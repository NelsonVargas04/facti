'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AvisoApi } from '@/components/AvisoApi';
import { Facti } from '@/components/Facti';
import { Paginacion } from '@/components/Paginacion';
import { Select } from '@/components/Select';
import { TablaFacturas, TablaSkeleton } from '@/components/TablaFacturas';
import { listarComprobantes, type Cobro } from '@/lib/api';
import { hoyAR, rangoMes } from '@/lib/formato';
import { useApi, useDemorado } from '@/lib/useApi';

type Filtro = 'todas' | 'cobradas' | 'pendientes';
const COBRO: Record<Filtro, Cobro> = { todas: '', cobradas: 'cobrada', pendientes: 'pendiente' };
const ORDENES = [
  { value: 'reciente', label: 'Más reciente' },
  { value: 'antigua', label: 'Más antigua' },
  { value: 'cliente', label: 'Cliente (A–Z)' },
  { value: 'numero', label: 'Número' },
  { value: 'mayor', label: 'Mayor monto' },
  { value: 'menor', label: 'Menor monto' },
];

const FILTROS_SEL = [
  { value: 'todas', label: 'Todas' },
  { value: 'cobradas', label: 'Cobradas' },
  { value: 'pendientes', label: 'Pendientes' },
];

const PERIODOS = [
  { value: 'mes', label: 'Este mes' },
  { value: 'mespasado', label: 'Mes pasado' },
  { value: 'trim', label: 'Últimos 3 meses' },
  { value: 'anio', label: 'Este año' },
  { value: 'todas', label: 'Todo el historial' },
];

/** Rango de fechas del período elegido, en hora de Argentina. */
function rangoDe(periodo: string): { desde?: string; hasta?: string } {
  const hoy = hoyAR();
  switch (periodo) {
    case 'mes': return rangoMes(hoy);
    case 'mespasado': return rangoMes(hoy, -1);
    case 'trim': return { desde: rangoMes(hoy, -2).desde, hasta: rangoMes(hoy).hasta };
    case 'anio': return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: `${hoy.slice(0, 4)}-12-31` };
    default: return {};
  }
}


export default function Facturas() {
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [periodo, setPeriodo] = useState('mes');
  const [orden, setOrden] = useState('reciente');
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const qDemorado = useDemorado(q.trim());

  useEffect(() => setPagina(1), [qDemorado, filtro, orden, periodo]);

  const filtroApi = useMemo(
    () => ({ ...rangoDe(periodo), q: qDemorado, cobro: COBRO[filtro], orden, limite: porPagina, saltar: (pagina - 1) * porPagina }),
    [periodo, qDemorado, filtro, orden, pagina, porPagina],
  );
  const lista = useApi(() => listarComprobantes(filtroApi), [filtroApi]);

  const total = lista.dato?.total ?? 0;
  const visibles = lista.dato?.comprobantes ?? [];
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const hayFiltros = qDemorado !== '' || filtro !== 'todas' || periodo !== 'todas';

  return (
    <>
      {/* Encabezado */}
      <div className="aparece flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-tight sm:text-[34px]">Facturas</h1>
          <p className="text-texto-suave">Todas tus facturas emitidas, en un solo lugar.</p>
        </div>
        <Link href="/app/facturas/nueva" className="btn-lift hidden h-12 items-center gap-2 rounded-full bg-primario px-6 font-bold text-white shadow-boton md:flex">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Emitir factura
        </Link>
      </div>

      {/* Tabla / vacío */}
      <section style={{ animationDelay: '40ms' }} aria-busy={lista.estado === 'cargando'} className="aparece flex flex-col overflow-hidden rounded-tarjeta bg-superficie shadow-tarjeta md:min-h-[540px]">
        {/* Buscador y filtros, dentro de la misma tarjeta que la lista. */}
        <div className="grid grid-cols-2 gap-3 border-b border-[#EDF0F6] p-4 sm:grid-cols-3 sm:p-6 xl:grid-cols-[minmax(240px,1fr)_185px_170px_185px]">
          <label className="col-span-2 flex h-12 min-w-0 items-center gap-2 rounded-input border-[1.5px] border-borde bg-white px-4 transition-colors focus-within:border-primario sm:col-span-3 xl:col-span-1">
            <span className="sr-only">Buscar</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none text-texto-tenue"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cliente o número…"
              className="h-full w-full min-w-0 bg-transparent text-base text-texto outline-none placeholder:text-texto-tenue"
            />
          </label>
          <div className="min-w-0"><Select ariaLabel="Período" value={periodo} onChange={setPeriodo} options={PERIODOS} /></div>
          <div className="min-w-0"><Select ariaLabel="Estado" value={filtro} onChange={(v) => setFiltro(v as Filtro)} options={FILTROS_SEL} /></div>
          <div className="col-span-2 min-w-0 sm:col-span-1"><Select ariaLabel="Ordenar por" value={orden} onChange={setOrden} options={ORDENES} /></div>
        </div>
        <div className="flex flex-1 flex-col p-4 sm:p-6">
        {lista.estado === 'error' && !lista.dato ? (
          <AvisoApi error={lista.error} onReintentar={lista.recargar} />
        ) : !lista.dato ? (
          <TablaSkeleton filas={6} />
        ) : total > 0 ? (
          <>
            {lista.estado === 'error' && <div className="mb-3"><AvisoApi error={lista.error} onReintentar={lista.recargar} compacto /></div>}
            <div className={lista.estado === 'cargando' ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
              {/* La key cambia con el resultado: las filas nuevas entran en cascada al filtrar o cambiar de página. */}
              <TablaFacturas key={visibles.map((v) => v.id).join(',')} rows={visibles} />
            </div>
            <div className="mt-auto border-t border-[#EDF0F6] pt-4">
              <Paginacion
                total={total}
                pagina={paginaActual}
                porPagina={porPagina}
                onPagina={setPagina}
                onPorPagina={(n) => {
                  setPorPagina(n);
                  setPagina(1);
                }}
                singular="factura"
                plural="facturas"
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
            <Facti pose="durmiendo" size={150} animated />
            <h2 className="text-[20px] font-bold">{hayFiltros ? 'No encontramos facturas' : 'Todavía no emitiste facturas'}</h2>
            <p className="max-w-[360px] text-texto-suave">
              {hayFiltros ? 'Probá con otra búsqueda o cambiá el período o el estado.' : 'Cuando emitas la primera, va a aparecer acá.'}
            </p>
            {!hayFiltros && (
              <Link href="/app/facturas/nueva" className="inline-flex items-center justify-center btn-lift rounded-full bg-primario px-6 h-12 font-bold text-white shadow-boton">Emitir factura</Link>
            )}
          </div>
        )}
        </div>
      </section>
    </>
  );
}
