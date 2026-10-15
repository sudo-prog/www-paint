/**
 * painter.js — Faithful port of Code Painter v4.24.1 auto-painter worker.
 *
 * Original: https://github.com/JasBlack/code-painter (single-file, 967KB)
 * Worker source: window.CP_WORKER_SRC (88KB)
 *
 * Key algorithms ported exactly:
 *   - Size progression: smax = L * lerp(0.45, 0.012, sqrt(count/maxShapes))
 *   - Hill-climbing: mutate best candidate up to 180 times
 *   - Color solving: weighted least squares with ridge term
 *   - Smart mode: structure tensor, focus map, subject detection
 *   - Error map: cumulative distribution sampling
 *   - Flow tracing: follow structure tensor field
 *   - Edge outlines: Canny non-max suppression + hysteresis + chain tracing
 *   - Region fill: flood fill + contour + scribble/rows
 *   - Order modes: down/up/right/left/diag/spiral/rings/clock
 *   - One-line mode: pen that never lifts
 *
 * @module painter
 */

import { poly as SHPpoly, shapeAxis as SHPaxis } from './shapes.js';

// ── Utility ─────────────────────────────────────────────────────────────────

const cl255 = v => v < 0 ? 0 : v > 255 ? 255 : v;
const lerp = (a, b, t) => a + (b - a) * t;

// ── Painter class ───────────────────────────────────────────────────────────

export class Painter {
  constructor({ width, height, imageData, options = {} }) {
    this.W = width;
    this.H = height;
    this.options = options;
    this._shapes = [];
    this._running = false;
    this._stopped = false;

    // Options
    this.style = options.style || 'painterly';
    this.smart = options.smart !== false; // default true
    this.abstract = options.abstract || false;
    this.palette = options.palette || null;
    this.sizeK = options.size || 1;
    this.sizeRand = options.sizeRand || false;
    this.order = options.order || null;
    this.outline = options.outline || 'off';
    this.rfill = options.rfill || 'off';
    this.maxShapes = options.maxShapes || 3000;
    this.seed = options.seed || 12345;
    this.onShape = options.onShape || null;
    this.onProgress = options.onProgress || null;
    this.onDone = options.onDone || null;

    // State
    this.count = 0;
    this.gen = 0;
    this.sim = 0;
    this.stuck = 0;
    this.passFails = 0;
    this.HURRY = 1;
    this.UNTIL = null;
    this.ACC = false;
    this.PEN = false;
    this.pENS = [];
    this.pEN_ID = 0;
    this.penPos = null;
    this.stepProg = 0;
    this.stepStyle = this.style;
    this.stepBg = null;
    this.styles = [this.style];
    this.bgStyles = [];
    this.LINES = true;
    this.SSZ = {};
    this.PAL = this.palette;
    this.ORD = null;
    this.passNo = 0;
    this.passStart = 0;
    this.passLen = 1;
    this.pathPic = null;
    this.rfNext = 0;
    this.OUTL = this.outline;
    this.OL = null;
    this.olI = 0;
    this.RFILL = this.rfill;
    this.endless = false;
    this.todo = 0;
    this.tries = 0;
    this.triesMax = 400;
    this.frameL = 0;
    this.lastAnaL = null;
    this.paused = false;
    this.anaN = 0;
    this.FRAME_OL = null;
    this.FRESH = null;
    this.band = null;
    this.Sub = null;
    this.Sal = null;
    this.Tan = null;
    this.Coh = null;
    this.Edge = null;
    this.Wt = null;
    this.cumE = null;
    this.cumETotal = 0;

    // Initialize RNG
    this._seed = this.seed;

    // Initialize image data
    this._initImage(imageData);

    // Initialize cumE for smart mode (must be after _initImage sets W/H)
    if (this.smart) {
      this.cumE = new Float64Array(this.W * this.H);
    }

    // Initialize analysis
    if (this.smart) {
      this.analyse();
    }

    // Initialize order
    if (this.order) {
      this.orderSetup(this.order, 0);
    }

    // Initialize outlines
    if (this.OUTL !== 'off') {
      this.OL = this.edgeChains().slice(0, Math.max(20, Math.round(this.maxShapes * 0.35)));
      if (this.OUTL === 'last') this.maxShapes = Math.max(this.count + 10, this.maxShapes - this.OL.length);
      if (this.OUTL === 'first') this.burnOutlines(this.OL);
    }

    this.rebuildCum();
  }

  _initImage(imageData) {
    const n = this.W * this.H;
    this.T = new Float32Array(n * 3);
    this.C = new Float32Array(n * 3);
    this.errMap = new Float32Array(n);
    this.cum = new Float64Array(n);
    this.tBuf = new Float32Array(n + 16);
    this.aBuf = new Float32Array(n + 16);
    this.spans = new Int32Array(3 * (this.H + 8) * 32);
    this.xs = new Float32Array(256);

    let br = 0, bg = 0, bb = 0;
    for (let i = 0; i < n; i++) {
      const o = i * 3, q = i * 4;
      this.T[o] = imageData[q];
      this.T[o + 1] = imageData[q + 1];
      this.T[o + 2] = imageData[q + 2];
      br += this.T[o]; bg += this.T[o + 1]; bb += this.T[o + 2];
    }

    let bgc = [br / n, bg / n, bb / n];
    if (this.PAL) {
      bgc = this.PAL.reduce((b, p) => {
        const d = (p[0] - bgc[0]) ** 2 + (p[1] - bgc[1]) ** 2 + (p[2] - bgc[2]) ** 2;
        return d < b[0] ? [d, p] : b;
      }, [Infinity, this.PAL[0]])[1].slice();
    }

    for (let i = 0; i < n; i++) {
      const o = i * 3;
      this.C[o] = bgc[0]; this.C[o + 1] = bgc[1]; this.C[o + 2] = bgc[2];
      this.errMap[i] = Math.abs(this.C[o] - this.T[o]) + Math.abs(this.C[o + 1] - this.T[o + 1]) + Math.abs(this.C[o + 2] - this.T[o + 2]);
    }
  }

  // ── RNG ───────────────────────────────────────────────────────────────────

  rnd() {
    this._seed ^= this._seed << 13; this._seed >>>= 0;
    this._seed ^= this._seed >>> 17;
    this._seed ^= this._seed << 5; this._seed >>>= 0;
    return this._seed / 4294967296;
  }

