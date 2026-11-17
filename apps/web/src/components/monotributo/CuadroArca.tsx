'use client';

import type { CategoriaMonotributo, EscalaMonotributo } from '@/lib/api';

const exacto = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Cuadro de categorías con el mismo orden y encabezados que el de ARCA
 * (arca.gob.ar/monotributo/categorias.asp), para compu. La fila de tu categoría va marcada.
 */
export function CuadroArca({ escala, tuya, ideal }: { escala: EscalaMonotributo; tuya?: string; ideal?: string }) {
  const th = 'border border-white/15 px-2 py-2.5 font-semibold leading-tight';
  const td = 'border border-[#E3E7F0] px-2 py-2.5 text-center tabular-nums whitespace-nowrap';
  const celdas: ((c: CategoriaMonotributo) => string)[] = [
    (c) => exacto(c.tope),
    (c) => c.superficie,
    (c) => c.energia,
    (c) => exacto(c.alquileres),
    (c) => exacto(c.precioMaximo),
    (c) => exacto(c.impServicios),
    (c) => exacto(c.impVentas),
    (c) => exacto(c.sipa),
    (c) => exacto(c.obraSocial),
    (c) => exacto(c.cuotaServicios),
    (c) => exacto(c.cuotaVentas),
  ];

  return (
    <div className="overflow-x-auto rounded-[16px] border border-[#DCE1EC] bg-white">
      <table className="w-full border-collapse">
        <caption className="px-4 py-3 text-left text-texto-suave">Cuadro de categorías y valores del monotributo</caption>
        <thead className="bg-[#232A5C] text-white">
          <tr>
            <th rowSpan={2} scope="col" className={`${th} sticky left-0 z-10 bg-[#232A5C]`}>Categ.</th>
            <th rowSpan={2} scope="col" className={th}>Ingresos brutos</th>
            <th rowSpan={2} scope="col" className={th}>Sup. afectada</th>
            <th rowSpan={2} scope="col" className={th}>Energía eléctrica consumida anualmente</th>
            <th rowSpan={2} scope="col" className={th}>Alquileres devengados anualmente</th>
            <th rowSpan={2} scope="col" className={th}>Precio unitario máximo para venta de cosas muebles</th>
            <th colSpan={2} scope="colgroup" className={th}>Impuesto integrado</th>
            <th rowSpan={2} scope="col" className={th}>Aportes al SIPA</th>
            <th rowSpan={2} scope="col" className={th}>Aportes obra social</th>
            <th colSpan={2} scope="colgroup" className={th}>Total</th>
          </tr>
          <tr>
            <th scope="col" className={th}>Locaciones y prestaciones de servicios</th>
            <th scope="col" className={th}>Venta de cosas muebles</th>
            <th scope="col" className={th}>Locaciones y prestaciones de servicios</th>
            <th scope="col" className={th}>Venta de cosas muebles</th>
          </tr>
        </thead>
        <tbody>
          {escala.categorias.map((c) => {
            const esTuya = c.letra === tuya;
            const esIdeal = c.letra === ideal && !esTuya;
            const fondo = esTuya ? 'bg-[#E4E5FF]' : esIdeal ? 'bg-[#FFF3D1]' : 'bg-white even:bg-[#F6F7FA]';
            return (
              <tr key={c.letra} className={fondo}>
                <th scope="row" className={`${td} sticky left-0 z-10 font-bold ${esTuya ? 'bg-[#E4E5FF] text-primario-oscuro' : esIdeal ? 'bg-[#FFF3D1]' : 'bg-inherit'}`}>
                  <span className="flex items-center justify-center gap-2">
                    {c.letra}
                    {esTuya && <span className="rounded-full bg-primario px-2 text-white">Tuya</span>}
                    {esIdeal && <span className="rounded-full bg-[#E0A100] px-2 text-white">Ideal</span>}
                  </span>
                </th>
                {celdas.map((f, i) => (
                  <td key={i} className={`${td} ${i === 0 || i >= 9 ? 'font-semibold text-texto' : 'text-texto-suave'}`}>
                    {f(c)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
