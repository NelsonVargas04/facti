-- Pedidos del "Botón de arrepentimiento" y del "Botón de baja de servicio" (Ley 24.240, art. 10 ter y 34;
-- Disposición SSDCyLC 954/2025). Se pueden hacer sin sesión; cada uno tiene un código que se le da al
-- consumidor en el momento. Se guardan como constancia.
create table if not exists facti.solicitudes_consumidor (
  id bigserial primary key,
  codigo text not null unique,
  tipo text not null check (tipo in ('arrepentimiento', 'baja')),
  nombre text not null,
  email text not null,
  cuit text not null default '',
  detalle text not null default '',
  usuario_id uuid,                       -- si la hizo con la sesión iniciada
  estado text not null default 'recibida' check (estado in ('recibida', 'resuelta')),
  creada_en timestamptz not null default now(),
  resuelta_en timestamptz
);

create index if not exists solicitudes_consumidor_email on facti.solicitudes_consumidor (lower(email));

-- Solo la API las lee y escribe.
alter table facti.solicitudes_consumidor enable row level security;
