'use client';

import { useMemo, useState } from 'react';
import { Girando, Numero } from '@/components/Animado';
import { AvisoApi } from '@/components/AvisoApi';
import { Confirmar } from '@/components/Confirmar';
import { ChipCobro, TablaFacturas, TablaSkeleton, nroCorto } from '@/components/TablaFacturas';
import { Buscador, Segmentos, TarjetaLista } from '@/components/TarjetaLista';
import { Paginacion } from '@/components/Paginacion';
import { Facti } from '@/components/Facti';
import { listarComprobantes, marcarCobro, verResumen, type Cobro, type Comprobante, type ErrorApi } from '@/lib/api';
import { nombreCliente } from '@/lib/comprobante';
import { importe, numeroComprobante, pesos } from '@/lib/formato';
import { useApi } from '@/lib/useApi';

type Filtro = 'pendientes' | 'cobradas' | 'todas';

const FILTROS: { id: Filtro; label: string; cobro: Cobro }[] = [
  { id: 'pendientes', label: 'Pendientes', cobro: 'pendiente' },
  { id: 'cobradas', label: 'Cobradas', cobro: 'cobrada' },
  { id: 'todas', label: 'Todas', cobro: '' },
];

const POR_PAGINA = 10;

export default function Cobros() {
  const [filtro, setFiltro] = useState<Filtro>('pendientes');
  const cobro = FILTROS.find((f) => f.id === filtro)!.cobro;
  const lista = useApi(() => listarComprobantes({ cobro, limite: 200 }), [cobro]);
  // Los totales de por cobrar salen de todo el historial; el cobrado, del mes en curso.
  const resumen = useApi(() => verResumen(), []);
  const [marcando, setMarcando] = useState<number | null>(null);
  const [errMarcar, setErrMarcar] = useState<ErrorApi | null>(null);
  // Factura que se está por marcar como cobrada: abre el modal de confirmación.
  const [aConfirmar, setAConfirmar] = useState<Comprobante | null>(null);

  const filas = useMemo(() => (lista.dato?.comprobantes ?? []).filter((f) => f.cobro !== ''), [lista.dato]);
  const [q, setQ] = useState('');
  const [pagina, setPagina] = useState(1);
  const buscadas = useMemo(() => {
    const t = q.trim().toLowerCase().replace(/^#/, '');
    if (!t) return filas;
    return filas.filter((f) => nombreCliente(f).toLowerCase().includes(t) || f.receptor.docNro.includes(t) || (/^\d+$/.test(t) && f.numeroInterno === Number(t)));
  }, [filas, q]);
  const visibles = buscadas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  async function marcar(id: number, estado: 'cobrada' | 'pendiente') {
    setMarcando(id);
    setErrMarcar(null);
    const r = await marcarCobro(id, estado);
    setMarcando(null);
    setAConfirmar(null);
    if (!r.ok) {
      setErrMarcar(r);
      return;
    }
    void lista.recargar();
    void resumen.recargar();
  }

  const r = resumen.dato;

  // Botón de cada factura: marcarla como cobrada (con confirmación) o deshacer.
  const accion = (f: Comprobante) =>
      f.cobro === 'pendiente' ? (
        <button type="button" disabled={marcando === f.id} onClick={() => setAConfirmar(f)} className="btn-lift inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-exito px-3.5 text-base font-bold text-white disabled:opacity-60">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          {marcando === f.id ? (<><Girando size={14} />Guardando…</>) : 'Marcar cobrada'}
        </button>
      ) : (
        <span className="inline-flex items-center gap-2">
          <ChipCobro estado={f.cobro} />
          <button type="button" disabled={marcando === f.id} onClick={() => marcar(f.id, 'pendiente')} className="text-base font-semibold text-texto-tenue underline-offset-2 hover:text-texto hover:underline disabled:opacity-60">
            Deshacer
          </button>
        </span>
      );

  return (
    <>
      <div className="aparece">
        <h1 className="text-[28px] font-bold leading-tight sm:text-[34px]">Cobros</h1>
        <p className="hidden text-texto-suave sm:block">Marcá tus facturas como cobradas y seguí lo que te deben.</p>
      </div>

      {/* Stats */}
      <div style={{ animationDelay: '20ms' }} className="aparece grid grid-cols-2 gap-3 sm:gap-[18px]">
        {r ? (
          <>
            <div className="entra row-span-3 grid grid-rows-subgrid content-start gap-y-1 rounded-tarjeta bg-superficie px-4 py-4 shadow-tarjeta sm:px-6 sm:py-5">
              <span className="text-base font-semibold text-texto-tenue">Por cobrar</span>
              <span className="self-end font-display text-[22px] font-semibold leading-tight tabular-nums sm:text-[30px]"><Numero valor={r.porCobrar.total} formato={pesos} /></span>
              <span className="text-base text-texto-suave">{r.porCobrar.facturas} {r.porCobrar.facturas === 1 ? 'factura pendiente' : 'facturas pendientes'}</span>
            </div>
            <div style={{ '--i': 1 } as React.CSSProperties} className="entra row-span-3 grid grid-rows-subgrid content-start gap-y-1 rounded-tarjeta bg-superficie px-4 py-4 shadow-tarjeta sm:px-6 sm:py-5">
              <span className="text-base font-semibold text-texto-tenue">Cobrado este mes</span>
              <span className="self-end font-display text-[22px] font-semibold leading-tight tabular-nums sm:text-[30px]"><Numero valor={r.delMes.cobrado} formato={pesos} /></span>
              <span className="text-base text-texto-suave">{r.delMes.cobradas} {r.delMes.cobradas === 1 ? 'factura cobrada' : 'facturas cobradas'}</span>
            </div>
          </>
        ) : resumen.estado === 'cargando' ? (
          [0, 1].map((i) => <div key={i} className="skeleton h-[110px] rounded-tarjeta" />)
        ) : null}
      </div>

      {errMarcar && <AvisoApi error={errMarcar} compacto />}

      {/* Listado: mismas piezas que Facturas (pestañas y buscador arriba, cantidad y páginas abajo). */}
      <TarjetaLista
        ocupado={lista.estado === 'cargando'}
        barra={
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Segmentos etiqueta="Filtrar por estado de cobro" opciones={FILTROS.map((f) => [f.id, f.label] as [Filtro, string])} valor={filtro} onCambio={(v) => { setFiltro(v); setPagina(1); }} />
            <Buscador valor={q} onCambio={(v) => { setQ(v); setPagina(1); }} placeholder="Buscar cliente o #número…" className="lg:w-[340px]" />
          </div>
        }
        pie={
          buscadas.length > 0 ? (
            <Paginacion total={buscadas.length} pagina={pagina} porPagina={POR_PAGINA} onPagina={setPagina} singular="factura" plural="facturas" />
          ) : undefined
        }
      >
        {lista.estado === 'error' && !lista.dato ? (
          <AvisoApi error={lista.error} onReintentar={lista.recargar} />
        ) : !lista.dato ? (
          <TablaSkeleton filas={4} />
        ) : visibles.length > 0 ? (
          <div key={filtro} className="entra">
            <TablaFacturas rows={visibles} accion={accion} />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
            <Facti pose={filtro === 'pendientes' && !q ? 'festejo' : 'buscando'} size={130} animated={false} />
            <p className="text-texto-suave">
              {q ? 'No encontramos facturas con esa búsqueda.' : filtro === 'pendientes' ? '¡No tenés facturas pendientes de cobro!' : filtro === 'cobradas' ? 'Todavía no marcaste facturas como cobradas.' : 'Todavía no emitiste facturas.'}
            </p>
          </div>
        )}
      </TarjetaLista>

      <Confirmar
        abierto={aConfirmar !== null}
        tono="exito"
        icono="cobros"
        titulo="¿Marcar esta factura como cobrada?"
        textoConfirmar="Sí, ya la cobré"
        cargando={aConfirmar !== null && marcando === aConfirmar.id}
        onConfirmar={() => aConfirmar && void marcar(aConfirmar.id, 'cobrada')}
        onCancelar={() => setAConfirmar(null)}
      >
        {aConfirmar && (
          <div className="flex flex-col gap-3">
            <dl className="flex flex-col gap-2 rounded-[18px] bg-fondo px-4 py-3.5 text-base">
              <div className="flex justify-between gap-4"><dt className="text-texto-suave">Cliente</dt><dd className="truncate font-semibold">{nombreCliente(aConfirmar)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-texto-suave">Factura</dt><dd className="tabular-nums">{aConfirmar.sigla} {nroCorto(aConfirmar)} · {numeroComprobante(aConfirmar.puntoVenta, aConfirmar.numero)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-texto-suave">Total</dt><dd className="font-bold tabular-nums">{importe(aConfirmar.total, aConfirmar.moneda)}</dd></div>
            </dl>
            <p className="text-base text-texto-suave">Pasa a &quot;Cobradas&quot; y deja de sumar en lo que te deben. Si te equivocás, la podés volver a pendiente.</p>
          </div>
        )}
      </Confirmar>
    </>
  );
}
