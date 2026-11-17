import type { ComponentType, SVGProps } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  Bank,
  Buildings,
  CalendarBlank,
  CaretDown,
  CaretRight,
  ChartLineUp,
  Check,
  CheckCircle,
  ClockCountdown,
  CopySimple,
  DotsThreeOutline,
  Crown,
  DownloadSimple,
  EnvelopeSimple,
  GearSix,
  HouseSimple,
  Info,
  Lightning,
  LockSimple,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Receipt,
  ShieldCheck,
  SignOut,
  Sparkle,
  Star,
  User,
  UsersThree,
  Wallet,
  Warning,
  WarningCircle,
  X,
} from '@phosphor-icons/react/dist/ssr';
import type { IconProps as PhosphorProps, IconWeight } from '@phosphor-icons/react';

/**
 * Sistema de íconos de Facti, sobre Phosphor (familia redondeada, pareja en toda la app).
 * Por defecto van en "duotone": el trazo en el color del texto y un relleno suave del mismo color,
 * que le da el toque amigable de Facti. Para algo más fino o más marcado, `weight`.
 *
 * Uso:  <Icon name="factura" />   ·   <Icon name="volver" size={18} weight="bold" />
 *
 * Para sumar un ícono: agregalo a ICONOS con un componente de @phosphor-icons/react.
 */
const ICONOS = {
  // Navegación
  volver: ArrowLeft,
  'flecha-derecha': ArrowRight,
  'chevron-derecha': CaretRight,
  'chevron-abajo': CaretDown,
  'link-externo': ArrowSquareOut,

  // Menú de la app
  inicio: HouseSimple,
  factura: Receipt,
  clientes: UsersThree,
  cliente: User,
  cobros: Wallet,
  monotributo: ChartLineUp,
  config: GearSix,
  menu: DotsThreeOutline,

  // Acciones
  mas: Plus,
  check: Check,
  'check-circulo': CheckCircle,
  cerrar: X,
  copiar: CopySimple,
  descargar: DownloadSimple,
  buscar: MagnifyingGlass,
  editar: PencilSimple,
  salir: SignOut,

  // Estado / avisos
  info: Info,
  alerta: WarningCircle,
  'alerta-triangulo': Warning,
  reloj: ClockCountdown,
  calendario: CalendarBlank,

  // Marketing / plan
  estrella: Star,
  chispa: Sparkle,
  corona: Crown,
  rayo: Lightning,

  // Fiscal / contacto
  escudo: ShieldCheck,
  banco: Bank,
  mail: EnvelopeSimple,
  candado: LockSimple,
  arca: Buildings,
} satisfies Record<string, ComponentType<PhosphorProps>>;

export type IconName = keyof typeof ICONOS;

/** Íconos de una sola línea (flechas, más, check, cruz): en duotono no tienen relleno, así que van en "bold". */
const SOLO_TRAZO = new Set<IconName>(['volver', 'flecha-derecha', 'chevron-derecha', 'chevron-abajo', 'mas', 'check', 'cerrar']);

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'ref'> {
  name: IconName;
  size?: number;
  weight?: IconWeight;
  /** Compatibilidad con el sistema anterior: un trazo ≥ 2.4 se dibuja en "bold". */
  strokeWidth?: number;
}

export function Icon({ name, size = 20, weight, strokeWidth, ...rest }: IconProps) {
  const Componente = ICONOS[name];
  const peso: IconWeight = weight ?? (SOLO_TRAZO.has(name) || (strokeWidth ?? 0) >= 2.4 ? 'bold' : 'duotone');
  return <Componente size={size} weight={peso} aria-hidden="true" {...(rest as PhosphorProps)} />;
}
