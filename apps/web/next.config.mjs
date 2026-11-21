import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// La web y la API comparten el .env de la raíz del repo. Next.js solo lee el de su carpeta,
// así que acá se cargan las variables públicas (NEXT_PUBLIC_*) del .env de la raíz.
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envRaiz = path.join(raiz, '.env');
if (existsSync(envRaiz)) {
  for (const linea of readFileSync(envRaiz, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*(NEXT_PUBLIC_[A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

// Cabeceras de seguridad. La web solo habla con la API de Facti y con Supabase (login);
// todo lo demás (ARCA, Mercado Pago, calendarios) son links que se abren aparte.
const desarrollo = process.env.NODE_ENV !== 'production';
const origen = (url) => {
  try {
    return url ? new URL(url).origin : '';
  } catch {
    return '';
  }
};
const api = origen(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000');
const supabase = origen(process.env.NEXT_PUBLIC_SUPABASE_URL);
const conexiones = ["'self'", api, supabase, supabase && supabase.replace(/^https:/, 'wss:')].filter(Boolean).join(' ');
const csp = [
  "default-src 'self'",
  // Next.js necesita scripts en línea para hidratar la página; en desarrollo, también eval.
  `script-src 'self' 'unsafe-inline'${desarrollo ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  `connect-src ${conexiones}${desarrollo ? ' ws: http://localhost:*' : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const cabecerasSeguridad = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  ...(desarrollo ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [{ source: '/:path*', headers: cabecerasSeguridad }];
  },
  // Los parámetros normativos (topes, montos con vigencia) vienen de packages/shared, en TypeScript.
  transpilePackages: ['@facti/shared'],
  // El indicador de Next (solo en desarrollo) va abajo a la derecha para no tapar la cuenta del menú.
  devIndicators: { position: 'bottom-right' },
};

export default nextConfig;
