package arca

// Códigos de las tablas de ARCA usados por WSFEv1.
// Las tablas oficiales se pueden consultar con los métodos FEParamGet* del web service;
// estas constantes cubren los casos del MVP.

// Tipos de comprobante.
const (
	FacturaA     = 1
	NotaDebitoA  = 2
	NotaCreditoA = 3
	FacturaB     = 6
	NotaDebitoB  = 7
	NotaCreditoB = 8
	FacturaC     = 11
	NotaDebitoC  = 12
	NotaCreditoC = 13
	FacturaM     = 51
	NotaDebitoM  = 52
	NotaCreditoM = 53
)

// Conceptos.
const (
	ConceptoProductos           = 1
	ConceptoServicios           = 2
	ConceptoProductosYServicios = 3
)

// Tipos de documento del receptor.
const (
	DocCUIT           = 80
	DocCUIL           = 86
	DocDNI            = 96
	DocSinIdentificar = 99
)

// Condición frente al IVA del receptor (RG 5616). Confirmar con FEParamGetCondicionIvaReceptor.
const (
	CondIvaResponsableInscripto = 1
	CondIvaExento               = 4
	CondIvaConsumidorFinal      = 5
	CondIvaMonotributo          = 6
)

// AlicuotasIVA mapea el porcentaje al Id de la tabla de ARCA.
var AlicuotasIVA = map[string]int{
	"0": 3, "10.5": 4, "21": 5, "27": 6, "5": 8, "2.5": 9,
}

const LeyendaLey27618 = "El crédito fiscal discriminado en el presente comprobante, solo podrá ser computado a efectos del Régimen de Sostenimiento e Inclusión Fiscal para Pequeños Contribuyentes de la Ley Nº 27.618"

// CondicionFiscal de un contribuyente según el padrón.
type CondicionFiscal string

const (
	ResponsableInscripto CondicionFiscal = "responsable_inscripto"
	Monotributo          CondicionFiscal = "monotributo"
	Exento               CondicionFiscal = "exento"
	ConsumidorFinal      CondicionFiscal = "consumidor_final"
	NoAlcanzado          CondicionFiscal = "no_alcanzado"
)

// Sugerencia de comprobante para un emisor y un receptor.
type Sugerencia struct {
	Tipo    int    `json:"tipo"`
	Letra   string `json:"letra"`
	Leyenda string `json:"leyenda,omitempty"`
}

// FacturaSugerida elige la factura según emisor y receptor (RG 1415).
// Para responsables inscriptos, ARCA puede asignar "A con leyenda" o "M":
// en ese caso hay que respetar lo que habilita el punto de venta.
func FacturaSugerida(emisor, receptor CondicionFiscal) Sugerencia {
	if emisor != ResponsableInscripto {
		return Sugerencia{Tipo: FacturaC, Letra: "C"}
	}
	switch receptor {
	case ResponsableInscripto:
		return Sugerencia{Tipo: FacturaA, Letra: "A"}
	case Monotributo:
		return Sugerencia{Tipo: FacturaA, Letra: "A", Leyenda: LeyendaLey27618}
	}
	return Sugerencia{Tipo: FacturaB, Letra: "B"}
}

// LetraDeTipo devuelve la letra del comprobante, o "" si el tipo no es A, B, C ni M.
func LetraDeTipo(tipo int) string {
	switch tipo {
	case FacturaA, NotaDebitoA, NotaCreditoA:
		return "A"
	case FacturaB, NotaDebitoB, NotaCreditoB:
		return "B"
	case FacturaC, NotaDebitoC, NotaCreditoC:
		return "C"
	case FacturaM, NotaDebitoM, NotaCreditoM:
		return "M"
	}
	return ""
}

func esTipoC(tipo int) bool { return LetraDeTipo(tipo) == "C" }

// FacturaE es el tipo de comprobante de la Factura de exportación (WSFEX).
const FacturaE = 19

// EsNotaCredito indica si el tipo es una nota de crédito A, B, C o M.
func EsNotaCredito(tipo int) bool {
	switch tipo {
	case NotaCreditoA, NotaCreditoB, NotaCreditoC, NotaCreditoM:
		return true
	}
	return false
}

// EsNotaDebito indica si el tipo es una nota de débito A, B, C o M.
func EsNotaDebito(tipo int) bool {
	switch tipo {
	case NotaDebitoA, NotaDebitoB, NotaDebitoC, NotaDebitoM:
		return true
	}
	return false
}

// Sigla corta para mostrar en la app: A, B, C, M, E, NC o ND.
func Sigla(tipo int) string {
	switch {
	case tipo == FacturaE:
		return "E"
	case EsNotaCredito(tipo):
		return "NC"
	case EsNotaDebito(tipo):
		return "ND"
	}
	return LetraDeTipo(tipo)
}
