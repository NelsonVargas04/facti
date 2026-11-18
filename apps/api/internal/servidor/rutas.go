package servidor

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"facti/api/internal/arca"
	"facti/api/internal/cuit"
	"facti/api/internal/datos"
)

func (s *Servidor) raiz(w http.ResponseWriter, _ *http.Request) {
	responderJSON(w, http.StatusOK, map[string]any{
		"nombre":      "Facti API",
		"descripcion": "Facturación electrónica conectada con ARCA",
		"rutas": []string{
			"GET /salud",
			"GET /arca/estado",
			"GET /arca/puntos-venta",
			"GET /arca/condiciones-iva?clase=C",
			"GET /arca/padron/{cuit}",
			"POST /facturas",
			"GET /cuenta",
			"GET /resumen?mes=AAAA-MM",
			"GET /comprobantes?desde=&hasta=&q=&cobro=&orden=&limite=&saltar=",
			"GET /comprobantes/{id}",
			"PATCH /comprobantes/{id}/cobro",
			"GET /clientes?q=",
		},
	})
}

func (s *Servidor) salud(w http.ResponseWriter, _ *http.Request) {
	responderJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"servicio": "facti-api",
		"entorno":  s.entorno,
		"hora":     s.ahora().UTC().Format(time.RFC3339),
	})
}

// Estado de los servidores de ARCA (FEDummy). No requiere ticket de acceso.
func (s *Servidor) arcaEstado(w http.ResponseWriter, r *http.Request) error {
	cl, err := s.arca()
	if err != nil {
		return err
	}
	estado, err := cl.WsfeDe(cl.Cfg.CuitCertificado).Estado(r.Context())
	if err != nil {
		return err
	}
	responderJSON(w, http.StatusOK, map[string]any{"entorno": cl.Cfg.Entorno, "servidores": estado})
	return nil
}

// emisor devuelve la cuenta del usuario (que ya tiene que tener el CUIT cargado) y los clientes de ARCA.
func (s *Servidor) emisor(r *http.Request) (datos.Datos, datos.Cuenta, *ClientesArca, error) {
	d, c, err := s.cuenta(r)
	if err != nil {
		return nil, c, nil, err
	}
	if c.Cuit == "" {
		return nil, c, nil, &errorPedido{
			estado: http.StatusConflict, codigo: "falta_cuit",
			mensaje: "Antes de facturar, cargá tu CUIT en el primer paso de la configuración.",
		}
	}
	cl, err := s.arca()
	return d, c, cl, err
}

func (s *Servidor) arcaPuntosVenta(w http.ResponseWriter, r *http.Request) error {
	_, c, cl, err := s.emisor(r)
	if err != nil {
		return err
	}
	pv, err := cl.WsfeDe(c.Cuit).PuntosDeVenta(r.Context())
	if err != nil {
		return err
	}
	responderJSON(w, http.StatusOK, map[string]any{"puntosVenta": pv})
	return nil
}

func (s *Servidor) arcaCondicionesIva(w http.ResponseWriter, r *http.Request) error {
	clase := r.URL.Query().Get("clase")
	if clase != "" && clase != "A" && clase != "B" && clase != "C" && clase != "M" {
		return pedidoInvalido("clase_invalida", "La clase de comprobante tiene que ser A, B, C o M.")
	}
	_, c, cl, err := s.emisor(r)
	if err != nil {
		return err
	}
	condiciones, err := cl.WsfeDe(c.Cuit).CondicionesIvaReceptor(r.Context(), clase)
	if err != nil {
		return err
	}
	responderJSON(w, http.StatusOK, map[string]any{"condiciones": condiciones})
	return nil
}

func (s *Servidor) arcaPadron(w http.ResponseWriter, r *http.Request) error {
	c := r.PathValue("cuit")
	if !cuit.Validar(c) {
		return pedidoInvalido("cuit_invalido", "El CUIT "+c+" no es válido")
	}
	if _, err := s.usuario(r); err != nil {
		return err
	}
	cl, err := s.arca()
	if err != nil {
		return err
	}
	datos, err := arca.ConsultarPadron(r.Context(), cl.Cfg, cl.Tickets, cuit.Limpiar(c))
	if err != nil {
		return err
	}
	datos.Cuit = cuit.Formatear(datos.Cuit)
	responderJSON(w, http.StatusOK, datos)
	return nil
}

