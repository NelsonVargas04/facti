package servidor

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"facti/api/internal/datos"
)

func entornoRecurrentes(t *testing.T, secreto string) *entorno {
	t.Helper()
	e := &entorno{arca: &arcaSimulado{}, mem: datos.NuevaMemoria()}
	cl := e.arca.clientes(t)
	e.h = Nuevo(Opciones{
		Arca: func() (*ClientesArca, error) { return cl, nil }, Datos: FijarDatos(e.mem), Auth: authFalso{},
		PuntoVenta: 3, Ahora: func() time.Time { return hoy }, Categorias: escalaFija{}, CronSecret: secreto,
	})
	if res, j := e.pedir(t, "PUT", "/cuenta/cuit", `{"cuit":"20-11111111-2"}`); res.StatusCode != 200 {
		t.Fatalf("cargar CUIT: %d %v", res.StatusCode, j)
	}
	return e
}

func TestFacturaRecurrente(t *testing.T) {
	e := entornoRecurrentes(t, "")

	// Crear: la próxima es el día elegido del mes que viene (hoy es 22/10/2026).
	res, j := e.pedir(t, "POST", "/recurrentes", fmt.Sprintf(`{"plantilla": %s, "dia": 1}`, facturaLumen))
	if res.StatusCode != http.StatusCreated || j["cliente"] != "ESTUDIO LUMEN SRL" || j["total"] != 85000.0 || j["proxima"] != "2026-11-01" || j["pendiente"] != false || j["automatica"] != false {
		t.Fatalf("crear: %d %v", res.StatusCode, j)
	}
	id := int64(j["id"].(float64))

	// Validaciones y límite del plan Gratis (1 recurrente).
	if res, _ := e.pedir(t, "POST", "/recurrentes", fmt.Sprintf(`{"plantilla": %s, "dia": 31}`, facturaLumen)); res.StatusCode != 400 {
		t.Errorf("día 31: %d", res.StatusCode)
	}
	if res, j := e.pedir(t, "POST", "/recurrentes", fmt.Sprintf(`{"plantilla": %s, "dia": 5}`, facturaLumen)); res.StatusCode != 403 || j["error"] != "limite_plan" {
		t.Errorf("segunda en Gratis: %d %v", res.StatusCode, j)
	}

	// Cambiar el día a 25: la próxima era en noviembre, así que pasa al 25/11.
	res, j = e.pedir(t, "PATCH", fmt.Sprintf("/recurrentes/%d", id), `{"dia": 25}`)
	if res.StatusCode != 200 || j["dia"] != 25.0 || j["proxima"] != "2026-11-25" {
		t.Fatalf("cambiar día: %d %v", res.StatusCode, j)
	}

	// Emitirla desde la web (modo "confirmar"): se manda recurrenteId y pasa al mes siguiente.
	conID := facturaLumen[:len(facturaLumen)-1] + fmt.Sprintf(`, "recurrenteId": %d}`, id)
	if res, j := e.pedir(t, "POST", "/facturas", conID); res.StatusCode != 200 {
		t.Fatalf("emitir: %d %v", res.StatusCode, j)
	}
	_, j = e.pedir(t, "GET", fmt.Sprintf("/recurrentes/%d", id), "")
	if j["ultimaEmision"] != "2026-10-12" || j["proxima"] != "2026-11-25" || j["ultimoComprobanteId"] == nil {
		t.Fatalf("después de emitir: %v", j)
	}

	// Pausar: deja de estar activa. Listar trae el límite del plan.
	if res, j := e.pedir(t, "PATCH", fmt.Sprintf("/recurrentes/%d", id), `{"activa": false}`); res.StatusCode != 200 || j["activa"] != false {
		t.Fatalf("pausar: %d %v", res.StatusCode, j)
	}
	_, j = e.pedir(t, "GET", "/recurrentes", "")
	if rs, _ := j["recurrentes"].([]any); len(rs) != 1 || j["limite"] != 1.0 {
		t.Fatalf("listar: %v", j)
	}

	if res, _ := e.pedir(t, "DELETE", fmt.Sprintf("/recurrentes/%d", id), ""); res.StatusCode != http.StatusNoContent {
		t.Fatalf("borrar: %d", res.StatusCode)
	}
	if res, _ := e.pedir(t, "GET", fmt.Sprintf("/recurrentes/%d", id), ""); res.StatusCode != 404 {
		t.Fatalf("borrada: %d", res.StatusCode)
	}
}

func TestRecurrenteAutomatica(t *testing.T) {
	e := entornoRecurrentes(t, "secreto-cron")
	res, j := e.pedir(t, "POST", "/recurrentes", fmt.Sprintf(`{"plantilla": %s, "dia": 22, "automatica": true}`, facturaLumen))
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("crear: %d %v", res.StatusCode, j)
	}
	id := int64(j["id"].(float64))
	// La ponemos para hoy (22/10): el cron la tiene que emitir sola.
	cuentaID := int64(1)
	rec, _ := e.mem.VerRecurrente(t.Context(), cuentaID, id)
	rec.Proxima = "2026-10-22"
	if _, err := e.mem.ActualizarRecurrente(t.Context(), cuentaID, rec); err != nil {
		t.Fatal(err)
	}
	if _, j := e.pedir(t, "GET", "/recurrentes", ""); j["recurrentes"].([]any)[0].(map[string]any)["pendiente"] != true {
		t.Fatalf("tendría que estar pendiente: %v", j)
	}

	// Sin la clave del cron no se puede.
	if res, _ := pedir(t, e.h, "POST", "/recurrentes/procesar", "", "Authorization", "Bearer otra"); res.StatusCode != 401 {
		t.Fatalf("sin clave: %d", res.StatusCode)
	}
	res, j = pedir(t, e.h, "POST", "/recurrentes/procesar", "", "Authorization", "Bearer secreto-cron")
	if res.StatusCode != 200 || j["emitidas"] != 1.0 || j["conError"] != 0.0 {
		t.Fatalf("procesar: %d %v", res.StatusCode, j)
	}
	_, j = e.pedir(t, "GET", fmt.Sprintf("/recurrentes/%d", id), "")
	if j["ultimaEmision"] != "2026-10-22" || j["proxima"] != "2026-11-22" || j["pendiente"] != false {
		t.Fatalf("después del cron: %v", j)
	}
	// La factura quedó con la fecha de hoy y el período del mes.
	_, j = e.pedir(t, "GET", fmt.Sprintf("/comprobantes/%d", int64(j["ultimoComprobanteId"].(float64))), "")
	c := j["comprobante"].(map[string]any)
	if c["fecha"] != "2026-10-22" || c["periodo"].(map[string]any)["desde"] != "2026-10-01" || c["total"] != 85000.0 {
		t.Fatalf("comprobante automático: %v", c)
	}
	// Si el cron corre otra vez el mismo día, no emite de nuevo.
	_, j = pedir(t, e.h, "POST", "/recurrentes/procesar", "", "Authorization", "Bearer secreto-cron")
	if j["emitidas"] != 0.0 {
		t.Fatalf("segunda corrida: %v", j)
	}
}
