'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AvisoApi } from '@/components/AvisoApi';
import { Facti } from '@/components/Facti';
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

const POR_PAGINA = 10;

export default function Facturas() {
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [periodo, setPeriodo] = useState('mes');
  const [orden, setOrden] = useState('reciente');
  const [pagina, setPagina] = useState(1);
  const qDemorado = useDemorado(q.trim());

  useEffect(() => setPagina(1), [qDemorado, filtro, orden, periodo]);

  const filtroApi = useMemo(
    () => ({ ...rangoDe(periodo), q: qDemorado, cobro: COBRO[filtro], orden, limite: POR_PAGINA, saltar: (pagina - 1) * POR_PAGINA }),
    [periodo, qDemorado, filtro, orden, pagina],
  );
  const lista = useApi(() => listarComprobantes(filtroApi), [filtroApi]);

  const total = lista.dato?.total ?? 0;
  const visibles = lista.dato?.comprobantes ?? [];
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const desde = total ? (paginaActual - 1) * POR_PAGINA + 1 : 0;
  const hasta = Math.min(paginaActual * POR_PAGINA, total);
  const hayFiltros = qDemorado !== '' || filtro !== 'todas' || periodo !== 'todas';

  return (
    <>
      {/* Encabezado */}
      <div className="aparece flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-bold">Facturas</h1>
          <p className="text-texto-suave">Todas tus facturas emitidas, en un solo lugar.</p>
        </div>
        <Link href="/app/facturas/nueva" className="btn-lift flex h-12 items-center gap-2 rounded-full bg-primario px-6 font-extrabold text-white shadow-boton">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Emitir factura
        </Link>
      </div>

      {/* Filtros separados */}
      <div style={{ animationDelay: '80ms' }} className="aparece flex flex-wrap items-end gap-4">
        <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
          <span className="text-sm font-bold">Buscar</span>
          <div className="flex h-12 items-center gap-2 rounded-input border-[1.5px] border-borde bg-white px-4 transition-colors focus-within:border-primario">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none text-texto-tenue"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cliente o número…"
              className="h-full w-full bg-transparent text-base text-texto outline-none placeholder:text-texto-tenue"
            />
          </div>
        </div>
        <div className="flex w-[185px] flex-col gap-1.5">
          <span className="text-sm font-bold">Período</span>
          <Select ariaLabel="Período" value={periodo} onChange={setPeriodo} options={PERIODOS} />
        </div>
        <div className="flex w-[160px] flex-col gap-1.5">
          <span className="text-sm font-bold">Estado</span>
          <Select ariaLabel="Estado" value={filtro} onChange={(v) => setFiltro(v as Filtro)} options={FILTROS_SEL} />
        </div>
        <div className="flex w-[185px] flex-col gap-1.5">
          <span className="text-sm font-bold">Ordenar por</span>
          <Select ariaLabel="Ordenar por" value={orden} onChange={setOrden} options={ORDENES} />
        </div>
      </div>

      {/* Tabla / vacío */}
      <section style={{ animationDelay: '160ms' }} aria-busy={lista.estado === 'cargando'} className="aparece rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
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
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-texto-tenue">Mostrando {desde}–{hasta} de {total}</span>
              {totalPaginas > 1 && (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={paginaActual === 1} aria-label="Página anterior" className="flex h-9 w-9 items-center justify-center rounded-[10px] border-[1.5px] border-borde text-texto-suave transition-colors hover:border-primario hover:text-primario disabled:opacity-40">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
                  </button>
                  {Array.from({ length: totalPaginas }).map((_, i) => {
                    const npag = i + 1;
                    const on = npag === paginaActual;
                    return (
                      <button key={npag} type="button" onClick={() => setPagina(npag)} aria-current={on ? 'page' : undefined} className={`h-9 min-w-9 rounded-[10px] px-2.5 text-sm font-extrabold transition-colors ${on ? 'bg-primario text-white' : 'text-texto-suave hover:bg-fondo'}`}>{npag}</button>
                    );
                  })}
                  <button type="button" onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={paginaActual === totalPaginas} aria-label="Página siguiente" className="flex h-9 w-9 items-center justify-center rounded-[10px] border-[1.5px] border-borde text-texto-suave transition-colors hover:border-primario hover:text-primario disabled:opacity-40">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Facti pose="durmiendo" size={150} animated />
            <h2 className="text-[20px] font-bold">{hayFiltros ? 'No encontramos facturas' : 'Todavía no emitiste facturas'}</h2>
            <p className="max-w-[360px] text-texto-suave">
              {hayFiltros ? 'Probá con otra búsqueda o cambiá el período o el estado.' : 'Cuando emitas la primera, va a aparecer acá.'}
            </p>
            {!hayFiltros && (
              <Link href="/app/facturas/nueva" className="btn-lift rounded-full bg-primario px-6 py-3 font-extrabold text-white shadow-boton">Emitir factura</Link>
            )}
          </div>
        )}
      </section>
    </>
  );
}
