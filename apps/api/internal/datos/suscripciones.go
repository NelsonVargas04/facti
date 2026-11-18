package datos

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// Estados de la suscripción (los mismos de Mercado Pago).
const (
	SuscripcionPendiente  = "pending"
	SuscripcionAutorizada = "authorized"
	SuscripcionPausada    = "paused"
	SuscripcionCancelada  = "cancelled"
)

// Suscripcion a Facti Pro. De la tarjeta solo se guarda lo que informa Mercado Pago para mostrarla.
type Suscripcion struct {
	MPID          string    `json:"-"`
	Estado        string    `json:"estado"`
	Importe       float64   `json:"importe"` // en pesos, por mes
	PrecioUSD     float64   `json:"precioUsd"`
	Cotizacion    float64   `json:"cotizacion"`
	ProximoCobro  string    `json:"proximoCobro"` // AAAA-MM-DD o ""
	Medio         string    `json:"medio"`        // visa, master, account_money…
	Ultimos       string    `json:"ultimos"`
	Vence         string    `json:"vence"` // MM/AA
	ActualizadaEn time.Time `json:"actualizadaEn"`
}

// PagoFacti es un cobro mensual de la suscripción.
type PagoFacti struct {
	MPID    string  `json:"id"`
	Fecha   string  `json:"fecha"` // AAAA-MM-DD
	Importe float64 `json:"importe"`
	Moneda  string  `json:"moneda"`
	Estado  string  `json:"estado"` // aprobado, rechazado, pendiente
	Medio   string  `json:"medio"`
	Ultimos string  `json:"ultimos"`
}

// Pagos guarda la suscripción a Pro y sus cobros. La implementan Memoria y Postgres.
type Pagos interface {
	// GuardarSuscripcion crea o reemplaza la suscripción de la cuenta y deja el plan en Pro
	// mientras esté autorizada (en Gratis si se cancela o se pausa; pendiente no cambia el plan).
	GuardarSuscripcion(ctx context.Context, cuentaID int64, s Suscripcion) error
	// VerSuscripcion devuelve nil si la cuenta nunca se suscribió.
	VerSuscripcion(ctx context.Context, cuentaID int64) (*Suscripcion, error)
	// CuentaDeSuscripcion busca la cuenta por el id de Mercado Pago (para los webhooks).
	CuentaDeSuscripcion(ctx context.Context, mpID string) (int64, error)
	// GuardarPagosFacti agrega o actualiza los cobros (por id de Mercado Pago).
	GuardarPagosFacti(ctx context.Context, cuentaID int64, ps []PagoFacti) error
	// PagosFacti devuelve los cobros, del más nuevo al más viejo.
	PagosFacti(ctx context.Context, cuentaID int64) ([]PagoFacti, error)
	// CuentaPorID lee la cuenta (los webhooks no tienen sesión).
	CuentaPorID(ctx context.Context, id int64) (Cuenta, error)
}

// planDe dice en qué plan queda la cuenta según el estado de la suscripción ("" = no cambia).
func planDe(estado string) Plan {
	switch estado {
	case SuscripcionAutorizada:
		return PlanPro
	case SuscripcionCancelada, SuscripcionPausada:
		return PlanGratis
	}
	return ""
}

// ---------- Memoria ----------

func (m *Memoria) GuardarSuscripcion(_ context.Context, cuentaID int64, s Suscripcion) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if !m.existeCuenta(cuentaID) {
		return ErrNoEncontrado
	}
	s.ActualizadaEn = m.ahora()
	if m.suscripciones == nil {
		m.suscripciones = map[int64]Suscripcion{}
	}
	m.suscripciones[cuentaID] = s
	if p := planDe(s.Estado); p != "" {
		for i := range m.cuentas {
			if m.cuentas[i].ID == cuentaID {
				m.cuentas[i].Plan = p
			}
		}
	}
	return nil
}

func (m *Memoria) VerSuscripcion(_ context.Context, cuentaID int64) (*Suscripcion, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if s, ok := m.suscripciones[cuentaID]; ok {
		return &s, nil
	}
	return nil, nil
}

func (m *Memoria) CuentaDeSuscripcion(_ context.Context, mpID string) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for id, s := range m.suscripciones {
		if s.MPID == mpID {
			return id, nil
		}
	}
	return 0, ErrNoEncontrado
}

func (m *Memoria) GuardarPagosFacti(_ context.Context, cuentaID int64, ps []PagoFacti) error {
	m.mu.Lock()
	defer m.mu.Unlock()
siguiente:
	for _, p := range ps {
		for i := range m.pagosFacti {
			if m.pagosFacti[i].v.MPID == p.MPID {
				m.pagosFacti[i] = delaCuenta[PagoFacti]{cuentaID, p}
				continue siguiente
			}
		}
		m.pagosFacti = append(m.pagosFacti, delaCuenta[PagoFacti]{cuentaID, p})
	}
	return nil
}

