// Un template se vuelve a montar en cada navegación: así cada pantalla de la app entra con su animación.
export default function Plantilla({ children }: { children: React.ReactNode }) {
  return <div className="pagina-entra flex flex-col gap-[26px]">{children}</div>;
}
