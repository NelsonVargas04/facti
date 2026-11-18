package monotributo

import (
	"fmt"
	"math"
	"strings"
	"time"
)

// TopeExclusion es el tope de ingresos que ARCA usa para excluir del monotributo.
//
// ARCA no excluye con la tabla vigente: usa la de semestres anteriores, que tiene topes más bajos
// (iProfesional, "Qué tabla de monotributo aplica ARCA para las exclusiones en 2026"). Para avisar
// a tiempo, Facti toma el tope de la K de la tabla anterior a la vigente.
type TopeExclusion struct {
	Monto        float64 `json:"monto"`
	VigenteDesde string  `json:"vigenteDesde"` // desde cuándo Facti usa este monto (AAAA-MM-DD)
	Fuente       string  `json:"fuente"`
}

// TopesExclusion, del más viejo al más nuevo. Agregar uno nuevo en cada actualización semestral (feb/ago).
var TopesExclusion = []TopeExclusion{
	{
		Monto:        108357084.05,
		VigenteDesde: "2026-08-01",
		Fuente:       "Tope de la categoría K de la tabla vigente del 01/02/2026 al 31/07/2026 (ARCA). Criterio: ARCA excluye con tablas anteriores a la vigente, https://www.iprofesional.com/impuestos/446225-tabla-monotributo-aplica-arca-para-exclusiones-2026",
	},
}

// ExclusionVigente devuelve el tope de exclusión para la fecha (AAAA-MM-DD).
func ExclusionVigente(fecha string) TopeExclusion {
	t := TopesExclusion[0]
	for _, x := range TopesExclusion {
		if x.VigenteDesde <= fecha {
			t = x
		}
	}
	return t
}

// Alerta para mostrar en el inicio y en el panel de monotributo.
type Alerta struct {
	Nivel  string `json:"nivel"`  // peligro, aviso, info
	Codigo string `json:"codigo"` // superaste_k, zona_exclusion, exclusion_cerca, subir_categoria, tope_cerca, bajar_categoria
	Titulo string `json:"titulo"`
	Texto  string `json:"texto"`
}

// Meta es un tope que todavía no alcanzaste.
type Meta struct {
	Letra string  `json:"letra,omitempty"`
	Tope  float64 `json:"tope"`
	Falta float64 `json:"falta"`
	// EnMeses: en cuántos meses lo pasarías si seguís facturando como en los últimos 3 (nil: no en un año).
	EnMeses *int `json:"enMeses"`
}

// Analisis de los topes con los ingresos de los últimos 12 meses.
type Analisis struct {
	Ingresos         float64 `json:"ingresos"`
	Promedio         float64 `json:"promedio"` // por mes, últimos 3 meses completos
	CategoriaPadron  string  `json:"categoriaPadron"`
	CategoriaDeHecho string  `json:"categoriaDeHecho"` // "" si pasaste la K
	Siguiente        *Meta   `json:"siguiente"`        // tope de la categoría de hecho (el que te haría subir)
	Exclusion        Meta    `json:"exclusion"`
	ExclusionFuente  string  `json:"exclusionFuente"`
	// Próxima recategorización: se hace hasta el 5 de febrero y de agosto, con lo facturado hasta enero y julio.
	ProximaRecategorizacion string   `json:"proximaRecategorizacion"` // AAAA-MM-DD (último día)
	Alertas                 []Alerta `json:"alertas"`
}

