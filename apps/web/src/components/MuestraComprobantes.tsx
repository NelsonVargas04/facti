'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import QRCode from 'qrcode';

/**
 * Sección "Todos los comprobantes" de la landing: elegís un tipo y ves una vista previa
 * en el formato oficial de ARCA (resumida), con lo que lo diferencia resaltado.
 * Los datos de ejemplo salen de los mockups de docs/diseno/pantallas/pdf-factura-*.html.
 */

type Fila = { etiqueta: string; valor: string; fuerte?: boolean; resaltar?: boolean };
type Item = { descripcion: string; cantidad: string; unidad: string; precio: string; iva?: string; importe: string };

interface Muestra {
  id: string;
  letra: string;
  nombre: string;
  cuando: string;
  diferencia: string; // texto del sticker sobre lo resaltado
  // Vista previa (mismos datos y orden que el comprobante de ARCA)
  titulo: string;
  cod: string;
  ptoVta: string;
  nro: string;
  emisor: { nombre: string; domicilio: string; condicion: string; cuit: string; inicio: string };
  periodo?: { desde: string; hasta: string; vto: string };
  receptor: { doc?: [string, string]; nombre: string; condicion: string; domicilio: string; venta: string };
  extra?: { texto: string; resaltar?: boolean }; // comprobante asociado, datos de exportación…
  items: Item[];
  totales: Fila[];
  leyenda?: { texto: string; resaltar?: boolean };
  qr: { cuit: number; ptoVta: number; tipoCmp: number; nroCmp: number; importe: number; moneda: string; ctz: number; codAut: number };
}

const LUCIA = { nombre: 'Fernández Lucía', domicilio: 'Av. Corrientes 1234 - CABA', condicion: 'Responsable Monotributo', cuit: '27314567894', inicio: '01/03/2019' };
const LUMEN = { nombre: 'Estudio Lumen SRL', domicilio: 'Gorriti 4520 - CABA', condicion: 'IVA Responsable Inscripto', cuit: '30715896327', inicio: '15/08/2017' };
const A_LUMEN = { doc: ['CUIT', LUMEN.cuit] as [string, string], nombre: LUMEN.nombre, condicion: LUMEN.condicion, domicilio: LUMEN.domicilio, venta: 'Transferencia bancaria' };
const OCTUBRE = { desde: '01/10/2026', hasta: '31/10/2026', vto: '24/10/2026' };

