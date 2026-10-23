-- Esquema inicial de Facti.
-- Todo vive en el esquema "facti" (no en "public"): en Supabase solo "public" se expone por la
-- Data API, así que estas tablas no quedan accesibles desde afuera con la clave anónima.

create table facti.cuentas (
  id                 bigint generated always as identity primary key,
  cuit               text not null unique,
  nombre             text not null default '',
  domicilio          text not null default '',
  condicion          text not null default '',
  categoria          text not null default '',
  ingresos_brutos    text not null default '',
  inicio_actividades date,
  punto_venta        int  not null,
  plan               text not null default 'gratis' check (plan in ('gratis', 'pro')),
  creada_en          timestamptz not null default now()
);

create table facti.clientes (
  id               bigint generated always as identity primary key,
  cuenta_id        bigint not null references facti.cuentas (id),
  doc_tipo         int  not null,
  doc_nro          text not null,
  nombre           text not null default '',
  condicion_iva_id int  not null,
  condicion        text not null default '',
  domicilio        text not null default '',
  email            text not null default '',
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  unique (cuenta_id, doc_tipo, doc_nro)
);

-- Comprobantes autorizados por ARCA. No se borran: se guardan 10 años con su respuesta original.
create table facti.comprobantes (
  id                        bigint generated always as identity primary key,
  cuenta_id                 bigint not null references facti.cuentas (id),
  cliente_id                bigint references facti.clientes (id),
  tipo                      int    not null,
  punto_venta               int    not null,
  numero                    bigint not null,
  fecha                     date   not null,
  concepto                  int    not null,
  moneda                    text   not null default 'PES',
  cotizacion                numeric(18, 6) not null default 1,
  importe_total             numeric(15, 2) not null,
  importe_neto              numeric(15, 2) not null,
  importe_iva               numeric(15, 2) not null default 0,
  cae                       text not null,
  cae_vto                   date,
  qr_url                    text not null,
  periodo_desde             date,
  periodo_hasta             date,
  vto_pago                  date,
  condicion_venta           text not null default '',
  receptor_doc_tipo         int  not null,
  receptor_doc_nro          text not null,
  receptor_nombre           text not null default '',
  receptor_condicion_iva_id int  not null,
  receptor_condicion        text not null default '',
  receptor_domicilio        text not null default '',
  receptor_email            text not null default '',
  cobro                     text not null default '' check (cobro in ('', 'pendiente', 'cobrada')),
  cobrada_en                timestamptz,
  respuesta_arca            text not null,
  creado_en                 timestamptz not null default now(),
  unique (cuenta_id, tipo, punto_venta, numero)
);

create index comprobantes_cuenta_fecha on facti.comprobantes (cuenta_id, fecha desc, id desc);
create index comprobantes_cliente on facti.comprobantes (cliente_id);

create table facti.items (
  comprobante_id  bigint not null references facti.comprobantes (id),
  orden           int    not null,
  descripcion     text   not null,
  cantidad        numeric(15, 4) not null,
  unidad          text   not null default '',
  precio_unitario numeric(15, 2) not null,
  subtotal        numeric(15, 2) not null,
  primary key (comprobante_id, orden)
);
