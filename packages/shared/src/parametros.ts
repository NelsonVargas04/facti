/**
 * Parámetros normativos que cambian con el tiempo.
 * Regla: nunca fijarlos en el código de negocio; siempre leerlos de acá
 * (y en producción, desde la base de datos) con su fuente y vigencia.
 */
export interface Parametro {
  clave: string;
  valor: number;
  vigenteDesde: string; // AAAA-MM-DD
  vigenteHasta?: string;
  fuente: string;
}

export const PARAMETROS: Parametro[] = [
  {
    clave: 'consumidor_final.monto_identificacion',
    valor: 10_000_000,
    vigenteDesde: '2025-06-01',
    fuente: 'RG ARCA 5700/2025, mantenida por RG 5866/2026',
  },
  {
    clave: 'fce.monto_minimo',
    valor: 5_549_862,
    vigenteDesde: '2026-04-14',
    fuente: 'Resolución 1/2026 (régimen FCE MiPyME, Ley 27.440)',
  },
  {
    clave: 'fce.plazo_aceptacion_dias',
    valor: 21,
    vigenteDesde: '2025-11-01',
    vigenteHasta: '2026-10-31',
    fuente: 'Resolución 219/2025 Ministerio de Economía',
  },
  {
    clave: 'fce.plazo_aceptacion_dias',
    valor: 15,
    vigenteDesde: '2026-11-01',
    fuente: 'Ley 27.440 (plazo original). Revisar si hay nueva prórroga.',
  },
  {
    clave: 'monotributo.tope_anual.A',
    valor: 12_009_410.45,
    vigenteDesde: '2026-08-01',
    fuente: 'Escalas ARCA agosto 2026',
  },
  {
    clave: 'monotributo.tope_anual.K',
    valor: 126_610_838.75,
    vigenteDesde: '2026-08-01',
    fuente: 'Escalas ARCA agosto 2026',
  },
  // TODO: cargar las categorías B a J y las cuotas por categoría desde la tabla oficial.
];

export function obtenerParametro(clave: string, fecha: Date = new Date(), tabla: Parametro[] = PARAMETROS): number {
  const dia = fecha.toISOString().slice(0, 10);
  const vigente = tabla
    .filter((p) => p.clave === clave && p.vigenteDesde <= dia && (!p.vigenteHasta || dia <= p.vigenteHasta))
    .sort((a, b) => b.vigenteDesde.localeCompare(a.vigenteDesde))[0];
  if (!vigente) throw new Error(`No hay valor vigente para "${clave}" al ${dia}`);
  return vigente.valor;
}
