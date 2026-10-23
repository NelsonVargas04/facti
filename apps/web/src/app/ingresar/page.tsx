'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BotonGoogle } from '@/components/BotonGoogle';
import { Facti } from '@/components/Facti';
import { FactiWordmark } from '@/components/FactiLogo';
import { mensajeAuth, supabase } from '@/lib/supabase';

const inputCls =
  'h-12 w-full rounded-input border-[1.5px] border-borde bg-white px-4 text-base font-normal text-texto outline-none transition-colors placeholder:text-[#9399B2] hover:border-[#C5CCDC] focus:border-primario focus:ring-4 focus:ring-primario-suave';

/** Solo se vuelve a rutas internas, para no usar el login como redirección a otro sitio. */
function rutaSegura(volver: string | null): string {
  return volver && volver.startsWith('/') && !volver.startsWith('//') ? volver : '/app';
}

export default function IngresarPagina() {
  return (
    <Suspense>
      <Ingresar />
    </Suspense>
  );
}

function Ingresar() {
  const router = useRouter();
  const volver = rutaSegura(useSearchParams().get('volver'));
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  async function entrar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setAviso('');
    const s = supabase();
    if (!s) {
      setError('Falta configurar Supabase en el .env (NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).');
      return;
    }
    if (!email.trim() || !clave) {
      setError('Completá tu email y tu contraseña.');
      return;
    }
    setEnviando(true);
    const { error } = await s.auth.signInWithPassword({ email: email.trim(), password: clave });
    if (error) {
      setEnviando(false);
      setError(mensajeAuth(error));
      return;
    }
    // /auth/callback decide si falta el onboarding (CUIT) o va directo a la app.
    router.replace(`/auth/callback?volver=${encodeURIComponent(volver)}`);
  }

  async function olvide() {
    setError('');
    const s = supabase();
    if (!s) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError('Escribí tu email arriba y te mandamos un link para elegir otra contraseña.');
      document.getElementById('email')?.focus();
      return;
    }
    const { error } = await s.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/nueva-clave` });
    if (error) setError(mensajeAuth(error));
    else setAviso(`Listo: si ${email.trim()} tiene cuenta en Facti, te llega un email para elegir una contraseña nueva.`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <Link href="/" aria-label="Volver al inicio de Facti">
          <FactiWordmark size={32} />
        </Link>
        <Facti pose="saludo" size={84} animated />
      </div>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[30px] font-bold leading-tight sm:text-[34px]">Hola de nuevo</h1>
        <p className="text-texto-suave">Entrá para seguir facturando.</p>
      </div>

      <BotonGoogle volver={volver} onError={setError} />

      <div className="flex items-center gap-3 text-sm text-texto-tenue">
        <span className="flex-1 border-t-[1.5px] border-borde" />o con tu email<span className="flex-1 border-t-[1.5px] border-borde" />
      </div>

      <form noValidate onSubmit={entrar} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-bold">Email</label>
          <input id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="clave" className="text-sm font-bold">Contraseña</label>
            <button type="button" onClick={olvide} className="text-[13px] font-extrabold text-primario-oscuro underline-offset-2 hover:underline">
              ¿Te la olvidaste?
            </button>
          </div>
          <input id="clave" type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} className={inputCls} />
        </div>

        {error && <p role="alert" className="rounded-[14px] bg-error-suave px-4 py-3 text-sm font-bold text-error">{error}</p>}
        {aviso && <p role="status" className="rounded-[14px] bg-exito-suave px-4 py-3 text-sm font-bold text-exito-texto">{aviso}</p>}

        <button type="submit" disabled={enviando} className="btn-lift flex h-[54px] items-center justify-center rounded-full bg-primario text-[17px] font-extrabold text-white shadow-boton disabled:cursor-wait disabled:opacity-80">
          {enviando ? 'Entrando…' : 'Iniciar sesión'}
        </button>
      </form>

      <p className="text-center text-[15px] text-texto-suave">
        ¿Todavía no tenés cuenta?{' '}
        <Link href="/registro" className="font-extrabold text-primario-oscuro underline-offset-2 hover:underline">Creala gratis</Link>
      </p>
    </main>
  );
}
