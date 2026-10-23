import type { CSSProperties } from 'react';

/**
 * Mascota Facti: ticket lila con borde en zigzag, manos amarillas y cachetes rosados.
 * Las 9 poses del sistema de diseño (ver diseno/DISENO.md y diseno/facti/*.svg).
 *
 * - `animated` solo tiene efecto en las poses que el diseño define como animadas
 *   (saludo, festejo, buscando, alerta, durmiendo).
 * - Todas las animaciones se apagan solas con prefers-reduced-motion (ver globals.css).
 */
export type PoseFacti =
  | 'saludo'
  | 'ok'
  | 'festejo'
  | 'factura'
  | 'pensando'
  | 'senalando'
  | 'buscando'
  | 'alerta'
  | 'durmiendo';

const POSES_ANIMADAS: Record<PoseFacti, boolean> = {
  saludo: true,
  ok: false,
  festejo: true,
  factura: false,
  pensando: false,
  senalando: false,
  buscando: true,
  alerta: true,
  durmiendo: true,
};

const ETIQUETAS: Record<PoseFacti, string> = {
  saludo: 'Facti: saludando',
  ok: 'Facti: todo bien',
  festejo: 'Facti: festejando',
  factura: 'Facti: con una factura',
  pensando: 'Facti: pensando',
  senalando: 'Facti: señalando',
  buscando: 'Facti: buscando en ARCA',
  alerta: 'Facti: atento',
  durmiendo: 'Facti: esperando',
};

export interface FactiProps {
  pose?: PoseFacti;
  size?: number;
  animated?: boolean;
  className?: string;
}

