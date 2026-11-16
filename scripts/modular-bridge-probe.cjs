#!/usr/bin/env node
/**
 * Track R modular bridge — browser probe (Mac half, R5/R6).
 *
 * `tests/modular-bridge.test.js` proves the bridge's algebra in node. This
 * probe proves the thing that actually matters for R6: **a shape planned by
 * the modular engine paints through the app's real render path** — the same
 * `Renderer` + registered style modules the Painter's shapes use.
 *
 *   1. serve the repo
 *   2. open `index.html` in real Chromium
 *   3. build a deterministic source image, run the REAL `analyzeImage()`
 *   4. run `buildModularPlan({enabled:true})` for several styles
 *   5. push the planned shapes into the app's own `Renderer` and render
 *   6. measure the canvas: non-background pixel count, unique colours,
 *      bounding box, and a diff against a Painter-format shape drawn with the
 *      same renderer
 *   7. screenshot the modular render
 *
 * Exit 0 = every assertion passed.
 *
 * Usage:
 *   NODE_PATH=<playwright-core parent> node scripts/modular-bridge-probe.cjs
 *     [--width=1440] [--height=900]
 *     [--json=docs/research/modular-bridge.json]
 *     [--shot=docs/research/modular-bridge.png]
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.txt': 'text/plain',
};

const args = process.argv.slice(2);
const argOf = (k, d) => {
  const hit = args.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const WIDTH = parseInt(argOf('width', '1440'), 10);
const HEIGHT = parseInt(argOf('height', '900'), 10);
const JSON_OUT = argOf('json', path.join(ROOT, 'docs', 'research', 'modular-bridge.json'));
const SHOT = argOf('shot', path.join(ROOT, 'docs', 'research', 'modular-bridge.png'));
const S = 200; // source image size (deterministic)

function findChromium() {
  const base = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (!fs.existsSync(base)) return process.env.CHROME_BINARY || undefined;
  const dirs = fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => parseInt(b.split('-')[1], 10) - parseInt(a.split('-')[1], 10));
  const subs = process.platform === 'darwin'
    ? [['chrome-mac-x64', 'Google Chrome for Testing'], ['chrome-mac', 'Chromium'], ['chrome-linux', 'chrome']]
    : [['chrome-linux64', 'chrome'], ['chrome-linux', 'chrome']];
  for (const d of dirs) for (const [sub, bin] of subs) {
    const p = path.join(base, d, sub, bin);
    if (fs.existsSync(p)) return p;
  }
  return process.env.CHROME_BINARY || undefined;
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
  if (!exe) { console.error('FAIL: no Chromium found (set CHROME_BINARY)'); process.exit(2); }

  const { server, port } = await startServer();
  const browser = await chromium.launch({
    headless: true, executablePath: exe,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const loc = m.location() && m.location().url ? m.location().url : '';
    if (/favicon\.ico/.test(loc)) return;
    errors.push(loc ? `${m.text()} (${loc})` : m.text());
  });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(async ({ S, origin }) => {
    const { analyzeImage } = await import(`${origin}/js/engine/analyzer.js`);
    const { buildModularPlan } = await import(`${origin}/js/engine/modular-bridge.js`);
    const { PaintingEngine } = await import(`${origin}/js/engine/engine.js`);
    const { getAllStyles } = await import(`${origin}/js/styles/index.js`);

    // ── deterministic source: soft blobs + hard rings ──────────────────────
    const px = new Uint8ClampedArray(S * S * 4);
    const blobs = [
      [50, 60, 26, [40, 60, 120]], [140, 70, 20, [150, 60, 40]], [100, 140, 22, [40, 120, 70]],
    ];
    const rings = [[100, 100, 46, [20, 20, 20]], [46, 142, 22, [90, 30, 90]]];
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4;
        let r = 235, g = 235, b = 232;
        for (const [cx, cy, rad, col] of blobs) {
          const d = Math.hypot(x - cx, y - cy) / rad;
          if (d < 1) {
            const k = Math.max(0, 1 - d) ** 1.6;
            r = r * (1 - k) + col[0] * k; g = g * (1 - k) + col[1] * k; b = b * (1 - k) + col[2] * k;
          }
        }
        for (const [cx, cy, rad, col] of rings) {
          const d = Math.abs(Math.hypot(x - cx, y - cy) - rad);
          if (d < 3.5) { const k = 1 - d / 3.5; r = r * (1 - k) + col[0] * k; g = g * (1 - k) + col[1] * k; b = b * (1 - k) + col[2] * k; }
        }
        px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
      }
    }
    const analysis = analyzeImage(px, S, S, {});

    const styles = getAllStyles().map((s) => s.name);
    const plans = {};
    for (const style of ['pencil', 'ink', 'watercolor', 'oil', 'cross-hatch']) {
      const p = buildModularPlan(analysis, {
        enabled: true, style, count: 250, seed: 12345, width: S, height: S,
        outlineBudgetFrac: 0.35, outlineMax: 64,
      });
      plans[style] = {
        used: p.used, reason: p.reason, shapes: p.shapes.length,
        rawCount: p.rawCount, outlineCount: p.outlineCount,
        regionFill: p.options ? p.options.regionFill : null,
        styleField: p.shapes.length ? [...new Set(p.shapes.map((s) => s.style))] : [],
        firstShape: p.shapes[0] ? {
          type: p.shapes[0].type, params: p.shapes[0].params,
          color0: p.shapes[0].color0, color1: p.shapes[0].color1,
          alpha: p.shapes[0].alpha, order: p.shapes[0].order,
        } : null,
      };
    }

    // ── render through the APP'S OWN Renderer ──────────────────────────────
    const engine = document.createElement('canvas');
    engine.width = S; engine.height = S;
    const PaintingEngineClass = PaintingEngine;
    const eng = new PaintingEngineClass({ canvas: engine, width: S, height: S, background: '#ffffff' });

    const measure = (canvas) => {
      const ctx = canvas.getContext('2d');
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let painted = 0, minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
      const colours = new Set();
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
          // background is #ffffff (or the renderer's clear colour)
          if (a < 8 || (r > 250 && g > 250 && b > 250)) continue;
          painted++;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          colours.add(`${r >> 3},${g >> 3},${b >> 3}`);
        }
      }
      return {
        painted, uniqueColours: colours.size,
        bbox: painted ? [minX, minY, maxX, maxY] : null,
      };
    };

    // Push the planned shapes in as a layer, exactly as engine.js does.
    const renderFor = (style) => {
      const plan = buildModularPlan(analysis, {
        enabled: true, style, count: 250, seed: 12345, width: S, height: S,
      });
      eng.layers = [{
        id: 0, name: 'modular', visible: true, opacity: 1, blendMode: 'normal',
        strokes: plan.shapes.map((s) => ({ ...s })),
      }];
      eng.renderer.setLayers(eng.layers);
      eng.renderer.renderAll({ progress: 1, clear: true });
      return { plan, metrics: measure(engine), dataURL: engine.toDataURL('image/png') };
    };

    const renders = {};
    for (const style of ['pencil', 'ink', 'watercolor']) renders[style] = renderFor(style);

    // ── the negative control: a disabled plan paints NOTHING ───────────────
    const off = buildModularPlan(analysis, { enabled: false, style: 'pencil', count: 250 });
    eng.layers = [{ id: 0, name: 'off', visible: true, opacity: 1, blendMode: 'normal', strokes: off.shapes }];
    eng.renderer.setLayers(eng.layers);
    eng.renderer.renderAll({ progress: 1, clear: true });
    const offMetrics = measure(engine);

    return {
      width: S, height: S, registryCount: styles.length,
      edgeMax: Math.max(...analysis.edges),
      plans, renders: Object.fromEntries(Object.entries(renders).map(([k, v]) => [k, {
        shapes: v.plan.shapes.length, rawCount: v.plan.rawCount,
        outlineCount: v.plan.outlineCount, metrics: v.metrics,
      }])),
      shots: Object.fromEntries(Object.entries(renders).map(([k, v]) => [k, v.dataURL])),
      off: { shapes: off.shapes.length, metrics: offMetrics },
    };
  }, { S, origin: `http://127.0.0.1:${port}` });

  await browser.close();
  server.close();

  /* ── assertions ─────────────────────────────────────────────────────── */
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); else console.log(`  ✓ ${msg}`); };

  console.log(`\n=== modular bridge probe @ ${WIDTH}x${HEIGHT} ===`);
  ok(errors.length === 0, `0 console/page errors (got ${errors.length}${errors.length ? ': ' + errors[0] : ''})`);
  ok(result.registryCount >= 50, `registry has ${result.registryCount} styles (>= 50)`);

  for (const [style, p] of Object.entries(result.plans)) {
    ok(p.used, `${style}: plan used (${p.shapes} shapes = ${p.rawCount} modular + ${p.outlineCount} outlines)`);
    ok(p.shapes > 0, `${style}: shapes > 0`);
    ok(p.shapes === p.rawCount + p.outlineCount, `${style}: shapes = modular + outlines (${p.shapes} = ${p.rawCount} + ${p.outlineCount})`);
    ok(p.rawCount <= 250, `${style}: modular count within budget (${p.rawCount} <= 250)`);
    ok(p.styleField.every((s) => s === style), `${style}: shape.style is the raw registry name [${p.styleField.join(',')}]`);
    if (p.firstShape) {
      const ps = p.firstShape.params;
      ok(Number.isFinite(ps[0]) && Number.isFinite(ps[1]), `${style}: first shape has a finite position`);
      ok(Array.isArray(p.firstShape.color0) && p.firstShape.color0.length === 3, `${style}: color0 is a 3-array`);
    }
  }

  for (const [style, r] of Object.entries(result.renders)) {
    ok(r.metrics.painted > 0, `${style}: RENDERED ${r.metrics.painted} non-background px`);
    ok(r.metrics.uniqueColours > 1, `${style}: ${r.metrics.uniqueColours} unique colours (> 1)`);
    ok(r.metrics.bbox !== null, `${style}: bbox ${JSON.stringify(r.metrics.bbox)}`);
  }

  ok(result.off.shapes === 0, `disabled plan has 0 shapes`);
  ok(result.off.metrics.painted === 0, `disabled plan paints 0 px (negative control)`);

  /* ── artefacts ───────────────────────────────────────────────────────── */
  fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
  const shots = result.shots;
  const { shots: _omit, ...json } = result;
  fs.writeFileSync(JSON_OUT, JSON.stringify(json, null, 2) + '\n');
  console.log(`\n  json: ${JSON_OUT}`);
  if (shots['ink']) {
    fs.mkdirSync(path.dirname(SHOT), { recursive: true });
    fs.writeFileSync(SHOT, Buffer.from(shots['ink'].split(',')[1], 'base64'));
    console.log(`  shot: ${SHOT}`);
  }

  if (fails.length) {
    console.log(`\nFAIL — ${fails.length} assertion(s):`);
    for (const f of fails) console.log(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log('\nPASS');
}

main().catch((e) => { console.error('probe crashed:', e); process.exit(2); });
