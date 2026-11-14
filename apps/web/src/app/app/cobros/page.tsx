'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { Girando, Numero } from '@/components/Animado';
import { AvisoApi } from '@/components/AvisoApi';
import { Confirmar } from '@/components/Confirmar';
import { ChipCobro, colorTipo, TablaSkeleton } from '@/components/TablaFacturas';
import { listarComprobantes, marcarCobro, verResumen, type Cobro, type Comprobante, type ErrorApi } from '@/lib/api';
import { nombreCliente } from '@/lib/comprobante';
import { fechaCorta, importe, numeroComprobante, pesos } from '@/lib/formato';
import { useApi } from '@/lib/useApi';

type Filtro = 'pendientes' | 'cobradas' | 'todas';

const FILTROS: { id: Filtro; label: string; cobro: Cobro }[] = [
  { id: 'pendientes', label: 'Pendientes', cobro: 'pendiente' },
  { id: 'cobradas', label: 'Cobradas', cobro: 'cobrada' },
  { id: 'todas', label: 'Todas', cobro: '' },
];

const th = 'whitespace-nowrap border-b border-[#EDF0F6] px-4 pb-3 font-semibold';
const td = 'px-4 py-4 align-middle';

export default function Cobros() {
  const [filtro, setFiltro] = useState<Filtro>('pendientes');
  const cobro = FILTROS.find((f) => f.id === filtro)!.cobro;
  const lista = useApi(() => listarComprobantes({ cobro, limite: 200 }), [cobro]);
  // Los totales de por cobrar salen de todo el historial; el cobrado, del mes en curso.
  const resumen = useApi(() => verResumen(), []);
  const [marcando, setMarcando] = useState<number | null>(null);
  const [errMarcar, setErrMarcar] = useState<ErrorApi | null>(null);
  // Factura que se está por marcar como cobrada: abre el modal de confirmación.
  const [aConfirmar, setAConfirmar] = useState<Comprobante | null>(null);

  const filas = useMemo(() => (lista.dato?.comprobantes ?? []).filter((f) => f.cobro !== ''), [lista.dato]);

  async function marcar(id: number, estado: 'cobrada' | 'pendiente') {
    setMarcando(id);
    setErrMarcar(null);
    const r = await marcarCobro(id, estado);
    setMarcando(null);
    setAConfirmar(null);
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
      <div style={{ animationDelay: '20ms' }} className="aparece grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {r ? (
          <>
            <div className="entra flex flex-col gap-1 rounded-tarjeta bg-superficie px-6 py-5 shadow-tarjeta">
              <span className="text-base font-semibold text-texto-tenue">Por cobrar</span>
              <span className="font-display text-[30px] font-semibold tabular-nums"><Numero valor={r.porCobrar.total} formato={pesos} /></span>
              <span className="text-base text-texto-suave">{r.porCobrar.facturas} {r.porCobrar.facturas === 1 ? 'factura pendiente' : 'facturas pendientes'}</span>
            </div>
            <div style={{ '--i': 1 } as React.CSSProperties} className="entra flex flex-col gap-1 rounded-tarjeta bg-superficie px-6 py-5 shadow-tarjeta">
              <span className="text-base font-semibold text-texto-tenue">Cobrado este mes</span>
              <span className="font-display text-[30px] font-semibold tabular-nums"><Numero valor={r.delMes.cobrado} formato={pesos} /></span>
              <span className="text-base text-texto-suave">{r.delMes.cobradas} {r.delMes.cobradas === 1 ? 'factura cobrada' : 'facturas cobradas'}</span>
            </div>
          </>
        ) : resumen.estado === 'cargando' ? (
          [0, 1].map((i) => <div key={i} className="skeleton h-[110px] rounded-tarjeta" />)
        ) : null}
      </div>

      {/* Filtros */}
      <div style={{ animationDelay: '40ms' }} role="group" aria-label="Filtrar por estado de cobro" className="aparece inline-flex gap-1 self-start rounded-input bg-fondo p-1">
        {FILTROS.map((f) => {
          const on = filtro === f.id;
          return (
            <button key={f.id} type="button" aria-pressed={on} onClick={() => setFiltro(f.id)}
              className={`rounded-xl px-4 py-2.5 text-base transition-colors ${on ? 'bg-white font-bold text-texto shadow-[0_2px_8px_rgba(21,25,58,0.08)]' : 'font-semibold text-texto-suave hover:text-texto'}`}>
              {f.label}
            </button>
          );
        })}
      </div>

      {errMarcar && <AvisoApi error={errMarcar} compacto />}

      {/* Tabla */}
      <section style={{ animationDelay: '60ms' }} aria-busy={lista.estado === 'cargando'} className="aparece rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        {lista.estado === 'error' && !lista.dato ? (
          <AvisoApi error={lista.error} onReintentar={lista.recargar} />
        ) : !lista.dato ? (
          <TablaSkeleton filas={4} />
        ) : filas.length > 0 ? (
          <div key={filtro} className="entra overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-base">
              <thead>
                <tr className="text-base text-texto-tenue">
                  <th className={`${th} text-center`}>Tipo</th>
                  <th className={`${th} text-left`}>Número</th>
                  <th className={`${th} text-left`}>Cliente</th>
                  <th className={`${th} text-left`}>Fecha</th>
                  <th className={`${th} text-right`}>Total</th>
                  <th className={`${th} text-right`}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {/* Al marcar una factura como cobrada en "Pendientes", la fila se va hacia la derecha y las demás suben solas. */}
                <AnimatePresence initial={false}>
                {filas.map((f) => (
                  <motion.tr
                    key={f.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 24 }}
                    transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                    className="border-b border-[#F0F2F7] transition-colors last:border-0 hover:bg-fondo"
                  >
                    <td className={`${td} text-center`}><span className={`inline-flex h-8 min-w-[34px] items-center justify-center rounded-[10px] px-2 text-base font-bold ${colorTipo(f.sigla)}`}>{f.sigla}</span></td>
                    <td className={`${td} whitespace-nowrap tabular-nums text-texto-suave`}>
                      <Link href={`/app/facturas/${f.id}`} className="hover:text-primario-oscuro hover:underline">{numeroComprobante(f.puntoVenta, f.numero)}</Link>
                    </td>
                    <td className={`${td} whitespace-nowrap font-semibold`}>{nombreCliente(f)}</td>
                    <td className={`${td} whitespace-nowrap tabular-nums text-texto-suave`}>{fechaCorta(f.fecha)}</td>
                    <td className={`${td} text-right font-semibold tabular-nums`}>{importe(f.total, f.moneda)}</td>
                    <td className={`${td} text-right`}>
                      {f.cobro === 'pendiente' ? (
                        <button type="button" disabled={marcando === f.id} onClick={() => setAConfirmar(f)} className="btn-lift inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-exito px-3.5 text-base font-bold text-white disabled:opacity-60">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                          {marcando === f.id ? (<><Girando size={14} />Guardando…</>) : 'Marcar cobrada'}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <ChipCobro estado={f.cobro} />
                          <button type="button" disabled={marcando === f.id} onClick={() => marcar(f.id, 'pendiente')} className="text-base font-semibold text-texto-tenue underline-offset-2 hover:text-texto hover:underline disabled:opacity-60">
                            Deshacer
                          </button>
                        </span>
                      )}
                    </td>
                  </motion.tr>
                ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-10 text-center text-texto-suave">
            {filtro === 'pendientes' ? '¡No tenés facturas pendientes de cobro!' : filtro === 'cobradas' ? 'Todavía no marcaste facturas como cobradas.' : 'Todavía no emitiste facturas.'}
          </p>
        )}
      </section>

      <Confirmar
        abierto={aConfirmar !== null}
        tono="exito"
        icono="cobros"
        titulo="¿Marcar esta factura como cobrada?"
        textoConfirmar="Sí, ya la cobré"
        cargando={aConfirmar !== null && marcando === aConfirmar.id}
        onConfirmar={() => aConfirmar && void marcar(aConfirmar.id, 'cobrada')}
        onCancelar={() => setAConfirmar(null)}
      >
        {aConfirmar && (
          <div className="flex flex-col gap-3">
            <dl className="flex flex-col gap-2 rounded-[18px] bg-fondo px-4 py-3.5 text-base">
              <div className="flex justify-between gap-4"><dt className="text-texto-suave">Cliente</dt><dd className="truncate font-semibold">{nombreCliente(aConfirmar)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-texto-suave">Factura</dt><dd className="tabular-nums">{aConfirmar.sigla} {numeroComprobante(aConfirmar.puntoVenta, aConfirmar.numero)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-texto-suave">Total</dt><dd className="font-bold tabular-nums">{importe(aConfirmar.total, aConfirmar.moneda)}</dd></div>
            </dl>
            <p className="text-base text-texto-suave">Pasa a &quot;Cobradas&quot; y deja de sumar en lo que te deben. Si te equivocás, la podés volver a pendiente.</p>
          </div>
        )}
      </Confirmar>
    </>
  );
}
