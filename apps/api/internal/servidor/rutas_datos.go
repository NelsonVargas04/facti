package servidor

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"facti/api/internal/arca"
	"facti/api/internal/cuit"
	"facti/api/internal/datos"
)

// planDe arma el bloque del plan con lo usado en el mes.
func (s *Servidor) planDe(r *http.Request, d datos.Datos, c datos.Cuenta) (map[string]any, error) {
	desde, hasta := mes(s.ahora().In(arca.HoraArgentina))
	uso, err := d.Uso(r.Context(), c.ID, desde, hasta)
	if err != nil {
		return nil, &BaseDatosError{Mensaje: "No se pudo leer el uso del plan: " + err.Error()}
	}
	return map[string]any{"nombre": c.Plan, "limites": limitesDe(c.Plan), "uso": uso}, nil
}

// completarPerfil trae nombre, domicilio y condición del emisor desde el padrón la primera vez.
// Si ARCA no está configurado o no responde, sigue sin perfil (se intenta de nuevo la próxima vez).
func (s *Servidor) completarPerfil(r *http.Request, d datos.Datos, c datos.Cuenta) datos.Cuenta {
	if c.Nombre != "" || c.Cuit == "" {
		return c
	}
	cl, err := s.arca()
	if err != nil {
		return c
	}
	p, err := arca.ConsultarPadron(r.Context(), cl.Cfg, cl.Tickets, cuit.Limpiar(c.Cuit))
	if err != nil {
		s.log.Warn("no se pudo leer el perfil del emisor en el padrón", "error", err)
		return c
	}
	act, err := d.ActualizarPerfil(r.Context(), c.ID, datos.Perfil{
		Nombre: p.Nombre, Domicilio: p.Domicilio, Condicion: string(p.Condicion), Categoria: p.CategoriaMonotributo,
	})
	if err != nil {
		s.log.Warn("no se pudo guardar el perfil del emisor", "error", err)
		return c
	}
	return act
}

func (s *Servidor) verCuenta(w http.ResponseWriter, r *http.Request) error {
	d, c, err := s.cuenta(r)
	if err != nil {
		return err
	}
	c = s.completarPerfil(r, d, c)
	plan, err := s.planDe(r, d, c)
	if err != nil {
		return err
	}
	responderJSON(w, http.StatusOK, map[string]any{"cuenta": c, "plan": plan})
	return nil
}

