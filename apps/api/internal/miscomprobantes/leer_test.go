package miscomprobantes

import (
	"archive/zip"
	"bytes"
	"errors"
	"testing"
)

// CSV como el que baja ARCA hoy: ";" , coma decimal y tipo "11 - Factura C".
const csvNuevo = "\xef\xbb\xbf" + `"Fecha de Emisión";"Tipo de Comprobante";"Punto de Venta";"Número Desde";"Número Hasta";"Cód. Autorización";"Tipo Doc. Receptor";"Nro. Doc. Receptor";"Denominación Receptor";"Tipo Cambio";"Moneda";"Imp. Neto Gravado";"Imp. Neto No Gravado";"Imp. Op. Exentas";"Otros Tributos";"IVA";"Imp. Total"
"2026-10-03";"11 - Factura C";"2";"15";"15";"76123456789012";"80";"30712345678";"ESTUDIO SUR SRL";"1,00";"$";"0,00";"0,00";"0,00";"0,00";"0,00";"350.000,00"
"2026-10-20";"13 - Nota de Crédito C";"2";"3";"3";"76123456789013";"80";"30712345678";"ESTUDIO SUR SRL";"1,00";"$";"0,00";"0,00";"0,00";"0,00";"0,00";"50.000,00"
"2026-11-02";"19 - Factura de Exportación E";"3";"1";"1";"76123456789014";"";"";"ACME INC";"1015,50";"DOL";"0,00";"0,00";"0,00";"0,00";"0,00";"1.000,00"
`

// Como el Excel viejo pasado a CSV: título arriba, "," y punto decimal, fecha dd/mm/aaaa.
const csvViejo = `Mis Comprobantes Emitidos - CUIT 20960377630
Fecha,Tipo,Punto de Venta,Número Desde,Número Hasta,Cód. Autorización,Tipo Doc. Receptor,Nro. Doc. Receptor,Denominación Receptor,Tipo Cambio,Moneda,Imp. Neto Gravado,Imp. Neto No Gravado,Imp. Op. Exentas,IVA,Imp. Total
15/09/2026,11,00002,14,14,76000000000001,99,0,CONSUMIDOR FINAL,1,$,0,0,0,0,12500.5
,,,,,,,,,,,,,,,12500.5
`

func TestLeerCSVNuevo(t *testing.T) {
	r, err := Leer([]byte(csvNuevo))
	if err != nil {
		t.Fatal(err)
	}
	if len(r.Errores) != 0 || len(r.Comprobantes) != 3 {
		t.Fatalf("resultado: %+v", r)
	}
	f, nc, e := r.Comprobantes[0], r.Comprobantes[1], r.Comprobantes[2]
	if f.Fecha != "2026-10-03" || f.Tipo != 11 || f.PuntoVenta != 2 || f.Numero != 15 || f.Pesos != 350000 || f.Receptor != "ESTUDIO SUR SRL" || f.DocNro != "30712345678" {
		t.Errorf("factura: %+v", f)
	}
	if nc.Pesos != -50000 {
		t.Errorf("la nota de crédito tiene que restar: %+v", nc)
	}
	if e.Moneda != "DOL" || e.Cotizacion != 1015.5 || e.Pesos != 1015500 {
		t.Errorf("factura E en dólares: %+v", e)
	}
}

func TestLeerCSVViejo(t *testing.T) {
	r, err := Leer([]byte(csvViejo))
	if err != nil {
		t.Fatal(err)
	}
	if len(r.Comprobantes) != 1 {
		t.Fatalf("resultado: %+v", r)
	}
	if c := r.Comprobantes[0]; c.Fecha != "2026-09-15" || c.PuntoVenta != 2 || c.Pesos != 12500.5 {
		t.Errorf("comprobante: %+v", c)
	}
}

