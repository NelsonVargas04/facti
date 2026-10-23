import type { Metadata } from 'next';
import { Quicksand, Nunito, Caveat } from 'next/font/google';
import './globals.css';

const quicksand = Quicksand({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-quicksand',
  display: 'swap',
});

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-nunito',
  display: 'swap',
});

const caveat = Caveat({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-caveat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Facti — Facturá en ARCA sin dolores de cabeza',
  description:
    'Facti hace la facturación electrónica de ARCA más simple y amigable, todo desde un solo lugar. No es ARCA ni un organismo oficial.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${quicksand.variable} ${nunito.variable} ${caveat.variable}`}>{children}</body>
    </html>
  );
}
