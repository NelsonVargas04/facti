import Link from 'next/link';
import { Facti } from '@/components/Facti';
import { Stepper } from '@/components/Stepper';
import { CopiarCuit } from '@/components/CopiarCuit';

// Placeholder: reemplazar por el CUIT real de Facti cuando esté definido.
const CUIT_FACTI = '[CUIT DE FACTI]';

function Tilde({ size = 16, color = '#1E9E63' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

const PASOS_ARCA = [
  { t: 'Entrá a ARCA con tu CUIT y clave fiscal nivel 3.', d: null },
  { t: 'Abrí el "Administrador de Relaciones de Clave Fiscal".', d: 'Está en "Mis servicios".' },
  { t: 'Tocá "Nueva relación" y elegí ARCA › WebServices.', d: 'Hacelo una vez por cada servicio de la lista de abajo.' },
  { t: 'En "Representante", pegá el CUIT de Facti y confirmá.', d: 'ARCA te muestra el formulario 3283 como constancia.' },
];

const SERVICIOS = [
  { nombre: 'Facturación Electrónica', desc: 'Facturas, notas de crédito y débito A, B, C y M', estado: 'Autorizado', clase: 'bg-exito-suave text-exito-texto', check: true },
  { nombre: 'Factura de Exportación', desc: 'Factura E, si vendés al exterior', estado: 'Falta autorizar', clase: 'bg-aviso-suave text-aviso-texto', check: false },
  { nombre: 'Factura de Crédito Electrónica MiPyME', desc: 'Solo si le vendés a empresas grandes', estado: 'Opcional', clase: 'bg-[#EEF0F5] text-[#3C4268]', check: false },
];

export default function AutorizarArca() {
  return (
    <>
      <Stepper actual={3} />

      <div className="flex flex-wrap items-start gap-7">
        <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-[22px] rounded-tarjeta bg-superficie p-9 shadow-tarjeta">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-extrabold tracking-[0.06em] text-texto-tenue">PASO 3 DE 5</span>
            <h1 className="text-[34px] font-bold leading-tight">Autorizá a Facti para facturar por vos</h1>
            <p className="text-[17px] text-texto-suave">
              Se hace una sola vez en la web de ARCA. <strong className="text-texto">Nunca te vamos a pedir tu clave fiscal</strong>: solo le decís a ARCA que Facti puede emitir comprobantes en tu nombre, y podés quitarle el permiso cuando quieras.
            </p>
          </div>

          <ol className="flex flex-col gap-3.5">
            {PASOS_ARCA.map((p, i) => (
              <li key={i} className="flex gap-3.5">
                <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[10px] bg-primario-suave font-extrabold text-primario-oscuro">{i + 1}</span>
                <span>
                  <strong className="block">{p.t}</strong>
                  {p.d && <span className="text-[15px] text-texto-suave">{p.d}</span>}
                </span>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-center justify-between gap-3.5 rounded-[18px] bg-fondo px-5 py-[18px]">
            <div>
              <div className="text-[13px] font-extrabold text-texto-tenue">CUIT DE FACTI (REPRESENTANTE)</div>
              <div className="font-display text-[26px] font-bold tracking-wide">{CUIT_FACTI}</div>
            </div>
            <CopiarCuit value={CUIT_FACTI} />
          </div>

          <div>
            <h2 className="mb-1 text-[20px] font-bold">Servicios a autorizar</h2>
            {SERVICIOS.map((s) => (
              <div key={s.nombre} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EDF0F6] py-3.5">
                <div>
                  <strong>{s.nombre}</strong>
                  <div className="text-sm text-texto-suave">{s.desc}</div>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-extrabold ${s.clase}`}>
                  {s.check && <Tilde size={16} color="#0E5C38" />}
                  {s.estado}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <a href="https://www.arca.gob.ar" target="_blank" rel="noopener noreferrer" className="btn-lift flex h-[52px] items-center gap-2 rounded-full border-[1.5px] border-borde bg-white px-6 font-extrabold text-texto">
              Abrir ARCA
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
            </a>
            <Link href="/app" className="btn-lift flex h-[52px] items-center rounded-full bg-primario px-7 font-extrabold text-white shadow-boton">Verificar y seguir</Link>
          </div>
        </section>

        <aside className="flex min-w-0 flex-1 basis-[320px] flex-col gap-5">
          <div className="flex flex-col items-center gap-2 rounded-tarjeta bg-superficie p-7 text-center shadow-tarjeta">
            <div className="f-pop rounded-[20px_20px_20px_6px] bg-texto px-4 py-3 text-[15px] font-extrabold leading-snug text-white">
              Tranqui, te acompaño.<br /><span className="text-acento">Yo reviso que quede bien.</span>
            </div>
            <Facti pose="senalando" size={190} animated={false} />
          </div>
          <div className="flex flex-col gap-2.5 rounded-tarjeta bg-superficie p-7 shadow-tarjeta">
            <h2 className="text-[18px] font-bold">Lo que sigue: tu punto de venta</h2>
            <p className="text-[15px] text-texto-suave">En el próximo paso creamos juntos un punto de venta de tipo <strong className="text-texto">"Factura electrónica - Monotributo - Web Services"</strong>. Si ARCA ya te habilitó uno, lo detectamos.</p>
          </div>
          <div className="flex flex-col gap-2.5 rounded-tarjeta bg-superficie p-7 shadow-tarjeta">
            <div className="flex items-center gap-2 text-sm font-extrabold text-exito-texto"><Tilde />Tu perfil</div>
            <strong>Fernández Lucía · CUIT 27-31456789-4</strong>
            <span className="text-[15px] text-texto-suave">Monotributo, categoría C · Servicios</span>
          </div>
        </aside>
      </div>
    </>
  );
}
