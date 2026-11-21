'use client';

import type { PadronDatos } from '@/lib/api';

/**
 * Borrador de la factura que se está armando. Se guarda solo, en este navegador, a cada cambio:
 * si se corta internet, se cierra la pestaña o se recarga, al volver está todo como estaba.
 * Se borra cuando ARCA autoriza la factura.
 *
 * (Es por navegador: para verlo en otro dispositivo habría que guardarlo en la API.)
 */

export interface ItemBorrador {
  id: number;
  desc: string;
  cant: string;
  unidad: string;
  precio: string;
}

export interface Borrador {
  v: 1;
  guardadoEn: string; // ISO
  /** Si viene de "Repetir factura", el número corto de la original. */
  repiteDe?: number;
  tipo: 'C' | 'E';
  incluyeServicio: boolean;
  docTipo: number;
  cuit: string;
  padron: PadronDatos | null;
  condicionVenta: string;
  nombreExt: string;
  pais: string;
  idImpositivo: string;
  monedaExt: string;
  cotizacion: string;
  formaPago: string;
  incoterms: string;
  email: string;
  fecha: string;
  desde: string;
  hasta: string;
  vence: string;
  items: ItemBorrador[];
}

const CLAVE = 'facti-borrador-factura';
/** Por cuenta: si dos personas usan la misma compu, cada una ve solo su borrador. Sin cuenta, no se guarda. */
const clave = (cuentaId?: number) => (cuentaId ? `${CLAVE}-${cuentaId}` : null);

export function leerBorrador(cuentaId?: number): Borrador | null {
  const k = clave(cuentaId);
  if (!k) return null;
  try {
    const s = window.localStorage.getItem(k);
    if (!s) return null;
    const b = JSON.parse(s) as Borrador;
    return b.v === 1 && Array.isArray(b.items) ? b : null;
  } catch {
    return null;
  }
}

export function guardarBorrador(b: Omit<Borrador, 'v' | 'guardadoEn'>, cuentaId?: number): string | null {
  const k = clave(cuentaId);
  if (!k) return null;
  const guardadoEn = new Date().toISOString();
  try {
    window.localStorage.setItem(k, JSON.stringify({ ...b, v: 1, guardadoEn }));
    return guardadoEn;
  } catch {
    return null; // sin almacenamiento (modo privado): la página sigue andando igual
  }
}

export function borrarBorrador(cuentaId?: number) {
  const k = clave(cuentaId);
  if (!k) return;
  try {
    window.localStorage.removeItem(k);
  } catch {
    /* nada */
  }
}

/** ¿El borrador tiene algo que valga la pena recuperar? */
export function tieneContenido(b: Pick<Borrador, 'cuit' | 'nombreExt' | 'email' | 'items'>): boolean {
  return !!(b.cuit.trim() || b.nombreExt.trim() || b.email.trim() || b.items.some((it) => it.desc.trim() || it.precio.trim()));
}

/** "hace un momento", "a las 15:32", "el 16/11 a las 09:10" */
export function cuandoSeGuardo(iso: string): string {
  const d = new Date(iso);
  const seg = (Date.now() - d.getTime()) / 1000;
  if (seg < 45) return 'hace un momento';
  const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });
  const dia = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });
  const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });
  return dia === hoy ? `a las ${hora}` : `el ${dia} a las ${hora}`;
}

/** ¿Hay conexión? (en el servidor, sí) */
export function enLinea(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}
