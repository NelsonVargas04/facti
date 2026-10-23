'use client';

import { useEffect, useRef, useState } from 'react';

const reducido = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Número que sube hasta su valor (y se mueve suave cuando cambia), formateado con `formato`.
 * Con movimiento reducido muestra el valor de una.
 */
export function Numero({ valor, formato, duracion = 700 }: { valor: number; formato: (n: number) => string; duracion?: number }) {
  const [mostrado, setMostrado] = useState(() => (reducido() ? valor : 0));
  const desde = useRef(mostrado);

  useEffect(() => {
    if (reducido()) {
      setMostrado(valor);
      return;
    }
    const inicio = performance.now();
    const origen = desde.current;
    let frame = 0;
    const paso = (t: number) => {
      const p = Math.min(1, (t - inicio) / duracion);
      const suave = 1 - Math.pow(1 - p, 3); // ease-out cúbico
      const actual = origen + (valor - origen) * suave;
      desde.current = actual;
      setMostrado(p < 1 ? actual : valor);
      if (p < 1) frame = requestAnimationFrame(paso);
    };
    frame = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(frame);
  }, [valor, duracion]);

  // El lector de pantalla lee el valor final, no cada paso de la animación.
  return (
    <>
      <span aria-hidden="true">{formato(Math.round(mostrado))}</span>
      <span className="sr-only">{formato(valor)}</span>
    </>
  );
}

/** Rueda que gira para los botones que están esperando una respuesta. */
export function Girando({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="girando flex-none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
