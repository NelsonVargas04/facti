/** Fecha en formato AAAAMMDD, en hora de Argentina (UTC-3). */
export function aFechaArca(fecha: Date): string {
  const ar = new Date(fecha.getTime() - 3 * 60 * 60_000);
  return ar.toISOString().slice(0, 10).replace(/-/g, '');
}

/** Convierte AAAAMMDD a AAAA-MM-DD. */
export function deFechaArca(valor: string): string {
  return `${valor.slice(0, 4)}-${valor.slice(4, 6)}-${valor.slice(6, 8)}`;
}

export function importe(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}
