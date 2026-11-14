'use client';

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { obtenerParametro } from '@facti/shared/src/parametros';
import { pesos } from '@/lib/formato';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Tope anual de la categoría, si está cargado en parametros.ts (por ahora solo A y K). Nunca se inventa. */
function topeDe(categoria?: string): number | null {
  if (!categoria) return null;
  try {
    return obtenerParametro(`monotributo.tope_anual.${categoria.toUpperCase()}`);
  } catch {
    return null;
  }
}

/** "$1,3 M" / "$450 mil" para el eje: corto y en castellano. */
function corto(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)} mil`;
  return `$${n}`;
}

type Mes = { mes: string; facturado: number };

function Globo({ active, payload }: { active?: boolean; payload?: { payload: Mes & { nombre: string } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload;
  return (
    <div className="rounded-[14px] bg-texto px-3.5 py-2.5 text-white shadow-tarjeta-lg">
      <div className="text-base capitalize text-[#C9CCE8]">{p.nombre}</div>
      <div className="text-[16px] font-bold tabular-nums">{pesos(p.facturado)}</div>
    </div>
  );
}

/**
 * Facturación mes a mes de los últimos 12 meses (lo que cuenta para la categoría de monotributo).
 * El mes actual va en índigo y los anteriores en lila; si se conoce el tope de la categoría,
 * abajo se ve cuánto falta para llegar.
 */
export function GraficoFacturacion({ porMes, total, categoria }: { porMes: Mes[]; total: number; categoria?: string }) {
  const datos = porMes.map((m) => {
    const [a, mm] = m.mes.split('-');
    const i = Number(mm) - 1;
    return { ...m, corto: MESES[i]!, nombre: `${MESES[i]} ${a}` };
  });
  const tope = topeDe(categoria);
  const pct = tope ? Math.min(100, Math.round((total / tope) * 100)) : null;

  return (
    <section className="flex flex-col gap-5 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[20px] font-bold">Tu facturación de los últimos 12 meses</h2>
          <p className="text-base text-texto-suave">
            {categoria ? `Es lo que mira ARCA para tu categoría ${categoria.toUpperCase()} de monotributo.` : 'Es lo que mira ARCA para tu categoría de monotributo.'}
          </p>
        </div>
        <div className="text-right">
          <div className="font-display text-[26px] font-bold leading-none tabular-nums">{pesos(total)}</div>
          <div className="mt-1 text-base text-texto-tenue">en 12 meses</div>
        </div>
      </div>

      <div className="h-[200px] w-full" role="img" aria-label={`Gráfico de barras: facturación mensual de ${datos[0]?.nombre ?? ''} a ${datos.at(-1)?.nombre ?? ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 6, right: 0, bottom: 0, left: 0 }} barCategoryGap="22%">
            <XAxis dataKey="corto" axisLine={false} tickLine={false} tick={{ fill: '#8A90AD', fontSize: 16 }} />
            <YAxis axisLine={false} tickLine={false} width={80} tick={{ fill: '#8A90AD', fontSize: 16 }} tickFormatter={corto} />
            <Tooltip content={<Globo />} cursor={{ fill: 'rgba(59,63,216,0.06)', radius: 10 }} />
            <Bar dataKey="facturado" radius={[8, 8, 8, 8]} animationDuration={700} animationEasing="ease-out">
              {datos.map((d, i) => (
                <Cell key={d.mes} fill={i === datos.length - 1 ? '#3B3FD8' : '#C9CBFA'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {tope && pct !== null && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap justify-between gap-2 text-base">
            <span className="font-semibold">Usaste el {pct}% del tope de tu categoría</span>
            <span className="tabular-nums text-texto-suave">Tope: {pesos(tope)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#ECEFF5]">
            <div className={`h-full rounded-full ${pct >= 80 ? 'bg-[#E5484D]' : 'bg-primario'}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </section>
  );
}
