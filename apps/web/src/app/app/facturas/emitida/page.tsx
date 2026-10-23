'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AvisoApi } from '@/components/AvisoApi';
import { Facti } from '@/components/Facti';
import { ComprobanteC } from '@/components/ComprobanteC';
import { verComprobante } from '@/lib/api';
import { datosComprobante, nombreCliente } from '@/lib/comprobante';
import { fecha, numeroComprobante, pesos } from '@/lib/formato';
import { useApi } from '@/lib/useApi';

function Ic({ children }: { children: React.ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

// useSearchParams necesita un Suspense alrededor en Next.js.
export default function FacturaEmitidaPagina() {
  return (
    <Suspense fallback={<div className="skeleton h-[560px] rounded-tarjeta-lg" />}>
      <FacturaEmitida />
    </Suspense>
  );
}

function FacturaEmitida() {
  const id = useSearchParams().get('id') ?? '';
  const det = useApi(() => verComprobante(id), [id]);
  const [copiado, setCopiado] = useState(false);

  if (!id || (det.estado === 'error' && det.error.estado === 404)) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Facti pose="pensando" size={150} />
        <h1 className="text-[22px] font-bold">No encontramos esa factura</h1>
        <Link href="/app/facturas" className="btn-lift rounded-full bg-primario px-6 py-3 font-extrabold text-white shadow-boton">Ver mis facturas</Link>
      </div>
    );
  }
  if (det.estado === 'error' && !det.dato) return <AvisoApi error={det.error} onReintentar={det.recargar} />;
  if (!det.dato) return <div aria-busy="true" className="skeleton h-[560px] rounded-tarjeta-lg" />;

  const { comprobante: f, emisor } = det.dato;
  const datos = datosComprobante(f, emisor);

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(f.qr);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* el navegador puede bloquear el portapapeles */
    }
  }

  const DATOS: [string, string][] = [
    ['Comprobante', `Factura ${f.sigla} ${numeroComprobante(f.puntoVenta, f.numero)}`],
    ['Total', pesos(f.total, true)],
    ['Cliente', nombreCliente(f)],
    ['Fecha de emisión', fecha(f.fecha)],
    ['CAE', f.cae],
    ['Vencimiento del CAE', fecha(f.caeVto)],
  ];

  return (
    <>
      <div className="flex flex-wrap items-start gap-8">
        {/* Columna izquierda */}
        <div className="flex min-w-0 flex-1 basis-[440px] flex-col gap-[22px]">
          <div className="flex items-center gap-[18px] rounded-tarjeta-lg bg-exito-suave p-7">
            <Facti pose="festejo" size={160} animated />
            <div className="flex flex-col gap-1.5 text-exito-texto">
              <span className="flex items-center gap-1.5 text-sm font-extrabold"><Ic><path d="M5 12.5l4.5 4.5L19 7.5" /></Ic>Autorizada por ARCA</span>
              <h1 className="text-[32px] font-bold leading-tight text-texto">¡Listo! Tu factura ya es válida</h1>
              <span className="text-[15px] text-exito-texto">Ya quedó guardada. Descargala o compartila con tu cliente.</span>
            </div>
          </div>

          <section className="grid grid-cols-2 gap-4 rounded-tarjeta bg-superficie p-7 shadow-tarjeta">
            {DATOS.map(([k, v]) => (
              <div key={k}>
                <div className="text-[13px] text-texto-tenue">{k}</div>
                <strong className="break-words">{v}</strong>
              </div>
            ))}
          </section>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => window.print()} className="btn-lift flex h-[52px] items-center gap-2.5 rounded-[16px] bg-primario px-5 font-extrabold text-white shadow-boton">
              <Ic><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></Ic>Descargar PDF
            </button>
            <button type="button" className="btn-lift flex h-[52px] items-center gap-2.5 rounded-[16px] border-[1.5px] border-borde bg-white px-5 font-extrabold text-texto">
              <Ic><path d="M4 20l1.5-4.5A8 8 0 1 1 9 19z" /></Ic>Enviar por WhatsApp
            </button>
            <button type="button" className="btn-lift flex h-[52px] items-center gap-2.5 rounded-[16px] border-[1.5px] border-borde bg-white px-5 font-extrabold text-texto">
              <Ic><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 8l9 6 9-6" /></Ic>Reenviar email
            </button>
            <button type="button" onClick={copiarLink} className="btn-lift flex h-[52px] items-center gap-2.5 rounded-[16px] border-[1.5px] border-borde bg-white px-5 font-extrabold text-texto">
              <Ic><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></Ic>
              {copiado ? '¡Link copiado!' : 'Copiar link'}
            </button>
          </div>

          <section className="flex flex-col gap-3.5 rounded-tarjeta bg-superficie p-7 shadow-tarjeta">
            <h2 className="text-[20px] font-bold">¿Qué querés hacer ahora?</h2>
            <div className="flex flex-wrap gap-3">
              <Link href={`/app/facturas/${f.id}`} className="flex-1 basis-[200px] rounded-[16px] bg-fondo p-4 transition-colors hover:bg-primario-suave">
                <strong className="block">Registrar el cobro</strong>
                <span className="text-sm text-texto-suave">Cuando te paguen, marcala como cobrada</span>
              </Link>
              <Link href="/app/facturas/nueva" className="flex-1 basis-[200px] rounded-[16px] bg-fondo p-4 transition-colors hover:bg-primario-suave">
                <strong className="block">Emitir otra factura</strong>
                <span className="text-sm text-texto-suave">Con los mismos datos o para otro cliente</span>
              </Link>
            </div>
            <p className="text-sm text-texto-suave">Guardamos el PDF y la respuesta de ARCA durante 10 años. También podés verificarla en ARCA escaneando el QR.</p>
          </section>
        </div>

        {/* Columna derecha: vista previa en formato oficial */}
        <div className="flex flex-[0_1_460px] flex-col gap-2.5">
          <span className="text-[13px] font-extrabold tracking-[0.06em] text-texto-tenue">VISTA PREVIA DEL PDF (FORMATO OFICIAL)</span>
          <div className="overflow-hidden rounded-xl shadow-tarjeta-lg" style={{ width: 445, height: 629 }}>
            <div style={{ width: 794, transformOrigin: 'top left', transform: 'scale(0.56)' }}>
              <ComprobanteC datos={datos} />
            </div>
          </div>
          <button type="button" onClick={() => window.print()} className="self-start text-[15px] font-extrabold text-primario-oscuro transition-colors hover:text-texto">Descargar / imprimir PDF →</button>
        </div>
      </div>

      {/* Copia a página completa, solo visible al imprimir */}
      <div id="comprobante-print" className="absolute left-[-99999px] top-0">
        <ComprobanteC datos={datos} />
      </div>
    </>
  );
}
