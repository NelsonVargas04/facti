'use client';

import type { ReactNode } from 'react';
import { PaymentIcon, type PaymentType } from 'react-svg-credit-card-payment-icons';
import { siMercadopago, type SimpleIcon } from 'simple-icons';
import type { Medio } from '@/lib/billetera';

/**
 * Medios de pago como en Mercado Pago o Stripe: sin tarjeta dibujada, el logo oficial de la marca y
 * "•••• 4242". Los logos salen de librerías: react-svg-credit-card-payment-icons (MIT, dibujos de
 * aaronfagan/svg-credit-card-payment-icons) para las tarjetas y simple-icons (CC0) para Mercado Pago.
 * Las marcas argentinas (Naranja, Cabal…) no están en ninguna librería: si Mercado Pago nos pasa su
 * logo oficial (`logoUrl`), se usa ese; si no, la tarjeta genérica de la librería.
 */

const TIPO_ICONO: Record<string, PaymentType> = {
  Visa: 'Visa',
  'Visa Débito': 'Visa',
  Mastercard: 'Mastercard',
  'Mastercard Débito': 'Mastercard',
  'American Express': 'Amex',
  Maestro: 'Maestro',
};

function LogoMarca({ icono, size }: { icono: SimpleIcon; size: number }) {
  return (
    <svg role="img" aria-label={icono.title} viewBox="0 0 24 24" width={size} height={size} fill={`#${icono.hex}`}>
      <path d={icono.path} />
    </svg>
  );
}

/** Logo del medio con forma de tarjetita (proporción 780:500 de la librería). */
export function MiniLogo({ medio, logoUrl, ancho = 52 }: { medio?: Medio; logoUrl?: string; ancho?: number }) {
  const alto = Math.round((ancho * 500) / 780);
  const caja = 'flex flex-none items-center justify-center rounded-[5px] bg-white ring-1 ring-inset ring-[#E3E7F0]';
  if (medio?.tipo === 'mercadopago') {
    return (
      <span aria-hidden="true" style={{ width: ancho, height: alto }} className={caja}>
        <LogoMarca icono={siMercadopago} size={Math.round(alto * 0.68)} />
      </span>
    );
  }
  if (logoUrl) {
    return (
      <span aria-hidden="true" style={{ width: ancho, height: alto }} className={caja}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="" style={{ maxHeight: alto * 0.72, maxWidth: ancho * 0.85 }} />
      </span>
    );
  }
  const tipo = medio?.tipo === 'tarjeta' ? (TIPO_ICONO[medio.marca] ?? 'Generic') : 'Generic';
  return <PaymentIcon type={tipo} format="flatRounded" width={ancho} aria-hidden="true" className="flex-none" />;
}

export function tituloMedio(m: Medio) {
  return m.tipo === 'tarjeta' ? `${m.marca} •••• ${m.ultimos}` : 'Mercado Pago';
}

/** El medio principal, destacado: logo grande, marca y últimos 4, vencimiento y titular. */
export function MedioDestacado({ medio, titular, acciones }: { medio?: Medio; titular?: string; acciones?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[18px] bg-fondo p-4 ring-1 ring-inset ring-[#E6E9F2] sm:p-5">
      <MiniLogo medio={medio} ancho={78} />
      <div className="flex min-w-0 flex-[1_1_180px] flex-col">
        <span className="truncate text-[18px] font-bold tabular-nums">{medio ? tituloMedio(medio) : 'Tu tarjeta nueva'}</span>
        <span className="truncate text-texto-suave">
          {!medio
            ? 'Se completa con lo que confirme Mercado Pago'
            : medio.tipo === 'tarjeta'
              ? `Vence ${medio.vence}${titular ? ` · ${titular}` : ''}`
              : 'Débito automático desde tu cuenta'}
        </span>
      </div>
      {acciones && <div className="flex flex-none items-center gap-2">{acciones}</div>}
    </div>
  );
}
