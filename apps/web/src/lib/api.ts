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
    if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
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

export interface EstadoArca {
  entorno: 'homologacion' | 'produccion' | string;
  servidores: { app: string; db: string; auth: string };
}

/** Estado de la conexión con ARCA (los tres servidores de prueba de FEDummy). */
export function verEstadoArca() {
  return pedir<EstadoArca>('/arca/estado');
}

export function verCuenta() {
  return pedir<{ cuenta: Cuenta; plan: Plan }>('/cuenta');
}

/** Guarda el CUIT del usuario. Si ARCA está conectado, trae su perfil del padrón (padron: true). */
export function asignarCuit(cuit: string) {
  return pedir<{ cuenta: Cuenta; plan: Plan; padron: boolean }>('/cuenta/cuit', { method: 'PUT', body: JSON.stringify({ cuit }) });
}

/** Guarda a mano nombre y domicilio del emisor (solo en homologación, donde el padrón de prueba no tiene a casi nadie). */
export function cargarPerfil(nombre: string, domicilio: string) {
  return pedir<{ cuenta: Cuenta }>('/cuenta/perfil', { method: 'PUT', body: JSON.stringify({ nombre, domicilio }) });
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
  /** Número corto de la app (#1, #2…), correlativo por cuenta. El oficial es puntoVenta + numero. */
  numeroInterno: number;
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
  /** En una nota de crédito: la factura que anula o corrige. */
  asociadoId?: number;
  asociado?: { id: number; tipo: number; sigla: string; puntoVenta: number; numero: number; fecha: string; total: number };
  /** En una factura: cuánto suman las notas de crédito que la anulan o corrigen. */
  acreditado: number;
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

/** Nota de Crédito C sobre una Factura C. Sin importe, anula lo que queda de la factura. */
export function emitirNotaCredito(id: number, body: { importe?: number; motivo?: string } = {}) {
  return pedir<FacturaEmitida>(`/comprobantes/${id}/nota-credito`, { method: 'POST', body: JSON.stringify(body) });
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
  ultimos12Meses: { facturado: number; desde: string; porMes: { mes: string; facturado: number; externo?: number }[] };
  porCobrar: { total: number; facturas: number };
  ultimas: Comprobante[];
  plan: Plan;
}

export function verResumen(mes?: string) {
  return pedir<Resumen>(`/resumen${query({ mes })}`);
}

// ---------- Topes y Mis Comprobantes ----------

export interface AlertaTope {
  nivel: 'peligro' | 'aviso' | 'info';
  codigo: string;
  titulo: string;
  texto: string;
}

export interface MetaTope {
  letra?: string;
  tope: number;
  falta: number;
  /** En cuántos meses lo pasarías a tu ritmo (null: no en el próximo año). */
  enMeses: number | null;
}

export interface Topes {
  desde: string;
  porMes: { mes: string; facti: number; externo: number }[];
  facti: number;
  externo: number;
  externos: { cantidad: number; desde?: string; hasta?: string; ultimaImportacion?: string };
  analisis: {
    ingresos: number;
    promedio: number;
    categoriaPadron: string;
    categoriaDeHecho: string;
    siguiente: MetaTope | null;
    exclusion: MetaTope;
    exclusionFuente: string;
    proximaRecategorizacion: string;
    alertas: AlertaTope[] | null;
  };
}

export function verTopes() {
  return pedir<Topes>('/monotributo/topes');
}

export interface ResultadoImportacion {
  leidos: number;
  importacion: { nuevos: number; repetidos: number; enFacti: number };
  errores: { fila: number; mensaje: string }[];
}

/** Sube el archivo de "Mis Comprobantes – Emitidos" (CSV o Excel) tal cual. */
export function importarComprobantes(archivo: File) {
  return pedir<ResultadoImportacion>('/comprobantes/importar', {
    method: 'POST',
    body: archivo,
    headers: { 'Content-Type': 'application/octet-stream' },
  });
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
  /** Si se emite desde una factura recurrente: la API la pasa al mes siguiente. */
  recurrenteId?: number;
}

export function emitirFactura(body: NuevaFacturaReq) {
  return pedir<FacturaEmitida>('/facturas', { method: 'POST', body: JSON.stringify(body) });
}

// ---------- Botón de arrepentimiento y de baja (sin sesión) ----------

export type TipoSolicitud = 'arrepentimiento' | 'baja';

export interface SolicitudReq {
  tipo: TipoSolicitud;
  nombre: string;
  email: string;
  cuit?: string;
  detalle?: string;
}

/** Registra el pedido y devuelve el código que identifica la solicitud (Disposición 954/2025). */
export function crearSolicitud(body: SolicitudReq) {
  return pedir<{ codigo: string; tipo: TipoSolicitud; creadaEn: string }>('/consumidor/solicitudes', { method: 'POST', body: JSON.stringify(body) });
}

// ---------- Monotributo: tabla oficial de categorías (se actualiza sola desde ARCA) ----------

export interface CategoriaMonotributo {
  letra: string;
  tope: number;
  cuotaServicios: number;
  cuotaVentas: number;
  superficie: string;
  energia: string;
  alquileres: number;
  precioMaximo: number;
  impServicios: number;
  impVentas: number;
  sipa: number;
  obraSocial: number;
}

export interface EscalaMonotributo {
  vigenteDesde: string; // AAAA-MM-DD
  fuente: string;
  origen: 'arca' | 'respaldo';
  consultadaEn: string;
  categorias: CategoriaMonotributo[];
}

export function verCategorias() {
  return pedir<EscalaMonotributo>('/monotributo/categorias');
}

// ---------- Plan Pro (Mercado Pago) ----------

export interface Suscripcion {
  estado: 'pending' | 'authorized' | 'paused' | 'cancelled' | string;
  importe: number; // en pesos, por mes
  precioUsd: number;
  cotizacion: number;
  proximoCobro: string; // AAAA-MM-DD o ""
  medio: string; // visa, master, account_money…
  ultimos: string;
  vence: string; // MM/AA
}

export interface PagoFacti {
  id: string;
  fecha: string;
  importe: number;
  moneda: string;
  estado: 'aprobado' | 'rechazado' | 'pendiente' | 'cancelado' | string;
  medio: string;
  ultimos: string;
}

export interface EstadoPagos {
  plan: Plan['nombre'];
  precioUsd: number;
  dolar?: { valor: number; fecha: string; fuente: string };
  /** false = Mercado Pago todavía no está configurado: la pantalla muestra la vista previa. */
  mercadoPago: boolean;
  suscripcion: Suscripcion | null;
  pagos: PagoFacti[];
}

export function verPagos() {
  return pedir<EstadoPagos>('/pagos');
}

/** Crea la suscripción y devuelve la URL del checkout de Mercado Pago (ahí se paga con tarjeta o dinero en cuenta). */
export function suscribirsePro() {
  return pedir<{ url: string; importe: number }>('/pagos/suscripcion', { method: 'POST' });
}

/** Trae de Mercado Pago el estado de la suscripción (al volver del checkout). */
export function sincronizarPagos() {
  return pedir<EstadoPagos>('/pagos/sincronizar', { method: 'POST' });
}

export function cancelarPro() {
  return pedir<EstadoPagos>('/pagos/cancelar', { method: 'POST' });
}

// ---------- Facturas recurrentes ----------

export interface Recurrente {
  id: number;
  cliente: string;
  total: number;
  /** El pedido de emisión sin fechas (se usan las del día al emitir). */
  plantilla: NuevaFacturaReq;
  dia: number; // 1 a 28
  proxima: string; // AAAA-MM-DD
  automatica: boolean;
  activa: boolean;
  ultimaEmision: string;
  ultimoComprobanteId?: number;
  ultimoError: string;
  /** Llegó el día y todavía no se emitió. */
  pendiente: boolean;
}

export function listarRecurrentes() {
  return pedir<{ recurrentes: Recurrente[]; limite: number | null }>('/recurrentes');
}

export function verRecurrente(id: number | string) {
  return pedir<Recurrente>(`/recurrentes/${id}`);
}

export function crearRecurrente(body: { plantilla: Omit<NuevaFacturaReq, 'fecha' | 'periodoServicio' | 'recurrenteId'>; dia: number; automatica: boolean }) {
  return pedir<Recurrente>('/recurrentes', { method: 'POST', body: JSON.stringify(body) });
}

export function cambiarRecurrente(id: number, cambios: { dia?: number; automatica?: boolean; activa?: boolean }) {
  return pedir<Recurrente>(`/recurrentes/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) });
}

export function borrarRecurrente(id: number) {
  return pedir<null>(`/recurrentes/${id}`, { method: 'DELETE' });
}

// ---------- Calendario (vencimientos, facturas de todos los meses y cobros) ----------

export interface EventoCalendario {
  fecha: string; // AAAA-MM-DD
  tipo: 'cuota_monotributo' | 'recategorizacion' | 'nueva_escala' | 'factura_mensual' | 'cobro' | string;
  titulo: string;
  detalle: string;
  link?: string;
}

export function verCalendario(dias = 90) {
  return pedir<{ eventos: EventoCalendario[]; cobrosOcultos: number }>(`/calendario?dias=${dias}`);
}

/** Link privado (.ics) para suscribirse desde Google Calendar, iPhone u Outlook. renovar: invalida el anterior. */
export function enlaceCalendario(renovar = false) {
  return pedir<{ url: string }>('/calendario/enlace', renovar ? { method: 'POST' } : undefined);
}
