#!/usr/bin/env node
/**
 * Render the Phase 2.1 tonal-masks debug page to a PNG.
 *
 * Serves the repo, opens tests/visual/tonal-masks.html in headless Chromium and
 * screenshots it to docs/research/tonal-masks.png. Prints the page's summary
 * (per-band coverage + coverage sum) so the visualization is verifiable.
 *
 * Usage: node scripts/tonal-masks-debug.cjs [outfile]
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'docs', 'research', 'tonal-masks.png');

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

async function main() {
  const exe = findChromium();
  if (!exe) { console.error('harness failure: no Chromium in ~/.cache/ms-playwright'); process.exit(2); }

  const { server, port } = await startServer();
  const browser = await chromium.launch({ headless: true, executablePath: exe,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1980, height: 300 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`http://127.0.0.1:${port}/tests/visual/tonal-masks.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.harnessReady === true, { timeout: 15000 });

  const summary = await page.evaluate(() => window.summary || null);
  await page.waitForTimeout(150);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await page.screenshot({ path: OUT, fullPage: true });

  await browser.close();
  server.close();

  console.log('summary:', JSON.stringify(summary));
  if (errors.length) console.log(`page errors (${errors.length}): ${errors.slice(0, 3).join(' | ')}`);
  console.log('wrote', path.relative(ROOT, OUT));
  process.exit(errors.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
