'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Facti } from '@/components/Facti';
import { ComprobanteC, type DatosComprobanteC } from '@/components/ComprobanteC';

interface Receptor {
  cuit: string;
  nombre: string;
  condicionIva: string;
  domicilio: string;
  condicionVenta: string;
}
interface FacturaGuardada {
  letra: string;
  puntoVenta: number;
  numero: number;
  cae: string;
  vencimientoCae?: string; // AAAA-MM-DD
  total: number;
  fecha: string; // AAAA-MM-DD
  qr: string;
  clienteNombre: string;
  receptor?: Receptor;
  periodo?: { desde: string; hasta: string; vtoPago: string } | null;
  items?: { descripcion: string; cantidad: number; unidad?: string; precioUnitario: number }[];
}

// Emisor: perfil fijo por ahora (hasta tener el perfil real del usuario).
const EMISOR = {
  razonSocial: 'FERNÁNDEZ LUCÍA',
  domicilio: 'Av. Rivadavia 5100, Piso 3 B - CABA',
  cuit: '27314567894',
  ingresosBrutos: '27314567894',
  inicioActividades: '01/03/2019',
};

const DEMO: FacturaGuardada = {
  letra: 'C',
  puntoVenta: 3,
  numero: 128,
  cae: '76419283746521',
  vencimientoCae: '2026-10-22',
  total: 85000,
  fecha: '2026-10-12',
  qr: 'https://www.arca.gob.ar/fe/qr/?p=ejemplo',
  clienteNombre: 'Estudio Lumen SRL',
  receptor: {
    cuit: '30715896327',
    nombre: 'ESTUDIO LUMEN SRL',
    condicionIva: 'IVA Responsable Inscripto',
    domicilio: 'Av. Corrientes 1234 - CABA',
    condicionVenta: 'Transferencia bancaria',
  },
  periodo: { desde: '01/10/2026', hasta: '31/10/2026', vtoPago: '24/10/2026' },
  items: [
    { descripcion: 'Diseño de logo e identidad', cantidad: 1, unidad: 'unidades', precioUnitario: 70000 },
    { descripcion: 'Adaptación para redes', cantidad: 3, unidad: 'unidades', precioUnitario: 5000 },
  ],
};

const nro = (pv: number, n: number) => `${String(pv).padStart(5, '0')}-${String(n).padStart(8, '0')}`;
function fecha(iso?: string) {
  if (!iso) return '—';
  if (iso.includes('/')) return iso;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
const pesos = (n: number) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2 });

