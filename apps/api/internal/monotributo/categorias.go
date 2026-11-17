// Package monotributo trae la tabla oficial de categorías del monotributo (topes y cuotas).
//
// ARCA no tiene una API para esto: publica la tabla en https://www.arca.gob.ar/monotributo/categorias.asp.
// Facti la lee de ahí (como mucho una vez cada 12 horas por instancia), la valida y, si ARCA no responde o
// cambió la página, usa la última tabla conocida que viene en el código (Respaldo), con su fuente y vigencia.
package monotributo

import (
	"context"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// URL oficial de la tabla.
const URL = "https://www.arca.gob.ar/monotributo/categorias.asp"

// Letras, de menor a mayor.
var Letras = []string{"A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"}

// Categoria de monotributo: los mismos datos que el cuadro oficial de ARCA.
type Categoria struct {
	Letra          string  `json:"letra"`
	Tope           float64 `json:"tope"`           // ingresos brutos anuales
	CuotaServicios float64 `json:"cuotaServicios"` // total mensual, locaciones y prestaciones de servicios
	CuotaVentas    float64 `json:"cuotaVentas"`    // total mensual, venta de cosas muebles
	Superficie     string  `json:"superficie"`     // "Hasta 30 m²"
	Energia        string  `json:"energia"`        // "Hasta 3330 kWh"
	Alquileres     float64 `json:"alquileres"`     // devengados anualmente
	PrecioMaximo   float64 `json:"precioMaximo"`   // unitario, venta de cosas muebles
	ImpServicios   float64 `json:"impServicios"`   // impuesto integrado, servicios
	ImpVentas      float64 `json:"impVentas"`      // impuesto integrado, venta de cosas muebles
	SIPA           float64 `json:"sipa"`
	ObraSocial     float64 `json:"obraSocial"`
}

// Escala es la tabla vigente.
type Escala struct {
	VigenteDesde string      `json:"vigenteDesde"` // AAAA-MM-DD
	Fuente       string      `json:"fuente"`
	Origen       string      `json:"origen"` // "arca" (leída ahora) o "respaldo" (la que viene en el código)
	ConsultadaEn time.Time   `json:"consultadaEn"`
	Categorias   []Categoria `json:"categorias"`
}

// Respaldo: tabla oficial con valores desde el 01/08/2026 (verificada contra arca.gob.ar el 17/11/2026).
var Respaldo = Escala{
	VigenteDesde: "2026-08-01",
	Fuente:       URL,
	Origen:       "respaldo",
	Categorias: []Categoria{
		{Letra: "A", Tope: 12009410.45, CuotaServicios: 49527.18, CuotaVentas: 49527.18, Superficie: "Hasta 30 m²", Energia: "Hasta 3330 kWh", Alquileres: 2792886.15, PrecioMaximo: 716840.77, ImpServicios: 5585.77, ImpVentas: 5585.77, SIPA: 18246.86, ObraSocial: 25694.55},
		{Letra: "B", Tope: 17595182.74, CuotaServicios: 56379.08, CuotaVentas: 56379.08, Superficie: "Hasta 45 m²", Energia: "Hasta 5000 kWh", Alquileres: 2792886.15, PrecioMaximo: 716840.77, ImpServicios: 10612.98, ImpVentas: 10612.98, SIPA: 20071.55, ObraSocial: 25694.55},
		{Letra: "C", Tope: 24670494.31, CuotaServicios: 66020.12, CuotaVentas: 64530.58, Superficie: "Hasta 60 m²", Energia: "Hasta 6700 kWh", Alquileres: 3816944.41, PrecioMaximo: 716840.77, ImpServicios: 18246.86, ImpVentas: 16757.32, SIPA: 22078.71, ObraSocial: 25694.55},
		{Letra: "D", Tope: 30628651.43, CuotaServicios: 84612.93, CuotaVentas: 82564.81, Superficie: "Hasta 85 m²", Energia: "Hasta 10000 kWh", Alquileres: 3816944.41, PrecioMaximo: 716840.77, ImpServicios: 29790.79, ImpVentas: 27742.67, SIPA: 24286.58, ObraSocial: 30535.56},
		{Letra: "E", Tope: 36028231.33, CuotaServicios: 119811.45, CuotaVentas: 108267.51, Superficie: "Hasta 110 m²", Energia: "Hasta 13000 kWh", Alquileres: 4841002.66, PrecioMaximo: 716840.77, ImpServicios: 55857.73, ImpVentas: 44313.79, SIPA: 26715.24, ObraSocial: 37238.48},
		{Letra: "F", Tope: 45151659.41, CuotaServicios: 150784.21, CuotaVentas: 129930.65, Superficie: "Hasta 150 m²", Energia: "Hasta 16500 kWh", Alquileres: 4841002.66, PrecioMaximo: 716840.77, ImpServicios: 78573.20, ImpVentas: 57719.64, SIPA: 29386.76, ObraSocial: 42824.25},
		{Letra: "G", Tope: 53995798.87, CuotaServicios: 230312.94, CuotaVentas: 158815.05, Superficie: "Hasta 200 m²", Energia: "Hasta 20000 kWh", Alquileres: 5771964.69, PrecioMaximo: 716840.77, ImpServicios: 142995.76, ImpVentas: 71497.87, SIPA: 41141.46, ObraSocial: 46175.72},
		{Letra: "H", Tope: 81924660.37, CuotaServicios: 522706.68, CuotaVentas: 317895.01, Superficie: "Hasta 200 m²", Energia: "Hasta 20000 kWh", Alquileres: 8378658.45, PrecioMaximo: 716840.77, ImpServicios: 409623.31, ImpVentas: 204811.64, SIPA: 57598.04, ObraSocial: 55485.33},
		{Letra: "I", Tope: 91699761.90, CuotaServicios: 963747.86, CuotaVentas: 474992.78, Superficie: "Hasta 200 m²", Energia: "Hasta 20000 kWh", Alquileres: 8378658.45, PrecioMaximo: 716840.77, ImpServicios: 814591.79, ImpVentas: 325836.71, SIPA: 80637.26, ObraSocial: 68518.81},
		{Letra: "J", Tope: 105012519.20, CuotaServicios: 1167299.76, CuotaVentas: 580793.69, Superficie: "Hasta 200 m²", Energia: "Hasta 20000 kWh", Alquileres: 8378658.45, PrecioMaximo: 716840.77, ImpServicios: 977510.14, ImpVentas: 391004.07, SIPA: 112892.16, ObraSocial: 76897.46},
		{Letra: "K", Tope: 126610838.75, CuotaServicios: 1614446.04, CuotaVentas: 702103.24, Superficie: "Hasta 200 m²", Energia: "Hasta 20000 kWh", Alquileres: 8378658.45, PrecioMaximo: 716840.77, ImpServicios: 1368514.20, ImpVentas: 456171.40, SIPA: 158049.02, ObraSocial: 87882.82},
	},
}

var (
	reVigencia = regexp.MustCompile(`Valores de aplicaci(?:ó|&oacute;)n desde el (\d{1,2})/(\d{1,2})/(\d{4})`)
	reCelda    = regexp.MustCompile(`<td[^>]*headers="th_([A-K])_t\d+ ([^"]+)"[^>]*>([^<]*)</td>`)
	reMonto    = regexp.MustCompile(`([\d.]+,\d{2})`)
)

// monto convierte "$12.009.410,45" en 12009410.45.
func monto(s string) (float64, error) {
	return strconv.ParseFloat(strings.ReplaceAll(strings.ReplaceAll(s, ".", ""), ",", "."), 64)
}

// Parsear lee la tabla del HTML de ARCA y la valida (11 categorías con topes crecientes).
func Parsear(pagina []byte) (Escala, error) {
	texto := string(pagina)
	e := Escala{Fuente: URL, Origen: "arca"}
	m := reVigencia.FindStringSubmatch(texto)
	if m == nil {
		return e, errors.New("no encontré la fecha de vigencia")
	}
	d, _ := strconv.Atoi(m[1])
	mes, _ := strconv.Atoi(m[2])
	e.VigenteDesde = fmt.Sprintf("%s-%02d-%02d", m[3], mes, d)

	cats := map[string]*Categoria{}
	for _, c := range reCelda.FindAllStringSubmatch(texto, -1) {
		letra, columna := c[1], c[2]
		crudo := strings.TrimSpace(html.UnescapeString(c[3]))
		cat := cats[letra]
		if cat == nil {
			cat = &Categoria{Letra: letra}
			cats[letra] = cat
		}
		// Columnas de texto.
		switch {
		case strings.Contains(columna, "th_sup_af_"):
			cat.Superficie = crudo
			continue
		case strings.Contains(columna, "th_energ_"):
			cat.Energia = crudo
			continue
		}
		mm := reMonto.FindString(crudo)
		if mm == "" {
			continue
		}
		v, err := monto(mm)
		if err != nil {
			continue
		}
		switch {
		case strings.Contains(columna, "th_ing_br_"):
			cat.Tope = v
		case strings.Contains(columna, "th_total_loc_"):
			cat.CuotaServicios = v
		case strings.Contains(columna, "th_total_ven_"):
			cat.CuotaVentas = v
		case strings.Contains(columna, "th_alq_"):
			cat.Alquileres = v
		case strings.Contains(columna, "th_venta_cosas_muebles_"):
			cat.PrecioMaximo = v
		case strings.Contains(columna, "th_imp_int_loc_"):
			cat.ImpServicios = v
		case strings.Contains(columna, "th_imp_int_ven_"):
			cat.ImpVentas = v
		case strings.Contains(columna, "th_ap_sipa_"):
			cat.SIPA = v
		case strings.Contains(columna, "th_ap_obra_soc_"):
			cat.ObraSocial = v
		}
	}
	anterior := 0.0
	for _, l := range Letras {
		c := cats[l]
		if c == nil || c.Tope <= anterior {
			return e, fmt.Errorf("la categoría %s falta o su tope no es mayor que la anterior", l)
		}
		anterior = c.Tope
		e.Categorias = append(e.Categorias, *c)
	}
	return e, nil
}

// Fuente trae la escala de ARCA con caché; si falla, devuelve la última buena o el Respaldo.
type Fuente struct {
	Cliente  *http.Client
	URL      string
	Duracion time.Duration
	Ahora    func() time.Time

	mu      sync.Mutex
	ultima  *Escala
	vence   time.Time
	errores int
}

// NuevaFuente con valores por defecto (12 horas de caché, 8 segundos para responder).
func NuevaFuente() *Fuente {
	return &Fuente{Cliente: &http.Client{Timeout: 8 * time.Second}, URL: URL, Duracion: 12 * time.Hour, Ahora: time.Now}
}

// Escala vigente. Nunca falla: si ARCA no responde, usa la última buena o el Respaldo.
func (f *Fuente) Escala(ctx context.Context) Escala {
	f.mu.Lock()
	defer f.mu.Unlock()
	ahora := f.Ahora()
	if f.ultima != nil && ahora.Before(f.vence) {
		return *f.ultima
	}
	e, err := f.traer(ctx)
	if err != nil {
		f.errores++
		// Reintenta en 30 minutos, no en cada pedido.
		f.vence = ahora.Add(30 * time.Minute)
		if f.ultima != nil {
			return *f.ultima
		}
		r := Respaldo
		r.ConsultadaEn = ahora
		f.ultima = &r
		return r
	}
	e.ConsultadaEn = ahora
	f.ultima = &e
	f.vence = ahora.Add(f.Duracion)
	return e
}

func (f *Fuente) traer(ctx context.Context) (Escala, error) {
	pedido, err := http.NewRequestWithContext(ctx, http.MethodGet, f.URL, nil)
	if err != nil {
		return Escala{}, err
	}
	pedido.Header.Set("User-Agent", "Facti/1.0 (consulta de la tabla publica de monotributo)")
	r, err := f.Cliente.Do(pedido)
	if err != nil {
		return Escala{}, err
	}
	defer r.Body.Close()
	if r.StatusCode != http.StatusOK {
		return Escala{}, fmt.Errorf("ARCA respondió %d", r.StatusCode)
	}
	cuerpo, err := io.ReadAll(io.LimitReader(r.Body, 2<<20))
	if err != nil {
		return Escala{}, err
	}
	return Parsear(cuerpo)
}
