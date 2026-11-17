'use client';

/**
 * Tarjeta de listado, igual en todas las pantallas (facturas, cobros, clientes):
 * arriba la barra (buscador, filtros o pestañas), en el medio la lista y abajo el pie (cantidad y páginas).
 */
export function TarjetaLista({
  barra,
  pie,
  children,
  ocupado = false,
}: {
  barra?: React.ReactNode;
  pie?: React.ReactNode;
  children: React.ReactNode;
  ocupado?: boolean;
}) {
  return (
    <section aria-busy={ocupado} className="aparece flex flex-col overflow-hidden rounded-tarjeta bg-superficie shadow-tarjeta md:min-h-[480px]">
      {barra && <div className="border-b border-[#EDF0F6] p-4 sm:px-6 sm:py-5">{barra}</div>}
      <div className="flex flex-1 flex-col px-4 py-2 sm:px-6 sm:py-3">{children}</div>
      {pie && <div className="border-t border-[#EDF0F6] px-4 py-4 sm:px-6">{pie}</div>}
    </section>
  );
}

/** Buscador con lupa, el mismo en todas las listas. */
export function Buscador({ valor, onCambio, placeholder, className = '' }: { valor: string; onCambio: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <label className={`flex h-12 min-w-0 items-center gap-2 rounded-input border-[1.5px] border-borde bg-white px-4 transition-colors focus-within:border-primario ${className}`}>
      <span className="sr-only">Buscar</span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none text-texto-tenue">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-4-4" />
      </svg>
      <input value={valor} onChange={(e) => onCambio(e.target.value)} placeholder={placeholder} className="h-full w-full min-w-0 bg-transparent text-base text-texto outline-none placeholder:text-texto-tenue" />
    </label>
  );
}

/** Pestañas segmentadas (Pendientes / Cobradas / Todas), las mismas en toda la app. */
export function Segmentos<T extends string>({ opciones, valor, onCambio, etiqueta }: { opciones: [T, string][]; valor: T; onCambio: (v: T) => void; etiqueta: string }) {
  return (
    <div role="tablist" aria-label={etiqueta} className="grid w-full grid-flow-col gap-1 rounded-input bg-fondo p-1 sm:inline-grid sm:w-auto">
      {opciones.map(([id, texto]) => {
        const on = id === valor;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onCambio(id)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 transition-colors ${on ? 'bg-white font-bold text-texto shadow-[0_2px_8px_rgba(21,25,58,0.08)]' : 'font-semibold text-texto-suave hover:text-texto'}`}
          >
            {texto}
          </button>
        );
      })}
    </div>
  );
}
