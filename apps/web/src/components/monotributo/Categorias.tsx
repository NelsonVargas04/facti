'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

export const fechaAR = (iso: string) => iso.split('-').reverse().join('/');

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

/** Monto con centavos, como en la tabla de ARCA. */
const exacto = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const valor = (c: CategoriaMonotributo, col: (typeof COLUMNAS)[number]) => (col.dinero ? exacto(Number(c[col.k])) : String(c[col.k] || '—'));

/** Una categoría: fila con tope y cuotas; al tocarla se abre el detalle completo. */
function FilaCategoria({ c, tuya, corresponde }: { c: CategoriaMonotributo; tuya: boolean; corresponde: boolean }) {
  const [abierta, setAbierta] = useState(tuya);
  // Tu categoría se abre sola cuando llegan tus datos (pueden llegar después que la tabla).
  useEffect(() => {
    if (tuya) setAbierta(true);
  }, [tuya]);
  const detalle = COLUMNAS.filter((col) => !['tope', 'cuotaServicios', 'cuotaVentas'].includes(col.k));
  const cuotas = COLUMNAS.filter((col) => col.k === 'cuotaServicios' || col.k === 'cuotaVentas');
  return (
    <li className={`border-b border-[#EDF0F6] last:border-0 ${tuya ? 'rounded-[16px] bg-primario-suave/50' : corresponde ? 'rounded-[16px] bg-aviso-suave/60' : ''}`}>
      <button
        type="button"
        onClick={() => setAbierta((x) => !x)}
        aria-expanded={abierta}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto_24px] items-center gap-3 rounded-[16px] px-3 py-3 text-left transition-colors hover:bg-fondo/70 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_32px] md:gap-4"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-full text-[18px] font-bold text-white ${tuya ? 'bg-primario' : 'bg-texto'}`}>{c.letra}</span>
          {tuya && <span className="whitespace-nowrap rounded-full bg-white px-2.5 py-0.5 font-semibold text-primario-oscuro"><span className="sm:hidden">Tuya</span><span className="hidden sm:inline">Tu categoría</span></span>}
          {corresponde && <span className="whitespace-nowrap rounded-full bg-white px-2.5 py-0.5 font-semibold text-aviso-texto"><span className="sm:hidden">Ideal</span><span className="hidden sm:inline">Te corresponde</span></span>}
        </span>
        <span className="text-right font-bold tabular-nums">{exacto(c.tope)}</span>
        <span className="hidden text-right tabular-nums md:block">{exacto(c.cuotaServicios)}</span>
        <span className="hidden text-right tabular-nums md:block">{exacto(c.cuotaVentas)}</span>
        <span className={`flex justify-end text-texto-tenue transition-transform ${abierta ? 'rotate-180' : ''}`}>
          <Icon name="chevron-abajo" size={20} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {abierta && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-3 pb-4 pt-1 sm:grid-cols-3 md:pl-[64px] lg:grid-cols-4">
              {/* En celular las cuotas van acá, porque no entran en la fila. */}
              {cuotas.map((col) => (
                <div key={col.k} className="flex flex-col md:hidden">
                  <dt className="text-texto-tenue">{col.t}</dt>
                  <dd className="font-semibold tabular-nums">{valor(c, col)}</dd>
                </div>
              ))}
              {detalle.map((col) => (
                <div key={col.k} className="flex flex-col">
                  <dt className="text-texto-tenue">{col.t}</dt>
                  <dd className="font-semibold tabular-nums">{valor(c, col)}</dd>
                </div>
              ))}
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}


/** Botón "Ver categorías": lleva al cuadro oficial (sin el menú), con tu categoría y la que te corresponde marcadas. */
export function VerCategorias({ categoria, corresponde }: { categoria?: string; corresponde?: string | null }) {
  const q = new URLSearchParams();
  if (categoria) q.set('cat', categoria.toUpperCase());
  if (corresponde) q.set('ideal', corresponde);
  return (
    <Link
      href={`/monotributo/categorias${q.size ? `?${q}` : ''}`}
      className="btn-lift inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] border-borde bg-white px-5 font-bold text-texto hover:border-primario hover:text-primario-oscuro"
    >
      <Icon name="monotributo" size={18} />
      Ver categorías
    </Link>
  );
}

/** Cuadro oficial de categorías: una fila por categoría (tope y cuotas) con el detalle desplegable. */
export function TablaCategorias({ escala, categoria, corresponde }: { escala: EscalaMonotributo; categoria?: string; corresponde?: string | null }) {
  const tuya = categoria?.toUpperCase();
  return (
    <section className="flex flex-col overflow-hidden rounded-tarjeta bg-superficie shadow-tarjeta">
      <div className="px-3 py-2 sm:px-6 sm:py-3">
        {/* Encabezado de columnas (compu) */}
        <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_32px] gap-4 border-b border-[#EDF0F6] px-3 pb-3 pt-2 font-semibold text-texto-tenue md:grid">
          <span>Categoría</span>
          <span className="text-right">Ingresos brutos (tope anual)</span>
          <span className="text-right">Cuota servicios</span>
          <span className="text-right">Cuota venta de cosas</span>
          <span />
        </div>
        <ul className="flex flex-col">
          {escala.categorias.map((c) => (
            <FilaCategoria key={c.letra} c={c} tuya={c.letra === tuya} corresponde={c.letra === corresponde && c.letra !== tuya} />
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EDF0F6] px-5 py-4 sm:px-6">
        <p className="text-texto-tenue">Fuente: ARCA. Tocá una categoría para ver todo el detalle. La cuota es el total por mes.</p>
        <a href={escala.fuente} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-bold text-primario-oscuro hover:underline">
          Ver en ARCA <Icon name="link-externo" size={16} />
        </a>
      </div>
    </section>
  );
}
