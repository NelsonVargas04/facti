const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export function limpiarCuit(cuit: string): string {
  return cuit.replace(/\D/g, '');
}

/** Valida el dígito verificador de un CUIT/CUIL (módulo 11). */
export function validarCuit(cuit: string): boolean {
  const c = limpiarCuit(cuit);
  if (!/^\d{11}$/.test(c)) return false;
  const suma = PESOS.reduce((acc, p, i) => acc + p * Number(c[i]), 0);
  let dv = 11 - (suma % 11);
  if (dv === 11) dv = 0;
  if (dv === 10) return false;
  return dv === Number(c[10]);
}

/** 20123456789 → 20-12345678-9 */
export function formatearCuit(cuit: string): string {
  const c = limpiarCuit(cuit);
  return c.length === 11 ? `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}` : cuit;
}
