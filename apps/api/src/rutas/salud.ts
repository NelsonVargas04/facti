import type { FastifyInstance } from 'fastify';

/** Rutas que no tocan ARCA: sirven para saber que el server está vivo. */
export async function rutasSalud(app: FastifyInstance): Promise<void> {
  app.get('/', async () => ({
    nombre: 'Facti API',
    descripcion: 'Facturación electrónica conectada con ARCA',
    rutas: ['GET /salud', 'GET /arca/estado', 'GET /arca/puntos-venta', 'GET /arca/padron/:cuit'],
  }));

  app.get('/salud', async () => ({
    ok: true,
    servicio: 'facti-api',
    entorno: process.env.ARCA_ENTORNO ?? 'homologacion',
    hora: new Date().toISOString(),
  }));
}
