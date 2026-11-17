'use client';

import Link from 'next/link';
import { AvisoApi } from '@/components/AvisoApi';
import { GraficoFacturacion } from '@/components/GraficoFacturacion';
import { Icon } from '@/components/Icon';
import type { Cuenta, ErrorApi, EscalaMonotributo, Resumen } from '@/lib/api';
import { BarraTope, categoriaQueCorresponde, topes, VerCategorias } from '@/components/monotributo/Categorias';
import { pesos } from '@/lib/formato';

/** Hoy en AAAA-MM-DD (hora de Argentina). */
function hoyISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

/** La recategorización es semestral: en enero (con lo facturado hasta diciembre) y en julio (hasta junio). */
export function proximaRecategorizacion(hoy = new Date()): { mes: string; anio: number; cierre: string } {
  const m = hoy.getMonth(); // 0 = enero
  if (m === 0) return { mes: 'enero', anio: hoy.getFullYear(), cierre: `31/12/${hoy.getFullYear() - 1}` };
  if (m <= 6) return { mes: 'julio', anio: hoy.getFullYear(), cierre: `30/06/${hoy.getFullYear()}` };
  return { mes: 'enero', anio: hoy.getFullYear() + 1, cierre: `31/12/${hoy.getFullYear()}` };
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
export function ResumenMonotributo({ resumen, cuenta, escala }: { resumen: Estado<Resumen>; cuenta?: Cuenta; escala?: EscalaMonotributo | null }) {
  if (resumen.estado === 'error') return <AvisoApi error={resumen.error} />;
  if (resumen.estado === 'cargando') return <Esqueleto />;
  const r = resumen.dato;
  const total = r.ultimos12Meses.facturado;
  const t = topes(escala);
  return (
    <>
      <section className="flex flex-col gap-5 rounded-tarjeta bg-superficie p-5 shadow-tarjeta sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-bold">Tu facturación</h2>
            <p className="text-texto-suave">Últimos 12 meses: lo que ARCA mira para tu categoría.</p>
          </div>
          <VerCategorias categoria={cuenta?.categoria} corresponde={categoriaQueCorresponde(total, t)} />
        </div>
        <BarraTope facturado={total} categoria={cuenta?.categoria} escala={escala} desde={r.ultimos12Meses.desde} hasta={hoyISO()} />
      </section>
      <GraficoFacturacion porMes={r.ultimos12Meses.porMes} total={total} categoria={cuenta?.categoria} conTope={false} />
    </>
  );
}

/** Pestaña Recategorización: cuándo toca y cómo venís. */
export function Recategorizacion({ resumen, cuenta, escala }: { resumen: Estado<Resumen>; cuenta?: Cuenta; escala?: EscalaMonotributo | null }) {
  if (resumen.estado === 'error') return <AvisoApi error={resumen.error} />;
  if (resumen.estado === 'cargando') return <Esqueleto />;
  const total = resumen.dato.ultimos12Meses.facturado;
  const t = topes(escala);
  const corresponde = categoriaQueCorresponde(total, t);
  const prox = proximaRecategorizacion();
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

        <BarraTope facturado={total} categoria={cuenta?.categoria} escala={escala} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EDF0F6] pt-4">
          <p className="text-texto-suave">
            {corresponde && cuenta?.categoria && corresponde !== cuenta.categoria.toUpperCase()
              ? `En ${prox.mes} te convendría pasar a la categoría ${corresponde}.`
              : 'Por ahora seguís en tu categoría: no hace falta cambiar nada.'}
          </p>
          <VerCategorias categoria={cuenta?.categoria} corresponde={corresponde} />
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-7 shadow-tarjeta">
        <h2 className="text-[20px] font-bold">Cómo recategorizarte</h2>
        <ol className="flex flex-col gap-2 pl-5 text-texto-suave [list-style:decimal]">
          <li>Entrá a ARCA con tu clave fiscal y abrí el servicio &quot;Monotributo&quot;.</li>
          <li>Elegí &quot;Recategorizarme&quot; y revisá lo que facturaste, los alquileres y la energía que consumiste.</li>
          <li>Si te corresponde otra categoría, confirmala. Si seguís en la misma, no hace falta hacer nada.</li>
        </ol>
        {/* Video paso a paso: el mismo formato que la guía para conectar Facti con ARCA. */}
        <Link
          href="/guias/recategorizacion"
          className="group flex items-center gap-4 rounded-[18px] bg-fondo p-3 pr-5 transition-colors hover:bg-primario-suave"
        >
          <span className="relative flex h-[72px] w-[128px] flex-none items-center justify-center overflow-hidden rounded-[12px] bg-texto">
            <img src="/videos/recategorizacion.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
            <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-tarjeta transition-transform group-hover:scale-110">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="#3B3FD8" /></svg>
            </span>
          </span>
          <span className="flex min-w-0 flex-col">
            <strong>Ver el video paso a paso</strong>
            <span className="text-texto-suave">Cómo recategorizarte en ARCA, despacio y con ejemplos. Dura menos de 2 minutos.</span>
          </span>
        </Link>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://www.arca.gob.ar/monotributo/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-lift inline-flex h-11 items-center gap-2 rounded-full bg-primario px-5 font-bold text-white shadow-boton"
          >
            Ir a Monotributo en ARCA
            <Icon name="link-externo" size={18} />
          </a>
        </div>
        <p className="text-texto-tenue">El cálculo es una ayuda con lo que facturaste desde Facti. No reemplaza la consulta con tu contador.</p>
      </section>
    </div>
  );
}
