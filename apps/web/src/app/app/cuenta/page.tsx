'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AvisoApi } from '@/components/AvisoApi';
import { Facti } from '@/components/Facti';
import { Icon } from '@/components/Icon';
import { Uso } from '@/components/UsoPlan';
import { Billetera } from '@/components/billetera/Billetera';
import { MedioDestacado, MiniLogo } from '@/components/billetera/TarjetaVisual';
import { botonBorde, botonPrimario, Desplegable, Estado, Fila, IncluyePro, Tarjeta } from '@/components/billetera/partes';
import { verCuenta, verPagos } from '@/lib/api';
import { PagosReales } from '@/components/billetera/PagosReales';
import { nombreMedio, useBilletera, type Medio } from '@/lib/billetera';
import { fecha } from '@/lib/formato';
import { PLAN_DEMO } from '@/lib/plan-demo';
import { useApi } from '@/lib/useApi';

const PRECIO = PLAN_DEMO.precioPro;

function LogoMedio({ m }: { m: Medio }) {
  return <MiniLogo medio={m} />;
}

export default function PlanYPagos() {
  // useSearchParams necesita un Suspense alrededor.
  return (
    <Suspense>
      <Contenido />
    </Suspense>
  );
}

function Contenido() {
  const cuenta = useApi(verCuenta, []);
  // Si la API tiene Mercado Pago configurado, se cobra de verdad; si no, queda la vista previa.
  const pagos = useApi(verPagos, []);
  const w = useBilletera();
  const b = w.billetera;
  const params = useSearchParams();

  const [agregando, setAgregando] = useState<null | 'tarjeta' | 'mercadopago'>(null);
  const [pagando, setPagando] = useState(false);
  const [elegido, setElegido] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [recienPago, setRecienPago] = useState(false);
  const [bajando, setBajando] = useState(false);
  const [cargada, setCargada] = useState<Medio | null>(null);
  const [mostrarAgregar, setMostrarAgregar] = useState(false);

  // Desde "Pasar a Pro" en otras pantallas se llega con ?pro=1: abre el pago directo.
  useEffect(() => {
    if (params.get('pro') === '1') setPagando(true);
  }, [params]);
  useEffect(() => {
    if (b && !elegido) setElegido(b.principal ?? b.medios[0]?.id ?? null);
  }, [b, elegido]);

  const plan = cuenta.dato?.plan;
  const titular = cuenta.dato?.cuenta.nombre ?? undefined;
  const esPro = b?.plan === 'pro';
  const medioDe = (id?: string) => b?.medios.find((m) => m.id === id);
  const principal = b ? (medioDe(b.principal) ?? b.medios[0]) : undefined;

  function confirmarPago() {
    if (!elegido || procesando) return;
    setProcesando(true);
    setTimeout(() => {
      w.pasarAPro(elegido, PRECIO);
      setProcesando(false);
      setPagando(false);
      setRecienPago(true);
    }, 1100);
  }

  const encabezado = (
    <div className="aparece">
      <h1 className="text-[28px] font-bold leading-tight sm:text-[34px]">Plan y pagos</h1>
      <p className="text-texto-suave">Tu plan, tus medios de pago y lo que le pagaste a Facti.</p>
    </div>
  );

  // Hasta saber si hay Mercado Pago, esqueleto (así no aparece la vista previa un instante).
  if (!pagos.dato && pagos.estado === 'cargando') {
    return (
      <>
        {encabezado}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="skeleton h-[320px] rounded-tarjeta" />
          <div className="skeleton h-[320px] rounded-tarjeta" />
        </div>
      </>
    );
  }

  if (pagos.dato?.mercadoPago) {
    return (
      <>
        {encabezado}
        <PagosReales inicial={pagos.dato} uso={plan} titular={titular} email={cuenta.dato?.cuenta.email} volvio={params.get('mp') === 'vuelta'} />
        <p className="text-texto-tenue">
          ¿Querés irte del todo? Usá el <Link href="/baja" className="font-semibold text-texto-suave underline underline-offset-2">botón de baja de servicio</Link>.
        </p>
      </>
    );
  }

  return (
    <>
      {encabezado}

      <div role="note" className="aparece flex items-start gap-3 rounded-[18px] bg-primario-suave px-4 py-3.5 text-primario-oscuro sm:px-5">
        <Icon name="info" size={22} className="mt-0.5 flex-none" />
        <p>
          <strong>Vista previa:</strong> todavía no cobramos nada, así que podés probar todo sin miedo. Cuando esté listo, la tarjeta se carga en el formulario seguro
          de Mercado Pago: Facti nunca ve ni guarda el número ni el código.
        </p>
      </div>

      {cuenta.estado === 'error' && !cuenta.dato && <AvisoApi error={cuenta.error} onReintentar={cuenta.recargar} />}

      {!b ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="skeleton h-[320px] rounded-tarjeta" />
          <div className="skeleton h-[320px] rounded-tarjeta" />
        </div>
      ) : (
        <div className="cascada flex flex-col gap-6">
          <div className="flex flex-col gap-6">
            {/* ---------- Tu plan ---------- */}
            <Tarjeta
              titulo="Tu plan"
              icono="corona"
              accion={
                <span className={`rounded-full px-3 py-1 font-bold ${esPro ? 'bg-acento text-texto' : 'bg-fondo text-texto-suave'}`}>{esPro ? 'Pro' : 'Gratis'}</span>
              }
            >
              {recienPago && esPro && (
                <div role="status" className="aparece flex items-center gap-2.5 rounded-[14px] bg-exito-suave px-4 py-3 font-semibold text-exito-texto">
                  <Icon name="check-circulo" size={22} className="flex-none" />
                  ¡Listo! Ya tenés Facti Pro.
                </div>
              )}

              {esPro ? (
                <div className="grid items-stretch gap-5 lg:grid-cols-2">
                  <dl className="flex flex-col justify-center divide-y divide-[#EEF1F6]">
                    <Fila k="Facturas A, B, C y E" v="Ilimitadas" />
                    <Fila k="Precio" v={`${PRECIO} por mes`} />
                    <Fila k="Próximo cobro" v={fecha(b.proximoCobro)} />
                    <Fila k="Se cobra con" v={medioDe(b.principal) ? nombreMedio(medioDe(b.principal)!) : 'Elegí un medio de pago'} />
                  </dl>
                  <IncluyePro />
                </div>
              ) : plan ? (
                <div className="grid gap-6 sm:grid-cols-2">
                  <Uso label="Facturas A, B y C" usadas={plan.uso.facturas} limite={plan.limites?.facturas ?? null} />
                  <Uso label="Factura E" usadas={plan.uso.exportacion} limite={plan.limites?.exportacion ?? null} />
                </div>
              ) : (
                <div className="skeleton h-[120px] rounded-[16px]" />
              )}

              {/* Pasar a Pro: el pago se arma acá mismo */}
              {!esPro && (
                <div className="mt-auto flex flex-col">
                  <Desplegable abierto={!pagando}>
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="button" onClick={() => setPagando(true)} className="btn-lift inline-flex h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-acento px-5 font-bold text-texto shadow-[0_6px_16px_rgba(224,161,0,0.25)]">
                        <Icon name="estrella" size={18} />
                        Pasar a Pro · {PRECIO}/mes
                      </button>
                      <Link href="/app/plan" className={`${botonBorde} flex-1`}>
                        Comparar planes
                      </Link>
                    </div>
                  </Desplegable>
                  <Desplegable abierto={pagando}>
                    <div className="flex flex-col gap-4 rounded-[18px] bg-fondo p-4 sm:p-5">
                      <div className="flex items-baseline justify-between gap-3">
                        <strong className="text-[18px]">Pasar a Pro</strong>
                        <span className="font-display text-[22px] font-bold">
                          {PRECIO}
                          <span className="text-base font-semibold text-texto-suave"> / mes</span>
                        </span>
                      </div>

                      {b.medios.length === 0 ? (
                        <p className="text-texto-suave">Primero agregá una tarjeta o conectá tu Mercado Pago en <b>Medios de pago</b>.</p>
                      ) : (
                        <fieldset className="flex flex-col gap-2">
                          <legend className="mb-2 font-semibold">¿Con qué pagás?</legend>
                          {b.medios.map((m) => (
                            <label
                              key={m.id}
                              className={`flex cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] bg-white px-3.5 py-3 transition-colors ${
                                elegido === m.id ? 'border-primario' : 'border-transparent hover:border-borde'
                              }`}
                            >
                              <input type="radio" name="medio" checked={elegido === m.id} onChange={() => setElegido(m.id)} className="h-4 w-4 flex-none accent-primario" />
                              <LogoMedio m={m} />
                              <span className="min-w-0 font-semibold">{nombreMedio(m)}</span>
                            </label>
                          ))}
                        </fieldset>
                      )}

                      <p className="text-texto-suave">Se cobra en pesos al tipo de cambio del día. Antes de confirmar ves el total final con impuestos. Sin permanencia: das de baja cuando quieras.</p>
                      <div className="flex flex-wrap gap-3">
                        <button type="button" onClick={confirmarPago} disabled={!elegido || procesando || b.medios.length === 0} className={`${botonPrimario} flex-1`}>
                          {procesando ? (
                            <>
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                              Procesando…
                            </>
                          ) : (
                            `Confirmar y pagar ${PRECIO}`
                          )}
                        </button>
                        <button type="button" onClick={() => setPagando(false)} disabled={procesando} className={`${botonBorde} flex-1`}>
                          Ahora no
                        </button>
                      </div>
                    </div>
                  </Desplegable>
                </div>
              )}

              {esPro && (
                <div className="mt-auto flex flex-col">
                  <Desplegable abierto={!bajando}>
                    <button type="button" onClick={() => setBajando(true)} className={`${botonBorde} w-full hover:border-error hover:text-error sm:w-auto`}>
                      Dar de baja Pro
                    </button>
                  </Desplegable>
                  <Desplegable abierto={bajando}>
                    <div className="flex flex-col gap-3 rounded-[18px] bg-error-suave p-4 sm:p-5">
                      <strong>¿Volvés al plan Gratis?</strong>
                      <p className="text-texto-suave">No se te cobra más. Vuelven los límites de 10 facturas A, B y C y 1 Factura E por mes.</p>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            w.darDeBaja();
                            setBajando(false);
                            setRecienPago(false);
                          }}
                          className="btn-lift inline-flex h-11 flex-1 items-center justify-center whitespace-nowrap rounded-full bg-[#E5484D] px-5 font-bold text-white"
                        >
                          Sí, dar de baja
                        </button>
                        <button type="button" onClick={() => setBajando(false)} className={`${botonBorde} flex-1`}>
                          Seguir con Pro
                        </button>
                      </div>
                    </div>
                  </Desplegable>
                </div>
              )}
            </Tarjeta>

            {/* ---------- Medios de pago ---------- */}
            <Tarjeta
              titulo="Medios de pago"
              icono="tarjeta"
              accion={
                b.medios.length > 0 &&
                !agregando && (
                  <button
                    type="button"
                    onClick={() => setMostrarAgregar((v) => !v)}
                    aria-expanded={mostrarAgregar}
                    className="btn-lift inline-flex h-10 items-center gap-1.5 rounded-full bg-primario-suave px-4 font-bold text-primario-oscuro hover:bg-[#E0E1FF]"
                  >
                    <Icon name="mas" size={18} strokeWidth={2.4} className={`transition-transform duration-200 ${mostrarAgregar ? 'rotate-45' : ''}`} />
                    Agregar
                  </button>
                )
              }
            >
              {b.medios.length === 0 ? (
                !agregando && <div className="flex flex-1 items-center gap-4 rounded-[18px] bg-fondo p-4">
                  <span className="flex-none">
                    <Facti pose="senalando" size={84} animated />
                  </span>
                  <p className="text-texto-suave">Todavía no agregaste ninguno. Podés pagar con tarjeta de crédito o débito, o con tu cuenta de Mercado Pago.</p>
                </div>
              ) : (
                <Billetera
                  medios={b.medios}
                  principalId={principal?.id}
                  titular={titular}
                  onPrincipal={w.hacerPrincipal}
                  onQuitar={w.quitar}
                  puedeQuitar={(id) => !(esPro && b.medios.length === 1 && b.medios[0]?.id === id)}
                />
              )}

              <div className="mt-auto flex flex-col">
              <Desplegable abierto={!agregando && (b.medios.length === 0 || mostrarAgregar)}>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => { setAgregando('tarjeta'); setMostrarAgregar(false); }} className={`${botonBorde} flex-1`}>
                    <Icon name="mas" size={18} />
                    Agregar tarjeta
                  </button>
                  {!b.medios.some((m) => m.tipo === 'mercadopago') && (
                    <button type="button" onClick={() => { setAgregando('mercadopago'); setMostrarAgregar(false); }} className={`${botonBorde} flex-1`}>
                      <Icon name="mas" size={18} />
                      Conectar Mercado Pago
                    </button>
                  )}
                </div>
              </Desplegable>

              <Desplegable abierto={agregando !== null}>
                <div className="flex flex-col gap-4 rounded-[18px] bg-fondo p-4 sm:p-5">
                  {agregando === 'tarjeta' && (
                    <MedioDestacado medio={cargada ?? undefined} titular={cargada ? titular : undefined} />
                  )}
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[13px] bg-white text-primario-oscuro">
                      <Icon name={agregando === 'tarjeta' ? 'candado' : 'escudo'} size={22} />
                    </span>
                    <div>
                      <strong>{agregando === 'tarjeta' ? 'Agregar tarjeta' : 'Conectar Mercado Pago'}</strong>
                      <p className="text-texto-suave">
                        {agregando === 'tarjeta'
                          ? 'Los datos de la tarjeta se cargan en el formulario seguro de Mercado Pago y van directo a ellos. Facti solo guarda la marca, los últimos 4 números y el vencimiento.'
                          : 'Te llevamos a Mercado Pago para que autorices el débito del plan cada mes. Facti no ve tu saldo ni tus movimientos, y lo podés desconectar cuando quieras.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (agregando === 'mercadopago') {
                          w.conectarMercadoPago();
                          setAgregando(null);
                          return;
                        }
                        // Se ve cómo se completa la tarjeta y después pasa a la lista.
                        setCargada({ id: 'prueba', tipo: 'tarjeta', marca: 'Visa', ultimos: '4242', vence: '12/29' });
                        setTimeout(() => {
                          w.agregarTarjetaPrueba();
                          setCargada(null);
                          setAgregando(null);
                        }, 1200);
                      }}
                      disabled={cargada !== null}
                      className={`${botonPrimario} flex-1`}
                    >
                      {agregando === 'tarjeta' ? 'Simular tarjeta de prueba' : 'Simular conexión'}
                    </button>
                    <button type="button" onClick={() => setAgregando(null)} className={`${botonBorde} flex-1`}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </Desplegable>
              </div>
            </Tarjeta>
          </div>

          {/* ---------- Historial ---------- */}
          <section className="flex flex-col gap-4 rounded-tarjeta bg-superficie p-5 shadow-tarjeta sm:p-6">
            <h2 className="text-[20px] font-bold">Tus pagos a Facti</h2>
            {b.pagos.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-[18px] bg-fondo px-5 py-8 text-center">
                <Facti pose="durmiendo" size={96} />
                <strong>Todavía no hay pagos</strong>
                <p className="max-w-[420px] text-texto-suave">Cuando pases a Pro vas a ver acá cada cobro, con su factura para descargar.</p>
              </div>
            ) : (
              <>
                {/* Compu: tabla, igual que las demás de la app */}
                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full border-collapse text-base">
                    <thead>
                      <tr className="text-texto-tenue">
                        {['Fecha', 'Concepto', 'Medio', 'Importe', 'Estado', ''].map((h, i) => (
                          <th key={h || 'acc'} className={`whitespace-nowrap border-b-2 border-[#EDF0F6] px-3 pb-3 font-semibold ${i === 3 ? 'text-right' : 'text-left'}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {b.pagos.map((p) => {
                        const m = medioDe(p.medioId);
                        return (
                          <tr key={p.id} className="border-b border-[#F0F2F7] last:border-0">
                            <td className="whitespace-nowrap px-3 py-4 tabular-nums text-texto-suave">{fecha(p.fecha)}</td>
                            <td className="px-3 py-4 font-semibold">{p.concepto}</td>
                            <td className="px-3 py-4 text-texto-suave">{m ? nombreMedio(m) : 'Medio quitado'}</td>
                            <td className="whitespace-nowrap px-3 py-4 text-right font-semibold tabular-nums">{p.importe}</td>
                            <td className="px-3 py-4">
                              <Estado aprobado={p.estado === 'aprobado'} />
                            </td>
                            <td className="px-3 py-4 text-right">
                              <span title="Disponible cuando se cobre de verdad" className="inline-flex cursor-not-allowed items-center gap-1.5 whitespace-nowrap font-semibold text-texto-tenue">
                                <Icon name="descargar" size={18} />
                                Factura
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Celular: una fila por pago */}
                <ul className="flex flex-col divide-y divide-[#EEF1F6] sm:hidden">
                  {b.pagos.map((p) => {
                    const m = medioDe(p.medioId);
                    return (
                      <li key={p.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                        <div className="flex min-w-0 flex-col">
                          <span className="font-semibold">{p.concepto}</span>
                          <span className="text-texto-tenue">
                            {fecha(p.fecha)} · {m ? nombreMedio(m) : 'Medio quitado'}
                          </span>
                        </div>
                        <div className="flex flex-none flex-col items-end gap-1">
                          <span className="font-semibold tabular-nums">{p.importe}</span>
                          <Estado aprobado={p.estado === 'aprobado'} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-texto-tenue">
              ¿Querés irte del todo? Usá el <Link href="/baja" className="font-semibold text-texto-suave underline underline-offset-2">botón de baja de servicio</Link>.
            </p>
            <button type="button" onClick={() => { w.reiniciar(); setElegido(null); setRecienPago(false); }} className="font-semibold text-texto-tenue underline underline-offset-2 hover:text-texto">
              Reiniciar la vista previa
            </button>
          </div>
        </div>
      )}
    </>
  );
}
