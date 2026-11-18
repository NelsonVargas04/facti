'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AvisoApi } from '@/components/AvisoApi';
import { Facti } from '@/components/Facti';
import { Icon } from '@/components/Icon';
import { Paginacion } from '@/components/Paginacion';
import { Select } from '@/components/Select';
import { Buscador, TarjetaLista } from '@/components/TarjetaLista';
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
        <div className="flex flex-wrap items-center gap-3">
        <Link href="/app/facturas/recurrentes" className="btn-lift flex h-12 items-center gap-2 rounded-full border-[1.5px] border-borde bg-white px-5 font-bold text-texto hover:border-primario hover:text-primario-oscuro">
          <Icon name="calendario" size={20} />
          De todos los meses
        </Link>
        <Link href="/app/facturas/nueva" className="btn-lift hidden h-12 items-center gap-2 rounded-full bg-primario px-6 font-bold text-white shadow-boton md:flex">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Emitir factura
        </Link>
        </div>
      </div>

      {/* Listado: buscador y filtros, la lista y el pie con la cantidad y las páginas. */}
      <TarjetaLista
        ocupado={lista.estado === 'cargando'}
        barra={
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-[minmax(240px,1fr)_185px_170px_185px]">
            <Buscador valor={q} onCambio={setQ} placeholder="Buscar cliente, CUIT o #número…" className="col-span-2 sm:col-span-3 xl:col-span-1" />
            <div className="min-w-0"><Select ariaLabel="Período" value={periodo} onChange={setPeriodo} options={PERIODOS} /></div>
            <div className="min-w-0"><Select ariaLabel="Estado" value={filtro} onChange={(v) => setFiltro(v as Filtro)} options={FILTROS_SEL} /></div>
            <div className="col-span-2 min-w-0 sm:col-span-1"><Select ariaLabel="Ordenar por" value={orden} onChange={setOrden} options={ORDENES} /></div>
          </div>
        }
        pie={
          lista.dato && total > 0 ? (
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
          ) : undefined
        }
      >
        {lista.estado === 'error' && !lista.dato ? (
          <AvisoApi error={lista.error} onReintentar={lista.recargar} />
        ) : !lista.dato ? (
          <TablaSkeleton filas={6} />
        ) : total > 0 ? (
          <>
            {lista.estado === 'error' && <div className="mb-3"><AvisoApi error={lista.error} onReintentar={lista.recargar} compacto /></div>}
            <div className={lista.estado === 'cargando' ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
              <TablaFacturas key={visibles.map((v) => v.id).join(',')} rows={visibles} />
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
              <Link href="/app/facturas/nueva" className="inline-flex h-12 items-center justify-center rounded-full bg-primario px-6 font-bold text-white shadow-boton btn-lift">Emitir factura</Link>
            )}
          </div>
        )}
      </TarjetaLista>
    </>
  );
}
