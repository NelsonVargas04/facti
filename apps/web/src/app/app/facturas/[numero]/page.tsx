'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { BackLink } from '@/components/BackLink';
import { Facti } from '@/components/Facti';
import { ComprobanteC } from '@/components/ComprobanteC';
import { EscalarComprobante } from '@/components/EscalarComprobante';
import { buscarFacturaDemo, datosComprobante } from '@/lib/facturas-demo';

function Ic({ children }: { children: React.ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export default function DetalleFactura() {
  const params = useParams<{ numero: string }>();
  const numero = decodeURIComponent(params.numero);
  const factura = buscarFacturaDemo(numero);

  if (!factura) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Facti pose="pensando" size={150} />
        <h1 className="text-[22px] font-bold">No encontramos esa factura</h1>
        <Link href="/app/facturas" className="btn-lift rounded-full bg-primario px-6 py-3 font-extrabold text-white shadow-boton">Volver a facturas</Link>
      </div>
    );
  }

  const esE = factura.tipo === 'E';
  const datos = esE ? null : datosComprobante(factura);

  return (
    <>
      <div className="aparece">
        <BackLink href="/app/facturas">Volver a facturas</BackLink>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[32px] font-bold">Factura {factura.tipo} {factura.num}</h1>
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
          {esE ? (
            <div className="flex flex-col items-center gap-3 rounded-tarjeta-lg bg-[#E4E8F1] p-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-acento font-mono text-2xl font-bold text-texto">E</span>
              <h3 className="text-[18px] font-bold">Factura E {factura.num}</h3>
              <p className="max-w-[360px] text-texto-suave">La vista del comprobante de exportación (formato WSFEX) se suma cuando integremos la Factura E.</p>
            </div>
          ) : (
            <div className="rounded-tarjeta-lg bg-[#E4E8F1] p-4 sm:p-7">
              <div className="mx-auto max-w-[794px] overflow-hidden rounded-[8px] bg-white shadow-[0_14px_44px_rgba(21,25,58,0.22)]">
                <EscalarComprobante>
                  <ComprobanteC datos={datos!} />
                </EscalarComprobante>
              </div>
            </div>
          )}
        </div>

        {/* Datos (secundario) */}
        <aside style={{ animationDelay: '160ms' }} className="aparece order-2 flex min-w-0 flex-1 basis-[280px] flex-col gap-[18px]">
          <div className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
            <h2 className="text-[18px] font-bold">Datos del comprobante</h2>
            {[
              ['Cliente', factura.cliente],
              ['Fecha', `${factura.fecha}/2026`],
              ['Total', factura.total],
              ['Estado ARCA', factura.arca],
              ['Cobro', factura.cobro],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 border-b border-[#F0F2F7] pb-2.5 last:border-0 last:pb-0">
                <span className="text-sm text-texto-tenue">{k}</span>
                <strong className="text-right">{v}</strong>
              </div>
            ))}
          </div>
          {!esE && (
            <div className="flex flex-col gap-2.5 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
              <button type="button" onClick={() => window.print()} className="btn-lift flex h-12 items-center justify-center gap-2 rounded-full bg-primario font-extrabold text-white shadow-boton">
                <Ic><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></Ic>Descargar PDF
              </button>
              <button type="button" className="btn-lift flex h-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-borde bg-white font-extrabold text-texto">
                <Ic><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 8l9 6 9-6" /></Ic>Reenviar por email
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* Copia a página completa para imprimir */}
      {!esE && (
        <div id="comprobante-print" className="absolute left-[-99999px] top-0">
          <ComprobanteC datos={datos!} />
        </div>
      )}
    </>
  );
}