// nuevaFactura es el cuerpo de POST /facturas. Los punteros permiten distinguir "no vino" de cero.
type nuevaFactura struct {
	Receptor *struct {
		DocTipo                *int   `json:"docTipo"`
		DocNro                 string `json:"docNro"`
		CondicionIvaReceptorID *int   `json:"condicionIvaReceptorId"`
		// Datos para guardar el cliente y armar el PDF (los trae el padrón en la web).
		Nombre    string `json:"nombre"`
		Condicion string `json:"condicion"`
		Domicilio string `json:"domicilio"`
		Email     string `json:"email"`
	} `json:"receptor"`
	Concepto        int    `json:"concepto"`
	Fecha           string `json:"fecha"` // AAAA-MM-DD
	CondicionVenta  string `json:"condicionVenta"`
	PeriodoServicio *struct {
		Desde           string `json:"desde"`
		Hasta           string `json:"hasta"`
		VencimientoPago string `json:"vencimientoPago"`
	} `json:"periodoServicio"`
	Items []struct {
		Descripcion    string   `json:"descripcion"`
		Cantidad       *float64 `json:"cantidad"`
		Unidad         string   `json:"unidad"`
		PrecioUnitario *float64 `json:"precioUnitario"`
	} `json:"items"`
	// RecurrenteID: si se emite desde una factura recurrente, para pasarla al mes siguiente.
	RecurrenteID *int64 `json:"recurrenteId,omitempty"`
}

type facturaEmitida struct {
	ID             int64          `json:"id"`
	Aprobado       bool           `json:"aprobado"`
	Letra          string         `json:"letra"`
	Tipo           int            `json:"tipo"`
	PuntoVenta     int            `json:"puntoVenta"`
	Numero         int64          `json:"numero"`
	CAE            string         `json:"cae"`
	VencimientoCAE string         `json:"vencimientoCae,omitempty"`
	Total          float64        `json:"total"`
	Fecha          string         `json:"fecha"`
	QR             string         `json:"qr"`
	Observaciones  []arca.Detalle `json:"observaciones"`
}

// parseFecha interpreta AAAA-MM-DD como mediodía en hora de Argentina (evita corrimientos de día).
func parseFecha(s string, ahora time.Time) (time.Time, error) {
	if s == "" {
		return ahora, nil
	}
	d, err := time.ParseInLocation("2006-01-02", s, arca.HoraArgentina)
	if err != nil {
		return time.Time{}, err
	}
	return d.Add(12 * time.Hour), nil
}

// emitirFactura emite una Factura C (fase 1: persona humana monotributo) y devuelve el CAE y el QR.
func (s *Servidor) emitirFactura(w http.ResponseWriter, r *http.Request) error {
	var body nuevaFactura
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil || !body.valido() {
		return pedidoInvalido("datos_invalidos", "Faltan datos del comprobante o los ítems.")
	}
	prep, err := body.preparar(s.ahora())
	if err != nil {
		return err
	}
	// Antes de pedir el CAE: sesión, CUIT cargado, ARCA configurado y base para guardarlo.
	d, cuenta, cl, err := s.emisor(r)
	if err != nil {
		return err
	}
	out, err := s.emitirC(r.Context(), d, cuenta, cl, body, prep)
	if err != nil {
		return err
	}
	// Si viene de una factura recurrente, queda anotada y pasa al mes siguiente.
	if body.RecurrenteID != nil {
		s.avanzarRecurrente(r.Context(), d, cuenta.ID, *body.RecurrenteID, out)
	}
	responderJSON(w, http.StatusOK, out)
	return nil
}

// facturaPreparada: lo que se calcula del pedido antes de ir a ARCA.
type facturaPreparada struct {
	items    []datos.Item
	total    float64
	fecha    time.Time
	servicio *arca.PeriodoServicio
}

