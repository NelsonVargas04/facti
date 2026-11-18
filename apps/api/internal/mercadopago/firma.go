package mercadopago

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"strings"
	"time"
)

// VerificarFirma valida la cabecera x-signature de un webhook ("ts=…,v1=…").
// El manifiesto es "id:{data.id};request-id:{x-request-id};ts:{ts};" (se omite lo que no venga);
// data.id va en minúsculas si es alfanumérico. tolerancia = 0 no mira la hora.
func VerificarFirma(secreto, cabecera, requestID, dataID string, ahora time.Time, tolerancia time.Duration) error {
	if secreto == "" || cabecera == "" {
		return ErrFirma
	}
	var ts, v1 string
	for _, parte := range strings.Split(cabecera, ",") {
		k, v, ok := strings.Cut(strings.TrimSpace(parte), "=")
		if !ok {
			continue
		}
		switch k {
		case "ts":
			ts = v
		case "v1":
			v1 = v
		}
	}
	if ts == "" || v1 == "" {
		return ErrFirma
	}
	var m strings.Builder
	if dataID != "" {
		m.WriteString("id:" + strings.ToLower(dataID) + ";")
	}
	if requestID != "" {
		m.WriteString("request-id:" + requestID + ";")
	}
	m.WriteString("ts:" + ts + ";")

	mac := hmac.New(sha256.New, []byte(secreto))
	mac.Write([]byte(m.String()))
	esperado := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(esperado), []byte(strings.ToLower(v1))) {
		return ErrFirma
	}
	if tolerancia > 0 {
		n, err := strconv.ParseInt(ts, 10, 64)
		if err != nil {
			return ErrFirma
		}
		// Mercado Pago manda el ts en milisegundos.
		cuando := time.UnixMilli(n)
		if n < 1e12 {
			cuando = time.Unix(n, 0)
		}
		if d := ahora.Sub(cuando); d > tolerancia || d < -tolerancia {
			return ErrFirma
		}
	}
	return nil
}
