'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PLAN_DEMO } from '@/lib/plan-demo';

export const AGOTADO_FACTURAS = PLAN_DEMO.facturas.usadas >= PLAN_DEMO.facturas.limite;
export const AGOTADO_EXPO = PLAN_DEMO.exportacion.usadas >= PLAN_DEMO.exportacion.limite;
export const HAY_AGOTADO = AGOTADO_FACTURAS || AGOTADO_EXPO;

export function Uso({ label, usadas, limite }: { label: string; usadas: number; limite: number }) {
  const pct = Math.min(100, Math.round((usadas / limite) * 100));
  const restante = Math.max(0, limite - usadas);
  const agotado = restante === 0;
  const bajo = restante <= Math.ceil(limite * 0.2);
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
          {agotado ? (limite === 1 ? 'Se te acabó' : 'Se te acabaron') : `Te ${restante === 1 ? 'queda' : 'quedan'} ${restante}`}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#ECEFF5]">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${bajo ? 'bg-[#E5484D]' : 'bg-primario'}`}
          style={{ width: `${w}%` }}
        />
      </div>
      <span className="text-xs text-texto-tenue">{usadas} de {limite} este mes</span>
    </div>
  );
}

export function AlertaAgotado() {
  const faltan: string[] = [];
  if (AGOTADO_FACTURAS) faltan.push('facturas A, B y C');
  if (AGOTADO_EXPO) faltan.push('Factura E');
  const texto = faltan.join(' y ');
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-[#FDECEC] px-4 py-3 ring-1 ring-inset ring-[#F6CBCD]">
      <div className="flex items-center gap-2 font-bold text-[#B4232B]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none"><path d="M12 8v5M12 16.5v.5" /><circle cx="12" cy="12" r="9" /></svg>
        Se te {faltan.length > 1 || AGOTADO_FACTURAS ? 'acabaron' : 'acabó'} tu cupo de {texto} este mes.
      </div>
      <Link href="/app/plan" className="btn-lift rounded-full bg-primario px-4 py-2 text-sm font-extrabold text-white shadow-boton">Mejorar plan</Link>
    </div>
  );
}

export function UsoPlan() {
  return (
    <div className="flex flex-col gap-4 rounded-tarjeta bg-superficie p-[22px] shadow-tarjeta">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-bold">Tu plan</h2>
        <span className="rounded-full bg-primario-suave px-2.5 py-1 text-[12px] font-extrabold text-primario-oscuro">{PLAN_DEMO.plan}</span>
      </div>
      <Uso label="Facturas A, B y C" usadas={PLAN_DEMO.facturas.usadas} limite={PLAN_DEMO.facturas.limite} />
      <Uso label="Factura E" usadas={PLAN_DEMO.exportacion.usadas} limite={PLAN_DEMO.exportacion.limite} />
      {HAY_AGOTADO && (
        <p className="text-sm font-bold text-[#B4232B]">Se te acabó un cupo este mes. Pasá a Pro para seguir facturando.</p>
      )}
      <Link href="/app/plan" className="btn-lift flex h-11 items-center justify-center gap-2 rounded-full bg-primario font-extrabold text-white shadow-boton">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" /></svg>
        {HAY_AGOTADO ? 'Mejorar plan' : 'Pasar a Pro'}
      </Link>
    </div>
  );
}

/** Sección de consumo para la página del plan (más ancha). */
export function ConsumoPlan() {
  return (
    <div className="flex flex-col gap-4 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
      <h2 className="text-[18px] font-bold">
        Tu plan <span className="text-primario-oscuro">{PLAN_DEMO.plan}</span> · lo que consumiste este mes
      </h2>
      {HAY_AGOTADO && <AlertaAgotado />}
      <div className="grid gap-6 sm:grid-cols-2">
        <Uso label="Facturas A, B y C" usadas={PLAN_DEMO.facturas.usadas} limite={PLAN_DEMO.facturas.limite} />
        <Uso label="Factura E" usadas={PLAN_DEMO.exportacion.usadas} limite={PLAN_DEMO.exportacion.limite} />
      </div>
    </div>
  );
}
