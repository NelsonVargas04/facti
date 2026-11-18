package servidor

import (
	"fmt"
	"io"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"facti/api/internal/datos"
)

func TestCalendario(t *testing.T) {
	e := entornoRecurrentes(t, "")
	// Una factura con vencimiento de pago el 24/10 (pendiente) y una de todos los meses el día 1.
	if res, j := e.pedir(t, "POST", "/facturas", facturaLumen); res.StatusCode != 200 {
		t.Fatalf("emitir: %d %v", res.StatusCode, j)
	}
	if res, j := e.pedir(t, "POST", "/recurrentes", fmt.Sprintf(`{"plantilla": %s, "dia": 1}`, facturaLumen)); res.StatusCode != 201 {
		t.Fatalf("recurrente: %d %v", res.StatusCode, j)
	}

	// Gratis: el cobro no se ve (es de Pro), pero se cuenta para invitar a pasarse.
	res, j := e.pedir(t, "GET", "/calendario?dias=60", "")
	if res.StatusCode != 200 || j["cobrosOcultos"] != 1.0 {
		t.Fatalf("calendario gratis: %d %v", res.StatusCode, j)
	}
	tipos := map[string]string{}
	for _, x := range j["eventos"].([]any) {
		ev := x.(map[string]any)
		tipos[ev["fecha"].(string)+" "+ev["tipo"].(string)] = ev["titulo"].(string)
	}
	if tipos["2026-11-01 factura_mensual"] != "Facturarle a ESTUDIO LUMEN SRL" {
		t.Errorf("falta la factura mensual: %v", tipos)
	}
	if _, ok := tipos["2026-10-24 cobro"]; ok {
		t.Errorf("en Gratis no se ven los cobros: %v", tipos)
	}

	// Pro: se ve el cobro.
	e.mem.CambiarPlan(1, datos.PlanPro)
	_, j = e.pedir(t, "GET", "/calendario?dias=60", "")
	vio := false
	for _, x := range j["eventos"].([]any) {
		if ev := x.(map[string]any); ev["tipo"] == "cobro" && ev["fecha"] == "2026-10-24" {
			vio = true
		}
	}
	if !vio || j["cobrosOcultos"] != 0.0 {
		t.Fatalf("calendario Pro: %v", j)
	}

	// Link para suscribirse: el .ics se baja sin sesión, con el token.
	_, j = e.pedir(t, "GET", "/calendario/enlace", "")
	u, err := url.Parse(j["url"].(string))
	if err != nil || u.Path != "/calendario.ics" || u.Query().Get("t") == "" {
		t.Fatalf("enlace: %v", j)
	}
	ics := bajar(t, e, u.RequestURI())
	for _, quiero := range []string{"BEGIN:VCALENDAR", "BEGIN:VEVENT", "SUMMARY:Facturarle a ESTUDIO LUMEN SRL", "DTSTART;VALUE=DATE:20261101", "SUMMARY:Te tiene que pagar ESTUDIO LUMEN SRL", "END:VCALENDAR"} {
		if !strings.Contains(ics, quiero) {
			t.Errorf("al .ics le falta %q", quiero)
		}
	}
	for _, l := range strings.Split(ics, "\r\n") {
		if len(l) > 75 {
			t.Errorf("línea de más de 75 bytes: %q", l)
		}
	}

	// Renovar el link invalida el anterior.
	_, j = e.pedir(t, "POST", "/calendario/enlace", "")
	if j["url"] == u.String() {
		t.Fatal("renovar tiene que dar otro link")
	}
	req := httptest.NewRequest("GET", u.RequestURI(), nil)
	rec := httptest.NewRecorder()
	e.h.ServeHTTP(rec, req)
	if rec.Code != 404 {
		t.Fatalf("link viejo: %d", rec.Code)
	}
}

func bajar(t *testing.T, e *entorno, ruta string) string {
	t.Helper()
	rec := httptest.NewRecorder()
	e.h.ServeHTTP(rec, httptest.NewRequest("GET", ruta, nil))
	if rec.Code != 200 || !strings.HasPrefix(rec.Header().Get("Content-Type"), "text/calendar") {
		t.Fatalf("bajar %s: %d %s", ruta, rec.Code, rec.Header().Get("Content-Type"))
	}
	b, _ := io.ReadAll(rec.Body)
	return string(b)
}
