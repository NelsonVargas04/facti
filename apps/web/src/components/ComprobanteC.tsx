'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import QRCode from 'qrcode';

export interface ItemComprobante {
  descripcion: string;
  cantidad: number;
  unidad?: string;
  precioUnitario: number;
}

export interface DatosComprobanteC {
  // Identificación del comprobante (por defecto Factura C)
  letra?: string;
  titulo?: string;
  cod?: string;
  // Emisor
  emisor: { razonSocial: string; domicilio: string; cuit: string; ingresosBrutos: string; inicioActividades: string };
  // Cabecera
  puntoVenta: number;
  numero: number;
  fechaEmision: string; // dd/mm/yyyy
  periodo?: { desde: string; hasta: string; vtoPago: string };
  // Receptor
  receptor: { cuit: string; nombre: string; condicionIva: string; domicilio: string; condicionVenta: string };
  // Detalle y totales
  items: ItemComprobante[];
  otrosTributos?: number;
  // ARCA
  cae: string;
  caeVto: string; // dd/mm/yyyy
  qrUrl: string;
}

const fmt2 = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nroComp = (pv: number, n: number) => ({ pv: String(pv).padStart(5, '0'), n: String(n).padStart(8, '0') });

const linea = '#1F2433';
const bold: CSSProperties = { fontWeight: 800 };
const fila: CSSProperties = { display: 'flex', gap: 6 };
const celda: CSSProperties = { padding: '7px 6px', borderBottom: '1px solid #E3E6EE' };
const th: CSSProperties = { padding: '7px 6px', fontWeight: 800, borderBottom: `1px solid ${linea}` };

/**
 * Factura C en el formato oficial de ARCA (A4, 794×1123). El QR se genera de verdad
 * a partir de la URL de verificación de ARCA. El emisor es, por ahora, un perfil fijo.
 */
