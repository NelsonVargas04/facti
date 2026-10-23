'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BackLink } from '@/components/BackLink';
import { Facti } from '@/components/Facti';
import { Select } from '@/components/Select';
import { buscarPadron, emitirFactura, COND_IVA_RECEPTOR, type PadronDatos, type Resultado } from '@/lib/api';

type Tipo = 'C' | 'E';
interface Item {
  id: number;
  desc: string;
  cant: string;
  unidad: string;
  precio: string;
}

/** Interpreta un monto en formato argentino ("70.000,50", "$70.000") como número. */
function parseNum(s: string): number {
  if (!s) return 0;
  const limpio = s.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(limpio);
  return Number.isNaN(n) ? 0 : n;
}
/** 70000 -> "70.000,00" (formato argentino, sin símbolo). */
const fmtNum = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (n: number, moneda = '$') => `${moneda} ` + fmtNum(n);
function isoFecha(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split('/');
  if (!d || !m || !y) return '';
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

const COND_LABEL: Record<PadronDatos['condicion'], string> = {
  responsable_inscripto: 'Responsable Inscripto',
  monotributo: 'Monotributo',
  exento: 'Exento',
  consumidor_final: 'Consumidor final',
  no_alcanzado: 'No alcanzado',
};
const COND_IVA_COMPROBANTE: Record<PadronDatos['condicion'], string> = {
  responsable_inscripto: 'IVA Responsable Inscripto',
  monotributo: 'Responsable Monotributo',
  exento: 'IVA Exento',
  consumidor_final: 'Consumidor Final',
  no_alcanzado: 'IVA No Alcanzado',
};

const TIPOS: { id: Tipo | 'A' | 'B' | 'M'; letra: string; nombre: string; hab: boolean; nota: string; detalle: string }[] = [
  { id: 'C', letra: 'C', nombre: 'Factura C', hab: true, nota: 'Monotributo · sin IVA', detalle: 'Para monotributistas y exentos. No discrimina IVA.' },
  { id: 'E', letra: 'E', nombre: 'Factura E', hab: true, nota: 'Exportación de servicios', detalle: 'Exportación de servicios. Moneda extranjera, IVA exento, sin período desde/hasta.' },
  { id: 'A', letra: 'A', nombre: 'Factura A', hab: false, nota: 'Resp. inscripto · discrimina IVA', detalle: 'Disponible en la fase de responsable inscripto. Discrimina IVA por alícuota.' },
  { id: 'B', letra: 'B', nombre: 'Factura B', hab: false, nota: 'Resp. inscripto · IVA incluido', detalle: 'Disponible en la fase de responsable inscripto. IVA incluido en el precio.' },
  { id: 'M', letra: 'M', nombre: 'Factura M', hab: false, nota: 'Resp. inscripto observado', detalle: 'Disponible en la fase de responsable inscripto. Como la A, con retención.' },
];
const DOCS = [
  { id: 80, label: 'CUIT' },
  { id: 86, label: 'CUIL' },
  { id: 96, label: 'DNI' },
  { id: 99, label: 'Consumidor final' },
];
const UNIDADES = ['unidades', 'horas', 'kg', 'metros', 'litros', 'docena', 'servicio'];
const CONDICIONES_VENTA = ['Contado', 'Transferencia bancaria', 'Cuenta corriente', 'Tarjeta de débito', 'Tarjeta de crédito', 'Cheque', 'Otra'];
const PAISES = ['Estados Unidos', 'Brasil', 'Chile', 'Uruguay', 'Paraguay', 'España', 'Alemania', 'Reino Unido', 'Francia', 'Italia', 'México', 'Colombia', 'Perú', 'China', 'Canadá', 'Otro'];
const MONEDAS_EXT = [
  { id: 'USD', label: 'Dólar estadounidense (USD)' },
  { id: 'EUR', label: 'Euro (EUR)' },
  { id: 'BRL', label: 'Real brasileño (BRL)' },
  { id: 'CLP', label: 'Peso chileno (CLP)' },
  { id: 'UYU', label: 'Peso uruguayo (UYU)' },
  { id: 'GBP', label: 'Libra esterlina (GBP)' },
];
const FORMAS_PAGO = ['Transferencia', 'Cuenta de terceros', 'Efectivo', 'Otra'];
const INCOTERMS = ['No aplica (servicios)', 'FOB', 'CIF', 'CFR', 'EXW', 'FCA', 'DAP', 'Otro'];

function Lupa() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>);
}
function Tilde({ color = '#0E5C38' }: { color?: string }) {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>);
}


