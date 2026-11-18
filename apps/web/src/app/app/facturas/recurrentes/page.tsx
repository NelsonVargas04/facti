'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AvisoApi } from '@/components/AvisoApi';
import { BackLink } from '@/components/BackLink';
import { Facti } from '@/components/Facti';
import { Icon } from '@/components/Icon';
import { Select } from '@/components/Select';
import { borrarRecurrente, cambiarRecurrente, listarRecurrentes, type ErrorApi, type Recurrente } from '@/lib/api';
import { fecha, pesos } from '@/lib/formato';
import { useApi } from '@/lib/useApi';

const DIAS = Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: `Día ${i + 1}` }));

/**
 * Link de "Agregar a Google Calendar": un evento de todo el día que se repite cada mes ese día.
 * No pide acceso a la cuenta de Google (es la plantilla pública de Calendar).
 */
function linkGoogleCalendar(r: Recurrente): string {
  const ini = r.proxima.replace(/-/g, '');
  const d = new Date(`${r.proxima}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const fin = d.toISOString().slice(0, 10).replace(/-/g, '');
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Facturar a ${r.cliente} (${pesos(r.total)})`,
    dates: `${ini}/${fin}`,
    details: r.automatica
      ? 'Facti emite esta factura sola hoy. Entrá a Facti para verla.'
      : `Hoy toca emitir esta factura en Facti: ${typeof window === 'undefined' ? '' : window.location.origin}/app/facturas/recurrentes`,
    recur: `RRULE:FREQ=MONTHLY;BYMONTHDAY=${r.dia}`,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

function Fila({ r, onCambio, onBorrada }: { r: Recurrente; onCambio: (r: Recurrente) => void; onBorrada: () => void }) {
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState<ErrorApi | null>(null);
  const [borrando, setBorrando] = useState(false);

  async function cambiar(c: { dia?: number; automatica?: boolean; activa?: boolean }) {
    setGuardando(true);
    setErr(null);
    const res = await cambiarRecurrente(r.id, c);
    setGuardando(false);
    if (res.ok) onCambio(res.dato);
    else setErr(res);
  }

  async function borrar() {
    setGuardando(true);
    const res = await borrarRecurrente(r.id);
    setGuardando(false);
    if (res.ok) onBorrada();
    else setErr(res);
  }

  return (
    <li className={`flex flex-col gap-4 rounded-tarjeta bg-superficie p-5 shadow-tarjeta sm:p-6 ${r.pendiente ? 'ring-2 ring-acento' : ''} ${!r.activa ? 'opacity-80' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[18px] font-bold">{r.cliente}</span>
          <span className="text-texto-suave">
            Todos los meses el día {r.dia} · {r.activa ? `próxima el ${fecha(r.proxima)}` : 'pausada'}
          </span>
        </div>
        <span className="font-display text-[22px] font-bold tabular-nums">{pesos(r.total)}</span>
      </div>

      {r.pendiente && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-aviso-suave px-4 py-3">
          <span className="font-semibold text-aviso-texto">{r.automatica ? 'Hoy sale sola.' : 'Hoy toca emitirla.'}</span>
          {!r.automatica && (
            <Link href={`/app/facturas/nueva?recurrente=${r.id}`} className="btn-lift inline-flex h-11 items-center gap-2 rounded-full bg-primario px-5 font-bold text-white shadow-boton">
              Revisar y emitir
            </Link>
          )}
        </div>
      )}
      {r.ultimoError && (
        <p role="alert" className="flex items-start gap-2 rounded-[14px] bg-error-suave px-4 py-3 text-error">
          <Icon name="alerta" size={20} className="mt-0.5 flex-none" />
          No pudimos emitirla sola: {r.ultimoError}. Emitila a mano desde acá.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-[#EEF1F6] pt-4">
        <label className="flex items-center gap-2 font-semibold">
          Día
          <span className="w-[120px]">
            <Select ariaLabel="Día del mes" value={String(r.dia)} onChange={(v) => cambiar({ dia: Number(v) })} options={DIAS} />
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" checked={r.automatica} disabled={guardando} onChange={(e) => cambiar({ automatica: e.target.checked })} className="h-5 w-5 accent-primario" />
          <span className="font-semibold">Que salga sola</span>
        </label>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <a href={linkGoogleCalendar(r)} target="_blank" rel="noopener noreferrer" className="btn-lift inline-flex h-10 items-center gap-2 rounded-full border-[1.5px] border-borde bg-white px-4 font-bold text-texto hover:border-primario hover:text-primario-oscuro">
            <Icon name="calendario" size={18} />
            Google Calendar
          </a>
          <button type="button" onClick={() => cambiar({ activa: !r.activa })} disabled={guardando} className="btn-lift inline-flex h-10 items-center rounded-full border-[1.5px] border-borde bg-white px-4 font-bold text-texto hover:border-primario hover:text-primario-oscuro">
            {r.activa ? 'Pausar' : 'Reanudar'}
          </button>
          {borrando ? (
            <span className="inline-flex items-center gap-2">
              <button type="button" onClick={borrar} disabled={guardando} className="h-10 rounded-full bg-[#E5484D] px-4 font-bold text-white">
                Sí, borrar
              </button>
              <button type="button" onClick={() => setBorrando(false)} className="h-10 rounded-full px-3 font-bold text-texto-suave">
                No
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setBorrando(true)} aria-label={`Borrar la factura recurrente de ${r.cliente}`} className="flex h-10 w-10 items-center justify-center rounded-full text-texto-tenue hover:bg-error-suave hover:text-error">
              <Icon name="cerrar" size={18} />
            </button>
          )}
        </div>
      </div>
      {err && <AvisoApi error={err} compacto />}
    </li>
  );
}

export default function Recurrentes() {
  const lista = useApi(listarRecurrentes, []);
  const rs = lista.dato?.recurrentes;

  function reemplazar(nueva: Recurrente) {
    if (!lista.dato) return;
    lista.setDato({ ...lista.dato, recurrentes: lista.dato.recurrentes.map((x) => (x.id === nueva.id ? nueva : x)) });
  }
  function quitar(id: number) {
    if (!lista.dato) return;
    lista.setDato({ ...lista.dato, recurrentes: lista.dato.recurrentes.filter((x) => x.id !== id) });
  }

  return (
    <>
      <div className="aparece">
        <BackLink href="/app/facturas">Volver a facturas</BackLink>
        <h1 className="mt-1 text-[28px] font-bold leading-tight sm:text-[34px]">Facturas de todos los meses</h1>
        <p className="text-texto-suave">Las que se repiten. Facti te las prepara el día que toca: las confirmás con un toque o salen solas.</p>
      </div>

      {lista.estado === 'error' && !lista.dato && <AvisoApi error={lista.error} onReintentar={lista.recargar} />}

      {!rs ? (
        lista.estado === 'cargando' && (
          <div className="flex flex-col gap-4">
            <div className="skeleton h-[170px] rounded-tarjeta" />
            <div className="skeleton h-[170px] rounded-tarjeta" />
          </div>
        )
      ) : rs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-tarjeta bg-superficie px-6 py-12 text-center shadow-tarjeta">
          <Facti pose="factura" size={120} animated />
          <h2 className="text-[20px] font-bold">Todavía no tenés facturas de todos los meses</h2>
          <p className="max-w-[460px] text-texto-suave">
            Al emitir una factura, prendé <b>Repetir todos los meses</b> (abajo del botón de emitir). También podés hacerlo desde una factura ya emitida.
          </p>
          <Link href="/app/facturas/nueva" className="btn-lift inline-flex h-12 items-center rounded-full bg-primario px-6 font-bold text-white shadow-boton">
            Emitir una factura
          </Link>
        </div>
      ) : (
        <ul className="cascada flex flex-col gap-4">
          {rs.map((r) => (
            <Fila key={r.id} r={r} onCambio={reemplazar} onBorrada={() => quitar(r.id)} />
          ))}
        </ul>
      )}

      {lista.dato?.limite != null && (
        <p className="text-texto-tenue">
          En el plan Gratis podés tener {lista.dato.limite} factura de todos los meses.{' '}
          <Link href="/app/plan" className="font-semibold text-primario-oscuro underline underline-offset-2">
            Con Pro, todas las que quieras
          </Link>
          .
        </p>
      )}
    </>
  );
}
