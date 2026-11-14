'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Girando } from '@/components/Animado';
import { Icon, type IconName } from '@/components/Icon';

type Tono = 'exito' | 'primario' | 'peligro';

const TONOS: Record<Tono, { icono: string; boton: string }> = {
  exito: { icono: 'bg-exito-suave text-exito-texto', boton: 'bg-exito text-white shadow-[0_6px_16px_rgba(30,158,99,0.28)]' },
  primario: { icono: 'bg-primario-suave text-primario-oscuro', boton: 'bg-primario text-white shadow-boton' },
  peligro: { icono: 'bg-error-suave text-error', boton: 'bg-[#E5484D] text-white shadow-[0_6px_16px_rgba(229,72,77,0.28)]' },
};

export interface ConfirmarProps {
  abierto: boolean;
  titulo: string;
  children?: ReactNode;
  icono?: IconName;
  tono?: Tono;
  textoConfirmar: string;
  textoCancelar?: string;
  /** Mientras se guarda: el botón muestra la ruedita y no se puede cerrar. */
  cargando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

/**
 * Modal de confirmación de Facti. Usa el <dialog> nativo (atrapa el foco, Esc cierra y el resto de
 * la página queda inerte) y Motion para entrar y salir suave. El foco arranca en "Cancelar", para que
 * un Enter apurado no confirme sin querer.
 */
export function Confirmar(props: ConfirmarProps) {
  return <AnimatePresence>{props.abierto && <Dialogo key="confirmar" {...props} />}</AnimatePresence>;
}

function Dialogo({ titulo, children, icono = 'check-circulo', tono = 'primario', textoConfirmar, textoCancelar = 'Cancelar', cargando = false, onConfirmar, onCancelar }: ConfirmarProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    cancelar.current?.focus();
    return () => {
      if (d.open) d.close();
    };
  }, []);

  const t = TONOS[tono];
  return (
    <motion.dialog
      ref={ref}
      aria-labelledby="confirmar-titulo"
      onCancel={(e) => {
        e.preventDefault();
        if (!cargando) onCancelar();
      }}
      // Un clic afuera de la tarjeta (en el fondo oscuro) cierra.
      onClick={(e) => {
        if (e.target === e.currentTarget && !cargando) onCancelar();
      }}
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: 4 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className="confirmar m-auto w-[min(440px,calc(100%-32px))] rounded-[26px] bg-superficie p-0 text-texto shadow-tarjeta-lg"
    >
      <div className="flex flex-col gap-5 p-6 sm:p-7">
        <div className="flex items-start gap-4">
          <span className={`flex h-12 w-12 flex-none items-center justify-center rounded-[16px] ${t.icono}`}>
            <Icon name={icono} size={26} />
          </span>
          <div className="flex min-w-0 flex-col gap-1 pt-0.5">
            <h2 id="confirmar-titulo" className="text-[20px] font-bold leading-tight">{titulo}</h2>
          </div>
        </div>
        {children}
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button
            ref={cancelar}
            type="button"
            disabled={cargando}
            onClick={onCancelar}
            className="btn-lift inline-flex h-11 items-center justify-center rounded-full border-[1.5px] border-borde bg-white px-5 text-base font-bold text-texto hover:border-primario hover:text-primario-oscuro disabled:opacity-60"
          >
            {textoCancelar}
          </button>
          <button
            type="button"
            disabled={cargando}
            onClick={onConfirmar}
            className={`btn-lift inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-base font-bold disabled:cursor-wait disabled:opacity-80 ${t.boton}`}
          >
            {cargando ? (<><Girando size={16} />Guardando…</>) : textoConfirmar}
          </button>
        </div>
      </div>
    </motion.dialog>
  );
}
