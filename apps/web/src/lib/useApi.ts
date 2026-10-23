'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ErrorApi, Resultado } from '@/lib/api';

export type EstadoApi<T> =
  | { estado: 'cargando'; dato?: T }
  | { estado: 'ok'; dato: T }
  | { estado: 'error'; error: ErrorApi; dato?: T };

/**
 * Carga datos de la API cuando cambian las dependencias. Mientras recarga deja el dato anterior
 * (para no parpadear) y descarta respuestas viejas si el pedido cambió en el medio.
 */
export function useApi<T>(cargar: () => Promise<Resultado<T>>, deps: unknown[]) {
  const [st, setSt] = useState<EstadoApi<T>>({ estado: 'cargando' });
  const turno = useRef(0);

  const recargar = useCallback(async () => {
    const mio = ++turno.current;
    setSt((s) => ({ estado: 'cargando', dato: s.dato }));
    const r = await cargar();
    if (mio !== turno.current) return;
    setSt((s) => (r.ok ? { estado: 'ok', dato: r.dato } : { estado: 'error', error: r, dato: s.dato }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return { ...st, recargar, setDato: (dato: T) => setSt({ estado: 'ok', dato }) };
}

/** Espera a que el usuario deje de escribir para no pedirle a la API en cada tecla. */
export function useDemorado<T>(valor: T, ms = 300): T {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}
