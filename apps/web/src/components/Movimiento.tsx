'use client';

import { MotionConfig } from 'motion/react';

/** Configuración de Motion para toda la app: si la persona pidió menos movimiento en su sistema, se respeta. */
export function Movimiento({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
