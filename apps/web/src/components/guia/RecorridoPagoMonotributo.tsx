'use client';

/**
 * Guía animada "Cómo pagar tu monotributo": generar el VEP en ARCA (CCMA › Volante de pago), pagarlo
 * con el QR desde la billetera y subir el comprobante a Facti. Recreación simplificada con números de
 * ejemplo (categoría C, servicios). Mismo motor que las otras guías (Cuadro).
 */

import { Facti } from '@/components/Facti';
import { Boton, CabeceraArca, Campo, Cuadro, prog, tipear, type Escena } from '@/components/guia/RecorridoArca';

const pesosAR = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** QR de mentira, siempre igual (dibujado con cuadraditos). */
function QR({ tam = 220 }: { tam?: number }) {
  const n = 25;
  const celdas: [number, number][] = [];
  let x = 7;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      x = (x * 1103515245 + 12345) % 2147483648;
      const esquina = (i < 7 && j < 7) || (i < 7 && j >= n - 7) || (i >= n - 7 && j < 7);
      if (!esquina && x % 3 === 0) celdas.push([i, j]);
    }
  const c = tam / n;
  const ojo = (i: number, j: number) => (
    <g key={`${i}-${j}`}>
      <rect x={j * c} y={i * c} width={7 * c} height={7 * c} fill="#15193A" />
      <rect x={(j + 1) * c} y={(i + 1) * c} width={5 * c} height={5 * c} fill="#fff" />
      <rect x={(j + 2) * c} y={(i + 2) * c} width={3 * c} height={3 * c} fill="#15193A" />
    </g>
  );
  return (
    <svg width={tam} height={tam} viewBox={`0 0 ${tam} ${tam}`} aria-hidden="true">
      <rect width={tam} height={tam} fill="#fff" />
      {celdas.map(([i, j]) => (
        <rect key={`${i}.${j}`} x={j * c} y={i * c} width={c} height={c} fill="#15193A" />
      ))}
      {ojo(0, 0)}
      {ojo(0, n - 7)}
      {ojo(n - 7, 0)}
    </svg>
  );
}

