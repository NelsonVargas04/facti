package datos

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"

	"facti/api/internal/arca"
)

// Postgres también guarda los tickets del WSAA y da el candado entre instancias que usa ARCA
// (arca.AlmacenTickets y arca.Candado), para correr la API en funciones serverless.

// LeerTicket devuelve el ticket guardado para la clave, si hay.
func (p *Postgres) LeerTicket(ctx context.Context, clave string) (arca.TicketAcceso, bool, error) {
	var b []byte
	err := p.pool.QueryRow(ctx, `select ticket from facti.tickets_acceso where clave = $1`, clave).Scan(&b)
	if errors.Is(err, pgx.ErrNoRows) {
		return arca.TicketAcceso{}, false, nil
	}
	if err != nil {
		return arca.TicketAcceso{}, false, err
	}
	var ta arca.TicketAcceso
	if err := json.Unmarshal(b, &ta); err != nil {
		return arca.TicketAcceso{}, false, err
	}
	return ta, true, nil
}

// GuardarTicket guarda (o reemplaza) el ticket de la clave.
func (p *Postgres) GuardarTicket(ctx context.Context, clave string, ta arca.TicketAcceso) error {
	b, err := json.Marshal(ta)
	if err != nil {
		return err
	}
	_, err = p.pool.Exec(ctx, `
		insert into facti.tickets_acceso (clave, ticket) values ($1, $2)
		on conflict (clave) do update set ticket = excluded.ticket, actualizado_en = now()`, clave, b)
	return err
}

// Bloquear toma un advisory lock de Postgres para la clave (espera si otro lo tiene) y lo suelta al
// llamar a la función devuelta. Vale entre todas las instancias de la API.
// Usa un lock de transacción (pg_advisory_xact_lock) dentro de una transacción abierta mientras dura
// el bloqueo: así funciona también con el pooler de Supabase en modo transacción (puerto 6543).
func (p *Postgres) Bloquear(ctx context.Context, clave string) (func(), error) {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `select pg_advisory_xact_lock(hashtextextended($1, 0))`, clave); err != nil {
		_ = tx.Rollback(context.Background())
		return nil, err
	}
	return func() {
		// Con un contexto nuevo: hay que soltarlo aunque el pedido se haya cancelado.
		_ = tx.Commit(context.Background())
	}, nil
}

var (
	_ arca.AlmacenTickets = (*Postgres)(nil)
	_ arca.Candado        = (*Postgres)(nil)
)
