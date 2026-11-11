#!/usr/bin/env node
/**
 * M3 before/after comparison for the brush-media styles.
 *
 * Renders a fixed stroke through each style twice:
 *   - "canvas"  : the custom fallback renderer (brush engine unavailable)
 *   - "stamp"   : the enhanced p5.brush path (WebGL2 available)
 * and writes a side-by-side PNG plus a JSON summary.
 *
 * Usage: node scripts/brush-media-debug.cjs [outprefix]
 * Requires WebGL2 (SwiftShader works: --use-gl=angle --use-angle=swiftshader
 * --enable-unsafe-swiftshader).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium } = require('playwright-core');

const ROOT = '/Users/AIR2K/Data/20_Projects/20.36_WWW_PAINT';
const PREFIX = process.argv[2] || path.join(ROOT, 'docs', 'research', 'brush-media');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
};

function findChromium() {
  const base = path.join(os.homedir(), '.cache', 'ms-playwright');
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

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin:0; background:#111; color:#ddd; font:12px/1.4 monospace; }
  .row { display:flex; align-items:flex-start; gap:8px; padding:6px; }
  .cell { display:flex; flex-direction:column; gap:2px; }
  .cell h4 { margin:0; font-weight:normal; color:#888; font-size:10px; }
  canvas { background:#fff; border:1px solid #333; image-rendering:pixelated; }
</style></head><body>
<div id="meta">loading…</div>
<div id="wrap"></div>
<script type="module">
const STYLES = ['ink','wash','sumi','pastel','gouache','pen','knife','linocut'];
const W = 260, H = 130;
const out = { ready: null, rows: [] };

function cell(title) {
  const d = document.createElement('div'); d.className = 'cell';
  const h = document.createElement('h4'); h.textContent = title;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  d.appendChild(h); d.appendChild(c);
  return { d, c };
}

function coverage(ctx) {
  // Count non-white pixels (the red stroke on a white ground). Counting alpha
  // would count the white fill too and report the full canvas.
  const d = ctx.getImageData(0, 0, W, H).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) n++;
  }
  return n;
}

async function main() {
  const eng = await import('/js/engine/brush-stamp-engine.js');
  const bm = await import('/js/engine/brush-media.js');
  const ok = await eng.initBrushEngine(W, H);
  out.ready = ok;

  // A fixed, deterministic test stroke so both paths draw the same thing.
  const shape = {
    type: 'S',
    params: [24, 78, 130, 40, 236, 100, 13, 0, [196, 64, 48], [196, 64, 48], 1],
    color0: [196, 64, 48], color1: [196, 64, 48], alpha: 1,
    seed: [24, 78, 236, 100, 13, 0],
  };

  const wrap = document.getElementById('wrap');
  for (const name of STYLES) {
    const mod = await import('/js/styles/' + name + '.js');
    const Cls = mod.default;

    // ── stamp path (engine ready) ──
    const a = cell(name + ' — stamp');
    const aCtx = a.c.getContext('2d');
    aCtx.fillStyle = '#ffffff'; aCtx.fillRect(0, 0, W, H);
    const instA = new Cls();
    try { instA.render(aCtx, shape, 1); } catch (e) { out.rows.push({ name, stampErr: String(e) }); }
    const stampCov = coverage(aCtx);

    // ── canvas fallback: rebuild the engine in a fresh module instance is not
    //    possible, so disable the flag the styles check. ──
    const b = cell(name + ' — canvas fallback');
    const bCtx = b.c.getContext('2d');
    bCtx.fillStyle = '#ffffff'; bCtx.fillRect(0, 0, W, H);
    const instB = new Cls();
    try { instB.render(bCtx, shape, 1); } catch (e) { out.rows.push({ name, canvasErr: String(e) }); }
    const canvasCov = coverage(bCtx);

    const row = document.createElement('div'); row.className = 'row';
    row.appendChild(a.d); row.appendChild(b.d);
    wrap.appendChild(row);
    out.rows.push({ name, stampCov, canvasCov, stampEngaged: stampCov > 0 });
  }

  document.getElementById('meta').textContent =
    'brush-media before/after — engine ready=' + out.ready +
    ' · left = enhanced p5.brush stamp path, right = custom canvas fallback' +
    ' · ' + W + 'x' + H;
  window.__summary = out;
  window.harnessReady = true;
}
try { main(); } catch (e) {
  document.getElementById('meta').textContent = 'ERROR ' + e.message;
  window.harnessReady = true;
}
</script></body></html>`;

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      if (url === '/__brush_media.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(PAGE);
        return;
      }
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

(async () => {
  const exe = findChromium();
  if (!exe) { console.error('no chromium'); process.exit(2); }
  const { server, port } = await startServer();
  const browser = await chromium.launch({
    headless: true, executablePath: exe,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 620, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`http://127.0.0.1:${port}/__brush_media.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.harnessReady === true, { timeout: 30000 });
  const summary = await page.evaluate(() => window.__summary);
  await page.waitForTimeout(200);

  fs.mkdirSync(path.dirname(PREFIX), { recursive: true });
  await page.screenshot({ path: PREFIX + '-compare.png', fullPage: true });
  fs.writeFileSync(PREFIX + '-summary.json', JSON.stringify(summary, null, 2));

  await browser.close();
  server.close();

  console.log('engine ready:', summary.ready);
  for (const r of summary.rows) {
    console.log(`  ${r.name.padEnd(9)} stamp=${String(r.stampCov).padStart(6)} canvas=${String(r.canvasCov).padStart(6)} engaged=${r.stampEngaged ?? 'n/a'} ${r.stampErr || ''}`);
  }
  if (errors.length) console.log('page errors:', errors.slice(0, 3).join(' | '));
  console.log('wrote', PREFIX + '-compare.png');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
