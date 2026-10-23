import { tokenActual } from '@/lib/supabase';

/** Base del backend (apps/api). Se puede sobreescribir con NEXT_PUBLIC_API_URL. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type ErrorApi = { ok: false; estado: number; codigo?: string; mensaje: string; extra?: Record<string, unknown> };
export type Resultado<T> = { ok: true; dato: T } | ErrorApi;

/** Llama a la API con la sesión del usuario y devuelve el dato o un error para mostrar. Nunca lanza. */
export async function pedir<T>(ruta: string, init?: RequestInit): Promise<Resultado<T>> {
  let r: Response;
  try {
    const token = await tokenActual();
    const headers = new Headers(init?.headers);
    if (init?.body) headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    r = await fetch(`${API_URL}${ruta}`, { ...init, headers });
  } catch {
    return { ok: false, estado: 0, codigo: 'sin_conexion', mensaje: `No se pudo conectar con la API de Facti (${API_URL}). ¿Está levantada?` };
  }
  let cuerpo: unknown = null;
  try {
    cuerpo = await r.json();
  } catch {
    /* respuesta sin JSON */
  }
  if (!r.ok) {
    const c = (cuerpo ?? {}) as { error?: string; mensaje?: string } & Record<string, unknown>;
    return { ok: false, estado: r.status, codigo: c.error, mensaje: c.mensaje ?? `Error ${r.status}`, extra: c };
  }
  return { ok: true, dato: cuerpo as T };
}

// ---------- Padrón ----------

export type Condicion = 'responsable_inscripto' | 'monotributo' | 'exento' | 'consumidor_final' | 'no_alcanzado';

export interface PadronDatos {
  cuit: string;
  nombre: string;
  tipoPersona: string;
  condicion: Condicion;
  categoriaMonotributo?: string;
  domicilio?: string;
  actividades: string[];
}

/** Condición del padrón → CondicionIVAReceptorId de ARCA (RG 5616). */
export const COND_IVA_RECEPTOR: Record<Condicion, number> = {
  responsable_inscripto: 1,
  exento: 4,
  consumidor_final: 5,
  monotributo: 6,
  no_alcanzado: 5,
};

/** Cómo se escribe la condición frente al IVA en el comprobante. */
export const COND_IVA_TEXTO: Record<Condicion, string> = {
  responsable_inscripto: 'IVA Responsable Inscripto',
  monotributo: 'Responsable Monotributo',
  exento: 'IVA Sujeto Exento',
  consumidor_final: 'Consumidor Final',
  no_alcanzado: 'IVA No Alcanzado',
};

/** Texto de la condición del receptor: usa la guardada o, si no hay, la deduce del Id de ARCA. */
export function condicionTexto(r: { condicion: string; condicionIvaId: number }): string {
  if (r.condicion in COND_IVA_TEXTO) return COND_IVA_TEXTO[r.condicion as Condicion];
  return ({ 1: 'IVA Responsable Inscripto', 4: 'IVA Sujeto Exento', 5: 'Consumidor Final', 6: 'Responsable Monotributo' } as Record<number, string>)[r.condicionIvaId] ?? '—';
}

export function buscarPadron(cuit: string) {
  return pedir<PadronDatos>(`/arca/padron/${cuit.replace(/\D/g, '')}`);
}

// ---------- Cuenta y plan ----------

export interface Cuenta {
  id: number;
  email: string;
  /** Vacío hasta que lo carga en el primer paso del onboarding. */
  cuit: string;
  nombre: string;
  domicilio: string;
  condicion: string;
  categoria: string;
  ingresosBrutos: string;
  inicioActividades: string;
  puntoVenta: number;
  plan: 'gratis' | 'pro';
}

export interface Uso {
  facturas: number;
  exportacion: number;
}

export interface Plan {
  nombre: 'gratis' | 'pro';
  /** null = ilimitado (Pro) */
  limites: Uso | null;
  uso: Uso;
}

export function verCuenta() {
  return pedir<{ cuenta: Cuenta; plan: Plan }>('/cuenta');
}

