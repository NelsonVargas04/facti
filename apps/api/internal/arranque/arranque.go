// Package arranque arma el handler de la API a partir de la configuración. Lo usan el servidor
// local (cmd/api) y la función de Vercel (api/index.go), así los dos se comportan igual.
package arranque

import (
	"errors"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"facti/api/internal/auth"
	"facti/api/internal/config"
	"facti/api/internal/cotizacion"
	"facti/api/internal/demo"
	"facti/api/internal/mercadopago"
	"facti/api/internal/servidor"
)

// Armar lee la configuración y devuelve el handler con todas las rutas.
// conDemo habilita FACTI_DEMO=1 (cuenta de prueba en memoria); en Vercel va siempre en false.
func Armar(log *slog.Logger, conDemo bool) (http.Handler, config.Config, error) {
	cfg := config.Cargar()

	if cfg.EnvCargado != "" {
		log.Info("configuración leída", "env", cfg.EnvCargado)
	}
	if cfg.DatabaseURL == "" {
		log.Warn("falta DATABASE_URL: las facturas, clientes y cobros no se pueden guardar ni leer")
	}
	if cfg.Entorno == "produccion" {
		log.Warn("ATENCIÓN: ARCA en PRODUCCIÓN. Los comprobantes son reales.")
	}
	// Sin Supabase no hay sesiones: las rutas con datos responden 503 hasta configurarlo.
	var autenticador servidor.Autenticador
	if cfg.SupabaseURL != "" {
		autenticador = auth.NuevoSupabase(cfg.SupabaseURL, cfg.SupabaseJWTSecret)
	} else {
		log.Warn("falta SUPABASE_URL: nadie puede iniciar sesión")
	}

	datosApp := servidor.DatosPerezosos(cfg.DatabaseURL)
	// Si hay base, ARCA guarda ahí los tickets del WSAA y los bloqueos (sirve con varias instancias).
	var datosArca servidor.ProveedorDatos
	if cfg.DatabaseURL != "" {
		datosArca = datosApp
	}
	// Modo demo (solo en la compu): cuenta de prueba en memoria, sin Supabase ni Postgres.
	if conDemo && os.Getenv("FACTI_DEMO") == "1" {
		if cfg.Entorno == "produccion" {
			return nil, cfg, errors.New("FACTI_DEMO no se puede usar con ARCA_ENTORNO=produccion")
		}
		m, err := demo.Datos(cfg.PuntoVenta, cfg.CuitEmisor, os.Getenv("FACTI_DEMO_NOMBRE"))
		if err != nil {
			return nil, cfg, err
		}
		datosApp = servidor.FijarDatos(m)
		datosArca = nil
		autenticador = demo.Autenticador{}
		log.Warn("MODO DEMO: cuenta de prueba en memoria (se borra al reiniciar), sin Supabase ni base de datos")
	}

	// Mercado Pago: sin token, la pantalla "Plan y pagos" queda en vista previa (no cobra nada).
	var mp servidor.CobradorPro
	if cfg.MPAccessToken != "" {
		mp = mercadopago.Nuevo(cfg.MPAccessToken, "")
		if strings.HasPrefix(cfg.MPAccessToken, "TEST-") {
			log.Info("Mercado Pago en modo de prueba (credenciales TEST-)")
		} else if cfg.MPWebhookSecret == "" {
			log.Warn("falta MP_WEBHOOK_SECRET: los avisos de Mercado Pago no se pueden validar")
		}
	}

	h := servidor.Nuevo(servidor.Opciones{
		Arca:        servidor.ClientesPerezosos(cfg, datosArca),
		Datos:       datosApp,
		Auth:        autenticador,
		PuntoVenta:  cfg.PuntoVenta,
		Entorno:     cfg.Entorno,
		OrigenesWeb: cfg.OrigenesWeb,
		Log:         log,

		MercadoPago:     mp,
		MPWebhookSecret: cfg.MPWebhookSecret,
		Cotizador:       cotizacion.Nueva(""),
		PrecioProUSD:    cfg.PrecioProUSD,
		WebURL:          cfg.WebURL,
		CronSecret:      cfg.CronSecret,
		AdminToken:      cfg.AdminReportToken,
		Version:         cfg.Version,
	})
	return h, cfg, nil
}
