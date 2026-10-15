/**
 * relief.js — WebGL2 height-map relief renderer for 3D painting styles.
 *
 * Ported faithfully from Code Painter v4.25.0's single-file relief engine.
 * Materials are drawn into a height map (height + material-id + direction
 * per pixel, plus an albedo canvas for colour) and then lit by the
 * RELIEF_FS WebGL2 fragment shader with directional lighting, soft shadows,
 * ambient-occlusion, and per-material shading (metal reflections, stone grain,
 * glass refraction, gold-leaf flakes, etc.).
 *
 * Public API:
 *   createReliefRenderer(width, height) → { begin, stamp, composite } | null
 *   reliefFlat(ctx, shape, progress, materialName)  — 2D stand-in (no WebGL)
 *   renderReliefShape(ctx, shape, progress, materialName) — entry point styles use
 *   RELIEF (material table), RELIEF_TINT, LIGHT
 *
 * When WebGL2 is unavailable, createReliefRenderer returns null and the
 * styles automatically fall back to reliefFlat — a lit 2D approximation that
 * draws each stroke as a gradient-shaded tube with cast shadow, rim light,
 * and (for clear materials) a translucent tint.
 *
 * @module relief
 */

import {
  rngFor, gaussR, lerp, clamp01,
  shade, shade2, mixHex, rgbaOf, hexRgb, rgbToHex,
  quadPts, normalAt, boxOf, shapePoly, outlinePath, offsetPts,
  shapeAxis, inPoly, gradOf
} from '../styles/base.js';

// ── Material table (ported from RELIEF in the reference) ────────────────────
// Each entry: id (shader material id), layer (how far a rope lies on what is
// under it), fuse (soft-melt radius in px), hk (height × radius), taper
// (pointed ends), bead (foam/chain), clear (glass/lens/crystal), puff.
export const RELIEF = {
  ceramic:  { id: 1, layer: 0.55, fuse: 1, hk: 0.95, taper: 0.35 },
  stone:    { id: 2, layer: 0.1, fuse: 7, hk: 0.75 },
  metal:    { id: 3, layer: 0.5, fuse: 2, hk: 0.95, taper: 0.2 },
  chrome:   { id: 6, layer: 0.35, fuse: 5, hk: 0.9, taper: 0.45 },
  glass:    { id: 17, clear: 'glass', layer: 0.5, fuse: 0, hk: 1 },
  lens:     { id: 18, clear: 'lens', layer: 0.5, fuse: 0, hk: 1 },
  crystal:  { id: 19, clear: 'crystal', layer: 0.5, fuse: 0, hk: 1 },
  gold:     { id: 10, layer: 0.5, fuse: 2, hk: 0.9, taper: 0.2 },
  bronze:   { id: 11, layer: 0.45, fuse: 3, hk: 0.85 },
  copper:   { id: 9, layer: 0.5, fuse: 2, hk: 0.9 },
  pewter:   { id: 7, layer: 0.45, fuse: 2, hk: 0.85 },
  foam:     { id: 4, layer: 0.75, fuse: 0, hk: 1, bead: 'foam' },
  beads:    { id: 12, layer: 0.75, fuse: 0, hk: 1, bead: 'chain' },
  puffy:    { id: 13, layer: 0.5, fuse: 2, hk: 1.15, puff: true },
  terrazzo: { id: 8, layer: 0.25, fuse: 5, hk: 0.7 },
  molten:   { id: 6, layer: 0.35, fuse: 5, hk: 0.9, taper: 0.45 }
};

// Tints applied to material colours (port of RELIEF_TINT)
export const RELIEF_TINT = {
  molten: '#d6d8dc',
  pewter: '#6d6f73',
  copper: '#b8673f',
  gold: '#e2b04a',
  bronze: '#8a6236',
  puffy: '#151517'
};

// Light direction (port of LIGHT)
export const LIGHT = { x: -0.62, y: -0.78 };

// ── Colour resolution (handles both engine and style shape formats) ─────────
function resolveColors(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c0 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : (typeof shape.color0 === 'string' ? shape.color0 : '#000000');
    const c1 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : (typeof shape.color1 === 'string' ? shape.color1 : '#000000');
    const o = typeof shape.alpha === 'number' ? shape.alpha : 1;
    return [c0, c1, o];
  }
  const a = shape.params;
  const i = shape.type === 'S' ? 8 : shape.type === 'T' ? 7 : 5;
  const c0 = a[i];
  const c1 = a[i + 1];
  const o = a[a.length - 1];
  return [
    Array.isArray(c0) ? rgbToHex(c0) : (typeof c0 === 'string' ? c0 : '#000000'),
    Array.isArray(c1) ? rgbToHex(c1) : (typeof c1 === 'string' ? c1 : '#000000'),
    typeof o === 'number' ? o : 1
  ];
}

// Convert an engine shape to the reference's internal {t, args, st, seed} format,
// ensuring colours are embedded in args at the expected positions.
function toReliefShape(shape) {
  const t = shape.type;
  let a = shape.params.slice();
  // Embed colours if not already present (engine shapes may use 8-element params)
  if (t === 'S' && a.length < 10) {
    const [c0, c1, o] = resolveColors(shape);
    a.push(...[hexRgb(c0), hexRgb(c1), o]);
  }
  const seed = shape.seed || a;
  return { t, args: a, st: shape.style, seed };
}

