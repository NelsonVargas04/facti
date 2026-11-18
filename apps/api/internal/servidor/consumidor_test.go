package servidor

import (
	"context"
	"regexp"
	"testing"

	"facti/api/internal/datos"
	"facti/api/internal/monotributo"
)

func TestSolicitudesDelConsumidor(t *testing.T) {
	mem := datos.NuevaMemoria()
	h := Nuevo(Opciones{Datos: FijarDatos(mem), Auth: authFalso{}, PuntoVenta: 3})

	// Sin sesión: el botón de baja funciona y devuelve un código.
	res, j := pedir(t, h, "POST", "/consumidor/solicitudes", `{"tipo":"baja","nombre":"Lucía Fernández","email":"Lucia@Example.com"}`)
	if res.StatusCode != 201 || j["tipo"] != "baja" || !regexp.MustCompile(`^BAJ-[2-9A-Z]{4}-[2-9A-Z]{4}$`).MatchString(j["codigo"].(string)) {
		t.Fatalf("baja sin sesión: %d %v", res.StatusCode, j)
	}
	// Arrepentimiento con sesión.
	res, j = pedir(t, h, "POST", "/consumidor/solicitudes", `{"tipo":"arrepentimiento","nombre":"Lucía","email":"lucia@example.com","cuit":"20-11111111-2","detalle":"Contraté Pro por error"}`, comoLucia...)
	if res.StatusCode != 201 || !regexp.MustCompile(`^ARR-`).MatchString(j["codigo"].(string)) {
		t.Fatalf("arrepentimiento: %d %v", res.StatusCode, j)
	}

	casos := map[string]struct{ cuerpo, codigo string }{
		"tipo":   {`{"tipo":"otro","nombre":"Ana","email":"ana@example.com"}`, "solicitud_invalida"},
		"nombre": {`{"tipo":"baja","nombre":" ","email":"ana@example.com"}`, "nombre_invalido"},
		"email":  {`{"tipo":"baja","nombre":"Ana","email":"ana@"}`, "email_invalido"},
		"email2": {`{"tipo":"baja","nombre":"Ana","email":"ana@localhost"}`, "email_invalido"},
		"cuit":   {`{"tipo":"baja","nombre":"Ana","email":"ana@example.com","cuit":"20-11111111-3"}`, "cuit_invalido"},
	}
	for nombre, c := range casos {
		if res, j := pedir(t, h, "POST", "/consumidor/solicitudes", c.cuerpo); res.StatusCode != 400 || j["error"] != c.codigo {
			t.Errorf("%s: %d %v", nombre, res.StatusCode, j)
		}
	}

	// Muchos pedidos seguidos desde la misma IP: 429 (ya van 2 válidos; el límite es 5 por hora).
	for i := 0; i < 3; i++ {
		pedir(t, h, "POST", "/consumidor/solicitudes", `{"tipo":"baja","nombre":"Ana","email":"ana@example.com"}`)
	}
	if res, j := pedir(t, h, "POST", "/consumidor/solicitudes", `{"tipo":"baja","nombre":"Ana","email":"ana@example.com"}`); res.StatusCode != 429 {
		t.Errorf("límite: %d %v", res.StatusCode, j)
	}
}

type escalaFija struct{}

func (escalaFija) Escala(context.Context) monotributo.Escala { return monotributo.Respaldo }

func TestCategoriasMonotributo(t *testing.T) {
	h := Nuevo(Opciones{Datos: FijarDatos(datos.NuevaMemoria()), Auth: authFalso{}, Categorias: escalaFija{}})
	res, j := pedir(t, h, "GET", "/monotributo/categorias", "")
	cats, _ := j["categorias"].([]any)
	if res.StatusCode != 200 || len(cats) != 11 || j["vigenteDesde"] != "2026-08-01" {
		t.Fatalf("categorías: %d %v", res.StatusCode, j)
	}
}

func TestImportarYTopes(t *testing.T) {
	e := nuevoEntorno(t, nil)
	if res, j := e.pedir(t, "POST", "/facturas", facturaLumen); res.StatusCode != 200 {
		t.Fatalf("emitir: %d %v", res.StatusCode, j)
	}
	// Sin importar: solo lo de Facti (85.000 en octubre).
	_, j := e.pedir(t, "GET", "/monotributo/topes", "")
	if j["facti"] != 85000.0 || j["externo"] != 0.0 {
		t.Fatalf("topes sin importar: %v", j)
	}
	if res, j := e.pedir(t, "POST", "/comprobantes/importar", "cualquier cosa"); res.StatusCode != 400 || j["error"] != "archivo_invalido" {
		t.Errorf("archivo que no sirve: %d %v", res.StatusCode, j)
	}
	csv := "Fecha;Tipo;Punto de Venta;Número Desde;Moneda;Imp. Total\n" +
		"10/08/2026;11 - Factura C;1;40;$;30.000.000,00\n" +
		"12/10/2026;11 - Factura C;3;1;$;85.000,00\n" + // la emitida con Facti
		"ayer;11;1;41;$;1\n"
	res, j := e.pedir(t, "POST", "/comprobantes/importar", csv)
	imp, _ := j["importacion"].(map[string]any)
	errs, _ := j["errores"].([]any)
	if res.StatusCode != 200 || imp["nuevos"] != 1.0 || imp["enFacti"] != 1.0 || len(errs) != 1 {
		t.Fatalf("importar: %d %v", res.StatusCode, j)
	}
	_, j = e.pedir(t, "GET", "/monotributo/topes", "")
	a, _ := j["analisis"].(map[string]any)
	if j["externo"] != 30000000.0 || a["ingresos"] != 30085000.0 || a["categoriaDeHecho"] != "D" {
		t.Fatalf("topes: %v", j)
	}
	// El inicio también suma lo importado.
	_, j = e.pedir(t, "GET", "/resumen", "")
	if u, _ := j["ultimos12Meses"].(map[string]any); u["facturado"] != 30085000.0 {
		t.Errorf("resumen 12 meses: %v", j["ultimos12Meses"])
	}
}
