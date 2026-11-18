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
    fuente: 'ARCA, tabla de categorías de monotributo (valores desde el 01/08/2026), arca.gob.ar/monotributo/categorias.asp',
  },
  {
    clave: 'monotributo.tope_anual.B',
    valor: 17_595_182.74,
    vigenteDesde: '2026-08-01',
    fuente: 'ARCA, tabla de categorías de monotributo (valores desde el 01/08/2026), arca.gob.ar/monotributo/categorias.asp',
  },
  {
    clave: 'monotributo.tope_anual.C',
    valor: 24_670_494.31,
    vigenteDesde: '2026-08-01',
    fuente: 'ARCA, tabla de categorías de monotributo (valores desde el 01/08/2026), arca.gob.ar/monotributo/categorias.asp',
  },
  {
    clave: 'monotributo.tope_anual.D',
    valor: 30_628_651.43,
    vigenteDesde: '2026-08-01',
    fuente: 'ARCA, tabla de categorías de monotributo (valores desde el 01/08/2026), arca.gob.ar/monotributo/categorias.asp',
  },
  {
    clave: 'monotributo.tope_anual.E',
    valor: 36_028_231.33,
    vigenteDesde: '2026-08-01',
    fuente: 'ARCA, tabla de categorías de monotributo (valores desde el 01/08/2026), arca.gob.ar/monotributo/categorias.asp',
  },
  {
    clave: 'monotributo.tope_anual.F',
    valor: 45_151_659.41,
    vigenteDesde: '2026-08-01',
    fuente: 'ARCA, tabla de categorías de monotributo (valores desde el 01/08/2026), arca.gob.ar/monotributo/categorias.asp',
  },
  {
    clave: 'monotributo.tope_anual.G',
    valor: 53_995_798.87,
    vigenteDesde: '2026-08-01',
    fuente: 'ARCA, tabla de categorías de monotributo (valores desde el 01/08/2026), arca.gob.ar/monotributo/categorias.asp',
  },
  {
    clave: 'monotributo.tope_anual.H',
    valor: 81_924_660.37,
    vigenteDesde: '2026-08-01',
    fuente: 'ARCA, tabla de categorías de monotributo (valores desde el 01/08/2026), arca.gob.ar/monotributo/categorias.asp',
  },
  {
    clave: 'monotributo.tope_anual.I',
    valor: 91_699_761.9,
    vigenteDesde: '2026-08-01',
    fuente: 'ARCA, tabla de categorías de monotributo (valores desde el 01/08/2026), arca.gob.ar/monotributo/categorias.asp',
  },
  {
    clave: 'monotributo.tope_anual.J',
    valor: 105_012_519.2,
    vigenteDesde: '2026-08-01',
    fuente: 'ARCA, tabla de categorías de monotributo (valores desde el 01/08/2026), arca.gob.ar/monotributo/categorias.asp',
  },
  {
    clave: 'monotributo.tope_anual.K',
    valor: 126_610_838.75,
    vigenteDesde: '2026-08-01',
    fuente: 'ARCA, tabla de categorías de monotributo (valores desde el 01/08/2026), arca.gob.ar/monotributo/categorias.asp',
  },
  {
    // ARCA excluye con tablas anteriores a la vigente (topes más bajos). Facti avisa con la K de la tabla anterior.
    // El mismo valor está en apps/api/internal/monotributo/topes.go (TopesExclusion): actualizar los dos.
    clave: 'monotributo.tope_exclusion',
    valor: 108_357_084.05,
    vigenteDesde: '2026-08-01',
    fuente:
      'Tope de la categoría K de la tabla del 01/02/2026 al 31/07/2026 (ARCA). Criterio: iprofesional.com/impuestos/446225-tabla-monotributo-aplica-arca-para-exclusiones-2026',
  },
  // TODO: cargar las cuotas mensuales por categoría desde la misma tabla.
];

export function obtenerParametro(clave: string, fecha: Date = new Date(), tabla: Parametro[] = PARAMETROS): number {
  const dia = fecha.toISOString().slice(0, 10);
  const vigente = tabla
    .filter((p) => p.clave === clave && p.vigenteDesde <= dia && (!p.vigenteHasta || dia <= p.vigenteHasta))
    .sort((a, b) => b.vigenteDesde.localeCompare(a.vigenteDesde))[0];
  if (!vigente) throw new Error(`No hay valor vigente para "${clave}" al ${dia}`);
  return vigente.valor;
}

/** Categorías de monotributo, de menor a mayor. */
export const CATEGORIAS_MONOTRIBUTO = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'] as const;

/**
 * Categoría que corresponde por ingresos brutos de los últimos 12 meses: la primera cuyo tope no se supera.
 * Devuelve null si se pasa del tope de la K (queda fuera del monotributo).
 * Solo mira los ingresos: ARCA también puede considerar otros parámetros.
 */
export function categoriaPorIngresos(ingresos: number, fecha: Date = new Date(), tabla: Parametro[] = PARAMETROS): string | null {
  for (const c of CATEGORIAS_MONOTRIBUTO) {
    if (ingresos <= obtenerParametro(`monotributo.tope_anual.${c}`, fecha, tabla)) return c;
  }
  return null;
}
