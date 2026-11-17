'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CATEGORIAS_MONOTRIBUTO, obtenerParametro } from '@facti/shared/src/parametros';
import { Icon } from '@/components/Icon';
import type { CategoriaMonotributo, EscalaMonotributo } from '@/lib/api';
import { pesos } from '@/lib/formato';

/** Topes por categoría: los de la API (leídos de ARCA) o, si no llegaron, los de los parámetros. */
export function topes(escala?: EscalaMonotributo | null): Record<string, number> {
  if (escala?.categorias?.length) return Object.fromEntries(escala.categorias.map((c) => [c.letra, c.tope]));
  const out: Record<string, number> = {};
  for (const l of CATEGORIAS_MONOTRIBUTO) {
    try {
      out[l] = obtenerParametro(`monotributo.tope_anual.${l}`);
    } catch {
      /* sin dato */
    }
  }
  return out;
}

/** Primera categoría cuyo tope no se supera (solo por ingresos). null si se pasa de la K. */
export function categoriaQueCorresponde(ingresos: number, t: Record<string, number>): string | null {
  for (const l of CATEGORIAS_MONOTRIBUTO) if (t[l] !== undefined && ingresos <= t[l]!) return l;
  return null;
}

const fechaAR = (iso: string) => iso.split('-').reverse().join('/');

/**
 * Barra como la de ARCA: lo facturado contra el tope de tu categoría, con la marca de dónde estás,
 * cuánto te queda y qué categoría te corresponde.
 */
export function BarraTope({ facturado, categoria, escala, desde, hasta }: { facturado: number; categoria?: string; escala?: EscalaMonotributo | null; desde?: string; hasta?: string }) {
  const t = topes(escala);
  const letra = categoria?.toUpperCase();
  const tope = letra ? t[letra] : undefined;
  const corresponde = categoriaQueCorresponde(facturado, t);
  const pct = tope ? Math.min(100, (facturado / tope) * 100) : 0;
  const pasado = tope !== undefined && facturado > tope;
  const cerca = !pasado && pct >= 80;
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setAncho(pct), 80);
    return () => clearTimeout(id);
  }, [pct]);

  const color = pasado ? 'bg-[#E5484D]' : cerca ? 'bg-[#E0A100]' : 'bg-primario';

  return (
    <div className="flex flex-col gap-4">
      {tope === undefined ? (
        <p className="rounded-[14px] bg-fondo px-4 py-3 text-texto-suave">Cargá tu categoría para ver cuánto te falta para el tope.</p>
      ) : (
        <>
          <div className="relative pb-[68px] pt-1">
            {/* Barra */}
            <div className="relative h-8 rounded-full bg-[#ECEFF5]">
              <div className="absolute inset-y-0 left-0 overflow-hidden rounded-full" style={{ width: `${ancho}%`, transition: 'width 0.8s cubic-bezier(0.23,1,0.32,1)' }}>
                <div className={`h-full w-full ${color}`} />
              </div>
              {/* Letra de la categoría al final, como en ARCA */}
              <span className="absolute -right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-texto font-bold text-white ring-4 ring-superficie">{letra}</span>
            </div>
            {/* Marca de lo facturado */}
            <div className="absolute top-10 flex flex-col items-center" style={{ left: `clamp(56px, ${ancho}%, calc(100% - 200px))`, transform: 'translateX(-50%)', transition: 'left 0.8s cubic-bezier(0.23,1,0.32,1)' }}>
              <span className="h-0 w-0 border-x-[7px] border-b-[9px] border-x-transparent border-b-texto" />
              <span className="mt-1 whitespace-nowrap font-bold tabular-nums">{pesos(facturado)}</span>
              <span className="whitespace-nowrap text-texto-suave">Facturado</span>
            </div>
            {/* Tope */}
            <div className="absolute right-0 top-10 flex flex-col items-end">
              <span className="mr-[13px] h-0 w-0 border-x-[7px] border-b-[9px] border-x-transparent border-b-texto" />
              <span className="mt-1 whitespace-nowrap font-bold tabular-nums">{pesos(tope)}</span>
              <span className="whitespace-nowrap text-texto-suave">Tope categoría {letra}</span>
            </div>
          </div>

          <p className={`rounded-[14px] px-4 py-3 font-semibold ${pasado ? 'bg-error-suave text-error' : cerca ? 'bg-aviso-suave text-aviso-texto' : 'bg-exito-suave text-exito-texto'}`}>
            {pasado
              ? corresponde
                ? `Te pasaste del tope por ${pesos(facturado - tope)}: por ingresos te corresponde la categoría ${corresponde}.`
                : 'Te pasaste del tope de la categoría K: consultá con un contador, podrías quedar fuera del monotributo.'
              : `Te quedan ${pesos(tope - facturado)} para llegar al tope de la categoría ${letra}.`}
            {!pasado && corresponde && corresponde !== letra && ` Por ingresos, hoy entrarías en la ${corresponde}.`}
          </p>
        </>
      )}
      {(desde || hasta) && (
        <p className="text-texto-tenue">
          Período {desde && fechaAR(desde)} al {hasta && fechaAR(hasta)}
          {escala && ` · Topes de ARCA vigentes desde el ${fechaAR(escala.vigenteDesde)}`}
        </p>
      )}
    </div>
  );
}

