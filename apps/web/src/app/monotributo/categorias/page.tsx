'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AvisoApi } from '@/components/AvisoApi';
import { FactiWordmark } from '@/components/FactiLogo';
import { Icon } from '@/components/Icon';
import { fechaAR, TablaCategorias } from '@/components/monotributo/Categorias';
import { CuadroArca } from '@/components/monotributo/CuadroArca';
import { verCategorias } from '@/lib/api';
import { useApi } from '@/lib/useApi';

/**
 * Cuadro de categorías del monotributo, solo la tabla (sin el menú de la app), como en ARCA.
 * Es público: los valores son los de ARCA y se actualizan solos. ?cat=D&ideal=E marca tu categoría
 * y la que te corresponde.
 */
function Pagina() {
  const params = useSearchParams();
  const cat = params.get('cat')?.toUpperCase() || undefined;
  const ideal = params.get('ideal')?.toUpperCase() || undefined;
  const escala = useApi(verCategorias, []);
  const e = escala.dato;

  return (
    <div className="min-h-screen bg-fondo">
      <header className="mx-auto flex max-w-[1800px] items-center justify-between gap-4 px-4 py-5 sm:px-8">
        <Link href="/app/monotributo/pagos" aria-label="Volver a Facti">
          <FactiWordmark size={30} />
        </Link>
        <Link href="/app/monotributo/pagos" className="inline-flex items-center gap-1.5 font-bold text-primario-oscuro hover:text-texto">
          <Icon name="volver" size={18} />
          Volver a Monotributo
        </Link>
      </header>

      <main className="mx-auto flex max-w-[1800px] flex-col gap-5 px-4 pb-12 sm:px-8">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2.5 text-[26px] font-bold leading-tight text-[#1B5E8A] sm:text-[32px]">
            <Icon name="check-circulo" size={30} weight="fill" />
            {e ? `Valores de aplicación desde el ${fechaAR(e.vigenteDesde)}` : 'Categorías del monotributo'}
          </h1>
          {e && (
            <p className="text-texto-suave">
              {e.origen === 'arca'
                ? 'Tomados de la web de ARCA. Se actualizan solos cuando ARCA publica una tabla nueva.'
                : 'No pudimos consultar ARCA ahora: mostramos la última tabla conocida.'}
            </p>
          )}
        </div>

        {escala.estado === 'error' && !e ? (
          <AvisoApi error={escala.error} onReintentar={escala.recargar} />
        ) : !e ? (
          <div className="skeleton h-[520px] rounded-[16px]" />
        ) : (
          <>
            {/* Compu: el cuadro igual al de ARCA */}
            <div className="hidden lg:block">
              <CuadroArca escala={e} tuya={cat} ideal={ideal} />
            </div>
            {/* Celular y tablet: una fila por categoría con el detalle desplegable */}
            <div className="lg:hidden">
              <TablaCategorias escala={e} categoria={cat} corresponde={ideal} />
            </div>

            <section className="flex flex-col gap-2 text-texto-suave">
              <h2 className="font-bold text-texto">Referencias</h2>
              <p>Los topes de ingresos brutos son anuales (los últimos 12 meses). La cuota es el total por mes: impuesto integrado, aportes al SIPA y obra social.</p>
              <p>
                Hay excepciones (por ejemplo, quienes no pagan impuesto integrado o aportes). Están detalladas en{' '}
                <a href={e.fuente} target="_blank" rel="noopener noreferrer" className="font-semibold text-primario-oscuro underline-offset-2 hover:underline">
                  la tabla oficial de ARCA
                </a>
                .
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default function CategoriasMonotributo() {
  return (
    <Suspense>
      <Pagina />
    </Suspense>
  );
}
