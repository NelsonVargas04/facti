'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Facti } from '@/components/Facti';
import { Icon } from '@/components/Icon';
import { Select } from '@/components/Select';
import { ComprobantePagoVEP, type DatosPagoVEP } from '@/components/ComprobantePagoVEP';
import { PLAN_DEMO } from '@/lib/plan-demo';
import { Recategorizacion, ResumenMonotributo } from '@/components/monotributo/Pestanas';
import { verCategorias, verCuenta, verResumen, verTopes } from '@/lib/api';
import { formatearCuit } from '@/lib/formato';
import { useApi } from '@/lib/useApi';
import { BotonVideo } from '@/components/guia/PaginaGuia';

/** Los recordatorios de vencimiento son exclusivos del plan Pro. */
const ES_PRO = PLAN_DEMO.plan !== 'Gratis';

const CONTRIBUYENTE = { cuit: '27-31456789-4', nombre: 'PEREZ, MARIA LAURA' };
const COMP_ESTANDAR = [
  { concepto: 'Impuesto integrado', importe: '18.246,86' },
  { concepto: 'Aportes jubilatorios (SIPA)', importe: '22.078,71' },
  { concepto: 'Obra social', importe: '25.694,55' },
];

interface Pago {
  id: string;
  periodo: string; // 'Octubre 2026'
  periodoFiscal: string; // '10/2026'
  importe: string;
  vence: string; // '20/10'
  vencimiento: string; // '20/10/2026'
  generado: string; // '01/10/2026'
  pagado: string; // '05/08' | '—'
  medio: string;
  estado: 'Pagado' | 'Pendiente';
  componentes: { concepto: string; importe: string }[];
  vep?: { nro: string; fechaPago: string; transaccion: string; control: string };
}

const HISTORIAL: Pago[] = [
  { id: '2026-10', periodo: 'Octubre 2026', periodoFiscal: '10/2026', importe: '$66.020,12', vence: '20/10', vencimiento: '20/10/2026', generado: '01/10/2026', pagado: '—', medio: '—', estado: 'Pendiente', componentes: COMP_ESTANDAR },
  { id: '2026-09', periodo: 'Septiembre 2026', periodoFiscal: '09/2026', importe: '$66.020,12', vence: '22/09', vencimiento: '22/09/2026', generado: '01/09/2026', pagado: '18/09', medio: 'Mercado Pago', estado: 'Pagado', componentes: COMP_ESTANDAR, vep: { nro: '1500441290', fechaPago: '18/09/2026 · 09:42', transaccion: '2819004471', control: '9BD34A' } },
  { id: '2026-08', periodo: 'Agosto 2026', periodoFiscal: '08/2026', importe: '$66.020,12', vence: '20/08', vencimiento: '20/08/2026', generado: '01/08/2026', pagado: '05/08', medio: 'Mercado Pago', estado: 'Pagado', componentes: COMP_ESTANDAR, vep: { nro: '1500328841', fechaPago: '05/08/2026 · 00:15', transaccion: '2740015526', control: '7AC21F' } },
  { id: '2026-07', periodo: 'Julio 2026', periodoFiscal: '07/2026', importe: '$56.511,40', vence: '21/07', vencimiento: '21/07/2026', generado: '01/07/2026', pagado: '19/07', medio: 'Débito automático', estado: 'Pagado', componentes: [{ concepto: 'Impuesto integrado', importe: '15.617,40' }, { concepto: 'Aportes jubilatorios (SIPA)', importe: '18.894,00' }, { concepto: 'Obra social', importe: '22.000,00' }], vep: { nro: '1500217733', fechaPago: '19/07/2026 · 02:00', transaccion: '2655178830', control: '4FE902' } },
];

const ESTADOS = [
  { value: 'todos', label: 'Todos' },
  { value: 'pagado', label: 'Pagados' },
  { value: 'pendiente', label: 'Pendientes' },
];
const ORDENES = [
  { value: 'reciente', label: 'Más reciente' },
  { value: 'antiguo', label: 'Más antiguo' },
  { value: 'mayor', label: 'Mayor monto' },
  { value: 'menor', label: 'Menor monto' },
];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const montoNum = (s: string) => Number(s.replace(/[.$\s]/g, '').replace(',', '.')) || 0;
const periodoKey = (p: Pago) => {
  const [m, a] = p.periodoFiscal.split('/').map(Number);
  return (a ?? 0) * 100 + (m ?? 0);
};

