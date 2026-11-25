// dli-stroke-only.cjs — ISOLATE the backend's own stroke: no manual splats,
// no diagnostic draws. Paint ONE stroke through the public API, then copy the
// simulator's paint texture into an RGBA8 texture and read it. If the copy has
// non-zero pixels, the backend's stroke deposits pigment.
const { chromium } = require('playwright-core');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');

const ROOT = '/home/thinkpad/Data/20_Projects/20.36_WWW_PAINT';
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
  page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 250)));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 250)); });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const R = await page.evaluate(async () => {
    const out = {};
    const mod = await import('/js/engine/dli-paint-backend.js');
    try { mod.resetDliPaintBackend(); } catch (e) {}
    const backend = await mod.getDliPaintBackend(384, 384);
    const paint = backend.paint, wgl = backend.wgl, gl = wgl.gl;

    const copySimToRgba8 = (label) => {
      const sim = paint.simulator;
      const tmp = wgl.buildTexture(wgl.RGBA, wgl.UNSIGNED_BYTE, sim.resolutionWidth, sim.resolutionHeight, null,
                                  wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.LINEAR, wgl.LINEAR);
      const ds = wgl.createDrawState()
        .bindFramebuffer(sim.simulationFramebuffer)
        .viewport(0, 0, sim.resolutionWidth, sim.resolutionHeight)
        .useProgram(sim.copyProgram)
        .uniform2f('u_oldResolution', sim.resolutionWidth, sim.resolutionHeight)
        .uniform2f('u_offset', 0, 0)
        .uniform2f('u_featherSize', 0, 0)
        .uniformTexture('u_paintTexture', 0, wgl.TEXTURE_2D, sim.paintTexture)
        .vertexAttribPointer(sim.quadVertexBuffer, sim.copyProgram.getAttribLocation('a_position'), 2, wgl.FLOAT, false, 0, 0);
      wgl.framebufferTexture2D(sim.simulationFramebuffer, wgl.FRAMEBUFFER, wgl.COLOR_ATTACHMENT0, wgl.TEXTURE_2D, tmp, 0);
      wgl.drawArrays(ds, wgl.TRIANGLE_STRIP, 0, 4);
      const copyErr = gl.getError();
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tmp, 0);
      const px = new Uint8Array(sim.resolutionWidth * sim.resolutionHeight * 4);
      gl.readPixels(0, 0, sim.resolutionWidth, sim.resolutionHeight, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const readErr = gl.getError();
      let nonZero = 0, mx = 0, mxA = 0;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i] !== 0 || px[i+1] !== 0 || px[i+2] !== 0 || px[i+3] !== 0) nonZero++;
        if (px[i] > mx) mx = px[i];
        if (px[i+3] > mxA) mxA = px[i+3];
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fb);
      wgl.deleteTexture(tmp);
      return { label, copyErr, readErr, nonZero, maxR: mx, maxA: mxA,
               total: sim.resolutionWidth * sim.resolutionHeight };
    };

    // BEFORE any stroke
    out.beforeStroke = copySimToRgba8('before');

    // THE PUBLIC API STROKE
    const res = await backend.paintStroke(
      [{ x: 60, y: 120 }, { x: 140, y: 90 }, { x: 220, y: 140 }, { x: 300, y: 100 }],
      { color: '#c44030', size: 30, alpha: 1 });
    out.strokeResult = res;
    out.counters = backend.counters;

    // AFTER the stroke
    out.afterStroke = copySimToRgba8('after');

    // Now the canvas texture (the shaded output)
    paint.update();
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, paint.canvasTexture, 0);
    const cpx = new Uint8Array(384 * 384 * 4);
    gl.readPixels(0, 0, 384, 384, gl.RGBA, gl.UNSIGNED_BYTE, cpx);
    const cerr = gl.getError();
    let distinct = new Set(), nonGrey = 0;
    for (let i = 0; i < cpx.length; i += 4) {
      distinct.add(cpx[i] + ',' + cpx[i+1] + ',' + cpx[i+2]);
      if (cpx[i] !== cpx[i+1] || cpx[i+1] !== cpx[i+2]) nonGrey++;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
    out.canvasTexture = { readErr: cerr, distinct: distinct.size, nonGrey };

    // And the public composite
    const c = document.createElement('canvas');
    c.width = 384; c.height = 384;
    const ctx = c.getContext('2d');
    out.composite = await backend.compositeToCanvas(ctx, 384, 384, 1);
    const cd = ctx.getImageData(0, 0, 384, 384).data;
    let cInk = 0, cChroma = 0;
    for (let i = 0; i < cd.length; i += 4) {
      if (cd[i+3] > 8) {
        cInk++;
        cChroma += Math.max(cd[i], cd[i+1], cd[i+2]) - Math.min(cd[i], cd[i+1], cd[i+2]);
      }
    }
    out.canvas2D = { inkPixels: cInk, chroma: cInk ? +(cChroma/cInk).toFixed(2) : 0 };
    out.png = c.toDataURL('image/png');
    return out;
  });

  console.log(JSON.stringify({ ...R, png: undefined }, null, 2));
  if (R.png) {
    const p = path.join(ROOT, 'docs/research/dli-stroke-only.png');
    fs.writeFileSync(p, Buffer.from(R.png.split(',')[1], 'base64'));
    console.log('wrote', p, fs.statSync(p).size, 'bytes');
  }
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(2); });
