/**
 * Emite una Factura C de prueba a consumidor final en HOMOLOGACIÓN.
 * Uso: npm run arca:factura-c
 */
import {
  CONCEPTOS, CONDICION_IVA_RECEPTOR, TIPOS_COMPROBANTE, TIPOS_DOCUMENTO, aFechaArca, deFechaArca, urlQR,
} from '../packages/arca/src/index.js';
import { crearClientes } from './_cliente.js';

const { cfg, wsfe, cuitEmisor, puntoVenta } = crearClientes();
if (cfg.entorno !== 'homologacion') {
  console.error('Este script de prueba solo corre en homologación.');
  process.exit(1);
}

const hoy = new Date();
const finDeMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
const total = 1000;

const resultado = await wsfe.emitir({
  puntoVenta,
  tipo: TIPOS_COMPROBANTE.FACTURA_C,
  concepto: CONCEPTOS.SERVICIOS,
  docTipo: TIPOS_DOCUMENTO.SIN_IDENTIFICAR,
  docNro: '0',
  condicionIvaReceptorId: CONDICION_IVA_RECEPTOR.CONSUMIDOR_FINAL,
  fecha: hoy,
  importeTotal: total,
  importeNeto: total,
  servicio: {
    desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1),
    hasta: finDeMes,
    vencimientoPago: new Date(hoy.getTime() + 10 * 86_400_000),
  },
});

if (!resultado.aprobado || !resultado.cae) {
  console.error('ARCA rechazó la factura:', resultado.errores, resultado.observaciones);
  process.exit(1);
}

console.log(`Factura C ${String(puntoVenta).padStart(5, '0')}-${String(resultado.numero).padStart(8, '0')} autorizada ✔`);
console.log(`CAE: ${resultado.cae} (vence ${deFechaArca(resultado.vencimientoCae!)})`);
if (resultado.observaciones.length) console.log('Observaciones:', resultado.observaciones);
console.log(
  'QR:',
  urlQR({
    fecha: deFechaArca(aFechaArca(hoy)),
    cuit: Number(cuitEmisor),
    ptoVta: puntoVenta,
    tipoCmp: TIPOS_COMPROBANTE.FACTURA_C,
    nroCmp: resultado.numero,
    importe: total,
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: TIPOS_DOCUMENTO.SIN_IDENTIFICAR,
    nroDocRec: 0,
    tipoCodAut: 'E',
    codAut: Number(resultado.cae),
  }),
);
