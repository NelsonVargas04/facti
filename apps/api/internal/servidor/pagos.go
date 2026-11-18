package servidor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"facti/api/internal/cotizacion"
	"facti/api/internal/datos"
	"facti/api/internal/mercadopago"
)

// CobradorPro es la parte de Mercado Pago que usa Facti para cobrar Pro (en los tests, uno falso).
type CobradorPro interface {
	CrearSuscripcion(ctx context.Context, p mercadopago.PedidoSuscripcion) (mercadopago.Suscripcion, error)
	VerSuscripcion(ctx context.Context, id string) (mercadopago.Suscripcion, error)
	Cancelar(ctx context.Context, id string) (mercadopago.Suscripcion, error)
	Cobros(ctx context.Context, suscripcionID string) ([]mercadopago.Cobro, error)
	VerCobro(ctx context.Context, id string) (mercadopago.Cobro, error)
	VerPago(ctx context.Context, id int64) (mercadopago.Pago, error)
}

// Cotizador da el dólar para pasar a pesos el precio de Pro.
type Cotizador interface {
	Dolar(ctx context.Context) (cotizacion.Dolar, error)
}

// estadoPagos es lo que ve la pantalla "Plan y pagos".
type estadoPagos struct {
	Plan        datos.Plan         `json:"plan"`
	PrecioUSD   float64            `json:"precioUsd"`
	Dolar       *cotizacion.Dolar  `json:"dolar,omitempty"`
	MercadoPago bool               `json:"mercadoPago"` // false = todavía no está configurado (vista previa)
	Suscripcion *datos.Suscripcion `json:"suscripcion"`
	Pagos       []datos.PagoFacti  `json:"pagos"`
}

func (s *Servidor) armarEstadoPagos(ctx context.Context, d datos.Datos, c datos.Cuenta) (estadoPagos, error) {
	e := estadoPagos{Plan: c.Plan, PrecioUSD: s.precioProUSD, MercadoPago: s.mp != nil, Pagos: []datos.PagoFacti{}}
	sus, err := d.VerSuscripcion(ctx, c.ID)
	if err != nil {
		return e, &BaseDatosError{Mensaje: err.Error()}
	}
	e.Suscripcion = sus
	if e.Pagos, err = d.PagosFacti(ctx, c.ID); err != nil {
		return e, &BaseDatosError{Mensaje: err.Error()}
	}
	// El dólar es solo informativo (cuánto sale en pesos hoy): si el BCRA no responde, no se muestra.
	if s.cotizador != nil {
		if dol, err := s.cotizador.Dolar(ctx); err == nil {
			e.Dolar = &dol
		}
	}
	return e, nil
}

// GET /pagos
func (s *Servidor) verPagos(w http.ResponseWriter, r *http.Request) error {
	d, c, err := s.cuenta(r)
	if err != nil {
		return err
	}
	e, err := s.armarEstadoPagos(r.Context(), d, c)
	if err != nil {
		return err
	}
	responderJSON(w, http.StatusOK, e)
	return nil
}

var errSinMercadoPago = &ConfiguracionError{Mensaje: "Todavía no conectamos Mercado Pago: falta MP_ACCESS_TOKEN en el .env de la API."}

// POST /pagos/suscripcion: crea la suscripción y devuelve la URL del checkout de Mercado Pago.
func (s *Servidor) suscribirse(w http.ResponseWriter, r *http.Request) error {
	if s.mp == nil {
		return errSinMercadoPago
	}
	d, c, err := s.cuenta(r)
	if err != nil {
		return err
	}
	if c.Plan == datos.PlanPro {
		return &errorPedido{estado: http.StatusConflict, codigo: "ya_pro", mensaje: "Ya tenés Facti Pro."}
	}
	if s.cotizador == nil {
		return &ConfiguracionError{Mensaje: "Falta la cotización del dólar para calcular el precio en pesos."}
	}
	dol, err := s.cotizador.Dolar(r.Context())
	if err != nil {
		return &errorPedido{estado: http.StatusServiceUnavailable, codigo: "sin_cotizacion", mensaje: "No pudimos traer la cotización del dólar. Probá de nuevo en un ratito."}
	}
	// Se redondea al peso para arriba: Mercado Pago cobra en pesos.
	importe := math.Ceil(s.precioProUSD * dol.Valor)
	sus, err := s.mp.CrearSuscripcion(r.Context(), mercadopago.PedidoSuscripcion{
		Email:      c.Email,
		Motivo:     "Facti Pro",
		Referencia: "cuenta:" + strconv.FormatInt(c.ID, 10),
		ImporteARS: importe,
		VolverA:    strings.TrimRight(s.webURL, "/") + "/app/cuenta?mp=vuelta",
	})
	if err != nil {
		return errorMercadoPago(err)
	}
	if err := d.GuardarSuscripcion(r.Context(), c.ID, datos.Suscripcion{
		MPID: sus.ID, Estado: datos.SuscripcionPendiente, Importe: importe, PrecioUSD: s.precioProUSD, Cotizacion: dol.Valor,
	}); err != nil {
		return &BaseDatosError{Mensaje: err.Error()}
	}
	responderJSON(w, http.StatusOK, map[string]any{"url": sus.URLPago, "importe": importe})
	return nil
}

