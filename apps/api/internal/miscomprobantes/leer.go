// Package miscomprobantes lee el archivo que se baja de "Mis Comprobantes – Emitidos" en la web de
// ARCA (CSV o Excel). ARCA no tiene web service para esa consulta, así que el usuario baja el archivo
// y lo sube a Facti.
//
// El formato cambió varias veces (Excel con una fila de título, CSV con ";" o ","), así que se
// buscan las columnas por nombre y no por posición.
package miscomprobantes

import (
	"bytes"
	"encoding/csv"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"facti/api/internal/arca"
	"facti/api/internal/datos"
)

// ErrFormato indica que el archivo no parece de Mis Comprobantes.
var ErrFormato = errors.New("El archivo no parece de \"Mis Comprobantes – Emitidos\" de ARCA. Bajalo de nuevo en CSV o Excel y subilo sin modificarlo.")

// ErrRecibidos indica que subió el de comprobantes recibidos (de proveedores) en vez de emitidos.
var ErrRecibidos = errors.New("Ese archivo es de comprobantes recibidos (tus compras). Para tus topes necesitamos el de \"Emitidos\".")

// ErrVacio indica que el archivo no tiene comprobantes.
var ErrVacio = errors.New("El archivo no tiene comprobantes. Revisá las fechas que elegiste en Mis Comprobantes.")

// ErrorFila es un problema en una fila puntual (las demás se importan igual).
type ErrorFila struct {
	Fila    int    `json:"fila"`
	Mensaje string `json:"mensaje"`
}

// Resultado de leer el archivo.
type Resultado struct {
	Comprobantes []datos.Externo
	Errores      []ErrorFila
}

// Leer interpreta el archivo (CSV o XLSX, se detecta por el contenido).
func Leer(b []byte) (Resultado, error) {
	var filas [][]string
	var err error
	if bytes.HasPrefix(b, []byte("PK")) {
		filas, err = leerXLSX(b)
	} else {
		filas, err = leerCSV(b)
	}
	if err != nil {
		return Resultado{}, err
	}
	return interpretar(filas)
}

func leerCSV(b []byte) ([][]string, error) {
	b = bytes.TrimPrefix(b, []byte("\xef\xbb\xbf"))
	if !utf8.Valid(b) { // Windows-1252 / Latin-1: cada byte es una letra
		r := make([]rune, len(b))
		for i, c := range b {
			r[i] = rune(c)
		}
		b = []byte(string(r))
	}
	// El separador se decide con la línea de encabezados (puede haber una línea de título antes).
	sep := ','
	for _, linea := range bytes.SplitN(b, []byte("\n"), 6) {
		if n, m := bytes.Count(linea, []byte(";")), bytes.Count(linea, []byte(",")); n > 2 || m > 2 {
			if n > m {
				sep = ';'
			}
			break
		}
	}
	r := csv.NewReader(bytes.NewReader(b))
	r.Comma = sep
	r.FieldsPerRecord = -1
	r.LazyQuotes = true
	filas, err := r.ReadAll()
	if err != nil {
		return nil, ErrFormato
	}
	return filas, nil
}

var sinAcento = strings.NewReplacer("á", "a", "é", "e", "í", "i", "ó", "o", "ú", "u", "ü", "u", "ñ", "n")

// clave normaliza un encabezado: minúsculas, sin acentos ni puntuación.
func clave(s string) string {
	s = sinAcento.Replace(strings.ToLower(strings.TrimSpace(s)))
	var b strings.Builder
	espacio := false
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
			espacio = false
		} else if !espacio && b.Len() > 0 {
			b.WriteByte(' ')
			espacio = true
		}
	}
	return strings.TrimSpace(b.String())
}

