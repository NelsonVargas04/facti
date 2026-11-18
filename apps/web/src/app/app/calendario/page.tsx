'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AvisoApi } from '@/components/AvisoApi';
import { Facti } from '@/components/Facti';
import { Icon, type IconName } from '@/components/Icon';
import { siApple, siGooglecalendar, type SimpleIcon } from 'simple-icons';
import { enlaceCalendario, verCalendario, type EventoCalendario } from '@/lib/api';
import { hoyAR } from '@/lib/formato';
import { useApi } from '@/lib/useApi';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_SEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** Cómo se ve cada tipo de evento. */
const ESTILO: Record<string, { icono: IconName; tono: string; etiqueta: string }> = {
  cuota_monotributo: { icono: 'monotributo', tono: 'bg-primario-suave text-primario-oscuro', etiqueta: 'Monotributo' },
  recategorizacion: { icono: 'alerta', tono: 'bg-aviso-suave text-aviso-texto', etiqueta: 'Recategorización' },
  nueva_escala: { icono: 'info', tono: 'bg-fondo text-texto-suave', etiqueta: 'Escala nueva' },
  factura_mensual: { icono: 'factura', tono: 'bg-[#EAF8F0] text-[#0E5C38]', etiqueta: 'Factura del mes' },
  cobro: { icono: 'cobros', tono: 'bg-[#FFF1E6] text-[#9A4A00]', etiqueta: 'Cobro' },
};

function diasHasta(fecha: string): number {
  const a = new Date(`${hoyAR()}T12:00:00Z`).getTime();
  const b = new Date(`${fecha}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

function cuando(fecha: string): string {
  const d = diasHasta(fecha);
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Mañana';
  return `En ${d} días`;
}

function Evento({ e }: { e: EventoCalendario }) {
  const est = ESTILO[e.tipo] ?? ESTILO.nueva_escala!;
  const f = new Date(`${e.fecha}T12:00:00Z`);
  const cerca = diasHasta(e.fecha) <= 3;
  const contenido = (
    <>
      <span className={`flex w-14 flex-none flex-col items-center rounded-[14px] py-1.5 ${cerca ? 'bg-texto text-white' : 'bg-fondo text-texto'}`}>
        <span className="font-display text-[22px] font-bold leading-none tabular-nums">{f.getUTCDate()}</span>
        <span className={cerca ? 'text-white/80' : 'text-texto-tenue'}>{DIAS_SEM[f.getUTCDay()]}</span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold ${est.tono}`}>
            <Icon name={est.icono} size={16} />
            {est.etiqueta}
          </span>
          <span className={`font-semibold ${cerca ? 'text-error' : 'text-texto-tenue'}`}>{cuando(e.fecha)}</span>
        </div>
        <strong className="text-[17px] leading-snug">{e.titulo}</strong>
        <span className="text-texto-suave">{e.detalle}</span>
      </div>
      {e.link && <Icon name="chevron-derecha" size={20} className="mt-1 flex-none text-texto-tenue transition-transform group-hover:translate-x-0.5" />}
    </>
  );
  const cls = 'group flex items-start gap-4 rounded-[18px] p-3 transition-colors sm:p-4';
  return e.link ? (
    <Link href={e.link} className={`${cls} hover:bg-fondo`}>
      {contenido}
    </Link>
  ) : (
    <div className={cls}>{contenido}</div>
  );
}

/** Logo oficial de la app (simple-icons, CC0), en su color. */
function LogoApp({ icono }: { icono: SimpleIcon }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={24} height={24} fill={`#${icono.hex}`} className="flex-none">
      <path d={icono.path} />
    </svg>
  );
}

