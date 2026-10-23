'use client';

import { Facti } from '@/components/Facti';
import type { ErrorApi } from '@/lib/api';

/** Qué decirle al usuario según el error de la API. */
function textos(e: ErrorApi): { titulo: string; detalle: string } {
  switch (e.codigo) {
    case 'base_datos':
      return {
        titulo: 'Falta conectar la base de datos',
        detalle: `${e.mensaje}. Cargá la URL de Supabase en DATABASE_URL (archivo .env de la raíz) y reiniciá la API.`,
      };
    case 'configuracion':
      return { titulo: 'Falta terminar la configuración', detalle: e.mensaje };
    case 'sin_conexion':
      return { titulo: 'No pudimos hablar con la API de Facti', detalle: `${e.mensaje} Levantala con pnpm dev:api.` };
    default:
      return { titulo: 'Algo salió mal', detalle: e.mensaje };
  }
}

/** Panel para cuando una pantalla no puede cargar sus datos. */
export function AvisoApi({ error, onReintentar, compacto }: { error: ErrorApi; onReintentar?: () => void; compacto?: boolean }) {
  const { titulo, detalle } = textos(error);
  if (compacto) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-aviso-suave px-4 py-3 text-sm text-aviso-texto">
        <span>
          <strong>{titulo}.</strong> {detalle}
        </span>
        {onReintentar && (
          <button type="button" onClick={onReintentar} className="rounded-full bg-white px-3.5 py-1.5 font-extrabold text-texto shadow-chip">
            Reintentar
          </button>
        )}
      </div>
    );
  }
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <Facti pose="durmiendo" size={140} animated />
      <h2 className="text-[20px] font-bold">{titulo}</h2>
      <p className="max-w-[460px] text-texto-suave">{detalle}</p>
      {onReintentar && (
        <button type="button" onClick={onReintentar} className="btn-lift mt-1 rounded-full bg-primario px-6 py-3 font-extrabold text-white shadow-boton">
          Reintentar
        </button>
      )}
    </div>
  );
}
