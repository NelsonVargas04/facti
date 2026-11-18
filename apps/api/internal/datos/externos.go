package datos

import "time"

// Externo es un comprobante emitido fuera de Facti, importado de "Mis Comprobantes – Emitidos".
type Externo struct {
	Fecha           string  `json:"fecha"` // AAAA-MM-DD
	Tipo            int     `json:"tipo"`
	PuntoVenta      int     `json:"puntoVenta"`
	Numero          int64   `json:"numero"`
	NumeroHasta     int64   `json:"numeroHasta"`
	CodAutorizacion string  `json:"codAutorizacion"`
	DocTipo         int     `json:"docTipo"`
	DocNro          string  `json:"docNro"`
	Receptor        string  `json:"receptor"`
	Moneda          string  `json:"moneda"` // PES, DOL…
	Cotizacion      float64 `json:"cotizacion"`
	Total           float64 `json:"total"` // en la moneda del comprobante, sin signo
	Pesos           float64 `json:"pesos"` // en pesos y con signo (las notas de crédito restan)
}

// Importacion cuenta qué pasó con cada comprobante del archivo.
type Importacion struct {
	Nuevos    int `json:"nuevos"`
	Repetidos int `json:"repetidos"` // ya se habían importado antes
	EnFacti   int `json:"enFacti"`   // se emitieron con Facti: ya se cuentan
}

// IngresoMes es lo facturado en un mes, en pesos: con Facti (incluye moneda extranjera a su
// cotización) y fuera de Facti (importado).
type IngresoMes struct {
	Mes     string  `json:"mes"` // AAAA-MM
	Facti   float64 `json:"facti"`
	Externo float64 `json:"externo"`
}

// EstadoExternos dice cuántos comprobantes externos hay y cuándo fue la última importación.
type EstadoExternos struct {
	Cantidad          int        `json:"cantidad"`
	Desde             string     `json:"desde,omitempty"` // fecha del más viejo, AAAA-MM-DD
	Hasta             string     `json:"hasta,omitempty"` // fecha del más nuevo
	UltimaImportacion *time.Time `json:"ultimaImportacion,omitempty"`
}

// mesesEntre devuelve los meses AAAA-MM de desde a hasta (AAAA-MM-DD), del más viejo al más nuevo.
func mesesEntre(desde, hasta string) []string {
	d, err1 := time.Parse("2006-01", desde[:7])
	h, err2 := time.Parse("2006-01", hasta[:7])
	if err1 != nil || err2 != nil {
		return nil
	}
	var out []string
	for m := d; !m.After(h); m = m.AddDate(0, 1, 0) {
		out = append(out, m.Format("2006-01"))
	}
	return out
}

// pesosDe pasa a pesos con signo un comprobante de Facti.
func pesosDe(c Comprobante) float64 {
	v := c.Firmado()
	if c.Moneda != "PES" && c.Moneda != "" {
		cot := c.Cotizacion
		if cot <= 0 {
			cot = 1
		}
		v *= cot
	}
	return v
}