// Nombres posibles de cada columna (ya normalizados con clave).
var columnas = map[string][]string{
	"fecha":   {"fecha de emision", "fecha"},
	"tipo":    {"tipo de comprobante", "tipo"},
	"pv":      {"punto de venta"},
	"desde":   {"numero desde", "nro desde", "numero"},
	"hasta":   {"numero hasta", "nro hasta"},
	"cae":     {"cod autorizacion", "codigo de autorizacion", "cae"},
	"doctipo": {"tipo doc receptor", "tipo doc emisor receptor", "tipo documento receptor"},
	"docnro":  {"nro doc receptor", "nro doc emisor receptor", "numero documento receptor"},
	"nombre":  {"denominacion receptor", "denominacion emisor receptor"},
	"cambio":  {"tipo cambio", "tipo de cambio"},
	"moneda":  {"moneda"},
	"total":   {"imp total", "importe total", "total"},
	"emisor":  {"nro doc emisor", "denominacion emisor"},
}

func interpretar(filas [][]string) (Resultado, error) {
	// La fila de encabezados es la primera (de las 10 primeras) con "punto de venta" y un total.
	cab := -1
	idx := map[string]int{}
	for i, f := range filas {
		if i > 10 {
			break
		}
		claves := make([]string, len(f))
		for j, c := range f {
			claves[j] = clave(c)
		}
		buscar := func(alias []string) int {
			for _, a := range alias {
				for j, c := range claves {
					if c == a {
						return j
					}
				}
			}
			return -1
		}
		if buscar(columnas["pv"]) < 0 || buscar(columnas["total"]) < 0 {
			continue
		}
		if buscar(columnas["emisor"]) >= 0 && buscar(columnas["nombre"]) < 0 {
			return Resultado{}, ErrRecibidos
		}
		cab = i
		for k, alias := range columnas {
			idx[k] = buscar(alias)
		}
		break
	}
	if cab < 0 {
		return Resultado{}, ErrFormato
	}
	for _, k := range []string{"fecha", "tipo", "pv", "desde", "total"} {
		if idx[k] < 0 {
			return Resultado{}, ErrFormato
		}
	}

	var res Resultado
	for i := cab + 1; i < len(filas); i++ {
		f := filas[i]
		celda := func(k string) string {
			if j := idx[k]; j >= 0 && j < len(f) {
				return strings.TrimSpace(f[j])
			}
			return ""
		}
		if strings.TrimSpace(strings.Join(f, "")) == "" || celda("fecha") == "" {
			continue // filas vacías o de totales
		}
		e, err := fila(celda)
		if err != nil {
			res.Errores = append(res.Errores, ErrorFila{Fila: i + 1, Mensaje: err.Error()})
			continue
		}
		res.Comprobantes = append(res.Comprobantes, e)
	}
	if len(res.Comprobantes) == 0 && len(res.Errores) == 0 {
		return res, ErrVacio
	}
	return res, nil
}

func fila(celda func(string) string) (datos.Externo, error) {
	var e datos.Externo
	fecha, err := leerFecha(celda("fecha"))
	if err != nil {
		return e, err
	}
	e.Fecha = fecha
	// "11 - Factura C" o "11"
	tipoTxt, _, _ := strings.Cut(celda("tipo"), "-")
	if e.Tipo, err = strconv.Atoi(entero(tipoTxt)); err != nil || e.Tipo <= 0 {
		return e, fmt.Errorf("Tipo de comprobante inválido: %q", celda("tipo"))
	}
	if e.PuntoVenta, err = strconv.Atoi(entero(celda("pv"))); err != nil {
		return e, fmt.Errorf("Punto de venta inválido: %q", celda("pv"))
	}
	if e.Numero, err = strconv.ParseInt(entero(celda("desde")), 10, 64); err != nil {
		return e, fmt.Errorf("Número inválido: %q", celda("desde"))
	}
	e.NumeroHasta = e.Numero
	if h, err := strconv.ParseInt(entero(celda("hasta")), 10, 64); err == nil && h >= e.Numero {
		e.NumeroHasta = h
	}
	e.CodAutorizacion = entero(celda("cae"))
	e.DocTipo, _ = strconv.Atoi(entero(celda("doctipo")))
	e.DocNro = entero(celda("docnro"))
	e.Receptor = celda("nombre")
	if e.Total, err = importe(celda("total")); err != nil {
		return e, fmt.Errorf("Importe total inválido: %q", celda("total"))
	}
	if e.Total < 0 {
		e.Total = -e.Total
	}
	e.Moneda = moneda(celda("moneda"))
	e.Cotizacion = 1
	if e.Moneda != "PES" {
		c, err := importe(celda("cambio"))
		if err != nil || c <= 0 {
			return e, fmt.Errorf("Falta el tipo de cambio del comprobante %d-%d en %s", e.PuntoVenta, e.Numero, e.Moneda)
		}
		e.Cotizacion = c
	}
	e.Pesos = redondear(e.Total * e.Cotizacion)
	if arca.EsNotaCredito(e.Tipo) || e.Tipo == 21 { // 21: nota de crédito E
		e.Pesos = -e.Pesos
	}
	return e, nil
}

