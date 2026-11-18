// Package vencimientos arma el calendario fiscal del monotributo: cuota mensual y recategorización.
//
// Fechas (verificar cada año contra el calendario de vencimientos de ARCA):
//   - Cuota mensual: vence el día 20 de cada mes, para todas las terminaciones de CUIT. Si cae
//     sábado, domingo o feriado, pasa al primer día hábil siguiente.
//   - Recategorización semestral: hasta el día 5 de febrero y de agosto (con los ingresos de los
//     12 meses cerrados en diciembre y junio). Los montos nuevos se pagan desde la cuota del 20.
//
// Fuentes: ARCA (arca.gob.ar/monotributo); iProfesional, "Vence hoy el plazo para tramitar la
// recategorización en el Monotributo" (05/08/2026). Los feriados no se calculan todavía: solo se
// corren los fines de semana, y el detalle del evento avisa que un feriado lo corre al día hábil siguiente.
package vencimientos

import (
	"fmt"
	"sort"
	"time"
)

// Parámetros con su vigencia (regla del repo: nada fijo en el código de negocio sin fuente).
const (
	DiaCuota            = 20
	DiaRecategorizacion = 5
	VigenteDesde        = "2024-02-01" // recategorización en febrero y agosto (antes, enero y julio)
)

// Tipos de evento.
const (
	TipoCuota            = "cuota_monotributo"
	TipoRecategorizacion = "recategorizacion"
	TipoNuevaEscala      = "nueva_escala"
)

// Evento del calendario.
type Evento struct {
	Fecha   string `json:"fecha"` // AAAA-MM-DD
	Tipo    string `json:"tipo"`
	Titulo  string `json:"titulo"`
	Detalle string `json:"detalle"`
	Link    string `json:"link,omitempty"` // ruta de la web
}

// habil corre sábados y domingos al lunes siguiente.
func habil(t time.Time) time.Time {
	for t.Weekday() == time.Saturday || t.Weekday() == time.Sunday {
		t = t.AddDate(0, 0, 1)
	}
	return t
}

const notaFeriado = " Si ese día es feriado, vence el día hábil siguiente."

var meses = []string{"", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"}

// Monotributo devuelve los vencimientos entre desde y hasta (inclusive), ordenados por fecha.
func Monotributo(desde, hasta time.Time) []Evento {
	loc := desde.Location()
	ini := time.Date(desde.Year(), desde.Month(), 1, 12, 0, 0, 0, loc)
	fin := hasta.Format("2006-01-02")
	min := desde.Format("2006-01-02")
	var out []Evento
	agregar := func(e Evento) {
		if e.Fecha >= min && e.Fecha <= fin {
			out = append(out, e)
		}
	}
	for m := ini; m.Format("2006-01-02") <= fin; m = m.AddDate(0, 1, 0) {
		cuota := habil(time.Date(m.Year(), m.Month(), DiaCuota, 12, 0, 0, 0, loc))
		agregar(Evento{
			Fecha:   cuota.Format("2006-01-02"),
			Tipo:    TipoCuota,
			Titulo:  "Vence la cuota del monotributo",
			Detalle: fmt.Sprintf("Cuota de %s: impuesto integrado y aportes. Pagala con VEP o débito.%s", meses[m.Month()], notaFeriado),
			Link:    "/app/monotributo/pagos",
		})
		if m.Month() == time.February || m.Month() == time.August {
			cierre := "diciembre"
			if m.Month() == time.August {
				cierre = "junio"
			}
			reca := habil(time.Date(m.Year(), m.Month(), DiaRecategorizacion, 12, 0, 0, 0, loc))
			agregar(Evento{
				Fecha:   reca.Format("2006-01-02"),
				Tipo:    TipoRecategorizacion,
				Titulo:  "Último día para recategorizarte",
				Detalle: fmt.Sprintf("Con lo que facturaste en los 12 meses hasta %s. Si no te corresponde cambiar, no hace falta hacer nada.%s", cierre, notaFeriado),
				Link:    "/guias/recategorizacion",
			})
			agregar(Evento{
				Fecha:   cuota.Format("2006-01-02"),
				Tipo:    TipoNuevaEscala,
				Titulo:  "Primera cuota con la escala nueva",
				Detalle: "ARCA actualiza los montos de las categorías dos veces por año: desde esta cuota se pagan los nuevos.",
				Link:    "/monotributo/categorias",
			})
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Fecha < out[j].Fecha })
	return out
}
