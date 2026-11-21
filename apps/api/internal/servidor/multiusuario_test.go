package servidor

import (
	"fmt"
	"net/http"
	"sort"
	"sync"
	"testing"

	"facti/api/internal/datos"
)

var comoMartin = []string{"Authorization", "Bearer martin"}

// dosUsuarios: Lucía y Martín, cada uno con su CUIT.
func dosUsuarios(t *testing.T) *entorno {
	t.Helper()
	e := entornoRecurrentes(t, "secreto-cron") // Lucía ya cargó su CUIT
	if res, j := pedir(t, e.h, "PUT", "/cuenta/cuit", `{"cuit":"20-22222222-3"}`, comoMartin...); res.StatusCode != 200 {
		t.Fatalf("CUIT de Martín: %d %v", res.StatusCode, j)
	}
	return e
}

func (e *entorno) comoMartin(t *testing.T, metodo, ruta, cuerpo string) (*http.Response, map[string]any) {
	t.Helper()
	return pedir(t, e.h, metodo, ruta, cuerpo, comoMartin...)
}

// Lo de Lucía no lo ve ni lo puede cambiar Martín, en ninguna pantalla nueva.
func TestDosUsuariosNoSeMezclan(t *testing.T) {
	e := dosUsuarios(t)

	// Lucía: una factura, una de todos los meses, comprobantes importados y el link del calendario.
	res, j := e.pedir(t, "POST", "/facturas", facturaLumen)
	if res.StatusCode != 200 {
		t.Fatalf("emitir: %d %v", res.StatusCode, j)
	}
	factura := int64(j["id"].(float64))
	_, j = e.pedir(t, "POST", "/recurrentes", fmt.Sprintf(`{"plantilla": %s, "dia": 1}`, facturaLumen))
	rec := int64(j["id"].(float64))
	csv := "Fecha;Tipo;Punto de Venta;Número Desde;Moneda;Imp. Total\n10/08/2026;11 - Factura C;1;40;$;30.000.000,00\n"
	if res, j := e.pedir(t, "POST", "/comprobantes/importar", csv); res.StatusCode != 200 {
		t.Fatalf("importar: %d %v", res.StatusCode, j)
	}
	_, j = e.pedir(t, "GET", "/calendario/enlace", "")
	icsLucia := j["url"].(string)

	// Martín no ve nada de eso.
	if _, j := e.comoMartin(t, "GET", "/comprobantes", ""); j["total"] != 0.0 {
		t.Errorf("Martín ve facturas ajenas: %v", j)
	}
	if _, j := e.comoMartin(t, "GET", "/recurrentes", ""); len(j["recurrentes"].([]any)) != 0 {
		t.Errorf("Martín ve recurrentes ajenas: %v", j)
	}
	if _, j := e.comoMartin(t, "GET", "/monotributo/topes", ""); j["externo"] != 0.0 || j["facti"] != 0.0 {
		t.Errorf("Martín ve facturación ajena en los topes: %v", j)
	}
	if _, j := e.comoMartin(t, "GET", "/calendario?dias=60", ""); j["cobrosOcultos"] != 0.0 {
		t.Errorf("Martín ve cobros ajenos: %v", j)
	} else {
		for _, x := range j["eventos"].([]any) {
			if ev := x.(map[string]any); ev["tipo"] == "factura_mensual" || ev["tipo"] == "cobro" {
				t.Errorf("Martín ve un evento ajeno: %v", ev)
			}
		}
	}
	if _, j := e.comoMartin(t, "GET", "/pagos", ""); j["suscripcion"] != nil || len(j["pagos"].([]any)) != 0 {
		t.Errorf("Martín ve pagos ajenos: %v", j)
	}

	// Ni puede tocarlo: todo da "no encontrado" (no "prohibido", para no confirmar que existe).
	for _, p := range []struct{ metodo, ruta, cuerpo string }{
		{"GET", fmt.Sprintf("/comprobantes/%d", factura), ""},
		{"PATCH", fmt.Sprintf("/comprobantes/%d/cobro", factura), `{"cobro":"cobrada"}`},
		{"GET", fmt.Sprintf("/recurrentes/%d", rec), ""},
		{"PATCH", fmt.Sprintf("/recurrentes/%d", rec), `{"activa": false}`},
		{"DELETE", fmt.Sprintf("/recurrentes/%d", rec), ""},
	} {
		if res, j := e.comoMartin(t, p.metodo, p.ruta, p.cuerpo); res.StatusCode != 404 {
			t.Errorf("Martín %s %s: %d %v", p.metodo, p.ruta, res.StatusCode, j)
		}
	}

	// Si Martín emite mandando el id de la recurrente de Lucía, su factura sale pero la de Lucía no se mueve.
	conID := facturaLumen[:len(facturaLumen)-1] + fmt.Sprintf(`, "recurrenteId": %d}`, rec)
	if res, j := e.comoMartin(t, "POST", "/facturas", conID); res.StatusCode != 200 {
		t.Fatalf("emitir Martín: %d %v", res.StatusCode, j)
	}
	if _, j := e.pedir(t, "GET", fmt.Sprintf("/recurrentes/%d", rec), ""); j["ultimaEmision"] != "" || j["proxima"] != "2026-11-01" {
		t.Errorf("la recurrente de Lucía se movió por una factura de Martín: %v", j)
	}

	// Lucía sigue viendo solo lo suyo, intacto.
	if _, j := e.pedir(t, "GET", "/comprobantes", ""); j["total"] != 1.0 {
		t.Errorf("Lucía: %v", j)
	}
	if _, j := e.pedir(t, "GET", fmt.Sprintf("/comprobantes/%d", factura), ""); j["comprobante"].(map[string]any)["cobro"] != "pendiente" {
		t.Errorf("la factura de Lucía cambió: %v", j)
	}

	// El link del calendario de Martín es otro y no muestra lo de Lucía.
	_, j = e.comoMartin(t, "GET", "/calendario/enlace", "")
	if j["url"] == icsLucia {
		t.Fatal("los dos usuarios tienen el mismo link de calendario")
	}
}

