package mercadopago

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func firmar(secreto, manifiesto string) string {
	m := hmac.New(sha256.New, []byte(secreto))
	m.Write([]byte(manifiesto))
	return hex.EncodeToString(m.Sum(nil))
}

func TestVerificarFirma(t *testing.T) {
	ahora := time.UnixMilli(1_794_930_000_000)
	ts := "1794930000000"
	v1 := firmar("secreto", "id:abc123;request-id:req-1;ts:"+ts+";")
	cab := "ts=" + ts + ",v1=" + v1

	if err := VerificarFirma("secreto", cab, "req-1", "ABC123", ahora, time.Minute); err != nil {
		t.Fatalf("firma buena (el id va en minúsculas): %v", err)
	}
	casos := map[string]func() error{
		"otro secreto": func() error { return VerificarFirma("otro", cab, "req-1", "abc123", ahora, 0) },
		"otro id":      func() error { return VerificarFirma("secreto", cab, "req-1", "zzz", ahora, 0) },
		"sin cabecera": func() error { return VerificarFirma("secreto", "", "req-1", "abc123", ahora, 0) },
		"sin secreto":  func() error { return VerificarFirma("", cab, "req-1", "abc123", ahora, 0) },
		"vieja": func() error {
			return VerificarFirma("secreto", cab, "req-1", "abc123", ahora.Add(time.Hour), time.Minute)
		},
		"cabecera rara": func() error { return VerificarFirma("secreto", "v1="+v1, "req-1", "abc123", ahora, 0) },
	}
	for nombre, f := range casos {
		if err := f(); !errors.Is(err, ErrFirma) {
			t.Errorf("%s: tenía que fallar, dio %v", nombre, err)
		}
	}
	// Sin x-request-id, ese par no va en el manifiesto.
	v1b := firmar("secreto", "id:9;ts:"+ts+";")
	if err := VerificarFirma("secreto", "ts="+ts+",v1="+v1b, "", "9", ahora, 0); err != nil {
		t.Fatalf("sin request-id: %v", err)
	}
}

func TestCrearSuscripcion(t *testing.T) {
	var recibido map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer TEST-token" || r.Method != http.MethodPost || r.URL.Path != "/preapproval" {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = io.WriteString(w, `{"message":"invalid access token"}`)
			return
		}
		_ = json.NewDecoder(r.Body).Decode(&recibido)
		_, _ = io.WriteString(w, `{"id":"pre-1","status":"pending","init_point":"https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=pre-1"}`)
	}))
	defer srv.Close()

	s, err := Nuevo("TEST-token", srv.URL).CrearSuscripcion(context.Background(), PedidoSuscripcion{
		Email: "lucia@ejemplo.com", Motivo: "Facti Pro", Referencia: "cuenta:1", ImporteARS: 15510, VolverA: "https://facti.app/app/cuenta",
	})
	if err != nil || s.ID != "pre-1" || s.URLPago == "" {
		t.Fatalf("suscripción: %+v %v", s, err)
	}
	ar, _ := recibido["auto_recurring"].(map[string]any)
	if recibido["payer_email"] != "lucia@ejemplo.com" || recibido["status"] != "pending" || ar["currency_id"] != "ARS" || ar["transaction_amount"] != 15510.0 || ar["frequency_type"] != "months" {
		t.Fatalf("pedido a Mercado Pago: %v", recibido)
	}

	_, err = Nuevo("otro", srv.URL).CrearSuscripcion(context.Background(), PedidoSuscripcion{})
	var e *Error
	if !errors.As(err, &e) || e.Estado != 401 || e.Mensaje != "invalid access token" {
		t.Fatalf("error de Mercado Pago: %v", err)
	}
}
