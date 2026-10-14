/**
 * Códigos de las tablas de ARCA usados por WSFEv1.
 * Las tablas oficiales se pueden consultar con los métodos FEParamGet* del web service;
 * estas constantes cubren los casos del MVP.
 */
export const TIPOS_COMPROBANTE = {
  FACTURA_A: 1, NOTA_DEBITO_A: 2, NOTA_CREDITO_A: 3,
  FACTURA_B: 6, NOTA_DEBITO_B: 7, NOTA_CREDITO_B: 8,
  FACTURA_C: 11, NOTA_DEBITO_C: 12, NOTA_CREDITO_C: 13,
  FACTURA_M: 51, NOTA_DEBITO_M: 52, NOTA_CREDITO_M: 53,
} as const;

export const CONCEPTOS = { PRODUCTOS: 1, SERVICIOS: 2, PRODUCTOS_Y_SERVICIOS: 3 } as const;

export const TIPOS_DOCUMENTO = { CUIT: 80, CUIL: 86, DNI: 96, SIN_IDENTIFICAR: 99 } as const;

/** Condición frente al IVA del receptor (RG 5616). Confirmar con FEParamGetCondicionIvaReceptor. */
export const CONDICION_IVA_RECEPTOR = {
  RESPONSABLE_INSCRIPTO: 1,
  EXENTO: 4,
  CONSUMIDOR_FINAL: 5,
  MONOTRIBUTO: 6,
} as const;

/** Alícuotas de IVA (Id de la tabla de ARCA). */
export const ALICUOTAS_IVA = {
  '0': 3, '10.5': 4, '21': 5, '27': 6, '5': 8, '2.5': 9,
} as const;

export const LEYENDA_LEY_27618 =
  'El crédito fiscal discriminado en el presente comprobante, solo podrá ser computado a efectos del Régimen de Sostenimiento e Inclusión Fiscal para Pequeños Contribuyentes de la Ley Nº 27.618';

export type CondicionFiscal =
  | 'responsable_inscripto'
  | 'monotributo'
  | 'exento'
  | 'consumidor_final'
  | 'no_alcanzado';

/**
 * Sugiere la factura según emisor y receptor (RG 1415).
 * Para responsables inscriptos, ARCA puede asignar "A con leyenda" o "M":
 * en ese caso hay que respetar lo que habilita el punto de venta.
 */
export function facturaSugerida(emisor: CondicionFiscal, receptor: CondicionFiscal): {
  tipo: number;
  letra: 'A' | 'B' | 'C';
  leyenda?: string;
} {
  if (emisor !== 'responsable_inscripto') return { tipo: TIPOS_COMPROBANTE.FACTURA_C, letra: 'C' };
  if (receptor === 'responsable_inscripto') return { tipo: TIPOS_COMPROBANTE.FACTURA_A, letra: 'A' };
  if (receptor === 'monotributo') {
    return { tipo: TIPOS_COMPROBANTE.FACTURA_A, letra: 'A', leyenda: LEYENDA_LEY_27618 };
  }
  return { tipo: TIPOS_COMPROBANTE.FACTURA_B, letra: 'B' };
}

export function letraDeTipo(tipo: number): 'A' | 'B' | 'C' | 'M' | undefined {
  if ([1, 2, 3].includes(tipo)) return 'A';
  if ([6, 7, 8].includes(tipo)) return 'B';
  if ([11, 12, 13].includes(tipo)) return 'C';
  if ([51, 52, 53].includes(tipo)) return 'M';
  return undefined;
}
