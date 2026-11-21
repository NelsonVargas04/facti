package servidor

import (
	"errors"
	"io"
	"net/http"
	"time"

	"facti/api/internal/arca"
	"facti/api/internal/datos"
	"facti/api/internal/miscomprobantes"
	"facti/api/internal/monotributo"
)

// maxArchivo es el tamaño máximo del archivo de Mis Comprobantes (un año entero entra de sobra).
const maxArchivo = 4 << 20

// importarComprobantes recibe el archivo de "Mis Comprobantes – Emitidos" (CSV o Excel, en el cuerpo
// del pedido tal cual) y guarda los comprobantes emitidos fuera de Facti.
func (s *Servidor) importarComprobantes(w http.ResponseWriter, r *http.Request) error {
	// Primero la sesión: sin ella no se lee el archivo (que puede pesar varios MB).
	d, c, err := s.cuenta(r)
	if err != nil {
		return err
	}
	b, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxArchivo))
	if err != nil {
		var grande *http.MaxBytesError
		if errors.As(err, &grande) {
			return pedidoInvalido("archivo_grande", "El archivo pesa más de 4 MB. Bajá menos meses por vez (con 12 alcanza).")
		}
		return pedidoInvalido("archivo_invalido", "No pudimos leer el archivo.")
	}
	leido, err := miscomprobantes.Leer(b)
	if err != nil {
		return pedidoInvalido("archivo_invalido", err.Error())
	}
	imp, err := d.ImportarExternos(r.Context(), c.ID, leido.Comprobantes)
	if err != nil {
		return &BaseDatosError{Mensaje: "No se pudieron guardar los comprobantes: " + err.Error()}
	}
	errores := leido.Errores
	if errores == nil {
		errores = []miscomprobantes.ErrorFila{}
	}
	responderJSON(w, http.StatusOK, map[string]any{
		"leidos":      len(leido.Comprobantes),
		"importacion": imp,
		"errores":     errores,
	})
	return nil
}

// ingresos12 devuelve los ingresos de los últimos 12 meses (incluido el actual), del más viejo al actual.
func (s *Servidor) ingresos12(r *http.Request, d datos.Datos, cuentaID int64) ([]datos.IngresoMes, string, error) {
	ahora := s.ahora().In(arca.HoraArgentina)
	ini := time.Date(ahora.Year(), ahora.Month(), 1, 0, 0, 0, 0, arca.HoraArgentina).AddDate(0, -11, 0)
	_, hasta := mes(ahora)
	m, err := d.IngresosPorMes(r.Context(), cuentaID, ini.Format("2006-01-02"), hasta)
	if err != nil {
		return nil, "", &BaseDatosError{Mensaje: err.Error()}
	}
	return m, ini.Format("2006-01-02"), nil
}

// verTopes devuelve la facturación de 12 meses (con y sin Facti), la categoría que corresponde,
// cuánto falta para cada tope y las alertas.
func (s *Servidor) verTopes(w http.ResponseWriter, r *http.Request) error {
	d, c, err := s.cuenta(r)
	if err != nil {
		return err
	}
	porMes, desde, err := s.ingresos12(r, d, c.ID)
	if err != nil {
		return err
	}
	ext, err := d.EstadoExternos(r.Context(), c.ID)
	if err != nil {
		return &BaseDatosError{Mensaje: err.Error()}
	}
	totales := make([]float64, len(porMes))
	var facti, externo float64
	for i, m := range porMes {
		totales[i] = m.Facti + m.Externo
		facti += m.Facti
		externo += m.Externo
	}
	escala := s.categorias.Escala(r.Context())
	responderJSON(w, http.StatusOK, map[string]any{
		"desde":    desde,
		"porMes":   porMes,
		"facti":    facti,
		"externo":  externo,
		"externos": ext,
		"analisis": monotributo.Analizar(totales, escala, c.Categoria, s.ahora().In(arca.HoraArgentina)),
		"escala":   map[string]any{"vigenteDesde": escala.VigenteDesde, "origen": escala.Origen},
	})
	return nil
}
