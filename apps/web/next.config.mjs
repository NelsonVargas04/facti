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

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
