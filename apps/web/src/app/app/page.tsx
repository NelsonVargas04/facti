import Link from 'next/link';
import { Facti } from '@/components/Facti';
import { TablaFacturas } from '@/components/TablaFacturas';
import { UsoPlan } from '@/components/UsoPlan';
import { FACTURAS_DEMO } from '@/lib/facturas-demo';

const STATS = [
  { label: 'FACTURADO EN OCTUBRE', valor: '$457.500', nota: '5 comprobantes emitidos' },
  { label: 'POR COBRAR', valor: '$252.500', nota: '2 facturas pendientes' },
  { label: 'COBRADO', valor: '$205.000', nota: '2 facturas cobradas' },
];

const FACTURAS = FACTURAS_DEMO.slice(0, 5);

const ACCIONES = [
  { label: 'Nueva Factura C', color: '#2A2DB0', href: '/app/facturas/nueva', icon: (<><path d="M6 3h9l4 4v14H6z" /><path d="M12 11v6M9 14h6" /></>) },
  { label: 'Nota de crédito', color: '#0E5C38', href: '#', icon: (<><path d="M4 12a8 8 0 1 0 3-6.2" /><path d="M4 4v4h4" /></>) },
  { label: 'Agregar cliente', color: '#8A5A00', href: '#', icon: (<><circle cx="10" cy="8" r="4" /><path d="M3 20c0-3.9 3.1-7 7-7M18 14v6M15 17h6" /></>) },
];

export default function Inicio() {
  return (
    <>
      {/* Encabezado */}
      <div className="aparece flex flex-wrap items-center justify-between gap-5">
        <div>
          <h1 className="text-[34px] font-bold">Hola, Lucía</h1>
          <p className="text-texto-suave">Este es el resumen de octubre.</p>
        </div>
        <div className="flex items-center gap-1">
          <div className="f-pop max-w-[300px] rounded-[20px_20px_6px_20px] bg-white px-4 py-3 text-[15px] font-bold shadow-[0_8px_20px_rgba(21,25,58,0.08)]">
            Tenés <strong>2 facturas por cobrar</strong>. ¿Le mando un recordatorio a tus clientes?
          </div>
          <Facti pose="alerta" size={110} animated={false} />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
        {STATS.map((s, i) => (
          <div key={s.label} style={{ animationDelay: `${60 + i * 60}ms` }} className="aparece card-hover flex flex-col gap-1.5 rounded-tarjeta bg-superficie px-6 py-[22px] shadow-tarjeta">
            <span className="text-[13px] font-extrabold tracking-[0.06em] text-texto-tenue">{s.label}</span>
            <span className="font-display text-[32px] font-bold">{s.valor}</span>
            <span className="text-sm text-texto-suave">{s.nota}</span>
          </div>
        ))}
        <div style={{ animationDelay: '240ms' }} className="aparece card-hover flex flex-col gap-1.5 rounded-tarjeta bg-superficie px-6 py-[22px] shadow-tarjeta">
          <span className="text-[13px] font-extrabold tracking-[0.06em] text-texto-tenue">MONOTRIBUTO</span>
          <span className="font-display text-[32px] font-bold">Categoría C</span>
          <span className="text-sm text-texto-suave">68% del tope anual</span>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[#ECEFF5]"><div className="h-full w-[68%] rounded-full bg-primario" /></div>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div style={{ animationDelay: '300ms' }} className="aparece flex flex-wrap gap-3">
        {ACCIONES.map((a) => (
          <Link key={a.label} href={a.href} className="btn-lift flex items-center gap-2.5 rounded-[16px] border-[1.5px] border-borde bg-superficie px-[18px] py-3.5 font-extrabold text-texto hover:border-primario">
            <span style={{ color: a.color }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{a.icon}</svg>
            </span>
            {a.label}
          </Link>
        ))}
      </div>

      {/* Tabla + aside */}
      <div style={{ animationDelay: '360ms' }} className="aparece flex flex-wrap items-start gap-[22px]">
        <section className="min-w-0 flex-[999_1_560px] rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[22px] font-bold">Últimas facturas</h2>
            <Link href="/app/facturas" className="font-extrabold text-primario-oscuro">Ver todas</Link>
          </div>
          <TablaFacturas rows={FACTURAS} />
        </section>

        <aside className="flex min-w-0 flex-1 basis-[280px] flex-col gap-[18px]">
          <UsoPlan />
          <div className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-[22px] shadow-tarjeta">
            <h2 className="text-[20px] font-bold">Para tener en cuenta</h2>
            <div className="rounded-[16px] bg-aviso-suave p-3.5 text-sm font-bold text-aviso-texto">Recategorización de monotributo: vence en enero. Ya tengo tus números listos.</div>
            <div className="rounded-[16px] bg-primario-suave p-3.5 text-sm font-bold text-primario-oscuro">Martín Gómez tiene una factura pendiente hace 4 días.</div>
          </div>
          <div className="flex flex-col gap-2 rounded-tarjeta bg-superficie p-[22px] shadow-tarjeta">
            <h2 className="text-[20px] font-bold">Estado de ARCA</h2>
            <span className="flex items-center gap-2 font-bold text-exito-texto"><span className="h-2.5 w-2.5 rounded-full bg-exito" />Funcionando normal</span>
            <span className="text-sm text-texto-suave">Si ARCA se cae, tus facturas quedan en espera y Facti las emite apenas vuelva.</span>
          </div>
        </aside>
      </div>
    </>
  );
}