// ── WebGL2 fragment shader (ported faithfully from RELIEF_FS in the reference) ─
const RELIEF_FS = `#version 300 es
precision highp float;
uniform sampler2D uA, uH, uM, uD;
uniform vec2 uRes; uniform vec3 uL; uniform float uK;
out vec4 frag;
float H(vec2 p) { return texture(uH, p / uRes).r; }
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 7.1; a *= .5; } return s; }
vec2 ngrad(vec2 p, float f) { float e = .5; return vec2(vn((p + vec2(e, 0)) * f) - vn((p - vec2(e, 0)) * f), vn((p + vec2(0, e)) * f) - vn((p - vec2(0, e)) * f)) / (2. * e) ; }
vec2 fgrad(vec2 p, float f) { float e = 1.; return vec2(fbm((p + vec2(e, 0)) * f) - fbm((p - vec2(e, 0)) * f), fbm((p + vec2(0, e)) * f) - fbm((p - vec2(0, e)) * f)) / (2. * e); }
float spec(vec3 n, vec3 h, float s) { return pow(max(dot(n, h), 0.), s); }
vec3 env(vec3 r, vec3 tint) {
  float up = -r.y, side = r.x;
  vec3 c = mix(vec3(.04), vec3(.95), smoothstep(-.25, .35, up));
  c += vec3(1.2) * smoothstep(.55, .75, up) * smoothstep(.2, -.1, abs(side + .25) - .25);
  c *= mix(vec3(1), tint, .35);
  c += vec3(.5) * exp(-abs(up + .05) * 30.);
  return c;
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y), uv = p / uRes, ps = p / uK;
  vec4 A = texture(uA, uv);
  int m = int(texture(uM, uv).r * 255. + .5);
  float h = H(p), e1 = 1.2 * uK, e2 = 3. * uK;
  vec2 g = .55 * vec2(H(p + vec2(e1, 0)) - H(p - vec2(e1, 0)), H(p + vec2(0, e1)) - H(p - vec2(0, e1))) / (2. * e1)
         + .45 * vec2(H(p + vec2(e2, 0)) - H(p - vec2(e2, 0)), H(p + vec2(0, e2)) - H(p - vec2(0, e2))) / (2. * e2);
  float grain = hash(floor(ps * 1.3)), slope = length(g);
  if (m == 2) g += 0.55 * ngrad(ps, 1.1) + 0.25 * fgrad(ps, .12);
  else if (m == 5) g += 1.3 * fgrad(ps, .07);
  float an = texture(uD, uv).r * 3.14159; vec2 dv = vec2(cos(an), sin(an)), dn = vec2(-dv.y, dv.x);
  float streak = vn(vec2(dot(ps, dv) * .045, dot(ps, dn) * 1.6));
  if (m == 7) g += .55 * (streak - .5) * dn + .12 * ngrad(ps, .4);
  else if (m == 9) g += .55 * fgrad(ps, .06) + .15 * ngrad(ps, .8);
  else if (m == 10) g += .12 * fgrad(ps, .1);
  else if (m == 11) g += 0.35 * ngrad(ps, .5) + .2 * fgrad(ps, .12);
  else if (m == 6) g += 0.08 * ngrad(ps, 2.);
  else if (m == 8) g += 0.2 * fgrad(ps, .2);
  vec3 n = normalize(vec3(-g, 1.)), L = normalize(uL), V = vec3(0, 0, 1), Hh = normalize(L + V);
  vec2 dir = normalize(L.xy + 1e-5); float rise = L.z / max(1e-3, length(L.xy)), sh = 1., t = 1.2 * uK;
  for (int i = 0; i < 26; i++) {
    float hs = H(p + dir * t), hr = h + rise * t;
    sh = min(sh, clamp(1. - (hs - hr) / (.18 * t + 1.2 * uK), 0., 1.));
    t = t * 1.17 + .8 * uK;
  }
  sh = sh * sh * (3. - 2. * sh);
  float avg = 0.;
  for (int i = 0; i < 8; i++) { float a = float(i) * .785 + .3; avg += H(p + vec2(cos(a), sin(a)) * 5. * uK) + H(p + vec2(cos(a + .4), sin(a + .4)) * 14. * uK); }
  avg /= 16.; float ao = clamp(1. - max(0., avg - h) / (14. * uK), .35, 1.);
  float dif = max(dot(n, L), 0.), lam = dot(n, L) / max(.2, L.z);
  vec3 c = A.rgb, o;
  if (m == 0) {
    o = c * clamp(.72 + .28 * lam, .25, 1.35) * (.42 + .58 * sh) * ao;
  } else if (m == 1) {
    vec3 b = mix(c, vec3(.97, .94, .88), .12);
    o = b * (.2 + .88 * dif * sh) * ao + vec3(1.15) * spec(n, Hh, 140.) * sh + vec3(.14) * spec(n, Hh, 14.) * sh + b * .18 * pow(1. - n.z, 2.);
  } else if (m == 2) {
    vec3 b = c * (.78 + .4 * grain) * (.85 + .3 * fbm(ps * .05));
    o = b * (.16 + .95 * dif * sh) * ao + vec3(.07) * grain * dif * sh;
  } else if (m == 3) {
    float band = .5 + .5 * sin(n.x * 9. + n.y * 13.), sl = length(n.xy);
    float v = clamp(.12 + .5 * dif * sh + .45 * band * smoothstep(.04, .3, sl) * (.4 + .6 * sh) - .35 * (1. - ao), 0., 1.);
    vec3 lo = c * .1, mid = c * .9, hi = mix(c, vec3(1), .85);
    o = v < .5 ? mix(lo, mid, v * 2.) : mix(mid, hi, (v - .5) * 2.);
    o += vec3(1.3) * spec(n, Hh, 220.) * sh + mix(c, vec3(1), .6) * .35 * spec(n, Hh, 30.) * sh;
  } else if (m == 4) {
    float w = clamp((dot(n, L) + .45) / 1.45, 0., 1.);
    o = c * (.22 + .9 * w * mix(1., sh, .85)) * ao + vec3(.18) * spec(n, Hh, 22.) * sh + c * .08 * (1. - sh);
  } else if (m == 5) {
    o = c * (.24 + .86 * dif * sh) * ao + vec3(.05) * spec(n, Hh, 9.) * sh;
  } else if (m == 6) {
    float sl = length(n.xy), fa = dot(n.xy / max(sl, 1e-4), normalize(L.xy + 1e-5));
    float e = .3 + .8 * smoothstep(.05, .5, sl) * (.5 + .5 * fa) + .7 * exp(-pow((sl - .32) * 7., 2.)) * (.6 + .4 * fa) - .2 * smoothstep(.55, .9, sl);
    e += .25 * smoothstep(.6, .95, -fa) * smoothstep(.2, .6, sl);
    o = vec3(e) * mix(vec3(1), c * 1.35, .6) * (.5 + .5 * sh) * ao + vec3(2.) * spec(n, Hh, 320.) * sh + (grain - .5) * .035;
  } else if (m == 7) {
    vec3 b = mix(c, vec3(.62, .63, .66), .5); float th = dot(vec3(dv, 0.), Hh);
    float aniso = pow(sqrt(max(0., 1. - th * th)) * max(dot(n, Hh), 0.), 36.);
    o = b * (.18 + .72 * dif * sh) * ao + vec3(.85) * aniso * sh * (.5 + streak) + b * .1 * streak;
  } else if (m == 8) {
    vec2 cell = floor(ps / 13.), f = fract(ps / 13.) - .5; float hc = hash(cell), hv = hash(cell + 3.7);
    vec2 off = vec2(hash(cell + 1.3), hash(cell + 7.1)) - .5;
    vec3 b = mix(c, vec3(.95, .93, .9), .2);
    float chip = step(length((f - off * .4) * vec2(1., .7 + .6 * hv)), .18 + .14 * hash(cell + 2.2));
    if (hc > .55 && chip > .5) b = hv < .33 ? vec3(.13) : hv < .66 ? vec3(.93, .91, .87) : c * .5;
    o = b * (.22 + .85 * dif * sh) * ao + vec3(.35) * spec(n, Hh, 70.) * sh;
  } else if (m == 9) {
    vec3 cu = mix(vec3(.80, .42, .26), c, .2), r = reflect(vec3(0, 0, -1), n);
    vec3 shine = cu * (.1 + .6 * dif * sh) * ao + cu * env(r, cu) * .5 * (.5 + .5 * sh) + mix(cu, vec3(1), .4) * spec(n, Hh, 50.) * 1.2 * sh;
    float pa = smoothstep(.15, .6, (1. - ao) * 2.2 + max(0., avg - h) / (5. * uK) + .45 * (fbm(ps * .04) - .45));
    vec3 verd = vec3(.32, .62, .52) * (.75 + .45 * fbm(ps * .09));
    o = mix(shine, verd * (.3 + .7 * dif * sh) * ao, pa * .92);
  } else if (m == 10) {
    vec2 cs = ps / 26., ic = floor(cs), id = ic; float d1 = 9., d2 = 9.;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 c2 = ic + vec2(i, j), pt = c2 + vec2(hash(c2), hash(c2 + 5.1)); float dd = length(cs - pt); if (dd < d1) { d2 = d1; d1 = dd; id = c2; } else if (dd < d2) d2 = dd; }
    float crack = smoothstep(0., .06, d2 - d1), hc = hash(id);
    vec3 n2 = normalize(n + vec3((hash(id + 1.3) - .5) * .22, (hash(id + 2.7) - .5) * .22, 0.)), H2 = normalize(L + V), r = reflect(vec3(0, 0, -1), n2);
    vec3 au = mix(vec3(1., .78, .34), c, .12);
    o = (au * (.12 + .5 * max(dot(n2, L), 0.) * sh) * ao + au * env(r, au) * .62 * (.6 + .4 * sh) + vec3(1., .9, .6) * spec(n2, H2, 90.) * 1.3 * sh) * (.9 + .18 * hc) * mix(.55, 1., crack);
  } else if (m == 11) {
    vec3 bz = mix(vec3(.72, .52, .28), c, .2), r = reflect(vec3(0, 0, -1), n);
    vec3 pol = bz * (.1 + .6 * dif * sh) * ao + bz * env(r, bz) * .42 * (.5 + .5 * sh) + mix(bz, vec3(1), .45) * spec(n, Hh, 70.) * 1.1 * sh;
    vec3 pat = mix(vec3(.24, .29, .21), vec3(.36, .42, .32), fbm(ps * .06)) * (.45 + .65 * dif * sh) * ao;
    o = mix(pat, pol, smoothstep(-2.5 * uK, 2. * uK, h - avg));
  } else if (m == 12) {
    vec3 b = c * 1.05;
    o = b * (.18 + .85 * dif * sh) * ao + vec3(1.2) * spec(n, Hh, 180.) * sh + b * .25 * pow(1. - n.z, 3.);
  } else if (m == 14) {
    o = c * (.28 + .8 * dif * sh) * ao + vec3(.15) * spec(n, Hh, 20.) * sh + vec3(.07) * spec(n, Hh, 5.) * sh;
  } else if (m == 16) {
    o = c * (.26 + .84 * dif * sh) * ao + vec3(.26) * spec(n, Hh, 60.) * sh + vec3(.05) * spec(n, Hh, 8.) * sh;
  } else if (m == 15) {
    o = c * (.3 + .78 * dif * sh) * ao + vec3(.07) * spec(n, Hh, 9.) * sh;
  } else if (m >= 17 && m <= 19) {
    vec2 gg = g;
    if (m == 17) gg += 3.2 * fgrad(ps, .05) + .35 * ngrad(ps, .3);
    vec3 n2 = normalize(vec3(-gg, 1.)), H2 = normalize(L + V);
    float ior = m == 18 ? 16. : m == 19 ? 12. : 9.;
    vec2 off = clamp(gg, -2.5, 2.5) * ior * uK;
    vec3 bent;
    if (m == 19) bent = vec3(texture(uA, (p + off * .94) / uRes).r, texture(uA, (p + off) / uRes).g, texture(uA, (p + off * 1.08) / uRes).b);
    else bent = texture(uA, (p + off) / uRes).rgb;
    vec3 r = reflect(vec3(0, 0, -1), n2);
    float fr = .05 + .95 * pow(1. - clamp(n2.z, 0., 1.), 4.);
    float thick = clamp(length(gg) * .6, 0., 1.);
    o = bent * (.82 + .25 * dif) * mix(1., .62, thick * (m == 17 ? .3 : 1.));
    o += env(r, vec3(1)) * fr * .55;
    o += vec3(1.8) * spec(n2, H2, m == 19 ? 900. : 500.) * sh + vec3(.12) * spec(n2, H2, 30.) * sh;
    if (m == 18) o += bent * .22 * smoothstep(.2, 1., n2.z) * dif;
    if (m == 19) { float tw = hash(floor(ps / 3.)); o += vec3(2.) * step(.992, tw) * smoothstep(.3, .8, spec(n2, H2, 40.)) * sh; }
    if (m == 17) {
      float me = texture(uD, uv).r, lead = 0.;
      for (int i = 0; i < 8; i++) { float a = float(i) * .785; vec2 q2 = (p + vec2(cos(a), sin(a)) * 2.6 * uK) / uRes;
        if (int(texture(uM, q2).r * 255. + .5) != 17 || abs(texture(uD, q2).r - me) > .002) lead = 1.; }
      if (lead > .5) o = vec3(.16, .16, .17) * (.5 + .7 * dif * sh) + vec3(.6) * spec(n, Hh, 30.) * sh;
    }
  } else {
    o = c * (.3 + .7 * dif * sh) * ao + vec3(.85) * spec(n, Hh, 70.) * sh + vec3(.12) * spec(n, Hh, 6.) * sh + vec3(.18) * pow(1. - n.z, 3.) * sh;
  }
  frag = vec4(clamp(o, 0., 1.) * A.a, A.a);
}`;

