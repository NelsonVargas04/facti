'use client';

/**
 * Guía animada "Cómo recategorizarte en el monotributo": recreación simplificada del portal de
 * Monotributo de ARCA, a ritmo lento, con cursor y subtítulos grandes. Usa el mismo motor que la guía
 * de conexión (Cuadro): se ve en la app y se graba a MP4 con scripts/grabar-guia-arca.mjs.
 * Los números son de ejemplo. Si ARCA cambia sus pantallas, se corrigen acá y se vuelve a grabar.
 */

import { Facti } from '@/components/Facti';
import { Boton, CabeceraArca, Campo, Cuadro, prog, tipear, type Escena } from '@/components/guia/RecorridoArca';

const TEAL = '#0E6A8C';
const TEAL_OSCURO = '#0A5573';

/** Cabecera del portal de Monotributo (como la de ARCA): nombre, CUIT, categoría y próxima recategorización. */
function CabeceraMonotributo({ categoria = 'C', compacta = false }: { categoria?: string; compacta?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-12 text-white ${compacta ? 'py-3' : 'py-5'}`} style={{ background: TEAL }}>
      <div className="flex flex-col gap-1">
        <span className="text-[28px] font-bold tracking-wide">TU NOMBRE Y APELLIDO</span>
        <span className="text-[18px]"><b>CUIT</b> 20-12345678-6</span>
        <span className="text-[18px] font-bold">Categoría {categoria} LOCACIONES DE SERVICIOS</span>
      </div>
      <span className="rounded-[4px] border-2 border-white px-5 py-3 text-[17px]">
        Próximo período de recategorización: <b>Enero 2027</b>
      </span>
    </div>
  );
}

function MenuMonotributo({ activo = 'Inicio', resaltar }: { activo?: string; resaltar?: string }) {
  return (
    <div className="flex w-[230px] flex-none flex-col gap-1">
      {['Inicio', 'Pagos', 'Facturación', 'Constancias', 'Recategorizarme', 'Datos personales'].map((x) => (
        <span
          key={x}
          className={`rounded-[4px] px-5 py-2.5 text-[18px] ${x === activo ? 'font-bold text-white' : 'text-[#3C4268]'} ${x === resaltar ? 'ring-4 ring-[#FFD25E]' : ''}`}
          style={x === activo ? { background: TEAL } : undefined}
        >
          {x}
        </span>
      ))}
    </div>
  );
}

const pesosAR = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function escenas(): Escena[] {
  const FACTURADO = 26_900_000;
  const TOPE_C = 24_670_494.31;
  const TOPE_D = 30_628_651.43;
  return [
    // 0. Presentación
    {
      dur: 8,
      url: null,
      paso: 'Antes de empezar',
      texto: 'Recategorizarte lleva unos 2 minutos. Se hace en enero y en julio, solo si tu facturación cambió.',
      pose: 'saludo',
      dibujar: (t) => (
        <div className="flex h-full items-center justify-center gap-14 bg-[#F2F5F9] px-20">
          <div style={{ opacity: prog(t, 0, 0.8), transform: `translateY(${(1 - prog(t, 0, 0.8)) * 16}px)` }}>
            <Facti pose="saludo" size={260} animated={false} />
          </div>
          <div className="flex max-w-[640px] flex-col gap-5" style={{ opacity: prog(t, 0.4, 1.4) }}>
            <span className="text-[22px] font-semibold text-[#3B3FD8]">Guía paso a paso</span>
            <h1 className="text-[60px] font-bold leading-[1.05] text-[#15193A]">Cómo recategorizarte en el monotributo</h1>
            <ol className="flex flex-col gap-3 text-[24px] text-[#3C4268]">
              {['Mirá en Facti qué categoría te corresponde', 'Entrá a Monotributo en ARCA', 'Revisá tus datos y confirmá'].map((x, i) => (
                <li key={x} className="flex items-center gap-3" style={{ opacity: prog(t, 1.8 + i * 0.8, 2.6 + i * 0.8) }}>
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#ECEDFF] text-[20px] font-bold text-[#2A2DB0]">{i + 1}</span>
                  {x}
                </li>
              ))}
            </ol>
          </div>
        </div>
      ),
    },

    // 1. En Facti: qué categoría corresponde
    {
      dur: 12,
      url: 'facti · Monotributo',
      paso: 'Paso 1 · Mirá en Facti cómo venís',
      texto: 'Facti suma lo que facturaste en los últimos 12 meses y te dice si te pasaste del tope y qué categoría te corresponde.',
      pose: 'senalando',
      cursor: [
        { t: 0, x: 900, y: 480 },
        { t: 3, x: 830, y: 300 },
        { t: 7.5, x: 640, y: 420 },
      ],
      dibujar: (t) => {
        const ancho = 100 * prog(t, 0.8, 3.2);
        const mensaje = t > 6;
        return (
          <div className="flex h-full flex-col gap-6 bg-[#F2F5F9] px-16 py-8">
            <div className="flex flex-col gap-5 rounded-[28px] bg-white p-8 shadow-[0_12px_32px_rgba(21,25,58,0.08)]">
              <div className="flex items-center justify-between">
                <span className="text-[28px] font-bold text-[#15193A]">Tu facturación · últimos 12 meses</span>
                <span className="rounded-full border-2 border-[#DCE1EC] px-5 py-2 text-[18px] font-bold text-[#15193A]">Ver categorías</span>
              </div>
              <div className="relative h-9 rounded-full bg-[#ECEFF5]">
                <div className="absolute inset-y-0 left-0 rounded-full bg-[#E5484D]" style={{ width: `${ancho}%` }} />
                <span className="absolute -right-1 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-[#15193A] text-[22px] font-bold text-white ring-4 ring-white">C</span>
              </div>
              <div className="flex justify-between text-[20px]">
                <span><b>{pesosAR(FACTURADO * prog(t, 0.8, 3.2))}</b> facturado</span>
                <span><b>{pesosAR(TOPE_C)}</b> tope categoría C</span>
              </div>
              <div
                className="rounded-[16px] bg-[#FDECEF] px-6 py-4 text-[22px] font-semibold text-[#B42344]"
                style={{ opacity: mensaje ? prog(t, 6, 6.8) : 0 }}
              >
                Te pasaste del tope por {pesosAR(FACTURADO - TOPE_C)}: por ingresos te corresponde la categoría D.
              </div>
            </div>
          </div>
        );
      },
    },

    // 2. Entrar a ARCA
    {
      dur: 10,
      url: 'auth.afip.gob.ar/contribuyente_/login.xhtml',
      paso: 'Paso 2 · Entrá a ARCA',
      texto: 'Entrá a arca.gob.ar con tu CUIT y tu clave fiscal. La clave la escribís solo vos: Facti nunca te la pide.',
      pose: 'senalando',
      cursor: [
        { t: 0, x: 900, y: 600 },
        { t: 1.2, x: 640, y: 330, click: true },
        { t: 4.6, x: 640, y: 330 },
        { t: 5.2, x: 640, y: 405, click: true },
        { t: 8.2, x: 640, y: 405 },
        { t: 8.8, x: 640, y: 405, click: true },
      ],
      dibujar: (t) => {
        const enClave = t >= 5.4;
        return (
          <div className="flex h-full flex-col bg-[#2B376E]">
            <CabeceraArca nombre={false} />
            <div className="flex flex-1 items-center justify-center">
              <div className="flex w-[480px] flex-col items-center gap-5 rounded-[10px] bg-[#F4F5F8] p-9 shadow-2xl">
                <span className="text-[24px] font-semibold text-[#1F2A5C]">Ingresar con Clave Fiscal</span>
                {!enClave ? (
                  <>
                    <Campo etiqueta="CUIT/CUIL" valor={tipear('20-12345678-6', t, 1.6, 7)} enfocado={t > 1.3} />
                    <Boton celeste activo={t > 5 && t < 5.6}>Siguiente</Boton>
                  </>
                ) : (
                  <>
                    <Campo etiqueta="TU CLAVE" valor={'•'.repeat(Math.min(10, Math.max(0, Math.floor((t - 5.8) * 4))))} enfocado={t < 8.7} />
                    <Boton celeste activo={t > 8.6}>Ingresar</Boton>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      },
    },

    // 3. Buscar Monotributo
    {
      dur: 10,
      url: 'portalcf.cloud.afip.gob.ar/portal/app',
      paso: 'Paso 3 · Abrí el servicio Monotributo',
      texto: 'En el buscador de ARCA escribí "Monotributo" y abrilo. Es el mismo servicio donde pagás tu cuota.',
      pose: 'buscando',
      cursor: [
        { t: 0, x: 640, y: 400 },
        { t: 1.2, x: 640, y: 182, click: true },
        { t: 5.8, x: 640, y: 182 },
        { t: 6.8, x: 560, y: 246, click: true },
      ],
      dibujar: (t) => {
        const texto = tipear('Monotributo', t, 1.6, 4);
        const sugerencia = texto.length >= 6;
        return (
          <div className="flex h-full flex-col bg-[#F4F5F8]">
            <CabeceraArca />
            <div className="flex flex-col items-center gap-2 pt-9">
              <span className={`flex h-14 w-[720px] items-center gap-3 rounded-full border-2 bg-white px-6 text-[22px] ${t > 1.3 ? 'border-[#1C9AD6]' : 'border-[#C7CDDD]'}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6B7394" strokeWidth="2.4" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
                {texto ? <span className="text-[#15193A]">{texto}</span> : <span className="text-[#9AA3BF]">Buscá un servicio</span>}
              </span>
              {sugerencia && (
                <div className="w-[720px] overflow-hidden rounded-[12px] bg-white text-[21px] shadow-xl" style={{ opacity: prog(t, 4, 4.6) }}>
                  <div className={`px-6 py-3.5 font-bold text-[#1F2A5C] ${t > 6.6 ? 'bg-[#FFD25E]' : 'bg-[#EEF1F6]'}`}>Monotributo</div>
                  <div className="px-6 py-3.5 text-[#6B7394]">Monotributo - Recategorización de oficio (MOREO)</div>
                </div>
              )}
            </div>
          </div>
        );
      },
    },

    // 4. Portal de Monotributo: Recategorizarme
    {
      dur: 11,
      url: 'monotributo.afip.gob.ar/app/Inicio.aspx',
      paso: 'Paso 4 · Tocá "Recategorizarme"',
      texto: 'Arriba ves tu categoría actual y cuándo es la recategorización. En el menú de la izquierda, tocá "Recategorizarme".',
      pose: 'senalando',
      cursor: [
        { t: 0, x: 900, y: 450 },
        { t: 3, x: 1020, y: 105 },
        { t: 6, x: 150, y: 450 },
        { t: 8.6, x: 150, y: 450, click: true },
      ],
      dibujar: (t) => (
        <div className="flex h-full flex-col bg-[#F1F1F1]">
          <CabeceraMonotributo />
          <div className="flex gap-8 px-12 pt-6">
            <MenuMonotributo resaltar={t > 6 ? 'Recategorizarme' : undefined} />
            <div className="flex flex-1 flex-col gap-4 rounded-[6px] bg-white p-7 shadow">
              <span className="text-[22px] text-[#15193A]">Facturación electrónica <span className="text-[16px] text-[#6B7394]">| últimos 12 meses</span></span>
              <div className="relative h-8 rounded-full bg-[#E6E6E6]">
                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: '100%', background: TEAL_OSCURO }} />
                <span className="absolute -right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full font-bold text-white ring-4 ring-white" style={{ background: TEAL }}>C</span>
              </div>
              <div className="flex justify-between text-[19px] font-bold" style={{ color: TEAL }}>
                <span>{pesosAR(FACTURADO)} <span className="font-normal text-[#15193A]">Monto facturado</span></span>
                <span>{pesosAR(TOPE_C)} <span className="font-normal text-[#15193A]">Tope categoría C</span></span>
              </div>
            </div>
          </div>
        </div>
      ),
    },

    // 5. Revisar los datos
    {
      dur: 16,
      url: 'monotributo.afip.gob.ar/app/Recategorizacion.aspx',
      paso: 'Paso 5 · Revisá tus datos',
      texto: 'ARCA ya trae tus ingresos de los últimos 12 meses. Revisá la superficie, la luz y el alquiler de tu lugar de trabajo, si tenés.',
      pose: 'pensando',
      cursor: [
        { t: 0, x: 400, y: 420 },
        { t: 2, x: 820, y: 236 },
        { t: 6, x: 820, y: 290 },
        { t: 9, x: 820, y: 344 },
        { t: 12, x: 820, y: 398 },
        { t: 14.6, x: 1150, y: 450, click: true },
      ],
      dibujar: (t) => {
        const fila = (y: number, a: number) => (t > a && t < a + 3 ? 'ring-4 ring-[#FFD25E]' : '');
        return (
          <div className="flex h-full flex-col bg-[#F1F1F1]">
            <CabeceraMonotributo compacta />
            <div className="flex flex-col gap-2 px-12 pt-3">
              <span className="text-[22px] font-bold text-[#15193A]">Recategorización · datos de los últimos 12 meses</span>
              {[
                ['Ingresos brutos', pesosAR(FACTURADO), 'Lo trae ARCA de tus facturas', 2],
                ['Superficie afectada', '0 m²', 'Local u oficina donde trabajás', 6],
                ['Energía eléctrica consumida', '0 kWh', 'De ese local, en el año', 9],
                ['Alquileres devengados', '$0,00', 'Lo que pagaste de alquiler del local', 12],
              ].map(([k, v, ayuda, a]) => (
                <div key={k as string} className={`flex items-center gap-5 rounded-[6px] bg-white px-6 py-1.5 ${fila(0, a as number)}`}>
                  <span className="w-[330px] text-[20px] font-bold text-[#3C4268]">{k}</span>
                  <span className="w-[300px] rounded-[4px] border border-[#B8C0D6] px-4 py-1.5 text-[20px] text-[#15193A]">{v}</span>
                  <span className="text-[17px] text-[#6B7394]">{ayuda}</span>
                </div>
              ))}
              <div className="flex justify-end">
                <span className={`rounded-[4px] px-8 py-2 text-[19px] font-bold text-white ${t > 14.4 ? 'ring-4 ring-[#FFD25E]' : ''}`} style={{ background: TEAL }}>Continuar</span>
              </div>
            </div>
          </div>
        );
      },
    },

    // 6. Resultado y confirmación
    {
      dur: 13,
      url: 'monotributo.afip.gob.ar/app/Recategorizacion.aspx',
      paso: 'Paso 6 · Confirmá la nueva categoría',
      texto: 'ARCA te muestra la categoría que te corresponde. Si coincide con la que te dijo Facti, tocá "Confirmar".',
      pose: 'ok',
      cursor: [
        { t: 0, x: 640, y: 470 },
        { t: 3, x: 760, y: 250 },
        { t: 9, x: 640, y: 420 },
        { t: 10.6, x: 640, y: 420, click: true },
      ],
      dibujar: (t) => (
        <div className="flex h-full flex-col bg-[#F1F1F1]">
          <CabeceraMonotributo />
          <div className="flex flex-col items-center gap-5 pt-8">
            <div className="flex items-center gap-10 rounded-[8px] bg-white px-12 py-7 shadow">
              <div className="flex flex-col items-center gap-2">
                <span className="text-[18px] text-[#6B7394]">Categoría actual</span>
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#C9CEDD] text-[30px] font-bold text-white">C</span>
              </div>
              <span className="text-[40px] text-[#6B7394]">→</span>
              <div className="flex flex-col items-center gap-2" style={{ opacity: prog(t, 1, 2), transform: `scale(${0.9 + 0.1 * prog(t, 1, 2)})` }}>
                <span className="text-[18px] font-bold" style={{ color: TEAL }}>Nueva categoría</span>
                <span className="flex h-20 w-20 items-center justify-center rounded-full text-[38px] font-bold text-white" style={{ background: TEAL }}>D</span>
                <span className="text-[17px] text-[#3C4268]">Tope {pesosAR(TOPE_D)}</span>
              </div>
            </div>
            <span className={`rounded-[4px] px-12 py-3.5 text-[21px] font-bold text-white ${t > 10.4 ? 'ring-4 ring-[#FFD25E]' : ''}`} style={{ background: TEAL }}>Confirmar</span>
          </div>
        </div>
      ),
    },

    // 7. Constancia
    {
      dur: 10,
      url: 'monotributo.afip.gob.ar/app/Constancias.aspx',
      paso: 'Paso 7 · Guardá la constancia',
      texto: 'Listo: ARCA registra tu nueva categoría. Descargá la constancia y guardala. Desde el mes siguiente pagás la cuota nueva.',
      pose: 'factura',
      cursor: [
        { t: 0, x: 640, y: 470 },
        { t: 4, x: 640, y: 380, click: true },
      ],
      dibujar: (t) => (
        <div className="flex h-full flex-col bg-[#F1F1F1]">
          <CabeceraMonotributo categoria="D" />
          <div className="flex flex-col items-center gap-4 pt-10" style={{ opacity: prog(t, 0.3, 1.2) }}>
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1E9E63] text-[36px] text-white">✓</span>
            <span className="text-[30px] font-bold text-[#15193A]">Recategorización registrada</span>
            <span className={`rounded-[4px] border-2 px-8 py-3 text-[20px] font-bold ${t > 3.8 ? 'ring-4 ring-[#FFD25E]' : ''}`} style={{ borderColor: TEAL, color: TEAL }}>Descargar constancia</span>
          </div>
        </div>
      ),
    },

    // 8. Facti
    {
      dur: 9,
      url: null,
      paso: 'Listo',
      texto: 'Eso es todo. Facti va a seguir sumando tu facturación y te avisa antes de la próxima recategorización.',
      pose: 'festejo',
      dibujar: (t) => (
        <div className="flex h-full items-center justify-center gap-12 bg-[#F2F5F9] px-20">
          <div className="flex w-[640px] flex-col items-center gap-5 rounded-[28px] bg-white p-10 text-center shadow-[0_20px_50px_rgba(21,25,58,0.12)]" style={{ opacity: prog(t, 0, 0.8) }}>
            <h2 className="text-[40px] font-bold text-[#0E5C38]">¡Ya estás recategorizado!</h2>
            <p className="text-[23px] text-[#3C4268]">Si tenés dudas con superficie, luz o alquiler, consultá con tu contador antes de confirmar.</p>
          </div>
          <Facti pose="festejo" size={220} animated={false} />
        </div>
      ),
    },
  ];
}

export function duracionRecategorizacion() {
  return escenas().reduce((a, e) => a + e.dur, 0);
}

/** Cuadro del instante `t` (segundos) a 1280×720. */
export function EscenarioRecategorizacion({ t }: { t: number }) {
  return <Cuadro t={t} lista={escenas()} />;
}