// entero limpia un número que Excel pudo dejar como "3.0" o "2.0E10".
func entero(s string) string {
	s = strings.TrimSpace(s)
	if strings.ContainsAny(s, "eE") {
		if f, err := strconv.ParseFloat(s, 64); err == nil {
			return strconv.FormatFloat(f, 'f', 0, 64)
		}
	}
	if i := strings.IndexAny(s, ".,"); i >= 0 && strings.Trim(s[i+1:], "0") == "" {
		s = s[:i]
	}
	return s
}

func leerFecha(s string) (string, error) {
	for _, f := range []string{"2006-01-02", "02/01/2006", "2/1/2006", "2006-01-02T15:04:05", "02-01-2006", "2006-01-02 15:04:05"} {
		if t, err := time.Parse(f, s); err == nil {
			return t.Format("2006-01-02"), nil
		}
	}
	// Excel guarda las fechas como días desde el 30/12/1899.
	if n, err := strconv.ParseFloat(s, 64); err == nil && n > 20000 && n < 80000 {
		return time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC).AddDate(0, 0, int(n)).Format("2006-01-02"), nil
	}
	return "", fmt.Errorf("Fecha inválida: %q", s)
}

// importe acepta "12500,50", "12.500,50", "12500.50" y "12,500.50".
func importe(s string) (float64, error) {
	s = strings.NewReplacer("$", "", " ", "", " ", "").Replace(strings.TrimSpace(s))
	if s == "" {
		return 0, nil
	}
	if strings.ContainsAny(s, "eE") {
		return strconv.ParseFloat(s, 64)
	}
	coma, punto := strings.LastIndex(s, ","), strings.LastIndex(s, ".")
	switch {
	case coma >= 0 && punto >= 0 && coma > punto: // 12.500,50
		s = strings.ReplaceAll(s, ".", "")
		s = strings.Replace(s, ",", ".", 1)
	case coma >= 0 && punto >= 0: // 12,500.50
		s = strings.ReplaceAll(s, ",", "")
	case coma >= 0: // 12500,50
		s = strings.Replace(s, ",", ".", 1)
	case strings.Count(s, ".") > 1 || (punto >= 0 && len(s)-punto == 4): // 12.500.000 o 1.000 (los importes tienen 2 decimales)
		s = strings.ReplaceAll(s, ".", "")
	}
	return strconv.ParseFloat(s, 64)
}

func moneda(s string) string {
	s = strings.ToUpper(strings.TrimSpace(s))
	switch s {
	case "", "$", "PES", "ARS", "PESOS":
		return "PES"
	case "USD", "U$S", "US$", "DOL", "DOLAR", "DÓLAR":
		return "DOL"
	case "EUR", "€":
		return "060"
	}
	return s
}

func redondear(v float64) float64 {
	if v < 0 {
		return -redondear(-v)
	}
	return float64(int64(v*100+0.5)) / 100
}
