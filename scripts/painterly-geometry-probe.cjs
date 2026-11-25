// painterly-geometry-probe.cjs — Serve repo on an ephemeral port, launch headless
// Chromium, load test-images/frog-source.jpg, select the 'painterly' style,
// generate + render, then capture #paint-canvas (id 'paint-canvas').
//
// Structure (http server + chromium launch + PNG capture) is copied from
// scripts/dli-stroke-only.cjs.
//
// TRAP 1: `window.__app.generate()` takes NO arguments — it reads the style from
//         `controls.getSettings().style`. So the style must be set on BOTH
//         `window.__app.controls.settings` and `window.__app.engine.settings`
//         before calling it.
// TRAP 2: `document.querySelector('canvas')` is the 256x160 media-panel
//         tonal-mask preview, NOT the painting. Capture `#paint-canvas`.
const { chromium } = require('playwright-core');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const REPO_ROOT = '/home/thinkpad/Data/20_Projects/20.36_WWW_PAINT';
const OUT_DIR = path.join(REPO_ROOT, 'docs/research');
const FROG_SRC = path.join(REPO_ROOT, 'test-images/frog-source.jpg');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.frag': 'text/plain', '.vert': 'text/plain' };

function findChromium() {
  const base = path.join(os.homedir(), '.cache', 'ms-playwright');
  const dirs = fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d))
    .sort((a, b) => parseInt(b.split('-')[1], 10) - parseInt(a.split('-')[1], 10));
  for (const d of dirs) for (const sub of [['chrome-linux64', 'chrome'], ['chrome-linux', 'chrome']]) {
    const p = path.join(base, d, ...sub);
    if (fs.existsSync(p)) return p;
  }
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(REPO_ROOT, url === '/' ? '/index.html' : url);
      if (!file.startsWith(REPO_ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('nf'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

(async () => {
  const CHROME_PATH = findChromium();
  if (!CHROME_PATH) { console.error('harness failure: no Chromium found'); process.exit(2); }

  const { server, port } = await startServer();
  const browser = await chromium.launch({
    headless: true, executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle',
           '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });

  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!(window._wwwPaint || window.__app), { timeout: 60000 });

  // Load the fixture straight through the app API (avoids depending on the
  // hidden file input + its change listener timing).
  const imgB64 = fs.readFileSync(FROG_SRC).toString('base64');
  const loaded = await page.evaluate(async (b64) => {
    const app = window._wwwPaint || window.__app;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const file = new File([bytes], 'frog-source.jpg', { type: 'image/jpeg' });
    await app.loadImageFile(file);
    return { width: app.engine.width, height: app.engine.height, hasImage: !!app.engine._imageData };
  }, imgB64);

  if (!loaded.hasImage) {
    console.error('image did not load:', JSON.stringify(loaded));
    process.exit(2);
  }

  const out = await page.evaluate(async () => {
    const app = window._wwwPaint || window.__app;
    const o = {};
    try {
      // TRAP 1: generate() reads the style off controls.getSettings()
      app.controls.settings.style = 'painterly';
      app.engine.settings.style = 'painterly';
      app.engine.settings.modular = false;

      const t0 = performance.now();
      const shapes = await app.engine.generate({
        style: 'painterly', count: 400, layer: 0, multiLayer: false,
      });
      const t1 = performance.now();
      await app.engine.render();
      const t2 = performance.now();

      const canvas = document.getElementById('paint-canvas');
      const ctx = canvas.getContext('2d');
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let ink = 0, black = 0;
      const distinct = new Set();
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 8) {
          ink++;
          distinct.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
          if (d[i] < 40 && d[i + 1] < 40 && d[i + 2] < 40) black++;
        }
      }
      const total = d.length / 4;
      const tags = {};
      for (const s of shapes) tags[s.style] = (tags[s.style] || 0) + 1;

      // Geometry sanity: how curved / how many points does each path imply?
      let curved = 0;
      for (const s of shapes) {
        const p = s.params;
        // perpendicular offset of the control point from the chord
        const ax = p[0], ay = p[1], bx = p[4], by = p[5];
        const cx = p[2], cy = p[3];
        const chord = Math.hypot(bx - ax, by - ay) || 1;
        const perp = Math.abs((bx - ax) * (ay - cy) - (ax - cx) * (by - ay)) / chord;
        if (perp > chord * 0.02) curved++;
      }

      o.strokes = shapes.length;
      o.genMs = Math.round(t1 - t0);
      o.renderMs = Math.round(t2 - t1);
      o.distinctColours = distinct.size;
      o.opaquePixels = Math.floor(total);
      o.inkPercent = Math.round((ink / total) * 10000) / 100;
      o.blackPixels = black;
      o.shapeStyleTags = tags;
      o.curvedStrokes = curved;
      o.ok = true;
      return o;
    } catch (e) {
      return { ok: false, error: String(e).slice(0, 400), stack: String(e.stack || '').slice(0, 600) };
    }
  });

  if (!out || out.ok !== true) {
    console.error('EVAL_RESULT', JSON.stringify(out, null, 2));
    await browser.close(); server.close();
    process.exit(2);
  }

  const dataUrl = await page.evaluate(() => document.getElementById('paint-canvas').toDataURL('image/png'));
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  const pngPath = path.join(OUT_DIR, 'painterly-geometry-probe.png');
  fs.writeFileSync(pngPath, buf);

  console.log(JSON.stringify({
    canvas: `${loaded.width}x${loaded.height}`,
    strokes: out.strokes,
    genMs: out.genMs,
    renderMs: out.renderMs,
    distinctColours: out.distinctColours,
    opaquePixels: out.opaquePixels,
    inkPercent: out.inkPercent,
    blackPixels: out.blackPixels,
    curvedStrokes: out.curvedStrokes,
    shapeStyleTags: out.shapeStyleTags,
    pageErrors: errors.slice(0, 5),
    png: pngPath,
    pngBytes: buf.length,
  }, null, 2));

  await browser.close();
  server.close();
  process.exit(0);
})().catch(e => { console.error('FAIL', e); process.exit(2); });
