-- Suscripción a Facti Pro, cobrada por Mercado Pago (una por cuenta: la última).
-- Facti no guarda datos de tarjetas: solo marca, últimos 4 y vencimiento, que informa Mercado Pago.
create table if not exists facti.suscripciones (
  cuenta_id bigint primary key references facti.cuentas (id) on delete cascade,
  mp_id text not null unique,
  estado text not null, -- pending, authorized, paused, cancelled (los de Mercado Pago)
  importe numeric(18, 2) not null, -- en pesos, lo que cobra Mercado Pago cada mes
  precio_usd numeric(18, 2) not null,
  cotizacion numeric(18, 4) not null, -- dólar BCRA usado para pasar a pesos
  proximo_cobro date,
  medio text not null default '', -- visa, master, account_money…
  ultimos text not null default '',
  vence text not null default '', -- MM/AA
  actualizada_en timestamptz not null default now()
);

-- Cobros mensuales de la suscripción (se guardan para el historial y por 10 años).
create table if not exists facti.pagos_facti (
  id bigserial primary key,
  cuenta_id bigint not null references facti.cuentas (id) on delete cascade,
  mp_id text not null unique, -- id del cobro mensual (authorized_payment)
  fecha date not null,
  importe numeric(18, 2) not null,
  moneda text not null default 'ARS',
  estado text not null, -- aprobado, rechazado, pendiente
  medio text not null default '',
  ultimos text not null default ''
);

create index if not exists pagos_facti_cuenta on facti.pagos_facti (cuenta_id, fecha desc);

alter table facti.suscripciones enable row level security;
alter table facti.pagos_facti enable row level security;
