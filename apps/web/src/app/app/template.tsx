'use client';

import { motion } from 'motion/react';

// Un template se vuelve a montar en cada navegación: así cada pantalla de la app entra suave
// (sube 8px y aparece, con la misma curva de salida que el resto de las animaciones de Facti).
export default function Plantilla({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
      className="flex flex-col gap-[26px]"
    >
      {children}
    </motion.div>
  );
}