// ── Height-map helpers (ported from the reference's relief engine) ──────────

/**
 * Sample the height map at a point.
 */
function hAt(R, x, y) {
  const i = Math.round(x), j = Math.round(y);
  if (i < 0 || j < 0 || i >= R.w || j >= R.h) return 0;
  return R.H[j * R.w + i];
}

/**
 * Draw a shape filled/stroked onto a 2D context (port of fillShape).
 */
function fillShape(ctx, shape, style) {
  const a = shape.args || shape.params;
  if ((shape.t || shape.type) === 'S') {
    ctx.strokeStyle = style;
    ctx.lineWidth = a[6];
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo(a[2], a[3], a[4], a[5]);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = style;
  outlinePath(ctx, shape);
  ctx.fill();
}

/**
 * Two-pass chamfer distance transform (port from reliefSlab / reliefClear).
 */
function chamferDist(A, w, h) {
  const D = new Float32Array(w * h);
  const BIG = 1e6;
  for (let i = 0; i < D.length; i++) D[i] = A[i] > 0.5 ? BIG : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!D[i]) continue;
      let v = D[i];
      if (x > 0) v = Math.min(v, D[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, D[i - w] + 1);
        if (x > 0) v = Math.min(v, D[i - w - 1] + 1.414);
        if (x < w - 1) v = Math.min(v, D[i - w + 1] + 1.414);
      }
      D[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!D[i]) continue;
      let v = D[i];
      if (x < w - 1) v = Math.min(v, D[i + 1] + 1);
      if (y < h - 1) {
        v = Math.min(v, D[i + w] + 1);
        if (x < w - 1) v = Math.min(v, D[i + w + 1] + 1.414);
        if (x > 0) v = Math.min(v, D[i + w - 1] + 1.414);
      }
      D[i] = v;
    }
  }
  return D;
}

