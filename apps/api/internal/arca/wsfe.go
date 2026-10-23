package arca

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"sync"
	"time"
)

const nsWsfe = "http://ar.gov.afip.dif.FEV1/"

// AlicuotaIva de un comprobante A, B o M.
type AlicuotaIva struct {
	ID            int // ver AlicuotasIVA
	BaseImponible float64
	Importe       float64
}

// ComprobanteAsociado, para notas de crédito y débito.
type ComprobanteAsociado struct {
	Tipo       int
	PuntoVenta int
	Numero     int64
	Cuit       string
	Fecha      time.Time // opcional
}

// PeriodoServicio es obligatorio si el concepto incluye servicios.
type PeriodoServicio struct {
	Desde           time.Time
	Hasta           time.Time
	VencimientoPago time.Time
}

// NuevoComprobante a autorizar con FECAESolicitar.
type NuevoComprobante struct {
	PuntoVenta             int
	Tipo                   int // ver FacturaA, FacturaC, etc.
	Concepto               int // 1, 2 o 3
	DocTipo                int
	DocNro                 string
	CondicionIvaReceptorID int
	Fecha                  time.Time // si es cero, hoy
	ImporteTotal           float64
	ImporteNeto            float64
	ImporteIva             float64
	ImporteExento          float64
	ImporteNoGravado       float64
	ImporteTributos        float64
	Alicuotas              []AlicuotaIva
	Servicio               *PeriodoServicio
	MonedaID               string  // si está vacío, PES
	Cotizacion             float64 // si es cero, 1
	Asociados              []ComprobanteAsociado
}

// ResultadoCAE de una emisión.
type ResultadoCAE struct {
	Aprobado       bool
	Numero         int64
	CAE            string
	VencimientoCAE string // AAAAMMDD
	Observaciones  []Detalle
	Errores        []Detalle
	// Respuesta de ARCA tal como llegó (XML), para guardarla junto al comprobante.
	Respuesta string
}

// crudo guarda el XML original de la respuesta de un método.
type crudo struct{ xml []byte }

func (c *crudo) guardarCrudo(b []byte) { c.xml = append([]byte(nil), b...) }

// EstadoServidores según FEDummy.
type EstadoServidores struct {
	App  string `json:"app"`
	DB   string `json:"db"`
	Auth string `json:"auth"`
}

// PuntoVenta habilitado para Web Services.
type PuntoVenta struct {
	Numero      int    `json:"numero"`
	TipoEmision string `json:"tipoEmision"`
	Bloqueado   bool   `json:"bloqueado"`
}

// CondicionIva de la tabla FEParamGetCondicionIvaReceptor.
type CondicionIva struct {
	ID          int    `json:"id"`
	Descripcion string `json:"descripcion"`
}

// ComprobanteConsultado con FECompConsultar.
type ComprobanteConsultado struct {
	Concepto        int     `xml:"Concepto" json:"concepto"`
	DocTipo         int     `xml:"DocTipo" json:"docTipo"`
	DocNro          string  `xml:"DocNro" json:"docNro"`
	CbteDesde       int64   `xml:"CbteDesde" json:"cbteDesde"`
	CbteHasta       int64   `xml:"CbteHasta" json:"cbteHasta"`
	CbteFch         string  `xml:"CbteFch" json:"cbteFch"`
	ImpTotal        float64 `xml:"ImpTotal" json:"impTotal"`
	ImpNeto         float64 `xml:"ImpNeto" json:"impNeto"`
	MonID           string  `xml:"MonId" json:"monId"`
	Resultado       string  `xml:"Resultado" json:"resultado"`
	CodAutorizacion string  `xml:"CodAutorizacion" json:"codAutorizacion"`
	EmisionTipo     string  `xml:"EmisionTipo" json:"emisionTipo"`
	FchVto          string  `xml:"FchVto" json:"fchVto"`
	PtoVta          int     `xml:"PtoVta" json:"ptoVta"`
	CbteTipo        int     `xml:"CbteTipo" json:"cbteTipo"`
	// XML original de FECompConsultar.
	Respuesta string `xml:"-" json:"-"`
}

type errXML struct {
	Code string `xml:"Code"`
	Msg  string `xml:"Msg"`
}

type conErrores struct {
	Errors struct {
		Err []errXML `xml:"Err"`
	} `xml:"Errors"`
}

