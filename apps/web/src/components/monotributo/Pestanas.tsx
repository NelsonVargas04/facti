'use client';

import { obtenerParametro } from '@facti/shared/src/parametros';
import { AvisoApi } from '@/components/AvisoApi';
import { GraficoFacturacion } from '@/components/GraficoFacturacion';
import { Icon } from '@/components/Icon';
import type { Cuenta, ErrorApi, Resumen } from '@/lib/api';
import { pesos } from '@/lib/formato';

/** Tope anual de facturación de la categoría (null si todavía no está cargado en los parámetros). */
export function topeCategoria(categoria?: string): number | null {
  if (!categoria) return null;
  try {
    return obtenerParametro(`monotributo.tope_anual.${categoria.toUpperCase()}`);
  } catch {
    return null;
  }
}

/** La recategorización es semestral: en enero (con lo facturado hasta diciembre) y en julio (hasta junio). */
export function proximaRecategorizacion(hoy = new Date()): { mes: string; anio: number; cierre: string } {
  const m = hoy.getMonth(); // 0 = enero
  if (m === 0) return { mes: 'enero', anio: hoy.getFullYear(), cierre: `31/12/${hoy.getFullYear() - 1}` };
  if (m <= 6) return { mes: 'julio', anio: hoy.getFullYear(), cierre: `30/06/${hoy.getFullYear()}` };
  return { mes: 'enero', anio: hoy.getFullYear() + 1, cierre: `31/12/${hoy.getFullYear()}` };
}

function Dato({ k, v, nota }: { k: string; v: string; nota?: string }) {
  return (
    <div className="row-span-3 grid grid-rows-subgrid content-start gap-y-1.5 rounded-tarjeta bg-superficie px-4 py-4 shadow-tarjeta sm:px-6 sm:py-[22px] [&:last-child:nth-child(odd)]:col-span-2 lg:[&:last-child:nth-child(odd)]:col-span-1">
      <span className="font-semibold text-texto-tenue">{k}</span>
      <span className="self-end font-display text-[22px] font-semibold leading-tight tabular-nums sm:text-[30px]">{v}</span>
      {nota && <span className="text-texto-suave">{nota}</span>}
    </div>
  );
}

type Estado<T> = { estado: 'cargando' } | { estado: 'error'; error: ErrorApi } | { estado: 'ok'; dato: T };

function Esqueleto() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-[18px] lg:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton row-span-3 h-[120px] rounded-tarjeta" />)}
      </div>
      <div className="skeleton h-[320px] rounded-tarjeta" />
    </>
  );
}

/** Pestaña Resumen: lo facturado en los últimos 12 meses contra el tope de tu categoría. */
export function ResumenMonotributo({ resumen, cuenta }: { resumen: Estado<Resumen>; cuenta?: Cuenta }) {
  if (resumen.estado === 'error') return <AvisoApi error={resumen.error} />;
  if (resumen.estado === 'cargando') return <Esqueleto />;
  const r = resumen.dato;
  const total = r.ultimos12Meses.facturado;
  const tope = topeCategoria(cuenta?.categoria);
  const usado = tope ? Math.round((total / tope) * 100) : null;
  return (
    <>
      <div className="cascada grid grid-cols-2 gap-3 sm:gap-[18px] lg:grid-cols-3">
        <Dato k="Últimos 12 meses" v={pesos(total)} nota="Lo que cuenta para tu categoría" />
        <Dato k={`Tope de la categoría ${cuenta?.categoria || '—'}`} v={tope ? pesos(tope) : 'Sin dato'} nota={tope ? 'Facturación anual máxima' : 'Revisalo en la tabla de ARCA'} />
        <Dato k="Usaste" v={usado !== null ? `${usado}%` : '—'} nota={usado !== null ? (usado >= 100 ? 'Te pasaste del tope' : usado >= 80 ? 'Estás cerca del tope' : 'Vas bien') : 'Cuando tengamos el tope, lo calculo'} />
      </div>
      <GraficoFacturacion porMes={r.ultimos12Meses.porMes} total={total} categoria={cuenta?.categoria} />
    </>
  );
}

