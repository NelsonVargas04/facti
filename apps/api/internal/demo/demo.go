// Package demo arma una cuenta de prueba para usar la app en la compu sin Supabase ni Postgres.
//
// Se activa con FACTI_DEMO=1 y nunca con ARCA_ENTORNO=produccion. La web entra con el token fijo
// "demo" y la API guarda todo en memoria (se pierde al reiniciar), con facturas y clientes de ejemplo.
// Emitir una factura nueva sigue yendo a ARCA (homologación), así que necesita los certificados.
package demo

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"facti/api/internal/arca"
	"facti/api/internal/auth"
	"facti/api/internal/cuit"
	"facti/api/internal/datos"
)

// Token que manda la web en modo demo.
const Token = "demo"

// Usuario de la cuenta de prueba.
var Usuario = auth.Usuario{ID: "00000000-0000-0000-0000-00000000de30", Email: "demo@facti.test"}

// Autenticador acepta solo el token de demo.
type Autenticador struct{}

// Verificar devuelve el usuario de prueba si el token es el de demo.
func (Autenticador) Verificar(_ context.Context, token string) (auth.Usuario, error) {
	if token != Token {
		return auth.Usuario{}, auth.ErrSinSesion
	}
	return Usuario, nil
}

// conDV completa un CUIT de 10 dígitos con su dígito verificador.
func conDV(base string) string {
	pesos := []int{5, 4, 3, 2, 7, 6, 5, 4, 3, 2}
	s := 0
	for i, p := range pesos {
		s += int(base[i]-'0') * p
	}
	dv := 11 - s%11
	switch dv {
	case 11:
		dv = 0
	case 10:
		dv = 9
	}
	return base + strconv.Itoa(dv)
}

type cliente struct {
	cuit, nombre, condicion, domicilio string
	condID                             int
}

// Datos devuelve una base en memoria con la cuenta de prueba ya cargada.
// Si se pasa un CUIT válido (el del certificado de ARCA), la cuenta lo usa, así se puede emitir de
// verdad en homologación; si no, usa uno de ejemplo. nombre es opcional (como figura en ARCA).
func Datos(puntoVenta int, cuitReal, nombre string) (*datos.Memoria, error) {
	ctx := context.Background()
	m := datos.NuevaMemoria()
	c, err := m.CuentaDeUsuario(ctx, Usuario.ID, Usuario.Email, puntoVenta)
	if err != nil {
		return nil, err
	}
	cuitEmisor := conDV("2731456789")
	if cuit.Validar(cuitReal) {
		cuitEmisor = cuit.Limpiar(cuitReal)
	}
	if strings.TrimSpace(nombre) == "" {
		nombre = "FERNÁNDEZ LUCÍA"
	}
	c, err = m.AsignarCuit(ctx, c.ID, cuitEmisor, datos.Perfil{
		Nombre:    strings.ToUpper(strings.TrimSpace(nombre)),
		Domicilio: "Av. Corrientes 1234 - CABA",
		Condicion: "monotributo",
		Categoria: "D",
	})
	if err != nil {
		return nil, err
	}

	clientes := []cliente{
		{conDV("3071589632"), "ESTUDIO LUMEN SRL", "IVA Responsable Inscripto", "Gorriti 4520 - CABA", 1},
		{conDV("3071234560"), "CAFÉ NORTE SAS", "IVA Responsable Inscripto", "Av. Cabildo 2100 - CABA", 1},
		{conDV("2033445566"), "PÉREZ JUAN CARLOS", "Responsable Monotributo", "Mitre 845 - Rosario", 6},
		{conDV("3070998877"), "ASOCIACIÓN VECINAL PALERMO", "IVA Sujeto Exento", "Thames 1650 - CABA", 4},
	}
	type factura struct {
		hace    int // meses atrás
		dia     int
		cliente int
		detalle string
		importe float64
		cobrada bool
	}
	facturas := []factura{
		{5, 8, 0, "Diseño de identidad visual", 240000, true},
		{4, 12, 1, "Fotografía de productos para carta", 180000, true},
		{3, 5, 0, "Mantenimiento web - mensual", 95000, true},
		{3, 20, 2, "Diseño de flyers (x4)", 60000, true},
		{2, 3, 1, "Diseño de packaging", 320000, true},
		{2, 18, 3, "Afiches para evento barrial", 75000, false},
		{1, 7, 0, "Mantenimiento web - mensual", 95000, true},
		{1, 22, 2, "Banner para redes", 45000, false},
		{0, 4, 0, "Diseño de logo e identidad", 85000, false},
		{0, 9, 1, "Menú digital con QR", 130000, false},
	}

	ar, _ := time.LoadLocation("America/Argentina/Buenos_Aires")
	if ar == nil {
		ar = time.FixedZone("ART", -3*3600)
	}
	hoy := time.Now().In(ar)
	nro := int64(100)
	cuitNum, _ := strconv.ParseInt(cuitEmisor, 10, 64)
	for _, f := range facturas {
		ini := time.Date(hoy.Year(), hoy.Month(), 1, 0, 0, 0, 0, ar).AddDate(0, -f.hace, 0)
		dia := f.dia
		if f.hace == 0 && dia > hoy.Day() {
			dia = hoy.Day()
		}
		fecha := ini.AddDate(0, 0, dia-1)
		fin := ini.AddDate(0, 1, -1)
		cl := clientes[f.cliente]
		nro++
		cae := int64(76419283700000) + nro
		docNro, _ := strconv.ParseInt(cl.cuit, 10, 64)
		docTipo := 80
		comp := &datos.Comprobante{
			Tipo:       arca.FacturaC,
			PuntoVenta: puntoVenta,
			Numero:     nro,
			Fecha:      fecha.Format("2006-01-02"),
			Concepto:   2,
			Moneda:     "PES",
			Cotizacion: 1,
			Total:      f.importe,
			Neto:       f.importe,
			CAE:        strconv.FormatInt(cae, 10),
			CAEVto:     fecha.AddDate(0, 0, 10).Format("2006-01-02"),
			QR: arca.URLDelQR(arca.DatosQR{
				Fecha: fecha.Format("2006-01-02"), Cuit: cuitNum, PtoVta: puntoVenta, TipoCmp: arca.FacturaC,
				NroCmp: nro, Importe: f.importe, Moneda: "PES", Ctz: 1,
				TipoDocRec: &docTipo, NroDocRec: &docNro, TipoCodAut: "E", CodAut: cae,
			}),
			Periodo:        &datos.Periodo{Desde: ini.Format("2006-01-02"), Hasta: fin.Format("2006-01-02"), VtoPago: fecha.AddDate(0, 0, 15).Format("2006-01-02")},
			CondicionVenta: "Transferencia bancaria",
			Receptor: datos.Receptor{
				DocTipo: docTipo, DocNro: cl.cuit, Nombre: cl.nombre, CondicionIvaID: cl.condID,
				Condicion: cl.condicion, Domicilio: cl.domicilio,
			},
			Cobro: datos.Pendiente,
			Items: []datos.Item{{Descripcion: f.detalle, Cantidad: 1, Unidad: "unidades", PrecioUnitario: f.importe, Subtotal: f.importe}},
		}
		if err := m.GuardarComprobante(ctx, c.ID, comp); err != nil {
			return nil, fmt.Errorf("demo: %w", err)
		}
		if f.cobrada {
			if _, err := m.MarcarCobro(ctx, c.ID, comp.ID, datos.Cobrada); err != nil {
				return nil, fmt.Errorf("demo: %w", err)
			}
		}
	}
	return m, nil
}
