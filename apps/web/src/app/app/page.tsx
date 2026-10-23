'use client';

import Link from 'next/link';
import { AvisoApi } from '@/components/AvisoApi';
import { Facti } from '@/components/Facti';
import { TablaFacturas, TablaSkeleton } from '@/components/TablaFacturas';
import { UsoPlan } from '@/components/UsoPlan';
import { pedir, verCuenta, verResumen } from '@/lib/api';
import { nombreMes, nombrePila, pesos } from '@/lib/formato';
import { useApi } from '@/lib/useApi';

const ACCIONES = [
  { label: 'Nueva Factura C', color: '#2A2DB0', href: '/app/facturas/nueva', icon: (<><path d="M6 3h9l4 4v14H6z" /><path d="M12 11v6M9 14h6" /></>) },
  { label: 'Ver cobros', color: '#0E5C38', href: '/app/cobros', icon: (<><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>) },
  { label: 'Ver clientes', color: '#8A5A00', href: '/app/clientes', icon: (<><circle cx="10" cy="8" r="4" /><path d="M3 20c0-3.9 3.1-7 7-7M18 14v6M15 17h6" /></>) },
];

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export default function Inicio() {
  const resumen = useApi(() => verResumen(), []);
  const cuenta = useApi(verCuenta, []);
  const arca = useApi(() => pedir<{ servidores: { app: string; db: string; auth: string } }>('/arca/estado'), []);

  const r = resumen.dato;
  const mes = r ? nombreMes(r.mes) : '';
  const nombre = cuenta.dato?.cuenta.nombre;
  const pendientes = r?.porCobrar.facturas ?? 0;
  const arcaOk = arca.estado === 'ok' && arca.dato.servidores.app === 'OK';

  const stats = r
    ? [
        { label: `FACTURADO EN ${mes.toUpperCase()}`, valor: pesos(r.delMes.facturado), nota: plural(r.delMes.emitidos, 'comprobante emitido', 'comprobantes emitidos') },
        { label: 'POR COBRAR', valor: pesos(r.porCobrar.total), nota: plural(r.porCobrar.facturas, 'factura pendiente', 'facturas pendientes') },
        { label: `COBRADO EN ${mes.toUpperCase()}`, valor: pesos(r.delMes.cobrado), nota: plural(r.delMes.cobradas, 'factura cobrada', 'facturas cobradas') },
        { label: 'ÚLTIMOS 12 MESES', valor: pesos(r.ultimos12Meses.facturado), nota: 'Lo que cuenta para tu categoría' },
      ]
    : [];

  return (
    <>
      {/* Encabezado */}
      <div className="aparece flex flex-wrap items-center justify-between gap-5">
        <div>
          <h1 className="text-[34px] font-bold">{nombre ? `Hola, ${nombrePila(nombre)}` : 'Hola'}</h1>
          <p className="text-texto-suave">{r ? `Este es el resumen de ${mes}.` : 'Tu resumen del mes.'}</p>
        </div>
        {r && (
          <div className="flex items-center gap-1">
            <div className="f-pop max-w-[300px] rounded-[20px_20px_6px_20px] bg-white px-4 py-3 text-[15px] font-bold shadow-[0_8px_20px_rgba(21,25,58,0.08)]">
              {r.delMes.emitidos === 0 && pendientes === 0 ? (
                <>Todavía no emitiste facturas este mes. <Link href="/app/facturas/nueva" className="text-primario-oscuro underline">¿Hacemos la primera?</Link></>
              ) : pendientes > 0 ? (
                <>Tenés <strong>{plural(pendientes, 'factura por cobrar', 'facturas por cobrar')}</strong>. <Link href="/app/cobros" className="text-primario-oscuro underline">Ver cobros</Link></>
              ) : (
                <>¡Tenés todo cobrado! Buen trabajo.</>
              )}
            </div>
            <Facti pose="alerta" size={110} animated={false} />
          </div>
        )}
      </div>

      {resumen.estado === 'error' && !r && <AvisoApi error={resumen.error} onReintentar={resumen.recargar} />}

      {/* Stat cards */}
      {(r || resumen.estado === 'cargando') && (
        <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
          {r
            ? stats.map((s, i) => (
                <div key={s.label} style={{ animationDelay: `${60 + i * 60}ms` }} className="aparece card-hover flex flex-col gap-1.5 rounded-tarjeta bg-superficie px-6 py-[22px] shadow-tarjeta">
                  <span className="text-[13px] font-extrabold tracking-[0.06em] text-texto-tenue">{s.label}</span>
                  <span className="font-display text-[32px] font-bold tabular-nums">{s.valor}</span>
                  <span className="text-sm text-texto-suave">{s.nota}</span>
                </div>
              ))
            : [0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[122px] rounded-tarjeta" />)}
        </div>
      )}

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
          {!r ? (
            resumen.estado === 'error' ? (
              <p className="py-8 text-center text-texto-suave">No pudimos cargar tus facturas.</p>
            ) : (
              <TablaSkeleton filas={4} />
            )
          ) : r.ultimas.length > 0 ? (
            <TablaFacturas rows={r.ultimas} />
          ) : (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Facti pose="factura" size={120} animated={false} />
              <p className="max-w-[340px] text-texto-suave">Cuando emitas tu primera factura, la vas a ver acá.</p>
              <Link href="/app/facturas/nueva" className="btn-lift rounded-full bg-primario px-6 py-3 font-extrabold text-white shadow-boton">Emitir factura</Link>
            </div>
          )}
        </section>

        <aside className="flex min-w-0 flex-1 basis-[280px] flex-col gap-[18px]">
          {r ? <UsoPlan plan={r.plan} /> : <div className="skeleton h-[230px] rounded-tarjeta" />}
          <div className="flex flex-col gap-2 rounded-tarjeta bg-superficie p-[22px] shadow-tarjeta">
            <h2 className="text-[20px] font-bold">Estado de ARCA</h2>
            {arca.estado === 'cargando' ? (
              <span className="text-sm text-texto-suave">Consultando…</span>
            ) : arcaOk ? (
              <span className="flex items-center gap-2 font-bold text-exito-texto"><span className="h-2.5 w-2.5 rounded-full bg-exito" />Funcionando normal</span>
            ) : arca.estado === 'error' && arca.error.codigo === 'configuracion' ? (
              <>
                <span className="flex items-center gap-2 font-bold text-aviso-texto"><span className="h-2.5 w-2.5 rounded-full bg-[#E0A100]" />Falta conectar Facti con ARCA</span>
                <Link href="/onboarding/arca" className="text-sm font-extrabold text-primario-oscuro">Conectar ahora</Link>
              </>
            ) : (
              <span className="flex items-center gap-2 font-bold text-[#B4232B]"><span className="h-2.5 w-2.5 rounded-full bg-[#E5484D]" />ARCA no responde ahora</span>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