/** Guarda el CUIT del usuario. Si ARCA está conectado, trae su perfil del padrón (padron: true). */
export function asignarCuit(cuit: string) {
  return pedir<{ cuenta: Cuenta; plan: Plan; padron: boolean }>('/cuenta/cuit', { method: 'PUT', body: JSON.stringify({ cuit }) });
}

// ---------- Comprobantes ----------

export type Cobro = '' | 'pendiente' | 'cobrada';

export interface Receptor {
  docTipo: number;
  docNro: string;
  nombre: string;
  condicionIvaId: number;
  condicion: string;
  domicilio: string;
  email: string;
}

export interface Comprobante {
  id: number;
  tipo: number;
  sigla: string; // A, B, C, M, E, NC, ND
  puntoVenta: number;
  numero: number;
  fecha: string; // AAAA-MM-DD
  concepto: number;
  moneda: string;
  cotizacion: number;
  total: number;
  neto: number;
  iva: number;
  cae: string;
  caeVto: string;
  qr: string;
  periodo?: { desde: string; hasta: string; vtoPago: string };
  condicionVenta: string;
  receptor: Receptor;
  clienteId?: number;
  cobro: Cobro;
  cobradaEn?: string;
  items?: { descripcion: string; cantidad: number; unidad: string; precioUnitario: number; subtotal: number }[];
  creadoEn: string;
}

export interface FiltroComprobantes {
  desde?: string;
  hasta?: string;
  q?: string;
  cobro?: Cobro;
  orden?: string;
  limite?: number;
  saltar?: number;
}

function query(f: object): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== '' && v !== null) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function listarComprobantes(f: FiltroComprobantes = {}) {
  return pedir<{ comprobantes: Comprobante[]; total: number }>(`/comprobantes${query(f)}`);
}

export function verComprobante(id: number | string) {
  return pedir<{ comprobante: Comprobante; emisor: Cuenta }>(`/comprobantes/${id}`);
}

export function marcarCobro(id: number, cobro: 'pendiente' | 'cobrada') {
  return pedir<Comprobante>(`/comprobantes/${id}/cobro`, { method: 'PATCH', body: JSON.stringify({ cobro }) });
}

// ---------- Resumen ----------

export interface ResumenPeriodo {
  facturado: number;
  emitidos: number;
  porCobrar: number;
  pendientes: number;
  cobrado: number;
  cobradas: number;
}

export interface Resumen {
  mes: string; // AAAA-MM
  delMes: ResumenPeriodo;
  ultimos12Meses: { facturado: number; desde: string };
  porCobrar: { total: number; facturas: number };
  ultimas: Comprobante[];
  plan: Plan;
}

export function verResumen(mes?: string) {
  return pedir<Resumen>(`/resumen${query({ mes })}`);
}

// ---------- Clientes ----------

export interface Cliente {
  id: number;
  docTipo: number;
  docNro: string;
  nombre: string;
  condicionIvaId: number;
  condicion: string;
  domicilio: string;
  email: string;
  comprobantes: number;
  facturado: number;
  porCobrar: number;
  ultimo: string;
}

export function listarClientes(q?: string) {
  return pedir<{ clientes: Cliente[] }>(`/clientes${query({ q })}`);
}

// ---------- Emitir ----------

export interface FacturaEmitida {
  id: number;
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

export interface NuevaFacturaReq {
  receptor: {
    docTipo: number;
    docNro: string;
    condicionIvaReceptorId: number;
    nombre?: string;
    condicion?: string;
    domicilio?: string;
    email?: string;
  };
  concepto: 1 | 2 | 3;
  fecha?: string;
  condicionVenta?: string;
  periodoServicio?: { desde: string; hasta: string; vencimientoPago: string };
  items: { descripcion: string; cantidad: number; unidad?: string; precioUnitario: number }[];
}

export function emitirFactura(body: NuevaFacturaReq) {
  return pedir<FacturaEmitida>('/facturas', { method: 'POST', body: JSON.stringify(body) });
}
