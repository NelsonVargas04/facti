import Link from 'next/link';
import { Icon } from '@/components/Icon';

/**
 * Link "volver" reutilizable, con ícono de flecha que se corre al hover.
 * Reemplaza los "← Volver" sueltos de cada pantalla.
 */
export function BackLink({ href, children = 'Volver' }: { href: string; children?: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 rounded-full py-1 pr-3 text-sm font-bold text-primario-oscuro transition-colors hover:text-texto"
    >
      <Icon name="volver" size={18} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
      {children}
    </Link>
  );
}
