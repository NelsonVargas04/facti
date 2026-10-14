import { consultarPadron } from '../packages/arca/src/index.js';
import { crearClientes } from './_cliente.js';

const cuit = process.argv[2];
if (!cuit) {
  console.error('Uso: npm run arca:padron -- 20123456786');
  process.exit(1);
}
const { cfg, tickets } = crearClientes();
const datos = await consultarPadron(cfg, tickets, cuit);
const { original, ...resumen } = datos;
console.log(resumen);
