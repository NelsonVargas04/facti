// Package mercadopago cobra la suscripción de Facti Pro con la API de Mercado Pago (suscripciones,
// "preapproval"). Facti nunca ve ni guarda datos de tarjetas: el usuario paga en el checkout de
// Mercado Pago (tarjeta o dinero en cuenta) y Facti solo consulta el estado.
//
// Referencias (verificar contra la documentación vigente):
//   - POST/GET/PUT https://api.mercadopago.com/preapproval
//   - GET https://api.mercadopago.com/authorized_payments/search?preapproval_id=…
//   - GET https://api.mercadopago.com/v1/payments/{id}
//   - Webhooks: firma x-signature "ts=…,v1=…", HMAC-SHA256 de "id:{data.id};request-id:{x-request-id};ts:{ts};"
package mercadopago

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const baseAPI = "https://api.mercadopago.com"

// Cliente de la API de Mercado Pago con el access token de la cuenta de Facti.
type Cliente struct {
	token string
	base  string
	http  *http.Client
}

// Nuevo arma el cliente. base vacía = la API real (los tests pasan un httptest.Server).
func Nuevo(token, base string) *Cliente {
	if base == "" {
		base = baseAPI
	}
	return &Cliente{token: token, base: strings.TrimRight(base, "/"), http: &http.Client{Timeout: 20 * time.Second}}
}

// Error de la API de Mercado Pago.
type Error struct {
	Estado  int
	Mensaje string
}

func (e *Error) Error() string {
	return fmt.Sprintf("Mercado Pago respondió %d: %s", e.Estado, e.Mensaje)
}

// Estados de una suscripción.
const (
	Pendiente  = "pending"    // creada, falta que el usuario pague en el checkout
	Autorizada = "authorized" // activa: se cobra cada mes
	Pausada    = "paused"
	Cancelada  = "cancelled"
)

// Suscripcion (preapproval) tal como la devuelve Mercado Pago.
type Suscripcion struct {
	ID                string `json:"id"`
	Estado            string `json:"status"`
	URLPago           string `json:"init_point"`
	ReferenciaExterna string `json:"external_reference"`
	ProximoCobro      string `json:"next_payment_date"`
	MedioID           string `json:"payment_method_id"`
	AutoRecurring     struct {
		Importe float64 `json:"transaction_amount"`
		Moneda  string  `json:"currency_id"`
	} `json:"auto_recurring"`
}

// PedidoSuscripcion para crear la suscripción mensual.
type PedidoSuscripcion struct {
	Email      string
	Motivo     string // lo que ve el usuario en Mercado Pago ("Facti Pro")
	Referencia string // para saber de qué cuenta es (external_reference)
	ImporteARS float64
	VolverA    string    // URL a la que vuelve después del checkout
	Inicio     time.Time // primer cobro; cero = ahora (sirve para volver a Pro sin cobrar dos veces el mismo mes)
}

// CrearSuscripcion crea la suscripción "pendiente" y devuelve la URL del checkout de Mercado Pago.
func (c *Cliente) CrearSuscripcion(ctx context.Context, p PedidoSuscripcion) (Suscripcion, error) {
	recurrencia := map[string]any{
		"frequency":          1,
		"frequency_type":     "months",
		"transaction_amount": p.ImporteARS,
		"currency_id":        "ARS",
	}
	if !p.Inicio.IsZero() {
		recurrencia["start_date"] = p.Inicio.Format("2006-01-02T15:04:05.000-07:00")
	}
	cuerpo := map[string]any{
		"reason":             p.Motivo,
		"external_reference": p.Referencia,
		"payer_email":        p.Email,
		"back_url":           p.VolverA,
		"status":             Pendiente,
		"auto_recurring":     recurrencia,
	}
	var s Suscripcion
	err := c.pedir(ctx, http.MethodPost, "/preapproval", cuerpo, &s)
	return s, err
}

// VerSuscripcion trae el estado actual de la suscripción.
func (c *Cliente) VerSuscripcion(ctx context.Context, id string) (Suscripcion, error) {
	var s Suscripcion
	err := c.pedir(ctx, http.MethodGet, "/preapproval/"+url.PathEscape(id), nil, &s)
	return s, err
}

// Cancelar da de baja la suscripción: no se cobra más.
func (c *Cliente) Cancelar(ctx context.Context, id string) (Suscripcion, error) {
	var s Suscripcion
	err := c.pedir(ctx, http.MethodPut, "/preapproval/"+url.PathEscape(id), map[string]any{"status": Cancelada}, &s)
	return s, err
}

// Cobro mensual de una suscripción (authorized_payment).
type Cobro struct {
	ID          int64   `json:"id"`
	Suscripcion string  `json:"preapproval_id"`
	Importe     float64 `json:"transaction_amount"`
	Moneda      string  `json:"currency_id"`
	Estado      string  `json:"status"` // scheduled, processed, recycling, cancelled
	FechaCobro  string  `json:"debit_date"`
	Creado      string  `json:"date_created"`
	Pago        struct {
		ID     int64  `json:"id"`
		Estado string `json:"status"` // approved, rejected…
	} `json:"payment"`
}

// Cobros devuelve los cobros mensuales de la suscripción.
func (c *Cliente) Cobros(ctx context.Context, suscripcionID string) ([]Cobro, error) {
	var r struct {
		Resultados []Cobro `json:"results"`
	}
	err := c.pedir(ctx, http.MethodGet, "/authorized_payments/search?preapproval_id="+url.QueryEscape(suscripcionID), nil, &r)
	return r.Resultados, err
}

// VerCobro trae un cobro mensual por su id (lo que manda el webhook).
func (c *Cliente) VerCobro(ctx context.Context, id string) (Cobro, error) {
	var r Cobro
	err := c.pedir(ctx, http.MethodGet, "/authorized_payments/"+url.PathEscape(id), nil, &r)
	return r, err
}

// Pago con el medio usado. De la tarjeta solo vienen marca, últimos 4 y vencimiento.
type Pago struct {
	ID      int64  `json:"id"`
	Estado  string `json:"status"`
	MedioID string `json:"payment_method_id"` // visa, master, account_money…
	Tarjeta struct {
		Ultimos string `json:"last_four_digits"`
		MesVto  int    `json:"expiration_month"`
		AnioVto int    `json:"expiration_year"`
	} `json:"card"`
}

// VerPago trae un pago (para mostrar con qué se pagó).
func (c *Cliente) VerPago(ctx context.Context, id int64) (Pago, error) {
	var p Pago
	err := c.pedir(ctx, http.MethodGet, "/v1/payments/"+strconv.FormatInt(id, 10), nil, &p)
	return p, err
}

func (c *Cliente) pedir(ctx context.Context, metodo, ruta string, cuerpo, destino any) error {
	var body io.Reader
	if cuerpo != nil {
		b, err := json.Marshal(cuerpo)
		if err != nil {
			return err
		}
		body = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, metodo, c.base+ruta, body)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	if cuerpo != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	res, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("no se pudo conectar con Mercado Pago: %w", err)
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode >= 300 {
		var e struct {
			Message string `json:"message"`
		}
		_ = json.Unmarshal(b, &e)
		if e.Message == "" {
			e.Message = strings.TrimSpace(string(b))
		}
		return &Error{Estado: res.StatusCode, Mensaje: e.Message}
	}
	if destino == nil {
		return nil
	}
	return json.Unmarshal(b, destino)
}

// ErrFirma indica que la notificación no viene firmada por Mercado Pago.
var ErrFirma = errors.New("firma de Mercado Pago inválida")