const COLUMNAS: { k: keyof CategoriaMonotributo; t: string; dinero?: boolean }[] = [
  { k: 'tope', t: 'Ingresos brutos', dinero: true },
  { k: 'superficie', t: 'Superficie' },
  { k: 'energia', t: 'Energía anual' },
  { k: 'alquileres', t: 'Alquileres anuales', dinero: true },
  { k: 'precioMaximo', t: 'Precio unitario máx.', dinero: true },
  { k: 'impServicios', t: 'Impuesto servicios', dinero: true },
  { k: 'impVentas', t: 'Impuesto ventas', dinero: true },
  { k: 'sipa', t: 'Aportes SIPA', dinero: true },
  { k: 'obraSocial', t: 'Obra social', dinero: true },
  { k: 'cuotaServicios', t: 'Cuota servicios', dinero: true },
  { k: 'cuotaVentas', t: 'Cuota ventas', dinero: true },
];

const valor = (c: CategoriaMonotributo, col: (typeof COLUMNAS)[number]) => (col.dinero ? pesos(Number(c[col.k])) : String(c[col.k] || '—'));

/** Botón "Ver categorías": abre el cuadro oficial completo, con tu categoría marcada. */
export function VerCategorias({ escala, categoria, corresponde }: { escala?: EscalaMonotributo | null; categoria?: string; corresponde?: string | null }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        disabled={!escala}
        className="btn-lift inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] border-borde bg-white px-5 font-bold text-texto hover:border-primario hover:text-primario-oscuro disabled:opacity-50"
      >
        <Icon name="monotributo" size={18} />
        Ver categorías
      </button>
      <AnimatePresence>{abierto && escala && <Cuadro escala={escala} categoria={categoria?.toUpperCase()} corresponde={corresponde} onCerrar={() => setAbierto(false)} />}</AnimatePresence>
    </>
  );
}

