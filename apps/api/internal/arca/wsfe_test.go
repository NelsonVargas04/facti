package arca

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

// arcaFalso simula WSFEv1: responde según el SOAPAction con el XML que devuelva responder.
type arcaFalso struct {
	mu       sync.Mutex
	pedidos  []string // métodos llamados, en orden
	cuerpos  map[string]string
	responde func(metodo, cuerpo string) (string, bool) // false = cortar la conexión
}

func (a *arcaFalso) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	metodo := strings.TrimPrefix(strings.Trim(r.Header.Get("SOAPAction"), `"`), nsWsfe)
	b, _ := io.ReadAll(r.Body)
	a.mu.Lock()
	a.pedidos = append(a.pedidos, metodo)
	a.cuerpos[metodo] = string(b)
	a.mu.Unlock()

	resultado, ok := a.responde(metodo, string(b))
	if !ok {
		// Simula un corte de red: cierra la conexión sin responder.
		conn, _, _ := w.(http.Hijacker).Hijack()
		conn.Close()
		return
	}
	w.Header().Set("Content-Type", "text/xml; charset=utf-8")
	io.WriteString(w, `<?xml version="1.0" encoding="utf-8"?>`+
		`<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>`+
		`<`+metodo+`Response xmlns="http://ar.gov.afip.dif.FEV1/"><`+metodo+`Result>`+resultado+
		`</`+metodo+`Result></`+metodo+`Response></soap:Body></soap:Envelope>`)
}

func nuevoWsfeFalso(t *testing.T, responde func(metodo, cuerpo string) (string, bool)) (*Wsfe, *arcaFalso) {
	t.Helper()
	falso := &arcaFalso{cuerpos: map[string]string{}, responde: responde}
	srv := httptest.NewServer(falso)
	t.Cleanup(srv.Close)
	cfg := Config{
		Entorno: Homologacion, CuitCertificado: "20111111112",
		Endpoints: &Endpoints{WSFE: srv.URL}, Timeout: 2 * time.Second,
	}
	tickets := NuevaCacheTickets(cfg)
	tickets.login = func(context.Context, Config, Servicio) (TicketAcceso, error) {
		return TicketAcceso{Token: "TOKEN", Sign: "SIGN", Expiracion: time.Now().Add(time.Hour).Format(time.RFC3339)}, nil
	}
	return NuevoWsfe(cfg, tickets, "20111111112"), falso
}

