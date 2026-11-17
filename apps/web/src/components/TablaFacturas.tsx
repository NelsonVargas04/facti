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

/** Clases compartidas por todas las tablas de la app (facturas, cobros, clientes). */
export const th = 'whitespace-nowrap border-b border-[#EDF0F6] px-3 pb-3 pt-1 font-semibold text-texto-tenue first:pl-0 last:pr-0';
export const td = 'px-3 py-3.5 align-middle first:pl-0 last:pr-0';
export const fila = 'group border-b border-[#F0F2F7] transition-colors last:border-0 hover:bg-fondo/70';

/** Número corto de la app con 4 dígitos: "#0012". El oficial (00001-00000012) queda en el detalle y el PDF. */
export const nroCorto = (f: Pick<Comprobante, 'numeroInterno'>) => `#${String(f.numeroInterno).padStart(4, '0')}`;

/** Chip con la sigla del comprobante (C, E, NC…). */
export function ChipTipo({ sigla }: { sigla: string }) {
  return <span className={`inline-flex h-9 min-w-[36px] flex-none items-center justify-center rounded-[10px] px-2 font-bold ${colorTipo(sigla)}`}>{sigla}</span>;
}

/**
 * Lista de comprobantes: tabla si entra, lista si no (celular o tarjeta angosta).
 * `accion`: lo que va en la última columna en vez del estado de cobro (por ejemplo, "Marcar cobrada").
 * `compacta`: para tarjetas angostas como la del inicio (cambia antes a lista y no muestra la fecha).
 */
export function TablaFacturas({
  rows,
  compacta = false,
  accion,
}: {
  rows: Comprobante[];
  compacta?: boolean;
  accion?: (f: Comprobante) => React.ReactNode;
}) {
  const router = useRouter();
  const tabla = compacta ? 'hidden @min-[560px]:block' : 'hidden @min-[760px]:block';
  const lista = compacta ? '@min-[560px]:hidden' : '@min-[760px]:hidden';
  const ultima = (f: Comprobante) => (accion ? accion(f) : <ChipCobro estado={f.cobro} />);

  return (
    <div className="@container">
      <ul className={`flex flex-col divide-y divide-[#F0F2F7] ${lista}`}>
        {rows.map((f) => {
          const total = totalFirmado(f);
          const contenido = (
            <>
              <Link href={`/app/facturas/${f.id}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-[12px] py-3.5 transition-colors hover:bg-fondo/70">
                <span className="row-span-2"><ChipTipo sigla={f.sigla} /></span>
                <span className="truncate font-semibold">{nombreCliente(f)}</span>
                <span className={`whitespace-nowrap text-right font-semibold tabular-nums ${total < 0 ? 'text-[#B4232B]' : ''}`}>{importe(total, f.moneda)}</span>
                <span className="truncate tabular-nums text-texto-tenue">{nroCorto(f)} · {fechaCorta(f.fecha)}</span>
                {!accion && <span className="justify-self-end"><ChipCobro estado={f.cobro} /></span>}
              </Link>
              {accion && <div className="flex justify-end pb-3.5">{accion(f)}</div>}
            </>
          );
          return <li key={f.id}>{contenido}</li>;
        })}
      </ul>

      <div className={tabla}>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${th} text-left`}>Comprobante</th>
              <th className={`${th} w-full text-left`}>Cliente</th>
              {!compacta && <th className={`${th} text-left`}>Fecha</th>}
              <th className={`${th} text-right`}>Total</th>
              <th className={`${th} text-right`}>{accion ? '' : 'Cobro'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => {
              const total = totalFirmado(f);
              const ir = () => router.push(`/app/facturas/${f.id}`);
              const celdas = (
                <>
                  <td className={td}>
                    <span className="flex items-center gap-2.5">
                      <ChipTipo sigla={f.sigla} />
                      <span className="whitespace-nowrap font-semibold tabular-nums text-texto-suave" title={`${f.sigla} ${numeroComprobante(f.puntoVenta, f.numero)}`}>{nroCorto(f)}</span>
                    </span>
                  </td>
                  <td className={`${td} max-w-0`}>
                    <span className="block truncate font-semibold">{nombreCliente(f)}</span>
                    {compacta && <span className="block truncate tabular-nums text-texto-tenue">{fechaCorta(f.fecha)}</span>}
                  </td>
                  {!compacta && <td className={`${td} whitespace-nowrap tabular-nums text-texto-suave`}>{fechaCorta(f.fecha)}</td>}
                  <td className={`${td} whitespace-nowrap text-right font-semibold tabular-nums ${total < 0 ? 'text-[#B4232B]' : ''}`}>{importe(total, f.moneda)}</td>
                  <td className={`${td} whitespace-nowrap text-right`} onClick={accion ? (e) => e.stopPropagation() : undefined}>{ultima(f)}</td>
                </>
              );
              const props = {
                onClick: ir,
                onKeyDown: (e: React.KeyboardEvent) => e.key === 'Enter' && ir(),
                tabIndex: 0,
                'aria-label': `Ver ${f.sigla} ${nroCorto(f)}`,
                className: `${fila} cursor-pointer focus-visible:bg-fondo focus-visible:outline-none`,
              };
              return <tr key={f.id} {...props}>{celdas}</tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
