/** Formatos de la app (es-AR). Las fechas de la API vienen como AAAA-MM-DD. */

export function pesos(n: number, decimales = false): string {
  const abs = Math.abs(n).toLocaleString('es-AR', decimales ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 });
  return `${n < 0 ? '-' : ''}$${abs}`;
}

/** Importe en su moneda: $ para pesos, el código para el resto (USD 1.200). */
export function importe(n: number, moneda = 'PES'): string {
  if (moneda === 'PES') return pesos(n);
  const m = moneda === 'DOL' ? 'USD' : moneda;
  return `${n < 0 ? '-' : ''}${m} ${Math.abs(n).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}

export const numeroComprobante = (pv: number, n: number) => `${String(pv).padStart(5, '0')}-${String(n).padStart(8, '0')}`;

/** 2026-10-12 → 12/10/2026 */
export function fecha(iso?: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

/** 2026-10-12 → 12/10 */
export function fechaCorta(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-');
  return d && m ? `${d}/${m}` : iso;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** 2026-10 → octubre */
export function nombreMes(aaaamm: string): string {
  return MESES[Number(aaaamm.slice(5, 7)) - 1] ?? aaaamm;
}

/** Fecha de hoy en Argentina como AAAA-MM-DD. */
export function hoyAR(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

/** Primer y último día de un mes (desplazado n meses desde la fecha dada), como AAAA-MM-DD. */
export function rangoMes(ref: string, desplazamiento = 0): { desde: string; hasta: string } {
  const [y, m] = ref.split('-').map(Number);
  const ini = new Date(Date.UTC(y!, m! - 1 + desplazamiento, 1));
  const fin = new Date(Date.UTC(y!, m! + desplazamiento, 0));
  return { desde: ini.toISOString().slice(0, 10), hasta: fin.toISOString().slice(0, 10) };
}

/** Nombre para saludar: "FERNÁNDEZ LUCÍA" → "Lucía". */
export function nombrePila(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  const n = partes.length > 1 ? partes[partes.length - 1]! : partes[0] ?? '';
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

export const formatearCuit = (c: string) => (c.length === 11 ? `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}` : c);
