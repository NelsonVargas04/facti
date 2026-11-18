'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
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

const INICIO: Item = { href: '/app', label: 'Inicio', icon: 'inicio' };
const FACTURAS: Item = { href: '/app/facturas', label: 'Facturas', icon: 'factura' };
const CLIENTES: Item = { href: '/app/clientes', label: 'Clientes', icon: 'clientes' };
const COBROS: Item = { href: '/app/cobros', label: 'Cobros', icon: 'cobros' };
const MONOTRIBUTO: Item = { href: '/app/monotributo/pagos', label: 'Monotributo', icon: 'monotributo' };
const CALENDARIO: Item = { href: '/app/calendario', label: 'Calendario', icon: 'calendario' };
const PLAN: Item = { href: '/app/cuenta', label: 'Plan y pagos', icon: 'tarjeta' };
const CONFIGURACION: Item = { href: '/app/configuracion', label: 'Configuración', icon: 'config' };

/** En la compu el menú va en dos grupos: el día a día de facturar y lo impositivo. Configuración queda abajo. */
const GRUPOS: { titulo: string; items: Item[] }[] = [
  { titulo: 'Facturación', items: [INICIO, FACTURAS, CLIENTES, COBROS] },
  { titulo: 'Impuestos', items: [MONOTRIBUTO, CALENDARIO] },
];

/** En el celular: barra de abajo con lo más usado; el resto, en "Más". */
const BARRA: Item[] = [INICIO, FACTURAS, COBROS];
const MAS: Item[] = [CLIENTES, MONOTRIBUTO, CALENDARIO, PLAN, CONFIGURACION];

/** Activo también en las subpáginas (una factura abierta marca "Facturas"), salvo Inicio. */
function esActivo(pathname: string, href: string) {
  if (href === '/app') return pathname === '/app';
  if (href === '/app/facturas' && pathname === '/app/facturas/nueva') return false;
  // Monotributo agrupa varias páginas (pagos, categorías).
  if (href.startsWith('/app/monotributo')) return pathname.startsWith('/app/monotributo');
  return pathname === href || pathname.startsWith(`${href}/`);
}

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || 'F';
}

/** Ítem del menú de la compu: ícono simple y texto; el activo lleva la píldora índigo. */
function ItemMenu({ it, activo, onIr }: { it: Item; activo: boolean; onIr: (href: string) => void }) {
  return (
    <Link
      href={it.href}
      onClick={() => onIr(it.href)}
      aria-current={activo ? 'page' : undefined}
      className={`group relative flex items-center gap-3 rounded-[14px] px-3.5 py-2.5 font-semibold transition-colors duration-150 ${
        activo ? 'text-white' : 'text-texto-suave hover:bg-fondo hover:text-texto'
      }`}
    >
      {/* La píldora del ítem activo es una sola y se desliza de un ítem al otro (Motion, layoutId). */}
      {activo && (
        <motion.span
          layoutId="menu-activo"
          transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
          className="absolute inset-0 rounded-[14px] bg-primario shadow-[0_6px_16px_rgba(59,63,216,0.28)]"
        />
      )}
      <Icon name={it.icon} size={22} weight={activo ? 'fill' : 'regular'} className="relative flex-none" />
      <span className="relative">{it.label}</span>
    </Link>
  );
}

