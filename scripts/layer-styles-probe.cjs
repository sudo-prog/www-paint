#!/usr/bin/env node
/**
 * Probe for Phase 2.2 — per-layer styles (the app's actual render path).
 *
 * The renderer dispatches on each shape's own `style` (`_styles[shape.style]`),
 * so writing `layer.style` alone is inert. Before this change the layer panel's
 * style dropdown was a documented no-op ("regenerate is what applies a style").
 * This probe proves `engine.setLayerStyle()` now applies the change live.
 *
 * It also drives `engine.generate({ layerStyles })` and `preserveLayerProps()`
 * directly (the multi-layer plumbing) — but note the CURRENT multi-layer
 * RENDER path (`renderer.renderAll` multiLayer branch) is broken and is NOT
 * asserted here; see docs/checkpoints/P2.2.md.
 *
 * Usage: NODE_PATH=<...> node scripts/layer-styles-probe.cjs
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const JSON_OUT = path.join(ROOT, 'docs', 'research', 'layer-styles-probe.json');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.wasm': 'application/wasm',
};

function findChromium() {
  const base = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  const dirs = fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d))
    .sort((a, b) => parseInt(b.split('-')[1]) - parseInt(a.split('-')[1]));
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
  const { PaintingEngine } = await import('/js/engine/engine.js');
  const { applyLayerStyles, preserveLayerProps, resolveLayerStyles } = await import('/js/engine/layer-styles.js');

  const size = 160;
  const src = document.createElement('canvas');
  src.width = size; src.height = size;
  const sctx = src.getContext('2d');
  const g = sctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#dfe6ef'); g.addColorStop(1, '#3a4658');
  sctx.fillStyle = g; sctx.fillRect(0, 0, size, size);

  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const eng = new PaintingEngine({ canvas, width: size, height: size, useWorker: false, background: '#ffffff' });
  await eng.loadImage(src);

  const ink = (cv) => {
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let n = 0, h = 2166136261 >>> 0;
    for (let i = 0; i < d.length; i += 4) {
      h ^= d[i]; h = Math.imul(h, 16777619) >>> 0;
      if (d[i] !== 255 || d[i + 1] !== 255 || d[i + 2] !== 255) n++;
    }
    return { ink: n, hash: h >>> 0 };
  };

  // The app's real path: single layer (layer 0), no multi-layer.
  // Start from a style that paints on the plain canvas (see P2.2 note).
  await eng.generate({ style: 'watercolor', count: 400, seed: 4242, layer: 0 });
  const before = ink(eng.render());

  // setLayerStyle must restamp the layer's strokes and change the render.
  const applied = eng.setLayerStyle(0, 'ink');
  const afterStyle = [...new Set((eng.getLayer(0).strokes || []).map(s => s.style))];
  const after = ink(eng.render());

  // A per-layer style change must survive a re-render (idempotent extra render).
  const after2 = ink(eng.render());

  // generate({ layerStyles }) plumbing (pure mapping; the multi-layer RENDER is broken).
  const shapes = [{ layerName: 'background', style: 'pencil' }, { layerName: 'midtone', style: 'pencil' }];
  applyLayerStyles(shapes, { background: 'watercolor', midtone: 'ink' });
  const plumb = {
    mapped: shapes.map(s => s.style),
    resolvedString: resolveLayerStyles('oil') && resolveLayerStyles('oil').midtone,
    preserved: (() => {
      const fresh = [{ _name: 'midtone', visible: true }];
      preserveLayerProps(fresh, [{ _name: 'midtone', visible: false, opacity: 0.3 }]);
      return [fresh[0].visible, fresh[0].opacity];
    })(),
  };

  eng.destroy();
  return { before, after, after2, applied, afterStyle, plumb };
};

async function main() {
  const exe = findChromium();
  if (!exe) { console.error('harness failure: no Chromium'); process.exit(2); }

  const { server, port } = await startServer();
  const browser = await chromium.launch({
    headless: true, executablePath: exe,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource/.test(t)) return;
    if (/<polyline> attribute points/.test(t)) return;
    pageErrors.push(t);
  });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => !!window.__app, { timeout: 15000 });

  const r = await page.evaluate(PAGE_FN);
  await browser.close();
  server.close();

  fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
  fs.writeFileSync(JSON_OUT, JSON.stringify(r, null, 2));
  console.log(JSON.stringify({ ...r, pageErrors: pageErrors.slice(0, 5) }, null, 2));

  const okA = r.before.ink > 1000;                                     // painting happened
  const okB = r.applied === true && r.afterStyle.length === 1 &&
    r.afterStyle[0] === 'ink';
  const okC = r.after.hash !== r.before.hash && r.after2.hash === r.after.hash; // changes & stable
  const okD = r.plumb.mapped[0] === 'watercolor' && r.plumb.mapped[1] === 'ink' &&
    r.plumb.resolvedString === 'oil' && r.plumb.preserved[0] === false &&
    r.plumb.preserved[1] === 0.3;

  if (!okA) { console.error('FAIL: no painting rendered'); process.exit(1); }
  if (!okB) { console.error('FAIL: setLayerStyle did not restamp strokes'); process.exit(1); }
  if (!okC) { console.error('FAIL: render did not change / was not stable'); process.exit(1); }
  if (!okD) { console.error('FAIL: highlight-level mapping wrong'); process.exit(1); }
  if (pageErrors.length) { console.error('FAIL: page errors', pageErrors); process.exit(1); }
  console.log(`PASS: setLayerStyle applies live (ink ${r.before.ink}->${r.after.ink}), per-layer mapping + preserve correct`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(2); });
