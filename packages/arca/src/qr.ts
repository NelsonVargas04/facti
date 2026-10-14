/**
 * Datos del código QR según la especificación de ARCA:
 * https://www.afip.gob.ar/fe/qr/documentos/QRespecificaciones.pdf
 */
export interface DatosQR {
  fecha: string; // AAAA-MM-DD
  cuit: number;
  ptoVta: number;
  tipoCmp: number;
  nroCmp: number;
  importe: number;
  moneda: string;
  ctz: number;
  tipoDocRec?: number;
  nroDocRec?: number;
  tipoCodAut: 'E' | 'A'; // E = CAE, A = CAEA
  codAut: number;
}

export const URL_QR = 'https://www.arca.gob.ar/fe/qr/';

export function urlQR(d: DatosQR): string {
  const json = JSON.stringify({ ver: 1, ...d });
  return `${URL_QR}?p=${Buffer.from(json, 'utf8').toString('base64')}`;
}

export function leerUrlQR(url: string): DatosQR & { ver: number } {
  const p = new URL(url).searchParams.get('p');
  if (!p) throw new Error('La URL no tiene el parámetro p');
  return JSON.parse(Buffer.from(p, 'base64').toString('utf8'));
}
