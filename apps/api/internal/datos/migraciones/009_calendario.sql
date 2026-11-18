-- Link privado para suscribirse al calendario de Facti (Google Calendar, iPhone, Outlook).
-- Quien tenga el link ve los vencimientos de la cuenta: se puede renovar para invalidar el anterior.
alter table facti.cuentas add column if not exists calendario_token text unique;
