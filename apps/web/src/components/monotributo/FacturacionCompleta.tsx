'use client';

import { useRef, useState } from 'react';
import { BotonVideo } from '@/components/guia/PaginaGuia';
import { Icon } from '@/components/Icon';
import { importarComprobantes, type ResultadoImportacion, type Topes } from '@/lib/api';
import { fecha, pesos } from '@/lib/formato';

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * "Toda tu facturación": lo hecho con Facti más lo importado de Mis Comprobantes (ARCA no tiene web
 * service para eso, así que el usuario baja el archivo y lo sube acá).
 */
export function FacturacionCompleta({ topes, onImportado }: { topes?: Topes; onImportado: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subir(archivo?: File | null) {
    if (!archivo || subiendo) return;
    setSubiendo(true);
    setError(null);
    setResultado(null);
    const r = await importarComprobantes(archivo);
    setSubiendo(false);
    if (input.current) input.current.value = '';
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    setResultado(r.dato);
    onImportado();
  }

  if (!topes) return <div className="skeleton h-[360px] rounded-tarjeta" />;
  const ext = topes.externos;
  const total = topes.facti + topes.externo;
  const parteFacti = total > 0 ? Math.max(0, Math.min(100, (topes.facti / total) * 100)) : 100;

  return (
    <section className="flex flex-col gap-5 rounded-tarjeta bg-superficie p-5 shadow-tarjeta sm:p-7">
      <div>
        <h2 className="text-[22px] font-bold">Toda tu facturación</h2>
        <p className="text-texto-suave">Para que los topes sean exactos, sumá lo que facturaste desde la web de ARCA o con otra app.</p>
      </div>

      {/* Con Facti / fuera de Facti */}
      <div className="flex flex-col gap-3">
        <div className="flex h-3 overflow-hidden rounded-full bg-fondo" aria-hidden="true">
          <div className="h-full bg-primario transition-[width] duration-500" style={{ width: `${parteFacti}%` }} />
          <div className="h-full bg-facti/50" style={{ width: `${100 - parteFacti}%` }} />
        </div>
        <dl className="grid grid-cols-1 gap-3 min-[460px]:grid-cols-2">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 flex-none rounded-full bg-primario" />
            <div className="flex min-w-0 flex-col">
              <dt className="text-texto-suave">Con Facti</dt>
              <dd className="font-semibold tabular-nums">{pesos(topes.facti)}</dd>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 flex-none rounded-full bg-facti/50" />
            <div className="flex min-w-0 flex-col">
              <dt className="text-texto-suave">Fuera de Facti</dt>
              <dd className="font-semibold tabular-nums">{ext.cantidad > 0 ? pesos(topes.externo) : 'Sin importar'}</dd>
            </div>
          </div>
        </dl>
        {ext.cantidad > 0 && (
          <p className="text-texto-tenue">
            Importaste {plural(ext.cantidad, 'comprobante', 'comprobantes')}
            {ext.desde && ext.hasta ? ` (del ${fecha(ext.desde)} al ${fecha(ext.hasta)})` : ''}
            {ext.ultimaImportacion ? `. Última vez: ${fecha(ext.ultimaImportacion.slice(0, 10))}` : ''}.
          </p>
        )}
      </div>

      {/* Paso 1: bajarlo en ARCA */}
      <div className="flex items-start gap-3.5 border-t border-[#EDF0F6] pt-5">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-primario-suave font-bold text-primario-oscuro">1</span>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div>
            <strong>Bajá tus comprobantes de ARCA</strong>
            <p className="text-texto-suave">
              En ARCA abrí <b>Mis Comprobantes</b> › <b>Emitidos</b>, elegí los últimos 12 meses y tocá <b>CSV</b> o <b>Excel</b>.
            </p>
          </div>
          <BotonVideo href="/guias/mis-comprobantes" portada="/videos/mis-comprobantes.jpg" titulo="Ver cómo se hace" texto="Video paso a paso: bajar el archivo y subirlo. Dura poco más de 1 minuto." />
          <a href="https://www.arca.gob.ar" target="_blank" rel="noopener noreferrer" className="btn-lift inline-flex h-11 items-center gap-2 self-start rounded-full border-[1.5px] border-borde px-5 font-bold text-texto hover:border-primario hover:text-primario-oscuro">
            Ir a ARCA <Icon name="link-externo" size={18} />
          </a>
        </div>
      </div>

      {/* Paso 2: subirlo */}
      <div className="flex items-start gap-3.5 border-t border-[#EDF0F6] pt-5">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-primario-suave font-bold text-primario-oscuro">2</span>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div>
            <strong>Subilo acá</strong>
            <p className="text-texto-suave">Tal cual lo bajaste. Si subís el mismo archivo dos veces, no se cuenta doble.</p>
          </div>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setArrastrando(true);
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastrando(false);
              subir(e.dataTransfer.files[0]);
            }}
            className={`flex cursor-pointer flex-col items-center gap-3 rounded-[18px] border-2 border-dashed px-5 py-6 text-center transition-colors ${
              arrastrando ? 'border-primario bg-primario-suave' : 'border-borde hover:border-primario hover:bg-fondo'
            }`}
          >
            <input ref={input} type="file" accept=".csv,.xlsx,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => subir(e.target.files?.[0])} />
            <span className="inline-flex h-11 items-center gap-2 rounded-full bg-primario px-5 font-bold text-white shadow-boton">
              {subiendo ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Leyendo…
                </>
              ) : (
                <>
                  <Icon name="descargar" size={18} className="rotate-180" />
                  Subir archivo
                </>
              )}
            </span>
            <span className="text-texto-tenue">o arrastralo hasta acá · CSV o Excel</span>
          </label>

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-[14px] bg-error-suave px-4 py-3 text-error">
              <Icon name="alerta" size={20} className="mt-0.5 flex-none" />
              {error}
            </p>
          )}
          {resultado && (
            <div role="status" className="aparece flex flex-col gap-1 rounded-[14px] bg-exito-suave px-4 py-3 text-exito-texto">
              <strong className="flex items-center gap-2">
                <Icon name="check-circulo" size={20} />
                {resultado.importacion.nuevos > 0 ? `Listo: ${plural(resultado.importacion.nuevos, 'comprobante nuevo', 'comprobantes nuevos')}` : 'No había comprobantes nuevos'}
              </strong>
              {(resultado.importacion.repetidos > 0 || resultado.importacion.enFacti > 0) && (
                <span>
                  {[
                    resultado.importacion.enFacti > 0 && `${plural(resultado.importacion.enFacti, 'ya estaba', 'ya estaban')} en Facti`,
                    resultado.importacion.repetidos > 0 && `${plural(resultado.importacion.repetidos, 'ya se había importado', 'ya se habían importado')}`,
                  ]
                    .filter(Boolean)
                    .join(' y ')}
                  : no se cuentan dos veces.
                </span>
              )}
              {resultado.errores.length > 0 && (
                <span className="text-aviso-texto">
                  {plural(resultado.errores.length, 'fila no se pudo leer', 'filas no se pudieron leer')}: {resultado.errores.slice(0, 2).map((e) => `fila ${e.fila} (${e.mensaje})`).join('; ')}
                  {resultado.errores.length > 2 ? '…' : ''}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
