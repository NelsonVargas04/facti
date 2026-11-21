// Package servidor arma la API HTTP de Facti: rutas, CORS y manejo de errores.
package servidor

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"facti/api/internal/arca"
	"facti/api/internal/datos"
	"facti/api/internal/monotributo"
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
	// limiteSolicitudes: hasta 5 pedidos de arrepentimiento o baja por hora y por IP.
	limiteSolicitudes limitador
	// categorias: tabla oficial de monotributo, leída de ARCA con caché.
	categorias interface {
		Escala(ctx context.Context) monotributo.Escala
	}
	// Cobro de Facti Pro con Mercado Pago (nil = no configurado: la web muestra la vista previa).
	mp           CobradorPro
	mpSecreto    string
	cotizador    Cotizador
	precioProUSD float64
	webURL       string
	// cronSecreto protege POST /recurrentes/procesar (lo llama el cron diario).
	cronSecreto string
	// adminToken protege GET /api/admin/report (lo llama el portal de administración).
	adminToken string
	version    string
	inicio     time.Time
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
	// Categorias: de dónde sale la tabla de monotributo. Si es nil, se usa la de ARCA (monotributo.NuevaFuente).
	Categorias interface {
		Escala(ctx context.Context) monotributo.Escala
	}
	// MercadoPago cobra Pro; nil = todavía no está configurado.
	MercadoPago CobradorPro
	// MPWebhookSecret valida la firma de los webhooks (en producción es obligatoria).
	MPWebhookSecret string
	Cotizador       Cotizador
	PrecioProUSD    float64 // 10 si no se indica
	// WebURL: a dónde vuelve el usuario después de pagar en Mercado Pago.
	WebURL string
	// CronSecret: clave del cron que emite las facturas recurrentes automáticas (vacía = desactivado).
	CronSecret string
	// AdminToken: clave del portal de administración (vacía = reporte desactivado).
	AdminToken string
	// Version que informa el reporte de administración (por ejemplo, el commit desplegado).
	Version string
}

// Nuevo devuelve el http.Handler con todas las rutas.
func Nuevo(o Opciones) http.Handler {
	s := &Servidor{
		arca: o.Arca, datos: o.Datos, auth: o.Auth, puntoVenta: o.PuntoVenta,
		entorno: o.Entorno, origenesWeb: o.OrigenesWeb, log: o.Log, ahora: o.Ahora,
		limiteSolicitudes: limitador{max: 5, ventana: time.Hour},
		categorias:        o.Categorias,
		mp:                o.MercadoPago, mpSecreto: o.MPWebhookSecret, cotizador: o.Cotizador,
		precioProUSD: o.PrecioProUSD, webURL: o.WebURL, cronSecreto: o.CronSecret,
		adminToken: o.AdminToken, version: o.Version, inicio: time.Now(),
	}
	if s.precioProUSD == 0 {
		s.precioProUSD = 10
	}
	if s.webURL == "" {
		s.webURL = "http://localhost:3000"
	}
	if s.categorias == nil {
		s.categorias = monotributo.NuevaFuente()
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
	// Botón de arrepentimiento y de baja: sin sesión (Disposición 954/2025).
	mux.Handle("POST /consumidor/solicitudes", s.ruta(s.crearSolicitud))
	// Tabla oficial de categorías de monotributo (pública, se actualiza sola desde ARCA).
	mux.HandleFunc("GET /monotributo/categorias", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "public, max-age=3600")
		responderJSON(w, http.StatusOK, s.categorias.Escala(r.Context()))
	})
	// El resto necesita sesión (401 si no hay) y, según la ruta, ARCA o la base (503 si faltan).
	mux.Handle("GET /arca/puntos-venta", s.ruta(s.arcaPuntosVenta))
	mux.Handle("GET /arca/condiciones-iva", s.ruta(s.arcaCondicionesIva))
	mux.Handle("GET /arca/padron/{cuit}", s.ruta(s.arcaPadron))
	mux.Handle("POST /facturas", s.ruta(s.emitirFactura))
	mux.Handle("GET /cuenta", s.ruta(s.verCuenta))
	mux.Handle("PUT /cuenta/cuit", s.ruta(s.asignarCuit))
	mux.Handle("PUT /cuenta/perfil", s.ruta(s.cargarPerfil))
	mux.Handle("GET /resumen", s.ruta(s.verResumen))
	mux.Handle("GET /comprobantes", s.ruta(s.listarComprobantes))
	mux.Handle("GET /comprobantes/{id}", s.ruta(s.verComprobante))
	mux.Handle("PATCH /comprobantes/{id}/cobro", s.ruta(s.marcarCobro))
	mux.Handle("POST /comprobantes/{id}/nota-credito", s.ruta(s.emitirNotaCredito))
	mux.Handle("GET /clientes", s.ruta(s.listarClientes))
	mux.Handle("POST /comprobantes/importar", s.ruta(s.importarComprobantes))
	mux.Handle("GET /monotributo/topes", s.ruta(s.verTopes))
	// Plan Pro con Mercado Pago. El webhook no tiene sesión: valida la firma y consulta a Mercado Pago.
	mux.Handle("GET /pagos", s.ruta(s.verPagos))
	mux.Handle("POST /pagos/suscripcion", s.ruta(s.suscribirse))
	mux.Handle("POST /pagos/sincronizar", s.ruta(s.sincronizarPagos))
	mux.Handle("POST /pagos/cancelar", s.ruta(s.cancelarPro))
	mux.HandleFunc("POST /webhooks/mercadopago", s.webhookMercadoPago)
	// Facturas recurrentes. "procesar" es del cron (sin sesión, con CRON_SECRET).
	// Calendario: vencimientos + facturas de todos los meses + cobros (Pro). El .ics va sin sesión (con token).
	mux.Handle("GET /calendario", s.ruta(s.verCalendario))
	mux.Handle("GET /calendario/enlace", s.ruta(s.enlaceCalendario))
	mux.Handle("POST /calendario/enlace", s.ruta(s.enlaceCalendario))
	mux.HandleFunc("GET /calendario.ics", s.calendarioICS)
	mux.Handle("GET /recurrentes", s.ruta(s.listarRecurrentes))
	mux.Handle("POST /recurrentes", s.ruta(s.crearRecurrente))
	mux.Handle("POST /recurrentes/procesar", s.ruta(s.procesarRecurrentes))
	mux.Handle("GET /recurrentes/procesar", s.ruta(s.procesarRecurrentes)) // los cron de Vercel llaman con GET
	mux.Handle("GET /recurrentes/{id}", s.ruta(s.verRecurrente))
	mux.Handle("PATCH /recurrentes/{id}", s.ruta(s.cambiarRecurrente))
	mux.Handle("DELETE /recurrentes/{id}", s.ruta(s.borrarRecurrente))
	// Portal de administración: métricas globales (sin sesión, con ADMIN_REPORT_TOKEN).
	mux.Handle("GET /api/admin/report", s.ruta(s.reporteAdmin))

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
				h.Set("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS")
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
