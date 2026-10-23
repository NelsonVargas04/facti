'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

const W = 794;
const H = 1123;

/** Escala el comprobante (794×1123) para que entre justo en el ancho disponible. */
export function EscalarComprobante({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setScale(Math.min(1, el.clientWidth / W));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ width: '100%', height: H * scale, overflow: 'hidden' }}>
      <div style={{ width: W, transformOrigin: 'top left', transform: `scale(${scale})` }}>{children}</div>
    </div>
  );
}
