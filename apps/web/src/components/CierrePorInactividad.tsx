'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { cerrarSesion } from '@/lib/sesion';

/**
 * Cierra la sesión después de 10 minutos sin actividad (Facti muestra datos fiscales). Un minuto antes
 * avisa con un cartel para seguir conectado. La última actividad se guarda en el navegador, así vale
 * para todas las pestañas abiertas y también si cerraste la pestaña y volviste más tarde.
 */
const LIMITE_MS = 10 * 60 * 1000;
const AVISO_MS = 60 * 1000;
const CLAVE = 'facti.ultimaActividad';

function leer(): number | null {
  try {
    const v = Number(localStorage.getItem(CLAVE));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function guardar(t: number) {
  try {
    localStorage.setItem(CLAVE, String(t));
  } catch {
    /* sin almacenamiento: se usa solo la memoria de esta pestaña */
  }
}

export function CierrePorInactividad() {
  const router = useRouter();
  const ruta = usePathname();
  const ultima = useRef<number>(Date.now());
  const cerrando = useRef(false);
  // Con el aviso en pantalla, mover el mouse no cuenta: hay que tocar "Seguir conectado".
  const avisando = useRef(false);
  const [quedan, setQuedan] = useState<number | null>(null); // segundos, cuando se muestra el aviso

  const marcar = useCallback(() => {
    if (avisando.current) return;
    const ahora = Date.now();
    // Se guarda como mucho cada 5 segundos para no escribir en cada movimiento del mouse.
    if (ahora - ultima.current > 5000) guardar(ahora);
    ultima.current = ahora;
  }, []);

  const salir = useCallback(async () => {
    if (cerrando.current) return;
    cerrando.current = true;
    try {
      localStorage.removeItem(CLAVE);
      // El login lee esta marca para explicar por qué se cerró la sesión.
      sessionStorage.setItem('facti.motivoSalida', 'inactividad');
    } catch {
      /* nada */
    }
    await cerrarSesion();
    router.replace(`/ingresar?motivo=inactividad&volver=${encodeURIComponent(ruta)}`);
  }, [router, ruta]);

  useEffect(() => {
    // Si la última actividad guardada ya venció (por ejemplo, volviste al día siguiente), se sale enseguida.
    const guardada = leer();
    if (guardada && Date.now() - guardada >= LIMITE_MS) {
      void salir();
      return;
    }
    ultima.current = Date.now();
    guardar(ultima.current);

    const eventos = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll', 'mousemove'] as const;
    eventos.forEach((e) => window.addEventListener(e, marcar, { passive: true }));

    const revisar = () => {
      // Otra pestaña pudo tener actividad más reciente.
      const otra = leer();
      const ult = Math.max(ultima.current, otra ?? 0);
      const inactivo = Date.now() - ult;
      if (inactivo >= LIMITE_MS) void salir();
      else if (inactivo >= LIMITE_MS - AVISO_MS) {
        avisando.current = true;
        setQuedan(Math.ceil((LIMITE_MS - inactivo) / 1000));
      } else {
        avisando.current = false;
        setQuedan(null);
      }
    };
    const intervalo = window.setInterval(revisar, 1000);
    const alVolver = () => document.visibilityState === 'visible' && revisar();
    document.addEventListener('visibilitychange', alVolver);

    return () => {
      eventos.forEach((e) => window.removeEventListener(e, marcar));
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [marcar, salir]);

  if (quedan === null) return null;

  const seguir = () => {
    avisando.current = false;
    ultima.current = Date.now();
    guardar(ultima.current);
    setQuedan(null);
  };

  // Tarjeta arriba, sin oscurecer la pantalla: se ve lo que estabas haciendo.
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div
        role="alertdialog"
        aria-labelledby="inactividad-titulo"
        aria-describedby="inactividad-texto"
        className="aviso-entra pointer-events-auto relative flex w-full max-w-[700px] flex-wrap items-center gap-x-4 gap-y-3 overflow-hidden rounded-tarjeta bg-superficie p-4 pb-5 shadow-[0_16px_40px_rgba(21,25,58,0.16)] sm:p-5 sm:pb-6"
      >
        <div className="flex min-w-0 flex-[1_1_220px] items-center gap-4">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-[14px] bg-aviso-suave text-aviso-texto">
            <Icon name="reloj" size={24} />
          </span>
          <div className="flex min-w-0 flex-col">
            <h2 id="inactividad-titulo" className="text-[18px] font-bold">¿Seguís ahí?</h2>
            <p id="inactividad-texto" className="whitespace-nowrap text-texto-suave">
              Tu sesión se cierra en <strong className="tabular-nums text-texto">{quedan} s</strong>
            </p>
          </div>
        </div>
        <div className="flex flex-none items-center gap-2 max-[420px]:w-full max-[420px]:justify-end">
          <button type="button" onClick={() => void salir()} className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-full px-4 font-bold text-texto-suave hover:text-error max-[420px]:flex-1">
            Cerrar sesión
          </button>
          <button type="button" autoFocus onClick={seguir} className="btn-lift inline-flex h-11 items-center justify-center whitespace-nowrap rounded-full bg-primario px-5 font-bold text-white shadow-boton max-[420px]:flex-1">
            Seguir conectado
          </button>
        </div>
        {/* Cuánto falta, como una barrita que se vacía. */}
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1.5 bg-fondo">
          <span className="block h-full bg-acento transition-[width] duration-1000 ease-linear" style={{ width: `${(quedan / (AVISO_MS / 1000)) * 100}%` }} />
        </span>
      </div>
    </div>
  );
}
