// Cada paso del onboarding entra con su animación al navegar.
export default function Plantilla({ children }: { children: React.ReactNode }) {
  return <div className="pagina-entra flex flex-col gap-7">{children}</div>;
}
