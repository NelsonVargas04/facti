'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cerrarSesion } from '@/lib/sesion';
import { AvisoApi } from '@/components/AvisoApi';
import { CargarPerfil } from '@/components/CargarPerfil';
import { Icon, type IconName } from '@/components/Icon';
import { UsoPlan } from '@/components/UsoPlan';
import { verCuenta, verEstadoArca } from '@/lib/api';
import { formatearCuit, nombrePropio } from '@/lib/formato';
import { useApi } from '@/lib/useApi';

const CONDICION: Record<string, string> = {
  monotributo: 'Monotributo',
  responsable_inscripto: 'Responsable inscripto',
  exento: 'Exento',
  consumidor_final: 'Sin inscripción en IVA',
  no_alcanzado: 'No alcanzado',
};

function iniciales(nombre: string) {
  const p = nombre.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || 'F';
}

function Tarjeta({ titulo, icono, children }: { titulo: string; icono: IconName; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
      <h2 className="flex items-center gap-2.5 text-[18px] font-bold">
          <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-primario-suave text-primario-oscuro">
            <Icon name={icono} size={19} />
          </span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Fila({ k, v }: { k: string; v?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt className="flex-none text-base text-texto-tenue">{k}</dt>
      <dd className={`min-w-0 text-right ${v ? 'font-semibold text-texto' : 'text-texto-tenue'}`}>
        {v || 'Sin cargar'}
      </dd>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex min-h-8 items-center rounded-full bg-fondo px-3 py-0.5 font-semibold text-texto-suave">{children}</span>;
}

export default function Configuracion() {
  const router = useRouter();
  const cuenta = useApi(verCuenta, []);
  const arca = useApi(verEstadoArca, []);
  const c = cuenta.dato?.cuenta;
  const plan = cuenta.dato?.plan;

  const servidores = arca.dato?.servidores;
  const conectado = !!servidores && Object.values(servidores).every((s) => s === 'OK');
  const pruebas = arca.dato?.entorno === 'homologacion';

  async function salir() {
    await cerrarSesion();
    router.replace('/ingresar');
  }

  return (
    <>
      <div className="aparece">
        <h1 className="text-[34px] font-bold">Configuración</h1>
        <p className="text-texto-suave">Tu perfil fiscal, la conexión con ARCA y tu plan.</p>
      </div>

      {cuenta.estado === 'error' && !c && <AvisoApi error={cuenta.error} onReintentar={cuenta.recargar} />}

      {c ? (
        <div className="cascada flex flex-col gap-6">
          {/* Quién sos */}
          <section className="flex flex-wrap items-center gap-5 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
            <span aria-hidden="true" className="hidden h-16 w-16 flex-none items-center justify-center rounded-[20px] sm:flex bg-facti font-display text-[22px] font-bold text-white">
              {iniciales(c.nombre || c.email)}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <h2 className="break-words text-[24px] font-bold leading-tight">{c.nombre ? nombrePropio(c.nombre) : 'Tu nombre todavía no está cargado'}</h2>
              <div className="flex flex-wrap gap-2">
                {c.cuit && <Chip>CUIT {formatearCuit(c.cuit)}</Chip>}
                {c.condicion && <Chip>{CONDICION[c.condicion] ?? c.condicion}{c.categoria && ` · Categoría ${c.categoria}`}</Chip>}
                <Chip>{c.email}</Chip>
              </div>
            </div>
          </section>

          {/* Faltan datos: se cargan acá mismo */}
          {!c.nombre && (
            <section className="flex flex-col gap-4 rounded-tarjeta bg-aviso-suave p-6">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-[12px] bg-white text-aviso-texto">
                  <Icon name="editar" size={19} />
                </span>
                <div>
                  <h2 className="text-[18px] font-bold">Completá tus datos fiscales</h2>
                  <p className="text-base text-texto-suave">
                    {pruebas
                      ? 'El padrón de pruebas de ARCA no tiene tus datos. Cargalos a mano para que salgan en tus facturas de prueba.'
                      : 'ARCA no nos pasó tus datos. Cargalos para que salgan en tus facturas.'}
                  </p>
                </div>
              </div>
              <CargarPerfil horizontal onGuardado={() => cuenta.recargar()} />
            </section>
          )}

          <div className="grid items-stretch gap-6 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
            <Tarjeta titulo="Datos fiscales" icono="cliente">
              <dl className="flex flex-col divide-y divide-[#EEF1F6]">
                <Fila k="Condición" v={c.condicion ? CONDICION[c.condicion] ?? c.condicion : ''} />
                <Fila k="Domicilio fiscal" v={c.domicilio} />
                <Fila k="Ingresos brutos" v={c.ingresosBrutos} />
                <Fila k="Inicio de actividades" v={c.inicioActividades && c.inicioActividades.split('-').reverse().join('/')} />
              </dl>
            </Tarjeta>

            <Tarjeta titulo="Conexión con ARCA" icono="arca">
              <dl className="flex flex-col divide-y divide-[#EEF1F6]">
                <div className="flex items-center justify-between gap-4 pb-3">
                  <dt className="text-base text-texto-tenue">Estado</dt>
                  <dd>
                    {arca.dato ? (
                      <span className={`inline-flex h-8 items-center gap-2 rounded-full px-3 font-bold ${conectado ? 'bg-exito-suave text-exito-texto' : 'bg-error-suave text-error'}`}>
                        <span className={`h-2 w-2 rounded-full ${conectado ? 'bg-exito' : 'bg-error'}`} />
                        {conectado ? 'Conectado' : 'Con problemas'}
                      </span>
                    ) : (
                      <span className="text-texto-tenue">{arca.estado === 'cargando' ? 'Revisando…' : 'Sin respuesta'}</span>
                    )}
                  </dd>
                </div>
                <Fila k="Punto de venta" v={String(c.puntoVenta).padStart(4, '0')} />
                <Fila k="Entorno" v={arca.dato ? (pruebas ? 'Pruebas' : 'Producción') : ''} />
              </dl>
              {pruebas && <p className="rounded-[14px] bg-fondo px-4 py-3 text-base text-texto-suave">Estás en el entorno de pruebas: las facturas no tienen validez fiscal.</p>}
              <Link href="/estado" className="btn-lift mt-auto flex h-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-borde font-bold text-texto hover:border-primario hover:text-primario-oscuro">
                Ver estado de la conexión
              </Link>
            </Tarjeta>

            {plan && <UsoPlan plan={plan} />}
          </div>
        </div>
      ) : (
        cuenta.estado === 'cargando' && (
          <div className="flex flex-col gap-6">
            <div className="skeleton h-[112px] rounded-tarjeta" />
            <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
              {[0, 1, 2].map((i) => <div key={i} className="skeleton h-[240px] rounded-tarjeta" />)}
            </div>
          </div>
        )
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base text-texto-tenue">Facti es una herramienta complementaria y de ayuda. No es ARCA ni un organismo oficial.</p>
        {/* En celular el menú no muestra la cuenta: desde acá se puede salir. En compu está en el menú. */}
        <button
          type="button"
          onClick={salir}
          className="btn-lift inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] border-borde bg-white px-5 text-base font-bold text-texto hover:border-error hover:text-error md:hidden"
        >
          <Icon name="salir" size={18} />
          Cerrar sesión
        </button>
      </div>
    </>
  );
}
