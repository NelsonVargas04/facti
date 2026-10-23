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

	Entorno         arca.Entorno
	CuitCertificado string
	CuitEmisor      string
	PuntoVenta      int
	CertPath        string
	KeyPath         string
	CacheDir        string
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
		Raiz:            raiz,
		EnvCargado:      envPath,
		Puerto:          entero(os.Getenv("API_PORT"), 4000),
		DatabaseURL:     strings.TrimSpace(os.Getenv("DATABASE_URL")),
		Entorno:         arca.Entorno(valor("ARCA_ENTORNO", string(arca.Homologacion))),
		CuitCertificado: os.Getenv("ARCA_CUIT_CERTIFICADO"),
		CuitEmisor:      os.Getenv("ARCA_CUIT_EMISOR"),
		PuntoVenta:      entero(os.Getenv("ARCA_PUNTO_VENTA"), 1),
		CertPath:        enRaiz(raiz, os.Getenv("ARCA_CERT_PATH")),
		KeyPath:         enRaiz(raiz, os.Getenv("ARCA_KEY_PATH")),
		CacheDir:        enRaiz(raiz, valor("ARCA_CACHE_DIR", ".cache")),
	}
	for _, o := range strings.Split(os.Getenv("WEB_ORIGIN"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			c.OrigenesWeb = append(c.OrigenesWeb, o)
		}
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
