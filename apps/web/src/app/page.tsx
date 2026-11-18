import Link from 'next/link';
import { Facti } from '@/components/Facti';
import { FactiWordmark } from '@/components/FactiLogo';
import { MuestraComprobantes } from '@/components/MuestraComprobantes';
import { Reveal } from '@/components/Reveal';
import { PieLegal } from '@/components/legal/PieLegal';
import { PLAN_DEMO } from '@/lib/plan-demo';

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
  'Comprobantes en línea se cuelga justo cuando tenés que facturar a fin de mes.',
  'Nunca sabés si a este cliente le va factura A o B.',
  'Te enterás tarde de que te tenías que recategorizar.',
  'Copiás a mano el CUIT y los datos de cada cliente, factura por factura.',
]

const PASOS = [
  {
    n: 1, titulo: 'Conectá tu CUIT', chip: 'Una sola vez',
    texto: (<>Desde ARCA autorizás a Facti a facturar por vos, con nuestra guía paso a paso. <strong className="font-bold text-texto">Tu clave fiscal nunca pasa por Facti</strong>.</>),
  },
  {
    n: 2, titulo: 'Facturá en segundos', chip: 'Menos de 1 minuto',
    texto: (<>Ponés el CUIT de tu cliente y Facti trae sus datos y <strong className="font-bold text-texto">elige si es A, B o C</strong>. Vos solo cargás el monto.</>),
  },
  {
    n: 3, titulo: 'Cobrá tranquilo', chip: 'Al instante',
    texto: (<>ARCA la autoriza con CAE y QR y se la mandás al cliente. <strong className="font-bold text-texto">Ves qué te pagaron y qué falta</strong>.</>),
  },
];

