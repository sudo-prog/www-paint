#!/usr/bin/env node
/**
 * frog-levers-probe.cjs
 * 
 * Renders frog-source.jpg via the REAL PaintingEngine path (useWorker:true) under
 * three lever configurations, producing docs/research/frog-baseline.png,
 * frog-gradient.png, and frog-all-three.png.
 * 
 * Lever wiring:
 *   baseline   → gradientLSQ:false, saliencyWeighted:false, paletteLockedPair:false
 *   gradient   → gradientLSQ:true,  saliencyWeighted:false, paletteLockedPair:false
 *   all-three  → gradientLSQ:true,  saliencyWeighted:true,  paletteLockedPair:true
 * 
 * The lever flags are forwarded through engine.generate({modular:true, gradientLSQ:true})
 * → buildModularPlan → modularOptions → resolveOptions → optimise.
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs', 'research');
const FROG_SOURCE = path.join(ROOT, 'test-images', 'frog-source.jpg');
const W = 512, H = 384;
const COUNT = 400;
const SEED = 12345;

// ── static file server ────────────────────────────────────────────────────────
function findChromium() {
  const base = path.join(require('os').homedir(), '.cache', 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  const dirs = fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d))
    .sort((a, b) => parseInt(b.split('-')[1]) - parseInt(a.split('-')[1]));
  for (const d of dirs) {
    for (const sub of ['chrome-linux64', 'chrome-linux']) {
      const p = path.join(base, d, sub, 'chrome');
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.wasm': 'application/wasm', '.txt': 'text/plain',
};

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
  const chrome = findChromium();
  if (!chrome) { console.error('no chromium found'); process.exit(1); }

  const { server, port } = await startServer();
  const browser = await chromium.launch({ headless: true, executablePath: chrome,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });

  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // The probe page does the actual render via PaintingEngine
  const probeHTML = path.join(ROOT, 'scripts', 'frog-levers-probe.html');
  const url = `http://127.0.0.1:${port}/scripts/frog-levers-probe.html`;
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });

  await page.waitForFunction(() => {
    const s = document.getElementById('status');
    return s && (s.textContent.startsWith('DONE') || s.textContent.startsWith('FATAL'));
  }, { timeout: 600000 });

  const status = await page.$eval('#status', el => el.textContent);
  console.log('STATUS:', status);

  const result = await page.evaluate(() => window.__probe || {});
  console.log('\n=== RESULTS ===');
  for (const k of ['source', 'baseline', 'gradient', 'allThree']) {
    const r = result[k];
    if (!r) continue;
    console.log(`${k.padEnd(9)} shapes=${String(r.shapes ?? '—').padStart(4)} ` +
      `inkPct=${r.stats.inkPct} meanLum=${r.stats.meanLum} buckets=${r.stats.colourBuckets} ` +
      `meanGradDist=${r.meanGradDist ?? '—'} c0unique=${r.colour0Unique ?? '—'} ` +
      `types=${JSON.stringify(r.typeCounts ?? {})}`);
  }
  console.log('\n=== PIXEL DIGESTS ===');
  console.log(JSON.stringify(result.hashes));
  console.log('differ:', JSON.stringify(result.differ));

  // Structural similarity to the SOURCE — the "is it a frog, not blobs" check.
  console.log('\n=== STRUCTURE vs SOURCE (downsampled 64x48 luminance correlation / meanAbsDiff) ===');
  const sim = await page.evaluate(() => {
    const W = 512, H = 384, GW = 64, GH = 48;
    const grid = (id) => {
      const c = document.getElementById(id);
      const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
      const out = new Float32Array(GW * GH);
      const cw = W / GW, ch = H / GH;
      for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
        let s = 0, n = 0;
        const x0 = Math.floor(gx * cw), x1 = Math.floor((gx + 1) * cw);
        const y0 = Math.floor(gy * ch), y1 = Math.floor((gy + 1) * ch);
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          const i = (y * W + x) * 4;
          s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; n++;
        }
        out[gy * GW + gx] = s / Math.max(1, n);
      }
      return out;
    };
    const src = grid('c-src');
    const corr = (b) => {
      let ma = 0, mb = 0;
      for (let i = 0; i < src.length; i++) { ma += src[i]; mb += b[i]; }
      ma /= src.length; mb /= b.length;
      let cov = 0, va = 0, vb = 0, mad = 0;
      for (let i = 0; i < src.length; i++) {
        const da = src[i] - ma, db = b[i] - mb;
        cov += da * db; va += da * da; vb += db * db;
        mad += Math.abs(src[i] - b[i]);
      }
      return { r: +(cov / Math.sqrt(va * vb || 1)).toFixed(3), mad: +(mad / src.length).toFixed(2) };
    };
    return {
      baseline: corr(grid('c-baseline')),
      gradient: corr(grid('c-gradient')),
      allThree: corr(grid('c-allThree')),
    };
  });
  console.log(JSON.stringify(sim, null, 2));

  // Save PNGs from the canvas elements
  const canvasIds = ['c-src', 'c-baseline', 'c-gradient', 'c-allThree'];
  const outNames = ['frog-source.png', 'frog-baseline.png', 'frog-gradient.png', 'frog-all-three.png'];
  for (let i = 0; i < canvasIds.length; i++) {
    const el = await page.$('#' + canvasIds[i]);
    if (el) {
      const b64 = await page.evaluate((id) => {
        const c = document.getElementById(id);
        return c.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
      }, canvasIds[i]);
      fs.writeFileSync(path.join(DOCS_DIR, outNames[i]), Buffer.from(b64, 'base64'));
      console.log(`saved ${outNames[i]}`);
    }
  }

  console.log('\nERRORS:', errors.slice(0, 5));
  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });