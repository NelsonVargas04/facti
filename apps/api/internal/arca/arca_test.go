package arca

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/smallstep/pkcs7"
)

func TestFacturaSugerida(t *testing.T) {
	if s := FacturaSugerida(Monotributo, ResponsableInscripto); s.Letra != "C" {
		t.Errorf("monotributista tiene que emitir C, dio %s", s.Letra)
	}
	s := FacturaSugerida(ResponsableInscripto, Monotributo)
	if s.Tipo != FacturaA || s.Leyenda != LeyendaLey27618 {
		t.Errorf("inscripto a monotributista: A con leyenda Ley 27.618, dio %+v", s)
	}
	if s := FacturaSugerida(ResponsableInscripto, ConsumidorFinal); s.Letra != "B" {
		t.Errorf("inscripto a consumidor final tiene que ser B, dio %s", s.Letra)
	}
	if s := FacturaSugerida(ResponsableInscripto, ResponsableInscripto); s.Letra != "A" || s.Leyenda != "" {
		t.Errorf("inscripto a inscripto tiene que ser A sin leyenda, dio %+v", s)
	}
}

func TestLetraDeTipo(t *testing.T) {
	casos := map[int]string{1: "A", 8: "B", 11: "C", 13: "C", 51: "M", 99: ""}
	for tipo, letra := range casos {
		if got := LetraDeTipo(tipo); got != letra {
			t.Errorf("LetraDeTipo(%d) = %q, se esperaba %q", tipo, got, letra)
		}
	}
}

func TestQR(t *testing.T) {
	tipoDoc, nroDoc := 80, int64(30715896327)
	u := URLDelQR(DatosQR{
		Fecha: "2026-10-12", Cuit: 27314567894, PtoVta: 3, TipoCmp: 11, NroCmp: 128,
		Importe: 85000, Moneda: "PES", Ctz: 1, TipoDocRec: &tipoDoc, NroDocRec: &nroDoc,
		TipoCodAut: "E", CodAut: 76419283746521,
	})
	if !strings.HasPrefix(u, "https://www.arca.gob.ar/fe/qr/?p=") {
		t.Fatalf("URL inesperada: %s", u)
	}
	d, err := LeerURLQR(u)
	if err != nil {
		t.Fatal(err)
	}
	if d.Ver != 1 || d.CodAut != 76419283746521 || *d.NroDocRec != nroDoc {
		t.Errorf("datos leídos incorrectos: %+v", d)
	}
	// El JSON arranca con ver, como pide la especificación.
	p := strings.TrimPrefix(u, URLQR+"?p=")
	j, _ := base64.StdEncoding.DecodeString(p)
	if !strings.HasPrefix(string(j), `{"ver":1,"fecha":"2026-10-12"`) {
		t.Errorf("JSON del QR: %s", j)
	}
}

func TestFechas(t *testing.T) {
	// 01:00 UTC del 15 son las 22:00 del 14 en Argentina.
	if got := AFechaArca(time.Date(2026, 10, 15, 1, 0, 0, 0, time.UTC)); got != "20261014" {
		t.Errorf("AFechaArca = %s", got)
	}
	if got := DeFechaArca("20261014"); got != "2026-10-14" {
		t.Errorf("DeFechaArca = %s", got)
	}
	if got := importe(85000); got != "85000.00" {
		t.Errorf("importe = %s", got)
	}
	if got := importe(0.125); got != "0.13" {
		t.Errorf("importe redondeado = %s", got)
	}
}

func TestCrearTRA(t *testing.T) {
	tra := CrearTRA(ServicioFacturacion, time.Date(2026, 10, 14, 12, 0, 0, 0, time.UTC))
	for _, parte := range []string{
		"<service>wsfe</service>",
		"<generationTime>2026-10-14T11:50:00.000Z</generationTime>",
		"<expirationTime>2026-10-14T12:10:00.000Z</expirationTime>",
	} {
		if !strings.Contains(tra, parte) {
			t.Errorf("al TRA le falta %s:\n%s", parte, tra)
		}
	}
}

// certificadoDePrueba genera un certificado autofirmado y su clave en PEM (PKCS#8).
func certificadoDePrueba(t *testing.T) (certPEM, keyPEM []byte) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	plantilla := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "facti-test"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(24 * time.Hour),
	}
	der, err := x509.CreateCertificate(rand.Reader, plantilla, plantilla, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	pk8, _ := x509.MarshalPKCS8PrivateKey(key)
	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}),
		pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: pk8})
}

