#!/usr/bin/env node
/**
 * Render the frog fixture through the REAL app path (PaintingEngine, useWorker:true)
 * for BEFORE / AFTER / TEACHER three-way comparison.
 *
 * BEFORE  — pristine HEAD extraction (d32b00f), served from /tmp/scratch-before
 * AFTER   — the current working tree, served from the repo root
 * TEACHER — /tmp/head-to-head/codepaint-stage.png
 *
 * Usage:
 *   NODE_PATH=$HOME/.hermes/hermes-agent/node_modules \
 *     node scripts/contour-shots.cjs
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const W = 512, H = 384;
const OUT_DIR = path.join(__dirname, '..', 'docs', 'research');
fs.mkdirSync(OUT_DIR, { recursive: true });

// The teacher reference lives outside the repo.
const TEACHER_PNG = '/tmp/head-to-head/codepaint-stage.png';

// ── static file server ────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.wasm': 'application/wasm', '.txt': 'text/plain',
};

function startServer(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(root, url === '/' ? '/index.html' : url);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function findChromium() {
  const base = path.join(require('os').homedir(), '.cache', 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  const dirs = fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d))
    .sort((a, b) => parseInt(b.split('-')[1]) - parseInt(a.split('-')[1]));
  for (const d of dirs) {
    for (const sub of ['chrome-linux64', 'chrome-linux']) {
      const p = path.join(base, d, sub, 'chrome');
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

// The probe page drives PaintingEngine exactly as app.js does.
const PROBE_HTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>shot</title></head>
<body>
<canvas id="c" width="${W}" height="${H}"></canvas>
<canvas id="src" width="${W}" height="${H}"></canvas>
<script type="module">
import { PaintingEngine } from './js/engine/engine.js';
window.__run = async function () {
  const e = new PaintingEngine({ canvas: document.getElementById('c'), useWorker: true });
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'test-images/frog-source.jpg'; });
  await e.loadImage(img);
  await e.generate({ style: 'graphic', count: 700, seed: 12345 });
  e.renderer.renderAll({ progress: 1, clear: false });
  return document.getElementById('c').toDataURL('image/png');
};
window.__ready = true;
</script>
</body></html>`;

(async () => {
  const chrome = findChromium();
  if (!chrome) { console.error('no chromium'); process.exit(1); }

  const beforeRoot = '/tmp/scratch-before';
  const afterRoot = path.resolve(__dirname, '..');

  // Write the probe into both roots so each server serves its own engine code.
  fs.writeFileSync(path.join(beforeRoot, 'shot-probe.html'), PROBE_HTML);
  fs.writeFileSync(path.join(afterRoot, 'shot-probe.html'), PROBE_HTML);

  const beforeSrv = await startServer(beforeRoot);
  const afterSrv = await startServer(afterRoot);

  const browser = await chromium.launch({ headless: true, executablePath: chrome,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });

  const outPaths = {};
  try {
    // BEFORE
    {
      const page = await browser.newPage({ viewport: { width: W, height: H } });
      await page.goto(`http://127.0.0.1:${beforeSrv.port}/shot-probe.html`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
      const dataURL = await page.evaluate(() => window.__run(), null, { timeout: 300000 });
      const b64 = dataURL.split(',')[1];
      const buf = Buffer.from(b64, 'base64');
      const p = path.join(OUT_DIR, 'contour-before-graphic700.png');
      fs.writeFileSync(p, buf);
      outPaths.before = p;
      await page.close();
    }
    // AFTER
    {
      const page = await browser.newPage({ viewport: { width: W, height: H } });
      await page.goto(`http://127.0.0.1:${afterSrv.port}/shot-probe.html`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
      const dataURL = await page.evaluate(() => window.__run(), null, { timeout: 300000 });
      const b64 = dataURL.split(',')[1];
      const buf = Buffer.from(b64, 'base64');
      const p = path.join(OUT_DIR, 'contour-after-graphic700.png');
      fs.writeFileSync(p, buf);
      outPaths.after = p;
      await page.close();
    }
    // TEACHER
    if (fs.existsSync(TEACHER_PNG)) {
      const p = path.join(OUT_DIR, 'contour-teacher-reference.png');
      fs.copyFileSync(TEACHER_PNG, p);
      outPaths.teacher = p;
    }
  } finally {
    await browser.close();
    beforeSrv.server.close();
    afterSrv.server.close();
  }

  console.log('=== SHOTS ===');
  for (const [k, v] of Object.entries(outPaths)) console.log(k, v);

  // Side-by-side comparison image (BEFORE | AFTER | TEACHER) drawn with node canvas if available,
  // otherwise fall back to a simple horizontal strip written via the browser.
  const { createCanvas } = (() => { try { return require('canvas'); } catch { return {}; } })();
  if (createCanvas) {
    const strip = createCanvas(W * 3, H);
    const ctx = strip.getContext('2d');
    const load = (p) => {
      const img = new (require('canvas').Image)();
      img.src = fs.readFileSync(p);
      return img;
    };
    ctx.drawImage(load(outPaths.before), 0, 0, W, H);
    ctx.drawImage(load(outPaths.after), W, 0, W, H);
    ctx.drawImage(load(outPaths.teacher), W * 2, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText('BEFORE (HEAD d32b00f)', 8, 20);
    ctx.fillText('AFTER (contour pass)', W + 8, 20);
    ctx.fillText('TEACHER (Code Paint)', W * 2 + 8, 20);
    const p = path.join(OUT_DIR, 'contour-three-way-comparison.png');
    fs.writeFileSync(p, strip.toBuffer('image/png'));
    console.log('three-way', p);
  } else {
    console.log('node-canvas not available — skipping side-by-side strip');
  }
})();