  gauss() {
    let u = 0, v = 0;
    while (!u) u = this.rnd();
    while (!v) v = this.rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v);
  }

  // ── Image analysis (smart mode) ───────────────────────────────────────────

  boxBlur(src, r) {
    const W = this.W, H = this.H;
    const out = new Float32Array(W * H), tmp = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      let s = 0; const row = y * W;
      for (let x = -r; x <= r; x++) s += src[row + Math.min(W - 1, Math.max(0, x))];
      for (let x = 0; x < W; x++) { tmp[row + x] = s / (2 * r + 1); s += src[row + Math.min(W - 1, x + r + 1)] - src[row + Math.max(0, x - r)]; }
    }
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let y = -r; y <= r; y++) s += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
      for (let y = 0; y < H; y++) { out[y * W + x] = s / (2 * r + 1); s += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x]; }
    }
    return out;
  }

  blur2(a, r) { return this.boxBlur(this.boxBlur(a, r), r); }

  pctl(a, q) {
    const s = Float32Array.from(a).sort();
    return s[Math.min(s.length - 1, Math.floor(q * s.length))] || 1e-6;
  }

  analyse() {
    const W = this.W, H = this.H, n = W * H;
    const L = new Float32Array(n), Y = new Float32Array(n), Cb = new Float32Array(n), Cr = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = this.T[i * 3], g = this.T[i * 3 + 1], b = this.T[i * 3 + 2];
      Y[i] = 0.299 * r + 0.587 * g + 0.114 * b; L[i] = Y[i] / 255;
      Cb[i] = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      Cr[i] = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    }
    // structure tensor
    const jxx = new Float32Array(n), jxy = new Float32Array(n), jyy = new Float32Array(n);
    const at = (x, y) => L[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
      const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
      const i = y * W + x; jxx[i] = gx * gx; jxy[i] = gx * gy; jyy[i] = gy * gy;
    }
    const r = Math.max(2, Math.round(Math.max(W, H) / 110));
    const a = this.blur2(jxx, r), b = this.blur2(jxy, r), c = this.blur2(jyy, r);
    this.Tan = new Float32Array(n); this.Coh = new Float32Array(n); this.Edge = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const d = a[i] - c[i], tr = Math.max(0, a[i] + c[i]);
      this.Tan[i] = 0.5 * Math.atan2(2 * b[i], d) + Math.PI / 2;
      this.Coh[i] = tr > 1e-6 ? Math.sqrt(d * d + 4 * b[i] * b[i]) / tr : 0;
      this.Edge[i] = Math.sqrt(tr);
    }
    const e98 = this.pctl(this.Edge, 0.98);
    for (let i = 0; i < n; i++) this.Edge[i] = Math.min(1, this.Edge[i] / e98);
    // focus map
    const R = Math.max(4, Math.round(Math.max(W, H) / 30));
    const bY = this.blur2(Y, R), bCb = this.blur2(Cb, R), bCr = this.blur2(Cr, R);
    const con = new Float32Array(n), skin = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      con[i] = Math.abs(Y[i] - bY[i]) + 0.6 * (Math.abs(Cb[i] - bCb[i]) + Math.abs(Cr[i] - bCr[i]));
      skin[i] = Y[i] > 45 ? Math.exp(-(((Cb[i] - 102) / 16) ** 2) - (((Cr[i] - 153) / 14) ** 2)) : 0;
    }
    const conB = this.blur2(con, 3), skinB = this.blur2(skin, 3), edgeB = this.blur2(this.Edge, 3);
    const c98 = this.pctl(conB, 0.98);
    this.Wt = new Float32Array(n); this.Sal = new Float32Array(n);
    let sum = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, dx = (x / W - 0.5) * 2, dy = (y / H - 0.5) * 2;
      const sal = Math.min(1, 0.45 * Math.min(1, conB[i] / c98) + 0.35 * edgeB[i] + 0.6 * skinB[i]) * (1 - 0.2 * (dx * dx + dy * dy));
      this.Wt[i] = Number.isFinite(sal) ? 0.45 + 1.8 * sal : 1; sum += this.Wt[i]; this.Sal[i] = Number.isFinite(sal) ? sal : 0;
    }
    if (sum > 0) for (let i = 0; i < n; i++) this.Wt[i] *= n / sum;
    this.subject();
  }

  subject() {
    const W = this.W, H = this.H, n = W * H;
    const m = Math.max(2, Math.round(Math.min(W, H) * 0.04)), bs = [];
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (x < m || y < m || x >= W - m || y >= H - m) { const o = (y * W + x) * 3; bs.push([this.T[o], this.T[o + 1], this.T[o + 2]]); }
    const K = Math.min(5, bs.length), C = [];
    for (let k = 0; k < K; k++) C.push(bs[Math.floor((k + 0.5) / K * bs.length)].slice());
    for (let it = 0; it < 8; it++) {
      const acc = C.map(() => [0, 0, 0, 0]);
      for (const b of bs) { let bk = 0, bd = 1e18; for (let k = 0; k < K; k++) { const d = (b[0] - C[k][0]) ** 2 + (b[1] - C[k][1]) ** 2 + (b[2] - C[k][2]) ** 2; if (d < bd) { bd = d; bk = k; } } const a = acc[bk]; a[0] += b[0]; a[1] += b[1]; a[2] += b[2]; a[3]++; }
      acc.forEach((a, k) => { if (a[3]) C[k] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; });
    }
    const sc = new Float32Array(n), sig = 2 * 32 * 32;
    for (let i = 0; i < n; i++) {
      const o = i * 3; let dm = 1e18;
      for (let k = 0; k < K; k++) { const d = (this.T[o] - C[k][0]) ** 2 + (this.T[o + 1] - C[k][1]) ** 2 + (this.T[o + 2] - C[k][2]) ** 2; if (d < dm) dm = d; }
      const x = i % W, y = (i / W) | 0, dx = (x / W - 0.5) * 2, dy = (y / H - 0.5) * 2;
      sc[i] = 0.6 * this.Sal[i] + 0.8 * (1 - Math.exp(-dm / sig)) + 0.3 * (1 - Math.min(1, (dx * dx + dy * dy) / 1.6));
    }
    const sb = this.blur2(sc, Math.max(2, Math.round(Math.max(W, H) / 55)));
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i < n; i++) { if (sb[i] < lo) lo = sb[i]; if (sb[i] > hi) hi = sb[i]; }
    const B = 64, hist = new Float64Array(B), span = Math.max(1e-6, hi - lo);
    for (let i = 0; i < n; i++) hist[Math.min(B - 1, Math.floor((sb[i] - lo) / span * B))]++;
    let tot = 0; for (let b = 0; b < B; b++) tot += b * hist[b];
    let w0 = 0, s0 = 0, best = -1, thb = B / 2;
    for (let b = 0; b < B; b++) { w0 += hist[b]; if (!w0 || w0 === n) continue; s0 += b * hist[b]; const m0 = s0 / w0, m1 = (tot - s0) / (n - w0), v = w0 * (n - w0) * (m0 - m1) ** 2; if (v > best) { best = v; thb = b + 1; } }
    const thr = Math.min(this.pctl(sb, 0.88), Math.max(this.pctl(sb, 0.35), lo + thb / B * span)), soft = 0.06 * span;
    this.Sub = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = Math.max(0, Math.min(1, (sb[i] - thr) / soft + 0.5)); this.Sub[i] = t * t * (3 - 2 * t); }
    const seen = new Uint8Array(n), q = new Int32Array(n); let head = 0, tail = 0;
    const push = i => { if (!seen[i] && this.Sub[i] < 0.5) { seen[i] = 1; q[tail++] = i; } };
    for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
    while (head < tail) { const i = q[head++], x = i % W; if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (i >= W) push(i - W); if (i < n - W) push(i + W); }
    for (let i = 0; i < n; i++) if (this.Sub[i] < 0.5 && !seen[i]) this.Sub[i] = 1;
  }

  // ── Flow tracing ──────────────────────────────────────────────────────────

  pix(x, y) { return Math.min(this.H - 1, Math.max(0, y | 0)) * this.W + Math.min(this.W - 1, Math.max(0, x | 0)); }

  trace(x, y, sgn, len) {
    const i0 = this.pix(x, y);
    let dx = Math.cos(this.Tan[i0]) * sgn, dy = Math.sin(this.Tan[i0]) * sgn, d = 0;
    const st = Math.max(1, len / 24);
    while (d < len) {
      const j = this.pix(x, y);
      if (this.Coh[j] > 0.08) { let tx = Math.cos(this.Tan[j]), ty = Math.sin(this.Tan[j]); if (tx * dx + ty * dy < 0) { tx = -tx; ty = -ty; } dx = tx; dy = ty; }
      x += dx * st; y += dy * st; d += st;
    }
    return [x, y];
  }

  // ── Rasterization ─────────────────────────────────────────────────────────

  raster(pts) {
    const W = this.W, H = this.H;
    const n = pts.length >> 1; let y0 = 1e9, y1 = -1e9, ns = 0;
    for (let i = 1; i < pts.length; i += 2) { if (pts[i] < y0) y0 = pts[i]; if (pts[i] > y1) y1 = pts[i]; }
    y0 = Math.max(0, Math.ceil(y0 - 0.5)); y1 = Math.min(H - 1, Math.floor(y1 - 0.5));
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5; let k = 0;
      for (let i = 0; i < n; i++) {
        const ax = pts[i * 2], ay = pts[i * 2 + 1], j = (i + 1) % n, bx = pts[j * 2], by = pts[j * 2 + 1];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) { if (k < 256) this.xs[k++] = ax + (yc - ay) * (bx - ax) / (by - ay); }
      }
      for (let a = 1; a < k; a++) { const v = this.xs[a]; let b = a - 1; while (b >= 0 && this.xs[b] > v) { this.xs[b + 1] = this.xs[b]; b--; } this.xs[b + 1] = v; }
      for (let j = 0; j + 1 < k; j += 2) {
        const xa = Math.max(0, Math.ceil(this.xs[j] - 0.5)), xb = Math.min(W - 1, Math.floor(this.xs[j + 1] - 0.5));
        if (xb >= xa && ns < this.spans.length / 3) { this.spans[ns * 3] = y; this.spans[ns * 3 + 1] = xa; this.spans[ns * 3 + 2] = xb; ns++; }
      }
    }
    return ns;
  }

  field(s, ns) {
    const W = this.W;
    const a = s.a; let j = 0;
    if (s.t === 'B') {
      const [ex, ey, rx, ry, r, f] = s.p, c = Math.cos(r), n = Math.sin(r);
      for (let i = 0; i < ns; i++) {
        const py = this.spans[i * 3] + 0.5;
        for (let x = this.spans[i * 3 + 1]; x <= this.spans[i * 3 + 2]; x++, j++) {
          const dx = x + 0.5 - ex, dy = py - ey, u = (dx * c + dy * n) / rx, v = (-dx * n + dy * c) / ry, k = Math.sqrt(u * u + v * v);
          this.tBuf[j] = k < 1 ? k : 1; this.aBuf[j] = k >= 1 ? 0 : a * Math.min(1, (1 - k) / f);
        }
      }
    } else {
      const [gx, gy, m, M] = SHPaxis(s), inv = 1 / Math.max(1e-6, M - m);
      for (let i = 0; i < ns; i++) {
        const py = this.spans[i * 3] + 0.5;
        for (let x = this.spans[i * 3 + 1]; x <= this.spans[i * 3 + 2]; x++, j++) {
          const t = s.fl ? 0 : ((x + 0.5) * gx + py * gy - m) * inv;
          this.tBuf[j] = t < 0 ? 0 : t > 1 ? 1 : t; this.aBuf[j] = a;
        }
      }
    }
    return j;
  }

  // ── Color solving ─────────────────────────────────────────────────────────

  evaluate(s) {
    const W = this.W;
    const ns = this.raster(SHPpoly(s)); if (!ns) return Infinity;
    const np = this.field(s, ns); if (np < 2) return Infinity;
    let A00 = 0, A01 = 0, A11 = 0, n = 0;
    const b0 = [0, 0, 0], b1 = [0, 0, 0], wmap = this.smart ? this.Wt : null;
    let j = 0;
    for (let i = 0; i < ns; i++) {
      const row = this.spans[i * 3] * W;
      for (let x = this.spans[i * 3 + 1]; x <= this.spans[i * 3 + 2]; x++, j++) {
        const ai = this.aBuf[j]; if (ai <= 0) continue;
        const wp = wmap ? wmap[row + x] : 1, t = this.tBuf[j], u = 1 - t, w = ai * ai * wp, ia = 1 - ai, o = (row + x) * 3;
        A00 += w * u * u; A01 += w * u * t; A11 += w * t * t; n++;
        for (let ch = 0; ch < 3; ch++) { const e = (this.T[o + ch] - this.C[o + ch] * ia) * ai * wp; b0[ch] += u * e; b1[ch] += t * e; }
      }
    }
    if (n < 2) return Infinity;
    const lam = 0.02 * (A00 + A11) + 1e-6, a00 = A00 + lam, a01 = A01 - lam, a11 = A11 + lam, det = a00 * a11 - a01 * a01;
    let c0 = [0, 0, 0], c1 = [0, 0, 0];
    if (this.PAL) {
      let best = Infinity, bi = 0, bj = 0;
      for (let i = 0; i < this.PAL.length; i++) for (let k = 0; k < this.PAL.length; k++) {
        if (s.fl && k !== i) continue;
        const P = this.PAL[i], Q = this.PAL[k]; let q = 0;
        for (let ch = 0; ch < 3; ch++) q += P[ch] * P[ch] * A00 + 2 * P[ch] * Q[ch] * A01 + Q[ch] * Q[ch] * A11 - 2 * P[ch] * b0[ch] - 2 * Q[ch] * b1[ch];
        if (q < best) { best = q; bi = i; bj = k; }
      }
      c0 = this.PAL[bi].slice(); c1 = this.PAL[bj].slice();
    } else for (let ch = 0; ch < 3; ch++) { c0[ch] = cl255((b0[ch] * a11 - b1[ch] * a01) / det); c1[ch] = cl255((a00 * b1[ch] - a01 * b0[ch]) / det); }
    if (s.st === 'charcoal' && !this.PAL) for (const c of [c0, c1]) { const g = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; for (let ch = 0; ch < 3; ch++) c[ch] = g + (c[ch] - g) * 0.12; }
    let d = 0; j = 0;
    for (let i = 0; i < ns; i++) {
      const row = this.spans[i * 3] * W;
      for (let x = this.spans[i * 3 + 1]; x <= this.spans[i * 3 + 2]; x++, j++) {
        const ai = this.aBuf[j]; if (ai <= 0) continue;
        const t = this.tBuf[j], ia = 1 - ai, o = (row + x) * 3, wp = wmap ? wmap[row + x] : 1;
        for (let ch = 0; ch < 3; ch++) {
          const tv = this.T[o + ch], cv = this.C[o + ch], nv = cv * ia + (c0[ch] + (c1[ch] - c0[ch]) * t) * ai - tv;
          d += (nv * nv - (cv - tv) * (cv - tv)) * wp;
        }
      }
    }
    s.c0 = c0; s.c1 = c1;
    return d;
  }

  commit(s) {
    const W = this.W;
    const ns = this.raster(SHPpoly(s)); this.field(s, ns);
    let j = 0;
    for (let i = 0; i < ns; i++) {
      const row = this.spans[i * 3] * W;
      for (let x = this.spans[i * 3 + 1]; x <= this.spans[i * 3 + 2]; x++, j++) {
        const ai = this.aBuf[j]; if (ai <= 0) continue;
        const t = this.tBuf[j], ia = 1 - ai, o = (row + x) * 3;
        let e = 0;
        for (let ch = 0; ch < 3; ch++) { this.C[o + ch] = this.C[o + ch] * ia + (s.c0[ch] + (s.c1[ch] - s.c0[ch]) * t) * ai; e += Math.abs(this.C[o + ch] - this.T[o + ch]); }
        this.errMap[row + x] = e;
      }
    }
  }

  // ── Sampling ──────────────────────────────────────────────────────────────

  rebuildCum() {
    const W = this.W, H = this.H, n = W * H;
    let t = 0, s = 0, te = 0;
    const b0 = this.band ? this.band[0] * W : 0, b1 = this.band ? this.band[1] * W : n;
    const ok = this.ORD ? this.ORD.key : null, lo = this.ORD ? this.passNo / this.ORD.K - 1e-6 : 0, hi = this.ORD ? (this.passNo >= this.ORD.K - 1 ? 2 : (this.passNo + 1) / this.ORD.K) : 2;
    for (let i = 0; i < n; i++) {
      const e = this.errMap[i] * this.errMap[i] + 1, w = (this.smart ? e * this.Wt[i] : e) * (i >= b0 && i < b1 ? 1 : 0) * (ok ? (ok[i] >= lo && ok[i] < hi ? 1 : 0) : 1);
      t += w; this.cum[i] = t; s += this.errMap[i];
      if (this.smart) { te += w * (0.15 + 3 * this.Edge[i] * this.Edge[i]); this.cumE[i] = te; }
    }
    this.cumTotal = t; this.cumETotal = te; this.sim = 100 * (1 - s / (3 * n) / 255);
  }

  samplePos(edges) {
    const W = this.W, H = this.H;
    if (this.abstract && !this.ORD && this.rnd() < 0.3) return [this.rnd() * W, this.band ? this.band[0] + this.rnd() * (this.band[1] - this.band[0]) : this.rnd() * H];
    const useEdges = edges && this.cumE;
    const tab = useEdges ? this.cumE : this.cum, r = this.rnd() * (useEdges ? this.cumETotal : this.cumTotal);
    let lo = 0, hi = W * H - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (tab[m] < r) lo = m + 1; else hi = m; }
    return [lo % W + this.rnd(), (lo / W | 0) + this.rnd()];
  }

  // ── Shape generation ──────────────────────────────────────────────────────

  pickType(st) {
    if ((st === 'hatch' || st === 'calligraphy' || st === 'string') && this.stepProg > 0.12) return 'S';
    if (this.LINES && !this.SHAPE_ID.has(st) && (this.stepProg > 0.04 || this.rnd() < 0.6)) return 'S';
    const m = this.MIX[st] || this.MIX.painterly; let r = this.rnd();
    for (const [t, w] of m) { if ((r -= w) <= 0) return t; }
    return m[0][0];
  }

  longer(p, k) { const cx = (p[0] + p[4]) / 2, cy = (p[1] + p[5]) / 2; for (const i of [0, 2, 4]) { p[i] = cx + (p[i] - cx) * k; p[i + 1] = cy + (p[i + 1] - cy) * k; } }

  styled(s, st) {
    const p = s.p;
    if (st === 'points' && s.t === 'E') { p[2] = p[3] = Math.max(1, Math.min(p[2], p[3])); s.a = 0.92; }
    else if (st === 'hatch' && s.t === 'S') { const cx = (p[0] + p[4]) / 2, cy = (p[1] + p[5]) / 2, len = Math.max(Math.hypot(p[4] - p[0], p[5] - p[1]) * 0.6, Math.max(this.W, this.H) * 0.03), ang = (this.rnd() < 0.5 ? 0.785 : 2.356) + this.gauss() * 0.08; p[0] = cx - Math.cos(ang) * len; p[1] = cy - Math.sin(ang) * len; p[4] = cx + Math.cos(ang) * len; p[5] = cy + Math.sin(ang) * len; p[2] = cx; p[3] = cy; p[6] = lerp(0.6, 1.5, this.rnd()); s.a = 0.9; }
    else if (st === 'calligraphy' && s.t === 'S') { p[6] = Math.max(1, p[6] * lerp(0.35, 1.4, this.rnd())); s.a = 0.95; }
    else if (st === 'watercolour') { if (s.t === 'S') { s.a = 0.62; p[6] = Math.max(2, p[6] * lerp(1.1, 1.6, this.rnd())); this.longer(p, 1.2); } else { s.a = lerp(0.45, 0.7, this.rnd()); if (s.t === 'B') p[5] = 0.15; } }
    else if (st === 'oil' || st === 'acrylic' || st === 'gouache') { s.a = 1; if (s.t === 'S') { p[6] = Math.max(3, p[6] * lerp(1.0, st === 'oil' ? 1.7 : 1.5, this.rnd())); this.longer(p, lerp(1.1, 1.4, this.rnd())); } else if (s.t === 'B') p[5] = 0.12; }
    else if (st === 'knife') { s.a = 1; if (s.t === 'S') { p[6] = Math.max(4, p[6] * lerp(1.1, 1.5, this.rnd())); p[2] = (p[0] + p[4]) / 2 + (p[2] - (p[0] + p[4]) / 2) * 0.3; p[3] = (p[1] + p[5]) / 2 + (p[3] - (p[1] + p[5]) / 2) * 0.3; this.longer(p, 0.95); } else if (s.t === 'B') p[5] = 0.12; }
    else if (st === 'sumi') { s.a = 0.95; if (s.t === 'S') p[6] = Math.max(1.5, p[6] * lerp(0.8, 1.6, this.rnd())); else if (s.t === 'B') p[5] = lerp(0.3, 0.6, this.rnd()); }
    else if (st === 'marker') { s.a = 0.7; if (s.t === 'S') { p[6] = Math.max(2, Math.min(10, p[6] * 0.6)); this.longer(p, 1.2); } }
    else if (st === 'confetti') s.a = 0.95;
    else if (st === 'graffiti') { if (s.t === 'S') { p[6] = Math.max(1.5, p[6] * lerp(1.1, 1.7, this.rnd())); s.a = 0.92; } else if (s.t === 'B') { s.a = 0.85; p[5] = lerp(0.7, 1, this.rnd()); } }
    else if (st === 'mosaic' || st === 'glitch') s.a = 1;
    else if (st === 'glass') { s.a = 1; if (s.t === 'B') p[5] = 0.12; }
    else if (st === 'linocut' || st === 'riso') { s.a = 1; if (s.t === 'B') p[5] = 0.12; else if (s.t === 'S') p[6] = Math.max(3, p[6] * lerp(1, 1.5, this.rnd())); }
    else if (st === 'tape') { s.a = 0.95; if (s.t === 'S') { p[6] = Math.max(4, Math.min(46, p[6] * lerp(0.8, 1.2, this.rnd()))); p[2] = (p[0] + p[4]) / 2 + (p[2] - (p[0] + p[4]) / 2) * 0.25; p[3] = (p[1] + p[5]) / 2 + (p[3] - (p[1] + p[5]) / 2) * 0.25; } }
    else if (st === 'scribble' || st === 'paper' || st === 'stitch' || st === 'halftone') { s.a = 1; if (s.t === 'B') p[5] = 0.12; }
    else if (st === 'bokeh') { s.a = lerp(0.45, 0.75, this.rnd()); p[2] = p[3] = (p[2] + p[3]) / 2; }
    else if (st === 'pencil') { s.a = 0.85; if (s.t === 'S') { p[6] = Math.max(1, Math.min(4, p[6] * lerp(0.25, 0.5, this.rnd()))); this.longer(p, 1.5); } else if (s.t === 'B') p[5] = 0.12; }
    else if (st === 'pastel') { s.a = 0.92; if (s.t === 'S') p[6] = Math.max(2, p[6] * lerp(1.1, 1.5, this.rnd())); else if (s.t === 'B') p[5] = 0.2; }
    else if (st === 'pen') { s.a = 1; if (s.t === 'B') p[5] = 0.12; }
    else if (st === 'ink') { s.a = 0.95; if (s.t === 'S') p[6] = Math.max(1.5, p[6] * lerp(0.7, 1.5, this.rnd())); else if (s.t === 'B') p[5] = lerp(0.3, 0.6, this.rnd()); }
    else if (st === 'hylics') { s.a = 1; if (s.t === 'S') p[6] = Math.max(3, p[6] * lerp(1.1, 1.7, this.rnd())); else if (s.t === 'B') p[5] = 0.12; }
    else if (st === 'lens' || st === 'crystal' || st === 'frost') { s.a = 0.9; if (s.t === 'B') p[5] = 0.12; }
    else if (this.RELIEF_ST.includes(st)) { s.a = 1; if (s.t === 'S') { p[6] = Math.max(3, p[6] * lerp(0.9, 1.4, this.rnd())); this.longer(p, lerp(1.2, 1.6, this.rnd())); } else if (s.t === 'B') p[5] = 0.12; }
    else if (st === 'neon') { s.a = 1; if (s.t === 'S') p[6] = Math.max(1.5, Math.min(8, p[6] * lerp(0.4, 0.8, this.rnd()))); }
    else if (st === 'embroid') { s.a = 1; if (s.t === 'S') p[6] = Math.max(4, p[6] * lerp(1.2, 1.9, this.rnd())); else if (s.t === 'B') p[5] = 0.12; }
    else if (st === 'thread') { s.a = 1; if (s.t === 'S') p[6] = Math.max(3, p[6] * lerp(0.9, 1.6, this.rnd())); }
    else if (st === 'wet') { s.a = lerp(0.5, 0.78, this.rnd()); if (s.t === 'B') p[5] = 0.15; else if (s.t === 'S') p[6] = Math.max(2, p[6] * lerp(1.1, 1.8, this.rnd())); }
    else if (st === 'wash') { s.a = lerp(0.45, 0.7, this.rnd()); if (s.t === 'B') p[5] = 0.15; }
    else if (st === 'charcoal') { s.a = 0.9; if (s.t === 'S') { p[6] = Math.max(2, p[6] * lerp(0.55, 0.9, this.rnd())); this.longer(p, 1.7); } else if (s.t === 'B') p[5] = 0.3; }
    else if (st === 'string' && s.t === 'S') { const cx = (p[0] + p[4]) / 2, cy = (p[1] + p[5]) / 2, ang = Math.atan2(p[5] - p[1], p[4] - p[0]), half = Math.max(Math.hypot(p[4] - p[0], p[5] - p[1]) * 0.9, Math.max(this.W, this.H) * lerp(0.06, 0.2, this.rnd())); p[0] = cx - Math.cos(ang) * half; p[1] = cy - Math.sin(ang) * half; p[4] = cx + Math.cos(ang) * half; p[5] = cy + Math.sin(ang) * half; p[6] = lerp(0.9, 1.5, this.rnd()); s.a = 0.8; }
    if (st === 'glitch' && s.t === 'R') { const w = Math.max(p[2], p[3]); p[2] = w * lerp(1.8, 4.5, this.rnd()); p[3] = Math.max(1, Math.min(p[2], p[3], w) * lerp(0.1, 0.35, this.rnd())); }
    return this.constrain(s);
  }

  constrain(s) {
    const p = s.p, st = s.st, L = Math.max(this.W, this.H);
    if (st === 'mosaic' && s.t === 'R') { const k = Math.max(3, Math.min(8, Math.round(Math.log2(L / Math.max(1, p[2], p[3]))))), cell = Math.max(2, L / 2 ** k); p[2] = p[3] = cell; p[4] = 0; p[0] = (Math.floor(p[0] / cell) + 0.5) * cell; p[1] = (Math.floor(p[1] / cell) + 0.5) * cell; }
    else if (st === 'string' && s.t === 'S') { const dx = p[4] - p[0], dy = p[5] - p[1], d = Math.hypot(dx, dy) || 1, min = L * 0.1; if (d < min) { const cx = (p[0] + p[4]) / 2, cy = (p[1] + p[5]) / 2, k = min / d / 2; p[0] = cx - dx * k; p[1] = cy - dy * k; p[4] = cx + dx * k; p[5] = cy + dy * k; } p[2] = (p[0] + p[4]) / 2; p[3] = (p[1] + p[5]) / 2; p[6] = Math.max(0.9, Math.min(1.6, p[6])); }
    else if (st === 'glitch' && s.t === 'R') { p[4] = 0; p[5] = Math.cos(p[5]) >= 0 ? 0 : Math.PI; p[3] = Math.max(1, Math.min(p[3], p[2] * 0.35)); }
    else if (st === 'bokeh' && s.t === 'E') p[3] = p[2];
    return s;
  }

  plainShape(smin, smax, t, pos) {
    const [x, y] = pos || this.samplePos(), s = lerp(smin, smax, this.rnd()), r = this.rnd() * Math.PI, g = this.rnd() * Math.PI * 2;
    if (t === 'E') return { t, a: 0.8, p: [x, y, s * lerp(0.25, 1, this.rnd()), s * lerp(0.25, 1, this.rnd()), r, g] };
    if (t === 'B') return { t, a: 0.9, p: [x, y, s * lerp(0.35, 1.2, this.rnd()), s * lerp(0.35, 1.2, this.rnd()), r, lerp(0.25, 0.9, this.rnd())] };
    if (t === 'R') return { t, a: 0.8, p: [x, y, s * lerp(0.3, 1.6, this.rnd()), s * lerp(0.2, 1, this.rnd()), r, g] };
    if (t === 'T') { const p = [x, y, x, y, x, y, g]; for (let i = 0; i < 6; i++) p[i] += (this.rnd() - 0.5) * 2 * s; return { t, a: 0.8, p }; }
    const dx = Math.cos(r) * s, dy = Math.sin(r) * s, bend = (this.rnd() - 0.5) * s;
    return { t, a: 0.8, p: [x - dx, y - dy, x - dy / s * bend, y + dx / s * bend, x + dx, y + dy, Math.max(1, s * lerp(0.08, 0.35, this.rnd())), Math.atan2(dy, dx) + (this.rnd() < 0.5 ? 0 : Math.PI / 2)] };
  }

  guidedShape(smin, smax, prog, t, st, pos) {
    const edges = pos ? pos.edges : prog > 0.55 && this.rnd() < 0.5;
    const [x, y] = pos || this.samplePos(edges), i = this.pix(x, y), coh = this.Coh[i];
    const s = lerp(smin, smax, this.rnd());
    const guided = this.rnd() < 0.3 + 0.65 * coh;
    const along = guided ? this.Tan[i] + this.gauss() * 0.12 : this.rnd() * Math.PI;
    const across = guided ? along + Math.PI / 2 : this.rnd() * Math.PI * 2;
    const long = guided ? lerp(0.55, 1.15, this.rnd()) : lerp(0.25, 1, this.rnd()), thin = guided ? lerp(0.18, 0.6, this.rnd()) : lerp(0.25, 1, this.rnd());
    if (t === 'E') return { t, a: 0.8, p: [x, y, s * long, s * thin, along, across] };
    if (t === 'B') return { t, a: 0.9, p: [x, y, s * lerp(0.4, 1.2, this.rnd()) * (guided ? 1.2 : 1), s * lerp(0.4, 1.2, this.rnd()) * (guided ? 0.6 : 1), along, lerp(0.25, 0.9, this.rnd())] };
    if (t === 'R') return { t, a: 0.8, p: [x, y, s * lerp(0.6, 1.6, this.rnd()), s * lerp(0.15, 0.6, this.rnd()), along, across] };
    if (t === 'T') { const p = [x, y, x, y, x, y, across]; for (let k = 0; k < 6; k++) p[k] += (this.rnd() - 0.5) * 2 * s; return { t, a: 0.8, p }; }
    const w = Math.max(1, s * (edges ? lerp(0.05, 0.16, this.rnd()) : lerp(0.08, 0.32, this.rnd())));
    if (guided) { const reach = st === 'calligraphy' ? s * 1.8 : s; const [x0, y0] = this.trace(x, y, -1, reach), [x2, y2] = this.trace(x, y, 1, reach); return { t, a: 0.8, p: [x0, y0, 2 * x - (x0 + x2) / 2, 2 * y - (y0 + y2) / 2, x2, y2, w, across] }; }
    const dx = Math.cos(along) * s, dy = Math.sin(along) * s, bend = (this.rnd() - 0.5) * s;
    return { t, a: 0.8, p: [x - dx, y - dy, x - dy / s * bend, y + dx / s * bend, x + dx, y + dy, w, across] };
  }

  randomShape(smin, smax, prog) {
    let st = this.stepStyle, pos = null;
    if (this.stepBg && this.Sub) { const edges = this.smart && prog > 0.55 && this.rnd() < 0.5; pos = this.samplePos(edges); pos.edges = edges; if (this.Sub[this.pix(pos[0], pos[1])] < 0.5) st = this.stepBg; }
    if (this.SMALL[st] && prog > 0.06) { const cap = Math.max(this.W, this.H) * this.SMALL[st]; if (smax > cap) { smin *= cap / smax; smax = cap; } }
    if (this.abstract) { const k = lerp(0.7, 1.9, this.rnd()); smin *= k; smax *= k; }
    const t = this.pickType(st), s = this.smart && !(this.abstract && this.rnd() < 0.5) ? this.guidedShape(smin, smax, prog, t, st, pos) : this.plainShape(smin, smax, t, pos);
    s.st = st; s.fl = this.FLAT.has(st);
    return this.styled(s, st);
  }

  // ── Mutation ───────────────────────────────────────────────────────────────

  extentOf(s) {
    const p = s.p;
    if (s.t === 'T') return Math.max(Math.hypot(p[2] - p[0], p[3] - p[1]), Math.hypot(p[4] - p[2], p[5] - p[3]), Math.hypot(p[0] - p[4], p[1] - p[5])) / 2;
    if (s.t === 'S') return Math.max(Math.hypot(p[4] - p[0], p[5] - p[1]) / 2, p[6]);
    return Math.max(p[2], p[3]);
  }

  mutate(s, smax) {
    const p = s.p.slice(), j = smax * 0.12, i = Math.floor(this.rnd() * p.length), k = this.KIND[s.t][i];
    if (k === 'p') p[i] += this.gauss() * j;
    else if (k === 's') p[i] = Math.max(1, p[i] * Math.exp(this.gauss() * 0.2));
    else if (k === 'a') p[i] += this.gauss() * 0.35;
    else if (k === 'f') p[i] = Math.max(0.12, Math.min(1, p[i] + this.gauss() * 0.12));
    return this.constrain({ t: s.t, a: s.a, p, st: s.st, fl: s.fl });
  }

  // ── Order modes ───────────────────────────────────────────────────────────

  orderSetup(kind, c0) {
    this.ORD = null;
    const KINDS = ['down', 'up', 'right', 'left', 'diag', 'spiral', 'spiralin', 'rings', 'ringsin', 'clock'];
    if (!KINDS.includes(kind)) return;
    const W = this.W, H = this.H, n = W * H;
    const key = new Float32Array(n), L = Math.max(W, H), cx = W / 2, cy = H / 2, short = Math.min(W, H), TURNS = 3;
    const spiral = kind === 'spiral' || kind === 'spiralin', rings = kind === 'rings' || kind === 'ringsin', clock = kind === 'clock';
    const K = Math.max(2, Math.min(spiral ? 30 : rings ? 10 : clock ? 16 : 12, Math.round(this.maxShapes / 20)));
    let thick = L / K;
    if (kind === 'down' || kind === 'up') thick = H / K; else if (kind === 'left' || kind === 'right') thick = W / K;
    else if (kind === 'diag') thick = (W + H) / (2 * K);
    else if (spiral) thick = short / (2 * TURNS); else if (rings) thick = short / (2 * K); else if (clock) thick = Math.sqrt(W * H / K);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, u = (x + 0.5 - cx) / cx, v = (y + 0.5 - cy) / cy; let k;
      if (kind === 'down') k = (y + 0.5) / H; else if (kind === 'up') k = 1 - (y + 0.5) / H;
      else if (kind === 'right') k = (x + 0.5) / W; else if (kind === 'left') k = 1 - (x + 0.5) / W;
      else if (kind === 'diag') k = ((x + 0.5) / W + (y + 0.5) / H) / 2;
      else { const r = Math.pow(Math.pow(Math.abs(u), 4) + Math.pow(Math.abs(v), 4), 0.25) / 1.1892; const phi = ((Math.atan2(u, -v) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI); if (clock) k = phi; else if (rings) k = Math.min(1, r); else { const lap = Math.round(Math.min(1, r) * TURNS - phi); k = Math.min(1, Math.max(0, (lap + phi) / TURNS)); } }
      key[i] = Math.min(0.9999, Math.max(0, kind === 'spiralin' || kind === 'ringsin' ? 1 - k : k));
    }
    this.ORD = { key, K, thick };
    this.passNo = Math.min(K - 1, Math.floor((c0 || 0) * K / Math.max(1, this.maxShapes))); this.passStart = c0 || 0; this.passFails = 0;
    this.passLen = Math.max(1, (this.maxShapes - this.passStart) / (K - this.passNo));
  }

  advancePass() { this.passNo++; this.passStart = this.count; this.passFails = 0; this.passLen = Math.max(1, (this.maxShapes - this.count) / (this.ORD.K - this.passNo)); this.rebuildCum(); }

  // ── Edge outlines ─────────────────────────────────────────────────────────

  edgeChains() {
    const W = this.W, H = this.H, n = W * H;
    const L = new Float32Array(n);
    for (let i = 0; i < n; i++) L[i] = 0.299 * this.T[i * 3] + 0.587 * this.T[i * 3 + 1] + 0.114 * this.T[i * 3 + 2];
    const B = this.blur2(L, Math.max(1, Math.round(Math.max(W, H) / 400))), M = new Float32Array(n), D = new Uint8Array(n);
    const at = (x, y) => B[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
      const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
      const i = y * W + x, a = Math.atan2(gy, gx); M[i] = Math.hypot(gx, gy);
      D[i] = Math.round(((a < 0 ? a + Math.PI : a) / Math.PI) * 4) % 4;
    }
    const NB = [[1, 0], [1, 1], [0, 1], [-1, 1]], K = new Float32Array(n);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x, [dx, dy] = NB[D[i]], m = M[i]; if (m >= M[i + dy * W + dx] && m >= M[i - dy * W - dx]) K[i] = m; }
    const hi = Math.max(60, this.pctl(K.filter(v => v > 0), 0.8)), lo = hi * 0.45, E = new Uint8Array(n), st = [];
    for (let i = 0; i < n; i++) if (K[i] >= hi && !E[i]) { E[i] = 1; st.push(i); while (st.length) { const j = st.pop(), x = j % W, y = (j / W) | 0; for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) { const xx = x + u, yy = y + v; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const k = yy * W + xx; if (!E[k] && K[k] >= lo) { E[k] = 1; st.push(k); } } } }
    const nbs = j => { const x = j % W, y = (j / W) | 0, o = []; for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) { if (!u && !v) continue; const xx = x + u, yy = y + v; if (xx >= 0 && yy >= 0 && xx < W && yy < H && E[yy * W + xx] === 1) o.push(yy * W + xx); } return o; };
    const chains = [], minLen = Math.max(6, Math.round(Math.max(W, H) * 0.012));
    const walk = s0 => { const c = [s0]; E[s0] = 2; let j = s0; for (;;) { const o = nbs(j); if (!o.length) break; j = o[0]; E[j] = 2; c.push(j); } return c; };
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) if (E[i] === 1 && (pass || nbs(i).length === 1)) { const c = walk(i); if (c.length >= minLen) chains.push(c); }
    const out = [], seg = Math.max(8, Math.round(Math.max(W, H) * 0.05)), w = Math.max(1, Math.max(W, H) * 0.0028);
    for (const c of chains) { const k = Math.max(1, Math.round(c.length / seg)); for (let s = 0; s < k; s++) { const a = Math.floor(s * c.length / k), b = Math.min(c.length - 1, Math.floor((s + 1) * c.length / k)), m = (a + b) >> 1; if (b - a < 3) continue; const P = j => [c[j] % W + 0.5, ((c[j] / W) | 0) + 0.5], [x0, y0] = P(a), [x1, y1] = P(m), [x2, y2] = P(b); const nx = -(y2 - y0), ny = x2 - x0, nl = Math.hypot(nx, ny) || 1, off = 2.5; const side = sg => { const x = Math.round(x1 + nx / nl * off * sg), y = Math.round(x1 + ny / nl * off * sg), i = Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x)); return [this.T[i * 3], this.T[i * 3 + 1], this.T[i * 3 + 2]]; }; const A = side(1), Bc = side(-1), dk = (A[0] + A[1] + A[2]) < (Bc[0] + Bc[1] + Bc[2]) ? A : Bc, col = dk.map(v => v * 0.45); out.push({ t: 'S', a: 0.95, p: [x0, y0, 2 * x1 - (x0 + x2) / 2, 2 * y1 - (y0 + y2) / 2, x2, y2, w, Math.atan2(y2 - y0, x2 - x0)], col, len: b - a }); } }
    out.sort((p, q) => q.len - p.len);
    return out;
  }

  outlineShape(o, st) { const s = { t: 'S', p: o.p.slice(), a: o.a, st, fl: true }; if (this.RELIEF_ST.includes(st)) s.p[6] = Math.max(2.5, s.p[6] * 1.6); this.evaluate(s); s.c0 = o.col.slice(); s.c1 = o.col.slice(); return s; }

  emitOutline(o, tag) { let st = this.styles[Math.floor(this.rnd() * this.styles.length)] || 'painterly'; if (this.SHAPE_ID.has(st) || this.NO_STROKE.has(st)) st = 'flat'; const s = this.outlineShape(o, st); this.commit(s); this.count++; this._emitShape(s); }

  burnOutlines(list) { for (const o of list) { const s = { t: 'S', p: o.p, a: 1 }, ns = this.raster(SHPpoly(s)); if (!ns) continue; this.field(s, ns); let j = 0; for (let i = 0; i < ns; i++) { const row = this.spans[i * 3] * this.W; for (let x = this.spans[i * 3 + 1]; x <= this.spans[i * 3 + 2]; x++, j++) { const ai = this.aBuf[j]; if (ai <= 0) continue; const q = (row + x) * 3; for (let ch = 0; ch < 3; ch++) this.T[q + ch] = this.T[q + ch] * (1 - ai) + o.col[ch] * ai; } } } }

  // ── Region fill ───────────────────────────────────────────────────────────

  regionAt(sx, sy) { const g = Math.max(2, Math.round(Math.max(this.W, this.H) / 150)), gw = Math.ceil(this.W / g), gh = Math.ceil(this.H / g), mask = new Uint8Array(gw * gh); const at = (gx, gy) => (Math.min(this.H - 1, gy * g) * this.W + Math.min(this.W - 1, gx * g)) * 3; const s0 = at(Math.floor(sx / g), Math.floor(sy / g)), r0 = this.T[s0], g0 = this.T[s0 + 1], b0 = this.T[s0 + 2], tol = 34; const st = [Math.floor(sy / g) * gw + Math.floor(sx / g)]; mask[st[0]] = 1; let n = 0, mr = 0, mg = 0, mb = 0, err = 0, x0 = gw, y0 = gh, x1 = 0, y1 = 0; while (st.length) { const c = st.pop(), cx = c % gw, cy = (c - cx) / gw, o = at(cx, cy); n++; mr += this.T[o]; mg += this.T[o + 1]; mb += this.T[o + 2]; err += this.errMap[o / 3]; if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy; if (n > gw * gh * 0.35) return null; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue; const j = ny * gw + nx; if (mask[j]) continue; const q = at(nx, ny); if (Math.abs(this.T[q] - r0) + Math.abs(this.T[q + 1] - g0) + Math.abs(this.T[q + 2] - b0) > tol * 3) continue; mask[j] = 1; st.push(j); } } return { mask, gw, gh, g, n, col: [mr / n, mg / n, mb / n], err: err / n, box: [x0, y0, x1, y1] }; }

  regionContour(Rg) { const { mask, gw, gh, g } = Rg, inside = (x, y) => x >= 0 && y >= 0 && x < gw && y < gh && mask[y * gw + x] === 1; let sx = -1, sy = -1; for (let i = 0; i < mask.length && sx < 0; i++) if (mask[i]) { sx = i % gw; sy = (i - sx) / gw; } const N8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]], out = []; let x = sx, y = sy, d = 7; for (let k = 0; k < gw * gh * 2; k++) { out.push([(x + 0.5) * g, (y + 0.5) * g]); let found = false; for (let j = 0; j < 8; j++) { const dd = (d + 6 + j) % 8, nx = x + N8[dd][0], ny = y + N8[dd][1]; if (inside(nx, ny)) { x = nx; y = ny; d = dd; found = true; break; } } if (!found || (x === sx && y === sy && out.length > 2)) break; } return out; }

  regionStroke(p0, p1, p2, w, col, a, st, tag) { const s = { t: 'S', p: [p0[0], p0[1], p1[0], p1[1], p2[0], p2[1], w, Math.atan2(p2[1] - p0[1], p2[0] - p0[0])], a, st, fl: true }; this.evaluate(s); s.c0 = col.slice(); s.c1 = col.map(v => Math.max(0, Math.min(255, v * (0.94 + this.rnd() * 0.12)))); this.commit(s); this.count++; this._emitShape(s); }

  regionMove(prog, tag) { let Rg = null; for (let k = 0; k < 6 && !Rg; k++) { const [x, y] = this.samplePos(false), r = this.regionAt(x, y); if (r && r.n * r.g * r.g > this.W * this.H * 0.01 && r.err > 40) Rg = r; } if (!Rg) return false; let st = this.styles[Math.floor(this.rnd() * this.styles.length)] || 'painterly'; if (this.SHAPE_ID.has(st) || this.NO_STROKE.has(st)) st = 'flat'; const L = Math.max(this.W, this.H), area = Rg.n * Rg.g * Rg.g, kk = this.sizeK * (this.SSZ[st] || 1), col = Rg.col; if (this.RFILL !== 'scribble') { const P = this.regionContour(Rg); if (P.length < 8) return false; const seg = Math.max(3, Math.round(P.length / Math.min(36, Math.max(6, P.length / 6)))), lw = Math.max(1.2, L * 0.004 * kk), dark = col.map(v => v * 0.55); for (let i = 0; i + seg <= P.length; i += seg) { const a = P[i], b = P[Math.min(P.length - 1, i + seg)], m = P[Math.min(P.length - 1, i + (seg >> 1))]; this.regionStroke(a, [2 * m[0] - (a[0] + b[0]) / 2, 2 * m[1] - (a[1] + b[1]) / 2], b, lw, dark, 1, st, tag); } const a = P[P.length - 1 - ((P.length - 1) % seg)], b = P[0]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 1) this.regionStroke(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b, lw, dark, 1, st, tag); } const fw0 = Math.max(2, Math.min(L * 0.035, Math.sqrt(area) / 9) * kk), { mask, gw, gh, g } = Rg; const inside = (x, y) => { const gx = Math.floor(x / g), gy = Math.floor(y / g); return gx >= 0 && gy >= 0 && gx < gw && gy < gh && mask[gy * gw + gx] === 1; }; const [bx0, by0, bx1, by1] = Rg.box, cx = (bx0 + bx1 + 1) / 2 * g, cy = (by0 + by1 + 1) / 2 * g, half = Math.hypot(bx1 - bx0 + 1, by1 - by0 + 1) * g / 2; const tone = () => col.map(v => v * (0.93 + this.rnd() * 0.14)), wid = () => fw0 * (0.7 + this.rnd() * 0.6); const curve = (A, E, amt) => { const mx = (A[0] + E[0]) / 2, my = (A[1] + E[1]) / 2, dx = E[0] - A[0], dy = E[1] - A[1], l = Math.hypot(dx, dy) || 1, b = (this.rnd() - 0.5) * amt; return [mx - dy / l * b, my + dx / l * b]; }; let made = 0; if (this.RFILL !== 'rows' && this.rnd() < 0.55) { const cov = new Uint8Array(gw * gh); let need = 0; for (let i = 0; i < mask.length; i++) if (mask[i]) need++; const r = Math.max(1, Math.round(fw0 * 0.6 / g)), mark = (x, y) => { const gx = Math.floor(x / g), gy = Math.floor(y / g); let n = 0; for (let v = -r; v <= r; v++) for (let u = -r; u <= r; u++) { const X2 = gx + u, Y2 = gy + v; if (X2 >= 0 && Y2 >= 0 && X2 < gw && Y2 < gh) { const j = Y2 * gw + X2; if (mask[j] && !cov[j]) { cov[j] = 1; n++; } } } return n; }; let p = null; for (let k = 0; k < 40 && !p; k++) { const x = (bx0 + this.rnd() * (bx1 - bx0 + 1)) * g, y = (by0 + this.rnd() * (by1 - by0 + 1)) * g; if (inside(x, y)) p = [x, y]; } if (p) { let th = this.rnd() * 6.283, turn = (this.rnd() < 0.5 ? 1 : -1) * (0.25 + this.rnd() * 0.35), got = mark(p[0], p[1]), aim = null, pts = [p]; const stepL = fw0 * (0.9 + this.rnd() * 0.5); for (let k = 0; k < 600 && got < need * 0.82 && pts.length < 220; k++) { if (k % 7 === 0) { aim = null; let bd = Infinity; for (let t = 0; t < 24; t++) { const j = Math.floor(this.rnd() * mask.length); if (!mask[j] || cov[j]) continue; const ax = (j % gw + 0.5) * g, ay = (Math.floor(j / gw) + 0.5) * g, d = Math.hypot(ax - p[0], ay - p[1]); if (d < bd) { bd = d; aim = [ax, ay]; } } } if (this.rnd() < 0.15) turn = -turn; if (this.rnd() < 0.1) turn = Math.sign(turn) * (0.1 + this.rnd() * 0.7); th += turn + (this.rnd() - 0.5) * 0.9; if (aim) { const want = Math.atan2(aim[1] - p[1], aim[0] - p[0]); let d = want - th; d = Math.atan2(Math.sin(d), Math.cos(d)); th += d * 0.18; } let q = [p[0] + Math.cos(th) * stepL, p[1] + Math.sin(th) * stepL]; for (let t = 0; t < 8 && !inside(q[0], q[1]); t++) { th += Math.PI * (0.45 + this.rnd() * 0.5); q = [p[0] + Math.cos(th) * stepL, p[1] + Math.sin(th) * stepL]; } if (!inside(q[0], q[1])) break; got += mark(q[0], q[1]); pts.push(q); p = q; } for (let k = 0; k + 2 < pts.length; k += 2) { this.regionStroke(pts[k], pts[k + 1], pts[k + 2], wid(), tone(), 0.9, st, tag); made++; } } } if (!made) { let an = this.rnd() * Math.PI; const pass = (an, from, to, rowsOnly) => { const rows = []; let v = -half + (from * 2 * half); while (v <= -half + to * 2 * half) { const a2 = an + (this.rnd() - 0.5) * 0.25, dx = Math.cos(a2), dy = Math.sin(a2), nx = -dy, ny = dx; let f = null, l = null; for (let u = -half; u <= half; u += g * 0.7) { const x = cx + nx * v + dx * u, y = cy + ny * v + dy * u; if (inside(x, y)) { if (!f) f = [x, y]; l = [x, y]; } } if (f && Math.hypot(l[0] - f[0], l[1] - f[1]) > fw0 * 0.5 && this.rnd() > 0.08) { const sh = s2 => { const t = s2 > 0 ? 0.88 + this.rnd() * 0.22 : 0.85 + this.rnd() * 0.2, mx = (f[0] + l[0]) / 2, my = (f[1] + l[1]) / 2, P = s2 > 0 ? l : f; return [mx + (P[0] - mx) * t, my + (P[1] - my) * t]; }; rows.push([sh(-1), sh(1)]); } v += fw0 * (this.RFILL === 'rows' ? 0.6 + this.rnd() * 0.5 : 0.7 + this.rnd() * 0.9); an += (this.rnd() - 0.5) * 0.08; } for (let k = 0; k < rows.length && made < 80; k++) { const [f, l] = rows[k], back = k % 2, A = back ? l : f, nxt = rows[k + 1]; const E = rowsOnly || !nxt ? (back ? f : l) : (back ? nxt[0] : nxt[1]); this.regionStroke(A, curve(A, E, fw0 * 2.2), E, wid(), tone(), 0.92, st, tag); made++; } }; pass(an, 0, 1, this.RFILL === 'rows'); if (this.rnd() < 0.4) { const a = this.rnd() * 0.6; pass(an + 0.6 + this.rnd() * 0.9, a, a + 0.25 + this.rnd() * 0.3, this.RFILL === 'rows'); } } return true; }

  // ── Abstract ──────────────────────────────────────────────────────────────

  shiftColours(s) { const th = this.gauss() * 0.4, c = Math.cos(th), n = Math.sin(th), k = 1 / Math.sqrt(3), sat = lerp(1.05, 1.35, this.rnd()); for (const col of [s.c0, s.c1]) { const m = (col[0] + col[1] + col[2]) / 3, r = col[0] - m, g = col[1] - m, b = col[2] - m; const cr = k * (g - b), cg = k * (b - r), cb = k * (r - g); col[0] = cl255(m + (r * c + cr * n) * sat); col[1] = cl255(m + (g * c + cg * n) * sat); col[2] = cl255(m + (b * c + cb * n) * sat); } }

  // ── Main step ─────────────────────────────────────────────────────────────

  step(prog = this.count / this.maxShapes, tag) {
    const L = Math.max(this.W, this.H);
    if (this.RFILL !== 'off' && !this.PEN && !this.ACC && prog > 0.06 && prog < 0.8 && this.count >= this.rfNext) { this.rfNext = this.count + Math.max(12, Math.round((this.endless ? 60 : this.maxShapes) / 25)); if (this.regionMove(prog, tag)) return true; }
    if (this.ORD) { if (this.passNo < this.ORD.K - 1 && (this.count - this.passStart >= this.passLen || this.passFails > 120 || this.cumTotal <= 0)) this.advancePass(); prog = Math.min(1, (this.count - this.passStart) / this.passLen); }
    if (this.PEN) return this.penStep(prog, tag);
    this.stepProg = prog; this.stepStyle = this.styles[Math.floor(this.rnd() * this.styles.length)] || 'painterly';
    this.stepBg = this.bgStyles.length ? this.bgStyles[Math.floor(this.rnd() * this.bgStyles.length)] : null;
    const kk = (this.sizeRand ? Math.pow(2, this.rnd() * 5.32 - 3.32) : this.sizeK) * (this.SSZ[this.stepStyle] || 1);
    let smax = Math.min(L * 0.9, L * lerp(0.45, 0.012, Math.pow(prog, 0.5)) * kk);
    if (this.under) smax = Math.min(smax, L * (this.endless ? 0.05 : 0.1) * Math.max(1, kk));
    if (this.ORD) smax = Math.min(smax, Math.max(this.ORD.thick, L * 0.02));
    const smin = smax * 0.3;
    if (this.count % 8 === 0) this.rebuildCum();
    let best = null, bd = Infinity;
    const nc = Math.round((prog < 0.15 ? 80 : 40) / this.HURRY);
    for (let i = 0; i < nc; i++) { const s = this.randomShape(smin, smax, prog), d = this.evaluate(s); if (d < bd) { bd = d; best = s; } }
    if (!best) { this.passFails++; return false; }
    let fails = 0;
    const keep = kk !== 1 || this.under, lo = smin * 0.4, hi = smax * 1.6;
    for (let i = 0, mi = 180 / this.HURRY, mf = 50 / this.HURRY; i < mi && fails < mf; i++) { const s = this.mutate(best, smax); if (keep) { const x = this.extentOf(s); if (x > hi || x < lo) { fails++; continue; } } const d = this.evaluate(s); if (d < bd) { bd = d; best = s; fails = 0; } else fails++; }
    if (!best || bd >= 0) { this.passFails++; return false; }
    this.evaluate(best);
    if (this.abstract && !this.PAL) this.shiftColours(best);
    this.commit(best); this.count++; this.passFails = 0;
    this._emitShape(best);
    return true;
  }

  // ── One-line mode ─────────────────────────────────────────────────────────

  penStep(prog, tag) { if (!this.PENS.length || !this.penPos) { this.PEN_ID = 0; return this.penStep1(prog, tag); } const k = this.penTurn++ % (this.PENS.length + 1); if (!k) { this.PEN_ID = 0; return this.penStep1(prog, tag); } const P = this.PENS[k - 1], keep = this.penPos; this.penPos = P.pos; this.PEN_ID = P.id; const ok = this.penStep1(prog, tag); P.pos = this.penPos; this.penPos = keep; this.PEN_ID = 0; if ((ok && --P.life <= 0) || !P.pos) this.PENS.splice(this.PENS.indexOf(P), 1); return ok; }

  penStep1(prog, tag) { const L = Math.max(this.W, this.H); this.stepProg = prog; this.stepStyle = this.styles[Math.floor(this.rnd() * this.styles.length)] || 'painterly'; if (this.NO_STROKE.has(this.stepStyle)) this.stepStyle = 'flat'; const kk = (this.sizeRand ? Math.pow(2, this.rnd() * 5.32 - 3.32) : this.sizeK) * (this.SSZ[this.stepStyle] || 1); let smax = Math.min(L * 0.9, L * lerp(0.45, 0.012, Math.pow(prog, 0.5)) * kk); if (this.under) smax = Math.min(smax, L * 0.1 * Math.max(1, kk)); if (this.ORD) smax = Math.min(smax, Math.max(this.ORD.thick, L * 0.02)); const smin = smax * 0.3, reach = Math.max(8, smax * 2.4); if (this.count % 8 === 0) this.rebuildCum(); const sx0 = this.penPos ? this.penPos[0] : 0, sy0 = this.penPos ? this.penPos[1] : 0; const spots = []; const lo = this.ORD ? this.passNo / this.ORD.K - 1e-6 : 0, hi = this.ORD ? (this.passNo >= this.ORD.K - 1 ? 2 : (this.passNo + 1) / this.ORD.K) : 2; const inWin = (x, y) => !this.ORD || (this.ORD.key[this.pix(x, y)] >= lo && this.ORD.key[this.pix(x, y)] < hi); for (let i = 0; i < 28 || (this.ORD && spots.length < 6 && i < 90); i++) { let x, y; if (!this.penPos || (this.ORD && i >= 28)) { [x, y] = this.samplePos(prog > 0.55 && this.rnd() < 0.5); } else { const a = this.rnd() * 6.2832, d = reach * Math.sqrt(this.rnd()) * (0.35 + 0.65 * this.rnd()); x = Math.min(this.W - 1, Math.max(0, sx0 + Math.cos(a) * d)); y = Math.min(this.H - 1, Math.max(0, sy0 + Math.sin(a) * d)); } if (!inWin(x, y)) continue; const k = this.pix(x, y); spots.push([x, y, (this.errMap[k] * this.errMap[k] + 1) * (this.smart ? this.Wt[k] : 1) * (0.4 + this.rnd())]); } if (this.penPos && this.ORD && spots.length > 1) { const near = (s) => Math.hypot(s[0] - sx0, s[1] - sy0); if (spots.every(s => near(s) > reach)) spots.sort((a, b) => near(a) - near(b)); } spots.sort((a, b) => b[2] - a[2]); let best = null, bd = Infinity; for (let i = 0; i < Math.min(10, spots.length); i++) { let sh; if (!this.penPos) { sh = this.guidedShape(smin, smax, prog, 'S', this.stepStyle, null); sh.st = this.stepStyle; sh.fl = this.FLAT.has(this.stepStyle); sh = this.styled(sh, this.stepStyle); } else { const [tx, ty] = spots[i], dx = tx - sx0, dy = ty - sy0, len = Math.hypot(dx, dy) || 1, bend = (this.rnd() - 0.5) * len * 0.8; sh = { t: 'S', a: 0.8, p: [sx0, sy0, (sx0 + tx) / 2 - dy / len * bend, (sy0 + ty) / 2 + dx / len * bend, tx, ty, Math.max(1, lerp(smin, smax, this.rnd()) * lerp(0.1, 0.34, this.rnd())), Math.atan2(dy, dx) + (this.rnd() < 0.5 ? 0 : Math.PI / 2)] }; sh.st = this.stepStyle; sh.fl = this.FLAT.has(this.stepStyle); sh = this.styled(sh, this.stepStyle); sh.p[0] = sx0; sh.p[1] = sy0; } if (sh.t !== 'S') continue; const d = this.evaluate(sh); if (d < bd) { bd = d; best = sh; } } if (!best) { if (++this.passFails > 30) this.penPos = null; return false; } for (let i = 0, fails = 0; i < 50 && fails < 16; i++) { const m = this.mutate(best, smax); if (this.penPos) { m.p[0] = sx0; m.p[1] = sy0; } const d = this.evaluate(m); if (d < bd) { bd = d; best = m; fails = 0; } else fails++; } if (bd >= 0 && this.penPos) { best.p[6] = 1; bd = this.evaluate(best); } if (bd === Infinity) { this.penPos = null; return false; } this.evaluate(best); if (this.abstract && !this.PAL) this.shiftColours(best); this.commit(best); this.count++; this.passFails = 0; this.penPos = [best.p[4], best.p[5]]; this._emitShape(best); return true; }

  // ── Loop ──────────────────────────────────────────────────────────────────

  async start() {
    this._running = true;
    this._stopped = false;
    const t0 = performance.now();
    if (this.OL && this.OUTL === 'first' && this.olI < this.OL.length) { while (this.olI < this.OL.length && performance.now() - t0 < 25) this.emitOutline(this.OL[this.olI++]); if (this.olI < this.OL.length) { setTimeout(() => this.start(), 0); return; } }
    if (!this._loopChecked) { this._loopChecked = true; let e = 0; for (let i = 0; i < this.errMap.length; i += 7) e += this.errMap[i]; if (e / (this.errMap.length / 7) < 6) this.stuck = 3001; }
    if (this.UNTIL != null && this.count >= this.UNTIL && this.count < this.maxShapes) { setTimeout(() => this.start(), 8); return; }
    while (this._running && this.count < this.maxShapes && (this.UNTIL == null || this.count < this.UNTIL) && performance.now() - t0 < 25) { if (this.step()) this.stuck = 0; else if (++this.stuck > 3000) break; }
    if ((this.count >= this.maxShapes || this.stuck > 3000) && this.OL && this.OUTL === 'last' && this.olI < this.OL.length) { while (this.olI < this.OL.length && performance.now() - t0 < 40) this.emitOutline(this.OL[this.olI++]); if (this.olI < this.OL.length) { setTimeout(() => this.start(), 0); return; } }
    if (this.count >= this.maxShapes || this.stuck > 3000) { this._running = false; this.rebuildCum(); if (this.onDone) this.onDone({ count: this.count, sim: this.sim }); return; }
    setTimeout(() => this.start(), 0);
  }

  stop() { this._running = false; this._stopped = true; }

  _emitShape(s) {
    this._shapes.push({ ...s, c0: s.c0.slice(), c1: s.c1.slice(), p: s.p.slice() });
    if (this.onShape) this.onShape({ ...s, c0: s.c0.slice(), c1: s.c1.slice(), p: s.p.slice() });
    if (this.onProgress) this.onProgress(this.count / this.maxShapes);
  }

  getShapes() { return this._shapes; }
  getProgress() { return this.count / this.maxShapes; }
  getSimilarity() { return this.sim; }

  // ── Static tables ─────────────────────────────────────────────────────────

  static get RELIEF_ST() { return ['oil', 'acrylic', 'knife', 'plast', 'ceramic', 'stone', 'metal', 'foam', 'molten', 'pewter', 'terrazzo', 'copper', 'gold', 'bronze', 'beads', 'puffy']; }
  static get SHAPE_ID() { return new Set(['mosaic', 'glitch', 'bubbles', 'bokeh', 'points', 'confetti', 'stitch', 'glass', 'paper', 'geometric', 'crystal']); }
  static get NO_STROKE() { return new Set(['mosaic', 'glitch']); }
  static get FLAT() { return new Set(['linocut', 'riso', 'tape', 'flat', 'points', 'confetti', 'hatch', 'graffiti', 'mosaic', 'scribble', 'string', 'bokeh', 'paper', 'stitch', 'pencil', 'pastel', 'pen', 'ink', 'wash', 'charcoal', 'thread', 'hylics', 'lens', 'crystal', 'frost', 'neon', 'sumi', 'marker', ...Painter.RELIEF_ST.filter(t => !['oil', 'acrylic', 'knife'].includes(t))]); }
  static get KIND() { return { E: 'ppssaa', B: 'ppssaf', T: 'ppppppa', R: 'ppssaa', S: 'pppppsa' }; }
  static get SMALL() { return { points: 0.028, confetti: 0.04 }; }
  static get MIX() { return { painterly: [['S', 0.45], ['B', 0.25], ['E', 0.15], ['T', 0.15]], soft: [['B', 0.75], ['S', 0.25]], mixed: [['E', 0.2], ['B', 0.2], ['T', 0.2], ['R', 0.15], ['S', 0.25]], geometric: [['T', 0.55], ['R', 0.45]], bubbles: [['B', 0.55], ['E', 0.45]], flat: [['S', 0.6], ['E', 0.25], ['T', 0.15]], points: [['E', 1]], hatch: [['S', 0.88], ['B', 0.12]], calligraphy: [['S', 0.85], ['B', 0.15]], watercolour: [['S', 0.6], ['B', 0.3], ['E', 0.1]], oil: [['S', 0.85], ['B', 0.15]], acrylic: [['S', 0.85], ['B', 0.15]], knife: [['S', 0.8], ['B', 0.2]], gouache: [['S', 0.8], ['B', 0.2]], sumi: [['S', 0.8], ['B', 0.2]], marker: [['S', 0.9], ['R', 0.1]], confetti: [['R', 0.7], ['T', 0.3]], graffiti: [['S', 0.82], ['B', 0.18]], mosaic: [['R', 1]], glass: [['T', 0.55], ['E', 0.25], ['R', 0.2]], linocut: [['B', 0.35], ['E', 0.25], ['T', 0.2], ['S', 0.2]], riso: [['B', 0.35], ['E', 0.25], ['R', 0.15], ['S', 0.25]], tape: [['S', 0.8], ['R', 0.2]], scribble: [['B', 0.45], ['E', 0.35], ['T', 0.2]], halftone: [['E', 0.35], ['B', 0.25], ['R', 0.2], ['T', 0.2]], string: [['S', 0.85], ['B', 0.15]], glitch: [['R', 1]], bokeh: [['E', 1]], paper: [['T', 0.35], ['R', 0.3], ['E', 0.2], ['B', 0.15]], stitch: [['B', 0.5], ['E', 0.25], ['R', 0.25]], pencil: [['S', 1]], pastel: [['S', 0.6], ['B', 0.25], ['E', 0.15]], pen: [['B', 0.35], ['E', 0.3], ['T', 0.2], ['S', 0.15]], ink: [['S', 0.75], ['B', 0.25]], wash: [['B', 0.55], ['E', 0.3], ['T', 0.15]], wet: [['B', 0.5], ['E', 0.28], ['S', 0.12], ['T', 0.1]], thread: [['S', 0.62], ['E', 0.16], ['R', 0.12], ['T', 0.1]], hylics: [['S', 0.4], ['B', 0.25], ['E', 0.15], ['T', 0.1], ['R', 0.1]], lens: [['E', 0.45], ['B', 0.25], ['S', 0.2], ['T', 0.1]], crystal: [['T', 0.45], ['R', 0.25], ['E', 0.2], ['S', 0.1]], frost: [['B', 0.4], ['E', 0.3], ['R', 0.2], ['S', 0.1]], neon: [['S', 0.7], ['E', 0.2], ['R', 0.1]], embroid: [['S', 0.55], ['E', 0.2], ['B', 0.15], ['T', 0.1]], plast: [['S', 0.82], ['B', 0.18]], ceramic: [['S', 0.82], ['B', 0.18]], stone: [['S', 0.82], ['B', 0.18]], metal: [['S', 0.82], ['B', 0.18]], foam: [['S', 0.82], ['B', 0.18]], molten: [['S', 0.82], ['B', 0.18]], pewter: [['S', 0.82], ['B', 0.18]], terrazzo: [['S', 0.82], ['B', 0.18]], copper: [['S', 0.82], ['B', 0.18]], gold: [['S', 0.82], ['B', 0.18]], bronze: [['S', 0.82], ['B', 0.18]], beads: [['S', 0.82], ['B', 0.18]], puffy: [['S', 0.82], ['B', 0.18]], charcoal: [['S', 1]] }; }
}

export default Painter;
