'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Cobro, Comprobante } from '@/lib/api';
import { nombreCliente } from '@/lib/comprobante';
import { fechaCorta, importe, numeroComprobante } from '@/lib/formato';

function colorTipo(t: string): string {
  if (t === 'E') return 'bg-acento text-texto';
  if (t === 'NC') return 'bg-exito-suave text-exito-texto';
  if (t === 'ND') return 'bg-aviso-suave text-aviso-texto';
  return 'bg-primario-suave text-primario-oscuro';
}

type Tono = 'ok' | 'warn' | 'err';
const TONO: Record<Tono, { cls: string; dot: string }> = {
  ok: { cls: 'bg-[#EAF8F0] text-[#0E5C38] ring-[#C8EDD8]', dot: '#1E9E63' },
  warn: { cls: 'bg-[#FFF6E1] text-[#7A5200] ring-[#F3E1A6]', dot: '#E0A100' },
  err: { cls: 'bg-[#FDECEC] text-[#B4232B] ring-[#F6CBCD]', dot: '#E5484D' },
};

function Estado({ tono, children }: { tono: Tono; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-base font-semibold ring-1 ring-inset ${TONO[tono].cls}`}>
      <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: TONO[tono].dot }} />
      {children}
    </span>
  );
}

export function ChipCobro({ estado }: { estado: Cobro }) {
  if (estado === 'cobrada') return <Estado tono="ok">Cobrada</Estado>;
  if (estado === 'pendiente') return <Estado tono="warn">Pendiente</Estado>;
  return <span className="text-texto-tenue">—</span>;
}

export { colorTipo };

/** Total con signo: las notas de crédito se muestran en negativo. */
export const totalFirmado = (c: Comprobante) => (c.sigla === 'NC' ? -c.total : c.total);

/** Placeholder animado mientras cargan las facturas. */
export function TablaSkeleton({ filas = 5 }: { filas?: number }) {
  // Filas flexibles (no una tabla de ancho fijo): sirve igual en celular y en compu.
  return (
    <div className="flex flex-col divide-y divide-[#F0F2F7]" aria-hidden="true">
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3.5">
          <div className="skeleton h-9 w-9 flex-none rounded-[10px]" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="skeleton h-5 w-2/5 max-w-[220px]" />
            <div className="skeleton h-4 w-3/5 max-w-[300px]" />
          </div>
          <div className="flex flex-none flex-col items-end gap-2">
            <div className="skeleton h-5 w-20" />
            <div className="skeleton h-6 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

const th = 'whitespace-nowrap border-b border-[#EDF0F6] px-4 pb-3 font-semibold';
const td = 'px-4 py-3.5 align-middle';

/** `compacta` (para el inicio, donde la tarjeta es angosta): el número va debajo del cliente y no hay columna aparte. */
export function TablaFacturas({ rows, compacta = false }: { rows: Comprobante[]; compacta?: boolean }) {
  const router = useRouter();
  // Con poco ancho (celular, o la tarjeta angosta del inicio) se muestra como lista; si entra, como tabla.
  const tabla = compacta ? 'hidden @min-[520px]:block' : 'hidden @min-[820px]:block';
  const lista = compacta ? '@min-[520px]:hidden' : '@min-[820px]:hidden';
  return (
    <div className="@container">
    <ul className={`cascada flex flex-col divide-y divide-[#F0F2F7] ${lista}`}>
      {rows.map((f) => {
        const total = totalFirmado(f);
        return (
          <li key={f.id}>
            <Link href={`/app/facturas/${f.id}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-[12px] py-3 transition-colors hover:bg-fondo">
              <span className={`row-span-2 inline-flex h-10 min-w-[40px] items-center justify-center rounded-[12px] px-2 font-bold ${colorTipo(f.sigla)}`}>{f.sigla}</span>
              <span className="truncate font-semibold">{nombreCliente(f)}</span>
              <span className={`whitespace-nowrap text-right font-semibold tabular-nums ${total < 0 ? 'text-[#B4232B]' : ''}`}>{importe(total, f.moneda)}</span>
              <span className="truncate tabular-nums text-texto-tenue">{numeroComprobante(f.puntoVenta, f.numero)} · {fechaCorta(f.fecha)}</span>
              <span className="justify-self-end"><ChipCobro estado={f.cobro} /></span>
            </Link>
          </li>
        );
      })}
    </ul>
    <div className={`overflow-y-hidden overflow-x-auto ${tabla}`}>
      <table className={`w-full border-collapse text-base ${compacta ? '[&_td]:px-3 [&_th]:px-3' : ''}`}>
        <thead>
          {/* Sin columna "ARCA": Facti solo guarda comprobantes que ARCA ya autorizó, así que siempre decía lo mismo. */}
          <tr className="text-base text-texto-tenue">
            <th className={`${th} text-center`}>Tipo</th>
            {!compacta && <th className={`${th} text-left`}>Número</th>}
            <th className={`${th} w-full text-left`}>Cliente</th>
            <th className={`${th} text-center`}>Fecha</th>
            <th className={`${th} text-right`}>Total</th>
            <th className={`${th} text-center`}>Cobro</th>
            {!compacta && <th className={`${th} w-10`} aria-label="Ver" />}
          </tr>
        </thead>
        <tbody className="cascada">
          {rows.map((f) => {
            const total = totalFirmado(f);
            const ir = () => router.push(`/app/facturas/${f.id}`);
            return (
            <tr
              key={f.id}
              onClick={ir}
              onKeyDown={(e) => e.key === 'Enter' && ir()}
              tabIndex={0}
              aria-label={`Ver ${f.sigla} ${numeroComprobante(f.puntoVenta, f.numero)}`}
              className="group cursor-pointer border-b border-[#F0F2F7] transition-colors last:border-0 hover:bg-fondo focus-visible:bg-fondo focus-visible:outline-none"
            >
              <td className={`${td} text-center`}>
                <span className={`inline-flex h-8 min-w-[34px] items-center justify-center rounded-[10px] px-2 text-base font-bold ${colorTipo(f.sigla)}`}>{f.sigla}</span>
              </td>
              {!compacta && <td className={`${td} whitespace-nowrap tabular-nums text-texto-suave`}>{numeroComprobante(f.puntoVenta, f.numero)}</td>}
              <td className={`${td} whitespace-nowrap`}>
                <span className="block font-semibold">{nombreCliente(f)}</span>
                {compacta && <span className="block text-base tabular-nums text-texto-tenue">{numeroComprobante(f.puntoVenta, f.numero)}</span>}
              </td>
              <td className={`${td} whitespace-nowrap text-center tabular-nums text-texto-suave`}>{fechaCorta(f.fecha)}</td>
              <td className={`${td} whitespace-nowrap text-right font-semibold tabular-nums ${total < 0 ? 'text-[#B4232B]' : ''}`}>{importe(total, f.moneda)}</td>
              <td className={`${td} text-center`}><ChipCobro estado={f.cobro} /></td>
              {!compacta && (
              <td className={`${td} text-center text-texto-tenue`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="opacity-0 transition-opacity group-hover:opacity-100">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </td>
              )}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </div>
  );
}
