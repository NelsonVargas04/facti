package arca

// Detalle de un error u observación devuelto por ARCA.
type Detalle struct {
	Codigo  string `json:"codigo"`
	Mensaje string `json:"mensaje"`
}

// Error devuelto por un web service de ARCA (fault SOAP o lista de errores).
type Error struct {
	Mensaje  string
	Detalles []Detalle
	Servicio string
}

func (e *Error) Error() string { return e.Mensaje }

// SinRespuestaError es un fallo de red o timeout: no sabemos si ARCA recibió el pedido.
type SinRespuestaError struct {
	Mensaje string
	Causa   error
}

func (e *SinRespuestaError) Error() string { return e.Mensaje }
func (e *SinRespuestaError) Unwrap() error { return e.Causa }
