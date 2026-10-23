// Package datos guarda cuentas, clientes y comprobantes.
// La implementación de producción es Postgres (Supabase); Memoria se usa en los tests.
package datos

import (
	"context"
	"errors"
	"time"

	"facti/api/internal/arca"
)

// ErrNoEncontrado se devuelve cuando el registro no existe (o es de otra cuenta).
var ErrNoEncontrado = errors.New("no encontrado")

// Plan de la cuenta.
type Plan string

const (
	PlanGratis Plan = "gratis"
	PlanPro    Plan = "pro"
)

// Cobro de un comprobante. Las notas de crédito no se cobran: quedan con SinCobro.
type Cobro string

const (
	SinCobro  Cobro = ""
	Pendiente Cobro = "pendiente"
	Cobrada   Cobro = "cobrada"
)

// Cuenta del emisor. Por ahora hay una sola (la del .env); con login habrá una por usuario.
type Cuenta struct {
	ID                int64     `json:"id"`
	Cuit              string    `json:"cuit"`
	Nombre            string    `json:"nombre"`
	Domicilio         string    `json:"domicilio"`
	Condicion         string    `json:"condicion"` // responsable_inscripto, monotributo, exento…
	Categoria         string    `json:"categoria"` // categoría de monotributo según el padrón
	IngresosBrutos    string    `json:"ingresosBrutos"`
	InicioActividades string    `json:"inicioActividades"` // AAAA-MM-DD o ""
	PuntoVenta        int       `json:"puntoVenta"`
	Plan              Plan      `json:"plan"`
	CreadaEn          time.Time `json:"creadaEn"`
}

// Perfil fiscal del emisor (sale del padrón de ARCA).
type Perfil struct {
	Nombre    string
	Domicilio string
	Condicion string
	Categoria string
}

// Receptor tal como quedó en el comprobante (copia: no cambia si después cambia el cliente).
type Receptor struct {
	DocTipo        int    `json:"docTipo"`
	DocNro         string `json:"docNro"`
	Nombre         string `json:"nombre"`
	CondicionIvaID int    `json:"condicionIvaId"`
	Condicion      string `json:"condicion"`
	Domicilio      string `json:"domicilio"`
	Email          string `json:"email"`
}

// Identificado indica si el receptor tiene documento (no es consumidor final anónimo).
func (r Receptor) Identificado() bool { return r.DocNro != "" && r.DocNro != "0" }

// completarReceptor llena lo que no vino en el pedido con lo que ya se sabe del cliente.
func completarReceptor(r *Receptor, nombre, condicion, domicilio, email string) {
	for _, par := range [][2]*string{{&r.Nombre, &nombre}, {&r.Condicion, &condicion}, {&r.Domicilio, &domicilio}, {&r.Email, &email}} {
		if *par[0] == "" {
			*par[0] = *par[1]
		}
	}
}

// Periodo del servicio facturado.
type Periodo struct {
	Desde   string `json:"desde"` // AAAA-MM-DD
	Hasta   string `json:"hasta"`
	VtoPago string `json:"vtoPago"`
}

// Item del detalle.
type Item struct {
	Descripcion    string  `json:"descripcion"`
	Cantidad       float64 `json:"cantidad"`
	Unidad         string  `json:"unidad"`
	PrecioUnitario float64 `json:"precioUnitario"`
	Subtotal       float64 `json:"subtotal"`
}

// Comprobante autorizado por ARCA.
type Comprobante struct {
	ID             int64      `json:"id"`
	Tipo           int        `json:"tipo"`
	Sigla          string     `json:"sigla"` // A, B, C, M, E, NC, ND
	PuntoVenta     int        `json:"puntoVenta"`
	Numero         int64      `json:"numero"`
	Fecha          string     `json:"fecha"` // AAAA-MM-DD
	Concepto       int        `json:"concepto"`
	Moneda         string     `json:"moneda"`
	Cotizacion     float64    `json:"cotizacion"`
	Total          float64    `json:"total"`
	Neto           float64    `json:"neto"`
	IVA            float64    `json:"iva"`
	CAE            string     `json:"cae"`
	CAEVto         string     `json:"caeVto"` // AAAA-MM-DD
	QR             string     `json:"qr"`
	Periodo        *Periodo   `json:"periodo,omitempty"`
	CondicionVenta string     `json:"condicionVenta"`
	Receptor       Receptor   `json:"receptor"`
	ClienteID      *int64     `json:"clienteId,omitempty"`
	Cobro          Cobro      `json:"cobro"`
	CobradaEn      *time.Time `json:"cobradaEn,omitempty"`
	Items          []Item     `json:"items,omitempty"`
	CreadoEn       time.Time  `json:"creadoEn"`
	// Respuesta original de ARCA. Se guarda 10 años pero no se manda a la web.
	Respuesta string `json:"-"`
}

