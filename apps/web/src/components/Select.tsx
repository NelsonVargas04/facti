'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type Opcion = { value: string; label: string };

function normalizar(options: (Opcion | string)[]): Opcion[] {
  return options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
}
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Posicion {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (Opcion | string)[];
  placeholder?: string;
  ariaLabel?: string;
  /** Mostrar buscador. Por defecto se activa solo cuando hay 8+ opciones. */
  searchable?: boolean;
  className?: string;
}

/**
 * Dropdown con el estilo de Facti (reemplaza al <select> nativo):
 * - se abre en un portal, así ningún contenedor con overflow lo recorta;
 * - se acomoda arriba o abajo según el espacio y limita su alto para no cortarse nunca;
 * - buscador para listas largas; navegable con teclado.
 */
export function Select({ value, onChange, options, placeholder = 'Elegí una opción', ariaLabel, searchable, className = '' }: SelectProps) {
  const opts = useMemo(() => normalizar(options), [options]);
  const conBuscador = searchable ?? opts.length >= 8;
  const seleccionada = opts.find((o) => o.value === value);

  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState('');
  const [resaltado, setResaltado] = useState(0);
  const [pos, setPos] = useState<Posicion | null>(null);

  const botonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buscadorRef = useRef<HTMLInputElement>(null);
  const opcionRef = useRef<HTMLButtonElement>(null);

  const filtradas = useMemo(() => {
    if (!q.trim()) return opts;
    const n = norm(q);
    return opts.filter((o) => norm(o.label).includes(n));
  }, [opts, q]);

  function reposicionar() {
    const b = botonRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const margen = 8;
    const altoBuscador = conBuscador ? 52 : 0;
    const deseado = Math.min(320, altoBuscador + opts.length * 42 + 12);
    const abajo = window.innerHeight - r.bottom - margen;
    const arriba = r.top - margen;

    let p: Posicion;
    if (abajo >= deseado || abajo >= arriba) {
      p = { left: r.left, width: r.width, top: r.bottom + 6, maxHeight: Math.max(140, Math.min(deseado, abajo)) };
    } else {
      p = { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 6, maxHeight: Math.max(140, Math.min(deseado, arriba)) };
    }
    setPos(p);
  }

  function abrir() {
    setQ('');
    setResaltado(Math.max(0, opts.findIndex((o) => o.value === value)));
    reposicionar();
    setAbierto(true);
  }

  useLayoutEffect(() => {
    if (!abierto) return;
    reposicionar();
    if (conBuscador) requestAnimationFrame(() => buscadorRef.current?.focus());
    const onScroll = () => reposicionar();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  useEffect(() => {
    if (abierto) opcionRef.current?.scrollIntoView({ block: 'nearest' });
  }, [resaltado, abierto]);

  useEffect(() => {
    if (!abierto) return;
    function onDown(e: PointerEvent) {
      const t = e.target as Node;
      if (botonRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setAbierto(false);
    }
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [abierto]);

  function elegir(v: string) {
    onChange(v);
    setAbierto(false);
    botonRef.current?.focus();
  }

  function navKeys(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setAbierto(false);
      botonRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setResaltado((i) => Math.min(filtradas.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setResaltado((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = filtradas[resaltado];
      if (o) elegir(o.value);
    }
  }

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        role="combobox"
        aria-expanded={abierto}
        aria-label={ariaLabel}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={(e) => {
          if (!abierto && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            abrir();
          } else if (abierto && !conBuscador) {
            navKeys(e);
          }
        }}
        className={`flex h-12 w-full items-center justify-between gap-2 rounded-input border-[1.5px] bg-white px-4 text-left text-base outline-none transition-all ${
          abierto ? 'border-primario ring-[3px] ring-primario/15' : 'border-borde hover:border-[#B9BED3]'
        } ${seleccionada ? 'text-texto' : 'text-texto-tenue'} ${className}`}
      >
        <span className="truncate">{seleccionada ? seleccionada.label : placeholder}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`flex-none text-texto-tenue transition-transform ${abierto ? 'rotate-180' : ''}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {abierto && pos && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            className="dropdown-anim z-50 flex flex-col overflow-hidden rounded-[18px] border border-[#E6EAF2] bg-white shadow-[0_18px_44px_rgba(21,25,58,0.18)]"
            style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, minWidth: 190, maxHeight: pos.maxHeight }}
          >
            {conBuscador && (
              <div className="border-b border-[#EEF1F6] p-2">
                <div className="flex items-center gap-2 rounded-[12px] bg-fondo px-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none text-texto-tenue"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
                  <input
                    ref={buscadorRef}
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setResaltado(0);
                    }}
                    onKeyDown={navKeys}
                    placeholder="Buscar…"
                    className="h-10 w-full bg-transparent text-[15px] text-texto outline-none placeholder:text-texto-tenue"
                  />
                </div>
              </div>
            )}

            <div className="scroll-fino flex flex-col gap-0.5 overflow-auto p-2">
              {filtradas.length === 0 ? (
                <div className="px-3 py-3 text-sm text-texto-tenue">Sin resultados</div>
              ) : (
                filtradas.map((o, i) => {
                  const sel = o.value === value;
                  const hl = i === resaltado;
                  return (
                    <button
                      key={o.value}
                      ref={hl ? opcionRef : undefined}
                      type="button"
                      role="option"
                      aria-selected={sel}
                      onMouseEnter={() => setResaltado(i)}
                      onClick={() => elegir(o.value)}
                      className={`flex w-full items-center justify-between gap-2 rounded-[12px] px-3 py-2.5 text-left text-[15px] transition-colors ${
                        sel ? 'bg-primario-suave font-extrabold text-primario-oscuro' : hl ? 'bg-fondo text-texto' : 'text-texto'
                      }`}
                    >
                      <span className="truncate">{o.label}</span>
                      {sel && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
