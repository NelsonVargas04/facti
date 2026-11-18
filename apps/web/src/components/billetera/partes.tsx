'use client';

import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Facti } from '@/components/Facti';
import { Icon, type IconName } from '@/components/Icon';

/** Piezas de la pantalla "Plan y pagos" (vista previa y Mercado Pago real usan las mismas). */

export const SALIDA = [0.23, 1, 0.32, 1] as const;

/** Panel que se abre dentro de la tarjeta (sin ventanas encima). */
export function Desplegable({ abierto, children }: { abierto: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {abierto && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.28, ease: SALIDA }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Tarjeta({ titulo, icono, accion, children }: { titulo: string; icono: IconName; accion?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex h-full flex-col gap-5 rounded-tarjeta bg-superficie p-5 shadow-tarjeta sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 text-[20px] font-bold">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[13px] bg-primario-suave text-primario-oscuro">
            <Icon name={icono} size={22} />
          </span>
          {titulo}
        </h2>
        {accion}
      </div>
      {children}
    </section>
  );
}

export const botonBorde =
  'btn-lift inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-borde bg-white px-5 font-bold text-texto hover:border-primario hover:text-primario-oscuro';
export const botonPrimario = 'btn-lift inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-primario px-5 font-bold text-white shadow-boton disabled:opacity-60';

export function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
      <dt className="text-texto-tenue">{k}</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  );
}

export function Estado({ aprobado }: { aprobado: boolean }) {
  return aprobado ? (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#EAF8F0] px-2.5 py-1 font-semibold text-[#0E5C38] ring-1 ring-inset ring-[#C8EDD8]">
      <span className="h-[7px] w-[7px] rounded-full bg-[#1E9E63]" />
      Aprobado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-error-suave px-2.5 py-1 font-semibold text-error">Rechazado</span>
  );
}

/** Lo que incluye Pro, con Facti festejando: llena la tarjeta del plan cuando ya sos Pro. */
export function IncluyePro({ animado = true }: { animado?: boolean }) {
  return (
    <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-3 rounded-[18px] bg-fondo p-4 sm:p-5">
      <span className="flex-none">
        <Facti pose="festejo" size={120} animated={animado} />
      </span>
      <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-2">
        <strong>Con Pro tenés</strong>
        <ul className="flex flex-col gap-1.5">
          {['Facturas A, B, C y E sin límite', 'Recordatorios de cobro', 'Registro de cobros', 'Soporte prioritario'].map((t) => (
            <li key={t} className="flex items-center gap-2 text-texto-suave">
              <Icon name="check" size={18} strokeWidth={3} className="flex-none text-exito" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
