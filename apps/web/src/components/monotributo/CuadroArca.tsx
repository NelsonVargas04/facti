'use client';

import { useEffect, useRef, useState } from 'react';
import type { CategoriaMonotributo, EscalaMonotributo } from '@/lib/api';

const exacto = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Col = { t: string; v: (c: CategoriaMonotributo) => string; texto?: boolean; fuerte?: boolean };

/** Columnas en el mismo orden que el cuadro de ARCA, con títulos más cortos. */
const SUELTAS_1: Col[] = [
  { t: 'Ingresos brutos', v: (c) => exacto(c.tope), fuerte: true },
  { t: 'Superficie', v: (c) => c.superficie.replace(/^Hasta /, 'hasta '), texto: true },
  { t: 'Energía', v: (c) => c.energia.replace(/^Hasta /, 'hasta '), texto: true },
  { t: 'Alquileres', v: (c) => exacto(c.alquileres) },
  { t: 'Precio máximo', v: (c) => exacto(c.precioMaximo) },
];
const IMPUESTO: Col[] = [
  { t: 'Servicios', v: (c) => exacto(c.impServicios) },
  { t: 'Ventas', v: (c) => exacto(c.impVentas) },
];
const SUELTAS_2: Col[] = [
  { t: 'Aportes SIPA', v: (c) => exacto(c.sipa) },
  { t: 'Obra social', v: (c) => exacto(c.obraSocial) },
];
const TOTAL: Col[] = [
  { t: 'Servicios', v: (c) => exacto(c.cuotaServicios), fuerte: true },
  { t: 'Ventas', v: (c) => exacto(c.cuotaVentas), fuerte: true },
];

/**
 * Cuadro de categorías con el mismo orden que el de ARCA (arca.gob.ar/monotributo/categorias.asp), para compu.
 * Tu categoría va en lila y la que te corresponde por ingresos en ámbar.
 */
export function CuadroArca({ escala, tuya, ideal }: { escala: EscalaMonotributo; tuya?: string; ideal?: string }) {
  const caja = useRef<HTMLDivElement>(null);
  const [desplazado, setDesplazado] = useState(false);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ver = () => setDesplazado(el.scrollLeft > 4);
    el.addEventListener('scroll', ver, { passive: true });
    return () => el.removeEventListener('scroll', ver);
  }, []);

  const th = 'whitespace-nowrap border-b border-l border-white/15 px-2.5 py-3 font-semibold leading-tight';
  const td = 'border-b border-l border-[#E8EBF2] px-2.5 py-3 tabular-nums whitespace-nowrap';
  const fija = `sticky left-0 z-10 transition-shadow ${desplazado ? 'shadow-[6px_0_10px_-6px_rgba(21,25,58,0.25)]' : ''}`;
  const todas = [...SUELTAS_1, ...IMPUESTO, ...SUELTAS_2, ...TOTAL];
  const ideal2 = ideal && ideal !== tuya ? ideal : undefined;

  return (
    <div className="flex flex-col gap-3">
      {(
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-texto-suave">
          {tuya && (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 rounded-full bg-primario" /> Tu categoría actual ({tuya})
            </span>
          )}
          {ideal2 && (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 rounded-full bg-[#E0A100]" /> La que te corresponde por lo que facturaste ({ideal2})
            </span>
          )}
          <span>Ingresos, energía y alquileres son anuales. El precio máximo es por unidad, para venta de cosas muebles.</span>
        </div>
      )}

      <div ref={caja} className="overflow-x-auto rounded-[18px] border border-[#DCE1EC] bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-[#232A5C] text-white">
            <tr>
              <th rowSpan={2} scope="col" className={`${th} ${fija} border-l-0 bg-[#232A5C] text-center`}>Categoría</th>
              {SUELTAS_1.map((c) => (
                <th key={c.t} rowSpan={2} scope="col" className={`${th} text-center`}>{c.t}</th>
              ))}
              <th colSpan={2} scope="colgroup" className={`${th} text-center`}>Impuesto integrado</th>
              {SUELTAS_2.map((c) => (
                <th key={c.t} rowSpan={2} scope="col" className={`${th} text-center`}>{c.t}</th>
              ))}
              <th colSpan={2} scope="colgroup" className={`${th} bg-[#2E3778] text-center`}>Cuota mensual total</th>
            </tr>
            <tr>
              {IMPUESTO.map((c) => (
                <th key={c.t} scope="col" className={`${th} text-center font-medium`}>{c.t}</th>
              ))}
              {TOTAL.map((c) => (
                <th key={c.t} scope="col" className={`${th} bg-[#2E3778] text-center font-medium`}>{c.t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {escala.categorias.map((c, i) => {
              const esTuya = c.letra === tuya;
              const esIdeal = c.letra === ideal2;
              // Color sólido (no heredado): la columna fija tapa bien lo que pasa por detrás al desplazar.
              const color = esTuya ? '#EEEFFF' : esIdeal ? '#FFF6DD' : i % 2 ? '#F7F8FB' : '#FFFFFF';
              return (
                <tr key={c.letra} style={{ backgroundColor: color }}>
                  <th scope="row" className={`${td} ${fija} border-l-0 text-center`} style={{ backgroundColor: color }}>
                    <span
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-full font-bold ${
                        esTuya ? 'bg-primario text-white' : esIdeal ? 'bg-[#E0A100] text-white' : 'bg-[#ECEEF5] text-texto'
                      }`}
                      title={esTuya ? 'Tu categoría actual' : esIdeal ? 'La que te corresponde' : undefined}
                    >
                      {c.letra}
                    </span>
                  </th>
                  {todas.map((col, j) => (
                    <td key={j} className={`${td} text-center ${col.fuerte ? 'font-semibold text-texto' : 'text-texto-suave'}`}>
                      {col.v(c)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
