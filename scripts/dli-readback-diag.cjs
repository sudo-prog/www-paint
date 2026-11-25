// dli-readback-diag.cjs — WHY does the canvas texture read back as a flat wash?
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
  page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 200)));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const R = await page.evaluate(async () => {
    const out = {};
    const mod = await import('/js/engine/dli-paint-backend.js');
    try { mod.resetDliPaintBackend(); } catch (e) {}
    const backend = await mod.getDliPaintBackend(384, 384);
    const paint = backend.paint, wgl = backend.wgl, gl = wgl.gl;

    out.ready = backend.isReady();

    // --- 1. What IS the canvas texture? ---
    gl.bindTexture(gl.TEXTURE_2D, paint.canvasTexture);
    // gl doesn't expose the format back; infer from what the port built it with.
    out.canvasTextureExists = !!paint.canvasTexture;
    out.paintTextureType = paint.simulator ? paint.simulator.simulationTextureType : null;

    // --- 2. Is the FBO with canvasTexture attached COMPLETE? ---
    wgl.framebufferTexture2D(paint.framebuffer, wgl.FRAMEBUFFER, wgl.COLOR_ATTACHMENT0, wgl.TEXTURE_2D, paint.canvasTexture, 0);
    out.fboStatus = wgl.checkFramebufferStatus(paint.framebuffer);
    out.FRAMEBUFFER_COMPLETE = gl.FRAMEBUFFER_COMPLETE;
    out.fboErr = gl.getError();

    // --- 3. Paint a stroke, then read the SIMULATION paint texture (float) ---
    await backend.paintStroke([{ x: 60, y: 120 }, { x: 300, y: 200 }], { color: '#c44030', size: 30, alpha: 1 });

    const sim = paint.simulator;
    out.simHasPaintTexture = !!sim.paintTexture;
    out.simTypeIsHalfFloat = sim.simulationTextureType !== wgl.FLOAT;

    // read simulation paint texture as FLOAT
    const W = sim.resolutionWidth, H = sim.resolutionHeight;
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sim.paintTexture, 0);
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    out.simFboStatus = st === gl.FRAMEBUFFER_COMPLETE ? 'COMPLETE' : st;
    out.simFboErr = gl.getError();
    if (st === gl.FRAMEBUFFER_COMPLETE) {
      // Read with the type the texture ACTUALLY has. The Simulator uses HALF_FLOAT
      // (36193) here, and readPixels with gl.FLOAT on a half-float attachment is
      // INVALID_OPERATION (1282).
      const HALF = gl.HALF_FLOAT_OES !== undefined ? gl.HALF_FLOAT_OES : 0x8D61;
      const isHalf = sim.simulationTextureType === HALF;
      out.simIsHalfFloat = isHalf;
      const buf = isHalf ? new Uint16Array(W * H * 4) : new Float32Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, isHalf ? HALF : gl.FLOAT, buf);
      out.simReadErr = gl.getError();
      let mx = 0, nz = 0, mxA = 0;
      for (let i = 0; i < buf.length; i += 4) {
        if (buf[i + 3] > mxA) mxA = buf[i + 3];
        if (buf[i] > mx) mx = buf[i];
        if (buf[i] !== 0 || buf[i + 1] !== 0 || buf[i + 2] !== 0 || buf[i + 3] !== 0) nz++;
      }
      out.simMaxRGB = mx; out.simMaxAlpha = mxA; out.simNonZeroPixels = nz;
      out.simTotal = W * H;
      out.simSample = Array.from(buf.slice(0, 12));
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);

    // ── 4. Read the canvas texture with several format/type combos ──
    // NOTE: paint.update() renders the painting into canvasTexture. Without it the
    // texture still holds whatever the previous pass left there.
    paint.update();
    // ── COPY THE SIM PAINT TEXTURE INTO AN RGBA8 TEXTURE, THEN READ ──
    // WebGL1 readPixels from a HALF_FLOAT attachment is unreliable (1282).
    // copyTexture() already does exactly this via the copyProgram, so copy the
    // simulator's paint texture into a temporary RGBA8 texture and read THAT.
    out.simViaCopy = (() => {
      const sim7 = paint.simulator, wgl7 = paint.wgl, gl7 = wgl7.gl;
      const res = {};
      try {
        const tmp = wgl7.buildTexture(wgl7.RGBA, wgl7.UNSIGNED_BYTE, sim7.resolutionWidth, sim7.resolutionHeight, null,
                                     wgl7.CLAMP_TO_EDGE, wgl7.CLAMP_TO_EDGE, wgl7.LINEAR, wgl7.LINEAR);
        // copyTexture writes with the copyProgram (resize.frag) which expects
        // u_oldResolution/u_offset/u_featherSize — set them via the draw state.
        const ds = wgl7.createDrawState()
          .bindFramebuffer(sim7.simulationFramebuffer)
          .viewport(0, 0, sim7.resolutionWidth, sim7.resolutionHeight)
          .useProgram(sim7.copyProgram)
          .uniform2f('u_oldResolution', sim7.resolutionWidth, sim7.resolutionHeight)
          .uniform2f('u_offset', 0, 0)
          .uniform2f('u_featherSize', 0, 0)
          .uniformTexture('u_paintTexture', 0, wgl7.TEXTURE_2D, sim7.paintTexture)
          .vertexAttribPointer(sim7.quadVertexBuffer, sim7.copyProgram.getAttribLocation('a_position'), 2, wgl7.FLOAT, false, 0, 0);
        wgl7.framebufferTexture2D(sim7.simulationFramebuffer, wgl7.FRAMEBUFFER, wgl7.COLOR_ATTACHMENT0, wgl7.TEXTURE_2D, tmp, 0);
        wgl7.drawArrays(ds, wgl7.TRIANGLE_STRIP, 0, 4);
        res.copyErr = gl7.getError();

        const fb7 = gl7.createFramebuffer();
        gl7.bindFramebuffer(gl7.FRAMEBUFFER, fb7);
        gl7.framebufferTexture2D(gl7.FRAMEBUFFER, gl7.COLOR_ATTACHMENT0, gl7.TEXTURE_2D, tmp, 0);
        const st = gl7.checkFramebufferStatus(gl7.FRAMEBUFFER);
        res.fbo = st === gl7.FRAMEBUFFER_COMPLETE ? 'COMPLETE' : st;
        const px = new Uint8Array(sim7.resolutionWidth * sim7.resolutionHeight * 4);
        gl7.readPixels(0, 0, sim7.resolutionWidth, sim7.resolutionHeight, gl7.RGBA, gl7.UNSIGNED_BYTE, px);
        res.readErr = gl7.getError();
        let nonZero = 0, mx = 0;
        for (let i = 0; i < px.length; i += 4) {
          if (px[i] !== 0 || px[i+1] !== 0 || px[i+2] !== 0 || px[i+3] !== 0) nonZero++;
          if (px[i] > mx) mx = px[i];
        }
        res.nonZero = nonZero; res.maxR = mx;
        res.total = sim7.resolutionWidth * sim7.resolutionHeight;
        gl7.bindFramebuffer(gl7.FRAMEBUFFER, null);
        gl7.deleteFramebuffer(fb7);
        wgl7.deleteTexture(tmp);
      } catch (e) { res.error = e.message; }
      return res;
    })();

    // Drain any stale GL error first: a pending 1282 from an earlier call makes a
    // perfectly good readback look like a failure.
    while (gl.getError() !== gl.NO_ERROR) { /* drain */ }

    out.readCombos = [];
    // Single isolated read with the error captured IMMEDIATELY after it.
    out.singleRead = (() => {
      const fbS = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbS);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, paint.canvasTexture, 0);
      const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      const errBefore = gl.getError();
      const px = new Uint8Array(384 * 384 * 4);
      gl.readPixels(0, 0, 384, 384, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const errAfter = gl.getError();
      let distinct = new Set(), nonGrey = 0;
      for (let i = 0; i < px.length; i += 4) {
        distinct.add(px[i] + ',' + px[i+1] + ',' + px[i+2]);
        if (px[i] !== px[i+1] || px[i+1] !== px[i+2]) nonGrey++;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fbS);
      return { fbo: st === gl.FRAMEBUFFER_COMPLETE ? 'COMPLETE' : st,
               errBefore, errAfter, distinct: distinct.size, nonGrey,
               sample: Array.from(px.slice(0, 12)) };
    })();
    out.textureInfo = {
      canvasTexW: (() => { gl.bindTexture(gl.TEXTURE_2D, paint.canvasTexture); return gl.getTexParameter ? null : null; })(),
      simW: paint.simulator.resolutionWidth,
      simH: paint.simulator.resolutionHeight,
      canvasW: paint.canvas.width,
      paintingRect: [paint.paintingRectangle.left, paint.paintingRectangle.bottom,
                     paint.paintingRectangle.width, paint.paintingRectangle.height],
      colorModel: paint.colorModel,
      needsRedraw: paint.needsRedraw,
    };
    wgl.framebufferTexture2D(paint.framebuffer, wgl.FRAMEBUFFER, wgl.COLOR_ATTACHMENT0, wgl.TEXTURE_2D, paint.canvasTexture, 0);
    for (const [fmt, type, label] of [
      [gl.RGBA, gl.UNSIGNED_BYTE, 'RGBA/UBYTE'],
      [gl.RGBA, gl.FLOAT, 'RGBA/FLOAT'],
    ]) {
      const px = new (type === gl.FLOAT ? Float32Array : Uint8Array)(384 * 384 * 4);
      gl.readPixels(0, 0, 384, 384, fmt, type, px);
      const e = gl.getError();
      let distinct = new Set(), mx = 0, nz = 0;
      for (let i = 0; i < px.length; i += 4) {
        distinct.add(px[i] + ',' + px[i + 1] + ',' + px[i + 2]);
        if (px[i] > mx) mx = px[i];
        if (px[i] !== px[i + 1] || px[i + 1] !== px[i + 2]) nz++;
      }
      out.readCombos.push({ label, err: e, distinct: distinct.size, maxR: mx, nonGrey: nz,
        sample: Array.from(px.slice(0, 8)) });
    }
    // ── Brush simulation textures: is the bristle simulation running? ──
    const brush = paint.brush;
    out.brushExists = !!brush;
    if (brush) {
      const bf = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, bf);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, brush.positionsTexture, 0);
      const bst = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      out.brushFbo = bst === gl.FRAMEBUFFER_COMPLETE ? 'COMPLETE' : bst;
      out.brushFboErr = gl.getError();
      if (bst === gl.FRAMEBUFFER_COMPLETE) {
        const bb = new Float32Array(100 * 10 * 4);
        gl.readPixels(0, 0, 100, 10, gl.RGBA, gl.FLOAT, bb);
        out.brushReadErr = gl.getError();
        let mx = 0, nz = 0;
        for (let i = 0; i < bb.length; i++) { if (bb[i] > mx) mx = bb[i]; if (bb[i] !== 0) nz++; }
        out.brushMax = mx; out.brushNonZero = nz;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(bf);
    }
    out.brushInitialized = paint.brushInitialized;
    out.simSplatAreas = paint.simulator ? paint.simulator.splatAreas.length : null;
    out.simFrameNumber = paint.simulator ? paint.simulator.frameNumber : null;

    // ── Direct splat test: write known colour into the sim paint texture ──
    // Upstream stores RYB in the texture; painting.frag converts with 1.0 - ryb.yxz.
    const sim2 = paint.simulator;
    out.splatTest = (() => {
      const fb3 = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb3);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sim2.paintTexture, 0);
      const st3 = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      const res = { fbo: st3 === gl.FRAMEBUFFER_COMPLETE ? 'COMPLETE' : st3 };
      if (st3 === gl.FRAMEBUFFER_COMPLETE) {
        const buf = new Uint16Array(4 * 4 * 4);
        gl.readPixels(0, 0, 4, 4, gl.RGBA, gl.HALF_FLOAT_OES !== undefined ? gl.HALF_FLOAT_OES : 0x8D61, buf);
        res.err = gl.getError();
        res.sample = Array.from(buf.slice(0, 12));
        res.anyNonZero = Array.from(buf).some(v => v !== 0);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fb3);
      return res;
    })();

    // ── ISOLATE: write known pigment into the sim paint texture, then shade ──
    out.shadingTest = (() => {
      const sim3 = paint.simulator;
      const W3 = sim3.resolutionWidth, H3 = sim3.resolutionHeight;
      const HALF = gl.HALF_FLOAT_OES !== undefined ? gl.HALF_FLOAT_OES : 0x8D61;

      // 1. Read the current paint texture (as half-float) to see if the splat wrote.
      const fbA = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbA);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sim3.paintTexture, 0);
      const bufA = new Uint16Array(W3 * H3 * 4);
      gl.readPixels(0, 0, W3, H3, gl.RGBA, HALF, bufA);
      // NOTE: WebGL1 readPixels from a HALF_FLOAT attachment requires
      // implementation-defined support; if it errors, read via the canvas texture.
      const errA = gl.getError();
      let nzA = 0, mxA = 0;
      for (let i = 0; i < bufA.length; i++) { if (bufA[i] !== 0) nzA++; if (bufA[i] > mxA) mxA = bufA[i]; }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fbA);

      return { readErr: errA, paintTexNonZero: nzA, paintTexMax: mxA,
               simW: W3, simH: H3,
               paintingResW: paint.simulator.resolutionWidth,
               paintingRectW: paint.paintingRectangle.width,
               paintingRectL: paint.paintingRectangle.left,
               paintingRectB: paint.paintingRectangle.bottom,
               canvasW: paint.canvas.width, canvasH: paint.canvas.height };
    })();

    // ── SPLAT ISOLATION: call simulator.splat() directly with a known colour ──
    out.splatIsolation = (() => {
      const sim4 = paint.simulator;
      const brush4 = paint.brush;
      const res = {};
      try {
        // Clear the sim paint texture first so any non-zero is definitely ours.
        sim4.clearTextures([sim4.paintTexture, sim4.paintTextureTemp]);
        res.afterClearErr = gl.getError();

        // Splat with a bright colour at the brush position.
        const area = new (paint.paintingRectangle.constructor)(0, 0, sim4.resolutionWidth, sim4.resolutionHeight);
        sim4.splat(brush4, 0.13333 * paint.brushScale, paint.paintingRectangle,
                   [0.9, 0.2, 0.1, 0.5], 0.05 * paint.brushScale, 0.14);
        res.afterSplatErr = gl.getError();

        // Read the paint texture via a FLOAT readback attempt (may 1282) and via
        // the canvas texture after an update.
        res.brushPos = { x: brush4.positionX, y: brush4.positionY, z: brush4.positionZ, scale: brush4.scale };
        res.brushScale = paint.brushScale;
        res.zThreshold = 0.13333 * paint.brushScale;
        res.splatAreas = sim4.splatAreas.length;
        res.frame = sim4.frameNumber;
      } catch (e) { res.error = e.message; }
      return res;
    })();

    // ── SPLAT DRAW, step by step, to locate the INVALID_OPERATION ──
    out.splatSteps = (() => {
      const sim5 = paint.simulator, brush5 = paint.brush, wgl5 = paint.wgl;
      const steps = [];
      const push = (label) => steps.push({ label, err: gl.getError() });
      try {
        // What does the splat actually need? Reproduce upstream's draw exactly.
        const splatDrawState = wgl5.createDrawState()
          .bindFramebuffer(sim5.simulationFramebuffer)
          .viewport(0, 0, sim5.resolutionWidth, sim5.resolutionHeight)
          .enable(wgl5.SCISSOR_TEST)
          .scissor(0, 0, sim5.resolutionWidth, sim5.resolutionHeight)
          .enable(wgl5.BLEND)
          .blendEquation(wgl5.FUNC_ADD)
          .blendFuncSeparate(wgl5.SRC_ALPHA, wgl5.ONE_MINUS_SRC_ALPHA, wgl5.ONE, wgl5.ONE)
          .vertexAttribPointer(brush5.splatCoordinatesBuffer, sim5.splatProgram.getAttribLocation('a_splatCoordinates'), 4, wgl5.FLOAT, wgl5.FALSE, 0, 0)
          .bindIndexBuffer(brush5.splatIndexBuffer)
          .useProgram(sim5.splatProgram)
          .uniform2f('u_paintingDimensions', paint.paintingRectangle.width, paint.paintingRectangle.height)
          .uniform2f('u_paintingPosition', paint.paintingRectangle.left, paint.paintingRectangle.bottom)
          .uniform1f('u_splatRadius', 0.05 * paint.brushScale)
          .uniform4f('u_splatColor', 0.9, 0.2, 0.1, 0.5)
          .uniformTexture('u_positionsTexture', 0, wgl5.TEXTURE_2D, brush5.positionsTexture)
          .uniformTexture('u_previousPositionsTexture', 1, wgl5.TEXTURE_2D, brush5.previousPositionsTexture)
          .uniform1f('u_zThreshold', 0.13333 * paint.brushScale);
        push('drawState built');

        wgl5.framebufferTexture2D(sim5.simulationFramebuffer, wgl5.FRAMEBUFFER, wgl5.COLOR_ATTACHMENT0, wgl5.TEXTURE_2D, sim5.paintTexture, 0);
        push('fbo attached');

        const count = brush5.splatIndexCount * brush5.bristleCount / brush5.maxBristleCount;
        steps.push({ label: 'counts', splatIndexCount: brush5.splatIndexCount,
                     bristleCount: brush5.bristleCount, maxBristleCount: brush5.maxBristleCount,
                     drawCount: count, attribLoc: sim5.splatProgram.getAttribLocation('a_splatCoordinates') });

        wgl5.drawElements(splatDrawState, wgl5.TRIANGLES, count, wgl5.UNSIGNED_SHORT, 0);
        push('drawElements');
      } catch (e) { steps.push({ label: 'EXCEPTION', msg: e.message }); }
      return steps;
    })();

    // ── REAL simulator.splat() on a CLEAN sim, error-checked around it ──
    out.realSplat = (() => {
      const sim6 = paint.simulator, brush6 = paint.brush, wgl6 = paint.wgl;
      const steps = [];
      try {
        // Fresh state: no splat areas, clean textures.
        sim6.splatAreas.length = 0;
        sim6.clearTextures([sim6.paintTexture, sim6.paintTextureTemp, sim6.velocityTexture, sim6.velocityTextureTemp]);
        steps.push({ label: 'cleared', err: gl.getError() });

        // Put the brush somewhere sensible and re-init so positions are fresh.
        brush6.initialize(200, 200, 2.0 * paint.brushScale, paint.brushScale);
        steps.push({ label: 'brush init', err: gl.getError() });

        sim6.splat(brush6, 0.13333 * paint.brushScale, paint.paintingRectangle,
                   [0.9, 0.2, 0.1, 0.5], 0.05 * paint.brushScale, 0.14);
        steps.push({ label: 'splat', err: gl.getError() });

        const sa = sim6.splatAreas[0];
        steps.push({ label: 'area', l: sa.rectangle.left, b: sa.rectangle.bottom,
                     w: sa.rectangle.width, h: sa.rectangle.height,
                     simW: sim6.resolutionWidth, simH: sim6.resolutionHeight });
        const gsa = sim6.getSimulationArea();
        steps.push({ label: 'simArea', l: gsa.left, b: gsa.bottom, w: gsa.width, h: gsa.height });
      } catch (e) { steps.push({ label: 'EXCEPTION', msg: e.message }); }
      return steps;
    })();

    // ── PROGRAM HEALTH: do all programs link WITH their attributes? ──
    out.programHealth = (() => {
      const wgl7 = paint.wgl, gl7 = wgl7.gl;
      const check = (prog, label) => {
        if (!prog || !prog.program) return { label, missing: true };
        return {
          label,
          linked: gl7.getProgramParameter(prog.program, gl7.LINK_STATUS),
          log: (gl7.getProgramInfoLog(prog.program) || '').slice(0, 120),
          attribs: gl7.getProgramParameter(prog.program, gl7.ACTIVE_ATTRIBUTES),
          a_splatCoordinates: prog.getAttribLocation('a_splatCoordinates'),
          a_position: prog.getAttribLocation('a_position'),
        };
      };
      const sim7 = paint.simulator;
      return [
        check(sim7.splatProgram, 'splatProgram'),
        check(sim7.velocitySplatProgram, 'velocitySplatProgram'),
        check(paint.paintingProgram, 'paintingProgram'),
        check(paint.paintingProgramRGB, 'paintingProgramRGB'),
        check(paint.outputProgram, 'outputProgram'),
      ];
    })();

    out.finalGlErr = gl.getError();
    return out;
  });

  console.log(JSON.stringify(R, null, 2));
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(2); });
