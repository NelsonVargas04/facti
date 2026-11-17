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
