package servidor

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"

	"facti/api/internal/auth"
	"facti/api/internal/datos"
)

// BaseDatosError indica que la base de datos no está configurada o no responde. Se traduce a HTTP 503.
type BaseDatosError struct{ Mensaje string }

func (e *BaseDatosError) Error() string { return e.Mensaje }

// ProveedorDatos devuelve la base de datos, o un error si no está disponible.
type ProveedorDatos func(ctx context.Context) (datos.Datos, error)

// DatosPerezosos se conecta a Postgres la primera vez que hace falta (no al arrancar), así la API
// levanta aunque todavía no esté la DATABASE_URL. Si falla, reintenta en el próximo pedido.
func DatosPerezosos(databaseURL string) ProveedorDatos {
	var (
		mu   sync.Mutex
		memo datos.Datos
	)
	return func(ctx context.Context) (datos.Datos, error) {
		mu.Lock()
		defer mu.Unlock()
		if memo != nil {
			return memo, nil
		}
		if databaseURL == "" {
			return nil, &BaseDatosError{Mensaje: "Falta la variable DATABASE_URL (la URL de conexión de Supabase, ver .env.example)"}
		}
		ctx, cancelar := context.WithTimeout(ctx, 15*time.Second)
		defer cancelar()
		d, err := datos.Conectar(ctx, databaseURL)
		if err != nil {
			return nil, &BaseDatosError{Mensaje: "No se pudo conectar con la base de datos: " + err.Error()}
		}
		memo = d
		return memo, nil
	}
}

// FijarDatos devuelve siempre la misma base (para tests).
func FijarDatos(d datos.Datos) ProveedorDatos {
	return func(context.Context) (datos.Datos, error) { return d, nil }
}

// Autenticador valida el token de sesión que manda la web (Supabase Auth).
type Autenticador interface {
	Verificar(ctx context.Context, token string) (auth.Usuario, error)
}

// errSinSesion se traduce a HTTP 401.
var errSinSesion = errors.New("Iniciá sesión para seguir.")

// usuario lee y valida el token "Authorization: Bearer ..." del pedido.
func (s *Servidor) usuario(r *http.Request) (auth.Usuario, error) {
	if s.auth == nil {
		return auth.Usuario{}, &ConfiguracionError{Mensaje: "Falta la variable NEXT_PUBLIC_SUPABASE_URL (la URL del proyecto de Supabase, ver .env.example)"}
	}
	token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if !ok || strings.TrimSpace(token) == "" {
		return auth.Usuario{}, errSinSesion
	}
	u, err := s.auth.Verificar(r.Context(), strings.TrimSpace(token))
	if err != nil {
		s.log.Info("sesión rechazada", "motivo", err)
		return auth.Usuario{}, errSinSesion
	}
	return u, nil
}

// cuenta devuelve la base y la cuenta del usuario que hace el pedido (la crea la primera vez).
func (s *Servidor) cuenta(r *http.Request) (datos.Datos, datos.Cuenta, error) {
	u, err := s.usuario(r)
	if err != nil {
		return nil, datos.Cuenta{}, err
	}
	d, err := s.datos(r.Context())
	if err != nil {
		return nil, datos.Cuenta{}, err
	}
	c, err := d.CuentaDeUsuario(r.Context(), u.ID, u.Email, s.puntoVenta)
	if err != nil {
		return nil, datos.Cuenta{}, &BaseDatosError{Mensaje: "No se pudo leer la cuenta: " + err.Error()}
	}
	return d, c, nil
}

// Limites del plan por mes. Nil = ilimitado.
type Limites struct {
	Facturas    int `json:"facturas"`
	Exportacion int `json:"exportacion"`
}

func limitesDe(p datos.Plan) *Limites {
	if p == datos.PlanPro {
		return nil
	}
	return &Limites{Facturas: 10, Exportacion: 1}
}

// mes devuelve el primer y el último día del mes de t, en hora de Argentina.
func mes(t time.Time) (desde, hasta string) {
	ini := time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, t.Location())
	return ini.Format("2006-01-02"), ini.AddDate(0, 1, -1).Format("2006-01-02")
}
