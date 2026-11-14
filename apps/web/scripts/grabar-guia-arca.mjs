// Graba la guía "Conectá Facti con ARCA" como MP4, cuadro por cuadro.
//
// Uso (con la web corriendo en http://localhost:3000):
//   node apps/web/scripts/grabar-guia-arca.mjs
// Deja el video en apps/web/public/videos/conectar-arca.mp4.
//
// Abre Chrome sin ventana, carga /guias/conectar-arca?grabar=1, mueve el tiempo con window.__irA(t)
// y saca una captura por cuadro (así el video sale parejo aunque la compu sea lenta). Después ffmpeg
// arma el MP4. Necesita Chrome y ffmpeg instalados.

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const SALIDA = resolve(aqui, '../public/videos/conectar-arca.mp4');
const URL = process.env.GUIA_URL ?? 'http://localhost:3000/guias/conectar-arca?grabar=1';
const FPS = Number(process.env.FPS ?? 24);
const ESCALA = 1.5; // 1280×720 dibujado a 1920×1080 para que el texto se vea nítido
const PUERTO = 9333;

const CHROME =
  process.env.CHROME ??
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => existsSync(p));
if (!CHROME) throw new Error('No encontré Chrome. Pasá la ruta en la variable CHROME.');

const perfil = join(tmpdir(), `facti-grabar-${Date.now()}`);
const cuadros = join(tmpdir(), `facti-cuadros-${Date.now()}`);
mkdirSync(cuadros, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PUERTO}`,
  `--user-data-dir=${perfil}`,
  '--hide-scrollbars',
  '--force-color-profile=srgb',
  '--window-size=1280,720',
  'about:blank',
]);

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function conectar() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PUERTO}/json/new?about:blank`, { method: 'PUT' });
      return await r.json();
    } catch {
      await esperar(200);
    }
  }
  throw new Error('Chrome no respondió');
}

const destino = await conectar();
const ws = new WebSocket(destino.webSocketDebuggerUrl);
await new Promise((ok, mal) => {
  ws.onopen = ok;
  ws.onerror = mal;
});
let id = 0;
const pendientes = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pendientes.has(d.id)) {
    const { ok, mal } = pendientes.get(d.id);
    pendientes.delete(d.id);
    d.error ? mal(new Error(d.error.message)) : ok(d.result);
  }
};
const cdp = (method, params = {}) =>
  new Promise((ok, mal) => {
    const n = ++id;
    pendientes.set(n, { ok, mal });
    ws.send(JSON.stringify({ id: n, method, params }));
  });

try {
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: ESCALA, mobile: false });
  await cdp('Page.navigate', { url: URL });

  // Esperar a que la página esté lista (fuentes cargadas y window.__irA definida).
  let total = 0;
  for (let i = 0; i < 120; i++) {
    const r = await cdp('Runtime.evaluate', {
      expression: `(async () => { if (!window.__irA) return 0; await document.fonts.ready; return 1; })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.result.value === 1) break;
    await esperar(500);
  }
  const dur = await cdp('Runtime.evaluate', { expression: 'window.__duracion', returnByValue: true });
  total = Number(process.env.DURACION ?? dur.result.value ?? 104);

  const n = Math.ceil(total * FPS);
  console.log(`Grabando ${n} cuadros (${total} s a ${FPS} fps)...`);
  for (let i = 0; i < n; i++) {
    const t = i / FPS;
    await cdp('Runtime.evaluate', { expression: `window.__irA(${t})`, awaitPromise: true });
    const shot = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 1280, height: 720, scale: 1 } });
    writeFileSync(join(cuadros, `c${String(i).padStart(5, '0')}.jpg`), Buffer.from(shot.data, 'base64'));
    if (i % (FPS * 5) === 0) console.log(`  ${Math.round(t)} s`);
  }

  mkdirSync(dirname(SALIDA), { recursive: true });
  const ff = spawnSync(
    'ffmpeg',
    ['-y', '-framerate', String(FPS), '-i', join(cuadros, 'c%05d.jpg'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', SALIDA],
    { stdio: 'inherit' },
  );
  if (ff.status !== 0) throw new Error('ffmpeg falló');
  console.log(`Listo: ${SALIDA}`);
} finally {
  ws.close();
  chrome.kill();
  await esperar(500);
  rmSync(cuadros, { recursive: true, force: true });
  rmSync(perfil, { recursive: true, force: true });
}
