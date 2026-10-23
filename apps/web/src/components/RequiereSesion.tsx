'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Facti } from '@/components/Facti';
import { useSesion } from '@/lib/sesion';

/** Muestra el contenido solo con sesión iniciada; si no, manda a /ingresar y vuelve después. */
export function RequiereSesion({ children }: { children: React.ReactNode }) {
  const sesion = useSesion();
  const router = useRouter();
  const ruta = usePathname();

  useEffect(() => {
    if (sesion.estado === 'sin_sesion') router.replace(`/ingresar?volver=${encodeURIComponent(ruta)}`);
  }, [sesion.estado, router, ruta]);

  if (sesion.estado === 'con_sesion') return <>{children}</>;
  if (sesion.estado === 'sin_configurar') {
    return (
      <div role="alert" className="mx-auto flex max-w-[520px] flex-col items-center gap-3 px-4 py-20 text-center">
        <Facti pose="durmiendo" size={140} animated />
        <h1 className="text-[22px] font-bold">Falta configurar el inicio de sesión</h1>
        <p className="text-texto-suave">
          Cargá <code>NEXT_PUBLIC_SUPABASE_URL</code> y <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> en el <code>.env</code> de la raíz
          y reiniciá la web. Están en Supabase, en Project Settings → API Keys.
        </p>
      </div>
    );
  }
  return (
    <div aria-busy="true" aria-label="Cargando" className="flex min-h-[60vh] items-center justify-center">
      <div className="skeleton h-12 w-12 rounded-full" />
    </div>
  );
}
