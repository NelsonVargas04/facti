package datos

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"os"
	"testing"
	"time"
)

func TestSuscripciones(t *testing.T) {
	t.Run("memoria", func(t *testing.T) { probarSuscripciones(t, NuevaMemoria()) })
	t.Run("postgres", func(t *testing.T) {
		url := os.Getenv("TEST_DATABASE_URL")
		if url == "" {
			t.Skip("TEST_DATABASE_URL no está definida")
		}
		ctx, cancelar := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancelar()
		p, err := Conectar(ctx, url)
		if err != nil {
			t.Fatal(err)
		}
		defer p.Cerrar()
		probarSuscripciones(t, p)
	})
}

func probarSuscripciones(t *testing.T, d Datos) {
	ctx := context.Background()
	uuid := func() string {
		return fmt.Sprintf("%08x-%04x-4%03x-a%03x-%012x", rand.Uint32(), rand.IntN(1<<16), rand.IntN(1<<12), rand.IntN(1<<12), rand.Int64N(1<<48))
	}
	c, err := d.CuentaDeUsuario(ctx, uuid(), "pro@ejemplo.com", 1)
	if err != nil {
		t.Fatal(err)
	}
	otra, _ := d.CuentaDeUsuario(ctx, uuid(), "otra@ejemplo.com", 1)
	plan := func(id int64) Plan { return planCuenta(t, d, id) }

	if s, err := d.VerSuscripcion(ctx, c.ID); err != nil || s != nil {
		t.Fatalf("sin suscripción tiene que dar nil: %+v %v", s, err)
	}
	mpID := fmt.Sprintf("pre-%d", rand.Int64())
	if err := d.GuardarSuscripcion(ctx, c.ID, Suscripcion{MPID: mpID, Estado: SuscripcionPendiente, Importe: 15510, PrecioUSD: 10, Cotizacion: 1551}); err != nil {
		t.Fatal(err)
	}
	if plan(c.ID) != PlanGratis {
		t.Fatal("pendiente no tiene que pasar a Pro")
	}
	if id, err := d.CuentaDeSuscripcion(ctx, mpID); err != nil || id != c.ID {
		t.Fatalf("cuenta de la suscripción: %d %v", id, err)
	}
	if _, err := d.CuentaDeSuscripcion(ctx, "no-existe"); !errors.Is(err, ErrNoEncontrado) {
		t.Fatalf("suscripción desconocida: %v", err)
	}

	if err := d.GuardarSuscripcion(ctx, c.ID, Suscripcion{MPID: mpID, Estado: SuscripcionAutorizada, Importe: 15510, PrecioUSD: 10, Cotizacion: 1551,
		ProximoCobro: "2026-12-17", Medio: "visa", Ultimos: "4242", Vence: "12/29"}); err != nil {
		t.Fatal(err)
	}
	s, err := d.VerSuscripcion(ctx, c.ID)
	if err != nil || s == nil || s.Estado != SuscripcionAutorizada || s.ProximoCobro != "2026-12-17" || s.Ultimos != "4242" || s.Importe != 15510 {
		t.Fatalf("suscripción autorizada: %+v %v", s, err)
	}
	if plan(c.ID) != PlanPro || plan(otra.ID) != PlanGratis {
		t.Fatal("autorizada tiene que pasar a Pro solo esa cuenta")
	}

	pagos := []PagoFacti{
		{MPID: fmt.Sprintf("c1-%d", rand.Int64()), Fecha: "2026-11-17", Importe: 15510, Moneda: "ARS", Estado: "aprobado", Medio: "visa", Ultimos: "4242"},
		{MPID: fmt.Sprintf("c2-%d", rand.Int64()), Fecha: "2026-12-17", Importe: 15510, Moneda: "ARS", Estado: "pendiente", Medio: "visa", Ultimos: "4242"},
	}
	if err := d.GuardarPagosFacti(ctx, c.ID, pagos); err != nil {
		t.Fatal(err)
	}
	pagos[1].Estado = "aprobado"
	if err := d.GuardarPagosFacti(ctx, c.ID, pagos[1:]); err != nil {
		t.Fatal(err)
	}
	ps, err := d.PagosFacti(ctx, c.ID)
	if err != nil || len(ps) != 2 || ps[0].Fecha != "2026-12-17" || ps[0].Estado != "aprobado" {
		t.Fatalf("pagos (del más nuevo al más viejo, sin duplicar): %+v %v", ps, err)
	}
	if ps, _ := d.PagosFacti(ctx, otra.ID); len(ps) != 0 {
		t.Fatalf("otra cuenta no ve los pagos: %+v", ps)
	}

	if err := d.GuardarSuscripcion(ctx, c.ID, Suscripcion{MPID: mpID, Estado: SuscripcionCancelada, Importe: 15510, PrecioUSD: 10, Cotizacion: 1551}); err != nil {
		t.Fatal(err)
	}
	if plan(c.ID) != PlanGratis {
		t.Fatal("cancelada vuelve a Gratis")
	}
}

func planCuenta(t *testing.T, d Datos, id int64) Plan {
	t.Helper()
	c, err := d.CuentaPorID(context.Background(), id)
	if err != nil {
		t.Fatal(err)
	}
	return c.Plan
}
