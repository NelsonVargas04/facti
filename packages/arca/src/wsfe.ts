import { ENDPOINTS, SERVICIOS, type ArcaConfig } from './config.js';
import { ArcaError, ArcaSinRespuestaError, type DetalleArca } from './errores.js';
import { aFechaArca, importe } from './fechas.js';
import { comoLista, esc, llamarSoap } from './soap.js';
import { CacheTickets } from './wsaa.js';

const NS = 'http://ar.gov.afip.dif.FEV1/';

export interface AlicuotaIva {
  id: number; // ver ALICUOTAS_IVA
  baseImponible: number;
  importe: number;
}

export interface ComprobanteAsociado {
  tipo: number;
  puntoVenta: number;
  numero: number;
  cuit?: string;
  fecha?: Date;
}

export interface NuevoComprobante {
  puntoVenta: number;
  tipo: number; // ver TIPOS_COMPROBANTE
  concepto: 1 | 2 | 3;
  docTipo: number;
  docNro: string;
  condicionIvaReceptorId: number;
  fecha?: Date;
  importeTotal: number;
  importeNeto: number;
  importeIva?: number;
  importeExento?: number;
  importeNoGravado?: number;
  importeTributos?: number;
  alicuotas?: AlicuotaIva[];
  /** Obligatorio si el concepto incluye servicios. */
  servicio?: { desde: Date; hasta: Date; vencimientoPago: Date };
  monedaId?: string;
  cotizacion?: number;
  asociados?: ComprobanteAsociado[];
}

export interface ResultadoCAE {
  aprobado: boolean;
  numero: number;
  cae?: string;
  vencimientoCae?: string; // AAAAMMDD
  observaciones: DetalleArca[];
  errores: DetalleArca[];
}

/** Cliente de WSFEv1 para un emisor (el CUIT representado). */
export class Wsfe {
  private bloqueos = new Map<string, Promise<unknown>>();

  constructor(
    private cfg: ArcaConfig,
    private tickets: CacheTickets,
    private cuitEmisor: string,
  ) {}

  private async auth(): Promise<string> {
    const ta = await this.tickets.obtener(SERVICIOS.facturacion);
    return `<ar:Auth><ar:Token>${ta.token}</ar:Token><ar:Sign>${ta.sign}</ar:Sign><ar:Cuit>${esc(this.cuitEmisor)}</ar:Cuit></ar:Auth>`;
  }

  private async llamar(metodo: string, interior: string, conAuth = true): Promise<any> {
    const auth = conAuth ? await this.auth() : '';
    const body = await llamarSoap({
      url: ENDPOINTS[this.cfg.entorno].wsfe,
      accion: `${NS}${metodo}`,
      servicio: `WSFEv1.${metodo}`,
      timeoutMs: this.cfg.timeoutMs,
      cuerpo: `<ar:${metodo} xmlns:ar="${NS}">${auth}${interior}</ar:${metodo}>`,
    });
    const resultado = body?.[`${metodo}Response`]?.[`${metodo}Result`];
    if (!resultado) throw new ArcaError(`Respuesta vacía de ${metodo}`, [], 'WSFEv1');
    return resultado;
  }

  /** Estado de los servidores de ARCA. No requiere autenticación. */
  async estado(): Promise<{ app: string; db: string; auth: string }> {
    const r = await this.llamar('FEDummy', '', false);
    return { app: String(r.AppServer), db: String(r.DbServer), auth: String(r.AuthServer) };
  }

  async ultimoAutorizado(puntoVenta: number, tipo: number): Promise<number> {
    const r = await this.llamar(
      'FECompUltimoAutorizado',
      `<ar:PtoVta>${puntoVenta}</ar:PtoVta><ar:CbteTipo>${tipo}</ar:CbteTipo>`,
    );
    lanzarErrores(r, 'FECompUltimoAutorizado');
    return Number(r.CbteNro);
  }

  async puntosDeVenta(): Promise<{ numero: number; tipoEmision: string; bloqueado: boolean }[]> {
    const r = await this.llamar('FEParamGetPtosVenta', '');
    // Si no tiene puntos de venta Web Services, ARCA devuelve un error 602.
    if (comoLista(r?.Errors?.Err).some((e: any) => String(e.Code) === '602')) return [];
    lanzarErrores(r, 'FEParamGetPtosVenta');
    return comoLista(r?.ResultGet?.PtoVenta).map((p: any) => ({
      numero: Number(p.Nro),
      tipoEmision: String(p.EmisionTipo),
      bloqueado: String(p.Bloqueado) === 'S',
    }));
  }

