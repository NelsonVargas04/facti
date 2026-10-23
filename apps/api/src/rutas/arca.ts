import type { FastifyInstance } from 'fastify';
import { consultarPadron } from '@facti/arca';
import { formatearCuit, validarCuit } from '@facti/shared';
import { clientesArca } from '../arca.js';

/** Rutas que consultan ARCA. Si falta configuración, el errorHandler responde 503. */
export async function rutasArca(app: FastifyInstance): Promise<void> {
  // Estado de los servidores de ARCA (FEDummy). No requiere autenticación en ARCA.
  app.get('/estado', async () => {
    const { wsfe, cfg } = clientesArca();
    return { entorno: cfg.entorno, servidores: await wsfe.estado() };
  });

  app.get('/puntos-venta', async () => {
    const { wsfe } = clientesArca();
    return { puntosVenta: await wsfe.puntosDeVenta() };
  });

  app.get<{ Params: { cuit: string } }>('/padron/:cuit', async (req, reply) => {
    const { cuit } = req.params;
    if (!validarCuit(cuit)) {
      return reply.code(400).send({ error: 'cuit_invalido', mensaje: `El CUIT ${cuit} no es válido` });
    }
    const { cfg, tickets } = clientesArca();
    const datos = await consultarPadron(cfg, tickets, cuit.replace(/\D/g, ''));
    const { original: _original, ...resumen } = datos;
    return { ...resumen, cuit: formatearCuit(resumen.cuit) };
  });
}
