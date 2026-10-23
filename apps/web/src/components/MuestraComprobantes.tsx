'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import QRCode from 'qrcode';

/**
 * Sección "Todos los comprobantes" de la landing: elegís un tipo y ves una vista previa
 * en el formato oficial de ARCA (resumida), con lo que lo diferencia resaltado.
 * Los datos de ejemplo salen de los mockups de docs/diseno/pantallas/pdf-factura-*.html.
 */

type Fila = { etiqueta: string; valor: string; fuerte?: boolean; resaltar?: boolean };

interface Muestra {
  id: string;
  letra: string;
  insignia: string; // clases del cuadrado de la letra en la lista
  nombre: string;
  cuando: string;
  diferencia: string; // texto del sticker sobre lo resaltado
  // Vista previa
  titulo: string;
  cod: string;
  numero: string;
  emisor: { nombre: string; condicion: string; cuit: string };
  receptor: { etiqueta: string; nombre: string; condicion: string; resaltar?: boolean };
  extra?: { texto: string; resaltar?: boolean }; // período, comprobante asociado, divisa…
  moneda: string;
  items: { descripcion: string; importe: string }[];
  totales: Fila[];
  leyenda?: { texto: string; resaltar?: boolean };
  qr: { cuit: number; ptoVta: number; tipoCmp: number; nroCmp: number; importe: number; moneda: string; ctz: number; codAut: number };
}

