#!/usr/bin/env node
/**
 * Probe for the STRUCTURE controls (Phase 1.2 UI surfacing).
 *
 * 1. Opens the real app (index.html) and asserts the STRUCTURE section exists
 *    with the Smart Mode toggle, the "Edge Follow" slider (structureAlign) and
 *    the "Align Wobble" slider (alignJitter); screenshots the panel.
 * 2. Runs the real PaintingEngine twice on a deterministic diagonal-ramp image
 *    with structureAlign = 1 vs 0 and measures how closely the emitted S-strokes
 *    follow the structure-tensor tangent (using the analyzer's orientation map
 *    as an independent instrument). Expect align=1 >> align=0.
 *
 * Usage: NODE_PATH=<...> node scripts/structure-controls-probe.cjs
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const SHOT = path.join(ROOT, 'docs', 'research', 'controls-structure.png');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf',
  '.wasm': 'application/wasm', '.txt': 'text/plain',
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
  const { sampleStructure } = await import('/js/engine/analyzer.js');

  const size = 256;
  const src = document.createElement('canvas');
  src.width = size; src.height = size;
  const sctx = src.getContext('2d');
  const im = sctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.round(((x + y) * 255) / (2 * size - 2)); // diagonal ramp
      const o = (y * size + x) * 4;
      im.data[o] = im.data[o + 1] = im.data[o + 2] = v;
      im.data[o + 3] = 255;
    }
  }
  sctx.putImageData(im, 0, 0);

  async function run(align) {
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const eng = new PaintingEngine({ canvas, width: size, height: size, useWorker: false, background: '#ffffff' });
    eng.setSettings({ smart: true, structureAlign: align, alignJitter: 0.12 });
    await eng.loadImage(src);
    await eng.generate({ style: 'pencil', count: 500, seed: 12345, smart: true });

    const analysis = eng.getAnalysis();
    const st = analysis && analysis.structure;
    const dbg = {
      hasAnalysis: !!analysis,
      hasStructure: !!st,
      oLen: st && st.orientation ? st.orientation.length : null,
      sampleMid: st && st.orientation ? sampleStructure(st.orientation, size, size, 128, 128) : null,
      firstS: null,
    };
    // Collect per-stroke metrics (in generation order). Note: the painter's
    // hill-climbing re-optimises every stroke, so FINAL alignment converges for
    // both settings; the seeding effect shows up in the EARLY strokes and in
    // stroke length (guided strokes are traced along the flow, so longer).
    const cosVals = [], lens = [];
    let sig = 0, firstCaptured = false;
    for (const L of eng.layers) {
      for (const s of (L.strokes || [])) {
        if (s.type !== 'S') continue;
        const p = s.params;
        if (!firstCaptured) { dbg.firstS = p.slice(0, 8); firstCaptured = true; }
        const cx = (p[0] + p[4]) / 2, cy = (p[1] + p[5]) / 2;
        const th = Math.atan2(p[5] - p[1], p[4] - p[0]);
        const tan = sampleStructure(st.orientation, size, size, cx, cy);
        sig += p[0] + p[1] * 3 + p[6] * 7;
        lens.push(Math.hypot(p[4] - p[0], p[5] - p[1]));
        if (!Number.isFinite(tan)) continue;
        let d = th - tan;
        while (d > Math.PI / 2) d -= Math.PI;
        while (d < -Math.PI / 2) d += Math.PI;
        cosVals.push(Math.abs(Math.cos(d)));
      }
    }
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    const total = eng.getTotalStrokes();
    eng.destroy();
    return {
      align, sStrokes: cosVals.length, total,
      meanCos: mean(cosVals) !== null ? +mean(cosVals).toFixed(4) : null,
      earlyCos: mean(cosVals.slice(0, 60)) !== null ? +mean(cosVals.slice(0, 60)).toFixed(4) : null,
      meanLen: mean(lens) !== null ? +mean(lens).toFixed(2) : null,
      sig: +sig.toFixed(1), dbg,
    };
  }

  const on = await run(1);
  const off = await run(0);
  return { on, off, changed: on.sig !== off.sig };
};

async function main() {
  const exe = findChromium();
  if (!exe) { console.error('harness failure: no Chromium'); process.exit(2); }

  const { server, port } = await startServer();
  const browser = await chromium.launch({ headless: true, executablePath: exe,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // Ignore benign noise: favicon/asset 404s and a pre-existing app SVG-render
    // warning (<polyline points> from a static icon), neither related to this work.
    if (/Failed to load resource/.test(t)) return;
    if (/<polyline> attribute points/.test(t)) return;
    pageErrors.push(t);
  });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => !!window.__app, { timeout: 15000 });

  // ── 1. DOM: STRUCTURE section + controls ──────────────────────────────────
  const dom = await page.evaluate(() => {
    const sec = document.querySelector('#structure-section');
    if (!sec) return { ok: false, reason: 'no #structure-section' };
    const sliders = [...sec.querySelectorAll('.control-slider')].map(s => ({
      key: s.dataset.key,
      label: s.querySelector('.slider-label')?.textContent || null,
      value: s.querySelector('.slider-value')?.textContent || null,
    }));
    return {
      ok: true,
      title: sec.querySelector('.control-section__title')?.textContent || null,
      hint: sec.querySelector('.control-hint')?.textContent || null,
      smartToggle: !!sec.querySelector('.pill-toggle'),
      sliders,
      sectionIds: [...document.querySelectorAll('.control-section')].map(s => s.id),
    };
  });

  // Screenshot the controls panel.
  await page.evaluate(() => {
    const sec = document.querySelector('#structure-section');
    if (sec) sec.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(200);
  fs.mkdirSync(path.dirname(SHOT), { recursive: true });
  await page.screenshot({ path: SHOT, fullPage: false });

  // ── 2. Behaviour: the knob actually changes painter output ────────────────
  const behaviour = await page.evaluate(PAGE_FN);

  await browser.close();
  server.close();

  console.log(JSON.stringify({ dom, behaviour, pageErrors: pageErrors.slice(0, 5) }, null, 2));
  console.log('screenshot:', path.relative(ROOT, SHOT));

  const okDom = dom.ok && dom.smartToggle &&
    dom.sliders.some(s => s.key === 'structureAlign') &&
    dom.sliders.some(s => s.key === 'alignJitter');
  // The control must measurably change painter output. We assert the two runs
  // differ AND that "Edge Follow = 1" seeds strokes more along the field in the
  // early strokes than "0" (the signal of the seeding bias, before the
  // hill-climb re-optimises everything).
  const okBeh = behaviour.changed &&
    behaviour.on.earlyCos > behaviour.off.earlyCos &&
    behaviour.on.meanLen > behaviour.off.meanLen * 1.1;
  if (!okDom) { console.error('FAIL: STRUCTURE controls missing'); process.exit(1); }
  if (!okBeh) { console.error('FAIL: structureAlign did not measurably change alignment'); process.exit(1); }
  if (pageErrors.length) { console.error('FAIL: page errors'); process.exit(1); }
  console.log('PASS: STRUCTURE controls present + structureAlign measurably steers strokes');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(2); });
