-- Una cuenta por usuario de Supabase Auth (Google o email).
-- El CUIT se carga después, en el onboarding: hasta entonces queda vacío.

alter table facti.cuentas
  add column usuario_id uuid unique,
  add column email text not null default '';

alter table facti.cuentas alter column cuit drop not null;
