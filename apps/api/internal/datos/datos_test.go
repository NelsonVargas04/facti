package datos

import (
	"context"
	"fmt"
	"math/rand/v2"
	"os"
	"testing"
	"time"
)

// Las dos implementaciones tienen que comportarse igual. Postgres se prueba solo si hay
// TEST_DATABASE_URL (puede ser la de un proyecto de Supabase de prueba): usa un CUIT al azar
// para no mezclarse con otros datos.
func TestContrato(t *testing.T) {
	t.Run("memoria", func(t *testing.T) { probarContrato(t, NuevaMemoria()) })
	t.Run("postgres", func(t *testing.T) {
		url := os.Getenv("TEST_DATABASE_URL")
		if url == "" {
			t.Skip("TEST_DATABASE_URL no está definida")
		}
		ctx, cancelar := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancelar()
		p, err := Conectar(ctx, url)
		if err != nil {
			t.Fatal(err)
		}
		defer p.Cerrar()
		// Conectar dos veces no vuelve a aplicar las migraciones.
		p2, err := Conectar(ctx, url)
		if err != nil {
			t.Fatalf("segunda conexión: %v", err)
		}
		p2.Cerrar()
		probarContrato(t, p)
	})
}

func probarContrato(t *testing.T, d Datos) {
	ctx := context.Background()
	cuit := fmt.Sprintf("99%09d", rand.IntN(1_000_000_000))

	cuenta, err := d.AsegurarCuenta(ctx, cuit, 3)
	if err != nil {
		t.Fatal(err)
	}
	if otra, _ := d.AsegurarCuenta(ctx, cuit, 3); otra.ID != cuenta.ID || cuenta.Plan != PlanGratis {
		t.Fatalf("AsegurarCuenta tiene que devolver la misma cuenta: %+v %+v", cuenta, otra)
	}
	if c, err := d.ActualizarPerfil(ctx, cuenta.ID, Perfil{Nombre: "FERNÁNDEZ LUCÍA", Condicion: "monotributo", Categoria: "C"}); err != nil || c.Nombre != "FERNÁNDEZ LUCÍA" {
		t.Fatalf("perfil: %+v %v", c, err)
	}

	lumen := Receptor{DocTipo: 80, DocNro: "30500010912", Nombre: "ESTUDIO LUMEN SRL", CondicionIvaID: 1, Condicion: "responsable_inscripto"}
	nuevo := func(tipo int, numero int64, fecha string, total float64, r Receptor, cobro Cobro) *Comprobante {
		return &Comprobante{
			Tipo: tipo, PuntoVenta: 3, Numero: numero, Fecha: fecha, Concepto: 2, Moneda: "PES", Cotizacion: 1,
			Total: total, Neto: total, CAE: "76419283746521", CAEVto: "2026-11-01", QR: "https://www.arca.gob.ar/fe/qr/?p=x",
			Receptor: r, Cobro: cobro, Respuesta: "<FECAESolicitarResult/>",
			Items: []Item{{Descripcion: "Diseño", Cantidad: 2, Unidad: "horas", PrecioUnitario: total / 2, Subtotal: total}},
		}
	}

	f1 := nuevo(11, 1, "2026-10-12", 85000, lumen, Pendiente)
	f1.Periodo = &Periodo{Desde: "2026-10-01", Hasta: "2026-10-31", VtoPago: "2026-10-24"}
	if err := d.GuardarComprobante(ctx, cuenta.ID, f1); err != nil {
		t.Fatal(err)
	}
	if f1.ID == 0 || f1.ClienteID == nil || f1.CreadoEn.IsZero() {
		t.Fatalf("GuardarComprobante tiene que completar ID, cliente y fecha: %+v", f1)
	}
	// Mismo cliente con el domicilio nuevo: no se duplica y el nombre vacío no pisa el anterior.
	conDomicilio := lumen
	conDomicilio.Nombre, conDomicilio.Domicilio = "", "Av. Corrientes 1234"
	f2 := nuevo(11, 2, "2026-10-20", 40000, conDomicilio, Pendiente)
	cf := nuevo(11, 3, "2026-09-30", 10000, Receptor{DocTipo: 99, DocNro: "0", CondicionIvaID: 5}, Pendiente)
	nc := nuevo(13, 1, "2026-10-21", 5000, lumen, SinCobro)
	for _, c := range []*Comprobante{f2, cf, nc} {
		if err := d.GuardarComprobante(ctx, cuenta.ID, c); err != nil {
			t.Fatal(err)
		}
	}
	if *f2.ClienteID != *f1.ClienteID || cf.ClienteID != nil {
		t.Errorf("clientes: f1=%v f2=%v cf=%v", *f1.ClienteID, *f2.ClienteID, cf.ClienteID)
	}
	if err := d.GuardarComprobante(ctx, cuenta.ID, nuevo(11, 1, "2026-10-12", 1, lumen, Pendiente)); err == nil {
		t.Error("no tiene que permitir el mismo tipo, punto de venta y número dos veces")
	}

	// Detalle
	got, err := d.Comprobante(ctx, cuenta.ID, f1.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Sigla != "C" || got.Fecha != "2026-10-12" || got.CAEVto != "2026-11-01" || got.Periodo == nil || got.Periodo.VtoPago != "2026-10-24" ||
		len(got.Items) != 1 || got.Items[0].Unidad != "horas" || got.Receptor.Nombre != "ESTUDIO LUMEN SRL" || got.Total != 85000 {
		t.Errorf("detalle: %+v", got)
	}
	if g, _ := d.Comprobante(ctx, cuenta.ID, nc.ID); g.Sigla != "NC" || g.Firmado() != -5000 {
		t.Errorf("nota de crédito: %+v", g)
	}
	otraCuenta, _ := d.AsegurarCuenta(ctx, cuit[:10]+"1", 1)
	if _, err := d.Comprobante(ctx, otraCuenta.ID, f1.ID); err != ErrNoEncontrado {
		t.Errorf("no tiene que ver comprobantes de otra cuenta: %v", err)
	}

	// Listado
	pag, err := d.ListarComprobantes(ctx, cuenta.ID, Filtro{})
	if err != nil || pag.Total != 4 || pag.Comprobantes[0].ID != nc.ID || pag.Comprobantes[0].Items != nil {
		t.Fatalf("listado: %+v %v", pag, err)
	}
	casos := []struct {
		f    Filtro
		want int
	}{
		{Filtro{Desde: "2026-10-01", Hasta: "2026-10-31"}, 3},
		{Filtro{Q: "lumen"}, 3},
		{Filtro{Q: "00003-00000002"}, 1},
		{Filtro{Q: "305000"}, 3},
		{Filtro{Cobro: Pendiente}, 3},
		{Filtro{Limite: 2, Saltar: 3}, 1},
	}
	for _, c := range casos {
		p, err := d.ListarComprobantes(ctx, cuenta.ID, c.f)
		if err != nil {
			t.Fatal(err)
		}
		if p.Total != c.want && c.f.Limite == 0 {
			t.Errorf("%+v: total %d, se esperaba %d", c.f, p.Total, c.want)
		}
		if c.f.Limite > 0 && len(p.Comprobantes) != c.want {
			t.Errorf("%+v: %d en la página, se esperaba %d", c.f, len(p.Comprobantes), c.want)
		}
	}
	if p, _ := d.ListarComprobantes(ctx, cuenta.ID, Filtro{Orden: "mayor"}); p.Comprobantes[0].ID != f1.ID {
		t.Errorf("orden por mayor monto: %+v", p.Comprobantes[0])
	}

	// Cobros
	if c, err := d.MarcarCobro(ctx, cuenta.ID, f1.ID, Cobrada); err != nil || c.Cobro != Cobrada || c.CobradaEn == nil {
		t.Errorf("marcar cobrada: %+v %v", c, err)
	}
	if _, err := d.MarcarCobro(ctx, cuenta.ID, nc.ID, Cobrada); err != ErrNoEncontrado {
		t.Errorf("las notas de crédito no se cobran: %v", err)
	}
	if c, _ := d.MarcarCobro(ctx, cuenta.ID, f2.ID, Pendiente); c.CobradaEn != nil {
		t.Errorf("pendiente no tiene fecha de cobro: %+v", c)
	}

	// Clientes
	cls, err := d.ListarClientes(ctx, cuenta.ID, "")
	if err != nil || len(cls) != 1 {
		t.Fatalf("clientes: %+v %v", cls, err)
	}
	c := cls[0]
	if c.Nombre != "ESTUDIO LUMEN SRL" || c.Domicilio != "Av. Corrientes 1234" || c.Comprobantes != 3 ||
		c.Facturado != 120000 || c.PorCobrar != 40000 || c.Ultimo != "2026-10-21" {
		t.Errorf("cliente: %+v", c)
	}
	if cls, _ := d.ListarClientes(ctx, cuenta.ID, "nadie"); len(cls) != 0 {
		t.Errorf("búsqueda sin resultados: %+v", cls)
	}

	// Resumen y uso de octubre (la de septiembre no cuenta; la NC resta)
	r, err := d.Resumen(ctx, cuenta.ID, "2026-10-01", "2026-10-31")
	if err != nil {
		t.Fatal(err)
	}
	if r != (Resumen{Facturado: 120000, Emitidos: 3, PorCobrar: 40000, Pendientes: 1, Cobrado: 85000, Cobradas: 1}) {
		t.Errorf("resumen: %+v", r)
	}
	if u, _ := d.Uso(ctx, cuenta.ID, "2026-10-01", "2026-10-31"); u != (Uso{Facturas: 2}) {
		t.Errorf("uso (las notas no cuentan): %+v", u)
	}
}
