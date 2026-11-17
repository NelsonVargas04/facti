'use client';

import { Icon } from '@/components/Icon';
import { Select } from '@/components/Select';

/** Páginas a mostrar: siempre la primera, la última y las vecinas de la actual; el resto, "…". */
function paginas(actual: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, actual - 1, actual, actual + 1].filter((n) => n >= 1 && n <= total));
  const orden = [...set].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  orden.forEach((n, i) => {
    if (i > 0 && n - orden[i - 1]! > 1) out.push('…');
    out.push(n);
  });
  return out;
}

const OPCIONES = [10, 25, 50].map((n) => ({ value: String(n), label: `${n} por página` }));

/**
 * Pie de las listas: cuántos hay ("1–10 de 34 facturas"), cuántos por página y los botones de página.
 * En el celular, las páginas se resumen en "Página 2 de 4" con anterior y siguiente.
 */
export function Paginacion({
  total,
  pagina,
  porPagina,
  onPagina,
  onPorPagina,
  singular,
  plural,
}: {
  total: number;
  pagina: number;
  porPagina: number;
  onPagina: (p: number) => void;
  onPorPagina?: (n: number) => void;
  singular: string;
  plural: string;
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const actual = Math.min(pagina, totalPaginas);
  const desde = total ? (actual - 1) * porPagina + 1 : 0;
  const hasta = Math.min(actual * porPagina, total);
  const boton =
    'flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-[12px] px-3 font-semibold text-texto-suave transition-colors hover:bg-fondo hover:text-texto disabled:pointer-events-none disabled:opacity-40';

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <p className="text-texto-suave">
        {total === 0 ? (
          `0 ${plural}`
        ) : total <= porPagina ? (
          <>
            <strong className="text-texto tabular-nums">{total}</strong> {total === 1 ? singular : plural}
          </>
        ) : (
          <>
            <strong className="text-texto tabular-nums">
              {desde}–{hasta}
            </strong>{' '}
            de <strong className="text-texto tabular-nums">{total}</strong> {plural}
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {onPorPagina && total > 10 && (
          <div className="w-[170px]">
            <Select ariaLabel="Cantidad por página" value={String(porPagina)} onChange={(v) => onPorPagina(Number(v))} options={OPCIONES} />
          </div>
        )}

        {totalPaginas > 1 && (
          <nav aria-label="Páginas" className="flex items-center gap-1 rounded-[14px] bg-fondo p-1">
            <button type="button" onClick={() => onPagina(actual - 1)} disabled={actual === 1} aria-label="Página anterior" className={boton}>
              <Icon name="volver" size={18} />
              <span className="hidden sm:inline">Anterior</span>
            </button>

            {/* Celular: resumen */}
            <span className="px-2 font-semibold tabular-nums text-texto sm:hidden">
              {actual} de {totalPaginas}
            </span>

            {/* Compu: números */}
            <span className="hidden items-center gap-1 sm:flex">
              {paginas(actual, totalPaginas).map((n, i) =>
                n === '…' ? (
                  <span key={`e${i}`} className="px-1 text-texto-tenue" aria-hidden="true">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onPagina(n)}
                    aria-current={n === actual ? 'page' : undefined}
                    className={`h-10 min-w-10 rounded-[12px] px-2 font-bold tabular-nums transition-colors ${
                      n === actual ? 'bg-primario text-white shadow-[0_4px_12px_rgba(59,63,216,0.25)]' : 'text-texto-suave hover:bg-white hover:text-texto'
                    }`}
                  >
                    {n}
                  </button>
                ),
              )}
            </span>

            <button type="button" onClick={() => onPagina(actual + 1)} disabled={actual === totalPaginas} aria-label="Página siguiente" className={boton}>
              <span className="hidden sm:inline">Siguiente</span>
              <Icon name="flecha-derecha" size={18} />
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
