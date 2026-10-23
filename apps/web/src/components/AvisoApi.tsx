'use client';

import Link from 'next/link';
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
    case 'sin_sesion':
      return { titulo: 'Tu sesión venció', detalle: 'Volvé a iniciar sesión para seguir.' };
    case 'falta_cuit':
      return { titulo: 'Falta tu CUIT', detalle: e.mensaje };
    case 'sin_conexion':
      return { titulo: 'No pudimos hablar con la API de Facti', detalle: `${e.mensaje} Levantala con pnpm dev:api.` };
    default:
      return { titulo: 'Algo salió mal', detalle: e.mensaje };
  }
}

/** Panel para cuando una pantalla no puede cargar sus datos. */
export function AvisoApi({ error, onReintentar, compacto }: { error: ErrorApi; onReintentar?: () => void; compacto?: boolean }) {
  const { titulo, detalle } = textos(error);
  // Para estos dos casos, la acción útil es ir a otra pantalla, no reintentar.
  const accion =
    error.codigo === 'sin_sesion' ? { href: '/ingresar', texto: 'Iniciar sesión' } : error.codigo === 'falta_cuit' ? { href: '/onboarding/perfil', texto: 'Cargar mi CUIT' } : null;
  if (accion) {
    return (
      <div role="alert" className={`flex ${compacto ? 'flex-wrap items-center justify-between rounded-[16px] bg-aviso-suave px-4 py-3 text-sm text-aviso-texto' : 'flex-col items-center px-4 py-12 text-center'} gap-3`}>
        {!compacto && <Facti pose="senalando" size={130} animated={false} />}
        <span className={compacto ? '' : 'flex flex-col gap-1'}>
          {compacto ? <strong>{titulo}. </strong> : <h2 className="text-[20px] font-bold text-texto">{titulo}</h2>}
          <span className={compacto ? '' : 'text-texto-suave'}>{detalle}</span>
        </span>
        <Link href={accion.href} className="btn-lift rounded-full bg-primario px-5 py-2.5 font-extrabold text-white shadow-boton">
          {accion.texto}
        </Link>
      </div>
    );
  }
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
