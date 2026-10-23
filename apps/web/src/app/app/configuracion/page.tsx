'use client';

import Link from 'next/link';
import { AvisoApi } from '@/components/AvisoApi';
import { verCuenta } from '@/lib/api';
import { formatearCuit } from '@/lib/formato';
import { useApi } from '@/lib/useApi';

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
      <strong className="text-right">{v || '—'}</strong>
    </div>
  );
}

const CONDICION: Record<string, string> = {
  monotributo: 'Monotributo',
  responsable_inscripto: 'Responsable inscripto',
  exento: 'Exento',
  consumidor_final: 'Sin inscripción en IVA',
  no_alcanzado: 'No alcanzado',
};

export default function Configuracion() {
  const cuenta = useApi(verCuenta, []);
  const c = cuenta.dato?.cuenta;
  const esPro = c?.plan === 'pro';

  return (
    <>
      <div className="aparece">
        <h1 className="text-[34px] font-bold">Configuración</h1>
        <p className="text-texto-suave">Tu perfil, la conexión con ARCA y tu plan.</p>
      </div>

      {cuenta.estado === 'error' && !c && <AvisoApi error={cuenta.error} onReintentar={cuenta.recargar} />}

      {c ? (
        <div style={{ animationDelay: '80ms' }} className="aparece grid items-start gap-6 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
          <Tarjeta titulo="Perfil fiscal">
            <Dato k="Nombre" v={c.nombre} />
            <Dato k="CUIT" v={formatearCuit(c.cuit)} />
            <Dato k="Condición" v={[CONDICION[c.condicion] ?? c.condicion, c.categoria && `Categoría ${c.categoria}`].filter(Boolean).join(' · ')} />
            <Dato k="Domicilio fiscal" v={c.domicilio} />
            {!c.nombre && <p className="text-sm text-texto-suave">Estos datos se completan solos desde el padrón de ARCA cuando conectes Facti con ARCA.</p>}
          </Tarjeta>

          <Tarjeta titulo="Conexión con ARCA">
            <Dato k="Punto de venta" v={`${String(c.puntoVenta).padStart(4, '0')} · Web Services`} />
            <Link href="/estado" className="btn-lift flex h-11 items-center self-start rounded-full border-[1.5px] border-borde px-5 font-extrabold text-texto">Ver estado de la conexión</Link>
          </Tarjeta>

          <Tarjeta titulo="Tu plan">
            <div className="flex items-center justify-between">
              <span className="font-display text-[24px] font-bold">{esPro ? 'Pro' : 'Gratis'}</span>
              <span className="rounded-full bg-primario-suave px-3 py-1 text-[13px] font-extrabold text-primario-oscuro">Actual</span>
            </div>
            <p className="text-sm text-texto-suave">
              {esPro ? 'Facturas ilimitadas y recordatorios de cobro.' : '10 facturas A/B/C y 1 Factura E por mes. Pasate a Pro para ilimitadas y recordatorios de cobro.'}
            </p>
            {!esPro && <Link href="/app/plan" className="btn-lift flex h-11 items-center justify-center rounded-full bg-primario font-extrabold text-white shadow-boton">Pasar a Pro</Link>}
          </Tarjeta>
        </div>
      ) : (
        cuenta.estado === 'cargando' && (
          <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-[220px] rounded-tarjeta" />)}
          </div>
        )
      )}

      <p className="text-[13px] text-texto-tenue">Facti es una herramienta complementaria y de ayuda. No es ARCA ni un organismo oficial.</p>
    </>
  );
}