/**
 * Create a mask from a shape at relief scale k.
 * Port of maskOf.
 */
function maskOf(shape, k, pad = 2) {
  const P = shapePoly(shape);
  const b = boxOf(P);
  const x0 = Math.floor(b.x0 * k) - pad;
  const y0 = Math.floor(b.y0 * k) - pad;
  const w = Math.ceil(b.x1 * k) + pad - x0;
  const h = Math.ceil(b.y1 * k) + pad - y0;
  if (w <= 0 || h <= 0 || w * h > 9e6) return null;

  if (!SLAB.cv) {
    SLAB.cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (!SLAB.cv) return null;
    SLAB.x = SLAB.cv.getContext('2d', { willReadFrequently: true });
  }
  if (SLAB.cv.width < w || SLAB.cv.height < h) {
    SLAB.cv.width = Math.max(SLAB.cv.width, w);
    SLAB.cv.height = Math.max(SLAB.cv.height, h);
  }
  const x = SLAB.x;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, w, h);
  x.setTransform(k, 0, 0, k, -x0, -y0);
  x.fillStyle = '#fff';
  x.strokeStyle = '#fff';
  const t = shape.t || shape.type;
  if (t === 'S') {
    const a = shape.args || shape.params;
    x.lineWidth = a[6];
    fillShape(x, { t, args: a }, '#fff');
  } else {
    outlinePath(x, shape);
    x.fill();
  }
  const d = x.getImageData(0, 0, w, h).data;
  const A = new Float32Array(w * h);
  for (let i = 0; i < A.length; i++) A[i] = d[i * 4 + 3] / 255;
  return { A, x0, y0, w, h };
}

const SLAB = { cv: null, x: null };

/**
 * Merge a height patch into the relief's height/material/direction maps.
 * Port of reliefMerge.
 */
function reliefMerge(R, patch, x0, y0, pw, ph, m, ang = 0, press = 1) {
  const Dt = R.D;
  const dv = Math.round(((ang % Math.PI) + Math.PI) % Math.PI / Math.PI * 255);
  const H = R.H;
  const Mt = R.M;
  const k = m.fuse * R.u;
  const id = m.id;
  const knee = 30 * R.u;
  const cap = 44 * R.u;
  for (let i = 0; i < patch.length; i++) {
    const v = patch[i];
    if (v > knee) patch[i] = knee + (v - knee) * 0.3;
  }
  for (let y = 0; y < ph; y++) {
    const row = (y + y0) * R.w + x0;
    for (let x = 0; x < pw; x++) {
      const v = patch[y * pw + x];
      if (v <= 0) continue;
      const i = row + x;
      const o = H[i] * press;
      if (v >= o - 0.25) { Mt[i] = id; Dt[i] = dv; }
      if (k > 0) {
        const d = Math.abs(v - o);
        H[i] = Math.min(cap, Math.max(v, o) + (d < k ? (k - d) * (k - d) / (4 * k) : 0));
      } else {
        H[i] = Math.min(cap, Math.max(v, o));
      }
    }
  }
}

/**
 * Draw the rope's / slab's colour into the albedo canvas.
 * Port of reliefAlbedo.
 */
