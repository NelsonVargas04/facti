package monotributo

import (
	"strings"
	"testing"
	"time"
)

var hoy = time.Date(2026, time.November, 17, 12, 0, 0, 0, time.UTC)

func parejo(v float64) []float64 {
	m := make([]float64, 12)
	for i := range m {
		m[i] = v
	}
	return m
}

func codigos(a Analisis) string {
	var c []string
	for _, x := range a.Alertas {
		c = append(c, x.Codigo)
	}
	return strings.Join(c, ",")
}

func TestCategoriaDeHechoYSubir(t *testing.T) {
	// 2.200.000 por mes = 26.400.000: pasa la C (24.670.494,31), entra en la D.
	a := Analizar(parejo(2_200_000), Respaldo, "c", hoy)
	if a.Ingresos != 26_400_000 || a.CategoriaDeHecho != "D" || a.CategoriaPadron != "C" {
		t.Fatalf("análisis: %+v", a)
	}
	if codigos(a) != "subir_categoria" {
		t.Fatalf("alertas: %+v", a.Alertas)
	}
	if !strings.Contains(a.Alertas[0].Texto, "5 de febrero de 2027") {
		t.Errorf("tiene que decir hasta cuándo: %s", a.Alertas[0].Texto)
	}
	if a.ProximaRecategorizacion != "2027-02-05" {
		t.Errorf("próxima recategorización: %s", a.ProximaRecategorizacion)
	}
}

func TestBajarCategoria(t *testing.T) {
	a := Analizar(parejo(500_000), Respaldo, "D", hoy) // 6.000.000: alcanza la A
	if a.CategoriaDeHecho != "A" || codigos(a) != "bajar_categoria" {
		t.Fatalf("análisis: %+v", a)
	}
}

func TestTopeCercaConProyeccion(t *testing.T) {
	// Los primeros 9 meses poco, los últimos 3 mucho: el total entra en la B, pero a ese ritmo la pasa pronto.
	m := []float64{500_000, 500_000, 500_000, 500_000, 500_000, 500_000, 500_000, 500_000, 3_500_000, 3_500_000, 3_500_000, 1_000_000}
	a := Analizar(m, Respaldo, "B", hoy) // 15.500.000: entra en la B (17.595.182,74)
	if a.CategoriaDeHecho != "B" || a.Siguiente == nil || a.Siguiente.EnMeses == nil || *a.Siguiente.EnMeses > 3 {
		t.Fatalf("análisis: %+v %+v", a, a.Siguiente)
	}
	if codigos(a) != "tope_cerca" {
		t.Fatalf("alertas: %+v", a.Alertas)
	}
}

func TestExclusion(t *testing.T) {
	a := Analizar(parejo(9_500_000), Respaldo, "K", hoy) // 114.000.000: entra en la K pero pasa el tope de exclusión
	if a.CategoriaDeHecho != "K" || codigos(a) != "zona_exclusion" {
		t.Fatalf("análisis: %+v", a.Alertas)
	}
	a = Analizar(parejo(11_000_000), Respaldo, "K", hoy) // 132.000.000: pasa la K
	if a.CategoriaDeHecho != "" || a.Siguiente != nil || codigos(a) != "superaste_k" {
		t.Fatalf("análisis: %+v", a)
	}
	m := parejo(8_500_000)
	m[8], m[9], m[10], m[11] = 10_000_000, 10_000_000, 10_000_000, 8_500_000 // 106.500.000 y subiendo: se acerca
	a = Analizar(m, Respaldo, "K", hoy)
	if codigos(a) != "exclusion_cerca" {
		t.Fatalf("alertas: %+v", a.Alertas)
	}
}

func TestSinAlertas(t *testing.T) {
	a := Analizar(parejo(1_200_000), Respaldo, "B", hoy) // 14.400.000 en la B: todo bien
	if a.CategoriaDeHecho != "B" || len(a.Alertas) != 0 {
		t.Fatalf("análisis: %+v", a)
	}
}

func TestProximaRecategorizacion(t *testing.T) {
	casos := map[string]string{"2026-01-10": "2026-02-05", "2026-02-05": "2026-02-05", "2026-02-06": "2026-08-05", "2026-08-05": "2026-08-05", "2026-12-31": "2027-02-05"}
	for d, quiero := range casos {
		f, _ := time.Parse("2006-01-02", d)
		if got := proximaRecategorizacion(f.Add(15 * time.Hour)); got != quiero {
			t.Errorf("%s: %s, quería %s", d, got, quiero)
		}
	}
}

func TestPesos(t *testing.T) {
	if p := pesos(26400000.4); p != "$26.400.000" {
		t.Error(p)
	}
}