// Analizar calcula la categoría de hecho, cuánto falta para cada tope y las alertas.
// porMes son los ingresos de los últimos 12 meses en pesos, del más viejo al actual (el último puede estar incompleto).
func Analizar(porMes []float64, escala Escala, categoriaPadron string, hoy time.Time) Analisis {
	a := Analisis{CategoriaPadron: strings.ToUpper(strings.TrimSpace(categoriaPadron))}
	for _, v := range porMes {
		a.Ingresos += v
	}
	a.Ingresos = math.Round(a.Ingresos*100) / 100
	a.Promedio = promedioReciente(porMes)
	a.ProximaRecategorizacion = proximaRecategorizacion(hoy)

	enMeses := func(tope float64) *int {
		for k := 1; k <= 12 && k <= len(porMes); k++ {
			proy := a.Promedio * float64(k)
			for _, v := range porMes[k:] {
				proy += v
			}
			if proy > tope {
				return &k
			}
		}
		return nil
	}

	cats := escala.Categorias
	var deHecho, padron *Categoria
	for i := range cats {
		if deHecho == nil && a.Ingresos <= cats[i].Tope {
			deHecho = &cats[i]
		}
		if cats[i].Letra == a.CategoriaPadron {
			padron = &cats[i]
		}
	}
	if deHecho != nil {
		a.CategoriaDeHecho = deHecho.Letra
		a.Siguiente = &Meta{Letra: deHecho.Letra, Tope: deHecho.Tope, Falta: redondear(deHecho.Tope - a.Ingresos), EnMeses: enMeses(deHecho.Tope)}
	}
	ex := ExclusionVigente(hoy.Format("2006-01-02"))
	a.ExclusionFuente = ex.Fuente
	a.Exclusion = Meta{Tope: ex.Monto, Falta: redondear(ex.Monto - a.Ingresos), EnMeses: enMeses(ex.Monto)}

	recat := fechaLarga(a.ProximaRecategorizacion)
	switch {
	case deHecho == nil:
		a.alerta("peligro", "superaste_k", "Pasaste el tope de la categoría K",
			fmt.Sprintf("En los últimos 12 meses facturaste %s, más que el tope de la K (%s). Eso es causal de exclusión del monotributo: te conviene hablar con un contador cuanto antes.", pesos(a.Ingresos), pesos(cats[len(cats)-1].Tope)))
	case a.Ingresos > ex.Monto:
		a.alerta("peligro", "zona_exclusion", "Estás en zona de exclusión",
			fmt.Sprintf("Facturaste %s en 12 meses. ARCA puede excluirte usando una tabla anterior, con un tope de %s. Frená la facturación o consultá con un contador.", pesos(a.Ingresos), pesos(ex.Monto)))
	case a.Exclusion.EnMeses != nil && *a.Exclusion.EnMeses <= 6:
		a.alerta("aviso", "exclusion_cerca", "Te acercás al tope de exclusión",
			fmt.Sprintf("A tu ritmo (%s por mes) pasarías el tope de exclusión (%s) en %s.", pesos(a.Promedio), pesos(ex.Monto), meses(*a.Exclusion.EnMeses)))
	}
	if deHecho != nil && padron != nil {
		switch {
		case deHecho.Tope > padron.Tope:
			a.alerta("aviso", "subir_categoria", fmt.Sprintf("Te corresponde la categoría %s", deHecho.Letra),
				fmt.Sprintf("Estás en la %s, pero facturaste %s en 12 meses y su tope es %s. Recategorizate antes del %s: la cuota pasa de %s a %s por mes.", padron.Letra, pesos(a.Ingresos), pesos(padron.Tope), recat, pesos(padron.CuotaServicios), pesos(deHecho.CuotaServicios)))
		case deHecho.Tope < padron.Tope:
			a.alerta("info", "bajar_categoria", fmt.Sprintf("Podrías bajar a la categoría %s", deHecho.Letra),
				fmt.Sprintf("Facturaste %s en 12 meses: alcanza con la %s. Si te recategorizás antes del %s, pagás %s menos por mes.", pesos(a.Ingresos), deHecho.Letra, recat, pesos(padron.CuotaServicios-deHecho.CuotaServicios)))
		}
	}
	if s := a.Siguiente; s != nil && deHecho.Letra != "K" && s.EnMeses != nil && *s.EnMeses <= 3 {
		a.alerta("aviso", "tope_cerca", fmt.Sprintf("Te acercás al tope de la %s", s.Letra),
			fmt.Sprintf("Te faltan %s. A tu ritmo lo pasarías en %s y tendrías que subir de categoría.", pesos(s.Falta), meses(*s.EnMeses)))
	}
	return a
}

func (a *Analisis) alerta(nivel, codigo, titulo, texto string) {
	a.Alertas = append(a.Alertas, Alerta{Nivel: nivel, Codigo: codigo, Titulo: titulo, Texto: texto})
}

// promedioReciente es el promedio de los 3 meses completos anteriores al actual (si no hay, de los 12).
func promedioReciente(porMes []float64) float64 {
	n := len(porMes)
	if n >= 4 {
		s := porMes[n-4] + porMes[n-3] + porMes[n-2]
		if s > 0 {
			return redondear(s / 3)
		}
	}
	var s float64
	for _, v := range porMes {
		s += v
	}
	if n == 0 {
		return 0
	}
	return redondear(s / float64(n))
}

// proximaRecategorizacion devuelve el último día para recategorizarse: 5 de febrero o 5 de agosto.
func proximaRecategorizacion(hoy time.Time) string {
	y := hoy.Year()
	for _, f := range []time.Time{
		time.Date(y, time.February, 5, 0, 0, 0, 0, hoy.Location()),
		time.Date(y, time.August, 5, 0, 0, 0, 0, hoy.Location()),
		time.Date(y+1, time.February, 5, 0, 0, 0, 0, hoy.Location()),
	} {
		if !hoy.After(f.AddDate(0, 0, 1).Add(-time.Nanosecond)) {
			return f.Format("2006-01-02")
		}
	}
	return ""
}

var nombresMes = []string{"enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"}

func fechaLarga(f string) string {
	t, err := time.Parse("2006-01-02", f)
	if err != nil {
		return f
	}
	return fmt.Sprintf("%d de %s de %d", t.Day(), nombresMes[t.Month()-1], t.Year())
}

func meses(n int) string {
	if n == 1 {
		return "1 mes"
	}
	return fmt.Sprintf("%d meses", n)
}

func redondear(v float64) float64 { return math.Round(v*100) / 100 }

// pesos formatea como "$ 1.234.567" (sin centavos: es para textos).
func pesos(v float64) string {
	neg := v < 0
	n := int64(math.Round(math.Abs(v)))
	s := fmt.Sprintf("%d", n)
	var b strings.Builder
	for i, r := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			b.WriteByte('.')
		}
		b.WriteRune(r)
	}
	if neg {
		return "-$" + b.String()
	}
	return "$" + b.String()
}
