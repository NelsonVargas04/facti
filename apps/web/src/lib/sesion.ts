'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import { alCambiarDemo, demoHabilitado, EMAIL_DEMO, enDemo, salirDemo, TOKEN_DEMO } from '@/lib/demo';

export type EstadoSesion = { estado: 'cargando' } | { estado: 'sin_configurar' } | { estado: 'sin_sesion' } | { estado: 'con_sesion'; sesion: Session };

/** Sesión de mentira para el modo demo: solo se usan el token y el email. */
const SESION_DEMO = { access_token: TOKEN_DEMO, user: { id: 'demo', email: EMAIL_DEMO } } as unknown as Session;

/** Sesión de Supabase Auth (o la de prueba), al día con los cambios (entrar, salir, renovar el token). */
export function useSesion(): EstadoSesion {
  const [st, setSt] = useState<EstadoSesion>(supabaseConfigurado || demoHabilitado ? { estado: 'cargando' } : { estado: 'sin_configurar' });

  useEffect(() => {
    let vivo = true;
    let real: EstadoSesion = supabaseConfigurado ? { estado: 'cargando' } : { estado: demoHabilitado ? 'sin_sesion' : 'sin_configurar' };
    const publicar = () => {
      if (vivo) setSt(enDemo() ? { estado: 'con_sesion', sesion: SESION_DEMO } : real);
    };
    publicar();
    const dejarDemo = demoHabilitado ? alCambiarDemo(publicar) : () => {};

    const s = supabase();
    if (!s) return () => {
      vivo = false;
      dejarDemo();
    };
    void s.auth.getSession().then(({ data }) => {
      real = data.session ? { estado: 'con_sesion', sesion: data.session } : { estado: 'sin_sesion' };
      publicar();
    });
    const { data } = s.auth.onAuthStateChange((_evento, sesion) => {
      real = sesion ? { estado: 'con_sesion', sesion } : { estado: 'sin_sesion' };
      publicar();
    });
    return () => {
      vivo = false;
      dejarDemo();
      data.subscription.unsubscribe();
    };
  }, []);

  return st;
}

export async function cerrarSesion() {
  if (enDemo()) {
    salirDemo();
    return;
  }
  await supabase()?.auth.signOut();
}