// POST /pagos/sincronizar: trae de Mercado Pago el estado de la suscripción (al volver del checkout).
func (s *Servidor) sincronizarPagos(w http.ResponseWriter, r *http.Request) error {
	d, c, err := s.cuenta(r)
	if err != nil {
		return err
	}
	if s.mp != nil {
		if c, err = s.sincronizar(r.Context(), d, c.ID); err != nil {
			return err
		}
	}
	e, err := s.armarEstadoPagos(r.Context(), d, c)
	if err != nil {
		return err
	}
	responderJSON(w, http.StatusOK, e)
	return nil
}

// POST /pagos/cancelar: da de baja Pro (no se cobra más).
func (s *Servidor) cancelarPro(w http.ResponseWriter, r *http.Request) error {
	if s.mp == nil {
		return errSinMercadoPago
	}
	d, c, err := s.cuenta(r)
	if err != nil {
		return err
	}
	sus, err := d.VerSuscripcion(r.Context(), c.ID)
	if err != nil {
		return &BaseDatosError{Mensaje: err.Error()}
	}
	if sus == nil || sus.Estado == datos.SuscripcionCancelada {
		return &errorPedido{estado: http.StatusConflict, codigo: "sin_suscripcion", mensaje: "No tenés una suscripción activa."}
	}
	if _, err := s.mp.Cancelar(r.Context(), sus.MPID); err != nil {
		return errorMercadoPago(err)
	}
	if c, err = s.sincronizar(r.Context(), d, c.ID); err != nil {
		return err
	}
	e, err := s.armarEstadoPagos(r.Context(), d, c)
	if err != nil {
		return err
	}
	responderJSON(w, http.StatusOK, e)
	return nil
}

// sincronizar copia de Mercado Pago el estado de la suscripción y sus cobros, y devuelve la cuenta
// con el plan actualizado. Mercado Pago es la fuente de verdad: Facti nunca decide sola que se pagó.
func (s *Servidor) sincronizar(ctx context.Context, d datos.Datos, cuentaID int64) (datos.Cuenta, error) {
	guardada, err := d.VerSuscripcion(ctx, cuentaID)
	if err != nil {
		return datos.Cuenta{}, &BaseDatosError{Mensaje: err.Error()}
	}
	if guardada != nil {
		mp, err := s.mp.VerSuscripcion(ctx, guardada.MPID)
		if err != nil {
			return datos.Cuenta{}, errorMercadoPago(err)
		}
		cobros, err := s.mp.Cobros(ctx, guardada.MPID)
		if err != nil {
			return datos.Cuenta{}, errorMercadoPago(err)
		}
		nueva := *guardada
		nueva.Estado = mp.Estado
		nueva.ProximoCobro = fechaDe(mp.ProximoCobro)
		if mp.AutoRecurring.Importe > 0 {
			nueva.Importe = mp.AutoRecurring.Importe
		}
		if mp.MedioID != "" {
			nueva.Medio = mp.MedioID
		}
		pagos := make([]datos.PagoFacti, 0, len(cobros))
		// Del cobro más reciente con pago se saca el medio (marca, últimos 4 y vencimiento).
		sort.Slice(cobros, func(i, j int) bool { return cobros[i].Creado > cobros[j].Creado })
		medioListo := false
		for _, cb := range cobros {
			p := datos.PagoFacti{
				MPID: strconv.FormatInt(cb.ID, 10), Fecha: fechaDe(primeraNoVacia(cb.FechaCobro, cb.Creado)),
				Importe: cb.Importe, Moneda: primeraNoVacia(cb.Moneda, "ARS"), Estado: estadoCobro(cb),
				Medio: nueva.Medio,
			}
			if cb.Pago.ID != 0 && !medioListo {
				if pg, err := s.mp.VerPago(ctx, cb.Pago.ID); err == nil {
					nueva.Medio, nueva.Ultimos = pg.MedioID, pg.Tarjeta.Ultimos
					if pg.Tarjeta.MesVto > 0 {
						nueva.Vence = fmt.Sprintf("%02d/%02d", pg.Tarjeta.MesVto, pg.Tarjeta.AnioVto%100)
					}
					medioListo = true
				}
			}
			p.Medio, p.Ultimos = nueva.Medio, nueva.Ultimos
			if p.Fecha != "" {
				pagos = append(pagos, p)
			}
		}
		if err := d.GuardarSuscripcion(ctx, cuentaID, nueva); err != nil {
			return datos.Cuenta{}, &BaseDatosError{Mensaje: err.Error()}
		}
		if err := d.GuardarPagosFacti(ctx, cuentaID, pagos); err != nil {
			return datos.Cuenta{}, &BaseDatosError{Mensaje: err.Error()}
		}
	}
	c, err := d.CuentaPorID(ctx, cuentaID)
	if err != nil {
		return datos.Cuenta{}, &BaseDatosError{Mensaje: err.Error()}
	}
	return c, nil
}

