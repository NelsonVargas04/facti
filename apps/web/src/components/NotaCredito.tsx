'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Girando } from '@/components/Animado';
import { AvisoApi } from '@/components/AvisoApi';
import { emitirNotaCredito, type Comprobante, type ErrorApi } from '@/lib/api';
import { importe, numeroComprobante } from '@/lib/formato';

const inputCls = 'h-12 w-full rounded-input border-[1.5px] border-borde bg-white px-4 text-base text-texto outline-none transition-colors focus:border-primario';

/** "70.000,50" o "$70.000" -> 70000.5 */
function parseNum(s: string): number {
  const n = parseFloat(s.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Tarjeta para anular o corregir una Factura C con una Nota de Crédito C.
 * En una nota de crédito, muestra qué factura anula.
 */
export function NotaCredito({ comprobante: f }: { comprobante: Comprobante }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [parcial, setParcial] = useState(false);
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<ErrorApi | null>(null);

  if (f.sigla === 'NC') {
    const a = f.asociado;
    if (!a) return null;
    return (
      <div className="flex flex-col gap-2 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        <h2 className="text-[18px] font-bold">Factura que corrige</h2>
        <p className="text-texto-suave">
          Esta nota de crédito anula o corrige la{' '}
          <Link href={`/app/facturas/${a.id}`} className="font-bold text-primario-oscuro underline-offset-2 hover:underline">
            Factura {a.sigla} {numeroComprobante(a.puntoVenta, a.numero)}
          </Link>{' '}
          de {importe(a.total)}.
        </p>
      </div>
    );
  }
  if (f.sigla !== 'C') return null;

  const queda = Math.round((f.total - (f.acreditado ?? 0)) * 100) / 100;
  if (queda <= 0) {
    return (
      <div className="flex flex-col gap-2 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        <h2 className="text-[18px] font-bold">Factura anulada</h2>
        <p className="text-texto-suave">La anulaste por completo con notas de crédito. Ya no suma a tu facturación.</p>
      </div>
    );
  }

  const montoNum = parcial ? parseNum(monto) : queda;
  const montoValido = montoNum > 0 && montoNum <= queda + 0.005;

  async function emitir() {
    if (!montoValido) return;
    setEnviando(true);
    setError(null);
    const r = await emitirNotaCredito(f.id, parcial ? { importe: montoNum, motivo: motivo.trim() || undefined } : {});
    setEnviando(false);
    if (r.ok) router.push(`/app/facturas/${r.dato.id}`);
    else setError(r);
  }

  return (
    <div className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
      <h2 className="text-[18px] font-bold">¿Te equivocaste en esta factura?</h2>
      {f.acreditado > 0 && (
        <p className="text-texto-suave">
          Ya hiciste notas de crédito por {importe(f.acreditado)}. Queda {importe(queda)}.
        </p>
      )}
      {!abierto ? (
        <>
          <p className="text-texto-suave">Una factura autorizada no se borra: se anula con una nota de crédito, que también se informa a ARCA.</p>
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="btn-lift flex h-11 items-center justify-center rounded-full border-[1.5px] border-borde bg-white px-5 font-bold text-texto hover:border-primario hover:text-primario-oscuro"
          >
            Hacer nota de crédito
          </button>
        </>
      ) : (
        <div className="entra flex flex-col gap-3">
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Qué querés anular</legend>
            <label className="flex cursor-pointer items-start gap-3 rounded-input border-[1.5px] border-borde bg-white p-3 has-[:checked]:border-primario">
              <input type="radio" name="alcance" checked={!parcial} onChange={() => setParcial(false)} className="mt-1 h-4 w-4 flex-none accent-primario" />
              <span>
                <strong>Anular {f.acreditado > 0 ? 'lo que queda' : 'toda la factura'}</strong>
                <span className="block text-texto-suave">Nota de crédito por {importe(queda)}.</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-input border-[1.5px] border-borde bg-white p-3 has-[:checked]:border-primario">
              <input type="radio" name="alcance" checked={parcial} onChange={() => setParcial(true)} className="mt-1 h-4 w-4 flex-none accent-primario" />
              <span>
                <strong>Solo una parte</strong>
                <span className="block text-texto-suave">Por ejemplo, un descuento o un ítem que no correspondía.</span>
              </span>
            </label>
          </fieldset>
          {parcial && (
            <div className="entra flex flex-col gap-3">
              <label className="flex flex-col gap-2 text-base font-semibold">
                Importe a anular
                <input type="text" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} className={inputCls} placeholder={`Hasta ${importe(queda)}`} />
              </label>
              <label className="flex flex-col gap-2 text-base font-semibold">
                Motivo (aparece en la nota)
                <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} className={inputCls} placeholder="Descuento acordado" />
              </label>
              {monto !== '' && !montoValido && <p className="text-base text-aviso-texto">El importe tiene que ser mayor a cero y como mucho {importe(queda)}.</p>}
            </div>
          )}
          {error && <AvisoApi error={error} compacto />}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={emitir}
              disabled={enviando || !montoValido}
              className="btn-lift flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primario px-5 font-bold text-white shadow-boton disabled:opacity-60"
            >
              {enviando ? (<><Girando />Pidiendo el CAE…</>) : `Emitir nota por ${importe(montoNum > 0 ? montoNum : 0)}`}
            </button>
            <button type="button" onClick={() => { setAbierto(false); setError(null); }} disabled={enviando} className="h-11 rounded-full px-4 font-bold text-texto-suave hover:text-texto">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
