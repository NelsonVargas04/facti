package servidor

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"facti/api/internal/datos"
	"facti/api/internal/vencimientos"
)

// Tipos de evento de la cuenta (además de los de vencimientos).
const (
	tipoFacturaMensual = "factura_mensual"
	tipoCobro          = "cobro"
)

// eventoCal: un día del calendario de la cuenta.
type eventoCal struct {
	vencimientos.Evento
	// ID estable para el archivo de calendario (para que no se dupliquen al actualizar).
	UID string `json:"-"`
}

// eventosCuenta arma el calendario de la cuenta entre desde y hasta: vencimientos del monotributo,
// facturas de todos los meses y, en Pro, los vencimientos de cobro de las facturas pendientes
// (los recordatorios de cobro son del plan pago). cobrosOcultos: cuántos se ven pasándose a Pro.
func (s *Servidor) eventosCuenta(ctx context.Context, d datos.Datos, c datos.Cuenta, desde, hasta time.Time) (ev []eventoCal, cobrosOcultos int, err error) {
	ini, fin := desde.Format("2006-01-02"), hasta.Format("2006-01-02")
	if c.Condicion == "monotributo" || c.Condicion == "" {
		for _, e := range vencimientos.Monotributo(desde, hasta) {
			ev = append(ev, eventoCal{Evento: e, UID: fmt.Sprintf("%s-%s", e.Tipo, e.Fecha)})
		}
	}

	rs, err := d.ListarRecurrentes(ctx, c.ID)
	if err != nil {
		return nil, 0, &BaseDatosError{Mensaje: err.Error()}
	}
	for _, r := range rs {
		if !r.Activa {
			continue
		}
		// La próxima y las de los meses siguientes que entren en el rango.
		f, err := time.ParseInLocation("2006-01-02", r.Proxima, desde.Location())
		if err != nil {
			continue
		}
		for i := 0; i < 24 && f.Format("2006-01-02") <= fin; i++ {
			if fecha := f.Format("2006-01-02"); fecha >= ini {
				titulo := "Facturarle a " + r.Cliente
				detalle := fmt.Sprintf("Factura de todos los meses por $%s. Facti te la deja lista: revisala y emitila.", miles(r.Total))
				if r.Automatica {
					titulo = "Sale sola la factura a " + r.Cliente
					detalle = fmt.Sprintf("Factura de todos los meses por $%s. Facti la emite sola en ARCA.", miles(r.Total))
				}
				ev = append(ev, eventoCal{
					Evento: vencimientos.Evento{Fecha: fecha, Tipo: tipoFacturaMensual, Titulo: titulo, Detalle: detalle, Link: "/app/facturas/recurrentes"},
					UID:    fmt.Sprintf("recurrente-%d-%s", r.ID, fecha),
				})
			}
			f = time.Date(f.Year(), f.Month()+1, r.Dia, 12, 0, 0, 0, f.Location())
		}
	}

	pag, err := d.ListarComprobantes(ctx, c.ID, datos.Filtro{Cobro: datos.Pendiente, Limite: 500})
	if err != nil {
		return nil, 0, &BaseDatosError{Mensaje: err.Error()}
	}
	for _, f := range pag.Comprobantes {
		if f.Periodo == nil || f.Periodo.VtoPago < ini || f.Periodo.VtoPago > fin {
			continue
		}
		if c.Plan != datos.PlanPro {
			cobrosOcultos++
			continue
		}
		cliente := f.Receptor.Nombre
		if cliente == "" {
			cliente = "tu cliente"
		}
		ev = append(ev, eventoCal{
			Evento: vencimientos.Evento{
				Fecha: f.Periodo.VtoPago, Tipo: tipoCobro,
				Titulo:  "Te tiene que pagar " + cliente,
				Detalle: fmt.Sprintf("Vence el pago de la factura #%04d por $%s.", f.NumeroInterno, miles(f.Total)),
				Link:    fmt.Sprintf("/app/facturas/%d", f.ID),
			},
			UID: fmt.Sprintf("cobro-%d", f.ID),
		})
	}
	sort.SliceStable(ev, func(i, j int) bool { return ev[i].Fecha < ev[j].Fecha })
	return ev, cobrosOcultos, nil
}

// miles: 85000 → "85.000" (para los textos del calendario).
func miles(n float64) string {
	s := strconv.FormatInt(int64(n+0.5), 10)
	var b strings.Builder
	for i, ch := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			b.WriteByte('.')
		}
		b.WriteRune(ch)
	}
	return b.String()
}

// GET /calendario?dias=90
func (s *Servidor) verCalendario(w http.ResponseWriter, r *http.Request) error {
	d, c, err := s.cuenta(r)
	if err != nil {
		return err
	}
	dias, _ := strconv.Atoi(r.URL.Query().Get("dias"))
	if dias <= 0 || dias > 400 {
		dias = 90
	}
	hoy := s.hoyAR()
	desde := time.Date(hoy.Year(), hoy.Month(), hoy.Day(), 0, 0, 0, 0, hoy.Location())
	ev, ocultos, err := s.eventosCuenta(r.Context(), d, c, desde, desde.AddDate(0, 0, dias))
	if err != nil {
		return err
	}
	lista := make([]vencimientos.Evento, len(ev))
	for i, e := range ev {
		lista[i] = e.Evento
	}
	responderJSON(w, http.StatusOK, map[string]any{"eventos": lista, "cobrosOcultos": ocultos})
	return nil
}