const MUESTRAS: Muestra[] = [
  {
    id: 'c',
    letra: 'C',
    nombre: 'Factura C',
    cuando: 'Sos monotributista o exento: siempre es C, para cualquier cliente.',
    diferencia: 'No discrimina IVA',
    titulo: 'FACTURA',
    cod: '011',
    ptoVta: '00003',
    nro: '00000128',
    emisor: LUCIA,
    periodo: OCTUBRE,
    receptor: A_LUMEN,
    items: [{ descripcion: 'Diseño de logo e identidad', cantidad: '1,00', unidad: 'unidades', precio: '85.000,00', importe: '85.000,00' }],
    totales: [
      { etiqueta: 'Subtotal', valor: '85.000,00' },
      { etiqueta: 'Importe Otros Tributos', valor: '0,00' },
      { etiqueta: 'Importe Total', valor: '85.000,00', fuerte: true, resaltar: true },
    ],
    qr: { cuit: 27314567894, ptoVta: 3, tipoCmp: 11, nroCmp: 128, importe: 85000, moneda: 'PES', ctz: 1, codAut: 76419283746521 },
  },
  {
    id: 'a',
    letra: 'A',
    nombre: 'Factura A',
    cuando: 'Sos responsable inscripto y le facturás a otro inscripto o a un monotributista.',
    diferencia: 'IVA discriminado + leyenda Ley 27.618',
    titulo: 'FACTURA',
    cod: '001',
    ptoVta: '00004',
    nro: '00000562',
    emisor: LUMEN,
    periodo: OCTUBRE,
    receptor: { doc: ['CUIT', LUCIA.cuit], nombre: LUCIA.nombre, condicion: LUCIA.condicion, domicilio: LUCIA.domicilio, venta: 'Transferencia bancaria' },
    items: [
      { descripcion: 'Puesto en oficina compartida - octubre', cantidad: '1,00', unidad: 'unidades', precio: '100.000,00', iva: '21%', importe: '121.000,00' },
      { descripcion: 'Impresiones y escaneos', cantidad: '40,00', unidad: 'unidades', precio: '200,00', iva: '21%', importe: '9.680,00' },
    ],
    totales: [
      { etiqueta: 'Importe Neto Gravado', valor: '108.000,00', resaltar: true },
      { etiqueta: 'IVA 21%', valor: '22.680,00', resaltar: true },
      { etiqueta: 'Importe Otros Tributos', valor: '0,00' },
      { etiqueta: 'Importe Total', valor: '130.680,00', fuerte: true },
    ],
    leyenda: {
      texto: 'El crédito fiscal discriminado en el presente comprobante solo podrá ser computado a efectos del Régimen de Sostenimiento e Inclusión Fiscal para Pequeños Contribuyentes de la Ley Nº 27.618.',
      resaltar: true,
    },
    qr: { cuit: 30715896327, ptoVta: 4, tipoCmp: 1, nroCmp: 562, importe: 130680, moneda: 'PES', ctz: 1, codAut: 76419283799012 },
  },
  {
    id: 'b',
    letra: 'B',
    nombre: 'Factura B',
    cuando: 'Sos responsable inscripto y le vendés a un consumidor final o a un exento.',
    diferencia: 'IVA incluido en el precio',
    titulo: 'FACTURA',
    cod: '006',
    ptoVta: '00004',
    nro: '00001877',
    emisor: LUMEN,
    receptor: { nombre: 'Consumidor Final', condicion: 'Consumidor Final', domicilio: '-', venta: 'Contado' },
    items: [{ descripcion: 'Pase diario coworking', cantidad: '3,00', unidad: 'unidades', precio: '12.100,00', importe: '36.300,00' }],
    totales: [
      { etiqueta: 'Subtotal', valor: '36.300,00' },
      { etiqueta: 'Importe Otros Tributos', valor: '0,00' },
      { etiqueta: 'Importe Total', valor: '36.300,00', fuerte: true },
      { etiqueta: 'IVA Contenido (Ley 27.743)', valor: '6.300,00', resaltar: true },
    ],
    qr: { cuit: 30715896327, ptoVta: 4, tipoCmp: 6, nroCmp: 1877, importe: 36300, moneda: 'PES', ctz: 1, codAut: 76419283811234 },
  },
  {
    id: 'e',
    letra: 'E',
    nombre: 'Factura E',
    cuando: 'Le vendés servicios a clientes del exterior y cobrás en dólares u otra moneda.',
    diferencia: 'En divisa, con tipo de cambio',
    titulo: 'FACTURA DE EXPORTACIÓN',
    cod: '019',
    ptoVta: '00002',
    nro: '00000014',
    emisor: { nombre: 'Ibarra Tomás', domicilio: 'Bv. Oroño 850 - Rosario, Santa Fe', condicion: 'Responsable Monotributo', cuit: '20389456127', inicio: '10/02/2021' },
    receptor: { doc: ['ID Impositivo', '88-1234567'], nombre: 'Northwind Labs LLC', condicion: 'Cliente del Exterior', domicilio: 'San Francisco, Estados Unidos', venta: 'Transferencia bancaria' },
    extra: { texto: 'Destino: Estados Unidos · Moneda: Dólar Estadounidense · Cotización: 1.350,00 · Exportación de servicios, IVA exento', resaltar: true },
    items: [{ descripcion: 'Desarrollo de software - septiembre 2026', cantidad: '1,00', unidad: 'unidades', precio: '1.200,00', importe: '1.200,00' }],
    totales: [
      { etiqueta: 'Subtotal', valor: 'USD 1.200,00' },
      { etiqueta: 'Importe Total', valor: 'USD 1.200,00', fuerte: true, resaltar: true },
    ],
    qr: { cuit: 20389456127, ptoVta: 2, tipoCmp: 19, nroCmp: 14, importe: 1200, moneda: 'DOL', ctz: 1350, codAut: 76402811937465 },
  },
  {
    id: 'nc',
    letra: 'NC',
    nombre: 'Notas de crédito y débito',
    cuando: 'Para corregir o anular una factura que ya emitiste. Van asociadas a la original.',
    diferencia: 'Asociada a la factura original',
    titulo: 'NOTA DE CRÉDITO',
    cod: '013',
    ptoVta: '00003',
    nro: '00000009',
    emisor: LUCIA,
    periodo: OCTUBRE,
    receptor: A_LUMEN,
    extra: { texto: 'Comprobante asociado: Factura C 00003-00000128 del 12/10/2026', resaltar: true },
    items: [{ descripcion: 'Descuento acordado sobre diseño de logo', cantidad: '1,00', unidad: 'unidades', precio: '15.000,00', importe: '15.000,00' }],
    totales: [
      { etiqueta: 'Subtotal', valor: '15.000,00' },
      { etiqueta: 'Importe Otros Tributos', valor: '0,00' },
      { etiqueta: 'Importe Total', valor: '15.000,00', fuerte: true },
    ],
    qr: { cuit: 27314567894, ptoVta: 3, tipoCmp: 13, nroCmp: 9, importe: 15000, moneda: 'PES', ctz: 1, codAut: 76419283900021 },
  },
  {
    id: 'm',
    letra: 'M',
    nombre: 'Factura M',
    cuando: 'ARCA te la asigna si tu inscripción como responsable inscripto tiene observaciones.',
    diferencia: 'Operación sujeta a retención',
    titulo: 'FACTURA',
    cod: '051',
    ptoVta: '00001',
    nro: '00000033',
    emisor: { nombre: 'García Martín', domicilio: 'San Martín 455 - Córdoba', condicion: 'IVA Responsable Inscripto', cuit: '20298765431', inicio: '05/06/2015' },
    periodo: OCTUBRE,
    receptor: A_LUMEN,
    items: [{ descripcion: 'Mantenimiento de equipos - octubre', cantidad: '1,00', unidad: 'unidades', precio: '50.000,00', iva: '21%', importe: '60.500,00' }],
    totales: [
      { etiqueta: 'Importe Neto Gravado', valor: '50.000,00' },
      { etiqueta: 'IVA 21%', valor: '10.500,00' },
      { etiqueta: 'Importe Otros Tributos', valor: '0,00' },
      { etiqueta: 'Importe Total', valor: '60.500,00', fuerte: true },
    ],
    leyenda: { texto: 'OPERACIÓN SUJETA A RETENCIÓN', resaltar: true },
    qr: { cuit: 20298765431, ptoVta: 1, tipoCmp: 51, nroCmp: 33, importe: 60500, moneda: 'PES', ctz: 1, codAut: 76419283955510 },
  },
];

