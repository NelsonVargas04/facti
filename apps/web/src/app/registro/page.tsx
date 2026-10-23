'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Girando } from '@/components/Animado';
import { BotonGoogle } from '@/components/BotonGoogle';
import { Facti } from '@/components/Facti';
import { FactiWordmark } from '@/components/FactiLogo';
import { mensajeAuth, supabase, urlDeVuelta } from '@/lib/supabase';

type CampoId = 'nombre' | 'email' | 'clave' | 'terminos';
type Valores = { nombre: string; email: string; clave: string; terminos: boolean };

const MIN_CLAVE = 8;

function validar(v: Valores): Partial<Record<CampoId, string>> {
  const e: Partial<Record<CampoId, string>> = {};
  if (v.nombre.trim().split(/\s+/).filter(Boolean).length < 2) e.nombre = 'Contanos tu nombre y apellido.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) e.email = 'Revisá el email, parece que le falta algo.';
  if (v.clave.length < MIN_CLAVE) e.clave = `La contraseña tiene que tener al menos ${MIN_CLAVE} caracteres.`;
  if (!v.terminos) e.terminos = 'Para seguir, aceptá los Términos y la Política de Privacidad.';
  return e;
}

function MensajeError({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="aviso-entra flex items-center gap-1.5 text-[13px] font-semibold text-error">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" className="flex-none">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.5v.01" />
      </svg>
      {children}
    </p>
  );
}

function Campo({
  id,
  label,
  error,
  children,
  ayuda,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
  ayuda?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      {children}
      {ayuda}
      <MensajeError id={`${id}-error`}>{error}</MensajeError>
    </div>
  );
}

function claseInput(conError: boolean) {
  return `h-12 w-full rounded-input border-[1.5px] bg-white px-4 text-base font-normal text-texto outline-none transition-colors placeholder:text-[#9399B2] focus:ring-4 ${
    conError
      ? 'border-error focus:border-error focus:ring-error-suave'
      : 'border-borde hover:border-[#C5CCDC] focus:border-primario focus:ring-primario-suave'
  }`;
}

function Ojo({ abierto }: { abierto: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!abierto && <path d="M4 4l16 16" />}
    </svg>
  );
}

