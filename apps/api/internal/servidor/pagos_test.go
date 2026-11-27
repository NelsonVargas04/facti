package servidor

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strconv"
	"sync"
	"testing"
	"time"

	"facti/api/internal/cotizacion"
	"facti/api/internal/datos"
	"facti/api/internal/mercadopago"
)

// mpFalso simula Mercado Pago: guarda las suscripciones y deja cambiarles el estado.
type mpFalso struct {
	mu     sync.Mutex
	subs   map[string]*mercadopago.Suscripcion
	cobros map[string][]mercadopago.Cobro
	pedido mercadopago.PedidoSuscripcion
}

func (m *mpFalso) CrearSuscripcion(_ context.Context, p mercadopago.PedidoSuscripcion) (mercadopago.Suscripcion, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.pedido = p
	s := &mercadopago.Suscripcion{ID: "pre-1", Estado: mercadopago.Pendiente, URLPago: "https://mp.test/checkout?preapproval_id=pre-1", ReferenciaExterna: p.Referencia}
	s.AutoRecurring.Importe = p.ImporteARS
	m.subs = map[string]*mercadopago.Suscripcion{s.ID: s}
	return *s, nil
}

func (m *mpFalso) VerSuscripcion(_ context.Context, id string) (mercadopago.Suscripcion, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return *m.subs[id], nil
}

func (m *mpFalso) Cancelar(_ context.Context, id string) (mercadopago.Suscripcion, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.subs[id].Estado = mercadopago.Cancelada
	return *m.subs[id], nil
}

func (m *mpFalso) Cobros(_ context.Context, id string) ([]mercadopago.Cobro, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.cobros[id], nil
}

func (m *mpFalso) VerCobro(_ context.Context, id string) (mercadopago.Cobro, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, cs := range m.cobros {
		for _, c := range cs {
			if id == "77" && c.ID == 77 {
				return c, nil
			}
		}
	}
	return mercadopago.Cobro{}, &mercadopago.Error{Estado: 404, Mensaje: "not found"}
}

func (m *mpFalso) VerPago(_ context.Context, id int64) (mercadopago.Pago, error) {
	p := mercadopago.Pago{ID: id, Estado: "approved", MedioID: "visa"}
	p.Tarjeta.Ultimos, p.Tarjeta.MesVto, p.Tarjeta.AnioVto = "4242", 12, 2029
	return p, nil
}

// pagar simula que el usuario pagó en el checkout: la suscripción queda autorizada con su primer cobro.
func (m *mpFalso) pagar() {
	m.mu.Lock()
	defer m.mu.Unlock()
	s := m.subs["pre-1"]
	s.Estado, s.ProximoCobro, s.MedioID = mercadopago.Autorizada, "2026-12-17T10:00:00.000-03:00", "visa"
	c := mercadopago.Cobro{ID: 77, Suscripcion: "pre-1", Importe: s.AutoRecurring.Importe, Moneda: "ARS", Estado: "processed", FechaCobro: "2026-11-17T10:00:00.000-03:00", Creado: "2026-11-17T10:00:00.000-03:00"}
	c.Pago.ID, c.Pago.Estado = 9001, "approved"
	m.cobros = map[string][]mercadopago.Cobro{"pre-1": {c}}
}

type dolarFijo struct{}

func (dolarFijo) Dolar(context.Context) (cotizacion.Dolar, error) {
	return cotizacion.Dolar{Valor: 1551.25, Fecha: "2026-11-16", Fuente: "BCRA"}, nil
}

func entornoPagos(t *testing.T, mp CobradorPro, secreto string) (*entorno, http.Handler) {
	t.Helper()
	e := &entorno{arca: &arcaSimulado{}, mem: datos.NuevaMemoria()}
	cl := e.arca.clientes(t)
	e.h = Nuevo(Opciones{
		Arca: func() (*ClientesArca, error) { return cl, nil }, Datos: FijarDatos(e.mem), Auth: authFalso{},
		PuntoVenta: 3, Ahora: func() time.Time { return hoy }, Categorias: escalaFija{},
		MercadoPago: mp, MPWebhookSecret: secreto, Cotizador: dolarFijo{}, WebURL: "https://facti.test",
	})
	return e, e.h
}

func TestPagosSinMercadoPago(t *testing.T) {
	e, _ := entornoPagos(t, nil, "")
	res, j := e.pedir(t, "GET", "/pagos", "")
	if res.StatusCode != 200 || j["mercadoPago"] != false || j["plan"] != "gratis" || j["precioUsd"] != 10.0 {
		t.Fatalf("sin Mercado Pago es vista previa: %d %v", res.StatusCode, j)
	}
	if res, j := e.pedir(t, "POST", "/pagos/suscripcion", ""); res.StatusCode != 503 || j["error"] != "configuracion" {
		t.Fatalf("suscribirse sin Mercado Pago: %d %v", res.StatusCode, j)
	}
}

