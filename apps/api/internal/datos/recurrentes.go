package datos

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"
)

// Recurrente es una factura que se repite todos los meses el mismo día.
type Recurrente struct {
	ID      int64   `json:"id"`
	Cliente string  `json:"cliente"`
	Total   float64 `json:"total"`
	// Plantilla: el pedido de emisión de la web sin las fechas (se usan las del día al emitir).
	Plantilla           json.RawMessage `json:"plantilla"`
	Dia                 int             `json:"dia"`     // 1 a 28 (así existe en todos los meses)
	Proxima             string          `json:"proxima"` // AAAA-MM-DD
	Automatica          bool            `json:"automatica"`
	Activa              bool            `json:"activa"`
	UltimaEmision       string          `json:"ultimaEmision"` // AAAA-MM-DD o ""
	UltimoComprobanteID *int64          `json:"ultimoComprobanteId,omitempty"`
	UltimoError         string          `json:"ultimoError"`
	CreadaEn            time.Time       `json:"creadaEn"`
}

// RecurrenteDeCuenta es una recurrente con su cuenta (para emitir las automáticas de todos).
type RecurrenteDeCuenta struct {
	CuentaID int64
	Recurrente
}

// Recurrentes guarda las facturas recurrentes. La implementan Memoria y Postgres.
type Recurrentes interface {
	// CrearRecurrente completa ID y CreadaEn. Con max > 0, si la cuenta ya tiene max devuelve
	// ErrLimiteRecurrentes; contar y crear es un solo paso (dos pedidos a la vez no pasan el límite).
	CrearRecurrente(ctx context.Context, cuentaID int64, r *Recurrente, max int) error
	ListarRecurrentes(ctx context.Context, cuentaID int64) ([]Recurrente, error)
	VerRecurrente(ctx context.Context, cuentaID, id int64) (Recurrente, error)
	// ActualizarRecurrente cambia día, próxima fecha, modo y si está activa (no la plantilla).
	ActualizarRecurrente(ctx context.Context, cuentaID int64, r Recurrente) (Recurrente, error)
	BorrarRecurrente(ctx context.Context, cuentaID, id int64) error
	// RegistrarEmisionRecurrente anota la factura emitida y deja la próxima fecha.
	RegistrarEmisionRecurrente(ctx context.Context, cuentaID, id, comprobanteID int64, fecha, proxima string) error
	RegistrarErrorRecurrente(ctx context.Context, cuentaID, id int64, mensaje string) error
	// AutomaticasVencidas: activas, automáticas y con próxima fecha hasta `hasta` inclusive, de todas las cuentas.
	AutomaticasVencidas(ctx context.Context, hasta string) ([]RecurrenteDeCuenta, error)
}

// ErrLimiteRecurrentes: la cuenta ya tiene todas las recurrentes que permite su plan.
var ErrLimiteRecurrentes = errors.New("límite de facturas recurrentes del plan")

// SiguienteFecha devuelve el día `dia` del mes siguiente al de `desde` (AAAA-MM-DD).
func SiguienteFecha(desde time.Time, dia int) string {
	if dia < 1 {
		dia = 1
	}
	if dia > 28 {
		dia = 28
	}
	return time.Date(desde.Year(), desde.Month()+1, dia, 12, 0, 0, 0, desde.Location()).Format("2006-01-02")
}

// ---------- Memoria ----------

func (m *Memoria) CrearRecurrente(_ context.Context, cuentaID int64, r *Recurrente, max int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if !m.existeCuenta(cuentaID) {
		return ErrNoEncontrado
	}
	if max > 0 {
		n := 0
		for _, x := range m.recurrentes {
			if x.cuentaID == cuentaID {
				n++
			}
		}
		if n >= max {
			return ErrLimiteRecurrentes
		}
	}
	m.ultimaRecurrente++
	r.ID = m.ultimaRecurrente
	r.CreadaEn = m.ahora()
	m.recurrentes = append(m.recurrentes, delaCuenta[Recurrente]{cuentaID, *r})
	return nil
}

