'use client';

import Link from 'next/link';
import { Numero } from '@/components/Animado';
import { AvisoApi } from '@/components/AvisoApi';
import { Facti } from '@/components/Facti';
import { GraficoFacturacion } from '@/components/GraficoFacturacion';
import { Icon } from '@/components/Icon';
import { TablaFacturas, TablaSkeleton } from '@/components/TablaFacturas';
import { UsoPlan } from '@/components/UsoPlan';
import { pedir, verCuenta, verResumen } from '@/lib/api';
import { nombreMes, nombrePila, pesos } from '@/lib/formato';
import { useApi } from '@/lib/useApi';


const ESTADOS_ARCA = {
  cargando: { tono: 'bg-fondo text-texto-tenue', punto: 'bg-[#C5CCDC]', texto: 'Consultando…' },
  ok: { tono: 'bg-exito-suave text-exito-texto', punto: 'bg-exito', texto: 'Funcionando normal' },
  sin_conectar: { tono: 'bg-aviso-suave text-aviso-texto', punto: 'bg-[#E0A100]', texto: 'Falta conectar tu CUIT' },
  caido: { tono: 'bg-error-suave text-error', punto: 'bg-[#E5484D]', texto: 'ARCA no responde ahora' },
} as const;

function EstadoArca({ estado }: { estado: keyof typeof ESTADOS_ARCA }) {
  const e = ESTADOS_ARCA[estado];
  return (
    <div className="flex flex-col gap-4 rounded-tarjeta bg-superficie p-5 shadow-tarjeta">
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-[14px] ${e.tono}`}>
          <Icon name="arca" size={22} />
        </span>
        <div className="flex min-w-0 flex-col">
          <h2 className="text-[17px] font-bold leading-tight">Conexión con ARCA</h2>
          <span className="flex items-center gap-1.5 whitespace-nowrap text-[14px] text-texto-suave">
            <span className={`h-2 w-2 flex-none rounded-full ${e.punto}`} />
            {e.texto}
          </span>
        </div>
      </div>
      {estado === 'sin_conectar' && (
        <Link href="/onboarding/arca" className="btn-lift inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primario px-5 text-[15px] font-bold text-white shadow-boton">
          Conectar con ARCA
        </Link>
      )}
    </div>
  );
}

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
        { label: `Facturado en ${mes}`, valor: r.delMes.facturado, nota: plural(r.delMes.emitidos, 'comprobante emitido', 'comprobantes emitidos'), href: '/app/facturas' },
        { label: 'Por cobrar', valor: r.porCobrar.total, nota: plural(r.porCobrar.facturas, 'factura pendiente', 'facturas pendientes'), href: '/app/cobros' },
        { label: `Cobrado en ${mes}`, valor: r.delMes.cobrado, nota: plural(r.delMes.cobradas, 'factura cobrada', 'facturas cobradas'), href: '/app/cobros' },
        { label: 'Últimos 12 meses', valor: r.ultimos12Meses.facturado, nota: 'Lo que cuenta para tu categoría', href: '/app/monotributo/pagos' },
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
          <div className="entra flex items-center gap-1">
            <div className="f-pop max-w-[300px] rounded-[20px_20px_6px_20px] bg-white px-4 py-3 text-[15px] font-semibold shadow-[0_8px_20px_rgba(21,25,58,0.08)]">
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
        <div className={`grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))] ${r ? 'cascada' : ''}`}>
          {r
            ? stats.map((s) => (
                // Cada tarjeta lleva a su pantalla: reemplaza la fila de botones "Ver cobros / Ver clientes".
                <Link
                  key={s.label}
                  href={s.href}
                  className="card-hover group flex flex-col gap-1.5 rounded-tarjeta bg-superficie px-6 py-[22px] shadow-tarjeta outline-none focus-visible:ring-2 focus-visible:ring-primario"
                >
                  <span className="flex items-center justify-between gap-2 text-[14px] font-semibold text-texto-tenue">
                    <span className="whitespace-nowrap">{s.label}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0.5 group-hover:opacity-100">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </span>
                  <span className="whitespace-nowrap font-display text-[32px] font-semibold tabular-nums"><Numero valor={s.valor} formato={pesos} /></span>
                  <span className="text-sm text-texto-suave">{s.nota}</span>
                </Link>
              ))
            : [0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[122px] rounded-tarjeta" />)}
        </div>
      )}

      {r && (
        <div style={{ animationDelay: '75ms' }} className="aparece">
          <GraficoFacturacion porMes={r.ultimos12Meses.porMes} total={r.ultimos12Meses.facturado} categoria={cuenta.dato?.cuenta.categoria} />
        </div>
      )}

      {/* Tabla + aside */}
      <div style={{ animationDelay: '90ms' }} className="aparece flex flex-wrap items-start gap-[22px]">
        <section className="min-w-0 flex-[999_1_560px] rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[22px] font-bold">Últimas facturas</h2>
            <Link href="/app/facturas" className="font-bold text-primario-oscuro">Ver todas</Link>
          </div>
          {!r ? (
            resumen.estado === 'error' ? (
              <p className="py-8 text-center text-texto-suave">No pudimos cargar tus facturas.</p>
            ) : (
              <TablaSkeleton filas={4} />
            )
          ) : r.ultimas.length > 0 ? (
            <TablaFacturas compacta rows={r.ultimas} />
          ) : (
            <div className="entra flex flex-col items-center gap-3 py-10 text-center">
              <Facti pose="factura" size={120} animated={false} />
              <p className="max-w-[340px] text-texto-suave">Cuando emitas tu primera factura, la vas a ver acá.</p>
              <Link href="/app/facturas/nueva" className="inline-flex items-center justify-center btn-lift rounded-full bg-primario px-6 h-12 font-bold text-white shadow-boton">Emitir factura</Link>
            </div>
          )}
        </section>

        <aside className="flex min-w-0 flex-1 basis-[280px] flex-col gap-[18px]">
          {r ? (
            <div className="entra" style={{ '--i': 2 } as React.CSSProperties}>
              <UsoPlan plan={r.plan} />
            </div>
          ) : (
            <div className="skeleton h-[230px] rounded-tarjeta" />
          )}
          <EstadoArca estado={arca.estado === 'cargando' ? 'cargando' : arcaOk ? 'ok' : arca.estado === 'error' && arca.error.codigo === 'configuracion' ? 'sin_conectar' : 'caido'} />
        </aside>
      </div>
    </>
  );
}
