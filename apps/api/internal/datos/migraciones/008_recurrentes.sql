-- Facturas recurrentes: "todos los meses el día X, facturale a este cliente esto".
-- La plantilla es el mismo pedido de emisión de la web (cliente, concepto, ítems), sin las fechas:
-- al emitir se usan las del día. Modo "confirmar" (Facti avisa y el usuario emite con un toque)
-- o "automática" (la API la emite sola el día que toca).
create table if not exists facti.recurrentes (
  id bigserial primary key,
  cuenta_id bigint not null references facti.cuentas (id) on delete cascade,
  cliente text not null default '',
  total numeric(18, 2) not null default 0,
  plantilla jsonb not null,
  dia int not null check (dia between 1 and 28),
  proxima date not null,
  automatica boolean not null default false,
  activa boolean not null default true,
  ultima_emision date,
  ultimo_comprobante_id bigint references facti.comprobantes (id) on delete set null,
  ultimo_error text not null default '',
  creada_en timestamptz not null default now()
);

create index if not exists recurrentes_cuenta on facti.recurrentes (cuenta_id);
create index if not exists recurrentes_proxima on facti.recurrentes (proxima) where activa;

alter table facti.recurrentes enable row level security;
