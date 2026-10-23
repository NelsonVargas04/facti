package arca

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/url"
)

// URLQR es la base del código QR según la especificación de ARCA:
// https://www.afip.gob.ar/fe/qr/documentos/QRespecificaciones.pdf
const URLQR = "https://www.arca.gob.ar/fe/qr/"

// DatosQR del comprobante. El orden de los campos es el del JSON que se codifica.
type DatosQR struct {
	Ver        int     `json:"ver"`
	Fecha      string  `json:"fecha"` // AAAA-MM-DD
	Cuit       int64   `json:"cuit"`
	PtoVta     int     `json:"ptoVta"`
	TipoCmp    int     `json:"tipoCmp"`
	NroCmp     int64   `json:"nroCmp"`
	Importe    float64 `json:"importe"`
	Moneda     string  `json:"moneda"`
	Ctz        float64 `json:"ctz"`
	TipoDocRec *int    `json:"tipoDocRec,omitempty"`
	NroDocRec  *int64  `json:"nroDocRec,omitempty"`
	TipoCodAut string  `json:"tipoCodAut"` // "E" = CAE, "A" = CAEA
	CodAut     int64   `json:"codAut"`
}

// URLDelQR arma la URL oficial con el JSON en Base64. Si Ver es cero, usa la versión 1.
func URLDelQR(d DatosQR) string {
	if d.Ver == 0 {
		d.Ver = 1
	}
	j, _ := json.Marshal(d)
	return URLQR + "?p=" + base64.StdEncoding.EncodeToString(j)
}

// LeerURLQR decodifica los datos de una URL de QR.
func LeerURLQR(u string) (DatosQR, error) {
	var d DatosQR
	pu, err := url.Parse(u)
	if err != nil {
		return d, err
	}
	p := pu.Query().Get("p")
	if p == "" {
		return d, errors.New("la URL no tiene el parámetro p")
	}
	j, err := base64.StdEncoding.DecodeString(p)
	if err != nil {
		return d, err
	}
	err = json.Unmarshal(j, &d)
	return d, err
}
