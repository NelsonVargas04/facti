package servidor

import (
	"context"
	"testing"

	"facti/api/internal/arca"
)

func TestNotaCreditoC(t *testing.T) {
	e := nuevoEntorno(t, nil)
	if res, j := e.pedir(t, "POST", "/facturas", facturaLumen); res.StatusCode != 200 {
		t.Fatalf("emisión: %d %v", res.StatusCode, j)
	}

	// 1. Nota parcial: un ítem con el motivo; la factura sigue pendiente por lo que queda.
	res, j := e.pedir(t, "POST", "/comprobantes/1/nota-credito", `{"importe": 10000, "motivo": "Descuento acordado"}`)
	if res.StatusCode != 200 || j["tipo"] != float64(arca.NotaCreditoC) || j["total"] != 10000.0 {
		t.Fatalf("nota parcial: %d %v", res.StatusCode, j)
	}
	if qr, err := arca.LeerURLQR(j["qr"].(string)); err != nil || qr.TipoCmp != arca.NotaCreditoC || qr.Importe != 10000 {
		t.Errorf("QR de la nota: %+v %v", qr, err)
	}
	_, j = e.pedir(t, "GET", "/comprobantes/2", "")
	nc := j["comprobante"].(map[string]any)
	items := nc["items"].([]any)
	asoc, _ := nc["asociado"].(map[string]any)
	if nc["sigla"] != "NC" || nc["cobro"] != "" || nc["concepto"] != 2.0 || nc["periodo"] == nil || len(items) != 1 ||
		items[0].(map[string]any)["descripcion"] != "Descuento acordado" || asoc == nil || asoc["numero"] != 1.0 || asoc["sigla"] != "C" {
		t.Errorf("detalle de la nota: %v", nc)
	}
	_, j = e.pedir(t, "GET", "/comprobantes/1", "")
	if f := j["comprobante"].(map[string]any); f["acreditado"] != 10000.0 || f["cobro"] != "pendiente" {
		t.Errorf("factura tras la nota parcial: %v", f)
	}

	// 2. No se puede acreditar más de lo que queda.
	if res, j := e.pedir(t, "POST", "/comprobantes/1/nota-credito", `{"importe": 80000}`); res.StatusCode != 400 || j["error"] != "importe_invalido" {
		t.Errorf("importe de más: %d %v", res.StatusCode, j)
	}

	// 3. Sin importe anula lo que queda, y la factura deja de figurar como pendiente.
	if res, j := e.pedir(t, "POST", "/comprobantes/1/nota-credito", ""); res.StatusCode != 200 || j["total"] != 75000.0 {
		t.Fatalf("nota por el resto: %d %v", res.StatusCode, j)
	}
	_, j = e.pedir(t, "GET", "/comprobantes/1", "")
	if f := j["comprobante"].(map[string]any); f["acreditado"] != 85000.0 || f["cobro"] != "" {
		t.Errorf("factura anulada: %v", f)
	}
	if res, j := e.pedir(t, "POST", "/comprobantes/1/nota-credito", ""); res.StatusCode != 400 || j["error"] != "ya_anulada" {
		t.Errorf("anular dos veces: %d %v", res.StatusCode, j)
	}
	// Una nota de crédito no se puede anular con otra.
	if res, j := e.pedir(t, "POST", "/comprobantes/2/nota-credito", ""); res.StatusCode != 400 || j["error"] != "no_corresponde" {
		t.Errorf("nota sobre nota: %d %v", res.StatusCode, j)
	}
	if res, _ := e.pedir(t, "POST", "/comprobantes/99/nota-credito", ""); res.StatusCode != 404 {
		t.Errorf("factura inexistente: %d", res.StatusCode)
	}

	// 4. Anulación total de una factura sin notas: repite los ítems originales.
	cf := `{"receptor":{"docTipo":99,"docNro":"0","condicionIvaReceptorId":5},"concepto":1,"fecha":"2026-10-20","items":[{"descripcion":"Taza","cantidad":2,"precioUnitario":7500}]}`
	if res, j := e.pedir(t, "POST", "/facturas", cf); res.StatusCode != 200 {
		t.Fatalf("emisión a consumidor final: %d %v", res.StatusCode, j)
	}
	res, j = e.pedir(t, "POST", "/comprobantes/4/nota-credito", "")
	if res.StatusCode != 200 || j["total"] != 15000.0 {
		t.Fatalf("anulación total: %d %v", res.StatusCode, j)
	}
	_, j = e.pedir(t, "GET", "/comprobantes/5", "")
	it := j["comprobante"].(map[string]any)["items"].([]any)[0].(map[string]any)
	if it["descripcion"] != "Taza" || it["cantidad"] != 2.0 {
		t.Errorf("ítems de la anulación total: %v", it)
	}

	// 5. Las notas no cuentan para el límite del plan ni para lo facturado.
	uso, _ := e.mem.Uso(context.Background(), 1, "2000-01-01", "2100-01-01")
	if uso.Facturas != 2 {
		t.Errorf("uso del plan: %+v", uso)
	}
	if res, j := e.pedir(t, "GET", "/clientes", ""); res.StatusCode != 200 || j["clientes"].([]any)[0].(map[string]any)["facturado"] != 0.0 {
		t.Errorf("lo facturado al cliente tiene que restar las notas: %v", j)
	}
}
