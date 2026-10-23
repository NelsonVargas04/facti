// Package arca implementa la conexión directa con los web services de ARCA:
// WSAA (autenticación), WSFEv1 (facturas A, B, C y M), padrón A5 y el QR del comprobante.
package arca

import (
	"net/http"
	"time"
)

// Entorno de ARCA: homologación (pruebas) o producción.
type Entorno string

const (
	Homologacion Entorno = "homologacion"
	Produccion   Entorno = "produccion"
)

// Endpoints de los web services. Los dominios *.afip.gov.ar siguen siendo los publicados
// en los manuales técnicos; verificar contra la documentación vigente antes de pasar a producción.
type Endpoints struct {
	WSAA   string
	WSFE   string
	Padron string
}

var endpoints = map[Entorno]Endpoints{
	Homologacion: {
		WSAA:   "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
		WSFE:   "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
		Padron: "https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5",
	},
	Produccion: {
		WSAA:   "https://wsaa.afip.gov.ar/ws/services/LoginCms",
		WSFE:   "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
		Padron: "https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5",
	},
}

// EndpointsDe devuelve los endpoints del entorno. Ante un valor desconocido usa homologación.
func EndpointsDe(e Entorno) Endpoints {
	if ep, ok := endpoints[e]; ok {
		return ep
	}
	return endpoints[Homologacion]
}

// Servicio es el nombre que se le pide al WSAA.
type Servicio string

const (
	ServicioFacturacion Servicio = "wsfe"
	ServicioPadron      Servicio = "ws_sr_constancia_inscripcion"
)

// Config de la conexión con ARCA.
type Config struct {
	Entorno Entorno
	// CUIT dueño del certificado (Facti en producción).
	CuitCertificado string
	// Certificado X.509 en PEM.
	CertPEM []byte
	// Clave privada en PEM. Nunca se loguea ni se sube al repo.
	KeyPEM []byte
	// Carpeta para guardar tickets de acceso. Si está vacía, solo se cachean en memoria.
	CacheDir string
	// Tiempo máximo de espera por llamada. Si es cero, 30 segundos.
	Timeout time.Duration
	// Endpoints a usar en lugar de los del entorno (para tests).
	Endpoints *Endpoints
	// Cliente HTTP. Si es nil, se usa http.DefaultClient.
	HTTP *http.Client
}

func (c Config) endpoints() Endpoints {
	if c.Endpoints != nil {
		return *c.Endpoints
	}
	return EndpointsDe(c.Entorno)
}

func (c Config) timeout() time.Duration {
	if c.Timeout > 0 {
		return c.Timeout
	}
	return 30 * time.Second
}

func (c Config) cliente() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return http.DefaultClient
}
