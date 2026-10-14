import { TIPOS_COMPROBANTE } from '../packages/arca/src/index.js';
import { crearClientes } from './_cliente.js';

const { cfg, wsfe, puntoVenta } = crearClientes();
console.log(`Entorno: ${cfg.entorno}`);

console.log('1. Estado de los servidores de ARCA...');
console.log(await wsfe.estado());

console.log('2. Puntos de venta Web Services del emisor...');
console.log(await wsfe.puntosDeVenta());

console.log(`3. Último Factura C autorizada en el punto de venta ${puntoVenta}...`);
console.log(await wsfe.ultimoAutorizado(puntoVenta, TIPOS_COMPROBANTE.FACTURA_C));

console.log('Conexión OK ✔');