// preparar valida importes y fechas del pedido (errores 400, antes de tocar ARCA).
func (body nuevaFactura) preparar(ahora time.Time) (facturaPreparada, error) {
	var p facturaPreparada
	p.items = make([]datos.Item, len(body.Items))
	for i, it := range body.Items {
		sub := math.Round(*it.Cantidad**it.PrecioUnitario*100) / 100
		p.total += sub
		p.items[i] = datos.Item{
			Descripcion: strings.TrimSpace(it.Descripcion), Cantidad: *it.Cantidad, Unidad: it.Unidad,
			PrecioUnitario: *it.PrecioUnitario, Subtotal: sub,
		}
	}
	p.total = math.Round(p.total*100) / 100
	if p.total <= 0 {
		return p, pedidoInvalido("total_invalido", "El total debe ser mayor a cero.")
	}
	var err error
	if p.fecha, err = parseFecha(body.Fecha, ahora); err != nil {
		return p, pedidoInvalido("fecha_invalida", "La fecha tiene que tener el formato AAAA-MM-DD.")
	}
	if ps := body.PeriodoServicio; ps != nil {
		desde, e1 := parseFecha(ps.Desde, ahora)
		hasta, e2 := parseFecha(ps.Hasta, ahora)
		vto, e3 := parseFecha(ps.VencimientoPago, ahora)
		if e1 != nil || e2 != nil || e3 != nil {
			return p, pedidoInvalido("fecha_invalida", "Las fechas del período tienen que tener el formato AAAA-MM-DD.")
		}
		p.servicio = &arca.PeriodoServicio{Desde: desde, Hasta: hasta, VencimientoPago: vto}
	}
	return p, nil
}

