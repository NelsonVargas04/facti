import Link from 'next/link';

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-tarjeta bg-superficie p-7 shadow-tarjeta">
      <h2 className="text-[20px] font-bold">{titulo}</h2>
      {children}
    </section>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#F0F2F7] pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-texto-tenue">{k}</span>
      <strong className="text-right">{v}</strong>
    </div>
  );
}

export default function Configuracion() {
  return (
    <>
      <div className="aparece">
        <h1 className="text-[34px] font-bold">Configuración</h1>
        <p className="text-texto-suave">Tu perfil, la conexión con ARCA y tu plan.</p>
      </div>

      <div style={{ animationDelay: '80ms' }} className="aparece grid items-start gap-6 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
        <Tarjeta titulo="Perfil fiscal">
          <Dato k="Nombre" v="Fernández Lucía" />
          <Dato k="CUIT" v="27-31456789-4" />
          <Dato k="Condición" v="Monotributo · Categoría C" />
          <Dato k="Actividad" v="Servicios de diseño" />
        </Tarjeta>

        <Tarjeta titulo="Conexión con ARCA">
          <div className="flex items-center gap-2 font-bold text-exito-texto">
            <span className="h-2.5 w-2.5 rounded-full bg-exito" />Conectado
          </div>
          <Dato k="Punto de venta" v="0003 · Web Services" />
          <Dato k="Certificado" v="Vence 10/2027" />
          <button type="button" className="btn-lift h-11 self-start rounded-full border-[1.5px] border-borde px-5 font-extrabold text-texto">Reautorizar en ARCA</button>
        </Tarjeta>

        <Tarjeta titulo="Tu plan">
          <div className="flex items-center justify-between">
            <span className="font-display text-[24px] font-bold">Gratis</span>
            <span className="rounded-full bg-primario-suave px-3 py-1 text-[13px] font-extrabold text-primario-oscuro">Actual</span>
          </div>
          <p className="text-sm text-texto-suave">10 facturas A/B/C y 1 Factura E por mes. Pasate a Pro para ilimitadas y recordatorios de cobro.</p>
          <Link href="/app/plan" className="btn-lift flex h-11 items-center justify-center rounded-full bg-primario font-extrabold text-white shadow-boton">Pasar a Pro</Link>
        </Tarjeta>

        <Tarjeta titulo="Cuenta">
          <Dato k="Email" v="lucia@ejemplo.com" />
          <button type="button" className="btn-lift h-11 self-start rounded-full border-[1.5px] border-borde px-5 font-extrabold text-texto">Cambiar contraseña</button>
          <button type="button" className="h-10 self-start text-sm font-extrabold text-[#B4232B] transition-colors hover:underline">Dar de baja mi cuenta</button>
        </Tarjeta>
      </div>

      <p className="text-[13px] text-texto-tenue">Facti es una herramienta complementaria y de ayuda. No es ARCA ni un organismo oficial.</p>
    </>
  );
}