function Ic({ children }: { children: React.ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export default function FacturaEmitida() {
  const [f, setF] = useState<FacturaGuardada>(DEMO);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('facti:ultima-factura');
    if (raw) {
      try {
        setF({ ...DEMO, ...(JSON.parse(raw) as FacturaGuardada) });
      } catch {
        /* usamos el demo */
      }
    }
  }, []);

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(f.qr);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* el navegador puede bloquear el portapapeles */
    }
  }

  const datos: DatosComprobanteC = {
    emisor: EMISOR,
    puntoVenta: f.puntoVenta,
    numero: f.numero,
    fechaEmision: fecha(f.fecha),
    periodo: f.periodo ?? undefined,
    receptor: f.receptor ?? {
      cuit: '',
      nombre: f.clienteNombre,
      condicionIva: 'Consumidor Final',
      domicilio: '—',
      condicionVenta: 'Contado',
    },
    items: f.items ?? [{ descripcion: 'Servicios', cantidad: 1, precioUnitario: f.total }],
    cae: f.cae,
    caeVto: fecha(f.vencimientoCae),
    qrUrl: f.qr,
  };

  const DATOS: [string, string][] = [
    ['Comprobante', `Factura ${f.letra} ${nro(f.puntoVenta, f.numero)}`],
    ['Total', pesos(f.total)],
    ['Cliente', f.clienteNombre],
    ['Fecha de emisión', fecha(f.fecha)],
    ['CAE', f.cae],
    ['Vencimiento del CAE', fecha(f.vencimientoCae)],
  ];

  return (
    <>
      <div className="flex flex-wrap items-start gap-8">
        {/* Columna izquierda */}
        <div className="flex min-w-0 flex-1 basis-[440px] flex-col gap-[22px]">
          <div className="flex items-center gap-[18px] rounded-tarjeta-lg bg-exito-suave p-7">
            <Facti pose="festejo" size={160} animated />
            <div className="flex flex-col gap-1.5 text-exito-texto">
              <span className="flex items-center gap-1.5 text-sm font-extrabold"><Ic><path d="M5 12.5l4.5 4.5L19 7.5" /></Ic>Autorizada por ARCA</span>
              <h1 className="text-[32px] font-bold leading-tight text-texto">¡Listo! Tu factura ya es válida</h1>
              <span className="text-[15px] text-exito-texto">Y ya se la mandé a tu cliente por email.</span>
            </div>
          </div>

          <section className="grid grid-cols-2 gap-4 rounded-tarjeta bg-superficie p-7 shadow-tarjeta">
            {DATOS.map(([k, v]) => (
              <div key={k}>
                <div className="text-[13px] text-texto-tenue">{k}</div>
                <strong className="break-words">{v}</strong>
              </div>
            ))}
          </section>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => window.print()} className="btn-lift flex h-[52px] items-center gap-2.5 rounded-[16px] bg-primario px-5 font-extrabold text-white shadow-boton">
              <Ic><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></Ic>Descargar PDF
            </button>
            <button type="button" className="btn-lift flex h-[52px] items-center gap-2.5 rounded-[16px] border-[1.5px] border-borde bg-white px-5 font-extrabold text-texto">
              <Ic><path d="M4 20l1.5-4.5A8 8 0 1 1 9 19z" /></Ic>Enviar por WhatsApp
            </button>
            <button type="button" className="btn-lift flex h-[52px] items-center gap-2.5 rounded-[16px] border-[1.5px] border-borde bg-white px-5 font-extrabold text-texto">
              <Ic><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 8l9 6 9-6" /></Ic>Reenviar email
            </button>
            <button type="button" onClick={copiarLink} className="btn-lift flex h-[52px] items-center gap-2.5 rounded-[16px] border-[1.5px] border-borde bg-white px-5 font-extrabold text-texto">
              <Ic><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></Ic>
              {copiado ? '¡Link copiado!' : 'Copiar link'}
            </button>
          </div>

          <section className="flex flex-col gap-3.5 rounded-tarjeta bg-superficie p-7 shadow-tarjeta">
            <h2 className="text-[20px] font-bold">¿Qué querés hacer ahora?</h2>
            <div className="flex flex-wrap gap-3">
              <Link href="/app" className="flex-1 basis-[200px] rounded-[16px] bg-fondo p-4 transition-colors hover:bg-primario-suave">
                <strong className="block">Registrar el cobro</strong>
                <span className="text-sm text-texto-suave">Cuando te paguen, marcala como cobrada</span>
              </Link>
              <Link href="/app/facturas/nueva" className="flex-1 basis-[200px] rounded-[16px] bg-fondo p-4 transition-colors hover:bg-primario-suave">
                <strong className="block">Emitir otra factura</strong>
                <span className="text-sm text-texto-suave">Con los mismos datos o para otro cliente</span>
              </Link>
            </div>
            <p className="text-sm text-texto-suave">Guardamos el PDF y la respuesta de ARCA durante 10 años. También podés verificarla en ARCA escaneando el QR.</p>
          </section>
        </div>

        {/* Columna derecha: vista previa en formato oficial */}
        <div className="flex flex-[0_1_460px] flex-col gap-2.5">
          <span className="text-[13px] font-extrabold tracking-[0.06em] text-texto-tenue">VISTA PREVIA DEL PDF (FORMATO OFICIAL)</span>
          <div className="overflow-hidden rounded-xl shadow-tarjeta-lg" style={{ width: 445, height: 629 }}>
            <div style={{ width: 794, transformOrigin: 'top left', transform: 'scale(0.56)' }}>
              <ComprobanteC datos={datos} />
            </div>
          </div>
          <button type="button" onClick={() => window.print()} className="self-start text-[15px] font-extrabold text-primario-oscuro transition-colors hover:text-texto">Descargar / imprimir PDF →</button>
        </div>
      </div>

      {/* Copia a página completa, solo visible al imprimir */}
      <div id="comprobante-print" className="absolute left-[-99999px] top-0">
        <ComprobanteC datos={datos} />
      </div>
    </>
  );
}
