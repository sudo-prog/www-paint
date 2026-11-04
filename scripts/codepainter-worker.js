'use strict';
// ─────────────────────────────────────────────────────────────
//  Shape vocabulary of the auto-painter, shared by the worker (scoring)
//  and the page (drawing + code). Every shape carries a 2-colour gradient
//  s = { t, p, c0:[r,g,b], c1:[r,g,b], a }:
//    E  ellipse    p = [x, y, rx, ry, rot, g]        linear gradient along angle g
//    B  soft blob  p = [x, y, rx, ry, rot, f]        radial gradient c0 centre -> c1 rim, edge feathered over f
//    T  triangle   p = [x1, y1, x2, y2, x3, y3, g]
//    R  bar        p = [x, y, w, h, rot, g]          (centre, size, angle)
//    S  stroke     p = [x0, y0, x1, y1, x2, y2, w, g] quadratic brush, round caps
//  Coordinates are in work pixels; k scales them to the output.
//  RUNTIME is the tiny drawing library the generated code calls; the page
//  draws with the same source, so the exported file matches exactly.
// ─────────────────────────────────────────────────────────────
const SHP = (() => {
  const TAU = Math.PI * 2;
  function poly(s) {
    const p = s.p, out = [];
    if (s.t === 'E' || s.t === 'B') {
      const [x, y, rx, ry, r] = p, c = Math.cos(r), n = Math.sin(r), m = Math.max(12, Math.min(40, Math.round((rx + ry) * 0.7)));
      for (let i = 0; i < m; i++) { const a = i / m * TAU, u = Math.cos(a) * rx, v = Math.sin(a) * ry; out.push(x + u * c - v * n, y + u * n + v * c); }
    } else if (s.t === 'T') out.push(...p.slice(0, 6));
    else if (s.t === 'R') out.push(...corners(p));
    else if (s.t === 'S') {
      const [x0, y0, x1, y1, x2, y2, w] = p, hw = w / 2, N = 10, L = [], R = [];
      const pt = t => { const u = 1 - t; return [u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2]; };
      const tan = t => { const dx = 2 * (1 - t) * (x1 - x0) + 2 * t * (x2 - x1), dy = 2 * (1 - t) * (y1 - y0) + 2 * t * (y2 - y1), d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; };
      for (let i = 0; i <= N; i++) { const t = i / N, [px, py] = pt(t), [tx, ty] = tan(t); L.push([px - ty * hw, py + tx * hw]); R.push([px + ty * hw, py - tx * hw]); }
      // half-circle caps, swept from one side of the ribbon to the other around the tip
      const cap = (cx, cy, base) => { const o = []; for (let i = 1; i < 6; i++) { const a = base - i / 6 * Math.PI; o.push([cx + Math.cos(a) * hw, cy + Math.sin(a) * hw]); } return o; };
      const [ex, ey] = pt(1), [sx, sy] = pt(0), [ex_, ey_] = tan(1), [sx_, sy_] = tan(0);
      for (const q of L) out.push(...q);
      for (const q of cap(ex, ey, Math.atan2(ex_, -ey_))) out.push(...q);
      for (let i = R.length - 1; i >= 0; i--) out.push(...R[i]);
      for (const q of cap(sx, sy, Math.atan2(-sx_, sy_))) out.push(...q);
    }
    return out;
  }
  function corners(p) {
    const [x, y, w, h, r] = p, c = Math.cos(r), n = Math.sin(r), o = [];
    for (const [u, v] of [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]) o.push(x + u * c - v * n, y + u * n + v * c);
    return o;
  }
  // gradient axis of a linear-gradient shape: [dirX, dirY, from, to] (projection extents; same maths as the runtime)
  function axis(s) {
    const p = s.p, g = s.t === 'T' ? p[6] : s.t === 'S' ? p[7] : p[5], dx = Math.cos(g), dy = Math.sin(g);
    if (s.t === 'E') { const d = p[0] * dx + p[1] * dy, h = Math.hypot(p[2] * Math.cos(g - p[4]), p[3] * Math.sin(g - p[4])); return [dx, dy, d - h, d + h]; }
    const pts = s.t === 'T' ? p.slice(0, 6) : s.t === 'R' ? corners(p) : p.slice(0, 6), pad = s.t === 'S' ? p[6] / 2 : 0;
    let m = 1e9, n = -1e9;
    for (let i = 0; i < pts.length; i += 2) { const d = pts[i] * dx + pts[i + 1] * dy; if (d < m) m = d; if (d > n) n = d; }
    return [dx, dy, m - pad, n + pad];
  }
  const hex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const r2 = v => Math.round(v * 100) / 100;
  const q = v => `'${v}'`;
  // the call's arguments in output coordinates (rounded exactly as written in the code)
  function args(s, k) {
    const p = s.p, K = v => Math.round(v * k), a = r2(s.a), c0 = hex(s.c0), c1 = hex(s.c1);
    if (s.t === 'E') return [K(p[0]), K(p[1]), K(p[2]), K(p[3]), r2(p[4]), r2(p[5]), c0, c1, a];
    if (s.t === 'B') return [K(p[0]), K(p[1]), K(p[2]), K(p[3]), r2(p[4]), r2(p[5]), c0, c1, a];
    if (s.t === 'T') return [...p.slice(0, 6).map(K), r2(p[6]), c0, c1, a];
    if (s.t === 'R') return [K(p[0]), K(p[1]), K(p[2]), K(p[3]), r2(p[4]), r2(p[5]), c0, c1, a];
    return [...p.slice(0, 6).map(K), Math.max(1, K(p[6])), r2(p[7]), c0, c1, a];
  }
  const fmt = v => typeof v === 'string' ? q(v) : String(v).replace(/^(-?)0\./, '$1.');
  const code = (s, k) => `${s.t}(${args(s, k).map(fmt).join(',')})`;

  const RUNTIME = `function hx(h){const n=parseInt(h.slice(1),16);return[n>>16&255,n>>8&255,n&255]}
function ca(v,o){return'rgba('+v.map(Math.round).join(',')+','+o+')'}
function lg(g,m,n,h0,h1){const x=Math.cos(g),y=Math.sin(g),q=c.createLinearGradient(x*m,y*m,x*n,y*n);q.addColorStop(0,h0);q.addColorStop(1,h1);return q}
function ex(g,P,d){const x=Math.cos(g),y=Math.sin(g);let m=1e9,n=-1e9;for(let i=0;i<P.length;i+=2){const t=P[i]*x+P[i+1]*y;if(t<m)m=t;if(t>n)n=t}return[m-d,n+d]}
function bg(k){c.globalAlpha=1;c.fillStyle=k;c.fillRect(0,0,1e5,1e5)}
function E(x,y,a,b,r,g,h0,h1,o){const d=x*Math.cos(g)+y*Math.sin(g),h=Math.hypot(a*Math.cos(g-r),b*Math.sin(g-r));c.globalAlpha=o;c.fillStyle=lg(g,d-h,d+h,h0,h1);c.beginPath();c.ellipse(x,y,a,b,r,0,7);c.fill()}
function B(x,y,a,b,r,f,h0,h1,o){const p=hx(h0),q=hx(h1),G=c.createRadialGradient(0,0,0,0,0,1);G.addColorStop(0,ca(p,o));G.addColorStop(1-f,ca(p.map((v,i)=>v+(q[i]-v)*(1-f)),o));G.addColorStop(1,ca(q,0));c.save();c.translate(x,y);c.rotate(r);c.scale(a,b);c.globalAlpha=1;c.fillStyle=G;c.beginPath();c.arc(0,0,1,0,7);c.fill();c.restore()}
function T(a,b,d,e,f,h,g,h0,h1,o){const[m,n]=ex(g,[a,b,d,e,f,h],0);c.globalAlpha=o;c.fillStyle=lg(g,m,n,h0,h1);c.beginPath();c.moveTo(a,b);c.lineTo(d,e);c.lineTo(f,h);c.fill()}
function R(x,y,w,h,r,g,h0,h1,o){const C=Math.cos(r),N=Math.sin(r),P=[];for(const[u,v]of[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]])P.push(x+u*C-v*N,y+u*N+v*C);const[m,n]=ex(g,P,0);c.globalAlpha=o;c.fillStyle=lg(g,m,n,h0,h1);c.beginPath();c.moveTo(P[0],P[1]);for(let i=2;i<8;i+=2)c.lineTo(P[i],P[i+1]);c.fill()}
function S(a,b,d,e,f,h,w,g,h0,h1,o){const[m,n]=ex(g,[a,b,d,e,f,h],w/2);c.globalAlpha=o;c.strokeStyle=lg(g,m,n,h0,h1);c.lineWidth=w;c.lineCap='round';c.beginPath();c.moveTo(a,b);c.quadraticCurveTo(d,e,f,h);c.stroke()}`;
  // bind the runtime to a 2D context (cached per context)
  const bound = new WeakMap();
  function lib(ctx) {
    if (!bound.has(ctx)) bound.set(ctx, new Function('c', RUNTIME + '\nreturn { bg, E, B, T, R, S };')(ctx));
    return bound.get(ctx);
  }
  const draw = (ctx, s, k) => lib(ctx)[s.t](...args(s, k));

  // ── compact export: every field quantised, bit-packed, base64 ──
  //   packed: 1 px grid, 10-bit angles, full 24-bit colour  -> looks identical, ~2.6x smaller than text
  //   tiny:   2 px grid,  6-bit angles, 15-bit colour       -> slightly lossy, ~3.5x smaller
  const MODES = { packed: [12, 1024, 1, 12, 1, 10, 6, 8], tiny: [10, 512, 2, 10, 2, 6, 4, 5] };   // cb co cs sb ss ab fb kb
  const FIELDS = { E: 'ccssaa', B: 'ccssaf', T: 'cccccca', R: 'ccssaa', S: 'ccccccsa' }, TYPE = { E: 0, B: 1, T: 2, R: 3, S: 4 }, A2 = 6.2832;
  const ci = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  // quantise a shape for an export mode: returns the exact arguments the decoder will reproduce, plus the bit codes
  function quant(s, k, mode) {
    if (mode === 'readable') return { t: s.t, args: args(s, k), codes: null, widths: null, bits: 0 };
    const [cb, co, cs, sb, ss, ab, fb, kb] = MODES[mode], f = FIELDS[s.t], p = s.p;
    const codes = [TYPE[s.t]], widths = [3], out = [];
    for (let i = 0; i < f.length; i++) {
      const kind = f[i]; let q, d;
      if (kind === 'c') { q = ci(Math.round((p[i] * k + co) / cs), 0, 2 ** cb - 1); d = q * cs - co; widths.push(cb); }
      else if (kind === 's') { q = ci(Math.round(p[i] * k / ss), 0, 2 ** sb - 1); d = Math.max(1, q * ss); widths.push(sb); }
      else if (kind === 'a') { const n = 2 ** ab; q = ((Math.round(p[i] / A2 * n) % n) + n) % n; d = q * A2 / n; widths.push(ab); }
      else { const n = 2 ** fb - 1; q = ci(Math.round(p[i] * n), 1, n); d = q / n; widths.push(fb); }
      codes.push(q); out.push(d);
    }
    const n = 2 ** kb - 1;
    for (const col of [s.c0, s.c1]) {
      let h = '#';
      for (const ch of col) { const q = ci(Math.round(ch / 255 * n), 0, n); codes.push(q); widths.push(kb); h += Math.round(q * 255 / n).toString(16).padStart(2, '0'); }
      out.push(h);
    }
    out.push(s.t === 'B' ? 0.9 : 0.8);
    return { t: s.t, args: out, codes, widths, bits: widths.reduce((a, b) => a + b, 0) };
  }
  const num = v => Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000).replace(/^(-?)0\./, '$1.');
  const lineOf = q => `${q.t}(${q.args.map(v => typeof v === 'string' ? `'${v}'` : num(v)).join(',')})`;
  function pack(items) {
    let bits = 16; for (const it of items) bits += it.bits;
    const bytes = new Uint8Array(Math.ceil(bits / 8)); let pos = 0;
    const put = (v, w) => { for (let i = w - 1; i >= 0; i--, pos++) if (Math.floor(v / 2 ** i) & 1) bytes[pos >> 3] |= 128 >> (pos & 7); };
    put(items.length, 16);
    for (const it of items) for (let j = 0; j < it.codes.length; j++) put(it.codes[j], it.widths[j]);
    let str = ''; for (let i = 0; i < bytes.length; i += 8192) str += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return btoa(str);
  }
  const packedLen = bits => 4 * Math.ceil(Math.ceil((16 + bits) / 8) / 3);
  // D() decodes the packed string into a list of [drawFunction, args] (paint them all, or play them back one by one)
  const DECODER = `function D(b,M){const s=atob(b),[cb,co,cs,sb,ss,ab,fb,kb]=M,L=[];let p=0,a=0,n=0;
const r=w=>{while(n<w){a=a*256+(s.charCodeAt(p++)||0);n+=8}n-=w;const v=Math.floor(a/2**n);a-=v*2**n;return v},
C=()=>r(cb)*cs-co,Z=()=>Math.max(1,r(sb)*ss),A=()=>r(ab)*6.2832/2**ab,F=()=>Math.max(1,r(fb))/(2**fb-1),
K=()=>{const q=2**kb-1,h=()=>Math.round(r(kb)*255/q).toString(16).padStart(2,'0');return'#'+h()+h()+h()};
for(let i=r(16);i--;){const t=r(3);
if(t==0)L.push([E,[C(),C(),Z(),Z(),A(),A(),K(),K(),.8]]);else if(t==1)L.push([B,[C(),C(),Z(),Z(),A(),F(),K(),K(),.9]]);
else if(t==2)L.push([T,[C(),C(),C(),C(),C(),C(),A(),K(),K(),.8]]);else if(t==3)L.push([R,[C(),C(),Z(),Z(),A(),A(),K(),K(),.8]]);
else L.push([S,[C(),C(),C(),C(),C(),C(),Z(),A(),K(),K(),.8]])}return L}`;

  // ── SVG export (vector: prints sharp at any size). Same gradient maths as the canvas runtime. ──
  function extentsOf(t, a) {
    const g = t === 'T' ? a[6] : t === 'S' ? a[7] : a[5], dx = Math.cos(g), dy = Math.sin(g);
    if (t === 'E') { const d = a[0] * dx + a[1] * dy, h = Math.hypot(a[2] * Math.cos(g - a[4]), a[3] * Math.sin(g - a[4])); return [g, d - h, d + h]; }
    const P = t === 'R' ? corners(a) : a.slice(0, 6), pad = t === 'S' ? a[6] / 2 : 0;
    let m = 1e9, n = -1e9; for (let i = 0; i < P.length; i += 2) { const d = P[i] * dx + P[i + 1] * dy; if (d < m) m = d; if (d > n) n = d; }
    return [g, m - pad, n + pad];
  }
  const f3 = v => String(Math.round(v * 1000) / 1000);
  const deg = r => f3(r * 180 / Math.PI);
  function svg(list, w, h, bg) {
    const defs = [], body = [];
    list.forEach(({ t, args: a }, i) => {
      const id = 'g' + i.toString(36), o = a[a.length - 1], h0 = a[a.length - 3], h1 = a[a.length - 2];
      if (t === 'B') {
        const [x, y, rx, ry, r, f] = a, p0 = [1, 3, 5].map(k => parseInt(h0.substr(k, 2), 16)), p1 = [1, 3, 5].map(k => parseInt(h1.substr(k, 2), 16));
        const mid = hex(p0.map((v, k) => v + (p1[k] - v) * (1 - f)));
        defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1"><stop offset="0" stop-color="${h0}" stop-opacity="${o}"/><stop offset="${f3(1 - f)}" stop-color="${mid}" stop-opacity="${o}"/><stop offset="1" stop-color="${h1}" stop-opacity="0"/></radialGradient>`);
        body.push(`<ellipse rx="1" ry="1" transform="translate(${f3(x)} ${f3(y)}) rotate(${deg(r)}) scale(${f3(rx)} ${f3(ry)})" fill="url(#${id})"/>`);
        return;
      }
      const [g, m, n] = extentsOf(t, a);
      let x1 = Math.cos(g) * m, y1 = Math.sin(g) * m, x2 = Math.cos(g) * n, y2 = Math.sin(g) * n;
      if (t === 'E') {   // the ellipse is drawn in a rotated frame, so express the gradient in that frame
        const [cx, cy, , , r] = a, c = Math.cos(-r), s = Math.sin(-r), rot = (x, y) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
        [x1, y1] = rot(x1, y1); [x2, y2] = rot(x2, y2);
      }
      defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f3(x1)}" y1="${f3(y1)}" x2="${f3(x2)}" y2="${f3(y2)}"><stop offset="0" stop-color="${h0}"/><stop offset="1" stop-color="${h1}"/></linearGradient>`);
      if (t === 'E') body.push(`<ellipse cx="${f3(a[0])}" cy="${f3(a[1])}" rx="${f3(a[2])}" ry="${f3(a[3])}" transform="rotate(${deg(a[4])} ${f3(a[0])} ${f3(a[1])})" fill="url(#${id})" opacity="${o}"/>`);
      else if (t === 'T') body.push(`<polygon points="${a.slice(0, 6).map(f3).join(' ')}" fill="url(#${id})" opacity="${o}"/>`);
      else if (t === 'R') body.push(`<polygon points="${corners(a).map(f3).join(' ')}" fill="url(#${id})" opacity="${o}"/>`);
      else body.push(`<path d="M${f3(a[0])} ${f3(a[1])}Q${f3(a[2])} ${f3(a[3])} ${f3(a[4])} ${f3(a[5])}" fill="none" stroke="url(#${id})" stroke-width="${f3(a[6])}" stroke-linecap="round" opacity="${o}"/>`);
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n<rect width="${w}" height="${h}" fill="${bg}"/>\n<defs>\n${defs.join('\n')}\n</defs>\n${body.join('\n')}\n</svg>\n`;
  }
  return { poly, axis, code, args, draw, lib, hex, RUNTIME, quant, lineOf, pack, packedLen, DECODER, MODES, svg };
})();
if (typeof self !== 'undefined') self.SHP = SHP;

'use strict';
// ─────────────────────────────────────────────────────────────
//  Auto-painter worker: rebuilds a target image one gradient shape at a time.
//  Each step samples candidate shapes where the error is largest; for each
//  candidate both gradient colours are solved exactly (weighted least squares
//  over the pixels it covers, with feathered alpha for soft blobs), the best is
//  hill-climbed, committed and posted to the page, which draws it and writes
//  its line of code. Sizes shrink as it goes: big washes first, fine textured
//  strokes last.
//  Smart mode (image analysis, computed once per painting):
//    flow   structure tensor -> edge direction + coherence per pixel; strokes are
//           grown along the flow like a brush following a contour, other shapes
//           align to it, gradients run across edges
//    focus  saliency from local contrast, edge density, skin tones and a centre
//           bias; errors there count more, so faces / focal points resolve first
//    edges  in the last part, half the strokes go to strong edges, thinner
// ─────────────────────────────────────────────────────────────
// SHP is already defined inline above; no importScripts needed

let W = 0, H = 0, T = null, C = null, running = false, count = 0, maxShapes = 3000, seed = 1;
let errMap = null, cum = null, cumTotal = 0, sim = 0, gen = 0;
let abstract = false, smart = false, Tan = null, Coh = null, Edge = null, Wt = null, cumE = null, cumETotal = 0;
let Sub = null, Sal = null;       // subject mask (0 background … 1 subject), and the saliency it starts from
let spans = new Int32Array(3 * 8192), tBuf = new Float32Array(1), aBuf = new Float32Array(1);
const xs = new Float32Array(256);

const rnd = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v); };
const lerp = (a, b, t) => a + (b - a) * t;

// ── image analysis for smart mode ───────────────────────────
// separable box blur (applied twice ≈ gaussian)
function boxBlur(src, r) {
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
const blur2 = (a, r) => boxBlur(boxBlur(a, r), r);
function pctl(a, q) { const s = Float32Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(q * s.length))] || 1e-6; }
function analyse() {
  const n = W * H, L = new Float32Array(n), Y = new Float32Array(n), Cb = new Float32Array(n), Cr = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = T[i * 3], g = T[i * 3 + 1], b = T[i * 3 + 2];
    Y[i] = 0.299 * r + 0.587 * g + 0.114 * b; L[i] = Y[i] / 255;
    Cb[i] = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b; Cr[i] = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  }
  // structure tensor from Sobel gradients -> edge tangent direction, coherence, edge strength
  const jxx = new Float32Array(n), jxy = new Float32Array(n), jyy = new Float32Array(n);
  const at = (x, y) => L[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
    const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
    const i = y * W + x; jxx[i] = gx * gx; jxy[i] = gx * gy; jyy[i] = gy * gy;
  }
  const r = Math.max(2, Math.round(Math.max(W, H) / 110));
  const a = blur2(jxx, r), b = blur2(jxy, r), c = blur2(jyy, r);
  Tan = new Float32Array(n); Coh = new Float32Array(n); Edge = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    // (running-sum blurs can dip a hair below zero on flat areas; sqrt of that would be NaN and poison the maps)
    const d = a[i] - c[i], tr = Math.max(0, a[i] + c[i]);
    Tan[i] = 0.5 * Math.atan2(2 * b[i], d) + Math.PI / 2;           // along the edge (perpendicular to the gradient)
    Coh[i] = tr > 1e-6 ? Math.sqrt(d * d + 4 * b[i] * b[i]) / tr : 0;
    Edge[i] = Math.sqrt(tr);
  }
  const e98 = pctl(Edge, 0.98); for (let i = 0; i < n; i++) Edge[i] = Math.min(1, Edge[i] / e98);
  // focus map: local colour contrast + edge density + skin tones, with a gentle centre bias
  const R = Math.max(4, Math.round(Math.max(W, H) / 30));
  const bY = blur2(Y, R), bCb = blur2(Cb, R), bCr = blur2(Cr, R), con = new Float32Array(n), skin = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    con[i] = Math.abs(Y[i] - bY[i]) + 0.6 * (Math.abs(Cb[i] - bCb[i]) + Math.abs(Cr[i] - bCr[i]));
    skin[i] = Y[i] > 45 ? Math.exp(-(((Cb[i] - 102) / 16) ** 2) - (((Cr[i] - 153) / 14) ** 2)) : 0;
  }
  const conB = blur2(con, 3), skinB = blur2(skin, 3), edgeB = blur2(Edge, 3), c98 = pctl(conB, 0.98);
  Wt = new Float32Array(n); Sal = new Float32Array(n); let sum = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, dx = (x / W - 0.5) * 2, dy = (y / H - 0.5) * 2;
    const sal = Math.min(1, 0.45 * Math.min(1, conB[i] / c98) + 0.35 * edgeB[i] + 0.6 * skinB[i]) * (1 - 0.2 * (dx * dx + dy * dy));
    Wt[i] = Number.isFinite(sal) ? 0.45 + 1.8 * sal : 1; sum += Wt[i]; Sal[i] = Number.isFinite(sal) ? sal : 0;
  }
  if (sum > 0) for (let i = 0; i < n; i++) Wt[i] *= n / sum;       // mean weight 1
  subject();
}
// subject / background: the focal parts (contrast, edges, skin, a little towards the middle) that don't share the colours
// found round the picture's border are the subject. Smoothed into whole regions, then split where the score naturally
// divides (Otsu), keeping the subject between 12% and 65% of the picture; a soft edge.
function subject() {
  const n = W * H, m = Math.max(2, Math.round(Math.min(W, H) * 0.04)), bs = [];
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (x < m || y < m || x >= W - m || y >= H - m) { const o = (y * W + x) * 3; bs.push([T[o], T[o + 1], T[o + 2]]); }
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
    for (let k = 0; k < K; k++) { const d = (T[o] - C[k][0]) ** 2 + (T[o + 1] - C[k][1]) ** 2 + (T[o + 2] - C[k][2]) ** 2; if (d < dm) dm = d; }
    const x = i % W, y = (i / W) | 0, dx = (x / W - 0.5) * 2, dy = (y / H - 0.5) * 2;
    sc[i] = 0.6 * Sal[i] + 0.8 * (1 - Math.exp(-dm / sig)) + 0.3 * (1 - Math.min(1, (dx * dx + dy * dy) / 1.6));
  }
  const sb = blur2(sc, Math.max(2, Math.round(Math.max(W, H) / 55)));
  let lo = 1e9, hi = -1e9; for (let i = 0; i < n; i++) { if (sb[i] < lo) lo = sb[i]; if (sb[i] > hi) hi = sb[i]; }
  const B = 64, hist = new Float64Array(B), span = Math.max(1e-6, hi - lo);
  for (let i = 0; i < n; i++) hist[Math.min(B - 1, Math.floor((sb[i] - lo) / span * B))]++;
  let tot = 0; for (let b = 0; b < B; b++) tot += b * hist[b];
  let w0 = 0, s0 = 0, best = -1, thb = B / 2;
  for (let b = 0; b < B; b++) { w0 += hist[b]; if (!w0 || w0 === n) continue; s0 += b * hist[b]; const m0 = s0 / w0, m1 = (tot - s0) / (n - w0), v = w0 * (n - w0) * (m0 - m1) ** 2; if (v > best) { best = v; thb = b + 1; } }
  const thr = Math.min(pctl(sb, 0.88), Math.max(pctl(sb, 0.35), lo + thb / B * span)), soft = 0.06 * span;
  Sub = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = Math.max(0, Math.min(1, (sb[i] - thr) / soft + 0.5)); Sub[i] = t * t * (3 - 2 * t); }
  // the background reaches the picture's edge: a "background" patch enclosed by the subject (a dark eye, a shadow
  // inside the face) is part of the subject
  const seen = new Uint8Array(n), q = new Int32Array(n); let head = 0, tail = 0;
  const push = i => { if (!seen[i] && Sub[i] < 0.5) { seen[i] = 1; q[tail++] = i; } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (head < tail) { const i = q[head++], x = i % W; if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (i >= W) push(i - W); if (i < n - W) push(i + W); }
  for (let i = 0; i < n; i++) if (Sub[i] < 0.5 && !seen[i]) Sub[i] = 1;
}
// the mask as bytes, for the page (to show which part is which)
const maskBytes = () => { const b = new Uint8ClampedArray(W * H); for (let i = 0; i < b.length; i++) b[i] = Sub[i] * 255; return b; };
const pix = (x, y) => Math.min(H - 1, Math.max(0, y | 0)) * W + Math.min(W - 1, Math.max(0, x | 0));
// follow the flow field from (x, y) for `len` pixels in direction sgn (streamline, keeps a consistent heading)
function trace(x, y, sgn, len) {
  const i0 = pix(x, y); let dx = Math.cos(Tan[i0]) * sgn, dy = Math.sin(Tan[i0]) * sgn, d = 0;
  const st = Math.max(1, len / 24);
  while (d < len) {
    const j = pix(x, y);
    if (Coh[j] > 0.08) { let tx = Math.cos(Tan[j]), ty = Math.sin(Tan[j]); if (tx * dx + ty * dy < 0) { tx = -tx; ty = -ty; } dx = tx; dy = ty; }
    x += dx * st; y += dy * st; d += st;
  }
  return [x, y];
}
const cl255 = v => v < 0 ? 0 : v > 255 ? 255 : v;

// scanline fill of a flat polygon at pixel centres -> spans [y, x0, x1]
function raster(pts) {
  const n = pts.length >> 1; let y0 = 1e9, y1 = -1e9, ns = 0;
  for (let i = 1; i < pts.length; i += 2) { if (pts[i] < y0) y0 = pts[i]; if (pts[i] > y1) y1 = pts[i]; }
  y0 = Math.max(0, Math.ceil(y0 - 0.5)); y1 = Math.min(H - 1, Math.floor(y1 - 0.5));
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5; let k = 0;
    for (let i = 0; i < n; i++) {
      const ax = pts[i * 2], ay = pts[i * 2 + 1], j = (i + 1) % n, bx = pts[j * 2], by = pts[j * 2 + 1];
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) { if (k < 256) xs[k++] = ax + (yc - ay) * (bx - ax) / (by - ay); }
    }
    for (let a = 1; a < k; a++) { const v = xs[a]; let b = a - 1; while (b >= 0 && xs[b] > v) { xs[b + 1] = xs[b]; b--; } xs[b + 1] = v; }
    for (let j = 0; j + 1 < k; j += 2) {
      const xa = Math.max(0, Math.ceil(xs[j] - 0.5)), xb = Math.min(W - 1, Math.floor(xs[j + 1] - 0.5));
      if (xb >= xa && ns < spans.length / 3) { spans[ns * 3] = y; spans[ns * 3 + 1] = xa; spans[ns * 3 + 2] = xb; ns++; }
    }
  }
  return ns;
}
// per-pixel gradient parameter t and alpha for the shape (into tBuf/aBuf, in span order)
function field(s, ns) {
  const a = s.a; let j = 0;
  if (s.t === 'B') {
    const [ex, ey, rx, ry, r, f] = s.p, c = Math.cos(r), n = Math.sin(r);
    for (let i = 0; i < ns; i++) {
      const py = spans[i * 3] + 0.5;
      for (let x = spans[i * 3 + 1]; x <= spans[i * 3 + 2]; x++, j++) {
        const dx = x + 0.5 - ex, dy = py - ey, u = (dx * c + dy * n) / rx, v = (-dx * n + dy * c) / ry, k = Math.sqrt(u * u + v * v);
        tBuf[j] = k < 1 ? k : 1; aBuf[j] = k >= 1 ? 0 : a * Math.min(1, (1 - k) / f);
      }
    }
  } else {
    const [gx, gy, m, M] = SHP.axis(s), inv = 1 / Math.max(1e-6, M - m);
    for (let i = 0; i < ns; i++) {
      const py = spans[i * 3] + 0.5;
      for (let x = spans[i * 3 + 1]; x <= spans[i * 3 + 2]; x++, j++) {
        const t = s.fl ? 0 : ((x + 0.5) * gx + py * gy - m) * inv;
        tBuf[j] = t < 0 ? 0 : t > 1 ? 1 : t; aBuf[j] = a;
      }
    }
  }
  return j;
}
// solve both gradient colours, return the change in squared error if painted
// (in smart mode every pixel's error is weighted by the focus map)
function evaluate(s) {
  const ns = raster(SHP.poly(s)); if (!ns) return Infinity;
  const np = field(s, ns); if (np < 2) return Infinity;
  let A00 = 0, A01 = 0, A11 = 0, n = 0;
  const b0 = [0, 0, 0], b1 = [0, 0, 0], wmap = smart ? Wt : null;
  let j = 0;
  for (let i = 0; i < ns; i++) {
    const row = spans[i * 3] * W;
    for (let x = spans[i * 3 + 1]; x <= spans[i * 3 + 2]; x++, j++) {
      const ai = aBuf[j]; if (ai <= 0) continue;
      const wp = wmap ? wmap[row + x] : 1, t = tBuf[j], u = 1 - t, w = ai * ai * wp, ia = 1 - ai, o = (row + x) * 3;
      A00 += w * u * u; A01 += w * u * t; A11 += w * t * t; n++;
      for (let ch = 0; ch < 3; ch++) { const e = (T[o + ch] - C[o + ch] * ia) * ai * wp; b0[ch] += u * e; b1[ch] += t * e; }
    }
  }
  if (n < 2) return Infinity;
  // small ridge towards c0 == c1, so a gradient only appears when the pixels ask for one
  const lam = 0.02 * (A00 + A11) + 1e-6, a00 = A00 + lam, a01 = A01 - lam, a11 = A11 + lam, det = a00 * a11 - a01 * a01;
  let c0 = [0, 0, 0], c1 = [0, 0, 0];
  if (PAL) {
    // palette lock: the pair of palette colours that fits these pixels best (the same squared error, from the sums above)
    let best = Infinity, bi = 0, bj = 0;
    for (let i = 0; i < PAL.length; i++) for (let k = 0; k < PAL.length; k++) {
      if (s.fl && k !== i) continue;
      const P = PAL[i], Q = PAL[k]; let q = 0;
      for (let ch = 0; ch < 3; ch++) q += P[ch] * P[ch] * A00 + 2 * P[ch] * Q[ch] * A01 + Q[ch] * Q[ch] * A11 - 2 * P[ch] * b0[ch] - 2 * Q[ch] * b1[ch];
      if (q < best) { best = q; bi = i; bj = k; }
    }
    c0 = PAL[bi].slice(); c1 = PAL[bj].slice();
  } else for (let ch = 0; ch < 3; ch++) { c0[ch] = cl255((b0[ch] * a11 - b1[ch] * a01) / det); c1[ch] = cl255((a00 * b1[ch] - a01 * b0[ch]) / det); }
  // charcoal draws in greys (a breath of the colour left in), so it is scored in them too
  if (s.st === 'charcoal' && !PAL) for (const c of [c0, c1]) { const g = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; for (let ch = 0; ch < 3; ch++) c[ch] = g + (c[ch] - g) * 0.12; }
  let d = 0; j = 0;
  for (let i = 0; i < ns; i++) {
    const row = spans[i * 3] * W;
    for (let x = spans[i * 3 + 1]; x <= spans[i * 3 + 2]; x++, j++) {
      const ai = aBuf[j]; if (ai <= 0) continue;
      const t = tBuf[j], ia = 1 - ai, o = (row + x) * 3, wp = wmap ? wmap[row + x] : 1;
      for (let ch = 0; ch < 3; ch++) {
        const tv = T[o + ch], cv = C[o + ch], nv = cv * ia + (c0[ch] + (c1[ch] - c0[ch]) * t) * ai - tv;
        d += (nv * nv - (cv - tv) * (cv - tv)) * wp;
      }
    }
  }
  s.c0 = c0; s.c1 = c1;
  return d;
}
function commit(s) {   // call right after evaluate(s): reuses its spans / field
  const ns = raster(SHP.poly(s)); field(s, ns);
  let j = 0;
  for (let i = 0; i < ns; i++) {
    const row = spans[i * 3] * W;
    for (let x = spans[i * 3 + 1]; x <= spans[i * 3 + 2]; x++, j++) {
      const ai = aBuf[j]; if (ai <= 0) continue;
      const t = tBuf[j], ia = 1 - ai, o = (row + x) * 3;
      let e = 0;
      for (let ch = 0; ch < 3; ch++) { C[o + ch] = C[o + ch] * ia + (s.c0[ch] + (s.c1[ch] - s.c0[ch]) * t) * ai; e += Math.abs(C[o + ch] - T[o + ch]); }
      errMap[row + x] = e;
    }
  }
}
// sampling tables: where to try next (error², weighted by focus; a second table also favours strong edges)
let band = null;          // [firstRow, endRow): live modes with several painters; each only picks places in its own rows
function rebuildCum() {
  let t = 0, s = 0, te = 0;
  const b0 = band ? band[0] * W : 0, b1 = band ? band[1] * W : W * H;
  const ok = ORD ? ORD.key : null, lo = ORD ? passNo / ORD.K - 1e-6 : 0, hi = ORD ? (passNo >= ORD.K - 1 ? 2 : (passNo + 1) / ORD.K) : 2;
  for (let i = 0; i < W * H; i++) {
    const e = errMap[i] * errMap[i] + 1, w = (smart ? e * Wt[i] : e) * (i >= b0 && i < b1 ? 1 : 0) * (ok ? (ok[i] >= lo && ok[i] < hi ? 1 : 0) : 1);
    t += w; cum[i] = t; s += errMap[i];
    if (smart) { te += w * (0.15 + 3 * Edge[i] * Edge[i]); cumE[i] = te; }
  }
  cumTotal = t; cumETotal = te; sim = 100 * (1 - s / (3 * W * H) / 255);
}
function samplePos(edges) {
  if (abstract && !ORD && rnd() < 0.3) return [rnd() * W, band ? band[0] + rnd() * (band[1] - band[0]) : rnd() * H];     // abstract: some strokes go anywhere (in its band)
  const tab = edges ? cumE : cum, r = rnd() * (edges ? cumETotal : cumTotal); let lo = 0, hi = W * H - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (tab[m] < r) lo = m + 1; else hi = m; }
  return [lo % W + rnd(), (lo / W | 0) + rnd()];
}
const RELIEF_ST = ['oil', 'acrylic', 'knife', 'plast', 'ceramic', 'stone', 'metal', 'foam', 'molten', 'pewter', 'terrazzo', 'copper', 'gold', 'bronze', 'beads', 'puffy'];
const MIX = {
  painterly: [['S', 0.45], ['B', 0.25], ['E', 0.15], ['T', 0.15]],
  soft: [['B', 0.75], ['S', 0.25]],
  mixed: [['E', 0.2], ['B', 0.2], ['T', 0.2], ['R', 0.15], ['S', 0.25]],
  geometric: [['T', 0.55], ['R', 0.45]],
  bubbles: [['B', 0.55], ['E', 0.45]],
  flat: [['S', 0.6], ['E', 0.25], ['T', 0.15]],
  points: [['E', 1]],                                  // pointillism: round dots
  hatch: [['S', 0.88], ['B', 0.12]],                   // pen cross-hatching (+ a few washes for the first coverage)
  calligraphy: [['S', 0.85], ['B', 0.15]],             // long flowing strokes of varying width
  watercolour: [['S', 0.6], ['B', 0.3], ['E', 0.1]],   // watercolour brush strokes (glazes) and washes
  oil: [['S', 0.85], ['B', 0.15]], acrylic: [['S', 0.85], ['B', 0.15]], knife: [['S', 0.8], ['B', 0.2]],
  gouache: [['S', 0.8], ['B', 0.2]], sumi: [['S', 0.8], ['B', 0.2]], marker: [['S', 0.9], ['R', 0.1]],
  confetti: [['R', 0.7], ['T', 0.3]],                  // small bright slips and flakes
  graffiti: [['S', 0.82], ['B', 0.18]],                // spray-can strokes and bursts (the page sprays them: haze, speckles, drips)
  // the newer styles (the page draws each in its own way; here they are shaped so the scoring matches)
  mosaic: [['R', 1]],                                  // square tiles on a grid (halving sizes, so small tiles fit big ones)
  glass: [['T', 0.55], ['E', 0.25], ['R', 0.2]],       // stained-glass pieces (lit glass in lead)
  linocut: [['B', 0.35], ['E', 0.25], ['T', 0.2], ['S', 0.2]],   // a lino print: solid ink, white gouge cuts
  riso: [['B', 0.35], ['E', 0.25], ['R', 0.15], ['S', 0.25]],    // risograph: two spot inks, grainy, off register
  tape: [['S', 0.8], ['R', 0.2]],                      // strips of coloured tape
  scribble: [['B', 0.45], ['E', 0.35], ['T', 0.2]],    // areas the page scribbles in with a pen
  halftone: [['E', 0.35], ['B', 0.25], ['R', 0.2], ['T', 0.2]],
  string: [['S', 0.85], ['B', 0.15]],                  // long straight threads (a few washes first)
  glitch: [['R', 1]],                                  // level bars
  bokeh: [['E', 1]],                                   // round lights
  paper: [['T', 0.35], ['R', 0.3], ['E', 0.2], ['B', 0.15]],
  stitch: [['B', 0.5], ['E', 0.25], ['R', 0.25]],
  // drawing media (the page draws them; strokes for the line media, areas the page shades or washes)
  pencil: [['S', 1]],      // coloured pencil: grainy lines, areas shaded with close strokes
  pastel: [['S', 0.6], ['B', 0.25], ['E', 0.15]],      // soft pastel: chalky strokes, smudged patches
  pen: [['B', 0.35], ['E', 0.3], ['T', 0.2], ['S', 0.15]],   // fine-liner: outlines and contours over pale washes
  ink: [['S', 0.75], ['B', 0.25]],                     // ink brush: swelling, tapering strokes, ink pools
  wash: [['B', 0.55], ['E', 0.3], ['T', 0.15]],
  wet: [['B', 0.5], ['E', 0.28], ['S', 0.12], ['T', 0.1]],
  thread: [['S', 0.62], ['E', 0.16], ['R', 0.12], ['T', 0.1]],         // embroidery: satin stitches across strokes, rows of stitches filling shapes
  hylics: [['S', 0.4], ['B', 0.25], ['E', 0.15], ['T', 0.1], ['R', 0.1]],           // after Hylics: clay printed like a photocopy
  lens: [['E', 0.45], ['B', 0.25], ['S', 0.2], ['T', 0.1]],             // clear glass that bends what is under it
  crystal: [['T', 0.45], ['R', 0.25], ['E', 0.2], ['S', 0.1]],          // cut crystal facets
  frost: [['B', 0.4], ['E', 0.3], ['R', 0.2], ['S', 0.1]],              // frosted glass
  neon: [['S', 0.7], ['E', 0.2], ['R', 0.1]],                           // neon tubes
  embroid: [['S', 0.55], ['E', 0.2], ['B', 0.15], ['T', 0.1]],          // machine embroidery
  // relief materials (the page raises them into a height map and lights it): ropes, a few slabs
  plast: [['S', 0.82], ['B', 0.18]],
  ceramic: [['S', 0.82], ['B', 0.18]],
  stone: [['S', 0.82], ['B', 0.18]],
  metal: [['S', 0.82], ['B', 0.18]],
  foam: [['S', 0.82], ['B', 0.18]],
  molten: [['S', 0.82], ['B', 0.18]],
  pewter: [['S', 0.82], ['B', 0.18]],
  terrazzo: [['S', 0.82], ['B', 0.18]],
  copper: [['S', 0.82], ['B', 0.18]],
  gold: [['S', 0.82], ['B', 0.18]],
  bronze: [['S', 0.82], ['B', 0.18]],
  beads: [['S', 0.82], ['B', 0.18]],
  puffy: [['S', 0.82], ['B', 0.18]],
  charcoal: [['S', 1]]                   // charcoal: dusty, smudged greys
};
let stepProg = 0;
// several styles can be ticked at once: every candidate stroke picks one of them and is finished in it
let styles = ['painterly'], stepStyle = 'painterly';   // each committed stroke picks its style first, so the ticked mix is shared evenly
let bgStyles = [], stepBg = null;                       // background styles (none: the same styles everywhere)
const FLAT = new Set(['linocut', 'riso', 'tape', 'flat', 'points', 'confetti', 'hatch', 'graffiti', 'mosaic', 'scribble', 'string', 'bokeh', 'paper', 'stitch', 'pencil', 'pastel', 'pen', 'ink', 'wash', 'charcoal', 'thread', 'hylics', 'lens', 'crystal', 'frost', 'neon', 'sumi', 'marker', ...RELIEF_ST.filter(t => !['oil', 'acrylic', 'knife'].includes(t))]);        // single-colour marks so dots / flakes / lines read as such
const SMALL = { points: 0.028, confetti: 0.04 };                      // dots and flakes stay small once the first washes are down
// lines: every style draws with strokes (except the ones whose look is their shape: tiles, bars, dots, lights, pieces…),
// after the first few washes of colour
let LINES = true;
const SHAPE_ID = new Set(['mosaic', 'glitch', 'bubbles', 'bokeh', 'points', 'confetti', 'stitch', 'glass', 'paper', 'geometric', 'crystal']);
function pickType(st) {
  if ((st === 'hatch' || st === 'calligraphy' || st === 'string') && stepProg > 0.12) return 'S';
  if (LINES && !SHAPE_ID.has(st) && (stepProg > 0.04 || rnd() < 0.6)) return 'S';
       // washes only for the first coverage
  const m = MIX[st] || MIX.painterly; let r = rnd(); for (const [t, w] of m) { if ((r -= w) <= 0) return t; } return m[0][0];
}
// a candidate shape: guided by the image's flow in smart mode (abstract mode sends half of them off unguided),
// then finished in its style
function randomShape(smin, smax, prog) {
  let st = stepStyle, pos = null;
  // subject / background styles: the candidate's spot decides which style it is painted in
  if (stepBg && Sub) {
    const edges = smart && prog > 0.55 && rnd() < 0.5; pos = samplePos(edges); pos.edges = edges;
    if (Sub[pix(pos[0], pos[1])] < 0.5) st = stepBg;
  }
  if (SMALL[st] && prog > 0.06) { const cap = Math.max(W, H) * SMALL[st]; if (smax > cap) { smin *= cap / smax; smax = cap; } }
  if (abstract) { const k = lerp(0.7, 1.9, rnd()); smin *= k; smax *= k; }
  const t = pickType(st), s = smart && !(abstract && rnd() < 0.5) ? guidedShape(smin, smax, prog, t, st, pos) : plainShape(smin, smax, t, pos);
  s.st = st; s.fl = FLAT.has(st);
  return styled(s, st);
}
// a stroke made k times longer about its middle (drawn strokes, not dabs)
function longer(p, k) { const cx = (p[0] + p[4]) / 2, cy = (p[1] + p[5]) / 2; for (const i of [0, 2, 4]) { p[i] = cx + (p[i] - cx) * k; p[i + 1] = cy + (p[i + 1] - cy) * k; } }
function styled(s, st) {
  const p = s.p;
  if (st === 'points' && s.t === 'E') { p[2] = p[3] = Math.max(1, Math.min(p[2], p[3])); s.a = 0.92; }
  else if (st === 'hatch' && s.t === 'S') {            // straight lines at ±45°, like pen hatching
    const cx = (p[0] + p[4]) / 2, cy = (p[1] + p[5]) / 2, len = Math.max(Math.hypot(p[4] - p[0], p[5] - p[1]) * 0.6, Math.max(W, H) * 0.03), ang = (rnd() < 0.5 ? 0.785 : 2.356) + gauss() * 0.08;
    p[0] = cx - Math.cos(ang) * len; p[1] = cy - Math.sin(ang) * len; p[4] = cx + Math.cos(ang) * len; p[5] = cy + Math.sin(ang) * len;
    p[2] = cx; p[3] = cy; p[6] = lerp(0.6, 1.5, rnd()); s.a = 0.9;     // thin pen lines
  } else if (st === 'calligraphy' && s.t === 'S') { p[6] = Math.max(1, p[6] * lerp(0.35, 1.4, rnd())); s.a = 0.95; }
  else if (st === 'watercolour') { if (s.t === 'S') { s.a = 0.62; p[6] = Math.max(2, p[6] * lerp(1.1, 1.6, rnd())); longer(p, 1.2); } else { s.a = lerp(0.45, 0.7, rnd()); if (s.t === 'B') p[5] = 0.15; } }
  else if (st === 'oil' || st === 'acrylic' || st === 'gouache') { s.a = 1; if (s.t === 'S') { p[6] = Math.max(3, p[6] * lerp(1.0, st === 'oil' ? 1.7 : 1.5, rnd())); longer(p, lerp(1.1, 1.4, rnd())); } else if (s.t === 'B') p[5] = 0.12; }
  else if (st === 'knife') { s.a = 1; if (s.t === 'S') { p[6] = Math.max(4, p[6] * lerp(1.1, 1.5, rnd())); p[2] = (p[0] + p[4]) / 2 + (p[2] - (p[0] + p[4]) / 2) * 0.3; p[3] = (p[1] + p[5]) / 2 + (p[3] - (p[1] + p[5]) / 2) * 0.3; longer(p, 0.95); } else if (s.t === 'B') p[5] = 0.12; }
  else if (st === 'sumi') { s.a = 0.95; if (s.t === 'S') p[6] = Math.max(1.5, p[6] * lerp(0.8, 1.6, rnd())); else if (s.t === 'B') p[5] = lerp(0.3, 0.6, rnd()); }
  else if (st === 'marker') { s.a = 0.7; if (s.t === 'S') { p[6] = Math.max(2, Math.min(10, p[6] * 0.6)); longer(p, 1.2); } }
  else if (st === 'confetti') s.a = 0.95;
  else if (st === 'graffiti') { if (s.t === 'S') { p[6] = Math.max(1.5, p[6] * lerp(1.1, 1.7, rnd())); s.a = 0.92; } else if (s.t === 'B') { s.a = 0.85; p[5] = lerp(0.7, 1, rnd()); } }
  else if (st === 'mosaic' || st === 'glitch') s.a = 1;
  else if (st === 'glass') { s.a = 1; if (s.t === 'B') p[5] = 0.12; }
  else if (st === 'linocut' || st === 'riso') { s.a = 1; if (s.t === 'B') p[5] = 0.12; else if (s.t === 'S') p[6] = Math.max(3, p[6] * lerp(1, 1.5, rnd())); }
  else if (st === 'tape') { s.a = 0.95; if (s.t === 'S') { p[6] = Math.max(4, Math.min(46, p[6] * lerp(0.8, 1.2, rnd()))); p[2] = (p[0] + p[4]) / 2 + (p[2] - (p[0] + p[4]) / 2) * 0.25; p[3] = (p[1] + p[5]) / 2 + (p[3] - (p[1] + p[5]) / 2) * 0.25; } }
  else if (st === 'scribble' || st === 'paper' || st === 'stitch' || st === 'halftone') { s.a = 1; if (s.t === 'B') p[5] = 0.12; }
  else if (st === 'bokeh') { s.a = lerp(0.45, 0.75, rnd()); p[2] = p[3] = (p[2] + p[3]) / 2; }
  else if (st === 'pencil') { s.a = 0.85; if (s.t === 'S') { p[6] = Math.max(1, Math.min(4, p[6] * lerp(0.25, 0.5, rnd()))); longer(p, 1.5); } else if (s.t === 'B') p[5] = 0.12; }
  else if (st === 'pastel') { s.a = 0.92; if (s.t === 'S') p[6] = Math.max(2, p[6] * lerp(1.1, 1.5, rnd())); else if (s.t === 'B') p[5] = 0.2; }
  else if (st === 'pen') { s.a = 1; if (s.t === 'B') p[5] = 0.12; }
  else if (st === 'ink') { s.a = 0.95; if (s.t === 'S') p[6] = Math.max(1.5, p[6] * lerp(0.7, 1.5, rnd())); else if (s.t === 'B') p[5] = lerp(0.3, 0.6, rnd()); }
  else if (st === 'hylics') { s.a = 1; if (s.t === 'S') p[6] = Math.max(3, p[6] * lerp(1.1, 1.7, rnd())); else if (s.t === 'B') p[5] = 0.12; }
  else if (st === 'lens' || st === 'crystal' || st === 'frost') { s.a = 0.9; if (s.t === 'B') p[5] = 0.12; }
  else if (RELIEF_ST.includes(st)) { s.a = 1; if (s.t === 'S') { p[6] = Math.max(3, p[6] * lerp(0.9, 1.4, rnd())); longer(p, lerp(1.2, 1.6, rnd())); } else if (s.t === 'B') p[5] = 0.12; }
  else if (st === 'neon') { s.a = 1; if (s.t === 'S') p[6] = Math.max(1.5, Math.min(8, p[6] * lerp(0.4, 0.8, rnd()))); }
  else if (st === 'embroid') { s.a = 1; if (s.t === 'S') p[6] = Math.max(4, p[6] * lerp(1.2, 1.9, rnd())); else if (s.t === 'B') p[5] = 0.12; }
  else if (st === 'thread') { s.a = 1; if (s.t === 'S') p[6] = Math.max(3, p[6] * lerp(0.9, 1.6, rnd())); }
  else if (st === 'wet') { s.a = lerp(0.5, 0.78, rnd()); if (s.t === 'B') p[5] = 0.15; else if (s.t === 'S') p[6] = Math.max(2, p[6] * lerp(1.1, 1.8, rnd())); }
  else if (st === 'wash') { s.a = lerp(0.45, 0.7, rnd()); if (s.t === 'B') p[5] = 0.15; }
  else if (st === 'charcoal') { s.a = 0.9; if (s.t === 'S') { p[6] = Math.max(2, p[6] * lerp(0.55, 0.9, rnd())); longer(p, 1.7); } else if (s.t === 'B') p[5] = 0.3; }
  else if (st === 'string' && s.t === 'S') {           // long and straight, through the point the painter picked
    const cx = (p[0] + p[4]) / 2, cy = (p[1] + p[5]) / 2, ang = Math.atan2(p[5] - p[1], p[4] - p[0]), half = Math.max(Math.hypot(p[4] - p[0], p[5] - p[1]) * 0.9, Math.max(W, H) * lerp(0.06, 0.2, rnd()));
    p[0] = cx - Math.cos(ang) * half; p[1] = cy - Math.sin(ang) * half; p[4] = cx + Math.cos(ang) * half; p[5] = cy + Math.sin(ang) * half; p[6] = lerp(0.9, 1.5, rnd()); s.a = 0.8;
  }
  if (st === 'glitch' && s.t === 'R') { const w = Math.max(p[2], p[3]); p[2] = w * lerp(1.8, 4.5, rnd()); p[3] = Math.max(1, Math.min(p[2], p[3], w) * lerp(0.1, 0.35, rnd())); }
  return constrain(s);
}
// shapes some styles need exactly, kept through the fine-tuning too: tiles on a grid, straight threads, level bars,
// round lights
function constrain(s) {
  const p = s.p, st = s.st, L = Math.max(W, H);
  if (st === 'mosaic' && s.t === 'R') {
    const k = Math.max(3, Math.min(8, Math.round(Math.log2(L / Math.max(1, p[2], p[3]))))), cell = Math.max(2, L / 2 ** k);
    p[2] = p[3] = cell; p[4] = 0; p[0] = (Math.floor(p[0] / cell) + 0.5) * cell; p[1] = (Math.floor(p[1] / cell) + 0.5) * cell;
  } else if (st === 'string' && s.t === 'S') {
    const dx = p[4] - p[0], dy = p[5] - p[1], d = Math.hypot(dx, dy) || 1, min = L * 0.1;
    if (d < min) { const cx = (p[0] + p[4]) / 2, cy = (p[1] + p[5]) / 2, k = min / d / 2; p[0] = cx - dx * k; p[1] = cy - dy * k; p[4] = cx + dx * k; p[5] = cy + dy * k; }
    p[2] = (p[0] + p[4]) / 2; p[3] = (p[1] + p[5]) / 2; p[6] = Math.max(0.9, Math.min(1.6, p[6]));
  } else if (st === 'glitch' && s.t === 'R') {
    p[4] = 0; p[5] = Math.cos(p[5]) >= 0 ? 0 : Math.PI; p[3] = Math.max(1, Math.min(p[3], p[2] * 0.35));
  } else if (st === 'bokeh' && s.t === 'E') p[3] = p[2];
  return s;
}
function plainShape(smin, smax, t, pos) {
  const [x, y] = pos || samplePos(), s = lerp(smin, smax, rnd()), r = rnd() * Math.PI, g = rnd() * Math.PI * 2;
  if (t === 'E') return { t, a: 0.8, p: [x, y, s * lerp(0.25, 1, rnd()), s * lerp(0.25, 1, rnd()), r, g] };
  if (t === 'B') return { t, a: 0.9, p: [x, y, s * lerp(0.35, 1.2, rnd()), s * lerp(0.35, 1.2, rnd()), r, lerp(0.25, 0.9, rnd())] };
  if (t === 'R') return { t, a: 0.8, p: [x, y, s * lerp(0.3, 1.6, rnd()), s * lerp(0.2, 1, rnd()), r, g] };
  if (t === 'T') { const p = [x, y, x, y, x, y, g]; for (let i = 0; i < 6; i++) p[i] += (rnd() - 0.5) * 2 * s; return { t, a: 0.8, p }; }
  const dx = Math.cos(r) * s, dy = Math.sin(r) * s, bend = (rnd() - 0.5) * s;
  return { t, a: 0.8, p: [x - dx, y - dy, x - dy / s * bend, y + dx / s * bend, x + dx, y + dy, Math.max(1, s * lerp(0.08, 0.35, rnd())), Math.atan2(dy, dx) + (rnd() < 0.5 ? 0 : Math.PI / 2)] };
}
// smart candidates: oriented by the flow field where the image has a clear direction,
// strokes grown along streamlines, gradients laid across edges; late on, half go to strong edges
function guidedShape(smin, smax, prog, t, st, pos) {
  const edges = pos ? pos.edges : prog > 0.55 && rnd() < 0.5;
  const [x, y] = pos || samplePos(edges), i = pix(x, y), coh = Coh[i];
  const s = lerp(smin, smax, rnd());
  const guided = rnd() < 0.3 + 0.65 * coh;
  const along = guided ? Tan[i] + gauss() * 0.12 : rnd() * Math.PI;         // edge tangent
  const across = guided ? along + Math.PI / 2 : rnd() * Math.PI * 2;         // gradient direction
  const long = guided ? lerp(0.55, 1.15, rnd()) : lerp(0.25, 1, rnd()), thin = guided ? lerp(0.18, 0.6, rnd()) : lerp(0.25, 1, rnd());
  if (t === 'E') return { t, a: 0.8, p: [x, y, s * long, s * thin, along, across] };
  if (t === 'B') return { t, a: 0.9, p: [x, y, s * lerp(0.4, 1.2, rnd()) * (guided ? 1.2 : 1), s * lerp(0.4, 1.2, rnd()) * (guided ? 0.6 : 1), along, lerp(0.25, 0.9, rnd())] };
  if (t === 'R') return { t, a: 0.8, p: [x, y, s * lerp(0.6, 1.6, rnd()), s * lerp(0.15, 0.6, rnd()), along, across] };
  if (t === 'T') { const p = [x, y, x, y, x, y, across]; for (let k = 0; k < 6; k++) p[k] += (rnd() - 0.5) * 2 * s; return { t, a: 0.8, p }; }
  const w = Math.max(1, s * (edges ? lerp(0.05, 0.16, rnd()) : lerp(0.08, 0.32, rnd())));
  if (guided) {
    const reach = st === 'calligraphy' ? s * 1.8 : s;    // calligraphy follows the flow much further
    const [x0, y0] = trace(x, y, -1, reach), [x2, y2] = trace(x, y, 1, reach);
    return { t, a: 0.8, p: [x0, y0, 2 * x - (x0 + x2) / 2, 2 * y - (y0 + y2) / 2, x2, y2, w, across] };   // quadratic through (x, y)
  }
  const dx = Math.cos(along) * s, dy = Math.sin(along) * s, bend = (rnd() - 0.5) * s;
  return { t, a: 0.8, p: [x - dx, y - dy, x - dy / s * bend, y + dx / s * bend, x + dx, y + dy, w, across] };
}
// how big a shape is (half its extent), to keep the fine-tuning inside the viewer's stroke-size range
function extentOf(s) {
  const p = s.p;
  if (s.t === 'T') return Math.max(Math.hypot(p[2] - p[0], p[3] - p[1]), Math.hypot(p[4] - p[2], p[5] - p[3]), Math.hypot(p[0] - p[4], p[1] - p[5])) / 2;
  if (s.t === 'S') return Math.max(Math.hypot(p[4] - p[0], p[5] - p[1]) / 2, p[6]);
  return Math.max(p[2], p[3]);
}
// which parameters are angles / sizes / feather for each type
const KIND = { E: 'ppssaa', B: 'ppssaf', T: 'pppppp' + 'a', R: 'ppssaa', S: 'pppppp' + 'sa' };
function mutate(s, smax) {
  const p = s.p.slice(), j = smax * 0.12, i = Math.floor(rnd() * p.length), k = KIND[s.t][i];
  if (k === 'p') p[i] += gauss() * j;
  else if (k === 's') p[i] = Math.max(1, p[i] * Math.exp(gauss() * 0.2));
  else if (k === 'a') p[i] += gauss() * 0.35;
  else if (k === 'f') p[i] = Math.max(0.12, Math.min(1, p[i] + gauss() * 0.12));
  return constrain({ t: s.t, a: s.a, p, st: s.st, fl: s.fl });
}

// rotate both colours' hue around the grey axis by the same random angle and push saturation a little
function shiftColours(s) {
  const th = gauss() * 0.4, c = Math.cos(th), n = Math.sin(th), k = 1 / Math.sqrt(3), sat = lerp(1.05, 1.35, rnd());
  for (const col of [s.c0, s.c1]) {
    const m = (col[0] + col[1] + col[2]) / 3, r = col[0] - m, g = col[1] - m, b = col[2] - m;
    const cr = k * (g - b), cg = k * (b - r), cb = k * (r - g);          // (axis × v); axis · v = 0 for a grey-centred colour
    col[0] = cl255(m + (r * c + cr * n) * sat); col[1] = cl255(m + (g * c + cg * n) * sat); col[2] = cl255(m + (b * c + cb * n) * sat);
  }
}
// ── order modes ───────────────────────────────────────────────
// Instead of attacking the biggest error wherever it is, the painter works through the picture in passes (top to
// bottom, round a spiral, …). Every pixel has a key 0…1; pass i only picks places whose key is in its slice, and
// within a pass the usual coarse-to-fine order applies (washes, then detail), so each slice is finished before the next.
let ORD = null, passNo = 0, passStart = 0, passLen = 1, passFails = 0, pathPic = null;
function orderSetup(kind, c0) {
  ORD = null;
  const KINDS = ['down', 'up', 'right', 'left', 'diag', 'spiral', 'spiralin', 'rings', 'ringsin', 'clock'];
  if (!KINDS.includes(kind)) return;
  const key = new Float32Array(W * H), L = Math.max(W, H), cx = W / 2, cy = H / 2, short = Math.min(W, H), TURNS = 3;
  const spiral = kind === 'spiral' || kind === 'spiralin', rings = kind === 'rings' || kind === 'ringsin', clock = kind === 'clock';
  const K = Math.max(2, Math.min(spiral ? 30 : rings ? 10 : clock ? 16 : 12, Math.round(maxShapes / 20)));
  let thick = L / K;
  if (kind === 'down' || kind === 'up') thick = H / K; else if (kind === 'left' || kind === 'right') thick = W / K;
  else if (kind === 'diag') thick = (W + H) / (2 * K);
  else if (spiral) thick = short / (2 * TURNS); else if (rings) thick = short / (2 * K); else if (clock) thick = Math.sqrt(W * H / K);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, u = (x + 0.5 - cx) / cx, v = (y + 0.5 - cy) / cy; let k;
    if (kind === 'down') k = (y + 0.5) / H; else if (kind === 'up') k = 1 - (y + 0.5) / H;
    else if (kind === 'right') k = (x + 0.5) / W; else if (kind === 'left') k = 1 - (x + 0.5) / W;
    else if (kind === 'diag') k = ((x + 0.5) / W + (y + 0.5) / H) / 2;
    else {
      const r = Math.pow(Math.pow(Math.abs(u), 4) + Math.pow(Math.abs(v), 4), 0.25) / 1.1892;         // 0 in the middle … 1 in the corners (a rounded square, like the picture)
      const phi = ((Math.atan2(u, -v) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI);                   // 0 at 12 o'clock, clockwise
      if (clock) k = phi;
      else if (rings) k = Math.min(1, r);
      else { const lap = Math.round(Math.min(1, r) * TURNS - phi); k = Math.min(1, Math.max(0, (lap + phi) / TURNS)); }
    }
    key[i] = Math.min(0.9999, Math.max(0, kind === 'spiralin' || kind === 'ringsin' ? 1 - k : k));
  }
  ORD = { key, K, thick };
  passNo = Math.min(K - 1, Math.floor((c0 || 0) * K / Math.max(1, maxShapes))); passStart = c0 || 0; passFails = 0;
  passLen = Math.max(1, (maxShapes - passStart) / (K - passNo));
}
function advancePass() {
  passNo++; passStart = count; passFails = 0; passLen = Math.max(1, (maxShapes - count) / (ORD.K - passNo));
  rebuildCum();
}

// ── one line, painted: a pen that never lifts ──────────────────
// Every stroke starts exactly where the last one ended. The pen wanders where the picture is most wrong near it, in
// whatever styles are ticked (ink, graffiti, paint …), takes whatever colour the picture needs there (so the colour
// changes as it goes), and paints over itself freely; early strokes are long and broad, late ones short and fine.
let PEN = false, penPos = null;
const NO_STROKE = new Set(['mosaic', 'glitch']);      // styles that only know how to draw bars: the pen draws plain strokes instead
// branches (music: on a beat the one line splits): extra pens that start where the line is and draw on beside it for a
// while; the pens take turns, so they grow together
let PENS = [], penTurn = 0, penIds = 0, PEN_ID = 0;
function penStep(prog, tag) {
  if (!PENS.length || !penPos) { PEN_ID = 0; return penStep1(prog, tag); }
  const k = penTurn++ % (PENS.length + 1);
  if (!k) { PEN_ID = 0; return penStep1(prog, tag); }
  const P = PENS[k - 1], keep = penPos; penPos = P.pos; PEN_ID = P.id;
  const ok = penStep1(prog, tag); P.pos = penPos; penPos = keep; PEN_ID = 0;
  if ((ok && --P.life <= 0) || !P.pos) PENS.splice(PENS.indexOf(P), 1);
  return ok;
}
function penStep1(prog, tag) {
  const L = Math.max(W, H); stepProg = prog; stepStyle = styles[Math.floor(rnd() * styles.length)] || 'painterly';
  if (NO_STROKE.has(stepStyle)) stepStyle = 'flat';
  const kk = (sizeRand ? Math.pow(2, rnd() * 5.32 - 3.32) : sizeK) * (SSZ[stepStyle] || 1);    // (a style can have its own size)
  let smax = Math.min(L * 0.9, L * lerp(0.45, 0.012, Math.pow(prog, 0.5)) * kk);
  if (under) smax = Math.min(smax, L * 0.1 * Math.max(1, kk));
  if (ORD) smax = Math.min(smax, Math.max(ORD.thick, L * 0.02));
  const smin = smax * 0.3, reach = Math.max(8, smax * 2.4);
  if (count % 8 === 0) rebuildCum();
  const sx0 = penPos ? penPos[0] : 0, sy0 = penPos ? penPos[1] : 0;
  // where the pen could go next: spots near it, the ones with the most wrong picture first
  const spots = [];
  // (with an order: only spots in the part being worked on; the pen travels on to the next part as a thin line, like a scanner head)
  const lo = ORD ? passNo / ORD.K - 1e-6 : 0, hi = ORD ? (passNo >= ORD.K - 1 ? 2 : (passNo + 1) / ORD.K) : 2;
  const inWin = (x, y) => !ORD || (ORD.key[pix(x, y)] >= lo && ORD.key[pix(x, y)] < hi);
  for (let i = 0; i < 28 || (ORD && spots.length < 6 && i < 90); i++) {
    let x, y;
    if (!penPos || (ORD && i >= 28)) { [x, y] = samplePos(prog > 0.55 && rnd() < 0.5); }
    else { const a = rnd() * 6.2832, d = reach * Math.sqrt(rnd()) * (0.35 + 0.65 * rnd()); x = Math.min(W - 1, Math.max(0, sx0 + Math.cos(a) * d)); y = Math.min(H - 1, Math.max(0, sy0 + Math.sin(a) * d)); }
    if (!inWin(x, y)) continue;
    const k = pix(x, y); spots.push([x, y, (errMap[k] * errMap[k] + 1) * (smart ? Wt[k] : 1) * (0.4 + rnd())]);
  }
  if (penPos && ORD && spots.length > 1) { const near = (s) => Math.hypot(s[0] - sx0, s[1] - sy0); if (spots.every(s => near(s) > reach)) spots.sort((a, b) => near(a) - near(b)); }
  spots.sort((a, b) => b[2] - a[2]);
  let best = null, bd = Infinity;
  for (let i = 0; i < Math.min(10, spots.length); i++) {
    let sh;
    if (!penPos) { sh = guidedShape(smin, smax, prog, 'S', stepStyle, null); sh.st = stepStyle; sh.fl = FLAT.has(stepStyle); sh = styled(sh, stepStyle); }      // the very first stroke: free, but always a stroke
    else {
      const [tx, ty] = spots[i], dx = tx - sx0, dy = ty - sy0, len = Math.hypot(dx, dy) || 1, bend = (rnd() - 0.5) * len * 0.8;
      sh = { t: 'S', a: 0.8, p: [sx0, sy0, (sx0 + tx) / 2 - dy / len * bend, (sy0 + ty) / 2 + dx / len * bend, tx, ty, Math.max(1, lerp(smin, smax, rnd()) * lerp(0.1, 0.34, rnd())), Math.atan2(dy, dx) + (rnd() < 0.5 ? 0 : Math.PI / 2)] };
      sh.st = stepStyle; sh.fl = FLAT.has(stepStyle); sh = styled(sh, stepStyle);
      sh.p[0] = sx0; sh.p[1] = sy0;
    }
    if (sh.t !== 'S') continue;
    const d = evaluate(sh); if (d < bd) { bd = d; best = sh; }
  }
  if (!best) { if (++passFails > 30) penPos = null; return false; }
  for (let i = 0, fails = 0; i < 50 && fails < 16; i++) {      // (refined a little less than a free stroke: the one line has to keep up with a song)
    const m = mutate(best, smax); if (penPos) { m.p[0] = sx0; m.p[1] = sy0; }
    const d = evaluate(m); if (d < bd) { bd = d; best = m; fails = 0; } else fails++;
  }
  if (bd >= 0 && penPos) { best.p[6] = 1; bd = evaluate(best); }       // nothing helps: the pen only travels, as thin as it can
  if (bd === Infinity) { penPos = null; return false; }
  evaluate(best);
  if (abstract && !PAL) shiftColours(best);
  commit(best); count++; passFails = 0; penPos = [best.p[4], best.p[5]];
  postMessage({ type: 'shape', s: best, count, sim, gen, L: tag, pen: PEN_ID });
  return true;
}
function step(prog = count / maxShapes, tag) {
  const L = Math.max(W, H);
  if (RFILL !== 'off' && !PEN && !ACC && prog > 0.06 && prog < 0.8 && count >= rfNext) { rfNext = count + Math.max(12, Math.round((endless ? 60 : maxShapes) / 25)); if (regionMove(prog, tag)) return true; }
  if (ORD) {
    if (passNo < ORD.K - 1 && (count - passStart >= passLen || passFails > 120 || cumTotal <= 0)) advancePass();
    prog = Math.min(1, (count - passStart) / passLen);
  }
  if (PEN) return penStep(prog, tag); stepProg = prog; stepStyle = styles[Math.floor(rnd() * styles.length)] || 'painterly';
  stepBg = bgStyles.length ? bgStyles[Math.floor(rnd() * bgStyles.length)] : null;
  const kk = (sizeRand ? Math.pow(2, rnd() * 5.32 - 3.32) : sizeK) * (SSZ[stepStyle] || 1);    // (a style can have its own size)   // random: anywhere from ×0.1 to ×4, stroke by stroke
  let smax = Math.min(L * 0.9, L * lerp(0.45, 0.012, Math.pow(prog, 0.5)) * kk);
  if (under) smax = Math.min(smax, L * (endless ? 0.05 : 0.1) * Math.max(1, kk));      // with the source showing under the canvas: no big first washes, it gets covered bit by bit
  if (ORD) smax = Math.min(smax, Math.max(ORD.thick, L * 0.02));      // a pass works inside its own window: no washes bigger than it
  const smin = smax * 0.3;
  if (count % 8 === 0) rebuildCum();
  let best = null, bd = Infinity;
  const nc = Math.round((prog < 0.15 ? 80 : 40) / HURRY);
  for (let i = 0; i < nc; i++) { const s = randomShape(smin, smax, prog), d = evaluate(s); if (d < bd) { bd = d; best = s; } }
  if (!best) { passFails++; return false; }                 // no candidate landed anywhere useful; try again next step
  let fails = 0;
  const keep = kk !== 1 || under, lo = smin * 0.4, hi = smax * 1.6;      // (a chosen stroke size stays chosen: no growing / shrinking out of it; under: no growing into big washes)
  for (let i = 0, mi = 180 / HURRY, mf = 50 / HURRY; i < mi && fails < mf; i++) {
    const s = mutate(best, smax);
    if (keep) { const x = extentOf(s); if (x > hi || x < lo) { fails++; continue; } }
    const d = evaluate(s);
    if (d < bd) { bd = d; best = s; fails = 0; } else fails++;
  }
  if (!best || bd >= 0) { passFails++; return false; }      // nothing helps here; try elsewhere next step
  evaluate(best);
  if (abstract && !PAL) shiftColours(best);        // abstract: the colours wander a little from what the image asks for
  commit(best); count++; passFails = 0;
  postMessage({ type: 'shape', s: best, count, sim, gen, L: tag, acc: ACC || undefined });
  return true;
}
// the beat's stroke (music in the paint): one stroke k times the size the painter is on now (and at least a real gesture), made at once, still
// one that brings the picture closer; when nothing that big helps anywhere, a smaller one
let ACC = false, HURRY = 1, UNTIL = null;     // (hurry: behind the song, each stroke is searched for less)
function accent(k) {
  const keepK = sizeK, keepR = sizeRand; let ok = false;
  ACC = true; sizeRand = false;
  // (never smaller than a real gesture: about a seventh of the canvas, however far the painting has got)
  const base = lerp(0.45, 0.012, Math.pow(Math.min(1, count / Math.max(1, maxShapes)), 0.5)), kmin = 0.15 / base / Math.max(0.3, keepK);
  try { for (let i = 0; i < 10 && !ok; i++) { sizeK = keepK * Math.max(1.2, Math.max(k, kmin) * Math.pow(0.82, i >> 1)); ok = step(); } }
  finally { ACC = false; sizeK = keepK; sizeRand = keepR; }
  if (!ok) postMessage({ type: 'accent-none', gen });
}
// ── outlines: the picture's real lines (Canny-style edges traced into chains), drawn as strokes ─────────────────
// OUTL 'first': the lines are drawn before the colour and burnt into the target, so the fill keeps them and fills the
// spaces between; 'last': the colour first, then the lines as a final pass. In a video / zoom every frame gets its
// lines again (the ones that don't show yet).
let OUTL = 'off', OL = null, olI = 0, olFirst = 0;
function edgeChains() {
  const n = W * H, L = new Float32Array(n);
  for (let i = 0; i < n; i++) L[i] = 0.299 * T[i * 3] + 0.587 * T[i * 3 + 1] + 0.114 * T[i * 3 + 2];
  const B = blur2(L, Math.max(1, Math.round(Math.max(W, H) / 400))), M = new Float32Array(n), D = new Uint8Array(n);
  const at = (x, y) => B[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
    const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
    const i = y * W + x, a = Math.atan2(gy, gx); M[i] = Math.hypot(gx, gy);
    D[i] = Math.round(((a < 0 ? a + Math.PI : a) / Math.PI) * 4) % 4;      // 0: —, 1: /, 2: |, 3: \ (gradient direction)
  }
  // thin to one pixel (non-maximum suppression across the edge), then hysteresis between two thresholds
  const NB = [[1, 0], [1, 1], [0, 1], [-1, 1]], K = new Float32Array(n);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, [dx, dy] = NB[D[i]], m = M[i];
    if (m >= M[i + dy * W + dx] && m >= M[i - dy * W - dx]) K[i] = m;
  }
  const hi = Math.max(60, pctl(K.filter(v => v > 0), 0.8)), lo = hi * 0.45, E = new Uint8Array(n), st = [];
  for (let i = 0; i < n; i++) if (K[i] >= hi && !E[i]) {
    E[i] = 1; st.push(i);
    while (st.length) { const j = st.pop(), x = j % W, y = (j / W) | 0; for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) { const xx = x + u, yy = y + v; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const k = yy * W + xx; if (!E[k] && K[k] >= lo) { E[k] = 1; st.push(k); } } }
  }
  // trace: walk each line from an end (or anywhere on a loop), one neighbour at a time
  const nbs = j => { const x = j % W, y = (j / W) | 0, o = []; for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) { if (!u && !v) continue; const xx = x + u, yy = y + v; if (xx >= 0 && yy >= 0 && xx < W && yy < H && E[yy * W + xx] === 1) o.push(yy * W + xx); } return o; };
  const chains = [], minLen = Math.max(6, Math.round(Math.max(W, H) * 0.012));
  const walk = s0 => { const c = [s0]; E[s0] = 2; let j = s0; for (;;) { const o = nbs(j); if (!o.length) break; j = o[0]; E[j] = 2; c.push(j); } return c; };
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) if (E[i] === 1 && (pass || nbs(i).length === 1)) { const c = walk(i); if (c.length >= minLen) chains.push(c); }
  // each chain cut into pieces, each a quadratic stroke through its middle point
  const out = [], seg = Math.max(8, Math.round(Math.max(W, H) * 0.05)), w = Math.max(1, Math.max(W, H) * 0.0028);
  for (const c of chains) {
    const k = Math.max(1, Math.round(c.length / seg));
    for (let s = 0; s < k; s++) {
      const a = Math.floor(s * c.length / k), b = Math.min(c.length - 1, Math.floor((s + 1) * c.length / k)), m = (a + b) >> 1; if (b - a < 3) continue;
      const P = j => [c[j] % W + 0.5, ((c[j] / W) | 0) + 0.5], [x0, y0] = P(a), [x1, y1] = P(m), [x2, y2] = P(b);
      // the line's colour: the darker side of the edge, darker still
      const nx = -(y2 - y0), ny = x2 - x0, nl = Math.hypot(nx, ny) || 1, off = 2.5;
      const side = sg => { const x = Math.round(x1 + nx / nl * off * sg), y = Math.round(y1 + ny / nl * off * sg), i = Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x)); return [T[i * 3], T[i * 3 + 1], T[i * 3 + 2]]; };
      const A = side(1), Bc = side(-1), dk = (A[0] + A[1] + A[2]) < (Bc[0] + Bc[1] + Bc[2]) ? A : Bc, col = dk.map(v => v * 0.45);
      out.push({ t: 'S', a: 0.95, p: [x0, y0, 2 * x1 - (x0 + x2) / 2, 2 * y1 - (y0 + y2) / 2, x2, y2, w, Math.atan2(y2 - y0, x2 - x0)], col, len: b - a });
    }
  }
  out.sort((p, q) => q.len - p.len);         // the long lines first
  return out;
}
// one outline stroke: in one of the ticked styles, its own colour, committed to the canvas the painter compares with
function outlineShape(o, st) {
  const s = { t: 'S', p: o.p.slice(), a: o.a, st, fl: true };
  if (RELIEF_ST.includes(st)) s.p[6] = Math.max(2.5, s.p[6] * 1.6);
  evaluate(s); s.c0 = o.col.slice(); s.c1 = o.col.slice();
  return s;
}
// ── shapes filled by hand: a big patch of one colour (the sun, a sleeve, a wall) is drawn the way a person fills it in:
// its outline first, one stroke after the next all round it, then a scribble going back and forth inside it (or rows)
let RFILL = 'off', rfNext = 0;
function regionAt(sx, sy) {
  const g = Math.max(2, Math.round(Math.max(W, H) / 150)), gw = Math.ceil(W / g), gh = Math.ceil(H / g), mask = new Uint8Array(gw * gh);
  const at = (gx, gy) => (Math.min(H - 1, gy * g) * W + Math.min(W - 1, gx * g)) * 3;
  const s0 = at(Math.floor(sx / g), Math.floor(sy / g)), r0 = T[s0], g0 = T[s0 + 1], b0 = T[s0 + 2], tol = 34;
  const st = [Math.floor(sy / g) * gw + Math.floor(sx / g)]; mask[st[0]] = 1;
  let n = 0, mr = 0, mg = 0, mb = 0, err = 0, x0 = gw, y0 = gh, x1 = 0, y1 = 0;
  while (st.length) {
    const c = st.pop(), cx = c % gw, cy = (c - cx) / gw, o = at(cx, cy);
    n++; mr += T[o]; mg += T[o + 1]; mb += T[o + 2]; err += errMap[o / 3]; if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
    if (n > gw * gh * 0.35) return null;                                   // (a whole background: not a shape)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue; const j = ny * gw + nx; if (mask[j]) continue;
      const q = at(nx, ny); if (Math.abs(T[q] - r0) + Math.abs(T[q + 1] - g0) + Math.abs(T[q + 2] - b0) > tol * 3) continue;
      mask[j] = 1; st.push(j);
    }
  }
  return { mask, gw, gh, g, n, col: [mr / n, mg / n, mb / n], err: err / n, box: [x0, y0, x1, y1] };
}
// the region's outline as points round it (Moore neighbour tracing on its grid)
function regionContour(Rg) {
  const { mask, gw, gh, g } = Rg, inside = (x, y) => x >= 0 && y >= 0 && x < gw && y < gh && mask[y * gw + x] === 1;
  let sx = -1, sy = -1; for (let i = 0; i < mask.length && sx < 0; i++) if (mask[i]) { sx = i % gw; sy = (i - sx) / gw; }
  const N8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]], out = [];
  let x = sx, y = sy, d = 7;
  for (let k = 0; k < gw * gh * 2; k++) {
    out.push([(x + 0.5) * g, (y + 0.5) * g]);
    let found = false;
    for (let j = 0; j < 8; j++) { const dd = (d + 6 + j) % 8, nx = x + N8[dd][0], ny = y + N8[dd][1]; if (inside(nx, ny)) { x = nx; y = ny; d = dd; found = true; break; } }
    if (!found || (x === sx && y === sy && out.length > 2)) break;
  }
  return out;
}
function regionStroke(p0, p1, p2, w, col, a, st, tag) {
  const s = { t: 'S', p: [p0[0], p0[1], p1[0], p1[1], p2[0], p2[1], w, Math.atan2(p2[1] - p0[1], p2[0] - p0[0])], a, st, fl: true };
  evaluate(s); s.c0 = col.slice(); s.c1 = col.map(v => Math.max(0, Math.min(255, v * (0.94 + rnd() * 0.12))));
  commit(s); count++;
  postMessage({ type: 'shape', s, count, sim, gen, L: tag });
}
function regionMove(prog, tag) {
  let Rg = null;
  for (let k = 0; k < 6 && !Rg; k++) { const [x, y] = samplePos(false), r = regionAt(x, y); if (r && r.n * r.g * r.g > W * H * 0.01 && r.err > 40) Rg = r; }
  if (!Rg) return false;
  let st = styles[Math.floor(rnd() * styles.length)] || 'painterly'; if (SHAPE_ID.has(st) || NO_STROKE.has(st)) st = 'flat';
  const L = Math.max(W, H), area = Rg.n * Rg.g * Rg.g, kk = sizeK * (SSZ[st] || 1), col = Rg.col;
  // 1. the outline: one stroke after another round the shape, in its colour a little darker
  if (RFILL !== 'scribble') {
    const P = regionContour(Rg); if (P.length < 8) return false;
    const seg = Math.max(3, Math.round(P.length / Math.min(36, Math.max(6, P.length / 6)))), lw = Math.max(1.2, L * 0.004 * kk), dark = col.map(v => v * 0.55);
    for (let i = 0; i + seg <= P.length; i += seg) { const a = P[i], b = P[Math.min(P.length - 1, i + seg)], m = P[Math.min(P.length - 1, i + (seg >> 1))]; regionStroke(a, [2 * m[0] - (a[0] + b[0]) / 2, 2 * m[1] - (a[1] + b[1]) / 2], b, lw, dark, 1, st, tag); }
    const a = P[P.length - 1 - ((P.length - 1) % seg)], b = P[0]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 1) regionStroke(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b, lw, dark, 1, st, tag);
  }
  // 2. the fill, by hand: never the same twice — a looping scribble that wanders into what is still empty, or a loose
  // zigzag (uneven spacing, the angle drifting, ends overshooting or falling short, a row skipped, sometimes a second
  // pass across it); rows: line by line, just as loose
  const fw0 = Math.max(2, Math.min(L * 0.035, Math.sqrt(area) / 9) * kk), { mask, gw, gh, g } = Rg;
  const inside = (x, y) => { const gx = Math.floor(x / g), gy = Math.floor(y / g); return gx >= 0 && gy >= 0 && gx < gw && gy < gh && mask[gy * gw + gx] === 1; };
  const [bx0, by0, bx1, by1] = Rg.box, cx = (bx0 + bx1 + 1) / 2 * g, cy = (by0 + by1 + 1) / 2 * g, half = Math.hypot(bx1 - bx0 + 1, by1 - by0 + 1) * g / 2;
  const tone = () => col.map(v => v * (0.93 + rnd() * 0.14)), wid = () => fw0 * (0.7 + rnd() * 0.6);
  const curve = (A, E, amt) => { const mx = (A[0] + E[0]) / 2, my = (A[1] + E[1]) / 2, dx = E[0] - A[0], dy = E[1] - A[1], l = Math.hypot(dx, dy) || 1, b = (rnd() - 0.5) * amt; return [mx - dy / l * b, my + dx / l * b]; };
  let made = 0;
  if (RFILL !== 'rows' && rnd() < 0.55) {
    // the looping scribble: a pen that keeps turning, heads for the nearest empty part, and swings back at the edge
    const cov = new Uint8Array(gw * gh); let need = 0; for (let i = 0; i < mask.length; i++) if (mask[i]) need++;
    const r = Math.max(1, Math.round(fw0 * 0.6 / g)), mark = (x, y) => { const gx = Math.floor(x / g), gy = Math.floor(y / g); let n = 0; for (let v = -r; v <= r; v++) for (let u = -r; u <= r; u++) { const X2 = gx + u, Y2 = gy + v; if (X2 >= 0 && Y2 >= 0 && X2 < gw && Y2 < gh) { const j = Y2 * gw + X2; if (mask[j] && !cov[j]) { cov[j] = 1; n++; } } } return n; };
    let p = null; for (let k = 0; k < 40 && !p; k++) { const x = (bx0 + rnd() * (bx1 - bx0 + 1)) * g, y = (by0 + rnd() * (by1 - by0 + 1)) * g; if (inside(x, y)) p = [x, y]; }
    if (p) {
      let th = rnd() * 6.283, turn = (rnd() < 0.5 ? 1 : -1) * (0.25 + rnd() * 0.35), got = mark(p[0], p[1]), aim = null, pts = [p];
      const stepL = fw0 * (0.9 + rnd() * 0.5);
      for (let k = 0; k < 600 && got < need * 0.82 && pts.length < 220; k++) {
        if (k % 7 === 0) {           // where is it still empty? the nearest of a few empty cells
          aim = null; let bd = Infinity;
          for (let t = 0; t < 24; t++) { const j = Math.floor(rnd() * mask.length); if (!mask[j] || cov[j]) continue; const ax = (j % gw + 0.5) * g, ay = (Math.floor(j / gw) + 0.5) * g, d = Math.hypot(ax - p[0], ay - p[1]); if (d < bd) { bd = d; aim = [ax, ay]; } }
        }
        if (rnd() < 0.15) turn = -turn;                                   // the loops change hand now and then, and tighten or open
        if (rnd() < 0.1) turn = Math.sign(turn) * (0.1 + rnd() * 0.7);
        th += turn + (rnd() - 0.5) * 0.9;
        if (aim) { const want = Math.atan2(aim[1] - p[1], aim[0] - p[0]); let d = want - th; d = Math.atan2(Math.sin(d), Math.cos(d)); th += d * 0.18; }
        let q = [p[0] + Math.cos(th) * stepL, p[1] + Math.sin(th) * stepL];
        for (let t = 0; t < 8 && !inside(q[0], q[1]); t++) { th += Math.PI * (0.45 + rnd() * 0.5); q = [p[0] + Math.cos(th) * stepL, p[1] + Math.sin(th) * stepL]; }
        if (!inside(q[0], q[1])) break;
        got += mark(q[0], q[1]); pts.push(q); p = q;
      }
      // the path as strokes, two steps each, one running into the next
      for (let k = 0; k + 2 < pts.length; k += 2) { regionStroke(pts[k], pts[k + 1], pts[k + 2], wid(), tone(), 0.9, st, tag); made++; }
    }
  }
  if (!made) {
    let an = rnd() * Math.PI;
    const pass = (an, from, to, rowsOnly) => {
      const rows = []; let v = -half + (from * 2 * half);
      while (v <= -half + to * 2 * half) {
        const a2 = an + (rnd() - 0.5) * 0.25, dx = Math.cos(a2), dy = Math.sin(a2), nx = -dy, ny = dx;
        let f = null, l = null; for (let u = -half; u <= half; u += g * 0.7) { const x = cx + nx * v + dx * u, y = cy + ny * v + dy * u; if (inside(x, y)) { if (!f) f = [x, y]; l = [x, y]; } }
        if (f && Math.hypot(l[0] - f[0], l[1] - f[1]) > fw0 * 0.5 && rnd() > 0.08) {
          const sh = s2 => { const t = s2 > 0 ? 0.88 + rnd() * 0.22 : 0.85 + rnd() * 0.2, mx = (f[0] + l[0]) / 2, my = (f[1] + l[1]) / 2, P = s2 > 0 ? l : f; return [mx + (P[0] - mx) * t, my + (P[1] - my) * t]; };
          rows.push([sh(-1), sh(1)]);
        }
        v += fw0 * (RFILL === 'rows' ? 0.6 + rnd() * 0.5 : 0.7 + rnd() * 0.9); an += (rnd() - 0.5) * 0.08;
      }
      for (let k = 0; k < rows.length && made < 80; k++) {
        const [f, l] = rows[k], back = k % 2, A = back ? l : f, nxt = rows[k + 1];
        const E = rowsOnly || !nxt ? (back ? f : l) : (back ? nxt[0] : nxt[1]);
        regionStroke(A, curve(A, E, fw0 * 2.2), E, wid(), tone(), 0.92, st, tag); made++;
      }
    };
    pass(an, 0, 1, RFILL === 'rows');
    if (rnd() < 0.4) { const a = rnd() * 0.6; pass(an + 0.6 + rnd() * 0.9, a, a + 0.25 + rnd() * 0.3, RFILL === 'rows'); }     // a second pass across part of it
  }
  return true;
}
function emitOutline(o, tag) {
  let st = styles[Math.floor(rnd() * styles.length)] || 'painterly';
  if (SHAPE_ID.has(st) || NO_STROKE.has(st)) st = 'flat';          // (tiles, bars, dots… can't draw a line: plain lines instead)
  const s = outlineShape(o, st);
  commit(s); count++;
  postMessage({ type: 'shape', s, count, sim, gen, L: tag });
}
// 'first': the lines become part of the target too, so the colour fills around them instead of over them
function burnOutlines(list) {
  for (const o of list) {
    const s = { t: 'S', p: o.p, a: 1 }, ns = raster(SHP.poly(s)); if (!ns) continue; field(s, ns);
    let j = 0;
    for (let i = 0; i < ns; i++) { const row = spans[i * 3] * W; for (let x = spans[i * 3 + 1]; x <= spans[i * 3 + 2]; x++, j++) { const ai = aBuf[j]; if (ai <= 0) continue; const q = (row + x) * 3; for (let ch = 0; ch < 3; ch++) T[q + ch] = T[q + ch] * (1 - ai) + o.col[ch] * ai; } }
  }
}
// a frame of a video / zoom: the lines that don't show on the canvas yet (most missing first), up to n of them
function frameOutlines(n) {
  const list = edgeChains(), sc = [];
  for (const o of list) {
    let e = 0, k = 0; const p = o.p;
    for (let t = 0; t <= 1; t += 0.2) { const u = 1 - t, x = Math.round(u * u * p[0] + 2 * u * t * p[2] + t * t * p[4]), y = Math.round(u * u * p[1] + 2 * u * t * p[3] + t * t * p[5]); if (x < 0 || y < 0 || x >= W || y >= H) continue; const q = (y * W + x) * 3; e += Math.abs(C[q] - o.col[0]) + Math.abs(C[q + 1] - o.col[1]) + Math.abs(C[q + 2] - o.col[2]); k++; }
    if (k) sc.push([e / k, o]);
  }
  sc.sort((a, b) => b[0] - a[0]);
  return sc.slice(0, n).filter(v => v[0] > 60).map(v => v[1]);
}
function loop(g) {
  if (g !== gen || !running || endless) return;
  const t0 = performance.now();
  // outlines first: the lines go down before any colour; last: after it, as the final pass
  if (OL && OUTL === 'first' && olI < OL.length) { while (olI < OL.length && performance.now() - t0 < 25) emitOutline(OL[olI++]); setTimeout(() => loop(g), 0); return; }
  if (!loop.checked) {        // a picture the canvas already matches (one flat colour, a black first frame): nothing to paint, done at once
    loop.checked = true; let e = 0; for (let i = 0; i < errMap.length; i += 7) e += errMap[i];
    if (e / (errMap.length / 7) < 6) stuck = 3001;
  }
  // (a budget from the page, while a song plays into the paint: no further ahead than it allows — it waits for more)
  if (UNTIL != null && count >= UNTIL && count < maxShapes) { setTimeout(() => loop(g), 8); return; }
  while (running && count < maxShapes && (UNTIL == null || count < UNTIL) && performance.now() - t0 < 25) { if (step()) stuck = 0; else if (++stuck > 3000) break; }
  if ((count >= maxShapes || stuck > 3000) && OL && OUTL === 'last' && olI < OL.length) {
    while (olI < OL.length && performance.now() - t0 < 40) emitOutline(OL[olI++]);
    if (olI < OL.length) { setTimeout(() => loop(g), 0); return; }
  }
  // (a picture that can't be improved any further also counts as finished)
  if (count >= maxShapes || stuck > 3000) { running = false; rebuildCum(); postMessage({ type: 'done', count, sim, gen }); return; }
  setTimeout(() => loop(g), 0);
}

// ── endless mode (zooming canvas) ────────────────────────────
// The page sends a 'frame': the target as it looks right now (the camera keeps moving) and what is painted on
// screen right now. The painter makes a small batch of shapes against that view, tags them with the view's zoom
// level L (so the page can place them on the canvas however far it has moved since), then asks for the next view.
let anaN = 0, FRAME_OL = null, FRESH = null;
let endless = false, todo = 0, tries = 0, frameL = 0, lastAnaL = null, paused = false, stuck = 0, triesMax = 400;
let sizeK = 1, sizeRand = false, under = false, SSZ = {};
let PAL = null;                   // palette lock: [[r, g, b], …] — every stroke is painted in two of these colours   // stroke size: ×0.25 … ×4 of the usual range (the size within it stays random); random: every stroke picks its own
function loopEndless(g) {
  if (g !== gen || !running || !endless) return;
  const t0 = performance.now();
  while (todo > 0 && tries < triesMax && performance.now() - t0 < 25) {
    // mostly mid-to-fine shapes, now and then a big one for areas that are new or blown up by the zoom
    // (a new scene being pre-drawn: painted like a fresh picture, big washes first, then finer and finer)
    if (ORD && pathPic != null && passNo >= ORD.K - 1 && count - passStart > passLen * 1.5) ORD = null;     // (the sweep is done: free again)
    tries++; if (step(FRESH != null ? Math.min(1, FRESH + rnd() * 0.12) : 0.3 + 0.7 * rnd() ** 0.8, frameL)) todo--;
  }
  if (todo > 0 && tries < triesMax) { setTimeout(() => loopEndless(g), 0); return; }
  if (FRAME_OL) { for (const o of FRAME_OL) emitOutline(o, frameL); FRAME_OL = null; }
  running = false; rebuildCum(); postMessage({ type: 'need', gen, sim, count });
}
function loadFrame(m) {
  for (let i = 0, n = W * H; i < n; i++) {
    const o = i * 3, q = i * 4;
    T[o] = m.target[q]; T[o + 1] = m.target[q + 1]; T[o + 2] = m.target[q + 2];
    C[o] = m.current[q]; C[o + 1] = m.current[q + 1]; C[o + 2] = m.current[q + 2];
    errMap[i] = Math.abs(C[o] - T[o]) + Math.abs(C[o + 1] - T[o + 1]) + Math.abs(C[o + 2] - T[o + 2]);
  }
  // re-read the image's structure only after the view has moved noticeably (it takes a moment)
  // (a video: every 12th frame, and at once when a cut starts being pre-drawn)
  if (smart && (lastAnaL === null || Math.abs(m.L - lastAnaL) > 0.12 || m.fresh === 0 || ((bgStyles.length || m.video) && ++anaN % (m.video ? 12 : 20) === 0))) { analyse(); lastAnaL = m.L; }
  rebuildCum();
}

self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'start') {
    gen = m.gen; W = m.w; H = m.h; maxShapes = m.shapes; band = null; if (m.under !== undefined) under = !!m.under; if (m.lines !== undefined) LINES = !!m.lines; if (m.stylesize) SSZ = m.stylesize; if (m.size) sizeK = m.size; if (m.sizeRand !== undefined) sizeRand = !!m.sizeRand; styles = m.styles && m.styles.length ? m.styles : [m.style || 'painterly']; bgStyles = m.bgStyles || []; seed = m.seed || 12345; count = 0;
    endless = false; todo = 0; lastAnaL = 0; paused = false; stuck = 0; HURRY = 1; UNTIL = null; abstract = !!m.abstract;
    PEN = !!(m.line && m.line.kind === 'pen'); penPos = null; ORD = null; pathPic = null; PENS = []; loop.checked = false;
    smart = !!m.smart;
    T = new Float32Array(W * H * 3); C = new Float32Array(W * H * 3); errMap = new Float32Array(W * H); cum = new Float64Array(W * H);
    cumE = smart ? new Float64Array(W * H) : null;
    tBuf = new Float32Array(W * H + 16); aBuf = new Float32Array(W * H + 16); spans = new Int32Array(3 * (H + 8) * 32);
    let br = 0, bg = 0, bb = 0;
    for (let i = 0; i < W * H; i++) { T[i * 3] = m.data[i * 4]; T[i * 3 + 1] = m.data[i * 4 + 1]; T[i * 3 + 2] = m.data[i * 4 + 2]; br += T[i * 3]; bg += T[i * 3 + 1]; bb += T[i * 3 + 2]; }
    PAL = m.palette && m.palette.length ? m.palette : null;
    let bgc = [br / (W * H), bg / (W * H), bb / (W * H)];
    if (PAL) bgc = PAL.reduce((b, p) => { const d = (p[0] - bgc[0]) ** 2 + (p[1] - bgc[1]) ** 2 + (p[2] - bgc[2]) ** 2; return d < b[0] ? [d, p] : b; }, [Infinity, PAL[0]])[1].slice();
    if (smart) { const t0 = performance.now(); analyse(); self.analysisMs = performance.now() - t0; }
    // (current: a canvas that is already partly painted — the painter carries on from it, stroke count0 onwards)
    const cur = m.current;
    for (let i = 0; i < W * H; i++) {
      if (cur) { C[i * 3] = cur[i * 4]; C[i * 3 + 1] = cur[i * 4 + 1]; C[i * 3 + 2] = cur[i * 4 + 2]; }
      else { C[i * 3] = bgc[0]; C[i * 3 + 1] = bgc[1]; C[i * 3 + 2] = bgc[2]; }
      errMap[i] = Math.abs(C[i * 3] - T[i * 3]) + Math.abs(C[i * 3 + 1] - T[i * 3 + 1]) + Math.abs(C[i * 3 + 2] - T[i * 3 + 2]);
    }
    if (cur) count = Math.min(maxShapes, m.count0 || 0);
    OUTL = m.outline || 'off'; OL = null; olI = 0; RFILL = m.rfill || 'off'; rfNext = 0;
    if (OUTL !== 'off' && !(m.line && m.line.kind === 'pen')) {
      OL = edgeChains().slice(0, Math.max(20, Math.round(maxShapes * 0.35)));
      if (OUTL === 'last') maxShapes = Math.max(count + 10, maxShapes - OL.length);     // (first: they are counted as they go)
      if (OUTL === 'first') burnOutlines(OL);
    }
    orderSetup(m.order, count);
    rebuildCum();
    postMessage({ type: 'bg', c: bgc, sim, gen, analysisMs: self.analysisMs || 0 });
    if (Sub) postMessage({ type: 'mask', gen, w: W, h: H, mask: maskBytes() });
    running = true; loop(gen);
  } else if (m.type === 'frame') {
    if (m.gen !== gen || !T) return;
    // a playlist with a path (an order, or one line): the sweep starts again for every new picture and runs over its
    // strokes (then the painter carries on freely); the one line goes on from picture to picture without lifting
    const P = m.path;
    if (P) {
      PEN = !!(P.line && P.line.kind === 'pen');
      if (P.pic !== pathPic) { pathPic = P.pic; maxShapes = Math.max(40, P.total); orderSetup(P.order, 0); maxShapes = count + Math.max(40, P.total); if (ORD) { passNo = 0; passStart = count; passFails = 0; passLen = Math.max(1, (maxShapes - count) / ORD.K); } }
    } else { ORD = null; PEN = false; pathPic = null; }
    endless = true; frameL = m.L; todo = m.n; tries = 0; triesMax = Math.max(400, m.n * 16); if (m.abstract !== undefined) abstract = !!m.abstract;
    band = m.band || null; if (m.under !== undefined) under = !!m.under; if (m.lines !== undefined) LINES = !!m.lines; if (m.stylesize) SSZ = m.stylesize; if (m.size) sizeK = m.size; if (m.sizeRand !== undefined) sizeRand = !!m.sizeRand;
    if (m.outline !== undefined) OUTL = m.outline; if (m.rfill !== undefined) RFILL = m.rfill;
    FRESH = m.fresh == null ? null : m.fresh;
    loadFrame(m);
    if (OUTL !== 'off') {           // the lines that are missing from this view: before the colour or after it
      const ol = frameOutlines(Math.max(4, Math.round(m.n / 3)));
      if (OUTL === 'first') { burnOutlines(ol); for (const o of ol) emitOutline(o, frameL); rebuildCum(); }
      else FRAME_OL = ol;
    }
    if (!paused) { running = true; loopEndless(gen); }
  } else if (m.type === 'size') { sizeK = m.k; sizeRand = !!m.rand; }
  else if (m.type === 'under') under = !!m.on;
  else if (m.type === 'lines') LINES = !!m.on;
  else if (m.type === 'stylesize') SSZ = m.map || {};
  else if (m.type === 'outline') OUTL = m.on || 'off';
  else if (m.type === 'rfill') RFILL = m.on || 'off';
  else if (m.type === 'hurry') HURRY = m.k || 1;
  else if (m.type === 'until') UNTIL = m.n == null ? null : m.n;
  else if (m.type === 'accent') { if (T && !endless && !PEN && count < maxShapes) accent(m.k || 2.5); else postMessage({ type: 'accent-none', gen }); }
  else if (m.type === 'branch') { if (PEN && penPos) for (let i = 0; i < (m.n || 1) && PENS.length < 4; i++) PENS.push({ id: ++penIds, pos: penPos.slice(), life: 6 + Math.round(rnd() * 10) }); }
  else if (m.type === 'palette') PAL = m.pal && m.pal.length ? m.pal : null;
  else if (m.type === 'styles') { if (m.styles && m.styles.length) styles = m.styles; if (m.bg) bgStyles = m.bg; }
  else if (m.type === 'pause') { running = false; paused = true; }
  else if (m.type === 'resume') {
    paused = false;
    if (endless) { if (!running && todo > 0) { running = true; loopEndless(gen); } }
    else if (!running && count < maxShapes) { running = true; loop(gen); }
  }
  else if (m.type === 'stop') { running = false; gen = -1; endless = false; }
};