// Muchos pedidos a la vez, de los dos usuarios: ninguno se pierde ni se cruza.
func TestPedidosAlMismoTiempo(t *testing.T) {
	e := dosUsuarios(t)
	e.mem.CambiarPlan(1, datos.PlanPro)
	e.mem.CambiarPlan(2, datos.PlanPro)

	const porUsuario = 8
	var wg sync.WaitGroup
	errores := make(chan string, 2*porUsuario)
	for _, quien := range [][]string{comoLucia, comoMartin} {
		for i := 0; i < porUsuario; i++ {
			wg.Add(1)
			go func(h []string) {
				defer wg.Done()
				res, j := pedir(t, e.h, "POST", "/facturas", facturaLumen, h...)
				if res.StatusCode != 200 {
					errores <- fmt.Sprintf("%d %v", res.StatusCode, j)
				}
			}(quien)
		}
	}
	wg.Wait()
	close(errores)
	for err := range errores {
		t.Errorf("emisión simultánea: %s", err)
	}

	// Cada uno tiene sus 8, con números internos 1 a 8 sin repetir.
	for _, quien := range [][]string{comoLucia, comoMartin} {
		_, j := pedir(t, e.h, "GET", "/comprobantes?limite=50", "", quien...)
		if j["total"] != float64(porUsuario) {
			t.Fatalf("%s: %v facturas", quien[1], j["total"])
		}
		var internos []int
		for _, x := range j["comprobantes"].([]any) {
			internos = append(internos, int(x.(map[string]any)["numeroInterno"].(float64)))
		}
		sort.Ints(internos)
		for i, n := range internos {
			if n != i+1 {
				t.Fatalf("%s: números internos %v", quien[1], internos)
			}
		}
	}
	// ARCA numeró las 16 sin repetir (el número oficial es correlativo por punto de venta).
	if n := e.arca.ultimo.Load(); n != 2*porUsuario {
		t.Errorf("ARCA emitió %d, quería %d", n, 2*porUsuario)
	}
}

// En Gratis se puede tener 1 recurrente: aunque se manden varias a la vez, queda 1.
func TestLimiteDeRecurrentesConDobleClic(t *testing.T) {
	e := dosUsuarios(t)
	var wg sync.WaitGroup
	for i := 0; i < 6; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			pedir(t, e.h, "POST", "/recurrentes", fmt.Sprintf(`{"plantilla": %s, "dia": 3}`, facturaLumen), comoLucia...)
		}()
	}
	wg.Wait()
	if _, j := e.pedir(t, "GET", "/recurrentes", ""); len(j["recurrentes"].([]any)) != 1 {
		t.Fatalf("con doble clic quedaron %d recurrentes en Gratis", len(j["recurrentes"].([]any)))
	}
}

// Sin sesión, con una sesión inventada o vencida: nada de lo nuevo responde datos.
func TestSinSesionNoHayDatos(t *testing.T) {
	e := dosUsuarios(t)
	rutas := []struct{ metodo, ruta string }{
		{"GET", "/pagos"}, {"POST", "/pagos/suscripcion"}, {"POST", "/pagos/sincronizar"}, {"POST", "/pagos/cancelar"},
		{"GET", "/recurrentes"}, {"POST", "/recurrentes"}, {"GET", "/recurrentes/1"}, {"PATCH", "/recurrentes/1"}, {"DELETE", "/recurrentes/1"},
		{"GET", "/calendario"}, {"GET", "/calendario/enlace"}, {"POST", "/calendario/enlace"},
		{"GET", "/monotributo/topes"}, {"POST", "/comprobantes/importar"},
	}
	for _, r := range rutas {
		for _, cab := range [][]string{nil, {"Authorization", "Bearer inventado"}, {"Authorization", "Basic lucia"}} {
			res, j := pedir(t, e.h, r.metodo, r.ruta, `{}`, cab...)
			// /pagos/suscripcion sin Mercado Pago responde 503 antes de mirar la sesión: no expone datos.
			if res.StatusCode != http.StatusUnauthorized && !(res.StatusCode == 503 && j["error"] == "configuracion") {
				t.Errorf("%s %s con %v: %d %v", r.metodo, r.ruta, cab, res.StatusCode, j)
			}
		}
	}
	// El calendario .ics sin token o con uno inventado no muestra nada.
	for _, ruta := range []string{"/calendario.ics", "/calendario.ics?t=", "/calendario.ics?t=inventado"} {
		if res, _ := pedir(t, e.h, "GET", ruta, ""); res.StatusCode != 404 {
			t.Errorf("%s: %d", ruta, res.StatusCode)
		}
	}
	// El cron, sin su clave, no emite nada.
	for _, cab := range [][]string{nil, {"Authorization", "Bearer lucia"}} {
		if res, _ := pedir(t, e.h, "POST", "/recurrentes/procesar", "", cab...); res.StatusCode != 401 {
			t.Errorf("cron sin clave (%v): %d", cab, res.StatusCode)
		}
	}
}
