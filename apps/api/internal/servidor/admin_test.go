package servidor

import (
	"testing"
	"time"

	"facti/api/internal/datos"
)

func TestReporteAdmin(t *testing.T) {
	e := &entorno{arca: &arcaSimulado{}, mem: datos.NuevaMemoria()}
	cl := e.arca.clientes(t)
	e.h = Nuevo(Opciones{
		Arca: func() (*ClientesArca, error) { return cl, nil }, Datos: FijarDatos(e.mem), Auth: authFalso{},
		PuntoVenta: 3, Ahora: func() time.Time { return hoy }, Categorias: escalaFija{},
		AdminToken: "secreto-admin", Version: "abc1234",
	})
	if res, j := e.pedir(t, "PUT", "/cuenta/cuit", `{"cuit":"20-11111111-2"}`); res.StatusCode != 200 {
		t.Fatalf("cargar CUIT: %d %v", res.StatusCode, j)
	}
	if res, j := e.pedir(t, "POST", "/facturas", facturaLumen); res.StatusCode != 200 && res.StatusCode != 201 {
		t.Fatalf("emitir: %d %v", res.StatusCode, j)
	}

	// Sin token o con otro: 401. La sesión de un usuario tampoco alcanza.
	for _, h := range [][]string{nil, {"Authorization", "Bearer otro"}, comoLucia} {
		if res, _ := pedir(t, e.h, "GET", "/api/admin/report", "", h...); res.StatusCode != 401 {
			t.Fatalf("con %v: esperaba 401, vino %d", h, res.StatusCode)
		}
	}

	res, j := pedir(t, e.h, "GET", "/api/admin/report", "", "Authorization", "Bearer secreto-admin")
	if res.StatusCode != 200 {
		t.Fatalf("reporte: %d %v", res.StatusCode, j)
	}
	if uso := j["usage"].(map[string]any); uso["activeUsers"] != float64(1) {
		t.Errorf("activeUsers = %v, esperaba 1", uso["activeUsers"])
	}
	if b := j["billing"].(map[string]any); b["currency"] != "ARS" || b["revenueMonth"] != float64(0) {
		t.Errorf("billing = %v", b)
	}
	if v := j["environments"].(map[string]any)["staging"].(map[string]any)["version"]; v != "abc1234" {
		t.Errorf("version = %v", v)
	}
	esperado := map[string]float64{"Cuentas": 1, "Con CUIT cargado": 1, "Pro": 0, "Comprobantes del mes": 1, "Comprobantes (30 días)": 1}
	for _, m := range j["metrics"].([]any) {
		m := m.(map[string]any)
		if want, ok := esperado[m["label"].(string)]; ok && m["value"] != want {
			t.Errorf("%s = %v, esperaba %v", m["label"], m["value"], want)
		}
	}
}

func TestReporteAdminSinToken(t *testing.T) {
	h := Nuevo(Opciones{Arca: sinConfigurar, Datos: FijarDatos(datos.NuevaMemoria())})
	if res, _ := pedir(t, h, "GET", "/api/admin/report", "", "Authorization", "Bearer "); res.StatusCode != 503 {
		t.Fatalf("sin ADMIN_REPORT_TOKEN: esperaba 503, vino %d", res.StatusCode)
	}
}