// completarSigla deja la sigla que corresponde al tipo (las dos implementaciones guardan solo el tipo).
func completarSigla(c *Comprobante) { c.Sigla = arca.Sigla(c.Tipo) }

// Firmado devuelve el total con signo: las notas de crédito restan.
func (c Comprobante) Firmado() float64 {
	if c.Sigla == "NC" {
		return -c.Total
	}
	return c.Total
}

// Cliente con lo que se le facturó.
type Cliente struct {
	ID             int64   `json:"id"`
	DocTipo        int     `json:"docTipo"`
	DocNro         string  `json:"docNro"`
	Nombre         string  `json:"nombre"`
	CondicionIvaID int     `json:"condicionIvaId"`
	Condicion      string  `json:"condicion"`
	Domicilio      string  `json:"domicilio"`
	Email          string  `json:"email"`
	Comprobantes   int     `json:"comprobantes"`
	Facturado      float64 `json:"facturado"` // en pesos, notas de crédito restadas
	PorCobrar      float64 `json:"porCobrar"`
	Ultimo         string  `json:"ultimo"` // fecha del último comprobante, AAAA-MM-DD
}

// Filtro del listado de comprobantes. Las fechas son AAAA-MM-DD (inclusive).
type Filtro struct {
	Desde, Hasta   string
	Q              string // cliente, documento o número
	Cobro          Cobro  // "" = todos
	Orden          string // reciente (por defecto), antigua, cliente, numero, mayor, menor
	Limite, Saltar int
}

// Pagina de comprobantes (sin ítems).
type Pagina struct {
	Comprobantes []Comprobante `json:"comprobantes"`
	Total        int           `json:"total"`
}

// Resumen de un período, en pesos.
type Resumen struct {
	Facturado  float64 `json:"facturado"`
	Emitidos   int     `json:"emitidos"`
	PorCobrar  float64 `json:"porCobrar"`
	Pendientes int     `json:"pendientes"`
	Cobrado    float64 `json:"cobrado"`
	Cobradas   int     `json:"cobradas"`
}

// Uso del mes para los límites del plan: facturas A/B/C/M y facturas E (las notas no cuentan).
type Uso struct {
	Facturas    int `json:"facturas"`
	Exportacion int `json:"exportacion"`
}

// Datos es lo que la API necesita guardar y leer.
type Datos interface {
	// AsegurarCuenta crea la cuenta del CUIT si no existe y la devuelve.
	AsegurarCuenta(ctx context.Context, cuit string, puntoVenta int) (Cuenta, error)
	ActualizarPerfil(ctx context.Context, cuentaID int64, p Perfil) (Cuenta, error)

	// GuardarComprobante guarda el comprobante con sus ítems y crea o actualiza el cliente.
	// Completa ID, ClienteID y CreadoEn.
	GuardarComprobante(ctx context.Context, cuentaID int64, c *Comprobante) error
	Comprobante(ctx context.Context, cuentaID, id int64) (Comprobante, error)
	ListarComprobantes(ctx context.Context, cuentaID int64, f Filtro) (Pagina, error)
	MarcarCobro(ctx context.Context, cuentaID, id int64, cobro Cobro) (Comprobante, error)

	ListarClientes(ctx context.Context, cuentaID int64, q string) ([]Cliente, error)

	// Resumen y Uso toman las fechas como AAAA-MM-DD, inclusive.
	Resumen(ctx context.Context, cuentaID int64, desde, hasta string) (Resumen, error)
	Uso(ctx context.Context, cuentaID int64, desde, hasta string) (Uso, error)

	Cerrar()
}