function reliefAlbedo(ctx, shape, m) {
  const [c0, c1] = resolveColors(shape);
  const tint = RELIEF_TINT[shape.st || shape.style];
  const col = c => tint ? mixHex(tint, c, shape.st === 'puffy' ? 0.12 : shape.st === 'molten' ? 0.6 : 0.28) : c;
  ctx.save();
  ctx.globalAlpha = 1;
  const t = shape.t || shape.type;
  if (t === 'S') {
    const a = shape.args || shape.params;
    const P = quadPts(a, 1, 1, 16);
    const w = a[6] * (m.bead === 'foam' ? 1.25 : 1.04);
    ctx.lineCap = 'round';
    ctx.lineWidth = w;
    for (let i = 0; i < P.length - 1; i++) {
      ctx.strokeStyle = col(mixHex(c0, c1, i / (P.length - 2)));
      ctx.beginPath();
      ctx.moveTo(P[i][0], P[i][1]);
      ctx.lineTo(P[i + 1][0], P[i + 1][1]);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = gradOf(ctx, shape, [[0, col(c0)], [1, col(c1)]]);
    outlinePath(ctx, shape);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = col(c1);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Compute the points along a rope's curve, each with a radius.
 * Port of ropePts.
 */
function ropePts(shape, m, k, rnd) {
  const a = shape.args || shape.params;
  const P = quadPts(a, 1, 1, 64);
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const len = cum[cum.length - 1] * k;
  const R0 = Math.max(1.2, a[6] * k / 2);
  const out = [];
  const at = s => {
    let j = 1;
    while (j < cum.length - 1 && cum[j] < s) j++;
    const f = (s - cum[j - 1]) / ((cum[j] - cum[j - 1]) || 1);
    return [(P[j - 1][0] + (P[j][0] - P[j - 1][0]) * f) * k, (P[j - 1][1] + (P[j][1] - P[j - 1][1]) * f) * k];
  };
  if (m.bead) {
    const chain = m.bead === 'chain';
    const r = chain ? Math.max(1.5, R0 * 0.9) : R0;
    const step = chain ? r * 1.9 : r * 1.05;
    for (let s = 0; s <= len / k + 1e-6; s += step / k) {
      const p = at(s);
      const rr = chain ? r : r * (0.72 + 0.5 * rnd());
      out.push({ x: p[0], y: p[1], r: rr, s: s * k / (len || 1) });
      if (step / k <= 0) break;
    }
    if (!out.length) { const p = at(0); out.push({ x: p[0], y: p[1], r: R0, s: 0 }); }
    return { pts: out, beads: true, R0 };
  }
  const n = Math.max(2, Math.min(80, Math.ceil(len / Math.max(1.5, R0 * 0.5))));
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const p = at(s * cum[cum.length - 1]);
    let r = R0;
    if (m.taper) {
      const sf = s * (shape.part || 1);
      const e = Math.min(sf, 1 - sf) / m.taper;
      if (e < 1) r *= 0.35 + 0.65 * Math.sqrt(Math.max(0, e));
    }
    out.push({ x: p[0], y: p[1], r, s });
  }
  return { pts: out, beads: false, R0 };
}

/**
 * Split a wide stroke into strands (port of strandsOf).
 */
function strandsOf(shape, R) {
  const a = shape.args || shape.params;
  const rnd = rngFor(shape.seed || a);
  const w = a[6];
  const n = Math.min(3, Math.ceil(w * R.k / (60 * R.u)));
  const out = [];
  const nrm = (ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay;
    const l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  };
  const n0 = nrm(a[0], a[1], a[2], a[3]);
  const n1 = nrm(a[0], a[1], a[4], a[5]);
  const n2 = nrm(a[2], a[3], a[4], a[5]);
  for (let i = 0; i < n; i++) {
    const off = ((i + 0.5) / n - 0.5) * w * 0.7 + (rnd() - 0.5) * w / n * 0.3;
    const sw = w / n * (1.35 + rnd() * 0.3);
    const pt = shape.part || 1;
    const s0 = Math.min(0.5, rnd() * 0.08 / pt);
    const r1 = rnd();
    const s1 = pt < 1 ? 1 : 1 - r1 * 0.08;
    const A = [a[0] + n0[0] * off, a[1] + n0[1] * off];
    const C = [a[2] + n1[0] * off * (1 + (rnd() - 0.5) * 0.2), a[3] + n1[1] * off];
    const B = [a[4] + n2[0] * off, a[5] + n2[1] * off];
    const at = t => {
      const u = 1 - t;
      return [u * u * A[0] + 2 * u * t * C[0] + t * t * B[0], u * u * A[1] + 2 * u * t * C[1] + t * t * B[1]];
    };
    const p0 = at(s0), p2 = at(s1), pm = at((s0 + s1) / 2);
    const cx = 2 * pm[0] - (p0[0] + p2[0]) / 2;
    const cy = 2 * pm[1] - (p0[1] + p2[1]) / 2;
    out.push({ ...shape, strand: true, args: [p0[0], p0[1], cx, cy, p2[0], p2[1], sw, ...a.slice(7)], seed: [...(shape.seed || a).slice(0, 6).map(v => v + i * 7.3), i] });
  }
  return out;
}

/**
 * Raise a rope into the height map.
 * Port of reliefRope.
 */
function reliefRope(R, shape, m) {
  const rnd = rngFor(shape.seed || (shape.args || shape.params));
  const { pts, beads, R0 } = ropePts(shape, m, R.k, rnd);
  const top = 18 * R.u;
  const base = pts.map(p => Math.min(top, hAt(R, p.x, p.y)) * Math.max(m.layer, 0.85));
  const sm = Math.max(3, Math.min(40, Math.round(R0 * 2.5 / Math.max(1, (pts.length > 1 ? Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) : 1)))));
  for (let pass = 0; pass < sm; pass++) {
    for (let i = 1; i < base.length - 1; i++) {
      base[i] = (base[i - 1] + base[i] * 2 + base[i + 1]) / 4;
    }
  }
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of pts) { x0 = Math.min(x0, p.x - p.r); y0 = Math.min(y0, p.y - p.r); x1 = Math.max(x1, p.x + p.r); y1 = Math.max(y1, p.y + p.r); }
  x0 = Math.max(0, Math.floor(x0) - 1);
  y0 = Math.max(0, Math.floor(y0) - 1);
  x1 = Math.min(R.w - 1, Math.ceil(x1) + 1);
  y1 = Math.min(R.h - 1, Math.ceil(y1) + 1);
  const pw = x1 - x0 + 1;
  const ph = y1 - y0 + 1;
  if (pw <= 0 || ph <= 0) return;
  const patch = new Float32Array(pw * ph);
  const hk = m.hk;
  const puff = m.puff;
  const cap = 13 * R.u;
  const prof = (r, d2) => {
    const v = Math.sqrt(Math.max(0, 1 - d2 / (r * r)));
    const hr = r < cap ? r : cap + (r - cap) * 0.25;
    return hr * (puff ? Math.pow(v, 0.55) : v);
  };
  if (beads) {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const b = base[i];
      const bx0 = Math.max(x0, Math.floor(p.x - p.r));
      const bx1 = Math.min(x1, Math.ceil(p.x + p.r));
      const by0 = Math.max(y0, Math.floor(p.y - p.r));
      const by1 = Math.min(y1, Math.ceil(p.y + p.r));
      for (let y = by0; y <= by1; y++) {
        for (let x = bx0; x <= bx1; x++) {
          const dx = x - p.x;
          const dy = y - p.y;
          const d2 = dx * dx + dy * dy;
          if (d2 >= p.r * p.r) continue;
          const v = b + hk * prof(p.r, d2);
          const o = (y - y0) * pw + x - x0;
          if (v > patch[o]) patch[o] = v;
        }
      }
    }
  } else {
    for (let i = 0; i < pts.length - 1; i++) {
      const A = pts[i];
      const B = pts[i + 1];
      const rm = Math.max(A.r, B.r);
      const ex = B.x - A.x;
      const ey = B.y - A.y;
      const L2 = ex * ex + ey * ey || 1e-6;
      for (let y = Math.max(y0, Math.floor(Math.min(A.y, B.y) - rm)); y <= Math.min(y1, Math.ceil(Math.max(A.y, B.y) + rm)); y++) {
        for (let x = Math.max(x0, Math.floor(Math.min(A.x, B.x) - rm)); x <= Math.min(x1, Math.ceil(Math.max(A.x, B.x) + rm)); x++) {
          let t = ((x - A.x) * ex + (y - A.y) * ey) / L2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const dx = x - A.x - ex * t;
          const dy = y - A.y - ey * t;
          const d2 = dx * dx + dy * dy;
          const r = A.r + (B.r - A.r) * t;
          if (d2 >= r * r) continue;
          const v = base[i] + (base[i + 1] - base[i]) * t + hk * prof(r, d2);
          const o = (y - y0) * pw + x - x0;
          if (v > patch[o]) patch[o] = v;
        }
      }
    }
  }
  reliefMerge(R, patch, x0, y0, pw, ph, m, Math.atan2((shape.args || shape.params)[5] - (shape.args || shape.params)[1], (shape.args || shape.params)[4] - (shape.args || shape.params)[0]), 0.6);
}

/**
 * Raise a slab into the height map.
 * Port of reliefSlab.
 */