/** "Agregalo a tu calendario": suscripción con el link privado (.ics). */
function Suscribirse() {
  const enlace = useApi(() => enlaceCalendario(), []);
  const [copiado, setCopiado] = useState(false);
  const [renovando, setRenovando] = useState(false);
  const url = enlace.dato?.url;
  const webcal = url?.replace(/^https?:/, 'webcal:');

  async function copiar() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* el navegador puede bloquear el portapapeles */
    }
  }
  async function renovar() {
    setRenovando(true);
    const r = await enlaceCalendario(true);
    setRenovando(false);
    if (r.ok) enlace.setDato(r.dato);
  }

  const botonIcono =
    'btn-lift flex h-12 w-12 flex-none items-center justify-center rounded-full border-[1.5px] border-borde bg-white hover:border-primario';
  const boton = 'btn-lift inline-flex h-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-borde bg-white px-5 font-bold text-texto hover:border-primario hover:text-primario-oscuro';
  return (
    <section className="aparece flex flex-col gap-3 rounded-tarjeta bg-superficie p-5 shadow-tarjeta sm:p-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-[1_1_320px] items-start gap-3">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-primario-suave text-primario-oscuro">
          <Icon name="calendario" size={22} />
        </span>
        <div>
          <h2 className="text-[20px] font-bold">Tenelo en tu calendario</h2>
          <p className="text-texto-suave">Suscribite una vez y se actualiza solo. Te avisa el día antes de pagar.</p>
        </div>
      </div>
      {enlace.estado === 'error' && !url ? (
        <AvisoApi error={enlace.error} onReintentar={enlace.recargar} compacto />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {/* Solo el logo de cada app; el nombre va en el tooltip y para lectores de pantalla. */}
          <a
            href={webcal ? `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!url}
            aria-label="Agregar a Google Calendar"
            title="Google Calendar"
            className={`${botonIcono} ${!url ? 'pointer-events-none opacity-50' : ''}`}
          >
            <LogoApp icono={siGooglecalendar} />
          </a>
          <a
            href={webcal}
            aria-disabled={!url}
            aria-label="Agregar al calendario del iPhone o la Mac"
            title="iPhone o Mac"
            className={`${botonIcono} ${!url ? 'pointer-events-none opacity-50' : ''}`}
          >
            <LogoApp icono={siApple} />
          </a>
          <a
            href={url ? `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(url)}&name=Facti` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!url}
            aria-label="Agregar a Outlook"
            title="Outlook"
            className={`${botonIcono} ${!url ? 'pointer-events-none opacity-50' : ''}`}
          >
            <Icon name="calendario" size={26} className="text-[#0F6CBD]" />
          </a>
          <button type="button" onClick={copiar} disabled={!url} className={boton}>
            <Icon name={copiado ? 'check' : 'copiar'} size={18} />
            {copiado ? '¡Link copiado!' : 'Copiar link'}
          </button>
        </div>
      )}
      </div>
      <p className="text-texto-tenue">
        El link es privado: quien lo tenga ve tus vencimientos.{' '}
        <button type="button" onClick={renovar} disabled={renovando} className="font-semibold text-texto-suave underline underline-offset-2 hover:text-texto">
          {renovando ? 'Renovando…' : 'Renovar el link'}
        </button>{' '}
        si lo compartiste sin querer.
      </p>
    </section>
  );
}

export default function Calendario() {
  const [dias, setDias] = useState(90);
  const cal = useApi(() => verCalendario(dias), [dias]);
  const ev = cal.dato?.eventos;

  // Agrupados por mes.
  const grupos: { mes: string; eventos: EventoCalendario[] }[] = [];
  for (const e of ev ?? []) {
    const [a, m] = e.fecha.split('-');
    const mes = `${MESES[Number(m) - 1]} ${a}`;
    const g = grupos.at(-1);
    if (g && g.mes === mes) g.eventos.push(e);
    else grupos.push({ mes, eventos: [e] });
  }

  return (
    <>
      <div className="aparece">
        <h1 className="text-[28px] font-bold leading-tight sm:text-[34px]">Calendario</h1>
        <p className="text-texto-suave">Lo que se viene: vencimientos del monotributo, tus facturas de todos los meses y tus cobros.</p>
      </div>

      <Suscribirse />

      {!!cal.dato?.cobrosOcultos && (
        <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-tarjeta bg-texto p-5 text-white sm:p-6">
          <strong className="text-[18px]">
            {cal.dato.cobrosOcultos === 1 ? 'Tenés 1 cobro por vencer' : `Tenés ${cal.dato.cobrosOcultos} cobros por vencer`}
          </strong>
          <p className="min-w-0 flex-[1_1_220px] truncate text-[#DADCF2]">Con Pro los ves acá y te avisamos antes.</p>
          <Link href="/app/plan" className="btn-lift inline-flex h-11 items-center justify-center rounded-full bg-acento px-5 font-bold text-texto">
            Ver Pro
          </Link>
        </section>
      )}

      <section className="flex min-w-0 flex-col gap-2 rounded-tarjeta bg-superficie p-3 shadow-tarjeta sm:p-4">
        {cal.estado === 'error' && !ev && (
          <div className="p-3">
            <AvisoApi error={cal.error} onReintentar={cal.recargar} compacto />
          </div>
        )}
        {!ev ? (
          cal.estado === 'cargando' && (
            <div className="flex flex-col gap-3 p-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-[92px] rounded-[18px]" />
              ))}
            </div>
          )
        ) : ev.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <Facti pose="durmiendo" size={110} />
            <strong className="text-[18px]">Nada por ahora</strong>
            <p className="max-w-[380px] text-texto-suave">En los próximos meses no tenés vencimientos ni facturas programadas.</p>
          </div>
        ) : (
          grupos.map((g) => (
            <div key={g.mes} className="flex flex-col">
              <h2 className="px-3 pb-1 pt-3 font-bold capitalize text-texto-tenue sm:px-4">{g.mes}</h2>
              {g.eventos.map((e, i) => (
                <Evento key={`${e.tipo}-${e.fecha}-${i}`} e={e} />
              ))}
            </div>
          ))
        )}
        {ev && dias < 365 && (
          <button type="button" onClick={() => setDias(365)} className="m-2 self-center rounded-full px-4 py-2 font-bold text-primario-oscuro hover:bg-primario-suave">
            Ver todo el año
          </button>
        )}
      </section>
    </>
  );
}
