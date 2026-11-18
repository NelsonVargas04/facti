'use client';

import { useEffect, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { PaymentIcon } from 'react-svg-credit-card-payment-icons';
import { siAmericanexpress, siMercadopago, siVisa, type SimpleIcon } from 'simple-icons';
import { Icon } from '@/components/Icon';
import type { Medio } from '@/lib/billetera';

/**
 * Billetera en carrusel, como Google Wallet o la app de Mercado Pago: una tarjeta grande por vez,
 * las de los costados asomando, flechas, deslizar y puntitos. Debajo, el nombre y las acciones.
 * Logos oficiales de librerías: simple-icons (CC0) y react-svg-credit-card-payment-icons (MIT).
 */

const RESORTE = { type: 'spring', duration: 0.45, bounce: 0.12 } as const;

/** Color de cada marca, como sus tarjetas físicas. */
const ESTILO: Record<string, { fondo: string; texto?: string }> = {
  Visa: { fondo: 'linear-gradient(135deg, #1A1F71 0%, #2A3BA8 55%, #3D5BD9 100%)' },
  'Visa Débito': { fondo: 'linear-gradient(135deg, #1A1F71 0%, #2A3BA8 55%, #3D5BD9 100%)' },
  Mastercard: { fondo: 'linear-gradient(135deg, #111214 0%, #2B2D33 60%, #45474F 100%)' },
  'Mastercard Débito': { fondo: 'linear-gradient(135deg, #111214 0%, #2B2D33 60%, #45474F 100%)' },
  'American Express': { fondo: 'linear-gradient(135deg, #1B4E8C 0%, #2E77BC 60%, #5AA2E0 100%)' },
  Naranja: { fondo: 'linear-gradient(135deg, #E85A00 0%, #FF6F0F 55%, #FF9445 100%)' },
  Cabal: { fondo: 'linear-gradient(135deg, #0B4F6C 0%, #127A9E 100%)' },
  mercadopago: { fondo: 'linear-gradient(135deg, #0A6FB5 0%, #009EE3 60%, #33C3F0 100%)' },
};
const GENERICO = { fondo: 'linear-gradient(135deg, #4A5072 0%, #6B7194 100%)' };

function Svg({ icono, alto, color = '#FFFFFF' }: { icono: SimpleIcon; alto: number; color?: string }) {
  return (
    <svg role="img" aria-label={icono.title} viewBox="0 0 24 24" height={alto} width={alto} fill={color}>
      <path d={icono.path} />
    </svg>
  );
}

/** Logo de la red abajo a la derecha, en blanco (Mastercard con sus círculos de color). */
function LogoRed({ medio }: { medio: Medio }) {
  if (medio.tipo === 'mercadopago') return <Svg icono={siMercadopago} alto={34} />;
  if (medio.marca.startsWith('Visa')) return <Svg icono={siVisa} alto={46} />;
  if (medio.marca.startsWith('Mastercard')) return <PaymentIcon type="Mastercard" format="logo" width={58} aria-hidden="true" />;
  if (medio.marca === 'American Express') return <Svg icono={siAmericanexpress} alto={40} />;
  return <span className="font-display text-[18px] font-extrabold tracking-tight">{medio.marca}</span>;
}

/** Una tarjeta, con el estilo limpio de las billeteras del celular. */
export function TarjetaWallet({ medio, titular }: { medio: Medio; titular?: string }) {
  const est = ESTILO[medio.tipo === 'mercadopago' ? 'mercadopago' : medio.marca] ?? GENERICO;
  return (
    <div
      style={{ background: est.fondo }}
      className="relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-[16px] p-5 text-white shadow-[0_12px_28px_rgba(21,25,58,0.22),inset_0_1px_0_rgba(255,255,255,0.18)]"
    >
      {/* Brillo suave, como el plástico */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_0%,rgba(255,255,255,0.22),transparent_55%)]" />
      <div className="relative flex h-[22px] items-center justify-between">
        <span className="truncate font-bold tracking-tight">{medio.tipo === 'mercadopago' ? 'Mercado Pago' : medio.marca}</span>
        {medio.tipo === 'tarjeta' && <span className="flex-none font-semibold tabular-nums text-white/85">•••• {medio.ultimos}</span>}
      </div>
      <div className="relative flex items-end justify-between gap-3">
        <div className="flex flex-col">
          <span className="max-w-[200px] truncate font-semibold uppercase tracking-wide">{medio.tipo === 'tarjeta' ? (titular ?? '') : 'Cuenta conectada'}</span>
          <span className="tabular-nums text-white/75">{medio.tipo === 'tarjeta' ? `Vence ${medio.vence}` : 'Débito automático'}</span>
        </div>
        <LogoRed medio={medio} />
      </div>
    </div>
  );
}

