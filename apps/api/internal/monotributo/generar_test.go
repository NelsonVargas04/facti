package monotributo

import (
	"fmt"
	"os"
	"testing"
)

// Imprime el bloque Respaldo desde el extracto oficial, para actualizarlo cuando ARCA publique una tabla nueva:
//
//	FACTI_GENERAR=1 go test -run TestGenerarRespaldo ./internal/monotributo/
func TestGenerarRespaldo(t *testing.T) {
	if os.Getenv("FACTI_GENERAR") != "1" {
		t.Skip("solo a mano")
	}
	html, err := os.ReadFile("testdata/categorias_2026-08.html")
	if err != nil {
		t.Fatal(err)
	}
	e, err := Parsear(html)
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range e.Categorias {
		fmt.Printf("\t\t{Letra: %q, Tope: %.2f, CuotaServicios: %.2f, CuotaVentas: %.2f, Superficie: %q, Energia: %q, Alquileres: %.2f, PrecioMaximo: %.2f, ImpServicios: %.2f, ImpVentas: %.2f, SIPA: %.2f, ObraSocial: %.2f},\n",
			c.Letra, c.Tope, c.CuotaServicios, c.CuotaVentas, c.Superficie, c.Energia, c.Alquileres, c.PrecioMaximo, c.ImpServicios, c.ImpVentas, c.SIPA, c.ObraSocial)
	}
}
