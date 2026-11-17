package servidor

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/mail"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"facti/api/internal/cuit"
	"facti/api/internal/datos"
)

// Botón de arrepentimiento y botón de baja de servicio (Ley 24.240, art. 10 ter y 34; Disposición
// SSDCyLC 954/2025). Se usan sin iniciar sesión y sin trámites previos: la API guarda el pedido y le
// devuelve al consumidor, en el momento, un código que identifica la solicitud.

// Letras y números sin los que se confunden (0/O, 1/I/L).
const alfabetoCodigo = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

func codigoSolicitud(tipo string) string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	for i := range b {
		b[i] = alfabetoCodigo[int(b[i])%len(alfabetoCodigo)]
	}
	prefijo := "BAJ"
	if tipo == datos.SolicitudArrepentimiento {
		prefijo = "ARR"
	}
	return prefijo + "-" + string(b[:4]) + "-" + string(b[4:])
}

// limitador frena a quien manda muchos pedidos seguidos desde la misma IP (por instancia de la API).
type limitador struct {
	mu      sync.Mutex
	pedidos map[string][]time.Time
	max     int
	ventana time.Duration
}

func (l *limitador) permitir(clave string, ahora time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.pedidos == nil {
		l.pedidos = map[string][]time.Time{}
	}
	recientes := l.pedidos[clave][:0]
	for _, t := range l.pedidos[clave] {
		if ahora.Sub(t) < l.ventana {
			recientes = append(recientes, t)
		}
	}
	if len(recientes) >= l.max {
		l.pedidos[clave] = recientes
		return false
	}
	l.pedidos[clave] = append(recientes, ahora)
	return true
}

func ipDe(r *http.Request) string {
	if f := r.Header.Get("X-Forwarded-For"); f != "" {
		return strings.TrimSpace(strings.Split(f, ",")[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func (s *Servidor) crearSolicitud(w http.ResponseWriter, r *http.Request) error {
	var body struct {
		Tipo    string `json:"tipo"`
		Nombre  string `json:"nombre"`
		Email   string `json:"email"`
		Cuit    string `json:"cuit"`
		Detalle string `json:"detalle"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&body); err != nil {
		return pedidoInvalido("solicitud_invalida", "No pudimos leer el pedido.")
	}
	sol := datos.Solicitud{
		Tipo:    strings.TrimSpace(body.Tipo),
		Nombre:  strings.TrimSpace(body.Nombre),
		Email:   strings.ToLower(strings.TrimSpace(body.Email)),
		Cuit:    strings.TrimSpace(body.Cuit),
		Detalle: strings.TrimSpace(body.Detalle),
	}
	if sol.Tipo != datos.SolicitudArrepentimiento && sol.Tipo != datos.SolicitudBaja {
		return pedidoInvalido("solicitud_invalida", "Elegí si querés arrepentirte de una contratación o dar de baja el servicio.")
	}
	if n := utf8.RuneCountInString(sol.Nombre); n < 2 || n > 120 {
		return pedidoInvalido("nombre_invalido", "Escribí tu nombre y apellido.")
	}
	if a, err := mail.ParseAddress(sol.Email); err != nil || a.Address != sol.Email || len(sol.Email) > 200 || !strings.Contains(sol.Email[strings.LastIndex(sol.Email, "@"):], ".") {
		return pedidoInvalido("email_invalido", "Revisá el email: es donde te escribimos sobre tu pedido.")
	}
	if sol.Cuit != "" {
		if !cuit.Validar(sol.Cuit) {
			return pedidoInvalido("cuit_invalido", "Revisá el CUIT: tiene que tener 11 números y un dígito verificador válido. Si no lo sabés, dejalo vacío.")
		}
		sol.Cuit = cuit.Limpiar(sol.Cuit)
	}
	if utf8.RuneCountInString(sol.Detalle) > 1000 {
		return pedidoInvalido("detalle_invalido", "El comentario puede tener hasta 1000 caracteres.")
	}
	if !s.limiteSolicitudes.permitir(ipDe(r), s.ahora()) {
		return &errorPedido{estado: http.StatusTooManyRequests, codigo: "demasiados_pedidos", mensaje: "Recibimos varios pedidos seguidos desde tu conexión. Probá de nuevo en un rato o escribinos por email."}
	}
	// La sesión es opcional: si la hay, el pedido queda asociado a la cuenta.
	if r.Header.Get("Authorization") != "" {
		if u, err := s.usuario(r); err == nil {
			sol.UsuarioID = u.ID
		}
	}
	d, err := s.datos(r.Context())
	if err != nil {
		return err
	}
	for intento := 0; ; intento++ {
		sol.Codigo = codigoSolicitud(sol.Tipo)
		err = d.GuardarSolicitud(r.Context(), &sol)
		if !errors.Is(err, datos.ErrCodigoRepetido) || intento == 4 {
			break
		}
	}
	if err != nil {
		return &BaseDatosError{Mensaje: "No se pudo guardar el pedido: " + err.Error()}
	}
	s.log.Info("solicitud del consumidor", "tipo", sol.Tipo, "codigo", sol.Codigo, "con_sesion", sol.UsuarioID != "")
	responderJSON(w, http.StatusCreated, map[string]any{"codigo": sol.Codigo, "tipo": sol.Tipo, "creadaEn": sol.CreadaEn})
	return nil
}
