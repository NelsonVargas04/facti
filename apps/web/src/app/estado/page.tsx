'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { API_URL } from '@/lib/api';

interface Salud {
  ok: boolean;
  servicio: string;
  entorno: string;
  hora: string;
}

interface EstadoArca {
  entorno: string;
  servidores: { app: string; db: string; auth: string };
}

type Estado<T> = { cargando: true } | { cargando: false; dato?: T; error?: string };

async function traer<T>(ruta: string): Promise<Estado<T>> {
  try {
    const r = await fetch(`${API_URL}${ruta}`);
    const cuerpo = await r.json();
    if (!r.ok) return { cargando: false, error: cuerpo?.mensaje ?? `HTTP ${r.status}` };
    return { cargando: false, dato: cuerpo as T };
  } catch {
    return { cargando: false, error: `No se pudo conectar con la API (${API_URL}). ¿Está levantada?` };
  }
}

function Semaforo({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 12,
        height: 12,
        borderRadius: 999,
        background: ok ? '#22c58b' : '#e5484d',
        boxShadow: `0 0 0 4px ${ok ? 'var(--menta)' : '#ffe0e1'}`,
      }}
    />
  );
}

export default function EstadoPage() {
  const [salud, setSalud] = useState<Estado<Salud>>({ cargando: true });
  const [arca, setArca] = useState<Estado<EstadoArca>>({ cargando: true });
  const [base, setBase] = useState<Estado<{ cuenta: { cuit: string } }>>({ cargando: true });

  useEffect(() => {
    traer<Salud>('/salud').then(setSalud);
    traer<EstadoArca>('/arca/estado').then(setArca);
    traer<{ cuenta: { cuit: string } }>('/cuenta').then(setBase);
  }, []);

  return (
    <main className="contenedor" style={{ padding: '2.5rem 1.5rem', maxWidth: 760 }}>
      <Link href="/" style={{ color: 'var(--indigo)', fontWeight: 700 }}>← Volver</Link>
      <h1 style={{ fontSize: '2.2rem', marginTop: '1rem' }}>Estado del sistema</h1>
      <p style={{ color: 'var(--gris-suave)' }}>
        Chequeo en vivo de la API de Facti y de los servidores de ARCA.
      </p>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {!salud.cargando && <Semaforo ok={!!salud.dato?.ok} />} API de Facti
        </h3>
        {salud.cargando && <p style={{ color: 'var(--gris-suave)' }}>Consultando…</p>}
        {!salud.cargando && salud.error && <p style={{ color: '#e5484d' }}>{salud.error}</p>}
        {!salud.cargando && salud.dato && (
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            <li>Servicio: <strong>{salud.dato.servicio}</strong></li>
            <li>Entorno: <strong>{salud.dato.entorno}</strong></li>
            <li>Hora del server: {new Date(salud.dato.hora).toLocaleString('es-AR')}</li>
          </ul>
        )}
      </div>

      <div className="card" style={{ marginTop: '1.2rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {!arca.cargando && <Semaforo ok={!arca.error} />} Servidores de ARCA
        </h3>
        {arca.cargando && <p style={{ color: 'var(--gris-suave)' }}>Consultando…</p>}
        {!arca.cargando && arca.error && (
          <p style={{ color: 'var(--gris-suave)' }}>
            {arca.error}
            <br />
            <span style={{ fontSize: '0.9rem' }}>
              (Es lo esperado hasta cargar el certificado y el <code>.env</code> de homologación.)
            </span>
          </p>
        )}
        {!arca.cargando && arca.dato && (
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            <li>App: <strong>{arca.dato.servidores.app}</strong></li>
            <li>Base de datos: <strong>{arca.dato.servidores.db}</strong></li>
            <li>Autenticación: <strong>{arca.dato.servidores.auth}</strong></li>
          </ul>
        )}
      </div>

      <div className="card" style={{ marginTop: '1.2rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {!base.cargando && <Semaforo ok={!base.error} />} Base de datos (Supabase)
        </h3>
        {base.cargando && <p style={{ color: 'var(--gris-suave)' }}>Consultando…</p>}
        {!base.cargando && base.error && <p style={{ color: 'var(--gris-suave)' }}>{base.error}</p>}
        {!base.cargando && base.dato && <p>Conectada. Cuenta del CUIT <strong>{base.dato.cuenta.cuit}</strong>.</p>}
      </div>
    </main>
  );
}
