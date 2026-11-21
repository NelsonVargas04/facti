'use client';

import Link from 'next/link';
import { Icon } from '@/components/Icon';
import type { ErrorApi } from '@/lib/api';

/** Qué decirle al usuario según el error de la API. */
function textos(e: ErrorApi): { titulo: string; detalle: string } {
  switch (e.codigo) {
    case 'base_datos':
      // El detalle técnico queda en el log de la API; al usuario no se le muestra.
      return process.env.NODE_ENV === 'development'
        ? { titulo: 'Falta conectar la base de datos', detalle: 'Revisá DATABASE_URL en el .env de la raíz y el log de la API.' }
        : { titulo: 'Facti no está disponible ahora', detalle: e.mensaje };
    case 'configuracion':
      return { titulo: 'Facti no está disponible ahora', detalle: e.mensaje };
    case 'sin_sesion':
      return { titulo: 'Tu sesión venció', detalle: 'Volvé a iniciar sesión para seguir.' };
    case 'falta_cuit':
      return { titulo: 'Falta tu CUIT', detalle: e.mensaje };
    case 'sin_conexion':
      return process.env.NODE_ENV === 'development'
        ? { titulo: 'No pudimos conectarnos con Facti', detalle: `${e.mensaje} Levantala con pnpm dev:api.` }
        : { titulo: 'No pudimos conectarnos con Facti', detalle: 'Revisá tu conexión a internet y probá de nuevo en un ratito.' };
    default:
      return { titulo: 'No pudimos cargar esta parte', detalle: e.mensaje };
  }
}

/** Tarjeta del aviso: a todo el ancho del contenido, como las demás tarjetas de la app. */
const tarjetaAviso = 'flex w-full flex-wrap items-center gap-x-5 gap-y-4 rounded-tarjeta bg-superficie p-5 shadow-tarjeta sm:p-6';

/** Ícono del aviso en un cuadradito de color, igual que en las tarjetas del inicio. */
function IconoAviso({ tono }: { tono: 'aviso' | 'error' }) {
  return (
    <span className={`flex h-12 w-12 flex-none items-center justify-center rounded-[14px] ${tono === 'error' ? 'bg-error-suave text-error' : 'bg-aviso-suave text-aviso-texto'}`}>
      <Icon name={tono === 'error' ? 'alerta-triangulo' : 'alerta'} size={24} />
    </span>
  );
}

/** Panel para cuando una pantalla no puede cargar sus datos. */
export function AvisoApi({ error, onReintentar, compacto }: { error: ErrorApi; onReintentar?: () => void; compacto?: boolean }) {
  const { titulo, detalle } = textos(error);
  // Para estos dos casos, la acción útil es ir a otra pantalla, no reintentar.
  const accion =
    error.codigo === 'sin_sesion' ? { href: '/ingresar', texto: 'Iniciar sesión' } : error.codigo === 'falta_cuit' ? { href: '/onboarding/perfil', texto: 'Cargar mi CUIT' } : null;

  if (compacto) {
    return (
      <div role="alert" className="aviso-entra flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-aviso-suave px-4 py-3 text-base text-aviso-texto">
        <span>
          <strong>{titulo}.</strong> {detalle}
        </span>
        {accion ? (
          <Link href={accion.href} className="rounded-full bg-white px-3.5 py-1.5 font-bold text-texto shadow-chip">
            {accion.texto}
          </Link>
        ) : (
          onReintentar && (
            <button type="button" onClick={onReintentar} className="rounded-full bg-white px-3.5 py-1.5 font-bold text-texto shadow-chip">
              Reintentar
            </button>
          )
        )}
      </div>
    );
  }

  return (
    <div role="alert" className={`entra ${tarjetaAviso}`}>
      {/* Ícono y texto siempre juntos; el botón baja abajo si no entra. */}
      <div className="flex min-w-0 flex-[1_1_280px] items-start gap-4">
        <IconoAviso tono={accion ? 'aviso' : 'error'} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-[18px] font-bold">{titulo}</h2>
          <p className="text-texto-suave">{detalle}</p>
        </div>
      </div>
      {accion ? (
        <Link href={accion.href} className="btn-lift inline-flex h-11 flex-none items-center justify-center rounded-full bg-primario px-5 font-bold text-white shadow-boton">
          {accion.texto}
        </Link>
      ) : (
        onReintentar && (
          <button type="button" onClick={onReintentar} className="btn-lift inline-flex h-11 flex-none items-center justify-center gap-2 rounded-full border-[1.5px] border-borde px-5 font-bold text-texto hover:border-primario hover:text-primario-oscuro">
            Reintentar
          </button>
        )
      )}
    </div>
  );
}
