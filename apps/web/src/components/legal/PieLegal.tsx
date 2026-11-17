import Link from 'next/link';
import { LEGAL } from '@/lib/legal';

/**
 * Links legales que tienen que estar a la vista desde el primer acceso: Términos, Privacidad, el
 * "Botón de arrepentimiento" y el "Botón de baja de servicio" (Disposición 954/2025) y el formulario
 * de denuncias de Defensa del Consumidor.
 */
export function PieLegal({ className = '' }: { className?: string }) {
  const link = 'font-semibold text-texto-suave underline-offset-4 hover:text-primario-oscuro hover:underline';
  return (
    <nav aria-label="Información legal" className={`flex flex-col gap-4 ${className}`}>
      <div className="flex flex-wrap gap-3">
        <Link href="/arrepentimiento" className="btn-lift inline-flex h-11 items-center rounded-full border-[1.5px] border-borde bg-white px-5 font-bold text-texto hover:border-primario hover:text-primario-oscuro">
          Botón de arrepentimiento
        </Link>
        <Link href="/baja" className="btn-lift inline-flex h-11 items-center rounded-full border-[1.5px] border-borde bg-white px-5 font-bold text-texto hover:border-primario hover:text-primario-oscuro">
          Botón de baja de servicio
        </Link>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Link href="/legal/terminos" className={link}>Términos y Condiciones</Link>
        <Link href="/legal/privacidad" className={link}>Política de Privacidad</Link>
        <a href={LEGAL.defensaConsumidor} target="_blank" rel="noopener noreferrer" className={link}>
          Defensa del Consumidor: formulario de denuncia
        </a>
      </div>
    </nav>
  );
}