export function ComprobanteC({ datos }: { datos: DatosComprobanteC }) {
  const [qr, setQr] = useState<string | null>(null);
  const { pv, n } = nroComp(datos.puntoVenta, datos.numero);
  const letra = datos.letra ?? 'C';
  const titulo = datos.titulo ?? 'FACTURA';
  const cod = datos.cod ?? '011';

  const items = datos.items.map((it, i) => {
    const subtotal = it.cantidad * it.precioUnitario;
    return { ...it, codigo: String(i + 1).padStart(4, '0'), subtotal };
  });
  const subtotal = items.reduce((a, it) => a + it.subtotal, 0);
  const otros = datos.otrosTributos ?? 0;
  const total = subtotal + otros;

  useEffect(() => {
    QRCode.toDataURL(datos.qrUrl, { margin: 0, width: 216, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => setQr(null));
  }, [datos.qrUrl]);

  return (
    <div
      style={{
        width: 794,
        minHeight: 1123,
        boxSizing: 'border-box',
        padding: 40,
        background: '#fff',
        color: linea,
        fontFamily: "'Nunito', 'Segoe UI', sans-serif",
        fontSize: 12,
        lineHeight: 1.45,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ border: `1px solid ${linea}`, textAlign: 'center', fontWeight: 800, fontSize: 15, padding: 6, letterSpacing: '0.08em' }}>ORIGINAL</div>

      {/* Cabecera: emisor | letra | comprobante */}
      <div style={{ border: `1px solid ${linea}`, display: 'flex', position: 'relative' }}>
        <div style={{ flex: '1 1 0', padding: '16px 44px 14px 16px', display: 'flex', flexDirection: 'column', gap: 5, borderRight: `1px solid ${linea}` }}>
          <div style={{ height: 46, display: 'flex', alignItems: 'center' }}>
            <span style={{ border: '1.5px dashed #9AA0B4', color: '#5A6080', borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 700 }}>LOGO DEL EMISOR (opcional)</span>
          </div>
          <div style={fila}><span style={bold}>Razón Social:</span><span>{datos.emisor.razonSocial}</span></div>
          <div style={fila}><span style={bold}>Domicilio Comercial:</span><span>{datos.emisor.domicilio}</span></div>
          <div style={fila}><span style={bold}>Condición frente al IVA:</span><span style={bold}>Responsable Monotributo</span></div>
        </div>
        <div style={{ position: 'absolute', left: '50%', top: -1, transform: 'translateX(-50%)', width: 64, background: '#fff', border: `2px solid ${linea}`, borderTop: `1px solid ${linea}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0 6px' }}>
          <span style={{ fontSize: 38, fontWeight: 800, lineHeight: 1 }}>{letra}</span>
          <span style={{ fontSize: 11, fontWeight: 800 }}>COD. {cod}</span>
        </div>
        <div style={{ flex: '1 1 0', padding: '16px 16px 14px 48px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.02em', marginBottom: 4 }}>{titulo}</div>
          <div style={{ display: 'flex', gap: 18 }}>
            <div style={fila}><span style={bold}>Punto de Venta:</span><span style={bold}>{pv}</span></div>
            <div style={fila}><span style={bold}>Comp. Nro:</span><span style={bold}>{n}</span></div>
          </div>
          <div style={fila}><span style={bold}>Fecha de Emisión:</span><span style={bold}>{datos.fechaEmision}</span></div>
          <div style={fila}><span style={bold}>CUIT:</span><span>{datos.emisor.cuit}</span></div>
          <div style={fila}><span style={bold}>Ingresos Brutos:</span><span>{datos.emisor.ingresosBrutos}</span></div>
          <div style={fila}><span style={bold}>Fecha de Inicio de Actividades:</span><span>{datos.emisor.inicioActividades}</span></div>
        </div>
      </div>

      {/* Período */}
      {datos.periodo && (
        <div style={{ border: `1px solid ${linea}`, padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: '6px 28px' }}>
          <div style={fila}><span style={bold}>Período Facturado Desde:</span><span>{datos.periodo.desde}</span></div>
          <div style={fila}><span style={bold}>Hasta:</span><span>{datos.periodo.hasta}</span></div>
          <div style={fila}><span style={bold}>Fecha de Vto. para el pago:</span><span>{datos.periodo.vtoPago}</span></div>
        </div>
      )}

      {/* Receptor */}
      <div style={{ border: `1px solid ${linea}`, padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '5px 20px' }}>
        <div style={fila}><span style={bold}>CUIT:</span><span>{datos.receptor.cuit}</span></div>
        <div style={fila}><span style={bold}>Apellido y Nombre / Razón Social:</span><span>{datos.receptor.nombre}</span></div>
        <div style={fila}><span style={bold}>Condición frente al IVA:</span><span>{datos.receptor.condicionIva}</span></div>
        <div style={fila}><span style={bold}>Domicilio:</span><span>{datos.receptor.domicilio}</span></div>
        <div style={fila}><span style={bold}>Condición de venta:</span><span>{datos.receptor.condicionVenta}</span></div>
      </div>

      {/* Detalle */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, border: `1px solid ${linea}` }}>
        <thead style={{ background: '#EEF0F5' }}>
          <tr>
            <th style={{ ...th, textAlign: 'left' }}>Código</th>
            <th style={{ ...th, textAlign: 'left' }}>Producto / Servicio</th>
            <th style={{ ...th, textAlign: 'right' }}>Cantidad</th>
            <th style={{ ...th, textAlign: 'left' }}>U. Medida</th>
            <th style={{ ...th, textAlign: 'right' }}>Precio Unit.</th>
            <th style={{ ...th, textAlign: 'right' }}>% Bonif</th>
            <th style={{ ...th, textAlign: 'right' }}>Imp. Bonif.</th>
            <th style={{ ...th, textAlign: 'right' }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.codigo}>
              <td style={{ ...celda, textAlign: 'left' }}>{it.codigo}</td>
              <td style={{ ...celda, textAlign: 'left' }}>{it.descripcion}</td>
              <td style={{ ...celda, textAlign: 'right' }}>{fmt2(it.cantidad)}</td>
              <td style={{ ...celda, textAlign: 'left' }}>{it.unidad ?? 'unidades'}</td>
              <td style={{ ...celda, textAlign: 'right' }}>{fmt2(it.precioUnitario)}</td>
              <td style={{ ...celda, textAlign: 'right' }}>0,00</td>
              <td style={{ ...celda, textAlign: 'right' }}>0,00</td>
              <td style={{ ...celda, textAlign: 'right' }}>{fmt2(it.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ flex: 1 }} />

      {/* Totales */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: 330, border: `1px solid ${linea}`, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}><span style={bold}>Subtotal: $</span><span>{fmt2(subtotal)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}><span style={bold}>Importe Otros Tributos: $</span><span>{fmt2(otros)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, fontSize: 16, fontWeight: 800, borderTop: `1px solid ${linea}`, paddingTop: 8, marginTop: 4 }}><span style={bold}>Importe Total: $</span><span>{fmt2(total)}</span></div>
        </div>
      </div>

      {/* QR + ARCA + CAE */}
      <div style={{ borderTop: `1px solid ${linea}`, paddingTop: 12, display: 'flex', gap: 16, alignItems: 'center' }}>
        {qr ? (
          <img src={qr} width={108} height={108} alt="Código QR de ARCA para verificar el comprobante" />
        ) : (
          <div style={{ width: 108, height: 108, background: '#F2F5F9' }} />
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '0.04em' }}>ARCA</span>
          <span style={{ fontWeight: 800, fontStyle: 'italic' }}>Comprobante Autorizado</span>
          <span style={{ fontSize: 11, color: '#4A5072', fontStyle: 'italic' }}>La Agencia no se responsabiliza por la veracidad de los datos ingresados en el detalle de la operación.</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', fontSize: 13 }}>
          <span style={{ fontWeight: 700 }}>Pág. 1/1</span>
          <div style={fila}><span style={bold}>CAE N°:</span><span>{datos.cae}</span></div>
          <div style={fila}><span style={bold}>Fecha de Vto. de CAE:</span><span>{datos.caeVto}</span></div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#5A6080' }}>
        <span>Comprobante emitido por Web Service</span>
        <span>Generado con Facti</span>
      </div>
    </div>
  );
}
