import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ArcaError, ArcaSinRespuestaError } from '@facti/arca';
import { ConfiguracionError } from './arca.js';
import { rutasSalud } from './rutas/salud.js';
import { rutasArca } from './rutas/arca.js';
import { rutasFacturas } from './rutas/facturas.js';

/** Arma la instancia de Fastify con sus rutas y el manejo de errores. */
export async function construirServidor() {
  const app = Fastify({ logger: true });

  // Permite que la web (apps/web, otro puerto) consuma la API desde el navegador.
  await app.register(cors, {
    origin: process.env.WEB_ORIGIN?.split(',') ?? true,
  });

  // Traduce los errores de dominio a códigos HTTP claros.
  app.setErrorHandler((error: Error & { statusCode?: number }, _req, reply) => {
    if (error instanceof ConfiguracionError) {
      return reply.code(503).send({ error: 'configuracion', mensaje: error.message });
    }
    if (error instanceof ArcaSinRespuestaError) {
      return reply.code(504).send({ error: 'arca_sin_respuesta', mensaje: error.message });
    }
    if (error instanceof ArcaError) {
      return reply.code(502).send({ error: 'arca', mensaje: error.message, detalles: error.detalles });
    }
    app.log.error(error);
    return reply.code(error.statusCode ?? 500).send({ error: 'interno', mensaje: error.message });
  });

  app.register(rutasSalud);
  app.register(rutasArca, { prefix: '/arca' });
  app.register(rutasFacturas);
  return app;
}

const puerto = Number(process.env.API_PORT ?? 4000);
try {
  const servidor = await construirServidor();
  const dir = await servidor.listen({ port: puerto, host: '0.0.0.0' });
  servidor.log.info(`Facti API escuchando en ${dir}`);
} catch (e) {
  console.error(e);
  process.exit(1);
}