export default function Registro() {
  const router = useRouter();
  const [v, setV] = useState<Valores>({ nombre: '', email: '', clave: '', terminos: false });
  const [tocados, setTocados] = useState<Partial<Record<CampoId, boolean>>>({});
  const [verClave, setVerClave] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState('');
  const [revisarEmail, setRevisarEmail] = useState('');

  const errores = validar(v);
  const mostrar = (c: CampoId) => (tocados[c] ? errores[c] : undefined);
  const tocar = (c: CampoId) => setTocados((t) => ({ ...t, [c]: true }));
  const claveOk = v.clave.length >= MIN_CLAVE;

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorGeneral('');
    setTocados({ nombre: true, email: true, clave: true, terminos: true });
    const primero = (['nombre', 'email', 'clave', 'terminos'] as const).find((c) => errores[c]);
    if (primero) {
      document.getElementById(primero)?.focus();
      return;
    }
    const s = supabase();
    if (!s) {
      setErrorGeneral('Falta configurar Supabase en el .env (NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).');
      return;
    }
    setEnviando(true);
    const { data, error } = await s.auth.signUp({
      email: v.email.trim(),
      password: v.clave,
      options: { data: { nombre: v.nombre.trim() }, emailRedirectTo: urlDeVuelta('/onboarding/perfil') },
    });
    setEnviando(false);
    if (error) {
      setErrorGeneral(mensajeAuth(error));
      return;
    }
    // Si el proyecto pide confirmar el email, todavía no hay sesión: hay que abrir el link del email.
    if (data.session) router.push('/onboarding/perfil');
    else setRevisarEmail(v.email.trim());
  }

  if (revisarEmail) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[460px] flex-col items-center justify-center gap-4 px-4 text-center">
        <Facti pose="ok" size={150} animated={false} />
        <h1 className="text-[28px] font-bold">Revisá tu email</h1>
        <p className="text-texto-suave">
          Te mandamos un link a <strong className="text-texto">{revisarEmail}</strong> para confirmar tu cuenta. Abrilo desde este mismo
          navegador y seguimos con tu CUIT.
        </p>
        <p className="text-sm text-texto-tenue">¿No llegó? Fijate en spam o promociones.</p>
        <Link href="/ingresar" className="font-extrabold text-primario-oscuro underline-offset-2 hover:underline">Ya lo confirmé, iniciar sesión</Link>
      </main>
    );
  }

  return (
    <div className="pagina-entra flex min-h-screen flex-col lg:flex-row">
      {/* Panel índigo: solo en pantallas anchas */}
      <aside className="relative hidden flex-1 flex-col gap-7 overflow-hidden bg-primario px-14 py-12 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2.5 text-white">
          <FactiWordmark size={34} ink="#15193A" textClass="text-white" />
        </Link>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <div className="relative">
            <div className="absolute -right-[150px] -top-2.5 rotate-[4deg]">
              <div className="f-pop whitespace-nowrap rounded-[22px_22px_22px_6px] bg-white px-[18px] py-3 text-[15px] font-extrabold text-texto shadow-tarjeta-lg">
                ¡Qué bueno verte por acá!
              </div>
            </div>
            <Facti pose="saludo" size={240} animated />
          </div>
          <p className="max-w-[460px] font-display text-[44px] font-bold leading-[1.15] tracking-[-0.02em] text-white">
            Tu ayudante para facturar en ARCA
          </p>
          <p className="max-w-[420px] text-[18px] text-[#E4E5FF]">
            Facturas A, B, C, M y E, tu monotributo bajo control y tus cobros en un solo lugar.
          </p>
        </div>
      </aside>

      {/* Formulario */}
      <main className="flex flex-1 items-start justify-center px-4 py-8 sm:px-8 lg:items-center lg:px-14 lg:py-12">
        <div className="flex w-full max-w-[420px] flex-col gap-6">
          {/* Encabezado compacto en celular y tablet (el panel índigo no se muestra) */}
          <div className="flex items-center justify-between lg:hidden">
            <Link href="/" aria-label="Volver al inicio de Facti">
              <FactiWordmark size={30} />
            </Link>
            <Facti pose="saludo" size={84} animated />
          </div>

          <div className="flex flex-col gap-1.5">
            <h1 className="text-[30px] font-bold leading-tight sm:text-[36px]">Creá tu cuenta</h1>
            <p className="text-texto-suave">Es gratis. Después conectamos tu CUIT con ARCA.</p>
          </div>

          <BotonGoogle volver="/onboarding/perfil" onError={setErrorGeneral} />
          {errorGeneral && (
            <p role="alert" className="aviso-entra rounded-[14px] bg-error-suave px-4 py-3 text-sm font-bold text-error">
              {errorGeneral}
            </p>
          )}

          <div className="flex items-center gap-3 text-sm text-texto-tenue">
            <span className="flex-1 border-t-[1.5px] border-borde" />o con tu email<span className="flex-1 border-t-[1.5px] border-borde" />
          </div>

          <form noValidate onSubmit={enviar} className="flex flex-col gap-5">
            <Campo id="nombre" label="Nombre y apellido" error={mostrar('nombre')}>
              <input
                id="nombre"
                type="text"
                autoComplete="name"
                placeholder="Ej.: Lucía Fernández"
                value={v.nombre}
                onChange={(e) => setV({ ...v, nombre: e.target.value })}
                onBlur={() => v.nombre && tocar('nombre')}
                aria-invalid={!!mostrar('nombre')}
                aria-describedby={mostrar('nombre') ? 'nombre-error' : undefined}
                className={claseInput(!!mostrar('nombre'))}
              />
            </Campo>

            <Campo id="email" label="Email" error={mostrar('email')}>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="tu@email.com"
                value={v.email}
                onChange={(e) => setV({ ...v, email: e.target.value })}
                onBlur={() => v.email && tocar('email')}
                aria-invalid={!!mostrar('email')}
                aria-describedby={mostrar('email') ? 'email-error' : undefined}
                className={claseInput(!!mostrar('email'))}
              />
            </Campo>

            <Campo
              id="clave"
              label="Contraseña"
              error={mostrar('clave')}
              ayuda={
                !mostrar('clave') && (
                  <p id="clave-ayuda" className={`flex items-center gap-1.5 text-[13px] font-semibold ${claveOk ? 'text-exito-texto' : 'text-texto-tenue'}`}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {claveOk ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <circle cx="12" cy="12" r="8" />}
                    </svg>
                    Al menos {MIN_CLAVE} caracteres
                  </p>
                )
              }
            >
              <div className="relative">
                <input
                  id="clave"
                  type={verClave ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={v.clave}
                  onChange={(e) => setV({ ...v, clave: e.target.value })}
                  onBlur={() => v.clave && tocar('clave')}
                  aria-invalid={!!mostrar('clave')}
                  aria-describedby={mostrar('clave') ? 'clave-error' : 'clave-ayuda'}
                  className={`${claseInput(!!mostrar('clave'))} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setVerClave((x) => !x)}
                  aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={verClave}
                  className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-texto-tenue hover:bg-fondo hover:text-texto focus-visible:outline-2 focus-visible:outline-primario"
                >
                  <Ojo abierto={!verClave} />
                </button>
              </div>
            </Campo>

            <div className="flex items-start gap-2.5 rounded-[14px] bg-aviso-suave px-3.5 py-3 text-[13px] leading-snug text-aviso-texto">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px flex-none">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 8v.5" />
              </svg>
              <span>
                <strong>Facti es una herramienta complementaria y de ayuda.</strong> No es ARCA ni un organismo oficial, y no reemplaza
                el asesoramiento de un contador.
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-texto-suave">
                <input
                  id="terminos"
                  type="checkbox"
                  checked={v.terminos}
                  onChange={(e) => {
                    setV({ ...v, terminos: e.target.checked });
                    tocar('terminos');
                  }}
                  aria-invalid={!!mostrar('terminos')}
                  aria-describedby={mostrar('terminos') ? 'terminos-error' : undefined}
                  className="mt-0.5 h-[18px] w-[18px] flex-none cursor-pointer accent-primario"
                />
                <span>
                  Leí y acepto los{' '}
                  <a href="#terminos" className="font-extrabold text-primario-oscuro underline-offset-2 hover:underline">
                    Términos y Condiciones
                  </a>{' '}
                  y la{' '}
                  <a href="#privacidad" className="font-extrabold text-primario-oscuro underline-offset-2 hover:underline">
                    Política de Privacidad
                  </a>
                  .
                </span>
              </label>
              <MensajeError id="terminos-error">{mostrar('terminos')}</MensajeError>
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="btn-lift flex h-[54px] items-center justify-center gap-2 rounded-full bg-primario text-[17px] font-extrabold text-white shadow-boton hover:shadow-[0_14px_30px_rgba(59,63,216,0.4)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primario disabled:cursor-wait disabled:opacity-80"
            >
              {enviando ? (<><Girando />Creando tu cuenta…</>) : 'Crear cuenta'}
            </button>
          </form>

          <p className="text-center text-[15px] text-texto-suave">
            ¿Ya tenés cuenta?{' '}
            <Link href="/ingresar" className="font-extrabold text-primario-oscuro underline-offset-2 hover:underline">
              Iniciá sesión
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
