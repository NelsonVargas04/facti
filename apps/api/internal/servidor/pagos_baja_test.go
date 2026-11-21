package servidor

import (
	"testing"
	"time"

	"facti/api/internal/arca"
	"facti/api/internal/datos"
)

// Al dar de baja, Pro sigue hasta el final de lo que ya pagó; después vuelve a Gratis.
func TestBajaProHastaFinDelPeriodo(t *testing.T) {
	mp := &mpFalso{}
	e, _ := entornoPagos(t, mp, "")
	if res, j := e.pedir(t, "POST", "/pagos/suscripcion", ""); res.StatusCode != 200 {
		t.Fatalf("suscribirse: %d %v", res.StatusCode, j)
	}
	mp.pagar() // próximo cobro: 17/12/2026
	if _, j := e.pedir(t, "POST", "/pagos/sincronizar", ""); j["plan"] != "pro" {
		t.Fatalf("después de pagar: %v", j)
	}

	res, j := e.pedir(t, "POST", "/pagos/cancelar", "")
	if res.StatusCode != 200 || j["plan"] != "pro" || j["proHasta"] != "2026-12-16" {
		t.Fatalf("baja: %d %v", res.StatusCode, j)
	}
	if _, j := e.pedir(t, "GET", "/cuenta", ""); j["plan"].(map[string]any)["nombre"] != "pro" {
		t.Fatalf("la cuenta sigue en Pro hasta el 16/12: %v", j)
	}
	// Otro aviso de Mercado Pago después de la baja no le borra lo pago.
	if _, j := e.pedir(t, "POST", "/pagos/sincronizar", ""); j["plan"] != "pro" || j["proHasta"] != "2026-12-16" {
		t.Fatalf("sincronizar después de la baja: %v", j)
	}
	// Dar de baja dos veces no se puede.
	if res, _ := e.pedir(t, "POST", "/pagos/cancelar", ""); res.StatusCode != 409 {
		t.Fatalf("baja repetida: %d", res.StatusCode)
	}

	// Puede volver a Pro sin pagar dos veces el mismo mes: el primer cobro es el 17/12.
	if res, j := e.pedir(t, "POST", "/pagos/suscripcion", ""); res.StatusCode != 200 {
		t.Fatalf("volver a Pro: %d %v", res.StatusCode, j)
	}
	if got := mp.pedido.Inicio.In(arca.HoraArgentina).Format("2006-01-02"); got != "2026-12-17" {
		t.Fatalf("inicio de la nueva suscripción: %s", got)
	}

	// Pasado el período, vuelve a Gratis.
	e.mem.FijarAhora(func() time.Time { return time.Date(2026, 12, 17, 9, 0, 0, 0, arca.HoraArgentina) })
	c, err := e.mem.CuentaPorID(t.Context(), 1)
	if err != nil || c.Plan != datos.PlanGratis || c.ProHasta != "" {
		t.Fatalf("después del 16/12: %+v %v", c, err)
	}
}

func TestFinDelPeriodo(t *testing.T) {
	ahora := time.Date(2026, 11, 21, 12, 0, 0, 0, arca.HoraArgentina)
	aprobado := []datos.PagoFacti{{Fecha: "2026-11-10", Estado: "aprobado"}, {Fecha: "2026-10-10", Estado: "aprobado"}}
	casos := []struct {
		nombre, proximo string
		pagos           []datos.PagoFacti
		quiere          string
	}{
		{"con próximo cobro", "2026-12-10", nil, "2026-12-09"},
		{"sin próximo cobro, por el último pago", "", aprobado, "2026-12-09"},
		{"sin nada pago", "", []datos.PagoFacti{{Fecha: "2026-11-10", Estado: "rechazado"}}, ""},
		{"ya vencido", "2026-11-01", nil, ""},
	}
	for _, c := range casos {
		if got := finDelPeriodo(c.proximo, c.pagos, ahora); got != c.quiere {
			t.Errorf("%s: %q, quiere %q", c.nombre, got, c.quiere)
		}
	}
}
