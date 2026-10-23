'use client';

import Link from 'next/link';
import { verCuenta } from '@/lib/api';
import { formatearCuit } from '@/lib/formato';
import { useApi } from '@/lib/useApi';

const CONDICION: Record<string, string> = { monotributo: 'Monotributo', responsable_inscripto: 'Responsable inscripto', exento: 'Exento' };

/** Tarjeta "Tu perfil" del onboarding, con lo que el usuario cargó en el paso 1. */
export function ResumenPerfil() {
  const cuenta = useApi(verCuenta, []);
  const c = cuenta.dato?.cuenta;
  if (!c) return <div className="skeleton h-[110px] rounded-tarjeta" />;
  if (!c.cuit) {
    return (
      <div className="flex flex-col gap-2 rounded-tarjeta bg-superficie p-7 shadow-tarjeta">
        <strong>Todavía no cargaste tu CUIT</strong>
        <Link href="/onboarding/perfil" className="text-[15px] font-extrabold text-primario-oscuro">Cargarlo ahora</Link>
      </div>
    );
  }
  const condicion = [CONDICION[c.condicion] ?? '', c.categoria && `categoría ${c.categoria}`].filter(Boolean).join(', ');
  return (
    <div className="flex flex-col gap-2.5 rounded-tarjeta bg-superficie p-7 shadow-tarjeta">
      <div className="flex items-center gap-2 text-sm font-extrabold text-exito-texto">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E9E63" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        Tu perfil
      </div>
      <strong>{[c.nombre, `CUIT ${formatearCuit(c.cuit)}`].filter(Boolean).join(' · ')}</strong>
      {condicion && <span className="text-[15px] text-texto-suave">{condicion}</span>}
    </div>
  );
}