function reliefSlab(R, shape, m) {
  const M = maskOf(shape, R.k);
  if (!M) return;
  const { A, x0, y0, w, h } = M;
  const D = chamferDist(A, w, h);
  let dmax = 0;
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (D[i] > dmax) dmax = D[i];
    }
  }
  const cap = Math.max(2, Math.min(dmax, 13 * R.u));
  const hk = m.hk;
  const rnd = rngFor(shape.args || shape.params);
  const dome = Math.min(2.2 * cap, Math.max(0, dmax - cap) * 0.45);
  let g = 0;
  for (let i = 0; i < 6; i++) {
    g = Math.max(g, hAt(R, x0 + w * (0.2 + 0.6 * rnd()), y0 + h * (0.2 + 0.6 * rnd())));
  }
  g = Math.min(18 * R.u, g * m.layer);
  const patch = new Float32Array(w * h);
  for (let i = 0; i < D.length; i++) {
    const d = D[i] + (A[i] > 0.5 ? 0 : A[i] - 0.5);
    if (d <= 0) continue;
    const t = Math.min(1, d / cap);
    const sh = Math.sqrt(1 - (1 - t) * (1 - t));
    patch[i] = g + hk * (cap * (m.puff ? Math.pow(sh, 0.6) : sh) + dome * Math.sqrt(Math.max(0, d - cap) / Math.max(1, dmax - cap)));
  }
  if (m.bristle) {
    const an = rnd() * Math.PI;
    const dx = Math.cos(an);
    const dy = Math.sin(an);
    const fr = 2 * Math.PI / (10 * R.u);
    const ph = [rnd() * 6, rnd() * 6];
    for (let i = 0; i < patch.length; i++) {
      if (patch[i] > g) {
        const px = i % w;
        const py = (i / w) | 0;
        const along = px * dy - py * dx;
        const wav = Math.sin(along * 0.03 + ph[0]) * 3 + Math.sin(along * 0.011 + ph[1]) * 6;
        patch[i] = g + (patch[i] - g) * (0.88 + 0.12 * (0.5 - 0.5 * Math.cos((px * dx + py * dy + wav) * fr)));
      }
    }
  }
  if (m.bead) {
    patch.fill(0);
    const n = Math.min(400, Math.max(3, Math.round(w * h / (Math.PI * cap * cap * 0.35))));
    for (let k = 0; k < n; k++) {
      const cx = rnd() * w;
      const cy = rnd() * h;
      const i0 = Math.min(w * h - 1, Math.floor(cy) * w + Math.floor(cx));
      if (A[i0] < 0.5) continue;
      const r = Math.max(1.5, Math.min(D[i0] + 1, cap) * (0.6 + 0.6 * rnd()));
      for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.ceil(cy + r)); y++) {
        for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.ceil(cx + r)); x++) {
          const d2 = (x - cx) ** 2 + (y - cy) ** 2;
          if (d2 >= r * r) continue;
          const v = g + hk * Math.sqrt(r * r - d2);
          const o = y * w + x;
          if (v > patch[o]) patch[o] = v;
        }
      }
    }
  }
  // Clip to canvas bounds
  const cx0 = Math.max(0, x0);
  const cy0 = Math.max(0, y0);
  const cx1 = Math.min(R.w, x0 + w);
  const cy1 = Math.min(R.h, y0 + h);
  if (cx1 <= cx0 || cy1 <= cy0) return;
  const pw = cx1 - cx0;
  const ph = cy1 - cy0;
  const P2 = new Float32Array(pw * ph);
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      P2[y * pw + x] = patch[(y + cy0 - y0) * w + x + cx0 - x0];
    }
  }
  const a = shape.args || shape.params;
  reliefMerge(R, P2, cx0, cy0, pw, ph, m, (shape.t || shape.type) === 'E' || (shape.t || shape.type) === 'B' || (shape.t || shape.type) === 'R' ? (a[4] || 0) : 0);
}

/**
 * Raise a clear material (glass/lens/crystal) into the height map.
 * Port of reliefClear.
 */
function reliefClear(R, shape, m) {
  const M = maskOf(shape, R.k, 2);
  if (!M) return;
  const { A, x0, y0, w, h } = M;
  const [c0, c1, o] = resolveColors(shape);
  const rnd = rngFor(shape.seed || (shape.args || shape.params));
  const kind = m.clear;
  const ax = R.ax;
  const k = R.k;
  ax.save();
  ax.setTransform(k, 0, 0, k, 0, 0);
  const tw = kind === 'glass' ? 0.1 : kind === 'lens' ? 0.5 : 0.35;
  ax.globalAlpha = (kind === 'glass' ? 0.55 : kind === 'lens' ? 0.18 : 0.3) * Math.min(1, o + 0.1);
  const G = gradOf(ax, shape, [[0, mixHex(c0, '#ffffff', tw)], [1, mixHex(c1, '#ffffff', tw)]]);
  const t = shape.t || shape.type;
  if (t === 'S') {
    const a = shape.args || shape.params;
    fillShape(ax, { t, args: a }, G);
  } else {
    ax.fillStyle = G;
    outlinePath(ax, shape);
    ax.fill();
  }
  ax.restore();
  const D = chamferDist(A, w, h);
  let dmax = 1;
  for (let i = 0; i < D.length; i++) if (D[i] > dmax) dmax = D[i];
  const u = R.u;
  const piece = 1 + Math.floor(rnd() * 254);
  const top = 18 * u;
  const hmax = kind === 'lens' ? Math.min(dmax * 0.7, 34 * u) : kind === 'crystal' ? Math.min(dmax * 0.55, 30 * u) : 0;
  const bev = 3 * u;
  for (let y = 0; y < h; y++) {
    const yy = y + y0;
    if (yy < 0 || yy >= R.h) continue;
    for (let x = 0; x < w; x++) {
      const xx = x + x0;
      if (xx < 0 || xx >= R.w) continue;
      const a = A[y * w + x];
      if (a <= 0.5) continue;
      const i = yy * R.w + xx;
      const d = D[y * w + x];
      const f = d / dmax;
      const base = Math.min(top, R.H[i]) * 0.4;
      let hh;
      if (kind === 'lens') hh = hmax * Math.sqrt(Math.max(0, 1 - (1 - f) * (1 - f)));
      else if (kind === 'crystal') {
        hh = hmax * f + 2 * u;
        // facets: straight sections between breaks
        const facet = Math.floor(d / bev) * bev;
        if (d > facet + bev * 0.3) hh = hmax * Math.sqrt(Math.max(0, 1 - (1 - (facet + bev) / dmax) * (1 - (facet + bev) / dmax))) + 2 * u;
      } else {
        hh = 5 * u * Math.min(1, d / bev); // glass: bevelled at its edge
      }
      R.H[i] = base + hh;
      R.M[i] = m.id;
      R.D[i] = piece;
    }
  }
}

