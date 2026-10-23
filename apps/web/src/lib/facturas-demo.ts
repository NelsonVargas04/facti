import type { DatosComprobanteC } from '@/components/ComprobanteC';

export interface FacturaRow {
  tipo: string; // C, A, B, M, E, NC, ND
  num: string;
  cliente: string;
  fecha: string;
  total: string; // ya formateado; negativo empieza con "-"
  arca: 'Autorizada' | 'En espera' | 'Rechazada';
  cobro: 'Cobrada' | 'Pendiente' | '—';
}

export const FACTURAS_DEMO: FacturaRow[] = [
  { tipo: 'C', num: '00003-00000128', cliente: 'Estudio Lumen SRL', fecha: '12/10', total: '$85.000', arca: 'Autorizada', cobro: 'Cobrada' },
  { tipo: 'C', num: '00003-00000127', cliente: 'Martín Gómez', fecha: '10/10', total: '$42.500', arca: 'Autorizada', cobro: 'Pendiente' },
  { tipo: 'C', num: '00003-00000126', cliente: 'Café Aroma SAS', fecha: '08/10', total: '$120.000', arca: 'Autorizada', cobro: 'Cobrada' },
  { tipo: 'NC', num: '00003-00000004', cliente: 'Café Aroma SAS', fecha: '08/10', total: '-$15.000', arca: 'Autorizada', cobro: '—' },
  { tipo: 'C', num: '00003-00000125', cliente: 'Fundación Raíces', fecha: '03/10', total: '$210.000', arca: 'Autorizada', cobro: 'Pendiente' },
  { tipo: 'E', num: '00002-00000014', cliente: 'Northwind Labs LLC', fecha: '02/10', total: 'USD 1.200', arca: 'Autorizada', cobro: 'Cobrada' },
  { tipo: 'C', num: '00003-00000124', cliente: 'Martín Gómez', fecha: '28/09', total: '$42.500', arca: 'Autorizada', cobro: 'Cobrada' },
  { tipo: 'C', num: '00003-00000123', cliente: 'Estudio Lumen SRL', fecha: '20/09', total: '$68.000', arca: 'Autorizada', cobro: 'Cobrada' },
  { tipo: 'C', num: '00003-00000122', cliente: 'Verde Vivero', fecha: '15/09', total: '$33.000', arca: 'En espera', cobro: 'Pendiente' },
];

export function buscarFacturaDemo(numero: string): FacturaRow | undefined {
  return FACTURAS_DEMO.find((f) => f.num === numero);
}

const EMISOR = {
  razonSocial: 'FERNÁNDEZ LUCÍA',
  domicilio: 'Av. Rivadavia 5100, Piso 3 B - CABA',
  cuit: '27314567894',
  ingresosBrutos: '27314567894',
  inicioActividades: '01/03/2019',
};

export function montoDe(total: string): number {
  const limpio = total.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  return Math.abs(parseFloat(limpio)) || 0;
}

/** Arma los datos del comprobante oficial a partir de una fila (demo). */
export function datosComprobante(f: FacturaRow): DatosComprobanteC {
  const [pv, n] = f.num.split('-');
  const esNC = f.tipo === 'NC';
  return {
    letra: esNC ? 'C' : f.tipo,
    titulo: esNC ? 'NOTA DE CRÉDITO' : 'FACTURA',
    cod: esNC ? '013' : '011',
    emisor: EMISOR,
    puntoVenta: Number(pv) || 0,
    numero: Number(n) || 0,
    fechaEmision: `${f.fecha}/2026`,
    receptor: {
      cuit: '30715896327',
      nombre: f.cliente,
      condicionIva: 'IVA Responsable Inscripto',
      domicilio: '—',
      condicionVenta: 'Transferencia bancaria',
    },
    items: [{ descripcion: 'Servicios profesionales', cantidad: 1, precioUnitario: montoDe(f.total) }],
    cae: '76419283746521',
    caeVto: '22/10/2026',
    qrUrl: 'https://www.arca.gob.ar/fe/qr/?p=ejemplo',
  };
}
