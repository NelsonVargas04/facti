package arca

import (
	"context"
	"strings"
)

const nsPadron = "http://a5.soap.ws.server.puc.sr/"

// DatosPadron de un contribuyente, resumidos para la app.
type DatosPadron struct {
	Cuit                 string          `json:"cuit"`
	Nombre               string          `json:"nombre"`
	TipoPersona          string          `json:"tipoPersona"` // FISICA o JURIDICA
	Condicion            CondicionFiscal `json:"condicion"`
	CategoriaMonotributo string          `json:"categoriaMonotributo,omitempty"`
	Domicilio            string          `json:"domicilio,omitempty"`
	Actividades          []string        `json:"actividades"`
}

type actividadXML struct {
	Descripcion string `xml:"descripcionActividad"`
}

// Persona tal como la devuelve getPersona_v2 (solo los campos que usa Facti).
type Persona struct {
	DatosGenerales *struct {
		Apellido        string `xml:"apellido"`
		Nombre          string `xml:"nombre"`
		RazonSocial     string `xml:"razonSocial"`
		TipoPersona     string `xml:"tipoPersona"`
		DomicilioFiscal *struct {
			Direccion string `xml:"direccion"`
			Localidad string `xml:"localidad"`
			Provincia string `xml:"descripcionProvincia"`
		} `xml:"domicilioFiscal"`
	} `xml:"datosGenerales"`
	DatosMonotributo *struct {
		Categoria *struct {
			Descripcion string `xml:"descripcionCategoria"`
		} `xml:"categoriaMonotributo"`
		Actividades []actividadXML `xml:"actividadMonotributista"`
	} `xml:"datosMonotributo"`
	DatosRegimenGeneral *struct {
		Impuestos []struct {
			ID int `xml:"idImpuesto"`
		} `xml:"impuesto"`
		Actividades []actividadXML `xml:"actividad"`
	} `xml:"datosRegimenGeneral"`
	ErrorConstancia *struct {
		Errores []string `xml:"error"`
	} `xml:"errorConstancia"`
}

// ConsultarPadron consulta la constancia de inscripción (padrón A5) con el certificado de Facti:
// el servicio ws_sr_constancia_inscripcion debe estar autorizado para ese certificado.
//
// IMPORTANTE: la deducción de la condición fiscal a partir de los impuestos
// (IVA = 30, IVA exento = 32) debe validarse en homologación.
func ConsultarPadron(ctx context.Context, cfg Config, tickets *CacheTickets, cuit string) (DatosPadron, error) {
	ta, err := tickets.Obtener(ctx, ServicioPadron)
	if err != nil {
		return DatosPadron{}, err
	}
	interior, err := llamarSoap(ctx, cfg, pedidoSoap{
		url:      cfg.endpoints().Padron,
		servicio: "Padron A5",
		cuerpo: `<a5:getPersona_v2 xmlns:a5="` + nsPadron + `">` +
			"<token>" + ta.Token + "</token><sign>" + ta.Sign + "</sign>" +
			"<cuitRepresentada>" + esc(cfg.CuitCertificado) + "</cuitRepresentada>" +
			"<idPersona>" + esc(cuit) + "</idPersona></a5:getPersona_v2>",
	})
	if err != nil {
		return DatosPadron{}, err
	}
	var resp struct {
		Persona *Persona `xml:"personaReturn"`
	}
	if err := xmlUnmarshal(interior, &resp); err != nil || resp.Persona == nil {
		return DatosPadron{}, &Error{Mensaje: "El padrón no devolvió datos", Servicio: "Padron A5"}
	}
	p := resp.Persona
	if p.ErrorConstancia != nil && p.DatosGenerales == nil {
		detalles := make([]Detalle, len(p.ErrorConstancia.Errores))
		for i, m := range p.ErrorConstancia.Errores {
			detalles[i] = Detalle{Codigo: "padron", Mensaje: strings.TrimSpace(m)}
		}
		return DatosPadron{}, &Error{
			Mensaje:  "Padrón: " + strings.Join(p.ErrorConstancia.Errores, " | "),
			Detalles: detalles,
			Servicio: "Padron A5",
		}
	}
	return InterpretarPersona(cuit, p), nil
}

// InterpretarPersona deduce nombre, domicilio y condición fiscal de la respuesta del padrón.
func InterpretarPersona(cuit string, p *Persona) DatosPadron {
	d := DatosPadron{Cuit: cuit, Condicion: ConsumidorFinal, Actividades: []string{}}
	if g := p.DatosGenerales; g != nil {
		if g.RazonSocial != "" {
			d.Nombre = strings.TrimSpace(g.RazonSocial)
		} else {
			d.Nombre = unir(" ", g.Apellido, g.Nombre)
		}
		d.TipoPersona = strings.TrimSpace(g.TipoPersona)
		if f := g.DomicilioFiscal; f != nil {
			d.Domicilio = unir(", ", f.Direccion, f.Localidad, f.Provincia)
		}
	}

	var actividades []actividadXML
	if m := p.DatosMonotributo; m != nil {
		d.Condicion = Monotributo
		if m.Categoria != nil {
			d.CategoriaMonotributo = strings.TrimSpace(m.Categoria.Descripcion)
		}
		actividades = append(actividades, m.Actividades...)
	}
	if rg := p.DatosRegimenGeneral; rg != nil {
		if d.Condicion != Monotributo {
			for _, imp := range rg.Impuestos {
				if imp.ID == 30 {
					d.Condicion = ResponsableInscripto
					break
				}
				if imp.ID == 32 {
					d.Condicion = Exento
				}
			}
		}
		actividades = append(actividades, rg.Actividades...)
	}
	for _, a := range actividades {
		if s := strings.TrimSpace(a.Descripcion); s != "" {
			d.Actividades = append(d.Actividades, s)
		}
	}
	return d
}

func unir(sep string, partes ...string) string {
	var out []string
	for _, p := range partes {
		if s := strings.TrimSpace(p); s != "" {
			out = append(out, s)
		}
	}
	return strings.Join(out, sep)
}
