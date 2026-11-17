'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Facti } from '@/components/Facti';
import { AvisoApi } from '@/components/AvisoApi';
import { Stepper } from '@/components/Stepper';
import { CargarPerfil } from '@/components/CargarPerfil';
import { asignarCuit, verCuenta, type Cuenta, type ErrorApi } from '@/lib/api';
import { formatearCuit } from '@/lib/formato';
import { useApi } from '@/lib/useApi';

function Tilde({ size = 16, color = '#1E9E63' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

const CONDICION: Record<string, string> = {
  monotributo: 'Monotributo',
  responsable_inscripto: 'Responsable inscripto',
  exento: 'Exento',
  consumidor_final: 'Sin inscripción en IVA',
  no_alcanzado: 'No alcanzado',
};

export default function PerfilFiscal() {
  const actual = useApi(verCuenta, []);
  const [cuit, setCuit] = useState<string | null>(null); // null = todavía no escribió nada
  const [guardado, setGuardado] = useState<{ cuenta: Cuenta; padron: boolean } | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [error, setError] = useState<ErrorApi | null>(null);

  // Si ya había cargado el CUIT (volvió al onboarding), lo mostramos.
  const cuenta = guardado?.cuenta ?? (actual.dato?.cuenta.cuit ? actual.dato.cuenta : null);
  const cuitVisible = cuit ?? (cuenta ? formatearCuit(cuenta.cuit) : '');

  async function consultar() {
    setError(null);
    setConsultando(true);
    const r = await asignarCuit(cuitVisible);
    setConsultando(false);
    if (r.ok) setGuardado({ cuenta: r.dato.cuenta, padron: r.dato.padron });
    else setError(r);
  }

  return (
    <>
      <Stepper actual={1} />

      <div className="flex flex-wrap items-start gap-7">
        {/* Columna principal */}
        <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-6 rounded-tarjeta bg-superficie p-9 shadow-tarjeta">
          <div className="flex flex-col gap-1.5">
            <span className="text-base font-semibold text-texto-tenue">Paso 1 de 5</span>
            <h1 className="text-[34px] font-bold leading-tight">Cargá tu CUIT</h1>
            <p className="text-[17px] text-texto-suave">Con tu CUIT consultamos el padrón de ARCA y configuramos todo según tu situación. Por ahora Facti es para personas humanas: monotributo, responsable inscripto o exento.</p>
          </div>

          {/* CUIT + consultar */}
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void consultar();
            }}
          >
            <label className="flex flex-1 basis-[260px] flex-col gap-1.5 text-base font-semibold">
              Tu CUIT
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="20-12345678-9"
                value={cuitVisible}
                onChange={(e) => {
                  setCuit(e.target.value);
                  setGuardado(null);
                  setError(null);
                }}
                aria-invalid={error?.codigo === 'cuit_invalido'}
                className="h-12 w-full rounded-input border-[1.5px] border-borde bg-white px-4 text-base font-normal text-texto outline-none placeholder:text-[#9399B2] focus:border-primario"
              />
            </label>
            <button type="submit" disabled={consultando || cuitVisible.replace(/\D/g, '').length !== 11} className="btn-lift flex h-12 items-center gap-2 rounded-full bg-primario px-5 text-base font-bold text-white disabled:opacity-50 shadow-boton">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
              {consultando ? 'Consultando…' : 'Consultar en ARCA'}
            </button>
          </form>

          {error && <AvisoApi error={error} compacto />}

          {/* Resultado del padrón */}
          {cuenta && (
            <div key={cuenta.cuit} className="entra grid gap-3.5 rounded-[18px] bg-fondo p-5 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
              <div className="col-span-full flex items-center gap-2 text-base font-bold text-exito-texto">
                <Tilde />
                {cuenta.nombre ? 'Encontramos tus datos en el padrón de ARCA' : 'Guardamos tu CUIT. Tus datos se completan cuando conectes Facti con ARCA.'}
              </div>
              {(
                [
                  ['CUIT', formatearCuit(cuenta.cuit)],
                  ['Nombre', cuenta.nombre],
                  ['Condición', [CONDICION[cuenta.condicion] ?? cuenta.condicion, cuenta.categoria && `Categoría ${cuenta.categoria}`].filter(Boolean).join(' · ')],
                  ['Domicilio fiscal', cuenta.domicilio],
                ] as const
              )
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <div className="text-base text-texto-tenue">{k}</div>
                    <strong>{v}</strong>
                  </div>
                ))}
            </div>
          )}

          {cuenta && !cuenta.nombre && <CargarPerfil onGuardado={(c) => setGuardado({ cuenta: c, padron: false })} />}

          {/* Qué podés emitir */}
          <div className="flex flex-col gap-2.5">
            <h2 className="text-[20px] font-bold">Con tu perfil vas a poder emitir</h2>
            <ul className="flex flex-col gap-2">
              {[
                ['Factura C', 'Para todos tus clientes'],
                ['Notas de crédito y débito C', 'Para corregir o anular'],
                ['Factura E', 'Si exportás servicios o bienes'],
              ].map(([t, d]) => (
                <li key={t} className="flex items-center gap-2.5">
                  <span className="text-exito"><Tilde /></span>
                  <span><strong>{t}</strong> · <span className="text-texto-suave">{d}</span></span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            {cuenta ? (
              <Link href="/onboarding/arca" className="btn-lift flex h-12 items-center rounded-full bg-primario px-7 font-bold text-white shadow-boton">
                {cuenta.nombre ? 'Sí, soy yo. Continuar' : 'Continuar'}
              </Link>
            ) : (
              <span aria-disabled="true" className="flex h-[52px] items-center rounded-full bg-primario px-7 font-bold text-white opacity-50">
                Cargá tu CUIT para seguir
              </span>
            )}
          </div>
        </section>

        {/* Aside */}
        <aside className="flex min-w-0 flex-1 basis-[320px] flex-col gap-5">
          <div className="flex flex-col items-center gap-2 rounded-tarjeta bg-superficie p-7 text-center shadow-tarjeta">
            <div className="f-pop rounded-[20px_20px_20px_6px] bg-texto px-4 py-3 text-base font-bold leading-snug text-white">
              Vas a necesitar tu<br /><span className="text-acento">clave fiscal nivel 3</span>.
            </div>
            <Facti pose="buscando" size={190} animated />
          </div>
        </aside>
      </div>
    </>
  );
}
