'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Facti } from '@/components/Facti';
import { Select } from '@/components/Select';
import { TablaFacturas } from '@/components/TablaFacturas';
import { FACTURAS_DEMO, montoDe } from '@/lib/facturas-demo';

type Filtro = 'todas' | 'cobradas' | 'pendientes';
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

// Demo: las fechas vienen como dd/mm; asumimos el año y tomamos como referencia la factura más reciente.
const ANIO_DEMO = 2026;
const fechaDe = (f: { fecha: string }) => {
  const [d, m] = f.fecha.split('/').map(Number);
  return new Date(ANIO_DEMO, (m ?? 1) - 1, d ?? 1);
};
const REF = FACTURAS_DEMO.reduce((max, f) => (fechaDe(f) > max ? fechaDe(f) : max), new Date(0));
function enPeriodo(f: { fecha: string }, periodo: string): boolean {
  if (periodo === 'todas') return true;
  const d = fechaDe(f);
  if (periodo === 'mes') return d.getMonth() === REF.getMonth() && d.getFullYear() === REF.getFullYear();
  if (periodo === 'mespasado') {
    const r = new Date(REF.getFullYear(), REF.getMonth() - 1, 1);
    return d.getMonth() === r.getMonth() && d.getFullYear() === r.getFullYear();
  }
  if (periodo === 'trim') {
    const lim = new Date(REF.getFullYear(), REF.getMonth() - 2, 1);
    return d >= lim && d <= REF;
  }
  if (periodo === 'anio') return d.getFullYear() === REF.getFullYear();
  return true;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function Facturas() {
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [periodo, setPeriodo] = useState('mes');
  const [orden, setOrden] = useState('reciente');
  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 6;

  const filtradas = useMemo(() => {
    const n = norm(q.trim());
    return FACTURAS_DEMO.filter((f) => {
      if (!enPeriodo(f, periodo)) return false;
      if (filtro === 'cobradas' && f.cobro !== 'Cobrada') return false;
      if (filtro === 'pendientes' && f.cobro !== 'Pendiente') return false;
      if (!n) return true;
      return norm(f.cliente).includes(n) || f.num.includes(n);
    });
  }, [q, filtro, periodo]);

  const ordenadas = useMemo(() => {
    const arr = [...filtradas];
    const fechaKey = (f: (typeof arr)[number]) => {
      const [d, m] = f.fecha.split('/').map(Number);
      return (m ?? 0) * 100 + (d ?? 0);
    };
    const montoKey = (f: (typeof arr)[number]) => montoDe(f.total) * (f.total.startsWith('-') ? -1 : 1);
    switch (orden) {
      case 'antigua': arr.sort((a, b) => fechaKey(a) - fechaKey(b)); break;
      case 'cliente': arr.sort((a, b) => a.cliente.localeCompare(b.cliente, 'es')); break;
      case 'numero': arr.sort((a, b) => a.num.localeCompare(b.num)); break;
      case 'mayor': arr.sort((a, b) => montoKey(b) - montoKey(a)); break;
      case 'menor': arr.sort((a, b) => montoKey(a) - montoKey(b)); break;
      default: arr.sort((a, b) => fechaKey(b) - fechaKey(a)); // más reciente
    }
    return arr;
  }, [filtradas, orden]);

  useEffect(() => setPagina(1), [q, filtro, orden, periodo]);

  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = ordenadas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);
  const desde = filtradas.length ? (paginaActual - 1) * POR_PAGINA + 1 : 0;
  const hasta = Math.min(paginaActual * POR_PAGINA, filtradas.length);

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
      <section style={{ animationDelay: '160ms' }} className="aparece rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        {filtradas.length > 0 ? (
          <>
            <TablaFacturas rows={visibles} />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-texto-tenue">Mostrando {desde}–{hasta} de {filtradas.length}</span>
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
            <h2 className="text-[20px] font-bold">No encontramos facturas</h2>
            <p className="max-w-[360px] text-texto-suave">Probá con otra búsqueda o cambiá el filtro. Cuando emitas una, va a aparecer acá.</p>
          </div>
        )}
      </section>
    </>
  );
}
