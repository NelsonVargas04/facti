'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Plan } from '@/lib/api';

const NOMBRE_PLAN = { gratis: 'Gratis', pro: 'Pro' } as const;

/** Qué cupos del mes se terminaron (en Pro nunca). */
export function agotados(plan: Plan) {
  const l = plan.limites;
  const facturas = !!l && plan.uso.facturas >= l.facturas;
  const expo = !!l && plan.uso.exportacion >= l.exportacion;
  return { facturas, expo, alguno: facturas || expo };
}

export function Uso({ label, usadas, limite }: { label: string; usadas: number; limite: number | null }) {
  const ilimitado = limite === null;
  const pct = ilimitado ? 0 : Math.min(100, Math.round((usadas / Math.max(limite, 1)) * 100));
  const restante = ilimitado ? Infinity : Math.max(0, limite - usadas);
  const agotado = restante === 0;
  const bajo = !ilimitado && restante <= Math.ceil(limite * 0.2);
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(pct), 80);
    return () => clearTimeout(t);
  }, [pct]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-bold">{label}</span>
        <span className={`font-extrabold ${bajo ? 'text-[#B4232B]' : 'text-texto-suave'}`}>
          {ilimitado
            ? 'Ilimitadas'
            : agotado
              ? limite === 1
                ? 'Se te acabó'
                : 'Se te acabaron'
              : `Te ${restante === 1 ? 'queda' : 'quedan'} ${restante}`}
        </span>
      </div>
      {!ilimitado && (
        <div className="h-2.5 overflow-hidden rounded-full bg-[#ECEFF5]">
          <div className={`h-full rounded-full transition-[width] duration-700 ease-out ${bajo ? 'bg-[#E5484D]' : 'bg-primario'}`} style={{ width: `${w}%` }} />
        </div>
      )}
      <span className="text-xs text-texto-tenue">
        {usadas} {ilimitado ? 'emitidas' : `de ${limite}`} este mes
      </span>
    </div>
  );
}

export function AlertaAgotado({ plan }: { plan: Plan }) {
  const a = agotados(plan);
  if (!a.alguno) return null;
  const faltan: string[] = [];
  if (a.facturas) faltan.push('facturas A, B y C');
  if (a.expo) faltan.push('Factura E');
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-[#FDECEC] px-4 py-3 ring-1 ring-inset ring-[#F6CBCD]">
      <div className="flex items-center gap-2 font-bold text-[#B4232B]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none"><path d="M12 8v5M12 16.5v.5" /><circle cx="12" cy="12" r="9" /></svg>
        Se te {faltan.length > 1 || a.facturas ? 'acabaron' : 'acabó'} tu cupo de {faltan.join(' y ')} este mes.
      </div>
      <Link href="/app/plan" className="btn-lift rounded-full bg-primario px-4 py-2 text-sm font-extrabold text-white shadow-boton">Mejorar plan</Link>
    </div>
  );
}

export function UsoPlan({ plan }: { plan: Plan }) {
  const a = agotados(plan);
  const esPro = plan.nombre === 'pro';
  return (
    <div className="flex flex-col gap-4 rounded-tarjeta bg-superficie p-[22px] shadow-tarjeta">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-bold">Tu plan</h2>
        <span className="rounded-full bg-primario-suave px-2.5 py-1 text-[12px] font-extrabold text-primario-oscuro">{NOMBRE_PLAN[plan.nombre]}</span>
      </div>
      <Uso label="Facturas A, B y C" usadas={plan.uso.facturas} limite={plan.limites?.facturas ?? null} />
      <Uso label="Factura E" usadas={plan.uso.exportacion} limite={plan.limites?.exportacion ?? null} />
      {a.alguno && <p className="text-sm font-bold text-[#B4232B]">Se te acabó un cupo este mes. Pasá a Pro para seguir facturando.</p>}
      {!esPro && (
        <Link href="/app/plan" className="btn-lift flex h-11 items-center justify-center gap-2 rounded-full bg-primario font-extrabold text-white shadow-boton">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" /></svg>
          {a.alguno ? 'Mejorar plan' : 'Pasar a Pro'}
        </Link>
      )}
    </div>
  );
}

/** Sección de consumo para la página del plan (más ancha). */
export function ConsumoPlan({ plan }: { plan: Plan }) {
  return (
    <div className="flex flex-col gap-4 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
      <h2 className="text-[18px] font-bold">
        Tu plan <span className="text-primario-oscuro">{NOMBRE_PLAN[plan.nombre]}</span> · lo que consumiste este mes
      </h2>
      <AlertaAgotado plan={plan} />
      <div className="grid gap-6 sm:grid-cols-2">
        <Uso label="Facturas A, B y C" usadas={plan.uso.facturas} limite={plan.limites?.facturas ?? null} />
        <Uso label="Factura E" usadas={plan.uso.exportacion} limite={plan.limites?.exportacion ?? null} />
      </div>
    </div>
  );
}
