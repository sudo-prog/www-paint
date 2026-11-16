#!/usr/bin/env node
/**
 * Probe: the H-S2 reference-confidence chip at every relevant width.
 *
 * Track-S hygiene **H-S2** added a chip to each library row that carries a fused
 * reference packet. The main probe asserts its behaviour at ONE viewport
 * (1280px); this one asserts its GEOMETRY across the width range, which is the
 * part the quality bar requires of any new UI:
 *
 *   - the chip is on-screen at 390 / 768 / 1440
 *   - it stays inside its panel (no horizontal overflow)
 *   - it does not clip its own text (`scrollWidth - clientWidth === 0`)
 *   - the ROW does not grow past the panel, and the action bar stays reachable
 *   - no document overflow, and nothing is untappable (`elementFromPoint`)
 *   - a profile with NO packet still renders no chip (no layout shift)
 *
 * Real headless Chromium against the app's own index.html.
 *
 * Usage:
 *   NODE_PATH=<dir with playwright-core> \
 *   CHROME_BINARY=<chrome> node scripts/ref-confidence-probe.cjs
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const JSON_OUT = path.join(ROOT, 'docs', 'research', 'ref-confidence.json');
const WIDTHS = (process.argv.find((a) => a.startsWith('--widths=')) || '')
  .split('=')[1] || '390,768,1440';
const LIST = WIDTHS.split(',').map((s) => parseInt(s, 10)).filter(Number.isFinite);

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.wasm': 'application/wasm',
};

function findChromium() {
  const base = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  const dirs = fs.readdirSync(base)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => parseInt(b.split('-')[1], 10) - parseInt(a.split('-')[1], 10));
  for (const d of dirs) {
    const p = path.join(base, d, 'chrome-linux64', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = req.url.split('?')[0];
      const rel = url === '/' ? '/index.html' : url;
      const file = path.join(ROOT, decodeURIComponent(rel).replace(/^\/+/, ''));
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/**
 * Runs in the page. Builds one good and one conflicting profile, then reports
 * the chip geometry. Returns JSON-serialisable data only (no DOM nodes).
 */
const PAGE_FN = async () => {
  const app = window.__app;
  const root = document.getElementById('style-library-root');
  const panel = app && app.library;
  if (!panel) return { error: 'no library panel' };

  // Isolate: the library persists to localStorage between runs.
  try { localStorage.removeItem('www-paint.styleProfiles.v1'); } catch { /* ignore */ }
  panel.library.clear();
  if (typeof panel.refresh === 'function') panel.refresh();

  const { analyzeReference, fuseReferences } = await import('/js/engine/ref-analyze.js');
  const synth = (fn) => {
    const w = 64, h = 64;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const cx = cv.getContext('2d');
    const img = cx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const [r, g, b] = fn(x, y);
        img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
      }
    }
    cx.putImageData(img, 0, 0);
    return cv;
  };
  const toPixels = (cv) => {
    const cx = cv.getContext('2d');
    const d = cx.getImageData(0, 0, cv.width, cv.height);
    return { pixels: new Uint8ClampedArray(d.data.buffer), width: cv.width, height: cv.height };
  };
  const fuse = (...srcs) => fuseReferences(srcs.map((s) => analyzeReference(toPixels(s), {})), {});

  const good = fuse(synth((x, y) => [255 * (x / 63), 128, 255 * (y / 63)]),
                    synth((x, y) => [200 * (x / 63), 60, 180]));
  const bad = fuse(synth((x, y) => [255 * (x / 63), 128, 255 * (y / 63)]),
                   synth((x, y) => [200 * (x / 63), 60, 180]),
                   synth(() => [30, 30, 30]),
                   synth(() => [250, 250, 250]));

  // One packet-less profile first: it must render NO chip at any width.
  const plain = {
    schemaVersion: 1, id: '00000000-0000-4000-8000-000000000011', name: 'No Packet',
    version: '1.0.0', engine: { name: 'www-paint', version: '0.1.0' },
    global: { style: 'pencil', strokeCount: 400, seed: 1 },
    layers: [], effects: [], mediaModel: { kind: 'dry' }, provenance: { source: 'human' },
  };
  const withPacket = (name, packet, n) => ({
    ...plain, id: '00000000-0000-4000-8000-0000000000' + String(n).padStart(2, '0'),
    name, provenance: { source: 'human', refPacket: packet },
  });
  panel.library.save(plain);
  panel.library.save(withPacket('Conflicting', bad, 21));
  panel.library.save(withPacket('Consistent', good, 22));
  if (typeof panel.refresh === 'function') panel.refresh();

  // Open the panel through the app's own toggle — a hidden panel makes every
  // measurement vacuous (this is the trap the a11y sweep documents).
  const btn = document.getElementById('btn-library-mode');
  if (btn && !app._libraryMode) btn.click();
  await new Promise((r) => setTimeout(r, 600));

  const out = { widths: [] };
  const noPacketRow = [...root.querySelectorAll('.library-row')]
    .find((el) => el.querySelector('.library-row__name').textContent === 'No Packet');
  out.noPacketChipCount = noPacketRow ? noPacketRow.querySelectorAll('.library-row__ref').length : -1;

  const badRow = [...root.querySelectorAll('.library-row')]
    .find((el) => (el.querySelector('.library-row__ref') || {}).dataset?.refBand === 'low');

  out.badRowFound = !!badRow;
  if (!badRow) return out;

  const chip = badRow.querySelector('.library-row__ref');
  const chipBox = chip.getBoundingClientRect();
  const panelBox = root.getBoundingClientRect();
  const rowBox = badRow.getBoundingClientRect();
  const actionsBox = badRow.querySelector('.library-row__actions').getBoundingClientRect();
  const hit = document.elementFromPoint(
    chipBox.left + chipBox.width / 2,
    chipBox.top + chipBox.height / 2,
  );

  out.chip = {
    text: chip.textContent,
    band: chip.dataset.refBand,
    titleHasSpread: /scale spread/.test(chip.title || ''),
    insideButton: !!chip.closest('button'),
    box: { l: +chipBox.left.toFixed(1), r: +chipBox.right.toFixed(1), w: +chipBox.width.toFixed(1), h: +chipBox.height.toFixed(1) },
    clip: chip.scrollWidth - chip.clientWidth,
    onScreen: chipBox.width > 0 && chipBox.height > 0
      && chipBox.top >= 0 && chipBox.bottom <= innerHeight
      && chipBox.left >= 0 && chipBox.right <= innerWidth,
    insidePanel: chipBox.left >= panelBox.left - 1 && chipBox.right <= panelBox.right + 1,
    hitIsChip: !!hit && (hit === chip || chip.contains(hit)),
    hitTag: hit ? hit.tagName + '.' + (hit.className || '').toString().slice(0, 24) : null,
  };
  out.row = {
    box: { t: +rowBox.top.toFixed(1), b: +rowBox.bottom.toFixed(1), h: +rowBox.height.toFixed(1) },
    insidePanel: rowBox.top >= panelBox.top - 1 && rowBox.bottom <= panelBox.bottom + 1,
    pastViewport: rowBox.right > innerWidth + 1,
  };
  out.actions = {
    box: { t: +actionsBox.top.toFixed(1), b: +actionsBox.bottom.toFixed(1) },
    insidePanel: actionsBox.bottom <= panelBox.bottom + 1,
    onScreen: actionsBox.top >= 0 && actionsBox.bottom <= innerHeight,
  };
  out.panel = {
    mode: !!app._libraryMode,
    hidden: root.classList.contains('panel--hidden'),
    box: { l: +panelBox.left.toFixed(1), r: +panelBox.right.toFixed(1), w: +panelBox.width.toFixed(1) },
  };
  out.docOverflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  out.viewport = { w: innerWidth, h: innerHeight };
  return out;
}

