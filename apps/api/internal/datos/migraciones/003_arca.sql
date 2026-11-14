-- Tickets de acceso del WSAA (ARCA). En Vercel cada instancia de la API arranca vacía:
-- se guardan acá para no pedir uno nuevo mientras el anterior sigue vigente (el WSAA lo rechaza).
create table if not exists facti.tickets_acceso (
  clave text primary key,          -- entorno-cuit del certificado-servicio
  ticket jsonb not null,           -- token, sign y vencimiento
  actualizado_en timestamptz not null default now()
);

-- Solo la API (conexión directa con la contraseña de la base) los lee: nadie desde el navegador.
alter table facti.tickets_acceso enable row level security;
