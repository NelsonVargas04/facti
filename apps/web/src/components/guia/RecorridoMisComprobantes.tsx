'use client';

/**
 * Guía animada "Cómo sumar lo que facturaste fuera de Facti": bajar el archivo de "Mis Comprobantes –
 * Emitidos" en ARCA (12 meses, CSV o Excel) y subirlo a Facti. Recreación simplificada con números de
 * ejemplo. Mismo motor que las otras guías (Cuadro).
 */

import { Facti } from '@/components/Facti';
import { Boton, CabeceraArca, Campo, Cuadro, prog, tipear, type Escena } from '@/components/guia/RecorridoArca';

const pesosAR = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

const FILAS = [
  ['14/11/2026', '11 - Factura C', '00002-00000031', 'ESTUDIO SUR SRL', 420000],
  ['03/11/2026', '11 - Factura C', '00002-00000030', 'CONSUMIDOR FINAL', 85000],
  ['28/10/2026', '13 - Nota de Crédito C', '00002-00000004', 'ESTUDIO SUR SRL', -50000],
  ['21/10/2026', '11 - Factura C', '00002-00000029', 'LUMEN SA', 610000],
  ['09/10/2026', '11 - Factura C', '00002-00000028', 'CONSUMIDOR FINAL', 120000],
] as const;

