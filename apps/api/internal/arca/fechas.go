package arca

import (
	"fmt"
	"math"
	"time"
)

// HoraArgentina es UTC-3 (Argentina no usa horario de verano). Se usa una zona fija
// para no depender de la base de husos horarios del sistema operativo.
var HoraArgentina = time.FixedZone("ART", -3*60*60)

// AFechaArca devuelve la fecha en formato AAAAMMDD, en hora de Argentina.
func AFechaArca(t time.Time) string {
	return t.In(HoraArgentina).Format("20060102")
}

// DeFechaArca convierte AAAAMMDD a AAAA-MM-DD.
func DeFechaArca(valor string) string {
	if len(valor) != 8 {
		return valor
	}
	return valor[0:4] + "-" + valor[4:6] + "-" + valor[6:8]
}

// importe formatea un monto con dos decimales, como lo pide WSFEv1.
func importe(n float64) string {
	return fmt.Sprintf("%.2f", math.Round(n*100)/100)
}