func TestLeerLatin1(t *testing.T) {
	// "Número" y "Denominación" en Windows-1252.
	b := []byte("Fecha;Tipo;Punto de Venta;N\xfamero Desde;Denominaci\xf3n Receptor;Moneda;Imp. Total\n01/10/2026;11;1;7;JUAN P\xc9REZ;$;1000\n")
	r, err := Leer(b)
	if err != nil {
		t.Fatal(err)
	}
	if len(r.Comprobantes) != 1 || r.Comprobantes[0].Receptor != "JUAN PÉREZ" || r.Comprobantes[0].Numero != 7 {
		t.Fatalf("resultado: %+v", r)
	}
}

func TestErroresDeFila(t *testing.T) {
	b := []byte("Fecha;Tipo;Punto de Venta;Número Desde;Moneda;Tipo Cambio;Imp. Total\n01/10/2026;11;1;7;$;1;1000\nayer;11;1;8;$;1;1000\n02/10/2026;19;1;1;DOL;;10\n")
	r, err := Leer(b)
	if err != nil {
		t.Fatal(err)
	}
	if len(r.Comprobantes) != 1 || len(r.Errores) != 2 || r.Errores[0].Fila != 3 {
		t.Fatalf("resultado: %+v", r)
	}
}

func TestArchivosQueNoSirven(t *testing.T) {
	casos := map[string]error{
		"nada que ver": ErrFormato,
		"Fecha;Tipo;Punto de Venta;Número Desde;Nro. Doc. Emisor;Denominación Emisor;Imp. Total\n": ErrRecibidos,
		"Fecha;Tipo;Punto de Venta;Número Desde;Imp. Total\n":                                      ErrVacio,
	}
	for txt, quiero := range casos {
		if _, err := Leer([]byte(txt)); !errors.Is(err, quiero) {
			t.Errorf("%q: error %v, quería %v", txt, err, quiero)
		}
	}
}

func TestImportes(t *testing.T) {
	for s, quiero := range map[string]float64{"12500,50": 12500.5, "12.500,50": 12500.5, "12500.50": 12500.5, "12,500.50": 12500.5, "12.500.000": 12500000, "$ 1.000": 1000, "1.5E3": 1500} {
		if v, err := importe(s); err != nil || v != quiero {
			t.Errorf("importe(%q) = %v, %v; quería %v", s, v, err, quiero)
		}
	}
}

func TestLeerXLSX(t *testing.T) {
	var buf bytes.Buffer
	z := zip.NewWriter(&buf)
	escribir := func(nombre, contenido string) {
		w, _ := z.Create(nombre)
		w.Write([]byte(contenido))
	}
	escribir("xl/sharedStrings.xml", `<sst><si><t>Fecha</t></si><si><t>Tipo</t></si><si><t>Punto de Venta</t></si><si><t>Número Desde</t></si><si><t>Imp. Total</t></si><si><t>11 - Factura C</t></si><si><t>Mis Comprobantes Emitidos</t></si></sst>`)
	escribir("xl/worksheets/sheet1.xml", `<worksheet><sheetData>
<row r="1"><c r="A1" t="s"><v>6</v></c></row>
<row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2" t="s"><v>1</v></c><c r="C2" t="s"><v>2</v></c><c r="D2" t="s"><v>3</v></c><c r="E2" t="s"><v>4</v></c></row>
<row r="3"><c r="A3"><v>46296</v></c><c r="B3" t="s"><v>5</v></c><c r="C3"><v>2</v></c><c r="D3"><v>21</v></c><c r="E3"><v>80000.25</v></c></row>
</sheetData></worksheet>`)
	z.Close()
	r, err := Leer(buf.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	if len(r.Comprobantes) != 1 {
		t.Fatalf("resultado: %+v", r)
	}
	if c := r.Comprobantes[0]; c.Fecha != "2026-10-01" || c.Tipo != 11 || c.Numero != 21 || c.Pesos != 80000.25 {
		t.Errorf("comprobante: %+v", c)
	}
}
