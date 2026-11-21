package datos

import (
	"context"
	"time"

	"facti/api/internal/arca"
)

// MetricasAdmin son los números globales de Facti (todas las cuentas) para el portal de administración.
// No incluyen datos personales: solo conteos e importes agregados.
type MetricasAdmin struct {
	Cuentas         int // cuentas creadas
	CuentasConCuit  int // terminaron el onboarding
	CuentasPro      int // con Pro vigente (incluye las que dieron de baja y siguen hasta fin de mes)
	CuentasActivas  int // emitieron al menos un comprobante en los últimos 30 días
	ComprobantesMes int // emitidos en el mes en curso
	Comprobantes30d int
	// Cobros de Facti Pro en el mes en curso (Mercado Pago, en pesos).
	CobradoMes      float64
	PagosPendientes int
	PagosRechazados int
	// MRR: suma de lo que cobra por mes cada suscripción autorizada (en pesos).
	MRR float64
	// BytesBase: tamaño de las tablas del esquema facti (0 si no se puede medir).
	BytesBase int64
}

// Admin lee las métricas globales. La implementan Memoria y Postgres.
type Admin interface {
	// MetricasAdmin calcula las métricas al día hoy (AAAA-MM-DD, hora de Argentina).
	MetricasAdmin(ctx context.Context, hoy string) (MetricasAdmin, error)
}

// rangoAdmin devuelve el primer día del mes y el día de hace 30 días (AAAA-MM-DD).
func rangoAdmin(hoy string) (inicioMes, hace30 string, err error) {
	d, err := time.ParseInLocation("2006-01-02", hoy, arca.HoraArgentina)
	if err != nil {
		return "", "", err
	}
	return d.Format("2006-01") + "-01", d.AddDate(0, 0, -30).Format("2006-01-02"), nil
}

// ---------- Memoria ----------

func (m *Memoria) MetricasAdmin(_ context.Context, hoy string) (MetricasAdmin, error) {
	inicioMes, hace30, err := rangoAdmin(hoy)
	if err != nil {
		return MetricasAdmin{}, err
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	var r MetricasAdmin
	for _, c := range m.cuentas {
		r.Cuentas++
		if c.Cuit != "" {
			r.CuentasConCuit++
		}
		if m.vigente(c).Plan == PlanPro {
			r.CuentasPro++
		}
	}
	activas := map[int64]bool{}
	for _, x := range m.comprobantes {
		if x.v.Fecha >= inicioMes && x.v.Fecha <= hoy {
			r.ComprobantesMes++
		}
		if x.v.Fecha > hace30 && x.v.Fecha <= hoy {
			r.Comprobantes30d++
			activas[x.cuentaID] = true
		}
	}
	r.CuentasActivas = len(activas)
	for _, s := range m.suscripciones {
		if s.Estado == SuscripcionAutorizada {
			r.MRR += s.Importe
		}
	}
	for _, x := range m.pagosFacti {
		if x.v.Fecha < inicioMes || x.v.Fecha > hoy {
			continue
		}
		switch x.v.Estado {
		case "aprobado":
			r.CobradoMes += x.v.Importe
		case "pendiente":
			r.PagosPendientes++
		case "rechazado":
			r.PagosRechazados++
		}
	}
	return r, nil
}

// ---------- Postgres ----------

func (p *Postgres) MetricasAdmin(ctx context.Context, hoy string) (MetricasAdmin, error) {
	inicioMes, hace30, err := rangoAdmin(hoy)
	if err != nil {
		return MetricasAdmin{}, err
	}
	var r MetricasAdmin
	err = p.pool.QueryRow(ctx, `
		select
			(select count(*) from facti.cuentas),
			(select count(*) from facti.cuentas where cuit is not null and cuit <> ''),
			(select count(*) from facti.cuentas where plan = 'pro' or pro_hasta >= $1::date),
			(select count(distinct cuenta_id) from facti.comprobantes where fecha > $3::date and fecha <= $1::date),
			(select count(*) from facti.comprobantes where fecha >= $2::date and fecha <= $1::date),
			(select count(*) from facti.comprobantes where fecha > $3::date and fecha <= $1::date),
			(select coalesce(sum(importe), 0)::float8 from facti.pagos_facti
				where estado = 'aprobado' and fecha >= $2::date and fecha <= $1::date),
			(select count(*) from facti.pagos_facti where estado = 'pendiente' and fecha >= $2::date and fecha <= $1::date),
			(select count(*) from facti.pagos_facti where estado = 'rechazado' and fecha >= $2::date and fecha <= $1::date),
			(select coalesce(sum(importe), 0)::float8 from facti.suscripciones where estado = $4)`,
		hoy, inicioMes, hace30, SuscripcionAutorizada,
	).Scan(&r.Cuentas, &r.CuentasConCuit, &r.CuentasPro, &r.CuentasActivas, &r.ComprobantesMes, &r.Comprobantes30d,
		&r.CobradoMes, &r.PagosPendientes, &r.PagosRechazados, &r.MRR)
	if err != nil {
		return r, err
	}
	// El tamaño es opcional: si el usuario de la base no puede leerlo, se informa 0.
	_ = p.pool.QueryRow(ctx, `
		select coalesce(sum(pg_total_relation_size(c.oid)), 0)::bigint
		from pg_class c join pg_namespace n on n.oid = c.relnamespace
		where n.nspname = 'facti' and c.relkind = 'r'`).Scan(&r.BytesBase)
	return r, nil
}