function escenas(): Escena[] {
  return [
    // 0. Presentación
    {
      dur: 9,
      url: null,
      paso: 'Antes de empezar',
      texto: 'Si alguna vez facturaste desde la web de ARCA o con otra app, Facti no lo ve. Te muestro cómo sumarlo para que tus topes sean exactos.',
      pose: 'saludo',
      dibujar: (t) => (
        <div className="flex h-full items-center justify-center gap-14 bg-[#F2F5F9] px-20">
          <div style={{ opacity: prog(t, 0, 0.8), transform: `translateY(${(1 - prog(t, 0, 0.8)) * 16}px)` }}>
            <Facti pose="saludo" size={260} animated={false} />
          </div>
          <div className="flex max-w-[660px] flex-col gap-5" style={{ opacity: prog(t, 0.4, 1.4) }}>
            <span className="text-[22px] font-semibold text-[#3B3FD8]">Guía paso a paso</span>
            <h1 className="text-[56px] font-bold leading-[1.05] text-[#15193A]">Sumá lo que facturaste fuera de Facti</h1>
            <ol className="flex flex-col gap-3 text-[24px] text-[#3C4268]">
              {['Entrá a "Mis Comprobantes" en ARCA', 'Bajá los emitidos de los últimos 12 meses', 'Subí el archivo a Facti'].map((x, i) => (
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

    // 1. Entrar a ARCA
    {
      dur: 10,
      url: 'auth.afip.gob.ar/contribuyente_/login.xhtml',
      paso: 'Paso 1 · Entrá a ARCA',
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

    // 2. Buscar Mis Comprobantes
    {
      dur: 11,
      url: 'portalcf.cloud.afip.gob.ar/portal/app',
      paso: 'Paso 2 · Abrí "Mis Comprobantes"',
      texto: 'En el buscador escribí "Mis Comprobantes" y abrilo. Si no aparece, agregalo desde "Administrador de Relaciones" (es gratis).',
      pose: 'buscando',
      cursor: [
        { t: 0, x: 640, y: 400 },
        { t: 1.2, x: 640, y: 182, click: true },
        { t: 6.4, x: 640, y: 182 },
        { t: 7.4, x: 600, y: 246, click: true },
      ],
      dibujar: (t) => {
        const texto = tipear('Mis Comprobantes', t, 1.6, 5);
        return (
          <div className="flex h-full flex-col bg-[#F4F5F8]">
            <CabeceraArca />
            <div className="flex flex-col items-center gap-2 pt-9">
              <span className={`flex h-14 w-[760px] items-center gap-3 rounded-full border-2 bg-white px-6 text-[22px] ${t > 1.3 ? 'border-[#1C9AD6]' : 'border-[#C7CDDD]'}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6B7394" strokeWidth="2.4" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
                {texto ? <span className="text-[#15193A]">{texto}</span> : <span className="text-[#9AA3BF]">Buscá un servicio</span>}
              </span>
              {texto.length >= 6 && (
                <div className="w-[760px] overflow-hidden rounded-[12px] bg-white text-[21px] shadow-xl" style={{ opacity: prog(t, 3.4, 4) }}>
                  <div className={`px-6 py-3.5 font-bold text-[#1F2A5C] ${t > 7.2 ? 'bg-[#FFD25E]' : 'bg-[#EEF1F6]'}`}>Mis Comprobantes · Consulta de comprobantes emitidos y recibidos</div>
                </div>
              )}
            </div>
          </div>
        );
      },
    },

    // 3. Emitidos
    {
      dur: 9,
      url: 'fes.afip.gob.ar/mcmp/jsp/setearContribuyente.do',
      paso: 'Paso 3 · Elegí "Emitidos"',
      texto: 'Elegí tu nombre si te lo pregunta y después tocá "Emitidos": son las facturas que hiciste vos.',
      pose: 'senalando',
      cursor: [
        { t: 0, x: 900, y: 560 },
        { t: 3.4, x: 460, y: 330 },
        { t: 5.6, x: 460, y: 330, click: true },
      ],
      dibujar: (t) => (
        <div className="flex h-full flex-col bg-[#F4F5F8]">
          <CabeceraArca />
          <div className="flex flex-col items-center gap-6 pt-10">
            <b className="text-[28px] text-[#1F2A5C]">Mis Comprobantes</b>
            <div className="flex gap-8">
              {[
                ['Emitidos', 'Las facturas que hiciste'],
                ['Recibidos', 'Las facturas que te hicieron'],
              ].map(([k, v], i) => (
                <div
                  key={k}
                  className={`flex h-[190px] w-[320px] flex-col items-center justify-center gap-2 rounded-[14px] border-2 bg-white ${i === 0 && t > 3.2 ? 'border-[#1C9AD6] ring-4 ring-[#FFD25E]' : 'border-[#D9DEE8]'}`}
                  style={{ opacity: prog(t, 0.3 + i * 0.4, 1 + i * 0.4) }}
                >
                  <b className="text-[30px] text-[#1F2A5C]">{k}</b>
                  <span className="text-[19px] text-[#6B7394]">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    },

    // 4. Fechas
    {
      dur: 13,
      url: 'fes.afip.gob.ar/mcmp/jsp/comprobantesEmitidos.do',
      paso: 'Paso 4 · Elegí los últimos 12 meses',
      texto: 'En "Fecha del comprobante" elegí desde hace un año hasta hoy (ARCA deja hasta 365 días por vez) y tocá "Buscar".',
      pose: 'pensando',
      cursor: [
        { t: 0, x: 900, y: 560 },
        { t: 1.6, x: 520, y: 262, click: true },
        { t: 6.4, x: 520, y: 262 },
        { t: 7.8, x: 640, y: 396 },
        { t: 9.6, x: 640, y: 396, click: true },
      ],
      dibujar: (t) => (
        <div className="flex h-full flex-col bg-[#F4F5F8]">
          <CabeceraArca />
          <div className="flex justify-center pt-8">
            <div className="flex w-[760px] flex-col gap-5 rounded-[10px] bg-white p-8 shadow">
              <b className="text-[26px] text-[#1F2A5C]">Comprobantes emitidos</b>
              <div className="flex flex-col gap-2">
                <span className="text-[19px] font-bold text-[#3C4268]">Fecha del comprobante</span>
                <span className={`flex h-14 items-center rounded-[6px] border-2 px-5 text-[22px] ${t > 1.8 ? 'border-[#1C9AD6]' : 'border-[#C7CDDD]'}`}>
                  {tipear('01/12/2025 - 30/11/2026', t, 2.2, 6) || <span className="text-[#9AA3BF]">Elegí un rango</span>}
                </span>
              </div>
              <div className="flex flex-col gap-2 text-[19px] text-[#6B7394]">
                <span>Tipo de comprobante: Todos</span>
              </div>
              <div className="flex justify-center">
                <Boton celeste activo={t > 9.4}>Buscar</Boton>
              </div>
            </div>
          </div>
        </div>
      ),
    },

    // 5. Bajar el archivo
    {
      dur: 12,
      url: 'fes.afip.gob.ar/mcmp/jsp/comprobantesEmitidos.do',
      paso: 'Paso 5 · Bajá el archivo',
      texto: 'Vas a ver la lista. Arriba a la derecha tocá "CSV" o "Excel": cualquiera de los dos sirve. No lo abras ni lo cambies.',
      pose: 'factura',
      cursor: [
        { t: 0, x: 640, y: 560 },
        { t: 4.6, x: 1195, y: 158 },
        { t: 6.6, x: 1195, y: 158, click: true },
      ],
      dibujar: (t) => (
        <div className="flex h-full flex-col bg-[#F4F5F8]">
          <CabeceraArca />
          <div className="flex flex-col gap-3 px-12 pt-5">
            <div className="flex items-center justify-between">
              <b className="text-[24px] text-[#1F2A5C]">Resultados: 31 comprobantes</b>
              <div className="flex gap-2">
                <span className="rounded-[6px] border-2 border-[#D9DEE8] bg-white px-4 py-1.5 text-[18px] font-bold text-[#3C4268]">Excel</span>
                <span className={`rounded-[6px] border-2 bg-white px-4 py-1.5 text-[18px] font-bold ${t > 4.4 ? 'border-[#1C9AD6] text-[#1F2A5C] ring-4 ring-[#FFD25E]' : 'border-[#D9DEE8] text-[#3C4268]'}`}>CSV</span>
              </div>
            </div>
            <div className="overflow-hidden rounded-[8px] bg-white text-[17px]">
              <div className="grid grid-cols-[150px_250px_200px_1fr_150px] bg-[#1F2A5C] px-5 py-2.5 font-bold text-white">
                <span>Fecha</span>
                <span>Tipo</span>
                <span>Número</span>
                <span>Receptor</span>
                <span className="text-right">Imp. Total</span>
              </div>
              {FILAS.map((f, i) => (
                <div key={f[2]} className="grid grid-cols-[150px_250px_200px_1fr_150px] border-b border-[#EEF1F6] px-5 py-2.5 text-[#3C4268]" style={{ opacity: prog(t, 0.4 + i * 0.3, 0.9 + i * 0.3) }}>
                  <span>{f[0]}</span>
                  <span>{f[1]}</span>
                  <span>{f[2]}</span>
                  <span className="truncate">{f[3]}</span>
                  <span className="text-right font-bold text-[#15193A]">{pesosAR(Math.abs(f[4]))}</span>
                </div>
              ))}
            </div>
            {t > 7.4 && (
              <div className="self-end rounded-[10px] bg-[#15193A] px-5 py-3 text-[18px] text-white shadow-xl" style={{ opacity: prog(t, 7.4, 8) }}>
                Descargado: mis_comprobantes_emitidos.csv
              </div>
            )}
          </div>
        </div>
      ),
    },

    // 6. Subir a Facti
    {
      dur: 14,
      url: 'facti · Monotributo › Resumen',
      paso: 'Paso 6 · Subilo a Facti',
      texto: 'En Facti, en Monotributo › Resumen, tocá "Subir archivo" y elegí el que bajaste. Facti saltea los repetidos y los que ya hiciste con Facti.',
      pose: 'festejo',
      cursor: [
        { t: 0, x: 300, y: 500 },
        { t: 2.2, x: 640, y: 252, click: true },
      ],
      dibujar: (t) => {
        const leido = t > 4.4;
        const total = 14_350_000 + (leido ? 6_120_000 * prog(t, 5, 7) : 0);
        const tope = 24_670_494;
        return (
          <div className="flex h-full items-center justify-center bg-[#F2F5F9]">
            <div className="flex w-[760px] flex-col gap-6 rounded-[28px] bg-white p-9 shadow-[0_12px_32px_rgba(21,25,58,0.08)]">
              <div className={`flex flex-col items-center gap-3 rounded-[20px] border-[3px] border-dashed p-7 text-center ${leido ? 'border-[#1E9E63] bg-[#EAF8F0]' : 'border-[#B9BED3]'}`}>
                {!leido ? (
                  <>
                    <b className="text-[26px] text-[#15193A]">Subí el archivo de Mis Comprobantes</b>
                    <span className={`rounded-full bg-[#3B3FD8] px-6 py-3 text-[20px] font-bold text-white ${t > 2 ? 'ring-4 ring-[#FFD25E]' : ''}`}>Subir archivo</span>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2" style={{ opacity: prog(t, 4.4, 5.2) }}>
                    <b className="text-[26px] text-[#0E5C38]">✓ Listo: 23 comprobantes nuevos</b>
                    <span className="text-[19px] text-[#3C4268]">8 ya estaban en Facti, así que no se cuentan dos veces</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[21px] text-[#3C4268]">Últimos 12 meses</span>
                  <b className="text-[34px] text-[#15193A]">{pesosAR(Math.round(total))}</b>
                </div>
                <div className="h-5 overflow-hidden rounded-full bg-[#ECEDFF]">
                  <div className="h-full rounded-full bg-[#3B3FD8]" style={{ width: `${(total / tope) * 100}%` }} />
                </div>
                <span className="text-[19px] text-[#6B7394]">Tope de la categoría C: {pesosAR(tope)}</span>
              </div>
            </div>
          </div>
        );
      },
    },
  ];
}

export function duracionMisComprobantes() {
  return escenas().reduce((a, e) => a + e.dur, 0);
}

/** Cuadro del instante `t` (segundos) a 1280×720. */
export function EscenarioMisComprobantes({ t }: { t: number }) {
  return <Cuadro t={t} lista={escenas()} />;
}
