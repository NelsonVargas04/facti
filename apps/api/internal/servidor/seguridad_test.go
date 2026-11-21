package servidor

import (
	"net/http/httptest"
	"testing"

	"facti/api/internal/arca"
	"facti/api/internal/datos"
)

// Las respuestas llevan cabeceras de seguridad y, en producción sin WEB_ORIGIN, no se abre CORS.
func TestCabecerasYCorsEnProduccion(t *testing.T) {
	h := Nuevo(Opciones{Arca: sinConfigurar, Datos: FijarDatos(datos.NuevaMemoria()), Entorno: arca.Produccion})
	req := httptest.NewRequest("GET", "/salud", nil)
	req.Header.Set("Origin", "https://atacante.example")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	for k, v := range map[string]string{"X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Cache-Control": "no-store"} {
		if rec.Header().Get(k) != v {
			t.Errorf("%s = %q, se esperaba %q", k, rec.Header().Get(k), v)
		}
	}
	if o := rec.Header().Get("Access-Control-Allow-Origin"); o != "" {
		t.Errorf("en producción sin WEB_ORIGIN no se habilita ningún origen: %q", o)
	}
}

// La IP para el límite de pedidos no sale de X-Forwarded-For (lo puede inventar cualquiera).
func TestIPNoUsaXForwardedFor(t *testing.T) {
	r := httptest.NewRequest("POST", "/consumidor/solicitudes", nil)
	r.RemoteAddr = "10.0.0.7:1234"
	r.Header.Set("X-Forwarded-For", "1.2.3.4")
	if ip := ipDe(r); ip != "10.0.0.7" {
		t.Errorf("ip = %s", ip)
	}
	r.Header.Set("X-Vercel-Forwarded-For", "5.6.7.8")
	if ip := ipDe(r); ip != "5.6.7.8" {
		t.Errorf("en Vercel: ip = %s", ip)
	}
}

// Con facturas emitidas, la cuenta no puede pasar a otro CUIT.
func TestCuitFijoDespuesDeFacturar(t *testing.T) {
	e := nuevoEntorno(t, nil)
	if res, j := e.pedir(t, "PUT", "/cuenta/cuit", `{"cuit":"20-11111111-2"}`); res.StatusCode != 200 {
		t.Fatalf("mismo CUIT otra vez: %d %v", res.StatusCode, j)
	}
	if res, j := e.pedir(t, "POST", "/facturas", facturaLumen); res.StatusCode != 200 {
		t.Fatalf("emisión: %d %v", res.StatusCode, j)
	}
	if res, j := e.pedir(t, "PUT", "/cuenta/cuit", `{"cuit":"20-12345678-6"}`); res.StatusCode != 409 || j["error"] != "cuit_fijo" {
		t.Fatalf("cambiar de CUIT con facturas: %d %v", res.StatusCode, j)
	}
}