// asignarCuit guarda el CUIT del usuario (primer paso del onboarding). Si ARCA está configurado,
// trae del padrón el nombre, el domicilio y la condición fiscal; si no, guarda solo el CUIT.
func (s *Servidor) asignarCuit(w http.ResponseWriter, r *http.Request) error {
	var body struct {
		Cuit string `json:"cuit"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<10)).Decode(&body); err != nil || !cuit.Validar(body.Cuit) {
		return pedidoInvalido("cuit_invalido", "Revisá el CUIT: tiene que tener 11 números y un dígito verificador válido.")
	}
	d, c, err := s.cuenta(r)
	if err != nil {
		return err
	}
	nuevo := cuit.Limpiar(body.Cuit)

	var perfil datos.Perfil
	padron := false
	if cl, err := s.arca(); err == nil {
		p, err := arca.ConsultarPadron(r.Context(), cl.Cfg, cl.Tickets, nuevo)
		var errArca *arca.Error
		switch {
		case err == nil:
			perfil = datos.Perfil{Nombre: p.Nombre, Domicilio: p.Domicilio, Condicion: string(p.Condicion), Categoria: p.CategoriaMonotributo}
			padron = true
		case cl.Cfg.Entorno == arca.Homologacion && errors.As(err, &errArca) && errArca.Servicio == "Padron A5":
			// El padrón de homologación casi no tiene personas reales ("No existe persona con ese Id"):
			// en pruebas se guarda el CUIT igual, sin datos del padrón.
		default:
			return err
		}
	}
	act, err := d.AsignarCuit(r.Context(), c.ID, nuevo, perfil)
	if errors.Is(err, datos.ErrCuitEnUso) {
		return &errorPedido{estado: http.StatusConflict, codigo: "cuit_en_uso", mensaje: "Ese CUIT ya está asociado a otra cuenta de Facti."}
	}
	if err != nil {
		return &BaseDatosError{Mensaje: err.Error()}
	}
	plan, err := s.planDe(r, d, act)
	if err != nil {
		return err
	}
	responderJSON(w, http.StatusOK, map[string]any{"cuenta": act, "plan": plan, "padron": padron})
	return nil
}

// cargarPerfil guarda a mano el nombre y el domicilio del emisor. Solo en homologación, donde el padrón
// de prueba casi no tiene personas reales; en producción esos datos salen siempre del padrón de ARCA.
func (s *Servidor) cargarPerfil(w http.ResponseWriter, r *http.Request) error {
	if s.entorno == arca.Produccion {
		return &errorPedido{estado: http.StatusForbidden, codigo: "perfil_del_padron", mensaje: "Tu nombre y domicilio salen del padrón de ARCA."}
	}
	var body struct {
		Nombre    string `json:"nombre"`
		Domicilio string `json:"domicilio"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<10)).Decode(&body); err != nil {
		return pedidoInvalido("perfil_invalido", "No pudimos leer los datos.")
	}
	nombre, domicilio := strings.TrimSpace(body.Nombre), strings.TrimSpace(body.Domicilio)
	if nombre == "" || len([]rune(nombre)) > 120 || len([]rune(domicilio)) > 200 {
		return pedidoInvalido("perfil_invalido", "Escribí tu nombre y apellido (o razón social) y, si querés, tu domicilio fiscal.")
	}
	d, c, err := s.cuenta(r)
	if err != nil {
		return err
	}
	if c.Cuit == "" {
		return &errorPedido{estado: http.StatusConflict, codigo: "falta_cuit", mensaje: "Primero cargá tu CUIT."}
	}
	condicion := c.Condicion
	if condicion == "" || condicion == string(arca.ConsumidorFinal) {
		condicion = string(arca.Monotributo)
	}
	act, err := d.ActualizarPerfil(r.Context(), c.ID, datos.Perfil{
		Nombre: strings.ToUpper(nombre), Domicilio: domicilio, Condicion: condicion, Categoria: c.Categoria,
	})
	if err != nil {
		return &BaseDatosError{Mensaje: err.Error()}
	}
	responderJSON(w, http.StatusOK, map[string]any{"cuenta": act})
	return nil
}

// verResumen devuelve los números del mes (?mes=AAAA-MM, por defecto el actual) y las últimas facturas.
func (s *Servidor) verResumen(w http.ResponseWriter, r *http.Request) error {
	ahora := s.ahora().In(arca.HoraArgentina)
	ref := ahora
	if m := r.URL.Query().Get("mes"); m != "" {
		t, err := time.ParseInLocation("2006-01", m, arca.HoraArgentina)
		if err != nil {
			return pedidoInvalido("mes_invalido", "El mes tiene que tener el formato AAAA-MM.")
		}
		ref = t
	}
	d, c, err := s.cuenta(r)
	if err != nil {
		return err
	}
	ctx := r.Context()
	desde, hasta := mes(ref)
	delMes, err := d.Resumen(ctx, c.ID, desde, hasta)
	if err != nil {
		return &BaseDatosError{Mensaje: err.Error()}
	}
	// Facturación de los últimos 12 meses, para el panel de monotributo.
	doce, err := d.Resumen(ctx, c.ID, ahora.AddDate(-1, 0, 1).Format("2006-01-02"), ahora.Format("2006-01-02"))
	if err != nil {
		return &BaseDatosError{Mensaje: err.Error()}
	}
	pendientes, err := d.Resumen(ctx, c.ID, "0001-01-01", "9999-12-31")
	if err != nil {
		return &BaseDatosError{Mensaje: err.Error()}
	}
	// Mes a mes de los últimos 12 (del más viejo al actual), para el gráfico del inicio y de monotributo.
	type mesFacturado struct {
		Mes       string  `json:"mes"` // AAAA-MM
		Facturado float64 `json:"facturado"`
	}
	porMes := make([]mesFacturado, 0, 12)
	for i := 11; i >= 0; i-- {
		m := time.Date(ahora.Year(), ahora.Month(), 1, 0, 0, 0, 0, arca.HoraArgentina).AddDate(0, -i, 0)
		md, mh := mes(m)
		rm, err := d.Resumen(ctx, c.ID, md, mh)
		if err != nil {
			return &BaseDatosError{Mensaje: err.Error()}
		}
		porMes = append(porMes, mesFacturado{Mes: md[:7], Facturado: rm.Facturado})
	}
	ultimas, err := d.ListarComprobantes(ctx, c.ID, datos.Filtro{Limite: 5})
	if err != nil {
		return &BaseDatosError{Mensaje: err.Error()}
	}
	plan, err := s.planDe(r, d, c)
	if err != nil {
		return err
	}
	responderJSON(w, http.StatusOK, map[string]any{
		"mes":            desde[:7],
		"delMes":         delMes,
		"ultimos12Meses": map[string]any{"facturado": doce.Facturado, "desde": ahora.AddDate(-1, 0, 1).Format("2006-01-02"), "porMes": porMes},
		// Lo que falta cobrar de cualquier mes, para el aviso del inicio.
		"porCobrar": map[string]any{"total": pendientes.PorCobrar, "facturas": pendientes.Pendientes},
		"ultimas":   ultimas.Comprobantes,
		"plan":      plan,
	})
	return nil
}