func TestEstado(t *testing.T) {
	w, falso := nuevoWsfeFalso(t, func(string, string) (string, bool) {
		return "<AppServer>OK</AppServer><DbServer>OK</DbServer><AuthServer>OK</AuthServer>", true
	})
	e, err := w.Estado(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if e != (EstadoServidores{App: "OK", DB: "OK", Auth: "OK"}) {
		t.Errorf("estado: %+v", e)
	}
	if strings.Contains(falso.cuerpos["FEDummy"], "<ar:Auth>") {
		t.Error("FEDummy no lleva autenticación")
	}
}

func TestEmitirAprobada(t *testing.T) {
	w, falso := nuevoWsfeFalso(t, func(metodo, _ string) (string, bool) {
		switch metodo {
		case "FECompUltimoAutorizado":
			return "<PtoVta>3</PtoVta><CbteTipo>11</CbteTipo><CbteNro>127</CbteNro>", true
		case "FECAESolicitar":
			return "<FeCabResp><Resultado>A</Resultado></FeCabResp><FeDetResp><FECAEDetResponse>" +
				"<Resultado>A</Resultado><CAE>76419283746521</CAE><CAEFchVto>20261022</CAEFchVto>" +
				"<Observaciones><Obs><Code>10217</Code><Msg>Aviso de prueba</Msg></Obs></Observaciones>" +
				"</FECAEDetResponse></FeDetResp>", true
		}
		return "", true
	})
	r, err := w.Emitir(context.Background(), comprobanteC())
	if err != nil {
		t.Fatal(err)
	}
	if !r.Aprobado || r.Numero != 128 || r.CAE != "76419283746521" || r.VencimientoCAE != "20261022" {
		t.Errorf("resultado: %+v", r)
	}
	if len(r.Observaciones) != 1 || r.Observaciones[0].Codigo != "10217" {
		t.Errorf("observaciones: %+v", r.Observaciones)
	}
	pedido := falso.cuerpos["FECAESolicitar"]
	for _, parte := range []string{"<ar:Token>TOKEN</ar:Token>", "<ar:Cuit>20111111112</ar:Cuit>", "<ar:CbteDesde>128</ar:CbteDesde>"} {
		if !strings.Contains(pedido, parte) {
			t.Errorf("al pedido le falta %s", parte)
		}
	}
}

func TestEmitirRechazada(t *testing.T) {
	w, _ := nuevoWsfeFalso(t, func(metodo, _ string) (string, bool) {
		if metodo == "FECompUltimoAutorizado" {
			return "<CbteNro>0</CbteNro>", true
		}
		return "<FeDetResp><FECAEDetResponse><Resultado>R</Resultado>" +
			"<Observaciones><Obs><Code>10015</Code><Msg>DocNro inválido</Msg></Obs></Observaciones>" +
			"</FECAEDetResponse></FeDetResp>", true
	})
	r, err := w.Emitir(context.Background(), comprobanteC())
	if err != nil {
		t.Fatal(err)
	}
	if r.Aprobado || r.CAE != "" || len(r.Observaciones) != 1 {
		t.Errorf("tenía que venir rechazada con una observación: %+v", r)
	}
}

func TestEmitirSinRespuestaConsultaAntesDeFallar(t *testing.T) {
	autorizada := true
	w, falso := nuevoWsfeFalso(t, func(metodo, _ string) (string, bool) {
		switch metodo {
		case "FECompUltimoAutorizado":
			return "<CbteNro>41</CbteNro>", true
		case "FECAESolicitar":
			return "", false // se corta la red
		case "FECompConsultar":
			if autorizada {
				return "<ResultGet><CbteDesde>42</CbteDesde><CodAutorizacion>11112222333344</CodAutorizacion><FchVto>20261101</FchVto></ResultGet>", true
			}
			return "<Errors><Err><Code>602</Code><Msg>No existen datos</Msg></Err></Errors>", true
		}
		return "", true
	})

	// ARCA la autorizó aunque no llegó la respuesta: se recupera el CAE.
	r, err := w.Emitir(context.Background(), comprobanteC())
	if err != nil {
		t.Fatal(err)
	}
	if !r.Aprobado || r.Numero != 42 || r.CAE != "11112222333344" {
		t.Errorf("tenía que recuperar el CAE con FECompConsultar: %+v", r)
	}
	if got := strings.Join(falso.pedidos, ","); got != "FECompUltimoAutorizado,FECAESolicitar,FECompConsultar" {
		t.Errorf("orden de llamadas: %s", got)
	}
	if !strings.Contains(falso.cuerpos["FECompConsultar"], "<ar:CbteNro>42</ar:CbteNro>") {
		t.Error("tenía que consultar el número que intentó emitir")
	}

	// No quedó autorizada: devuelve el error de red para que se reintente.
	autorizada = false
	_, err = w.Emitir(context.Background(), comprobanteC())
	var sinRespuesta *SinRespuestaError
	if !errors.As(err, &sinRespuesta) {
		t.Fatalf("se esperaba SinRespuestaError, vino %v", err)
	}
}

func TestEmitirDeAUnoPorPuntoDeVentaYTipo(t *testing.T) {
	var (
		mu       sync.Mutex
		ultimo   int64
		enCurso  int
		maxCurso int
	)
	w, _ := nuevoWsfeFalso(t, func(metodo, cuerpo string) (string, bool) {
		mu.Lock()
		defer mu.Unlock()
		switch metodo {
		case "FECompUltimoAutorizado":
			enCurso++
			if enCurso > maxCurso {
				maxCurso = enCurso
			}
			return "<CbteNro>" + strconv.FormatInt(ultimo, 10) + "</CbteNro>", true
		case "FECAESolicitar":
			ultimo++
			enCurso--
			return "<FeDetResp><FECAEDetResponse><Resultado>A</Resultado><CAE>1</CAE><CAEFchVto>20261031</CAEFchVto></FECAEDetResponse></FeDetResp>", true
		}
		return "", true
	})
	var wg sync.WaitGroup
	numeros := make([]int64, 5)
	for i := range numeros {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r, err := w.Emitir(context.Background(), comprobanteC())
			if err != nil {
				t.Error(err)
			}
			numeros[i] = r.Numero
		}()
	}
	wg.Wait()
	if maxCurso != 1 {
		t.Errorf("hubo %d emisiones a la vez en el mismo punto de venta y tipo", maxCurso)
	}
	vistos := map[int64]bool{}
	for _, n := range numeros {
		if vistos[n] {
			t.Errorf("número repetido: %d (%v)", n, numeros)
		}
		vistos[n] = true
	}
}

func TestErroresDeWsfe(t *testing.T) {
	w, _ := nuevoWsfeFalso(t, func(metodo, _ string) (string, bool) {
		if metodo == "FEParamGetPtosVenta" {
			return "<Errors><Err><Code>602</Code><Msg>Sin Resultados</Msg></Err></Errors>", true
		}
		return "<Errors><Err><Code>600</Code><Msg>ValidacionDeToken: No aparecio CUIT</Msg></Err></Errors>", true
	})
	pv, err := w.PuntosDeVenta(context.Background())
	if err != nil || len(pv) != 0 {
		t.Errorf("sin puntos de venta tiene que devolver lista vacía, vino %v %v", pv, err)
	}
	_, err = w.UltimoAutorizado(context.Background(), 1, FacturaC)
	var e *Error
	if !errors.As(err, &e) || len(e.Detalles) != 1 || e.Detalles[0].Codigo != "600" {
		t.Errorf("se esperaba el error 600 de ARCA, vino %v", err)
	}
}

func TestFaultSoap(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		io.WriteString(w, `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body>`+
			`<soapenv:Fault><faultcode>ns1:coe.alreadyAuthenticated</faultcode>`+
			`<faultstring>El CEE ya posee un TA valido para el acceso al WSN solicitado</faultstring></soapenv:Fault>`+
			`</soapenv:Body></soapenv:Envelope>`)
	}))
	defer srv.Close()
	_, err := llamarSoap(context.Background(), Config{}, pedidoSoap{url: srv.URL, servicio: "WSAA"})
	var e *Error
	if !errors.As(err, &e) || !strings.Contains(e.Mensaje, "TA valido") || e.Detalles[0].Codigo != "ns1:coe.alreadyAuthenticated" {
		t.Errorf("fault mal interpretado: %v", err)
	}
}
