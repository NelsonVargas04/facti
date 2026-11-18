'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BackLink } from '@/components/BackLink';
import { Facti } from '@/components/Facti';
import { Select } from '@/components/Select';
import { Girando } from '@/components/Animado';
import { AvisoApi } from '@/components/AvisoApi';
import { buscarPadron, crearRecurrente, emitirFactura, verComprobante, verCuenta, verRecurrente, COND_IVA_RECEPTOR, type Comprobante, type Condicion, type ErrorApi, type NuevaFacturaReq, type PadronDatos } from '@/lib/api';
import { Icon } from '@/components/Icon';
import { borrarBorrador, cuandoSeGuardo, enLinea, guardarBorrador, leerBorrador, tieneContenido, type Borrador } from '@/lib/borrador';
import { hoyAR, rangoMes } from '@/lib/formato';
import { paises } from '@/lib/paises';
import { useApi } from '@/lib/useApi';

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
/** AAAA-MM-DD → dd/mm/aaaa */
const ddmmyyyy = (iso: string) => iso.split('-').reverse().join('/');
/** Fechas iniciales: hoy, el mes en curso como período y vencimiento a 10 días. */
function fechasIniciales() {
  const hoy = hoyAR();
  const { desde, hasta } = rangoMes(hoy);
  const vence = new Date(`${hoy}T12:00:00Z`);
  vence.setUTCDate(vence.getUTCDate() + 10);
  return { hoy: ddmmyyyy(hoy), desde: ddmmyyyy(desde), hasta: ddmmyyyy(hasta), vence: ddmmyyyy(vence.toISOString().slice(0, 10)) };
}

