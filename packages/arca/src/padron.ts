import { ENDPOINTS, SERVICIOS, type ArcaConfig } from './config.js';
import type { CondicionFiscal } from './codigos.js';
import { ArcaError } from './errores.js';
import { comoLista, esc, llamarSoap } from './soap.js';
import type { CacheTickets } from './wsaa.js';

const NS = 'http://a5.soap.ws.server.puc.sr/';

export interface DatosPadron {
  cuit: string;
  nombre: string;
  tipoPersona: 'FISICA' | 'JURIDICA' | string;
  condicion: CondicionFiscal;
  categoriaMonotributo?: string;
  domicilio?: string;
  actividades: string[];
  /** Respuesta original, por si hace falta algún dato más. */
  original: unknown;
}

/**
 * Consulta la constancia de inscripción (padrón A5). Usa el certificado de Facti:
 * el servicio ws_sr_constancia_inscripcion debe estar autorizado para ese certificado.
 *
 * IMPORTANTE: la deducción de la condición fiscal a partir de los impuestos
 * (IVA = 30, IVA exento = 32) debe validarse en homologación.
 */
export async function consultarPadron(cfg: ArcaConfig, tickets: CacheTickets, cuit: string): Promise<DatosPadron> {
  const ta = await tickets.obtener(SERVICIOS.padron);
  const body = await llamarSoap({
    url: ENDPOINTS[cfg.entorno].padron,
    accion: '',
    servicio: 'Padron A5',
    timeoutMs: cfg.timeoutMs,
    cuerpo:
      `<a5:getPersona_v2 xmlns:a5="${NS}">` +
      `<token>${ta.token}</token><sign>${ta.sign}</sign>` +
      `<cuitRepresentada>${esc(cfg.cuitCertificado)}</cuitRepresentada><idPersona>${esc(cuit)}</idPersona>` +
      '</a5:getPersona_v2>',
  });
  const p = body?.getPersona_v2Response?.personaReturn;
  if (!p) throw new ArcaError('El padrón no devolvió datos', [], 'Padron A5');
  if (p.errorConstancia && !p.datosGenerales) {
    const msgs = comoLista(p.errorConstancia.error).map(String);
    throw new ArcaError(`Padrón: ${msgs.join(' | ')}`, msgs.map((m) => ({ codigo: 'padron', mensaje: m })), 'Padron A5');
  }
  return interpretarPersona(cuit, p);
}

export function interpretarPersona(cuit: string, p: any): DatosPadron {
  const g = p?.datosGenerales ?? {};
  const nombre = g.razonSocial ? String(g.razonSocial) : [g.apellido, g.nombre].filter(Boolean).join(' ');
  const d = g.domicilioFiscal;
  const domicilio = d ? [d.direccion, d.localidad, d.descripcionProvincia].filter(Boolean).join(', ') : undefined;

  const mono = p?.datosMonotributo;
  const impuestos = comoLista(p?.datosRegimenGeneral?.impuesto).map((i: any) => Number(i.idImpuesto));
  let condicion: CondicionFiscal = 'consumidor_final';
  if (mono) condicion = 'monotributo';
  else if (impuestos.includes(30)) condicion = 'responsable_inscripto';
  else if (impuestos.includes(32)) condicion = 'exento';

  const actividades = [
    ...comoLista(mono?.actividadMonotributista),
    ...comoLista(p?.datosRegimenGeneral?.actividad),
  ]
    .map((a: any) => a?.descripcionActividad)
    .filter(Boolean)
    .map(String);

  return {
    cuit,
    nombre,
    tipoPersona: String(g.tipoPersona ?? ''),
    condicion,
    categoriaMonotributo: mono?.categoriaMonotributo?.descripcionCategoria
      ? String(mono.categoriaMonotributo.descripcionCategoria)
      : undefined,
    domicilio,
    actividades,
    original: p,
  };
}
