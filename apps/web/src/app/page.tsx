import Link from 'next/link';
import { Facti } from '@/components/Facti';
import { FactiWordmark } from '@/components/FactiLogo';
import { MuestraComprobantes } from '@/components/MuestraComprobantes';
import { Reveal } from '@/components/Reveal';

function Flecha() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function Tilde({ color = '#1E9E63', size = 22 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

const SOSPECHAS = [
  { dot: '#1E9E63', rot: '-1.5deg', texto: 'Comprobantes en línea se cuelga justo cuando tengo que facturar a fin de mes.' },
  { dot: '#3B3FD8', rot: '1deg', texto: 'Nunca sé si a este cliente le tengo que hacer factura A o B.' },
  { dot: '#E0A100', rot: '1.5deg', texto: 'Me enteré tarde de que tenía que recategorizarme.' },
  { dot: '#D9466F', rot: '-1deg', texto: 'Paso horas copiando el CUIT y los datos de cada cliente.' },
];

const PASOS = [
  {
    bg: '#ECEDFF', fg: '#2A2DB0', n: 1, titulo: 'Conectá tu CUIT', chip: 'Una sola vez',
    texto: (<>Desde ARCA autorizás a Facti a facturar por vos, con nuestra guía paso a paso. <strong className="font-bold text-texto">Tu clave fiscal nunca pasa por Facti</strong>.</>),
    icon: (<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>),
  },
  {
    bg: '#FFF3D1', fg: '#8A5A00', n: 2, titulo: 'Facturá en segundos', chip: 'Menos de 1 minuto',
    texto: (<>Ponés el CUIT de tu cliente y Facti trae sus datos y <strong className="font-bold text-texto">elige si es A, B o C</strong>. Vos solo cargás el monto.</>),
    icon: (<><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h5" /></>),
  },
  {
    bg: '#D7F5E6', fg: '#0E5C38', n: 3, titulo: 'Cobrá tranquilo', chip: 'Al instante',
    texto: (<>ARCA la autoriza con CAE y QR y se la mandás al cliente. <strong className="font-bold text-texto">Ves qué te pagaron y qué falta</strong>.</>),
    icon: (<><path d="M4 19V5M4 19h16" /><path d="M8 15l4-4 3 3 5-6" /></>),
  },
];

export default function Landing() {
  return (
    <div className="overflow-hidden text-[17px] leading-relaxed">
      {/* Header */}
      <header className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-5 px-8 py-7">
        <Link href="/" aria-label="Facti inicio" className="btn-lift">
          <FactiWordmark size={38} />
        </Link>
        <nav aria-label="Principal" className="flex flex-wrap gap-7 text-[15px] font-semibold text-texto-suave">
          <a href="#como" className="transition-colors hover:text-texto">Cómo funciona</a>
          <a href="#comprobantes" className="transition-colors hover:text-texto">Comprobantes</a>
          <a href="#monotributo" className="transition-colors hover:text-texto">Monotributo</a>
          <a href="#precios" className="transition-colors hover:text-texto">Precios</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/registro" className="px-4 py-3 text-[15px] font-bold text-texto transition-colors hover:text-primario">Iniciar sesión</Link>
          <Link href="/registro" className="btn-lift rounded-full bg-primario px-6 py-3 text-[15px] font-extrabold text-white shadow-[0_8px_20px_rgba(59,63,216,0.25)] hover:shadow-[0_12px_28px_rgba(59,63,216,0.38)]">
            Empezar gratis
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section id="inicio" className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-14 px-8 pb-24 pt-12">
        <Reveal className="flex min-w-0 flex-1 basis-[520px] flex-col gap-7">
          <div className="flex flex-wrap gap-2.5">
            {[
              { dot: '#1E9E63', rot: '-2deg', t: 'Facturas A, B, C y E' },
              { dot: '#3B3FD8', rot: '1.5deg', t: 'Conectada con ARCA' },
              { dot: '#E0A100', rot: '-1deg', t: 'Sin instalar nada' },
            ].map((b) => (
              <span key={b.t} style={{ transform: `rotate(${b.rot})` }} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold shadow-chip">
                <span className="h-2 w-2 rounded-full" style={{ background: b.dot }} />
                {b.t}
              </span>
            ))}
          </div>
          <h1 className="text-[clamp(44px,6vw,68px)] font-bold leading-[1.12]">
            ¿Facturar en{' '}
            <span className="inline-block -rotate-2 rounded-full bg-white px-6 pb-1.5 text-primario shadow-[0_10px_30px_rgba(21,25,58,0.10)]">ARCA</span>{' '}
            te complica?
            <br />
            <span style={{ background: 'linear-gradient(transparent 58%, #FFD25E 58%, #FFD25E 92%, transparent 92%)' }} className="px-1.5">
              Facti lo hace simple.
            </span>
          </h1>
          <p className="max-w-[560px] text-[20px] text-texto-suave">
            Emití facturas electrónicas en un par de clics, conectadas directo con ARCA, y tené tu{' '}
            <strong className="text-texto">categoría de monotributo siempre bajo control</strong>. Sin pantallas confusas ni planillas.
          </p>
          <div className="flex flex-wrap gap-3.5">
            <Link href="/registro" className="btn-lift inline-flex items-center gap-2.5 rounded-full bg-primario px-8 py-4 text-[18px] font-extrabold text-white shadow-[0_12px_28px_rgba(59,63,216,0.28)] hover:shadow-[0_16px_34px_rgba(59,63,216,0.42)]">
              Quiero facturar fácil <Flecha />
            </Link>
            <a href="#como" className="btn-lift rounded-full border-[1.5px] border-borde bg-white px-8 py-4 text-[18px] font-extrabold text-texto hover:border-primario">
              Ver cómo funciona
            </a>
          </div>
        </Reveal>

        {/* Composición de la derecha */}
        <Reveal delay={140} className="relative flex min-h-[540px] min-w-0 flex-1 basis-[440px] items-center justify-center">
          <div className="absolute left-0 top-2.5 flex w-[330px] -rotate-[4deg] flex-col gap-3.5 rounded-[24px] bg-white p-6 shadow-tarjeta-lg">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-primario-suave px-3 py-1.5 text-[13px] font-extrabold text-primario-oscuro">Factura C</span>
              <span className="text-[13px] font-semibold text-texto-tenue">N° 00003-00000128</span>
            </div>
            <div>
              <div className="text-[13px] text-texto-tenue">Cliente</div>
              <div className="font-extrabold">Estudio Lumen SRL</div>
            </div>
            <div className="flex items-end justify-between border-t-[1.5px] border-dashed border-borde pt-3.5">
              <div className="text-sm text-texto-suave">Diseño de logo</div>
              <div className="font-display text-[30px] font-bold">$85.000</div>
            </div>
            <div className="flex items-center gap-2.5 rounded-input bg-exito-suave px-3.5 py-2.5 text-sm font-bold text-exito-texto">
              <Tilde color="#0E5C38" size={18} />
              <span>Autorizada por ARCA<br /><span className="text-xs font-semibold">CAE 76419283746521 · vence 24/10</span></span>
            </div>
          </div>

          <div className="absolute right-0 top-10 flex w-[230px] rotate-3 flex-col gap-2.5 rounded-[22px] bg-white p-5 shadow-tarjeta-lg">
            <div className="text-xs font-extrabold tracking-[0.06em] text-texto-tenue">MONOTRIBUTO</div>
            <div className="font-display text-[22px] font-bold">Categoría D</div>
            <div className="h-3 overflow-hidden rounded-full bg-[#ECEFF5]"><div className="h-full w-[68%] rounded-full bg-primario" /></div>
            <div className="text-[13px] text-texto-suave">68% del tope anual</div>
          </div>

          <div className="relative top-20">
            <Facti pose="saludo" size={260} animated />
          </div>

          <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 -rotate-2">
            <div className="f-pop whitespace-nowrap rounded-full bg-exito-suave px-6 py-3.5 text-[17px] font-extrabold text-exito-texto shadow-tarjeta-lg">
              ¡Factura autorizada y enviada al cliente!
            </div>
          </div>
        </Reveal>
      </section>

      {/* ¿Te suena? */}
      <section className="mx-auto flex max-w-[1100px] flex-col items-center gap-10 px-8 pb-24 pt-10">
        <Reveal as="h2" className="text-center text-[44px] font-bold">¿Te suena?</Reveal>
        <div className="flex flex-wrap justify-center gap-5">
          {SOSPECHAS.map((s, i) => (
            <Reveal key={s.texto} delay={i * 80} className="max-w-[500px] flex-1 basis-[440px]">
              <div style={{ transform: `rotate(${s.rot})` }} className="card-hover flex h-full gap-3 rounded-[22px] bg-white px-6 py-5 shadow-tarjeta">
                <span className="mt-[9px] h-[9px] w-[9px] flex-none rounded-full" style={{ background: s.dot }} />
                {s.texto}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Así de fácil funciona */}
      <section id="como" className="mx-auto flex max-w-[1200px] flex-col gap-12 px-8 pb-24 pt-10">
        <Reveal className="flex flex-col items-center gap-3 text-center">
          <h2 className="text-[44px] font-bold">Así de fácil funciona</h2>
          <p className="max-w-[620px] text-[19px] text-texto-suave">Conectás tu CUIT con ARCA una sola vez y después facturás desde la compu o el celular.</p>
        </Reveal>
        <ol className="grid items-stretch gap-6 md:grid-cols-3">
          {PASOS.map((p, i) => (
            <Reveal as="li" key={p.n} delay={i * 90} className="relative h-full">
              <div className="card-hover flex h-full flex-col gap-4 rounded-tarjeta-lg bg-white p-7 shadow-[0_10px_30px_rgba(21,25,58,0.07)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex h-14 w-14 flex-none items-center justify-center rounded-[18px]" style={{ background: p.bg, color: p.fg }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p.icon}</svg>
                    <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-texto font-display text-[13px] font-bold text-white ring-[3px] ring-white">
                      {p.n}
                    </span>
                  </div>
                  <span className="rounded-full px-3 py-1 text-[13px] font-extrabold" style={{ background: p.bg, color: p.fg }}>{p.chip}</span>
                </div>
                <h3 className="text-[23px] font-bold leading-tight">
                  <span className="sr-only">Paso {p.n}: </span>
                  {p.titulo}
                </h3>
                <p className="text-[16px] leading-[1.6] text-texto-suave">{p.texto}</p>
              </div>
              {i < PASOS.length - 1 && (
                <span aria-hidden="true" className="absolute -right-[21px] top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-primario shadow-chip md:flex">
                  <Flecha />
                </span>
              )}
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Comprobantes */}
      <section id="comprobantes" className="mx-auto flex max-w-[1200px] flex-col gap-11 px-4 pb-28 pt-10 sm:px-8">
        <Reveal className="flex flex-col items-center gap-3 text-center">
          <h2 className="text-[clamp(32px,5vw,44px)] font-bold leading-tight">Todos los comprobantes que necesitás</h2>
          <p className="max-w-[620px] text-[19px] text-texto-suave">Seas monotributista, responsable inscripto o exportador, Facti te muestra solo los que te corresponden.</p>
        </Reveal>
        <Reveal delay={80}>
          <MuestraComprobantes />
        </Reveal>
      </section>

      {/* Monotributo */}
      <section id="monotributo" className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-14 px-8 pb-28 pt-10">
        <Reveal className="flex min-w-0 flex-1 basis-[460px] flex-col gap-5">
          <span className="self-start rounded-xl bg-aviso-suave px-4 py-[7px] text-sm font-extrabold text-aviso-texto">Para monotributistas</span>
          <h2 className="text-[44px] font-bold leading-[1.15]">
            Facti cuida tu categoría{' '}
            <span style={{ fontFamily: 'var(--font-caveat), cursive' }} className="text-[54px] text-primario">como si fuera suya</span>
          </h2>
          <p className="text-[19px] text-texto-suave">Como Facti hace tus facturas, ya sabe cuánto facturaste. Te avisa antes de que te pases del tope y te recuerda cuándo recategorizarte, con los números listos.</p>
          <div className="flex flex-col gap-3 font-bold">
            {['Facturación de los últimos 12 meses', 'Alerta cuando te acercás al tope', 'Recordatorio de recategorización'].map((t) => (
              <span key={t} className="flex items-center gap-2.5"><Tilde />{t}</span>
            ))}
          </div>
        </Reveal>
        <Reveal delay={120} className="relative min-w-0 flex-1 basis-[420px] pt-[30px]">
          <div className="card-hover flex flex-col gap-5 rounded-tarjeta-lg bg-white p-[34px] shadow-tarjeta-lg">
            <div>
              <div className="text-[13px] font-extrabold tracking-[0.06em] text-texto-tenue">TU MONOTRIBUTO</div>
              <div className="font-display text-[28px] font-bold">Categoría D</div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between font-bold"><span>Facturado en 12 meses</span><span>68% del tope</span></div>
              <div className="h-4 overflow-hidden rounded-full bg-[#ECEFF5]"><div className="h-full w-[68%] rounded-full bg-primario" /></div>
              <div className="flex justify-between text-sm text-texto-suave"><span>$8.100.000</span><span>Tope: $11.900.000</span></div>
            </div>
            <div className="flex items-start gap-3 rounded-[18px] bg-aviso-suave px-[18px] py-4 font-bold text-aviso-texto">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 flex-none"><path d="M12 8v5M12 16.5v.5" /><circle cx="12" cy="12" r="9" /></svg>
              <span>La próxima recategorización vence en enero. Ya tengo tus números listos.</span>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Precios */}
      <section id="precios" className="mx-auto flex max-w-[1000px] flex-col gap-11 px-8 pb-28 pt-10">
        <Reveal className="flex flex-col items-center gap-3 text-center">
          <h2 className="text-[44px] font-bold">Empezá gratis</h2>
          <p className="text-[19px] text-texto-suave">Pasate a Pro cuando lo necesites.</p>
        </Reveal>
        <div className="grid items-stretch gap-6 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
          <Reveal className="h-full">
            <div className="card-hover flex h-full flex-col gap-[18px] rounded-tarjeta-lg bg-white p-9 shadow-[0_10px_30px_rgba(21,25,58,0.07)]">
              <h3 className="text-[26px] font-bold">Gratis</h3>
              <div className="font-display text-[44px] font-bold">$0</div>
              <div className="flex flex-col gap-2.5 text-texto-suave">
                <span>10 facturas A, B y C por mes</span>
                <span>1 Factura E por mes</span>
                <span>Panel de monotributo</span>
              </div>
              <Link href="/registro" className="btn-lift mt-auto rounded-[16px] border-2 border-texto bg-white px-4 py-4 text-center font-extrabold text-texto hover:bg-texto hover:text-white">Crear cuenta</Link>
            </div>
          </Reveal>
          <Reveal delay={120} className="h-full">
            <div className="card-hover flex h-full flex-col gap-[18px] rounded-tarjeta-lg bg-texto p-9 text-white shadow-tarjeta-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-[26px] font-bold text-white">Pro</h3>
                <span className="rounded-[10px] bg-acento px-3 py-1.5 text-[13px] font-extrabold text-texto">Más elegido</span>
              </div>
              <div className="font-display text-[44px] font-bold">$8.900<span className="text-[18px] font-semibold text-[#C9CCE8]"> / mes</span></div>
              <div className="flex flex-col gap-2.5 text-[#DADCF2]">
                <span>Facturas A, B y C ilimitadas</span>
                <span>Factura E ilimitada</span>
                <span>Recordatorios de cobro</span>
                <span>Registro de cobros</span>
              </div>
              <Link href="/registro" className="btn-lift mt-auto rounded-[16px] bg-acento px-4 py-4 text-center font-extrabold text-texto hover:brightness-105">Probar Pro</Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA final */}
      <section id="empezar" className="mx-auto max-w-[1200px] px-8 pb-20 pt-5">
        <Reveal>
          <div className="flex flex-wrap items-center justify-center gap-10 rounded-[40px] bg-primario px-12 py-14 text-white">
            <div className="flex-none">
              <Facti pose="saludo" size={180} animated={false} />
            </div>
            <div className="flex min-w-0 flex-1 basis-[420px] flex-col gap-[18px]">
              <h2 className="text-[46px] font-bold leading-[1.15] text-white">Facti está listo para tu próxima factura</h2>
              <p className="max-w-[520px] text-[19px] text-[#E4E5FF]">Creá tu cuenta gratis y conectá tu CUIT. Facti te acompaña en cada paso.</p>
              <Link href="/registro" className="btn-lift self-start rounded-[18px] bg-acento px-8 py-4 text-[18px] font-extrabold text-texto shadow-[0_6px_0_#15193A] hover:shadow-[0_4px_0_#15193A]">
                Empezar gratis
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-4 px-8 pb-12 text-sm text-texto-tenue">
        <span>© 2026 Facti</span>
        <span>Facti es un servicio independiente y no pertenece a ARCA.</span>
      </footer>
    </div>
  );
}
