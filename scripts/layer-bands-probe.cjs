/**
 * Phase 2.2 on the modular engine — multi-layer app-path probe (BE).
 *
 * Verifies the MODULAR engine's layer split in a real browser, on the REAL
 * engine path (`engine.js#generate()`), the same way the R6 switch probe does:
 *
 *   1. serves the repo and opens `index.html` in real Chromium
 *   2. `engine.generate({ multiLayer: true })` with the modular switch ON:
 *      - the engine builds the FIVE named band layers
 *        (background/shadows/outline/midtone/highlights)
 *      - every stroke carries a `layerName` from that set
 *      - at least 3 bands are populated on the zoned fixture
 *      - the composite paints real ink (multiLayer renderer on)
 *   3. per-layer styles ride THROUGH the bands ({shadows:'ink'}) on the
 *      modular path
 *   4. the APP config (`useWorker: true`) + multiLayer also returns the banded
 *      modular plan — this pins the NEW branch ordering (the modular
 *      multi-layer block precedes the worker branch and returns early)
 *   5. `modular: false` + multiLayer still routes the legacy Painter path
 *      (the old behaviour is preserved, not replaced)
 *
 * Exit 0 = every assertion passed.
 *
 * Run:
 *   NODE_PATH=<dir containing playwright-core> node scripts/layer-bands-probe.cjs
 *       [--json=<path>] [--shot=<path>]
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
const JSON_OUT = argOf('json', path.join(ROOT, 'docs', 'research', 'layer-bands.json'));
const SHOT = argOf('shot', path.join(ROOT, 'docs', 'research', 'layer-bands.png'));

function findChromium() {
  const base = path.join(process.env.HOME || '', '.cache', 'ms-playwright');
  if (fs.existsSync(base)) {
    const dirs = fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort();
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  const notFound = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('response', (r) => { if (r.status() === 404) notFound.push(r.url()); });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(async ({ origin }) => {
    const { PaintingEngine } = await import(`${origin}/js/engine/engine.js`);
    const S = 200;
    const NAMES = ['background', 'shadows', 'outline', 'midtone', 'highlights'];

    // Deterministic zoned source: bright sky, mid band, dark floor + a dark
    // blob and a bright blob so every band owns real territory.
    const src = document.createElement('canvas');
    src.width = S; src.height = S;
    const sctx = src.getContext('2d');
    const id = sctx.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4;
        let v = y < S / 3 ? 235 : y < (2 * S) / 3 ? 128 : 25;
        if (Math.hypot(x - 50, y - 30) < 18) v = 30;
        if (Math.hypot(x - 150, y - 165) < 18) v = 245;
        id.data[i] = v; id.data[i + 1] = v; id.data[i + 2] = v; id.data[i + 3] = 255;
      }
    }
    sctx.putImageData(id, 0, 0);

    const measure = (canvas, eng) => {
      // Render BEFORE measuring — a fresh engine canvas is blank until the
      // renderer composites the layers (the modular-switch probe does the
      // same inside its own measure()).
      if (eng) eng.renderer.renderAll({ progress: 1, clear: true });
      const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let painted = 0; const colours = new Set();
      for (let p = 0; p < d.length; p += 4) {
        const r = d[p], g = d[p + 1], b = d[p + 2], a = d[p + 3];
        if (a < 8 || (r > 250 && g > 250 && b > 250)) continue;
        painted++; colours.add(`${r >> 3},${g >> 3},${b >> 3}`);
      }
      return { painted, uniqueColours: colours.size };
    };
    const layerSummary = (eng) => eng.layers.map((l) => ({
      name: l._name || l.name, strokes: (l.strokes || []).length,
      visible: l.visible !== false, opacity: l.opacity,
    }));

    // ── CASE 1: modular + multiLayer on the main-thread engine ──
    const c1 = document.createElement('canvas'); c1.width = S; c1.height = S;
    const e1 = new PaintingEngine({ canvas: c1, width: S, height: S, background: '#ffffff', useWorker: false });
    await e1.loadImage(src);
    const shapes1 = await e1.generate({ modular: true, multiLayer: true, style: 'pencil', count: 60, seed: 11 });
    const m1 = measure(c1, e1);
    const layers1 = layerSummary(e1);
    const banded = shapes1.filter((s) => NAMES.includes(s.layerName));
    const populated = layers1.filter((l) => l.strokes > 0).map((l) => l.name);
    const rendererMulti = e1.renderer.multiLayer === true;

    // ── CASE 2: per-layer styles ride through the bands (modular path) ──
    const c2 = document.createElement('canvas'); c2.width = S; c2.height = S;
    const e2 = new PaintingEngine({ canvas: c2, width: S, height: S, background: '#ffffff', useWorker: false });
    await e2.loadImage(src);
    const shapes2 = await e2.generate({
      modular: true, multiLayer: true, style: 'pencil', count: 60, seed: 11,
      layerStyles: { shadows: 'ink', highlights: 'pastel' },
    });
    const shadowsInk = shapes2.filter((s) => s.layerName === 'shadows');
    const highlightsPastel = shapes2.filter((s) => s.layerName === 'highlights');
    const stylesOk = shadowsInk.length > 0 && shadowsInk.every((s) => s.style === 'ink')
      && highlightsPastel.length > 0 && highlightsPastel.every((s) => s.style === 'pastel');

    // ── CASE 3: the APP config (useWorker:true) + multiLayer ──
    const c3 = document.createElement('canvas'); c3.width = S; c3.height = S;
    const e3 = new PaintingEngine({ canvas: c3, width: S, height: S, background: '#ffffff', useWorker: true });
    await e3.loadImage(src);
    const shapes3 = await e3.generate({ modular: true, multiLayer: true, style: 'pencil', count: 60, seed: 11 });
    e3.renderer.renderAll({ progress: 1, clear: true });
    const m3 = measure(c3);
    const workerBanded = shapes3.filter((s) => NAMES.includes(s.layerName)).length;

    // ── CASE 4: legacy Painter multiLayer path still works ──
    const c4 = document.createElement('canvas'); c4.width = S; c4.height = S;
    const e4 = new PaintingEngine({ canvas: c4, width: S, height: S, background: '#ffffff', useWorker: false });
    await e4.loadImage(src);
    const shapes4 = await e4.generate({ modular: false, multiLayer: true, style: 'pencil', count: 200, seed: 11 });
    const painterMulti = e4.renderer.multiLayer === true;
    const painterLayers = layerSummary(e4);

    return {
      S,
      case1: {
        shapes: shapes1.length, banded: banded.length, rendererMulti,
        layers: layers1, populated, metrics: m1,
        shot: c1.toDataURL('image/png'),
      },
      case2: { shapes: shapes2.length, stylesOk, shadowsInk: shadowsInk.length, highlightsPastel: highlightsPastel.length },
      case3: { shapes: shapes3.length, workerBanded, metrics: m3, layers: layerSummary(e3) },
      case4: { shapes: shapes4.length, painterMulti, layers: painterLayers },
    };
  }, { origin: `http://127.0.0.1:${port}` });

  await browser.close();
  server.close();

  fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
  const { shot, ...record } = result.case1;
  fs.writeFileSync(JSON_OUT, JSON.stringify({ ...result, case1: record }, null, 2) + '\n');
  if (shot) fs.writeFileSync(SHOT, Buffer.from(shot.replace(/^data:image\/png;base64,/, ''), 'base64'));

  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); else console.log(`  \u2713 ${msg}`); };
  const c1 = result.case1, c2 = result.case2, c3 = result.case3, c4 = result.case4;
  console.log(`\n=== modular multi-layer (layer bands) probe ===`);
  ok(c1.shapes > 0, `modular multiLayer generate returns shapes (${c1.shapes})`);
  ok(c1.banded === c1.shapes, `every shape carries a layerName (${c1.banded}/${c1.shapes})`);
  ok(c1.rendererMulti, 'renderer.multiLayer is true (offscreen band compositing on)');
  ok(c1.layers.length === 5, `engine built 5 named layers (${c1.layers.length})`);
  ok(c1.populated.length >= 3, `\u22653 bands populated (${c1.populated.join(', ')})`);
  ok(c1.metrics.painted > 0, `banded composite paints ink (${c1.metrics.painted} px / ${c1.metrics.uniqueColours} colours)`);
  ok(c2.stylesOk, `per-layer styles restamp through the bands (${c2.shadowsInk} shadows\u2192ink, ${c2.highlightsPastel} highlights\u2192pastel)`);
  ok(c3.shapes > 0 && c3.workerBanded === c3.shapes, `APP config (useWorker:true) returns the banded plan (${c3.workerBanded}/${c3.shapes})`);
  ok(c3.metrics.painted > 0, `APP config composite paints ink (${c3.metrics.painted} px)`);
  ok(c4.shapes > 0 && c4.painterMulti, `legacy Painter multiLayer path still works (${c4.shapes} shapes)`);
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