const COND_LABEL: Record<PadronDatos['condicion'], string> = {
  responsable_inscripto: 'Responsable Inscripto',
  monotributo: 'Monotributo',
  exento: 'Exento',
  consumidor_final: 'Consumidor final',
  no_alcanzado: 'No alcanzado',
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
const labelCls = 'flex flex-col gap-2 text-base font-semibold';

let proximoId = 3;

function Aviso({ res }: { res: ErrorApi }) {
  if (res.codigo === 'configuracion') {
    return (
      <div role="alert" className="aviso-entra flex flex-col gap-1 rounded-[14px] bg-aviso-suave px-4 py-3 text-base font-semibold text-aviso-texto">
        <span>Todavía no conectaste Facti con ARCA. {res.mensaje}</span>
        <Link href="/onboarding/arca" className="font-bold text-primario-oscuro underline">Conectar ahora</Link>
      </div>
    );
  }
  if (res.codigo === 'base_datos' || res.codigo === 'sin_conexion') return <AvisoApi error={res} compacto />;
  if (res.codigo === 'limite_plan') {
    return (
      <div role="alert" className="aviso-entra flex flex-col gap-1 rounded-[14px] bg-aviso-suave px-4 py-3 text-base font-semibold text-aviso-texto">
        <span>{res.mensaje}</span>
        <Link href="/app/plan" className="font-bold text-primario-oscuro underline">Ver el plan Pro</Link>
      </div>
    );
  }
  if (res.estado === 501) {
    return <div role="alert" className="aviso-entra rounded-[14px] bg-aviso-suave px-4 py-3 text-base font-semibold text-aviso-texto">{res.mensaje}</div>;
  }
  return <div role="alert" className="aviso-entra rounded-[14px] bg-[#FDE8EA] px-4 py-3 text-base font-semibold text-[#B4232B]">{res.mensaje}</div>;
}

export default function NuevaFactura() {
  // useSearchParams (para "Repetir factura") necesita un Suspense alrededor.
  return (
    <Suspense fallback={<div className="skeleton h-[560px] rounded-tarjeta-lg" />}>
      <FormularioFactura />
    </Suspense>
  );
}

const CONDICIONES_VALIDAS: Condicion[] = ['responsable_inscripto', 'monotributo', 'exento', 'consumidor_final', 'no_alcanzado'];
/** CondicionIVAReceptorId de ARCA (RG 5616) → condición. */
const CONDICION_POR_ID: Record<number, Condicion> = { 1: 'responsable_inscripto', 4: 'exento', 5: 'consumidor_final', 6: 'monotributo', 13: 'monotributo' };

/** La condición guardada puede venir como código ("monotributo") o como texto ("IVA Responsable Inscripto"):
 *  si no es un código, manda el id de ARCA, que es lo que se usa para emitir. */
function condicionDe(cond: string | undefined, ivaId: number | undefined): Condicion {
  if (CONDICIONES_VALIDAS.includes(cond as Condicion)) return cond as Condicion;
  return (ivaId !== undefined && CONDICION_POR_ID[ivaId]) || 'consumidor_final';
}

/** Arma un borrador a partir de una factura ya emitida ("Repetir factura"). Las fechas no se copian: van las de hoy. */
function borradorDeComprobante(c: Comprobante): Partial<Borrador> {
  const r = c.receptor;
  const cond = condicionDe(r.condicion, r.condicionIvaId);
  const esE = c.sigla === 'E';
  const conPadron = !esE && r.docTipo !== 99 && !!r.nombre;
  return {
    repiteDe: c.numeroInterno,
    tipo: esE ? 'E' : 'C',
    incluyeServicio: c.concepto !== 1,
    docTipo: esE ? 80 : r.docTipo,
    cuit: esE || r.docTipo === 99 ? '' : r.docNro,
    padron: conPadron ? { cuit: r.docNro, nombre: r.nombre, tipoPersona: '', condicion: cond, domicilio: r.domicilio || undefined, actividades: [] } : null,
    nombreExt: esE ? r.nombre : '',
    email: r.email ?? '',
    condicionVenta: c.condicionVenta || 'Transferencia bancaria',
    items: (c.items ?? []).map((it, i) => ({
      id: i + 1,
      desc: it.descripcion,
      cant: String(it.cantidad).replace('.', ','),
      unidad: it.unidad || 'unidades',
      precio: fmtNum(it.precioUnitario),
    })),
  };
}

/** Arma el borrador desde la plantilla de una factura recurrente (fechas: las de hoy). */
function borradorDePlantilla(pl: NuevaFacturaReq): Partial<Borrador> {
  const r = pl.receptor;
  const cond = condicionDe(r.condicion, r.condicionIvaReceptorId);
  return {
    tipo: 'C',
    incluyeServicio: pl.concepto !== 1,
    docTipo: r.docTipo,
    cuit: r.docTipo === 99 ? '' : r.docNro,
    padron: r.docTipo !== 99 && r.nombre ? { cuit: r.docNro, nombre: r.nombre, tipoPersona: '', condicion: cond, domicilio: r.domicilio || undefined, actividades: [] } : null,
    email: r.email ?? '',
    condicionVenta: pl.condicionVenta || 'Transferencia bancaria',
    items: pl.items.map((it, i) => ({ id: i + 1, desc: it.descripcion, cant: String(it.cantidad).replace('.', ','), unidad: it.unidad || 'unidades', precio: fmtNum(it.precioUnitario) })),
  };
}

const DIAS = Array.from({ length: 28 }, (_, i) => String(i + 1));

function FormularioFactura() {
  const router = useRouter();
  const params = useSearchParams();
  const repetirId = params.get('repetir');
  const recurrenteParam = params.get('recurrente');
  const [tipo, setTipo] = useState<Tipo>('C');
  const [incluyeServicio, setIncluyeServicio] = useState(true);

  // Receptor nacional (C)
  const cuenta = useApi(verCuenta, []);
  const puntoVenta = cuenta.dato ? String(cuenta.dato.cuenta.puntoVenta).padStart(4, '0') : '…';
  const [iniciales] = useState(fechasIniciales);
  const [docTipo, setDocTipo] = useState(80);
  const [cuit, setCuit] = useState('');
  const [padron, setPadron] = useState<PadronDatos | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [padronMsg, setPadronMsg] = useState<ErrorApi | null>(null);
  const [condicionVenta, setCondicionVenta] = useState('Transferencia bancaria');

  // Receptor del exterior (E)
  const [nombreExt, setNombreExt] = useState('');
  const [pais, setPais] = useState('Estados Unidos');
  const [idImpositivo, setIdImpositivo] = useState('');
  const [monedaExt, setMonedaExt] = useState('USD');
  const [cotizacion, setCotizacion] = useState('1.000,00');
  const [formaPago, setFormaPago] = useState('Transferencia');
  const [incoterms, setIncoterms] = useState('No aplica (servicios)');

  const [email, setEmail] = useState('');
  const [fecha, setFecha] = useState(iniciales.hoy);
  const [desde, setDesde] = useState(iniciales.desde);
  const [hasta, setHasta] = useState(iniciales.hasta);
  const [vence, setVence] = useState(iniciales.vence);

  const [items, setItems] = useState<Item[]>([{ id: 1, desc: '', cant: '1', unidad: 'unidades', precio: '' }]);

  const [emitiendo, setEmitiendo] = useState(false);
  const [emitirMsg, setEmitirMsg] = useState<ErrorApi | null>(null);
  const [yaAutorizada, setYaAutorizada] = useState(false);

  // ---------- Borrador: se guarda solo, también sin internet ----------
  const cuentaId = cuenta.dato?.cuenta.id;
  const cuentaLista = cuenta.dato !== undefined || cuenta.estado === 'error';
  const [listo, setListo] = useState(false); // ya se recuperó (o no había) borrador
  const [guardadoEn, setGuardadoEn] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'borrador' | 'repetida' | 'error'; texto: string } | null>(null);
  const [repiteDe, setRepiteDe] = useState<number | undefined>(undefined);
  const [online, setOnline] = useState(true);
  // "Repetir todos los meses": apagado por defecto, para que facturar siga siendo simple.
  const [mensual, setMensual] = useState(false);
  const [diaMensual, setDiaMensual] = useState(() => String(Math.min(28, Number(hoyAR().slice(8, 10)))));
  const [saleSola, setSaleSola] = useState(false);
  // Si se está emitiendo una recurrente que tocaba hoy.
  const [recurrenteId, setRecurrenteId] = useState<number | null>(null);
  const arrancado = useRef(false);

  function aplicar(b: Partial<Borrador>) {
    if (b.tipo) setTipo(b.tipo);
    if (b.incluyeServicio !== undefined) setIncluyeServicio(b.incluyeServicio);
    if (b.docTipo !== undefined) setDocTipo(b.docTipo);
    if (b.cuit !== undefined) setCuit(b.cuit);
    if (b.padron !== undefined) setPadron(b.padron);
    if (b.condicionVenta) setCondicionVenta(b.condicionVenta);
    if (b.nombreExt !== undefined) setNombreExt(b.nombreExt);
    if (b.pais) setPais(b.pais);
    if (b.idImpositivo !== undefined) setIdImpositivo(b.idImpositivo);
    if (b.monedaExt) setMonedaExt(b.monedaExt);
    if (b.cotizacion) setCotizacion(b.cotizacion);
    if (b.formaPago) setFormaPago(b.formaPago);
    if (b.incoterms) setIncoterms(b.incoterms);
    if (b.email !== undefined) setEmail(b.email);
    if (b.fecha) setFecha(b.fecha);
    if (b.desde) setDesde(b.desde);
    if (b.hasta) setHasta(b.hasta);
    if (b.vence) setVence(b.vence);
    if (b.items?.length) {
      setItems(b.items);
      proximoId = Math.max(proximoId, ...b.items.map((it) => it.id + 1));
    }
    setRepiteDe(b.repiteDe);
  }

  // Al entrar: "Repetir factura" trae la original; si no, se recupera el borrador que haya quedado.
  useEffect(() => {
    if (arrancado.current || !cuentaLista) return;
    arrancado.current = true;
    if (recurrenteParam) {
      void verRecurrente(recurrenteParam).then((r) => {
        if (r.ok) {
          aplicar(borradorDePlantilla(r.dato.plantilla));
          setRecurrenteId(r.dato.id);
          setAviso({ tipo: 'repetida', texto: `Factura de todos los meses para ${r.dato.cliente}. Ya está todo cargado con las fechas de hoy: revisala y emitila.` });
        } else {
          setAviso({ tipo: 'error', texto: 'No pudimos traer la factura recurrente. Podés cargarla igual a mano.' });
        }
        setListo(true);
      });
      return;
    }
    if (repetirId) {
      void verComprobante(repetirId).then((r) => {
        if (r.ok) {
          const b = borradorDeComprobante(r.dato.comprobante);
          aplicar(b);
          setAviso({
            tipo: 'repetida',
            texto: `Estás repitiendo la factura #${String(r.dato.comprobante.numeroInterno).padStart(4, '0')}. Copiamos el cliente y el detalle; las fechas son las de hoy. Revisá el monto antes de emitir.`,
          });
        } else {
          setAviso({ tipo: 'error', texto: 'No pudimos traer la factura para repetirla. Podés cargarla igual a mano.' });
        }
        setListo(true);
      });
      return;
    }
    const b = leerBorrador(cuentaId);
    if (b && tieneContenido(b)) {
      aplicar(b);
      setGuardadoEn(b.guardadoEn);
      setAviso({ tipo: 'borrador', texto: `Recuperamos la factura que estabas armando (guardada ${cuandoSeGuardo(b.guardadoEn)}).` });
    }
    setListo(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuentaLista, cuentaId, repetirId, recurrenteParam]);

  // A cada cambio, se guarda (medio segundo después de dejar de escribir).
  useEffect(() => {
    if (!listo) return;
    const datos = {
      repiteDe, tipo, incluyeServicio, docTipo, cuit, padron, condicionVenta, nombreExt, pais, idImpositivo,
      monedaExt, cotizacion, formaPago, incoterms, email, fecha, desde, hasta, vence, items,
    };
    if (!tieneContenido(datos)) return;
    const t = setTimeout(() => {
      const cuando = guardarBorrador(datos, cuentaId);
      if (cuando) setGuardadoEn(cuando);
    }, 500);
    return () => clearTimeout(t);
  }, [listo, cuentaId, repiteDe, tipo, incluyeServicio, docTipo, cuit, padron, condicionVenta, nombreExt, pais, idImpositivo, monedaExt, cotizacion, formaPago, incoterms, email, fecha, desde, hasta, vence, items]);

  // Sin internet: se avisa y no se intenta emitir (el borrador sigue guardándose igual).
  useEffect(() => {
    const ver = () => setOnline(enLinea());
    ver();
    window.addEventListener('online', ver);
    window.addEventListener('offline', ver);
    return () => {
      window.removeEventListener('online', ver);
      window.removeEventListener('offline', ver);
    };
  }, []);

  function empezarDeCero() {
    borrarBorrador(cuentaId);
    setAviso(null);
    setGuardadoEn(null);
    setRepiteDe(undefined);
    setTipo('C');
    setIncluyeServicio(true);
    setDocTipo(80);
    setCuit('');
    setPadron(null);
    setPadronMsg(null);
    setCondicionVenta('Transferencia bancaria');
    setNombreExt('');
    setIdImpositivo('');
    setEmail('');
    setFecha(iniciales.hoy);
    setDesde(iniciales.desde);
    setHasta(iniciales.hasta);
    setVence(iniciales.vence);
    setItems([{ id: proximoId++, desc: '', cant: '1', unidad: 'unidades', precio: '' }]);
    setRecurrenteId(null);
    if (repetirId || recurrenteParam) router.replace('/app/facturas/nueva');
  }

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
    if (!enLinea()) {
      setEmitirMsg({ ok: false, estado: 0, codigo: 'sin_conexion', mensaje: 'Estás sin internet. Tu factura quedó guardada: emitila cuando vuelva la conexión.' } as ErrorApi);
      return;
    }
    if (esE) {
      // La Factura E usa WSFEX (otro web service), que todavía no integramos.
      setEmitirMsg({ ok: false, estado: 501, mensaje: 'La Factura E (exportación) se emite con el web service WSFEX de ARCA, que estamos integrando. Es parte del plan Pro.' });
      return;
    }
    if (!esCF && !padron && cuit.replace(/\D/g, '').length < 7) {
      setEmitirMsg({ ok: false, estado: 400, mensaje: 'Cargá el CUIT o DNI de tu cliente (o elegí Consumidor final).' });
      return;
    }
    if (items.some((it) => !it.desc.trim() || parseNum(it.precio) <= 0)) {
      setEmitirMsg({ ok: false, estado: 400, mensaje: 'Completá la descripción y el precio de cada ítem.' });
      return;
    }
    setEmitiendo(true);
    const receptor = esCF
      ? { docTipo: 99, docNro: '0', condicionIvaReceptorId: 5, nombre: 'Consumidor final', condicion: 'consumidor_final', email }
      : padron
        ? {
            docTipo,
            docNro: padron.cuit.replace(/\D/g, ''),
            condicionIvaReceptorId: COND_IVA_RECEPTOR[padron.condicion],
            nombre: padron.nombre,
            condicion: padron.condicion,
            domicilio: padron.domicilio,
            email,
          }
        : { docTipo, docNro: cuit.replace(/\D/g, ''), condicionIvaReceptorId: 5, condicion: 'consumidor_final', email };
    const plantilla = {
      receptor,
      concepto: (incluyeServicio ? 2 : 1) as 1 | 2,
      condicionVenta,
      items: items.map((it) => ({ descripcion: it.desc, cantidad: parseNum(it.cant), unidad: it.unidad, precioUnitario: parseNum(it.precio) })),
    };
    const res = await emitirFactura({
      ...plantilla,
      fecha: isoFecha(fecha),
      periodoServicio: conServicio ? { desde: isoFecha(desde), hasta: isoFecha(hasta), vencimientoPago: isoFecha(vence) } : undefined,
      recurrenteId: recurrenteId ?? undefined,
    });
    if (res.ok) {
      borrarBorrador(cuentaId);
      let extra = '';
      if (mensual && !recurrenteId) {
        const r = await crearRecurrente({ plantilla, dia: Number(diaMensual), automatica: saleSola });
        extra = r.ok ? '&recurrente=creada' : r.codigo === 'limite_plan' ? '&recurrente=limite' : '&recurrente=error';
      }
      setEmitiendo(false);
      router.push(`/app/facturas/emitida?id=${res.dato.id}${extra}`);
      return;
    }
    setEmitiendo(false);
    if (res.codigo === 'no_guardado') {
      borrarBorrador(cuentaId);
      // ARCA ya la autorizó: no hay que reintentar. Mostramos el aviso y bloqueamos el botón.
      setEmitirMsg(res);
      setYaAutorizada(true);
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
          <h1 className="mt-1 text-[28px] font-bold leading-tight sm:text-[34px]">Nueva factura</h1>
        </div>
        <span className="inline-flex items-center gap-2.5 rounded-input bg-primario-suave px-4 py-2.5 font-bold text-primario-oscuro">
          <span className="rounded-lg bg-primario px-2.5 py-0.5 text-white">{tipo}</span>
          {esE ? 'Factura E · Exportación' : `Factura C · Punto de venta ${puntoVenta}`}
        </span>
      </div>

      {!online && (
        <div role="status" className="aviso-entra flex items-start gap-3 rounded-[18px] bg-aviso-suave px-4 py-3.5 text-aviso-texto sm:px-5">
          <Icon name="alerta" size={22} className="mt-0.5 flex-none" />
          <p>
            <strong>Estás sin internet.</strong> No te preocupes: lo que cargás se sigue guardando en este dispositivo. Cuando vuelva la conexión, emitís.
          </p>
        </div>
      )}
      {aviso && (
        <div
          role="status"
          className={`aviso-entra flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[18px] px-4 py-3.5 sm:px-5 ${
            aviso.tipo === 'error' ? 'bg-error-suave text-error' : 'bg-primario-suave text-primario-oscuro'
          }`}
        >
          <Icon name={aviso.tipo === 'repetida' ? 'copiar' : aviso.tipo === 'error' ? 'alerta' : 'reloj'} size={22} className="flex-none" />
          <p className="min-w-0 flex-[1_1_280px] font-semibold">{aviso.texto}</p>
          {aviso.tipo !== 'error' && (
            <button type="button" onClick={empezarDeCero} className="h-10 rounded-full bg-white px-4 font-bold text-texto shadow-chip">
              Empezar de cero
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          {/* Tipo de comprobante */}
          <section className="flex flex-col gap-4 rounded-tarjeta bg-superficie p-7 shadow-tarjeta">
            <div>
              <h2 className="text-[20px] font-bold">Tipo de comprobante</h2>
              <p className="hidden text-base text-texto-suave sm:block">Según tu condición (monotributo) podés emitir C y E. Cada tipo pide solo los datos que le corresponden.</p>
            </div>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
              {TIPOS.filter((t) => t.hab).map((t) => {
                const on = t.id === tipo;
                return (
                  <button
                    key={t.id}
                    type="button"
                    title={t.detalle}
                    aria-pressed={on}
                    onClick={() => setTipo(t.id as Tipo)}
                    className={`flex items-center gap-3 rounded-[16px] border-2 p-3.5 text-left transition-colors hover:border-primario ${
                      on ? 'border-primario bg-[#F4F4FF]' : 'border-[#E1E5EE] bg-white'
                    }`}
                  >
                    <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-[12px] font-mono text-xl font-semibold ${t.letra === 'E' ? 'bg-acento text-texto' : on ? 'bg-primario text-white' : 'bg-primario-suave text-primario-oscuro'}`}>{t.letra}</span>
                    <span className="min-w-0">
                      <strong className="block">{t.nombre}</strong>
                      <span className="text-texto-tenue">{t.nota}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {TIPOS.some((t) => !t.hab) && (
              <div className="flex flex-wrap items-center gap-2 text-texto-tenue">
                <span>Próximamente:</span>
                {TIPOS.filter((t) => !t.hab).map((t) => (
                  <span key={t.id} title={t.detalle} className="inline-flex h-8 items-center rounded-full bg-fondo px-3 font-semibold text-texto-suave">
                    {t.nombre}
                  </span>
                ))}
              </div>
            )}
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
                    <button type="button" onClick={buscar} disabled={buscando} className="btn-lift flex h-11 items-center gap-2 rounded-full bg-primario px-5 text-base font-bold text-white disabled:opacity-60 shadow-boton">
                      <Lupa />{buscando ? 'Buscando…' : 'Buscar en ARCA'}
                    </button>
                  </div>
                )}

                {esCF ? (
                  <p className="rounded-[18px] bg-fondo px-5 py-4 text-base text-texto-suave">Consumidor final. Solo se pide identificación cuando la factura es de <strong>$10.000.000</strong> o más.</p>
                ) : padron ? (
                  <div className="grid gap-4 rounded-[18px] bg-fondo p-5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                    <div className="col-span-full flex items-center gap-2 text-base font-bold text-exito-texto"><Tilde />Encontrado en el padrón de ARCA</div>
                    <div><div className="text-base text-texto-tenue">Nombre / Razón social</div><strong>{padron.nombre}</strong></div>
                    <div><div className="text-base text-texto-tenue">Condición frente al IVA</div><strong>{COND_LABEL[padron.condicion]}{padron.categoriaMonotributo ? ` · ${padron.categoriaMonotributo}` : ''}</strong></div>
                    {padron.domicilio && <div><div className="text-base text-texto-tenue">Domicilio</div><strong>{padron.domicilio}</strong></div>}
                  </div>
                ) : padronMsg ? (
                  <Aviso res={padronMsg} />
                ) : (
                  <p className="hidden rounded-[18px] bg-fondo px-5 py-4 text-base text-texto-suave sm:block">Escribí el CUIT y tocá <strong>Buscar en ARCA</strong> para traer los datos del cliente y su condición frente al IVA.</p>
                )}

                <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                  <label className={labelCls}>Email para enviarle la factura<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="cliente@ejemplo.com" /></label>
                  <label className={labelCls}>Condición de venta<Select ariaLabel="Condición de venta" value={condicionVenta} onChange={setCondicionVenta} options={CONDICIONES_VENTA} /></label>
                </div>
              </>
            ) : (
              // Receptor del exterior (Factura E)
              <>
                <div className="flex items-start gap-2 rounded-[14px] bg-aviso-suave px-4 py-3 text-base font-semibold text-aviso-texto">
                  <Tilde color="#6B4600" />El cliente del exterior no está en el padrón de ARCA: cargá sus datos a mano.
                </div>
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                  <label className={labelCls}>Nombre / Razón social del exterior<input type="text" value={nombreExt} onChange={(e) => setNombreExt(e.target.value)} className={inputCls} placeholder="Acme Corp." /></label>
                  <label className={labelCls}>País de destino<Select ariaLabel="País de destino" value={pais} onChange={setPais} options={paises().map((p) => p.nombre)} /></label>
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
                <span className="text-base font-semibold">Concepto</span>
                <span className="inline-flex items-center gap-2 self-start rounded-input bg-primario-suave px-4 py-2.5 text-base font-bold text-primario-oscuro">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                  Servicios · Exportación
                </span>
                <span className="text-base text-texto-tenue">La Factura E es por exportación de servicios: el período va en la descripción de cada ítem.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <span className="text-base font-semibold">¿Es un servicio?</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={incluyeServicio}
                  onClick={() => setIncluyeServicio((v) => !v)}
                  className="flex items-center gap-3 self-start"
                >
                  <span className={`relative h-6 w-11 flex-none rounded-full transition-colors ${incluyeServicio ? 'bg-primario' : 'bg-[#D6DBE7]'}`}>
                    {/* Se mueve con transform (no con left) para no recalcular el diseño en cada cuadro. */}
                    <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-mover ${incluyeServicio ? 'translate-x-5' : 'translate-x-0'}`} />
                  </span>
                  <span className="font-semibold text-texto">{incluyeServicio ? 'Sí, cobro por un período de trabajo' : 'No, vendo productos'}</span>
                </button>
                <span className="hidden text-base text-texto-tenue sm:block">Si está activado, sumamos el período facturado (desde/hasta). Apagalo si vendés productos. Los ítems los agregás abajo como más te convenga.</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-3 gap-y-4 [&>*]:min-w-0 sm:gap-4 lg:[grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
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
              <span className="text-base font-semibold">Detalle</span>
              <div className="@container">
              {/* Con poco ancho cada ítem es una tarjeta con los campos apilados; si entra, una tabla. */}
              <div className="flex flex-col gap-3 @min-[620px]:hidden">
                {items.map((it, i) => (
                  <div key={it.id} className="flex flex-col gap-3 rounded-[18px] border-[1.5px] border-[#E6E9F1] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold">Ítem {i + 1}</span>
                      <button type="button" onClick={() => quitar(it.id)} aria-label="Quitar ítem" disabled={items.length === 1} className="rounded-lg p-2 text-texto-tenue transition-colors hover:bg-fondo hover:text-[#D9466F] disabled:opacity-30">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                      </button>
                    </div>
                    <label className="flex flex-col gap-1.5 font-semibold">
                      Descripción
                      <input type="text" value={it.desc} onChange={(e) => actualizar(it.id, 'desc', e.target.value)} className={inputCls} placeholder="Ej: Diseño de logo" />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex min-w-0 flex-col gap-1.5 font-semibold">
                        Cantidad
                        <input type="text" inputMode="decimal" value={it.cant} onChange={(e) => actualizar(it.id, 'cant', e.target.value)} className={inputCls} />
                      </label>
                      <div className="flex min-w-0 flex-col gap-1.5 font-semibold">
                        Unidad
                        <Select ariaLabel="Unidad de medida" value={it.unidad} onChange={(v) => actualizar(it.id, 'unidad', v)} options={UNIDADES} />
                      </div>
                    </div>
                    <label className="flex flex-col gap-1.5 font-semibold">
                      Precio unitario
                      <input type="text" inputMode="decimal" value={it.precio} onChange={(e) => actualizar(it.id, 'precio', e.target.value)} onBlur={(e) => actualizar(it.id, 'precio', e.target.value.trim() ? fmtNum(parseNum(e.target.value)) : '')} className={inputCls} placeholder="0,00" />
                    </label>
                    <div className="flex items-center justify-between border-t border-dashed border-borde pt-3">
                      <span className="text-texto-suave">Subtotal</span>
                      <span className="font-bold tabular-nums">{fmt(parseNum(it.cant) * parseNum(it.precio), simboloMoneda)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-y-hidden overflow-x-auto @min-[620px]:block">
                <table className="w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-left text-base text-texto-tenue">
                      <th className="px-1 pb-1">Descripción</th>
                      <th className="w-[80px] px-1 pb-1">Cant.</th>
                      <th className="w-[130px] px-1 pb-1">U. medida</th>
                      <th className="w-[140px] px-1 pb-1">Precio unit.</th>
                      <th className="w-[130px] px-1 pb-1 text-right">Subtotal</th>
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
                        <td className="whitespace-nowrap px-1 text-right align-middle font-bold">{fmt(parseNum(it.cant) * parseNum(it.precio), simboloMoneda)}</td>
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
              </div>
              <button type="button" onClick={agregar} className="flex items-center gap-2 self-start rounded-input border-[1.5px] border-dashed border-[#B9BED3] px-[18px] py-3 text-base font-bold text-primario-oscuro transition-colors hover:border-primario hover:bg-fondo">
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
            {/* El total en su propia línea y sin cortar: con USD y montos grandes no entra al lado de "Total". */}
            <div className="@container flex flex-col gap-0.5 border-t-[1.5px] border-dashed border-borde pt-3.5">
              <strong>Total</strong>
              <span className="whitespace-nowrap text-right font-display text-[26px] font-semibold tabular-nums @[260px]:text-[32px]">{fmt(total, simboloMoneda)}</span>
            </div>
            {emitirMsg && <Aviso res={emitirMsg} />}
            <button type="button" onClick={emitir} disabled={emitiendo || yaAutorizada || !online} className="btn-lift flex h-12 items-center justify-center gap-2 rounded-full bg-primario text-base font-bold text-white shadow-boton disabled:opacity-60">
              {emitiendo ? (<><Girando />Emitiendo en ARCA…</>) : mensual && !recurrenteId ? `Emitir y repetir cada mes` : `Emitir y enviar Factura ${tipo}`}
            </button>
            {!recurrenteId && !esE && (
              <div className="flex flex-col gap-3 rounded-[16px] bg-fondo p-4">
                <button type="button" role="switch" aria-checked={mensual} onClick={() => setMensual((v) => !v)} className="flex items-center justify-between gap-3 text-left">
                  <span className="flex flex-col">
                    <span className="font-semibold">Repetir todos los meses</span>
                    <span className="text-texto-tenue">Te la preparo cada mes</span>
                  </span>
                  <span className={`relative h-6 w-11 flex-none rounded-full transition-colors ${mensual ? 'bg-primario' : 'bg-[#D6DBE7]'}`}>
                    <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-mover ${mensual ? 'translate-x-5' : 'translate-x-0'}`} />
                  </span>
                </button>
                {mensual && (
                  <div className="aparece flex flex-col gap-3 border-t border-[#E3E7F0] pt-3">
                    <label className="flex items-center justify-between gap-3 font-semibold">
                      El día
                      <span className="w-[110px]">
                        <Select ariaLabel="Día del mes" value={diaMensual} onChange={setDiaMensual} options={DIAS} />
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input type="checkbox" checked={saleSola} onChange={(e) => setSaleSola(e.target.checked)} className="mt-1 h-5 w-5 flex-none accent-primario" />
                      <span className="flex flex-col">
                        <span className="font-semibold">Que salga sola</span>
                        <span className="text-texto-tenue">{saleSola ? 'Facti la emite en ARCA ese día, sin preguntarte.' : 'Si no, te aviso ese día y la emitís con un toque.'}</span>
                      </span>
                    </label>
                  </div>
                )}
              </div>
            )}
            <p className="flex items-start justify-center gap-2 text-center text-texto-tenue" aria-live="polite">
              {guardadoEn ? (
                <>
                  <Icon name="check-circulo" size={18} className="mt-[3px] flex-none text-exito" />
                  Guardado {cuandoSeGuardo(guardadoEn)}
                </>
              ) : (
                'Se guarda solo mientras cargás, aunque se corte internet.'
              )}
            </p>
          </div>

          <div className="flex items-center gap-3.5 rounded-tarjeta bg-texto p-[22px] text-white">
            <Facti pose="factura" size={110} animated={false} />
            <p className="text-base font-semibold leading-snug">
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
