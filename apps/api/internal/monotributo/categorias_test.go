package monotributo

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"
)

func TestParsearTablaOficial(t *testing.T) {
	html, err := os.ReadFile("testdata/categorias_2026-08.html")
	if err != nil {
		t.Fatal(err)
	}
	e, err := Parsear(html)
	if err != nil {
		t.Fatal(err)
	}
	if e.VigenteDesde != "2026-08-01" || len(e.Categorias) != 11 || e.Origen != "arca" {
		t.Fatalf("escala: %+v", e)
	}
	// La tabla leída tiene que coincidir con el respaldo que viene en el código.
	for i, c := range e.Categorias {
		if c != Respaldo.Categorias[i] {
			t.Errorf("categoría %s: leída %+v, respaldo %+v", c.Letra, c, Respaldo.Categorias[i])
		}
	}
}

func TestParsearRechazaTablaRara(t *testing.T) {
	if _, err := Parsear([]byte(`<h3>Valores de aplicación desde el 1/02/2027</h3><td headers="th_A_t16 th_ing_br_t16">$1,00</td>`)); err == nil {
		t.Error("una tabla incompleta no tiene que aceptarse")
	}
	if _, err := Parsear([]byte(`<html>mantenimiento</html>`)); err == nil {
		t.Error("una página sin tabla no tiene que aceptarse")
	}
}

func TestFuenteUsaRespaldoSiARCANoResponde(t *testing.T) {
	llamadas := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		llamadas++
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()
	ahora := time.Date(2026, 11, 17, 10, 0, 0, 0, time.UTC)
	f := &Fuente{Cliente: srv.Client(), URL: srv.URL, Duracion: time.Hour, Ahora: func() time.Time { return ahora }}
	e := f.Escala(context.Background())
	if e.Origen != "respaldo" || len(e.Categorias) != 11 {
		t.Fatalf("sin ARCA tiene que usar el respaldo: %+v", e)
	}
	// No reintenta en cada pedido.
	f.Escala(context.Background())
	if llamadas != 1 {
		t.Errorf("llamadas a ARCA: %d", llamadas)
	}
}

func TestFuenteLeeDeARCAYGuardaEnCache(t *testing.T) {
	html, _ := os.ReadFile("testdata/categorias_2026-08.html")
	llamadas := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		llamadas++
		_, _ = w.Write(html)
	}))
	defer srv.Close()
	ahora := time.Date(2026, 11, 17, 10, 0, 0, 0, time.UTC)
	f := &Fuente{Cliente: srv.Client(), URL: srv.URL, Duracion: time.Hour, Ahora: func() time.Time { return ahora }}
	if e := f.Escala(context.Background()); e.Origen != "arca" || e.Categorias[2].Tope != 24670494.31 {
		t.Fatalf("escala: %+v", e)
	}
	f.Escala(context.Background())
	if llamadas != 1 {
		t.Errorf("tiene que usar la caché: %d llamadas", llamadas)
	}
	ahora = ahora.Add(2 * time.Hour)
	f.Escala(context.Background())
	if llamadas != 2 {
		t.Errorf("vencida la caché, vuelve a leer: %d llamadas", llamadas)
	}
}
