'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BackLink } from '@/components/BackLink';
import { FactiWordmark } from '@/components/FactiLogo';
import { Reproductor } from '@/components/guia/ReproductorArca';
import { EscenarioRecategorizacion, duracionRecategorizacion } from '@/components/guia/RecorridoRecategorizacion';

/** Modo grabación (?grabar=1): el cuadro a 1280×720, manejado por window.__irA(t) (scripts/grabar-guia-arca.mjs). */
function Grabar() {
  const [t, setT] = useState(0);
  useEffect(() => {
    window.__duracion = duracionRecategorizacion();
    window.__irA = (x: number) =>
      new Promise((ok) => {
        setT(x);
        requestAnimationFrame(() => requestAnimationFrame(() => ok()));
      });
  }, []);
  return (
    <div className="fixed left-0 top-0">
      <style>{'nextjs-portal{display:none!important}'}</style>
      <EscenarioRecategorizacion t={t} />
    </div>
  );
}

function Pagina() {
  const grabar = useSearchParams().get('grabar') === '1';
  if (grabar) return <Grabar />;
  return (
    <main className="mx-auto flex w-full max-w-[1000px] flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" aria-label="Facti inicio">
          <FactiWordmark size={32} />
        </Link>
        <BackLink href="/app/monotributo/pagos">Volver a Monotributo</BackLink>
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-[clamp(28px,4vw,40px)] font-bold leading-tight">Cómo recategorizarte en el monotributo</h1>
        <p className="text-[17px] text-texto-suave">
          Paso a paso y despacio: qué mirar en Facti, dónde tocar en ARCA y cómo confirmar. Lleva unos 2 minutos. Podés pausarlo y verlo más lento.
        </p>
      </div>
      <Reproductor total={duracionRecategorizacion()} cuadro={(t) => <EscenarioRecategorizacion t={t} />} />
      <p className="text-texto-tenue">
        Es una recreación simplificada de la web de ARCA con números de ejemplo. También está como{' '}
        <a className="font-semibold text-primario-oscuro underline-offset-2 hover:underline" href="/videos/recategorizacion.mp4" download>
          video MP4
        </a>
        .
      </p>
    </main>
  );
}

export default function GuiaRecategorizacion() {
  return (
    <Suspense>
      <Pagina />
    </Suspense>
  );
}
