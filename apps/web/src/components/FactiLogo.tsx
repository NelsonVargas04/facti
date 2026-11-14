/**
 * Logo chico de Facti: la mascota (ticket lila con borde en zigzag) reducida a lo esencial
 * para leerse a 24–40 px: reflejo arriba, ojos con brillo, cachetes rosados y sonrisa.
 * `ink` = color de ojos y boca. El mismo dibujo está en app/icon.svg (favicon).
 */
export function FactiLogo({ size = 34, ink = '#15193A' }: { size?: number; ink?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      {/* Cuerpo: ticket con 5 dientes abajo */}
      <path
        d="M7 13 Q7 6 14 6 L26 6 Q33 6 33 13 L33 31 L30.4 34 L27.8 31 L25.2 34 L22.6 31 L20 34 L17.4 31 L14.8 34 L12.2 31 L9.6 34 L7 31 Z"
        fill="#7B7FF2"
      />
      {/* Brillo de arriba */}
      <rect x="10" y="8.6" width="9" height="2.6" rx="1.3" fill="#FFFFFF" opacity="0.35" />
      {/* Cachetes */}
      <ellipse cx="11.8" cy="22.2" rx="2.1" ry="1.3" fill="#FF9FB2" opacity="0.9" />
      <ellipse cx="28.2" cy="22.2" rx="2.1" ry="1.3" fill="#FF9FB2" opacity="0.9" />
      {/* Ojos con brillo */}
      <ellipse cx="15.6" cy="18" rx="2.4" ry="2.9" fill={ink} />
      <ellipse cx="24.4" cy="18" rx="2.4" ry="2.9" fill={ink} />
      <circle cx="16.4" cy="17" r="0.85" fill="#FFFFFF" />
      <circle cx="25.2" cy="17" r="0.85" fill="#FFFFFF" />
      {/* Sonrisa */}
      <path d="M16.8 23 Q20 26.4 23.2 23" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Logo + palabra "Facti". */
export function FactiWordmark({
  size = 34,
  ink = '#15193A',
  textClass = 'text-texto',
}: {
  size?: number;
  ink?: string;
  textClass?: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <FactiLogo size={size} ink={ink} />
      <span className={`font-display text-2xl font-bold tracking-[-0.02em] ${textClass}`}>Facti</span>
    </span>
  );
}