func TestFirmarTRA(t *testing.T) {
	certPEM, keyPEM := certificadoDePrueba(t)
	cms, err := FirmarTRA(CrearTRA(ServicioFacturacion, time.Now()), certPEM, keyPEM)
	if err != nil {
		t.Fatal(err)
	}
	der, err := base64.StdEncoding.DecodeString(cms)
	if err != nil {
		t.Fatal(err)
	}
	p7, err := pkcs7.Parse(der)
	if err != nil {
		t.Fatal(err)
	}
	// El TRA va embebido en el CMS (firma "attached"), como pide el WSAA.
	if !strings.Contains(string(p7.Content), "<service>wsfe</service>") {
		t.Error("el CMS no tiene el TRA embebido")
	}
	if len(p7.Certificates) != 1 {
		t.Errorf("se esperaba 1 certificado, hay %d", len(p7.Certificates))
	}
	if err := p7.Verify(); err != nil {
		t.Errorf("la firma no verifica: %v", err)
	}
}

func TestFirmarTRAConClavePKCS1(t *testing.T) {
	certPEM, keyPEM := certificadoDePrueba(t)
	b, _ := pem.Decode(keyPEM)
	k, _ := x509.ParsePKCS8PrivateKey(b.Bytes)
	pk1 := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(k.(*rsa.PrivateKey))})
	if _, err := FirmarTRA("<x/>", certPEM, pk1); err != nil {
		t.Fatalf("no firmó con clave PKCS#1: %v", err)
	}
	if _, err := FirmarTRA("<x/>", certPEM, []byte("no es pem")); err == nil {
		t.Fatal("se esperaba error con una clave inválida")
	}
}

func TestCacheTickets(t *testing.T) {
	dir := t.TempDir()
	cfg := Config{Entorno: Homologacion, CuitCertificado: "20111111112", CacheDir: dir}
	llamadas := 0
	ahora := time.Date(2026, 10, 14, 12, 0, 0, 0, time.UTC)
	nueva := func() *CacheTickets {
		c := NuevaCacheTickets(cfg)
		c.ahora = func() time.Time { return ahora }
		c.login = func(context.Context, Config, Servicio) (TicketAcceso, error) {
			llamadas++
			return TicketAcceso{Token: "T", Sign: "S", Expiracion: ahora.Add(12 * time.Hour).Format(time.RFC3339)}, nil
		}
		return c
	}

	c := nueva()
	for range 3 {
		if _, err := c.Obtener(context.Background(), ServicioFacturacion); err != nil {
			t.Fatal(err)
		}
	}
	if llamadas != 1 {
		t.Fatalf("se esperaba 1 login, hubo %d", llamadas)
	}
	// Otra instancia (por ejemplo, después de reiniciar la API) lo lee del disco.
	if _, err := nueva().Obtener(context.Background(), ServicioFacturacion); err != nil {
		t.Fatal(err)
	}
	if llamadas != 1 {
		t.Fatalf("tenía que leer el ticket del disco, hubo %d logins", llamadas)
	}
	if _, err := os.Stat(filepath.Join(dir, "ta-homologacion-20111111112-wsfe.json")); err != nil {
		t.Errorf("no se guardó el ticket con el nombre esperado: %v", err)
	}
	// Vencido (con el margen de 5 minutos): pide uno nuevo.
	ahora = ahora.Add(12*time.Hour - 4*time.Minute)
	if _, err := nueva().Obtener(context.Background(), ServicioFacturacion); err != nil {
		t.Fatal(err)
	}
	if llamadas != 2 {
		t.Fatalf("con el ticket vencido tenía que pedir otro, hubo %d logins", llamadas)
	}
}

func comprobanteC() NuevoComprobante {
	dia := func(d int) time.Time { return time.Date(2026, 10, d, 15, 0, 0, 0, time.UTC) }
	return NuevoComprobante{
		PuntoVenta: 3, Tipo: FacturaC, Concepto: ConceptoServicios, DocTipo: DocCUIT, DocNro: "30715896327",
		CondicionIvaReceptorID: CondIvaResponsableInscripto, Fecha: dia(12),
		ImporteTotal: 85000, ImporteNeto: 85000,
		Servicio: &PeriodoServicio{Desde: dia(1), Hasta: dia(31), VencimientoPago: dia(24)},
	}
}