const MUESTRAS: Muestra[] = [
  {
    id: 'c',
    letra: 'C',
    insignia: 'bg-primario text-white',
    nombre: 'Factura C',
    cuando: 'Sos monotributista o exento: siempre es C, para cualquier cliente.',
    diferencia: 'No discrimina IVA',
    titulo: 'FACTURA',
    cod: '011',
    numero: '00003-00000128',
    emisor: { nombre: 'FERNÁNDEZ LUCÍA', condicion: 'Responsable Monotributo', cuit: '27-31456789-4' },
    receptor: { etiqueta: 'Cliente', nombre: 'ESTUDIO LUMEN SRL', condicion: 'IVA Responsable Inscripto' },
    extra: { texto: 'Período facturado: 01/10/2026 al 31/10/2026 · Vto. pago 24/10/2026' },
    moneda: '$',
    items: [{ descripcion: 'Diseño de logo e identidad', importe: '85.000,00' }],
    totales: [
      { etiqueta: 'Subtotal', valor: '85.000,00' },
      { etiqueta: 'Importe Total', valor: '85.000,00', fuerte: true, resaltar: true },
    ],
    qr: { cuit: 27314567894, ptoVta: 3, tipoCmp: 11, nroCmp: 128, importe: 85000, moneda: 'PES', ctz: 1, codAut: 76419283746521 },
  },
  {
    id: 'a',
    letra: 'A',
    insignia: 'bg-primario text-white',
    nombre: 'Factura A',
    cuando: 'Sos responsable inscripto y le facturás a otro inscripto o a un monotributista.',
    diferencia: 'IVA discriminado + leyenda Ley 27.618',
    titulo: 'FACTURA',
    cod: '001',
    numero: '00004-00000562',
    emisor: { nombre: 'ESTUDIO LUMEN SRL', condicion: 'IVA Responsable Inscripto', cuit: '30-71589632-7' },
    receptor: { etiqueta: 'Cliente', nombre: 'FERNÁNDEZ LUCÍA', condicion: 'Responsable Monotributo' },
    moneda: '$',
    items: [
      { descripcion: 'Puesto en oficina compartida - octubre', importe: '100.000,00' },
      { descripcion: 'Impresiones y escaneos', importe: '8.000,00' },
    ],
    totales: [
      { etiqueta: 'Neto Gravado', valor: '108.000,00', resaltar: true },
      { etiqueta: 'IVA 21%', valor: '22.680,00', resaltar: true },
      { etiqueta: 'Importe Total', valor: '130.680,00', fuerte: true },
    ],
    leyenda: {
      texto: 'El crédito fiscal discriminado solo podrá ser computado a efectos del Régimen de Sostenimiento e Inclusión Fiscal para Pequeños Contribuyentes de la Ley Nº 27.618.',
      resaltar: true,
    },
    qr: { cuit: 30715896327, ptoVta: 4, tipoCmp: 1, nroCmp: 562, importe: 130680, moneda: 'PES', ctz: 1, codAut: 76419283799012 },
  },
  {
    id: 'b',
    letra: 'B',
    insignia: 'bg-primario text-white',
    nombre: 'Factura B',
    cuando: 'Sos responsable inscripto y le vendés a un consumidor final o a un exento.',
    diferencia: 'IVA incluido en el precio',
    titulo: 'FACTURA',
    cod: '006',
    numero: '00004-00001877',
    emisor: { nombre: 'ESTUDIO LUMEN SRL', condicion: 'IVA Responsable Inscripto', cuit: '30-71589632-7' },
    receptor: { etiqueta: 'Cliente', nombre: 'CONSUMIDOR FINAL', condicion: 'Consumidor Final' },
    moneda: '$',
    items: [{ descripcion: 'Pase diario coworking (x3)', importe: '36.300,00' }],
    totales: [
      { etiqueta: 'Subtotal', valor: '36.300,00' },
      { etiqueta: 'Importe Total', valor: '36.300,00', fuerte: true },
      { etiqueta: 'IVA contenido (Ley 27.743)', valor: '6.300,00', resaltar: true },
    ],
    qr: { cuit: 30715896327, ptoVta: 4, tipoCmp: 6, nroCmp: 1877, importe: 36300, moneda: 'PES', ctz: 1, codAut: 76419283811234 },
  },
  {
    id: 'e',
    letra: 'E',
    insignia: 'bg-acento text-texto',
    nombre: 'Factura E',
    cuando: 'Le vendés servicios a clientes del exterior y cobrás en dólares u otra moneda.',
    diferencia: 'En divisa, con tipo de cambio',
    titulo: 'FACTURA DE EXPORTACIÓN',
    cod: '019',
    numero: '00002-00000014',
    emisor: { nombre: 'IBARRA TOMÁS', condicion: 'Responsable Monotributo', cuit: '20-38945612-7' },
    receptor: { etiqueta: 'Señor(es)', nombre: 'NORTHWIND LABS LLC', condicion: 'Estados Unidos · ID 88-1234567' },
    extra: { texto: 'Divisa: USD · Destino: Estados Unidos · IVA exento, operación de exportación', resaltar: true },
    moneda: 'USD',
    items: [{ descripcion: 'Desarrollo de software - septiembre 2026', importe: '1.200,00' }],
    totales: [
      { etiqueta: 'Tipo de cambio', valor: '1.350,00', resaltar: true },
      { etiqueta: 'Importe Total', valor: 'USD 1.200,00', fuerte: true },
    ],
    qr: { cuit: 20389456127, ptoVta: 2, tipoCmp: 19, nroCmp: 14, importe: 1200, moneda: 'DOL', ctz: 1350, codAut: 76402811937465 },
  },
  {
    id: 'nc',
    letra: 'NC',
    insignia: 'bg-exito-suave text-exito-texto',
    nombre: 'Notas de crédito y débito',
    cuando: 'Para corregir o anular una factura que ya emitiste. Van asociadas a la original.',
    diferencia: 'Asociada a la factura original',
    titulo: 'NOTA DE CRÉDITO',
    cod: '013',
    numero: '00003-00000009',
    emisor: { nombre: 'FERNÁNDEZ LUCÍA', condicion: 'Responsable Monotributo', cuit: '27-31456789-4' },
    receptor: { etiqueta: 'Cliente', nombre: 'ESTUDIO LUMEN SRL', condicion: 'IVA Responsable Inscripto' },
    extra: { texto: 'Comprobante asociado: Factura C 00003-00000128 del 12/10/2026', resaltar: true },
    moneda: '$',
    items: [{ descripcion: 'Descuento acordado sobre diseño de logo', importe: '15.000,00' }],
    totales: [{ etiqueta: 'Importe Total', valor: '15.000,00', fuerte: true }],
    qr: { cuit: 27314567894, ptoVta: 3, tipoCmp: 13, nroCmp: 9, importe: 15000, moneda: 'PES', ctz: 1, codAut: 76419283900021 },
  },
  {
    id: 'm',
    letra: 'M',
    insignia: 'bg-primario text-white',
    nombre: 'Factura M',
    cuando: 'ARCA te la asigna si tu inscripción como responsable inscripto tiene observaciones.',
    diferencia: 'Operación sujeta a retención',
    titulo: 'FACTURA',
    cod: '051',
    numero: '00001-00000033',
    emisor: { nombre: 'GARCÍA MARTÍN', condicion: 'IVA Responsable Inscripto', cuit: '20-29876543-1' },
    receptor: { etiqueta: 'Cliente', nombre: 'ESTUDIO LUMEN SRL', condicion: 'IVA Responsable Inscripto' },
    moneda: '$',
    items: [{ descripcion: 'Mantenimiento de equipos - octubre', importe: '50.000,00' }],
    totales: [
      { etiqueta: 'Neto Gravado', valor: '50.000,00' },
      { etiqueta: 'IVA 21%', valor: '10.500,00' },
      { etiqueta: 'Importe Total', valor: '60.500,00', fuerte: true },
    ],
    leyenda: { texto: 'OPERACIÓN SUJETA A RETENCIÓN', resaltar: true },
    qr: { cuit: 20298765431, ptoVta: 1, tipoCmp: 51, nroCmp: 33, importe: 60500, moneda: 'PES', ctz: 1, codAut: 76419283955510 },
  },
];