export function Facti({ pose = 'saludo', size = 160, animated = true, className }: FactiProps) {
  const a = animated && POSES_ANIMADAS[pose];
  const height = Math.round((size * 320) / 340);
  // Clase de animación solo si corresponde.
  const c = (cls: string) => (a ? cls : undefined);

  const svgProps = {
    width: size,
    height,
    viewBox: '-30 -30 340 320',
    role: 'img' as const,
    'aria-label': ETIQUETAS[pose],
    className,
  };

  const sombra = <ellipse cx="130" cy="276" rx="84" ry="10" fill="#15193A" opacity="0.08" />;
  // Cuerpo del ticket (zigzag) + franjas internas + cachetes. Compartido por varias poses.
  const cuerpo = (
    <>
      <path
        d="M40 70 Q40 34 76 34 L184 34 Q220 34 220 70 L220 238 L202 254 L184 238 L166 254 L148 238 L130 254 L112 238 L94 254 L76 238 L58 254 L40 238 Z"
        fill="#7B7FF2"
      />
      <path d="M56 74 Q56 50 80 50 L178 50 Q202 50 202 74 L202 104 L56 104 Z" fill="#FFFFFF" opacity="0.18" />
      <path
        d="M76 196 L184 196 M76 214 L150 214"
        stroke="#FFFFFF"
        strokeWidth="7"
        strokeLinecap="round"
        opacity="0.6"
      />
      <ellipse cx="82" cy="156" rx="12" ry="7" fill="#FF9FB2" opacity="0.8" />
      <ellipse cx="178" cy="156" rx="12" ry="7" fill="#FF9FB2" opacity="0.8" />
    </>
  );
  const confDelay = (s: string): CSSProperties => ({ animationDelay: s });

  switch (pose) {
    case 'ok':
      return (
        <svg {...svgProps}>
          {sombra}
          <g className={c('f-float')}>
            <path d="M40 160 Q18 172 24 202" fill="none" stroke="#7B7FF2" strokeWidth="16" strokeLinecap="round" />
            <circle cx="24" cy="208" r="13" fill="#FFD25E" />
            <g>
              <path d="M220 160 Q250 150 244 116" fill="none" stroke="#7B7FF2" strokeWidth="16" strokeLinecap="round" />
              <circle cx="244" cy="108" r="13" fill="#FFD25E" />
              <circle cx="250" cy="76" r="24" fill="#1E9E63" stroke="#FFFFFF" strokeWidth="4" />
              <path d="M239 76 l8 8 l14 -15" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            {cuerpo}
            <g className={c('f-blink')}>
              <ellipse cx="102" cy="128" rx="13" ry="16" fill="#15193A" />
              <ellipse cx="158" cy="128" rx="13" ry="16" fill="#15193A" />
              <circle cx="106" cy="122" r="5" fill="#fff" />
              <circle cx="162" cy="122" r="5" fill="#fff" />
            </g>
            <path d="M108 158 Q130 182 152 158" fill="none" stroke="#15193A" strokeWidth="6" strokeLinecap="round" />
          </g>
        </svg>
      );

    case 'festejo':
      return (
        <svg {...svgProps}>
          {sombra}
          <rect className={c('f-conf')} style={confDelay('0s')} x="-10" y="20" width="10" height="16" rx="3" fill="#FFD25E" transform="rotate(20 -5 28)" />
          <rect className={c('f-conf')} style={confDelay('0.4s')} x="30" y="-10" width="10" height="16" rx="3" fill="#FF9FB2" transform="rotate(-15 35 -2)" />
          <rect className={c('f-conf')} style={confDelay('0.2s')} x="250" y="-8" width="10" height="16" rx="3" fill="#7CC6FF" transform="rotate(25 255 0)" />
          <rect className={c('f-conf')} style={confDelay('0.6s')} x="282" y="40" width="10" height="16" rx="3" fill="#FFD25E" transform="rotate(-20 287 48)" />
          <rect className={c('f-conf')} style={confDelay('0.8s')} x="0" y="80" width="10" height="16" rx="3" fill="#1E9E63" transform="rotate(10 5 88)" />
          <rect className={c('f-conf')} style={confDelay('1s')} x="276" y="100" width="10" height="16" rx="3" fill="#FF9FB2" transform="rotate(30 281 108)" />
          <g className={c('f-float')}>
            <g className={c('f-wave-l')}>
              <path d="M40 150 Q14 140 18 112" fill="none" stroke="#7B7FF2" strokeWidth="16" strokeLinecap="round" />
              <circle cx="18" cy="104" r="13" fill="#FFD25E" />
            </g>
            <g className={c('f-wave')}>
              <path d="M220 150 Q248 132 238 100" fill="none" stroke="#7B7FF2" strokeWidth="16" strokeLinecap="round" />
              <circle cx="238" cy="92" r="13" fill="#FFD25E" />
            </g>
            {cuerpo}
            <path d="M88 132 Q102 112 116 132 M144 132 Q158 112 172 132" fill="none" stroke="#15193A" strokeWidth="7" strokeLinecap="round" />
            <path d="M104 154 Q130 196 156 154 Z" fill="#15193A" stroke="#15193A" strokeWidth="4" strokeLinejoin="round" />
            <path d="M116 172 Q130 184 144 172 Q130 166 116 172 Z" fill="#FF9FB2" />
          </g>
        </svg>
      );

    case 'factura':
      return (
        <svg {...svgProps}>
          {sombra}
          <g className={c('f-float')}>
            <path d="M40 150 Q44 196 80 206" fill="none" stroke="#7B7FF2" strokeWidth="16" strokeLinecap="round" />
            <circle cx="84" cy="206" r="13" fill="#FFD25E" />
            <path d="M220 150 Q216 196 180 206" fill="none" stroke="#7B7FF2" strokeWidth="16" strokeLinecap="round" />
            <circle cx="176" cy="206" r="13" fill="#FFD25E" />
            {cuerpo}
            <g className={c('f-blink')}>
              <ellipse cx="102" cy="128" rx="13" ry="16" fill="#15193A" />
              <ellipse cx="158" cy="128" rx="13" ry="16" fill="#15193A" />
              <circle cx="106" cy="122" r="5" fill="#fff" />
              <circle cx="162" cy="122" r="5" fill="#fff" />
            </g>
            <path d="M108 158 Q130 182 152 158" fill="none" stroke="#15193A" strokeWidth="6" strokeLinecap="round" />
            <g transform="rotate(-4 130 200)">
              <rect x="80" y="160" width="100" height="92" rx="8" fill="#fff" stroke="#C9CEDD" strokeWidth="2" />
              <path d="M94 180h56M94 194h72M94 208h40" stroke="#B9BED3" strokeWidth="6" strokeLinecap="round" />
              <circle cx="158" cy="232" r="13" fill="#D7F5E6" />
              <path d="M152 232l4 4 8-8" fill="none" stroke="#1E9E63" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </g>
        </svg>
      );

    case 'pensando':
      return (
        <svg {...svgProps}>
          {sombra}
          <circle cx="238" cy="40" r="6" fill="#fff" stroke="#C9CEDD" strokeWidth="2" />
          <circle cx="252" cy="20" r="9" fill="#fff" stroke="#C9CEDD" strokeWidth="2" />
          <g>
            <circle cx="276" cy="-2" r="22" fill="#fff" stroke="#C9CEDD" strokeWidth="2" />
            <text x="276" y="7" textAnchor="middle" fontFamily="Quicksand, Nunito, sans-serif" fontWeight="700" fontSize="26" fill="#7B7FF2">?</text>
          </g>
          <g className={c('f-float')}>
            <path d="M40 160 Q18 172 24 202" fill="none" stroke="#7B7FF2" strokeWidth="16" strokeLinecap="round" />
            <circle cx="24" cy="208" r="13" fill="#FFD25E" />
            <path d="M220 160 Q214 196 172 186" fill="none" stroke="#7B7FF2" strokeWidth="16" strokeLinecap="round" />
            <circle cx="166" cy="182" r="13" fill="#FFD25E" />
            {cuerpo}
            <g className={c('f-blink')}>
              <ellipse cx="108" cy="122" rx="13" ry="16" fill="#15193A" />
              <ellipse cx="164" cy="122" rx="13" ry="16" fill="#15193A" />
              <circle cx="112" cy="116" r="5" fill="#fff" />
              <circle cx="168" cy="116" r="5" fill="#fff" />
            </g>
            <path d="M116 166 Q130 160 146 168" fill="none" stroke="#15193A" strokeWidth="6" strokeLinecap="round" />
            <path d="M88 104 Q102 96 116 102 M146 100 Q160 92 174 98" fill="none" stroke="#15193A" strokeWidth="5" strokeLinecap="round" />
          </g>
        </svg>
      );

    case 'senalando':
      return (
        <svg {...svgProps}>
          {sombra}
          <g className={c('f-float')}>
            <path d="M40 160 Q18 172 24 202" fill="none" stroke="#7B7FF2" strokeWidth="16" strokeLinecap="round" />
            <circle cx="24" cy="208" r="13" fill="#FFD25E" />
            <path d="M220 150 Q246 148 270 140" fill="none" stroke="#7B7FF2" strokeWidth="16" strokeLinecap="round" />
            <circle cx="274" cy="138" r="13" fill="#FFD25E" />
            <path d="M282 134 L298 128" stroke="#FFD25E" strokeWidth="10" strokeLinecap="round" />
            {cuerpo}
            <g className={c('f-blink')}>
              <ellipse cx="108" cy="128" rx="13" ry="16" fill="#15193A" />
              <ellipse cx="164" cy="128" rx="13" ry="16" fill="#15193A" />
              <circle cx="112" cy="122" r="5" fill="#fff" />
              <circle cx="168" cy="122" r="5" fill="#fff" />
            </g>
            <path d="M108 158 Q130 182 152 158" fill="none" stroke="#15193A" strokeWidth="6" strokeLinecap="round" />
          </g>
        </svg>
      );

    case 'buscando':
      return (
        <svg {...svgProps}>
          {sombra}
          <g className={c('f-float')}>
            <path d="M40 160 Q18 172 24 202" fill="none" stroke="#7B7FF2" strokeWidth="16" strokeLinecap="round" />
            <circle cx="24" cy="208" r="13" fill="#FFD25E" />
            <g className={c('f-sweep')}>
              <path d="M220 150 Q246 130 240 104" fill="none" stroke="#7B7FF2" strokeWidth="16" strokeLinecap="round" />
              <circle cx="240" cy="96" r="13" fill="#FFD25E" />
              <circle cx="262" cy="62" r="22" fill="#ffffff" fillOpacity="0.6" stroke="#15193A" strokeWidth="6" />
              <path d="M248 78 L240 92" stroke="#15193A" strokeWidth="7" strokeLinecap="round" />
            </g>
            {cuerpo}
            <g className={c('f-blink')}>
              <ellipse cx="110" cy="124" rx="13" ry="16" fill="#15193A" />
              <ellipse cx="166" cy="124" rx="13" ry="16" fill="#15193A" />
              <circle cx="114" cy="118" r="5" fill="#fff" />
              <circle cx="170" cy="118" r="5" fill="#fff" />
            </g>
            <ellipse cx="130" cy="166" rx="9" ry="11" fill="#15193A" />
          </g>
        </svg>
      );

    case 'alerta':
      return (
        <svg {...svgProps}>
          {sombra}
          <g className={c('f-pulse')}>
            <circle cx="20" cy="40" r="20" fill="#FFD25E" />
            <text x="20" y="50" textAnchor="middle" fontFamily="Nunito, sans-serif" fontWeight="800" fontSize="28" fill="#15193A">!</text>
          </g>
          <path d="M226 56 Q234 70 226 78 Q218 70 226 56 Z" fill="#7CC6FF" />
          <g className={c('f-shake')}>
            <path d="M40 160 Q18 172 24 202" fill="none" stroke="#7B7FF2" strokeWidth="16" strokeLinecap="round" />
            <circle cx="24" cy="208" r="13" fill="#FFD25E" />
            <path d="M220 160 Q242 172 236 202" fill="none" stroke="#7B7FF2" strokeWidth="16" strokeLinecap="round" />
            <circle cx="236" cy="208" r="13" fill="#FFD25E" />
            {cuerpo}
            <g className={c('f-blink')}>
              <ellipse cx="102" cy="128" rx="13" ry="16" fill="#15193A" />
              <ellipse cx="158" cy="128" rx="13" ry="16" fill="#15193A" />
              <circle cx="106" cy="122" r="5" fill="#fff" />
              <circle cx="162" cy="122" r="5" fill="#fff" />
            </g>
            <ellipse cx="130" cy="166" rx="9" ry="11" fill="#15193A" />
            <path d="M86 100 L114 108 M174 100 L146 108" stroke="#15193A" strokeWidth="6" strokeLinecap="round" />
          </g>
        </svg>
      );

    case 'durmiendo':
      return (
        <svg {...svgProps}>
          {sombra}
          <text className={c('f-z')} style={confDelay('0s')} x="222" y="40" fontFamily="Quicksand, Nunito, sans-serif" fontWeight="700" fontSize="22" fill="#7B7FF2">z</text>
          <text className={c('f-z')} style={confDelay('0.8s')} x="244" y="20" fontFamily="Quicksand, Nunito, sans-serif" fontWeight="700" fontSize="28" fill="#7B7FF2">z</text>
          <text className={c('f-z')} style={confDelay('1.6s')} x="268" y="-2" fontFamily="Quicksand, Nunito, sans-serif" fontWeight="700" fontSize="34" fill="#7B7FF2">z</text>
          <g className={c('f-float')}>
            <path d="M40 160 Q18 172 24 202" fill="none" stroke="#7B7FF2" strokeWidth="16" strokeLinecap="round" />
            <circle cx="24" cy="208" r="13" fill="#FFD25E" />
            <path d="M220 160 Q242 172 236 202" fill="none" stroke="#7B7FF2" strokeWidth="16" strokeLinecap="round" />
            <circle cx="236" cy="208" r="13" fill="#FFD25E" />
            {cuerpo}
            <path d="M88 126 Q102 138 116 126 M144 126 Q158 138 172 126" fill="none" stroke="#15193A" strokeWidth="6" strokeLinecap="round" />
            <ellipse cx="130" cy="166" rx="6" ry="5" fill="#15193A" />
          </g>
        </svg>
      );

    case 'saludo':
    default:
      return (
        <svg {...svgProps}>
          {sombra}
          <g className={c('f-float')}>
            <g className={c('f-wave-l')}>
              <path d="M40 150 Q14 140 18 112" fill="none" stroke="#7B7FF2" strokeWidth="16" strokeLinecap="round" />
              <circle cx="18" cy="104" r="13" fill="#FFD25E" />
            </g>
            <g className={c('f-wave')}>
              <path d="M220 150 Q248 132 238 100" fill="none" stroke="#7B7FF2" strokeWidth="16" strokeLinecap="round" />
              <circle cx="238" cy="92" r="13" fill="#FFD25E" />
            </g>
            {cuerpo}
            <g className={c('f-blink')}>
              <ellipse cx="102" cy="128" rx="13" ry="16" fill="#15193A" />
              <ellipse cx="158" cy="128" rx="13" ry="16" fill="#15193A" />
              <circle cx="106" cy="122" r="5" fill="#fff" />
              <circle cx="162" cy="122" r="5" fill="#fff" />
            </g>
            <path d="M108 158 Q130 182 152 158" fill="none" stroke="#15193A" strokeWidth="6" strokeLinecap="round" />
          </g>
        </svg>
      );
  }
}