export default function Landing() {
  return (
    <div className="landing overflow-hidden text-[17px] leading-relaxed">
      <div className="fondo-hero">
      {/* Header */}
      <header className="mx-auto flex max-w-[1200px] items-center justify-between gap-5 px-4 py-5 sm:px-8 sm:py-7">
        <Link href="/" aria-label="Facti inicio" className="btn-lift flex-none">
          {/* En celular va solo el ícono, para que entren los dos botones en un renglón. */}
          <FactiWordmark size={38} textClass="hidden text-texto min-[420px]:inline" />
        </Link>
        {/* En celular el menú se oculta: las secciones están a un scroll y el encabezado queda en un renglón. */}
        {/* Hover: píldora lila suave con texto índigo, como el ítem activo del menú de la app. */}
        <nav aria-label="Principal" className="hidden gap-1 text-base font-semibold text-texto-suave md:flex">
          {[
            ['#como', 'Cómo funciona'],
            ['#comprobantes', 'Comprobantes'],
            ['#monotributo', 'Monotributo'],
            ['#precios', 'Precios'],
          ].map(([href, texto]) => (
            <a
              key={href}
              href={href}
              className="rounded-full px-4 py-2 transition-[background-color,color] duration-150 hover:bg-primario-suave hover:text-primario-oscuro focus-visible:bg-primario-suave focus-visible:text-primario-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario"
            >
              {texto}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-3">
          <Link href="/ingresar" className="whitespace-nowrap px-3 py-3 text-base font-bold text-texto transition-colors hover:text-primario sm:px-4">Iniciar sesión</Link>
          <Link href="/registro" className="btn-lift whitespace-nowrap rounded-full bg-primario px-5 py-3 text-base font-extrabold text-white shadow-[0_8px_20px_rgba(59,63,216,0.25)] hover:shadow-[0_12px_28px_rgba(59,63,216,0.38)] sm:px-6">
            Empezar gratis
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section id="inicio" className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 pb-20 pt-6 sm:px-8 sm:pt-12 lg:grid-cols-[1.25fr_1fr] lg:gap-8 lg:pb-24">
        <Reveal className="flex min-w-0 flex-col gap-7">
          <h1 className="text-balance text-[clamp(40px,4.6vw,62px)] font-bold leading-[1.1]">
            Facturá en ARCA <span className="whitespace-nowrap text-primario">sin vueltas</span>
          </h1>
          <p className="max-w-[540px] text-[18px] text-texto-suave sm:text-[20px]">
            Ponés el CUIT de tu cliente y el monto. Facti elige si va A, B o C, ARCA te da el CAE y vos seguís con lo tuyo.{' '}
            <strong className="text-texto">Gratis hasta 10 facturas por mes.</strong>
          </p>
          <div className="flex flex-wrap gap-3.5">
            <Link href="/registro" className="btn-lift inline-flex items-center gap-2.5 rounded-full bg-primario px-8 py-4 text-[18px] font-extrabold text-white shadow-[0_12px_28px_rgba(59,63,216,0.28)] hover:shadow-[0_16px_34px_rgba(59,63,216,0.42)]">
              Crear cuenta gratis <Flecha />
            </Link>
            <a href="#como" className="btn-lift rounded-full border-[1.5px] border-borde bg-white px-8 py-4 text-[18px] font-extrabold text-texto hover:border-primario">
              Ver cómo funciona
            </a>
          </div>
          <p className="text-base font-semibold text-texto-tenue">Monotributo, responsable inscripto y exento · Facturas A, B, C y E</p>
        </Reveal>

        {/* Composición de la derecha. La factura va adelante (z-20) para que nunca se tape el monto;
            la tarjeta de monotributo asoma por detrás, más abajo. En celular se oculta: esa info
            tiene su propia sección más abajo. */}
        <Reveal delay={140} className="relative mx-auto flex min-h-[470px] w-full min-w-0 max-w-[560px] items-center justify-center sm:min-h-[580px]">
          <div className="absolute left-0 top-2.5 z-20 flex w-[min(330px,88%)] flex-col gap-3.5 rounded-[24px] bg-white p-6 shadow-tarjeta-lg">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-primario-suave px-3 py-1.5 text-base font-extrabold text-primario-oscuro">Factura C</span>
              <span className="text-base font-semibold text-texto-tenue">N° 00003-00000128</span>
            </div>
            <div>
              <div className="text-base text-texto-tenue">Cliente</div>
              <div className="font-extrabold">Estudio Lumen SRL</div>
            </div>
            <div className="flex items-end justify-between border-t-[1.5px] border-dashed border-borde pt-3.5">
              <div className="text-base text-texto-suave">Diseño de logo</div>
              <div className="font-display text-[30px] font-bold">$85.000</div>
            </div>
            <div className="flex items-center gap-2.5 rounded-input bg-exito-suave px-3.5 py-2.5 text-base font-bold text-exito-texto">
              <Tilde color="#0E5C38" size={18} />
              <span>Autorizada por ARCA<br /><span className="text-base font-semibold">CAE 76419283746521 · vence 24/10</span></span>
            </div>
          </div>

          <div className="absolute -right-4 top-[330px] z-10 hidden w-[230px] flex-col gap-2.5 rounded-[22px] bg-white p-5 shadow-tarjeta-lg sm:flex">
            <div className="text-base font-bold text-texto-tenue">Tu monotributo</div>
            <div className="font-display text-[22px] font-bold">Categoría D</div>
            <div className="h-3 overflow-hidden rounded-full bg-[#ECEFF5]"><div className="h-full w-[68%] rounded-full bg-primario" /></div>
            <div className="text-base text-texto-suave">68% del tope anual</div>
          </div>

          <div className="relative top-24 z-30 origin-bottom scale-[0.78] sm:top-32 sm:-translate-x-20 sm:scale-100">
            <Facti pose="saludo" size={260} animated />
          </div>

          <div className="absolute bottom-[-10px] left-1/2 z-30 w-max max-w-full -translate-x-1/2">
            <div className="f-pop rounded-full bg-exito-suave px-5 py-3 text-center text-base font-extrabold text-exito-texto shadow-tarjeta-lg sm:px-6 sm:py-3.5 sm:text-[17px]">
              ¡Factura autorizada y enviada al cliente!
            </div>
          </div>
        </Reveal>
      </section>
      </div>

      {/* Lo que cuesta hoy */}
      <section data-sec="problemas" className="mx-auto flex max-w-[1200px] flex-col gap-10 px-4 py-20 sm:px-8 sm:py-24">
        <Reveal as="h2" className="text-[clamp(32px,5vw,44px)] font-bold leading-tight">Lo que hoy te hace perder tiempo con ARCA</Reveal>
        <ul className="grid gap-x-10 gap-y-6 md:grid-cols-2">
          {SOSPECHAS.map((s) => (
            <li key={s} className="border-l-4 border-acento pl-5 text-[18px] leading-[1.55] text-texto">
              {s}
            </li>
          ))}
        </ul>
      </section>

      {/* Así de fácil funciona */}
      <section id="como" data-sec="como" className="mx-auto flex max-w-[1200px] flex-col gap-12 px-4 py-20 sm:px-8 sm:py-24">
        <Reveal className="flex flex-col items-center gap-3 text-center">
          <h2 className="text-[clamp(32px,5vw,44px)] font-bold leading-tight">Cómo funciona</h2>
          <p className="max-w-[620px] text-[17px] text-texto-suave sm:text-[19px]">Conectás tu CUIT con ARCA una sola vez y después facturás desde la compu o el celular.</p>
        </Reveal>
        {/* Un solo talón con tres partes separadas por una línea punteada, como un ticket troquelado. */}
        <Reveal>
          <ol className="grid rounded-tarjeta-lg bg-white shadow-[0_10px_30px_rgba(21,25,58,0.07)] md:grid-cols-3">
            {PASOS.map((p, i) => (
              <li
                key={p.n}
                className={`flex flex-col gap-3 p-7 sm:p-8 ${i > 0 ? 'border-t-2 border-dashed border-[#D8DDE8] md:border-l-2 md:border-t-0' : ''}`}
              >
                <div className="flex items-baseline gap-3">
                  <span aria-hidden="true" className="font-display text-[52px] font-bold leading-none text-primario">{p.n}</span>
                  <span className="text-base font-bold text-texto-tenue">{p.chip}</span>
                </div>
                <h3 className="text-[22px] font-bold leading-tight">
                  <span className="sr-only">Paso {p.n}: </span>
                  {p.titulo}
                </h3>
                <p className="text-[16px] leading-[1.6] text-texto-suave">{p.texto}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>

      {/* Comprobantes */}
      <section id="comprobantes" data-sec="comprobantes" className="mx-auto flex max-w-[1200px] flex-col gap-11 px-4 py-20 sm:px-8 sm:py-24">
        <Reveal className="flex flex-col items-center gap-3 text-center">
          <h2 className="text-[clamp(32px,5vw,44px)] font-bold leading-tight">Todos los comprobantes que necesitás</h2>
          <p className="max-w-[620px] text-[17px] text-texto-suave sm:text-[19px]">Seas monotributista, responsable inscripto o exportador, Facti te muestra solo los que te corresponden.</p>
        </Reveal>
        <Reveal delay={80}>
          <MuestraComprobantes />
        </Reveal>
      </section>

      {/* Monotributo */}
      <section id="monotributo" data-sec="monotributo" className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-14 px-4 py-20 sm:px-8 sm:py-24">
        <Reveal className="flex min-w-0 flex-1 basis-[460px] flex-col gap-5">
          <h2 className="text-balance text-[clamp(32px,5vw,44px)] font-bold leading-[1.15]">
            Tu categoría de monotributo, siempre a la vista
          </h2>
          <p className="text-[17px] text-texto-suave sm:text-[19px]">Como Facti hace tus facturas, ya sabe cuánto facturaste. Te avisa antes de que te pases del tope y te recuerda cuándo recategorizarte, con los números listos.</p>
          <div className="flex flex-col gap-3 font-bold">
            {['Facturación de los últimos 12 meses', 'Alerta cuando te acercás al tope', 'Recordatorio de recategorización'].map((t) => (
              <span key={t} className="flex items-center gap-2.5"><Tilde />{t}</span>
            ))}
          </div>
        </Reveal>
        <Reveal delay={120} className="relative min-w-0 flex-1 basis-[420px] pt-[30px]">
          <div className="flex flex-col gap-5 rounded-tarjeta-lg bg-white p-7 shadow-tarjeta-lg sm:p-[34px]">
            <div>
              <div className="text-base font-bold text-texto-tenue">Tu monotributo</div>
              <div className="font-display text-[28px] font-bold">Categoría D</div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between gap-3 font-bold"><span>Facturado en 12 meses</span><span>68% del tope</span></div>
              <div className="h-4 overflow-hidden rounded-full bg-[#ECEFF5]"><div className="h-full w-[68%] rounded-full bg-primario" /></div>
              <div className="text-base text-texto-suave">A este ritmo llegás al tope en marzo.</div>
            </div>
            <div className="flex items-start gap-3 rounded-[18px] bg-aviso-suave px-[18px] py-4 font-bold text-aviso-texto">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 flex-none"><path d="M12 8v5M12 16.5v.5" /><circle cx="12" cy="12" r="9" /></svg>
              <span>La próxima recategorización vence en enero. Ya tengo tus números listos.</span>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Precios */}
      <section id="precios" data-sec="precios" className="mx-auto flex max-w-[1000px] flex-col gap-11 px-4 py-20 sm:px-8 sm:py-24">
        <Reveal className="flex flex-col items-center gap-3 text-center">
          <h2 className="text-[clamp(32px,5vw,44px)] font-bold leading-tight">Precios</h2>
          <p className="text-[17px] text-texto-suave sm:text-[19px]">Empezá gratis y pasate a Pro cuando lo necesites.</p>
        </Reveal>
        <div className="grid items-stretch gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))]">
          <Reveal className="h-full">
            <div className="flex h-full flex-col gap-[18px] rounded-tarjeta-lg bg-white p-7 shadow-[0_10px_30px_rgba(21,25,58,0.07)] sm:p-9">
              <h3 className="text-[26px] font-bold">Gratis</h3>
              <div className="font-display text-[44px] font-bold">$0</div>
              <ul className="flex flex-col gap-2.5 text-texto-suave">
                {['10 facturas A, B y C por mes', '1 Factura E por mes', 'Panel de monotributo'].map((t) => (
                  <li key={t} className="flex items-center gap-2.5"><Tilde size={18} />{t}</li>
                ))}
              </ul>
              <Link href="/registro" className="btn-lift mt-auto rounded-full border-2 border-texto bg-white px-4 py-4 text-center font-extrabold text-texto hover:bg-texto hover:text-white">Crear cuenta</Link>
            </div>
          </Reveal>
          <Reveal delay={120} className="h-full">
            <div className="flex h-full flex-col gap-[18px] rounded-tarjeta-lg bg-texto p-7 text-white sm:p-9 shadow-tarjeta-lg">
              <h3 className="text-[26px] font-bold text-white">Pro</h3>
              <div className="font-display text-[44px] font-bold">{PLAN_DEMO.precioPro}<span className="text-[18px] font-semibold text-[#C9CCE8]"> / mes</span></div>
              <ul className="flex flex-col gap-2.5 text-[#DADCF2]">
                {['Facturas A, B y C ilimitadas', 'Factura E ilimitada', 'Recordatorios de cobro', 'Registro de cobros'].map((t) => (
                  <li key={t} className="flex items-center gap-2.5"><Tilde color="#FFD25E" size={18} />{t}</li>
                ))}
              </ul>
              <Link href="/registro" className="btn-lift mt-auto rounded-full bg-acento px-4 py-4 text-center font-extrabold text-texto hover:brightness-105">Empezar con Pro</Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA final */}
      <section id="empezar" className="mx-auto max-w-[1200px] px-4 pb-16 pt-16 sm:px-8 sm:pb-20 sm:pt-20">
        <Reveal>
          <div className="flex flex-wrap items-center justify-center gap-8 rounded-[32px] bg-primario px-6 py-10 text-white sm:gap-10 sm:rounded-[40px] sm:px-12 sm:py-14">
            <div className="flex-none">
              <Facti pose="saludo" size={180} animated={false} />
            </div>
            <div className="flex min-w-0 flex-1 basis-[min(420px,100%)] flex-col gap-[18px]">
              <h2 className="text-balance text-[clamp(32px,5vw,46px)] font-bold leading-[1.15] text-white">Tu próxima factura, en un minuto</h2>
              <p className="max-w-[520px] text-[17px] text-[#E4E5FF] sm:text-[19px]">Creá tu cuenta gratis y conectá tu CUIT. Facti te acompaña en cada paso.</p>
              <Link href="/registro" className="btn-lift self-start rounded-full bg-acento px-8 py-4 text-[18px] font-extrabold text-texto shadow-[0_10px_24px_rgba(21,25,58,0.25)] hover:shadow-[0_14px_30px_rgba(21,25,58,0.32)]">
                Crear cuenta gratis
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="mx-auto flex max-w-[1200px] flex-col gap-6 border-t border-[#E3E7F0] px-4 pb-12 pt-8 sm:px-8">
        <PieLegal />
        <div className="flex flex-wrap justify-between gap-4 text-texto-tenue">
          <span>© 2026 Facti</span>
          <span>Facti es un servicio independiente y no pertenece a ARCA.</span>
        </div>
      </footer>
    </div>
  );
}