async function main() {
  const exe = findChromium();
  if (!exe) { console.error('harness failure: no Chromium (set CHROME_BINARY)'); process.exit(2); }

  const { server, port } = await startServer();
  const browser = await chromium.launch({
    headless: true,
    executablePath: exe,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const results = [];
  for (const width of LIST) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => !!window.__app, { timeout: 20000 });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__app, { timeout: 20000 });
    const r = await page.evaluate(PAGE_FN);
    results.push({ width, ...r, pageErrors: errs });
    await page.close();
  }

  await browser.close();
  server.close();

  fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
  fs.writeFileSync(JSON_OUT, JSON.stringify(results, null, 2));

  let fails = 0;
  for (const r of results) {
    const tag = `@${r.width}px`;
    if (r.error) { console.log(`  FAIL ${tag} ${r.error}`); fails++; continue; }
    if (r.noPacketChipCount !== 0) {
      console.log(`  FAIL ${tag} a packet-less profile rendered ${r.noPacketChipCount} chip(s)`); fails++;
    }
    if (!r.badRowFound) { console.log(`  FAIL ${tag} no 'low' chip row`); fails++; continue; }
    const c = r.chip, row = r.row, act = r.actions, p = r.panel;
    const checks = [
      ['panel open', p.mode && !p.hidden && p.box.w > 0],
      ['chip on screen', c.onScreen],
      ['chip inside panel', c.insidePanel],
      ['chip not clipped', c.clip === 0],
      ['chip hit-testable', c.hitIsChip],
      ['chip outside a button', !c.insideButton],
      ['chip says conflicting', /conflicting/.test(c.text)],
      ['title carries spread', c.titleHasSpread],
      ['row inside panel', row.insidePanel],
      ['row not past viewport', !row.pastViewport],
      ['actions on screen', act.onScreen],
      ['actions inside panel', act.insidePanel],
      ['no document overflow', r.docOverflowX === 0],
      ['no page errors', r.pageErrors.length === 0],
    ];
    for (const [name, ok] of checks) {
      if (!ok) { console.log(`  FAIL ${tag} ${name}`); fails++; }
    }
    console.log(`  ${tag} chip ${c.box.w}x${c.box.h}@${c.box.l} band=${c.band} `
      + `"${c.text}" hit=${c.hitTag} rowH=${row.box.h} docOverflowX=${r.docOverflowX}`);
  }

  if (fails) { console.error(`FAIL — ${fails} check(s) failed`); process.exit(1); }
  console.log(`PASS — ${LIST.length} width(s), every chip on-screen, unclipped, inside its panel`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(2); });
