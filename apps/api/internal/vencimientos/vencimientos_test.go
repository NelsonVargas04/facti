package vencimientos

import (
	"testing"
	"time"
)

func TestMonotributo(t *testing.T) {
	ar := time.FixedZone("ART", -3*3600)
	ev := Monotributo(time.Date(2026, 11, 17, 0, 0, 0, 0, ar), time.Date(2027, 2, 28, 0, 0, 0, 0, ar))
	var fechas []string
	for _, e := range ev {
		fechas = append(fechas, e.Fecha+" "+e.Tipo)
	}
	// 20/12/2026 es domingo → lunes 21. 20/02/2027 es sábado → lunes 22. 05/02/2027 es viernes.
	quiero := []string{
		"2026-11-20 cuota_monotributo",
		"2026-12-21 cuota_monotributo",
		"2027-01-20 cuota_monotributo",
		"2027-02-05 recategorizacion",
		"2027-02-22 cuota_monotributo",
		"2027-02-22 nueva_escala",
	}
	if len(fechas) != len(quiero) {
		t.Fatalf("eventos: %v", fechas)
	}
	for i := range quiero {
		if fechas[i] != quiero[i] {
			t.Errorf("evento %d: %s, quería %s", i, fechas[i], quiero[i])
		}
	}
	// Antes del 17/11 no entra la cuota del 20/10.
	if ev := Monotributo(time.Date(2026, 10, 21, 0, 0, 0, 0, ar), time.Date(2026, 10, 31, 0, 0, 0, 0, ar)); len(ev) != 0 {
		t.Fatalf("fuera de rango: %v", ev)
	}
}
