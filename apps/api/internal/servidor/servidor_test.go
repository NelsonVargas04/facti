package servidor

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"facti/api/internal/arca"
)

func sinConfigurar() (*ClientesArca, error) {
	return nil, &ConfiguracionError{Mensaje: "Falta la variable ARCA_CUIT_CERTIFICADO (ver .env.example)"}
}

func pedir(t *testing.T, h http.Handler, metodo, ruta, cuerpo string, headers ...string) (*http.Response, map[string]any) {
	t.Helper()
	req := httptest.NewRequest(metodo, ruta, strings.NewReader(cuerpo))
	for i := 0; i+1 < len(headers); i += 2 {
		req.Header.Set(headers[i], headers[i+1])
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	res := rec.Result()
	var j map[string]any
	_ = json.NewDecoder(res.Body).Decode(&j)
	return res, j
}

func TestSaludSinConfiguracion(t *testing.T) {
	h := Nuevo(Opciones{Arca: sinConfigurar, Entorno: arca.Homologacion})
	res, j := pedir(t, h, "GET", "/salud", "")
	if res.StatusCode != 200 || j["ok"] != true || j["entorno"] != "homologacion" {
		t.Errorf("salud: %d %v", res.StatusCode, j)
	}
	res, j = pedir(t, h, "GET", "/", "")
	if res.StatusCode != 200 || j["nombre"] != "Facti API" {
		t.Errorf("raíz: %d %v", res.StatusCode, j)
	}
	if res, _ := pedir(t, h, "GET", "/no-existe", ""); res.StatusCode != 404 {
		t.Errorf("ruta inexistente: %d", res.StatusCode)
	}
}

func TestArcaSinConfiguracionDa503(t *testing.T) {
	h := Nuevo(Opciones{Arca: sinConfigurar})
	res, j := pedir(t, h, "GET", "/arca/estado", "")
	if res.StatusCode != 503 || j["error"] != "configuracion" {
		t.Errorf("se esperaba 503 de configuración: %d %v", res.StatusCode, j)
	}
}

func TestValidaciones(t *testing.T) {
	h := Nuevo(Opciones{Arca: sinConfigurar})
	res, j := pedir(t, h, "GET", "/arca/padron/20111111113", "")
	if res.StatusCode != 400 || j["error"] != "cuit_invalido" {
		t.Errorf("CUIT inválido: %d %v", res.StatusCode, j)
	}
	for _, cuerpo := range []string{
		"no es json",
		`{"concepto":1,"items":[{"cantidad":1,"precioUnitario":10}]}`,
		`{"receptor":{"docTipo":99,"docNro":"0","condicionIvaReceptorId":5},"concepto":4,"items":[{"cantidad":1,"precioUnitario":10}]}`,
		`{"receptor":{"docTipo":99,"docNro":"0","condicionIvaReceptorId":5},"concepto":1,"items":[]}`,
		`{"receptor":{"docTipo":99,"docNro":"0","condicionIvaReceptorId":5},"concepto":1,"items":[{"cantidad":1}]}`,
	} {
		if res, j := pedir(t, h, "POST", "/facturas", cuerpo); res.StatusCode != 400 || j["error"] != "datos_invalidos" {
			t.Errorf("%s: %d %v", cuerpo, res.StatusCode, j)
		}
	}
	res, j = pedir(t, h, "POST", "/facturas",
		`{"receptor":{"docTipo":99,"docNro":"0","condicionIvaReceptorId":5},"concepto":1,"items":[{"cantidad":1,"precioUnitario":0}]}`)
	if res.StatusCode != 400 || j["error"] != "total_invalido" {
		t.Errorf("total cero: %d %v", res.StatusCode, j)
	}
}

func TestCORS(t *testing.T) {
	h := Nuevo(Opciones{Arca: sinConfigurar, OrigenesWeb: []string{"http://localhost:3000"}})
	res, _ := pedir(t, h, "OPTIONS", "/facturas", "",
		"Origin", "http://localhost:3000", "Access-Control-Request-Method", "POST", "Access-Control-Request-Headers", "content-type")
	if res.StatusCode != 204 || res.Header.Get("Access-Control-Allow-Origin") != "http://localhost:3000" ||
		res.Header.Get("Access-Control-Allow-Headers") != "content-type" {
		t.Errorf("preflight: %d %v", res.StatusCode, res.Header)
	}
	res, _ = pedir(t, h, "GET", "/salud", "", "Origin", "https://otro.com")
	if res.Header.Get("Access-Control-Allow-Origin") != "" {
		t.Error("no tiene que habilitar orígenes que no están en WEB_ORIGIN")
	}
}

// arcaSimulado responde como WSFEv1 en homologación para emitir una Factura C.
func arcaSimulado(t *testing.T) *ClientesArca {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		accion := strings.Trim(r.Header.Get("SOAPAction"), `"`)
		metodo := accion[strings.LastIndex(accion, "/")+1:]
		resultado := map[string]string{
			"FECompUltimoAutorizado": "<CbteNro>7</CbteNro>",
			"FECAESolicitar": "<FeDetResp><FECAEDetResponse><Resultado>A</Resultado>" +
				"<CAE>76419283746521</CAE><CAEFchVto>20261101</CAEFchVto></FECAEDetResponse></FeDetResp>",
		}[metodo]
		io.WriteString(w, `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><`+
			metodo+`Response><`+metodo+`Result>`+resultado+`</`+metodo+`Result></`+metodo+`Response></soap:Body></soap:Envelope>`)
	}))
	t.Cleanup(srv.Close)

	// Ticket vigente en la caché de disco, así no hace falta el WSAA.
	dir := t.TempDir()
	ta, _ := json.Marshal(arca.TicketAcceso{Token: "T", Sign: "S", Expiracion: time.Now().Add(time.Hour).Format(time.RFC3339)})
	if err := os.WriteFile(filepath.Join(dir, "ta-homologacion-20111111112-wsfe.json"), ta, 0o600); err != nil {
		t.Fatal(err)
	}
	cfg := arca.Config{
		Entorno: arca.Homologacion, CuitCertificado: "20111111112", CacheDir: dir,
		Endpoints: &arca.Endpoints{WSFE: srv.URL},
	}
	tickets := arca.NuevaCacheTickets(cfg)
	return &ClientesArca{
		Cfg: cfg, Tickets: tickets, Wsfe: arca.NuevoWsfe(cfg, tickets, "20111111112"),
		CuitEmisor: "20111111112", PuntoVenta: 3,
	}
}