/**
 * Add a shape to the relief height map.
 * Port of reliefAdd.
 */
function reliefAdd(R, shape) {
  const m = RELIEF[shape.st || shape.style];
  if (!m) return;
  if (R.scratch || !shape.strand && !shape.sub) {
    if (++R.added >= 32) {
      R.added = 0;
      for (let i = 0; i < R.H.length; i++) R.H[i] *= 0.985;
    }
  }

  const t = shape.t || shape.type;
  const a = shape.args || shape.params;

  if (m.clear) {
    reliefClear(R, shape, m);
    R.dirty = true;
    return;
  }

  // Wide strokes split into strands
  if (!m.bristle && t === 'S' && !shape.strand && a[6] * R.k > 70 * R.u) {
    const strands = strandsOf(shape, R);
    for (const sq of strands) reliefAdd(R, sq);
    R.dirty = true;
    return;
  }

  if (m.bristle) {
    // Oil/acrylic/knife bristle brushes — not among our 16 materials.
    // Still deposit the albedo colour; height would need bristle-specific code.
    reliefAlbedo(R.ax, shape, m);
  } else {
    reliefAlbedo(R.ax, shape, m);
    if (t === 'S') reliefRope(R, shape, m);
    else reliefSlab(R, shape, m);
  }
  R.dirty = true;
}

// ── WebGL2 renderer factory ──────────────────────────────────────────────────

let _glr = null;       // WebGL renderer (cached), false when unavailable
let _activeRelief = null;  // active relief for the current render

/**
 * Create or return the cached WebGL2 relief renderer.
 * Port of reliefGL from the reference.
 * @returns {object|null}
 */
function getGLR() {
  if (_glr !== null) return _glr;
  _glr = false;
  try {
    if (typeof document === 'undefined') return false;
    const cv = document.createElement('canvas');
    const gl = cv.getContext('webgl2', { premultipliedAlpha: true, antialias: false });
    if (!gl) return false;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, '#version 300 es\nin vec2 a; void main() { gl_Position = vec4(a, 0, 1); }'));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, RELIEF_FS));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = (unit, filter) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    const T = { A: tex(0, gl.LINEAR), H: tex(1, gl.LINEAR), M: tex(2, gl.NEAREST), D: tex(3, gl.NEAREST) };
    const U = n => gl.getUniformLocation(pr, n);
    gl.uniform1i(U('uA'), 0);
    gl.uniform1i(U('uH'), 1);
    gl.uniform1i(U('uM'), 2);
    gl.uniform1i(U('uD'), 3);
    _glr = { cv, gl, T, uRes: U('uRes'), uL: U('uL'), uK: U('uK'), max: gl.getParameter(gl.MAX_TEXTURE_SIZE) };
  } catch (e) {
    console.warn('relief: no WebGL 2 lighting', e);
    _glr = false;
  }
  return _glr;
}

/**
 * Create a WebGL2 relief renderer.
 * @param {number} width - Canvas width in pixels.
 * @param {number} height - Canvas height in pixels.
 * @returns {{begin:Function, stamp:Function, composite:Function}|null}
 */
export function createReliefRenderer(width, height) {
  const glr = getGLR();
  if (!glr) return null;
  const maxTex = glr.max;
  // Cap dimensions to max texture size
  const w = Math.min(width, maxTex);
  const h = Math.min(height, maxTex);
  if (w <= 0 || h <= 0) return null;

  const k = 1;
  const u = Math.max(w, h) / 1000;

  const R = {
    w, h, k, u,
    alb: null,  // will be a canvas
    H: new Float32Array(w * h),
    M: new Uint8Array(w * h),
    D: new Uint8Array(w * h),
    dirty: true,
    added: 0
  };

  // Albedo canvas
  R.alb = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!R.alb) return null;
  R.alb.width = w;
  R.alb.height = h;
  R.ax = R.alb.getContext('2d');

  return {
    /**
     * Reset the relief buffers and seed the albedo from a background canvas.
     * @param {CanvasImageSource} [bg] - Optional background to draw into albedo.
     */
    begin(bg) {
      R.H.fill(0);
      R.M.fill(0);
      R.D.fill(0);
      R.ax.setTransform(1, 0, 0, 1, 0, 0);
      R.ax.clearRect(0, 0, w, h);
      R.added = 0;
      R.dirty = true;
      if (bg) R.ax.drawImage(bg, 0, 0, w, h);
    },

    /**
     * Stamp a shape into the relief height/material/direction buffers.
     * @param {object} shape - Shape object ({type, params, color0, color1, alpha, style, seed}).
     * @param {object} [materialDef] - Material definition (from RELIEF table).
     */
    stamp(shape, materialDef) {
      const m = materialDef || RELIEF[shape.style];
      if (!m) return;
      const rs = toReliefShape(shape);
      rs.st = shape.style;
      reliefAdd(R, rs);
    },

    /**
     * Run the RELIEF_FS shader over the height buffers and blit the lit
     * result to the given 2D canvas context.
     * @param {CanvasRenderingContext2D} ctx
     * @returns {boolean} true if GL rendering succeeded, false if it failed.
     */
    composite(ctx) {
      if (!R.dirty) return true;
      const { gl, cv, T } = glr;
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      gl.viewport(0, 0, w, h);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, T.A);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, R.alb);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, T.H);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, w, h, 0, gl.RED, gl.FLOAT, R.H);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, T.M);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, h, 0, gl.RED, gl.UNSIGNED_BYTE, R.M);
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, T.D);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, h, 0, gl.RED, gl.UNSIGNED_BYTE, R.D);
      gl.uniform2f(glr.uRes, w, h);
      gl.uniform3f(glr.uL, LIGHT.x, LIGHT.y, 0.62);
      gl.uniform1f(glr.uK, u);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, ctx.canvas ? ctx.canvas.width : w, ctx.canvas ? ctx.canvas.height : h);
      if (ctx.canvas && (ctx.canvas.width !== w || ctx.canvas.height !== h)) {
        ctx.drawImage(cv, 0, 0, ctx.canvas.width, ctx.canvas.height);
      } else {
        ctx.drawImage(cv, 0, 0);
      }
      ctx.restore();
      R.dirty = false;
      return true;
    },

    /** Internal: expose the relief state for advanced use. */
    _state: () => R,
  };
}

// ── Set / clear the active relief renderer for the current render pass ──────
export function setActiveRelief(renderer) {
  _activeRelief = renderer;
}

export function clearActiveRelief() {
  _activeRelief = null;
}

// ── SLAB scratch canvas for maskOf ────────────────────────────────────────────
// (already defined above as SLAB)

// ── 2D fallback: shaded tube / slab approximation (port of reliefFlat) ──────

