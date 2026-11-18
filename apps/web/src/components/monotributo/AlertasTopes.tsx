'use client';

import Link from 'next/link';
import { Icon, type IconName } from '@/components/Icon';
import type { AlertaTope } from '@/lib/api';

const ESTILO: Record<AlertaTope['nivel'], { caja: string; icono: string; nombre: IconName }> = {
  peligro: { caja: 'bg-error-suave', icono: 'bg-white text-error', nombre: 'alerta-triangulo' },
  aviso: { caja: 'bg-aviso-suave', icono: 'bg-white text-aviso-texto', nombre: 'alerta' },
  info: { caja: 'bg-primario-suave', icono: 'bg-white text-primario-oscuro', nombre: 'info' },
};

/** Qué hacer con cada alerta. */
function accion(codigo: string): { href: string; texto: string } | null {
  switch (codigo) {
    case 'subir_categoria':
    case 'bajar_categoria':
    case 'tope_cerca':
      return { href: '/guias/recategorizacion', texto: 'Cómo recategorizarte' };
    case 'superaste_k':
    case 'zona_exclusion':
    case 'exclusion_cerca':
      return { href: '/monotributo/categorias', texto: 'Ver los topes' };
  }
  return null;
}

/** Avisos de topes del monotributo (categoría, recategorización y exclusión). No muestra nada si no hay. */
export function AlertasTopes({ alertas }: { alertas?: AlertaTope[] | null }) {
  if (!alertas?.length) return null;
  return (
    <div className="cascada flex flex-col gap-3">
      {alertas.map((a) => {
        const e = ESTILO[a.nivel];
        const ac = accion(a.codigo);
        return (
          <div key={a.codigo} role={a.nivel === 'peligro' ? 'alert' : undefined} className={`flex flex-wrap items-center gap-x-4 gap-y-3 rounded-tarjeta px-5 py-4 ${e.caja}`}>
            <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-[14px] ${e.icono}`}>
              <Icon name={e.nombre} size={22} />
            </span>
            <div className="flex min-w-0 flex-[1_1_320px] flex-col">
              <strong>{a.titulo}</strong>
              <p className="text-texto-suave">{a.texto}</p>
            </div>
            {ac && (
              <Link href={ac.href} className="btn-lift inline-flex h-11 flex-none items-center gap-2 rounded-full bg-white px-5 font-bold text-texto shadow-tarjeta">
                {ac.texto}
                <Icon name="chevron-derecha" size={16} />
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
