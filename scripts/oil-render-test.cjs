#!/usr/bin/env node
/**
 * Image render test — OIL first: paint a REAL image through the REAL app path
 * with the new brush stack (dli/paint impasto backend) and export the PNG.
 *
 * Drives window.__app exactly like a user: loadImageFile -> engine.generate
 * (style=oil, worker off, fixed seed) -> engine.render -> exportPNG.
 * Writes the exported painting + the live canvas to docs/research/.
 *
 * Usage: env -u DISPLAY NODE_PATH=<playwright-core dir> node scripts/oil-render-test.cjs [image] [count] [seed]
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const IMAGE = process.argv[2] || path.join(ROOT, 'test-images', 'frog-source.jpg');
const COUNT = parseInt(process.argv[3] || '700', 10);
const SEED = parseInt(process.argv[4] || '12345', 10);
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.wasm': 'application/wasm',
};

function findChromium() {
  const base = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  const dirs = fs.readdirSync(base)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => parseInt(b.split('-')[1], 10) - parseInt(a.split('-')[1], 10));
  for (const d of dirs) {
    for (const sub of [['chrome-linux64', 'chrome'], ['chrome-linux', 'chrome']]) {
      const p = path.join(base, d, ...sub);
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(ROOT, url === '/' ? '/index.html' : url);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

async function main() {
  const exe = findChromium();
  if (!exe) { console.error('harness failure: no Chromium'); process.exit(2); }
  const img = fs.readFileSync(IMAGE).toString('base64');

  const { server, port } = await startServer();
  const browser = await chromium.launch({
    headless: true,
    executablePath: exe,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu',
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/Failed to load resource/.test(m.text())) return;
    pageErrors.push(m.text());
  });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => !!window.__app, { timeout: 20000 });

  const r = await page.evaluate(async ({ img, COUNT, SEED }) => {
    const app = window.__app;
    const out = {};
    // Load the real image through the app's own path.
    const bin = atob(img);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    await app.loadImageFile(new Blob([bytes], { type: 'image/jpeg' }));
    out.imageSize = [app.engine.width, app.engine.height];

    // Generate OIL strokes through the real engine path (modular default).
    app.engine.useWorker = false;
    const shapes = await app.engine.generate({ style: 'oil', count: COUNT, seed: SEED, layer: 0 });
    out.strokes = shapes.length;
    app.engine.render();

    // Ink stats on the live canvas.
    const d = app.canvasEl.getContext('2d').getImageData(0, 0, app.canvasEl.width, app.canvasEl.height).data;
    let ink = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
      sum += l;
      if (l < 200) ink++;
    }
    out.liveInkPct = +(100 * ink / (d.length / 4)).toFixed(2);
    out.liveMeanLum = +(sum / (d.length / 4)).toFixed(2);

    // Export the painting exactly as the app does.
    const blob = await app.engine.exportPNG({ width: app.engine.width, height: app.engine.height });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
    out.exportB64 = btoa(s);
    out.exportBytes = buf.length;
    return out;
  }, { img, COUNT, SEED });

  // Save the exported painting + a screenshot of the live app.
  fs.mkdirSync(path.join(ROOT, 'docs', 'research'), { recursive: true });
  const outPath = path.join(ROOT, 'docs', 'research', 'oil-render-frog-700.png');
  fs.writeFileSync(outPath, Buffer.from(r.exportB64, 'base64'));
  delete r.exportB64;
  await page.screenshot({ path: path.join(ROOT, 'docs', 'research', 'oil-render-frog-live.png') });

  await browser.close();
  server.close();

  console.log(JSON.stringify(r, null, 2));
  console.log('exported ->', outPath);
  if (pageErrors.length) console.log('page errors:', pageErrors.slice(0, 3).join(' | '));

  let failed = false;
  const fail = (m) => { console.error('FAIL: ' + m); failed = true; };
  if (!r.strokes) fail('no strokes generated');
  if (!(r.liveInkPct > 5)) fail(`live canvas has too little ink (${r.liveInkPct}%)`);
  if (!(r.exportBytes > 1000)) fail('export is empty');
  if (pageErrors.length) fail('page errors present');
  if (failed) process.exit(1);
  console.log('PASS: oil painted the image through the real app path and exported');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(2); });