// emitirC pide el CAE a ARCA y guarda la Factura C. La usan la web y las recurrentes automáticas.
func (s *Servidor) emitirC(ctx context.Context, d datos.Datos, cuenta datos.Cuenta, cl *ClientesArca, body nuevaFactura, prep facturaPreparada) (facturaEmitida, error) {
	fecha, total, servicio := prep.fecha, prep.total, prep.servicio
	if lim := limitesDe(cuenta.Plan); lim != nil {
		desde, hasta := mes(fecha.In(arca.HoraArgentina))
		uso, err := d.Uso(ctx, cuenta.ID, desde, hasta)
		if err != nil {
			return facturaEmitida{}, &BaseDatosError{Mensaje: err.Error()}
		}
		if uso.Facturas >= lim.Facturas {
			return facturaEmitida{}, &errorPedido{
				estado: http.StatusForbidden, codigo: "limite_plan",
				mensaje: fmt.Sprintf("Ya emitiste las %d facturas de tu plan Gratis este mes. Pasate a Pro para seguir facturando.", lim.Facturas),
				extra:   map[string]any{"uso": uso, "limites": lim},
			}
		}
	}

	pv := cuenta.PuntoVenta
	rec := body.Receptor
	res, err := cl.WsfeDe(cuenta.Cuit).Emitir(ctx, arca.NuevoComprobante{
		PuntoVenta:             pv,
		Tipo:                   arca.FacturaC,
		Concepto:               body.Concepto,
		DocTipo:                *rec.DocTipo,
		DocNro:                 rec.DocNro,
		CondicionIvaReceptorID: *rec.CondicionIvaReceptorID,
		Fecha:                  fecha,
		ImporteTotal:           total,
		ImporteNeto:            total, // La Factura C no discrimina IVA.
		Servicio:               servicio,
	})
	if err != nil {
		return facturaEmitida{}, err
	}
	if !res.Aprobado || res.CAE == "" {
		return facturaEmitida{}, &errorPedido{
			estado: http.StatusUnprocessableEntity, codigo: "rechazada", mensaje: "ARCA no autorizó la factura.",
			extra: map[string]any{"observaciones": res.Observaciones, "errores": res.Errores},
		}
	}

	fechaISO := arca.DeFechaArca(arca.AFechaArca(fecha))
	cuitEmisor, _ := strconv.ParseInt(cuenta.Cuit, 10, 64)
	nroDoc, _ := strconv.ParseInt(cuit.Limpiar(rec.DocNro), 10, 64)
	codAut, _ := strconv.ParseInt(res.CAE, 10, 64)
	docTipo := *rec.DocTipo

	out := facturaEmitida{
		Aprobado:   true,
		Letra:      "C",
		Tipo:       arca.FacturaC,
		PuntoVenta: pv,
		Numero:     res.Numero,
		CAE:        res.CAE,
		Total:      total,
		Fecha:      fechaISO,
		QR: arca.URLDelQR(arca.DatosQR{
			Fecha:      fechaISO,
			Cuit:       cuitEmisor,
			PtoVta:     pv,
			TipoCmp:    arca.FacturaC,
			NroCmp:     res.Numero,
			Importe:    total,
			Moneda:     "PES",
			Ctz:        1,
			TipoDocRec: &docTipo,
			NroDocRec:  &nroDoc,
			TipoCodAut: "E",
			CodAut:     codAut,
		}),
		Observaciones: res.Observaciones,
	}
	if res.VencimientoCAE != "" {
		out.VencimientoCAE = arca.DeFechaArca(res.VencimientoCAE)
	}

	comp := datos.Comprobante{
		Tipo: arca.FacturaC, PuntoVenta: pv, Numero: res.Numero, Fecha: fechaISO,
		Concepto: body.Concepto, Moneda: "PES", Cotizacion: 1, Total: total, Neto: total,
		CAE: res.CAE, CAEVto: out.VencimientoCAE, QR: out.QR,
		CondicionVenta: body.CondicionVenta,
		Receptor: datos.Receptor{
			DocTipo: docTipo, DocNro: cuit.Limpiar(rec.DocNro), Nombre: strings.TrimSpace(rec.Nombre),
			CondicionIvaID: *rec.CondicionIvaReceptorID, Condicion: rec.Condicion,
			Domicilio: strings.TrimSpace(rec.Domicilio), Email: strings.TrimSpace(rec.Email),
		},
		Cobro: datos.Pendiente, Items: prep.items, Respuesta: res.Respuesta,
	}
	if comp.Receptor.DocNro == "" {
		comp.Receptor.DocNro = "0"
	}
	if servicio != nil {
		ps := body.PeriodoServicio
		comp.Periodo = &datos.Periodo{Desde: ps.Desde, Hasta: ps.Hasta, VtoPago: ps.VencimientoPago}
	}
	// Usa un contexto propio: si el navegador cortó el pedido, el comprobante igual se guarda.
	ctxGuardar, cancelar := context.WithTimeout(context.WithoutCancel(ctx), 20*time.Second)
	defer cancelar()
	if err := d.GuardarComprobante(ctxGuardar, cuenta.ID, &comp); err != nil {
		// ARCA ya lo autorizó: se deja todo en el log para poder cargarlo a mano y se avisa claro.
		completo, _ := json.Marshal(comp)
		s.log.Error("comprobante autorizado sin guardar", "error", err, "comprobante", string(completo), "respuesta", res.Respuesta)
		return facturaEmitida{}, &errorPedido{
			estado: http.StatusInternalServerError, codigo: "no_guardado",
			mensaje: fmt.Sprintf("ARCA autorizó la factura %05d-%08d (CAE %s), pero no pudimos guardarla en Facti. No la vuelvas a emitir: ya es válida.", pv, res.Numero, res.CAE),
			extra:   map[string]any{"factura": out},
		}
	}
	out.ID = comp.ID
	return out, nil
}

func (b nuevaFactura) valido() bool {
	if b.Receptor == nil || b.Receptor.DocTipo == nil || b.Receptor.CondicionIvaReceptorID == nil {
		return false
	}
	if b.Concepto < 1 || b.Concepto > 3 || len(b.Items) == 0 {
		return false
	}
	for _, it := range b.Items {
		if it.Cantidad == nil || it.PrecioUnitario == nil {
			return false
		}
	}
	return true
}
