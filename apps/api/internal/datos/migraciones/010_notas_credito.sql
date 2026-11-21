-- Notas de crédito: cada una apunta a la factura que anula o corrige.
alter table facti.comprobantes
  add column if not exists asociado_id bigint references facti.comprobantes (id);

create index if not exists comprobantes_asociado_idx on facti.comprobantes (asociado_id) where asociado_id is not null;
