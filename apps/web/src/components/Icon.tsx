import type { SVGProps } from 'react';

/**
 * Sistema de íconos de Facti.
 * Estilo único (grid 24, trazo redondeado, `stroke: currentColor`) para que
 * todos los íconos hereden el color del texto y se vean parejos en toda la app.
 *
 * Uso:  <Icon name="factura" />   ·   <Icon name="volver" size={18} />
 *
 * Para sumar un ícono: agregá su entrada a PATHS con paths de un viewBox 0 0 24 24.
 */

const PATHS = {
  // Navegación
  volver: <path d="M15 5l-7 7 7 7M8 12h12" />,
  'flecha-derecha': <path d="M5 12h12M12 5l7 7-7 7" />,
  'chevron-derecha': <path d="M9 6l6 6-6 6" />,
  'chevron-abajo': <path d="M6 9l6 6 6-6" />,
  'link-externo': <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,

  // Menú de la app
  inicio: <><path d="M4 11l8-7 8 7v9H4z" /><path d="M10 20v-6h4v6" /></>,
  factura: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h5" /></>,
  clientes: <><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21 20c0-2.6-1.6-4.8-4-5.6" /></>,
  cliente: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></>,
  cobros: <><rect x="3" y="6" width="18" height="12" rx="3" /><circle cx="12" cy="12" r="2.5" /></>,
  monotributo: <><path d="M4 19V5M4 19h16" /><path d="M8 15l4-4 3 3 5-6" /></>,
  config: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" /></>,

  // Acciones
  mas: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  'check-circulo': <><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></>,
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  copiar: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  descargar: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 19h16" /></>,
  buscar: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  editar: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,

  // Estado / avisos
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.5" /></>,
  alerta: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.5" /></>,
  'alerta-triangulo': <><path d="M12 3l9.5 16.5H2.5z" /><path d="M12 10v4M12 17v.5" /></>,
  reloj: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  calendario: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>,

  // Marketing / plan
  estrella: <path d="M12 3l2.6 5.7 6.2.6-4.7 4.1 1.4 6.1-5.5-3.2-5.5 3.2 1.4-6.1L3.2 9.3l6.2-.6z" />,
  chispa: <><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /><path d="M19 14l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" /></>,
  corona: <path d="M4 18h16M4 18l-1.5-9 5 4L12 5l4.5 8 5-4L20 18" />,
  rayo: <path d="M13 3L5 13h6l-1 8 8-10h-6z" />,

  // Fiscal / contacto
  escudo: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  banco: <><path d="M3 10l9-6 9 6M5 10v9M19 10v9M9 10v9M15 10v9M3 21h18" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  candado: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  arca: <><path d="M4 8l8-4 8 4-8 4z" /><path d="M6 10v6M10 10v6M14 10v6M18 10v6M4 20h16" /></>,
} as const;

export type IconName = keyof typeof PATHS;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}

export function Icon({ name, size = 20, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