const resaltado = 'rounded-[6px] bg-acento/35 shadow-[0_0_0_2px_#FFD25E]';

function urlQR(m: Muestra): string {
  const json = JSON.stringify({
    ver: 1, fecha: '2026-10-12', ...m.qr, tipoDocRec: 80, nroDocRec: 30715896327, tipoCodAut: 'E',
  });
  return `https://www.arca.gob.ar/fe/qr/?p=${btoa(json)}`;
}

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
  return (
    <div className="flex flex-col gap-2 bg-white p-4 font-sans text-[11px] leading-[1.4] text-[#1F2433] sm:p-5 sm:text-[12px]">
      <div className={`border ${linea} py-1 text-center text-[11px] font-extrabold tracking-[0.08em]`}>ORIGINAL</div>

      {/* Cabecera: emisor | letra | comprobante */}
      <div className={`relative grid grid-cols-2 border ${linea}`}>
        <div className={`flex min-w-0 flex-col gap-0.5 border-r ${linea} py-2.5 pl-2.5 pr-7 sm:pl-3 sm:pr-8`}>
          <span className="font-extrabold">{m.emisor.nombre}</span>
          <span className="text-[10px] sm:text-[11px]">{m.emisor.condicion}</span>
          <span className="text-[10px] sm:text-[11px]">CUIT {m.emisor.cuit}</span>
        </div>
        <div className={`absolute left-1/2 top-[-1px] flex w-11 -translate-x-1/2 flex-col items-center border-2 border-t ${linea} bg-white pb-1 pt-0.5`}>
          <span className="text-[24px] font-extrabold leading-none">{m.letra === 'NC' ? 'C' : m.letra}</span>
          <span className="text-[8px] font-extrabold">COD. {m.cod}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 py-2.5 pl-7 pr-2.5 sm:pl-8 sm:pr-3">
          <span className="text-[12px] font-extrabold tracking-[0.02em] sm:text-[13px]">{m.titulo}</span>
          <span className="whitespace-nowrap text-[10px] font-bold sm:text-[12px]">N° {m.numero}</span>
          <span className="text-[10px] sm:text-[11px]">Fecha: 12/10/2026</span>
        </div>
      </div>

      {m.extra && <div className={`border ${linea} px-3 py-1.5 ${m.extra.resaltar ? resaltado : ''}`}>{m.extra.texto}</div>}

      <div className={`border ${linea} px-3 py-1.5`}>
        <span className="font-extrabold">{m.receptor.etiqueta}:</span> {m.receptor.nombre}
        <span className="block text-[10px] sm:text-[11px]">Condición frente al IVA: {m.receptor.condicion}</span>
      </div>

      {/* Detalle */}
      <table className={`w-full border-collapse border ${linea}`}>
        <thead className="bg-[#EEF0F5]">
          <tr>
            <th className={`border-b ${linea} px-2 py-1 text-left font-extrabold`}>Producto / Servicio</th>
            <th className={`border-b ${linea} px-2 py-1 text-right font-extrabold`}>Subtotal ({m.moneda})</th>
          </tr>
        </thead>
        <tbody>
          {m.items.map((it) => (
            <tr key={it.descripcion}>
              <td className="border-b border-[#E3E6EE] px-2 py-1">{it.descripcion}</td>
              <td className="whitespace-nowrap border-b border-[#E3E6EE] px-2 py-1 text-right">{it.importe}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {m.leyenda && (
        <p className={`px-2 py-1 text-[10px] italic sm:text-[11px] ${m.leyenda.resaltar ? resaltado : ''} ${m.leyenda.texto === m.leyenda.texto.toUpperCase() ? 'text-center font-extrabold not-italic' : ''}`}>
          {m.leyenda.texto}
        </p>
      )}

      {/* Totales */}
      <div className="flex justify-end">
        <div className={`flex w-full max-w-[250px] flex-col gap-0.5 border ${linea} px-3 py-2`}>
          {m.totales.map((t) => (
            <div
              key={t.etiqueta}
              className={`flex justify-between gap-3 px-1 ${t.fuerte ? `mt-0.5 border-t ${linea} pt-1 text-[13px] font-extrabold` : ''} ${t.resaltar ? resaltado : ''}`}
            >
              <span className="font-bold">{t.etiqueta}:</span>
              <span className="whitespace-nowrap">{t.valor.startsWith('USD') ? t.valor : `$ ${t.valor}`}</span>
            </div>
          ))}
        </div>
      </div>

      {/* QR + ARCA + CAE */}
      <div className={`flex items-center gap-3 border-t ${linea} pt-2`}>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} width={58} height={58} alt="Código QR de ARCA de ejemplo" className="flex-none" />
        ) : (
          <div className="h-[58px] w-[58px] flex-none bg-fondo" />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[14px] font-extrabold tracking-[0.04em]">ARCA</span>
          <span className="font-extrabold italic">Comprobante Autorizado</span>
        </div>
        <div className="flex flex-col items-end text-[10px] sm:text-[11px]">
          <span>
            <span className="font-extrabold">CAE</span> {m.qr.codAut}
          </span>
          <span>
            <span className="font-extrabold">Vto. CAE</span> 22/10/2026
          </span>
        </div>
      </div>
    </div>
  );
}

export function MuestraComprobantes() {
  const [activo, setActivo] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const m = MUESTRAS[activo]!;

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
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-10">
      {/* Lista de comprobantes */}
      <div
        role="tablist"
        aria-label="Tipos de comprobante"
        aria-orientation="vertical"
        onKeyDown={teclado}
        className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
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
              className={`flex flex-none snap-start items-center gap-3.5 rounded-[20px] border-2 bg-white px-4 py-3 text-left transition-[border-color,box-shadow] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primario lg:gap-4 lg:px-5 lg:py-4 ${
                sel ? 'border-primario shadow-tarjeta-lg' : 'border-transparent shadow-tarjeta hover:border-borde'
              }`}
            >
              <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-[14px] font-mono font-bold lg:h-12 lg:w-12 ${c.insignia} ${c.letra.length > 1 ? 'text-[17px]' : 'text-[22px]'}`}>
                {c.letra}
              </span>
              <span className="flex min-w-0 flex-col">
                <strong className="whitespace-nowrap text-[16px] lg:text-[17px]">{c.nombre}</strong>
                <span className="hidden text-[14px] leading-snug text-texto-suave lg:block">{c.cuando}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Vista previa */}
      <div id="vista-comprobante" role="tabpanel" aria-labelledby={`tab-${m.id}`} className="flex flex-col gap-4 lg:sticky lg:top-6">
        <p className="text-[16px] text-texto-suave lg:hidden">{m.cuando}</p>
        <div className="relative pt-4">
          <span className="absolute right-3 top-0 z-10 rotate-2 rounded-full bg-acento px-4 py-1.5 text-[13px] font-extrabold text-texto shadow-chip sm:right-6 sm:text-[14px]">
            {m.diferencia}
          </span>
          <div key={m.id} className="muestra-entrar overflow-hidden rounded-[18px] shadow-tarjeta-lg ring-1 ring-borde">
            <VistaPrevia m={m} />
          </div>
        </div>
        <p className="flex items-start gap-2 text-[15px] text-texto-suave">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1E9E63" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 flex-none">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          <span>
            <strong className="text-texto">Facti elige el comprobante solo</strong> según tu condición y la de tu cliente en el padrón de ARCA. Vos no tenés que acordarte de nada.
          </span>
        </p>
      </div>
    </div>
  );
}
