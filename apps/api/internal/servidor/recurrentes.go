package servidor

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"facti/api/internal/arca"
	"facti/api/internal/datos"
)

// maxRecurrentesGratis: en el plan Gratis se puede tener una factura recurrente; en Pro, ilimitadas.
const maxRecurrentesGratis = 1

// recurrenteVista agrega lo que la web necesita mostrar.
type recurrenteVista struct {
	datos.Recurrente
	// Pendiente: ya llegó el día y todavía no se emitió (las de "confirmar" esperan al usuario).
	Pendiente bool `json:"pendiente"`
}

func (s *Servidor) hoyAR() time.Time { return s.ahora().In(arca.HoraArgentina) }

// proximaDesde: el día `dia` del mes de `desde` si todavía no pasó; si no, el del mes siguiente.
func proximaDesde(desde time.Time, dia int) string {
	esteMes := time.Date(desde.Year(), desde.Month(), dia, 12, 0, 0, 0, desde.Location()).Format("2006-01-02")
	if esteMes >= desde.Format("2006-01-02") {
		return esteMes
	}
	return datos.SiguienteFecha(desde, dia)
}

func (s *Servidor) vista(r datos.Recurrente) recurrenteVista {
	return recurrenteVista{Recurrente: r, Pendiente: r.Activa && r.Proxima <= s.hoyAR().Format("2006-01-02")}
}

// GET /recurrentes
func (s *Servidor) listarRecurrentes(w http.ResponseWriter, r *http.Request) error {
	d, c, err := s.cuenta(r)
	if err != nil {
		return err
	}
	rs, err := d.ListarRecurrentes(r.Context(), c.ID)
	if err != nil {
		return &BaseDatosError{Mensaje: err.Error()}
	}
	out := make([]recurrenteVista, len(rs))
	for i, x := range rs {
		out[i] = s.vista(x)
	}
	var limite *int
	if c.Plan != datos.PlanPro {
		n := maxRecurrentesGratis
		limite = &n
	}
	responderJSON(w, http.StatusOK, map[string]any{"recurrentes": out, "limite": limite})
	return nil
}

type pedidoRecurrente struct {
	Plantilla  json.RawMessage `json:"plantilla"`
	Dia        int             `json:"dia"`
	Automatica bool            `json:"automatica"`
}

// POST /recurrentes: la plantilla es el mismo pedido de emisión de la web (sin fechas).
func (s *Servidor) crearRecurrente(w http.ResponseWriter, r *http.Request) error {
	var body pedidoRecurrente
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
		return pedidoInvalido("datos_invalidos", "No pudimos leer la factura recurrente.")
	}
	if body.Dia < 1 || body.Dia > 28 {
		return pedidoInvalido("dia_invalido", "Elegí un día del 1 al 28 (así existe en todos los meses).")
	}
	var plantilla nuevaFactura
	if err := json.Unmarshal(body.Plantilla, &plantilla); err != nil || !plantilla.valido() {
		return pedidoInvalido("datos_invalidos", "Faltan datos del cliente o los ítems.")
	}
	plantilla.Fecha, plantilla.PeriodoServicio, plantilla.RecurrenteID = "", nil, nil
	prep, err := plantilla.preparar(s.ahora())
	if err != nil {
		return err
	}
	d, c, err := s.cuenta(r)
	if err != nil {
		return err
	}
	if c.Plan != datos.PlanPro {
		rs, err := d.ListarRecurrentes(r.Context(), c.ID)
		if err != nil {
			return &BaseDatosError{Mensaje: err.Error()}
		}
		if len(rs) >= maxRecurrentesGratis {
			return &errorPedido{
				estado: http.StatusForbidden, codigo: "limite_plan",
				mensaje: "En el plan Gratis podés tener 1 factura recurrente. Pasate a Pro para tener todas las que quieras.",
			}
		}
	}
	guardada, _ := json.Marshal(plantilla)
	cliente := strings.TrimSpace(plantilla.Receptor.Nombre)
	if cliente == "" {
		cliente = "Consumidor final"
	}
	rec := datos.Recurrente{
		Cliente: cliente, Total: prep.total, Plantilla: guardada, Dia: body.Dia,
		Proxima: datos.SiguienteFecha(s.hoyAR(), body.Dia), Automatica: body.Automatica, Activa: true,
	}
	if err := d.CrearRecurrente(r.Context(), c.ID, &rec); err != nil {
		return &BaseDatosError{Mensaje: err.Error()}
	}
	responderJSON(w, http.StatusCreated, s.vista(rec))
	return nil
}