func (m *Memoria) PagosFacti(_ context.Context, cuentaID int64) ([]PagoFacti, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := []PagoFacti{}
	for _, x := range m.pagosFacti {
		if x.cuentaID == cuentaID {
			out = append(out, x.v)
		}
	}
	// Del más nuevo al más viejo (orden estable por id ante la misma fecha).
	for i := 1; i < len(out); i++ {
		for j := i; j > 0 && (out[j].Fecha > out[j-1].Fecha || (out[j].Fecha == out[j-1].Fecha && out[j].MPID > out[j-1].MPID)); j-- {
			out[j], out[j-1] = out[j-1], out[j]
		}
	}
	return out, nil
}

func (m *Memoria) CuentaPorID(_ context.Context, id int64) (Cuenta, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, c := range m.cuentas {
		if c.ID == id {
			return c, nil
		}
	}
	return Cuenta{}, ErrNoEncontrado
}

func (m *Memoria) existeCuenta(id int64) bool {
	for _, c := range m.cuentas {
		if c.ID == id {
			return true
		}
	}
	return false
}

// ---------- Postgres ----------

func (p *Postgres) GuardarSuscripcion(ctx context.Context, cuentaID int64, s Suscripcion) error {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `
		insert into facti.suscripciones (cuenta_id, mp_id, estado, importe, precio_usd, cotizacion, proximo_cobro, medio, ultimos, vence, actualizada_en)
		values ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10, now())
		on conflict (cuenta_id) do update set mp_id = excluded.mp_id, estado = excluded.estado, importe = excluded.importe,
			precio_usd = excluded.precio_usd, cotizacion = excluded.cotizacion, proximo_cobro = excluded.proximo_cobro,
			medio = excluded.medio, ultimos = excluded.ultimos, vence = excluded.vence, actualizada_en = now()`,
		cuentaID, s.MPID, s.Estado, s.Importe, s.PrecioUSD, s.Cotizacion, nulo(s.ProximoCobro), s.Medio, s.Ultimos, s.Vence); err != nil {
		return err
	}
	if pl := planDe(s.Estado); pl != "" {
		if _, err := tx.Exec(ctx, `update facti.cuentas set plan = $2 where id = $1`, cuentaID, pl); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (p *Postgres) VerSuscripcion(ctx context.Context, cuentaID int64) (*Suscripcion, error) {
	var s Suscripcion
	err := p.pool.QueryRow(ctx, `
		select mp_id, estado, importe::float8, precio_usd::float8, cotizacion::float8,
			coalesce(to_char(proximo_cobro, 'YYYY-MM-DD'), ''), medio, ultimos, vence, actualizada_en
		from facti.suscripciones where cuenta_id = $1`, cuentaID).
		Scan(&s.MPID, &s.Estado, &s.Importe, &s.PrecioUSD, &s.Cotizacion, &s.ProximoCobro, &s.Medio, &s.Ultimos, &s.Vence, &s.ActualizadaEn)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (p *Postgres) CuentaPorID(ctx context.Context, id int64) (Cuenta, error) {
	return scanCuenta(p.pool.QueryRow(ctx, `select `+columnasCuenta+` from facti.cuentas where id = $1`, id))
}

func (p *Postgres) CuentaDeSuscripcion(ctx context.Context, mpID string) (int64, error) {
	var id int64
	err := p.pool.QueryRow(ctx, `select cuenta_id from facti.suscripciones where mp_id = $1`, mpID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrNoEncontrado
	}
	return id, err
}

func (p *Postgres) GuardarPagosFacti(ctx context.Context, cuentaID int64, ps []PagoFacti) error {
	for _, x := range ps {
		if _, err := p.pool.Exec(ctx, `
			insert into facti.pagos_facti (cuenta_id, mp_id, fecha, importe, moneda, estado, medio, ultimos)
			values ($1, $2, $3::date, $4, $5, $6, $7, $8)
			on conflict (mp_id) do update set fecha = excluded.fecha, importe = excluded.importe, moneda = excluded.moneda,
				estado = excluded.estado, medio = excluded.medio, ultimos = excluded.ultimos`,
			cuentaID, x.MPID, x.Fecha, x.Importe, x.Moneda, x.Estado, x.Medio, x.Ultimos); err != nil {
			return err
		}
	}
	return nil
}

func (p *Postgres) PagosFacti(ctx context.Context, cuentaID int64) ([]PagoFacti, error) {
	rows, err := p.pool.Query(ctx, `
		select mp_id, to_char(fecha, 'YYYY-MM-DD'), importe::float8, moneda, estado, medio, ultimos
		from facti.pagos_facti where cuenta_id = $1 order by fecha desc, mp_id desc`, cuentaID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []PagoFacti{}
	for rows.Next() {
		var x PagoFacti
		if err := rows.Scan(&x.MPID, &x.Fecha, &x.Importe, &x.Moneda, &x.Estado, &x.Medio, &x.Ultimos); err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}