func (c conErrores) detalles() []Detalle { return aDetalles(c.Errors.Err) }

func (c conErrores) tieneCodigo(codigo string) bool {
	for _, e := range c.Errors.Err {
		if strings.TrimSpace(e.Code) == codigo {
			return true
		}
	}
	return false
}

func (c conErrores) lanzar(metodo string) error {
	d := c.detalles()
	if len(d) == 0 {
		return nil
	}
	msgs := make([]string, len(d))
	for i, x := range d {
		msgs[i] = x.Mensaje
	}
	return &Error{Mensaje: metodo + ": " + strings.Join(msgs, " | "), Detalles: d, Servicio: "WSFEv1"}
}

func aDetalles(l []errXML) []Detalle {
	out := make([]Detalle, 0, len(l))
	for _, e := range l {
		out = append(out, Detalle{Codigo: strings.TrimSpace(e.Code), Mensaje: strings.TrimSpace(e.Msg)})
	}
	return out
}

// Wsfe es el cliente de WSFEv1 para un emisor (el CUIT representado).
type Wsfe struct {
	cfg        Config
	tickets    *CacheTickets
	cuitEmisor string

	mu       sync.Mutex
	bloqueos map[string]*sync.Mutex
}

func NuevoWsfe(cfg Config, tickets *CacheTickets, cuitEmisor string) *Wsfe {
	return &Wsfe{cfg: cfg, tickets: tickets, cuitEmisor: cuitEmisor, bloqueos: map[string]*sync.Mutex{}}
}

// llamar invoca un método de WSFEv1 y decodifica <metodo>Result en out.
func (w *Wsfe) llamar(ctx context.Context, metodo, interior string, conAuth bool, out any) error {
	auth := ""
	if conAuth {
		ta, err := w.tickets.Obtener(ctx, ServicioFacturacion)
		if err != nil {
			return err
		}
		auth = "<ar:Auth><ar:Token>" + ta.Token + "</ar:Token><ar:Sign>" + ta.Sign +
			"</ar:Sign><ar:Cuit>" + esc(w.cuitEmisor) + "</ar:Cuit></ar:Auth>"
	}
	cuerpo, err := llamarSoap(ctx, w.cfg, pedidoSoap{
		url:      w.cfg.endpoints().WSFE,
		accion:   nsWsfe + metodo,
		servicio: "WSFEv1." + metodo,
		cuerpo:   "<ar:" + metodo + ` xmlns:ar="` + nsWsfe + `">` + auth + interior + "</ar:" + metodo + ">",
	})
	if err != nil {
		return err
	}
	var resp struct {
		Resultado *struct {
			Interior []byte `xml:",innerxml"`
		} `xml:",any"`
	}
	if err := xmlUnmarshal(cuerpo, &resp); err != nil || resp.Resultado == nil {
		return &Error{Mensaje: "Respuesta vacía de " + metodo, Servicio: "WSFEv1"}
	}
	envuelto := append(append([]byte("<r>"), resp.Resultado.Interior...), "</r>"...)
	if err := xmlUnmarshal(envuelto, out); err != nil {
		return &Error{Mensaje: "Respuesta inválida de " + metodo + ": " + err.Error(), Servicio: "WSFEv1"}
	}
	if c, ok := out.(interface{ guardarCrudo([]byte) }); ok {
		c.guardarCrudo([]byte("<" + metodo + "Result>" + string(resp.Resultado.Interior) + "</" + metodo + "Result>"))
	}
	return nil
}

// Estado de los servidores de ARCA. No requiere autenticación.
func (w *Wsfe) Estado(ctx context.Context) (EstadoServidores, error) {
	var r struct {
		App  string `xml:"AppServer"`
		DB   string `xml:"DbServer"`
		Auth string `xml:"AuthServer"`
	}
	if err := w.llamar(ctx, "FEDummy", "", false, &r); err != nil {
		return EstadoServidores{}, err
	}
	return EstadoServidores{App: r.App, DB: r.DB, Auth: r.Auth}, nil
}

// UltimoAutorizado devuelve el número del último comprobante autorizado.
func (w *Wsfe) UltimoAutorizado(ctx context.Context, puntoVenta, tipo int) (int64, error) {
	var r struct {
		conErrores
		CbteNro int64 `xml:"CbteNro"`
	}
	interior := fmt.Sprintf("<ar:PtoVta>%d</ar:PtoVta><ar:CbteTipo>%d</ar:CbteTipo>", puntoVenta, tipo)
	if err := w.llamar(ctx, "FECompUltimoAutorizado", interior, true, &r); err != nil {
		return 0, err
	}
	if err := r.lanzar("FECompUltimoAutorizado"); err != nil {
		return 0, err
	}
	return r.CbteNro, nil
}