function Cuadro({ escala, categoria, corresponde, onCerrar }: { escala: EscalaMonotributo; categoria?: string; corresponde?: string | null; onCerrar: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', esc);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', esc);
  }, [onCerrar]);

  const marca = (l: string) => (l === categoria ? 'Tu categoría' : l === corresponde ? 'Te corresponde' : '');

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="cuadro-titulo">
      <motion.button type="button" aria-label="Cerrar" onClick={onCerrar} className="absolute inset-0 bg-[#15193A]/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div
        ref={ref}
        tabIndex={-1}
        className="relative flex max-h-[90vh] w-full max-w-[1200px] flex-col overflow-hidden rounded-t-[28px] bg-superficie shadow-tarjeta outline-none sm:rounded-tarjeta"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#EDF0F6] p-5 sm:p-6">
          <div>
            <h2 id="cuadro-titulo" className="text-[22px] font-bold">Categorías del monotributo</h2>
            <p className="text-texto-suave">
              Valores de ARCA vigentes desde el {fechaAR(escala.vigenteDesde)}.{' '}
              {escala.origen === 'arca' ? 'Se actualizan solos desde ARCA.' : 'No pudimos consultar ARCA ahora: mostramos la última tabla conocida.'}
            </p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-texto-suave hover:bg-fondo hover:text-texto">
            <Icon name="cerrar" size={20} />
          </button>
        </div>

        <div className="overflow-auto p-4 sm:p-6">
          {/* Celular: una tarjeta por categoría */}
          <ul className="flex flex-col gap-3 md:hidden">
            {escala.categorias.map((c) => (
              <li key={c.letra} className={`rounded-[18px] border-[1.5px] p-4 ${c.letra === categoria ? 'border-primario bg-primario-suave/40' : c.letra === corresponde ? 'border-[#E0A100] bg-aviso-suave/50' : 'border-[#E6E9F1]'}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-texto font-bold text-white">{c.letra}</span>
                    <strong className="tabular-nums">{pesos(c.tope)}</strong>
                  </span>
                  {marca(c.letra) && <span className="rounded-full bg-white px-2.5 py-0.5 font-semibold text-primario-oscuro">{marca(c.letra)}</span>}
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {COLUMNAS.slice(1).map((col) => (
                    <div key={col.k} className="flex flex-col">
                      <dt className="text-texto-tenue">{col.t}</dt>
                      <dd className="font-semibold tabular-nums">{valor(c, col)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>

          {/* Compu: el cuadro completo */}
          <table className="hidden w-full border-collapse md:table">
            <thead>
              <tr className="bg-texto text-white">
                <th className="sticky left-0 rounded-tl-[12px] bg-texto px-3 py-3 text-left font-semibold">Cat.</th>
                {COLUMNAS.map((col, i) => (
                  <th key={col.k} className={`whitespace-nowrap px-3 py-3 text-right font-semibold ${i === COLUMNAS.length - 1 ? 'rounded-tr-[12px]' : ''}`}>
                    {col.t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {escala.categorias.map((c) => {
                const tuya = c.letra === categoria;
                const corr = c.letra === corresponde && !tuya;
                return (
                  <tr key={c.letra} className={`border-b border-[#EDF0F6] ${tuya ? 'bg-primario-suave/60' : corr ? 'bg-aviso-suave/60' : 'even:bg-fondo/60'}`}>
                    <th scope="row" className="sticky left-0 bg-inherit px-3 py-3 text-left">
                      <span className="flex items-center gap-2">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${tuya ? 'bg-primario text-white' : 'bg-texto text-white'}`}>{c.letra}</span>
                        {marca(c.letra) && <span className="whitespace-nowrap font-semibold text-primario-oscuro">{marca(c.letra)}</span>}
                      </span>
                    </th>
                    {COLUMNAS.map((col) => (
                      <td key={col.k} className={`whitespace-nowrap px-3 py-3 text-right tabular-nums ${col.k === 'tope' || col.k.startsWith('cuota') ? 'font-semibold text-texto' : 'text-texto-suave'}`}>
                        {valor(c, col)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EDF0F6] px-5 py-4 sm:px-6">
          <p className="text-texto-tenue">Fuente: ARCA. La cuota mensual es el total (impuesto integrado, SIPA y obra social).</p>
          <a href={escala.fuente} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-bold text-primario-oscuro hover:underline">
            Ver en ARCA <Icon name="link-externo" size={16} />
          </a>
        </div>
      </motion.div>
    </div>
  );
}
