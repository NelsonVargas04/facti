'use client';

import { useState } from 'react';
import { AvisoApi } from '@/components/AvisoApi';
import { Icon } from '@/components/Icon';
import { crearSolicitud, type ErrorApi, type TipoSolicitud } from '@/lib/api';
import { LEGAL } from '@/lib/legal';

const campo =
  'h-12 w-full rounded-input border-[1.5px] border-borde bg-white px-4 text-base font-normal text-texto outline-none placeholder:text-[#9399B2] focus:border-primario';

/**
 * Formulario del botón de arrepentimiento y del botón de baja. No pide iniciar sesión: con nombre y
 * email alcanza. Al enviarlo, muestra el código de la solicitud (Disposición 954/2025, art. 5).
 */
export function FormSolicitud({ tipo }: { tipo: TipoSolicitud }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [cuit, setCuit] = useState('');
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<ErrorApi | null>(null);
  const [hecho, setHecho] = useState<{ codigo: string; creadaEn: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const esBaja = tipo === 'baja';

  async function enviar() {
    setError(null);
    setEnviando(true);
    const r = await crearSolicitud({ tipo, nombre, email, cuit: cuit.trim() || undefined, detalle: detalle.trim() || undefined });
    setEnviando(false);
    if (r.ok) setHecho({ codigo: r.dato.codigo, creadaEn: r.dato.creadaEn });
    else setError(r);
  }

  if (hecho) {
    const fecha = new Date(hecho.creadaEn).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' });
    return (
      <div className="flex flex-col gap-4" role="status">
        <div className="flex items-center gap-2 font-bold text-exito-texto">
          <Icon name="check" size={22} />
          Recibimos tu pedido de {esBaja ? 'baja' : 'arrepentimiento'}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-exito-suave px-5 py-4">
          <div>
            <div className="text-exito-texto">Tu código de solicitud</div>
            <div className="font-mono text-[26px] font-bold tracking-wider text-texto">{hecho.codigo}</div>
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(hecho.codigo);
                setCopiado(true);
              } catch {
                /* sin portapapeles: el código queda a la vista */
              }
            }}
            className="btn-lift inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 font-bold text-texto"
          >
            <Icon name={copiado ? 'check' : 'copiar'} size={18} />
            {copiado ? 'Copiado' : 'Copiar código'}
          </button>
        </div>
        <p>
          Guardá este código: es tu constancia (registrado el {fecha}). {esBaja ? 'Hacemos efectiva la baja y no se te cobra nada más.' : 'Cancelamos la contratación y te devolvemos lo que pagaste por el mismo medio de pago.'}{' '}
          Si hace falta confirmar que el pedido es tuyo, te escribimos a <strong>{email}</strong>.
        </p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
    >
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        <label className="flex flex-col gap-1.5 font-semibold text-texto">
          Nombre y apellido
          <input className={campo} value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" maxLength={120} required />
        </label>
        <label className="flex flex-col gap-1.5 font-semibold text-texto">
          Email
          <input className={campo} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={200} required placeholder="El de tu cuenta de Facti" />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 font-semibold text-texto">
        CUIT (opcional)
        <input className={campo} inputMode="numeric" value={cuit} onChange={(e) => setCuit(e.target.value)} autoComplete="off" maxLength={13} placeholder="20-12345678-9" />
      </label>
      <label className="flex flex-col gap-1.5 font-semibold text-texto">
        {esBaja ? '¿Querés contarnos por qué? (opcional)' : '¿Qué contratación querés cancelar? (opcional)'}
        <textarea
          className="min-h-[96px] w-full rounded-input border-[1.5px] border-borde bg-white px-4 py-3 text-base font-normal text-texto outline-none placeholder:text-[#9399B2] focus:border-primario"
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
          maxLength={1000}
          placeholder={esBaja ? 'Por ejemplo: ya no facturo más' : 'Por ejemplo: el plan Pro que contraté el 10/11'}
        />
      </label>
      {error && <AvisoApi error={error} compacto />}
      <button
        type="submit"
        disabled={enviando || !nombre.trim() || !email.trim()}
        className="btn-lift flex h-12 items-center justify-center self-start rounded-full bg-primario px-7 font-bold text-white shadow-boton disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enviando ? 'Enviando…' : esBaja ? 'Pedir la baja' : 'Pedir el arrepentimiento'}
      </button>
      <p className="text-texto-tenue">
        No hace falta iniciar sesión. Si preferís, también podés escribirnos a {LEGAL.email}.
      </p>
    </form>
  );
}