// PuntosDeVenta habilitados para Web Services.
func (w *Wsfe) PuntosDeVenta(ctx context.Context) ([]PuntoVenta, error) {
	var r struct {
		conErrores
		ResultGet struct {
			PtoVenta []struct {
				Nro         int    `xml:"Nro"`
				EmisionTipo string `xml:"EmisionTipo"`
				Bloqueado   string `xml:"Bloqueado"`
			} `xml:"PtoVenta"`
		} `xml:"ResultGet"`
	}
	if err := w.llamar(ctx, "FEParamGetPtosVenta", "", true, &r); err != nil {
		return nil, err
	}
	out := []PuntoVenta{}
	// Si no tiene puntos de venta Web Services, ARCA devuelve un error 602.
	if r.tieneCodigo("602") {
		return out, nil
	}
	if err := r.lanzar("FEParamGetPtosVenta"); err != nil {
		return nil, err
	}
	for _, p := range r.ResultGet.PtoVenta {
		out = append(out, PuntoVenta{
			Numero:      p.Nro,
			TipoEmision: strings.TrimSpace(p.EmisionTipo),
			Bloqueado:   strings.TrimSpace(p.Bloqueado) == "S",
		})
	}
	return out, nil
}

// CondicionesIvaReceptor (RG 5616). claseComprobante puede ser "A", "B", "C", "M" o "".
func (w *Wsfe) CondicionesIvaReceptor(ctx context.Context, claseComprobante string) ([]CondicionIva, error) {
	var r struct {
		conErrores
		ResultGet struct {
			Condicion []struct {
				ID   int    `xml:"Id"`
				Desc string `xml:"Desc"`
			} `xml:"CondicionIvaReceptor"`
		} `xml:"ResultGet"`
	}
	interior := ""
	if claseComprobante != "" {
		interior = "<ar:ClaseCmp>" + esc(claseComprobante) + "</ar:ClaseCmp>"
	}
	if err := w.llamar(ctx, "FEParamGetCondicionIvaReceptor", interior, true, &r); err != nil {
		return nil, err
	}
	if err := r.lanzar("FEParamGetCondicionIvaReceptor"); err != nil {
		return nil, err
	}
	out := []CondicionIva{}
	for _, c := range r.ResultGet.Condicion {
		out = append(out, CondicionIva{ID: c.ID, Descripcion: strings.TrimSpace(c.Desc)})
	}
	return out, nil
}

// Consultar un comprobante. Devuelve nil si no existe.
func (w *Wsfe) Consultar(ctx context.Context, puntoVenta, tipo int, numero int64) (*ComprobanteConsultado, error) {
	var r struct {
		conErrores
		crudo
		ResultGet *ComprobanteConsultado `xml:"ResultGet"`
	}
	interior := fmt.Sprintf(
		"<ar:FeCompConsReq><ar:CbteTipo>%d</ar:CbteTipo><ar:CbteNro>%d</ar:CbteNro><ar:PtoVta>%d</ar:PtoVta></ar:FeCompConsReq>",
		tipo, numero, puntoVenta)
	if err := w.llamar(ctx, "FECompConsultar", interior, true, &r); err != nil {
		return nil, err
	}
	// Error 602: el comprobante no existe.
	if r.tieneCodigo("602") {
		return nil, nil
	}
	if err := r.lanzar("FECompConsultar"); err != nil {
		return nil, err
	}
	if r.ResultGet != nil {
		r.ResultGet.Respuesta = string(r.xml)
	}
	return r.ResultGet, nil
}

// Emitir toma el próximo número y pide el CAE.
// Solo un pedido a la vez por punto de venta y tipo, porque la numeración es correlativa.
// Si ARCA no responde, consulta si el número quedó autorizado antes de dar error.
func (w *Wsfe) Emitir(ctx context.Context, c NuevoComprobante) (ResultadoCAE, error) {
	if err := Validar(c); err != nil {
		return ResultadoCAE{}, err
	}
	clave := fmt.Sprintf("%d-%d", c.PuntoVenta, c.Tipo)
	w.mu.Lock()
	l, ok := w.bloqueos[clave]
	if !ok {
		l = &sync.Mutex{}
		w.bloqueos[clave] = l
	}
	w.mu.Unlock()
	l.Lock()
	defer l.Unlock()
	return w.emitirSinBloqueo(ctx, c)
}

