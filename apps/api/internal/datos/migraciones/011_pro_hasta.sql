-- Al dar de baja Pro, la cuenta sigue en Pro hasta el final del período que ya pagó.
alter table facti.cuentas add column if not exists pro_hasta date;
