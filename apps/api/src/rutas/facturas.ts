import type { FastifyInstance } from 'fastify';
import {
  TIPOS_COMPROBANTE,
  aFechaArca,
  deFechaArca,
  urlQR,
  type NuevoComprobante,
} from '@facti/arca';
import { clientesArca } from '../arca.js';

interface ItemReq {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
}

interface NuevaFacturaBody {
  receptor: { docTipo: number; docNro: string; condicionIvaReceptorId: number };
  concepto: 1 | 2 | 3;
  fecha?: string; // AAAA-MM-DD
  periodoServicio?: { desde: string; hasta: string; vencimientoPago: string };
  items: ItemReq[];
}

/** Interpreta una fecha AAAA-MM-DD como mediodía en hora de Argentina (evita corrimientos de día). */
function parseFecha(s?: string): Date {
  if (!s) return new Date();
  return new Date(`${s}T12:00:00-03:00`);
}

function esValido(b: unknown): b is NuevaFacturaBody {
  if (!b || typeof b !== 'object') return false;
  const x = b as NuevaFacturaBody;
  if (!x.receptor || typeof x.receptor.docTipo !== 'number' || typeof x.receptor.condicionIvaReceptorId !== 'number') return false;
  if (![1, 2, 3].includes(x.concepto)) return false;
  if (!Array.isArray(x.items) || x.items.length === 0) return false;
  return x.items.every((i) => typeof i.cantidad === 'number' && typeof i.precioUnitario === 'number');
}

/**
 * Emite una Factura C (fase 1: persona humana monotributo) contra ARCA y devuelve el CAE y el QR.
 * Si falta certificado o .env, clientesArca() lanza ConfiguracionError y el server responde 503.
 */
export async function rutasFacturas(app: FastifyInstance): Promise<void> {
  app.post('/facturas', async (req, reply) => {
    if (!esValido(req.body)) {
      return reply.code(400).send({ error: 'datos_invalidos', mensaje: 'Faltan datos del comprobante o los ítems.' });
    }
    const body = req.body;

    const total = body.items.reduce((acc, it) => acc + it.cantidad * it.precioUnitario, 0);
    if (total <= 0) {
      return reply.code(400).send({ error: 'total_invalido', mensaje: 'El total debe ser mayor a cero.' });
    }

    const { wsfe, cuitEmisor, puntoVenta } = clientesArca();
    const fecha = parseFecha(body.fecha);

    const comprobante: NuevoComprobante = {
      puntoVenta,
      tipo: TIPOS_COMPROBANTE.FACTURA_C,
      concepto: body.concepto,
      docTipo: body.receptor.docTipo,
      docNro: body.receptor.docNro,
      condicionIvaReceptorId: body.receptor.condicionIvaReceptorId,
      fecha,
      importeTotal: total,
      importeNeto: total, // La Factura C no discrimina IVA.
      servicio: body.periodoServicio
        ? {
            desde: parseFecha(body.periodoServicio.desde),
            hasta: parseFecha(body.periodoServicio.hasta),
            vencimientoPago: parseFecha(body.periodoServicio.vencimientoPago),
          }
        : undefined,
    };

    const r = await wsfe.emitir(comprobante);
    if (!r.aprobado || !r.cae) {
      return reply.code(422).send({
        error: 'rechazada',
        mensaje: 'ARCA no autorizó la factura.',
        observaciones: r.observaciones,
        errores: r.errores,
      });
    }

    const fechaArca = aFechaArca(fecha);
    const qr = urlQR({
      fecha: deFechaArca(fechaArca),
      cuit: Number(cuitEmisor),
      ptoVta: puntoVenta,
      tipoCmp: TIPOS_COMPROBANTE.FACTURA_C,
      nroCmp: r.numero,
      importe: total,
      moneda: 'PES',
      ctz: 1,
      tipoDocRec: body.receptor.docTipo,
      nroDocRec: Number(body.receptor.docNro.replace(/\D/g, '')) || 0,
      tipoCodAut: 'E',
      codAut: Number(r.cae),
    });

    return {
      aprobado: true,
      letra: 'C',
      tipo: TIPOS_COMPROBANTE.FACTURA_C,
      puntoVenta,
      numero: r.numero,
      cae: r.cae,
      vencimientoCae: r.vencimientoCae ? deFechaArca(r.vencimientoCae) : undefined,
      total,
      fecha: deFechaArca(fechaArca),
      qr,
      observaciones: r.observaciones,
    };
  });
}
