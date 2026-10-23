import type { DatosComprobanteC } from '@/components/ComprobanteC';
import { condicionTexto, type Comprobante, type Cuenta } from '@/lib/api';
import { fecha, formatearCuit } from '@/lib/formato';

const TITULOS: Record<string, { titulo: string; cod: string }> = {
  C: { titulo: 'FACTURA', cod: '011' },
  ND: { titulo: 'NOTA DE DÉBITO', cod: '012' },
  NC: { titulo: 'NOTA DE CRÉDITO', cod: '013' },
};

/** Arma los datos del comprobante oficial (formato ARCA) a partir de lo guardado en la API. */
export function datosComprobante(c: Comprobante, emisor: Cuenta): DatosComprobanteC {
  const t = TITULOS[c.sigla] ?? TITULOS.C!;
  const r = c.receptor;
  const identificado = r.docNro && r.docNro !== '0';
  return {
    letra: 'C',
    titulo: t.titulo,
    cod: t.cod,
    emisor: {
      razonSocial: emisor.nombre || formatearCuit(emisor.cuit),
      domicilio: emisor.domicilio || '—',
      cuit: emisor.cuit,
      ingresosBrutos: emisor.ingresosBrutos || '—',
      inicioActividades: emisor.inicioActividades ? fecha(emisor.inicioActividades) : '—',
    },
    puntoVenta: c.puntoVenta,
    numero: c.numero,
    fechaEmision: fecha(c.fecha),
    periodo: c.periodo ? { desde: fecha(c.periodo.desde), hasta: fecha(c.periodo.hasta), vtoPago: fecha(c.periodo.vtoPago) } : undefined,
    receptor: {
      cuit: identificado ? r.docNro : '',
      nombre: r.nombre || (identificado ? r.docNro : 'Consumidor final'),
      condicionIva: condicionTexto(r),
      domicilio: r.domicilio || '—',
      condicionVenta: c.condicionVenta || '—',
    },
    items: (c.items ?? []).map((it) => ({ descripcion: it.descripcion, cantidad: it.cantidad, unidad: it.unidad || undefined, precioUnitario: it.precioUnitario })),
    cae: c.cae,
    caeVto: fecha(c.caeVto),
    qrUrl: c.qr,
  };
}

/** Nombre a mostrar del cliente de un comprobante. */
export function nombreCliente(c: Comprobante): string {
  const r = c.receptor;
  if (r.nombre) return r.nombre;
  return r.docNro && r.docNro !== '0' ? formatearCuit(r.docNro) : 'Consumidor final';
}
