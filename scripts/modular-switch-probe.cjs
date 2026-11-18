/**
 * Track R6 — the modular-engine switch, browser probe (BE).
 *
 * Verifies the opt-in `engine.js#generate()` switch directly:
 *   1. serves the repo and opens `index.html` in real Chromium
 *   2. builds a deterministic source canvas
 *   3. `engine.generate({ modular: true })` -> shapes from the MODULAR engine
 *   4. `engine.generate({ modular: false })` -> shapes from the legacy Painter
 *   5. asserts both return shapes, both paint real ink, the default is OFF, and
 *      the modular path does nothing unless the switch is set.
 *
 * Exit 0 = every assertion passed.
 *
 * Run:
 *   NODE_PATH=<dir containing playwright-core> node scripts/modular-switch-probe.cjs [--width=1440]
 *       [--json=docs/research/modular-switch.json] [--shot=docs/research/modular-switch.png]
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const argOf = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const WIDTH = parseInt(argOf('width', '1440'), 10);
const HEIGHT = parseInt(argOf('height', '900'), 10);
const JSON_OUT = argOf('json', path.join(ROOT, 'docs', 'research', 'modular-switch.json'));
const SHOT = argOf('shot', path.join(ROOT, 'docs', 'research', 'modular-switch.png'));

function findChromium() {
  const base = path.join(process.env.HOME || '', '.cache', 'ms-playwright');
  if (fs.existsSync(base)) {
    const dirs = fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort();
    // newest first
    for (const d of dirs.reverse()) {
      const exe = path.join(base, d, 'chrome-linux64', 'chrome');
      if (fs.existsSync(exe)) return exe;
    }
  }
  return process.env.CHROME_BINARY || undefined;
}

async function main() {
  const exe = findChromium();
  if (!exe) { console.error('FAIL: no Chromium found (set CHROME_BINARY)'); process.exit(2); }

  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    const file = path.join(ROOT, url === '/' ? '/index.html' : url);
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      const ext = path.extname(file);
      const type = ext === '.js' ? 'text/javascript' : ext === '.html' ? 'text/html'
        : ext === '.css' ? 'text/css' : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type });
      res.end(data);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  const consoleErrors = [];
  const notFound = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  // The headless server has no /favicon.ico — capture 404 URLs so we can prove
  // the ONLY missing resource is the favicon (the generic console text carries
  // no URL, so filtering the text alone cannot distinguish it from a real 404).
  page.on('response', (r) => { if (r.status() === 404) notFound.push(r.url()); });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(async ({ origin }) => {
    const { PaintingEngine } = await import(`${origin}/js/engine/engine.js`);
    const S = 200;

    // deterministic source: soft blobs + concentric rings
    const src = document.createElement('canvas');
    src.width = S; src.height = S;
    const sctx = src.getContext('2d');
    const id = sctx.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4;
        let r = 235, g = 235, b = 232;
        const blobs = [[50, 60, 26, [40, 60, 120]], [140, 70, 20, [150, 60, 40]], [100, 140, 22, [40, 120, 70]]];
        const rings = [[100, 100, 46, [20, 20, 20]], [46, 142, 22, [90, 30, 90]]];
        for (const [cx, cy, rad, col] of blobs) {
          const d = Math.hypot(x - cx, y - cy) / rad;
          if (d < 1) { const k = Math.max(0, 1 - d) ** 1.6; r = r * (1 - k) + col[0] * k; g = g * (1 - k) + col[1] * k; b = b * (1 - k) + col[2] * k; }
        }
        for (const [cx, cy, rad, col] of rings) {
          const dd = Math.abs(Math.hypot(x - cx, y - cy) - rad);
          if (dd < 3.5) { const k = 1 - dd / 3.5; r = r * (1 - k) + col[0] * k; g = g * (1 - k) + col[1] * k; b = b * (1 - k) + col[2] * k; }
        }
        id.data[i] = r; id.data[i + 1] = g; id.data[i + 2] = b; id.data[i + 3] = 255;
      }
    }
    sctx.putImageData(id, 0, 0);

    const canvas = document.createElement('canvas');
    canvas.width = S; canvas.height = S;
    const eng = new PaintingEngine({ canvas, width: S, height: S, background: '#ffffff', useWorker: false });
    await eng.loadImage(src);

    const measure = () => {
      eng.renderer.renderAll({ progress: 1, clear: true });
      const ctx = canvas.getContext('2d');
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let painted = 0; const colours = new Set();
      for (let p = 0; p < d.length; p += 4) {
        const r = d[p], g = d[p + 1], b = d[p + 2], a = d[p + 3];
        if (a < 8 || (r > 250 && g > 250 && b > 250)) continue;
        painted++; colours.add(`${r >> 3},${g >> 3},${b >> 3}`);
      }
      return { painted, uniqueColours: colours.size };
    };

    const defaultModular = eng.settings.modular === true;

    // ON — modular engine
    const onShapes = await eng.generate({ modular: true, style: 'pencil', count: 250, seed: 12345 });
    const onMetrics = measure();
    const onStyleFields = [...new Set(onShapes.map((s) => s.style))];
    const onShapeOk = onShapes.length ? onShapes.every((s) => Array.isArray(s.params) && s.params.length >= 5 && Array.isArray(s.color0)) : false;

    // OFF — legacy Painter
    const offShapes = await eng.generate({ modular: false, style: 'pencil', count: 250, seed: 12345 });
    const offMetrics = measure();

    // ── the APP's REAL configuration — `useWorker: true` (js/ui/app.js:89) ────
    // The app constructs the engine with the worker enabled, so the switch must
    // be proven THERE and not only on the main-thread engine above. It works
    // because the modular branch in `engine.js#generate()` sits BEFORE the worker
    // branch and returns early — this case is what pins that ordering.
    const canvasW = document.createElement('canvas');
    canvasW.width = S; canvasW.height = S;
    const engW = new PaintingEngine({ canvas: canvasW, width: S, height: S, background: '#ffffff', useWorker: true });
    await engW.loadImage(src);
    const workerShapes = await engW.generate({ modular: true, style: 'pencil', count: 250, seed: 12345 });
    engW.renderer.renderAll({ progress: 1, clear: true });
    const dW = canvasW.getContext('2d').getImageData(0, 0, S, S).data;
    let paintedW = 0;
    for (let p = 0; p < dW.length; p += 4) {
      if (dW[p + 3] < 8) continue;
      if (dW[p] > 250 && dW[p + 1] > 250 && dW[p + 2] > 250) continue;
      paintedW++;
    }
    const workerShapeOk = workerShapes.length > 0
      && workerShapes.every((s) => Array.isArray(s.params) && s.params.length >= 5 && Array.isArray(s.color0));

    return {
      S, registry: (await import(`${origin}/js/styles/index.js`)).getAllStyles().length,
      defaultModular,
      on: { shapes: onShapes.length, metrics: onMetrics, styleFields: onStyleFields, shapeOk: onShapeOk },
      off: { shapes: offShapes.length, metrics: offMetrics },
      worker: { shapes: workerShapes.length, painted: paintedW, shapeOk: workerShapeOk },
      shot: canvas.toDataURL('image/png'),
    };
  }, { origin: `http://127.0.0.1:${port}` });

  await browser.close();
  server.close();

  fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
  fs.writeFileSync(JSON_OUT, JSON.stringify(result, null, 2) + '\n');
  if (result.shot) fs.writeFileSync(SHOT, Buffer.from(result.shot.replace(/^data:image\/png;base64,/, ''), 'base64'));

  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); else console.log(`  \u2713 ${msg}`); };
  console.log(`\n=== modular-engine switch probe @ ${WIDTH}x${HEIGHT} ===`);
  // The R6 default flip (commit 5b52357, human-approved, 9 pins re-baselined)
  // turned `settings.modular` ON — this guard was written against the old
  // opt-in contract and stayed red ever since. Assert the SHIPPED contract.
  ok(result.defaultModular === true, `default settings.modular is true (got ${result.defaultModular})`);
  ok(result.on.shapes > 0, `modular generate returns shapes (${result.on.shapes})`);
  ok(result.off.shapes > 0, `painter generate returns shapes (${result.off.shapes})`);
  ok(result.on.shapeOk, `every modular shape is engine-format (params + color0)`);
  ok(result.on.metrics.painted > 0, `modular path paints ink (${result.on.metrics.painted} px / ${result.on.metrics.uniqueColours} colours)`);
  ok(result.off.metrics.painted > 0, `painter path paints ink (${result.off.metrics.painted} px / ${result.off.metrics.uniqueColours} colours)`);
  // The app runs `useWorker: true`, so the switch has to work from THAT engine:
  // the modular branch precedes the worker branch and returns early.
  ok(result.worker.shapes > 0, `modular works under the APP config (useWorker:true) — ${result.worker.shapes} shapes`);
  ok(result.worker.shapeOk, 'every shape is engine-format under useWorker:true');
  ok(result.worker.painted > 0, `the worker-configured modular path paints ink (${result.worker.painted} px)`);
  const realErrors = consoleErrors.filter((t) => !/status of 404/.test(t));
  ok(realErrors.length === 0, `0 non-404 console errors (got ${realErrors.length})`);
  ok(notFound.every((u) => /favicon\.ico/.test(u)), `every 404 is the favicon (${notFound.length} 404(s))`);
  console.log(`  json: ${JSON_OUT}\n  shot: ${SHOT}`);
  if (fails.length) {
    console.log(`\nFAIL \u2014 ${fails.length} assertion(s):`);
    fails.forEach((f) => console.log('  \u2717 ' + f));
    consoleErrors.forEach((e) => console.log('    console-error: ' + e));
    process.exit(1);
  }
  console.log('\nPASS');
}

main().catch((e) => { console.error('probe crashed:', e); process.exit(2); });
