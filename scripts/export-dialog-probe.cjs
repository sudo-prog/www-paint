#!/usr/bin/env node
/**
 * export-dialog-probe.cjs — regression guard for AGENTS.md §0.9.
 *
 * The LEGACY export dialog (`#export-root`, built by `js/ui/export.js`) is a
 * hidden overlay: the a11y sweep only asserts its role/aria-modal, and no Maestro
 * flow opens it, so its geometry was never measured. Its five action buttons sat
 * in ONE `.form-actions` flex row (`css/style.css`), which at 1440 already exactly
 * filled the dialog body — so any narrower body (<= ~450px) overflowed the row and
 * clipped `Save Project` past the viewport (measured right edge 392.45 vs 390).
 *
 * This probe opens the dialog at each width and asserts, for EVERY button:
 *   - its box lies fully inside the viewport (no left/right overflow), and
 *   - `elementFromPoint` at its centre returns the button itself (it is tappable), and
 *   - its height is >= 44px (the panels' WCAG-aligned target bar).
 *
 * Usage:
 *   NODE_PATH=<dir with playwright-core> node scripts/export-dialog-probe.cjs
 *   ... [--sizes=320,390,768,1440] [--json=<path>] [--shots=<dir>]
 * Exit: 0 = every width clean, 1 = a width failed (or the probe crashed).
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const MIN_TARGET = 44;
const sizesArg = (process.argv.find((a) => a.startsWith('--sizes=')) || '').split('=')[1];
const SIZES = (sizesArg ? sizesArg.split(',').map(Number) : [320, 360, 390, 414, 480, 500, 768, 1024, 1440])
  .map((w) => [w, w <= 500 ? 844 : 900]);
const JSON_OUT = (process.argv.find((a) => a.startsWith('--json=')) || '').split('=')[1] || '';
const SHOT_DIR = (process.argv.find((a) => a.startsWith('--shots=')) || '').split('=')[1] || '';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.wasm': 'application/wasm',
};

function findChromium() {
  const base = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  const dirs = fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => parseInt(b.split('-')[1], 10) - parseInt(a.split('-')[1], 10));
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

(async () => {
  const { server, port } = await startServer();
  const exe = process.env.CHROME_BINARY || findChromium();
  if (!exe) { console.error('No chromium found (set CHROME_BINARY or install playwright browsers)'); process.exit(1); }
  const browser = await chromium.launch({ executablePath: exe, args: ['--disable-gpu'] });
  const results = { probe: 'export-dialog (AGENTS §0.9)', minTarget: MIN_TARGET, sizes: [] };
  let failed = 0;

  for (const [W, H] of SIZES) {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    await page.click('#btn-export');
    await page.waitForTimeout(250);
    const data = await page.evaluate((MIN) => {
      const root = document.getElementById('export-root');
      const btns = [...root.querySelectorAll('.form-actions .btn')].map((b) => {
        const r = b.getBoundingClientRect();
        const cx = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
        const cy = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
        const hit = document.elementFromPoint(cx, cy);
        return {
          label: (b.textContent || '').replace(/\s+/g, ' ').trim(),
          left: Math.round(r.left * 100) / 100,
          right: Math.round(r.right * 100) / 100,
          height: Math.round(r.height * 100) / 100,
          offViewport: r.right > innerWidth + 0.5 || r.left < -0.5,
          tappable: !!(hit && hit.closest('.form-actions .btn') === b),
          underMin: r.height < MIN - 0.5,
        };
      });
      const rows = [...root.querySelectorAll('.form-actions')].map((row) => ({
        count: row.querySelectorAll('.btn').length,
        scrollW: row.scrollWidth,
        clientW: row.clientWidth,
        overflow: row.scrollWidth > row.clientWidth + 1,
      }));
      return { innerWidth, open: root.classList.contains('modal--open'), buttons: btns, rows };
    }, MIN_TARGET);

    const bad = data.buttons.filter((b) => b.offViewport || !b.tappable || b.underMin);
    const verdict = bad.length ? 'DEFECT' : 'ok';
    if (bad.length) failed++;
    results.sizes.push({ width: W, verdict, ...data });
    if (SHOT_DIR) {
      fs.mkdirSync(SHOT_DIR, { recursive: true });
      await page.locator('#export-root .export-dialog__content')
        .screenshot({ path: path.join(SHOT_DIR, `export-${W}.png`) }).catch(() => {});
    }
    const off = data.buttons.filter((b) => b.offViewport).map((b) => `${b.label}(${b.right})`);
    const small = data.buttons.filter((b) => b.underMin).map((b) => `${b.label}(${b.height})`);
    console.log(`@${String(W).padStart(4)} => ${verdict.padEnd(6)} buttons ${data.buttons.length}` +
      `  offViewport=[${off.join(',')}]  under44=[${small.join(',')}]` +
      `  rows=${JSON.stringify(data.rows.map((r) => [r.count, r.scrollW, r.clientW]))}`);
    await page.close();
  }

  await browser.close();
  server.close();
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(results, null, 2));
  console.log(`\n${failed ? 'FAIL' : 'PASS'} — ${failed} of ${SIZES.length} widths failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
