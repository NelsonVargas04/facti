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
)

// Servidor HTTP de la API.
type Servidor struct {
	arca        ProveedorArca
	entorno     arca.Entorno
	origenesWeb []string
	log         *slog.Logger
	ahora       func() time.Time
}

// Opciones para construir el servidor.
type Opciones struct {
	Arca        ProveedorArca
	Entorno     arca.Entorno
	OrigenesWeb []string // vacío = cualquier origen
	Log         *slog.Logger
}

// Nuevo devuelve el http.Handler con todas las rutas.
func Nuevo(o Opciones) http.Handler {
	s := &Servidor{arca: o.Arca, entorno: o.Entorno, origenesWeb: o.OrigenesWeb, log: o.Log, ahora: time.Now}
	if s.log == nil {
		s.log = slog.Default()
	}

	mux := http.NewServeMux()
	// Rutas que no tocan ARCA: sirven para saber que el server está vivo.
	mux.HandleFunc("GET /{$}", s.raiz)
	mux.HandleFunc("GET /salud", s.salud)
	// Rutas que consultan ARCA. Si falta configuración, responden 503.
	mux.Handle("GET /arca/estado", s.ruta(s.arcaEstado))
	mux.Handle("GET /arca/puntos-venta", s.ruta(s.arcaPuntosVenta))
	mux.Handle("GET /arca/condiciones-iva", s.ruta(s.arcaCondicionesIva))
	mux.Handle("GET /arca/padron/{cuit}", s.ruta(s.arcaPadron))
	mux.Handle("POST /facturas", s.ruta(s.emitirFactura))

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
		sinRespuesta *arca.SinRespuestaError
		errArca      *arca.Error
		pedido       *errorPedido
	)
	switch {
	case errors.As(err, &pedido):
		responderJSON(w, pedido.estado, map[string]any{"error": pedido.codigo, "mensaje": pedido.mensaje})
	case errors.As(err, &conf):
		responderJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "configuracion", "mensaje": conf.Mensaje})
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
				h.Set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS")
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
