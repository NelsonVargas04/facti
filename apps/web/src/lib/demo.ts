'use client';

/**
 * Modo demo (solo en la compu): con NEXT_PUBLIC_DEMO=1 aparece "Entrar con la cuenta de prueba"
 * en /ingresar. Entra sin Supabase: la web manda el token fijo "demo" y la API (con FACTI_DEMO=1)
 * responde con una cuenta de ejemplo en memoria.
 */
export const demoHabilitado = process.env.NEXT_PUBLIC_DEMO === '1';

const CLAVE = 'facti-demo';
const EVENTO = 'facti-demo-cambio';
export const TOKEN_DEMO = 'demo';
export const EMAIL_DEMO = 'demo@facti.test';

export function enDemo(): boolean {
  if (!demoHabilitado || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(CLAVE) === '1';
  } catch {
    return false;
  }
}

function fijar(valor: boolean) {
  try {
    if (valor) window.localStorage.setItem(CLAVE, '1');
    else window.localStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento: el modo demo dura hasta recargar */
  }
  window.dispatchEvent(new Event(EVENTO));
}

export const entrarDemo = () => fijar(true);
export const salirDemo = () => fijar(false);

/** Avisa cuando se entra o se sale del modo demo. */
export function alCambiarDemo(fn: () => void): () => void {
  window.addEventListener(EVENTO, fn);
  return () => window.removeEventListener(EVENTO, fn);
}