/** Pestaña Recategorización: cuándo toca y cómo venís. */
export function Recategorizacion({ resumen, cuenta }: { resumen: Estado<Resumen>; cuenta?: Cuenta }) {
  if (resumen.estado === 'error') return <AvisoApi error={resumen.error} />;
  if (resumen.estado === 'cargando') return <Esqueleto />;
  const total = resumen.dato.ultimos12Meses.facturado;
  const tope = topeCategoria(cuenta?.categoria);
  const usado = tope ? Math.min(100, Math.round((total / tope) * 100)) : null;
  const prox = proximaRecategorizacion();
  const tono = usado === null ? 'bg-fondo text-texto-suave' : usado >= 100 ? 'bg-error-suave text-error' : usado >= 80 ? 'bg-aviso-suave text-aviso-texto' : 'bg-exito-suave text-exito-texto';
  const mensaje =
    usado === null
      ? 'Todavía no tenemos cargado el tope de tu categoría. Comparalo con la tabla oficial de ARCA.'
      : usado >= 100
        ? 'Facturaste más que el tope de tu categoría: en la próxima recategorización te corresponde subir.'
        : usado >= 80
          ? 'Estás cerca del tope de tu categoría. Revisá si te conviene recategorizarte.'
          : 'Venís bien: estás dentro del tope de tu categoría.';

  return (
    <div className="cascada flex flex-col gap-6">
      <section className="flex flex-col gap-5 rounded-tarjeta bg-superficie p-7 shadow-tarjeta">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[24px] font-bold">Próxima recategorización: {prox.mes} {prox.anio}</h2>
            <p className="text-texto-suave">ARCA toma lo que facturaste en los 12 meses hasta el {prox.cierre}.</p>
          </div>
          <span className="inline-flex h-9 items-center gap-2 rounded-full bg-primario-suave px-4 font-bold text-primario-oscuro">
            <Icon name="calendario" size={18} />
            {prox.mes[0]!.toUpperCase() + prox.mes.slice(1)} {prox.anio}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold">Categoría {cuenta?.categoria || '—'}</span>
            <span className="tabular-nums text-texto-suave">
              {pesos(total)} {tope ? `de ${pesos(tope)}` : ''}
            </span>
          </div>
          {usado !== null && (
            <div className="h-3 overflow-hidden rounded-full bg-[#ECEFF5]">
              <div
                className={`h-full w-full rounded-full transition-transform duration-700 ease-salida ${usado >= 100 ? 'bg-[#E5484D]' : usado >= 80 ? 'bg-[#E0A100]' : 'bg-primario'}`}
                style={{ transform: `translateX(${usado - 100}%)` }}
              />
            </div>
          )}
        </div>

        <p className={`rounded-[16px] px-5 py-4 font-semibold ${tono}`}>{mensaje}</p>
      </section>

      <section className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-7 shadow-tarjeta">
        <h2 className="text-[20px] font-bold">Cómo recategorizarte</h2>
        <ol className="flex flex-col gap-2 pl-5 text-texto-suave [list-style:decimal]">
          <li>Entrá a ARCA con tu clave fiscal y abrí el servicio &quot;Monotributo&quot;.</li>
          <li>Elegí &quot;Recategorizarme&quot; y revisá lo que facturaste, los alquileres y la energía que consumiste.</li>
          <li>Si te corresponde otra categoría, confirmala. Si seguís en la misma, no hace falta hacer nada.</li>
        </ol>
        <a
          href="https://www.arca.gob.ar/monotributo/"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-lift inline-flex h-11 items-center gap-2 self-start rounded-full bg-primario px-5 font-bold text-white shadow-boton"
        >
          Ir a Monotributo en ARCA
          <Icon name="link-externo" size={18} />
        </a>
        <p className="text-texto-tenue">El cálculo es una ayuda con lo que facturaste desde Facti. No reemplaza la consulta con tu contador.</p>
      </section>
    </div>
  );
}
