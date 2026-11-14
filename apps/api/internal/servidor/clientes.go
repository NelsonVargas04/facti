package servidor

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"facti/api/internal/arca"
	"facti/api/internal/config"
)

// ConfiguracionError indica que falta configuración (variables de entorno o certificado).
// Se traduce a HTTP 503.
type ConfiguracionError struct{ Mensaje string }

func (e *ConfiguracionError) Error() string { return e.Mensaje }

// ClientesArca que usan las rutas.
type ClientesArca struct {
	Cfg     arca.Config
	Tickets *arca.CacheTickets
	// Emisor del .env: lo usan las pruebas manuales (cmd/arca). La API usa el CUIT de cada cuenta.
	Wsfe       *arca.Wsfe
	CuitEmisor string
	PuntoVenta int

	mu    sync.Mutex
	wsfes map[string]*arca.Wsfe
}

// WsfeDe devuelve el cliente de WSFEv1 para un CUIT representado. Se reusa siempre el mismo por CUIT,
// así el bloqueo por punto de venta y tipo vale para todos los pedidos de ese emisor.
func (c *ClientesArca) WsfeDe(cuit string) *arca.Wsfe {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.wsfes == nil {
		c.wsfes = map[string]*arca.Wsfe{}
	}
	if c.Wsfe != nil && cuit == c.CuitEmisor {
		return c.Wsfe
	}
	w, ok := c.wsfes[cuit]
	if !ok {
		w = arca.NuevoWsfe(c.Cfg, c.Tickets, cuit)
		c.wsfes[cuit] = w
	}
	return w
}

// ProveedorArca devuelve los clientes de ARCA, o un error si falta configuración.
type ProveedorArca func() (*ClientesArca, error)

// ClientesPerezosos construye los clientes de ARCA la primera vez que se usan (no al arrancar),
// así el server levanta aunque todavía no haya certificado ni .env.
// Si falla, se vuelve a intentar en el próximo pedido (por si mientras tanto se cargó el certificado).
//
// Si se pasa la base (datos), los tickets del WSAA y los bloqueos de emisión van a Postgres:
// así funciona igual con varias instancias de la API (Vercel).
func ClientesPerezosos(c config.Config, datos ProveedorDatos) ProveedorArca {
	var (
		mu   sync.Mutex
		memo *ClientesArca
	)
	return func() (*ClientesArca, error) {
		mu.Lock()
		defer mu.Unlock()
		if memo != nil {
			return memo, nil
		}
		var compartido almacenYCandado
		if datos != nil {
			ctx, cancelar := context.WithTimeout(context.Background(), 15*time.Second)
			d, err := datos(ctx)
			cancelar()
			if err != nil {
				return nil, err
			}
			compartido, _ = d.(almacenYCandado)
		}
		cl, err := construir(c, compartido)
		if err != nil {
			return nil, err
		}
		memo = cl
		return memo, nil
	}
}

// almacenYCandado es lo que da la base de Postgres para compartir tickets y bloqueos entre instancias.
type almacenYCandado interface {
	arca.AlmacenTickets
	arca.Candado
}

// ConstruirClientes lee el certificado y arma los clientes de ARCA (tickets en disco, bloqueo local).
func ConstruirClientes(c config.Config) (*ClientesArca, error) { return construir(c, nil) }

func construir(c config.Config, compartido almacenYCandado) (*ClientesArca, error) {
	if err := requerida("ARCA_CUIT_CERTIFICADO", c.CuitCertificado); err != nil {
		return nil, err
	}
	cert, err := leerPEM("ARCA_CERT_PEM o ARCA_CERT_PATH", c.CertPEM, c.CertPath)
	if err != nil {
		return nil, err
	}
	key, err := leerPEM("ARCA_KEY_PEM o ARCA_KEY_PATH", c.KeyPEM, c.KeyPath)
	if err != nil {
		return nil, err
	}
	cfg := arca.Config{
		Entorno:         c.Entorno,
		CuitCertificado: c.CuitCertificado,
		CertPEM:         cert,
		KeyPEM:          key,
		CacheDir:        c.CacheDir,
	}
	if compartido != nil {
		cfg.Almacen = compartido
		cfg.Candado = compartido
	}
	tickets := arca.NuevaCacheTickets(cfg)
	cl := &ClientesArca{Cfg: cfg, Tickets: tickets, CuitEmisor: c.CuitEmisor, PuntoVenta: c.PuntoVenta}
	if c.CuitEmisor != "" {
		cl.Wsfe = arca.NuevoWsfe(cfg, tickets, c.CuitEmisor)
	}
	return cl, nil
}

func requerida(nombre, valor string) error {
	if valor == "" {
		return &ConfiguracionError{Mensaje: fmt.Sprintf("Falta la variable %s (ver .env.example)", nombre)}
	}
	return nil
}

func leerPEM(nombre, contenido, ruta string) ([]byte, error) {
	if contenido != "" {
		return decodificarPEM(nombre, contenido)
	}
	if err := requerida(nombre, ruta); err != nil {
		return nil, err
	}
	b, err := os.ReadFile(ruta)
	if err != nil {
		return nil, &ConfiguracionError{Mensaje: fmt.Sprintf(
			"No se pudo leer %s=%s. ¿Generaste el certificado de homologación? (ver README)", nombre, ruta)}
	}
	return b, nil
}

// decodificarPEM acepta el PEM tal cual (con saltos de línea reales o escritos como \n) o en base64,
// que es más cómodo para pegar en las variables de entorno de Vercel.
func decodificarPEM(nombre, v string) ([]byte, error) {
	v = strings.TrimSpace(v)
	if strings.HasPrefix(v, "-----BEGIN") {
		return []byte(strings.ReplaceAll(v, `\n`, "\n")), nil
	}
	b, err := base64.StdEncoding.DecodeString(strings.Join(strings.Fields(v), ""))
	if err != nil || !strings.HasPrefix(strings.TrimSpace(string(b)), "-----BEGIN") {
		return nil, &ConfiguracionError{Mensaje: fmt.Sprintf("%s no tiene un PEM válido (pegalo tal cual o en base64)", nombre)}
	}
	return b, nil
}
