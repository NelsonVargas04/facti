package miscomprobantes

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"io"
	"strconv"
	"strings"
)

// leerXLSX lee la primera hoja de un Excel (.xlsx) sin dependencias: es un zip con XML.
func leerXLSX(b []byte) ([][]string, error) {
	z, err := zip.NewReader(bytes.NewReader(b), int64(len(b)))
	if err != nil {
		return nil, ErrFormato
	}
	leer := func(nombre string) ([]byte, bool) {
		for _, f := range z.File {
			if f.Name == nombre {
				rc, err := f.Open()
				if err != nil {
					return nil, false
				}
				defer rc.Close()
				d, err := io.ReadAll(io.LimitReader(rc, 50<<20))
				return d, err == nil
			}
		}
		return nil, false
	}

	var compartidos []string
	if d, ok := leer("xl/sharedStrings.xml"); ok {
		var sst struct {
			SI []struct {
				T string `xml:"t"`
				R []struct {
					T string `xml:"t"`
				} `xml:"r"`
			} `xml:"si"`
		}
		if err := xml.Unmarshal(d, &sst); err != nil {
			return nil, ErrFormato
		}
		for _, si := range sst.SI {
			t := si.T
			for _, r := range si.R {
				t += r.T
			}
			compartidos = append(compartidos, t)
		}
	}

	hoja, ok := leer("xl/worksheets/sheet1.xml")
	if !ok {
		for _, f := range z.File {
			if strings.HasPrefix(f.Name, "xl/worksheets/sheet") {
				hoja, ok = leer(f.Name)
				break
			}
		}
	}
	if !ok {
		return nil, ErrFormato
	}
	var ws struct {
		Filas []struct {
			Celdas []struct {
				Ref    string `xml:"r,attr"`
				Tipo   string `xml:"t,attr"`
				Valor  string `xml:"v"`
				Inline string `xml:"is>t"`
			} `xml:"c"`
		} `xml:"sheetData>row"`
	}
	if err := xml.Unmarshal(hoja, &ws); err != nil {
		return nil, ErrFormato
	}
	var filas [][]string
	for _, f := range ws.Filas {
		var fila []string
		for i, c := range f.Celdas {
			col := columnaDe(c.Ref)
			if col < 0 {
				col = i
			}
			for len(fila) <= col {
				fila = append(fila, "")
			}
			v := c.Valor
			switch c.Tipo {
			case "s":
				if n, err := strconv.Atoi(v); err == nil && n >= 0 && n < len(compartidos) {
					v = compartidos[n]
				}
			case "inlineStr":
				v = c.Inline
			}
			fila[col] = v
		}
		filas = append(filas, fila)
	}
	return filas, nil
}

// columnaDe convierte "C12" en 2.
func columnaDe(ref string) int {
	n := 0
	for _, r := range ref {
		if r < 'A' || r > 'Z' {
			break
		}
		n = n*26 + int(r-'A'+1)
	}
	return n - 1
}
