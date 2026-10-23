import type { CSSProperties } from 'react';

export interface DatosPagoVEP {
  vep: string;
  generado: string; // dd/mm/yyyy
  vencimiento: string; // dd/mm/yyyy
  contribuyente: { cuit: string; nombre: string };
  impuesto: string; // p.ej. "20 - Monotributo (Régimen Simplificado)"
  concepto: string; // p.ej. "Pago mensual"
  periodo: string; // mm/yyyy
  componentes: { concepto: string; importe: string }[];
  total: string;
  pago: { red: string; fecha: string; transaccion: string; control: string };
}

const linea = '#1F2433';
const tenue = '#5A6080';
const bold: CSSProperties = { fontWeight: 800 };

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '3px 0' }}>
      <span style={{ color: tenue }}>{k}</span>
      <span style={{ ...bold, textAlign: 'right' }}>{v}</span>
    </div>
  );
}

function Seccion({ titulo }: { titulo: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.09em', color: tenue, marginTop: 4 }}>{titulo}</div>
  );
}

/**
 * Réplica compacta del Comprobante de Pago del VEP de ARCA/AFIP (papel blanco,
 * bordes finos, sello PAGADO). Mismo criterio visual que <ComprobanteC />.
 */
export function ComprobantePagoVEP({ datos }: { datos: DatosPagoVEP }) {
  return (
    <div
      style={{
        position: 'relative',
        background: '#fff',
        color: linea,
        fontFamily: "'Nunito', 'Segoe UI', sans-serif",
        fontSize: 12.5,
        lineHeight: 1.45,
        border: `1px solid ${linea}`,
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      {/* Encabezado ARCA */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, padding: '12px 16px 10px', borderBottom: `1px solid ${linea}` }}>
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.04em', color: '#2A2DB0' }}>ARCA</span>
        <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
          <div style={{ fontWeight: 800 }}>Comprobante de Pago</div>
          <div style={{ fontSize: 10.5, color: tenue }}>Volante Electrónico de Pago (VEP)</div>
        </div>
      </div>

      <div style={{ padding: '10px 16px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Fila k="VEP N°" v={datos.vep} />
        <Fila k="Generado" v={datos.generado} />
        <Fila k="Vencimiento" v={datos.vencimiento} />

        <Seccion titulo="CONTRIBUYENTE" />
        <Fila k="CUIT" v={datos.contribuyente.cuit} />
        <Fila k="Apellido y Nombre" v={datos.contribuyente.nombre} />

        <Seccion titulo="DETALLE DE LA OBLIGACIÓN" />
        <Fila k="Organismo recaudador" v="AFIP" />
        <Fila k="Impuesto" v={datos.impuesto} />
        <Fila k="Concepto" v={datos.concepto} />
        <Fila k="Período fiscal" v={datos.periodo} />

        <div style={{ borderTop: `1px dashed ${'#C7CBDA'}`, marginTop: 6, paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {datos.componentes.map((c) => (
            <div key={c.concepto} style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
              <span style={{ color: tenue }}>{c.concepto}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{c.importe}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 14, borderTop: `1px solid ${linea}`, marginTop: 8, paddingTop: 8 }}>
          <span style={{ fontWeight: 800, fontSize: 13 }}>Importe total</span>
          <span style={{ fontWeight: 800, fontSize: 19 }}>{datos.total}</span>
        </div>

        <Seccion titulo="DATOS DEL PAGO" />
        <Fila k="Red de pago" v={datos.pago.red} />
        <Fila k="Fecha de pago" v={datos.pago.fecha} />
        <Fila k="N° de transacción" v={datos.pago.transaccion} />
        <Fila k="Código de control" v={datos.pago.control} />
      </div>

      {/* Sello PAGADO */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: 10,
          bottom: 48,
          transform: 'rotate(-14deg)',
          border: '2.5px solid #1E9E63',
          color: '#1E9E63',
          borderRadius: 8,
          padding: '2px 12px',
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: '0.12em',
          opacity: 0.85,
        }}
      >
        PAGADO
      </div>
    </div>
  );
}
