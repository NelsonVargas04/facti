import Link from 'next/link';
import { Facti } from '@/components/Facti';
import { FactiWordmark } from '@/components/FactiLogo';

function Campo({ label, type, placeholder }: { label: string; type: string; placeholder: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-bold">
      {label}
      <input
        type={type}
        placeholder={placeholder}
        className="h-12 w-full rounded-input border-[1.5px] border-borde bg-white px-4 text-base text-texto outline-none placeholder:text-texto-tenue focus:border-primario"
      />
    </label>
  );
}

export default function Registro() {
  return (
    <div className="flex min-h-screen flex-wrap">
      {/* Panel izquierdo (índigo) */}
      <div className="relative flex flex-1 basis-[520px] flex-col gap-7 overflow-hidden bg-primario px-14 py-12 text-white">
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
          <h1 className="max-w-[460px] text-[44px] font-bold leading-[1.15] text-white">Tu ayudante para facturar en ARCA</h1>
          <p className="max-w-[420px] text-[18px] text-[#E4E5FF]">Facturas A, B, C, M y E, tu monotributo bajo control y tus cobros en un solo lugar.</p>
        </div>
      </div>

      {/* Panel derecho (formulario) */}
      <div className="flex flex-1 basis-[520px] items-center justify-center px-14 py-12">
        <div className="flex w-full max-w-[420px] flex-col gap-[22px]">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-[36px] font-bold">Creá tu cuenta</h2>
            <p className="text-texto-suave">Es gratis. Después conectamos tu CUIT con ARCA.</p>
          </div>

          <button
            type="button"
            className="btn-lift flex h-[52px] items-center justify-center gap-2.5 rounded-full border-[1.5px] border-borde bg-white text-base font-extrabold text-texto hover:border-primario"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="none" stroke="#3C4268" strokeWidth="2" />
              <path d="M12 12h8" stroke="#3C4268" strokeWidth="2" />
            </svg>
            Continuar con Google
          </button>

          <div className="flex items-center gap-3 text-sm text-texto-tenue">
            <span className="flex-1 border-t-[1.5px] border-borde" />o con tu email<span className="flex-1 border-t-[1.5px] border-borde" />
          </div>

          <Campo label="Nombre y apellido" type="text" placeholder="Lucía Fernández" />
          <Campo label="Email" type="email" placeholder="lucia@ejemplo.com" />
          <Campo label="Contraseña" type="password" placeholder="Mínimo 8 caracteres" />

          <div className="flex items-start gap-2.5 rounded-[16px] bg-aviso-suave px-4 py-3.5 text-sm leading-snug text-aviso-texto">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px flex-none">
              <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.5" />
            </svg>
            <span>
              <strong>Facti es una herramienta complementaria y de ayuda.</strong> No es ARCA ni un organismo oficial, y no reemplaza el asesoramiento de un contador.
            </span>
          </div>

          <label className="flex items-start gap-2.5 text-sm text-texto-suave">
            <input type="checkbox" required className="mt-0.5 h-[18px] w-[18px]" />
            <span>
              Leí y acepto los <a href="#terminos" className="font-extrabold text-primario-oscuro">Términos y Condiciones</a> y la{' '}
              <a href="#privacidad" className="font-extrabold text-primario-oscuro">Política de Privacidad</a>.
            </span>
          </label>

          <Link
            href="/onboarding/perfil"
            className="btn-lift flex h-[54px] items-center justify-center rounded-full bg-primario text-[17px] font-extrabold text-white shadow-boton hover:shadow-[0_14px_30px_rgba(59,63,216,0.4)]"
          >
            Crear cuenta
          </Link>

          <p className="text-center text-[15px] text-texto-suave">
            ¿Ya tenés cuenta? <Link href="/app" className="font-extrabold text-primario-oscuro">Iniciá sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
