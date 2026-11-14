'use client';

/**
 * Guía animada "Conectá Facti con ARCA": una recreación simplificada de las pantallas de ARCA con un
 * cursor que hace cada paso, a ritmo lento y con subtítulos grandes.
 *
 * Todo depende del tiempo `t` (segundos): la misma función dibuja el reproductor de la app y cada
 * cuadro del MP4 (scripts/grabar-guia-arca.mjs llama a window.__irA(t) y saca una captura).
 * Si ARCA cambia sus pantallas, se corrigen acá y se vuelve a grabar.
 */

import type { ReactNode } from 'react';
import { Facti, type PoseFacti } from '@/components/Facti';

export const ANCHO = 1280;
export const ALTO = 720;

// ---------- utilidades de tiempo ----------

const lim = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
/** Progreso 0..1 de `a` a `b`, con salida suave. */
const prog = (t: number, a: number, b: number) => {
  const p = lim((t - a) / (b - a));
  return 1 - Math.pow(1 - p, 3);
};
/** Texto que se va escribiendo desde `desde`, a `cps` letras por segundo. */
const tipear = (texto: string, t: number, desde: number, cps = 9) => texto.slice(0, Math.max(0, Math.floor((t - desde) * cps)));

type Punto = { t: number; x: number; y: number; click?: boolean };

