'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Facti } from '@/components/Facti';
import { verCuenta } from '@/lib/api';
import { supabase } from '@/lib/supabase';

/**
 * Acá vuelve el usuario después de Google o del link del email. El cliente de Supabase cambia
 * el código de la URL por la sesión; después se decide adónde ir: al onboarding si todavía
 * no cargó el CUIT, o a donde venía.
 */
export default function CallbackPagina() {
  return (
    <Suspense>
      <Callback />
    </Suspense>
  );
}

function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const desdeUrl = params.get('error_description');
    if (desdeUrl) {
      setError(desdeUrl);
      return;
    }
    const s = supabase();
    if (!s) {
      setError('Falta configurar Supabase en el .env.');
      return;
    }
    const v = params.get('volver');
    const volver = v && v.startsWith('/') && !v.startsWith('//') ? v : '/app';
    let listo = false;

    async function seguir() {
      if (listo) return;
      const { data } = await s!.auth.getSession();
      if (!data.session) return;
      listo = true;
      const r = await verCuenta();
      // Si la API todavía no está configurada, igual lo dejamos entrar: cada pantalla avisa qué falta.
      router.replace(r.ok && !r.dato.cuenta.cuit ? '/onboarding/perfil' : volver);
    }

    const { data: sub } = s.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_IN' || evento === 'INITIAL_SESSION') void seguir();
    });
    void seguir();
    // Si en unos segundos no hay sesión, el link venció o ya se usó.
    const t = setTimeout(() => !listo && setError('El link venció o ya se usó. Probá iniciar sesión de nuevo.'), 8000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, [params, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-[440px] flex-col items-center justify-center gap-4 px-4 text-center">
      {error ? (
        <>
          <Facti pose="pensando" size={140} animated={false} />
          <h1 className="text-[24px] font-bold">No pudimos iniciar tu sesión</h1>
          <p role="alert" className="text-texto-suave">{error}</p>
          <Link href="/ingresar" className="btn-lift rounded-full bg-primario px-6 py-3 font-extrabold text-white shadow-boton">Volver a intentar</Link>
        </>
      ) : (
        <>
          <Facti pose="buscando" size={140} animated />
          <p aria-live="polite" className="font-bold text-texto-suave">Entrando a tu cuenta…</p>
        </>
      )}
    </main>
  );
}
