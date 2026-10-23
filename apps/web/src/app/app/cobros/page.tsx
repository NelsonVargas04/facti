'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AvisoApi } from '@/components/AvisoApi';
import { ChipCobro, colorTipo, TablaSkeleton } from '@/components/TablaFacturas';
import { listarComprobantes, marcarCobro, verResumen, type Cobro, type ErrorApi } from '@/lib/api';
import { nombreCliente } from '@/lib/comprobante';
import { fechaCorta, importe, numeroComprobante, pesos } from '@/lib/formato';
import { useApi } from '@/lib/useApi';

type Filtro = 'pendientes' | 'cobradas' | 'todas';

const FILTROS: { id: Filtro; label: string; cobro: Cobro }[] = [
  { id: 'pendientes', label: 'Pendientes', cobro: 'pendiente' },
  { id: 'cobradas', label: 'Cobradas', cobro: 'cobrada' },
  { id: 'todas', label: 'Todas', cobro: '' },
];

const th = 'border-b-2 border-[#EDF0F6] px-4 pb-3 font-extrabold';
const td = 'px-4 py-4 align-middle';

export default function Cobros() {
  const [filtro, setFiltro] = useState<Filtro>('pendientes');
  const cobro = FILTROS.find((f) => f.id === filtro)!.cobro;
  const lista = useApi(() => listarComprobantes({ cobro, limite: 200 }), [cobro]);
  // Los totales de por cobrar salen de todo el historial; el cobrado, del mes en curso.
  const resumen = useApi(() => verResumen(), []);
  const [marcando, setMarcando] = useState<number | null>(null);
  const [errMarcar, setErrMarcar] = useState<ErrorApi | null>(null);

  const filas = useMemo(() => (lista.dato?.comprobantes ?? []).filter((f) => f.cobro !== ''), [lista.dato]);

  async function marcar(id: number, estado: 'cobrada' | 'pendiente') {
    setMarcando(id);
    setErrMarcar(null);
    const r = await marcarCobro(id, estado);
    setMarcando(null);
    if (!r.ok) {
      setErrMarcar(r);
      return;
    }
    void lista.recargar();
    void resumen.recargar();
  }

  const r = resumen.dato;

  return (
    <>
      <div className="aparece">
        <h1 className="text-[34px] font-bold">Cobros</h1>
        <p className="text-texto-suave">Marcá tus facturas como cobradas y seguí lo que te deben.</p>
      </div>

      {/* Stats */}
      <div style={{ animationDelay: '80ms' }} className="aparece grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {r ? (
          <>
            <div className="card-hover flex flex-col gap-1 rounded-tarjeta bg-superficie px-6 py-5 shadow-tarjeta">
              <span className="text-[13px] font-extrabold tracking-[0.06em] text-texto-tenue">POR COBRAR</span>
              <span className="font-display text-[30px] font-bold tabular-nums">{pesos(r.porCobrar.total)}</span>
              <span className="text-sm text-texto-suave">{r.porCobrar.facturas} {r.porCobrar.facturas === 1 ? 'factura pendiente' : 'facturas pendientes'}</span>
            </div>
            <div className="card-hover flex flex-col gap-1 rounded-tarjeta bg-superficie px-6 py-5 shadow-tarjeta">
              <span className="text-[13px] font-extrabold tracking-[0.06em] text-texto-tenue">COBRADO ESTE MES</span>
              <span className="font-display text-[30px] font-bold tabular-nums">{pesos(r.delMes.cobrado)}</span>
              <span className="text-sm text-texto-suave">{r.delMes.cobradas} {r.delMes.cobradas === 1 ? 'factura cobrada' : 'facturas cobradas'}</span>
            </div>
          </>
        ) : resumen.estado === 'cargando' ? (
          [0, 1].map((i) => <div key={i} className="skeleton h-[110px] rounded-tarjeta" />)
        ) : null}
      </div>

      {/* Filtros */}
      <div style={{ animationDelay: '160ms' }} role="group" aria-label="Filtrar por estado de cobro" className="aparece inline-flex gap-1 self-start rounded-input bg-fondo p-1">
        {FILTROS.map((f) => {
          const on = filtro === f.id;
          return (
            <button key={f.id} type="button" aria-pressed={on} onClick={() => setFiltro(f.id)}
              className={`rounded-xl px-4 py-2.5 text-[15px] transition-colors ${on ? 'bg-white font-extrabold text-texto shadow-[0_2px_8px_rgba(21,25,58,0.08)]' : 'font-bold text-texto-suave hover:text-texto'}`}>
              {f.label}
            </button>
          );
        })}
      </div>

      {errMarcar && <AvisoApi error={errMarcar} compacto />}

      {/* Tabla */}
      <section style={{ animationDelay: '240ms' }} aria-busy={lista.estado === 'cargando'} className="aparece rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        {lista.estado === 'error' && !lista.dato ? (
          <AvisoApi error={lista.error} onReintentar={lista.recargar} />
        ) : !lista.dato ? (
          <TablaSkeleton filas={4} />
        ) : filas.length > 0 ? (
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
                {filas.map((f) => (
                  <tr key={f.id} className="border-b border-[#F0F2F7] transition-colors last:border-0 hover:bg-fondo">
                    <td className={`${td} text-center`}><span className={`inline-flex h-8 min-w-[34px] items-center justify-center rounded-[10px] px-2 text-[13px] font-extrabold ${colorTipo(f.sigla)}`}>{f.sigla}</span></td>
                    <td className={`${td} whitespace-nowrap tabular-nums text-texto-suave`}>
                      <Link href={`/app/facturas/${f.id}`} className="hover:text-primario-oscuro hover:underline">{numeroComprobante(f.puntoVenta, f.numero)}</Link>
                    </td>
                    <td className={`${td} font-bold`}>{nombreCliente(f)}</td>
                    <td className={`${td} whitespace-nowrap tabular-nums text-texto-suave`}>{fechaCorta(f.fecha)}</td>
                    <td className={`${td} text-right font-extrabold tabular-nums`}>{importe(f.total, f.moneda)}</td>
                    <td className={`${td} text-right`}>
                      {f.cobro === 'pendiente' ? (
                        <button type="button" disabled={marcando === f.id} onClick={() => marcar(f.id, 'cobrada')} className="btn-lift inline-flex h-9 items-center gap-1.5 rounded-full bg-exito px-3.5 text-sm font-extrabold text-white disabled:opacity-60">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                          {marcando === f.id ? 'Guardando…' : 'Marcar cobrada'}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <ChipCobro estado={f.cobro} />
                          <button type="button" disabled={marcando === f.id} onClick={() => marcar(f.id, 'pendiente')} className="text-sm font-bold text-texto-tenue underline-offset-2 hover:text-texto hover:underline disabled:opacity-60">
                            Deshacer
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-10 text-center text-texto-suave">
            {filtro === 'pendientes' ? '¡No tenés facturas pendientes de cobro!' : filtro === 'cobradas' ? 'Todavía no marcaste facturas como cobradas.' : 'Todavía no emitiste facturas.'}
          </p>
        )}
      </section>
    </>
  );
}
