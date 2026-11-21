/**
 * Destino seguro para volver después de iniciar sesión: solo rutas internas de Facti.
 * Rechaza "//otro.com" y "/\otro.com" (el navegador trata "\" como "/") y cualquier otro origen.
 */
export function destinoSeguro(v: string | null | undefined, porDefecto = '/app'): string {
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.includes('\\')) return porDefecto;
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://facti.local';
    const u = new URL(v, base);
    return u.origin === base ? u.pathname + u.search + u.hash : porDefecto;
  } catch {
    return porDefecto;
  }
}
