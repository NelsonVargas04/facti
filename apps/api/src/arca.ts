import { readFileSync } from 'node:fs';
import { CacheTickets, Wsfe, type ArcaConfig, type Entorno } from '@facti/arca';

/** Falta configuración (variables de entorno o certificado). Se traduce a HTTP 503. */
export class ConfiguracionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfiguracionError';
  }
}

export interface ClientesArca {
  cfg: ArcaConfig;
  tickets: CacheTickets;
  wsfe: Wsfe;
  cuitEmisor: string;
  puntoVenta: number;
}

let memo: ClientesArca | undefined;

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new ConfiguracionError(`Falta la variable ${nombre} (ver .env.example)`);
  return valor;
}

function leerPem(nombre: string): string {
  const ruta = requerida(nombre);
  try {
    return readFileSync(ruta, 'utf8');
  } catch {
    throw new ConfiguracionError(
      `No se pudo leer ${nombre}=${ruta}. ¿Generaste el certificado de homologación? (ver README)`,
    );
  }
}

/**
 * Construye los clientes de ARCA la primera vez que se usan (no al arrancar el server),
 * así el server levanta aunque todavía no haya certificado ni .env.
 */
export function clientesArca(): ClientesArca {
  if (memo) return memo;
  const cfg: ArcaConfig = {
    entorno: (process.env.ARCA_ENTORNO ?? 'homologacion') as Entorno,
    cuitCertificado: requerida('ARCA_CUIT_CERTIFICADO'),
    certPem: leerPem('ARCA_CERT_PATH'),
    keyPem: leerPem('ARCA_KEY_PATH'),
    cacheDir: process.env.ARCA_CACHE_DIR ?? '.cache',
  };
  const tickets = new CacheTickets(cfg);
  const cuitEmisor = requerida('ARCA_CUIT_EMISOR');
  memo = {
    cfg,
    tickets,
    wsfe: new Wsfe(cfg, tickets, cuitEmisor),
    cuitEmisor,
    puntoVenta: Number(process.env.ARCA_PUNTO_VENTA ?? '1'),
  };
  return memo;
}
