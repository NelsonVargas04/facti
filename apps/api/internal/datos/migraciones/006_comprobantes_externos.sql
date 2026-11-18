-- Comprobantes emitidos fuera de Facti (en la web de ARCA o con otra app), importados del archivo de
-- "Mis Comprobantes – Emitidos". Solo sirven para sumar la facturación de los últimos 12 meses
-- (topes del monotributo): no tienen ítems ni cobro. Los que ya están en facti.comprobantes no se importan.
create table if not exists facti.comprobantes_externos (
  id bigserial primary key,
  cuenta_id bigint not null references facti.cuentas (id) on delete cascade,
  fecha date not null,
  tipo int not null,
  punto_venta int not null,
  numero bigint not null,
  numero_hasta bigint not null,
  cod_autorizacion text not null default '',
  receptor_doc_tipo int not null default 0,
  receptor_doc_nro text not null default '',
  receptor_nombre text not null default '',
  moneda text not null default 'PES',
  cotizacion numeric(18, 6) not null default 1,
  importe_total numeric(18, 2) not null,
  -- En pesos y con signo (las notas de crédito restan).
  importe_pesos numeric(18, 2) not null,
  importado_en timestamptz not null default now(),
  unique (cuenta_id, tipo, punto_venta, numero)
);

create index if not exists comprobantes_externos_fecha on facti.comprobantes_externos (cuenta_id, fecha);

-- Solo la API las lee y escribe.
alter table facti.comprobantes_externos enable row level security;
