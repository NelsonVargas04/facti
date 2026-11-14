'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Numero } from '@/components/Animado';
import { AvisoApi } from '@/components/AvisoApi';
import { Facti } from '@/components/Facti';
import { TablaSkeleton } from '@/components/TablaFacturas';
import { condicionTexto, listarClientes } from '@/lib/api';
import { fecha, formatearCuit, nombrePropio, pesos } from '@/lib/formato';
import { useApi, useDemorado } from '@/lib/useApi';

const th = 'whitespace-nowrap border-b border-[#EDF0F6] px-4 pb-3 font-semibold';
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
        <Link href="/app/facturas/nueva" className="btn-lift flex h-12 items-center gap-2 rounded-full bg-primario px-6 font-bold text-white shadow-boton">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10" cy="8" r="4" /><path d="M3 20c0-3.9 3.1-7 7-7M18 14v6M15 17h6" /></svg>
          Facturar a un cliente nuevo
        </Link>
      </div>

      {/* Stats */}
      {lista.dato && !qDemorado && (
        <div className="cascada grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          <div className="flex flex-col gap-1 rounded-tarjeta bg-superficie px-6 py-5 shadow-tarjeta">
            <span className="text-base font-semibold text-texto-tenue">Clientes</span>
            <span className="font-display text-[30px] font-semibold tabular-nums"><Numero valor={clientes.length} formato={String} /></span>
          </div>
          <div className="flex flex-col gap-1 rounded-tarjeta bg-superficie px-6 py-5 shadow-tarjeta">
            <span className="text-base font-semibold text-texto-tenue">Comprobantes emitidos</span>
            <span className="font-display text-[30px] font-semibold tabular-nums"><Numero valor={totalComprobantes} formato={String} /></span>
          </div>
        </div>
      )}

      {/* Buscador */}
      <div style={{ animationDelay: '40ms' }} className="aparece flex min-w-[240px] max-w-[440px] items-center gap-2 rounded-input border-[1.5px] border-borde bg-white px-4 transition-colors focus-within:border-primario">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none text-texto-tenue"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar clientes" placeholder="Buscar por nombre o CUIT…" className="h-12 w-full bg-transparent text-base text-texto outline-none placeholder:text-texto-tenue" />
      </div>

      {/* Tabla */}
      <section style={{ animationDelay: '60ms' }} aria-busy={lista.estado === 'cargando'} className="aparece rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        {lista.estado === 'error' && !lista.dato ? (
          <AvisoApi error={lista.error} onReintentar={lista.recargar} />
        ) : !lista.dato ? (
          <TablaSkeleton filas={4} />
        ) : clientes.length > 0 ? (
          <div className="overflow-y-hidden overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-base">
              <thead>
                <tr className="text-base text-texto-tenue">
                  <th className={`${th} text-left`}>Cliente</th>
                  <th className={`${th} text-left`}>Condición IVA</th>
                  <th className={`${th} text-center`}>Comprobantes</th>
                  <th className={`${th} text-right`}>Facturado</th>
                  <th className={`${th} text-right`}>Por cobrar</th>
                </tr>
              </thead>
              <tbody className="cascada" key={qDemorado}>
                {clientes.map((c) => (
                  <tr key={c.id} className="border-b border-[#F0F2F7] transition-colors last:border-0 hover:bg-fondo">
                    <td className={`${td} whitespace-nowrap`}>
                      <span className="block font-semibold">{c.nombre ? nombrePropio(c.nombre) : formatearCuit(c.docNro)}</span>
                      {/* Documento debajo del nombre: una columna menos y todo entra en una línea. */}
                      <span className="block text-base tabular-nums text-texto-tenue">
                        {DOC[c.docTipo] ?? 'Doc.'} {c.docTipo === 96 ? c.docNro : formatearCuit(c.docNro)}
                        {c.ultimo && <> · última {fecha(c.ultimo)}</>}
                      </span>
                    </td>
                    <td className={`${td} whitespace-nowrap text-texto-suave`}>{condicionTexto(c)}</td>
                    <td className={`${td} text-center font-semibold tabular-nums`}>{c.comprobantes}</td>
                    <td className={`${td} whitespace-nowrap text-right font-semibold tabular-nums`}>{pesos(c.facturado)}</td>
                    <td className={`${td} whitespace-nowrap text-right tabular-nums ${c.porCobrar > 0 ? 'font-semibold text-aviso-texto' : 'text-texto-tenue'}`}>
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
          <div className="entra flex flex-col items-center gap-3 py-10 text-center">
            <Facti pose="buscando" size={130} animated={false} />
            <h2 className="text-[20px] font-bold">Todavía no tenés clientes</h2>
            <p className="max-w-[380px] text-texto-suave">Cuando le hagas una factura a alguien con CUIT o DNI, lo guardamos acá con todo lo que le facturaste.</p>
          </div>
        )}
      </section>
    </>
  );
}
