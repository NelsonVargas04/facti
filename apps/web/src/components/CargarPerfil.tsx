'use client';

import { useState } from 'react';
import { AvisoApi } from '@/components/AvisoApi';
import { cargarPerfil, type Cuenta, type ErrorApi } from '@/lib/api';

const campo =
  'h-12 w-full rounded-input border-[1.5px] border-borde bg-white px-4 text-base font-normal text-texto outline-none placeholder:text-[#9399B2] focus:border-primario';

/**
 * Formulario para cargar a mano el nombre y el domicilio fiscal del emisor, cuando el padrón de ARCA
 * no los trajo (pasa en homologación). Salen así en el PDF de la factura.
 * horizontal: los dos campos y el botón en una fila (en pantallas anchas).
 */
export function CargarPerfil({ onGuardado, horizontal = false }: { onGuardado: (c: Cuenta) => void; horizontal?: boolean }) {
  const [nombre, setNombre] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<ErrorApi | null>(null);

  async function guardar() {
    setError(null);
    setGuardando(true);
    const r = await cargarPerfil(nombre, domicilio);
    setGuardando(false);
    if (r.ok) onGuardado(r.dato.cuenta);
    else setError(r);
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
    >
      {!horizontal && <p className="text-base text-texto-suave">ARCA no nos pasó tus datos. Cargalos acá así aparecen en tus facturas.</p>}
      <div className={horizontal ? 'flex flex-wrap items-end gap-3' : 'flex flex-col gap-3'}>
        <label className="flex min-w-0 flex-1 basis-[240px] flex-col gap-1.5 text-base font-semibold">
          Nombre y apellido o razón social
          <input className={campo} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Fernández Lucía" autoComplete="name" maxLength={120} required />
        </label>
        <label className="flex min-w-0 flex-1 basis-[240px] flex-col gap-1.5 text-base font-semibold">
          Domicilio fiscal
          <input className={campo} value={domicilio} onChange={(e) => setDomicilio(e.target.value)} placeholder="Ej: Av. Corrientes 1234, CABA" autoComplete="street-address" maxLength={200} />
        </label>
        <button
          type="submit"
          disabled={guardando || !nombre.trim()}
          className={`btn-lift flex h-12 flex-none items-center justify-center rounded-full bg-primario px-6 font-bold text-white shadow-boton disabled:cursor-not-allowed disabled:opacity-50 ${horizontal ? '' : 'self-start'}`}
        >
          {guardando ? 'Guardando…' : 'Guardar datos'}
        </button>
      </div>
      {error && <AvisoApi error={error} compacto />}
    </form>
  );
}