func (m *Memoria) ListarRecurrentes(_ context.Context, cuentaID int64) ([]Recurrente, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := []Recurrente{}
	for _, x := range m.recurrentes {
		if x.cuentaID == cuentaID {
			out = append(out, x.v)
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Proxima != out[j].Proxima {
			return out[i].Proxima < out[j].Proxima
		}
		return out[i].ID < out[j].ID
	})
	return out, nil
}

func (m *Memoria) buscarRecurrente(cuentaID, id int64) *Recurrente {
	for i := range m.recurrentes {
		if m.recurrentes[i].cuentaID == cuentaID && m.recurrentes[i].v.ID == id {
			return &m.recurrentes[i].v
		}
	}
	return nil
}

func (m *Memoria) VerRecurrente(_ context.Context, cuentaID, id int64) (Recurrente, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if r := m.buscarRecurrente(cuentaID, id); r != nil {
		return *r, nil
	}
	return Recurrente{}, ErrNoEncontrado
}

func (m *Memoria) ActualizarRecurrente(_ context.Context, cuentaID int64, nueva Recurrente) (Recurrente, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	r := m.buscarRecurrente(cuentaID, nueva.ID)
	if r == nil {
		return Recurrente{}, ErrNoEncontrado
	}
	r.Dia, r.Proxima, r.Automatica, r.Activa = nueva.Dia, nueva.Proxima, nueva.Automatica, nueva.Activa
	return *r, nil
}

func (m *Memoria) BorrarRecurrente(_ context.Context, cuentaID, id int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.recurrentes {
		if m.recurrentes[i].cuentaID == cuentaID && m.recurrentes[i].v.ID == id {
			m.recurrentes = append(m.recurrentes[:i], m.recurrentes[i+1:]...)
			return nil
		}
	}
	return ErrNoEncontrado
}

func (m *Memoria) RegistrarEmisionRecurrente(_ context.Context, cuentaID, id, comprobanteID int64, fecha, proxima string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	r := m.buscarRecurrente(cuentaID, id)
	if r == nil {
		return ErrNoEncontrado
	}
	cid := comprobanteID
	r.UltimaEmision, r.UltimoComprobanteID, r.Proxima, r.UltimoError = fecha, &cid, proxima, ""
	return nil
}

func (m *Memoria) RegistrarErrorRecurrente(_ context.Context, cuentaID, id int64, mensaje string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	r := m.buscarRecurrente(cuentaID, id)
	if r == nil {
		return ErrNoEncontrado
	}
	r.UltimoError = mensaje
	return nil
}

func (m *Memoria) AutomaticasVencidas(_ context.Context, hasta string) ([]RecurrenteDeCuenta, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := []RecurrenteDeCuenta{}
	for _, x := range m.recurrentes {
		if x.v.Activa && x.v.Automatica && x.v.Proxima <= hasta {
			out = append(out, RecurrenteDeCuenta{x.cuentaID, x.v})
		}
	}
	return out, nil
}

// ---------- Postgres ----------

const columnasRecurrente = `id, cliente, total::float8, plantilla, dia, to_char(proxima, 'YYYY-MM-DD'), automatica, activa,
	coalesce(to_char(ultima_emision, 'YYYY-MM-DD'), ''), ultimo_comprobante_id, ultimo_error, creada_en`

func scanRecurrente(row pgx.Row, extra ...any) (Recurrente, error) {
	var r Recurrente
	var plantilla []byte
	dest := append([]any{&r.ID, &r.Cliente, &r.Total, &plantilla, &r.Dia, &r.Proxima, &r.Automatica, &r.Activa,
		&r.UltimaEmision, &r.UltimoComprobanteID, &r.UltimoError, &r.CreadaEn}, extra...)
	err := row.Scan(dest...)
	if errors.Is(err, pgx.ErrNoRows) {
		return r, ErrNoEncontrado
	}
	r.Plantilla = plantilla
	return r, err
}

