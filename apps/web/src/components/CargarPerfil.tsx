'use client';

import { useState } from 'react';
import { AvisoApi } from '@/components/AvisoApi';
import { cargarPerfil, type Cuenta, type ErrorApi } from '@/lib/api';

const campo =
  'h-12 w-full rounded-input border-[1.5px] border-borde bg-white px-4 text-base font-normal text-texto outline-none placeholder:text-[#9399B2] focus:border-primario';

/**
 * Formulario para cargar a mano el nombre y el domicilio fiscal del emisor, cuando el padrón de ARCA
 * no los trajo (pasa en homologación). Salen así en el PDF de la factura.
 */
export function CargarPerfil({ onGuardado }: { onGuardado: (c: Cuenta) => void }) {
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
      <p className="text-sm text-texto-suave">ARCA no nos pasó tus datos. Cargalos acá así aparecen en tus facturas.</p>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Nombre y apellido o razón social
        <input className={campo} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Vargas Nelson" autoComplete="name" maxLength={120} required />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Domicilio fiscal
        <input className={campo} value={domicilio} onChange={(e) => setDomicilio(e.target.value)} placeholder="Av. Corrientes 1234 - CABA" autoComplete="street-address" maxLength={200} />
      </label>
      {error && <AvisoApi error={error} compacto />}
      <button type="submit" disabled={guardando || !nombre.trim()} className="btn-lift flex h-11 items-center justify-center self-start rounded-full bg-primario px-6 font-bold text-white shadow-boton disabled:opacity-50">
        {guardando ? 'Guardando…' : 'Guardar mis datos'}
      </button>
    </form>
  );
}