func (w *Wsfe) emitirSinBloqueo(ctx context.Context, c NuevoComprobante) (ResultadoCAE, error) {
	ultimo, err := w.UltimoAutorizado(ctx, c.PuntoVenta, c.Tipo)
	if err != nil {
		return ResultadoCAE{}, err
	}
	numero := ultimo + 1

	var r respuestaCAE
	err = w.llamar(ctx, "FECAESolicitar", ArmarSolicitud(c, numero), true, &r)
	if err == nil {
		return r.resultado(numero), nil
	}
	var sinRespuesta *SinRespuestaError
	if !errors.As(err, &sinRespuesta) {
		return ResultadoCAE{}, err
	}
	// No sabemos si ARCA lo autorizó: se consulta antes de dar error (y antes de cualquier reintento).
	existente, errConsulta := w.Consultar(context.WithoutCancel(ctx), c.PuntoVenta, c.Tipo, numero)
	if errConsulta == nil && existente != nil && existente.CodAutorizacion != "" {
		return ResultadoCAE{
			Aprobado:       true,
			Numero:         numero,
			CAE:            strings.TrimSpace(existente.CodAutorizacion),
			VencimientoCAE: strings.TrimSpace(existente.FchVto),
			Observaciones:  []Detalle{},
			Errores:        []Detalle{},
			Respuesta:      existente.Respuesta,
		}, nil
	}
	return ResultadoCAE{}, err
}

type respuestaCAE struct {
	conErrores
	crudo
	FeDetResp struct {
		Det []struct {
			Resultado     string `xml:"Resultado"`
			CAE           string `xml:"CAE"`
			CAEFchVto     string `xml:"CAEFchVto"`
			Observaciones struct {
				Obs []errXML `xml:"Obs"`
			} `xml:"Observaciones"`
		} `xml:"FECAEDetResponse"`
	} `xml:"FeDetResp"`
}

func (r respuestaCAE) resultado(numero int64) ResultadoCAE {
	res := ResultadoCAE{Numero: numero, Errores: r.detalles(), Observaciones: []Detalle{}, Respuesta: string(r.xml)}
	if len(r.FeDetResp.Det) == 0 {
		return res
	}
	d := r.FeDetResp.Det[0]
	res.Observaciones = aDetalles(d.Observaciones.Obs)
	res.Aprobado = strings.TrimSpace(d.Resultado) == "A"
	if res.Aprobado {
		res.CAE = strings.TrimSpace(d.CAE)
		res.VencimientoCAE = strings.TrimSpace(d.CAEFchVto)
	}
	return res
}

// Validar revisa los importes y los datos obligatorios antes de mandar el pedido.
func Validar(c NuevoComprobante) error {
	suma := c.ImporteNeto + c.ImporteIva + c.ImporteExento + c.ImporteNoGravado + c.ImporteTributos
	if math.Abs(suma-c.ImporteTotal) > 0.01 {
		return &Error{Mensaje: fmt.Sprintf("El total (%.2f) no coincide con la suma de importes (%.2f)", c.ImporteTotal, suma)}
	}
	if c.Concepto < 1 || c.Concepto > 3 {
		return &Error{Mensaje: "El concepto tiene que ser 1 (productos), 2 (servicios) o 3 (ambos)"}
	}
	if c.Concepto != ConceptoProductos && c.Servicio == nil {
		return &Error{Mensaje: "Para servicios hay que indicar período facturado y vencimiento de pago"}
	}
	if esTipoC(c.Tipo) && (c.ImporteIva != 0 || len(c.Alicuotas) > 0) {
		return &Error{Mensaje: "Los comprobantes C no discriminan IVA"}
	}
	if !esTipoC(c.Tipo) && c.ImporteIva > 0 && len(c.Alicuotas) == 0 {
		return &Error{Mensaje: "Falta el detalle de alícuotas de IVA"}
	}
	return nil
}

