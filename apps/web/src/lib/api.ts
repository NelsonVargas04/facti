/** Base del backend (apps/api). Se puede sobreescribir con NEXT_PUBLIC_API_URL. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type Resultado<T> = { ok: true; dato: T } | { ok: false; estado: number; mensaje: string };

export interface PadronDatos {
  cuit: string;
  nombre: string;
  tipoPersona: string;
  condicion: 'responsable_inscripto' | 'monotributo' | 'exento' | 'consumidor_final' | 'no_alcanzado';
  categoriaMonotributo?: string;
  domicilio?: string;
  actividades: string[];
}

export interface FacturaEmitida {
  aprobado: boolean;
  letra: string;
  tipo: number;
  puntoVenta: number;
  numero: number;
  cae: string;
  vencimientoCae?: string;
  total: number;
  fecha: string;
  qr: string;
  observaciones: { codigo: string; mensaje: string }[];
}

/** Condición del padrón → CondicionIVAReceptorId de ARCA (RG 5616). */
export const COND_IVA_RECEPTOR: Record<PadronDatos['condicion'], number> = {
  responsable_inscripto: 1,
  exento: 4,
  consumidor_final: 5,
  monotributo: 6,
  no_alcanzado: 5,
};

async function leerError(r: Response): Promise<string> {
  try {
    const j = await r.json();
    return j?.mensaje ?? `Error ${r.status}`;
  } catch {
    return `Error ${r.status}`;
  }
}

export async function buscarPadron(cuit: string): Promise<Resultado<PadronDatos>> {
  const limpio = cuit.replace(/\D/g, '');
  try {
    const r = await fetch(`${API_URL}/arca/padron/${limpio}`);
    if (!r.ok) return { ok: false, estado: r.status, mensaje: await leerError(r) };
    return { ok: true, dato: (await r.json()) as PadronDatos };
  } catch {
    return { ok: false, estado: 0, mensaje: `No se pudo conectar con la API (${API_URL}).` };
  }
}

export interface NuevaFacturaReq {
  receptor: { docTipo: number; docNro: string; condicionIvaReceptorId: number };
  concepto: 1 | 2 | 3;
  fecha?: string;
  periodoServicio?: { desde: string; hasta: string; vencimientoPago: string };
  items: { descripcion: string; cantidad: number; precioUnitario: number }[];
}

export async function emitirFactura(body: NuevaFacturaReq): Promise<Resultado<FacturaEmitida>> {
  try {
    const r = await fetch(`${API_URL}/facturas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) return { ok: false, estado: r.status, mensaje: await leerError(r) };
    return { ok: true, dato: (await r.json()) as FacturaEmitida };
  } catch {
    return { ok: false, estado: 0, mensaje: `No se pudo conectar con la API (${API_URL}).` };
  }
}
