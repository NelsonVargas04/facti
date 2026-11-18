package cotizacion

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDolarBCRA(t *testing.T) {
	caido := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if caido {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		_, _ = io.WriteString(w, `{"status":200,"results":[
			{"fecha":"2026-11-13","detalle":[{"codigoMoneda":"USD","tipoCotizacion":1540.5}]},
			{"fecha":"2026-11-16","detalle":[{"codigoMoneda":"USD","tipoPase":0.0,"tipoCotizacion":1551.0}]}]}`)
	}))
	defer srv.Close()

	f := Nueva(srv.URL)
	d, err := f.Dolar(context.Background())
	if err != nil || d.Valor != 1551 || d.Fecha != "2026-11-16" || d.Fuente != "BCRA" {
		t.Fatalf("dólar: %+v %v", d, err)
	}
	// Si el BCRA se cae, sigue con la última que trajo.
	caido = true
	f.hasta = f.hasta.AddDate(-1, 0, 0)
	if d, err := f.Dolar(context.Background()); err != nil || d.Valor != 1551 {
		t.Fatalf("con el BCRA caído: %+v %v", d, err)
	}
	if _, err := Nueva(srv.URL).Dolar(context.Background()); err == nil {
		t.Fatal("sin ninguna cotización tiene que dar error")
	}
}
