'use client';

import { useEffect, useRef, useState } from 'react';
import { Facti } from '@/components/Facti';
import { Icon } from '@/components/Icon';
import { Uso } from '@/components/UsoPlan';
import { cancelarPro, sincronizarPagos, suscribirsePro, type EstadoPagos, type Plan, type Suscripcion } from '@/lib/api';
import type { Medio } from '@/lib/billetera';
import { fecha, pesos } from '@/lib/formato';
import { TarjetaWallet } from './Billetera';
import { botonBorde, Desplegable, Fila, IncluyePro, Tarjeta } from './partes';

const MARCAS: Record<string, string> = {
  visa: 'Visa',
  debvisa: 'Visa Débito',
  master: 'Mastercard',
  debmaster: 'Mastercard Débito',
  amex: 'American Express',
  naranja: 'Naranja',
  cabal: 'Cabal',
  debcabal: 'Cabal Débito',
  maestro: 'Maestro',
};

/** El medio de la suscripción, para dibujarlo como tarjeta. */
function medioDe(s: Suscripcion): Medio | null {
  if (!s.medio) return null;
  if (s.medio === 'account_money') return { id: 'mp', tipo: 'mercadopago', cuenta: 'Mercado Pago' };
  return { id: s.medio, tipo: 'tarjeta', marca: MARCAS[s.medio] ?? s.medio, ultimos: s.ultimos || '••••', vence: s.vence || '··/··' };
}

function nombreMedioMP(medio: string, ultimos: string) {
  if (!medio) return '—';
  if (medio === 'account_money') return 'Dinero en Mercado Pago';
  return `${MARCAS[medio] ?? medio}${ultimos ? ` terminada en ${ultimos}` : ''}`;
}

