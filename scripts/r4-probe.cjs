#!/usr/bin/env node
/**
 * Track R4 browser probe (Mac half).
 *
 * Verifies the R4 seam against a REAL `analyzeImage()` result in REAL Chromium
 * — not a synthetic typed buffer. The unit suite proves the algebra; this probe
 * proves the numbers a caller will actually see:
 *
 *   1. loads the repo in headless Chromium at a given --width (default 1440)
 *   2. builds a deterministic source image (blobs + rings) INSIDE the page
 *   3. runs `analyzeImage()` on it in the page
 *   4. runs `buildR4Plan()` for several (style, outline, order) triples
 *   5. screenshots the source with the extracted contours overlaid
 *   6. writes docs/research/r4-plan.json
 *
 * Exit 0 = every assertion passed. Nothing is written unless --out is given or
 * the default research path is used; the source tree is never modified.
 *
 * Usage:
 *   NODE_PATH=<playwright-core parent> node scripts/r4-probe.cjs [--width=1440]
 *                                   [--json=docs/research/r4-plan.json]
 *                                   [--shot=docs/research/r4-outlines.png]
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
const JSON_OUT = argOf('json', path.join(ROOT, 'docs', 'research', 'r4-plan.json'));
const SHOT = argOf('shot', path.join(ROOT, 'docs', 'research', `r4-outlines-${WIDTH}.png`));

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
    executablePath: exe,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
  });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

  // A blank same-origin document: the probe builds its own pixel buffer and
  // imports the engine modules directly, so it must not depend on index.html's
  // shell (and its WebGL/canvas bootstrap) at all.
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // Chromium logs a failed resource as "Failed to load resource: … <status>"
    // without naming the URL in `text()`; the URL lives on the location.
    const loc = m.location() && m.location().url ? m.location().url : '';
    errors.push(loc ? `${t} (${loc})` : t);
  });

  const result = await page.evaluate(async ({ w, h, origin }) => {
    const { analyzeImage } = await import(`${origin}/js/engine/analyzer.js`);
    const r4 = await import(`${origin}/js/engine/r4.js`);
    const { getAllStyles } = await import(`${origin}/js/styles/index.js`);

    // Deterministic source: three soft blobs + two rings on a light ground.
    const S = 256;
    const px = new Uint8ClampedArray(S * S * 4);
    const blobs = [
      [70, 80, 34, [40, 60, 120]], [180, 90, 26, [150, 60, 40]], [120, 180, 30, [40, 120, 70]],
    ];
    const rings = [[128, 128, 62, [20, 20, 20]], [60, 190, 30, [90, 30, 90]]];
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

    // A deterministic 400-shape spread, as the optimiser would emit.
    const shapes = [];
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let i = 0; i < 400; i++) {
      shapes.push({
        id: `s${i}`, type: 'E',
        params: [rnd() * S, rnd() * S, 3 + rnd() * 10, 3 + rnd() * 10, rnd() * 3.14],
        color0: [0, 0, 0], color1: [0, 0, 0], alpha: 0.8,
      });
    }

    const styles = getAllStyles().map((s) => s.name);
    const plans = {};
    for (const [style, order, outline] of [
      ['pencil', null, 'off'],
      ['pencil', 'clock', 'off'],
      ['ink', 'up', 'first'],
      ['watercolor', null, 'last'],
      ['oil', 'spiral', 'first'],
      ['cross-hatch', 'rings', 'off'],
    ]) {
      plans[`${style}/${order || 'style'}/${outline}`] = r4.buildR4Plan({
        style, order, outline, analysis, shapes,
        outlineOptions: { minLength: 10, budget: 40 },
      });
    }

    // The overlay is drawn from the SAME plan the app would use.
    const plan = plans['ink/up/first'];

    // Overlay the extracted contours on the source for the screenshot.
    const canvas = document.createElement('canvas');
    canvas.width = S; canvas.height = S;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(new ImageData(px, S, S), 0, 0);
    // Key must match the table above: ink's row passes an explicit `up` order.
    const p = plans['ink/up/first'] || {};
    ctx.lineWidth = 1.2;
    for (const pts of p.outlinePoints || []) {
      ctx.strokeStyle = 'rgba(255,0,0,0.85)';
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    const shot = canvas.toDataURL('image/png');

    return {
      width: w, height: h,
      analysis: { width: analysis.width, height: analysis.height, edgeMax: Math.max(...analysis.edges) },
      registryCount: styles.length,
      validation: r4.validateShaping(),
      coverageGaps: r4.shapingCoverageGaps(),
      orderModes: r4.R4_ORDER_MODES,
      plans: Object.fromEntries(Object.entries(plans).map(([k, v]) => [k, {
        orderMode: v.order.mode, native: v.order.native, changed: v.order.changed,
        centre: v.order.centre, shapingOrder: v.shaping.order, shapingSource: v.shapingSource,
        outlineMode: v.outline.mode, outlineCount: v.outline.count, outlineSkipped: v.outline.skipped,
        outlineBudget: v.outline.budget, outlineRows: v.outlines.length,
        minSize: v.shaping.minSize, maxSize: v.shaping.maxSize, elongation: v.shaping.elongation,
        regionFill: v.shaping.regionFill,
      }])),
      shot,
      outline: {
        count: plan.outline.count,
        threshold: plan.outline.threshold,
        peak: plan.outline.peak,
        mode: plan.outline.mode,
      },
      pageErrors: 0,
    };
  }, { w: WIDTH, h: HEIGHT, origin: `http://127.0.0.1:${port}` });

  result.pageErrors = errors.length;
  result.consoleErrors = errors.slice(0, 10);

  // ── Assertions ──────────────────────────────────────────────────────────
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };

  ok(result.analysis.width === 256, `analysis width ${result.analysis.width}`);
  ok(result.analysis.edgeMax > 0.05, `edges present (max ${result.analysis.edgeMax})`);
  ok(result.registryCount >= 51, `registry >= 51 styles (got ${result.registryCount})`);
  ok(result.validation.ok, `validateShaping ok — ${result.validation.errors.join(' | ')}`);
  ok(result.coverageGaps.length === 0, `no shaping coverage gaps — ${result.coverageGaps.join(',')}`);
  ok(result.orderModes.length === 14, `14 R4 order modes (got ${result.orderModes.length})`);

  for (const [key, p] of Object.entries(result.plans)) {
    // `budget` is only meaningful for an ACTIVE lay-in; an `off` plan reports
    // budget 0 by construction, so assert it only where contours are planned.
    if (p.outlineMode !== 'off') {
      ok(p.outlineBudget === 40, `${key}: budget honoured (${p.outlineBudget})`);
    }
    if (p.outlineMode === 'off') {
      ok(p.outlineCount === 0, `${key}: off lays no contours (${p.outlineCount})`);
    } else {
      ok(p.outlineCount >= 1, `${key}: ${p.outlineMode} lays contours (${p.outlineCount})`);
      ok(p.outlineRows === p.outlineCount, `${key}: rows match count`);
    }
    ok(p.maxSize >= p.minSize, `${key}: maxSize >= minSize`);
    ok(p.elongation >= 1, `${key}: elongation >= 1`);
    ok(p.regionFill >= 0 && p.regionFill <= 1, `${key}: regionFill in [0,1]`);
  }
  ok(result.plans['ink/up/first'].outlineCount > 0, 'ink/first plans real contours');
  ok(result.plans['pencil/style/off'].outlineCount === 0, 'pencil/off plans none');
  ok(result.plans['pencil/style/off'].orderMode === 'down', 'pencil shaping order is down');
  ok(result.plans['pencil/clock/off'].orderMode === 'clock', 'explicit order wins');
  ok(result.plans['oil/spiral/first'].native === true, 'spiral is native');
  // The shipped path is the ABSOLUTE threshold. Assert it is used and reported;
  // the soft-edge gap is a RECORDED finding (see tests/r4.test.js), not a claim
  // that a relative mode fixes it — measurement showed lowering the cut merges
  // contours rather than adding soft ones.
  ok(result.outline.count > 0, `contours found (${result.outline.count})`);
  ok(result.outline.threshold === 0.3, `cut is the requested 0.3 (${result.outline.threshold})`);
  ok(result.outline.peak === 1, 'absolute mode reports a unity scale');
  // `/favicon.ico` 404 is a pre-existing Chromium request (recorded in AGENTS.md
  // §7 / M15), not an app error — it fires on every page load including a
  // pristine HEAD copy. Anything else IS a real defect.
  const realErrors = result.consoleErrors.filter((e) => !/favicon\.ico/i.test(e));
  ok(realErrors.length === 0, `no console errors — ${realErrors.join(' | ')}`);
  result.ignoredConsoleErrors = result.consoleErrors.filter((e) => /favicon\.ico/i.test(e));

  // ── Artefacts ───────────────────────────────────────────────────────────
  fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
  fs.writeFileSync(JSON_OUT, JSON.stringify(result, null, 2));
  if (result.shot) {
    fs.mkdirSync(path.dirname(SHOT), { recursive: true });
    fs.writeFileSync(SHOT, Buffer.from(result.shot.split(',')[1], 'base64'));
  }


  await browser.close();
  server.close();

  console.log(`width ${WIDTH}x${HEIGHT}  analysis ${result.analysis.width}x${result.analysis.height} edgeMax ${result.analysis.edgeMax.toFixed(3)}  styles ${result.registryCount}`);
  for (const [k, p] of Object.entries(result.plans)) {
    console.log(`  ${k.padEnd(26)} order=${p.orderMode}${p.native ? '' : '(ext)'} changed=${p.changed}  outline=${p.outlineMode} n=${p.outlineCount} skip=${p.outlineSkipped}  shaping=${p.minSize}-${p.maxSize}/${p.elongation}/${p.regionFill}`);
  }
  console.log(`json  ${path.relative(ROOT, JSON_OUT)}`);
  if (result.shot) console.log(`shot  ${path.relative(ROOT, SHOT)}`);
  console.log(`outline: mode ${result.outline.mode} count ${result.outline.count} threshold ${result.outline.threshold} scale ${result.outline.peak}`);

  if (fails.length) {
    console.error(`\nFAIL ${fails.length}:`);
    for (const f of fails) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log('\nPASS — Track R4 browser probe');
}

main().catch((e) => { console.error('FAIL (exception):', e); process.exit(1); });
