'use client';

import { useMemo, useState } from 'react';
import { FACTURAS_DEMO, montoDe } from '@/lib/facturas-demo';

type Cobro = 'Cobrada' | 'Pendiente' | '—';
type Filtro = 'pendientes' | 'cobradas' | 'todas';

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'cobradas', label: 'Cobradas' },
  { id: 'todas', label: 'Todas' },
];

const pesos = (n: number) => '$' + n.toLocaleString('es-AR');
const colorTipo = (t: string) => (t === 'E' ? 'bg-acento text-texto' : t === 'NC' ? 'bg-exito-suave text-exito-texto' : 'bg-primario-suave text-primario-oscuro');
const th = 'border-b-2 border-[#EDF0F6] px-4 pb-3 font-extrabold';
const td = 'px-4 py-4 align-middle';

export default function Cobros() {
  const [estados, setEstados] = useState<Record<string, Cobro>>(() =>
    Object.fromEntries(FACTURAS_DEMO.map((f) => [f.num, f.cobro as Cobro])),
  );
  const [filtro, setFiltro] = useState<Filtro>('pendientes');

  const filas = FACTURAS_DEMO.map((f) => ({ ...f, cobro: estados[f.num] ?? (f.cobro as Cobro) }));

  const porCobrar = filas.filter((f) => f.cobro === 'Pendiente' && !f.total.includes('USD')).reduce((a, f) => a + montoDe(f.total), 0);
  const cobrado = filas.filter((f) => f.cobro === 'Cobrada' && !f.total.includes('USD')).reduce((a, f) => a + montoDe(f.total), 0);

  const visibles = useMemo(() => {
    return filas.filter((f) => {
      if (filtro === 'pendientes') return f.cobro === 'Pendiente';
      if (filtro === 'cobradas') return f.cobro === 'Cobrada';
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, estados]);

  const marcarCobrada = (num: string) => setEstados((e) => ({ ...e, [num]: 'Cobrada' }));

  return (
    <>
      <div className="aparece">
        <h1 className="text-[34px] font-bold">Cobros</h1>
        <p className="text-texto-suave">Marcá tus facturas como cobradas y seguí lo que te deben.</p>
      </div>

      {/* Stats */}
      <div style={{ animationDelay: '80ms' }} className="aparece grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        <div className="card-hover flex flex-col gap-1 rounded-tarjeta bg-superficie px-6 py-5 shadow-tarjeta">
          <span className="text-[13px] font-extrabold tracking-[0.06em] text-texto-tenue">POR COBRAR</span>
          <span className="font-display text-[30px] font-bold">{pesos(porCobrar)}</span>
          <span className="text-sm text-texto-suave">{filas.filter((f) => f.cobro === 'Pendiente').length} facturas pendientes</span>
        </div>
        <div className="card-hover flex flex-col gap-1 rounded-tarjeta bg-superficie px-6 py-5 shadow-tarjeta">
          <span className="text-[13px] font-extrabold tracking-[0.06em] text-texto-tenue">COBRADO</span>
          <span className="font-display text-[30px] font-bold">{pesos(cobrado)}</span>
          <span className="text-sm text-texto-suave">{filas.filter((f) => f.cobro === 'Cobrada').length} facturas cobradas</span>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ animationDelay: '160ms' }} className="aparece inline-flex gap-1 self-start rounded-input bg-fondo p-1">
        {FILTROS.map((f) => {
          const on = filtro === f.id;
          return (
            <button key={f.id} type="button" onClick={() => setFiltro(f.id)}
              className={`rounded-xl px-4 py-2.5 text-[15px] transition-colors ${on ? 'bg-white font-extrabold text-texto shadow-[0_2px_8px_rgba(21,25,58,0.08)]' : 'font-bold text-texto-suave hover:text-texto'}`}>
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Tabla */}
      <section style={{ animationDelay: '240ms' }} className="aparece rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        {visibles.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[15px]">
              <thead>
                <tr className="text-xs tracking-[0.06em] text-texto-tenue">
                  <th className={`${th} text-center`}>TIPO</th>
                  <th className={`${th} text-left`}>NÚMERO</th>
                  <th className={`${th} text-left`}>CLIENTE</th>
                  <th className={`${th} text-left`}>FECHA</th>
                  <th className={`${th} text-right`}>TOTAL</th>
                  <th className={`${th} text-right`}>ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => (
                  <tr key={f.num} className="border-b border-[#F0F2F7] transition-colors last:border-0 hover:bg-fondo">
                    <td className={`${td} text-center`}><span className={`inline-flex h-8 min-w-[34px] items-center justify-center rounded-[10px] px-2 text-[13px] font-extrabold ${colorTipo(f.tipo)}`}>{f.tipo}</span></td>
                    <td className={`${td} whitespace-nowrap tabular-nums text-texto-suave`}>{f.num}</td>
                    <td className={`${td} font-bold`}>{f.cliente}</td>
                    <td className={`${td} whitespace-nowrap tabular-nums text-texto-suave`}>{f.fecha}</td>
                    <td className={`${td} text-right font-extrabold tabular-nums ${f.total.startsWith('-') ? 'text-[#B4232B]' : ''}`}>{f.total}</td>
                    <td className={`${td} text-right`}>
                      {f.cobro === 'Pendiente' ? (
                        <button type="button" onClick={() => marcarCobrada(f.num)} className="btn-lift inline-flex h-9 items-center gap-1.5 rounded-full bg-exito px-3.5 text-sm font-extrabold text-white">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                          Marcar cobrada
                        </button>
                      ) : f.cobro === 'Cobrada' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF8F0] px-2.5 py-1 text-[12.5px] font-bold text-[#0E5C38] ring-1 ring-inset ring-[#C8EDD8]"><span className="h-[7px] w-[7px] rounded-full bg-[#1E9E63]" />Cobrada</span>
                      ) : (
                        <span className="text-texto-tenue">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-10 text-center text-texto-suave">No hay facturas {filtro === 'pendientes' ? 'pendientes' : filtro === 'cobradas' ? 'cobradas' : ''} para mostrar.</p>
        )}
      </section>
    </>
  );
}
