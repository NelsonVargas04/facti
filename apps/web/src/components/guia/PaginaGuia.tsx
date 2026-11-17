'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BackLink } from '@/components/BackLink';
import { FactiWordmark } from '@/components/FactiLogo';
import { Reproductor } from '@/components/guia/ReproductorArca';

/**
 * Página de una guía en video: título, reproductor (con pausa y velocidad) y link al MP4.
 * Con ?grabar=1 muestra solo el cuadro a 1280×720 para que scripts/grabar-guia-arca.mjs lo grabe.
 */
export function PaginaGuia({
  titulo,
  bajada,
  total,
  cuadro,
  mp4,
  volver,
}: {
  titulo: string;
  bajada: string;
  total: number;
  cuadro: (t: number) => ReactNode;
  mp4: string;
  volver: { href: string; texto: string };
}) {
  const grabar = useSearchParams().get('grabar') === '1';
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!grabar) return;
    window.__duracion = total;
    window.__irA = (x: number) =>
      new Promise((ok) => {
        setT(x);
        requestAnimationFrame(() => requestAnimationFrame(() => ok()));
      });
  }, [grabar, total]);

  if (grabar) {
    return (
      <div className="fixed left-0 top-0">
        <style>{'nextjs-portal{display:none!important}'}</style>
        {cuadro(t)}
      </div>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[1000px] flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" aria-label="Facti inicio">
          <FactiWordmark size={32} />
        </Link>
        <BackLink href={volver.href}>{volver.texto}</BackLink>
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-[clamp(28px,4vw,40px)] font-bold leading-tight">{titulo}</h1>
        <p className="text-[17px] text-texto-suave">{bajada}</p>
      </div>
      <Reproductor total={total} cuadro={cuadro} />
      <p className="text-texto-tenue">
        Es una recreación simplificada de la web de ARCA con números de ejemplo. También está como{' '}
        <a className="font-semibold text-primario-oscuro underline-offset-2 hover:underline" href={mp4} download>
          video MP4
        </a>
        .
      </p>
    </main>
  );
}

/** Tarjeta "Ver el video paso a paso" con la portada del video. */
export function BotonVideo({ href, portada, titulo = 'Ver el video paso a paso', texto }: { href: string; portada: string; titulo?: string; texto: string }) {
  return (
    <Link href={href} className="group flex items-center gap-4 rounded-[18px] bg-fondo p-3 pr-5 transition-colors hover:bg-primario-suave">
      <span className="relative flex h-[72px] w-[128px] flex-none items-center justify-center overflow-hidden rounded-[12px] bg-texto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {/* Si la portada no carga, se esconde y queda el fondo con el botón de play (nunca un ícono roto). */}
        <img
          src={portada}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-80"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-tarjeta transition-transform group-hover:scale-110">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14l11-7z" fill="#3B3FD8" />
          </svg>
        </span>
      </span>
      <span className="flex min-w-0 flex-col">
        <strong>{titulo}</strong>
        <span className="text-texto-suave">{texto}</span>
      </span>
    </Link>
  );
}