function aDatosVEP(p: Pago): DatosPagoVEP {
  return {
    vep: p.vep!.nro,
    generado: p.generado,
    vencimiento: p.vencimiento,
    contribuyente: CONTRIBUYENTE,
    impuesto: '20 - Monotributo',
    concepto: 'Pago mensual',
    periodo: p.periodoFiscal,
    componentes: p.componentes,
    total: p.importe,
    pago: { red: p.medio, fecha: p.vep!.fechaPago, transaccion: p.vep!.transaccion, control: p.vep!.control },
  };
}

const PRIMER_PAGADO = HISTORIAL.find((p) => p.estado === 'Pagado')!.id;

const pesosExacto = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Externo() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>;
}

export default function MonotributoPagos() {
  const [tab, setTab] = useState('resumen');
  const cuenta = useApi(verCuenta, []);
  const resumen = useApi(() => verResumen(), []);
  const categorias = useApi(verCategorias, []);
  const topes = useApi(verTopes, []);
  const c = cuenta.dato?.cuenta;
  // Cuota del mes con los valores oficiales de tu categoría (tabla de ARCA) y vencimiento el día 20.
  const ahoraAR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const mesNombre = ahoraAR.toLocaleDateString('es-AR', { month: 'long' });
  const mm = String(ahoraAR.getMonth() + 1).padStart(2, '0');
  const periodo = `${mm}/${ahoraAR.getFullYear()}`;
  const venceTxt = `20/${mm}`;
  const fila = categorias.dato?.categorias.find((x) => x.letra === c?.categoria?.toUpperCase());
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('todos');
  const [orden, setOrden] = useState('reciente');
  const [selId, setSelId] = useState(PRIMER_PAGADO);

  const visibles = useMemo(() => {
    const n = norm(q.trim());
    const arr = HISTORIAL.filter((p) => {
      if (estado === 'pagado' && p.estado !== 'Pagado') return false;
      if (estado === 'pendiente' && p.estado !== 'Pendiente') return false;
      if (n && !norm(p.periodo).includes(n) && !(p.vep?.nro ?? '').includes(n)) return false;
      return true;
    });
    switch (orden) {
      case 'antiguo': arr.sort((a, b) => periodoKey(a) - periodoKey(b)); break;
      case 'mayor': arr.sort((a, b) => montoNum(b.importe) - montoNum(a.importe)); break;
      case 'menor': arr.sort((a, b) => montoNum(a.importe) - montoNum(b.importe)); break;
      default: arr.sort((a, b) => periodoKey(b) - periodoKey(a)); // más reciente
    }
    return arr;
  }, [q, estado, orden]);

  const sel = HISTORIAL.find((p) => p.id === selId);

  return (
    <>
      {/* Encabezado + tabs */}
      <div className="aparece flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-tight sm:text-[34px]">Monotributo</h1>
          <p className="text-texto-suave">{c ? [c.categoria && `Categoría ${c.categoria}`, c.cuit && `CUIT ${formatearCuit(c.cuit)}`].filter(Boolean).join(' · ') : ' '}</p>
        </div>
        <nav aria-label="Secciones de monotributo" className="grid w-full grid-cols-3 gap-1 rounded-input bg-[#E8EBF2] p-1 sm:inline-flex sm:w-auto">
          {[['resumen', 'Resumen', 'Resumen'], ['pagos', 'Pagos', 'Pagos'], ['recategorizacion', 'Recategorización', 'Categoría']].map(([id, label, corto]) => {
            const on = tab === id;
            return (
              <button key={id} type="button" onClick={() => setTab(id)} aria-current={on ? 'page' : undefined}
                className={`whitespace-nowrap rounded-xl px-2 py-2.5 transition-colors sm:px-[18px] ${on ? 'bg-white font-bold text-texto shadow-[0_2px_8px_rgba(21,25,58,0.08)]' : 'font-semibold text-texto-suave hover:text-texto'}`}>
                <span className="sm:hidden">{corto}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {tab === 'resumen' && (
        <ResumenMonotributo
          resumen={resumen}
          cuenta={c}
          escala={categorias.dato}
          topes={topes.dato}
          onImportado={() => {
            void topes.recargar();
            void resumen.recargar();
          }}
        />
      )}
      {tab === 'recategorizacion' && <Recategorizacion resumen={resumen} cuenta={c} escala={categorias.dato} topes={topes.dato} />}

      {tab === 'pagos' && (
      <>
      {/* Cuota + recordatorio */}
      <div style={{ animationDelay: '20ms' }} className="aparece flex flex-wrap items-stretch gap-6">
        <section className="flex min-w-0 flex-[999_1_480px] flex-col gap-5 rounded-tarjeta bg-superficie p-5 shadow-tarjeta sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[24px] font-bold first-letter:uppercase">Tu cuota de {mesNombre}</h2>
              <p className="text-texto-suave">{c?.categoria ? `Categoría ${c.categoria.toUpperCase()} · servicios` : 'Cargá tu categoría para ver tu cuota'}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-aviso-suave px-3.5 py-1.5 font-bold text-aviso-texto">
              <Icon name="calendario" size={18} />
              Vence el {venceTxt}
            </span>
          </div>

          {fila ? (
            <>
              <dl className="flex flex-col gap-2.5">
                {(
                  [
                    ['Impuesto integrado', 'Lo que pagás de impuesto', fila.impServicios],
                    ['Aportes jubilatorios (SIPA)', 'Para tu jubilación', fila.sipa],
                    ['Obra social', 'Tu cobertura de salud', fila.obraSocial],
                  ] as const
                ).map(([k, ayuda, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4">
                    <dt className="flex flex-col">
                      <span>{k}</span>
                      <span className="text-texto-tenue">{ayuda}</span>
                    </dt>
                    <dd className="whitespace-nowrap font-semibold tabular-nums">{pesosExacto(v)}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap items-baseline justify-between gap-3 rounded-[16px] bg-fondo px-5 py-4">
                <strong>Total a pagar</strong>
                <span className="whitespace-nowrap font-display text-[30px] font-semibold tabular-nums sm:text-[36px]">{pesosExacto(fila.cuotaServicios)}</span>
              </div>
              <p className="text-texto-tenue">Si vendés cosas muebles en vez de servicios, tu cuota es {pesosExacto(fila.cuotaVentas)}. Valores de ARCA.</p>
            </>
          ) : (
            <div className="skeleton h-[180px] rounded-[16px]" />
          )}

          <div className="flex flex-col">
            <h3 className="mb-1 font-bold">Cómo pagarla, en 3 pasos</h3>
            <div className="flex items-start gap-3.5 border-t border-[#EDF0F6] py-4">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-primario-suave font-bold text-primario-oscuro">1</span>
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div>
                  <strong>Generá el VEP en ARCA</strong>
                  <p className="text-texto-suave">
                    Entrá a ARCA con tu clave fiscal, abrí <b>CCMA</b> › <b>Volante de pago</b>, marcá el período <b>{periodo}</b> y tocá <b>Generar VEP o QR</b>.
                  </p>
                </div>
                <BotonVideo href="/guias/pagar-monotributo" portada="/videos/pagar-monotributo.jpg" titulo="Ver cómo se hace" texto="Video paso a paso: generar el VEP y pagarlo. Menos de 2 minutos." />
                <a href="https://www.arca.gob.ar" target="_blank" rel="noopener noreferrer" className="btn-lift inline-flex h-11 items-center gap-2 self-start rounded-full bg-primario px-5 font-bold text-white shadow-boton">
                  Ir a ARCA <Externo />
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3.5 border-t border-[#EDF0F6] py-4">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-primario-suave font-bold text-primario-oscuro">2</span>
              <div className="min-w-0">
                <strong>Pagalo</strong>
                <p className="text-texto-suave">
                  Con billetera (Mercado Pago, Cuenta DNI, Ualá…): tocá <b>Pagar con QR</b> en la app y escaneá el código del VEP. Ojo: desde la app de la billetera, no con la cámara. También podés pagarlo por home banking.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3.5 border-t border-[#EDF0F6] py-4">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-primario-suave font-bold text-primario-oscuro">3</span>
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <strong>Subí el comprobante a Facti</strong>
                  <p className="text-texto-suave">El PDF que te da la billetera o el banco. Lo leo y lo guardo en tu historial.</p>
                </div>
                <a href="#subir" className="btn-lift inline-flex h-11 items-center rounded-full border-[1.5px] border-borde px-5 font-bold text-texto hover:border-primario hover:text-primario-oscuro">
                  Subir comprobante
                </a>
              </div>
            </div>
          </div>
          <p className="text-texto-tenue">El pago se hace siempre en ARCA, tu billetera o tu banco. Facti te guía y lleva el registro, pero no paga por vos.</p>
        </section>

        <aside className="flex flex-1 basis-[300px] flex-col items-center justify-center gap-3 rounded-tarjeta bg-texto p-7 text-center text-white">
          {ES_PRO ? (
            <>
              <Facti pose="alerta" size={150} />
              <p className="font-semibold leading-snug">Pagando antes del <span className="text-acento">{venceTxt}</span> no tenés intereses. ¿Te lo recuerdo 2 días antes?</p>
              <button type="button" className="inline-flex items-center justify-center btn-lift h-11 rounded-full bg-acento px-5 font-bold text-texto">Sí, recordámelo</button>
            </>
          ) : (
            <>
              <Facti pose="senalando" size={150} />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-base font-bold text-acento">
                <Icon name="chispa" size={14} />Función Pro
              </span>
              <p className="font-semibold leading-snug">Pagando antes del <span className="text-acento">{venceTxt}</span> no tenés intereses. Con <strong>Pro</strong> te aviso 2 días antes así no se te pasa.</p>
              <Link href="/app/plan" className="btn-lift flex h-11 items-center gap-2 rounded-full bg-acento px-5 font-bold text-texto">
                <Icon name="corona" size={18} />Pasá a Pro
              </Link>
              <span className="text-base text-[#9CA0C8]">Desde {PLAN_DEMO.precioPro} / mes · cancelás cuando quieras</span>
            </>
          )}
        </aside>
      </div>

      {/* Subir comprobante */}
      <section id="subir" style={{ animationDelay: '40ms' }} className="aparece flex flex-wrap items-center justify-between gap-4 rounded-tarjeta border-2 border-dashed border-[#B9BED3] bg-superficie p-7">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-primario-suave text-primario-oscuro">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>
          </span>
          <div>
            <strong className="text-[17px]">Arrastrá acá el PDF de tu comprobante de pago</strong>
            <div className="text-base text-texto-suave">Facti lee el número de VEP, el período, el importe, la fecha y el código de control.</div>
          </div>
        </div>
        <label className="btn-lift flex h-12 cursor-pointer items-center rounded-full bg-primario px-6 font-bold text-white shadow-boton">
          Elegir archivo
          <input type="file" accept="application/pdf" className="hidden" />
        </label>
      </section>

      {/* Historial + comprobante */}
      <div style={{ animationDelay: '60ms' }} className="aparece flex flex-wrap items-stretch gap-6">
        <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-4 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
          <h2 className="text-[22px] font-bold">Historial de pagos</h2>

          {/* Filtros */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
              <span className="text-base font-semibold">Buscar</span>
              <div className="flex h-11 items-center gap-2 rounded-input border-[1.5px] border-borde bg-white px-3.5 transition-colors focus-within:border-primario">
                <Icon name="buscar" size={18} className="flex-none text-texto-tenue" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Período o N° de VEP…" className="h-full w-full bg-transparent text-base text-texto outline-none placeholder:text-texto-tenue" />
              </div>
            </div>
            <div className="flex w-[150px] flex-col gap-1.5">
              <span className="text-base font-semibold">Estado</span>
              <Select ariaLabel="Estado" value={estado} onChange={setEstado} options={ESTADOS} />
            </div>
            <div className="flex w-[165px] flex-col gap-1.5">
              <span className="text-base font-semibold">Ordenar por</span>
              <Select ariaLabel="Ordenar por" value={orden} onChange={setOrden} options={ORDENES} />
            </div>
          </div>

          {visibles.length > 0 ? (
            <div className="@container">
              {/* Con poco ancho, lista; si entra, tabla. */}
              <ul className="flex flex-col gap-1 @min-[720px]:hidden">
                {visibles.map((h) => {
                  const on = h.id === selId;
                  return (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => setSelId(h.id)}
                        aria-current={on ? 'true' : undefined}
                        className={`flex w-full items-start gap-3 rounded-[14px] px-3 py-3 text-left transition-colors ${on ? 'bg-primario-suave/60' : 'hover:bg-fondo'}`}
                      >
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="font-semibold">{h.periodo}</span>
                          <span className="text-texto-tenue">Vence {h.vence}{h.pagado && h.pagado !== '—' ? ` · Pagado el ${h.pagado}` : ''}</span>
                        </span>
                        <span className="flex flex-none flex-col items-end gap-1.5">
                          <span className="font-semibold tabular-nums">{h.importe}</span>
                          {h.estado === 'Pagado'
                          ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF8F0] px-2.5 py-1 text-base font-semibold text-[#0E5C38] ring-1 ring-inset ring-[#C8EDD8]"><span className="h-[7px] w-[7px] rounded-full bg-[#1E9E63]" />Pagado</span>
                          : <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF6E1] px-2.5 py-1 text-base font-semibold text-[#7A5200] ring-1 ring-inset ring-[#F3E1A6]"><span className="h-[7px] w-[7px] rounded-full bg-[#E0A100]" />Pendiente</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            <div className="hidden overflow-y-hidden overflow-x-auto @min-[720px]:block">
              <table className="w-full border-collapse text-base">
                <thead>
                  <tr className="text-base text-texto-tenue">
                    {['Período', 'Importe', 'Vence', 'Pagado el', 'Medio', 'Estado', ''].map((h, i) => (
                      <th key={h || 'acc'} className={`whitespace-nowrap border-b-2 border-[#EDF0F6] px-3 pb-3 font-semibold ${i === 1 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((h) => {
                    const on = h.id === selId;
                    return (
                      <tr
                        key={h.id}
                        onClick={() => setSelId(h.id)}
                        aria-current={on ? 'true' : undefined}
                        className={`cursor-pointer border-b border-[#F0F2F7] transition-colors last:border-0 ${on ? 'bg-primario-suave/60' : 'hover:bg-fondo'}`}
                      >
                        <td className="rounded-l-[10px] px-3 py-4 font-semibold">
                          <span className="flex items-center gap-2">
                            {on && <span className="h-4 w-1 flex-none rounded-full bg-primario" />}
                            {h.periodo}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-right font-semibold tabular-nums">{h.importe}</td>
                        <td className="px-3 py-4 tabular-nums text-texto-suave">{h.vence}</td>
                        <td className="px-3 py-4 tabular-nums text-texto-suave">{h.pagado}</td>
                        <td className="px-3 py-4 text-texto-suave">{h.medio}</td>
                        <td className="px-3 py-4">
                          {h.estado === 'Pagado'
                            ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF8F0] px-2.5 py-1 text-base font-semibold text-[#0E5C38] ring-1 ring-inset ring-[#C8EDD8]"><span className="h-[7px] w-[7px] rounded-full bg-[#1E9E63]" />Pagado</span>
                            : <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF6E1] px-2.5 py-1 text-base font-semibold text-[#7A5200] ring-1 ring-inset ring-[#F3E1A6]"><span className="h-[7px] w-[7px] rounded-full bg-[#E0A100]" />Pendiente</span>}
                        </td>
                        <td className="rounded-r-[10px] px-3 py-4 text-right">
                          <span className={`inline-flex items-center gap-1 text-base font-bold ${on ? 'text-primario-oscuro' : 'text-texto-tenue'}`}>
                            {h.estado === 'Pagado' ? 'Ver' : 'Detalle'}
                            <Icon name="chevron-derecha" size={15} />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Facti pose="durmiendo" size={130} animated />
              <h3 className="text-[18px] font-bold">No encontramos pagos</h3>
              <p className="max-w-[320px] text-texto-suave">Probá con otra búsqueda o cambiá el filtro de estado.</p>
            </div>
          )}
        </section>

        {/* Detalle del pago seleccionado */}
        <section className="flex flex-1 basis-[340px] flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[20px] font-bold">Comprobante de pago</h2>
            {sel?.estado === 'Pagado' && (
              <span className="inline-flex items-center gap-1.5 text-base font-bold text-exito-texto">
                <Icon name="check" size={16} strokeWidth={3} />Leído del PDF
              </span>
            )}
          </div>

          {sel?.estado === 'Pagado' && sel.vep ? (
            <>
              <p className="-mt-1 text-base text-texto-suave">{sel.periodo} · Monotributo pago mensual</p>
              <ComprobantePagoVEP datos={aDatosVEP(sel)} />
              <a href="#descargar" className="btn-lift flex h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-borde bg-superficie font-bold text-texto hover:border-primario hover:text-primario-oscuro">
                <Icon name="descargar" size={18} />Descargar comprobante de ARCA
              </a>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-tarjeta border-2 border-dashed border-[#C7CBDA] bg-superficie p-7 text-center">
              <Facti pose="buscando" size={130} animated />
              <strong className="text-[17px]">Todavía no hay comprobante</strong>
              <p className="max-w-[260px] text-base text-texto-suave">
                {sel ? `La cuota de ${sel.periodo} figura como pendiente. Cuando la pagues y subas el PDF, el comprobante aparece acá.` : 'Elegí un pago del historial para ver su comprobante.'}
              </p>
              {sel?.estado === 'Pendiente' && (
                <a href="#subir" className="btn-lift mt-1 flex h-11 items-center gap-2 rounded-full bg-primario px-5 font-bold text-white shadow-boton">
                  <Icon name="descargar" size={18} className="rotate-180" />Subir comprobante
                </a>
              )}
            </div>
          )}
        </section>
      </div>
      </>
      )}
    </>
  );
}