/** Posición del cursor interpolando entre puntos (con curva suave). */
function cursorEn(puntos: Punto[], t: number) {
  if (!puntos.length) return null;
  let a = puntos[0]!;
  for (const p of puntos) if (p.t <= t) a = p;
  const i = puntos.indexOf(a);
  const b = puntos[i + 1];
  if (!b || t <= a.t) return { x: a.x, y: a.y };
  const k = prog(t, a.t, b.t);
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

// ---------- piezas visuales ----------

const AZUL_ARCA = '#1F2A5C';
const CELESTE_ARCA = '#1C9AD6';

function BarraNavegador({ url }: { url: string }) {
  return (
    <div className="flex h-[52px] items-center gap-3 border-b border-[#D9DEE8] bg-[#EEF1F6] px-5">
      <div className="flex gap-2">
        <span className="h-3.5 w-3.5 rounded-full bg-[#FF6B6B]" />
        <span className="h-3.5 w-3.5 rounded-full bg-[#FFC94D]" />
        <span className="h-3.5 w-3.5 rounded-full bg-[#4CD07D]" />
      </div>
      <div className="flex h-9 flex-1 items-center gap-2 rounded-full bg-white px-4 text-[17px] text-[#3C4268] shadow-[inset_0_0_0_1px_#DCE1EA]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E9E63" strokeWidth="2.4" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
        {url}
      </div>
    </div>
  );
}

function CabeceraArca({ nombre = true }: { nombre?: boolean }) {
  return (
    <div className="flex h-[64px] items-center justify-between px-10" style={{ background: AZUL_ARCA }}>
      <div className="flex items-center gap-3 text-white">
        <span className="text-[30px] font-extrabold tracking-wide">ARCA</span>
        <span className="h-7 w-px bg-white/40" />
        <span className="text-[12px] leading-tight text-white/80">AGENCIA DE RECAUDACIÓN<br />Y CONTROL ADUANERO</span>
      </div>
      {nombre && <span className="text-[15px] font-semibold text-white/90">TU NOMBRE (20-12345678-6)</span>}
    </div>
  );
}

function Boton({ children, activo = false, celeste = false }: { children: ReactNode; activo?: boolean; celeste?: boolean }) {
  return (
    <span
      className={`inline-flex h-11 items-center justify-center rounded-[6px] px-6 text-[17px] font-bold transition-none ${
        celeste ? 'text-white' : 'border border-[#9AA3BF] bg-white text-[#1F2A5C]'
      } ${activo ? 'ring-4 ring-[#FFD25E]' : ''}`}
      style={celeste ? { background: CELESTE_ARCA } : undefined}
    >
      {children}
    </span>
  );
}

function Campo({ etiqueta, valor, placeholder, enfocado = false, ancho = 420 }: { etiqueta?: string; valor: string; placeholder?: string; enfocado?: boolean; ancho?: number }) {
  return (
    <div className="flex flex-col gap-1.5" style={{ width: ancho }}>
      {etiqueta && <span className="text-[15px] font-bold text-[#3C4268]">{etiqueta}</span>}
      <span className={`flex h-12 items-center rounded-[6px] border bg-white px-4 text-[20px] ${enfocado ? 'border-[#1C9AD6] ring-4 ring-[#1C9AD6]/20' : 'border-[#B8C0D6]'}`}>
        {valor ? <span className="text-[#15193A]">{valor}</span> : <span className="text-[#9AA3BF]">{placeholder}</span>}
        {enfocado && <span className="ml-0.5 inline-block h-6 w-[2px] bg-[#15193A]" />}
      </span>
    </div>
  );
}

// ---------- escenas ----------

type Escena = {
  dur: number;
  url: string | null; // null = pantalla de Facti (sin navegador)
  paso: string; // "Paso 1 de 6"
  texto: string; // subtítulo grande
  pose?: PoseFacti;
  cursor?: Punto[];
  dibujar: (t: number) => ReactNode;
};

function escenas(cuitFacti: string): Escena[] {
  const CUIT_EJEMPLO = '20-12345678-6';
  return [
    // 0. Presentación
    {
      dur: 7,
      url: null,
      paso: 'Antes de empezar',
      texto: 'Se hace una sola vez y tarda unos 2 minutos. Facti nunca te pide tu clave fiscal.',
      pose: 'saludo',
      dibujar: (t) => (
        <div className="flex h-full items-center justify-center gap-14 bg-[#F2F5F9] px-20">
          <div style={{ opacity: prog(t, 0, 0.8), transform: `translateY(${(1 - prog(t, 0, 0.8)) * 16}px)` }}>
            <Facti pose="saludo" size={260} animated={false} />
          </div>
          <div className="flex max-w-[600px] flex-col gap-5" style={{ opacity: prog(t, 0.4, 1.4) }}>
            <span className="text-[22px] font-semibold text-[#3B3FD8]">Guía paso a paso</span>
            <h1 className="text-[64px] font-bold leading-[1.05] text-[#15193A]">Conectá Facti con ARCA</h1>
            <ol className="flex flex-col gap-3 text-[24px] text-[#3C4268]">
              {['Entrás a ARCA con tu clave fiscal', 'Autorizás a Facti a facturar por vos', 'Creás un punto de venta Web Services'].map((x, i) => (
                <li key={x} className="flex items-center gap-3" style={{ opacity: prog(t, 1.6 + i * 0.7, 2.4 + i * 0.7) }}>
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#ECEDFF] text-[20px] font-bold text-[#2A2DB0]">{i + 1}</span>
                  {x}
                </li>
              ))}
            </ol>
          </div>
        </div>
      ),
    },

    // 1. Ingresar a ARCA
    {
      dur: 11,
      url: 'auth.afip.gob.ar/contribuyente_/login.xhtml',
      paso: 'Paso 1 · Entrá a ARCA',
      texto: 'Entrá a arca.gob.ar con tu CUIT y tu clave fiscal (nivel 3). La clave la escribís solo vos.',
      pose: 'senalando',
      cursor: [
        { t: 0, x: 900, y: 600 },
        { t: 1.2, x: 640, y: 330, click: true },
        { t: 4.6, x: 640, y: 330 },
        { t: 5.4, x: 640, y: 405, click: true },
        { t: 8.6, x: 640, y: 405 },
        { t: 9.3, x: 640, y: 405, click: true },
      ],
      dibujar: (t) => {
        const enClave = t >= 5.6;
        return (
          <div className="flex h-full flex-col bg-[#2B376E]">
            <CabeceraArca nombre={false} />
            <div className="flex flex-1 items-center justify-center">
              <div className="flex w-[480px] flex-col items-center gap-5 rounded-[10px] bg-[#F4F5F8] p-9 shadow-2xl">
                <span className="flex items-center gap-2 text-[24px] font-semibold text-[#1F2A5C]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                  Ingresar con Clave Fiscal
                </span>
                {!enClave ? (
                  <>
                    <Campo etiqueta="CUIT/CUIL" valor={tipear(CUIT_EJEMPLO, t, 1.6, 7)} placeholder="" enfocado={t > 1.3} />
                    <Boton celeste activo={t > 5.2 && t < 5.8}>Siguiente</Boton>
                  </>
                ) : (
                  <>
                    <Campo etiqueta="TU CLAVE" valor={'•'.repeat(Math.min(10, Math.max(0, Math.floor((t - 6) * 4))))} enfocado={t < 9.2} />
                    <Boton celeste activo={t > 9.1}>Ingresar</Boton>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      },
    },

    // 2. Buscar el Administrador de Relaciones
    {
      dur: 10,
      url: 'portalcf.cloud.afip.gob.ar/portal/app',
      paso: 'Paso 2 · Abrí el Administrador de Relaciones',
      texto: 'En el buscador escribí "Administrador de relaciones" y abrilo. Ahí se dan los permisos.',
      pose: 'buscando',
      cursor: [
        { t: 0, x: 640, y: 400 },
        { t: 1.2, x: 640, y: 182, click: true },
        { t: 6.2, x: 640, y: 182 },
        { t: 7.2, x: 560, y: 246, click: true },
      ],
      dibujar: (t) => (
        <div className="flex h-full flex-col bg-white">
          <CabeceraArca />
          <div className="flex flex-col items-center gap-0 pt-12">
            <div className="w-[760px]">
              <Campo valor={tipear('Administrador de relaciones', t, 1.6, 6)} placeholder="¿Qué necesitás? | Buscá trámites y servicios" enfocado={t > 1.3 && t < 7.4} ancho={760} />
              {t > 5.4 && (
                <div className={`mt-1 rounded-[6px] border border-[#D9DEE8] bg-white px-5 py-4 shadow-lg ${t > 7.1 ? 'ring-4 ring-[#FFD25E]' : ''}`} style={{ opacity: prog(t, 5.4, 6) }}>
                  <div className="text-[20px] font-semibold text-[#1F2A5C]">Administrador de Relaciones de Clave Fiscal</div>
                  <div className="text-[15px] text-[#6B7394]">Gestioná quién puede actuar en tu nombre en los servicios de ARCA</div>
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    },

    // 3. Nueva relación
    {
      dur: 8,
      url: 'auth.afip.gob.ar/contribuyente_/adminrel',
      paso: 'Paso 3 · Tocá "Nueva relación"',
      texto: 'Vas a ver tus relaciones actuales. Tocá el botón "Nueva Relación".',
      pose: 'senalando',
      cursor: [
        { t: 0, x: 560, y: 246 },
        { t: 2.4, x: 960, y: 446, click: true },
      ],
      dibujar: (t) => (
        <div className="flex h-full flex-col bg-white">
          <CabeceraArca />
          <div className="flex flex-col gap-6 px-16 pt-8">
            <h2 className="text-[30px] font-bold text-[#1F2A5C]">Administrador de Relaciones de Clave Fiscal</h2>
            <div className="rounded-[8px] border border-[#D9DEE8] p-6 text-[19px] text-[#3C4268]">
              <div><b>Contribuyente:</b> TU NOMBRE · CUIT 20-12345678-6</div>
              <div className="mt-2 text-[16px] text-[#6B7394]">Relaciones vigentes: se muestran acá las personas y sistemas que pueden actuar en tu nombre.</div>
            </div>
            <div className="flex justify-end gap-4">
              <Boton>Consultar</Boton>
              <Boton celeste activo={t > 2.3}>Nueva Relación</Boton>
            </div>
          </div>
        </div>
      ),
    },

    // 4. Elegir el servicio
    {
      dur: 14,
      url: 'auth.afip.gob.ar/contribuyente_/adminrel/nueva',
      paso: 'Paso 4 · Elegí el servicio',
      texto: 'Tocá "Buscar" en Servicio, elegí ARCA › WebServices › "Facturación Electrónica".',
      pose: 'pensando',
      cursor: [
        { t: 0, x: 960, y: 446 },
        { t: 1.6, x: 900, y: 232, click: true },
        { t: 3.6, x: 900, y: 232 },
        { t: 4.6, x: 420, y: 380, click: true },
        { t: 6.8, x: 420, y: 380 },
        { t: 7.8, x: 700, y: 362, click: true },
        { t: 9.6, x: 700, y: 362 },
        { t: 10.6, x: 720, y: 426, click: true },
      ],
      dibujar: (t) => {
        const elegido = t > 11;
        return (
          <div className="relative flex h-full flex-col bg-white">
            <CabeceraArca />
            <div className="flex flex-col gap-5 px-16 pt-8">
              <h2 className="text-[30px] font-bold text-[#1F2A5C]">Incorporar nueva relación</h2>
              <div className="flex items-center gap-4 text-[20px]">
                <b className="w-[160px] text-[#3C4268]">Servicio</b>
                <span className={`flex h-12 w-[520px] items-center rounded-[6px] border px-4 ${elegido ? 'border-[#1E9E63] bg-[#EAF8F0] font-semibold text-[#0E5C38]' : 'border-[#B8C0D6] text-[#9AA3BF]'}`}>
                  {elegido ? 'ARCA › WebServices › Facturación Electrónica' : 'Elegí un servicio'}
                </span>
                <Boton activo={t > 1.5 && t < 2}>Buscar</Boton>
              </div>
              <div className="flex items-center gap-4 text-[20px] opacity-50">
                <b className="w-[160px] text-[#3C4268]">Representante</b>
                <span className="flex h-12 w-[520px] items-center rounded-[6px] border border-[#B8C0D6] px-4 text-[#9AA3BF]">—</span>
              </div>
            </div>
            {t > 1.9 && t < 11 && (
              <div className="absolute inset-x-16 top-[150px] rounded-[10px] border border-[#D9DEE8] bg-white p-6 shadow-2xl" style={{ opacity: prog(t, 1.9, 2.4) }}>
                <div className="mb-4 text-[18px] font-semibold text-[#3C4268]">¿De qué organismo es el servicio?</div>
                <div className="flex gap-6">
                  <div className={`flex h-[120px] w-[200px] flex-col items-center justify-center rounded-[8px] border text-[22px] font-extrabold text-white ${t > 4.5 ? 'ring-4 ring-[#FFD25E]' : ''}`} style={{ background: AZUL_ARCA }}>
                    ARCA
                    <span className="text-[13px] font-normal text-white/80">Agencia de Recaudación</span>
                  </div>
                  {t > 4.9 && (
                    <div className="flex flex-1 flex-col gap-2 text-[19px]" style={{ opacity: prog(t, 4.9, 5.5) }}>
                      <div className="text-[16px] text-[#6B7394]">Tipos de servicio</div>
                      <div className="rounded-[6px] border border-[#D9DEE8] px-4 py-2">Servicios interactivos</div>
                      <div className={`rounded-[6px] border px-4 py-2 font-semibold ${t > 7.7 ? 'border-[#1C9AD6] bg-[#E8F5FC] text-[#1F2A5C]' : 'border-[#D9DEE8]'}`}>WebServices ▾</div>
                      {t > 8.1 && (
                        <div className="ml-6 flex flex-col gap-1.5" style={{ opacity: prog(t, 8.1, 8.6) }}>
                          <div className={`rounded-[6px] px-4 py-2 font-bold ${t > 10.5 ? 'bg-[#FFD25E] text-[#15193A]' : 'bg-[#F4F5F8]'}`}>Facturación Electrónica</div>
                          <div className="rounded-[6px] bg-[#F4F5F8] px-4 py-2 text-[#6B7394]">Factura Electrónica de Exportación</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      },
    },

    // 5. Representante = Facti
    {
      dur: 14,
      url: 'auth.afip.gob.ar/contribuyente_/adminrel/nueva',
      paso: 'Paso 5 · Poné a Facti como representante',
      texto: `En "Representante" tocá "Buscar" y escribí el CUIT de Facti: ${cuitFacti}. Después, "Confirmar".`,
      pose: 'factura',
      cursor: [
        { t: 0, x: 720, y: 426 },
        { t: 1.4, x: 1110, y: 296, click: true },
        { t: 3, x: 1110, y: 296 },
        { t: 3.8, x: 560, y: 352, click: true },
        { t: 8, x: 560, y: 352 },
        { t: 8.8, x: 880, y: 352, click: true },
        { t: 10.4, x: 880, y: 352 },
        { t: 11.4, x: 1000, y: 460, click: true },
      ],
      dibujar: (t) => {
        const listo = t > 9.4;
        return (
          <div className="relative flex h-full flex-col bg-white">
            <CabeceraArca />
            <div className="flex flex-col gap-5 px-16 pt-8">
              <h2 className="text-[30px] font-bold text-[#1F2A5C]">Incorporar nueva relación</h2>
              <div className="flex items-center gap-4 text-[20px]">
                <b className="w-[160px] text-[#3C4268]">Servicio</b>
                <span className="flex h-12 w-[520px] items-center rounded-[6px] border border-[#1E9E63] bg-[#EAF8F0] px-4 font-semibold text-[#0E5C38]">ARCA › WebServices › Facturación Electrónica</span>
              </div>
              <div className="flex items-center gap-4 text-[20px]">
                <b className="w-[160px] text-[#3C4268]">Representante</b>
                <span className={`flex h-12 w-[520px] items-center rounded-[6px] border px-4 ${listo ? 'border-[#1E9E63] bg-[#EAF8F0] font-semibold text-[#0E5C38]' : 'border-[#B8C0D6] text-[#9AA3BF]'}`}>
                  {listo ? `FACTI · CUIT ${cuitFacti}` : 'Elegí al representante'}
                </span>
                <Boton activo={t > 1.3 && t < 1.8}>Buscar</Boton>
              </div>
              <div className="flex justify-end">
                <Boton celeste activo={t > 11.3}>Confirmar</Boton>
              </div>
            </div>
            {t > 1.8 && t < 9.4 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30" style={{ opacity: prog(t, 1.8, 2.2) }}>
                <div className="flex w-[640px] flex-col gap-5 rounded-[10px] bg-white p-8 shadow-2xl">
                  <div className="text-[22px] font-bold text-[#1F2A5C]">Buscar representante</div>
                  <div className="flex items-end gap-4">
                    <Campo etiqueta="CUIT/CUIL del representante" valor={tipear(cuitFacti, t, 4.2, 6)} enfocado={t > 3.7 && t < 8.7} ancho={420} />
                    <Boton celeste activo={t > 8.7}>Buscar</Boton>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      },
    },

    // 6. Constancia
    {
      dur: 8,
      url: 'auth.afip.gob.ar/contribuyente_/adminrel/f3283',
      paso: '¡Listo el permiso!',
      texto: 'ARCA te muestra el formulario 3283 como constancia. Podés quitarle el permiso a Facti cuando quieras desde el mismo lugar.',
      pose: 'ok',
      dibujar: (t) => (
        <div className="flex h-full flex-col bg-white">
          <CabeceraArca />
          <div className="flex flex-1 items-center justify-center">
            <div className="flex w-[760px] flex-col gap-4 rounded-[10px] border-2 border-[#1E9E63] bg-[#F3FBF7] p-9" style={{ opacity: prog(t, 0.2, 0.9), transform: `scale(${0.96 + 0.04 * prog(t, 0.2, 0.9)})` }}>
              <div className="flex items-center gap-4 text-[30px] font-bold text-[#0E5C38]">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1E9E63] text-[30px] text-white">✓</span>
                Relación generada
              </div>
              <div className="text-[19px] leading-relaxed text-[#3C4268]">
                <div><b>Formulario:</b> F. 3283 – Autorización de relación</div>
                <div><b>Servicio:</b> Facturación Electrónica</div>
                <div><b>Representante:</b> FACTI · CUIT {cuitFacti}</div>
              </div>
            </div>
          </div>
        </div>
      ),
    },

    // 7. Exportación (opcional)
    {
      dur: 7,
      url: null,
      paso: 'Solo si vendés al exterior',
      texto: 'Si hacés Factura E, repetí los pasos 3 a 5 eligiendo "Factura Electrónica de Exportación".',
      pose: 'pensando',
      dibujar: (t) => (
        <div className="flex h-full items-center justify-center gap-10 bg-[#F2F5F9] px-20">
          <div className="flex w-[640px] flex-col gap-4 rounded-[24px] bg-white p-9 shadow-[0_20px_50px_rgba(21,25,58,0.12)]" style={{ opacity: prog(t, 0, 0.8) }}>
            <span className="text-[20px] font-semibold text-[#6B7394]">Servicios para autorizar a Facti</span>
            <div className="flex items-center justify-between rounded-[14px] bg-[#EAF8F0] px-5 py-4 text-[22px]"><b>Facturación Electrónica</b><span className="font-bold text-[#0E5C38]">✓ Hecho</span></div>
            <div className={`flex items-center justify-between rounded-[14px] px-5 py-4 text-[22px] ${t > 1.6 ? 'bg-[#FFF3D1]' : 'bg-[#F4F5F8]'}`}><b>Factura Electrónica de Exportación</b><span className="font-bold text-[#7A5200]">Solo para Factura E</span></div>
          </div>
          <Facti pose="pensando" size={200} animated={false} />
        </div>
      ),
    },

    // 8. Punto de venta
    {
      dur: 16,
      url: 'serviciosweb.afip.gob.ar/genericos/puntosDeVenta',
      paso: 'Paso 6 · Creá un punto de venta Web Services',
      texto: 'Buscá "Administración de puntos de venta", tocá "Agregar" y elegí "Factura Electrónica - Monotributo - Web Services".',
      pose: 'senalando',
      cursor: [
        { t: 0, x: 640, y: 500 },
        { t: 1.6, x: 1080, y: 230, click: true },
        { t: 3.4, x: 1080, y: 230 },
        { t: 4.4, x: 640, y: 300, click: true },
        { t: 7.6, x: 640, y: 300 },
        { t: 8.6, x: 640, y: 386, click: true },
        { t: 10.4, x: 640, y: 386 },
        { t: 11.2, x: 640, y: 442, click: true },
        { t: 13, x: 640, y: 442 },
        { t: 13.8, x: 1040, y: 560, click: true },
      ],
      dibujar: (t) => {
        const formulario = t > 2;
        const sistemaAbierto = t > 8.8 && t < 11.4;
        const sistema = t > 11.4 ? 'Factura Electrónica - Monotributo - Web Services' : '';
        return (
          <div className="relative flex h-full flex-col bg-white">
            <CabeceraArca />
            <div className="flex flex-col gap-5 px-16 pt-7">
              <div className="flex items-center justify-between">
                <h2 className="text-[28px] font-bold text-[#1F2A5C]">Administración de puntos de venta y domicilios</h2>
                {!formulario && <Boton celeste activo={t > 1.5}>Agregar</Boton>}
              </div>
              {formulario && (
                <div className="flex flex-col gap-4" style={{ opacity: prog(t, 2, 2.6) }}>
                  <div className="flex items-center gap-4 text-[20px]">
                    <b className="w-[200px] text-[#3C4268]">Número</b>
                    <span className={`flex h-12 w-[200px] items-center rounded-[6px] border px-4 ${t > 4.3 && t < 8.5 ? 'border-[#1C9AD6] ring-4 ring-[#1C9AD6]/20' : 'border-[#B8C0D6]'}`}>{tipear('00002', t, 4.8, 4)}</span>
                    <span className="text-[16px] text-[#6B7394]">Uno que no uses en otro sistema</span>
                  </div>
                  <div className="relative flex items-center gap-4 text-[20px]">
                    <b className="w-[200px] text-[#3C4268]">Sistema</b>
                    <span className={`flex h-12 w-[620px] items-center justify-between rounded-[6px] border px-4 ${sistema ? 'border-[#1E9E63] bg-[#EAF8F0] font-semibold text-[#0E5C38]' : 'border-[#B8C0D6] text-[#9AA3BF]'}`}>
                      {sistema || 'Elegí el sistema de facturación'} <span>▾</span>
                    </span>
                    {sistemaAbierto && (
                      <div className="absolute left-[216px] top-[54px] z-10 w-[620px] rounded-[6px] border border-[#D9DEE8] bg-white text-[18px] shadow-xl">
                        <div className="px-4 py-2.5 text-[#6B7394]">Comprobantes en línea</div>
                        <div className={`px-4 py-2.5 font-bold ${t > 11 ? 'bg-[#FFD25E]' : 'bg-[#F4F5F8]'}`}>Factura Electrónica - Monotributo - Web Services</div>
                        <div className="px-4 py-2.5 text-[#6B7394]">RECE para aplicativo y web services (responsable inscripto)</div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-[20px]">
                    <b className="w-[200px] text-[#3C4268]">Domicilio</b>
                    <span className="flex h-12 w-[620px] items-center rounded-[6px] border border-[#B8C0D6] px-4 text-[#3C4268]">Tu domicilio fiscal</span>
                  </div>
                  <div className="flex justify-end pr-[72px]">
                    <Boton celeste activo={t > 13.7}>Aceptar</Boton>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      },
    },

    // 9. Volver a Facti
    {
      dur: 9,
      url: 'facti · Conectar con ARCA',
      paso: 'Último paso · Volvé a Facti',
      texto: 'Volvé a Facti y tocá "Verificar y seguir". Facti revisa con ARCA que todo quedó bien. ¡Listo para facturar!',
      pose: 'festejo',
      cursor: [
        { t: 0, x: 640, y: 560 },
        { t: 2, x: 640, y: 420, click: true },
      ],
      dibujar: (t) => {
        const ok = t > 3.2;
        return (
          <div className="flex h-full items-center justify-center gap-12 bg-[#F2F5F9] px-20">
            <div className="flex w-[620px] flex-col items-center gap-6 rounded-[28px] bg-white p-10 text-center shadow-[0_20px_50px_rgba(21,25,58,0.12)]">
              {!ok ? (
                <>
                  <h2 className="text-[36px] font-bold text-[#15193A]">Autorizá a Facti para facturar por vos</h2>
                  <span className={`inline-flex h-16 items-center rounded-full bg-[#3B3FD8] px-10 text-[24px] font-bold text-white shadow-[0_10px_24px_rgba(59,63,216,0.35)] ${t > 1.9 ? 'ring-4 ring-[#FFD25E]' : ''}`}>Verificar y seguir</span>
                </>
              ) : (
                <div className="flex flex-col items-center gap-4" style={{ opacity: prog(t, 3.2, 4), transform: `scale(${0.94 + 0.06 * prog(t, 3.2, 4)})` }}>
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#1E9E63] text-[44px] text-white">✓</span>
                  <h2 className="text-[40px] font-bold text-[#0E5C38]">¡Todo conectado!</h2>
                  <p className="text-[22px] text-[#3C4268]">Ya podés emitir tu primera factura desde Facti.</p>
                </div>
              )}
            </div>
            <Facti pose={ok ? 'festejo' : 'senalando'} size={220} animated={false} />
          </div>
        );
      },
    },
  ];
}

export function duracionTotal(cuitFacti: string) {
  return escenas(cuitFacti).reduce((a, e) => a + e.dur, 0);
}

/** Dibuja el cuadro del instante `t` (en segundos) a 1280×720. */
export function Escenario({ t, cuitFacti }: { t: number; cuitFacti: string }) {
  const lista = escenas(cuitFacti);
  let inicio = 0;
  let e = lista[lista.length - 1]!;
  for (const x of lista) {
    if (t < inicio + x.dur) {
      e = x;
      break;
    }
    inicio += x.dur;
  }
  const lt = Math.max(0, t - inicio);
  const c = e.cursor ? cursorEn(e.cursor, lt) : null;
  // Pulso de clic: 0.45 s después de cada punto marcado como clic.
  const clic = e.cursor?.find((p) => p.click && lt >= p.t && lt < p.t + 0.45);
  // Cada escena entra con un fundido corto desde el fondo claro (sin destellos oscuros entre escenas).
  const fundido = prog(lt, 0, 0.35);
  const total = lista.reduce((a, x) => a + x.dur, 0);

  return (
    <div className="relative overflow-hidden bg-[#F2F5F9] font-sans" style={{ width: ANCHO, height: ALTO }}>
      {/* Pantalla */}
      <div className="absolute left-0 right-0 top-0 overflow-hidden" style={{ height: 556, opacity: fundido }}>
        {e.url && <BarraNavegador url={e.url} />}
        <div className="absolute inset-x-0 bottom-0" style={{ top: e.url ? 52 : 0 }}>
          {e.dibujar(lt)}
        </div>
        {c && (
          <div className="pointer-events-none absolute" style={{ left: c.x, top: c.y + (e.url ? 0 : 0) }}>
            {clic && (
              <span
                className="absolute rounded-full border-4 border-[#FFD25E]"
                style={{
                  width: 20 + 50 * prog(lt, clic.t, clic.t + 0.45),
                  height: 20 + 50 * prog(lt, clic.t, clic.t + 0.45),
                  left: -(10 + 25 * prog(lt, clic.t, clic.t + 0.45)),
                  top: -(10 + 25 * prog(lt, clic.t, clic.t + 0.45)),
                  opacity: 1 - prog(lt, clic.t, clic.t + 0.45),
                }}
              />
            )}
            <svg width="34" height="34" viewBox="0 0 24 24" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))' }}>
              <path d="M4 2l15 9.5-6.5 1.2 3.8 7.3-2.6 1.4-3.8-7.3L5 19z" fill="#15193A" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>

      {/* Subtítulo */}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-5 bg-white px-8" style={{ height: 164 }}>
        <div className="flex-none">
          <Facti pose={e.pose ?? 'saludo'} size={120} animated={false} />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[20px] font-bold text-[#3B3FD8]">{e.paso}</span>
          <span className="text-[27px] font-semibold leading-snug text-[#15193A]">{e.texto}</span>
        </div>
        {/* Progreso */}
        <div className="absolute inset-x-0 top-0 h-[5px] bg-[#ECEFF5]">
          <div className="h-full bg-[#3B3FD8]" style={{ width: `${(t / total) * 100}%` }} />
        </div>
      </div>
      {e.url?.includes('afip.gob.ar') && (
        <span className="absolute right-4 top-[12px] rounded-full bg-[#15193A]/70 px-3 py-1 text-[13px] text-white">Recreación simplificada de la web de ARCA</span>
      )}
    </div>
  );
}
