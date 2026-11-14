import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

// Una sola familia para títulos y texto (variable: todos los pesos de 200 a 800).
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Facti — Facturación electrónica conectada con ARCA',
  description:
    'Facti hace la facturación electrónica de ARCA más simple y amigable, todo desde un solo lugar. No es ARCA ni un organismo oficial.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