const resaltado = 'rounded-[4px] bg-acento/35 shadow-[0_0_0_2px_#FFD25E]';

function urlQR(m: Muestra): string {
  const json = JSON.stringify({
    ver: 1, fecha: '2026-10-12', ...m.qr, tipoDocRec: 80, nroDocRec: 30715896327, tipoCodAut: 'E',
  });
  return `https://www.arca.gob.ar/fe/qr/?p=${btoa(json)}`;
}

/** "Etiqueta: valor" como en el comprobante de ARCA (etiqueta en negrita). */
function Dato({ e, v, className = '' }: { e: string; v: string; className?: string }) {
  return (
    <span className={className}>
      <b className="font-extrabold">{e}:</b> {v}
    </span>
  );
}

/** Ancho de "hoja" de la vista previa. Se dibuja siempre a este ancho y después se escala
 *  (con `zoom`) al lugar disponible, como un PDF: así cada dato queda en su renglón, como en ARCA. */
const ANCHO_HOJA = 720;

function VistaPrevia({ m }: { m: Muestra }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let vigente = true;
    QRCode.toDataURL(urlQR(m), { margin: 0, width: 128, errorCorrectionLevel: 'M' })
      .then((u) => vigente && setQr(u))
      .catch(() => vigente && setQr(null));
    return () => {
      vigente = false;
    };
  }, [m]);

  const linea = 'border-[#1F2433]';
  const conIva = m.items.some((it) => it.iva);
  const th = `whitespace-nowrap border-b ${linea} px-2 py-1.5 font-extrabold`;
  const td = 'border-b border-[#E3E6EE] px-2 py-1.5 align-top';
  const num = `${td} whitespace-nowrap text-right tabular-nums`;
  return (
    <div className="flex h-full flex-col gap-2 bg-white p-5 font-sans text-[11px] leading-[1.45] text-[#1F2433] [&_span]:whitespace-nowrap">
      <div className={`border ${linea} py-1 text-center text-[12px] font-extrabold tracking-[0.08em]`}>ORIGINAL</div>

      {/* Cabecera: emisor | letra | comprobante */}
      <div className={`relative grid grid-cols-2 border ${linea}`}>
        <div className={`flex min-w-0 flex-col gap-0.5 border-r ${linea} py-3 pl-3 pr-9`}>
          <span className="mb-1.5 text-[15px] font-extrabold leading-tight">{m.emisor.nombre}</span>
          <Dato e="Razón Social" v={m.emisor.nombre} />
          <Dato e="Domicilio Comercial" v={m.emisor.domicilio} />
          <Dato e="Condición frente al IVA" v={m.emisor.condicion} />
        </div>
        <div className={`absolute left-1/2 top-[-1px] flex w-12 -translate-x-1/2 flex-col items-center border-2 border-t ${linea} bg-white pb-1 pt-0.5`}>
          <span className="text-[26px] font-extrabold leading-none">{m.letra === 'NC' ? 'C' : m.letra}</span>
          <span className="text-[8px] font-extrabold">COD. {m.cod}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 py-3 pl-9 pr-3">
          <span className="mb-1.5 text-[15px] font-extrabold leading-tight tracking-[0.02em]">{m.titulo}</span>
          <span className="flex gap-4">
            <Dato e="Punto de Venta" v={m.ptoVta} />
            <Dato e="Comp. Nro" v={m.nro} />
          </span>
          <Dato e="Fecha de Emisión" v="12/10/2026" />
          <Dato e="CUIT" v={m.emisor.cuit} />
          <Dato e="Ingresos Brutos" v={m.emisor.cuit} />
          <Dato e="Fecha de Inicio de Actividades" v={m.emisor.inicio} />
        </div>
      </div>

      {m.periodo && (
        <div className={`flex gap-8 border ${linea} px-3 py-1.5`}>
          <Dato e="Período Facturado Desde" v={m.periodo.desde} />
          <Dato e="Hasta" v={m.periodo.hasta} />
          <Dato e="Fecha de Vto. para el pago" v={m.periodo.vto} />
        </div>
      )}

      {/* Receptor: dos columnas, como en ARCA (izquierda la más angosta) */}
      <div className={`grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-x-4 gap-y-0.5 border ${linea} px-3 py-1.5`}>
        {m.receptor.doc ? <Dato e={m.receptor.doc[0]} v={m.receptor.doc[1]} /> : <span />}
        <Dato e="Apellido y Nombre / Razón Social" v={m.receptor.nombre} />
        <Dato e="Condición frente al IVA" v={m.receptor.condicion} />
        <Dato e="Domicilio" v={m.receptor.domicilio} />
        <Dato e="Condición de venta" v={m.receptor.venta} />
      </div>

      {m.extra && <div className={`border ${linea} px-3 py-1.5 ${m.extra.resaltar ? resaltado : ''}`}>{m.extra.texto}</div>}

      {/* Detalle */}
      <table className={`w-full border-collapse border ${linea}`}>
        <thead className="bg-[#EEF0F5]">
          <tr>
            <th className={`${th} text-left`}>Código</th>
            <th className={`${th} w-full text-left`}>Producto / Servicio</th>
            <th className={`${th} text-right`}>Cantidad</th>
            <th className={`${th} text-left`}>U. Medida</th>
            <th className={`${th} text-right`}>Precio Unit.</th>
            {conIva && <th className={`${th} text-right`}>Alícuota IVA</th>}
            <th className={`${th} text-right`}>{conIva ? 'Subtotal c/IVA' : 'Subtotal'}</th>
          </tr>
        </thead>
        <tbody>
          {m.items.map((it, i) => (
            <tr key={it.descripcion}>
              <td className={`${td} whitespace-nowrap`}>{String(i + 1).padStart(4, '0')}</td>
              <td className={td}>{it.descripcion}</td>
              <td className={num}>{it.cantidad}</td>
              <td className={`${td} whitespace-nowrap`}>{it.unidad}</td>
              <td className={num}>{it.precio}</td>
              {conIva && <td className={num}>{it.iva}</td>}
              <td className={num}>{it.importe}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {m.leyenda && (
        <p className={`px-2 py-1 text-[10px] italic ${m.leyenda.resaltar ? resaltado : ''} ${m.leyenda.texto === m.leyenda.texto.toUpperCase() ? 'text-center font-extrabold not-italic' : ''}`}>
          {m.leyenda.texto}
        </p>
      )}

      {/* Como en el comprobante oficial, los totales y el CAE van al pie */}
      <div className="flex-1" />

      {/* Totales */}
      <div className="flex justify-end">
        <div className={`flex w-[300px] flex-col gap-0.5 border ${linea} px-3 py-2`}>
          {m.totales.map((t) => (
            <div
              key={t.etiqueta}
              className={`flex justify-between gap-3 px-1 tabular-nums ${t.fuerte ? `mt-0.5 border-t ${linea} pt-1 text-[13px] font-extrabold` : ''} ${t.resaltar ? resaltado : ''}`}
            >
              <span className="font-bold">{t.etiqueta}:{t.valor.startsWith('USD') ? '' : ' $'}</span>
              <span>{t.valor}</span>
            </div>
          ))}
        </div>
      </div>

      {/* QR + ARCA + CAE */}
      <div className={`flex items-center gap-3 border-t ${linea} pt-2`}>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} width={62} height={62} alt="Código QR de ARCA de ejemplo" className="flex-none" />
        ) : (
          <div className="h-[62px] w-[62px] flex-none bg-fondo" />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-extrabold tracking-[0.04em]">ARCA</span>
          <span className="font-extrabold italic">Comprobante Autorizado</span>
          <span className="text-[9px] italic text-[#4A5072]">Esta Agencia no se responsabiliza por los datos ingresados en el detalle de la operación.</span>
        </div>
        <div className="flex flex-col items-end text-right">
          <span className="font-bold">Pág. 1/1</span>
          <Dato e="CAE N°" v={String(m.qr.codAut)} />
          <Dato e="Fecha de Vto. de CAE" v="22/10/2026" />
        </div>
      </div>
    </div>
  );
}

/** Escala para que la hoja de ANCHO_HOJA entre en el ancho del contenedor (nunca la agranda). */
function useEscala() {
  const ref = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setEscala(Math.min(1, el.clientWidth / ANCHO_HOJA));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, escala };
}

