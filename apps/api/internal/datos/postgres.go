package datos

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"net/url"
	"sort"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migraciones/*.sql
var migraciones embed.FS

// Postgres guarda los datos en PostgreSQL (en producción, Supabase).
type Postgres struct {
	pool *pgxpool.Pool
}

// Conectar abre el pool y aplica las migraciones pendientes.
func Conectar(ctx context.Context, databaseURL string) (*Postgres, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("DATABASE_URL inválida: %w", err)
	}
	// El pooler de Supabase en modo transacción (puerto 6543) no soporta sentencias preparadas.
	if u, err := url.Parse(databaseURL); err == nil && u.Port() == "6543" {
		cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	}
	cfg.MaxConns = 10
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("no se pudo conectar a la base de datos: %w", err)
	}
	p := &Postgres{pool: pool}
	if err := p.migrar(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return p, nil
}

func (p *Postgres) Cerrar() { p.pool.Close() }

// migrar aplica en orden los archivos de migraciones/ que todavía no se aplicaron.
func (p *Postgres) migrar(ctx context.Context) error {
	archivos, err := fs.Glob(migraciones, "migraciones/*.sql")
	if err != nil {
		return err
	}
	sort.Strings(archivos)

	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	// Evita que dos instancias de la API migren a la vez.
	if _, err := tx.Exec(ctx, `select pg_advisory_xact_lock(4207117)`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `create schema if not exists facti;
		create table if not exists facti.migraciones (
			version text primary key,
			aplicada_en timestamptz not null default now()
		)`); err != nil {
		return fmt.Errorf("no se pudo preparar el esquema facti: %w", err)
	}
	for _, a := range archivos {
		version := strings.TrimSuffix(strings.TrimPrefix(a, "migraciones/"), ".sql")
		var ya bool
		if err := tx.QueryRow(ctx, `select exists(select 1 from facti.migraciones where version = $1)`, version).Scan(&ya); err != nil {
			return err
		}
		if ya {
			continue
		}
		sql, err := migraciones.ReadFile(a)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, string(sql)); err != nil {
			return fmt.Errorf("migración %s: %w", version, err)
		}
		if _, err := tx.Exec(ctx, `insert into facti.migraciones (version) values ($1)`, version); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// nulo convierte "" en NULL para columnas de fecha.
func nulo(s string) any {
	if s == "" {
		return nil
	}
	return s
}

const columnasCuenta = `id, cuit, nombre, domicilio, condicion, categoria, ingresos_brutos,
	coalesce(to_char(inicio_actividades, 'YYYY-MM-DD'), ''), punto_venta, plan, creada_en`

func scanCuenta(row pgx.Row) (Cuenta, error) {
	var c Cuenta
	err := row.Scan(&c.ID, &c.Cuit, &c.Nombre, &c.Domicilio, &c.Condicion, &c.Categoria, &c.IngresosBrutos,
		&c.InicioActividades, &c.PuntoVenta, &c.Plan, &c.CreadaEn)
	if errors.Is(err, pgx.ErrNoRows) {
		return c, ErrNoEncontrado
	}
	return c, err
}

func (p *Postgres) AsegurarCuenta(ctx context.Context, cuit string, puntoVenta int) (Cuenta, error) {
	// "on conflict do update" con el mismo valor para que devuelva la fila también si ya existía.
	return scanCuenta(p.pool.QueryRow(ctx, `
		insert into facti.cuentas (cuit, punto_venta) values ($1, $2)
		on conflict (cuit) do update set punto_venta = excluded.punto_venta
		returning `+columnasCuenta, cuit, puntoVenta))
}

func (p *Postgres) ActualizarPerfil(ctx context.Context, cuentaID int64, pf Perfil) (Cuenta, error) {
	return scanCuenta(p.pool.QueryRow(ctx, `
		update facti.cuentas set nombre = $2, domicilio = $3, condicion = $4, categoria = $5
		where id = $1 returning `+columnasCuenta, cuentaID, pf.Nombre, pf.Domicilio, pf.Condicion, pf.Categoria))
}

func (p *Postgres) GuardarComprobante(ctx context.Context, cuentaID int64, c *Comprobante) error {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	r := &c.Receptor
	if r.Identificado() {
		var id int64
		var nombre, condicion, domicilio, email string
		err := tx.QueryRow(ctx, `
			insert into facti.clientes (cuenta_id, doc_tipo, doc_nro, nombre, condicion_iva_id, condicion, domicilio, email)
			values ($1, $2, $3, $4, $5, $6, $7, $8)
			on conflict (cuenta_id, doc_tipo, doc_nro) do update set
				nombre = coalesce(nullif(excluded.nombre, ''), facti.clientes.nombre),
				condicion_iva_id = excluded.condicion_iva_id,
				condicion = coalesce(nullif(excluded.condicion, ''), facti.clientes.condicion),
				domicilio = coalesce(nullif(excluded.domicilio, ''), facti.clientes.domicilio),
				email = coalesce(nullif(excluded.email, ''), facti.clientes.email),
				actualizado_en = now()
			returning id, nombre, condicion, domicilio, email`,
			cuentaID, r.DocTipo, r.DocNro, r.Nombre, r.CondicionIvaID, r.Condicion, r.Domicilio, r.Email).
			Scan(&id, &nombre, &condicion, &domicilio, &email)
		if err != nil {
			return fmt.Errorf("guardar cliente: %w", err)
		}
		c.ClienteID = &id
		completarReceptor(r, nombre, condicion, domicilio, email)
	}

	var desde, hasta, vto string
	if c.Periodo != nil {
		desde, hasta, vto = c.Periodo.Desde, c.Periodo.Hasta, c.Periodo.VtoPago
	}
	err = tx.QueryRow(ctx, `
		insert into facti.comprobantes (
			cuenta_id, cliente_id, tipo, punto_venta, numero, fecha, concepto, moneda, cotizacion,
			importe_total, importe_neto, importe_iva, cae, cae_vto, qr_url,
			periodo_desde, periodo_hasta, vto_pago, condicion_venta,
			receptor_doc_tipo, receptor_doc_nro, receptor_nombre, receptor_condicion_iva_id,
			receptor_condicion, receptor_domicilio, receptor_email, cobro, respuesta_arca)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
			$20, $21, $22, $23, $24, $25, $26, $27, $28)
		returning id, creado_en`,
		cuentaID, c.ClienteID, c.Tipo, c.PuntoVenta, c.Numero, c.Fecha, c.Concepto, c.Moneda, c.Cotizacion,
		c.Total, c.Neto, c.IVA, c.CAE, nulo(c.CAEVto), c.QR,
		nulo(desde), nulo(hasta), nulo(vto), c.CondicionVenta,
		r.DocTipo, r.DocNro, r.Nombre, r.CondicionIvaID, r.Condicion, r.Domicilio, r.Email,
		string(c.Cobro), c.Respuesta,
	).Scan(&c.ID, &c.CreadoEn)
	if err != nil {
		return fmt.Errorf("guardar comprobante: %w", err)
	}
	for i, it := range c.Items {
		if _, err := tx.Exec(ctx, `
			insert into facti.items (comprobante_id, orden, descripcion, cantidad, unidad, precio_unitario, subtotal)
			values ($1, $2, $3, $4, $5, $6, $7)`,
			c.ID, i+1, it.Descripcion, it.Cantidad, it.Unidad, it.PrecioUnitario, it.Subtotal); err != nil {
			return fmt.Errorf("guardar ítem %d: %w", i+1, err)
		}
	}
	return tx.Commit(ctx)
}

const columnasComprobante = `c.id, c.tipo, c.punto_venta, c.numero, to_char(c.fecha, 'YYYY-MM-DD'), c.concepto,
	c.moneda, c.cotizacion::float8, c.importe_total::float8, c.importe_neto::float8, c.importe_iva::float8,
	c.cae, coalesce(to_char(c.cae_vto, 'YYYY-MM-DD'), ''), c.qr_url,
	coalesce(to_char(c.periodo_desde, 'YYYY-MM-DD'), ''), coalesce(to_char(c.periodo_hasta, 'YYYY-MM-DD'), ''),
	coalesce(to_char(c.vto_pago, 'YYYY-MM-DD'), ''), c.condicion_venta,
	c.receptor_doc_tipo, c.receptor_doc_nro, c.receptor_nombre, c.receptor_condicion_iva_id,
	c.receptor_condicion, c.receptor_domicilio, c.receptor_email, c.cliente_id, c.cobro, c.cobrada_en, c.creado_en`

func scanComprobante(row pgx.Row) (Comprobante, error) {
	var c Comprobante
	var desde, hasta, vto, cobro string
	r := &c.Receptor
	err := row.Scan(&c.ID, &c.Tipo, &c.PuntoVenta, &c.Numero, &c.Fecha, &c.Concepto,
		&c.Moneda, &c.Cotizacion, &c.Total, &c.Neto, &c.IVA,
		&c.CAE, &c.CAEVto, &c.QR, &desde, &hasta, &vto, &c.CondicionVenta,
		&r.DocTipo, &r.DocNro, &r.Nombre, &r.CondicionIvaID, &r.Condicion, &r.Domicilio, &r.Email,
		&c.ClienteID, &cobro, &c.CobradaEn, &c.CreadoEn)
	if errors.Is(err, pgx.ErrNoRows) {
		return c, ErrNoEncontrado
	}
	if err != nil {
		return c, err
	}
	if desde != "" {
		c.Periodo = &Periodo{Desde: desde, Hasta: hasta, VtoPago: vto}
	}
	c.Cobro = Cobro(cobro)
	completarSigla(&c)
	return c, nil
}

func (p *Postgres) Comprobante(ctx context.Context, cuentaID, id int64) (Comprobante, error) {
	c, err := scanComprobante(p.pool.QueryRow(ctx,
		`select `+columnasComprobante+` from facti.comprobantes c where c.cuenta_id = $1 and c.id = $2`, cuentaID, id))
	if err != nil {
		return c, err
	}
	filas, err := p.pool.Query(ctx, `
		select descripcion, cantidad::float8, unidad, precio_unitario::float8, subtotal::float8
		from facti.items where comprobante_id = $1 order by orden`, id)
	if err != nil {
		return c, err
	}
	c.Items, err = pgx.CollectRows(filas, func(r pgx.CollectableRow) (Item, error) {
		var it Item
		err := r.Scan(&it.Descripcion, &it.Cantidad, &it.Unidad, &it.PrecioUnitario, &it.Subtotal)
		return it, err
	})
	return c, err
}

// ordenes posibles del listado. El id desempata para que la paginación sea estable.
var ordenes = map[string]string{
	"reciente": "c.fecha desc, c.id desc",
	"antigua":  "c.fecha asc, c.id asc",
	"cliente":  "lower(c.receptor_nombre) asc, c.fecha desc, c.id desc",
	"numero":   "c.punto_venta asc, c.numero asc, c.id asc",
	"mayor":    "c.importe_total desc, c.id desc",
	"menor":    "c.importe_total asc, c.id asc",
}

func (p *Postgres) ListarComprobantes(ctx context.Context, cuentaID int64, f Filtro) (Pagina, error) {
	where := []string{"c.cuenta_id = $1"}
	args := []any{cuentaID}
	agregar := func(cond string, v any) {
		args = append(args, v)
		where = append(where, strings.ReplaceAll(cond, "?", "$"+strconv.Itoa(len(args))))
	}
	if f.Desde != "" {
		agregar("c.fecha >= ?::date", f.Desde)
	}
	if f.Hasta != "" {
		agregar("c.fecha <= ?::date", f.Hasta)
	}
	if f.Cobro != "" {
		agregar("c.cobro = ?", string(f.Cobro))
	}
	if q := strings.TrimSpace(f.Q); q != "" {
		agregar(`(c.receptor_nombre ilike ? or c.receptor_doc_nro like ?
			or lpad(c.punto_venta::text, 5, '0') || '-' || lpad(c.numero::text, 8, '0') like ?)`, "%"+escaparLike(q)+"%")
	}
	orden, ok := ordenes[f.Orden]
	if !ok {
		orden = ordenes["reciente"]
	}
	limite := f.Limite
	if limite <= 0 || limite > 200 {
		limite = 50
	}

	condicion := strings.Join(where, " and ")
	var pag Pagina
	if err := p.pool.QueryRow(ctx, `select count(*) from facti.comprobantes c where `+condicion, args...).Scan(&pag.Total); err != nil {
		return pag, err
	}
	filas, err := p.pool.Query(ctx, fmt.Sprintf(`select %s from facti.comprobantes c where %s order by %s limit %d offset %d`,
		columnasComprobante, condicion, orden, limite, max(f.Saltar, 0)), args...)
	if err != nil {
		return pag, err
	}
	pag.Comprobantes, err = pgx.CollectRows(filas, func(r pgx.CollectableRow) (Comprobante, error) { return scanComprobante(r) })
	if pag.Comprobantes == nil {
		pag.Comprobantes = []Comprobante{}
	}
	return pag, err
}

func escaparLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

func (p *Postgres) MarcarCobro(ctx context.Context, cuentaID, id int64, cobro Cobro) (Comprobante, error) {
	tag, err := p.pool.Exec(ctx, `
		update facti.comprobantes
		set cobro = $3, cobrada_en = case when $3 = 'cobrada' then now() else null end
		where cuenta_id = $1 and id = $2 and cobro <> ''`, cuentaID, id, string(cobro))
	if err != nil {
		return Comprobante{}, err
	}
	if tag.RowsAffected() == 0 {
		return Comprobante{}, ErrNoEncontrado
	}
	return p.Comprobante(ctx, cuentaID, id)
}

// firmado es el importe en pesos con signo (las notas de crédito restan). Solo cuenta pesos.
const firmado = `case when c.moneda <> 'PES' then 0
	when c.tipo in (3, 8, 13, 53) then -c.importe_total else c.importe_total end`

func (p *Postgres) ListarClientes(ctx context.Context, cuentaID int64, q string) ([]Cliente, error) {
	args := []any{cuentaID}
	filtro := ""
	if q = strings.TrimSpace(q); q != "" {
		args = append(args, "%"+escaparLike(q)+"%")
		filtro = " and (cl.nombre ilike $2 or cl.doc_nro like $2)"
	}
	filas, err := p.pool.Query(ctx, `
		select cl.id, cl.doc_tipo, cl.doc_nro, cl.nombre, cl.condicion_iva_id, cl.condicion, cl.domicilio, cl.email,
			count(c.id)::int,
			coalesce(sum(`+firmado+`), 0)::float8,
			coalesce(sum(case when c.cobro = 'pendiente' and c.moneda = 'PES' then c.importe_total else 0 end), 0)::float8,
			coalesce(to_char(max(c.fecha), 'YYYY-MM-DD'), '')
		from facti.clientes cl
		left join facti.comprobantes c on c.cliente_id = cl.id
		where cl.cuenta_id = $1`+filtro+`
		group by cl.id
		order by max(c.fecha) desc nulls last, lower(cl.nombre)`, args...)
	if err != nil {
		return nil, err
	}
	clientes, err := pgx.CollectRows(filas, func(r pgx.CollectableRow) (Cliente, error) {
		var c Cliente
		err := r.Scan(&c.ID, &c.DocTipo, &c.DocNro, &c.Nombre, &c.CondicionIvaID, &c.Condicion, &c.Domicilio, &c.Email,
			&c.Comprobantes, &c.Facturado, &c.PorCobrar, &c.Ultimo)
		return c, err
	})
	if clientes == nil {
		clientes = []Cliente{}
	}
	return clientes, err
}

func (p *Postgres) Resumen(ctx context.Context, cuentaID int64, desde, hasta string) (Resumen, error) {
	var r Resumen
	err := p.pool.QueryRow(ctx, `
		select
			coalesce(sum(`+firmado+`), 0)::float8,
			count(*)::int,
			coalesce(sum(case when c.cobro = 'pendiente' and c.moneda = 'PES' then c.importe_total else 0 end), 0)::float8,
			count(*) filter (where c.cobro = 'pendiente')::int,
			coalesce(sum(case when c.cobro = 'cobrada' and c.moneda = 'PES' then c.importe_total else 0 end), 0)::float8,
			count(*) filter (where c.cobro = 'cobrada')::int
		from facti.comprobantes c
		where c.cuenta_id = $1 and c.fecha between $2::date and $3::date`, cuentaID, desde, hasta).
		Scan(&r.Facturado, &r.Emitidos, &r.PorCobrar, &r.Pendientes, &r.Cobrado, &r.Cobradas)
	return r, err
}

func (p *Postgres) Uso(ctx context.Context, cuentaID int64, desde, hasta string) (Uso, error) {
	var u Uso
	err := p.pool.QueryRow(ctx, `
		select count(*) filter (where tipo in (1, 6, 11, 51))::int, count(*) filter (where tipo = 19)::int
		from facti.comprobantes
		where cuenta_id = $1 and fecha between $2::date and $3::date`, cuentaID, desde, hasta).Scan(&u.Facturas, &u.Exportacion)
	return u, err
}

var _ Datos = (*Postgres)(nil)