// urlCalendario arma el link del archivo .ics con la dirección pública de la API.
func urlCalendario(r *http.Request, token string) string {
	esquema := "https"
	if r.TLS == nil && r.Header.Get("X-Forwarded-Proto") != "https" && strings.HasPrefix(r.Host, "localhost") {
		esquema = "http"
	}
	return fmt.Sprintf("%s://%s/calendario.ics?t=%s", esquema, r.Host, token)
}

// GET /calendario/enlace (y POST para renovarlo y que el anterior deje de andar).
func (s *Servidor) enlaceCalendario(w http.ResponseWriter, r *http.Request) error {
	d, c, err := s.cuenta(r)
	if err != nil {
		return err
	}
	token, err := d.TokenCalendario(r.Context(), c.ID, r.Method == http.MethodPost)
	if err != nil {
		return &BaseDatosError{Mensaje: err.Error()}
	}
	responderJSON(w, http.StatusOK, map[string]any{"url": urlCalendario(r, token)})
	return nil
}

// GET /calendario.ics?t=<token>: el calendario para suscribirse desde Google Calendar, iPhone u Outlook.
// Sin sesión (los calendarios no la mandan): el token del link es la llave.
func (s *Servidor) calendarioICS(w http.ResponseWriter, r *http.Request) {
	d, err := s.datos(r.Context())
	if err != nil {
		http.Error(w, "No disponible", http.StatusServiceUnavailable)
		return
	}
	c, err := d.CuentaPorTokenCalendario(r.Context(), r.URL.Query().Get("t"))
	if err != nil {
		http.Error(w, "Link de calendario inválido o renovado", http.StatusNotFound)
		return
	}
	hoy := s.hoyAR()
	desde := time.Date(hoy.Year(), hoy.Month(), 1, 0, 0, 0, 0, hoy.Location()).AddDate(0, -1, 0)
	ev, _, err := s.eventosCuenta(r.Context(), d, c, desde, desde.AddDate(1, 2, 0))
	if err != nil {
		http.Error(w, "No disponible", http.StatusServiceUnavailable)
		return
	}
	w.Header().Set("Content-Type", "text/calendar; charset=utf-8")
	w.Header().Set("Cache-Control", "private, max-age=3600")
	_, _ = w.Write([]byte(armarICS(ev, strings.TrimRight(s.webURL, "/"), s.ahora())))
}

// armarICS escribe el calendario en formato iCalendar (RFC 5545): eventos de todo el día.
func armarICS(ev []eventoCal, web string, ahora time.Time) string {
	var b strings.Builder
	linea := func(s string) { b.WriteString(plegar(s)); b.WriteString("\r\n") }
	linea("BEGIN:VCALENDAR")
	linea("VERSION:2.0")
	linea("PRODID:-//Facti//Calendario//ES")
	linea("CALSCALE:GREGORIAN")
	linea("METHOD:PUBLISH")
	linea("X-WR-CALNAME:Facti")
	linea("X-WR-TIMEZONE:America/Argentina/Buenos_Aires")
	linea("REFRESH-INTERVAL;VALUE=DURATION:PT12H")
	linea("X-PUBLISHED-TTL:PT12H")
	sello := ahora.UTC().Format("20060102T150405Z")
	for _, e := range ev {
		f, err := time.Parse("2006-01-02", e.Fecha)
		if err != nil {
			continue
		}
		linea("BEGIN:VEVENT")
		linea("UID:" + e.UID + "@facti")
		linea("DTSTAMP:" + sello)
		linea("DTSTART;VALUE=DATE:" + f.Format("20060102"))
		linea("DTEND;VALUE=DATE:" + f.AddDate(0, 0, 1).Format("20060102"))
		linea("SUMMARY:" + escaparICS(e.Titulo))
		detalle := e.Detalle
		if e.Link != "" && web != "" {
			detalle += "\n" + web + e.Link
			linea("URL:" + web + e.Link)
		}
		linea("DESCRIPTION:" + escaparICS(detalle))
		linea("TRANSP:TRANSPARENT")
		// Aviso a las 9 del día (y el día anterior para lo que hay que pagar o hacer).
		if e.Tipo == vencimientos.TipoCuota || e.Tipo == vencimientos.TipoRecategorizacion {
			linea("BEGIN:VALARM")
			linea("ACTION:DISPLAY")
			linea("DESCRIPTION:" + escaparICS(e.Titulo))
			linea("TRIGGER:-PT15H")
			linea("END:VALARM")
		}
		linea("END:VEVENT")
	}
	linea("END:VCALENDAR")
	return b.String()
}

func escaparICS(s string) string {
	r := strings.NewReplacer(`\`, `\\`, ";", `\;`, ",", `\,`, "\r\n", `\n`, "\n", `\n`)
	return r.Replace(s)
}

// plegar corta las líneas largas a 75 bytes, como pide el formato (sin partir caracteres UTF-8).
func plegar(s string) string {
	if len(s) <= 75 {
		return s
	}
	var b strings.Builder
	n := 0
	for _, ch := range s {
		l := len(string(ch))
		if n+l > 75 {
			b.WriteString("\r\n ")
			n = 1
		}
		b.WriteRune(ch)
		n += l
	}
	return b.String()
}