func TestSuscripcionPro(t *testing.T) {
	mp := &mpFalso{}
	e, h := entornoPagos(t, mp, "secreto")

	res, j := e.pedir(t, "POST", "/pagos/suscripcion", "")
	if res.StatusCode != 200 || j["url"] != "https://mp.test/checkout?preapproval_id=pre-1" || j["importe"] != 15513.0 {
		t.Fatalf("suscribirse (10 × 1551,25 = 15512,50 → 15513): %d %v", res.StatusCode, j)
	}
	if mp.pedido.VolverA != "https://facti.test/app/cuenta?mp=vuelta" || mp.pedido.Email == "" {
		t.Fatalf("pedido a Mercado Pago: %+v", mp.pedido)
	}
	// Todavía no pagó: sigue en Gratis.
	_, j = e.pedir(t, "POST", "/pagos/sincronizar", "")
	if j["plan"] != "gratis" {
		t.Fatalf("pendiente: %v", j)
	}

	// Paga en Mercado Pago y Mercado Pago avisa por webhook (firmado).
	mp.pagar()
	ts := strconv.FormatInt(hoy.UnixMilli(), 10)
	m := hmac.New(sha256.New, []byte("secreto"))
	m.Write([]byte("id:pre-1;request-id:r1;ts:" + ts + ";"))
	firma := "ts=" + ts + ",v1=" + hex.EncodeToString(m.Sum(nil))
	if res, _ := pedir(t, h, "POST", "/webhooks/mercadopago?type=subscription_preapproval&data.id=pre-1", `{}`, "x-signature", "ts="+ts+",v1=00", "x-request-id", "r1"); res.StatusCode != 401 {
		t.Fatalf("webhook con firma falsa: %d", res.StatusCode)
	}
	if res, _ := pedir(t, h, "POST", "/webhooks/mercadopago?type=subscription_preapproval&data.id=pre-1", `{}`, "x-signature", firma, "x-request-id", "r1"); res.StatusCode != 200 {
		t.Fatalf("webhook: %d", res.StatusCode)
	}

	_, j = e.pedir(t, "GET", "/pagos", "")
	sus, _ := j["suscripcion"].(map[string]any)
	pagos, _ := j["pagos"].([]any)
	if j["plan"] != "pro" || sus["estado"] != "authorized" || sus["ultimos"] != "4242" || sus["vence"] != "12/29" || sus["proximoCobro"] != "2026-12-17" || len(pagos) != 1 {
		t.Fatalf("después de pagar: %v", j)
	}
	if p := pagos[0].(map[string]any); p["estado"] != "aprobado" || p["fecha"] != "2026-11-17" || p["importe"] != 15513.0 {
		t.Fatalf("cobro: %v", p)
	}
	if _, j := e.pedir(t, "GET", "/cuenta", ""); j["plan"].(map[string]any)["nombre"] != "pro" {
		t.Fatalf("la cuenta tiene que quedar en Pro: %v", j)
	}
	if res, j := e.pedir(t, "POST", "/pagos/suscripcion", ""); res.StatusCode != 409 {
		t.Fatalf("ya es Pro: %d %v", res.StatusCode, j)
	}

	// Da de baja: sigue en Pro hasta el día antes del próximo cobro (lo que ya pagó) y el historial se queda.
	res, j = e.pedir(t, "POST", "/pagos/cancelar", "")
	if res.StatusCode != 200 || j["plan"] != "pro" || j["proHasta"] != "2026-12-16" || len(j["pagos"].([]any)) != 1 {
		t.Fatalf("cancelar: %d %v", res.StatusCode, j)
	}
}

// Se paga con la cuenta de Mercado Pago que diga el usuario (puede no ser el email de Facti).
func TestSuscripcionConEmailDeMercadoPago(t *testing.T) {
	mp := &mpFalso{}
	e, _ := entornoPagos(t, mp, "")
	if res, j := e.pedir(t, "POST", "/pagos/suscripcion", `{"emailMercadoPago": "sin-arroba"}`); res.StatusCode != 400 || j["error"] != "email_invalido" {
		t.Fatalf("email inválido: %d %v", res.StatusCode, j)
	}
	if res, j := e.pedir(t, "POST", "/pagos/suscripcion", `{"emailMercadoPago": " test_user_1@testuser.com "}`); res.StatusCode != 200 {
		t.Fatalf("suscribirse: %d %v", res.StatusCode, j)
	}
	if mp.pedido.Email != "test_user_1@testuser.com" {
		t.Fatalf("email del pagador: %q", mp.pedido.Email)
	}
}