function BotonEmitir({ grande = false, activo }: { grande?: boolean; activo: boolean }) {
  return (
    <Link
      href="/app/facturas/nueva"
      aria-current={activo ? 'page' : undefined}
      className={`btn-lift flex items-center justify-center gap-2 rounded-full bg-acento px-4 font-bold text-texto shadow-[0_6px_16px_rgba(224,161,0,0.25)] hover:shadow-[0_10px_22px_rgba(224,161,0,0.32)] ${grande ? 'h-12' : 'h-11'}`}
    >
      <Icon name="mas" size={18} strokeWidth={2.4} />
      Emitir factura
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const cuenta = useApi(verCuenta, []);
  const sesion = useSesion();
  const email = sesion.estado === 'con_sesion' ? sesion.sesion.user.email : undefined;
  const c = cuenta.dato?.cuenta;
  const nombre = c?.nombre ? nombrePropio(c.nombre) : email ? email.split('@')[0] : 'Tu cuenta';

  // Al tocar un ítem, el menú marca el destino en el acto, sin esperar a que cargue la página.
  const [destino, setDestino] = useState<string | null>(null);
  const [masAbierto, setMasAbierto] = useState(false);
  useEffect(() => {
    setDestino(null);
    setMasAbierto(false);
  }, [pathname]);
  // Si la página no llega a cambiar (por ejemplo, sin conexión), el menú vuelve a marcar dónde estás.
  useEffect(() => {
    if (!destino) return;
    const t = setTimeout(() => setDestino(null), 4000);
    return () => clearTimeout(t);
  }, [destino]);
  const actual = destino ?? pathname;
  const enMas = MAS.some((it) => esActivo(actual, it.href));
  const emitiendo = pathname === '/app/facturas/nueva';

  useEffect(() => {
    if (!masAbierto) return;
    const cerrar = (e: KeyboardEvent) => e.key === 'Escape' && setMasAbierto(false);
    window.addEventListener('keydown', cerrar);
    return () => window.removeEventListener('keydown', cerrar);
  }, [masAbierto]);

  async function salir() {
    await cerrarSesion();
    router.replace('/ingresar');
  }

  const cuentaTarjeta = (
    <div className="flex flex-col gap-2.5 rounded-[20px] bg-fondo p-3">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex h-10 w-10 flex-none items-center justify-center rounded-[14px] bg-facti font-display font-bold text-white">
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
          onClick={salir}
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white text-texto-suave ring-1 ring-inset ring-[#E3E7F0] transition-colors hover:bg-error-suave hover:text-error hover:ring-transparent focus-visible:outline-2 focus-visible:outline-primario"
        >
          <Icon name="salir" size={18} weight="bold" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ---------- Compu: panel flotante a la izquierda ---------- */}
      <aside className="sticky top-0 hidden h-screen w-[272px] flex-none p-3 md:flex">
        <div className="flex w-full flex-col gap-5 rounded-[26px] bg-superficie p-4 shadow-tarjeta">
          <Link href="/" className="px-2 pt-1">
            <FactiWordmark size={32} />
          </Link>
          <BotonEmitir grande activo={emitiendo} />

          <nav aria-label="Menú de la app" className="flex flex-col gap-4">
            {GRUPOS.map((g) => (
              <div key={g.titulo} className="flex flex-col gap-1">
                <span className="px-3.5 pb-1 font-semibold text-texto-tenue">{g.titulo}</span>
                {g.items.map((it) => (
                  <ItemMenu key={it.href} it={it} activo={esActivo(actual, it.href)} onIr={setDestino} />
                ))}
              </div>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <ItemMenu it={PLAN} activo={esActivo(actual, PLAN.href)} onIr={setDestino} />
              <ItemMenu it={CONFIGURACION} activo={esActivo(actual, CONFIGURACION.href)} onIr={setDestino} />
            </div>
            {cuentaTarjeta}
          </div>
        </div>
      </aside>

      {/* ---------- Celular: barra de arriba (logo y Emitir) ---------- */}
      <header className="sticky top-0 z-30 mb-2 flex h-16 items-center justify-between gap-3 border-b border-[#E3E7F0] bg-superficie/95 px-4 shadow-[0_4px_16px_rgba(21,25,58,0.05)] backdrop-blur-md md:hidden">
        <Link href="/app" aria-label="Facti, ir al inicio">
          <FactiWordmark size={30} />
        </Link>
        {!emitiendo && <BotonEmitir activo={false} />}
      </header>

      {/* ---------- Celular: barra de abajo, flotante ---------- */}
      <nav
        aria-label="Menú de la app"
        className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-40 grid grid-cols-4 rounded-[26px] bg-superficie/95 p-1.5 shadow-[0_12px_32px_rgba(21,25,58,0.16)] ring-1 ring-[#E8EBF2] backdrop-blur-md md:hidden"
      >
        {[...BARRA.map((it) => ({ ...it, on: esActivo(actual, it.href) })), { href: '#mas', label: 'Más', icon: 'menu' as IconName, on: enMas || masAbierto }].map((it) => {
          const contenido = (
            <>
              {/* La píldora del activo es una sola y se desliza de un ítem al otro. */}
              {it.on && (
                <motion.span
                  layoutId="barra-activa"
                  transition={{ type: 'spring', duration: 0.45, bounce: 0.2 }}
                  className="absolute inset-0 rounded-[20px] bg-primario-suave"
                />
              )}
              <motion.span
                className="relative"
                animate={it.on ? { y: [0, -3, 0] } : { y: 0 }}
                transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
              >
                <Icon name={it.icon} size={24} weight={it.on ? 'fill' : 'regular'} />
              </motion.span>
              <span className="relative">{it.label}</span>
            </>
          );
          const clase = `relative flex flex-col items-center gap-0.5 rounded-[20px] py-2 font-semibold transition-colors ${it.on ? 'text-primario-oscuro' : 'text-texto-tenue'}`;
          return it.href === '#mas' ? (
            <motion.button
              key={it.href}
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => setMasAbierto(true)}
              aria-expanded={masAbierto}
              aria-haspopup="dialog"
              className={clase}
            >
              {contenido}
            </motion.button>
          ) : (
            <motion.div key={it.href} whileTap={{ scale: 0.92 }} className="flex">
              <Link href={it.href} onClick={() => setDestino(it.href)} aria-current={it.on ? 'page' : undefined} className={`${clase} flex-1`}>
                {contenido}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* ---------- Celular: panel "Más" ---------- */}
      <AnimatePresence>
        {masAbierto && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Más opciones">
            <motion.button
              type="button"
              aria-label="Cerrar"
              onClick={() => setMasAbierto(false)}
              className="absolute inset-0 bg-[#15193A]/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
            <motion.div
              className="absolute inset-x-0 bottom-0 flex touch-none flex-col gap-3 rounded-t-[28px] bg-superficie px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 shadow-tarjeta"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', duration: 0.4, bounce: 0.1 }}
              // Se cierra arrastrándolo hacia abajo (más de 90 px o un gesto rápido); hacia arriba casi no se mueve.
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.05, bottom: 0.9 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 90 || info.velocity.y > 500) setMasAbierto(false);
              }}
            >
              <span aria-hidden="true" className="mx-auto h-1.5 w-12 cursor-grab rounded-full bg-[#DCE1EC] active:cursor-grabbing" />
              <ul className="flex flex-col">
                {MAS.map((it, i) => {
                  const on = esActivo(actual, it.href);
                  return (
                    <motion.li
                      key={it.href}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.06 + i * 0.04, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                    >
                      <Link
                        href={it.href}
                        onClick={() => setDestino(it.href)}
                        aria-current={on ? 'page' : undefined}
                        className={`flex items-center gap-3 rounded-[14px] px-3 py-3.5 font-semibold ${on ? 'bg-primario-suave text-primario-oscuro' : 'text-texto hover:bg-fondo'}`}
                      >
                        <Icon name={it.icon} size={22} weight={on ? 'fill' : 'regular'} />
                        <span className="flex-1">{it.label}</span>
                        <Icon name="chevron-derecha" size={18} className="text-texto-tenue" />
                      </Link>
                    </motion.li>
                  );
                })}
              </ul>
              {cuentaTarjeta}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
