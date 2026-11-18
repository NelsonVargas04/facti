package datos

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"

	"github.com/jackc/pgx/v5"
)

// Calendario guarda el link privado para suscribirse al calendario de la cuenta.
type Calendario interface {
	// TokenCalendario devuelve el token de la cuenta (lo crea la primera vez). renovar: uno nuevo.
	TokenCalendario(ctx context.Context, cuentaID int64, renovar bool) (string, error)
	// CuentaPorTokenCalendario: ErrNoEncontrado si el token no existe.
	CuentaPorTokenCalendario(ctx context.Context, token string) (Cuenta, error)
}

func nuevoToken() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

// ---------- Memoria ----------

func (m *Memoria) TokenCalendario(_ context.Context, cuentaID int64, renovar bool) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if !m.existeCuenta(cuentaID) {
		return "", ErrNoEncontrado
	}
	if m.tokensCal == nil {
		m.tokensCal = map[int64]string{}
	}
	if t, ok := m.tokensCal[cuentaID]; ok && !renovar {
		return t, nil
	}
	t := nuevoToken()
	m.tokensCal[cuentaID] = t
	return t, nil
}

func (m *Memoria) CuentaPorTokenCalendario(_ context.Context, token string) (Cuenta, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for id, t := range m.tokensCal {
		if t == token && token != "" {
			for _, c := range m.cuentas {
				if c.ID == id {
					return c, nil
				}
			}
		}
	}
	return Cuenta{}, ErrNoEncontrado
}

// ---------- Postgres ----------

func (p *Postgres) TokenCalendario(ctx context.Context, cuentaID int64, renovar bool) (string, error) {
	if !renovar {
		var t *string
		err := p.pool.QueryRow(ctx, `select calendario_token from facti.cuentas where id = $1`, cuentaID).Scan(&t)
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrNoEncontrado
		}
		if err != nil {
			return "", err
		}
		if t != nil && *t != "" {
			return *t, nil
		}
	}
	t := nuevoToken()
	tag, err := p.pool.Exec(ctx, `update facti.cuentas set calendario_token = $2 where id = $1`, cuentaID, t)
	if err == nil && tag.RowsAffected() == 0 {
		return "", ErrNoEncontrado
	}
	return t, err
}

func (p *Postgres) CuentaPorTokenCalendario(ctx context.Context, token string) (Cuenta, error) {
	if token == "" {
		return Cuenta{}, ErrNoEncontrado
	}
	return scanCuenta(p.pool.QueryRow(ctx, `select `+columnasCuenta+` from facti.cuentas where calendario_token = $1`, token))
}
