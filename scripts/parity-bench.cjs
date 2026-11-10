#!/usr/bin/env node
/**
 * Parity benchmark driver (Clean-room Track R0).
 *
 * Serves the repo, opens tests/parity/harness.html and runs the three engines
 * (reference Code Painter / our port / our modular engine) on identical
 * deterministic images at the same seed + stroke count. Prints `sim` and the
 * independent `mae`/`simMae`, writes a comparison PNG + a JSON baseline.
 *
 * Usage: NODE_PATH=<...> node scripts/parity-bench.cjs
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const OUTDIR = path.join(ROOT, 'docs', 'research', 'parity');

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

const pad = (s, n) => String(s).padEnd(n);

async function main() {
  const exe = findChromium();
  if (!exe) { console.error('harness failure: no Chromium'); process.exit(2); }

  const { server, port } = await startServer();
  const browser = await chromium.launch({ headless: true, executablePath: exe,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  page.setDefaultTimeout(240000);
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource/.test(t)) return;
    pageErrors.push(t);
  });

  await page.goto(`http://127.0.0.1:${port}/tests/parity/harness.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.harnessReady === true, { timeout: 20000 });

  console.error('running parity harness (reference + port + modular)…');
  const results = await page.evaluate(() => window.runAll());

  const composite = await page.evaluate(() => window.__composite || null);

  await browser.close();
  server.close();

  fs.mkdirSync(OUTDIR, { recursive: true });
  if (composite) {
    fs.writeFileSync(path.join(OUTDIR, 'baseline-comparison.png'),
      Buffer.from(composite.replace(/^data:image\/png;base64,/, ''), 'base64'));
  }
  fs.writeFileSync(path.join(OUTDIR, 'baseline.json'),
    JSON.stringify({ when: new Date().toISOString(), engine: 'www-paint parity (Track R)',
      seed: 12345, shapes: 400, images: results }, null, 2) + '\n');

  console.log('\n=== PARITY BENCH (Track R)  seed=12345 shapes=400 ===');
  console.log(pad('image', 10) + pad('engine', 24) + pad('sim(self)', 11) + pad('simMae', 9) + pad('ssim', 8) + 'mae');
  for (const r of results) {
    for (const k of ['reference', 'port', 'modular']) {
      const m = r.results[k];
      console.log(pad(r.name, 10) + pad(k, 24) +
        pad(m.sim === null || m.sim === undefined ? '—' : Number(m.sim).toFixed(2), 11) +
        pad(m.simMae, 9) + pad(m.ssim, 8) + m.mae);
    }
    const d = r.results.reference.simMae - r.results.modular.simMae;
    const ds = r.results.reference.ssim - r.results.modular.ssim;
    console.log(`${' '.repeat(10)}-> reference - modular gap: simMae ${d.toFixed(2)}  ssim ${ds.toFixed(4)}`);
  }
  console.log('\nwrote docs/research/parity/baseline.json + baseline-comparison.png');
  if (pageErrors.length) console.log(`page errors: ${pageErrors.slice(0, 3).join(' | ')}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(2); });
