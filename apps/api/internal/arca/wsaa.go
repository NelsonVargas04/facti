package arca

import (
	"context"
	"crypto"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/smallstep/pkcs7"
)

// TicketAcceso (TA) que entrega el WSAA. Vale aprox. 12 horas.
// Los nombres JSON son los mismos que usaba la versión en TypeScript,
// así los tickets guardados en disco sirven para las dos.
type TicketAcceso struct {
	Token      string `json:"token"`
	Sign       string `json:"sign"`
	Expiracion string `json:"expiracion"` // ISO 8601
}

// vigente considera vencido el ticket 5 minutos antes, por margen.
func (t TicketAcceso) vigente(ahora time.Time) bool {
	exp, err := time.Parse(time.RFC3339, t.Expiracion)
	if err != nil {
		return false
	}
	return exp.Add(-5 * time.Minute).After(ahora)
}

// CrearTRA arma el Ticket de Requerimiento de Acceso.
func CrearTRA(servicio Servicio, ahora time.Time) string {
	const iso = "2006-01-02T15:04:05.000Z"
	desde := ahora.Add(-10 * time.Minute).UTC().Format(iso)
	hasta := ahora.Add(10 * time.Minute).UTC().Format(iso)
	return `<?xml version="1.0" encoding="UTF-8"?>` +
		`<loginTicketRequest version="1.0"><header>` +
		fmt.Sprintf("<uniqueId>%d</uniqueId>", ahora.Unix()) +
		"<generationTime>" + desde + "</generationTime>" +
		"<expirationTime>" + hasta + "</expirationTime>" +
		"</header><service>" + esc(string(servicio)) + "</service></loginTicketRequest>"
}

// FirmarTRA firma el TRA como CMS (PKCS#7, SHA-256, con el TRA embebido) y devuelve Base64.
func FirmarTRA(tra string, certPEM, keyPEM []byte) (string, error) {
	cert, err := leerCertificado(certPEM)
	if err != nil {
		return "", err
	}
	key, err := leerClave(keyPEM)
	if err != nil {
		return "", err
	}
	sd, err := pkcs7.NewSignedData([]byte(tra))
	if err != nil {
		return "", err
	}
	sd.SetDigestAlgorithm(pkcs7.OIDDigestAlgorithmSHA256)
	// AddSigner agrega los atributos contentType, messageDigest y signingTime.
	if err := sd.AddSigner(cert, key, pkcs7.SignerInfoConfig{}); err != nil {
		return "", fmt.Errorf("no se pudo firmar el TRA: %w", err)
	}
	der, err := sd.Finish()
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(der), nil
}

func leerCertificado(p []byte) (*x509.Certificate, error) {
	b, _ := pem.Decode(p)
	if b == nil {
		return nil, errors.New("el certificado no está en formato PEM")
	}
	return x509.ParseCertificate(b.Bytes)
}

// leerClave acepta claves PKCS#1 ("RSA PRIVATE KEY", openssl genrsa clásico)
// y PKCS#8 ("PRIVATE KEY", el formato por defecto de OpenSSL 3).
func leerClave(p []byte) (crypto.PrivateKey, error) {
	b, _ := pem.Decode(p)
	if b == nil {
		return nil, errors.New("la clave privada no está en formato PEM")
	}
	if k, err := x509.ParsePKCS1PrivateKey(b.Bytes); err == nil {
		return k, nil
	}
	k, err := x509.ParsePKCS8PrivateKey(b.Bytes)
	if err != nil {
		return nil, errors.New("no se pudo leer la clave privada (se espera RSA en PKCS#1 o PKCS#8)")
	}
	return k, nil
}

