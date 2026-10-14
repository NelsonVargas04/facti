/**
 * Configuración y endpoints de los web services de ARCA.
 * Los dominios *.afip.gov.ar siguen siendo los publicados en los manuales técnicos;
 * verificar contra la documentación vigente antes de pasar a producción.
 */
export type Entorno = 'homologacion' | 'produccion';

export const ENDPOINTS = {
  homologacion: {
    wsaa: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
    wsfe: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
    padron: 'https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5',
  },
  produccion: {
    wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
    wsfe: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
    padron: 'https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5',
  },
} as const;

/** Nombres de servicio que se piden al WSAA. */
export const SERVICIOS = {
  facturacion: 'wsfe',
  padron: 'ws_sr_constancia_inscripcion',
} as const;
export type Servicio = (typeof SERVICIOS)[keyof typeof SERVICIOS];

export interface ArcaConfig {
  entorno: Entorno;
  /** CUIT dueño del certificado (Facti en producción). */
  cuitCertificado: string;
  /** Certificado X.509 en PEM. */
  certPem: string;
  /** Clave privada en PEM. Nunca se loguea ni se sube al repo. */
  keyPem: string;
  /** Carpeta para guardar tickets de acceso. Si no se indica, solo se cachean en memoria. */
  cacheDir?: string;
  /** Tiempo máximo de espera por llamada, en milisegundos. */
  timeoutMs?: number;
}
