package servidor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"facti/api/internal/arca"
	"facti/api/internal/datos"
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

// 22/10/2026 al mediodía en Argentina.
var hoy = time.Date(2026, 10, 22, 12, 0, 0, 0, arca.HoraArgentina)

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

func TestSinBaseDeDatosDa503(t *testing.T) {
	h := Nuevo(Opciones{Arca: sinConfigurar, CuitEmisor: "20111111112", PuntoVenta: 3})
	for _, ruta := range []string{"/cuenta", "/resumen", "/comprobantes", "/comprobantes/1", "/clientes"} {
		res, j := pedir(t, h, "GET", ruta, "")
		if res.StatusCode != 503 || j["error"] != "base_datos" || !strings.Contains(j["mensaje"].(string), "DATABASE_URL") {
			t.Errorf("%s: se esperaba 503 base_datos, vino %d %v", ruta, res.StatusCode, j)
		}
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
	res, _ := pedir(t, h, "OPTIONS", "/comprobantes/1/cobro", "",
		"Origin", "http://localhost:3000", "Access-Control-Request-Method", "PATCH", "Access-Control-Request-Headers", "content-type")
	if res.StatusCode != 204 || res.Header.Get("Access-Control-Allow-Origin") != "http://localhost:3000" ||
		!strings.Contains(res.Header.Get("Access-Control-Allow-Methods"), "PATCH") {
		t.Errorf("preflight: %d %v", res.StatusCode, res.Header)
	}
	res, _ = pedir(t, h, "GET", "/salud", "", "Origin", "https://otro.com")
	if res.Header.Get("Access-Control-Allow-Origin") != "" {
		t.Error("no tiene que habilitar orígenes que no están en WEB_ORIGIN")
	}
}

// arcaSimulado responde como WSFEv1 en homologación: numera en orden y autoriza todo.
type arcaSimulado struct {
	pedidos atomic.Int32
	ultimo  atomic.Int64
}

func (a *arcaSimulado) clientes(t *testing.T) *ClientesArca {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		a.pedidos.Add(1)
		accion := strings.Trim(r.Header.Get("SOAPAction"), `"`)
		metodo := accion[strings.LastIndex(accion, "/")+1:]
		var resultado string
		switch metodo {
		case "FECompUltimoAutorizado":
			resultado = fmt.Sprintf("<CbteNro>%d</CbteNro>", a.ultimo.Load())
		case "FECAESolicitar":
			n := a.ultimo.Add(1)
			resultado = fmt.Sprintf("<FeDetResp><FECAEDetResponse><Resultado>A</Resultado><CbteDesde>%d</CbteDesde>"+
				"<CAE>76419283746521</CAE><CAEFchVto>20261101</CAEFchVto></FECAEDetResponse></FeDetResp>", n)
		}
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

type entorno struct {
	h    http.Handler
	arca *arcaSimulado
	mem  *datos.Memoria
}

func nuevoEntorno(t *testing.T, d datos.Datos) *entorno {
	t.Helper()
	e := &entorno{arca: &arcaSimulado{}}
	if d == nil {
		e.mem = datos.NuevaMemoria()
		d = e.mem
	}
	cl := e.arca.clientes(t)
	e.h = Nuevo(Opciones{
		Arca:       func() (*ClientesArca, error) { return cl, nil },
		Datos:      FijarDatos(d),
		CuitEmisor: "20111111112", PuntoVenta: 3,
		Ahora: func() time.Time { return hoy },
	})
	return e
}

const facturaLumen = `{
	"receptor": {"docTipo": 80, "docNro": "30-50001091-2", "condicionIvaReceptorId": 1,
		"nombre": "ESTUDIO LUMEN SRL", "condicion": "responsable_inscripto", "domicilio": "Av. Corrientes 1234, CABA"},
	"concepto": 2,
	"fecha": "2026-10-12",
	"condicionVenta": "Transferencia bancaria",
	"periodoServicio": {"desde": "2026-10-01", "hasta": "2026-10-31", "vencimientoPago": "2026-10-24"},
	"items": [{"descripcion": "Diseño web", "cantidad": 2, "unidad": "horas", "precioUnitario": 42500}]
}`

func TestEmitirGuardaYSeVeEnTodasLasPantallas(t *testing.T) {
	e := nuevoEntorno(t, nil)

	// 1. Emitir
	res, j := pedir(t, e.h, "POST", "/facturas", facturaLumen)
	if res.StatusCode != 200 {
		t.Fatalf("emisión: %d %v", res.StatusCode, j)
	}
	if j["id"] != 1.0 || j["cae"] != "76419283746521" || j["numero"] != 1.0 || j["total"] != 85000.0 || j["vencimientoCae"] != "2026-11-01" {
		t.Errorf("respuesta: %v", j)
	}
	qr, err := arca.LeerURLQR(j["qr"].(string))
	if err != nil || qr.NroCmp != 1 || *qr.NroDocRec != 30500010912 {
		t.Errorf("QR: %+v %v", qr, err)
	}
	// Una factura a consumidor final anónimo no crea cliente.
	cf := `{"receptor":{"docTipo":99,"docNro":"0","condicionIvaReceptorId":5},"concepto":1,"fecha":"2026-10-20","items":[{"descripcion":"Taza","cantidad":1,"precioUnitario":15000}]}`
	if res, j := pedir(t, e.h, "POST", "/facturas", cf); res.StatusCode != 200 || j["numero"] != 2.0 {
		t.Fatalf("emisión a consumidor final: %d %v", res.StatusCode, j)
	}

	// 2. Detalle: con ítems, receptor, período y datos del emisor, y sin la respuesta cruda de ARCA.
	res, j = pedir(t, e.h, "GET", "/comprobantes/1", "")
	if res.StatusCode != 200 {
		t.Fatalf("detalle: %d %v", res.StatusCode, j)
	}
	c := j["comprobante"].(map[string]any)
	rec := c["receptor"].(map[string]any)
	items := c["items"].([]any)
	if c["sigla"] != "C" || c["cobro"] != "pendiente" || c["fecha"] != "2026-10-12" || rec["nombre"] != "ESTUDIO LUMEN SRL" ||
		rec["docNro"] != "30500010912" || len(items) != 1 || items[0].(map[string]any)["unidad"] != "horas" ||
		c["periodo"].(map[string]any)["vtoPago"] != "2026-10-24" || c["condicionVenta"] != "Transferencia bancaria" {
		t.Errorf("detalle: %v", c)
	}
	if _, ok := c["Respuesta"]; ok {
		t.Error("la respuesta de ARCA no se manda a la web")
	}
	if j["emisor"].(map[string]any)["cuit"] != "20111111112" {
		t.Errorf("emisor: %v", j["emisor"])
	}
	guardado, _ := e.mem.Comprobante(context.Background(), 1, 1)
	if !strings.Contains(guardado.Respuesta, "<CAE>76419283746521</CAE>") {
		t.Errorf("tiene que guardar la respuesta original de ARCA: %q", guardado.Respuesta)
	}

	// 3. Listado y filtros
	res, j = pedir(t, e.h, "GET", "/comprobantes?desde=2026-10-01&hasta=2026-10-31", "")
	if res.StatusCode != 200 || j["total"] != 2.0 || j["comprobantes"].([]any)[0].(map[string]any)["numero"] != 2.0 {
		t.Errorf("listado (más reciente primero): %v", j)
	}
	if _, j := pedir(t, e.h, "GET", "/comprobantes?q=lumen", ""); j["total"] != 1.0 {
		t.Errorf("búsqueda por cliente: %v", j)
	}
	if _, j := pedir(t, e.h, "GET", "/comprobantes?q=00003-00000002", ""); j["total"] != 1.0 {
		t.Errorf("búsqueda por número: %v", j)
	}
	if res, _ := pedir(t, e.h, "GET", "/comprobantes?desde=12/10/2026", ""); res.StatusCode != 400 {
		t.Errorf("fecha inválida: %d", res.StatusCode)
	}

	// 4. Cobro
	res, j = pedir(t, e.h, "PATCH", "/comprobantes/1/cobro", `{"cobro":"cobrada"}`)
	if res.StatusCode != 200 || j["cobro"] != "cobrada" || j["cobradaEn"] == nil {
		t.Errorf("marcar cobrada: %d %v", res.StatusCode, j)
	}
	if _, j := pedir(t, e.h, "GET", "/comprobantes?cobro=pendiente", ""); j["total"] != 1.0 {
		t.Errorf("filtro pendientes: %v", j)
	}
	if res, _ := pedir(t, e.h, "PATCH", "/comprobantes/1/cobro", `{"cobro":"pagada"}`); res.StatusCode != 400 {
		t.Errorf("cobro inválido: %d", res.StatusCode)
	}

	// 5. Clientes: solo Lumen (el consumidor final anónimo no es cliente).
	_, j = pedir(t, e.h, "GET", "/clientes", "")
	cls := j["clientes"].([]any)
	if len(cls) != 1 {
		t.Fatalf("clientes: %v", j)
	}
	cl := cls[0].(map[string]any)
	if cl["nombre"] != "ESTUDIO LUMEN SRL" || cl["comprobantes"] != 1.0 || cl["facturado"] != 85000.0 || cl["porCobrar"] != 0.0 {
		t.Errorf("cliente: %v", cl)
	}
	if _, j := pedir(t, e.h, "GET", "/clientes?q=30-50001091", ""); len(j["clientes"].([]any)) != 1 {
		t.Errorf("búsqueda de cliente por CUIT con guiones: %v", j)
	}

	// 6. Resumen del mes y plan
	res, j = pedir(t, e.h, "GET", "/resumen", "")
	if res.StatusCode != 200 {
		t.Fatalf("resumen: %d %v", res.StatusCode, j)
	}
	m := j["delMes"].(map[string]any)
	if j["mes"] != "2026-10" || m["facturado"] != 100000.0 || m["emitidos"] != 2.0 || m["cobrado"] != 85000.0 ||
		m["porCobrar"] != 15000.0 || m["pendientes"] != 1.0 || len(j["ultimas"].([]any)) != 2 {
		t.Errorf("resumen: %v", j)
	}
	if j["ultimos12Meses"].(map[string]any)["facturado"] != 100000.0 {
		t.Errorf("últimos 12 meses: %v", j["ultimos12Meses"])
	}
	plan := j["plan"].(map[string]any)
	if plan["nombre"] != "gratis" || plan["uso"].(map[string]any)["facturas"] != 2.0 || plan["limites"].(map[string]any)["facturas"] != 10.0 {
		t.Errorf("plan: %v", plan)
	}
	if _, j := pedir(t, e.h, "GET", "/resumen?mes=2026-09", ""); j["delMes"].(map[string]any)["emitidos"] != 0.0 {
		t.Errorf("resumen de septiembre: %v", j)
	}

	// 7. No existe
	if res, j := pedir(t, e.h, "GET", "/comprobantes/99", ""); res.StatusCode != 404 || j["error"] != "no_encontrado" {
		t.Errorf("inexistente: %d %v", res.StatusCode, j)
	}
}

func TestLimiteDelPlanGratis(t *testing.T) {
	e := nuevoEntorno(t, nil)
	ctx := context.Background()
	cuenta, _ := e.mem.AsegurarCuenta(ctx, "20111111112", 3)
	for i := 1; i <= 10; i++ {
		c := datos.Comprobante{Tipo: arca.FacturaC, PuntoVenta: 3, Numero: int64(i), Fecha: "2026-10-05", Moneda: "PES",
			Total: 1000, Receptor: datos.Receptor{DocTipo: 99, DocNro: "0"}, Cobro: datos.Pendiente}
		if err := e.mem.GuardarComprobante(ctx, cuenta.ID, &c); err != nil {
			t.Fatal(err)
		}
	}
	e.arca.ultimo.Store(10) // ARCA sigue la numeración de las que ya están guardadas.
	res, j := pedir(t, e.h, "POST", "/facturas", facturaLumen)
	if res.StatusCode != 403 || j["error"] != "limite_plan" {
		t.Fatalf("se esperaba 403 por el límite del plan: %d %v", res.StatusCode, j)
	}
	if n := e.arca.pedidos.Load(); n != 0 {
		t.Errorf("con el cupo agotado no tiene que llamar a ARCA (hubo %d pedidos)", n)
	}
	// En noviembre se renueva el cupo.
	nov := strings.Replace(facturaLumen, `"fecha": "2026-10-12"`, `"fecha": "2026-11-02"`, 1)
	if res, j := pedir(t, e.h, "POST", "/facturas", nov); res.StatusCode != 200 {
		t.Errorf("en el mes siguiente tiene que poder emitir: %d %v", res.StatusCode, j)
	}
	// Con Pro no hay límite.
	e.mem.CambiarPlan(cuenta.ID, datos.PlanPro)
	if res, j := pedir(t, e.h, "POST", "/facturas", facturaLumen); res.StatusCode != 200 {
		t.Errorf("Pro no tiene límite: %d %v", res.StatusCode, j)
	}
}

// datosQueFallan simula que la base se cae justo después de que ARCA autoriza.
type datosQueFallan struct{ *datos.Memoria }

func (datosQueFallan) GuardarComprobante(context.Context, int64, *datos.Comprobante) error {
	return errors.New("conexión perdida")
}

func TestAutorizadaPeroNoGuardada(t *testing.T) {
	e := nuevoEntorno(t, datosQueFallan{datos.NuevaMemoria()})
	res, j := pedir(t, e.h, "POST", "/facturas", facturaLumen)
	if res.StatusCode != 500 || j["error"] != "no_guardado" || !strings.Contains(j["mensaje"].(string), "76419283746521") ||
		!strings.Contains(j["mensaje"].(string), "No la vuelvas a emitir") {
		t.Fatalf("se esperaba un aviso claro con el CAE: %d %v", res.StatusCode, j)
	}
	if f, ok := j["factura"].(map[string]any); !ok || f["cae"] != "76419283746521" {
		t.Errorf("tiene que devolver los datos de la factura autorizada: %v", j)
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

func TestMes(t *testing.T) {
	if d, h := mes(time.Date(2026, 2, 15, 0, 0, 0, 0, arca.HoraArgentina)); d != "2026-02-01" || h != "2026-02-28" {
		t.Errorf("febrero: %s %s", d, h)
	}
	if d, h := mes(time.Date(2026, 12, 31, 23, 0, 0, 0, arca.HoraArgentina)); d != "2026-12-01" || h != "2026-12-31" {
		t.Errorf("diciembre: %s %s", d, h)
	}
}