const inputCls = 'h-12 w-full rounded-input border-[1.5px] border-borde bg-white px-4 text-base text-texto outline-none transition-colors focus:border-primario';
const labelCls = 'flex flex-col gap-2 text-sm font-bold';

let proximoId = 3;

function Aviso({ res }: { res: Extract<Resultado<unknown>, { ok: false }> }) {
  if (res.estado === 503) {
    return (
      <div className="flex flex-col gap-1 rounded-[14px] bg-aviso-suave px-4 py-3 text-sm font-bold text-aviso-texto">
        <span>Todavía no conectaste Facti con ARCA.</span>
        <Link href="/onboarding/arca" className="font-extrabold text-primario-oscuro underline">Conectar ahora</Link>
      </div>
    );
  }
  if (res.estado === 501) {
    return <div className="rounded-[14px] bg-aviso-suave px-4 py-3 text-sm font-bold text-aviso-texto">{res.mensaje}</div>;
  }
  return <div className="rounded-[14px] bg-[#FDE8EA] px-4 py-3 text-sm font-bold text-[#B4232B]">{res.mensaje}</div>;
}

export default function NuevaFactura() {
  const router = useRouter();
  const [tipo, setTipo] = useState<Tipo>('C');
  const [incluyeServicio, setIncluyeServicio] = useState(true);

  // Receptor nacional (C)
  const [docTipo, setDocTipo] = useState(80);
  const [cuit, setCuit] = useState('30-71589632-7');
  const [padron, setPadron] = useState<PadronDatos | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [padronMsg, setPadronMsg] = useState<Extract<Resultado<unknown>, { ok: false }> | null>(null);
  const [condicionVenta, setCondicionVenta] = useState('Transferencia bancaria');

  // Receptor del exterior (E)
  const [nombreExt, setNombreExt] = useState('');
  const [pais, setPais] = useState('Estados Unidos');
  const [idImpositivo, setIdImpositivo] = useState('');
  const [monedaExt, setMonedaExt] = useState('USD');
  const [cotizacion, setCotizacion] = useState('1.000,00');
  const [formaPago, setFormaPago] = useState('Transferencia');
  const [incoterms, setIncoterms] = useState('No aplica (servicios)');

  const [email, setEmail] = useState('admin@estudiolumen.com.ar');
  const [fecha, setFecha] = useState('14/10/2026');
  const [desde, setDesde] = useState('01/10/2026');
  const [hasta, setHasta] = useState('31/10/2026');
  const [vence, setVence] = useState('24/10/2026');

  const [items, setItems] = useState<Item[]>([
    { id: 1, desc: 'Diseño de logo e identidad', cant: '1', unidad: 'unidades', precio: '70.000,00' },
    { id: 2, desc: 'Adaptación para redes', cant: '3', unidad: 'unidades', precio: '5.000,00' },
  ]);

  const [emitiendo, setEmitiendo] = useState(false);
  const [emitirMsg, setEmitirMsg] = useState<Extract<Resultado<unknown>, { ok: false }> | null>(null);

  const total = useMemo(() => items.reduce((acc, it) => acc + parseNum(it.cant) * parseNum(it.precio), 0), [items]);
  const conServicio = incluyeServicio;
  const esE = tipo === 'E';
  const esCF = docTipo === 99;
  const simboloMoneda = esE ? monedaExt : '$';

  function actualizar(id: number, campo: keyof Item, valor: string) {
    setItems((xs) => xs.map((it) => (it.id === id ? { ...it, [campo]: valor } : it)));
  }
  const agregar = () => setItems((xs) => [...xs, { id: proximoId++, desc: '', cant: '1', unidad: 'unidades', precio: '' }]);
  const quitar = (id: number) => setItems((xs) => (xs.length > 1 ? xs.filter((it) => it.id !== id) : xs));

  async function buscar() {
    setBuscando(true);
    setPadronMsg(null);
    const res = await buscarPadron(cuit);
    setBuscando(false);
    if (res.ok) setPadron(res.dato);
    else {
      setPadron(null);
      setPadronMsg(res);
    }
  }

  async function emitir() {
    setEmitirMsg(null);
    if (esE) {
      // La Factura E usa WSFEX (otro web service), que todavía no integramos.
      setEmitirMsg({ ok: false, estado: 501, mensaje: 'La Factura E (exportación) se emite con el web service WSFEX de ARCA, que estamos integrando. Es parte del plan Pro.' });
      return;
    }
    setEmitiendo(true);
    const receptor = esCF
      ? { docTipo: 99, docNro: '0', condicionIvaReceptorId: 5 }
      : padron
        ? { docTipo, docNro: padron.cuit.replace(/\D/g, ''), condicionIvaReceptorId: COND_IVA_RECEPTOR[padron.condicion] }
        : { docTipo, docNro: cuit.replace(/\D/g, ''), condicionIvaReceptorId: 5 };
    const req = {
      receptor,
      concepto: (incluyeServicio ? 2 : 1) as 1 | 2 | 3,
      fecha: isoFecha(fecha),
      periodoServicio: conServicio ? { desde: isoFecha(desde), hasta: isoFecha(hasta), vencimientoPago: isoFecha(vence) } : undefined,
      items: items.map((it) => ({ descripcion: it.desc, cantidad: parseNum(it.cant), unidad: it.unidad, precioUnitario: parseNum(it.precio) })),
    };
    const res = await emitirFactura(req);
    setEmitiendo(false);
    if (res.ok) {
      sessionStorage.setItem(
        'facti:ultima-factura',
        JSON.stringify({
          ...res.dato,
          clienteNombre: esCF ? 'Consumidor final' : padron?.nombre ?? 'Consumidor final',
          receptor: {
            cuit: esCF ? '' : padron?.cuit ?? cuit,
            nombre: esCF ? 'Consumidor final' : padron?.nombre ?? 'Consumidor final',
            condicionIva: esCF ? 'Consumidor Final' : padron ? COND_IVA_COMPROBANTE[padron.condicion] : 'Consumidor Final',
            domicilio: padron?.domicilio ?? '—',
            condicionVenta,
          },
          periodo: conServicio ? { desde, hasta, vtoPago: vence } : null,
          items: req.items,
        }),
      );
      router.push('/app/facturas/emitida');
    } else {
      setEmitirMsg(res);
    }
  }

  return (
    <>
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <BackLink href="/app">Volver al inicio</BackLink>
          <h1 className="mt-1 text-[34px] font-bold">Nueva factura</h1>
        </div>
        <span className="inline-flex items-center gap-2.5 rounded-input bg-primario-suave px-4 py-2.5 font-extrabold text-primario-oscuro">
          <span className="rounded-lg bg-primario px-2.5 py-0.5 text-white">{tipo}</span>
          {esE ? 'Factura E · Exportación' : 'Factura C · Punto de venta 0003'}
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          {/* Tipo de comprobante */}
          <section className="flex flex-col gap-4 rounded-tarjeta bg-superficie p-7 shadow-tarjeta">
            <div>
              <h2 className="text-[20px] font-bold">Tipo de comprobante</h2>
              <p className="text-sm text-texto-suave">Según tu condición (monotributo) podés emitir C y E. Cada tipo pide solo los datos que le corresponden. Las demás son para responsables inscriptos.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {TIPOS.map((t) => {
                const on = t.id === tipo;
                return (
                  <button
                    key={t.id}
                    type="button"
                    title={t.detalle}
                    disabled={!t.hab}
                    onClick={() => {
                      if (!t.hab) return;
                      setTipo(t.id as Tipo);
                    }}
                    className={`flex min-w-[130px] flex-1 items-center gap-3 rounded-[16px] border-2 p-3 text-left transition-colors ${
                      on ? 'border-primario bg-[#F4F4FF]' : 'border-[#E1E5EE] bg-white'
                    } ${t.hab ? 'cursor-pointer hover:border-primario' : 'cursor-not-allowed opacity-60'}`}
                  >
                    <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-lg font-mono text-xl font-bold ${t.letra === 'E' ? 'bg-acento text-texto' : on ? 'bg-primario text-white' : 'bg-primario-suave text-primario-oscuro'}`}>{t.letra}</span>
                    <span>
                      <strong className="block text-[15px]">{t.nombre}</strong>
                      <span className="text-xs text-texto-tenue">{t.nota}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 1. Cliente */}
          <section className="flex flex-col gap-5 rounded-tarjeta bg-superficie p-7 shadow-tarjeta">
            <h2 className="text-[20px] font-bold">1. Cliente</h2>

            {!esE ? (
              <>
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                  <label className={labelCls}>
                    Tipo de documento
                    <Select ariaLabel="Tipo de documento" value={String(docTipo)} onChange={(v) => setDocTipo(Number(v))} options={DOCS.map((d) => ({ value: String(d.id), label: d.label }))} />
                  </label>
                  {!esCF && (
                    <div className="flex items-end gap-3 sm:col-span-1">
                      <label className={`${labelCls} flex-1`}>
                        {DOCS.find((d) => d.id === docTipo)?.label} del cliente
                        <input type="text" value={cuit} onChange={(e) => setCuit(e.target.value)} className={inputCls} placeholder="30-71589632-7" />
                      </label>
                    </div>
                  )}
                </div>

                {!esCF && (
                  <div>
                    <button type="button" onClick={buscar} disabled={buscando} className="btn-lift flex h-11 items-center gap-2 rounded-input bg-texto px-5 text-[15px] font-extrabold text-white disabled:opacity-60">
                      <Lupa />{buscando ? 'Buscando…' : 'Buscar en ARCA'}
                    </button>
                  </div>
                )}

                {esCF ? (
                  <p className="rounded-[18px] bg-fondo px-5 py-4 text-sm text-texto-suave">Consumidor final. Solo se pide identificación cuando la factura es de <strong>$10.000.000</strong> o más.</p>
                ) : padron ? (
                  <div className="grid gap-4 rounded-[18px] bg-fondo p-5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                    <div className="col-span-full flex items-center gap-2 text-sm font-extrabold text-exito-texto"><Tilde />Encontrado en el padrón de ARCA</div>
                    <div><div className="text-[13px] text-texto-tenue">Nombre / Razón social</div><strong>{padron.nombre}</strong></div>
                    <div><div className="text-[13px] text-texto-tenue">Condición frente al IVA</div><strong>{COND_LABEL[padron.condicion]}{padron.categoriaMonotributo ? ` · ${padron.categoriaMonotributo}` : ''}</strong></div>
                    {padron.domicilio && <div><div className="text-[13px] text-texto-tenue">Domicilio</div><strong>{padron.domicilio}</strong></div>}
                  </div>
                ) : padronMsg ? (
                  <Aviso res={padronMsg} />
                ) : (
                  <p className="rounded-[18px] bg-fondo px-5 py-4 text-sm text-texto-suave">Escribí el CUIT y tocá <strong>Buscar en ARCA</strong> para traer los datos del cliente y su condición frente al IVA.</p>
                )}

                <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                  <label className={labelCls}>Email para enviarle la factura<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="cliente@ejemplo.com" /></label>
                  <label className={labelCls}>Condición de venta<Select ariaLabel="Condición de venta" value={condicionVenta} onChange={setCondicionVenta} options={CONDICIONES_VENTA} /></label>
                </div>
              </>
            ) : (
              // Receptor del exterior (Factura E)
              <>
                <div className="flex items-start gap-2 rounded-[14px] bg-aviso-suave px-4 py-3 text-sm font-bold text-aviso-texto">
                  <Tilde color="#6B4600" />El cliente del exterior no está en el padrón de ARCA: cargá sus datos a mano.
                </div>
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                  <label className={labelCls}>Nombre / Razón social del exterior<input type="text" value={nombreExt} onChange={(e) => setNombreExt(e.target.value)} className={inputCls} placeholder="Acme Corp." /></label>
                  <label className={labelCls}>País de destino<Select ariaLabel="País de destino" value={pais} onChange={setPais} options={PAISES} /></label>
                  <label className={labelCls}>ID impositivo del exterior<input type="text" value={idImpositivo} onChange={(e) => setIdImpositivo(e.target.value)} className={inputCls} placeholder="Tax ID / VAT / EIN" /></label>
                  <label className={labelCls}>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="cliente@ejemplo.com" /></label>
                </div>
              </>
            )}
          </section>

          {/* 2. Qué facturás */}
          <section className="flex flex-col gap-5 rounded-tarjeta bg-superficie p-7 shadow-tarjeta">
            <h2 className="text-[20px] font-bold">2. Qué facturás</h2>

            {esE ? (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-bold">Concepto</span>
                <span className="inline-flex items-center gap-2 self-start rounded-input bg-primario-suave px-4 py-2.5 text-[15px] font-extrabold text-primario-oscuro">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                  Servicios · Exportación
                </span>
                <span className="text-xs text-texto-tenue">La Factura E es por exportación de servicios: el período va en la descripción de cada ítem.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-bold">¿Es un servicio?</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={incluyeServicio}
                  onClick={() => setIncluyeServicio((v) => !v)}
                  className="flex items-center gap-3 self-start"
                >
                  <span className={`relative h-6 w-11 flex-none rounded-full transition-colors ${incluyeServicio ? 'bg-primario' : 'bg-[#D6DBE7]'}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${incluyeServicio ? 'left-[22px]' : 'left-0.5'}`} />
                  </span>
                  <span className="font-bold text-texto">{incluyeServicio ? 'Sí, cobro por un período de trabajo' : 'No, vendo productos'}</span>
                </button>
                <span className="text-xs text-texto-tenue">Si está activado, sumamos el período facturado (desde/hasta). Apagalo si vendés productos. Los ítems los agregás abajo como más te convenga.</span>
              </div>
            )}

            <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
              <label className={labelCls}>Fecha de emisión<input type="text" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} /></label>
              {esE ? (
                <>
                  <label className={labelCls}>Moneda<Select ariaLabel="Moneda" value={monedaExt} onChange={setMonedaExt} options={MONEDAS_EXT.map((m) => ({ value: m.id, label: m.label }))} /></label>
                  <label className={labelCls}>Cotización (en $)<input type="text" inputMode="decimal" value={cotizacion} onChange={(e) => setCotizacion(e.target.value)} onBlur={(e) => setCotizacion(e.target.value.trim() ? fmtNum(parseNum(e.target.value)) : '')} className={inputCls} placeholder="1.000,00" /></label>
                  <label className={labelCls}>Forma de pago<Select ariaLabel="Forma de pago" value={formaPago} onChange={setFormaPago} options={FORMAS_PAGO} /></label>
                  <label className={labelCls}>Incoterms<Select ariaLabel="Incoterms" value={incoterms} onChange={setIncoterms} options={INCOTERMS} /></label>
                </>
              ) : (
                <label className={labelCls}>Moneda<Select ariaLabel="Moneda" value="ARS" onChange={() => {}} options={[{ value: 'ARS', label: 'Pesos argentinos (ARS)' }]} /></label>
              )}
              {conServicio && !esE && (
                <>
                  <label className={labelCls}>Servicio desde<input type="text" value={desde} onChange={(e) => setDesde(e.target.value)} className={inputCls} /></label>
                  <label className={labelCls}>Servicio hasta<input type="text" value={hasta} onChange={(e) => setHasta(e.target.value)} className={inputCls} /></label>
                  <label className={labelCls}>Vence el pago<input type="text" value={vence} onChange={(e) => setVence(e.target.value)} className={inputCls} /></label>
                </>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold">Detalle</span>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-left text-xs font-extrabold tracking-[0.06em] text-texto-tenue">
                      <th className="px-1 pb-1">DESCRIPCIÓN</th>
                      <th className="w-[80px] px-1 pb-1">CANT.</th>
                      <th className="w-[130px] px-1 pb-1">U. MEDIDA</th>
                      <th className="w-[140px] px-1 pb-1">PRECIO UNIT.</th>
                      <th className="w-[130px] px-1 pb-1 text-right">SUBTOTAL</th>
                      <th className="w-[40px] px-1 pb-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td className="pr-2"><input aria-label="Descripción" type="text" value={it.desc} onChange={(e) => actualizar(it.id, 'desc', e.target.value)} className={inputCls} placeholder="Ej: Diseño de logo" /></td>
                        <td className="pr-2"><input aria-label="Cantidad" type="text" value={it.cant} onChange={(e) => actualizar(it.id, 'cant', e.target.value)} className={inputCls} /></td>
                        <td className="pr-2"><Select ariaLabel="Unidad de medida" value={it.unidad} onChange={(v) => actualizar(it.id, 'unidad', v)} options={UNIDADES} /></td>
                        <td className="pr-2"><input aria-label="Precio unitario" type="text" inputMode="decimal" value={it.precio} onChange={(e) => actualizar(it.id, 'precio', e.target.value)} onBlur={(e) => actualizar(it.id, 'precio', e.target.value.trim() ? fmtNum(parseNum(e.target.value)) : '')} className={inputCls} placeholder="0,00" /></td>
                        <td className="whitespace-nowrap px-1 text-right align-middle font-extrabold">{fmt(parseNum(it.cant) * parseNum(it.precio), simboloMoneda)}</td>
                        <td className="text-center align-middle">
                          <button type="button" onClick={() => quitar(it.id)} aria-label="Quitar ítem" disabled={items.length === 1} className="rounded-lg p-2 text-texto-tenue transition-colors hover:bg-fondo hover:text-[#D9466F] disabled:opacity-30">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={agregar} className="flex items-center gap-2 self-start rounded-input border-[1.5px] border-dashed border-[#B9BED3] px-[18px] py-3 text-[15px] font-extrabold text-primario-oscuro transition-colors hover:border-primario hover:bg-fondo">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                Agregar ítem
              </button>
            </div>
          </section>
        </div>

        {/* Aside: resumen */}
        <aside className="flex min-w-0 flex-1 basis-[320px] flex-col gap-[18px]">
          <div className="flex flex-col gap-3.5 rounded-tarjeta bg-superficie p-7 shadow-tarjeta">
            <h2 className="text-[20px] font-bold">Resumen</h2>
            <div className="flex justify-between text-texto-suave"><span>Subtotal</span><span>{fmt(total, simboloMoneda)}</span></div>
            <div className="flex justify-between text-texto-suave"><span>IVA</span><span>{esE ? 'Exento (exportación)' : 'No corresponde'}</span></div>
            <div className="flex items-baseline justify-between border-t-[1.5px] border-dashed border-borde pt-3.5">
              <strong>Total</strong>
              <span className="font-display text-[32px] font-bold">{fmt(total, simboloMoneda)}</span>
            </div>
            {emitirMsg && <Aviso res={emitirMsg} />}
            <button type="button" onClick={emitir} disabled={emitiendo} className="btn-lift flex h-[54px] items-center justify-center gap-2 rounded-full bg-primario text-[17px] font-extrabold text-white shadow-boton disabled:opacity-60">
              {emitiendo ? 'Emitiendo…' : `Emitir y enviar Factura ${tipo}`}
            </button>
            <button type="button" className="btn-lift h-[50px] rounded-full border-[1.5px] border-borde bg-white text-base font-extrabold text-texto">Guardar borrador</button>
          </div>

          <div className="flex items-center gap-3.5 rounded-tarjeta bg-texto p-[22px] text-white">
            <Facti pose="factura" size={110} animated={false} />
            <p className="text-[15px] font-bold leading-snug">
              {esE
                ? <>Para exportar usás la <span className="text-acento">Factura E</span>. Cargá el país y la moneda del exterior.</>
                : <>Te puse <span className="text-acento">Factura C</span> porque sos monotributista. Revisá el monto y yo le pido el CAE a ARCA.</>}
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
