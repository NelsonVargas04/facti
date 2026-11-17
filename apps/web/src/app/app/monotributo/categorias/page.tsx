'use client';

import { AvisoApi } from '@/components/AvisoApi';
import { BackLink } from '@/components/BackLink';
import { categoriaQueCorresponde, fechaAR, TablaCategorias, topes } from '@/components/monotributo/Categorias';
import { verCategorias, verCuenta, verResumen } from '@/lib/api';
import { useApi } from '@/lib/useApi';

/** Cuadro oficial de categorías del monotributo, leído de ARCA (se actualiza solo). */
export default function CategoriasMonotributo() {
  const escala = useApi(verCategorias, []);
  const cuenta = useApi(verCuenta, []);
  const resumen = useApi(() => verResumen(), []);
  const e = escala.dato;
  const categoria = cuenta.dato?.cuenta.categoria;
  const facturado = resumen.dato?.ultimos12Meses.facturado;
  const corresponde = facturado !== undefined ? categoriaQueCorresponde(facturado, topes(e)) : null;

  return (
    <>
      <div className="aparece flex flex-col gap-1">
        <BackLink href="/app/monotributo/pagos">Volver a Monotributo</BackLink>
        <h1 className="text-[28px] font-bold leading-tight sm:text-[34px]">Categorías del monotributo</h1>
        <p className="text-texto-suave">
          {e
            ? `Valores de ARCA vigentes desde el ${fechaAR(e.vigenteDesde)}. ${e.origen === 'arca' ? 'Se actualizan solos desde ARCA.' : 'No pudimos consultar ARCA ahora: mostramos la última tabla conocida.'}`
            : 'Topes y cuotas de cada categoría, tal como los publica ARCA.'}
        </p>
      </div>

      {escala.estado === 'error' && !e ? (
        <AvisoApi error={escala.error} onReintentar={escala.recargar} />
      ) : !e ? (
        <div className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-12 rounded-[14px]" />
          ))}
        </div>
      ) : (
        <TablaCategorias escala={e} categoria={categoria} corresponde={corresponde} />
      )}
    </>
  );
}