/**
 * Render a relief-style shape as a 2D lit approximation.
 * This is the port of reliefFlat from the reference — used when WebGL2
 * is unavailable or the relief renderer is not active.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} shape - Shape object.
 * @param {number} progress - 0..1 reveal.
 * @param {string} materialName - Material key in RELIEF.
 * @returns {[number, number]} End point of the stroke (for chaining).
 */
export function reliefFlat(ctx, shape, progress = 1, materialName = 'ceramic') {
  const m = RELIEF[materialName];
  const t = shape.type;
  const a = shape.params;

  // For clear materials in 2D, draw a tinted translucent shape with rim light
  if (m && m.clear) {
    return reliefFlatClear(ctx, shape, progress, materialName);
  }

  const [c0, c1, o] = resolveColors(shape);
  const tint = RELIEF_TINT[materialName];
  const c = tint ? mixHex(tint, mixHex(c0, c1, 0.5), 0.28) : mixHex(c0, c1, 0.5);

  ctx.save();
  ctx.globalAlpha = Math.max(0.9, o);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (t === 'S') {
    const w = a[6];
    const P = quadPts(a, progress, 1, 24);
    const n = P.length;
    if (n < 2) { ctx.restore(); return [P[0][0], P[0][1]]; }

    const line = () => {
      ctx.beginPath();
      P.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1]));
    };

    // Cast shadow
    ctx.translate(-LIGHT.x * w * 0.12, -LIGHT.y * w * 0.12);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = w * 1.05;
    line();
    ctx.stroke();

    // Darker body
    ctx.translate(LIGHT.x * w * 0.12, LIGHT.y * w * 0.12);
    ctx.strokeStyle = shade(c, -0.45);
    ctx.lineWidth = w;
    line();
    ctx.stroke();

    // Base colour
    ctx.strokeStyle = c;
    ctx.lineWidth = w * 0.72;
    ctx.translate(LIGHT.x * w * 0.06, LIGHT.y * w * 0.06);
    line();
    ctx.stroke();

    // Highlight rim
    ctx.strokeStyle = shade(c, 0.55);
    ctx.lineWidth = w * 0.22;
    ctx.translate(LIGHT.x * w * 0.14, LIGHT.y * w * 0.14);
    line();
    ctx.stroke();

    ctx.restore();
    return [P[n - 1][0], P[n - 1][1]];
  }

  // Area fill (E/B/T/R)
  const P = shapePoly(shape);
  const b = boxOf(P);
  const s = Math.max(2, Math.min(b.w, b.h) * 0.08);

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.translate(-LIGHT.x * s, -LIGHT.y * s);
  outlinePath(ctx, shape);
  ctx.fill();
  ctx.translate(LIGHT.x * s, LIGHT.y * s);

  ctx.fillStyle = gradOf(ctx, shape, [[0, shade(c, 0.25)], [1, shade(c, -0.3)]]);
  outlinePath(ctx, shape);
  ctx.fill();

  ctx.restore();
  return [a[0], a[1]];
}

/**
 * 2D fallback for clear materials (glass, lens, crystal).
 * Draws a tinted, translucent shape with a bright rim and caustic highlight.
 */
function reliefFlatClear(ctx, shape, progress = 1, materialName = 'glass') {
  const m = RELIEF[materialName];
  const [c0, c1, o] = resolveColors(shape);
  const a = shape.params;
  const t = shape.type;

  ctx.save();
  ctx.globalAlpha = Math.max(0.5, o * 0.7);

  // Tinted fill
  const tint = mixHex(c0, c1, 0.5);
  const tintedCol = materialName === 'glass' ? mixHex(tint, '#ffffff', 0.4) :
    materialName === 'lens' ? mixHex(tint, '#ffffff', 0.6) : mixHex(tint, '#ffffff', 0.5);

  if (t === 'S') {
    const w = a[6];
    const P = quadPts(a, progress, 1, 24);
    const n = P.length;
    if (n < 2) { ctx.restore(); return [P[0][0], P[0][1]]; }

    // Build ribbon path and fill
    const off = w / 2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const [nx, ny] = normalAt(P, i);
      i === 0 ? ctx.moveTo(P[i][0] + nx * off, P[i][1] + ny * off)
              : ctx.lineTo(P[i][0] + nx * off, P[i][1] + ny * off);
    }
    for (let i = n - 1; i >= 0; i--) {
      const [nx, ny] = normalAt(P, i);
      ctx.lineTo(P[i][0] - nx * off, P[i][1] - ny * off);
    }
    ctx.closePath();

    ctx.fillStyle = tintedCol;
    ctx.fill();

    // Bright rim highlight
    ctx.globalAlpha = Math.max(0.5, o * 0.9);
    ctx.strokeStyle = shade2(tintedCol, 0.7);
    ctx.lineWidth = Math.max(0.5, w * 0.3);
    ctx.beginPath();
    P.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1]));
    ctx.stroke();

    // Caustic line
    ctx.globalAlpha = Math.max(0.5, o * 0.4);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(0.5, w * 0.15);
    ctx.translate(LIGHT.x * w * 0.15, LIGHT.y * w * 0.15);
    ctx.beginPath();
    P.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1]));
    ctx.stroke();
  } else {
    ctx.fillStyle = tintedCol;
    outlinePath(ctx, shape);
    ctx.fill();

    // Rim
    ctx.globalAlpha = Math.max(0.5, o * 0.9);
    ctx.strokeStyle = shade2(tintedCol, 0.7);
    ctx.lineWidth = Math.max(1, Math.min(a[2] || 10, a[3] || 10) * 0.05);
    outlinePath(ctx, shape);
    ctx.stroke();
  }

  ctx.restore();
  return a[0] !== undefined ? [a[0], a[1]] : [0, 0];
}

/**
 * Main entry point for 3D/relief styles.
 *
 * Tries the WebGL2 relief renderer if one is active for the current render pass.
 * If no renderer is active (or WebGL2 is unavailable), falls back to the
 * 2D lit approximation via reliefFlat.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} shape - Shape object.
 * @param {number} progress - 0..1.
 * @param {string} materialName - Material key in RELIEF.
 * @returns {boolean} true if rendered.
 */
export function renderReliefShape(ctx, shape, progress, materialName) {
  const m = RELIEF[materialName];
  if (!m) return false;

  // If a WebGL relief renderer is active, stamp into it
  if (_activeRelief && _activeRelief.stamp) {
    _activeRelief.stamp(shape, m);
    return true;
  }

  // 2D fallback
  reliefFlat(ctx, shape, progress, materialName);
  return true;
}

export default {
  RELIEF,
  RELIEF_TINT,
  LIGHT,
  createReliefRenderer,
  reliefFlat,
  renderReliefShape,
  setActiveRelief,
  clearActiveRelief
};
