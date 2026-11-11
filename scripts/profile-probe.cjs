#!/usr/bin/env node
/**
 * Probe for Phase 4.1 — the engine consumes a Style Profile.
 *
 * Drives the app's real engine path (`PaintingEngine` + `generate()`) with a
 * StyleProfile and asserts, in a real headless browser, that:
 *   - the profile's global block lands on engine settings and drives a render;
 *   - the profile's `seed` (not the engine default) is used when no opts.seed;
 *   - the same profile re-bakes to the same pixels (deterministic);
 *   - per-layer style overrides are applied to the right tonal band;
 *   - an explicit `opts.style` still overrides the profile.
 *
 * Usage: NODE_PATH=<install with playwright-core> node scripts/profile-probe.cjs
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const JSON_OUT = path.join(ROOT, 'docs', 'research', 'profile-probe.json');

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
  const { applyProfile, validateProfile } = await import('/js/engine/profile.js');

  const size = 160;
  const src = document.createElement('canvas');
  src.width = size; src.height = size;
  const sctx = src.getContext('2d');
  const g = sctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#dfe6ef'); g.addColorStop(1, '#3a4658');
  sctx.fillStyle = g; sctx.fillRect(0, 0, size, size);

  const ink = (cv) => {
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let n = 0, h = 2166136261 >>> 0;
    for (let i = 0; i < d.length; i += 4) {
      h ^= d[i]; h = Math.imul(h, 16777619) >>> 0;
      if (d[i] !== 255 || d[i + 1] !== 255 || d[i + 2] !== 255) n++;
    }
    return { ink: n, hash: h >>> 0 };
  };

  const mkEngine = async (bg) => {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const e = new PaintingEngine({ canvas: c, width: size, height: size, useWorker: false, background: bg || '#ffffff' });
    await e.loadImage(src);
    return e;
  };

  const base = (seed) => ({
    schemaVersion: 1, id: '11111111-1111-4111-8111-111111111111',
    name: 'Probe Profile', version: '1.0.0', engine: { name: 'www-paint', version: '0.1.0' },
    global: { style: 'watercolor', strokeCount: 400, detailLevel: 0.6, seed, multiLayer: false },
    layers: [], provenance: { source: 'human' },
  });

  const valid = validateProfile(base(1234)).ok;
  const expanded = applyProfile(base(1234));

  // 1. Profile drives settings + a render.
  const e1 = await mkEngine();
  const shapes = await e1.generate({ profile: base(1234) });
  const r1 = ink(e1.render());
  const styleUsed = e1.settings.style;
  const stylesSeen = [...new Set(shapes.map((s) => s.style))];

  // 2. Same profile → same pixels (deterministic).
  const e2 = await mkEngine();
  await e2.generate({ profile: base(1234) });
  const r2 = ink(e2.render());

  // 3. Profile seed is used (different seed → different render).
  const e3 = await mkEngine();
  await e3.generate({ profile: base(987654) });
  const r3 = ink(e3.render());

  // 4. Explicit opts.style overrides the profile.
  const e4 = await mkEngine();
  await e4.generate({ profile: base(1234), style: 'oil' });
  const r4 = ink(e4.render());

  // 5. Per-layer style overrides land on the right band (multi-layer).
  const mlProf = base(2222);
  mlProf.global.multiLayer = true;
  mlProf.layers = [{ role: 'highlights', style: 'pastel' }, { role: 'background', style: 'ink' }];
  const eml = await mkEngine();
  await eml.generate({ profile: mlProf });
  eml.render();
  const bandStyles = {};
  for (const L of eml.layers) bandStyles[L._name] = [...new Set((L.strokes || []).map((s) => s.style))];

  e1.destroy(); e2.destroy(); e3.destroy(); e4.destroy(); eml.destroy();
  return {
    valid, expanded: { seed: expanded.seed, style: expanded.settings.style, multiLayer: expanded.multiLayer },
    styleUsed, stylesSeen, r1, r2, r3, r4, bandStyles,
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

  const fail = (m) => { console.error('FAIL: ' + m); process.exit(1); };
  if (!r.valid) fail('the probe profile did not validate');
  if (r.expanded.seed !== 1234) fail('applyProfile did not surface the profile seed');
  if (r.styleUsed !== 'watercolor') fail(`profile style not consumed: ${r.styleUsed}`);
  // The engine resolves the registry name, which aliases 'watercolor' → 'watercolour'.
  if (!(r.stylesSeen.length === 1 && /^watercol/.test(r.stylesSeen[0]))) {
    fail(`shapes not painted in the profile style: ${JSON.stringify(r.stylesSeen)}`);
  }
  if (!(r.r1.ink > 1000)) fail('profile render produced no ink');
  if (r.r1.hash !== r.r2.hash) fail('the same profile did not re-bake to the same pixels');
  if (r.r1.hash === r.r3.hash) fail('the profile seed was ignored (two seeds gave the same render)');
  if (r.r1.hash === r.r4.hash) fail('opts.style did not override the profile style');
  const hi = r.bandStyles.highlights || [], bg = r.bandStyles.background || [];
  if (!hi.includes('pastel')) fail(`highlights band did not take the profile style: ${JSON.stringify(r.bandStyles)}`);
  if (!bg.includes('ink')) fail(`background band did not take the profile style: ${JSON.stringify(r.bandStyles)}`);
  if (pageErrors.length) fail('page errors: ' + pageErrors.slice(0, 3).join(' | '));
  console.log(`PASS: profile drives settings (style=${r.styleUsed}), seed used, deterministic re-bake, per-layer band styles applied, opts override works`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(2); });
