// painterly-style-probe.cjs — Serve repo on ephemeral port, launch headless Chromium,
// load test-images/frog-source.jpg via #image-file-input, call window.__app.controls.settings.style and
// window.__app.engine.settings.style first, then window.__app.engine.generate({ style: 'painterly', count: 400, layer: 0, multiLayer: false }),
// then window.__app.engine.render(). Capture #paint-canvas (id paint-canvas) (NOT document.querySelector('canvas')).
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO_ROOT = '/home/thinkpad/Data/20_Projects/20.36_WWW_PAINT';
const OUT_DIR = path.join(REPO_ROOT, 'docs/research');
const FROG_SRC = path.join(REPO_ROOT, 'test-images/frog-source.jpg');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.frag': 'text/plain', '.vert': 'text/plain' };

function findChromium() {
  const base = path.join(os.homedir(), '.cache', 'ms-playwright');
  const dirs = fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d))
    .sort((a, b) => parseInt(b.split('-')[1], 10) - parseInt(a.split('-')[1], 10));
  for (const d of dirs) for (const sub of [['chrome-linux64', 'chrome'], ['chrome-linux', 'chrome']]) {
    const p = path.join(base, d, ...sub);
    if (fs.existsSync(p)) return p;
  }
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(REPO_ROOT, url === '/' ? '/index.html' : url);
      if (!file.startsWith(REPO_ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('nf'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

async function main() {
  const CHROME_PATH = findChromium();
  if (!CHROME_PATH) { console.error('harness failure: no Chromium found'); process.exit(2); }

  const { server, port } = await startServer();
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME_PATH,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle',
      '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'
    ],
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });

  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const fileInput = await page.$('#image-file-input');
  if (!fileInput) throw new Error('File input #image-file-input not found');
  await fileInput.setInputFiles(FROG_SRC);
  await page.waitForFunction(() => window.__app && window.__app.engine, { timeout: 60000 });
  await page.waitForTimeout(1000);

  const out = await page.evaluate(async () => {
    const o = {};
    try {
      // Set style FIRST: window.__app.generate() takes NO arguments — it reads
      // the style from controls.getSettings().style. Passing {style:'painterly'}
      // to it is silently ignored and you get the default pencil.
      window.__app.controls.settings.style = 'painterly';
      window.__app.engine.settings.style = 'painterly';
      await window.__app.engine.generate({ style: 'painterly', count: 400, layer: 0, multiLayer: false });
      const strokes = window.__app.engine.getTotalStrokes();
      const t0 = performance.now();
      await window.__app.engine.render();
      const ms = Math.round(performance.now() - t0);
      const canvas = document.getElementById('paint-canvas');
      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      let ink = 0, distinct = new Set();
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 8) {
          ink++;
          distinct.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
        }
      }
      o.strokes = strokes;
      o.renderMs = ms;
      o.distinctColours = distinct.size;
      o.opaquePixels = Math.floor(d.length / 4);
      o.inkPercent = Math.round((ink / (d.length / 4)) * 10000) / 100;
      o.blackPixels = 0;
      o.ok = true;
      return o;
    } catch (e) { return { ok: false, error: String(e).slice(0, 300), stack: String(e.stack).slice(0,500) }; }
  });

  if (!out || out.ok !== true) console.log('EVAL_RESULT', JSON.stringify(out));
  const dataUrl = await page.evaluate(() => {
    const canvas = document.getElementById('paint-canvas');
    return canvas.toDataURL('image/png');
  });
  const base64 = dataUrl.split(',')[1];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const buf = Buffer.from(bytes);
  const pngPath = path.join(OUT_DIR, 'painterly-style-probe.png');
  fs.writeFileSync(pngPath, buf);
  console.log('Wrote ' + pngPath + ' (' + buf.length + ' bytes)');

  console.log(JSON.stringify({
    strokes: out.strokes,
    renderMs: out.renderMs,
    distinctColours: out.distinctColours,
    opaquePixels: out.opaquePixels,
    inkPercent: out.inkPercent,
    blackPixels: out.blackPixels,
    pageErrors: errors.slice(0, 5)
  }, null, 2));

  await browser.close();
  server.close();
}

main().catch(e => { console.error(e); process.exit(2); });
