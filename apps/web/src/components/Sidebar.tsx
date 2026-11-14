'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { usePathname, useRouter } from 'next/navigation';
import { FactiWordmark } from '@/components/FactiLogo';
import { Icon, type IconName } from '@/components/Icon';
import { verCuenta } from '@/lib/api';
import { formatearCuit, nombrePropio } from '@/lib/formato';
import { cerrarSesion, useSesion } from '@/lib/sesion';
import { useApi } from '@/lib/useApi';

interface Item {
  href: string;
  label: string;
  icon: IconName;
}

/** El menú va en dos grupos: el día a día de facturar y lo impositivo. Configuración queda abajo, con la cuenta. */
const GRUPOS: { titulo: string; items: Item[] }[] = [
  {
    titulo: 'Facturación',
    items: [
      { href: '/app', label: 'Inicio', icon: 'inicio' },
      { href: '/app/facturas', label: 'Facturas', icon: 'factura' },
      { href: '/app/clientes', label: 'Clientes', icon: 'clientes' },
      { href: '/app/cobros', label: 'Cobros', icon: 'cobros' },
    ],
  },
  {
    titulo: 'Impuestos',
    items: [{ href: '/app/monotributo/pagos', label: 'Monotributo', icon: 'monotributo' }],
  },
];

/** Activo también en las subpáginas (una factura abierta marca "Facturas"), salvo Inicio. */
function esActivo(pathname: string, href: string) {
  if (href === '/app') return pathname === '/app';
  if (href === '/app/facturas' && pathname === '/app/facturas/nueva') return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ItemMenu({ it, activo }: { it: Item; activo: boolean }) {
  return (
    <Link
      href={it.href}
      aria-current={activo ? 'page' : undefined}
      className={`group relative flex flex-none items-center gap-2 whitespace-nowrap rounded-[14px] px-3 py-2 text-base font-semibold transition-colors duration-150 md:gap-3 md:py-2.5 ${
        activo ? 'text-white' : 'text-texto-suave hover:bg-fondo hover:text-texto'
      }`}
    >
      {/* La píldora índigo del ítem activo es una sola y se desliza de un ítem al otro (Motion, layoutId). */}
      {activo && (
        <motion.span
          layoutId="menu-activo"
          transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
          className="absolute inset-0 rounded-[14px] bg-primario shadow-[0_6px_16px_rgba(59,63,216,0.28)]"
        />
      )}
      <span
        className={`relative hidden h-8 w-8 flex-none items-center justify-center rounded-[10px] transition-colors duration-150 md:flex ${
          activo ? 'bg-white/15' : 'bg-fondo text-texto-suave group-hover:bg-white group-hover:text-primario'
        }`}
      >
        <Icon name={it.icon} size={18} />
      </span>
      <span className="relative">{it.label}</span>
    </Link>
  );
}

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || 'F';
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const cuenta = useApi(verCuenta, []);
  const sesion = useSesion();
  const email = sesion.estado === 'con_sesion' ? sesion.sesion.user.email : undefined;
  const c = cuenta.dato?.cuenta;
  const nombre = c?.nombre ? nombrePropio(c.nombre) : email ? email.split('@')[0] : 'Tu cuenta';
  // En celular el menú se desliza de costado: el ítem activo siempre queda a la vista.
  const menu = useRef<HTMLElement>(null);
  useEffect(() => {
    menu.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [pathname]);

  return (
    // Panel flotante con esquinas redondeadas, separado del borde: el estilo "soft" de Facti.
    <aside className="flex min-w-0 flex-1 basis-full p-3 md:sticky md:top-0 md:h-screen md:w-[272px] md:flex-none">
      {/* En celular es una barra compacta (logo, Emitir y el menú que se desliza de costado); en compu, el panel completo. */}
      <div className="flex w-full min-w-0 flex-col gap-3 rounded-[22px] bg-superficie p-3 shadow-tarjeta md:gap-5 md:rounded-[26px] md:p-4">
        <div className="flex items-center justify-between gap-3 md:flex-col md:items-stretch md:gap-5">
          <Link href="/" className="md:px-2 md:pt-1">
            <FactiWordmark size={32} />
          </Link>

          <Link
            href="/app/facturas/nueva"
            aria-current={pathname === '/app/facturas/nueva' ? 'page' : undefined}
            className="btn-lift flex h-10 items-center justify-center gap-2 rounded-full bg-acento px-4 text-base font-bold text-texto shadow-[0_6px_16px_rgba(224,161,0,0.25)] hover:shadow-[0_10px_22px_rgba(224,161,0,0.32)] md:h-12"
          >
            <Icon name="mas" size={18} strokeWidth={2.4} />
            Emitir factura
          </Link>
        </div>

        <nav ref={menu} aria-label="Menú de la app" className="menu-deslizable -mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 md:mx-0 md:flex-col md:gap-4 md:overflow-visible md:px-0 md:pb-0">
          {GRUPOS.map((g) => (
            <div key={g.titulo} className="contents md:flex md:flex-col md:gap-1">
              <span className="hidden px-3 pb-1 text-base font-semibold text-texto-tenue md:block">{g.titulo}</span>
              {g.items.map((it) => (
                <ItemMenu key={it.href} it={it} activo={esActivo(pathname, it.href)} />
              ))}
            </div>
          ))}
          <span className="contents md:hidden">
            <ItemMenu it={{ href: '/app/configuracion', label: 'Configuración', icon: 'config' }} activo={esActivo(pathname, '/app/configuracion')} />
          </span>
        </nav>

        <div className="mt-auto hidden flex-col gap-1 md:flex">
          <ItemMenu it={{ href: '/app/configuracion', label: 'Configuración', icon: 'config' }} activo={esActivo(pathname, '/app/configuracion')} />

          {/* Cuenta: quién sos arriba; abajo el CUIT y el botón para salir. */}
          <div className="mt-2 flex flex-col gap-2.5 rounded-[20px] bg-fondo p-3">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="flex h-10 w-10 flex-none items-center justify-center rounded-[14px] bg-facti font-display text-base font-bold text-white">
                {iniciales(nombre)}
              </span>
              <span className="line-clamp-2 min-w-0 flex-1 break-words font-bold leading-tight text-texto" title={c?.nombre ? nombre : email}>
                {nombre}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-[#E3E7F0] pt-2.5">
              {c?.cuit ? (
                <span className="whitespace-nowrap tabular-nums text-texto-suave">{formatearCuit(c.cuit)}</span>
              ) : (
                cuenta.dato && <Link href="/onboarding/perfil" className="font-semibold text-primario-oscuro">Cargar mi CUIT</Link>
              )}
              <button
                type="button"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                onClick={async () => {
                  await cerrarSesion();
                  router.replace('/ingresar');
                }}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-texto-tenue transition-colors hover:bg-error-suave hover:text-error focus-visible:outline-2 focus-visible:outline-primario"
              >
                <Icon name="salir" size={19} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
