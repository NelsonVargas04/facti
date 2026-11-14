'use client';

import { useEffect, useRef, useState } from 'react';
import { ALTO, ANCHO, Escenario, duracionTotal } from '@/components/guia/RecorridoArca';
import { CUIT_FACTI } from '@/lib/cuitFacti';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Reproductor de la guía: se adapta al ancho, con play/pausa, barra para adelantar y velocidad. */
export function ReproductorArca() {
  const total = duracionTotal(CUIT_FACTI);
  const [t, setT] = useState(0);
  const [jugando, setJugando] = useState(false);
  const [velocidad, setVelocidad] = useState(1);
  const [escala, setEscala] = useState(0.5);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setEscala(el.clientWidth / ANCHO);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!jugando) return;
    let previo = performance.now();
    let id = 0;
    const paso = (ahora: number) => {
      const dt = (ahora - previo) / 1000;
      previo = ahora;
      setT((x) => {
        const n = x + dt * velocidad;
        if (n >= total) {
          setJugando(false);
          return total;
        }
        return n;
      });
      id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [jugando, velocidad, total]);

  return (
    <div className="flex flex-col gap-3">
      <div ref={caja} className="relative w-full overflow-hidden rounded-[20px] bg-[#0F1330] shadow-tarjeta-lg" style={{ height: ALTO * escala }}>
        <div style={{ width: ANCHO, height: ALTO, zoom: escala }}>
          <Escenario t={t} cuitFacti={CUIT_FACTI} />
        </div>
        {!jugando && (
          <button
            type="button"
            onClick={() => {
              if (t >= total) setT(0);
              setJugando(true);
            }}
            className="absolute inset-0 flex items-center justify-center bg-[#15193A]/25 transition-colors hover:bg-[#15193A]/35"
            aria-label={t > 0 && t < total ? 'Seguir viendo la guía' : 'Ver la guía'}
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-tarjeta-lg">
              <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="#3B3FD8" /></svg>
            </span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (t >= total ? (setT(0), setJugando(true)) : setJugando((j) => !j))}
          className="btn-lift inline-flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primario text-white"
          aria-label={jugando ? 'Pausar' : 'Reproducir'}
        >
          {jugando ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>
        <input
          type="range"
          min={0}
          max={total}
          step={0.1}
          value={t}
          onChange={(e) => setT(Number(e.target.value))}
          aria-label="Avanzar o retroceder la guía"
          className="h-2 flex-1 cursor-pointer accent-primario"
        />
        <span className="w-[86px] flex-none text-right text-[14px] tabular-nums text-texto-suave">{fmt(t)} / {fmt(total)}</span>
        <button
          type="button"
          onClick={() => setVelocidad((v) => (v === 1 ? 0.75 : v === 0.75 ? 0.5 : 1))}
          className="h-9 flex-none rounded-full border-[1.5px] border-borde bg-white px-3 text-[14px] font-semibold text-texto hover:border-primario"
          aria-label="Cambiar la velocidad"
        >
          {velocidad === 1 ? 'Normal' : velocidad === 0.75 ? 'Lento' : 'Muy lento'}
        </button>
      </div>
    </div>
  );
}
