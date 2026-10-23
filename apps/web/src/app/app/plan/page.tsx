'use client';

import { AvisoApi } from '@/components/AvisoApi';
import { BackLink } from '@/components/BackLink';
import { Facti } from '@/components/Facti';
import { Icon } from '@/components/Icon';
import { ConsumoPlan } from '@/components/UsoPlan';
import { verCuenta } from '@/lib/api';
import { PLAN_DEMO } from '@/lib/plan-demo';
import { useApi } from '@/lib/useApi';

type Valor = string | boolean;
const BENEFICIOS: { f: string; gratis: Valor; pro: Valor }[] = [
  { f: 'Facturas A, B y C', gratis: '10 / mes', pro: 'Ilimitadas' },
  { f: 'Factura E (exportación)', gratis: '1 / mes', pro: 'Ilimitada' },
  { f: 'Panel de monotributo', gratis: true, pro: true },
  { f: 'Registro de cobros', gratis: true, pro: true },
  { f: 'Recordatorios de cobro', gratis: false, pro: true },
  { f: 'Multi-CUIT (para contadores)', gratis: false, pro: true },
  { f: 'Soporte prioritario', gratis: false, pro: true },
];

function Celda({ v, pro }: { v: Valor; pro?: boolean }) {
  if (typeof v === 'string') return <span className={`text-sm font-extrabold ${pro ? 'text-primario-oscuro' : 'text-texto'}`}>{v}</span>;
  if (!v) return <Icon name="cerrar" size={16} strokeWidth={2.6} className="text-[#B9BED3]" />;
  return <Icon name="check" size={18} strokeWidth={3} className={pro ? 'text-primario-oscuro' : 'text-exito'} />;
}

export default function PlanPro() {
  const cuenta = useApi(verCuenta, []);
  return (
    <>
      <div className="aparece">
        <BackLink href="/app" />
      </div>

      {/* Hero */}
      <div style={{ animationDelay: '60ms' }} className="aparece flex flex-wrap items-center justify-center gap-6 rounded-tarjeta-lg bg-primario p-8 text-center text-white sm:justify-start sm:text-left">
        <Facti pose="festejo" size={150} animated />
        <div className="flex flex-col gap-2">
          <span className="self-center rounded-full bg-acento px-3 py-1 text-[13px] font-extrabold text-texto sm:self-start">Facti Pro</span>
          <h1 className="text-[34px] font-bold leading-tight text-white">Hacé más, sin límites</h1>
          <p className="max-w-[460px] text-[#E4E5FF]">Facturás todo lo que necesites, sumás recordatorios de cobro y Facti te cuida el monotributo. Cancelás cuando quieras.</p>
        </div>
      </div>

      {/* Consumo actual */}
      <div style={{ animationDelay: '90ms' }} className="aparece">
        {cuenta.dato ? (
          <ConsumoPlan plan={cuenta.dato.plan} />
        ) : cuenta.estado === 'error' ? (
          <AvisoApi error={cuenta.error} onReintentar={cuenta.recargar} compacto />
        ) : (
          <div className="skeleton h-[150px] rounded-tarjeta" />
        )}
      </div>

      <div className="flex flex-wrap items-stretch gap-6">
        {/* Comparación */}
        <section style={{ animationDelay: '120ms' }} className="aparece min-w-0 flex-[2_1_440px] rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 gap-y-1">
            <div className="pb-3 text-xs font-extrabold tracking-[0.06em] text-texto-tenue">QUÉ INCLUYE</div>
            <div className="pb-3 text-center text-xs font-extrabold tracking-[0.06em] text-texto-tenue">GRATIS</div>
            <div className="rounded-t-xl bg-primario-suave px-4 pb-3 pt-2 text-center text-xs font-extrabold tracking-[0.06em] text-primario-oscuro">PRO</div>
            {BENEFICIOS.map((b, i) => (
              <div key={b.f} className="contents">
                <div style={{ animationDelay: `${150 + i * 70}ms` }} className="pop-in border-t border-[#F0F2F7] py-3.5 text-[15px] font-bold">{b.f}</div>
                <div style={{ animationDelay: `${150 + i * 70}ms` }} className="pop-in flex justify-center border-t border-[#F0F2F7] py-3.5"><Celda v={b.gratis} /></div>
                <div style={{ animationDelay: `${150 + i * 70}ms` }} className={`pop-in flex justify-center border-t border-[#E6E7FF] bg-primario-suave px-4 py-3.5 ${i === BENEFICIOS.length - 1 ? 'rounded-b-xl' : ''}`}><Celda v={b.pro} pro /></div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Pro */}
        <aside style={{ animationDelay: '200ms' }} className="aparece flex min-w-0 flex-1 basis-[300px] flex-col gap-4 rounded-tarjeta-lg bg-texto p-7 text-white shadow-tarjeta-lg">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[26px] font-bold text-white">Pro</h2>
            <span className="rounded-[10px] bg-acento px-3 py-1 text-[13px] font-extrabold text-texto">Más elegido</span>
          </div>
          <div className="font-display text-[44px] font-bold">{PLAN_DEMO.precioPro}<span className="text-[18px] font-semibold text-[#C9CCE8]"> / mes</span></div>
          <ul className="flex flex-col gap-2.5 text-[15px] text-[#DADCF2]">
            {['Facturas A, B, C y E ilimitadas', 'Recordatorios de cobro', 'Multi-CUIT', 'Soporte prioritario'].map((t) => (
              <li key={t} className="flex items-center gap-2.5"><Icon name="check" size={18} strokeWidth={3} className="flex-none text-acento" />{t}</li>
            ))}
          </ul>
          <button type="button" className="btn-lift pulse-cta mt-auto flex h-[54px] items-center justify-center rounded-full bg-acento text-[17px] font-extrabold text-texto">
            Pasar a Pro
          </button>
          <p className="text-center text-xs text-[#9CA0C8]">Sin permanencia. Cancelás cuando quieras.</p>
        </aside>
      </div>

    </>
  );
}
