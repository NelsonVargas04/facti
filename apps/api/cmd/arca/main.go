// Comando arca: pruebas manuales contra ARCA (homologación).
//
//	go run ./cmd/arca probar            estado, puntos de venta y última Factura C
//	go run ./cmd/arca padron <cuit>     constancia de inscripción (padrón A5)
//	go run ./cmd/arca factura-c         emite una Factura C de prueba (solo homologación)
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"time"

	"facti/api/internal/arca"
	"facti/api/internal/config"
	"facti/api/internal/cuit"
	"facti/api/internal/servidor"
)

func main() {
	if len(os.Args) < 2 {
		uso()
	}
	cfg := config.Cargar()
	cl, err := servidor.ConstruirClientes(cfg)
	if err != nil {
		salir(err)
	}
	if cl.Cfg.Entorno == arca.Produccion {
		fmt.Fprintln(os.Stderr, "ATENCIÓN: estás usando ARCA en PRODUCCIÓN. Los comprobantes son reales.")
	}
	ctx := context.Background()

	switch os.Args[1] {
	case "probar":
		probar(ctx, cl)
	case "padron":
		if len(os.Args) < 3 {
			fmt.Fprintln(os.Stderr, "Uso: pnpm arca:padron 20123456786")
			os.Exit(1)
		}
		datos, err := arca.ConsultarPadron(ctx, cl.Cfg, cl.Tickets, cuit.Limpiar(os.Args[2]))
		if err != nil {
			salir(err)
		}
		mostrar(datos)
	case "factura-c":
		facturaC(ctx, cl)
	default:
		uso()
	}
}

func probar(ctx context.Context, cl *servidor.ClientesArca) {
	fmt.Println("Entorno:", cl.Cfg.Entorno)

	fmt.Println("1. Estado de los servidores de ARCA...")
	estado, err := cl.Wsfe.Estado(ctx)
	if err != nil {
		salir(err)
	}
	mostrar(estado)

	fmt.Println("2. Puntos de venta Web Services del emisor...")
	pv, err := cl.Wsfe.PuntosDeVenta(ctx)
	if err != nil {
		salir(err)
	}
	mostrar(pv)

	fmt.Printf("3. Última Factura C autorizada en el punto de venta %d...\n", cl.PuntoVenta)
	ultimo, err := cl.Wsfe.UltimoAutorizado(ctx, cl.PuntoVenta, arca.FacturaC)
	if err != nil {
		salir(err)
	}
	fmt.Println(ultimo)
	fmt.Println("Conexión OK ✔")
}

// facturaC emite una Factura C de servicios a consumidor final por $1000, en homologación.
func facturaC(ctx context.Context, cl *servidor.ClientesArca) {
	if cl.Cfg.Entorno != arca.Homologacion {
		fmt.Fprintln(os.Stderr, "Este comando de prueba solo corre en homologación.")
		os.Exit(1)
	}
	hoy := time.Now().In(arca.HoraArgentina)
	inicioMes := time.Date(hoy.Year(), hoy.Month(), 1, 12, 0, 0, 0, arca.HoraArgentina)
	const total = 1000.0

	res, err := cl.Wsfe.Emitir(ctx, arca.NuevoComprobante{
		PuntoVenta:             cl.PuntoVenta,
		Tipo:                   arca.FacturaC,
		Concepto:               arca.ConceptoServicios,
		DocTipo:                arca.DocSinIdentificar,
		DocNro:                 "0",
		CondicionIvaReceptorID: arca.CondIvaConsumidorFinal,
		Fecha:                  hoy,
		ImporteTotal:           total,
		ImporteNeto:            total,
		Servicio: &arca.PeriodoServicio{
			Desde:           inicioMes,
			Hasta:           inicioMes.AddDate(0, 1, -1),
			VencimientoPago: hoy.AddDate(0, 0, 10),
		},
	})
	if err != nil {
		salir(err)
	}
	if !res.Aprobado || res.CAE == "" {
		fmt.Fprintln(os.Stderr, "ARCA rechazó la factura:")
		mostrar(map[string]any{"errores": res.Errores, "observaciones": res.Observaciones})
		os.Exit(1)
	}

	fmt.Printf("Factura C %05d-%08d autorizada ✔\n", cl.PuntoVenta, res.Numero)
	fmt.Printf("CAE: %s (vence %s)\n", res.CAE, arca.DeFechaArca(res.VencimientoCAE))
	if len(res.Observaciones) > 0 {
		fmt.Println("Observaciones:")
		mostrar(res.Observaciones)
	}
	cuitEmisor, _ := strconv.ParseInt(cuit.Limpiar(cl.CuitEmisor), 10, 64)
	codAut, _ := strconv.ParseInt(res.CAE, 10, 64)
	docTipo, nroDoc := arca.DocSinIdentificar, int64(0)
	fmt.Println("QR:", arca.URLDelQR(arca.DatosQR{
		Fecha:      arca.DeFechaArca(arca.AFechaArca(hoy)),
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
	}))
}

func mostrar(v any) {
	b, _ := json.MarshalIndent(v, "", "  ")
	fmt.Println(string(b))
}

func salir(err error) {
	fmt.Fprintln(os.Stderr, "Error:", err)
	if e, ok := err.(*arca.Error); ok && len(e.Detalles) > 0 {
		mostrar(e.Detalles)
	}
	os.Exit(1)
}

func uso() {
	fmt.Fprintln(os.Stderr, "Uso: go run ./cmd/arca probar | padron <cuit> | factura-c")
	os.Exit(1)
}
