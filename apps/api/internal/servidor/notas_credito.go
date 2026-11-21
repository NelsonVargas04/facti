package servidor

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"facti/api/internal/arca"
	"facti/api/internal/datos"
)

// pedidoNotaCredito es el cuerpo de POST /comprobantes/{id}/nota-credito.
// Sin importe, anula lo que queda de la factura (total). Con importe, es una nota parcial.
type pedidoNotaCredito struct {
	Importe *float64 `json:"importe"`
	Motivo  string   `json:"motivo"`
}

// emitirNotaCredito emite una Nota de Crédito C asociada a una Factura C de la cuenta.
// Toma el receptor, el concepto y el período de la factura original, así el usuario solo decide cuánto.
func (s *Servidor) emitirNotaCredito(w http.ResponseWriter, r *http.Request) error {
	id, err := idDe(r)
	if err != nil {
		return err
	}
	var body pedidoNotaCredito
	if r.ContentLength != 0 {
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<12)).Decode(&body); err != nil {
			return pedidoInvalido("datos_invalidos", "No pudimos leer los datos de la nota de crédito.")
		}
	}
	d, cuenta, cl, err := s.emisor(r)
	if err != nil {
		return err
	}
	orig, err := d.Comprobante(r.Context(), cuenta.ID, id)
	if err != nil {
		return err
	}
	if orig.Tipo != arca.FacturaC {
		return pedidoInvalido("no_corresponde", "Solo se puede hacer una nota de crédito sobre una Factura C.")
	}
	disponible := redondear(orig.Total - orig.Acreditado)
	if disponible <= 0 {
		return pedidoInvalido("ya_anulada", "Esta factura ya está anulada por completo con notas de crédito.")
	}
	importe := disponible
	if body.Importe != nil {
		importe = redondear(*body.Importe)
	}
	if importe <= 0 || importe > disponible+0.005 {
		return pedidoInvalido("importe_invalido", fmt.Sprintf("El importe tiene que ser mayor a cero y como mucho $%.2f (lo que queda de la factura).", disponible))
	}
	total := math.Abs(importe-disponible) < 0.005 && orig.Acreditado == 0

	prep, nf, err := prepararNotaCredito(orig, importe, total, strings.TrimSpace(body.Motivo), s.ahora())
	if err != nil {
		return err
	}
	out, err := s.emitirTipoC(r.Context(), d, cuenta, cl, nf, prep, &orig)
	if err != nil {
		return err
	}
	// Si la nota anula todo lo que quedaba y la factura no se había cobrado, deja de figurar como pendiente.
	if math.Abs(importe-disponible) < 0.005 && orig.Cobro == datos.Pendiente {
		if _, err := d.MarcarCobro(r.Context(), cuenta.ID, orig.ID, datos.SinCobro); err != nil {
			s.log.Error("no se pudo sacar de pendientes la factura anulada", "error", err, "factura", orig.ID)
		}
	}
	responderJSON(w, http.StatusOK, out)
	return nil
}

// prepararNotaCredito arma el pedido de la nota a partir de la factura original.
// Anulación total: repite los ítems. Parcial: un solo ítem con el motivo y el importe.
func prepararNotaCredito(orig datos.Comprobante, importe float64, total bool, motivo string, ahora time.Time) (facturaPreparada, nuevaFactura, error) {
	numero := fmt.Sprintf("%05d-%08d", orig.PuntoVenta, orig.Numero)
	items := orig.Items
	if !total || len(items) == 0 {
		desc := motivo
		if desc == "" {
			desc = "Ajuste de la Factura C " + numero
		}
		items = []datos.Item{{Descripcion: desc, Cantidad: 1, Unidad: "unidades", PrecioUnitario: importe, Subtotal: importe}}
	}
	type item struct {
		Descripcion    string  `json:"descripcion"`
		Cantidad       float64 `json:"cantidad"`
		Unidad         string  `json:"unidad"`
		PrecioUnitario float64 `json:"precioUnitario"`
	}
	pedido := map[string]any{
		"receptor": map[string]any{
			"docTipo": orig.Receptor.DocTipo, "docNro": orig.Receptor.DocNro,
			"condicionIvaReceptorId": orig.Receptor.CondicionIvaID,
			"nombre":                 orig.Receptor.Nombre, "condicion": orig.Receptor.Condicion,
			"domicilio": orig.Receptor.Domicilio, "email": orig.Receptor.Email,
		},
		"concepto":       orig.Concepto,
		"condicionVenta": orig.CondicionVenta,
	}
	if p := orig.Periodo; p != nil {
		pedido["periodoServicio"] = map[string]string{"desde": p.Desde, "hasta": p.Hasta, "vencimientoPago": p.VtoPago}
	}
	lista := make([]item, len(items))
	for i, it := range items {
		lista[i] = item{it.Descripcion, it.Cantidad, it.Unidad, it.PrecioUnitario}
	}
	pedido["items"] = lista

	// Se arma igual que un pedido de la web, así pasa por las mismas validaciones.
	var nf nuevaFactura
	b, _ := json.Marshal(pedido)
	if err := json.Unmarshal(b, &nf); err != nil || !nf.valido() {
		return facturaPreparada{}, nf, pedidoInvalido("datos_invalidos", "A la factura original le faltan datos para hacer la nota de crédito.")
	}
	prep, err := nf.preparar(ahora)
	if err != nil {
		return prep, nf, err
	}
	// El total de la nota es el importe pedido (en una anulación total, la suma de los ítems ya coincide).
	if math.Abs(prep.total-importe) > 0.01 {
		return prep, nf, pedidoInvalido("importe_invalido", "El importe de la nota no coincide con el de los ítems de la factura.")
	}
	if p := orig.Periodo; p == nil && orig.Concepto != arca.ConceptoProductos {
		return prep, nf, pedidoInvalido("datos_invalidos", "A la factura original le falta el período del servicio.")
	}
	return prep, nf, nil
}

func redondear(x float64) float64 { return math.Round(x*100) / 100 }