function EstadoPago({ estado }: { estado: string }) {
  const tonos: Record<string, [string, string]> = {
    aprobado: ['bg-[#EAF8F0] text-[#0E5C38] ring-[#C8EDD8]', 'Aprobado'],
    rechazado: ['bg-error-suave text-error ring-transparent', 'Rechazado'],
    cancelado: ['bg-fondo text-texto-suave ring-transparent', 'Cancelado'],
  };
  const [clase, texto] = tonos[estado] ?? ['bg-aviso-suave text-aviso-texto ring-transparent', 'Pendiente'];
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 font-semibold ring-1 ring-inset ${clase}`}>{texto}</span>;
}

/** "Plan y pagos" con Mercado Pago de verdad: se paga en el checkout de Mercado Pago. */
export function PagosReales({ inicial, uso, titular, email, volvio }: { inicial: EstadoPagos; uso?: Plan; titular?: string; email?: string; volvio: boolean }) {
  const [e, setE] = useState(inicial);
  useEffect(() => setE(inicial), [inicial]);
  const [yendo, setYendo] = useState(false);
  // Mercado Pago rechaza el pago si se paga con otra cuenta que la de este email: por defecto, el de Facti.
  const [emailMp, setEmailMp] = useState(email ?? '');
  useEffect(() => {
    if (email) setEmailMp((v) => v || email);
  }, [email]);
  const [bajando, setBajando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [aviso, setAviso] = useState<{ tono: 'exito' | 'aviso' | 'error'; texto: string } | null>(null);
  const sincronizado = useRef(false);

  // Al volver del checkout, se le pregunta a Mercado Pago cómo quedó.
  useEffect(() => {
    if (!volvio || sincronizado.current) return;
    sincronizado.current = true;
    void sincronizarPagos().then((r) => {
      if (!r.ok) return setAviso({ tono: 'error', texto: r.mensaje });
      setE(r.dato);
      setAviso(
        r.dato.plan === 'pro'
          ? { tono: 'exito', texto: '¡Listo! Ya tenés Facti Pro.' }
          : { tono: 'aviso', texto: 'Mercado Pago todavía no confirmó el pago. Puede tardar unos minutos: te avisamos acá cuando llegue.' },
      );
    });
  }, [volvio]);

  const esPro = e.plan === 'pro';
  // Dio de baja pero le queda Pro pago: no se muestra "Dar de baja" y puede volver.
  const deBaja = esPro && Boolean(e.proHasta);
  const diaSiguiente = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const s = e.suscripcion;
  const medio = s ? medioDe(s) : null;
  const enPesosHoy = e.dolar ? Math.ceil(e.precioUsd * e.dolar.valor) : null;

  async function pasarAPro() {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailMp.trim())) {
      setAviso({ tono: 'error', texto: 'Revisá el email de tu cuenta de Mercado Pago.' });
      return;
    }
    setYendo(true);
    setAviso(null);
    const r = await suscribirsePro(emailMp.trim());
    if (!r.ok) {
      setYendo(false);
      setAviso({ tono: 'error', texto: r.mensaje });
      return;
    }
    window.location.href = r.dato.url;
  }

  async function darDeBaja() {
    setCancelando(true);
    const r = await cancelarPro();
    setCancelando(false);
    setBajando(false);
    if (!r.ok) return setAviso({ tono: 'error', texto: r.mensaje });
    setE(r.dato);
    setAviso({
      tono: 'aviso',
      texto: r.dato.proHasta
        ? `Listo, diste de baja Pro. No se te cobra más y seguís con Pro hasta el ${fecha(r.dato.proHasta)}, lo que ya pagaste.`
        : 'Listo, diste de baja Pro. No se te cobra más.',
    });
  }

  const colorAviso = { exito: 'bg-exito-suave text-exito-texto', aviso: 'bg-aviso-suave text-aviso-texto', error: 'bg-error-suave text-error' };

  return (
    <div className="cascada flex flex-col gap-6">
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        {/* ---------- Tu plan ---------- */}
        <Tarjeta
          titulo="Tu plan"
          icono="corona"
          accion={<span className={`rounded-full px-3 py-1 font-bold ${esPro ? 'bg-acento text-texto' : 'bg-fondo text-texto-suave'}`}>{esPro ? 'Pro' : 'Gratis'}</span>}
        >
          {aviso && (
            <div role="status" className={`aparece flex items-start gap-2.5 rounded-[14px] px-4 py-3 font-semibold ${colorAviso[aviso.tono]}`}>
              <Icon name={aviso.tono === 'exito' ? 'check-circulo' : 'alerta'} size={22} className="mt-0.5 flex-none" />
              {aviso.texto}
            </div>
          )}

          {deBaja ? (
            <>
              <div className="flex flex-col gap-2 rounded-[18px] bg-fondo p-4 sm:p-5">
                <strong>Diste de baja Pro</strong>
                <p className="text-texto-suave">
                  No se te cobra más. Seguís con Pro hasta el <b className="text-texto">{fecha(e.proHasta!)}</b>, lo que ya pagaste; después volvés al plan Gratis.
                </p>
              </div>
              <IncluyePro animado={false} />
              <div className="mt-auto flex flex-col gap-2">
                <label className="flex flex-col gap-1.5">
                  <span className="font-semibold">Email de tu cuenta de Mercado Pago</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={emailMp}
                    onChange={(ev) => setEmailMp(ev.target.value)}
                    className="h-11 rounded-input border-[1.5px] border-borde bg-white px-4 text-texto outline-none focus:border-primario"
                  />
                  <span className="text-texto-tenue">El de la cuenta con la que vas a pagar.</span>
                </label>
                <button
                  type="button"
                  onClick={pasarAPro}
                  disabled={yendo}
                  className="btn-lift inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-acento px-5 font-bold text-texto shadow-[0_6px_16px_rgba(224,161,0,0.25)] disabled:opacity-70"
                >
                  {yendo ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-texto/30 border-t-texto" />
                      Te llevamos a Mercado Pago…
                    </>
                  ) : (
                    <>
                      <Icon name="estrella" size={18} />
                      {s?.estado === 'pending' ? 'Terminar el pago en Mercado Pago' : 'Volver a Pro'}
                    </>
                  )}
                </button>
                <p className="text-texto-suave">Si volvés, el primer cobro es el {fecha(diaSiguiente(e.proHasta!))}: no pagás dos veces el mismo mes.</p>
              </div>
            </>
          ) : esPro && s ? (
            <>
              <dl className="flex flex-col divide-y divide-[#EEF1F6]">
                <Fila k="Precio" v={`${pesos(s.importe)} por mes (US$${s.precioUsd})`} />
                <Fila k="Próximo cobro" v={fecha(s.proximoCobro)} />
                <Fila k="Se cobra con" v={nombreMedioMP(s.medio, s.ultimos)} />
              </dl>
              <IncluyePro animado={false} />
              <div className="flex flex-col">
                <Desplegable abierto={!bajando}>
                  <button type="button" onClick={() => setBajando(true)} className={`${botonBorde} w-full hover:border-error hover:text-error`}>
                    Dar de baja Pro
                  </button>
                </Desplegable>
                <Desplegable abierto={bajando}>
                  <div className="flex flex-col gap-3 rounded-[18px] bg-error-suave p-4 sm:p-5">
                    <strong>¿Volvés al plan Gratis?</strong>
                    <p className="text-texto-suave">Cancelamos la suscripción en Mercado Pago y no se te cobra más. Seguís con Pro hasta el final del mes que ya pagaste; después vuelven los límites de 10 facturas A, B y C y 1 Factura E por mes.</p>
                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={darDeBaja} disabled={cancelando} className="btn-lift inline-flex h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#E5484D] px-5 font-bold text-white disabled:opacity-60">
                        {cancelando && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                        Sí, dar de baja
                      </button>
                      <button type="button" onClick={() => setBajando(false)} disabled={cancelando} className={`${botonBorde} flex-1`}>
                        Seguir con Pro
                      </button>
                    </div>
                  </div>
                </Desplegable>
              </div>
            </>
          ) : (
            <>
              {uso ? (
                <div className="flex flex-col gap-4">
                  <Uso label="Facturas A, B y C" usadas={uso.uso.facturas} limite={uso.limites?.facturas ?? null} />
                  <Uso label="Factura E" usadas={uso.uso.exportacion} limite={uso.limites?.exportacion ?? null} />
                </div>
              ) : (
                <div className="skeleton h-[120px] rounded-[16px]" />
              )}
              <div className="mt-auto flex flex-col gap-3">
                <p className="text-texto-suave">
                  Pro sale <b className="text-texto">US${e.precioUsd} por mes</b>
                  {enPesosHoy && e.dolar ? `: hoy son ${pesos(enPesosHoy)} (dólar BCRA del ${fecha(e.dolar.fecha)})` : ''}. Pagás en Mercado Pago con tarjeta o con tu
                  cuenta, y das de baja cuando quieras.
                </p>
                <label className="flex flex-col gap-1.5">
                  <span className="font-semibold">Email de tu cuenta de Mercado Pago</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={emailMp}
                    onChange={(ev) => setEmailMp(ev.target.value)}
                    className="h-11 rounded-input border-[1.5px] border-borde bg-white px-4 text-texto outline-none focus:border-primario"
                  />
                  <span className="text-texto-tenue">El de la cuenta con la que vas a pagar.</span>
                </label>
                <button
                  type="button"
                  onClick={pasarAPro}
                  disabled={yendo}
                  className="btn-lift inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-acento px-5 font-bold text-texto shadow-[0_6px_16px_rgba(224,161,0,0.25)] disabled:opacity-70"
                >
                  {yendo ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-texto/30 border-t-texto" />
                      Te llevamos a Mercado Pago…
                    </>
                  ) : (
                    <>
                      <Icon name="estrella" size={18} />
                      {s?.estado === 'pending' ? 'Terminar el pago en Mercado Pago' : `Pasar a Pro · US$${e.precioUsd}/mes`}
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </Tarjeta>

        {/* ---------- Medio de pago ---------- */}
        <Tarjeta titulo="Medio de pago" icono="tarjeta">
          {medio && esPro ? (
            <>
              <div className="w-full max-w-[360px]">
                <TarjetaWallet medio={medio} titular={titular} />
              </div>
              <p className="text-texto-suave">
                La tarjeta la guarda Mercado Pago: Facti solo ve la marca, los últimos 4 números y el vencimiento. Para cambiarla, entrá a tus suscripciones en Mercado Pago.
              </p>
              <a href="https://www.mercadopago.com.ar/subscriptions" target="_blank" rel="noopener noreferrer" className={`${botonBorde} mt-auto`}>
                Cambiar en Mercado Pago <Icon name="link-externo" size={18} />
              </a>
            </>
          ) : (
            <div className="flex flex-1 items-center gap-4 rounded-[18px] bg-fondo p-4">
              <span className="flex-none">
                <Facti pose="senalando" size={84} animated />
              </span>
              <p className="text-texto-suave">
                Cuando pasás a Pro elegís en Mercado Pago con qué pagar: tarjeta de crédito, débito o dinero en tu cuenta. Facti nunca ve ni guarda los datos de tu tarjeta.
              </p>
            </div>
          )}
        </Tarjeta>
      </div>

      {/* ---------- Historial ---------- */}
      <section className="flex flex-col gap-4 rounded-tarjeta bg-superficie p-5 shadow-tarjeta sm:p-6">
        <h2 className="text-[20px] font-bold">Tus pagos a Facti</h2>
        {e.pagos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[18px] bg-fondo px-5 py-8 text-center">
            <Facti pose="durmiendo" size={96} />
            <strong>Todavía no hay pagos</strong>
            <p className="max-w-[420px] text-texto-suave">Cuando pases a Pro vas a ver acá cada cobro de Mercado Pago.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-base">
                <thead>
                  <tr className="text-texto-tenue">
                    {['Fecha', 'Concepto', 'Medio', 'Importe', 'Estado'].map((h, i) => (
                      <th key={h} className={`whitespace-nowrap border-b-2 border-[#EDF0F6] px-3 pb-3 font-semibold ${i === 3 ? 'text-right' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {e.pagos.map((p) => (
                    <tr key={p.id} className="border-b border-[#F0F2F7] last:border-0">
                      <td className="whitespace-nowrap px-3 py-4 tabular-nums text-texto-suave">{fecha(p.fecha)}</td>
                      <td className="px-3 py-4 font-semibold">Facti Pro · 1 mes</td>
                      <td className="px-3 py-4 text-texto-suave">{nombreMedioMP(p.medio, p.ultimos)}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-right font-semibold tabular-nums">{pesos(p.importe)}</td>
                      <td className="px-3 py-4">
                        <EstadoPago estado={p.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="flex flex-col divide-y divide-[#EEF1F6] sm:hidden">
              {e.pagos.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                  <div className="flex min-w-0 flex-col">
                    <span className="font-semibold">Facti Pro · 1 mes</span>
                    <span className="text-texto-tenue">
                      {fecha(p.fecha)} · {nombreMedioMP(p.medio, p.ultimos)}
                    </span>
                  </div>
                  <div className="flex flex-none flex-col items-end gap-1">
                    <span className="font-semibold tabular-nums">{pesos(p.importe)}</span>
                    <EstadoPago estado={p.estado} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
