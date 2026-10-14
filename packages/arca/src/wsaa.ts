import forge from 'node-forge';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ENDPOINTS, type ArcaConfig, type Servicio } from './config.js';
import { ArcaError } from './errores.js';
import { esc, llamarSoap, parsearXml } from './soap.js';

/** Ticket de acceso (TA) que entrega el WSAA. Vale aprox. 12 horas. */
export interface TicketAcceso {
  token: string;
  sign: string;
  expiracion: string; // ISO 8601
}

/** Arma el Ticket de Requerimiento de Acceso (TRA). */
export function crearTRA(servicio: Servicio, ahora: Date = new Date()): string {
  const desde = new Date(ahora.getTime() - 10 * 60_000).toISOString();
  const hasta = new Date(ahora.getTime() + 10 * 60_000).toISOString();
  const uniqueId = Math.floor(ahora.getTime() / 1000);
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<loginTicketRequest version="1.0"><header>' +
    `<uniqueId>${uniqueId}</uniqueId>` +
    `<generationTime>${desde}</generationTime>` +
    `<expirationTime>${hasta}</expirationTime>` +
    `</header><service>${esc(servicio)}</service></loginTicketRequest>`
  );
}

/** Firma el TRA como CMS (PKCS#7) con el certificado y devuelve Base64. */
export function firmarTRA(tra: string, certPem: string, keyPem: string): string {
  const cert = forge.pki.certificateFromPem(certPem);
  const key = forge.pki.privateKeyFromPem(keyPem);
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(tra, 'utf8');
  p7.addCertificate(cert);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256!,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType!, value: forge.pki.oids.data! },
      { type: forge.pki.oids.messageDigest! },
      { type: forge.pki.oids.signingTime!, value: new Date() as unknown as string },
    ],
  });
  p7.sign();
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

/** Llama a LoginCms y devuelve el ticket de acceso. */
export async function loginCms(cfg: ArcaConfig, servicio: Servicio): Promise<TicketAcceso> {
  const cms = firmarTRA(crearTRA(servicio), cfg.certPem, cfg.keyPem);
  const body = await llamarSoap({
    url: ENDPOINTS[cfg.entorno].wsaa,
    accion: '',
    servicio: 'WSAA',
    timeoutMs: cfg.timeoutMs,
    cuerpo:
      '<wsaa:loginCms xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">' +
      `<wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms>`,
  });
  const ret = body?.loginCmsResponse?.loginCmsReturn;
  if (!ret) throw new ArcaError('El WSAA no devolvió un ticket de acceso', [], 'WSAA');
  const ta = parsearXml(String(ret))?.loginTicketResponse;
  const token = ta?.credentials?.token;
  const sign = ta?.credentials?.sign;
  const expiracion = ta?.header?.expirationTime;
  if (!token || !sign || !expiracion) throw new ArcaError('Ticket de acceso incompleto', [], 'WSAA');
  return { token: String(token), sign: String(sign), expiracion: String(expiracion) };
}

/**
 * Guarda los tickets mientras son válidos. El WSAA rechaza pedir un ticket nuevo
 * si todavía hay uno vigente, por eso se persisten en disco y no solo en memoria.
 */
export class CacheTickets {
  private memoria = new Map<string, TicketAcceso>();
  private pendientes = new Map<string, Promise<TicketAcceso>>();

  constructor(private cfg: ArcaConfig) {}

  async obtener(servicio: Servicio): Promise<TicketAcceso> {
    const clave = `${this.cfg.entorno}-${this.cfg.cuitCertificado}-${servicio}`;
    const enMemoria = this.memoria.get(clave);
    if (enMemoria && vigente(enMemoria)) return enMemoria;

    const enDisco = await this.leer(clave);
    if (enDisco && vigente(enDisco)) {
      this.memoria.set(clave, enDisco);
      return enDisco;
    }

    // Evita pedir dos tickets a la vez para el mismo servicio.
    const enCurso = this.pendientes.get(clave);
    if (enCurso) return enCurso;
    const pedido = loginCms(this.cfg, servicio)
      .then(async (ta) => {
        this.memoria.set(clave, ta);
        await this.guardar(clave, ta);
        return ta;
      })
      .finally(() => this.pendientes.delete(clave));
    this.pendientes.set(clave, pedido);
    return pedido;
  }

  private ruta(clave: string): string | undefined {
    return this.cfg.cacheDir ? join(this.cfg.cacheDir, `ta-${clave}.json`) : undefined;
  }

  private async leer(clave: string): Promise<TicketAcceso | undefined> {
    const ruta = this.ruta(clave);
    if (!ruta) return undefined;
    try {
      return JSON.parse(await readFile(ruta, 'utf8')) as TicketAcceso;
    } catch {
      return undefined;
    }
  }

  private async guardar(clave: string, ta: TicketAcceso): Promise<void> {
    const ruta = this.ruta(clave);
    if (!ruta || !this.cfg.cacheDir) return;
    await mkdir(this.cfg.cacheDir, { recursive: true });
    await writeFile(ruta, JSON.stringify(ta), { mode: 0o600 });
  }
}

/** Considera vencido el ticket 5 minutos antes, por margen. */
function vigente(ta: TicketAcceso): boolean {
  return new Date(ta.expiracion).getTime() - 5 * 60_000 > Date.now();
}
