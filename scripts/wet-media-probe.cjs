#!/usr/bin/env node
/**
 * Probe for Phase 3.3 (mediaModel → wetsim render pass) + Phase 1.5 (smudge /
 * height buffer), stream B1.
 *
 * Proves, in real headless Chromium on the app's own render path:
 *   1. dry (default) output is deterministic and leaves the wet pass off;
 *   2. a wet pass (explicit `wetMedia` opts) changes the render, is
 *      deterministic, and DARKENS (the wash multiplies absorption on top);
 *   3. a Style Profile `mediaModel` activates the same pass (3.3 wiring);
 *   4. the paper-height buffer is reachable (1.5);
 *   5. smudge changes the output deterministically.
 *
 * Usage: NODE_PATH=<playwright-core parent> node scripts/wet-media-probe.cjs
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const JSON_OUT = path.join(ROOT, 'docs', 'research', 'wet-media-probe.json');

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
  const size = 160;

  const src = document.createElement('canvas');
  src.width = size; src.height = size;
  const sctx = src.getContext('2d');
  const g = sctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#e8eef5'); g.addColorStop(1, '#2f3a4c');
  sctx.fillStyle = g; sctx.fillRect(0, 0, size, size);

  const mkEngine = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const eng = new PaintingEngine({ canvas, width: size, height: size, useWorker: false, background: '#ffffff' });
    await eng.loadImage(src);
    return eng;
  };
  const data = (cv) => cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const ink = (cv) => {
    const d = data(cv);
    let n = 0, h = 2166136261 >>> 0, lum = 0;
    for (let i = 0; i < d.length; i += 4) {
      h ^= d[i]; h = Math.imul(h, 16777619) >>> 0;
      if (d[i] !== 255 || d[i + 1] !== 255 || d[i + 2] !== 255) n++;
      lum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    }
    return { ink: n, hash: h >>> 0, meanLum: lum / (d.length / 4) };
  };

  // A. Dry (default): baseline + determinism, wet pass off.
  const a = await mkEngine();
  await a.generate({ style: 'watercolor', count: 400, seed: 4242 });
  const dry = ink(a.render());
  const dry2 = ink(a.render());

  // B. Wet on (explicit wetsim opts): changes output, deterministic, darkens.
  const b = await mkEngine();
  await b.generate({ style: 'watercolor', count: 400, seed: 4242,
    wetMedia: { seed: 4242, maxWet: 1.5, flowRate: 0.5, dryRate: 0.5, heightScale: 1, granulation: 0.2 } });
  const wet = ink(b.render());
  const wet2 = ink(b.render());
  const heightWet = b.getHeightBuffer();

  const da = data(a.render()), db = data(b.render());
  let darker = 0, lighter = 0, changed = 0;
  for (let i = 0; i < da.length; i += 4) {
    const la = 0.2126 * da[i] + 0.7152 * da[i + 1] + 0.0722 * da[i + 2];
    const lb = 0.2126 * db[i] + 0.7152 * db[i + 1] + 0.0722 * db[i + 2];
    if (Math.abs(la - lb) > 2) changed++;
    if (lb < la - 2) darker++;
    if (lb > la + 2) lighter++;
  }

  // C. Wet driven by a Style Profile mediaModel (3.3 wiring).
  const c = await mkEngine();
  await c.generate({ profile: {
    schemaVersion: 1, id: 'wet', name: 'Wet', version: '1.0.0',
    global: { style: 'watercolor', strokeCount: 400, detailLevel: 0.7, opacity: 0.9, smart: true, seed: 4242 },
    mediaModel: { kind: 'watercolor', wetness: 0.8, bleed: 0.6, drying: 0.6, granulation: 0.2, height: 0.6 },
  } });
  const viaProfile = ink(c.render());
  const cWetActive = !!(c.renderer && c.renderer._wet);

  // D. Smudge (Phase 1.5): changes output, deterministic.
  const d = await mkEngine();
  await d.generate({ style: 'watercolor', count: 400, seed: 4242 });
  d.render(); // dry baseline render
  const noSmudge = ink(d.render());
  d.setSmudge(0.8);
  const smudge = ink(d.render());
  const smudge2 = ink(d.render());

  const heightDryIsNull = a.getHeightBuffer() === null;

  a.destroy(); b.destroy(); c.destroy(); d.destroy();
  return {
    dry, dry2, heightDryIsNull,
    wet, wet2, wetActive: !!(b.renderer && b.renderer._wet),
    heightWetIsFloat: !!heightWet && heightWet.length === size * size,
    provenance: { changed, darker, lighter },
    viaProfile, cWetActive,
    noSmudge, smudge, smudge2,
  };
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

  const checks = [
    ['dry painting rendered', r.dry.ink > 1000],
    ['dry render deterministic', r.dry.hash === r.dry2.hash],
    ['wet pass off when dry', r.heightDryIsNull === true],
    ['wet pass active when on', r.wetActive === true],
    ['wet render deterministic', r.wet.hash === r.wet2.hash],
    ['wet changes output', r.wet.hash !== r.dry.hash],
    ['wash darkens (multiply)', r.provenance.changed > 0 && r.provenance.darker > 0],
    ['wash stays translucent, not black', r.wet.meanLum > 40 && r.wet.meanLum < r.dry.meanLum],
    ['mediaModel activates wet (3.3)', r.cWetActive === true && r.viaProfile.hash !== r.dry.hash],
    ['height buffer reachable (1.5)', r.heightWetIsFloat === true],
    ['smudge changes output (1.5)', r.smudge.hash !== r.noSmudge.hash],
    ['smudge deterministic', r.smudge.hash === r.smudge2.hash],
  ];
  let bad = 0;
  for (const [name, ok] of checks) { if (!ok) { console.error(`FAIL: ${name}`); bad++; } }
  if (pageErrors.length) { console.error('FAIL: page errors', pageErrors); bad++; }
  if (bad) process.exit(1);
  console.log(`PASS: wet ${r.wet.ink} px (dry ${r.dry.ink}); wash changed ${r.provenance.changed} px, ${r.provenance.darker} darker / ${r.provenance.lighter} lighter; profile-wet + smudge verified; 0 page errors`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(2); });
