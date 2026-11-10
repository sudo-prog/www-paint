#!/usr/bin/env node
/**
 * Visual regression runner (Phase 0.2).
 *
 * Serves the repo, opens tests/visual/regression.html in headless Chromium and
 * runs a fixed set of (style, seed) cases. Each case yields a SHA-256 of the
 * exported PNG. Hashes are compared against tests/visual/baselines.json.
 *
 * Usage:
 *   node scripts/visual-regression.cjs            # verify against baselines
 *   node scripts/visual-regression.cjs --update   # (re)write baselines + PNGs
 *   node scripts/visual-regression.cjs --styles=pencil,ink
 *
 * Exit code 0 = all cases match; 1 = mismatch / error; 2 = harness failure.
 *
 * NOTE: baselines are only meaningful on a FIXED Chromium build + this machine.
 * A different browser build may re-encode PNGs identically only if pixels match;
 * treat a mismatch as "investigate", and re-baseline deliberately with --update.
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_DIR = path.join(ROOT, 'tests', 'visual', 'baselines');
const BASELINE_JSON = path.join(ROOT, 'tests', 'visual', 'baselines.json');

// Core media (roadmap §7) + representative graphic/draw styles.
const DEFAULT_CASES = [
  { id: 'pencil',      style: 'pencil',      seed: 3047602159, count: 700 },
  { id: 'ink',         style: 'ink',         seed: 3047602159, count: 700 },
  { id: 'watercolor',  style: 'watercolor',  seed: 3047602159, count: 700 },
  { id: 'oil',         style: 'oil',         seed: 3047602159, count: 700 },
  { id: 'charcoal',    style: 'charcoal',    seed: 3047602159, count: 700 },
  { id: 'marker',      style: 'marker',      seed: 3047602159, count: 700 },
  { id: 'cross-hatch', style: 'cross-hatch', seed: 3047602159, count: 700 },
  { id: 'halftone',    style: 'halftone',    seed: 3047602159, count: 700 },
  { id: 'graphic',     style: 'graphic',     seed: 3047602159, count: 700 },
];

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
    const p = path.join(base, d, 'chrome-linux64', 'chrome');
    if (fs.existsSync(p)) return p;
    const p2 = path.join(base, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(p2)) return p2;
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

async function main() {
  const args = process.argv.slice(2);
  const update = args.includes('--update');
  const styleArg = args.find(a => a.startsWith('--styles='));
  let cases = DEFAULT_CASES;
  if (styleArg) {
    const wanted = styleArg.split('=')[1].split(',').map(s => s.trim());
    cases = wanted.map(id => DEFAULT_CASES.find(c => c.id === id) || { id, style: id, seed: 3047602159, count: 700 });
  }

  const baselines = fs.existsSync(BASELINE_JSON)
    ? JSON.parse(fs.readFileSync(BASELINE_JSON, 'utf8'))
    : { engine: 'www-paint', schema: 1, browser: null, cases: {} };

  const { server, port } = await startServer();
  const exe = findChromium();
  if (!exe) { server.close(); console.error('harness failure: no Chromium found in ~/.cache/ms-playwright'); process.exit(2); }

  const browser = await chromium.launch({ headless: true, executablePath: exe,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') pageErrors.push(m.text()); });

  await page.goto(`http://127.0.0.1:${port}/tests/visual/regression.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.harnessReady === true, { timeout: 15000 });

  const styleCount = await page.evaluate(() => window.styleCount());
  console.log(`Registry styles: ${styleCount}`);

  if (update) fs.mkdirSync(BASELINE_DIR, { recursive: true });

  let pass = 0, fail = 0, errored = 0;
  const results = [];
  for (const c of cases) {
    let r;
    try {
      r = await page.evaluate((cc) => window.runCase(cc), c);
    } catch (e) {
      r = { ok: false, error: String(e) };
    }
    if (!r || !r.ok) {
      errored++;
      let msg = r && r.error ? String(r.error) : 'unknown';
      const lg = (r && r.lastGrad) ? ` lastGradArgs=${JSON.stringify(r.lastGrad)}` : '';
      console.log(`✗ ${c.id.padEnd(12)} ERROR${lg} ${msg.split('\n').slice(0, 7).join('\n      ')}`);
      if (r && r.badWidthCount !== null && r.badWidthCount !== undefined) {
        console.log(`      badWidthCount=${r.badWidthCount} sample=${JSON.stringify(r.badWidthSample)}`);
      }

      results.push({ id: c.id, status: 'error', error: msg });
      continue;
    }
    const prev = baselines.cases[c.id];
    const match = prev && prev.hash === r.hash;
    if (update) {
      baselines.cases[c.id] = { style: c.style, seed: c.seed, count: c.count, size: r.size, strokes: r.strokes, bytes: r.bytes, hash: r.hash };
      const png = Buffer.from(r.dataURL.replace(/^data:image\/png;base64,/, ''), 'base64');
      fs.writeFileSync(path.join(BASELINE_DIR, `${c.id}.png`), png);
      console.log(`● ${c.id.padEnd(12)} ${r.hash.slice(0, 16)}  ${r.strokes} strokes  (baseline written)`);
      results.push({ id: c.id, status: 'baseline', hash: r.hash });
    } else if (!prev) {
      fail++;
      console.log(`! ${c.id.padEnd(12)} NO BASELINE (run with --update)  hash=${r.hash.slice(0, 16)}`);
      results.push({ id: c.id, status: 'no-baseline', hash: r.hash });
    } else if (match) {
      pass++;
      console.log(`✓ ${c.id.padEnd(12)} ${r.hash.slice(0, 16)}  ${r.strokes} strokes`);
      results.push({ id: c.id, status: 'pass', hash: r.hash });
    } else {
      fail++;
      console.log(`✗ ${c.id.padEnd(12)} MISMATCH  expected ${prev.hash.slice(0, 16)} got ${r.hash.slice(0, 16)}`);
      results.push({ id: c.id, status: 'fail', expected: prev.hash, got: r.hash });
    }
  }

  if (update) {
    baselines.browser = path.basename(exe);
    baselines.updatedAt = new Date().toISOString();
    fs.writeFileSync(BASELINE_JSON, JSON.stringify(baselines, null, 2) + '\n');
    console.log(`\nBaselines written → ${path.relative(ROOT, BASELINE_JSON)} + ${path.relative(ROOT, BASELINE_DIR)}/`);
  }

  await browser.close();
  server.close();

  if (pageErrors.length) console.log(`\nPage errors (${pageErrors.length}):\n  ` + pageErrors.slice(0, 5).join('\n  '));

  console.log(`\n=== ${update ? 'UPDATE' : 'VERIFY'} SUMMARY ===`);
  console.log(`pass=${pass} fail=${fail} error=${errored} total=${cases.length}`);

  if (!update && (fail > 0 || errored > 0)) process.exit(1);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(2); });
