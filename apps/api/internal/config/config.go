// Package config lee la configuración de la API desde el entorno y el .env del repo.
package config

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/joho/godotenv"

	"facti/api/internal/arca"
)

// Config de la API.
type Config struct {
	// Carpeta raíz del repo: ahí se busca el .env y contra ella se resuelven las rutas relativas.
	Raiz        string
	EnvCargado  string // ruta del .env leído, o "" si no había
	Puerto      int
	OrigenesWeb []string // vacío = cualquier origen
	// URL de conexión a Postgres (en producción, la de Supabase).
	DatabaseURL string
	// Proyecto de Supabase para validar las sesiones (https://xxxx.supabase.co) y, si el proyecto
	// todavía firma con el secreto legado (HS256), ese secreto.
	SupabaseURL       string
	SupabaseJWTSecret string

	Entorno         arca.Entorno
	CuitCertificado string
	CuitEmisor      string
	PuntoVenta      int
	CertPath        string
	KeyPath         string
	// Certificado y clave como contenido (PEM o PEM en base64), para hosts sin archivos como Vercel.
	// Si están, tienen prioridad sobre CertPath y KeyPath.
	CertPEM  string
	KeyPEM   string
	CacheDir string

	// Mercado Pago (cobro de Facti Pro). Sin token, la pantalla de pagos queda en vista previa.
	MPAccessToken   string
	MPWebhookSecret string
	// Precio de Pro en dólares (se cobra en pesos con el dólar del BCRA del día).
	PrecioProUSD float64
	// URL pública de la web: a dónde vuelve el usuario después de pagar.
	WebURL string
	// CronSecret: clave del cron diario que emite las facturas recurrentes automáticas.
	CronSecret string
	// AdminReportToken: clave del portal de administración para GET /api/admin/report.
	AdminReportToken string
	// Version: lo que se desplegó (FACTI_VERSION o, en Vercel, el commit).
	Version string
}

// Cargar busca el .env subiendo desde la carpeta actual (la API corre dentro de apps/api)
// y lo carga sin pisar variables que ya estén definidas en el entorno.
func Cargar() Config {
	dir, _ := os.Getwd()
	raiz, envPath := buscarRaiz(dir)
	if envPath != "" {
		_ = godotenv.Load(envPath)
	}

	c := Config{
		Raiz:       raiz,
		EnvCargado: envPath,
		// En Vercel (y otros hosts) el puerto lo asigna la plataforma en PORT.
		Puerto: entero(valor("PORT", os.Getenv("API_PORT")), 4000),
		// DATABASE_URL, o las que crea la integración de Supabase con Vercel (primero la de sesión).
		DatabaseURL: strings.TrimSpace(primera("DATABASE_URL", "POSTGRES_URL_NON_POOLING", "POSTGRES_URL")),
		// La web usa NEXT_PUBLIC_SUPABASE_URL; la API acepta la misma variable para no repetirla.
		SupabaseURL:       strings.TrimSpace(valor("SUPABASE_URL", os.Getenv("NEXT_PUBLIC_SUPABASE_URL"))),
		SupabaseJWTSecret: strings.TrimSpace(os.Getenv("SUPABASE_JWT_SECRET")),
		Entorno:           arca.Entorno(valor("ARCA_ENTORNO", string(arca.Homologacion))),
		CuitCertificado:   os.Getenv("ARCA_CUIT_CERTIFICADO"),
		CuitEmisor:        os.Getenv("ARCA_CUIT_EMISOR"),
		PuntoVenta:        entero(os.Getenv("ARCA_PUNTO_VENTA"), 1),
		CertPath:          enRaiz(raiz, os.Getenv("ARCA_CERT_PATH")),
		KeyPath:           enRaiz(raiz, os.Getenv("ARCA_KEY_PATH")),
		CertPEM:           strings.TrimSpace(os.Getenv("ARCA_CERT_PEM")),
		KeyPEM:            strings.TrimSpace(os.Getenv("ARCA_KEY_PEM")),
		CacheDir:          enRaiz(raiz, valor("ARCA_CACHE_DIR", ".cache")),
	}
	for _, o := range strings.Split(os.Getenv("WEB_ORIGIN"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			c.OrigenesWeb = append(c.OrigenesWeb, o)
		}
	}
	c.MPAccessToken = strings.TrimSpace(os.Getenv("MP_ACCESS_TOKEN"))
	c.MPWebhookSecret = strings.TrimSpace(os.Getenv("MP_WEBHOOK_SECRET"))
	c.CronSecret = strings.TrimSpace(os.Getenv("CRON_SECRET"))
	c.AdminReportToken = strings.TrimSpace(os.Getenv("ADMIN_REPORT_TOKEN"))
	c.Version = strings.TrimSpace(os.Getenv("FACTI_VERSION"))
	if sha := strings.TrimSpace(os.Getenv("VERCEL_GIT_COMMIT_SHA")); c.Version == "" && len(sha) >= 7 {
		c.Version = sha[:7]
	}
	c.PrecioProUSD = 10
	if v, err := strconv.ParseFloat(strings.TrimSpace(os.Getenv("FACTI_PRECIO_PRO_USD")), 64); err == nil && v > 0 {
		c.PrecioProUSD = v
	}
	// Por defecto, el primer origen permitido de la web (o la web local).
	c.WebURL = strings.TrimSpace(os.Getenv("WEB_URL"))
	if c.WebURL == "" && len(c.OrigenesWeb) > 0 {
		c.WebURL = c.OrigenesWeb[0]
	}
	return c
}

// buscarRaiz sube carpetas hasta encontrar un .env o el pnpm-workspace.yaml del monorepo.
func buscarRaiz(desde string) (raiz, env string) {
	for d := desde; ; {
		if _, err := os.Stat(filepath.Join(d, ".env")); err == nil {
			return d, filepath.Join(d, ".env")
		}
		if _, err := os.Stat(filepath.Join(d, "pnpm-workspace.yaml")); err == nil {
			return d, ""
		}
		padre := filepath.Dir(d)
		if padre == d {
			return desde, ""
		}
		d = padre
	}
}

// enRaiz resuelve una ruta relativa contra la raíz del repo (las rutas del .env son relativas a él).
func enRaiz(raiz, ruta string) string {
	if ruta == "" || filepath.IsAbs(ruta) {
		return ruta
	}
	return filepath.Join(raiz, ruta)
}

func valor(nombre, porDefecto string) string {
	if v := os.Getenv(nombre); v != "" {
		return v
	}
	return porDefecto
}

func entero(s string, porDefecto int) int {
	if n, err := strconv.Atoi(strings.TrimSpace(s)); err == nil {
		return n
	}
	return porDefecto
}

// primera devuelve el valor de la primera variable de entorno que no esté vacía.
func primera(nombres ...string) string {
	for _, n := range nombres {
		if v := strings.TrimSpace(os.Getenv(n)); v != "" {
			return v
		}
	}
	return ""
}