const nombre = (m: Medio) => (m.tipo === 'tarjeta' ? `${m.marca} •••• ${m.ultimos}` : 'Mercado Pago');

/** La billetera: carrusel de tarjetas y, debajo, la elegida con sus acciones. */
export function Billetera({
  medios,
  principalId,
  titular,
  onPrincipal,
  onQuitar,
  puedeQuitar,
}: {
  medios: Medio[];
  principalId?: string;
  titular?: string;
  onPrincipal: (id: string) => void;
  onQuitar: (id: string) => void;
  puedeQuitar: (id: string) => boolean;
}) {
  const inicial = Math.max(0, medios.findIndex((m) => m.id === principalId));
  const [i, setI] = useState(inicial);
  const [dir, setDir] = useState(1);
  const [detalles, setDetalles] = useState(false);
  // Si se quita una tarjeta, el índice no se pasa del final.
  useEffect(() => {
    if (i > medios.length - 1) setI(Math.max(0, medios.length - 1));
  }, [medios.length, i]);
  const n = medios.length;
  const actual = medios[Math.min(i, n - 1)];
  if (!actual) return null;
  const ir = (paso: number) => {
    if (n < 2) return;
    setDir(paso);
    setI((x) => (x + paso + n) % n);
  };
  const anterior = n > 1 ? medios[(i - 1 + n) % n] : undefined;
  const siguiente = n > 2 ? medios[(i + 1) % n] : undefined;
  const esPrincipal = actual.id === principalId;
  const teclas = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') ir(-1);
    if (e.key === 'ArrowRight') ir(1);
  };

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Carrusel */}
      <div
        role="group"
        aria-roledescription="carrusel"
        aria-label="Tus tarjetas"
        tabIndex={0}
        onKeyDown={teclas}
        className="relative flex w-full items-center justify-center overflow-hidden rounded-[20px] py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario"
      >
        {/* Las de los costados, asomando (solo en pantallas anchas) */}
        {anterior && (
          <button
            type="button"
            onClick={() => ir(-1)}
            aria-label={`Ver ${nombre(anterior)}`}
            tabIndex={-1}
            className="absolute left-1/2 hidden w-[340px] -translate-x-[calc(50%+330px)] scale-[0.86] opacity-50 transition-opacity hover:opacity-70 md:block"
          >
            <TarjetaWallet medio={anterior} titular={titular} />
          </button>
        )}
        {siguiente && (
          <button
            type="button"
            onClick={() => ir(1)}
            aria-label={`Ver ${nombre(siguiente)}`}
            tabIndex={-1}
            className="absolute left-1/2 hidden w-[340px] translate-x-[calc(-50%+330px)] scale-[0.86] opacity-50 transition-opacity hover:opacity-70 md:block"
          >
            <TarjetaWallet medio={siguiente} titular={titular} />
          </button>
        )}

        {/* La del medio: se desliza con el dedo o el mouse */}
        <div className="relative z-10 w-[min(360px,calc(100%-96px))]">
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div
              key={actual.id}
              custom={dir}
              initial={{ x: dir * 80, opacity: 0, scale: 0.96 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: dir * -80, opacity: 0, scale: 0.96 }}
              transition={RESORTE}
              drag={n > 1 ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.35}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60 || info.velocity.x < -400) ir(1);
                else if (info.offset.x > 60 || info.velocity.x > 400) ir(-1);
              }}
              className="cursor-grab touch-pan-y active:cursor-grabbing"
            >
              <TarjetaWallet medio={actual} titular={titular} />
            </motion.div>
          </AnimatePresence>
        </div>

        {n > 1 && (
          <>
            <button
              type="button"
              onClick={() => ir(-1)}
              aria-label="Tarjeta anterior"
              className="absolute left-1 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white text-texto shadow-[0_6px_18px_rgba(21,25,58,0.16)] transition-transform hover:scale-105 sm:left-2"
            >
              <Icon name="chevron-derecha" size={20} weight="bold" className="rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => ir(1)}
              aria-label="Tarjeta siguiente"
              className="absolute right-1 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white text-texto shadow-[0_6px_18px_rgba(21,25,58,0.16)] transition-transform hover:scale-105 sm:right-2"
            >
              <Icon name="chevron-derecha" size={20} weight="bold" />
            </button>
          </>
        )}
      </div>

      {/* Puntitos (con muchas tarjetas alcanza con "3 de 14") */}
      {n > 1 && n <= 12 && (
        <div className="-mt-2 flex items-center gap-1">
          {medios.map((m, k) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setDir(k > i ? 1 : -1);
                setI(k);
              }}
              aria-label={`Ver ${nombre(m)}`}
              aria-current={k === i ? 'true' : undefined}
              className="flex h-6 items-center px-0.5"
            >
              <span className={`block h-2 rounded-full transition-all duration-300 ${k === i ? 'w-6 bg-primario' : 'w-2 bg-[#D5D9E6] hover:bg-[#B9BED3]'}`} />
            </button>
          ))}
        </div>
      )}

      {/* La elegida */}
      <div aria-live="polite" className="flex flex-col items-center gap-1 text-center">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-[20px] font-bold tabular-nums">{nombre(actual)}</span>
          {esPrincipal && (
            <span className="inline-flex items-center gap-1 rounded-full bg-exito-suave px-2.5 py-0.5 font-semibold text-exito-texto">
              <Icon name="check" size={16} strokeWidth={3} />
              Principal
            </span>
          )}
        </div>
        <span className="text-texto-suave">
          {actual.tipo === 'tarjeta' ? `Vence ${actual.vence}` : 'Débito automático'} · {Math.min(i, n - 1) + 1} de {n}
        </span>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {!esPrincipal && (
          <button type="button" onClick={() => onPrincipal(actual.id)} className="btn-lift inline-flex h-11 items-center gap-2 rounded-full bg-primario px-5 font-bold text-white shadow-boton">
            Usar como principal
          </button>
        )}
        <button
          type="button"
          onClick={() => setDetalles((v) => !v)}
          aria-expanded={detalles}
          className="btn-lift inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] border-borde bg-white px-5 font-bold text-texto hover:border-primario hover:text-primario-oscuro"
        >
          {detalles ? 'Ocultar detalles' : 'Ver detalles'}
        </button>
        <button
          type="button"
          onClick={() => onQuitar(actual.id)}
          disabled={!puedeQuitar(actual.id)}
          title={puedeQuitar(actual.id) ? undefined : 'Con Pro necesitás al menos un medio de pago'}
          className="btn-lift inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] border-borde bg-white px-5 font-bold text-error hover:border-error disabled:pointer-events-none disabled:opacity-50"
        >
          {actual.tipo === 'tarjeta' ? 'Quitar' : 'Desconectar'}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {detalles && (
          <motion.dl
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-[460px] overflow-hidden rounded-[16px] bg-fondo"
          >
            {(actual.tipo === 'tarjeta'
              ? [
                  ['Número', `•••• •••• •••• ${actual.ultimos}`],
                  ['Vence', actual.vence],
                  ['Titular', titular ?? '—'],
                  ['Se usa para', esPrincipal ? 'Cobrar Facti Pro cada mes' : 'Nada por ahora'],
                ]
              : [
                  ['Tipo', 'Débito automático'],
                  ['Se usa para', esPrincipal ? 'Cobrar Facti Pro cada mes' : 'Nada por ahora'],
                ]
            ).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 border-t border-[#E9ECF3] px-4 py-3 first:border-t-0">
                <dt className="flex-none text-texto-suave">{k}</dt>
                <dd className="min-w-0 truncate text-right font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </motion.dl>
        )}
      </AnimatePresence>
    </div>
  );
}