// LoginCms pide un ticket de acceso al WSAA.
func LoginCms(ctx context.Context, cfg Config, servicio Servicio) (TicketAcceso, error) {
	cms, err := FirmarTRA(CrearTRA(servicio, time.Now()), cfg.CertPEM, cfg.KeyPEM)
	if err != nil {
		return TicketAcceso{}, err
	}
	interior, err := llamarSoap(ctx, cfg, pedidoSoap{
		url:      cfg.endpoints().WSAA,
		servicio: "WSAA",
		cuerpo: `<wsaa:loginCms xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">` +
			"<wsaa:in0>" + cms + "</wsaa:in0></wsaa:loginCms>",
	})
	if err != nil {
		return TicketAcceso{}, err
	}
	var resp struct {
		Return string `xml:"loginCmsReturn"`
	}
	if err := xmlUnmarshal(interior, &resp); err != nil || resp.Return == "" {
		return TicketAcceso{}, &Error{Mensaje: "El WSAA no devolvió un ticket de acceso", Servicio: "WSAA"}
	}
	var ta struct {
		Header struct {
			Expiracion string `xml:"expirationTime"`
		} `xml:"header"`
		Credentials struct {
			Token string `xml:"token"`
			Sign  string `xml:"sign"`
		} `xml:"credentials"`
	}
	if err := xmlUnmarshal([]byte(resp.Return), &ta); err != nil ||
		ta.Credentials.Token == "" || ta.Credentials.Sign == "" || ta.Header.Expiracion == "" {
		return TicketAcceso{}, &Error{Mensaje: "Ticket de acceso incompleto", Servicio: "WSAA"}
	}
	return TicketAcceso{
		Token:      strings.TrimSpace(ta.Credentials.Token),
		Sign:       strings.TrimSpace(ta.Credentials.Sign),
		Expiracion: strings.TrimSpace(ta.Header.Expiracion),
	}, nil
}

// CacheTickets guarda los tickets mientras son válidos. El WSAA rechaza pedir un ticket nuevo
// si todavía hay uno vigente, por eso se persisten en disco y no solo en memoria.
type CacheTickets struct {
	cfg     Config
	mu      sync.Mutex
	memoria map[string]TicketAcceso
	locks   map[string]*sync.Mutex

	// Reemplazables en tests.
	login func(context.Context, Config, Servicio) (TicketAcceso, error)
	ahora func() time.Time
}

func NuevaCacheTickets(cfg Config) *CacheTickets {
	return &CacheTickets{
		cfg:     cfg,
		memoria: map[string]TicketAcceso{},
		locks:   map[string]*sync.Mutex{},
		login:   LoginCms,
		ahora:   time.Now,
	}
}

// Obtener devuelve un ticket vigente para el servicio, pidiéndolo al WSAA solo si hace falta.
func (c *CacheTickets) Obtener(ctx context.Context, servicio Servicio) (TicketAcceso, error) {
	clave := fmt.Sprintf("%s-%s-%s", c.cfg.Entorno, c.cfg.CuitCertificado, servicio)

	// Un candado por servicio: evita pedir dos tickets a la vez para el mismo servicio.
	c.mu.Lock()
	l, ok := c.locks[clave]
	if !ok {
		l = &sync.Mutex{}
		c.locks[clave] = l
	}
	c.mu.Unlock()
	l.Lock()
	defer l.Unlock()

	c.mu.Lock()
	enMemoria, ok := c.memoria[clave]
	c.mu.Unlock()
	if ok && enMemoria.vigente(c.ahora()) {
		return enMemoria, nil
	}
	if enDisco, ok := c.leer(clave); ok && enDisco.vigente(c.ahora()) {
		c.recordar(clave, enDisco)
		return enDisco, nil
	}

	ta, err := c.login(ctx, c.cfg, servicio)
	if err != nil {
		return TicketAcceso{}, err
	}
	c.recordar(clave, ta)
	if err := c.guardar(clave, ta); err != nil {
		return TicketAcceso{}, fmt.Errorf("no se pudo guardar el ticket de acceso: %w", err)
	}
	return ta, nil
}

func (c *CacheTickets) recordar(clave string, ta TicketAcceso) {
	c.mu.Lock()
	c.memoria[clave] = ta
	c.mu.Unlock()
}

func (c *CacheTickets) ruta(clave string) string {
	if c.cfg.CacheDir == "" {
		return ""
	}
	return filepath.Join(c.cfg.CacheDir, "ta-"+clave+".json")
}

func (c *CacheTickets) leer(clave string) (TicketAcceso, bool) {
	var ta TicketAcceso
	ruta := c.ruta(clave)
	if ruta == "" {
		return ta, false
	}
	b, err := os.ReadFile(ruta)
	if err != nil || json.Unmarshal(b, &ta) != nil {
		return ta, false
	}
	return ta, true
}

func (c *CacheTickets) guardar(clave string, ta TicketAcceso) error {
	ruta := c.ruta(clave)
	if ruta == "" {
		return nil
	}
	if err := os.MkdirAll(c.cfg.CacheDir, 0o700); err != nil {
		return err
	}
	b, _ := json.Marshal(ta)
	return os.WriteFile(ruta, b, 0o600)
}