function escenas(): Escena[] {
  const IMPUESTO = 18246.86;
  const SIPA = 22078.71;
  const OS = 25694.55;
  const TOTAL = IMPUESTO + SIPA + OS;
  return [
    // 0. Presentación
    {
      dur: 8,
      url: null,
      paso: 'Antes de empezar',
      texto: 'La cuota del monotributo se paga todos los meses hasta el día 20. Te muestro cómo, paso a paso.',
      pose: 'saludo',
      dibujar: (t) => (
        <div className="flex h-full items-center justify-center gap-14 bg-[#F2F5F9] px-20">
          <div style={{ opacity: prog(t, 0, 0.8), transform: `translateY(${(1 - prog(t, 0, 0.8)) * 16}px)` }}>
            <Facti pose="saludo" size={260} animated={false} />
          </div>
          <div className="flex max-w-[640px] flex-col gap-5" style={{ opacity: prog(t, 0.4, 1.4) }}>
            <span className="text-[22px] font-semibold text-[#3B3FD8]">Guía paso a paso</span>
            <h1 className="text-[60px] font-bold leading-[1.05] text-[#15193A]">Cómo pagar tu monotributo</h1>
            <ol className="flex flex-col gap-3 text-[24px] text-[#3C4268]">
              {['Generá el VEP en ARCA', 'Pagalo con el QR o por home banking', 'Subí el comprobante a Facti'].map((x, i) => (
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

    // 1. Facti: cuánto y cuándo
    {
      dur: 10,
      url: 'facti · Monotributo › Pagos',
      paso: 'Paso 1 · Mirá cuánto y cuándo',
      texto: 'En Facti, en Monotributo › Pagos, ves cuánto pagás este mes, qué incluye y hasta cuándo tenés.',
      pose: 'senalando',
      cursor: [
        { t: 0, x: 900, y: 480 },
        { t: 2.5, x: 980, y: 110 },
        { t: 6, x: 900, y: 330 },
      ],
      dibujar: (t) => (
        <div className="flex h-full justify-center bg-[#F2F5F9] px-16 py-8">
          <div className="flex w-[760px] flex-col gap-4 rounded-[28px] bg-white p-8 shadow-[0_12px_32px_rgba(21,25,58,0.08)]">
            <div className="flex items-center justify-between">
              <span className="text-[28px] font-bold text-[#15193A]">Tu cuota de noviembre</span>
              <span className={`rounded-full bg-[#FFF3D1] px-4 py-1.5 text-[19px] font-bold text-[#6B4600] ${t > 2.3 && t < 5 ? 'ring-4 ring-[#FFD25E]' : ''}`}>Vence el 20/11</span>
            </div>
            {[
              ['Impuesto integrado', IMPUESTO],
              ['Aportes jubilatorios (SIPA)', SIPA],
              ['Obra social', OS],
            ].map(([k, v], i) => (
              <div key={k as string} className="flex justify-between text-[21px] text-[#3C4268]" style={{ opacity: prog(t, 0.5 + i * 0.4, 1.1 + i * 0.4) }}>
                <span>{k}</span>
                <b className="text-[#15193A]">{pesosAR(v as number)}</b>
              </div>
            ))}
            <div className="flex items-baseline justify-between border-t-2 border-dashed border-[#DCE1EC] pt-3">
              <b className="text-[22px]">Total</b>
              <span className={`rounded-[10px] px-2 text-[44px] font-bold text-[#15193A] ${t > 5.8 ? 'ring-4 ring-[#FFD25E]' : ''}`}>{pesosAR(TOTAL)}</span>
            </div>
          </div>
        </div>
      ),
    },

    // 2. Entrar a ARCA
    {
      dur: 10,
      url: 'auth.afip.gob.ar/contribuyente_/login.xhtml',
      paso: 'Paso 2 · Entrá a ARCA',
      texto: 'Entrá a arca.gob.ar con tu CUIT y tu clave fiscal. La clave la escribís solo vos.',
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

    // 3. Buscar CCMA
    {
      dur: 11,
      url: 'portalcf.cloud.afip.gob.ar/portal/app',
      paso: 'Paso 3 · Abrí "CCMA"',
      texto: 'En el buscador escribí "CCMA" y abrí "Cuenta corriente de monotributistas y autónomos". Ahí se generan los pagos.',
      pose: 'buscando',
      cursor: [
        { t: 0, x: 640, y: 400 },
        { t: 1.2, x: 640, y: 182, click: true },
        { t: 6.4, x: 640, y: 182 },
        { t: 7.4, x: 600, y: 246, click: true },
      ],
      dibujar: (t) => {
        const texto = tipear('CCMA', t, 1.6, 2);
        return (
          <div className="flex h-full flex-col bg-[#F4F5F8]">
            <CabeceraArca />
            <div className="flex flex-col items-center gap-2 pt-9">
              <span className={`flex h-14 w-[760px] items-center gap-3 rounded-full border-2 bg-white px-6 text-[22px] ${t > 1.3 ? 'border-[#1C9AD6]' : 'border-[#C7CDDD]'}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6B7394" strokeWidth="2.4" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
                {texto ? <span className="text-[#15193A]">{texto}</span> : <span className="text-[#9AA3BF]">Buscá un servicio</span>}
              </span>
              {texto.length >= 3 && (
                <div className="w-[760px] overflow-hidden rounded-[12px] bg-white text-[21px] shadow-xl" style={{ opacity: prog(t, 3.6, 4.2) }}>
                  <div className={`px-6 py-3.5 font-bold text-[#1F2A5C] ${t > 7.2 ? 'bg-[#FFD25E]' : 'bg-[#EEF1F6]'}`}>CCMA · Cuenta corriente de monotributistas y autónomos</div>
                </div>
              )}
            </div>
          </div>
        );
      },
    },

    // 4. Volante de pago
    {
      dur: 9,
      url: 'servicios1.afip.gob.ar/tramites_con_clave_fiscal/ccam/',
      paso: 'Paso 4 · Tocá "Volante de pago"',
      texto: 'Dentro de CCMA, en el menú, tocá "Volante de pago (VEP)".',
      pose: 'senalando',
      cursor: [
        { t: 0, x: 900, y: 460 },
        { t: 3.5, x: 330, y: 316 },
        { t: 6, x: 330, y: 316, click: true },
      ],
      dibujar: (t) => (
        <div className="flex h-full flex-col bg-[#F4F5F8]">
          <CabeceraArca />
          <div className="flex gap-8 px-14 pt-8">
            <div className="flex w-[380px] flex-col overflow-hidden rounded-[8px] border border-[#D9DEE8] bg-white text-[20px]">
              {['Estado de cuenta', 'Cálculo de deuda', 'Volante de pago (VEP)', 'Pagos realizados'].map((x) => (
                <span key={x} className={`border-b border-[#EEF1F6] px-6 py-3.5 ${x.startsWith('Volante') ? `font-bold text-[#1F2A5C] ${t > 3.2 ? 'bg-[#FFD25E]' : 'bg-[#EEF1F6]'}` : 'text-[#3C4268]'}`}>
                  {x}
                </span>
              ))}
            </div>
            <div className="flex flex-1 flex-col gap-3 rounded-[8px] bg-white p-7 text-[20px] text-[#3C4268]">
              <b className="text-[24px] text-[#1F2A5C]">Cuenta corriente</b>
              <span>Período 11/2026 · Cuota mensual · Pendiente de pago</span>
            </div>
          </div>
        </div>
      ),
    },

    // 5. Elegir el período y generar
    {
      dur: 14,
      url: 'servicios1.afip.gob.ar/tramites_con_clave_fiscal/ccam/vep',
      paso: 'Paso 5 · Elegí el mes y generá el VEP',
      texto: 'Marcá el mes que vas a pagar (los tres conceptos) y tocá "Generar VEP o QR".',
      pose: 'pensando',
      cursor: [
        { t: 0, x: 640, y: 470 },
        { t: 2, x: 192, y: 200, click: true },
        { t: 4.4, x: 192, y: 254, click: true },
        { t: 6.8, x: 192, y: 308, click: true },
        { t: 9.8, x: 1100, y: 388 },
        { t: 11.6, x: 1100, y: 388, click: true },
      ],
      dibujar: (t) => {
        const marcas = [t > 2.2, t > 4.6, t > 7];
        const total = [IMPUESTO, SIPA, OS].reduce((a, v, i) => a + (marcas[i] ? v : 0), 0);
        return (
          <div className="flex h-full flex-col bg-[#F4F5F8]">
            <CabeceraArca />
            <div className="flex flex-col gap-2.5 px-14 pt-5">
              <b className="text-[24px] text-[#1F2A5C]">Elegí lo que vas a pagar</b>
              {[
                ['11/2026 · Impuesto integrado', IMPUESTO],
                ['11/2026 · Aportes SIPA', SIPA],
                ['11/2026 · Obra social', OS],
              ].map(([k, v], i) => (
                <div key={k as string} className="flex items-center gap-4 rounded-[6px] bg-white px-6 py-2.5 text-[20px]">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-[4px] border-2 ${marcas[i] ? 'border-[#1C9AD6] bg-[#1C9AD6] text-white' : 'border-[#9AA3BF]'}`}>{marcas[i] ? '✓' : ''}</span>
                  <span className="flex-1 text-[#3C4268]">{k}</span>
                  <b className="text-[#15193A]">{pesosAR(v as number)}</b>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[22px] text-[#3C4268]">
                  Total: <b className="text-[#15193A]">{pesosAR(total)}</b>
                </span>
                <Boton celeste activo={t > 11.4}>Generar VEP o QR</Boton>
              </div>
            </div>
          </div>
        );
      },
    },

    // 6. QR
    {
      dur: 12,
      url: 'servicios1.afip.gob.ar/tramites_con_clave_fiscal/ccam/vep',
      paso: 'Paso 6 · Elegí cómo pagar',
      texto: 'Con billetera (Mercado Pago, Cuenta DNI, etc.): escaneá el QR desde la app de la billetera, no con la cámara. Si preferís, elegí home banking.',
      pose: 'ok',
      cursor: [
        { t: 0, x: 900, y: 480 },
        { t: 2, x: 420, y: 200, click: true },
      ],
      dibujar: (t) => (
        <div className="flex h-full flex-col bg-[#F4F5F8]">
          <CabeceraArca />
          <div className="flex items-start justify-center gap-10 px-14 pt-5">
            <div className="flex w-[440px] flex-col gap-3">
              <b className="text-[24px] text-[#1F2A5C]">¿Cómo querés pagar?</b>
              <span className={`rounded-[8px] border-2 bg-white px-6 py-3.5 text-[20px] font-bold ${t > 2 ? 'border-[#1C9AD6] text-[#1F2A5C]' : 'border-[#D9DEE8] text-[#3C4268]'}`}>Pagar con QR (billeteras)</span>
              <span className="rounded-[8px] border-2 border-[#D9DEE8] bg-white px-6 py-3.5 text-[20px] text-[#3C4268]">Home banking (Link, Banelco, Interbanking)</span>
              <span className="rounded-[8px] border-2 border-[#D9DEE8] bg-white px-6 py-3.5 text-[20px] text-[#3C4268]">Pago Mis Cuentas</span>
            </div>
            <div className="flex flex-col items-center gap-3 rounded-[12px] bg-white p-6 shadow" style={{ opacity: prog(t, 2.6, 3.4) }}>
              <QR tam={250} />
              <b className="text-[22px] text-[#15193A]">{pesosAR(TOTAL)}</b>
            </div>
          </div>
        </div>
      ),
    },

    // 7. Pagar desde la billetera
    {
      dur: 12,
      url: null,
      paso: 'Paso 7 · Pagá desde la billetera',
      texto: 'En la app de tu billetera tocá "Pagar con QR", escaneá el código y confirmá. Después guardá el comprobante en PDF.',
      pose: 'factura',
      dibujar: (t) => {
        const pagado = t > 6.5;
        return (
          <div className="flex h-full items-center justify-center gap-16 bg-[#F2F5F9]">
            <div className="flex h-[480px] w-[260px] flex-col items-center gap-4 overflow-hidden rounded-[36px] border-[10px] border-[#15193A] bg-white px-4 pt-6 shadow-2xl">
              {!pagado ? (
                <>
                  <span className="text-[18px] font-bold text-[#15193A]">Pagar con QR</span>
                  <div className="relative rounded-[12px] border-4 border-[#3B3FD8] p-2">
                    <QR tam={170} />
                    <span className="absolute inset-x-2 h-[3px] bg-[#E5484D]" style={{ top: `${10 + 85 * Math.abs(Math.sin(t * 1.6))}%` }} />
                  </div>
                  <span className="text-[16px] text-[#3C4268]" style={{ opacity: prog(t, 3, 3.6) }}>ARCA · VEP</span>
                  <b className="text-[24px] text-[#15193A]" style={{ opacity: prog(t, 3, 3.6) }}>{pesosAR(TOTAL)}</b>
                  <span className={`mt-auto mb-5 w-full rounded-full bg-[#3B3FD8] py-3 text-center text-[18px] font-bold text-white ${t > 5.4 ? 'ring-4 ring-[#FFD25E]' : ''}`} style={{ opacity: prog(t, 3.4, 4) }}>Pagar</span>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center" style={{ opacity: prog(t, 6.5, 7.3) }}>
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1E9E63] text-[34px] text-white">✓</span>
                  <b className="text-[22px] text-[#0E5C38]">Pago aprobado</b>
                  <span className={`rounded-full border-2 border-[#3B3FD8] px-4 py-2 text-[16px] font-bold text-[#3B3FD8] ${t > 9 ? 'ring-4 ring-[#FFD25E]' : ''}`}>Descargar comprobante</span>
                </div>
              )}
            </div>
          </div>
        );
      },
    },

    // 8. Subir a Facti
    {
      dur: 10,
      url: 'facti · Monotributo › Pagos',
      paso: 'Paso 8 · Subí el comprobante a Facti',
      texto: 'Volvé a Facti y subí el PDF del pago. Facti lo lee y lo guarda en tu historial. ¡Listo hasta el mes que viene!',
      pose: 'festejo',
      cursor: [
        { t: 0, x: 300, y: 450 },
        { t: 2.2, x: 640, y: 260, click: true },
      ],
      dibujar: (t) => {
        const leido = t > 4;
        return (
          <div className="flex h-full items-center justify-center bg-[#F2F5F9]">
            <div className={`flex w-[700px] flex-col items-center gap-4 rounded-[28px] border-[3px] border-dashed p-10 text-center ${leido ? 'border-[#1E9E63] bg-[#EAF8F0]' : 'border-[#B9BED3] bg-white'}`}>
              {!leido ? (
                <>
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#3B3FD8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                    <path d="M14 3v5h5M9 13h6M9 17h4" />
                  </svg>
                  <b className="text-[26px] text-[#15193A]">Soltá acá el comprobante de pago</b>
                  <span className="text-[19px] text-[#6B7394]">PDF que te dio la billetera o el banco</span>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3" style={{ opacity: prog(t, 4, 4.8) }}>
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1E9E63] text-[30px] text-white">✓</span>
                  <b className="text-[28px] text-[#0E5C38]">Pago de noviembre registrado</b>
                  <span className="text-[20px] text-[#3C4268]">{pesosAR(TOTAL)} · pagado el 18/11</span>
                </div>
              )}
            </div>
          </div>
        );
      },
    },
  ];
}

export function duracionPagoMonotributo() {
  return escenas().reduce((a, e) => a + e.dur, 0);
}

/** Cuadro del instante `t` (segundos) a 1280×720. */
export function EscenarioPagoMonotributo({ t }: { t: number }) {
  return <Cuadro t={t} lista={escenas()} />;
}
