// dli-brush-isolated.cjs — drive the Brush alone and find where the writes fail.
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
  page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const R = await page.evaluate(async () => {
    const out = {};
    const { WrappedGL } = await import('/js/engine/dli-paint/wrappedgl.module.js');
    const { default: Brush } = await import('/js/engine/dli-paint/brush.module.js');

    const cv = new OffscreenCanvas(256, 256);
    const wgl = WrappedGL.create(cv, { preserveDrawingBuffer: true, alpha: true });
    const gl = wgl.gl;
    out.hasGL = !!gl;

    // THE critical order: extensions FIRST.
    wgl.getExtension('OES_texture_float');
    wgl.getExtension('OES_texture_float_linear');
    out.extErr = gl.getError();

    const files = ['shaders/fullscreen.vert','shaders/project.frag','shaders/distanceconstraint.frag',
      'shaders/planeconstraint.frag','shaders/bendingconstraint.frag','shaders/setbristles.frag',
      'shaders/updatevelocity.frag'];
    const src = {};
    for (const f of files) src[f] = await (await fetch('/js/engine/dli-paint/' + f)).text();

    const brush = new Brush(wgl, src, 100);
    out.errAfterBuild = gl.getError();

    // program link status
    out.programs = {};
    for (const name of ['setBristlesProgram','projectProgram','distanceConstraintProgram',
                        'planeConstraintProgram','bendingConstraintProgram','updateVelocityProgram']) {
      const p = brush[name];
      out.programs[name] = p ? {
        linked: gl.getProgramParameter(p.program, gl.LINK_STATUS),
        log: (gl.getProgramInfoLog(p.program) || '').slice(0, 150),
        attribs: gl.getProgramParameter(p.program, gl.ACTIVE_ATTRIBUTES),
      } : 'MISSING';
    }

    // texture FBO completeness
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    for (const [n, t] of [['positions', brush.positionsTexture], ['projected', brush.projectedPositionsTexture],
                           ['velocities', brush.velocitiesTexture]]) {
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      out['fbo_' + n] = st === gl.FRAMEBUFFER_COMPLETE ? 'COMPLETE' : st;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);

    // initialize + update
    try {
      brush.initialize(100, 256, 24, 12);
      out.errAfterInit = gl.getError();
      brush.update(140, 256, 24, 12);
      out.errAfterUpdate = gl.getError();
    } catch (e) { out.updateError = e.message; }

    // read positions
    const fb2 = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb2);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, brush.positionsTexture, 0);
    const st2 = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    out.positionsFbo = st2 === gl.FRAMEBUFFER_COMPLETE ? 'COMPLETE' : st2;
    if (st2 === gl.FRAMEBUFFER_COMPLETE) {
      const buf = new Float32Array(100 * 10 * 4);
      gl.readPixels(0, 0, 100, 10, gl.RGBA, gl.FLOAT, buf);
      out.readErr = gl.getError();
      let mx = 0, nz = 0;
      for (let i = 0; i < buf.length; i++) { if (buf[i] > mx) mx = buf[i]; if (buf[i] !== 0) nz++; }
      out.max = mx; out.nonZero = nz;
      out.sample = Array.from(buf.slice(0, 8));
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb2);
    out.finalErr = gl.getError();
    return out;
  });

  console.log(JSON.stringify(R, null, 2));
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(2); });