func TestEmitirFacturaC(t *testing.T) {
	cl := arcaSimulado(t)
	h := Nuevo(Opciones{Arca: func() (*ClientesArca, error) { return cl, nil }})
	res, j := pedir(t, h, "POST", "/facturas", `{
		"receptor": {"docTipo": 80, "docNro": "30-71589632-7", "condicionIvaReceptorId": 1},
		"concepto": 2,
		"fecha": "2026-10-12",
		"periodoServicio": {"desde": "2026-10-01", "hasta": "2026-10-31", "vencimientoPago": "2026-10-24"},
		"items": [{"descripcion": "Diseño web", "cantidad": 2, "precioUnitario": 42500}]
	}`)
	if res.StatusCode != 200 {
		t.Fatalf("emisión: %d %v", res.StatusCode, j)
	}
	if j["cae"] != "76419283746521" || j["numero"] != 8.0 || j["total"] != 85000.0 ||
		j["fecha"] != "2026-10-12" || j["vencimientoCae"] != "2026-11-01" || j["letra"] != "C" {
		t.Errorf("respuesta: %v", j)
	}
	qr, err := arca.LeerURLQR(j["qr"].(string))
	if err != nil {
		t.Fatal(err)
	}
	if qr.NroCmp != 8 || qr.PtoVta != 3 || qr.CodAut != 76419283746521 || *qr.NroDocRec != 30715896327 {
		t.Errorf("QR: %+v", qr)
	}
	if obs, ok := j["observaciones"].([]any); !ok || len(obs) != 0 {
		t.Errorf("observaciones tiene que ser una lista vacía: %v", j["observaciones"])
	}
}

func TestParseFecha(t *testing.T) {
	d, err := parseFecha("2026-10-12", time.Now())
	if err != nil || arca.AFechaArca(d) != "20261012" {
		t.Errorf("parseFecha: %v %v", d, err)
	}
	if _, err := parseFecha("12/10/2026", time.Now()); err == nil {
		t.Error("se esperaba error con formato inválido")
	}
}