// ArmarSolicitud arma el FeCAEReq de un comprobante con el número indicado.
func ArmarSolicitud(c NuevoComprobante, numero int64) string {
	fecha := c.Fecha
	if fecha.IsZero() {
		fecha = time.Now()
	}
	moneda := c.MonedaID
	if moneda == "" {
		moneda = "PES"
	}
	cotizacion := c.Cotizacion
	if cotizacion == 0 {
		cotizacion = 1
	}

	var b strings.Builder
	b.WriteString("<ar:FeCAEReq><ar:FeCabReq>")
	fmt.Fprintf(&b, "<ar:CantReg>1</ar:CantReg><ar:PtoVta>%d</ar:PtoVta><ar:CbteTipo>%d</ar:CbteTipo>", c.PuntoVenta, c.Tipo)
	b.WriteString("</ar:FeCabReq><ar:FeDetReq><ar:FECAEDetRequest>")
	fmt.Fprintf(&b, "<ar:Concepto>%d</ar:Concepto><ar:DocTipo>%d</ar:DocTipo><ar:DocNro>%s</ar:DocNro>", c.Concepto, c.DocTipo, esc(c.DocNro))
	fmt.Fprintf(&b, "<ar:CbteDesde>%d</ar:CbteDesde><ar:CbteHasta>%d</ar:CbteHasta><ar:CbteFch>%s</ar:CbteFch>", numero, numero, AFechaArca(fecha))
	b.WriteString("<ar:ImpTotal>" + importe(c.ImporteTotal) + "</ar:ImpTotal>")
	b.WriteString("<ar:ImpTotConc>" + importe(c.ImporteNoGravado) + "</ar:ImpTotConc>")
	b.WriteString("<ar:ImpNeto>" + importe(c.ImporteNeto) + "</ar:ImpNeto>")
	b.WriteString("<ar:ImpOpEx>" + importe(c.ImporteExento) + "</ar:ImpOpEx>")
	b.WriteString("<ar:ImpTrib>" + importe(c.ImporteTributos) + "</ar:ImpTrib>")
	b.WriteString("<ar:ImpIVA>" + importe(c.ImporteIva) + "</ar:ImpIVA>")
	if s := c.Servicio; s != nil {
		b.WriteString("<ar:FchServDesde>" + AFechaArca(s.Desde) + "</ar:FchServDesde>")
		b.WriteString("<ar:FchServHasta>" + AFechaArca(s.Hasta) + "</ar:FchServHasta>")
		b.WriteString("<ar:FchVtoPago>" + AFechaArca(s.VencimientoPago) + "</ar:FchVtoPago>")
	}
	b.WriteString("<ar:MonId>" + esc(moneda) + "</ar:MonId><ar:MonCotiz>" + strconv.FormatFloat(cotizacion, 'f', -1, 64) + "</ar:MonCotiz>")
	fmt.Fprintf(&b, "<ar:CondicionIVAReceptorId>%d</ar:CondicionIVAReceptorId>", c.CondicionIvaReceptorID)
	if len(c.Asociados) > 0 {
		b.WriteString("<ar:CbtesAsoc>")
		for _, a := range c.Asociados {
			fmt.Fprintf(&b, "<ar:CbteAsoc><ar:Tipo>%d</ar:Tipo><ar:PtoVta>%d</ar:PtoVta><ar:Nro>%d</ar:Nro>", a.Tipo, a.PuntoVenta, a.Numero)
			if a.Cuit != "" {
				b.WriteString("<ar:Cuit>" + esc(a.Cuit) + "</ar:Cuit>")
			}
			if !a.Fecha.IsZero() {
				b.WriteString("<ar:CbteFch>" + AFechaArca(a.Fecha) + "</ar:CbteFch>")
			}
			b.WriteString("</ar:CbteAsoc>")
		}
		b.WriteString("</ar:CbtesAsoc>")
	}
	if len(c.Alicuotas) > 0 {
		b.WriteString("<ar:Iva>")
		for _, a := range c.Alicuotas {
			fmt.Fprintf(&b, "<ar:AlicIva><ar:Id>%d</ar:Id><ar:BaseImp>%s</ar:BaseImp><ar:Importe>%s</ar:Importe></ar:AlicIva>",
				a.ID, importe(a.BaseImponible), importe(a.Importe))
		}
		b.WriteString("</ar:Iva>")
	}
	b.WriteString("</ar:FECAEDetRequest></ar:FeDetReq></ar:FeCAEReq>")
	return b.String()
}
