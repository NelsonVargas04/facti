package servidor

import (
	"context"
	"sync"
	"time"

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

// cuenta devuelve la base y la cuenta del emisor configurado.
// Por ahora hay un solo emisor (el del .env); con login va a salir de la sesión.
func (s *Servidor) cuenta(ctx context.Context) (datos.Datos, datos.Cuenta, error) {
	if s.cuitEmisor == "" {
		return nil, datos.Cuenta{}, &ConfiguracionError{Mensaje: "Falta la variable ARCA_CUIT_EMISOR (ver .env.example)"}
	}
	d, err := s.datos(ctx)
	if err != nil {
		return nil, datos.Cuenta{}, err
	}
	c, err := d.AsegurarCuenta(ctx, s.cuitEmisor, s.puntoVenta)
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