func estadoCobro(c mercadopago.Cobro) string {
	switch {
	case c.Pago.Estado == "approved":
		return "aprobado"
	case c.Pago.Estado == "rejected":
		return "rechazado"
	case c.Estado == "cancelled":
		return "cancelado"
	}
	return "pendiente"
}

// fechaDe toma AAAA-MM-DD de una fecha ISO de Mercado Pago, en hora argentina.
func fechaDe(iso string) string {
	if iso == "" {
		return ""
	}
	if t, err := time.Parse(time.RFC3339Nano, iso); err == nil {
		return t.In(time.FixedZone("ART", -3*3600)).Format("2006-01-02")
	}
	if len(iso) >= 10 {
		return iso[:10]
	}
	return ""
}

func primeraNoVacia(vs ...string) string {
	for _, v := range vs {
		if v != "" {
			return v
		}
	}
	return ""
}

func errorMercadoPago(err error) error {
	var e *mercadopago.Error
	if errors.As(err, &e) {
		return &errorPedido{estado: http.StatusBadGateway, codigo: "mercadopago", mensaje: "Mercado Pago no aceptó el pedido: " + e.Mensaje}
	}
	return &errorPedido{estado: http.StatusBadGateway, codigo: "mercadopago", mensaje: "No pudimos hablar con Mercado Pago. Probá de nuevo en un ratito."}
}

// POST /webhooks/mercadopago: Mercado Pago avisa que cambió una suscripción o hubo un cobro.
// Sin sesión: se valida la firma y, igual, se vuelve a consultar todo a Mercado Pago.
func (s *Servidor) webhookMercadoPago(w http.ResponseWriter, r *http.Request) {
	body, _ := io.ReadAll(io.LimitReader(r.Body, 64<<10))
	var aviso struct {
		Tipo string `json:"type"`
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	_ = json.Unmarshal(body, &aviso)
	q := r.URL.Query()
	tipo := primeraNoVacia(q.Get("type"), q.Get("topic"), aviso.Tipo)
	id := primeraNoVacia(q.Get("data.id"), q.Get("id"), aviso.Data.ID)

	if s.mp == nil {
		w.WriteHeader(http.StatusOK)
		return
	}
	if s.mpSecreto != "" {
		if err := mercadopago.VerificarFirma(s.mpSecreto, r.Header.Get("x-signature"), r.Header.Get("x-request-id"), q.Get("data.id"), s.ahora(), 10*time.Minute); err != nil {
			s.log.Warn("webhook de Mercado Pago con firma inválida")
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
	} else if s.entorno == "produccion" {
		s.log.Error("falta MP_WEBHOOK_SECRET: no se aceptan webhooks sin firma en producción")
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	ctx := r.Context()
	var suscripcion string
	switch tipo {
	case "subscription_preapproval", "preapproval":
		suscripcion = id
	case "subscription_authorized_payment", "authorized_payment":
		cb, err := s.mp.VerCobro(ctx, id)
		if err != nil {
			s.log.Warn("webhook: no se pudo leer el cobro", "id", id, "error", err)
			w.WriteHeader(http.StatusInternalServerError) // Mercado Pago reintenta
			return
		}
		suscripcion = cb.Suscripcion
	default:
		w.WriteHeader(http.StatusOK) // otros avisos no le interesan a Facti
		return
	}
	d, err := s.datos(ctx)
	if err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	cuentaID, err := d.CuentaDeSuscripcion(ctx, suscripcion)
	if errors.Is(err, datos.ErrNoEncontrado) {
		w.WriteHeader(http.StatusOK)
		return
	}
	if err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	if _, err := s.sincronizar(ctx, d, cuentaID); err != nil {
		s.log.Warn("webhook: no se pudo sincronizar", "cuenta", cuentaID, "error", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}
