'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FactiWordmark } from '@/components/FactiLogo';
import { Icon, type IconName } from '@/components/Icon';

interface Item {
  href: string;
  label: string;
  icon: IconName;
}

const ITEMS: Item[] = [
  { href: '/app', label: 'Inicio', icon: 'inicio' },
  { href: '/app/facturas', label: 'Facturas', icon: 'factura' },
  { href: '/app/clientes', label: 'Clientes', icon: 'clientes' },
  { href: '/app/cobros', label: 'Cobros', icon: 'cobros' },
  { href: '/app/monotributo/pagos', label: 'Monotributo', icon: 'monotributo' },
  { href: '/app/configuracion', label: 'Configuración', icon: 'config' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex max-w-[280px] flex-1 basis-[240px] flex-col gap-[22px] border-r border-[#E6EAF2] bg-superficie px-[18px] py-6">
      <Link href="/" className="px-1.5">
        <FactiWordmark size={34} />
      </Link>

      <Link
        href="/app/facturas/nueva"
        className="btn-lift flex items-center justify-center gap-2 rounded-full bg-primario px-4 py-3.5 font-extrabold text-white shadow-[0_8px_20px_rgba(59,63,216,0.25)] hover:shadow-[0_12px_28px_rgba(59,63,216,0.38)]"
      >
        <Icon name="mas" />
        Emitir factura
      </Link>

      <nav aria-label="Menú de la app" className="flex flex-col gap-1">
        {ITEMS.map((it) => {
          const activo = pathname === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={activo ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-input px-3.5 py-3 text-[15px] font-bold transition-colors ${
                activo ? 'bg-primario-suave text-primario-oscuro' : 'text-texto-suave hover:bg-fondo hover:text-texto'
              }`}
            >
              <Icon name={it.icon} />
              {it.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 rounded-[18px] bg-exito-suave px-4 py-3.5 text-[13px] text-exito-texto">
        <strong className="flex items-center gap-2 text-sm">
          <span className="h-[9px] w-[9px] rounded-full bg-exito" />Conectado a ARCA
        </strong>
        <span>CUIT 27-31456789-4 · Punto de venta 0003</span>
      </div>
    </aside>
  );
}
