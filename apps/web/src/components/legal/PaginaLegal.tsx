import Link from 'next/link';
import { FactiWordmark } from '@/components/FactiLogo';
import { PieLegal } from '@/components/legal/PieLegal';
import { LEGAL, LEGAL_INCOMPLETO } from '@/lib/legal';

/** Marco común de las páginas legales: encabezado simple, texto legible y los links legales al pie. */
export function PaginaLegal({ titulo, bajada, children, conFecha = true }: { titulo: string; bajada?: string; children: React.ReactNode; conFecha?: boolean }) {
  return (
    <div className="min-h-screen bg-fondo">
      <header className="mx-auto flex max-w-[880px] items-center justify-between gap-4 px-4 py-6 sm:px-8">
        <Link href="/" aria-label="Facti, ir al inicio">
          <FactiWordmark size={30} />
        </Link>
        <Link href="/ingresar" className="font-bold text-primario-oscuro hover:text-texto">Iniciar sesión</Link>
      </header>

      <main className="mx-auto flex max-w-[880px] flex-col gap-6 px-4 pb-10 sm:px-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-[34px] font-bold leading-tight sm:text-[40px]">{titulo}</h1>
          {bajada && <p className="text-[18px] text-texto-suave">{bajada}</p>}
          {conFecha && <p className="text-texto-tenue">Última actualización: {LEGAL.actualizado}</p>}
        </div>

        {LEGAL_INCOMPLETO && (
          <p className="rounded-[16px] bg-aviso-suave px-5 py-4 font-semibold text-aviso-texto">
            Borrador: faltan completar algunos datos del titular antes de abrir Facti al público.
          </p>
        )}

        <article className="texto-legal rounded-tarjeta bg-superficie p-6 shadow-tarjeta sm:p-10">{children}</article>
      </main>

      <footer className="mx-auto flex max-w-[880px] flex-col gap-6 px-4 pb-12 sm:px-8">
        <PieLegal />
        <p className="text-texto-tenue">
          © 2026 Facti · {LEGAL.titular} · CUIT {LEGAL.cuit}. Facti es un servicio independiente: no es ARCA ni un organismo oficial.
        </p>
      </footer>
    </div>
  );
}