func fechaValida(s string) bool {
	if s == "" {
		return true
	}
	_, err := time.Parse("2006-01-02", s)
	return err == nil
}

func (s *Servidor) listarComprobantes(w http.ResponseWriter, r *http.Request) error {
	q := r.URL.Query()
	f := datos.Filtro{
		Desde: q.Get("desde"), Hasta: q.Get("hasta"), Q: q.Get("q"),
		Cobro: datos.Cobro(q.Get("cobro")), Orden: q.Get("orden"),
	}
	if !fechaValida(f.Desde) || !fechaValida(f.Hasta) {
		return pedidoInvalido("fecha_invalida", "Las fechas tienen que tener el formato AAAA-MM-DD.")
	}
	if f.Cobro != "" && f.Cobro != datos.Pendiente && f.Cobro != datos.Cobrada {
		return pedidoInvalido("cobro_invalido", "El cobro tiene que ser pendiente o cobrada.")
	}
	f.Limite, _ = strconv.Atoi(q.Get("limite"))
	f.Saltar, _ = strconv.Atoi(q.Get("saltar"))
	d, c, err := s.cuenta(r)
	if err != nil {
		return err
	}
	pag, err := d.ListarComprobantes(r.Context(), c.ID, f)
	if err != nil {
		return &BaseDatosError{Mensaje: err.Error()}
	}
	responderJSON(w, http.StatusOK, pag)
	return nil
}

func idDe(r *http.Request) (int64, error) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		return 0, &errorPedido{estado: http.StatusNotFound, codigo: "no_encontrado", mensaje: "No encontramos ese comprobante."}
	}
	return id, nil
}

// verComprobante devuelve el comprobante con sus ítems y los datos del emisor para armar el PDF.
func (s *Servidor) verComprobante(w http.ResponseWriter, r *http.Request) error {
	id, err := idDe(r)
	if err != nil {
		return err
	}
	d, c, err := s.cuenta(r)
	if err != nil {
		return err
	}
	comp, err := d.Comprobante(r.Context(), c.ID, id)
	if err != nil {
		return err
	}
	responderJSON(w, http.StatusOK, map[string]any{"comprobante": comp, "emisor": c})
	return nil
}

func (s *Servidor) marcarCobro(w http.ResponseWriter, r *http.Request) error {
	id, err := idDe(r)
	if err != nil {
		return err
	}
	var body struct {
		Cobro datos.Cobro `json:"cobro"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<10)).Decode(&body); err != nil ||
		(body.Cobro != datos.Pendiente && body.Cobro != datos.Cobrada) {
		return pedidoInvalido("cobro_invalido", "El cobro tiene que ser pendiente o cobrada.")
	}
	d, c, err := s.cuenta(r)
	if err != nil {
		return err
	}
	comp, err := d.MarcarCobro(r.Context(), c.ID, id, body.Cobro)
	if err != nil {
		return err
	}
	responderJSON(w, http.StatusOK, comp)
	return nil
}

func (s *Servidor) listarClientes(w http.ResponseWriter, r *http.Request) error {
	d, c, err := s.cuenta(r)
	if err != nil {
		return err
	}
	// Si buscan un CUIT con guiones, se busca por los dígitos.
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if l := cuit.Limpiar(q); len(l) >= 5 && len(l) >= len(strings.ReplaceAll(q, "-", "")) {
		q = l
	}
	clientes, err := d.ListarClientes(r.Context(), c.ID, q)
	if err != nil {
		return &BaseDatosError{Mensaje: err.Error()}
	}
	responderJSON(w, http.StatusOK, map[string]any{"clientes": clientes})
	return nil
}
