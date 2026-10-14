import { XMLParser } from 'fast-xml-parser';
import { ArcaError, ArcaSinRespuestaError } from './errores.js';

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

export function parsearXml(xml: string): any {
  return parser.parse(xml);
}

/** Escapa texto para insertarlo dentro de XML. */
export function esc(valor: string | number): string {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Normaliza nodos que pueden venir como objeto único o como lista. */
export function comoLista<T>(valor: T | T[] | undefined | null): T[] {
  if (valor === undefined || valor === null || valor === '') return [];
  return Array.isArray(valor) ? valor : [valor];
}

export async function llamarSoap(opts: {
  url: string;
  accion: string;
  cuerpo: string;
  timeoutMs?: number;
  servicio?: string;
}): Promise<any> {
  const envelope =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">' +
    `<soapenv:Header/><soapenv:Body>${opts.cuerpo}</soapenv:Body></soapenv:Envelope>`;

  let respuesta: Response;
  try {
    respuesta = await fetch(opts.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `"${opts.accion}"`,
      },
      body: envelope,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
    });
  } catch (e) {
    throw new ArcaSinRespuestaError(`Sin respuesta de ${opts.servicio ?? opts.url}`, e);
  }

  const texto = await respuesta.text();
  let xml: any;
  try {
    xml = parsearXml(texto);
  } catch {
    throw new ArcaError(`Respuesta inválida de ${opts.servicio ?? opts.url} (HTTP ${respuesta.status})`);
  }

  const body = xml?.Envelope?.Body;
  if (body?.Fault) {
    const f = body.Fault;
    throw new ArcaError(
      String(f.faultstring ?? 'Error SOAP'),
      [{ codigo: String(f.faultcode ?? ''), mensaje: String(f.faultstring ?? '') }],
      opts.servicio,
    );
  }
  if (!respuesta.ok || !body) {
    throw new ArcaError(`HTTP ${respuesta.status} en ${opts.servicio ?? opts.url}`, [], opts.servicio);
  }
  return body;
}
