package servidor

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"facti/api/internal/arca"
	"facti/api/internal/cuit"
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
	estado, err := cl.Wsfe.Estado(r.Context())
	if err != nil {
		return err
	}
	responderJSON(w, http.StatusOK, map[string]any{"entorno": cl.Cfg.Entorno, "servidores": estado})
	return nil
}

func (s *Servidor) arcaPuntosVenta(w http.ResponseWriter, r *http.Request) error {
	cl, err := s.arca()
	if err != nil {
		return err
	}
	pv, err := cl.Wsfe.PuntosDeVenta(r.Context())
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
	cl, err := s.arca()
	if err != nil {
		return err
	}
	condiciones, err := cl.Wsfe.CondicionesIvaReceptor(r.Context(), clase)
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
	} `json:"receptor"`
	Concepto        int    `json:"concepto"`
	Fecha           string `json:"fecha"` // AAAA-MM-DD
	PeriodoServicio *struct {
		Desde           string `json:"desde"`
		Hasta           string `json:"hasta"`
		VencimientoPago string `json:"vencimientoPago"`
	} `json:"periodoServicio"`
	Items []struct {
		Descripcion    string   `json:"descripcion"`
		Cantidad       *float64 `json:"cantidad"`
		PrecioUnitario *float64 `json:"precioUnitario"`
	} `json:"items"`
}

type facturaEmitida struct {
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

	total := 0.0
	for _, it := range body.Items {
		total += *it.Cantidad * *it.PrecioUnitario
	}
	if total <= 0 {
		return pedidoInvalido("total_invalido", "El total debe ser mayor a cero.")
	}

	ahora := s.ahora()
	fecha, err := parseFecha(body.Fecha, ahora)
	if err != nil {
		return pedidoInvalido("fecha_invalida", "La fecha tiene que tener el formato AAAA-MM-DD.")
	}
	var servicio *arca.PeriodoServicio
	if p := body.PeriodoServicio; p != nil {
		desde, e1 := parseFecha(p.Desde, ahora)
		hasta, e2 := parseFecha(p.Hasta, ahora)
		vto, e3 := parseFecha(p.VencimientoPago, ahora)
		if e1 != nil || e2 != nil || e3 != nil {
			return pedidoInvalido("fecha_invalida", "Las fechas del período tienen que tener el formato AAAA-MM-DD.")
		}
		servicio = &arca.PeriodoServicio{Desde: desde, Hasta: hasta, VencimientoPago: vto}
	}

	cl, err := s.arca()
	if err != nil {
		return err
	}
	rec := body.Receptor
	res, err := cl.Wsfe.Emitir(r.Context(), arca.NuevoComprobante{
		PuntoVenta:             cl.PuntoVenta,
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
		return err
	}
	if !res.Aprobado || res.CAE == "" {
		responderJSON(w, http.StatusUnprocessableEntity, map[string]any{
			"error":         "rechazada",
			"mensaje":       "ARCA no autorizó la factura.",
			"observaciones": res.Observaciones,
			"errores":       res.Errores,
		})
		return nil
	}

	fechaISO := arca.DeFechaArca(arca.AFechaArca(fecha))
	cuitEmisor, _ := strconv.ParseInt(cuit.Limpiar(cl.CuitEmisor), 10, 64)
	nroDoc, _ := strconv.ParseInt(cuit.Limpiar(rec.DocNro), 10, 64)
	codAut, _ := strconv.ParseInt(res.CAE, 10, 64)
	docTipo := *rec.DocTipo

	out := facturaEmitida{
		Aprobado:   true,
		Letra:      "C",
		Tipo:       arca.FacturaC,
		PuntoVenta: cl.PuntoVenta,
		Numero:     res.Numero,
		CAE:        res.CAE,
		Total:      total,
		Fecha:      fechaISO,
		QR: arca.URLDelQR(arca.DatosQR{
			Fecha:      fechaISO,
			Cuit:       cuitEmisor,
			PtoVta:     cl.PuntoVenta,
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
	responderJSON(w, http.StatusOK, out)
	return nil
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
