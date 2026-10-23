package datos

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
)

// Memoria implementa Datos en memoria, con el mismo comportamiento que Postgres. Es para tests.
type Memoria struct {
	mu           sync.Mutex
	cuentas      []Cuenta
	clientes     []delaCuenta[Cliente]
	comprobantes []delaCuenta[Comprobante]
	ahora        func() time.Time
}

type delaCuenta[T any] struct {
	cuentaID int64
	v        T
}

func NuevaMemoria() *Memoria { return &Memoria{ahora: time.Now} }

func (m *Memoria) Cerrar() {}

func (m *Memoria) AsegurarCuenta(_ context.Context, cuit string, puntoVenta int) (Cuenta, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.cuentas {
		if m.cuentas[i].Cuit == cuit {
			m.cuentas[i].PuntoVenta = puntoVenta
			return m.cuentas[i], nil
		}
	}
	c := Cuenta{ID: int64(len(m.cuentas) + 1), Cuit: cuit, PuntoVenta: puntoVenta, Plan: PlanGratis, CreadaEn: m.ahora()}
	m.cuentas = append(m.cuentas, c)
	return c, nil
}

func (m *Memoria) ActualizarPerfil(_ context.Context, cuentaID int64, p Perfil) (Cuenta, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.cuentas {
		if m.cuentas[i].ID == cuentaID {
			c := &m.cuentas[i]
			c.Nombre, c.Domicilio, c.Condicion, c.Categoria = p.Nombre, p.Domicilio, p.Condicion, p.Categoria
			return *c, nil
		}
	}
	return Cuenta{}, ErrNoEncontrado
}

// CambiarPlan es solo para tests (todavía no hay pagos).
func (m *Memoria) CambiarPlan(cuentaID int64, plan Plan) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.cuentas {
		if m.cuentas[i].ID == cuentaID {
			m.cuentas[i].Plan = plan
		}
	}
}

func (m *Memoria) GuardarComprobante(_ context.Context, cuentaID int64, c *Comprobante) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, x := range m.comprobantes {
		if x.cuentaID == cuentaID && x.v.Tipo == c.Tipo && x.v.PuntoVenta == c.PuntoVenta && x.v.Numero == c.Numero {
			return fmt.Errorf("guardar comprobante: el %d %s ya existe", c.Tipo, numeroDe(*c))
		}
	}
	r := c.Receptor
	if r.Identificado() {
		var cl *Cliente
		for i := range m.clientes {
			x := &m.clientes[i]
			if x.cuentaID == cuentaID && x.v.DocTipo == r.DocTipo && x.v.DocNro == r.DocNro {
				cl = &x.v
			}
		}
		if cl == nil {
			m.clientes = append(m.clientes, delaCuenta[Cliente]{cuentaID, Cliente{ID: int64(len(m.clientes) + 1), DocTipo: r.DocTipo, DocNro: r.DocNro}})
			cl = &m.clientes[len(m.clientes)-1].v
		}
		cl.CondicionIvaID = r.CondicionIvaID
		// Como en Postgres: un dato vacío no pisa el que ya estaba.
		for _, par := range [][2]*string{{&cl.Nombre, &r.Nombre}, {&cl.Condicion, &r.Condicion}, {&cl.Domicilio, &r.Domicilio}, {&cl.Email, &r.Email}} {
			if *par[1] != "" {
				*par[0] = *par[1]
			}
		}
		id := cl.ID
		c.ClienteID = &id
		completarReceptor(&c.Receptor, cl.Nombre, cl.Condicion, cl.Domicilio, cl.Email)
	}
	c.ID = int64(len(m.comprobantes) + 1)
	c.CreadoEn = m.ahora()
	completarSigla(c)
	guardado := *c
	guardado.Items = append([]Item(nil), c.Items...)
	m.comprobantes = append(m.comprobantes, delaCuenta[Comprobante]{cuentaID, guardado})
	return nil
}

func (m *Memoria) Comprobante(_ context.Context, cuentaID, id int64) (Comprobante, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, x := range m.comprobantes {
		if x.v.ID == id && x.cuentaID == cuentaID {
			return x.v, nil
		}
	}
	return Comprobante{}, ErrNoEncontrado
}

func numeroDe(c Comprobante) string { return fmt.Sprintf("%05d-%08d", c.PuntoVenta, c.Numero) }

