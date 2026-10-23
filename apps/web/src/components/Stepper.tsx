const PASOS = ['Tu perfil', 'Clave fiscal', 'Autorizar en ARCA', 'Punto de venta', '¡Listo!'];

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/** Stepper del onboarding. `actual` es 1..5; los pasos anteriores quedan completados. */
export function Stepper({ actual }: { actual: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2.5">
      {PASOS.map((label, i) => {
        const n = i + 1;
        const done = n < actual;
        const current = n === actual;
        return (
          <li key={label} className="flex flex-1 items-center gap-2.5" style={{ minWidth: 0 }}>
            <div
              className={`flex items-center gap-2 text-[15px] font-extrabold ${
                done ? 'text-exito-texto' : current ? 'text-texto' : 'text-texto-tenue'
              }`}
            >
              <span
                className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full font-extrabold ${
                  done ? 'bg-exito text-white' : current ? 'bg-primario text-white' : 'bg-[#E6EAF2] text-texto-tenue'
                }`}
              >
                {done ? <Check /> : n}
              </span>
              <span className="whitespace-nowrap">{label}</span>
            </div>
            {n < PASOS.length && <span className="min-w-[16px] flex-1 border-t-2 border-dashed border-[#C9CEDD]" />}
          </li>
        );
      })}
    </ol>
  );
}
