'use client';

import { useState } from 'react';

export function CopiarCuit({ value }: { value: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(value);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* el navegador puede bloquear el portapapeles; no es crítico */
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className="btn-lift flex h-[46px] items-center gap-2 rounded-full border-[1.5px] border-texto bg-white px-5 text-[15px] font-extrabold text-texto"
    >
      {copiado ? (
        <>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E9E63" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          ¡Copiado!
        </>
      ) : (
        <>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="3" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>
          Copiar CUIT
        </>
      )}
    </button>
  );
}