func (m *Memoria) ListarComprobantes(_ context.Context, cuentaID int64, f Filtro) (Pagina, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	q := strings.ToLower(strings.TrimSpace(f.Q))
	var lista []Comprobante
	for _, x := range m.comprobantes {
		c := x.v
		if x.cuentaID != cuentaID || (f.Desde != "" && c.Fecha < f.Desde) || (f.Hasta != "" && c.Fecha > f.Hasta) {
			continue
		}
		if f.Cobro != "" && c.Cobro != f.Cobro {
			continue
		}
		if q != "" && !strings.Contains(strings.ToLower(c.Receptor.Nombre), q) && !strings.Contains(c.Receptor.DocNro, q) && !strings.Contains(numeroDe(c), q) {
			continue
		}
		c.Items = nil
		lista = append(lista, c)
	}
	menor := map[string]func(a, b Comprobante) bool{
		"antigua": func(a, b Comprobante) bool { return a.Fecha < b.Fecha || (a.Fecha == b.Fecha && a.ID < b.ID) },
		"cliente": func(a, b Comprobante) bool {
			return strings.ToLower(a.Receptor.Nombre) < strings.ToLower(b.Receptor.Nombre)
		},
		"numero": func(a, b Comprobante) bool { return numeroDe(a) < numeroDe(b) },
		"mayor":  func(a, b Comprobante) bool { return a.Total > b.Total },
		"menor":  func(a, b Comprobante) bool { return a.Total < b.Total },
	}[f.Orden]
	if menor == nil {
		menor = func(a, b Comprobante) bool { return a.Fecha > b.Fecha || (a.Fecha == b.Fecha && a.ID > b.ID) }
	}
	sort.SliceStable(lista, func(i, j int) bool { return menor(lista[i], lista[j]) })

	limite := f.Limite
	if limite <= 0 || limite > 200 {
		limite = 50
	}
	desde := min(max(f.Saltar, 0), len(lista))
	pag := Pagina{Total: len(lista), Comprobantes: []Comprobante{}}
	pag.Comprobantes = append(pag.Comprobantes, lista[desde:min(desde+limite, len(lista))]...)
	return pag, nil
}

func (m *Memoria) MarcarCobro(_ context.Context, cuentaID, id int64, cobro Cobro) (Comprobante, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.comprobantes {
		x := &m.comprobantes[i]
		if x.v.ID != id || x.cuentaID != cuentaID || x.v.Cobro == SinCobro {
			continue
		}
		x.v.Cobro = cobro
		x.v.CobradaEn = nil
		if cobro == Cobrada {
			t := m.ahora()
			x.v.CobradaEn = &t
		}
		return x.v, nil
	}
	return Comprobante{}, ErrNoEncontrado
}

func (m *Memoria) ListarClientes(_ context.Context, cuentaID int64, q string) ([]Cliente, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	q = strings.ToLower(strings.TrimSpace(q))
	out := []Cliente{}
	for _, cl := range m.clientes {
		if cl.cuentaID != cuentaID || (q != "" && !strings.Contains(strings.ToLower(cl.v.Nombre), q) && !strings.Contains(cl.v.DocNro, q)) {
			continue
		}
		c := cl.v
		for _, x := range m.comprobantes {
			if x.v.ClienteID == nil || *x.v.ClienteID != c.ID {
				continue
			}
			c.Comprobantes++
			if x.v.Moneda == "PES" {
				c.Facturado += x.v.Firmado()
				if x.v.Cobro == Pendiente {
					c.PorCobrar += x.v.Total
				}
			}
			c.Ultimo = max(c.Ultimo, x.v.Fecha)
		}
		out = append(out, c)
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Ultimo > out[j].Ultimo })
	return out, nil
}

func (m *Memoria) delPeriodo(cuentaID int64, desde, hasta string, f func(Comprobante)) {
	for _, x := range m.comprobantes {
		if x.cuentaID == cuentaID && x.v.Fecha >= desde && x.v.Fecha <= hasta {
			f(x.v)
		}
	}
}

func (m *Memoria) Resumen(_ context.Context, cuentaID int64, desde, hasta string) (Resumen, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var r Resumen
	m.delPeriodo(cuentaID, desde, hasta, func(c Comprobante) {
		r.Emitidos++
		pesos := c.Moneda == "PES"
		if pesos {
			r.Facturado += c.Firmado()
		}
		switch c.Cobro {
		case Pendiente:
			r.Pendientes++
			if pesos {
				r.PorCobrar += c.Total
			}
		case Cobrada:
			r.Cobradas++
			if pesos {
				r.Cobrado += c.Total
			}
		}
	})
	return r, nil
}

func (m *Memoria) Uso(_ context.Context, cuentaID int64, desde, hasta string) (Uso, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var u Uso
	m.delPeriodo(cuentaID, desde, hasta, func(c Comprobante) {
		switch c.Tipo {
		case 1, 6, 11, 51:
			u.Facturas++
		case 19:
			u.Exportacion++
		}
	})
	return u, nil
}

var _ Datos = (*Memoria)(nil)