export function MuestraComprobantes() {
  const [activo, setActivo] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const m = MUESTRAS[activo]!;
  const { ref: hoja, escala } = useEscala();

  function teclado(e: KeyboardEvent<HTMLDivElement>) {
    const mover: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    let siguiente: number | undefined;
    if (e.key in mover) siguiente = (activo + mover[e.key]! + MUESTRAS.length) % MUESTRAS.length;
    if (e.key === 'Home') siguiente = 0;
    if (e.key === 'End') siguiente = MUESTRAS.length - 1;
    if (siguiente === undefined) return;
    e.preventDefault();
    setActivo(siguiente);
    tabs.current[siguiente]?.focus();
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:items-stretch lg:gap-10">
      {/* Lista de comprobantes */}
      <div
        role="tablist"
        aria-label="Tipos de comprobante"
        aria-orientation="vertical"
        onKeyDown={teclado}
        className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:rounded-tarjeta-lg lg:bg-white lg:p-2 lg:shadow-tarjeta"
      >
        {MUESTRAS.map((c, i) => {
          const sel = i === activo;
          return (
            <button
              key={c.id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              id={`tab-${c.id}`}
              role="tab"
              type="button"
              aria-selected={sel}
              aria-controls="vista-comprobante"
              tabIndex={sel ? 0 : -1}
              onClick={() => setActivo(i)}
              className={`flex flex-none snap-start items-center gap-3.5 rounded-[16px] border-2 bg-white px-4 py-3 text-left transition-[border-color,background-color] duration-150 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primario lg:gap-4 lg:border-0 lg:px-4 lg:py-3.5 ${
                sel ? 'border-primario lg:bg-primario-suave' : 'border-transparent shadow-tarjeta hover:border-borde lg:shadow-none lg:hover:bg-fondo'
              }`}
            >
              {/* La letra va en un recuadro como el del comprobante oficial de ARCA, con su código. */}
              <span
                aria-hidden="true"
                className={`flex h-12 w-11 flex-none flex-col items-center justify-center gap-0.5 rounded-[6px] border-2 bg-white leading-none transition-colors duration-150 ${
                  sel ? 'border-primario text-primario' : 'border-texto text-texto'
                }`}
              >
                <span className={`font-display font-bold ${c.letra.length > 1 ? 'text-base' : 'text-[22px]'}`}>{c.letra}</span>
                <span className="text-[8px] font-extrabold">COD. {c.cod}</span>
              </span>
              <span className="flex min-w-0 flex-col">
                <strong className="whitespace-nowrap text-[16px] lg:text-[17px]">{c.nombre}</strong>
                <span className="hidden text-base leading-snug text-texto-suave lg:block">{c.cuando}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Vista previa */}
      {/* En pantallas anchas la vista previa se estira hasta el alto de la lista */}
      <div id="vista-comprobante" role="tabpanel" aria-labelledby={`tab-${m.id}`} className="flex min-w-0 flex-col gap-4">
        {/* Todas las vistas se apilan en la misma celda de la grilla y solo se ve la elegida:
            así el bloque siempre mide lo que la más alta y nada salta al cambiar de tipo. */}
        <div className="grid lg:hidden">
          {MUESTRAS.map((x) => (
            <p key={x.id} aria-hidden={x.id !== m.id} className={`[grid-area:1/1] text-[16px] text-texto-suave ${x.id === m.id ? '' : 'invisible'}`}>
              {x.cuando}
            </p>
          ))}
        </div>
        <div className="relative mt-4 flex min-w-0 flex-1 flex-col lg:mt-0">
          <span className="absolute -top-4 right-3 z-10 rounded-full bg-acento px-4 py-1.5 text-base font-extrabold text-texto shadow-chip sm:right-6 sm:text-base">
            {m.diferencia}
          </span>
          <div ref={hoja} className="grid w-full min-w-0 flex-1 overflow-hidden rounded-[20px] bg-white shadow-tarjeta-lg ring-1 ring-borde">
            {MUESTRAS.map((x) => (
              <div
                key={x.id}
                aria-hidden={x.id !== m.id}
                style={{ width: ANCHO_HOJA, zoom: escala }}
                className={`[grid-area:1/1] ${x.id === m.id ? 'muestra-entrar' : 'invisible'}`}
              >
                <VistaPrevia m={x} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="flex items-start gap-2 text-base text-texto-suave lg:col-span-2 lg:justify-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1E9E63" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 flex-none">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        <span>
          <strong className="text-texto">Facti elige el comprobante solo</strong> según tu condición y la de tu cliente en el padrón de ARCA. Vos no tenés que acordarte de nada.
        </span>
      </p>
    </div>
  );
}
