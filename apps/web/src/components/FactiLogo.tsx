/** Logo chico de Facti (el ticket) para headers y menú. `ink` = color de ojos y boca. */
export function FactiLogo({ size = 34, ink = '#15193A' }: { size?: number; ink?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path
        d="M6 12 Q6 5 13 5 L27 5 Q34 5 34 12 L34 32 L30 36 L26 32 L22 36 L18 32 L14 36 L10 32 L6 36 Z"
        fill="#7B7FF2"
      />
      <g>
        <ellipse cx="15" cy="17" rx="2.6" ry="3.2" fill={ink} />
        <ellipse cx="25" cy="17" rx="2.6" ry="3.2" fill={ink} />
      </g>
      <path d="M15 24 Q20 29 25 24" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
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
    <span className="flex items-center gap-2.5">
      <FactiLogo size={size} ink={ink} />
      <span className={`font-display font-bold text-2xl ${textClass}`}>Facti</span>
    </span>
  );
}
