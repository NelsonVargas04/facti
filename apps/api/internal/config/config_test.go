package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCargarDesdeAppsApi(t *testing.T) {
	raiz := t.TempDir()
	api := filepath.Join(raiz, "apps", "api")
	if err := os.MkdirAll(api, 0o755); err != nil {
		t.Fatal(err)
	}
	env := "ARCA_CUIT_CERTIFICADO=20111111112\nARCA_CERT_PATH=certs/homologacion.crt\nAPI_PORT=4100\nWEB_ORIGIN=http://localhost:3000, http://127.0.0.1:3000\n"
	if err := os.WriteFile(filepath.Join(raiz, ".env"), []byte(env), 0o600); err != nil {
		t.Fatal(err)
	}
	for _, v := range []string{"ARCA_CUIT_CERTIFICADO", "ARCA_CERT_PATH", "ARCA_CACHE_DIR", "API_PORT", "WEB_ORIGIN"} {
		t.Setenv(v, "")
		os.Unsetenv(v)
	}
	t.Chdir(api)

	c := Cargar()
	if c.EnvCargado != filepath.Join(raiz, ".env") || c.CuitCertificado != "20111111112" || c.Puerto != 4100 {
		t.Errorf("no leyó el .env de la raíz: %+v", c)
	}
	// Las rutas relativas del .env se resuelven contra la raíz del repo, no contra apps/api.
	if c.CertPath != filepath.Join(raiz, "certs", "homologacion.crt") || c.CacheDir != filepath.Join(raiz, ".cache") {
		t.Errorf("rutas: cert=%s cache=%s", c.CertPath, c.CacheDir)
	}
	if len(c.OrigenesWeb) != 2 || c.OrigenesWeb[1] != "http://127.0.0.1:3000" {
		t.Errorf("orígenes: %v", c.OrigenesWeb)
	}
	if c.Entorno != "homologacion" || c.PuntoVenta != 1 {
		t.Errorf("valores por defecto: %+v", c)
	}
}
