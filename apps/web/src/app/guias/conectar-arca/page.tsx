'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Escenario, duracionTotal } from '@/components/guia/RecorridoArca';
import { ReproductorArca } from '@/components/guia/ReproductorArca';
import { CUIT_FACTI } from '@/lib/cuitFacti';
import { FactiWordmark } from '@/components/FactiLogo';

declare global {
  interface Window {
    __irA?: (t: number) => Promise<void>;
    __duracion?: number;
  }
}

/** Modo grabación (?grabar=1): el cuadro a 1280×720 en la esquina, manejado por window.__irA(t). */
function Grabar() {
  const [t, setT] = useState(0);
  useEffect(() => {
    window.__duracion = duracionTotal(CUIT_FACTI);
    window.__irA = (x: number) =>
      new Promise((ok) => {
        setT(x);
        requestAnimationFrame(() => requestAnimationFrame(() => ok()));
      });
  }, []);
  return (
    <div className="fixed left-0 top-0">
      {/* El indicador de Next (solo en desarrollo) no tiene que salir en el video. */}
      <style>{'nextjs-portal{display:none!important}'}</style>
      <Escenario t={t} cuitFacti={CUIT_FACTI} />
    </div>
  );
}

function Pagina() {
  const grabar = useSearchParams().get('grabar') === '1';
  if (grabar) return <Grabar />;
  return (
    <main className="mx-auto flex w-full max-w-[1000px] flex-col gap-6 px-4 py-8 sm:px-8">
      <Link href="/" aria-label="Facti inicio"><FactiWordmark size={32} /></Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-[clamp(28px,4vw,40px)] font-bold leading-tight">Cómo conectar Facti con ARCA</h1>
        <p className="text-[17px] text-texto-suave">Paso a paso y despacio: se hace una sola vez, en unos 2 minutos. Facti nunca te pide tu clave fiscal.</p>
      </div>
      <ReproductorArca />
      <p className="text-base text-texto-tenue">Si querés descargarlo, también está como <a className="font-semibold text-primario-oscuro underline-offset-2 hover:underline" href="/videos/conectar-arca.mp4" download>video MP4</a>.</p>
    </main>
  );
}

export default function GuiaConectarArca() {
  return (
    <Suspense>
      <Pagina />
    </Suspense>
  );
}
