'use client';

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
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold ring-1 ring-inset ${TONO[tono].cls}`}>
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
  const anchos = ['w-10', 'w-32', 'w-40', 'w-12', 'w-20', 'w-24', 'w-20'];
  return (
    <div className="overflow-y-hidden overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse">
        <tbody>
          {Array.from({ length: filas }).map((_, i) => (
            <tr key={i} className="border-b border-[#F0F2F7] last:border-0">
              {anchos.map((w, j) => (
                <td key={j} className="px-3 py-4">
                  <div className={`skeleton h-5 ${w} ${j === 0 ? 'rounded-[10px]' : ''}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th = 'whitespace-nowrap border-b border-[#EDF0F6] px-4 pb-3 font-semibold';
const td = 'px-4 py-3.5 align-middle';

/** `compacta` (para el inicio, donde la tarjeta es angosta): el número va debajo del cliente y no hay columna aparte. */
export function TablaFacturas({ rows, compacta = false }: { rows: Comprobante[]; compacta?: boolean }) {
  const router = useRouter();
  return (
    <div className="overflow-y-hidden overflow-x-auto">
      <table className={`w-full border-collapse text-[15px] ${compacta ? 'min-w-[420px] [&_td]:px-3 [&_th]:px-3' : 'min-w-[620px]'}`}>
        <thead>
          {/* Sin columna "ARCA": Facti solo guarda comprobantes que ARCA ya autorizó, así que siempre decía lo mismo. */}
          <tr className="text-[13px] text-texto-tenue">
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
                <span className={`inline-flex h-8 min-w-[34px] items-center justify-center rounded-[10px] px-2 text-[13px] font-bold ${colorTipo(f.sigla)}`}>{f.sigla}</span>
              </td>
              {!compacta && <td className={`${td} whitespace-nowrap tabular-nums text-texto-suave`}>{numeroComprobante(f.puntoVenta, f.numero)}</td>}
              <td className={`${td} whitespace-nowrap`}>
                <span className="block font-semibold">{nombreCliente(f)}</span>
                {compacta && <span className="block text-[13px] tabular-nums text-texto-tenue">{numeroComprobante(f.puntoVenta, f.numero)}</span>}
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
  );
}
