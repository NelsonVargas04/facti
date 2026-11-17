-- Número interno corto de cada comprobante (#1, #2, #3…), correlativo por cuenta. Sirve para mostrar
-- y buscar en la app sin el número oficial largo (00001-00000110), que sigue en el comprobante y el PDF.
alter table facti.comprobantes add column if not exists numero_interno integer;

update facti.comprobantes c set numero_interno = n.fila
from (select id, row_number() over (partition by cuenta_id order by creado_en, id) as fila from facti.comprobantes) n
where c.id = n.id and c.numero_interno is null;

alter table facti.comprobantes alter column numero_interno set not null;

create unique index if not exists comprobantes_numero_interno on facti.comprobantes (cuenta_id, numero_interno);
