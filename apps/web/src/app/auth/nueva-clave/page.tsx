'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Girando } from '@/components/Animado';
import { Facti } from '@/components/Facti';
import { useSesion } from '@/lib/sesion';
import { mensajeAuth, supabase } from '@/lib/supabase';

/** Se llega desde el email de "¿Te olvidaste la contraseña?": Supabase ya abrió una sesión temporal. */
export default function NuevaClave() {
  const router = useRouter();
  const sesion = useSesion();
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (clave.length < 8) {
      setError('La contraseña tiene que tener al menos 8 caracteres.');
      return;
    }
    setGuardando(true);
    const { error } = await supabase()!.auth.updateUser({ password: clave });
    setGuardando(false);
    if (error) setError(mensajeAuth(error));
    else router.replace('/app');
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col justify-center gap-5 px-4 py-10">
      <Facti pose="ok" size={110} animated={false} />
      <h1 className="text-[28px] font-bold">Elegí una contraseña nueva</h1>
      {sesion.estado === 'sin_sesion' ? (
        <p role="alert" className="aviso-entra text-texto-suave">El link venció o ya se usó. Pedí otro desde “¿Te la olvidaste?” al iniciar sesión.</p>
      ) : (
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-bold">
            Contraseña nueva
            <input type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)}
              className="h-12 w-full rounded-input border-[1.5px] border-borde bg-white px-4 text-base font-normal text-texto outline-none focus:border-primario focus:ring-4 focus:ring-primario-suave" />
          </label>
          {error && <p role="alert" className="aviso-entra rounded-[14px] bg-error-suave px-4 py-3 text-sm font-bold text-error">{error}</p>}
          <button type="submit" disabled={guardando || sesion.estado !== 'con_sesion'} className="btn-lift flex h-[52px] items-center justify-center gap-2 rounded-full bg-primario font-extrabold text-white shadow-boton disabled:opacity-70">
            {guardando ? (<><Girando />Guardando…</>) : 'Guardar y entrar'}
          </button>
        </form>
      )}
    </main>
  );
}
