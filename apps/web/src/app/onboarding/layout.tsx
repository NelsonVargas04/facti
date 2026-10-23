import Link from 'next/link';
import { FactiWordmark } from '@/components/FactiLogo';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-8 py-6">
        <Link href="/">
          <FactiWordmark size={34} />
        </Link>
        <a href="#ayuda" className="font-bold text-texto-suave transition-colors hover:text-texto">
          ¿Necesitás ayuda?
        </a>
      </header>
      <main className="mx-auto flex max-w-[1180px] flex-col gap-7 px-8 pb-12 pt-2">
        {children}
        <p className="text-center text-[13px] text-texto-tenue">
          Facti es una herramienta complementaria y de ayuda. No es ARCA ni un organismo oficial.
        </p>
      </main>
    </div>
  );
}
