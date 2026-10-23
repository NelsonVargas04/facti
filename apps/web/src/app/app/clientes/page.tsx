'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AvisoApi } from '@/components/AvisoApi';
import { Facti } from '@/components/Facti';
import { TablaSkeleton } from '@/components/TablaFacturas';
import { condicionTexto, listarClientes } from '@/lib/api';
import { fecha, formatearCuit, pesos } from '@/lib/formato';
import { useApi, useDemorado } from '@/lib/useApi';

const th = 'border-b-2 border-[#EDF0F6] px-4 pb-3 font-extrabold';
const td = 'px-4 py-4 align-middle';

const DOC: Record<number, string> = { 80: 'CUIT', 86: 'CUIL', 96: 'DNI' };

export default function Clientes() {
  const [q, setQ] = useState('');
  const qDemorado = useDemorado(q.trim());
  const lista = useApi(() => listarClientes(qDemorado), [qDemorado]);
  const clientes = lista.dato?.clientes ?? [];
  const totalComprobantes = clientes.reduce((a, c) => a + c.comprobantes, 0);

  return (
    <>
      <div className="aparece flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-bold">Clientes</h1>
          <p className="text-texto-suave">Tus clientes y cuánto les facturaste. Se guardan solos cuando les hacés una factura.</p>
        </div>
        <Link href="/app/facturas/nueva" className="btn-lift flex h-12 items-center gap-2 rounded-full bg-primario px-6 font-extrabold text-white shadow-boton">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10" cy="8" r="4" /><path d="M3 20c0-3.9 3.1-7 7-7M18 14v6M15 17h6" /></svg>
          Facturar a un cliente nuevo
        </Link>
      </div>

      {/* Stats */}
      {lista.dato && !qDemorado && (
        <div style={{ animationDelay: '80ms' }} className="aparece grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          <div className="card-hover flex flex-col gap-1 rounded-tarjeta bg-superficie px-6 py-5 shadow-tarjeta">
            <span className="text-[13px] font-extrabold tracking-[0.06em] text-texto-tenue">CLIENTES</span>
            <span className="font-display text-[30px] font-bold">{clientes.length}</span>
          </div>
          <div className="card-hover flex flex-col gap-1 rounded-tarjeta bg-superficie px-6 py-5 shadow-tarjeta">
            <span className="text-[13px] font-extrabold tracking-[0.06em] text-texto-tenue">COMPROBANTES EMITIDOS</span>
            <span className="font-display text-[30px] font-bold">{totalComprobantes}</span>
          </div>
        </div>
      )}

      {/* Buscador */}
      <div style={{ animationDelay: '160ms' }} className="aparece flex min-w-[240px] max-w-[440px] items-center gap-2 rounded-input border-[1.5px] border-borde bg-white px-4 transition-colors focus-within:border-primario">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none text-texto-tenue"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar clientes" placeholder="Buscar por nombre o CUIT…" className="h-12 w-full bg-transparent text-base text-texto outline-none placeholder:text-texto-tenue" />
      </div>

      {/* Tabla */}
      <section style={{ animationDelay: '240ms' }} aria-busy={lista.estado === 'cargando'} className="aparece rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        {lista.estado === 'error' && !lista.dato ? (
          <AvisoApi error={lista.error} onReintentar={lista.recargar} />
        ) : !lista.dato ? (
          <TablaSkeleton filas={4} />
        ) : clientes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-[15px]">
              <thead>
                <tr className="text-xs tracking-[0.06em] text-texto-tenue">
                  <th className={`${th} text-left`}>CLIENTE</th>
                  <th className={`${th} text-left`}>CUIT / DNI</th>
                  <th className={`${th} text-left`}>CONDICIÓN IVA</th>
                  <th className={`${th} text-center`}>COMPROBANTES</th>
                  <th className={`${th} text-right`}>FACTURADO</th>
                  <th className={`${th} text-right`}>POR COBRAR</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.id} className="border-b border-[#F0F2F7] transition-colors last:border-0 hover:bg-fondo">
                    <td className={`${td}`}>
                      <span className="block font-bold">{c.nombre || formatearCuit(c.docNro)}</span>
                      {c.ultimo && <span className="text-[13px] text-texto-tenue">Última factura: {fecha(c.ultimo)}</span>}
                    </td>
                    <td className={`${td} whitespace-nowrap tabular-nums text-texto-suave`}>
                      {DOC[c.docTipo] ?? 'Doc.'} {c.docTipo === 96 ? c.docNro : formatearCuit(c.docNro)}
                    </td>
                    <td className={`${td} text-texto-suave`}>{condicionTexto(c)}</td>
                    <td className={`${td} text-center font-bold tabular-nums`}>{c.comprobantes}</td>
                    <td className={`${td} text-right font-extrabold tabular-nums`}>{pesos(c.facturado)}</td>
                    <td className={`${td} text-right tabular-nums ${c.porCobrar > 0 ? 'font-extrabold text-aviso-texto' : 'text-texto-tenue'}`}>
                      {c.porCobrar > 0 ? pesos(c.porCobrar) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : qDemorado ? (
          <p className="py-10 text-center text-texto-suave">No encontramos clientes con esa búsqueda.</p>
        ) : (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Facti pose="buscando" size={130} animated={false} />
            <h2 className="text-[20px] font-bold">Todavía no tenés clientes</h2>
            <p className="max-w-[380px] text-texto-suave">Cuando le hagas una factura a alguien con CUIT o DNI, lo guardamos acá con todo lo que le facturaste.</p>
          </div>
        )}
      </section>
    </>
  );
}
