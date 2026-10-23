'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FactiWordmark } from '@/components/FactiLogo';
import { Icon, type IconName } from '@/components/Icon';
import { verCuenta } from '@/lib/api';
import { formatearCuit } from '@/lib/formato';
import { useApi } from '@/lib/useApi';

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
  const cuenta = useApi(verCuenta, []);

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

      {cuenta.dato && (
        <div className="mt-auto flex flex-col gap-1 rounded-[18px] bg-fondo px-4 py-3.5 text-[13px] text-texto-suave">
          <strong className="text-sm text-texto">{cuenta.dato.cuenta.nombre || 'Tu cuenta'}</strong>
          <span>
            CUIT {formatearCuit(cuenta.dato.cuenta.cuit)} · Punto de venta {String(cuenta.dato.cuenta.puntoVenta).padStart(4, '0')}
          </span>
        </div>
      )}
    </aside>
  );
}