func TestArmarSolicitudFacturaC(t *testing.T) {
	xml := ArmarSolicitud(comprobanteC(), 128)
	for _, parte := range []string{
		"<ar:CbteDesde>128</ar:CbteDesde>",
		"<ar:ImpTotal>85000.00</ar:ImpTotal>",
		"<ar:FchServDesde>20261001</ar:FchServDesde>",
		"<ar:CondicionIVAReceptorId>1</ar:CondicionIVAReceptorId>",
		"<ar:MonId>PES</ar:MonId><ar:MonCotiz>1</ar:MonCotiz>",
	} {
		if !strings.Contains(xml, parte) {
			t.Errorf("a la solicitud le falta %s", parte)
		}
	}
	if strings.Contains(xml, "<ar:Iva>") {
		t.Error("la Factura C no tiene que discriminar IVA")
	}
}

func TestValidar(t *testing.T) {
	c := comprobanteC()
	if err := Validar(c); err != nil {
		t.Fatalf("comprobante válido rechazado: %v", err)
	}
	casos := map[string]func(*NuevoComprobante){
		"total distinto":     func(c *NuevoComprobante) { c.ImporteTotal = 1 },
		"servicio sin fecha": func(c *NuevoComprobante) { c.Servicio = nil },
		"C con IVA":          func(c *NuevoComprobante) { c.ImporteIva = 10; c.ImporteTotal += 10 },
		"A sin alícuotas":    func(c *NuevoComprobante) { c.Tipo = FacturaA; c.ImporteIva = 10; c.ImporteTotal += 10 },
	}
	for nombre, cambiar := range casos {
		c := comprobanteC()
		cambiar(&c)
		if err := Validar(c); err == nil {
			t.Errorf("%s: se esperaba error", nombre)
		}
	}
}

func persona(t *testing.T, x string) *Persona {
	t.Helper()
	var p Persona
	if err := xmlUnmarshal([]byte("<personaReturn>"+x+"</personaReturn>"), &p); err != nil {
		t.Fatal(err)
	}
	return &p
}

func TestInterpretarPersona(t *testing.T) {
	d := InterpretarPersona("27314567894", persona(t,
		`<datosGenerales><apellido>FERNANDEZ</apellido><nombre>LUCIA</nombre><tipoPersona>FISICA</tipoPersona>`+
			`<domicilioFiscal><direccion>AV SIEMPRE VIVA 742</direccion><localidad>CABA</localidad><descripcionProvincia>CIUDAD AUTONOMA BUENOS AIRES</descripcionProvincia></domicilioFiscal></datosGenerales>`+
			`<datosMonotributo><categoriaMonotributo><descripcionCategoria>C LOCACIONES DE SERVICIO</descripcionCategoria></categoriaMonotributo>`+
			`<actividadMonotributista><descripcionActividad>SERVICIOS DE DISEÑO</descripcionActividad></actividadMonotributista></datosMonotributo>`))
	if d.Condicion != Monotributo || d.Nombre != "FERNANDEZ LUCIA" || d.CategoriaMonotributo != "C LOCACIONES DE SERVICIO" {
		t.Errorf("monotributista mal interpretado: %+v", d)
	}
	if d.Domicilio != "AV SIEMPRE VIVA 742, CABA, CIUDAD AUTONOMA BUENOS AIRES" || len(d.Actividades) != 1 {
		t.Errorf("domicilio o actividades: %+v", d)
	}

	d = InterpretarPersona("30715896327", persona(t,
		`<datosGenerales><razonSocial>ESTUDIO LUMEN SRL</razonSocial><tipoPersona>JURIDICA</tipoPersona></datosGenerales>`+
			`<datosRegimenGeneral><impuesto><idImpuesto>32</idImpuesto></impuesto><impuesto><idImpuesto>30</idImpuesto></impuesto></datosRegimenGeneral>`))
	if d.Condicion != ResponsableInscripto || d.Nombre != "ESTUDIO LUMEN SRL" {
		t.Errorf("con el impuesto 30 tiene que ser responsable inscripto: %+v", d)
	}

	d = InterpretarPersona("20111111112", persona(t,
		`<datosRegimenGeneral><impuesto><idImpuesto>32</idImpuesto></impuesto></datosRegimenGeneral>`))
	if d.Condicion != Exento {
		t.Errorf("con el impuesto 32 tiene que ser exento: %+v", d)
	}
	if d := InterpretarPersona("20111111112", persona(t, "")); d.Condicion != ConsumidorFinal || d.Actividades == nil {
		t.Errorf("sin datos tiene que ser consumidor final: %+v", d)
	}
}

func TestErroresSonDistinguibles(t *testing.T) {
	var err error = &SinRespuestaError{Mensaje: "x", Causa: context.DeadlineExceeded}
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Error("SinRespuestaError tiene que exponer la causa")
	}
}
