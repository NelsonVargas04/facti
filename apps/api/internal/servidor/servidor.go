// Package servidor arma la API HTTP de Facti: rutas, CORS y manejo de errores.
package servidor

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"facti/api/internal/arca"
	"facti/api/internal/datos"
)

// Servidor HTTP de la API.
type Servidor struct {
	arca        ProveedorArca
	datos       ProveedorDatos
	auth        Autenticador
	puntoVenta  int
	entorno     arca.Entorno
	origenesWeb []string
	log         *slog.Logger
	ahora       func() time.Time
}

// Opciones para construir el servidor.
type Opciones struct {
	Arca  ProveedorArca
	Datos ProveedorDatos
	// Auth valida las sesiones de Supabase. Si es nil, las rutas con datos responden 503.
	Auth Autenticador
	// Punto de venta con el que arrancan las cuentas nuevas.
	PuntoVenta  int
	Entorno     arca.Entorno
	OrigenesWeb []string // vacío = cualquier origen
	Log         *slog.Logger
	Ahora       func() time.Time // para tests
}

// Nuevo devuelve el http.Handler con todas las rutas.
func Nuevo(o Opciones) http.Handler {
	s := &Servidor{
		arca: o.Arca, datos: o.Datos, auth: o.Auth, puntoVenta: o.PuntoVenta,
		entorno: o.Entorno, origenesWeb: o.OrigenesWeb, log: o.Log, ahora: o.Ahora,
	}
	if s.puntoVenta == 0 {
		s.puntoVenta = 1
	}
	if s.log == nil {
		s.log = slog.Default()
	}
	if s.ahora == nil {
		s.ahora = time.Now
	}
	if s.datos == nil {
		s.datos = DatosPerezosos("")
	}

	mux := http.NewServeMux()
	// Rutas que no tocan ARCA: sirven para saber que el server está vivo.
	mux.HandleFunc("GET /{$}", s.raiz)
	mux.HandleFunc("GET /salud", s.salud)
	// Estado de ARCA: no necesita sesión. Si falta configuración, responde 503.
	mux.Handle("GET /arca/estado", s.ruta(s.arcaEstado))
	// El resto necesita sesión (401 si no hay) y, según la ruta, ARCA o la base (503 si faltan).
	mux.Handle("GET /arca/puntos-venta", s.ruta(s.arcaPuntosVenta))
	mux.Handle("GET /arca/condiciones-iva", s.ruta(s.arcaCondicionesIva))
	mux.Handle("GET /arca/padron/{cuit}", s.ruta(s.arcaPadron))
	mux.Handle("POST /facturas", s.ruta(s.emitirFactura))
	mux.Handle("GET /cuenta", s.ruta(s.verCuenta))
	mux.Handle("PUT /cuenta/cuit", s.ruta(s.asignarCuit))
	mux.Handle("GET /resumen", s.ruta(s.verResumen))
	mux.Handle("GET /comprobantes", s.ruta(s.listarComprobantes))
	mux.Handle("GET /comprobantes/{id}", s.ruta(s.verComprobante))
	mux.Handle("PATCH /comprobantes/{id}/cobro", s.ruta(s.marcarCobro))
	mux.Handle("GET /clientes", s.ruta(s.listarClientes))

	return s.registrar(s.cors(mux))
}

// manejador es una ruta que puede devolver un error de dominio.
type manejador func(w http.ResponseWriter, r *http.Request) error

func (s *Servidor) ruta(h manejador) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := h(w, r); err != nil {
			s.responderError(w, err)
		}
	})
}

// responderError traduce los errores de dominio a códigos HTTP claros.
func (s *Servidor) responderError(w http.ResponseWriter, err error) {
	var (
		conf         *ConfiguracionError
		base         *BaseDatosError
		sinRespuesta *arca.SinRespuestaError
		errArca      *arca.Error
		pedido       *errorPedido
	)
	switch {
	case errors.As(err, &pedido):
		cuerpo := map[string]any{"error": pedido.codigo, "mensaje": pedido.mensaje}
		for k, v := range pedido.extra {
			cuerpo[k] = v
		}
		responderJSON(w, pedido.estado, cuerpo)
	case errors.Is(err, errSinSesion):
		responderJSON(w, http.StatusUnauthorized, map[string]any{"error": "sin_sesion", "mensaje": errSinSesion.Error()})
	case errors.Is(err, datos.ErrNoEncontrado):
		responderJSON(w, http.StatusNotFound, map[string]any{"error": "no_encontrado", "mensaje": "No encontramos ese comprobante."})
	case errors.As(err, &conf):
		responderJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "configuracion", "mensaje": conf.Mensaje})
	case errors.As(err, &base):
		s.log.Error("base de datos", "error", err)
		responderJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "base_datos", "mensaje": base.Mensaje})
	case errors.As(err, &sinRespuesta):
		responderJSON(w, http.StatusGatewayTimeout, map[string]any{"error": "arca_sin_respuesta", "mensaje": sinRespuesta.Mensaje})
	case errors.As(err, &errArca):
		detalles := errArca.Detalles
		if detalles == nil {
			detalles = []arca.Detalle{}
		}
		responderJSON(w, http.StatusBadGateway, map[string]any{"error": "arca", "mensaje": errArca.Mensaje, "detalles": detalles})
	default:
		s.log.Error("error interno", "error", err)
		responderJSON(w, http.StatusInternalServerError, map[string]any{"error": "interno", "mensaje": err.Error()})
	}
}

// errorPedido es un error del cliente (datos inválidos) con su código HTTP.
type errorPedido struct {
	estado  int
	codigo  string
	mensaje string
	extra   map[string]any // campos adicionales en la respuesta
}

func (e *errorPedido) Error() string { return e.mensaje }

func pedidoInvalido(codigo, mensaje string) error {
	return &errorPedido{estado: http.StatusBadRequest, codigo: codigo, mensaje: mensaje}
}

func responderJSON(w http.ResponseWriter, estado int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(estado)
	_ = json.NewEncoder(w).Encode(v)
}

// cors permite que la web (apps/web, otro puerto) consuma la API desde el navegador.
func (s *Servidor) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origen := r.Header.Get("Origin")
		if origen != "" && (len(s.origenesWeb) == 0 || slices.Contains(s.origenesWeb, origen)) {
			h := w.Header()
			h.Set("Access-Control-Allow-Origin", origen)
			h.Add("Vary", "Origin")
			if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
				h.Set("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, PATCH, OPTIONS")
				if pedidos := r.Header.Get("Access-Control-Request-Headers"); pedidos != "" {
					h.Set("Access-Control-Allow-Headers", pedidos)
				}
				h.Set("Access-Control-Max-Age", "600")
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

type grabador struct {
	http.ResponseWriter
	estado int
}

func (g *grabador) WriteHeader(estado int) {
	g.estado = estado
	g.ResponseWriter.WriteHeader(estado)
}

// registrar deja una línea de log por pedido.
func (s *Servidor) registrar(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		inicio := time.Now()
		g := &grabador{ResponseWriter: w, estado: http.StatusOK}
		next.ServeHTTP(g, r)
		s.log.Info("pedido", "metodo", r.Method, "ruta", r.URL.Path, "estado", g.estado, "ms", time.Since(inicio).Milliseconds())
	})
}