  async condicionesIvaReceptor(claseComprobante?: 'A' | 'B' | 'C' | 'M'): Promise<{ id: number; descripcion: string }[]> {
    const r = await this.llamar(
      'FEParamGetCondicionIvaReceptor',
      claseComprobante ? `<ar:ClaseCmp>${claseComprobante}</ar:ClaseCmp>` : '',
    );
    lanzarErrores(r, 'FEParamGetCondicionIvaReceptor');
    return comoLista(r?.ResultGet?.CondicionIvaReceptor).map((c: any) => ({
      id: Number(c.Id),
      descripcion: String(c.Desc),
    }));
  }

  async consultar(puntoVenta: number, tipo: number, numero: number): Promise<any | undefined> {
    const r = await this.llamar(
      'FECompConsultar',
      `<ar:FeCompConsReq><ar:CbteTipo>${tipo}</ar:CbteTipo><ar:CbteNro>${numero}</ar:CbteNro><ar:PtoVta>${puntoVenta}</ar:PtoVta></ar:FeCompConsReq>`,
    );
    // Error 602: el comprobante no existe.
    if (comoLista(r?.Errors?.Err).some((e: any) => String(e.Code) === '602')) return undefined;
    lanzarErrores(r, 'FECompConsultar');
    return r?.ResultGet;
  }

  /**
   * Emite un comprobante: toma el próximo número y pide el CAE.
   * Solo un pedido a la vez por punto de venta y tipo, porque la numeración es correlativa.
   * Si ARCA no responde, consulta si el número quedó autorizado antes de dar error.
   */
  async emitir(c: NuevoComprobante): Promise<ResultadoCAE> {
    validar(c);
    const clave = `${c.puntoVenta}-${c.tipo}`;
    const anterior = this.bloqueos.get(clave) ?? Promise.resolve();
    const tarea = anterior.catch(() => undefined).then(() => this.emitirSinBloqueo(c));
    this.bloqueos.set(clave, tarea);
    try {
      return await tarea;
    } finally {
      if (this.bloqueos.get(clave) === tarea) this.bloqueos.delete(clave);
    }
  }

  private async emitirSinBloqueo(c: NuevoComprobante): Promise<ResultadoCAE> {
    const numero = (await this.ultimoAutorizado(c.puntoVenta, c.tipo)) + 1;
    try {
      const r = await this.llamar('FECAESolicitar', armarSolicitud(c, numero));
      return leerResultado(r, numero);
    } catch (e) {
      if (!(e instanceof ArcaSinRespuestaError)) throw e;
      const existente = await this.consultar(c.puntoVenta, c.tipo, numero);
      if (existente?.CodAutorizacion) {
        return {
          aprobado: true,
          numero,
          cae: String(existente.CodAutorizacion),
          vencimientoCae: String(existente.FchVto),
          observaciones: [],
          errores: [],
        };
      }
      throw e;
    }
  }
}

function validar(c: NuevoComprobante): void {
  const suma =
    c.importeNeto + (c.importeIva ?? 0) + (c.importeExento ?? 0) + (c.importeNoGravado ?? 0) + (c.importeTributos ?? 0);
  if (Math.abs(suma - c.importeTotal) > 0.01) {
    throw new ArcaError(`El total (${c.importeTotal}) no coincide con la suma de importes (${suma.toFixed(2)})`);
  }
  if (c.concepto !== 1 && !c.servicio) {
    throw new ArcaError('Para servicios hay que indicar período facturado y vencimiento de pago');
  }
  const esC = [11, 12, 13].includes(c.tipo);
  if (esC && ((c.importeIva ?? 0) !== 0 || (c.alicuotas?.length ?? 0) > 0)) {
    throw new ArcaError('Los comprobantes C no discriminan IVA');
  }
  if (!esC && (c.importeIva ?? 0) > 0 && !c.alicuotas?.length) {
    throw new ArcaError('Falta el detalle de alícuotas de IVA');
  }
}

