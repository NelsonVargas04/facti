import { TablaSkeleton } from '@/components/TablaFacturas';

/**
 * Esqueletos de carga de cada pantalla de la app. Se muestran apenas tocás un ítem del menú, mientras
 * llega la página, así nunca queda la pantalla anterior "trabada".
 */

export function EsqueletoTitulo({ boton = false }: { boton?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-col gap-2">
        <div className="skeleton h-9 w-52" />
        <div className="skeleton h-5 w-72 max-w-full" />
      </div>
      {boton && <div className="skeleton h-12 w-44 rounded-full" />}
    </div>
  );
}

function Tarjeta({ alto }: { alto: string }) {
  return <div className={`skeleton rounded-tarjeta ${alto}`} />;
}

/** Listado: buscador y una tabla (clientes, cobros). */
export function EsqueletoListado({ conResumen = false, boton = false }: { conResumen?: boolean; boton?: boolean }) {
  return (
    <>
      <EsqueletoTitulo boton={boton} />
      {conResumen && (
        <div className="grid grid-cols-2 gap-3 sm:gap-[18px]">
          <Tarjeta alto="h-[112px]" />
          <Tarjeta alto="h-[112px]" />
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <div className="skeleton h-12 min-w-[260px] flex-1 rounded-input" />
        <div className="skeleton h-12 w-48 rounded-input" />
      </div>
      <section className="rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        <TablaSkeleton filas={6} />
      </section>
    </>
  );
}

/** Configuración: encabezado de perfil y cuatro tarjetas en 2×2. */
export function EsqueletoConfiguracion() {
  return (
    <>
      <EsqueletoTitulo />
      <Tarjeta alto="h-[112px]" />
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Tarjeta key={i} alto="h-[250px]" />
        ))}
      </div>
    </>
  );
}

/** Formulario largo con resumen al costado (nueva factura). */
export function EsqueletoFormulario() {
  return (
    <>
      <EsqueletoTitulo />
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          <Tarjeta alto="h-[170px]" />
          <Tarjeta alto="h-[260px]" />
          <Tarjeta alto="h-[300px]" />
        </div>
        <div className="flex min-w-0 flex-1 basis-[300px] flex-col gap-6">
          <Tarjeta alto="h-[240px]" />
          <Tarjeta alto="h-[120px]" />
        </div>
      </div>
    </>
  );
}

/** Pantallas de tarjetas (plan, monotributo). */
export function EsqueletoTarjetas() {
  return (
    <>
      <EsqueletoTitulo />
      <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
        <Tarjeta alto="h-[200px]" />
        <Tarjeta alto="h-[200px]" />
        <Tarjeta alto="h-[200px]" />
      </div>
      <Tarjeta alto="h-[260px]" />
    </>
  );
}
