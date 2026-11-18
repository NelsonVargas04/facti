'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Billetera de la cuenta: medios de pago, plan y pagos a Facti.
 *
 * VISTA PREVIA: todavía no hay cobros reales. Esto vive solo en el navegador (localStorage) para ver
 * cómo va a funcionar. Cuando se conecte Mercado Pago:
 *  - la tarjeta se carga en el formulario seguro de Mercado Pago (Card Payment Brick): Facti recibe un
 *    token y guarda solo marca, últimos 4 y vencimiento. Nunca el número ni el código de seguridad;
 *  - "Conectar Mercado Pago" lleva a Mercado Pago para autorizar el débito mensual (suscripción);
 *  - el plan, los medios y los pagos los da la API.
 */

export type Medio =
  | { id: string; tipo: 'tarjeta'; marca: string; ultimos: string; vence: string }
  | { id: string; tipo: 'mercadopago'; cuenta: string };

export interface Pago {
  id: string;
  fecha: string; // AAAA-MM-DD
  concepto: string;
  medioId: string;
  importe: string;
  estado: 'aprobado' | 'rechazado';
}

export interface Billetera {
  plan: 'gratis' | 'pro';
  /** Fecha del próximo cobro (solo Pro). */
  proximoCobro?: string;
  principal?: string;
  medios: Medio[];
  pagos: Pago[];
}

const CLAVE = 'facti-billetera-preview';
const VACIA: Billetera = { plan: 'gratis', medios: [], pagos: [] };

function leer(): Billetera {
  try {
    const s = window.localStorage.getItem(CLAVE);
    return s ? { ...VACIA, ...(JSON.parse(s) as Billetera) } : VACIA;
  } catch {
    return VACIA;
  }
}

function guardar(b: Billetera) {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(b));
  } catch {
    /* sin almacenamiento: dura hasta recargar */
  }
}

const hoyIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

function enUnMes(iso: string) {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const f = new Date(Date.UTC(y, m, Math.min(d, 28)));
  return f.toISOString().slice(0, 10);
}

const TARJETAS_PRUEBA = [
  { marca: 'Visa', ultimos: '4242', vence: '12/29' },
  { marca: 'Mastercard', ultimos: '5454', vence: '08/28' },
  { marca: 'American Express', ultimos: '0005', vence: '03/30' },
  { marca: 'Naranja', ultimos: '1234', vence: '11/27' },
];

const nuevoId = () => Math.random().toString(36).slice(2, 10);

export function nombreMedio(m: Medio): string {
  return m.tipo === 'tarjeta' ? `${m.marca} terminada en ${m.ultimos}` : 'Mercado Pago';
}

export function useBilletera() {
  const [b, setB] = useState<Billetera | null>(null);
  useEffect(() => setB(leer()), []);

  const cambiar = useCallback((fn: (b: Billetera) => Billetera) => {
    setB((prev) => {
      const sig = fn(prev ?? VACIA);
      guardar(sig);
      return sig;
    });
  }, []);

  return {
    billetera: b,
    /** Simula lo que devolvería Mercado Pago después del formulario seguro (tarjeta de prueba). */
    agregarTarjetaPrueba: () =>
      cambiar((x) => {
        const id = nuevoId();
        // Tarjetas de prueba distintas, para ver cómo queda la billetera con varias.
        const n = x.medios.filter((m) => m.tipo === 'tarjeta').length;
        const muestra = TARJETAS_PRUEBA[n % TARJETAS_PRUEBA.length]!;
        const medio: Medio = { id, tipo: 'tarjeta', ...muestra, ultimos: String((Number(muestra.ultimos) + Math.floor(n / TARJETAS_PRUEBA.length) * 111) % 10000).padStart(4, '0') };
        return { ...x, medios: [...x.medios, medio], principal: x.principal ?? id };
      }),
    /** Simula la vuelta de Mercado Pago después de autorizar. */
    conectarMercadoPago: () =>
      cambiar((x) => {
        if (x.medios.some((m) => m.tipo === 'mercadopago')) return x;
        const id = nuevoId();
        return { ...x, medios: [...x.medios, { id, tipo: 'mercadopago', cuenta: 'Tu cuenta de Mercado Pago' }], principal: x.principal ?? id };
      }),
    quitar: (id: string) =>
      cambiar((x) => {
        const medios = x.medios.filter((m) => m.id !== id);
        return { ...x, medios, principal: x.principal === id ? medios[0]?.id : x.principal };
      }),
    hacerPrincipal: (id: string) => cambiar((x) => ({ ...x, principal: id })),
    pasarAPro: (medioId: string, importe: string) =>
      cambiar((x) => {
        const hoy = hoyIso();
        const pago: Pago = { id: nuevoId(), fecha: hoy, concepto: 'Facti Pro · 1 mes', medioId, importe, estado: 'aprobado' };
        return { ...x, plan: 'pro', principal: medioId, proximoCobro: enUnMes(hoy), pagos: [pago, ...x.pagos] };
      }),
    darDeBaja: () => cambiar((x) => ({ ...x, plan: 'gratis', proximoCobro: undefined })),
    reiniciar: () => cambiar(() => VACIA),
  };
}
