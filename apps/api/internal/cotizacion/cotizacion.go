// Package cotizacion trae la cotización del dólar del BCRA, para pasar a pesos el precio de Facti Pro
// (Mercado Pago cobra las suscripciones en pesos).
//
// Fuente: API de Estadísticas Cambiarias del BCRA,
// https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD (campo tipoCotizacion).
package cotizacion

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"
)

const urlBCRA = "https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD"

// Dolar es una cotización con su fecha.
type Dolar struct {
	Valor  float64 `json:"valor"`
	Fecha  string  `json:"fecha"` // AAAA-MM-DD
	Fuente string  `json:"fuente"`
}

// Fuente de la cotización, con caché de unas horas (cambia una vez por día hábil).
type Fuente struct {
	url   string
	http  *http.Client
	ttl   time.Duration
	mu    sync.Mutex
	ult   Dolar
	hasta time.Time
}

// Nueva usa la API del BCRA. url vacía = la real (los tests pasan otra).
func Nueva(url string) *Fuente {
	if url == "" {
		url = urlBCRA
	}
	return &Fuente{url: url, http: &http.Client{Timeout: 10 * time.Second}, ttl: 6 * time.Hour}
}

// Dolar devuelve la última cotización. Si el BCRA no responde, usa la última que trajo.
func (f *Fuente) Dolar(ctx context.Context) (Dolar, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.ult.Valor > 0 && time.Now().Before(f.hasta) {
		return f.ult, nil
	}
	d, err := f.traer(ctx)
	if err != nil {
		if f.ult.Valor > 0 {
			return f.ult, nil
		}
		return Dolar{}, err
	}
	f.ult, f.hasta = d, time.Now().Add(f.ttl)
	return d, nil
}

func (f *Fuente) traer(ctx context.Context) (Dolar, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, f.url, nil)
	if err != nil {
		return Dolar{}, err
	}
	res, err := f.http.Do(req)
	if err != nil {
		return Dolar{}, fmt.Errorf("no se pudo consultar la cotización del BCRA: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return Dolar{}, fmt.Errorf("el BCRA respondió %d", res.StatusCode)
	}
	var r struct {
		Results []struct {
			Fecha   string `json:"fecha"`
			Detalle []struct {
				Codigo string  `json:"codigoMoneda"`
				Valor  float64 `json:"tipoCotizacion"`
			} `json:"detalle"`
		} `json:"results"`
	}
	if err := json.NewDecoder(res.Body).Decode(&r); err != nil {
		return Dolar{}, fmt.Errorf("respuesta del BCRA inesperada: %w", err)
	}
	// Viene la más reciente primero, pero por las dudas se busca la de fecha mayor.
	var mejor Dolar
	for _, x := range r.Results {
		for _, d := range x.Detalle {
			if d.Codigo == "USD" && d.Valor > 0 && x.Fecha > mejor.Fecha {
				mejor = Dolar{Valor: d.Valor, Fecha: x.Fecha, Fuente: "BCRA"}
			}
		}
	}
	if mejor.Valor == 0 {
		return Dolar{}, errors.New("el BCRA no devolvió la cotización del dólar")
	}
	return mejor, nil
}
