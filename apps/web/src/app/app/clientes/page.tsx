'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Numero } from '@/components/Animado';
import { AvisoApi } from '@/components/AvisoApi';
import { Facti } from '@/components/Facti';
import { fila, TablaSkeleton, td, th } from '@/components/TablaFacturas';
import { Buscador, TarjetaLista } from '@/components/TarjetaLista';
import { Paginacion } from '@/components/Paginacion';
import { condicionTexto, listarClientes } from '@/lib/api';
import { fecha, formatearCuit, nombrePropio, pesos } from '@/lib/formato';
import { useApi, useDemorado } from '@/lib/useApi';

const POR_PAGINA = 10;

const DOC: Record<number, string> = { 80: 'CUIT', 86: 'CUIL', 96: 'DNI' };

export default function Clientes() {
  const [q, setQ] = useState('');
  const qDemorado = useDemorado(q.trim());
  const lista = useApi(() => listarClientes(qDemorado), [qDemorado]);
  const clientes = lista.dato?.clientes ?? [];
  const totalComprobantes = clientes.reduce((a, c) => a + c.comprobantes, 0);
  const [pagina, setPagina] = useState(1);
  const visibles = clientes.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  return (
    <>
      <div className="aparece flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-tight sm:text-[34px]">Clientes</h1>
          <p className="hidden text-texto-suave sm:block">Tus clientes y cuánto les facturaste. Se guardan solos cuando les hacés una factura.</p>
        </div>
        <Link href="/app/facturas/nueva" className="btn-lift hidden h-12 items-center gap-2 rounded-full bg-primario px-6 font-bold text-white shadow-boton md:flex">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10" cy="8" r="4" /><path d="M3 20c0-3.9 3.1-7 7-7M18 14v6M15 17h6" /></svg>
          Facturar a un cliente nuevo
        </Link>
      </div>

      {/* Stats */}
      {lista.dato && !qDemorado && (
        <div className="cascada grid grid-cols-2 gap-3 sm:gap-[18px]">
          <div className="row-span-3 grid grid-rows-subgrid content-start gap-y-1 rounded-tarjeta bg-superficie px-4 py-4 shadow-tarjeta sm:px-6 sm:py-5">
            <span className="text-base font-semibold text-texto-tenue">Clientes</span>
            <span className="self-end font-display text-[22px] font-semibold leading-tight tabular-nums sm:text-[30px]"><Numero valor={clientes.length} formato={String} /></span>
          </div>
          <div className="row-span-3 grid grid-rows-subgrid content-start gap-y-1 rounded-tarjeta bg-superficie px-4 py-4 shadow-tarjeta sm:px-6 sm:py-5">
            <span className="text-base font-semibold text-texto-tenue">Comprobantes emitidos</span>
            <span className="self-end font-display text-[22px] font-semibold leading-tight tabular-nums sm:text-[30px]"><Numero valor={totalComprobantes} formato={String} /></span>
          </div>
        </div>
      )}

      {/* Tabla */}
      <TarjetaLista
        ocupado={lista.estado === 'cargando'}
        barra={<Buscador valor={q} onCambio={(v) => { setQ(v); setPagina(1); }} placeholder="Buscar por nombre o CUIT…" className="sm:max-w-[440px]" />}
        pie={clientes.length > 0 ? <Paginacion total={clientes.length} pagina={pagina} porPagina={POR_PAGINA} onPagina={setPagina} singular="cliente" plural="clientes" /> : undefined}
      >
        {lista.estado === 'error' && !lista.dato ? (
          <AvisoApi error={lista.error} onReintentar={lista.recargar} />
        ) : !lista.dato ? (
          <TablaSkeleton filas={4} />
        ) : clientes.length > 0 ? (
          <div className="@container">
            {/* Con poco ancho, lista; si entra, tabla. */}
            <ul className="cascada flex flex-col divide-y divide-[#F0F2F7] @min-[960px]:hidden" key={`l-${qDemorado}`}>
              {visibles.map((c) => (
                <li key={c.id} className="flex items-start gap-3 py-3.5">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{c.nombre ? nombrePropio(c.nombre) : formatearCuit(c.docNro)}</span>
                    <span className="truncate tabular-nums text-texto-tenue">
                      {DOC[c.docTipo] ?? 'Doc.'} {c.docTipo === 96 ? c.docNro : formatearCuit(c.docNro)}
                    </span>
                    <span className="truncate text-texto-suave">
                      {condicionTexto(c)} · {c.comprobantes} {c.comprobantes === 1 ? 'comprobante' : 'comprobantes'}
                    </span>
                  </span>
                  <span className="flex flex-none flex-col items-end">
                    <span className="whitespace-nowrap font-semibold tabular-nums">{pesos(c.facturado)}</span>
                    {c.porCobrar > 0 && <span className="whitespace-nowrap font-semibold tabular-nums text-aviso-texto">Debe {pesos(c.porCobrar)}</span>}
                  </span>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-y-hidden overflow-x-auto @min-[960px]:block">
            <table className="w-full border-collapse text-base">
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
                {visibles.map((c) => (
                  <tr key={c.id} className={fila}>
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
          </div>
        ) : qDemorado ? (
          <p className="flex flex-1 items-center justify-center py-10 text-center text-texto-suave">No encontramos clientes con esa búsqueda.</p>
        ) : (
          <div className="entra flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
            <Facti pose="buscando" size={130} animated={false} />
            <h2 className="text-[20px] font-bold">Todavía no tenés clientes</h2>
            <p className="max-w-[380px] text-texto-suave">Cuando le hagas una factura a alguien con CUIT o DNI, lo guardamos acá con todo lo que le facturaste.</p>
          </div>
        )}
      </TarjetaLista>
    </>
  );
}
