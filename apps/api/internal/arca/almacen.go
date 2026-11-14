package arca

import (
	"context"
	"sync"
)

// AlmacenTickets guarda los tickets de acceso del WSAA fuera del proceso.
// En un servidor que corre siempre alcanza con el disco (CacheDir); en funciones serverless
// (Vercel) cada instancia arranca vacía, así que se guardan en la base para no pedir uno nuevo
// mientras el anterior sigue vigente (el WSAA lo rechaza).
type AlmacenTickets interface {
	LeerTicket(ctx context.Context, clave string) (TicketAcceso, bool, error)
	GuardarTicket(ctx context.Context, clave string, ta TicketAcceso) error
}

// Candado es un bloqueo por clave que vale entre instancias (en Postgres, un advisory lock).
// Bloquear espera hasta tener el candado y devuelve la función para soltarlo.
type Candado interface {
	Bloquear(ctx context.Context, clave string) (func(), error)
}

// candadoLocal bloquea dentro del proceso: alcanza cuando hay un solo servidor.
type candadoLocal struct {
	mu    sync.Mutex
	locks map[string]*sync.Mutex
}

func nuevoCandadoLocal() *candadoLocal { return &candadoLocal{locks: map[string]*sync.Mutex{}} }

func (c *candadoLocal) Bloquear(_ context.Context, clave string) (func(), error) {
	c.mu.Lock()
	l, ok := c.locks[clave]
	if !ok {
		l = &sync.Mutex{}
		c.locks[clave] = l
	}
	c.mu.Unlock()
	l.Lock()
	return l.Unlock, nil
}

func candadoDe(cfg Config) Candado {
	if cfg.Candado != nil {
		return cfg.Candado
	}
	return nuevoCandadoLocal()
}
