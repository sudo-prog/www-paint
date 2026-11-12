#!/usr/bin/env node
/**
 * Probe: the p5.brush stamp path must never silently blank a style, and an
 * export must never wipe the caller's canvas. (defects found 2026-11-12)
 *
 * Runs the REAL app page in headless Chromium (`--disable-gpu`), which is the
 * environment every behavioural probe in this repo uses. Three invariants:
 *
 *   1. HONESTY   `isBrushReady()` may only be true when a stamp actually marks
 *                pixels. A WebGL2 context merely EXISTING is not proof the build
 *                can draw (a software rasteriser reports a valid context and
 *                renders nothing), so a style that trusts the stamp path painted
 *                nothing and the whole canvas came out blank.
 *   2. INK       after generating strokes, the engine canvas must contain real
 *                ink (not a flat background).
 *   3. NO WIPE   exporting must not resize+clear the live canvas: the bitmap
 *                before and after an export must be identical.
 *
 * Usage: NODE_PATH=<dir with playwright-core> node scripts/brush-path-probe.cjs
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');

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

const PAGE_FN = async () => {
  const app = window.__app;
  const out = {};
  const stats = (c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let ink = 0, sum = 0;
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
      sum += l;
      if (l < 200) ink++;
    }
    return { lum: +(sum / n).toFixed(2), inkPct: +(100 * ink / n).toFixed(2) };
  };

  const BSE = await import('/js/engine/brush-stamp-engine.js');
  out.isBrushReady = BSE.isBrushReady();
  out.lastStampError = String(BSE.lastStampError() || '').slice(0, 200);

  // A deterministic source image, loaded through the app's own path.
  const src = document.createElement('canvas');
  src.width = 96; src.height = 96;
  const sx = src.getContext('2d');
  const g = sx.createLinearGradient(0, 0, 96, 96);
  g.addColorStop(0, '#dfe6ef'); g.addColorStop(1, '#3a4658');
  sx.fillStyle = g; sx.fillRect(0, 0, 96, 96);
  sx.fillStyle = '#802020'; sx.beginPath(); sx.arc(48, 48, 16, 0, 7); sx.fill();
  await app.loadImageFile(await new Promise((r) => src.toBlob(r, 'image/png')));

  app.engine.useWorker = false;
  const shapes = await app.engine.generate({ count: 200, seed: 12345, layer: 0 });
  out.shapes = shapes.length;
  app.engine.render();
  out.canvasInk = stats(app.canvasEl);

  // INVARIANT 1: if the engine claims the stamp path is usable, a stamp must
  // actually change pixels.
  if (out.isBrushReady && shapes[0]) {
    const t = document.createElement('canvas');
    t.width = 96; t.height = 96;
    const tc = t.getContext('2d');
    tc.fillStyle = '#f5f5f5'; tc.fillRect(0, 0, 96, 96);
    const before = tc.getImageData(0, 0, 96, 96).data;
    const ok = BSE.stampStrokeSync(tc, shapes[0], {
      brushName: 'cpencil',
      color: shapes[0].color0 || [0, 0, 0],
      alpha: 1,
      size: shapes[0].params[6],
      progress: 1,
    });
    const after = tc.getImageData(0, 0, 96, 96).data;
    let changed = 0;
    for (let i = 0; i < after.length; i += 4) {
      if (after[i] !== before[i] || after[i + 1] !== before[i + 1] || after[i + 2] !== before[i + 2]) changed++;
    }
    out.stampReportedOk = ok;
    out.stampChangedPixels = changed;
  }

  // INVARIANT 3: exporting must not resize+clear the live canvas.
  const urlBefore = app.canvasEl.toDataURL('image/png');
  const blob = await app.engine.exportPNG({ width: 128, height: 128 });
  out.exportBytes = blob.size;
  const urlAfter = app.canvasEl.toDataURL('image/png');
  out.exportKeptVisibleBitmap = urlBefore === urlAfter;
  const u = URL.createObjectURL(blob);
  const im = new Image(); im.src = u; await im.decode();
  const ec = document.createElement('canvas');
  ec.width = im.width; ec.height = im.height;
  ec.getContext('2d').drawImage(im, 0, 0);
  out.exportInk = stats(ec);
  URL.revokeObjectURL(u);
  return out;
};

async function main() {
  const exe = findChromium();
  if (!exe) { console.error('harness failure: no Chromium'); process.exit(2); }

  const { server, port } = await startServer();
  const browser = await chromium.launch({
    headless: true,
    executablePath: exe,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource/.test(t)) return;
    pageErrors.push(t);
  });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => !!window.__app, { timeout: 20000 });
  const r = await page.evaluate(PAGE_FN);

  await browser.close();
  server.close();

  console.log(JSON.stringify(r, null, 2));
  if (pageErrors.length) console.log('page errors: ' + pageErrors.slice(0, 3).join(' | '));

  const fail = (m) => { console.error('FAIL: ' + m); process.exit(1); };
  if (!r.shapes) fail('the engine generated no strokes');
  if (r.isBrushReady && !(r.stampChangedPixels > 0)) {
    fail(`isBrushReady() is true but a stamp changed 0 pixels (the stamp path would blank every style)`);
  }
  if (!(r.canvasInk.inkPct > 1)) fail(`the engine canvas has no ink (inkPct=${r.canvasInk.inkPct})`);
  if (!(r.exportInk.inkPct > 1)) fail(`the exported PNG has no ink (inkPct=${r.exportInk.inkPct})`);
  if (!r.exportKeptVisibleBitmap) fail('exporting resized+cleared the live canvas (the painting was wiped)');
  if (pageErrors.length) fail('page errors: ' + pageErrors.slice(0, 3).join(' | '));

  console.log('PASS: brush path is honest (ready implies it marks pixels), the canvas and the '
    + 'export both contain ink, and an export leaves the visible painting intact');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(2); });