export function armarSolicitud(c: NuevoComprobante, numero: number): string {
  const fecha = aFechaArca(c.fecha ?? new Date());
  const servicio = c.servicio
    ? `<ar:FchServDesde>${aFechaArca(c.servicio.desde)}</ar:FchServDesde>` +
      `<ar:FchServHasta>${aFechaArca(c.servicio.hasta)}</ar:FchServHasta>` +
      `<ar:FchVtoPago>${aFechaArca(c.servicio.vencimientoPago)}</ar:FchVtoPago>`
    : '';
  const asociados = c.asociados?.length
    ? `<ar:CbtesAsoc>${c.asociados
        .map(
          (a) =>
            `<ar:CbteAsoc><ar:Tipo>${a.tipo}</ar:Tipo><ar:PtoVta>${a.puntoVenta}</ar:PtoVta><ar:Nro>${a.numero}</ar:Nro>` +
            (a.cuit ? `<ar:Cuit>${esc(a.cuit)}</ar:Cuit>` : '') +
            (a.fecha ? `<ar:CbteFch>${aFechaArca(a.fecha)}</ar:CbteFch>` : '') +
            '</ar:CbteAsoc>',
        )
        .join('')}</ar:CbtesAsoc>`
    : '';
  const iva = c.alicuotas?.length
    ? `<ar:Iva>${c.alicuotas
        .map(
          (a) =>
            `<ar:AlicIva><ar:Id>${a.id}</ar:Id><ar:BaseImp>${importe(a.baseImponible)}</ar:BaseImp><ar:Importe>${importe(a.importe)}</ar:Importe></ar:AlicIva>`,
        )
        .join('')}</ar:Iva>`
    : '';
  return (
    '<ar:FeCAEReq><ar:FeCabReq>' +
    `<ar:CantReg>1</ar:CantReg><ar:PtoVta>${c.puntoVenta}</ar:PtoVta><ar:CbteTipo>${c.tipo}</ar:CbteTipo>` +
    '</ar:FeCabReq><ar:FeDetReq><ar:FECAEDetRequest>' +
    `<ar:Concepto>${c.concepto}</ar:Concepto><ar:DocTipo>${c.docTipo}</ar:DocTipo><ar:DocNro>${esc(c.docNro)}</ar:DocNro>` +
    `<ar:CbteDesde>${numero}</ar:CbteDesde><ar:CbteHasta>${numero}</ar:CbteHasta><ar:CbteFch>${fecha}</ar:CbteFch>` +
    `<ar:ImpTotal>${importe(c.importeTotal)}</ar:ImpTotal>` +
    `<ar:ImpTotConc>${importe(c.importeNoGravado ?? 0)}</ar:ImpTotConc>` +
    `<ar:ImpNeto>${importe(c.importeNeto)}</ar:ImpNeto>` +
    `<ar:ImpOpEx>${importe(c.importeExento ?? 0)}</ar:ImpOpEx>` +
    `<ar:ImpTrib>${importe(c.importeTributos ?? 0)}</ar:ImpTrib>` +
    `<ar:ImpIVA>${importe(c.importeIva ?? 0)}</ar:ImpIVA>` +
    servicio +
    `<ar:MonId>${esc(c.monedaId ?? 'PES')}</ar:MonId><ar:MonCotiz>${c.cotizacion ?? 1}</ar:MonCotiz>` +
    `<ar:CondicionIVAReceptorId>${c.condicionIvaReceptorId}</ar:CondicionIVAReceptorId>` +
    asociados +
    iva +
    '</ar:FECAEDetRequest></ar:FeDetReq></ar:FeCAEReq>'
  );
}

function detalles(lista: unknown): DetalleArca[] {
  return comoLista(lista as any).map((e: any) => ({ codigo: String(e.Code), mensaje: String(e.Msg) }));
}

function lanzarErrores(r: any, metodo: string): void {
  const errores = detalles(r?.Errors?.Err);
  if (errores.length) throw new ArcaError(`${metodo}: ${errores.map((e) => e.mensaje).join(' | ')}`, errores, 'WSFEv1');
}

function leerResultado(r: any, numero: number): ResultadoCAE {
  const det = comoLista(r?.FeDetResp?.FECAEDetResponse)[0] as any;
  const errores = detalles(r?.Errors?.Err);
  const observaciones = detalles(det?.Observaciones?.Obs);
  const aprobado = String(det?.Resultado) === 'A';
  return {
    aprobado,
    numero,
    cae: aprobado ? String(det.CAE) : undefined,
    vencimientoCae: aprobado ? String(det.CAEFchVto) : undefined,
    observaciones,
    errores,
  };
}
