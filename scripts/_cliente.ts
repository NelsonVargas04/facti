import { readFileSync } from 'node:fs';
import { CacheTickets, Wsfe, type ArcaConfig, type Entorno } from '../packages/arca/src/index.js';

function requerida(nombre: string): string {
  const v = process.env[nombre];
  if (!v) throw new Error(`Falta la variable ${nombre} en .env (ver .env.example)`);
  return v;
}

export function crearClientes() {
  const cfg: ArcaConfig = {
    entorno: (process.env.ARCA_ENTORNO ?? 'homologacion') as Entorno,
    cuitCertificado: requerida('ARCA_CUIT_CERTIFICADO'),
    certPem: readFileSync(requerida('ARCA_CERT_PATH'), 'utf8'),
    keyPem: readFileSync(requerida('ARCA_KEY_PATH'), 'utf8'),
    cacheDir: process.env.ARCA_CACHE_DIR ?? '.cache',
  };
  if (cfg.entorno === 'produccion') {
    console.warn('ATENCIÓN: estás usando ARCA en PRODUCCIÓN. Los comprobantes son reales.');
  }
  const tickets = new CacheTickets(cfg);
  const cuitEmisor = requerida('ARCA_CUIT_EMISOR');
  const wsfe = new Wsfe(cfg, tickets, cuitEmisor);
  const puntoVenta = Number(process.env.ARCA_PUNTO_VENTA ?? '1');
  return { cfg, tickets, wsfe, cuitEmisor, puntoVenta };
}
