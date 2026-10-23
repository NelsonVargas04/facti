package arca

import (
	"bytes"
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// xmlUnmarshal es xml.Unmarshal aceptando también respuestas en ISO-8859-1.
func xmlUnmarshal(b []byte, v any) error {
	d := xml.NewDecoder(bytes.NewReader(b))
	d.CharsetReader = func(charset string, r io.Reader) (io.Reader, error) {
		switch strings.ToLower(charset) {
		case "iso-8859-1", "latin1", "windows-1252":
			crudo, err := io.ReadAll(r)
			if err != nil {
				return nil, err
			}
			runas := make([]rune, len(crudo))
			for i, c := range crudo {
				runas[i] = rune(c)
			}
			return strings.NewReader(string(runas)), nil
		}
		return nil, fmt.Errorf("codificación no soportada: %s", charset)
	}
	return d.Decode(v)
}

// esc escapa texto para insertarlo dentro de XML.
func esc(valor string) string {
	var b strings.Builder
	_ = xml.EscapeText(&b, []byte(valor))
	return b.String()
}

type envelope struct {
	Body struct {
		Fault *struct {
			Code   string `xml:"faultcode"`
			String string `xml:"faultstring"`
		} `xml:"Fault"`
		Interior []byte `xml:",innerxml"`
	} `xml:"Body"`
}

type pedidoSoap struct {
	url      string
	accion   string
	cuerpo   string
	servicio string
}

// llamarSoap envía el sobre SOAP y devuelve el XML que viene dentro del Body.
func llamarSoap(ctx context.Context, cfg Config, p pedidoSoap) ([]byte, error) {
	sobre := `<?xml version="1.0" encoding="UTF-8"?>` +
		`<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">` +
		`<soapenv:Header/><soapenv:Body>` + p.cuerpo + `</soapenv:Body></soapenv:Envelope>`

	ctx, cancelar := context.WithTimeout(ctx, cfg.timeout())
	defer cancelar()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.url, strings.NewReader(sobre))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "text/xml; charset=utf-8")
	req.Header.Set("SOAPAction", `"`+p.accion+`"`)

	resp, err := cfg.cliente().Do(req)
	if err != nil {
		return nil, &SinRespuestaError{Mensaje: "Sin respuesta de " + p.servicio, Causa: err}
	}
	defer resp.Body.Close()
	texto, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, &SinRespuestaError{Mensaje: "Respuesta cortada de " + p.servicio, Causa: err}
	}

	var env envelope
	if err := xmlUnmarshal(texto, &env); err != nil {
		return nil, &Error{
			Mensaje:  fmt.Sprintf("Respuesta inválida de %s (HTTP %d)", p.servicio, resp.StatusCode),
			Servicio: p.servicio,
		}
	}
	if f := env.Body.Fault; f != nil {
		msg := f.String
		if msg == "" {
			msg = "Error SOAP"
		}
		return nil, &Error{
			Mensaje:  msg,
			Detalles: []Detalle{{Codigo: f.Code, Mensaje: f.String}},
			Servicio: p.servicio,
		}
	}
	interior := bytes.TrimSpace(env.Body.Interior)
	if resp.StatusCode >= 300 || len(interior) == 0 {
		return nil, &Error{
			Mensaje:  fmt.Sprintf("HTTP %d en %s", resp.StatusCode, p.servicio),
			Servicio: p.servicio,
		}
	}
	return interior, nil
}
