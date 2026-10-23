'use client';

import { useMemo, useState } from 'react';

interface Cliente {
  nombre: string;
  cuit: string;
  iva: string;
  facturas: number;
  facturado: string;
}

const CLIENTES: Cliente[] = [
  { nombre: 'Estudio Lumen SRL', cuit: '30-71589632-7', iva: 'Responsable Inscripto', facturas: 8, facturado: '$612.000' },
  { nombre: 'Martín Gómez', cuit: '20-28456789-3', iva: 'Consumidor final', facturas: 5, facturado: '$212.500' },
  { nombre: 'Café Aroma SAS', cuit: '30-71122334-5', iva: 'Responsable Inscripto', facturas: 4, facturado: '$360.000' },
  { nombre: 'Fundación Raíces', cuit: '30-70998877-1', iva: 'Exento', facturas: 3, facturado: '$510.000' },
  { nombre: 'Verde Vivero', cuit: '27-33445566-8', iva: 'Monotributo', facturas: 2, facturado: '$66.000' },
  { nombre: 'Northwind Labs LLC', cuit: 'ID 88-1234567', iva: 'Exterior (EE.UU.)', facturas: 6, facturado: 'USD 7.200' },
];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const th = 'border-b-2 border-[#EDF0F6] px-4 pb-3 font-extrabold';
const td = 'px-4 py-4 align-middle';

const totalFacturas = CLIENTES.reduce((a, c) => a + c.facturas, 0);

export default function Clientes() {
  const [q, setQ] = useState('');
  const filtrados = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return CLIENTES;
    return CLIENTES.filter((c) => norm(c.nombre).includes(n) || c.cuit.replace(/\D/g, '').includes(n.replace(/\D/g, '')) || norm(c.cuit).includes(n));
  }, [q]);

  return (
    <>
      <div className="aparece flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-bold">Clientes</h1>
          <p className="text-texto-suave">Tus clientes y cuánto les facturaste.</p>
        </div>
        <button type="button" className="btn-lift flex h-12 items-center gap-2 rounded-full bg-primario px-6 font-extrabold text-white shadow-boton">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10" cy="8" r="4" /><path d="M3 20c0-3.9 3.1-7 7-7M18 14v6M15 17h6" /></svg>
          Agregar cliente
        </button>
      </div>

      {/* Stats */}
      <div style={{ animationDelay: '80ms' }} className="aparece grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        <div className="card-hover flex flex-col gap-1 rounded-tarjeta bg-superficie px-6 py-5 shadow-tarjeta">
          <span className="text-[13px] font-extrabold tracking-[0.06em] text-texto-tenue">CLIENTES</span>
          <span className="font-display text-[30px] font-bold">{CLIENTES.length}</span>
        </div>
        <div className="card-hover flex flex-col gap-1 rounded-tarjeta bg-superficie px-6 py-5 shadow-tarjeta">
          <span className="text-[13px] font-extrabold tracking-[0.06em] text-texto-tenue">FACTURAS EMITIDAS</span>
          <span className="font-display text-[30px] font-bold">{totalFacturas}</span>
        </div>
      </div>

      {/* Buscador */}
      <div style={{ animationDelay: '160ms' }} className="aparece flex min-w-[240px] max-w-[440px] items-center gap-2 rounded-input border-[1.5px] border-borde bg-white px-4 transition-colors focus-within:border-primario">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none text-texto-tenue"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o CUIT…" className="h-12 w-full bg-transparent text-base text-texto outline-none placeholder:text-texto-tenue" />
      </div>

      {/* Tabla */}
      <section style={{ animationDelay: '240ms' }} className="aparece rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        {filtrados.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[15px]">
              <thead>
                <tr className="text-xs tracking-[0.06em] text-texto-tenue">
                  <th className={`${th} text-left`}>CLIENTE</th>
                  <th className={`${th} text-left`}>CUIT / ID</th>
                  <th className={`${th} text-left`}>CONDICIÓN IVA</th>
                  <th className={`${th} text-center`}>FACTURAS</th>
                  <th className={`${th} text-right`}>FACTURADO</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.cuit} className="border-b border-[#F0F2F7] transition-colors last:border-0 hover:bg-fondo">
                    <td className={`${td} font-bold`}>{c.nombre}</td>
                    <td className={`${td} whitespace-nowrap tabular-nums text-texto-suave`}>{c.cuit}</td>
                    <td className={`${td} text-texto-suave`}>{c.iva}</td>
                    <td className={`${td} text-center font-bold tabular-nums`}>{c.facturas}</td>
                    <td className={`${td} text-right font-extrabold tabular-nums`}>{c.facturado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-10 text-center text-texto-suave">No encontramos clientes con esa búsqueda.</p>
        )}
      </section>
    </>
  );
}
