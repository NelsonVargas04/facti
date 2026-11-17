'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Facti } from '@/components/Facti';
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

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="inactividad-titulo" className="fixed inset-0 z-50 flex items-center justify-center bg-[#15193A]/40 p-4">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-4 rounded-tarjeta bg-superficie p-7 text-center shadow-tarjeta">
        <Facti pose="durmiendo" size={110} animated={false} />
        <h2 id="inactividad-titulo" className="text-[22px] font-bold">¿Seguís ahí?</h2>
        <p className="text-texto-suave">
          Para cuidar tus datos fiscales, cerramos tu sesión en <strong className="tabular-nums text-texto">{quedan} s</strong> si no hay actividad.
        </p>
        <div className="flex w-full flex-wrap justify-center gap-3">
          <button
            type="button"
            autoFocus
            onClick={() => {
              avisando.current = false;
              ultima.current = Date.now();
              guardar(ultima.current);
              setQuedan(null);
            }}
            className="btn-lift inline-flex h-12 items-center rounded-full bg-primario px-6 font-bold text-white shadow-boton"
          >
            Seguir conectado
          </button>
          <button type="button" onClick={() => void salir()} className="inline-flex h-12 items-center rounded-full px-5 font-bold text-texto-suave hover:text-error">
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
