/**
 * Capture Code Paint's RAW drawing operations (the "teacher signal").
 *
 * Loads https://paint.jas.black in our own Playwright Chromium and wraps
 * CanvasRenderingContext2D.prototype (+ Path2D) BEFORE the site's scripts
 * run, recording every stroke()/fill() call with:
 *   - the full path (moveTo/lineTo/quad/bezier args)
 *   - lineWidth, strokeStyle, fillStyle (string colours only), globalAlpha
 *   - the canvas size it drew on
 *
 * That is the site's exact stroke plan — length, width, strength (alpha),
 * colour, order — not pixels. We observe the public API of a page we loaded
 * in our own browser; nothing is modified on their side.
 *
 * Output:
 *   /tmp/cp-strokes.ndjson        one JSON op per line
 *   /tmp/cp-shots/mid-*.png       progressive stage screenshots
 *   /tmp/cp-shots/final-stage.png final stage canvas
 */
const { chromium } = require('playwright-core');
const fs = require('fs');

const CHROME = '/home/thinkpad/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const OUT_NDJSON = '/tmp/cp-strokes.ndjson';
const SHOT_DIR = '/tmp/cp-shots';
const FROG = '/home/thinkpad/Data/20_Projects/20.36_WWW_PAINT/test-images/frog-source.jpg';

(async () => {
  fs.rmSync(OUT_NDJSON, { force: true });
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: CHROME,
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  await ctx.addInitScript(() => {
    const log = [];
    log._cap = 500000;
    window.__cp2d = log;
    const proto = CanvasRenderingContext2D.prototype;

    // Tracked drawing state (per-context-independent best effort).
    const state = { lw: 1, ss: '#000000', fs: '#000000', ga: 1, cap: 'butt' };
    const stack = [];

    // Intercept style properties so every stroke record carries its state.
    for (const prop of ['lineWidth', 'strokeStyle', 'fillStyle', 'globalAlpha', 'lineCap']) {
      const desc = Object.getOwnPropertyDescriptor(proto, prop);
      if (!desc || !desc.set) continue;
      Object.defineProperty(proto, prop, {
        get: desc.get,
        set: function (v) { state[prop] = v; return desc.set.call(this, v); },
        configurable: true,
        enumerable: desc.enumerable,
      });
    }

    // save/restore bypass the setters, so track them to keep state honest.
    const saveO = proto.save;
    proto.save = function () { stack.push({ ...state }); return saveO.call(this); };
    const restoreO = proto.restore;
    proto.restore = function () { const s = stack.pop(); if (s) Object.assign(state, s); return restoreO.call(this); };

    // Path recording: plain path on the context + Path2D instances.
    const pathOps = ['moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo',
      'arc', 'ellipse', 'rect', 'arcTo', 'closePath'];
    const num = (x) => (typeof x === 'number' ? Math.round(x * 100) / 100 : x);
    let path = [];
    for (const op of pathOps) {
      const orig = proto[op];
      if (typeof orig !== 'function') continue;
      Object.defineProperty(proto, op, {
        value: function (...a) { path.push([op, a.map(num)]); return orig.apply(this, a); },
        writable: true, configurable: true,
      });
    }
    const pm = typeof Path2D !== 'undefined' ? new WeakMap() : null;
    if (pm) {
      const P2 = Path2D.prototype;
      for (const op of pathOps) {
        const orig = P2[op];
        if (typeof orig !== 'function') continue;
        Object.defineProperty(P2, op, {
          value: function (...a) {
            let l = pm.get(this);
            if (!l) { l = []; pm.set(this, l); }
            l.push([op, a.map(num)]);
            return orig.apply(this, a);
          },
          writable: true, configurable: true,
        });
      }
    }

    const colStr = (v) => {
      if (typeof v === 'string') return v;
      const t = Object.prototype.toString.call(v);
      return t === '[object CanvasGradient]' ? 'gradient' : 'pattern';
    };

    const record = (op, args, ops, cw, ch) => {
      if (log.length >= log._cap) return;
      log.push({
        op, a: args.map(num),
        path: ops,
        lw: state.lw, ss: colStr(state.ss), fs: colStr(state.fs),
        ga: state.ga, cap: state.cap, cw, ch,
      });
    };

    for (const op of ['stroke', 'fill']) {
      const orig = proto[op];
      Object.defineProperty(proto, op, {
        value: function (...a) {
          const cw = this.canvas ? this.canvas.width : 0;
          const ch = this.canvas ? this.canvas.height : 0;
          if (a[0] instanceof Path2D && pm) {
            record(op, [], pm.get(a[0]) || [], cw, ch);
          } else if (path.length) {
            record(op, [], path.slice(), cw, ch);
            path = [];
          }
          return orig.apply(this, a);
        },
        writable: true, configurable: true,
      });
    }

    // drawImage / putImageData matter too (layer compositing).
    for (const op of ['drawImage', 'putImageData']) {
      const orig = proto[op];
      Object.defineProperty(proto, op, {
        value: function (...a) {
          const cw = this.canvas ? this.canvas.width : 0;
          const ch = this.canvas ? this.canvas.height : 0;
          if (log.length < log._cap) {
            log.push({ op, a: [], path: [], cw, ch, lw: state.lw, ss: colStr(state.ss), fs: colStr(state.fs), ga: state.ga, cap: state.cap });
          }
          return orig.apply(this, a);
        },
        writable: true, configurable: true,
      });
    }
  });

  const page = await ctx.newPage();
  console.log('loading paint.jas.black ...');
  await page.goto('https://paint.jas.black/', { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(10000);

  const fileInput = await page.$('#file');
  if (!fileInput) { console.log('NO #file input'); await browser.close(); process.exit(1); }
  await fileInput.setInputFiles(FROG);
  console.log('frog uploaded');
  const go = await page.$('#phtextgo');
  if (go) { await go.click().catch(() => {}); }

  // Poll until the op stream goes quiet (painting finished).
  let last = -1, stable = 0, i = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 180000) {
    await page.waitForTimeout(4000);
    const n = await page.evaluate(() => (window.__cp2d ? window.__cp2d.length : -1));
    const secs = Math.round((Date.now() - t0) / 1000);
    console.log(`t+${secs}s ops=${n}`);
    if (n === last && n > 0) { if (++stable >= 3) break; } else { stable = 0; last = n; }
    if (i % 3 === 0) {
      const st = await page.$('#stage');
      if (st) await st.screenshot({ path: `${SHOT_DIR}/mid-${String(i).padStart(3, '0')}.png` }).catch(() => {});
    }
    i++;
  }

  // Final captures.
  const stage = await page.$('#stage');
  if (stage) await stage.screenshot({ path: `${SHOT_DIR}/final-stage.png` }).catch(() => {});
  await page.screenshot({ path: `${SHOT_DIR}/final-page.png` }).catch(() => {});

  // Chunked NDJSON dump.
  const total = await page.evaluate(() => window.__cp2d.length);
  console.log('total ops:', total);
  for (let s = 0; s < total; s += 20000) {
    const slice = await page.evaluate(
      ({ a, c }) => JSON.stringify(window.__cp2d.slice(a, a + c)), { a: s, c: 20000 },
    );
    const arr = JSON.parse(slice);
    fs.appendFileSync(OUT_NDJSON, arr.map((o) => JSON.stringify(o)).join('\n') + '\n');
  }
  console.log('dumped', OUT_NDJSON, fs.statSync(OUT_NDJSON).size, 'bytes');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