// GET /recurrentes/{id}
func (s *Servidor) verRecurrente(w http.ResponseWriter, r *http.Request) error {
	d, c, err := s.cuenta(r)
	if err != nil {
		return err
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		return datos.ErrNoEncontrado
	}
	rec, err := d.VerRecurrente(r.Context(), c.ID, id)
	if err != nil {
		return err
	}
	responderJSON(w, http.StatusOK, s.vista(rec))
	return nil
}

// PATCH /recurrentes/{id}: cambiar el día, el modo o pausarla.
func (s *Servidor) cambiarRecurrente(w http.ResponseWriter, r *http.Request) error {
	var body struct {
		Dia        *int  `json:"dia"`
		Automatica *bool `json:"automatica"`
		Activa     *bool `json:"activa"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(&body); err != nil {
		return pedidoInvalido("datos_invalidos", "No pudimos leer el cambio.")
	}
	d, c, err := s.cuenta(r)
	if err != nil {
		return err
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		return datos.ErrNoEncontrado
	}
	rec, err := d.VerRecurrente(r.Context(), c.ID, id)
	if err != nil {
		return err
	}
	hoy := s.hoyAR()
	if body.Dia != nil {
		if *body.Dia < 1 || *body.Dia > 28 {
			return pedidoInvalido("dia_invalido", "Elegí un día del 1 al 28.")
		}
		rec.Dia = *body.Dia
		// El mismo mes de la próxima; si ese día ya pasó, el que viene.
		prox, _ := time.ParseInLocation("2006-01-02", rec.Proxima, arca.HoraArgentina)
		if prox.Before(hoy) {
			prox = hoy
		}
		rec.Proxima = proximaDesde(prox, rec.Dia)
	}
	if body.Automatica != nil {
		rec.Automatica = *body.Automatica
	}
	if body.Activa != nil {
		rec.Activa = *body.Activa
		// Al reactivarla, no se emiten los meses "atrasados": sigue en la próxima fecha que viene.
		if rec.Activa && rec.Proxima < hoy.Format("2006-01-02") {
			rec.Proxima = proximaDesde(hoy, rec.Dia)
		}
	}
	rec, err = d.ActualizarRecurrente(r.Context(), c.ID, rec)
	if err != nil {
		return err
	}
	responderJSON(w, http.StatusOK, s.vista(rec))
	return nil
}

// DELETE /recurrentes/{id}
func (s *Servidor) borrarRecurrente(w http.ResponseWriter, r *http.Request) error {
	d, c, err := s.cuenta(r)
	if err != nil {
		return err
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		return datos.ErrNoEncontrado
	}
	if err := d.BorrarRecurrente(r.Context(), c.ID, id); err != nil {
		return err
	}
	w.WriteHeader(http.StatusNoContent)
	return nil
}

// avanzarRecurrente anota la factura emitida y pasa la recurrente al mes siguiente. Si falla solo
// se registra en el log: la factura ya está autorizada y guardada.
func (s *Servidor) avanzarRecurrente(ctx context.Context, d datos.Datos, cuentaID, id int64, out facturaEmitida) {
	rec, err := d.VerRecurrente(ctx, cuentaID, id)
	if err != nil {
		s.log.Warn("recurrente no encontrada al emitir", "id", id, "error", err)
		return
	}
	fecha, _ := time.ParseInLocation("2006-01-02", out.Fecha, arca.HoraArgentina)
	if err := d.RegistrarEmisionRecurrente(ctx, cuentaID, id, out.ID, out.Fecha, datos.SiguienteFecha(fecha, rec.Dia)); err != nil {
		s.log.Error("no se pudo avanzar la recurrente", "id", id, "error", err)
	}
}

// pedidoDelMes arma el pedido de emisión de hoy a partir de la plantilla: fecha de hoy y, si es
// un servicio, el mes en curso como período con vencimiento a 10 días.
func pedidoDelMes(plantilla json.RawMessage, hoy time.Time) (nuevaFactura, error) {
	var body nuevaFactura
	if err := json.Unmarshal(plantilla, &body); err != nil {
		return body, err
	}
	body.Fecha = hoy.Format("2006-01-02")
	if body.Concepto != 1 {
		desde, hasta := mes(hoy)
		body.PeriodoServicio = &struct {
			Desde           string `json:"desde"`
			Hasta           string `json:"hasta"`
			VencimientoPago string `json:"vencimientoPago"`
		}{desde, hasta, hoy.AddDate(0, 0, 10).Format("2006-01-02")}
	}
	return body, nil
}

// POST /recurrentes/procesar: emite las recurrentes automáticas que vencen hoy (lo llama el cron
// una vez por día con "Authorization: Bearer <CRON_SECRET>"). De a una: ARCA pide emitir en orden.
func (s *Servidor) procesarRecurrentes(w http.ResponseWriter, r *http.Request) error {
	if s.cronSecreto == "" {
		return &ConfiguracionError{Mensaje: "Falta CRON_SECRET para emitir las facturas recurrentes automáticas."}
	}
	token, _ := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if subtle.ConstantTimeCompare([]byte(token), []byte(s.cronSecreto)) != 1 {
		return errSinSesion
	}
	d, err := s.datos(r.Context())
	if err != nil {
		return err
	}
	hoy := s.hoyAR()
	vencidas, err := d.AutomaticasVencidas(r.Context(), hoy.Format("2006-01-02"))
	if err != nil {
		return &BaseDatosError{Mensaje: err.Error()}
	}
	resumen := map[string]int{"vencidas": len(vencidas), "emitidas": 0, "conError": 0}
	for _, x := range vencidas {
		// Si ya se emitió este mes (por ejemplo, el cron corrió dos veces), solo se avanza la fecha.
		if x.UltimaEmision != "" && x.UltimaEmision[:7] == hoy.Format("2006-01") {
			x.Proxima = datos.SiguienteFecha(hoy, x.Dia)
			_, _ = d.ActualizarRecurrente(r.Context(), x.CuentaID, x.Recurrente)
			continue
		}
		if err := s.emitirRecurrente(r.Context(), d, x, hoy); err != nil {
			resumen["conError"]++
			msg := err.Error()
			var pe *errorPedido
			if errors.As(err, &pe) {
				msg = pe.mensaje
			}
			s.log.Warn("recurrente automática con error", "cuenta", x.CuentaID, "id", x.ID, "error", msg)
			_ = d.RegistrarErrorRecurrente(r.Context(), x.CuentaID, x.ID, msg)
			continue
		}
		resumen["emitidas"]++
	}
	responderJSON(w, http.StatusOK, resumen)
	return nil
}

func (s *Servidor) emitirRecurrente(ctx context.Context, d datos.Datos, x datos.RecurrenteDeCuenta, hoy time.Time) error {
	cuenta, err := d.CuentaPorID(ctx, x.CuentaID)
	if err != nil {
		return err
	}
	if cuenta.Cuit == "" {
		return fmt.Errorf("la cuenta no tiene CUIT cargado")
	}
	body, err := pedidoDelMes(x.Plantilla, hoy)
	if err != nil || !body.valido() {
		return fmt.Errorf("la plantilla de la factura no es válida")
	}
	prep, err := body.preparar(s.ahora())
	if err != nil {
		return err
	}
	cl, err := s.arca()
	if err != nil {
		return err
	}
	out, err := s.emitirC(ctx, d, cuenta, cl, body, prep)
	if err != nil {
		return err
	}
	s.avanzarRecurrente(ctx, d, x.CuentaID, x.ID, out)
	return nil
}
