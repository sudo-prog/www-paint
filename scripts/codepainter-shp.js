
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
if (typeof window !== 'undefined') window.SHP = SHP;
