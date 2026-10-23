'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Girando } from '@/components/Animado';
import { AvisoApi } from '@/components/AvisoApi';
import { BackLink } from '@/components/BackLink';
import { Facti } from '@/components/Facti';
import { ComprobanteC } from '@/components/ComprobanteC';
import { EscalarComprobante } from '@/components/EscalarComprobante';
import { ChipCobro, totalFirmado } from '@/components/TablaFacturas';
import { marcarCobro, verComprobante, type ErrorApi } from '@/lib/api';
import { datosComprobante, nombreCliente } from '@/lib/comprobante';
import { fecha, importe, numeroComprobante } from '@/lib/formato';
import { useApi } from '@/lib/useApi';

function Ic({ children }: { children: React.ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const NOMBRES: Record<string, string> = { NC: 'Nota de crédito', ND: 'Nota de débito', E: 'Factura E' };

export default function DetalleFactura() {
  const { id } = useParams<{ id: string }>();
  const det = useApi(() => verComprobante(id), [id]);
  const [cambiando, setCambiando] = useState(false);
  const [errCobro, setErrCobro] = useState<ErrorApi | null>(null);

  if (det.estado === 'error' && !det.dato) {
    if (det.error.estado === 404) {
      return (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Facti pose="pensando" size={150} />
          <h1 className="text-[22px] font-bold">No encontramos esa factura</h1>
          <Link href="/app/facturas" className="btn-lift rounded-full bg-primario px-6 py-3 font-extrabold text-white shadow-boton">Volver a facturas</Link>
        </div>
      );
    }
    return <AvisoApi error={det.error} onReintentar={det.recargar} />;
  }
  if (!det.dato) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <div className="skeleton h-10 w-72 rounded-xl" />
        <div className="skeleton h-[560px] rounded-tarjeta-lg" />
      </div>
    );
  }

  const { comprobante: f, emisor } = det.dato;
  const esE = f.sigla === 'E';
  const datos = esE ? null : datosComprobante(f, emisor);
  const titulo = `${NOMBRES[f.sigla] ?? `Factura ${f.sigla}`} ${numeroComprobante(f.puntoVenta, f.numero)}`;

  async function cambiarCobro() {
    setCambiando(true);
    setErrCobro(null);
    const r = await marcarCobro(f.id, f.cobro === 'cobrada' ? 'pendiente' : 'cobrada');
    setCambiando(false);
    if (r.ok) det.setDato({ comprobante: { ...f, ...r.dato, items: f.items }, emisor });
    else setErrCobro(r);
  }

  return (
    <>
      <div className="aparece">
        <BackLink href="/app/facturas">Volver a facturas</BackLink>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[32px] font-bold">{titulo}</h1>
          {!esE && (
            <button type="button" onClick={() => window.print()} className="btn-lift flex h-12 items-center gap-2 rounded-full bg-primario px-6 font-extrabold text-white shadow-boton">
              <Ic><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></Ic>Descargar PDF
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-7">
        {/* Vista del comprobante (principal) */}
        <div style={{ animationDelay: '80ms' }} className="aparece order-1 flex min-w-0 flex-[2_1_520px] flex-col gap-2.5">
          <span className="text-[13px] font-extrabold tracking-[0.06em] text-texto-tenue">COMPROBANTE (FORMATO OFICIAL)</span>
          {esE || !datos ? (
            <div className="flex flex-col items-center gap-3 rounded-tarjeta-lg bg-[#E4E8F1] p-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-acento font-mono text-2xl font-bold text-texto">E</span>
              <h3 className="text-[18px] font-bold">{titulo}</h3>
              <p className="max-w-[360px] text-texto-suave">La vista del comprobante de exportación (formato WSFEX) se suma cuando integremos la Factura E.</p>
            </div>
          ) : (
            <div className="rounded-tarjeta-lg bg-[#E4E8F1] p-4 sm:p-7">
              <div className="entra mx-auto max-w-[794px] overflow-hidden rounded-[8px] bg-white shadow-[0_14px_44px_rgba(21,25,58,0.22)]">
                <EscalarComprobante>
                  <ComprobanteC datos={datos} />
                </EscalarComprobante>
              </div>
            </div>
          )}
        </div>

        {/* Datos (secundario) */}
        <aside style={{ animationDelay: '160ms' }} className="aparece order-2 flex min-w-0 flex-1 basis-[280px] flex-col gap-[18px]">
          <div className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
            <h2 className="text-[18px] font-bold">Datos del comprobante</h2>
            {(
              [
                ['Cliente', nombreCliente(f)],
                ['Fecha', fecha(f.fecha)],
                ['Total', importe(totalFirmado(f), f.moneda)],
                ['CAE', f.cae],
                ['Vencimiento del CAE', fecha(f.caeVto)],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 border-b border-[#F0F2F7] pb-2.5">
                <span className="text-sm text-texto-tenue">{k}</span>
                <strong className="text-right tabular-nums">{v}</strong>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 border-b border-[#F0F2F7] pb-2.5">
              <span className="text-sm text-texto-tenue">Estado ARCA</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF8F0] px-2.5 py-1 text-[12.5px] font-bold text-[#0E5C38] ring-1 ring-inset ring-[#C8EDD8]"><span className="h-[7px] w-[7px] rounded-full bg-[#1E9E63]" />Autorizada</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-texto-tenue">Cobro</span>
              {/* key: el chip vuelve a entrar cuando cambia el estado del cobro */}
              <span key={f.cobro} className="entra">
                <ChipCobro estado={f.cobro} />
              </span>
            </div>
            {f.cobro !== '' && (
              <button
                type="button"
                onClick={cambiarCobro}
                disabled={cambiando}
                className={`btn-lift mt-1 flex h-11 items-center justify-center gap-2 rounded-full font-extrabold disabled:opacity-60 ${
                  f.cobro === 'cobrada' ? 'border-[1.5px] border-borde bg-white text-texto' : 'bg-exito text-white'
                }`}
              >
                {cambiando ? (<><Girando />Guardando…</>) : f.cobro === 'cobrada' ? 'Marcar como pendiente' : (<><Ic><path d="M5 12.5l4.5 4.5L19 7.5" /></Ic>Marcar como cobrada</>)}
              </button>
            )}
            {errCobro && <AvisoApi error={errCobro} compacto />}
          </div>
          {!esE && (
            <div className="flex flex-col gap-2.5 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
              <button type="button" onClick={() => window.print()} className="btn-lift flex h-12 items-center justify-center gap-2 rounded-full bg-primario font-extrabold text-white shadow-boton">
                <Ic><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></Ic>Descargar PDF
              </button>
              <p className="text-sm text-texto-suave">Guardamos el comprobante y la respuesta de ARCA durante 10 años.</p>
            </div>
          )}
        </aside>
      </div>

      {/* Copia a página completa para imprimir */}
      {datos && (
        <div id="comprobante-print" className="absolute left-[-99999px] top-0">
          <ComprobanteC datos={datos} />
        </div>
      )}
    </>
  );
}
