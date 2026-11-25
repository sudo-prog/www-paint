// dli-backend-direct.cjs — exercise the dli backend DIRECTLY (no full app), a few
// strokes only. Proves: engine constructs, FBO complete, paint deposited, pixels out.
const { chromium } = require('playwright-core');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');

const ROOT = '/home/thinkpad/Data/20_Projects/20.36_WWW_PAINT';
const OUT = path.join(ROOT, 'docs/research');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.frag': 'text/plain', '.vert': 'text/plain' };

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
      const file = path.join(ROOT, url === '/' ? '/index.html' : url);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('nf'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

(async () => {
  const { server, port } = await startServer();
  const browser = await chromium.launch({
    headless: true, executablePath: findChromium(),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle',
           '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('C:' + m.text().slice(0, 300)); });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const R = await page.evaluate(async () => {
    const out = { steps: [] };
    const t0 = performance.now();
    let mod;
    try {
      mod = await import('/js/engine/dli-paint-backend.js');
    } catch (e) { return { importError: e.message }; }
    out.steps.push('module imported');
    // Clean slate: a previous run in this page may have left a half-built instance.
    try { mod.resetDliPaintBackend(); } catch (e) { /* ignore */ }

    const W = 384, H = 384;
    let backend;
    try {
      backend = await mod.getDliPaintBackend(W, H);
    } catch (e) { return { ...out, initError: e.message, stack: (e.stack||'').split('\n').slice(0,3) }; }
    out.initMs = Math.round(performance.now() - t0);
    out.isReady = backend.isReady();
    out.isFallback = backend.isFallback();
    out.initError = backend.initError || null;
    out.counters = backend.counters || null;
    out.steps.push('backend initialized');
    window.__dliBackend = backend;

    // A handful of strokes across the canvas.
    const strokes = [
      { points: [[60, 120], [140, 90], [220, 140], [300, 100]], color: '#c44030' },
      { points: [[80, 200], [180, 240], [280, 200]], color: '#4a7c59' },
      { points: [[100, 300], [200, 270], [300, 310]], color: '#d9a441' },
    ];
    let strokeErr = null;
    let lastStrokeResult = null;
    const t1 = performance.now();
    try {
      for (const s of strokes) {
        lastStrokeResult = await backend.paintStroke(s.points, { color: s.color, size: 26, alpha: 1, seed: 7 });
      }
    } catch (e) { strokeErr = e.message + ' | ' + (e.stack||'').split('\n')[1]; }
    out.strokeMs = Math.round(performance.now() - t1);
    out.strokeError = strokeErr;
    out.strokeResult = lastStrokeResult;
    out.steps.push('strokes done');

    // Composite to a 2D canvas and measure the pixels.
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    try {
      // Diagnostic: read the canvas texture exactly the way the working diag does.
    // Read IMMEDIATELY after the strokes, no update() in between.
    out.immediateTex = (() => {
      const inst = window.__dliBackend;
      const paint = inst.paint, gl = inst.wgl.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, paint.framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, paint.canvasTexture, 0);
      const px = new Uint8Array(384 * 384 * 4);
      gl.readPixels(0, 0, 384, 384, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let distinct = new Set(), nonGrey = 0;
      for (let i = 0; i < px.length; i += 4) {
        distinct.add(px[i] + ',' + px[i+1] + ',' + px[i+2]);
        if (px[i] !== px[i+1] || px[i+1] !== px[i+2]) nonGrey++;
      }
      return { distinct: distinct.size, nonGrey, err: gl.getError() };
    })();

    out.preCompositeTex = (() => {
      const inst = window.__dliBackend;
      const paint = inst.paint, wgl = inst.wgl, gl = wgl.gl;
      const before = paint.needsRedraw;
      paint.update();
      const px = new Uint8Array(384 * 384 * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, paint.framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, paint.canvasTexture, 0);
      gl.readPixels(0, 0, 384, 384, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let distinct = new Set(), nonGrey = 0;
      for (let i = 0; i < px.length; i += 4) {
        distinct.add(px[i] + ',' + px[i+1] + ',' + px[i+2]);
        if (px[i] !== px[i+1] || px[i+1] !== px[i+2]) nonGrey++;
      }
      return { distinct: distinct.size, nonGrey, err: gl.getError(), needsRedrawBefore: before, needsRedrawAfter: paint.needsRedraw,
               offscreenW: inst.offscreenCanvas.width, offscreenH: inst.offscreenCanvas.height };
    })();

    out.compositeResult = await backend.compositeToCanvas(ctx, W, H, 1);
      out.steps.push('composited');
    } catch (e) { out.compositeError = e.message; }

    // RAW readback diagnostics (before masking): what does the GL canvas hold?
    out.rawSample = (() => {
      const inst = window.__dliBackend;
      const paint = inst.paint, wgl = inst.wgl;
      const px = new Uint8Array(W * H * 4);
      wgl.framebufferTexture2D(paint.framebuffer, wgl.FRAMEBUFFER, wgl.COLOR_ATTACHMENT0, wgl.TEXTURE_2D, paint.canvasTexture, 0);
      wgl.readPixels(wgl.createReadState().bindFramebuffer(paint.framebuffer), 0, 0, W, H, wgl.RGBA, wgl.UNSIGNED_BYTE, px);
      const hist = {};
      let nz = 0;
      for (let i = 0; i < px.length; i += 4) {
        const k = px[i] + ',' + px[i+1] + ',' + px[i+2] + ',' + px[i+3];
        hist[k] = (hist[k] || 0) + 1;
        if (px[i] !== px[i+1] || px[i+1] !== px[i+2]) nz++;
      }
      const top = Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 6);
      return { topColors: top, nonGreyPixels: nz, total: W * H, glError: wgl.getError() };
    })();

    // Post-composite: is there paint in the GL canvas texture NOW?
    out.postComposite = (() => {
      const inst = window.__dliBackend;
      const paint = inst.paint, wgl = inst.wgl, gl = wgl.gl;
      const px = new Uint8Array(W * H * 4);
      wgl.framebufferTexture2D(paint.framebuffer, wgl.FRAMEBUFFER, wgl.COLOR_ATTACHMENT0, wgl.TEXTURE_2D, paint.canvasTexture, 0);
      wgl.readPixels(wgl.createReadState().bindFramebuffer(paint.framebuffer), 0, 0, W, H, wgl.RGBA, wgl.UNSIGNED_BYTE, px);
      let distinct = new Set(), nonGrey = 0;
      for (let i = 0; i < px.length; i += 4) {
        distinct.add(px[i] + ',' + px[i+1] + ',' + px[i+2]);
        if (px[i] !== px[i+1] || px[i+1] !== px[i+2]) nonGrey++;
      }
      return { distinct: distinct.size, nonGrey, simFrame: paint.simulator.frameNumber,
               splatAreas: paint.simulator.splatAreas.length, err: gl.getError() };
    })();

    // If the 2D composite came back empty, fall back to the GL canvas texture
    // directly (drawImage of an OffscreenCanvas whose WebGL backbuffer was
    // rendered into). Report both so the difference is visible.
    out.compositePixels = (() => {
      const dd = ctx.getImageData(0, 0, W, H).data;
      let n = 0; for (let i = 3; i < dd.length; i += 4) if (dd[i] > 8) n++;
      return n;
    })();

    const d = ctx.getImageData(0, 0, W, H).data;
    let ink = 0, chromaSum = 0, minL = 255, maxL = 0;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (a > 8) {
        ink++;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        chromaSum += mx - mn;
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        if (l < minL) minL = l;
        if (l > maxL) maxL = l;
      }
    }
    out.inkPixels = ink;
    out.inkPercent = +(100 * ink / (W * H)).toFixed(3);
    out.chroma = ink ? +(chromaSum / ink).toFixed(2) : 0;
    out.lumRange = +(maxL - minL).toFixed(2);
    out.png = c.toDataURL('image/png');
    return out;
  });

  console.log(JSON.stringify({ ...R, png: undefined }, null, 2));
  if (R.png) {
    fs.mkdirSync(OUT, { recursive: true });
    const p = path.join(OUT, 'dli-backend-direct.png');
    fs.writeFileSync(p, Buffer.from(R.png.split(',')[1], 'base64'));
    console.log('wrote', p, fs.statSync(p).size, 'bytes');
  }
  if (errs.length) console.log('ERRORS:', errs.slice(0, 5));
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(2); });