func (p *Postgres) CrearRecurrente(ctx context.Context, cuentaID int64, r *Recurrente, max int) error {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if max > 0 {
		// Un candado por cuenta mientras dura la transacción: dos pedidos a la vez se ponen en fila.
		if _, err := tx.Exec(ctx, `select pg_advisory_xact_lock(8008, $1::int)`, cuentaID); err != nil {
			return err
		}
		var n int
		if err := tx.QueryRow(ctx, `select count(*) from facti.recurrentes where cuenta_id = $1`, cuentaID).Scan(&n); err != nil {
			return err
		}
		if n >= max {
			return ErrLimiteRecurrentes
		}
	}
	if err := tx.QueryRow(ctx, `
		insert into facti.recurrentes (cuenta_id, cliente, total, plantilla, dia, proxima, automatica, activa)
		values ($1, $2, $3, $4::jsonb, $5, $6::date, $7, $8) returning id, creada_en`,
		cuentaID, r.Cliente, r.Total, string(r.Plantilla), r.Dia, r.Proxima, r.Automatica, r.Activa).Scan(&r.ID, &r.CreadaEn); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (p *Postgres) ListarRecurrentes(ctx context.Context, cuentaID int64) ([]Recurrente, error) {
	rows, err := p.pool.Query(ctx, `select `+columnasRecurrente+` from facti.recurrentes where cuenta_id = $1 order by proxima, id`, cuentaID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Recurrente{}
	for rows.Next() {
		r, err := scanRecurrente(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (p *Postgres) VerRecurrente(ctx context.Context, cuentaID, id int64) (Recurrente, error) {
	return scanRecurrente(p.pool.QueryRow(ctx, `select `+columnasRecurrente+` from facti.recurrentes where cuenta_id = $1 and id = $2`, cuentaID, id))
}

func (p *Postgres) ActualizarRecurrente(ctx context.Context, cuentaID int64, r Recurrente) (Recurrente, error) {
	return scanRecurrente(p.pool.QueryRow(ctx, `
		update facti.recurrentes set dia = $3, proxima = $4::date, automatica = $5, activa = $6
		where cuenta_id = $1 and id = $2 returning `+columnasRecurrente,
		cuentaID, r.ID, r.Dia, r.Proxima, r.Automatica, r.Activa))
}

func (p *Postgres) BorrarRecurrente(ctx context.Context, cuentaID, id int64) error {
	tag, err := p.pool.Exec(ctx, `delete from facti.recurrentes where cuenta_id = $1 and id = $2`, cuentaID, id)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNoEncontrado
	}
	return err
}

func (p *Postgres) RegistrarEmisionRecurrente(ctx context.Context, cuentaID, id, comprobanteID int64, fecha, proxima string) error {
	tag, err := p.pool.Exec(ctx, `
		update facti.recurrentes set ultima_emision = $3::date, ultimo_comprobante_id = $4, proxima = $5::date, ultimo_error = ''
		where cuenta_id = $1 and id = $2`, cuentaID, id, fecha, comprobanteID, proxima)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNoEncontrado
	}
	return err
}

func (p *Postgres) RegistrarErrorRecurrente(ctx context.Context, cuentaID, id int64, mensaje string) error {
	_, err := p.pool.Exec(ctx, `update facti.recurrentes set ultimo_error = $3 where cuenta_id = $1 and id = $2`, cuentaID, id, mensaje)
	return err
}

func (p *Postgres) AutomaticasVencidas(ctx context.Context, hasta string) ([]RecurrenteDeCuenta, error) {
	rows, err := p.pool.Query(ctx, `select `+columnasRecurrente+`, cuenta_id from facti.recurrentes
		where activa and automatica and proxima <= $1::date order by proxima, id`, hasta)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []RecurrenteDeCuenta{}
	for rows.Next() {
		var x RecurrenteDeCuenta
		r, err := scanRecurrente(rows, &x.CuentaID)
		if err != nil {
			return nil, err
		}
		x.Recurrente = r
		out = append(out, x)
	}
	return out, rows.Err()
}
