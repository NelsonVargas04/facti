'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigurado } from '@/lib/supabase';

export type EstadoSesion = { estado: 'cargando' } | { estado: 'sin_configurar' } | { estado: 'sin_sesion' } | { estado: 'con_sesion'; sesion: Session };

/** Sesión de Supabase Auth, al día con los cambios (entrar, salir, renovar el token). */
export function useSesion(): EstadoSesion {
  const [st, setSt] = useState<EstadoSesion>(supabaseConfigurado ? { estado: 'cargando' } : { estado: 'sin_configurar' });

  useEffect(() => {
    const s = supabase();
    if (!s) return;
    let vivo = true;
    void s.auth.getSession().then(({ data }) => {
      if (vivo) setSt(data.session ? { estado: 'con_sesion', sesion: data.session } : { estado: 'sin_sesion' });
    });
    const { data } = s.auth.onAuthStateChange((_evento, sesion) => {
      if (vivo) setSt(sesion ? { estado: 'con_sesion', sesion } : { estado: 'sin_sesion' });
    });
    return () => {
      vivo = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return st;
}

export async function cerrarSesion() {
  await supabase()?.auth.signOut();
}
