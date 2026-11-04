var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn2, res) => function __init() {
  return fn2 && (res = (0, fn2[__getOwnPropNames(fn2)[0]])(fn2 = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// js/vendor/brush.esm.js
var brush_esm_exports = {};
__export(brush_esm_exports, {
  Color: () => z,
  DEGREES: () => L,
  Plot: () => xe,
  Polygon: () => ge,
  Position: () => Jt,
  RADIANS: () => N,
  add: () => Dr,
  addField: () => ue,
  angleMode: () => G,
  arc: () => _e,
  beginShape: () => Me,
  beginStroke: () => Pe,
  box: () => Lr,
  circle: () => be,
  clear: () => tt,
  clip: () => Gr,
  createCanvas: () => st,
  endShape: () => Se,
  endStroke: () => Fe,
  field: () => le,
  fill: () => ei,
  fillBleed: () => ri,
  fillTexture: () => ni,
  flowLine: () => hn,
  getAngleMode: () => V,
  hatch: () => xn,
  hatchArray: () => Tn,
  hatchStyle: () => yn,
  initStandaloneRuntime: () => K,
  instance: () => d,
  line: () => ln,
  listFields: () => fe,
  load: () => I,
  mass: () => Sn,
  massArray: () => Vn,
  move: () => Ce,
  noClip: () => Vr,
  noField: () => he,
  noFill: () => ii,
  noHatch: () => pn,
  noMass: () => Pn,
  noStroke: () => zr,
  noWash: () => di,
  noise: () => _t,
  noiseSeed: () => wt,
  pick: () => Ur,
  polygon: () => ye,
  pop: () => $,
  push: () => H,
  random: () => Et,
  rect: () => pe,
  refreshField: () => ce,
  render: () => Q,
  rotate: () => q,
  scale: () => j,
  scaleBrushes: () => Br,
  seed: () => bt,
  set: () => Yr,
  spline: () => Ie,
  stroke: () => Or,
  strokeWeight: () => Xr,
  translate: () => W,
  vertex: () => Te,
  wRand: () => It,
  wash: () => mi,
  wiggle: () => me
});
function h(t2) {
  t2.usesRadians && (a = t2.usesRadians), t2.fromDegrees && (o = t2.fromDegrees), t2.createColor && (s = t2.createColor), t2.getAffineMatrix && (c = t2.getAffineMatrix), t2.notifyDraw && (l = t2.notifyDraw);
}
function f(t2) {
  "Cwidth" in t2 && (e = t2.Cwidth), "Cheight" in t2 && (r = t2.Cheight), "Instance" in t2 && t2.Instance, "Renderer" in t2 && (n = t2.Renderer), "Density" in t2 && (i = t2.Density);
}
function Y(t2, e2) {
  return { a: t2.a * e2.a + t2.c * e2.b, b: t2.b * e2.a + t2.d * e2.b, c: t2.a * e2.c + t2.c * e2.d, d: t2.b * e2.c + t2.d * e2.d, x: t2.a * e2.x + t2.c * e2.y + t2.x, y: t2.b * e2.x + t2.d * e2.y + t2.y };
}
function G(t2) {
  if (t2 !== L && t2 !== N) throw new Error(`Invalid angle mode "${t2}". Use "degrees" or "radians".`);
  U = t2;
}
function V() {
  return U;
}
function H() {
  !function(t2 = P) {
    let e2 = k.get(t2);
    e2 || (e2 = [], k.set(t2, e2)), e2.push({ fill: { ...P.fill }, wash: P.wash ? { ...P.wash } : null, stroke: { ...P.stroke }, hatch: { ...P.hatch }, mass: P.mass ? { ...P.mass } : null, field: { ...P.field } });
  }(), O.push({ ...X });
}
function $() {
  0 !== O.length && (X = O.pop(), function(t2 = P) {
    const e2 = k.get(t2)?.pop();
    e2 && (P.stroke = e2.stroke, P.field = e2.field, P.hatch = e2.hatch, P.fill = e2.fill, e2.wash && (P.wash = e2.wash), e2.mass ? P.mass = e2.mass : P.mass && (P.mass = { ...P.mass, isActive: false, brush: null, color: null, options: {} }));
  }());
}
function W(t2, e2) {
  X = Y(X, { a: 1, b: 0, c: 0, d: 1, x: t2, y: e2 });
}
function q(t2) {
  const e2 = U === N ? t2 : t2 * Math.PI / 180, r2 = Math.cos(e2), n2 = Math.sin(e2);
  X = Y(X, { a: r2, b: n2, c: -n2, d: r2, x: 0, y: 0 });
}
function j(t2, e2 = t2) {
  X = Y(X, { a: t2, b: 0, c: 0, d: e2, x: 0, y: 0 });
}
function K() {
  h({ usesRadians: () => "radians" === U, fromDegrees: (t2) => "radians" === U ? t2 * Math.PI / 180 : t2, createColor: (...t2) => 1 === t2.length && t2[0]?._array ? t2[0] : new z(...t2), getAffineMatrix: () => X });
}
function Q() {
  Z = false, (F.isBlending || F.justChanged) && (F.blend(false, true), F.clearMask(F.glMask), F.clearMask(F.mask), F.justChanged = false, F.isBlending = false, F.isBrush = null, F.cachedColor = null);
}
function tt(...t2) {
  m(), F.glMask && F.clearMask(F.glMask), F.mask && F.clearMask(F.mask), F.justChanged = false, F.isBlending = false, F.isBrush = null, F.cachedColor = null;
  const e2 = n.drawingContext, r2 = 0 === t2.length ? [1, 1, 1, 0] : [...s(...t2)._array.slice(0, 3), 1];
  e2.bindFramebuffer(e2.FRAMEBUFFER, null), e2.disable(e2.SCISSOR_TEST), e2.clearColor(r2[0], r2[1], r2[2], r2[3]), e2.clear(e2.COLOR_BUFFER_BIT | e2.DEPTH_BUFFER_BIT);
}
function ot(t2, e2, r2, n2) {
  et = t2, it = e2, at = r2, nt = n2;
  const i2 = function(t3, e3, r3, n3) {
    const i3 = function(t4) {
      return t4.getContext("webgl2", { premultipliedAlpha: true, preserveDrawingBuffer: true }) ?? t4.getContext("webgl2", { preserveDrawingBuffer: true });
    }(t3);
    if (!i3) throw new Error("brush.load(target) requires a canvas with a WebGL2 context.");
    return { canvas: t3, drawingContext: i3, width: e3, height: r3, pixelDensity: () => n3 };
  }(t2, e2, r2, n2);
  f({ Renderer: i2, Cwidth: e2, Cheight: r2, Density: n2 }), rt = true;
}
function st(t2, e2, r2 = {}) {
  if ("undefined" == typeof document) throw new Error("brush.createCanvas() requires a browser document.");
  const n2 = Math.max(1, Math.round(t2)), i2 = Math.max(1, Math.round(e2)), a2 = Math.max(1, Number(r2.pixelDensity) || 1), o2 = document.createElement("canvas");
  o2.width = Math.max(1, Math.round(n2 * a2)), o2.height = Math.max(1, Math.round(i2 * a2)), o2.style.width = `${n2}px`, o2.style.height = `${i2}px`, o2.id = r2.id ?? "brush-canvas";
  const s2 = void 0 !== r2.parent ? r2.parent : document.body;
  if (s2) {
    const t3 = "string" == typeof s2 ? document.querySelector(s2) : s2;
    if (!t3) throw new Error(`Could not find parent "${r2.parent}" for brush.createCanvas().`);
    t3.appendChild(o2);
  }
  return ot(o2, n2, i2, a2), o2;
}
function mt(t2 = Math.random) {
  const e2 = function(t3) {
    const e3 = new Uint8Array(512);
    for (let t4 = 0; t4 < 256; t4++) e3[t4] = t4;
    for (let r3 = 0; r3 < 255; r3++) {
      const n3 = r3 + ~~(t3() * (256 - r3)), i2 = e3[r3];
      e3[r3] = e3[n3], e3[n3] = i2;
    }
    for (let t4 = 256; t4 < 512; t4++) e3[t4] = e3[t4 - 256];
    return e3;
  }(t2), r2 = new Float64Array(e2).map((t3) => ft[t3 % 12 * 2]), n2 = new Float64Array(e2).map((t3) => ft[t3 % 12 * 2 + 1]);
  return function(t3, i2) {
    let a2 = 0, o2 = 0, s2 = 0;
    const c2 = (t3 + i2) * lt, l2 = ut(t3 + c2), h2 = ut(i2 + c2), u2 = (l2 + h2) * ht, f2 = t3 - (l2 - u2), m2 = i2 - (h2 - u2);
    let d2, g2;
    f2 > m2 ? (d2 = 1, g2 = 0) : (d2 = 0, g2 = 1);
    const x2 = f2 - d2 + ht, y2 = m2 - g2 + ht, p2 = f2 - 1 + 2 * ht, b2 = m2 - 1 + 2 * ht, _2 = 255 & l2, v2 = 255 & h2;
    let w2 = 0.5 - f2 * f2 - m2 * m2;
    if (w2 >= 0) {
      const t4 = _2 + e2[v2];
      w2 *= w2, a2 = w2 * w2 * (r2[t4] * f2 + n2[t4] * m2);
    }
    let R2 = 0.5 - x2 * x2 - y2 * y2;
    if (R2 >= 0) {
      const t4 = _2 + d2 + e2[v2 + g2];
      R2 *= R2, o2 = R2 * R2 * (r2[t4] * x2 + n2[t4] * y2);
    }
    let E2 = 0.5 - p2 * p2 - b2 * b2;
    if (E2 >= 0) {
      const t4 = _2 + 1 + e2[v2 + 1];
      E2 *= E2, s2 = E2 * E2 * (r2[t4] * p2 + n2[t4] * b2);
    }
    return 70 * (a2 + o2 + s2);
  };
}
function dt(t2) {
  let e2 = function(t3) {
    let e3 = 0;
    const r2 = String(t3);
    for (let t4 = 0; t4 < r2.length; t4++) e3 = 0 | Math.imul(e3 ^ r2.charCodeAt(t4), 2654435769), e3 ^= e3 >>> 15;
    return e3 = 0 | Math.imul(e3 ^ e3 >>> 16, 2246822507), e3 = 0 | Math.imul(e3 ^ e3 >>> 13, 3266489909), (e3 ^ e3 >>> 16) >>> 0 || 1;
  }(t2);
  return () => {
    e2 = e2 + 1831565813 | 0;
    let t3 = Math.imul(e2 ^ e2 >>> 15, 1 | e2);
    return t3 ^= t3 + Math.imul(t3 ^ t3 >>> 7, 61 | t3), 23283064365386963e-26 * ((t3 ^ t3 >>> 14) >>> 0);
  };
}
function Et(t2 = 0, e2 = 1) {
  return Array.isArray(t2) ? Mt(t2) : 1 === arguments.length ? xt() * t2 : At(t2, e2);
}
function Zt() {
  Kt || (C(), Qt = 0.01 * e, te = -0.5 * e, ee = -0.5 * r, re = Math.round(2 * e / Qt), ne = Math.round(2 * r / Qt), ue("hand", (t2, e2) => {
    const r2 = At(0.2, 0.8), n2 = St(5, 10);
    return de(e2, (e3, i2) => 0.5 * n2 * Yt(r2 * i2 * e3 + St(15, 25)) * 0.2 * Xt(t2) + vt(e3, i2) * n2 * 0.7);
  }), ue("curved", (t2, e2) => {
    let r2 = St(-10, 10);
    return St(0, 100) % 2 == 0 && (r2 *= -1), de(e2, (e3, n2) => 3 * kt(vt(0.02 * e3 + 0.03 * t2, 0.02 * n2 + 0.03 * t2), 0, 1, -r2, r2));
  }), ue("zigzag", (t2, e2) => {
    let r2 = St(-30, -15) + Math.abs(44 * Yt(t2));
    St(0, 100) % 2 == 0 && (r2 *= -1);
    let n2 = r2, i2 = 0;
    for (let t3 = 0; t3 < re; t3++) {
      for (let r3 = 0; r3 < ne; r3++) e2[t3][r3] = i2, i2 += n2, n2 *= -1;
      i2 += n2, n2 *= -1;
    }
    return e2;
  }), ue("waves", (t2, e2) => {
    const r2 = St(10, 15) + 5 * Yt(t2), n2 = St(3, 6) + 3 * Xt(t2), i2 = St(20, 35);
    return de(e2, (t3, e3) => Yt(r2 * t3) * i2 * Xt(e3 * n2) + St(-3, 3));
  }), ue("seabed", (t2, e2) => {
    const r2 = At(0.4, 0.8), n2 = St(18, 26);
    return de(e2, (e3, i2) => 1.1 * n2 * Yt(r2 * i2 * e3 + St(15, 20)) * Xt(t2));
  }), ue("spiral", (t2, e2) => {
    const r2 = St(5, 10), n2 = 2 * St(0, 2) - 1, i2 = St(65, 80), a2 = Array.from({ length: r2 }, () => ({ x: At(0.1, 0.9) * re, y: At(0.1, 0.9) * ne }));
    return de(e2, (t3, e3) => {
      let r3 = 0, o2 = 0;
      for (const s2 of a2) {
        const a3 = t3 - s2.x, c2 = e3 - s2.y, l2 = 1 / (a3 * a3 + c2 * c2 + 1), h2 = Math.atan2(c2, a3) * (180 / Math.PI), u2 = n2 * (h2 + i2) * Math.PI / 180;
        r3 += l2 * Math.cos(u2), o2 += l2 * Math.sin(u2);
      }
      return Math.atan2(o2, r3) * (180 / Math.PI);
    });
  }), ue("columns", (t2, e2) => {
    const r2 = St(3, 8), n2 = St(25, 45);
    return de(e2, (t3, e3) => Yt(t3 * r2) * n2);
  }), Kt = true);
}
function oe(t2 = {}) {
  const e2 = ("string" == typeof t2 ? { angleMode: t2 } : t2 || {}).angleMode ?? "degrees";
  if (!ae.has(e2)) throw new Error(`Invalid field angle mode "${e2}". Use "degrees" or "radians".`);
  return e2;
}
function se(t2, e2) {
  return function(t3, e3) {
    if ("radians" !== e3) return t3;
    for (let e4 = 0; e4 < t3.length; e4++) for (let r2 = 0; r2 < t3[e4].length; r2++) t3[e4][r2] = Ht(t3[e4][r2], true);
    return t3;
  }(t2.gen(e2, new Array(re).fill(null).map(() => new Float32Array(ne))), t2.angleMode);
}
function ce(t2 = 0) {
  if (!P.field.isActive || !P.field.current) throw new Error("No field is currently active. Call brush.field('name') to activate one before refreshing.");
  const e2 = ie.get(P.field.current);
  e2.field = se(e2, t2);
}
function le(t2) {
  if (P.field.wiggle || (P.field.wiggle = 1), Zt(), !ie.has(t2)) throw new Error(`Field "${t2}" does not exist. Available fields: ${Array.from(ie.keys()).join(", ")}.`);
  P.field.isActive = true, P.field.current = t2;
  const e2 = ie.get(t2);
  e2.field || (e2.field = se(e2, 0));
}
function he() {
  Zt(), P.field.isActive = false;
}
function ue(t2, e2, r2 = {}) {
  ie.set(t2, { gen: e2, field: null, angleMode: oe(r2) });
}
function fe() {
  return Zt(), Array.from(ie.keys());
}
function me(t2 = 1) {
  le("hand"), P.field.wiggle = t2;
}
function de(t2, e2) {
  for (let r2 = 0; r2 < re; r2++) for (let n2 = 0; n2 < ne; n2++) t2[r2][n2] = e2(r2, n2);
  return t2;
}
function ye(t2) {
  const e2 = new ge(t2);
  return e2.show(), e2;
}
function pe(t2, e2, r2, n2, i2 = "corner") {
  "center" === i2 && (t2 -= r2 / 2, e2 -= n2 / 2), Me(0), Te(t2, e2), Te(t2 + r2, e2), Te(t2 + r2, e2 + n2), Te(t2, e2 + n2), Se(true);
}
function be(t2, e2, r2, n2 = false) {
  const i2 = new xe("curve"), a2 = Math.PI * r2, o2 = At(0, 360), s2 = n2 ? () => 1 + 0.2 * n2 * At() : () => 1;
  for (let t3 = 0; t3 < 4; t3++) {
    const e3 = -90 * t3 + o2;
    i2.addSegment(e3 * s2(), a2 / 2 * s2(), 1, true);
  }
  if (n2) {
    const t3 = n2 * St(-5, 5);
    i2.addSegment(o2, Math.abs(t3) * (Math.PI / 180) * r2, 1, true), i2.endPlot(t3 + o2, 1, true);
  } else i2.endPlot(o2, 1, true);
  const c2 = t2 - r2 * Yt(o2), l2 = e2 - r2 * Xt(-o2);
  return i2.show(c2, l2, 1), [i2, c2, l2];
}
function _e(t2, e2, r2, n2, i2) {
  const a2 = Ht(n2), o2 = ((Ht(i2) - a2) % 360 + 360) % 360;
  if (0 === o2) return null;
  const s2 = new xe("curve"), c2 = Math.max(1, Math.ceil(o2 / 90)), l2 = o2 / c2, h2 = Math.PI * r2 * l2 / 180;
  for (let t3 = 0; t3 < c2; t3++) s2.addSegment(a2 + t3 * l2 + 90, h2, 1, true);
  s2.endPlot(a2 + o2 + 90, 1, true);
  const u2 = t2 + r2 * Xt(a2), f2 = e2 - r2 * Yt(a2);
  return s2.draw(u2, f2, 1), s2;
}
function Me(t2 = 0) {
  we = Dt(t2, 0, 1), ve = new Ae();
}
function Te(t2, e2, r2 = 1) {
  if (!ve) throw new Error("vertex() called outside of beginShape()/endShape(). Call beginShape() first.");
  ve.vertex(t2, e2, r2);
}
function Se(t2 = false) {
  if (!ve) throw new Error("endShape() called without beginShape(). Call beginShape() first.");
  if (ve.vert.length < 2) throw new Error("endShape() requires at least 2 vertices. Add more with vertex().");
  t2 && (ve.vertex(...ve.vert[0]), ve.isClosed = true);
  const e2 = ve.show();
  return ve = false, e2;
}
function Pe(t2, e2, r2) {
  if ("curve" !== t2 && "segments" !== t2) throw new Error(`beginStroke() type must be "curve" or "segments", got "${t2}".`);
  Ee = [e2, r2], Re = new xe(t2);
}
function Ce(t2, e2, r2) {
  if (!Re) throw new Error("move() called without beginStroke(). Call beginStroke() first.");
  Re.addSegment(t2, e2, r2);
}
function Fe(t2, e2) {
  if (!Re) throw new Error("endStroke() called without beginStroke(). Call beginStroke() first.");
  Re.endPlot(t2, e2), Re.draw(Ee[0], Ee[1], 1), Re = false;
}
function Ie(t2, e2 = 0.5) {
  if (!t2 || t2.length < 2) throw new Error("spline() requires at least 2 points. Each point should be [x, y, pressure].");
  let r2 = ke(t2, e2);
  return r2.show(), r2;
}
function ke(t2, e2 = 0.5, r2 = false) {
  const n2 = new xe(0 === e2 ? "segments" : "curve"), i2 = 2 * Math.PI;
  if (r2 && 0 !== e2 && t2.push(t2[1]), t2 && t2.length > 0) {
    let a2, o2, s2, c2 = 0;
    for (let l2 = 0; l2 < t2.length - 1; l2++) if (e2 > 0 && l2 < t2.length - 2) {
      const h2 = t2[l2], u2 = t2[l2 + 1], f2 = t2[l2 + 2], m2 = Wt(h2[0], h2[1], u2[0], u2[1]), d2 = Wt(u2[0], u2[1], f2[0], f2[1]), g2 = qt(h2[0], h2[1], u2[0], u2[1]), x2 = qt(u2[0], u2[1], f2[0], f2[1]), y2 = e2 * Math.min(m2, d2, 0.5 * Math.min(m2, d2)), p2 = Math.max(m2, d2), b2 = m2 - y2, _2 = d2 - y2;
      if (Math.floor(g2) === Math.floor(x2)) {
        const e3 = r2 && 0 === l2 ? 0 : m2 - c2, i3 = r2 ? 0 === l2 ? 0 : d2 - s2 : d2;
        n2.addSegment(g2, e3, h2[2], true), l2 === t2.length - 3 && n2.addSegment(x2, i3, u2[2], true), c2 = 0, 0 === l2 && (a2 = m2, s2 = y2, o2 = t2[1], c2 = 0);
      } else {
        const e3 = { x: u2[0] - y2 * Xt(-g2), y: u2[1] - y2 * Yt(-g2) }, f3 = { x: e3.x + p2 * Xt(90 - g2), y: e3.y + p2 * Yt(90 - g2) }, m3 = { x: u2[0] + y2 * Xt(-x2), y: u2[1] + y2 * Yt(-x2) }, d3 = { x: m3.x + p2 * Xt(90 - x2), y: m3.y + p2 * Yt(90 - x2) }, v2 = jt(e3, f3, m3, d3, true), w2 = Wt(e3.x, e3.y, v2.x, v2.y), R2 = Wt(e3.x, e3.y, m3.x, m3.y) / 2, E2 = i2 * w2 * (2 * Math.asin(R2 / w2) * (180 / Math.PI)) / 360, A2 = r2 && 0 === l2 ? 0 : b2 - c2, M2 = l2 === t2.length - 3 ? r2 ? a2 - y2 : _2 : 0;
        n2.addSegment(g2, A2, h2[2], true), n2.addSegment(g2, isNaN(E2) ? 0 : E2, h2[2], true), n2.addSegment(x2, M2, u2[2], true), c2 = y2, 0 === l2 && (a2 = b2, s2 = y2, o2 = [e3.x, e3.y]);
      }
      l2 === t2.length - 3 && n2.endPlot(x2, u2[2], true);
    } else if (0 === e2) {
      const e3 = t2[l2], r3 = t2[l2 + 1], i3 = Wt(e3[0], e3[1], r3[0], r3[1]), a3 = qt(e3[0], e3[1], r3[0], r3[1]);
      n2.addSegment(a3, i3, e3[2], true), l2 === t2.length - 2 && n2.endPlot(a3, r3[2], true);
    }
    n2.origin = r2 && 0 !== e2 ? o2 : t2[0];
  }
  return n2;
}
function Er() {
  return Xe;
}
function Ar() {
  return ((t2, e2, r2) => Be.beginDirectMaskDraw(t2, e2, r2))(n, Oe, F.glMask);
}
function Mr(t2) {
  ((t3, e2, r2) => {
    Be.endDirectMaskDraw(t3, e2, r2);
  })(n, Oe, t2);
}
function Tr(t2, e2, r2, n2, i2) {
  return t2 ? (e2 < t2.minX && (t2.minX = e2), r2 < t2.minY && (t2.minY = r2), n2 > t2.maxX && (t2.maxX = n2), i2 > t2.maxY && (t2.maxY = i2), t2) : { minX: e2, minY: r2, maxX: n2, maxY: i2 };
}
function Sr(t2, e2, r2, n2) {
  if (sr >= cr) {
    cr *= 2;
    const t3 = new Float32Array(4 * cr);
    t3.set(or), or = t3;
  }
  const i2 = t2 - rr, a2 = e2 - nr, o2 = 4 * sr, s2 = Ke * i2 + Je * a2 + tr + rr, c2 = Ze * i2 + Qe * a2 + er + nr, l2 = ar * r2 * ir / 2;
  or[o2] = s2, or[o2 + 1] = c2, or[o2 + 2] = l2, or[o2 + 3] = n2 / 255;
  const h2 = s2 * ar, u2 = c2 * ar;
  hr = Tr(hr, h2 - l2 - 1, u2 - l2 - 1, h2 + l2 + 1, u2 + l2 + 1), sr++;
}
function Pr(t2, e2) {
  if (0 === br) return;
  F.glMask.isDrawn = true;
  const r2 = Ar();
  let i2 = wr.get(e2);
  i2 || (i2 = Oe.createTexture(), Oe.bindTexture(Oe.TEXTURE_2D, i2), Oe.texImage2D(Oe.TEXTURE_2D, 0, Oe.RGBA, Oe.RGBA, Oe.UNSIGNED_BYTE, t2.canvas), Oe.texParameteri(Oe.TEXTURE_2D, Oe.TEXTURE_MIN_FILTER, Oe.LINEAR), Oe.texParameteri(Oe.TEXTURE_2D, Oe.TEXTURE_MAG_FILTER, Oe.LINEAR), Oe.texParameteri(Oe.TEXTURE_2D, Oe.TEXTURE_WRAP_S, Oe.CLAMP_TO_EDGE), Oe.texParameteri(Oe.TEXTURE_2D, Oe.TEXTURE_WRAP_T, Oe.CLAMP_TO_EDGE), wr.set(e2, i2)), Oe.useProgram(ur), Oe.enable(Oe.BLEND), Oe.blendFunc(Oe.ONE_MINUS_DST_ALPHA, Oe.ONE), Oe.activeTexture(Oe.TEXTURE0), Oe.bindTexture(Oe.TEXTURE_2D, i2), Oe.uniform1i(xr.u_tex, 0);
  const a2 = P.stroke.color._array;
  Oe.uniform4f(xr.u_color, ...a2), Oe.uniformMatrix4fv(xr.u_proj, false, Er()), Oe.bindVertexArray(fr), Oe.bindBuffer(Oe.ARRAY_BUFFER, dr);
  const o2 = 5 * br * 4, s2 = pr.subarray(0, 5 * br);
  o2 > yr ? (Oe.bufferData(Oe.ARRAY_BUFFER, pr, Oe.DYNAMIC_DRAW), yr = pr.byteLength) : Oe.bufferSubData(Oe.ARRAY_BUFFER, 0, s2), Oe.drawArraysInstanced(Oe.TRIANGLE_STRIP, 0, 4, br), Oe.bindVertexArray(null), Oe.bindTexture(Oe.TEXTURE_2D, null), Mr(r2), vr && (F.markDirtyRect(F.glMask, vr), vr = null), br = 0, Ue(n, Oe);
}
function Ir() {
  return { ...P.stroke };
}
function kr(t2) {
  P.stroke = { ...t2 };
}
function Dr(t2, e2) {
  if (e2.type = ["marker", "custom", "image", "spray"].includes(e2.type) ? e2.type : "default", void 0 === e2.markerTip && (e2.markerTip = true), void 0 === e2.noise && (e2.noise = 0.3), e2.noise = Math.max(0, Math.min(1, e2.noise)), void 0 !== e2.vibration && void 0 === e2.scatter && (e2.scatter = e2.vibration), void 0 !== e2.definition && void 0 === e2.sharpness && (e2.sharpness = e2.definition), void 0 !== e2.quality && void 0 === e2.grain && (e2.grain = e2.quality), e2.pressure = function(t3) {
    if (!t3) return t3;
    if ("function" == typeof t3) return { type: "custom", min_max: [0, 1], curve: t3, variation: { ...Fr } };
    if ("object" == typeof t3 && !Array.isArray(t3)) {
      if ("custom" === t3.type || "custom" === t3.mode) {
        const { mode: e3, ...r2 } = t3;
        return { ...r2, type: "custom", variation: { ...Fr, ...r2.variation ?? {} } };
      }
      return "gaussian" === t3.type || "gaussian" === t3.mode || Array.isArray(t3.curve) && Array.isArray(t3.min_max) ? { ...t3, type: "gaussian", curve: t3.curve, min_max: t3.min_max } : t3;
    }
    if (Array.isArray(t3)) {
      const [e3, r2, n2] = 2 === t3.length ? [t3[0], (t3[0] + t3[1]) / 2, t3[1]] : t3, i2 = Math.min(e3, r2, n2), a2 = Math.max(e3, r2, n2), o2 = a2 - i2 || 1, [s2, c2, l2] = [(e3 - i2) / o2, (r2 - i2) / o2, (n2 - i2) / o2];
      return { type: "custom", min_max: [i2, a2], variation: { ...Fr }, curve: (t4) => t4 < 0.5 ? s2 + (c2 - s2) * t4 * 2 : c2 + (l2 - c2) * (t4 - 0.5) * 2 };
    }
  }(e2.pressure), "custom" === e2.type) {
    if ("function" != typeof e2.tip) throw new Error(`Brush "${t2}" is type "custom" but is missing a tip function.`);
    const r2 = `custom::${t2}`;
    !function(t3) {
      const e3 = wr.get(t3);
      e3 && Oe && Oe.deleteTexture(e3), wr.delete(t3);
    }(r2);
    const n2 = De.createTipSurface(500, 500);
    return n2.pixelDensity(1), n2.background(255), n2.noSmooth(), n2.push(), n2.translate(250, 250), n2.scale(5), n2.noStroke(), e2.tip(n2), n2.pop(), mn.imageToWhite(n2), mn.tips.set(r2, n2), e2.tipKey = r2, void Cr.set(t2, { param: e2, colors: [], buffers: [] });
  }
  if ("image" === e2.type) {
    if (!e2.image || !e2.image.src) throw new Error(`Brush "${t2}" is type "image" but is missing params.image.src. Example: image: { src: "./tip.jpg" }`);
    return mn.add(e2.image.src), Cr.set(t2, { param: e2, colors: [], buffers: [] }), mn.load();
  }
  Cr.set(t2, { param: e2, colors: [], buffers: [] });
}
function Lr() {
  return [...Cr.keys()];
}
function Nr(t2) {
  return Cr.get(t2)?.param ?? null;
}
function Br(t2) {
  for (const { param: e2 } of Cr.values()) e2 && (e2.weight *= t2, e2.scatter *= t2, e2.spacing *= t2);
}
function Ur(t2) {
  if (!Cr.has(t2)) throw new Error(`Brush "${t2}" not found. Available brushes: ${[...Cr.keys()].join(", ")}.`);
  P.stroke.type = t2;
}
function Or(t2, e2, r2) {
  m(), P.stroke.color = s(...arguments), P.stroke.isActive = true;
}
function Xr(t2) {
  P.stroke.weight = t2;
}
function Yr(t2, e2, r2 = 1) {
  Ur(t2), Or(e2), Xr(r2);
}
function zr() {
  P.stroke.isActive = false;
}
function Gr(t2) {
  return m(), t2;
}
function Vr() {
}
function Zr(t2, n2, a2, o2 = false) {
  !function() {
    const t3 = c();
    Ke = t3.a, Ze = t3.b, Je = t3.c, Qe = t3.d, tr = t3.x, er = t3.y, rr = e / 2, nr = r / 2, ir = Math.sqrt(Ke * Ke + Ze * Ze), ar = i;
  }(), Hr = new Jt(t2 + e / 2, n2 + r / 2), $r = a2, Wr = o2, Wr && Wr.calcIndex(0);
}
function Qr(t2, i2) {
  i2 || (qr = t2), function() {
    Kr.seed = 999999 * Rt();
    const { param: t3 } = Cr.get(P.stroke.type) ?? {};
    if (!t3) return;
    Kr.p = t3;
    const { pressure: i3 } = t3;
    if (Kr.isCustomPressure = "custom" === i3.type, Kr.a = Kr.isCustomPressure ? 0 : Rt(-1, 1), Kr.b = Kr.isCustomPressure ? 0 : Rt(1, 1.5), Kr.isCustomPressure) {
      const t4 = i3.variation ?? Fr;
      Kr.cp = Rt(-t4.offset, t4.offset), Kr.ct = Rt(-t4.warp, t4.warp), Kr.cs = Rt(1 - t4.scale, 1 + t4.scale), Kr.ck = Rt(-t4.tilt, t4.tilt);
    } else Kr.cp = Rt(3, 3.5), Kr.ct = 0, Kr.cs = 1, Kr.ck = 0;
    [Kr.min, Kr.max] = i3.min_max, Wr || (Kr.cos = Xt(qr), Kr.sin = Yt(qr)), function() {
      C(), function() {
        const t5 = n?.glMask;
        t5 && (We = t5, We.dirtyRect ??= null, We.isDrawn ??= false, F.glMask = We);
      }();
      const t4 = n.drawingContext, i4 = !Ve || Oe !== t4;
      (i4 || He !== e || $e !== r) && (Xe = new Float32Array([2 / e, 0, 0, 0, 0, 2 / r, 0, 0, 0, 0, 1, 0, -1, -1, 0, 1]), He = e, $e = r), i4 && (function() {
        if (Oe && !Oe.isContextLost?.()) {
          for (const t5 of wr.values()) Oe.deleteTexture(t5);
          wr.clear(), Ge && Oe.deleteProgram(Ge), Ye && Oe.deleteVertexArray(Ye), ze && Oe.deleteBuffer(ze), ur && Oe.deleteProgram(ur), fr && Oe.deleteVertexArray(fr), mr && Oe.deleteBuffer(mr), dr && Oe.deleteBuffer(dr), Ge = Ye = ze = null, ur = fr = mr = dr = null, lr = 0, yr = 0;
        } else wr.clear();
      }(), Oe = t4, Ge = Ne(Oe, "#version 300 es\n#define GLSLIFY 1\nin vec2 a_position;in float a_radius;in float a_alpha;uniform mat4 u_matrix;out float v_alpha;void main(){gl_Position=u_matrix*vec4(a_position,0.0,1.0);v_alpha=a_alpha;gl_PointSize=a_radius*2.0;}", "#version 300 es\nprecision highp float;\n#define GLSLIFY 1\nin float v_alpha;out vec4 outColor;uniform vec4 u_color;void main(){vec2 v=gl_PointCoord-vec2(0.5);float f=length(v);float a=fwidth(f);f=1.0-smoothstep(0.5-a,0.5+a,f);if(f<0.01){discard;}outColor=vec4(u_color.xyz,v_alpha*f);}"), Oe.useProgram(Ge), Oe.enable(Oe.BLEND), Oe.blendFunc(Oe.ONE_MINUS_DST_ALPHA, Oe.ONE), ["a_position", "a_radius", "a_alpha"].forEach((t5) => qe[t5] = Oe.getAttribLocation(Ge, t5)), ["u_matrix", "u_color"].forEach((t5) => je[t5] = Oe.getUniformLocation(Ge, t5)), Ye = Oe.createVertexArray(), Oe.bindVertexArray(Ye), ze = Oe.createBuffer(), Oe.bindBuffer(Oe.ARRAY_BUFFER, ze), Oe.bufferData(Oe.ARRAY_BUFFER, or.byteLength, Oe.DYNAMIC_DRAW), lr = or.byteLength, Oe.enableVertexAttribArray(qe.a_position), Oe.vertexAttribPointer(qe.a_position, 2, Oe.FLOAT, false, 16, 0), Oe.enableVertexAttribArray(qe.a_radius), Oe.vertexAttribPointer(qe.a_radius, 1, Oe.FLOAT, false, 16, 8), Oe.enableVertexAttribArray(qe.a_alpha), Oe.vertexAttribPointer(qe.a_alpha, 1, Oe.FLOAT, false, 16, 12), Oe.bindVertexArray(null), ur = Ne(Oe, "#version 300 es\n#define GLSLIFY 1\nin vec2 a_corner;in vec2 a_pos;in float a_size;in float a_angle;in float a_alpha;uniform mat4 u_proj;out vec2 v_uv;out float v_alpha;void main(){float c=cos(a_angle);float s=sin(a_angle);vec2 rotated=vec2(c*a_corner.x-s*a_corner.y,s*a_corner.x+c*a_corner.y);gl_Position=u_proj*vec4(a_pos+rotated*a_size,0.0,1.0);v_uv=a_corner*0.5+0.5;v_alpha=a_alpha;}", "#version 300 es\nprecision highp float;\n#define GLSLIFY 1\nin vec2 v_uv;in float v_alpha;uniform sampler2D u_tex;uniform vec4 u_color;out vec4 outColor;void main(){float inkAlpha=texture(u_tex,v_uv).a;if(inkAlpha<0.01)discard;outColor=vec4(u_color.rgb,inkAlpha*v_alpha);}"), ["a_corner", "a_pos", "a_size", "a_angle", "a_alpha"].forEach((t5) => gr[t5] = Oe.getAttribLocation(ur, t5)), ["u_proj", "u_color", "u_tex"].forEach((t5) => xr[t5] = Oe.getUniformLocation(ur, t5)), fr = Oe.createVertexArray(), Oe.bindVertexArray(fr), mr = Oe.createBuffer(), Oe.bindBuffer(Oe.ARRAY_BUFFER, mr), Oe.bufferData(Oe.ARRAY_BUFFER, Rr, Oe.STATIC_DRAW), Oe.enableVertexAttribArray(gr.a_corner), Oe.vertexAttribPointer(gr.a_corner, 2, Oe.FLOAT, false, 0, 0), dr = Oe.createBuffer(), Oe.bindBuffer(Oe.ARRAY_BUFFER, dr), Oe.bufferData(Oe.ARRAY_BUFFER, pr.byteLength, Oe.DYNAMIC_DRAW), yr = pr.byteLength, Oe.enableVertexAttribArray(gr.a_pos), Oe.vertexAttribPointer(gr.a_pos, 2, Oe.FLOAT, false, 20, 0), Oe.vertexAttribDivisor(gr.a_pos, 1), Oe.enableVertexAttribArray(gr.a_size), Oe.vertexAttribPointer(gr.a_size, 1, Oe.FLOAT, false, 20, 8), Oe.vertexAttribDivisor(gr.a_size, 1), Oe.enableVertexAttribArray(gr.a_angle), Oe.vertexAttribPointer(gr.a_angle, 1, Oe.FLOAT, false, 20, 12), Oe.vertexAttribDivisor(gr.a_angle, 1), Oe.enableVertexAttribArray(gr.a_alpha), Oe.vertexAttribPointer(gr.a_alpha, 1, Oe.FLOAT, false, 20, 16), Oe.vertexAttribDivisor(gr.a_alpha, 1), Oe.bindVertexArray(null), Ve = true);
    }();
    const a3 = true !== F.isBrush;
    F.isBrush = true, a3 && (F.justChanged = true), F.blend(P.stroke.color);
    const o3 = ["default", "spray"].includes(Kr.p.type) ? Kr.p.opacity : Kr.p.opacity / Math.min(P.stroke.weight, 1.3), s3 = 0.1 * (Kr.p.noise ?? 0);
    Kr.alpha = s3 > 0 ? Math.max(0, o3 * (1 + Ft(0, s3))) : o3, Kr.overscan = function() {
      const t4 = Math.max(1, Kr.max ?? 1), e2 = P.stroke.weight * Kr.p.scatter, r2 = P.stroke.weight * Kr.p.weight * t4;
      return Math.max(8, 1.5 * e2 + 0.75 * r2);
    }(), Kr.drawFn = "spray" === Kr.p.type ? nn : "marker" === Kr.p.type ? an : "custom" === Kr.p.type || "image" === Kr.p.type ? on : sn, cn();
  }();
  const a2 = Kr.p?.spacing ?? 1, o2 = Math.round($r * (i2 ? t2 : 1) / a2);
  Kr.pressureCount = 10, Kr.cachedPressure = void 0;
  const s2 = 2 * o2;
  for (; Jr.length < s2; ) Jr.push(Ft());
  for (let e2 = 0; e2 < o2; e2++) i2 && (jr = Wr.angle(Hr.plotted)), tn(), i2 ? Hr.plotTo(Wr, a2, a2, t2, jr) : Hr._moveToDegrees(t2, a2, a2);
  !function() {
    cn(), function() {
      if (0 === sr) return;
      F.glMask.isDrawn = true;
      const t4 = Ar(), e2 = P.stroke.color._array;
      Oe.useProgram(Ge), Oe.enable(Oe.BLEND), Oe.blendFunc(Oe.ONE_MINUS_DST_ALPHA, Oe.ONE), Oe.bindVertexArray(Ye), Oe.bindBuffer(Oe.ARRAY_BUFFER, ze);
      const r2 = 16 * sr, i3 = or.subarray(0, 4 * sr);
      r2 > lr ? (Oe.bufferData(Oe.ARRAY_BUFFER, or, Oe.DYNAMIC_DRAW), lr = or.byteLength) : Oe.bufferSubData(Oe.ARRAY_BUFFER, 0, i3), Oe.uniform4f(je.u_color, ...e2), Oe.uniformMatrix4fv(je.u_matrix, false, Er()), Oe.drawArrays(Oe.POINTS, 0, sr), Oe.bindVertexArray(null), Mr(t4), hr && (F.markDirtyRect(F.glMask, hr), hr = null), sr = 0, Ue(n, Oe);
    }();
    const t3 = Kr.p?.type;
    "image" === t3 ? Pr(mn.tips.get(Kr.p.image.src), Kr.p.image.src) : "custom" === t3 && Pr(mn.tips.get(Kr.p.tipKey), Kr.p.tipKey);
  }();
}
function tn() {
  const t2 = en();
  Kr.drawFn(t2);
}
function en() {
  return (Kr.pressureCount >= 10 || void 0 === Kr.cachedPressure) && (Kr.cachedPressure = Wr ? rn() * Wr.pressure(Hr.plotted) : rn(), Kr.pressureCount = 0), Kr.pressureCount++, Kr.cachedPressure;
}
function rn() {
  if (!Kr.isCustomPressure) return function(t3 = 0.5 + Kr.p.pressure.curve[0] * Kr.a, e2 = 1 - Kr.p.pressure.curve[1] * Kr.b, r2 = Kr.cp, n2 = Kr.min, i2 = Kr.max) {
    const a2 = t3 * $r, o2 = (Hr.plotted < a2 ? 1.2 * e2 : 0.8 * e2) * ($r / 2);
    return kt(1 / (1 + Math.pow(Math.abs((Hr.plotted - a2) / o2), 2 * r2)), 0, 1, n2, i2);
  }();
  const t2 = Hr.plotted / $r;
  return kt(Kr.p.pressure.curve(Math.max(0, Math.min(1, 0.5 + (t2 - 0.5 + Kr.ct) * Kr.cs))) + Kr.cp + Kr.ck * (t2 - 0.5), 0, 1, Kr.min, Kr.max, true);
}
function nn(t2) {
  const e2 = P.stroke.weight * Kr.p.scatter * t2 + P.stroke.weight * Mt(Jr) * Kr.p.scatter / 3, r2 = Kr.p.weight * Rt(0.9, 1.1), n2 = Math.ceil(Kr.p.grain / t2);
  for (let t3 = 0; t3 < n2; t3++) {
    const t4 = Rt(0.9, 1.1), n3 = t4 * e2 * Rt(-1, 1), i2 = Rt(-1, 1), a2 = Math.sqrt((t4 * e2) ** 2 - n3 ** 2);
    Sr(Hr.x + n3, Hr.y + i2 * a2, r2, Kr.alpha);
  }
}
function an(t2, e2 = true, r2 = Kr.alpha) {
  const n2 = e2 ? P.stroke.weight * Kr.p.scatter : 0, i2 = e2 ? n2 * Rt(-1, 1) : 0, a2 = e2 ? n2 * Rt(-1, 1) : 0;
  Sr(Hr.x + i2, Hr.y + a2, P.stroke.weight * Kr.p.weight * t2, r2 * Math.max(0.8, t2) * Rt(0.9, 1.1));
}
function on(t2, e2 = Kr.alpha) {
  const r2 = P.stroke.weight * Kr.p.scatter, n2 = r2 * Rt(-1, 1), i2 = r2 * Rt(-1, 1), a2 = Kr.p.weight * P.stroke.weight * t2, o2 = Kr.overscan;
  let s2 = 0;
  "random" === Kr.p.rotate ? s2 = Tt(0, 360) * (Math.PI / 180) : "natural" === Kr.p.rotate && (s2 = ((Wr ? -jr : -qr) + Hr.angle()) * (Math.PI / 180)), function(t3, e3, r3, n3, i3, a3 = 0) {
    if (br >= _r) {
      _r *= 2;
      const t4 = new Float32Array(5 * _r);
      t4.set(pr), pr = t4;
    }
    const o3 = t3 - rr, s3 = e3 - nr, c2 = Ke * o3 + Je * s3 + tr + rr, l2 = Ze * o3 + Qe * s3 + er + nr, h2 = ar * r3 * ir / 2, u2 = ar * a3 * ir, f2 = 5 * br;
    pr[f2] = c2, pr[f2 + 1] = l2, pr[f2 + 2] = h2, pr[f2 + 3] = n3, pr[f2 + 4] = i3 / 255;
    const m2 = c2 * ar, d2 = l2 * ar, g2 = 1.42 * h2 + u2;
    vr = Tr(vr, m2 - g2 - 1, d2 - g2 - 1, m2 + g2 + 1, d2 + g2 + 1), br++;
  }(Hr.x + n2, Hr.y + i2, a2, s2, e2 * Math.max(0.8, t2) * Rt(0.9, 1.1), o2);
}
function sn(t2) {
  if (Rt(0, 1) >= Kr.p.grain * t2) return;
  const e2 = P.stroke.weight * Kr.p.scatter * (Kr.p.sharpness + (1 - Kr.p.sharpness) * Mt(Jr) / t2);
  let r2, n2;
  if (Wr) {
    const t3 = jr, i3 = Xt(t3), a3 = Yt(t3), o2 = e2 * Rt(-1, 1), s2 = 0.3 * e2 * Rt(-1, 1);
    r2 = o2 * a3 + s2 * i3, n2 = o2 * i3 - s2 * a3;
  } else {
    const t3 = e2 * Rt(-1, 1), i3 = 0.3 * e2 * Rt(-1, 1);
    r2 = t3 * Kr.sin + i3 * Kr.cos, n2 = t3 * Kr.cos - i3 * Kr.sin;
  }
  const i2 = t2 * t2 * Kr.p.weight * Rt(0.85, 1.15) * P.stroke.weight, a2 = Math.max(0.9, t2) * Kr.alpha * Rt(0.75, 1.1);
  Sr(Hr.x + r2, Hr.y + n2, i2, a2);
}
function cn() {
  if (false === Kr.p.markerTip) return;
  let t2 = en(), e2 = Kr.alpha;
  if ("marker" === Kr.p.type) for (let r2 = 1; r2 < 10; r2++) an(t2 * r2 / 10, true, 8 * e2);
  else if ("custom" === Kr.p.type || "image" === Kr.p.type) for (let r2 = 1; r2 < 5; r2++) on(t2 * r2 / 10, 2 * e2);
}
function ln(t2, e2, r2, n2) {
  if (!P.stroke.isActive || !P.stroke.color) throw new Error("No brush or color set. Call brush.set('brushName', color) before drawing.");
  Zt();
  let i2 = Wt(t2, e2, r2, n2);
  0 != i2 && (Zr(t2, e2, i2), Qr(qt(t2, e2, r2, n2), false));
}
function hn(t2, e2, r2, n2) {
  if (!P.stroke.isActive || !P.stroke.color) throw new Error("No brush or color set. Call brush.set('brushName', color) before drawing.");
  Zt(), Zr(t2, e2, r2), Qr(Vt(n2), false);
}
function dn() {
  return { ...P.hatch };
}
function gn(t2) {
  P.hatch = { ...t2 };
}
function xn(t2 = 5, e2 = 45, r2 = { rand: false, continuous: false, gradient: false }) {
  let n2 = P.hatch;
  n2.isActive = true, n2.dist = t2, n2.angle = Ht(e2), n2.options = r2;
}
function yn(t2, e2 = "black", r2 = 1) {
  P.hatch.hBrush = { brush: t2, color: e2, weight: r2 };
}
function pn() {
  P.hatch.isActive = false, P.hatch.hBrush = false;
}
function An(t2, e2, r2, n2) {
  const i2 = function(t3, e3, r3, n3) {
    Array.isArray(t3) || (t3 = [t3]);
    const i3 = e3 * Math.PI / 180, a2 = Math.cos(i3), o2 = Math.sin(i3);
    let s2 = 0;
    for (const e4 of t3) s2 += e4.a.length;
    if (0 === s2) return [];
    bn.length < s2 && (bn = new Float64Array(2 * s2), _n = new Float64Array(2 * s2));
    let c2 = Infinity, l2 = -Infinity, h2 = 0, u2 = 0;
    vn.length < s2 && (vn = new Float64Array(2 * s2), wn = new Float64Array(2 * s2), Rn = new Float64Array(2 * s2), En = new Float64Array(2 * s2));
    for (const e4 of t3) {
      const t4 = e4.a, r4 = t4.length, n4 = u2;
      for (let e5 = 0; e5 < r4; e5++) {
        const r5 = t4[e5][0], n5 = t4[e5][1];
        bn[u2] = r5 * a2 - n5 * o2, _n[u2] = r5 * o2 + n5 * a2, _n[u2] < c2 && (c2 = _n[u2]), _n[u2] > l2 && (l2 = _n[u2]), u2++;
      }
      for (let t5 = 0; t5 < r4; t5++) {
        const e5 = n4 + t5, i4 = n4 + (t5 + 1 < r4 ? t5 + 1 : 0), a3 = _n[e5], o3 = _n[i4];
        a3 !== o3 && (vn[h2] = bn[e5], wn[h2] = a3, Rn[h2] = bn[i4], En[h2] = o3, h2++);
      }
    }
    const f2 = [], m2 = [];
    let d2 = c2 + 0.5 * r3, g2 = r3;
    const x2 = 1 !== n3;
    for (; d2 < l2; ) {
      m2.length = 0;
      for (let t5 = 0; t5 < h2; t5++) {
        const e4 = wn[t5], r4 = En[t5];
        e4 <= d2 != r4 <= d2 && m2.push(vn[t5] + (d2 - e4) / (r4 - e4) * (Rn[t5] - vn[t5]));
      }
      const t4 = m2.length;
      if (2 === t4) {
        let t5 = m2[0], e4 = m2[1];
        if (t5 > e4) {
          const r4 = t5;
          t5 = e4, e4 = r4;
        }
        f2.push({ scanY: d2, x1: t5 * a2 + d2 * o2, y1: -t5 * o2 + d2 * a2, x2: e4 * a2 + d2 * o2, y2: -e4 * o2 + d2 * a2 });
      } else if (t4 > 2) {
        m2.sort((t5, e4) => t5 - e4);
        for (let e4 = 0; e4 < t4 - 1; e4 += 2) {
          const t5 = m2[e4], r4 = m2[e4 + 1];
          f2.push({ scanY: d2, x1: t5 * a2 + d2 * o2, y1: -t5 * o2 + d2 * a2, x2: r4 * a2 + d2 * o2, y2: -r4 * o2 + d2 * a2 });
        }
      }
      d2 += g2, x2 && (g2 *= n3);
    }
    return f2;
  }(t2, r2, e2, n2);
  return i2.sort((t3, e3) => t3.scanY === e3.scanY ? t3.x1 - e3.x1 : t3.scanY - e3.scanY), i2;
}
function Mn(t2) {
  const { dist: e2, options: r2, segs: n2 } = function(t3) {
    const e3 = P.hatch.dist, r3 = (P.hatch.angle % 180 + 180) % 180, n3 = P.hatch.options;
    return { dist: e3, options: n3, segs: An(t3, e3, r3, n3.gradient ? kt(n3.gradient, 0, 1, 1, 1.1, true) : 1) };
  }(t2), i2 = r2.rand || 0, a2 = [];
  for (let t3 = 0; t3 < n2.length; t3++) {
    const o2 = n2[t3];
    let s2 = o2.x1, c2 = o2.y1, l2 = o2.x2, h2 = o2.y2;
    i2 && (s2 += 2 * i2 * e2 * Rt(-1, 1), c2 += 2 * i2 * e2 * Rt(-1, 1), l2 += 2 * i2 * e2 * Rt(-1, 1), h2 += 2 * i2 * e2 * Rt(-1, 1));
    const u2 = r2.continuous && t3 % 2 == 1 ? { x1: l2, y1: h2, x2: s2, y2: c2, scanY: o2.scanY, isConnector: false } : { x1: s2, y1: c2, x2: l2, y2: h2, scanY: o2.scanY, isConnector: false };
    if (a2.push(u2), t3 > 0 && r2.continuous) {
      const t4 = a2[a2.length - 2];
      a2.push({ x1: t4.x2, y1: t4.y2, x2: u2.x1, y2: u2.y1, scanY: o2.scanY, isConnector: true });
    }
  }
  return a2;
}
function Tn(t2) {
  !function(t3, e2) {
    const r2 = Mn(t3);
    !function() {
      const t4 = Ir();
      (() => {
        for (let t5 = 0; t5 < r2.length; t5++) {
          const n2 = r2[t5];
          e2(n2.x1, n2.y1, n2.x2, n2.y2, t5, r2);
        }
      })(), kr(t4);
    }();
  }(t2, (t3, e2, r2, n2) => {
    P.hatch.hBrush && Yr(P.hatch.hBrush.brush, P.hatch.hBrush.color, P.hatch.hBrush.weight * Rt(0.9, 1.1)), ln(t3, e2, r2, n2);
  });
}
function Sn(t2, e2, r2 = {}) {
  P.mass.brush = t2, P.mass.color = e2, P.mass.options = r2, P.mass.isActive = true;
}
function Pn() {
  P.mass.isActive = false, P.mass.brush = null, P.mass.color = null, P.mass.options = {};
}
function Cn(t2, e2, r2) {
  return new ge(t2.vertices.map((t3) => [t3.x + e2, t3.y + r2]));
}
function Fn(t2, e2, r2) {
  return t2.map((t3) => Cn(t3, e2, r2));
}
function In(t2) {
  const e2 = Array.isArray(t2) ? t2.flatMap((t3) => t3?.a ?? []) : t2?.a ?? [];
  let r2 = Infinity, n2 = Infinity, i2 = -Infinity, a2 = -Infinity;
  for (const [t3, o2] of e2) t3 < r2 && (r2 = t3), o2 < n2 && (n2 = o2), t3 > i2 && (i2 = t3), o2 > a2 && (a2 = o2);
  return { minX: r2, minY: n2, maxX: i2, maxY: a2, cx: (r2 + i2) / 2, cy: (n2 + a2) / 2, size: Math.hypot(i2 - r2, a2 - n2) };
}
function kn(t2, e2, r2, n2, i2) {
  const a2 = (e2 + n2) / 2, o2 = (r2 + i2) / 2, s2 = n2 - e2, c2 = i2 - r2, l2 = Math.hypot(s2, c2);
  if (!l2) return null;
  const h2 = -c2 / l2, u2 = s2 / l2, f2 = (t2.x - a2) * h2 + (t2.y - o2) * u2;
  return { x: a2 + h2 * f2, y: o2 + u2 * f2 };
}
function Dn(t2, e2, r2, n2, i2, a2) {
  if (!Array.isArray(t2)) return e2;
  const o2 = (r2 + i2) / 2, s2 = (n2 + a2) / 2, c2 = Math.hypot(i2 - r2, a2 - n2), l2 = Math.max(In(t2).size, c2, 1), h2 = 0.08 + 0.18 * (1 - Math.min(1, c2 / (0.42 * l2)));
  return { x: e2.x + (o2 - e2.x) * h2, y: e2.y + (s2 - e2.y) * h2 };
}
function Ln(t2, e2, r2) {
  let n2 = false;
  for (let i2 = 0, a2 = t2.length - 1; i2 < t2.length; a2 = i2++) {
    const o2 = t2[i2][0], s2 = t2[i2][1], c2 = t2[a2][0], l2 = t2[a2][1];
    s2 > r2 != l2 > r2 && e2 < (c2 - o2) * (r2 - s2) / (l2 - s2 || Number.EPSILON) + o2 && (n2 = !n2);
  }
  return n2;
}
function Nn(t2, e2, r2) {
  if (Array.isArray(t2)) {
    let n2 = false;
    for (const i2 of t2) Ln(i2.a, e2, r2) && (n2 = !n2);
    return n2;
  }
  return Ln(t2.a, e2, r2);
}
function Bn(t2, e2, r2, n2, i2, a2, o2) {
  const s2 = a2(n2), c2 = (s2 + ((a2(i2) - s2) % 360 + 360) % 360 * o2) * Math.PI / 180;
  return { x: t2 + r2 * Math.cos(c2), y: e2 - r2 * Math.sin(c2) };
}
function Un(t2, e2, r2, n2, i2, a2, o2) {
  for (const s2 of [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]) {
    const c2 = Bn(e2, r2, n2, i2, a2, o2, s2);
    if (!Nn(t2, c2.x, c2.y)) return false;
  }
  return true;
}
function On(t2, e2, r2, n2, i2, a2, o2, s2, c2, l2) {
  const h2 = function(t3, e3, r3, n3, i3, a3, o3) {
    let s3 = qt(t3, e3, r3, n3), c3 = qt(t3, e3, i3, a3);
    return ((c3 - s3) % 360 + 360) % 360 > 180 && ([s3, c3] = [c3, s3]), [o3(s3), o3(c3)];
  }(e2, r2, i2, a2, o2, s2, c2), u2 = [h2[1], h2[0]], f2 = Un(t2, e2, r2, n2, h2[0], h2[1], l2), m2 = Un(t2, e2, r2, n2, u2[0], u2[1], l2);
  return f2 && !m2 ? h2 : m2 && !f2 ? u2 : f2 ? h2 : m2 ? u2 : null;
}
function Xn(t2) {
  const e2 = At(0.35, 0.65), r2 = t2.x1 + (t2.x2 - t2.x1) * e2, n2 = t2.y1 + (t2.y2 - t2.y1) * e2, i2 = t2.x2 - t2.x1, a2 = t2.y2 - t2.y1, o2 = Math.hypot(i2, a2) || 1, s2 = At(0.04, 0.1) * o2, c2 = i2 / o2 * s2 * 0.5, l2 = a2 / o2 * s2 * 0.5;
  return [{ x1: t2.x1, y1: t2.y1, x2: r2 - c2, y2: n2 - l2 }, { x1: r2 + c2, y1: n2 + l2, x2: t2.x2, y2: t2.y2 }];
}
function Yn(t2, e2, r2, n2) {
  const i2 = function(t3, e3) {
    const r3 = In(t3), n3 = r3.size * At(0.6, 1.4), [i3, a2] = e3;
    return { x: r3.cx + i3 * n3, y: r3.cy + a2 * n3 };
  }(t2, e2);
  for (const e3 of Mn(t2)) {
    const a2 = !e3.isConnector && At() < 0.35 ? Xn(e3) : [e3];
    for (const e4 of a2) {
      const a3 = kn(i2, e4.x1, e4.y1, e4.x2, e4.y2), o2 = a3 ? Dn(t2, a3, e4.x1, e4.y1, e4.x2, e4.y2) : null;
      if (!o2) continue;
      const s2 = Wt(o2.x, o2.y, e4.x1, e4.y1);
      if (!s2) continue;
      const c2 = On(t2, o2.x, o2.y, s2, e4.x1, e4.y1, e4.x2, e4.y2, r2, n2);
      if (!c2) continue;
      const [l2, h2] = c2;
      _e(o2.x, o2.y, s2, l2, h2);
    }
  }
}
function zn(t2, e2, r2, n2, i2, a2, o2) {
  xn(e2, r2, Array.isArray(t2) ? { ...n2, continuous: false } : n2), Yn(t2, i2, a2, o2);
}
function Gn(t2, e2, r2, n2) {
  const i2 = function(t3, e3, r3, n3) {
    const i3 = false === e3, a2 = Nr(P.mass.brush)?.scatter ?? 0, o2 = i3 ? t3 : t3.genPol(e3, r3, n3, 0.15), s3 = Math.min(2 * a2, 5), c3 = [[At(-s3, s3), At(-s3, s3)], [At(-s3, s3), At(-s3, s3)]];
    return Array.isArray(o2) ? [o2, Fn(o2, c3[0][0], c3[0][1]), Fn(o2, c3[1][0], c3[1][1])] : [o2, Cn(o2, c3[0][0], c3[0][1]), Cn(o2, c3[1][0], c3[1][1])];
  }(t2, e2, r2, n2), s2 = dn(), c2 = Ir(), l2 = { ...P.field }, h2 = P.mass.options?.precision ?? 0.5, u2 = P.mass.options?.strength ?? 1, f2 = P.mass.options?.gradient ?? 0.1, m2 = P.mass.options?.outline ?? false, d2 = Nr(P.mass.brush)?.scatter ?? 0, g2 = 1.6 * At(0.65 * d2, 0.85 * d2) - 0.4 * f2, x2 = At(-90, 90), y2 = ((x2 + 90) % 180 + 180) % 180 - 90 >= 0 ? At() < 0.5 ? [1, 1] : [-1, -1] : At() < 0.5 ? [-1, 1] : [1, -1], p2 = a() ? (t3) => t3 * Math.PI / 180 : (t3) => t3, b2 = a() ? (t3) => 180 * t3 / Math.PI : (t3) => t3;
  Yr(P.mass.brush, P.mass.color, 1), me(2 - h2), m2 && function(t3) {
    if (Array.isArray(t3)) for (const e3 of t3) e3.draw();
    else t3.draw();
  }(i2[0]), zn(i2[0], 0.9 * g2, o(x2), { gradient: f2, rand: 2 - 2 * h2, continuous: true }, y2, p2, b2), u2 > 0.33 && zn(i2[1], g2, o(x2 + 20 * At(-1, 1)), { gradient: f2, rand: 0.6 - 0.6 * h2, continuous: true }, y2, p2, b2), u2 > 0.66 && zn(i2[2], 0.8 * g2, o(x2 + 15 * At(-1, 1)), { gradient: f2, rand: 0.6 - 0.6 * h2, continuous: true }, y2, p2, b2), kr(c2), gn(s2), P.field = { ...l2 };
}
function Vn(t2) {
  return Gn(t2, false);
}
function Hn(t2, e2 = null) {
  const r2 = F.ctx;
  e2 || (e2 = r2.getTransform());
  const n2 = e2.a, i2 = e2.b, a2 = e2.c, o2 = e2.d, s2 = e2.e, c2 = e2.f;
  let l2 = Infinity, h2 = Infinity, u2 = -Infinity, f2 = -Infinity;
  r2.beginPath();
  const m2 = t2[0];
  let d2 = n2 * m2.x + a2 * m2.y + s2, g2 = i2 * m2.x + o2 * m2.y + c2;
  l2 = u2 = d2, h2 = f2 = g2, r2.moveTo(m2.x, m2.y);
  for (let e3 = 1; e3 < t2.length; e3++) {
    const m3 = t2[e3];
    d2 = n2 * m3.x + a2 * m3.y + s2, g2 = i2 * m3.x + o2 * m3.y + c2, l2 = Math.min(l2, d2), h2 = Math.min(h2, g2), u2 = Math.max(u2, d2), f2 = Math.max(f2, g2), r2.lineTo(m3.x, m3.y);
  }
  r2.closePath();
  const x2 = function(t3, e3) {
    const r3 = t3.lineWidth || 0;
    return r3 <= 0 ? 1 : 1 + r3 * Math.max(Math.hypot(e3.a, e3.c), Math.hypot(e3.b, e3.d)) / 2;
  }(r2, e2);
  F.markDirtyRect(F.mask, { minX: l2 - x2, minY: h2 - x2, maxX: u2 + x2, maxY: f2 + x2 });
}
function $n(t2, e2, r2) {
  const n2 = 2 * Math.PI, i2 = F.ctx, a2 = r2 / 2;
  i2.moveTo(t2 + a2, e2), i2.arc(t2, e2, a2, 0, n2);
}
function ei(t2, e2, r2, n2) {
  P.fill.opacity = (arguments.length < 4 ? e2 : n2) || 150, P.fill.color = arguments.length < 3 ? s(t2) : s(t2, e2, r2), P.fill.isActive = true;
}
function ri(t2, e2 = "out", r2 = null) {
  P.fill.bleed_strength = Dt(t2, 0, 1), P.fill.direction = e2, P.fill.angle = null == r2 ? null : Ht(r2);
}
function ni(t2 = 0.4, e2 = 0.4, r2 = true) {
  P.fill.texture_strength = Dt(t2, 0, 1), P.fill.border_strength = Dt(e2, 0, 1), P.fill.scatter = r2;
}
function ii() {
  P.fill.isActive = false;
}
function ui() {
  for (let t2 = 0; t2 < 512; t2++) hi[0][t2] = Ft(0.5, 0.2), hi[1][t2] = Ft(0, 0.02);
}
function mi(t2, e2, r2, n2) {
  m(), P.wash.opacity = (arguments.length < 4 ? e2 : n2) ?? 150, P.wash.color = arguments.length < 3 ? s(t2) : s(t2, e2, r2), P.wash.isActive = true;
}
function di() {
  P.wash.isActive = false;
}
function gi(t2, e2, r2) {
  const n2 = e2.isEnabled(e2.DEPTH_TEST);
  return n2 && e2.disable(e2.DEPTH_TEST), e2.bindFramebuffer(e2.FRAMEBUFFER, r2.framebuffer), e2.viewport(0, 0, r2.width * r2.density, r2.height * r2.density), { hadDepthTest: n2 };
}
function xi(t2, n2, a2) {
  a2?.hadDepthTest && n2.enable(n2.DEPTH_TEST), n2.bindFramebuffer(n2.FRAMEBUFFER, null), n2.viewport(0, 0, Math.max(1, Math.round(e * i)), Math.max(1, Math.round(r * i)));
}
function yi(t2, e2) {
  e2.activeTexture(e2.TEXTURE0), e2.bindTexture(e2.TEXTURE_2D, null), e2.blendEquation(e2.FUNC_ADD), e2.blendFunc(e2.ONE, e2.ONE_MINUS_SRC_ALPHA);
}
function pi(t2, e2, r2) {
  if (!e2) return;
  if (r2(e2)) {
    const r3 = t2.drawingContext, n3 = r3.getParameter(r3.FRAMEBUFFER_BINDING), i2 = r3.getParameter(r3.VIEWPORT);
    return r3.bindFramebuffer(r3.FRAMEBUFFER, e2.framebuffer), r3.viewport(0, 0, e2.width * e2.density, e2.height * e2.density), r3.clearColor(0, 0, 0, 0), r3.clear(r3.COLOR_BUFFER_BIT), r3.bindFramebuffer(r3.FRAMEBUFFER, n3), void r3.viewport(i2[0], i2[1], i2[2], i2[3]);
  }
  const n2 = e2.drawingContext;
  n2.save(), n2.setTransform(1, 0, 0, 1, 0, 0), n2.clearRect(0, 0, e2.width, e2.height), n2.restore();
}
function bi(t2, e2, r2) {
  return t2.shaderProgram ??= function(t3, e3, r3) {
    const n2 = Ne(t3, e3, r3), i2 = /* @__PURE__ */ new Map(), a2 = t3.createVertexArray(), o2 = t3.getUniformLocation(n2, "u_source"), s2 = t3.getUniformLocation(n2, "u_mask"), c2 = t3.getUniformLocation(n2, "u_color");
    return { program: n2, quadVao: a2, loc_source: o2, loc_mask: s2, loc_color: c2, setUniform(e4, r4) {
      const a3 = ((e5) => (i2.has(e5) || i2.set(e5, t3.getUniformLocation(n2, e5)), i2.get(e5)))(e4);
      a3 && ("boolean" != typeof r4 ? "number" != typeof r4 ? Array.isArray(r4) && (3 === r4.length ? t3.uniform3f(a3, r4[0], r4[1], r4[2]) : 4 === r4.length && t3.uniform4f(a3, r4[0], r4[1], r4[2], r4[3])) : t3.uniform1f(a3, r4) : t3.uniform1i(a3, r4 ? 1 : 0));
    } };
  }(t2.drawingContext, e2, r2), t2.shaderProgram;
}
function _i(t2, e2) {
  const r2 = t2.drawingContext, n2 = e2.density ?? 1, i2 = r2.createFramebuffer(), a2 = Math.max(1, e2.width), o2 = Math.max(1, e2.height), s2 = Math.max(1, Math.round(a2 * n2)), c2 = Math.max(1, Math.round(o2 * n2)), l2 = function(t3, e3, r3) {
    const n3 = t3.createTexture();
    return t3.bindTexture(t3.TEXTURE_2D, n3), t3.texImage2D(t3.TEXTURE_2D, 0, t3.RGBA, e3, r3, 0, t3.RGBA, t3.UNSIGNED_BYTE, null), t3.texParameteri(t3.TEXTURE_2D, t3.TEXTURE_MIN_FILTER, t3.LINEAR), t3.texParameteri(t3.TEXTURE_2D, t3.TEXTURE_MAG_FILTER, t3.LINEAR), t3.texParameteri(t3.TEXTURE_2D, t3.TEXTURE_WRAP_S, t3.CLAMP_TO_EDGE), t3.texParameteri(t3.TEXTURE_2D, t3.TEXTURE_WRAP_T, t3.CLAMP_TO_EDGE), t3.bindTexture(t3.TEXTURE_2D, null), n3;
  }(r2, s2, c2);
  return r2.bindFramebuffer(r2.FRAMEBUFFER, i2), r2.framebufferTexture2D(r2.FRAMEBUFFER, r2.COLOR_ATTACHMENT0, r2.TEXTURE_2D, l2, 0), r2.bindFramebuffer(r2.FRAMEBUFFER, null), { __brushFramebuffer: true, framebuffer: i2, colorTexture: l2, width: a2, height: o2, density: n2, pixelDensity: () => n2, remove() {
    r2.deleteFramebuffer(i2), r2.deleteTexture(l2);
  } };
}
function vi(t2, e2, r2, n2, i2) {
  return e2?.remove?.(), _i(t2, { width: r2, height: n2, density: i2 });
}
function wi({ renderer: t2, shader: e2, source: r2, mask: n2, color: i2, isBrushMask: a2, dirtyRect: o2, targetIsFramebuffer: s2, withScissor: c2 }) {
  const l2 = t2.drawingContext, h2 = l2.isEnabled(l2.DEPTH_TEST), u2 = l2.getParameter(l2.FRAMEBUFFER_BINDING), f2 = l2.getParameter(l2.CURRENT_PROGRAM), m2 = l2.getParameter(l2.VERTEX_ARRAY_BINDING);
  l2.bindVertexArray(e2.quadVao), l2.useProgram(e2.program), l2.disable(l2.DEPTH_TEST), l2.enable(l2.BLEND), l2.blendEquation(l2.FUNC_ADD), l2.blendFunc(l2.ONE, l2.ONE_MINUS_SRC_ALPHA), l2.activeTexture(l2.TEXTURE0), l2.bindTexture(l2.TEXTURE_2D, r2.colorTexture), l2.uniform1i(e2.loc_source, 0), l2.activeTexture(l2.TEXTURE1), l2.bindTexture(l2.TEXTURE_2D, n2.colorTexture), l2.uniform1i(e2.loc_mask, 1), e2.setUniform("u_targetIsFramebuffer", s2), e2.setUniform("u_isBrush", a2), l2.uniform3f(e2.loc_color, i2[0], i2[1], i2[2]), l2.bindFramebuffer(l2.FRAMEBUFFER, null), c2(l2, o2, () => {
    l2.drawArrays(l2.TRIANGLES, 0, 3);
  }, !s2), l2.bindTexture(l2.TEXTURE_2D, null), l2.activeTexture(l2.TEXTURE0), l2.bindVertexArray(m2), l2.useProgram(f2), l2.bindFramebuffer(l2.FRAMEBUFFER, u2), h2 && l2.enable(l2.DEPTH_TEST);
}
function Ri(t2) {
  return function({ renderer: t3, sourceFramebuffer: e2, dirtyRect: r2, getTargetPixelSize: n2, toScissorBox: i2 }) {
    const a2 = t3.drawingContext, { width: o2, height: s2 } = n2(), c2 = r2 ? i2(r2) : null, l2 = a2.getParameter(a2.READ_FRAMEBUFFER_BINDING), h2 = a2.getParameter(a2.DRAW_FRAMEBUFFER_BINDING);
    return a2.bindFramebuffer(a2.READ_FRAMEBUFFER, null), a2.bindFramebuffer(a2.DRAW_FRAMEBUFFER, e2.framebuffer), a2.blitFramebuffer(c2?.x ?? 0, c2?.y ?? 0, c2 ? c2.x + c2.width : o2, c2 ? c2.y + c2.height : s2, c2?.x ?? 0, c2?.y ?? 0, c2 ? c2.x + c2.width : o2, c2 ? c2.y + c2.height : s2, a2.COLOR_BUFFER_BIT, a2.NEAREST), a2.bindFramebuffer(a2.READ_FRAMEBUFFER, l2), a2.bindFramebuffer(a2.DRAW_FRAMEBUFFER, h2), e2;
  }(t2);
}
function Ei(t2) {
  if ("number" == typeof t2) {
    const e2 = Math.max(0, Math.min(255, t2));
    return `rgb(${e2} ${e2} ${e2})`;
  }
  return t2 ?? "black";
}
function Ai(t2) {
  const e2 = ((t3, e3 = false) => (t3.drawingContext ??= t3.getContext("2d", e3 ? { willReadFrequently: true } : void 0), t3.drawingContext))(t2, true), r2 = { canvas: t2, drawingContext: e2, width: t2.width, height: t2.height, pixels: null, _fillStyle: "#ffffff", _strokeStyle: "transparent", _lineWidth: 1, pixelDensity: () => 1, background(r3) {
    e2.save(), e2.setTransform(1, 0, 0, 1, 0, 0), e2.fillStyle = Ei(r3), e2.fillRect(0, 0, t2.width, t2.height), e2.restore();
  }, noSmooth() {
    e2.imageSmoothingEnabled = false;
  }, push() {
    e2.save();
  }, pop() {
    e2.restore();
  }, translate(t3, r3) {
    e2.translate(t3, r3);
  }, scale(t3, r3 = t3) {
    e2.scale(t3, r3);
  }, rotate(t3) {
    e2.rotate(t3);
  }, noStroke() {
    r2._strokeStyle = "transparent";
  }, stroke(t3) {
    r2._strokeStyle = Ei(t3);
  }, noFill() {
    r2._fillStyle = "transparent";
  }, fill(t3) {
    r2._fillStyle = Ei(t3);
  }, strokeWeight(t3) {
    r2._lineWidth = t3;
  }, rect(t3, n2, i2, a2) {
    e2.beginPath(), e2.rect(t3, n2, i2, a2), r2._paint();
  }, circle(t3, n2, i2) {
    e2.beginPath(), e2.arc(t3, n2, i2 / 2, 0, 2 * Math.PI), r2._paint();
  }, ellipse(t3, n2, i2, a2) {
    e2.beginPath(), e2.ellipse(t3, n2, i2 / 2, a2 / 2, 0, 0, 2 * Math.PI), r2._paint();
  }, line(t3, n2, i2, a2) {
    e2.beginPath(), e2.moveTo(t3, n2), e2.lineTo(i2, a2), e2.strokeStyle = r2._strokeStyle, e2.lineWidth = r2._lineWidth, e2.stroke();
  }, beginShape() {
    e2.beginPath(), r2._shapeStarted = false;
  }, vertex(t3, n2) {
    r2._shapeStarted ? e2.lineTo(t3, n2) : (e2.moveTo(t3, n2), r2._shapeStarted = true);
  }, endShape(t3 = false) {
    t3 && e2.closePath(), r2._paint();
  }, loadPixels() {
    r2.pixels = e2.getImageData(0, 0, t2.width, t2.height).data;
  }, updatePixels() {
    const n2 = e2.getImageData(0, 0, t2.width, t2.height);
    n2.data.set(r2.pixels), e2.putImageData(n2, 0, 0);
  }, _paint() {
    "transparent" !== r2._fillStyle && (e2.fillStyle = r2._fillStyle, e2.fill()), "transparent" !== r2._strokeStyle && (e2.strokeStyle = r2._strokeStyle, e2.lineWidth = r2._lineWidth, e2.stroke());
  } };
  return r2;
}
function Mi(t2, e2) {
  return Ai(p(t2, e2, true));
}
function Ti(t2, e2) {
  return new Promise((r2, n2) => {
    const i2 = globalThis.Image;
    if (!i2) return void n2(new Error("Standalone image brush loading requires Image support."));
    const a2 = new i2();
    a2.onload = () => {
      const t3 = Ai(p(a2.naturalWidth, a2.naturalHeight, true));
      t3.drawingContext.drawImage(a2, 0, 0), e2(t3), r2(t3);
    }, a2.onerror = () => n2(new Error(`Failed to load image tip: ${t2}`)), a2.crossOrigin = "anonymous", a2.src = t2;
  });
}
var t, e, r, n, i, a, o, s, c, l, u, m, d, g, x, y, p, b, _, v, w, R, E, A, M, T, S, P, C, F, I, k, D, L, N, B, U, O, X, z, Z, J, et, rt, nt, it, at, ct, lt, ht, ut, ft, gt, xt, yt, pt, bt, _t, vt, wt, Rt, At, Mt, Tt, St, Pt, Ct, Ft, It, kt, Dt, Lt, Nt, Bt, Ut, Ot, Xt, Yt, zt, Gt, Vt, Ht, $t, Wt, qt, jt, Kt, Jt, Qt, te, ee, re, ne, ie, ae, ge, xe, ve, we, Re, Ee, Ae, De, Le, Ne, Be, Ue, Oe, Xe, Ye, ze, Ge, Ve, He, $e, We, qe, je, Ke, Ze, Je, Qe, tr, er, rr, nr, ir, ar, or, sr, cr, lr, hr, ur, fr, mr, dr, gr, xr, yr, pr, br, _r, vr, wr, Rr, Cr, Fr, Hr, $r, Wr, qr, jr, Kr, Jr, un, fn, mn, bn, _n, vn, wn, Rn, En, Wn, qn, jn, Kn, Zn, Jn, Qn, ti, ai, oi, si, ci, li, hi, fi, Si;
var init_brush_esm = __esm({
  "js/vendor/brush.esm.js"() {
    t = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
    a = () => false;
    o = (t2) => t2;
    s = () => {
      throw new Error("No runtime color adapter registered.");
    };
    c = () => t;
    l = () => {
    };
    u = { load: () => {
      throw new Error("No target runtime adapter registered.");
    }, syncDensity: () => i, isCanvasReady: () => {
      throw new Error("No target runtime adapter registered.");
    }, instance: (t2) => {
    }, activateInstance: (t2) => {
    }, deactivateInstance: () => {
    }, getActiveFramebuffer: () => null, isFramebufferTarget: () => false };
    m = () => u.isCanvasReady();
    d = (t2) => u.instance(t2);
    g = () => u.getActiveFramebuffer();
    x = (t2) => u.isFramebufferTarget(t2);
    y = (t2, e2 = 0) => t2 ? { minX: t2.minX - e2, minY: t2.minY - e2, maxX: t2.maxX + e2, maxY: t2.maxY + e2 } : null;
    p = (t2, e2, r2 = false) => {
      const n2 = "undefined" != typeof OffscreenCanvas ? new OffscreenCanvas(t2, e2) : (() => {
        const r3 = document.createElement("canvas");
        return r3.width = t2, r3.height = e2, r3;
      })();
      return n2.drawingContext = n2.getContext("2d", r2 ? { willReadFrequently: true } : void 0), n2;
    };
    b = { clearTarget: () => {
      throw new Error("No compositor runtime adapter registered.");
    }, ensureBlendShaderProgram: () => {
      throw new Error("No compositor runtime adapter registered.");
    }, ensureBlendSourceFramebuffer: () => {
      throw new Error("No compositor runtime adapter registered.");
    }, createFramebuffer: () => {
      throw new Error("No compositor runtime adapter registered.");
    }, runBlendShaderPass: () => {
      throw new Error("No compositor runtime adapter registered.");
    }, blitSourceToFramebuffer: () => {
      throw new Error("No compositor runtime adapter registered.");
    } };
    _ = (...t2) => b.createFramebuffer(...t2);
    v = null;
    w = null;
    R = (t2) => {
      ((...t3) => {
        b.clearTarget(...t3);
      })(n, t2, x);
    };
    E = () => ({ width: Math.max(1, Math.round(e * i)), height: Math.max(1, Math.round(r * i)) });
    A = (t2) => {
      if (!t2) return null;
      const { width: e2, height: r2 } = E();
      return ((t3, e3, r3) => {
        if (!t3) return null;
        const n2 = Math.max(0, Math.floor(Math.min(t3.minX, t3.maxX))), i2 = Math.max(0, Math.floor(Math.min(t3.minY, t3.maxY))), a2 = Math.min(e3, Math.ceil(Math.max(t3.minX, t3.maxX))), o2 = Math.min(r3, Math.ceil(Math.max(t3.minY, t3.maxY)));
        return a2 <= n2 || o2 <= i2 ? null : { minX: n2, minY: i2, maxX: a2, maxY: o2 };
      })(t2, e2, r2);
    };
    M = () => {
      const { width: t2, height: e2 } = E();
      return /* @__PURE__ */ ((t3, e3) => ({ minX: 0, minY: 0, maxX: t3, maxY: e3 }))(t2, e2);
    };
    T = (t2, e2 = true) => {
      const r2 = A(t2);
      if (!r2) return null;
      const { height: n2 } = E();
      return { x: r2.minX, y: e2 ? n2 - r2.maxY : r2.minY, width: r2.maxX - r2.minX, height: r2.maxY - r2.minY };
    };
    S = (t2, e2, r2, n2 = true) => {
      const i2 = T(e2, n2);
      if (i2) {
        t2.enable(t2.SCISSOR_TEST), t2.scissor(i2.x, i2.y, i2.width, i2.height);
        try {
          r2();
        } finally {
          t2.disable(t2.SCISSOR_TEST);
        }
      } else r2();
    };
    P = {};
    C = () => {
      n?.loaded || (m(), F.load());
    };
    F = { isBlending: false, cachedColor: null, markDirtyRect(t2, e2) {
      const r2 = A(e2);
      var n2, i2;
      t2 && r2 && (t2.dirtyRect = (i2 = r2, (n2 = t2.dirtyRect) ? i2 ? { minX: Math.min(n2.minX, i2.minX), minY: Math.min(n2.minY, i2.minY), maxX: Math.max(n2.maxX, i2.maxX), maxY: Math.max(n2.maxY, i2.maxY) } : n2 : i2), t2.isDrawn = true);
    }, clearMask(t2) {
      if (!t2) return;
      const e2 = t2 === this.glMask ? v : w;
      e2?.clearMask?.(t2, R);
    }, getCompositeRect(t2, e2) {
      const r2 = e2 ? v : w;
      return r2?.getCompositeRect?.(t2, g, M, y, A);
    }, load() {
      u.syncDensity();
      const t2 = !n.blendSourceFramebuffer || n.blendSourceFramebuffer.width !== e || n.blendSourceFramebuffer.height !== r || "function" == typeof n.blendSourceFramebuffer.pixelDensity && n.blendSourceFramebuffer.pixelDensity() !== i;
      ((...t3) => {
        b.ensureBlendShaderProgram(...t3);
      })(n, "#version 300 es\n#define GLSLIFY 1\nout vec2 p;void main(){vec3 v=vec3(-1);v[gl_VertexID]=3.;p=v.xy;gl_Position=vec4(v.x,-v.y,0,1);}", "#version 300 es\nprecision highp float;\n#define GLSLIFY 1\nuniform bool u_isBrush;uniform bool u_targetIsFramebuffer;uniform sampler2D u_source;uniform sampler2D u_mask;uniform vec3 u_color;in vec2 p;out vec4 outColor;const int SPECTRAL_SIZE=38;const float SPECTRAL_GAMMA=2.4;const float SPECTRAL_EPSILON=0.0001;float spectral_uncompand(float x){return(x<0.04045)? x/12.92 : pow((x+0.055)/1.055,SPECTRAL_GAMMA);}float spectral_compand(float x){return(x<0.0031308)? x*12.92 : 1.055*pow(x,1.0/SPECTRAL_GAMMA)-0.055;}vec3 spectral_srgb_to_linear(vec3 srgb){return vec3(spectral_uncompand(srgb[0]),spectral_uncompand(srgb[1]),spectral_uncompand(srgb[2]));}vec3 spectral_linear_to_srgb(vec3 lrgb){return clamp(vec3(spectral_compand(lrgb[0]),spectral_compand(lrgb[1]),spectral_compand(lrgb[2])),0.,1.);}void spectral_linear_to_reflectance(vec3 lrgb,inout float R[SPECTRAL_SIZE]){float w=min(lrgb.r,min(lrgb.g,lrgb.b));lrgb-=w;float c=min(lrgb.g,lrgb.b);float m=min(lrgb.r,lrgb.b);float y=min(lrgb.r,lrgb.g);float r=min(max(0.0,lrgb.r-lrgb.b),max(0.0,lrgb.r-lrgb.g));float g=min(max(0.0,lrgb.g-lrgb.b),max(0.0,lrgb.g-lrgb.r));float b=min(max(0.0,lrgb.b-lrgb.g),max(0.0,lrgb.b-lrgb.r));R[0]=max(SPECTRAL_EPSILON,w*1.0011607271876400+c*0.9705850013229620+m*0.9906735573199880+y*0.0210523371789306+r*0.0315605737777207+g*0.0095560747554212+b*0.9794047525020140);R[1]=max(SPECTRAL_EPSILON,w*1.0011606515972800+c*0.9705924981434250+m*0.9906715249619790+y*0.0210564627517414+r*0.0315520718330149+g*0.0095581580120851+b*0.9794007068431300);R[2]=max(SPECTRAL_EPSILON,w*1.0011603192274700+c*0.9706253487298910+m*0.9906625823534210+y*0.0210746178695038+r*0.0315148215513658+g*0.0095673245444588+b*0.9793829034702610);R[3]=max(SPECTRAL_EPSILON,w*1.0011586727078900+c*0.9707868061190170+m*0.9906181076447950+y*0.0211649058448753+r*0.0313318044982702+g*0.0096129126297349+b*0.9792943649455940);R[4]=max(SPECTRAL_EPSILON,w*1.0011525984455200+c*0.9713686732282480+m*0.9904514808787100+y*0.0215027957272504+r*0.0306729857725527+g*0.0097837090401843+b*0.9789630146085700);R[5]=max(SPECTRAL_EPSILON,w*1.0011325252899800+c*0.9731632306212520+m*0.9898710814002040+y*0.0226738799041561+r*0.0286480476989607+g*0.0103786227058710+b*0.9778144666940430);R[6]=max(SPECTRAL_EPSILON,w*1.0010850066332700+c*0.9767402231587650+m*0.9882866087596400+y*0.0258235649693629+r*0.0246450407045709+g*0.0120026452378567+b*0.9747243211338360);R[7]=max(SPECTRAL_EPSILON,w*1.0009968788945300+c*0.9815876054913770+m*0.9842906927975040+y*0.0334879385639851+r*0.0192960753663651+g*0.0160977721473922+b*0.9671984823439730);R[8]=max(SPECTRAL_EPSILON,w*1.0008652515227400+c*0.9862802656529490+m*0.9739349056253060+y*0.0519069663740307+r*0.0142066612220556+g*0.0267061902231680+b*0.9490796575305750);R[9]=max(SPECTRAL_EPSILON,w*1.0006962900094000+c*0.9899491476891340+m*0.9418178384601450+y*0.1007490148334730+r*0.0102942608878609+g*0.0595555440185881+b*0.9008501289409770);R[10]=max(SPECTRAL_EPSILON,w*1.0005049611488800+c*0.9924927015384200+m*0.8173903261951560+y*0.2391298997068470+r*0.0076191460521811+g*0.1860398265328260+b*0.7631504454622400);R[11]=max(SPECTRAL_EPSILON,w*1.0003080818799200+c*0.9941456804052560+m*0.4324728050657290+y*0.5348043122727480+r*0.0058980410835420+g*0.5705798201161590+b*0.4659221716493190);R[12]=max(SPECTRAL_EPSILON,w*1.0001196660201300+c*0.9951839750332120+m*0.1384539782588700+y*0.7978075786430300+r*0.0048233247781713+g*0.8614677684002920+b*0.2012632804510050);R[13]=max(SPECTRAL_EPSILON,w*0.9999527659684070+c*0.9957567501108180+m*0.0537347216940033+y*0.9114498940673840+r*0.0042298748350633+g*0.9458790897676580+b*0.0877524413419623);R[14]=max(SPECTRAL_EPSILON,w*0.9998218368992970+c*0.9959128182867100+m*0.0292174996673231+y*0.9537979630045070+r*0.0040599171299341+g*0.9704654864743050+b*0.0457176793291679);R[15]=max(SPECTRAL_EPSILON,w*0.9997386095575930+c*0.9956061578345280+m*0.0213136517508590+y*0.9712416154654290+r*0.0043533695594676+g*0.9784136302844500+b*0.0284706050521843);R[16]=max(SPECTRAL_EPSILON,w*0.9997095516396120+c*0.9945976009618540+m*0.0201349530181136+y*0.9793031238075880+r*0.0053434425970201+g*0.9795890314112240+b*0.0205271767569850);R[17]=max(SPECTRAL_EPSILON,w*0.9997319302106270+c*0.9922157154923700+m*0.0241323096280662+y*0.9833801195075750+r*0.0076917201010463+g*0.9755335369086320+b*0.0165302792310211);R[18]=max(SPECTRAL_EPSILON,w*0.9997994363461950+c*0.9862364527832490+m*0.0372236145223627+y*0.9854612465677550+r*0.0135969795736536+g*0.9622887553978130+b*0.0145135107212858);R[19]=max(SPECTRAL_EPSILON,w*0.9999003303166710+c*0.9679433372645410+m*0.0760506552706601+y*0.9864350469766050+r*0.0316975442661115+g*0.9231215745131200+b*0.0136003508637687);R[20]=max(SPECTRAL_EPSILON,w*1.0000204065261100+c*0.8912850042449430+m*0.2053754719423990+y*0.9867382506701410+r*0.1078611963552490+g*0.7934340189431110+b*0.0133604258769571);R[21]=max(SPECTRAL_EPSILON,w*1.0001447879365800+c*0.5362024778620530+m*0.5412689034604390+y*0.9866178824450320+r*0.4638126031687040+g*0.4592701359024290+b*0.0135488943145680);R[22]=max(SPECTRAL_EPSILON,w*1.0002599790341200+c*0.1541081190018780+m*0.8158416850864860+y*0.9862777767586430+r*0.8470554052720110+g*0.1855741036663030+b*0.0139594356366992);R[23]=max(SPECTRAL_EPSILON,w*1.0003557969708900+c*0.0574575093228929+m*0.9128177041239760+y*0.9858605924440560+r*0.9431854093939180+g*0.0881774959955372+b*0.0144434255753570);R[24]=max(SPECTRAL_EPSILON,w*1.0004275378026900+c*0.0315349873107007+m*0.9463398301669620+y*0.9854749276762100+r*0.9688621506965580+g*0.0543630228766700+b*0.0148854440621406);R[25]=max(SPECTRAL_EPSILON,w*1.0004762334488800+c*0.0222633920086335+m*0.9599276963319910+y*0.9851769347655580+r*0.9780306674736030+g*0.0406288447060719+b*0.0152254296999746);R[26]=max(SPECTRAL_EPSILON,w*1.0005072096750800+c*0.0182022841492439+m*0.9662605952303120+y*0.9849715740141810+r*0.9820436438543060+g*0.0342215204316970+b*0.0154592848180209);R[27]=max(SPECTRAL_EPSILON,w*1.0005251915637300+c*0.0162990559732640+m*0.9693259700584240+y*0.9848463034157120+r*0.9839236237187070+g*0.0311185790956966+b*0.0156018026485961);R[28]=max(SPECTRAL_EPSILON,w*1.0005350960689600+c*0.0153656239334613+m*0.9708545367213990+y*0.9847753518111990+r*0.9848454841543820+g*0.0295708898336134+b*0.0156824871281936);R[29]=max(SPECTRAL_EPSILON,w*1.0005402209748200+c*0.0149111568733976+m*0.9716050665281280+y*0.9847380666252650+r*0.9852942758145960+g*0.0288108739348928+b*0.0157248764360615);R[30]=max(SPECTRAL_EPSILON,w*1.0005427281678400+c*0.0146954339898235+m*0.9719627697573920+y*0.9847196483117650+r*0.9855072952198250+g*0.0284486271324597+b*0.0157458108784121);R[31]=max(SPECTRAL_EPSILON,w*1.0005438956908700+c*0.0145964146717719+m*0.9721272722745090+y*0.9847110233919390+r*0.9856050715398370+g*0.0282820301724731+b*0.0157556123350225);R[32]=max(SPECTRAL_EPSILON,w*1.0005444821215100+c*0.0145470156699655+m*0.9722094177458120+y*0.9847066833006760+r*0.9856538499335780+g*0.0281988376490237+b*0.0157605443964911);R[33]=max(SPECTRAL_EPSILON,w*1.0005447695999200+c*0.0145228771899495+m*0.9722495776784240+y*0.9847045543930910+r*0.9856776850338830+g*0.0281581655342037+b*0.0157629637515278);R[34]=max(SPECTRAL_EPSILON,w*1.0005448988776200+c*0.0145120341118965+m*0.9722676219987420+y*0.9847035963093700+r*0.9856883918061220+g*0.0281398910216386+b*0.0157640525629106);R[35]=max(SPECTRAL_EPSILON,w*1.0005449625468900+c*0.0145066940939832+m*0.9722765094621500+y*0.9847031240775520+r*0.9856936646900310+g*0.0281308901665811+b*0.0157645892329510);R[36]=max(SPECTRAL_EPSILON,w*1.0005449892705800+c*0.0145044507314479+m*0.9722802433068740+y*0.9847029256150900+r*0.9856958798482050+g*0.0281271086805816+b*0.0157648147772649);R[37]=max(SPECTRAL_EPSILON,w*1.0005449969930000+c*0.0145038009464639+m*0.9722813248265600+y*0.9847028681227950+r*0.9856965214637620+g*0.0281260133612096+b*0.0157648801149616);}vec3 spectral_xyz_to_srgb(vec3 xyz){mat3 XYZ_RGB;XYZ_RGB[0]=vec3(3.2409699419045200,-1.537383177570090,-0.4986107602930030);XYZ_RGB[1]=vec3(-0.9692436362808790,1.875967501507720,0.0415550574071756);XYZ_RGB[2]=vec3(0.0556300796969936,-0.203976958888976,1.0569715142428700);float r=dot(XYZ_RGB[0],xyz);float g=dot(XYZ_RGB[1],xyz);float b=dot(XYZ_RGB[2],xyz);return spectral_linear_to_srgb(vec3(r,g,b));}vec3 spectral_reflectance_to_xyz(float R[SPECTRAL_SIZE]){vec3 xyz=vec3(0.);xyz+=R[0]*vec3(0.0000646919989576,0.0000018442894440,0.0003050171476380);xyz+=R[1]*vec3(0.0002194098998132,0.0000062053235865,0.0010368066663574);xyz+=R[2]*vec3(0.0011205743509343,0.0000310096046799,0.0053131363323992);xyz+=R[3]*vec3(0.0037666134117111,0.0001047483849269,0.0179543925899536);xyz+=R[4]*vec3(0.0118805536037990,0.0003536405299538,0.0570775815345485);xyz+=R[5]*vec3(0.0232864424191771,0.0009514714056444,0.1136516189362870);xyz+=R[6]*vec3(0.0345594181969747,0.0022822631748318,0.1733587261835500);xyz+=R[7]*vec3(0.0372237901162006,0.0042073290434730,0.1962065755586570);xyz+=R[8]*vec3(0.0324183761091486,0.0066887983719014,0.1860823707062960);xyz+=R[9]*vec3(0.0212332056093810,0.0098883960193565,0.1399504753832070);xyz+=R[10]*vec3(0.0104909907685421,0.0152494514496311,0.0891745294268649);xyz+=R[11]*vec3(0.0032958375797931,0.0214183109449723,0.0478962113517075);xyz+=R[12]*vec3(0.0005070351633801,0.0334229301575068,0.0281456253957952);xyz+=R[13]*vec3(0.0009486742057141,0.0513100134918512,0.0161376622950514);xyz+=R[14]*vec3(0.0062737180998318,0.0704020839399490,0.0077591019215214);xyz+=R[15]*vec3(0.0168646241897775,0.0878387072603517,0.0042961483736618);xyz+=R[16]*vec3(0.0286896490259810,0.0942490536184085,0.0020055092122156);xyz+=R[17]*vec3(0.0426748124691731,0.0979566702718931,0.0008614711098802);xyz+=R[18]*vec3(0.0562547481311377,0.0941521856862608,0.0003690387177652);xyz+=R[19]*vec3(0.0694703972677158,0.0867810237486753,0.0001914287288574);xyz+=R[20]*vec3(0.0830531516998291,0.0788565338632013,0.0001495555858975);xyz+=R[21]*vec3(0.0861260963002257,0.0635267026203555,0.0000923109285104);xyz+=R[22]*vec3(0.0904661376847769,0.0537414167568200,0.0000681349182337);xyz+=R[23]*vec3(0.0850038650591277,0.0426460643574120,0.0000288263655696);xyz+=R[24]*vec3(0.0709066691074488,0.0316173492792708,0.0000157671820553);xyz+=R[25]*vec3(0.0506288916373645,0.0208852059213910,0.0000039406041027);xyz+=R[26]*vec3(0.0354739618852640,0.0138601101360152,0.0000015840125870);xyz+=R[27]*vec3(0.0214682102597065,0.0081026402038399,0.0000000000000000);xyz+=R[28]*vec3(0.0125164567619117,0.0046301022588030,0.0000000000000000);xyz+=R[29]*vec3(0.0068045816390165,0.0024913800051319,0.0000000000000000);xyz+=R[30]*vec3(0.0034645657946526,0.0012593033677378,0.0000000000000000);xyz+=R[31]*vec3(0.0014976097506959,0.0005416465221680,0.0000000000000000);xyz+=R[32]*vec3(0.0007697004809280,0.0002779528920067,0.0000000000000000);xyz+=R[33]*vec3(0.0004073680581315,0.0001471080673854,0.0000000000000000);xyz+=R[34]*vec3(0.0001690104031614,0.0000610327472927,0.0000000000000000);xyz+=R[35]*vec3(0.0000952245150365,0.0000343873229523,0.0000000000000000);xyz+=R[36]*vec3(0.0000490309872958,0.0000177059860053,0.0000000000000000);xyz+=R[37]*vec3(0.0000199961492222,0.0000072209749130,0.0000000000000000);return xyz;}float KS(float R){return pow(1.0-R,2.0)/(2.0*R);}float KM(float KS){return 1.0+KS-sqrt(pow(KS,2.0)+2.0*KS);}vec3 spectral_mix(vec3 color1,float tintingStrength1,float factor1,vec3 color2,float tintingStrength2,float factor2){vec3 lrgb1=spectral_srgb_to_linear(color1);vec3 lrgb2=spectral_srgb_to_linear(color2);float R1[SPECTRAL_SIZE];float R2[SPECTRAL_SIZE];spectral_linear_to_reflectance(lrgb1,R1);spectral_linear_to_reflectance(lrgb2,R2);float luminance1=spectral_reflectance_to_xyz(R1)[1];float luminance2=spectral_reflectance_to_xyz(R2)[1];float R[SPECTRAL_SIZE];for(int i=0;i<SPECTRAL_SIZE;i++){float concentration1=pow(factor1,2.)*pow(tintingStrength1,2.)*luminance1;float concentration2=pow(factor2,2.)*pow(tintingStrength2,2.)*luminance2;float totalConcentration=concentration1+concentration2;float ksMix=0.;ksMix+=KS(R1[i])*concentration1;ksMix+=KS(R2[i])*concentration2;R[i]=KM(ksMix/totalConcentration);}return spectral_xyz_to_srgb(spectral_reflectance_to_xyz(R));}vec3 spectral_mix(vec3 color1,vec3 color2,float factor){return spectral_mix(color1,1.,1.-factor,color2,1.,factor);}vec3 spectral_mix(vec3 color1,float factor1,vec3 color2,float factor2){return spectral_mix(color1,1.,factor1,color2,1.,factor2);}const float GAMMA=2.4,EPSILON=0.0001;const float DARKEN_THRESHOLD=0.7;const float EDGE_MIN=0.05,EDGE_MAX=0.35;void main(void){vec2 uv=0.5*p+0.5;vec2 sourceUV=vec2(uv.x,1.0-uv.y);vec2 maskUV=u_targetIsFramebuffer ? vec2(uv.x,1.0-uv.y): uv;vec4 source=texture(u_source,sourceUV);vec4 maskColor=texture(u_mask,maskUV);if(maskColor.a==0.0){outColor=source;return;}vec4 pigment=vec4(u_color.xyz,1.0);if(u_isBrush&&(maskColor.a>DARKEN_THRESHOLD)){float blacken=0.5*(min(maskColor.a,1.0)-DARKEN_THRESHOLD);pigment=pigment*(1.0-blacken)-vec4(0.5)*blacken;pigment.rgb=max(pigment.rgb,vec3(0.0));}float mixIntensity=min(maskColor.a,1.0);if(!u_isBrush){vec2 texelSize=1.0/vec2(textureSize(u_mask,0));float scaledAlpha=maskColor.a*15.0;float blurEdge=0.0;for(int i=-2;i<=2;i+=2){for(int j=-2;j<=2;j+=2){vec2 neighborUV=maskUV+vec2(float(i),float(j))*texelSize;float neighborAlpha=texture(u_mask,neighborUV).a*15.0;blurEdge+=smoothstep(EDGE_MIN,EDGE_MAX,length(vec2(dFdx(neighborAlpha),dFdy(neighborAlpha))));}}blurEdge/=9.0;mixIntensity=clamp(maskColor.a+blurEdge*0.1,0.0,1.0);}vec3 bgColor=mix(vec3(1.0),source.rgb,source.a);outColor=vec4(spectral_mix(bgColor,pigment.rgb,mixIntensity),1.);}"), this.glMask = v?.ensureResources?.(n, e, r, i);
      const a2 = w?.ensureResources?.(n, e, r, i, R) ?? { mask: null, ctx: null };
      t2 && (n.blendSourceFramebuffer = ((...t3) => b.ensureBlendSourceFramebuffer(...t3))(n, n.blendSourceFramebuffer, e, r, i)), this.mask = a2.mask, this.ctx = a2.ctx;
    }, blend(t2 = false, e2 = false) {
      C();
      const r2 = true === this.isBrush, n2 = r2 ? this.glMask : this.mask, i2 = r2 ? this.mask : this.glMask, a2 = t2?._array, o2 = !!a2 && (this.cachedColor?.[0] !== a2[0] || this.cachedColor?.[1] !== a2[1] || this.cachedColor?.[2] !== a2[2] || this.cachedColor?.[3] !== a2[3]);
      !this.isBlending && a2 && (this.isBlending = true, this.cachedColor = a2, l(), this.clearMask(this.glMask)), (e2 || o2) && (this.justChanged && (this.applyShader(i2, !r2), this.justChanged = false), this.isBlending && this.applyShader(n2, r2), a2 && (this.cachedColor = a2), e2 && (this.isBlending = false, this.cachedColor = null));
    }, applyShader(t2, i2) {
      if (!t2?.isDrawn) return;
      const a2 = this.getCompositeRect(t2, i2);
      if (!a2) return void this.clearMask(t2);
      n.drawingContext;
      const o2 = n.shaderProgram, s2 = g(), c2 = ((...t3) => b.blitSourceToFramebuffer(...t3))({ renderer: n, sourceTarget: s2 ?? n, sourceFramebuffer: n.blendSourceFramebuffer, dirtyRect: a2, isFramebufferTarget: x, Cwidth: e, Cheight: r, getTargetPixelSize: E, toScissorBox: T, withScissor: S }), l2 = !!s2, h2 = (i2 ? v : w).getShaderMask(n, t2, a2, M, R);
      ((...t3) => {
        b.runBlendShaderPass(...t3);
      })({ renderer: n, shader: o2, source: c2, mask: h2, color: this.cachedColor, isBrushMask: i2, Cwidth: e, Cheight: r, dirtyRect: a2, targetIsFramebuffer: l2, withScissor: S }), this.clearMask(t2);
    } };
    I = (t2 = false) => {
      ((t3 = false) => {
        u.load(t3);
      })(t2), n.loaded && F.load();
    };
    k = /* @__PURE__ */ new WeakMap();
    D = (t2, e2, r2) => Math.max(e2, Math.min(t2, r2));
    L = "degrees";
    N = "radians";
    B = null;
    U = N;
    O = [];
    X = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
    z = class {
      constructor(t2, e2, r2) {
        const n2 = t2;
        let i2 = 1;
        if (t2?._array) return this.r = Math.round(255 * t2._array[0]), this.g = Math.round(255 * t2._array[1]), this.b = Math.round(255 * t2._array[2]), this.hex = this.rgbToHex(this.r, this.g, this.b), this._array = [...t2._array], void (this.gl = this._array);
        if ("string" == typeof t2) {
          const e3 = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i.exec(t2);
          if (e3) {
            this.r = D(parseInt(e3[1]), 0, 255), this.g = D(parseInt(e3[2]), 0, 255), this.b = D(parseInt(e3[3]), 0, 255), this.hex = this.rgbToHex(this.r, this.g, this.b);
            const t3 = void 0 !== e3[4] ? D(parseFloat(e3[4]), 0, 1) : 1;
            return this._array = [this.r / 255, this.g / 255, this.b / 255, t3], void (this.gl = this._array);
          }
          this.hex = this.standardize(t2);
          const r3 = this.hexToRgb(this.hex);
          this.r = r3.r, this.g = r3.g, this.b = r3.b;
        } else Array.isArray(t2) && ([t2, e2, r2, i2 = 1] = t2), this.r = D(t2 ?? 0, 0, 255), this.g = D(e2 ?? t2 ?? 0, 0, 255), this.b = D(r2 ?? t2 ?? 0, 0, 255), this.hex = this.rgbToHex(this.r, this.g, this.b);
        if (!Number.isFinite(this.r) || !Number.isFinite(this.g) || !Number.isFinite(this.b)) throw new Error(`Invalid color value "${n2}".`);
        this._array = [this.r / 255, this.g / 255, this.b / 255, D(i2, 0, 1)], this.gl = this._array;
      }
      rgbToHex(t2, e2, r2) {
        return `#${(1 << 24 | t2 << 16 | e2 << 8 | r2).toString(16).slice(1)}`;
      }
      hexToRgb(t2) {
        t2 = t2.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (t3, e3, r2, n2) => e3 + e3 + r2 + r2 + n2 + n2);
        const e2 = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(t2);
        if (!e2) throw new Error(`Invalid color value "${t2}".`);
        return { r: parseInt(e2[1], 16), g: parseInt(e2[2], 16), b: parseInt(e2[3], 16) };
      }
      standardize(t2) {
        const e2 = function() {
          if (B) return B;
          if ("undefined" != typeof document) return B = document.createElement("canvas").getContext("2d"), B;
          if ("undefined" != typeof OffscreenCanvas) return B = new OffscreenCanvas(1, 1).getContext("2d"), B;
          throw new Error("Standalone color parsing requires CanvasRenderingContext2D support.");
        }();
        e2.fillStyle = "#000000", e2.fillStyle = t2;
        const r2 = e2.fillStyle;
        if (e2.fillStyle = "#ffffff", e2.fillStyle = t2, r2 !== e2.fillStyle) throw new Error(`Invalid color value "${t2}".`);
        return r2;
      }
      _getRed() {
        return this.r;
      }
      _getGreen() {
        return this.g;
      }
      _getBlue() {
        return this.b;
      }
    };
    Z = false;
    J = false;
    h({ notifyDraw: function() {
      J || (J = true, Z = true, requestAnimationFrame(() => {
        J = false, Z && console.warn("[p5.brush] Drawing calls were made but brush.render() was never called. Call brush.render() after your drawing code to flush to the canvas.");
      }));
    } });
    et = null;
    rt = false;
    nt = 1;
    it = 0;
    at = 0;
    ct = Math.sqrt(3);
    lt = 0.5 * (ct - 1);
    ht = (3 - ct) / 6;
    ut = (t2) => 0 | Math.floor(t2);
    ft = new Float64Array([1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 1, 0, -1, 0, 0, 1, 0, -1, 0, 1, 0, -1]);
    gt = dt(Math.random());
    xt = dt(Math.random() + ":2");
    yt = [];
    pt = (t2) => yt.push(t2);
    bt = (t2) => {
      gt = dt(t2), xt = dt(`${t2}:2`), Pt = false;
      for (const t3 of yt) t3();
    };
    _t = mt(dt(Math.random()));
    vt = mt(dt(Math.random() + ":2"));
    wt = (t2) => {
      _t = mt(dt(t2)), vt = mt(dt(`${t2}:2`));
    };
    Rt = (t2 = 0, e2 = 1) => t2 + gt() * (e2 - t2);
    At = (t2 = 0, e2 = 1) => t2 + xt() * (e2 - t2);
    Mt = (t2) => t2[~~(gt() * t2.length)];
    Tt = (t2, e2) => ~~Rt(t2, e2);
    St = (t2, e2) => ~~At(t2, e2);
    Pt = false;
    Ct = 0;
    Ft = (t2 = 0, e2 = 1) => {
      if (Pt) return Pt = false, Ct * e2 + t2;
      const r2 = 1 - gt(), n2 = gt(), i2 = Math.sqrt(-2 * Math.log(r2)), a2 = 360 * n2;
      return Ct = i2 * Yt(a2), Pt = true, i2 * Xt(a2) * e2 + t2;
    };
    It = (t2) => {
      let e2 = 0;
      const r2 = [];
      for (const n3 in t2) e2 += t2[n3], r2.push({ key: n3, cumulative: e2 });
      const n2 = gt() * e2;
      for (const { key: t3, cumulative: e3 } of r2) if (n2 < e3) return isNaN(t3) ? t3 : parseInt(t3);
    };
    kt = (t2, e2, r2, n2, i2, a2 = false) => {
      let o2 = n2 + (t2 - e2) / (r2 - e2) * (i2 - n2);
      return a2 ? n2 < i2 ? Dt(o2, n2, i2) : Dt(o2, i2, n2) : o2;
    };
    Dt = (t2, e2, r2) => Math.max(Math.min(t2, r2), e2);
    Lt = 1440;
    Nt = 2 * Math.PI / Lt;
    Bt = new Float32Array(Lt);
    Ut = new Float32Array(Lt);
    for (let t2 = 0; t2 < Lt; t2++) Bt[t2] = Math.cos(t2 * Nt), Ut[t2] = Math.sin(t2 * Nt);
    Ot = (t2) => t2 < 0 ? t2 >= -360 ? ~~(4 * (t2 + 360)) : ~~(4 * ((t2 %= 360) < 0 ? t2 + 360 : t2)) : t2 < 360 ? ~~(4 * t2) : t2 < 720 ? ~~(4 * (t2 - 360)) : t2 < 1080 ? ~~(4 * (t2 - 720)) : ~~(4 * ((t2 %= 360) < 0 ? t2 + 360 : t2));
    Xt = (t2) => Bt[Ot(t2)];
    Yt = (t2) => Ut[Ot(t2)];
    zt = new Float32Array(2);
    Gt = (t2) => {
      const e2 = Ot(t2);
      return zt[0] = Bt[e2], zt[1] = Ut[e2], zt;
    };
    Vt = (t2, e2 = false) => {
      if (e2 || a()) {
        let e3 = 180 * t2 / Math.PI % 360;
        return e3 < 0 ? e3 + 360 : e3;
      }
      return t2;
    };
    Ht = (t2, e2 = false) => e2 || a() ? 180 * t2 / Math.PI : t2;
    $t = (t2, e2, r2, n2, i2) => {
      const a2 = Gt(i2), o2 = a2[0], s2 = a2[1];
      return { x: o2 * (r2 - t2) + s2 * (n2 - e2) + t2, y: o2 * (n2 - e2) - s2 * (r2 - t2) + e2 };
    };
    Wt = (t2, e2, r2, n2) => Math.hypot(r2 - t2, n2 - e2);
    qt = (t2, e2, r2, n2) => Vt(Math.atan2(-(n2 - e2), r2 - t2), true);
    jt = (t2, e2, r2, n2, i2 = false) => {
      const a2 = t2.x, o2 = t2.y, s2 = e2.x, c2 = e2.y, l2 = r2.x, h2 = r2.y, u2 = s2 - a2, f2 = c2 - o2, m2 = n2.x - l2, d2 = n2.y - h2, g2 = d2 * u2 - m2 * f2;
      if (0 === g2) return false;
      const x2 = o2 - h2, y2 = a2 - l2, p2 = (m2 * x2 - d2 * y2) / g2, b2 = (u2 * x2 - f2 * y2) / g2;
      return !(!i2 && (b2 < 0 || b2 > 1)) && { x: a2 + p2 * u2, y: o2 + p2 * f2 };
    };
    Kt = false;
    Jt = class _Jt {
      constructor(t2, e2) {
        Zt();
        const r2 = c();
        this.mx = r2.x, this.my = r2.y, this.update(t2, e2), this.plotted = 0;
      }
      update(t2, e2) {
        this.x = t2, this.y = e2, P.field.isActive && (this.colIdx = Math.round((t2 + this.mx - te) / Qt), this.rowIdx = Math.round((e2 + this.my - ee) / Qt));
      }
      reset() {
        this.plotted = 0;
      }
      isIn() {
        return P.field.isActive ? _Jt.isIn(this.colIdx, this.rowIdx) : this.isInCanvas(this.x, this.y);
      }
      isInCanvas() {
        const t2 = e, n2 = r, i2 = this.x + this.mx, a2 = this.y + this.my;
        return i2 >= -0.5 * t2 && i2 <= 1.5 * t2 && a2 >= -0.5 * n2 && a2 <= 1.5 * n2;
      }
      angle(t2 = false) {
        return P.field.isActive && (t2 || this.isIn()) ? ie.get(P.field.current).field[this.colIdx][this.rowIdx] * P.field.wiggle : 0;
      }
      moveTo(t2, e2, r2 = 1) {
        const n2 = Ht(t2);
        P.field.isActive ? this.movePos(n2, e2, r2) : this._moveConstant(n2, e2, r2);
      }
      _moveToDegrees(t2, e2, r2 = 1) {
        P.field.isActive ? this.movePos(t2, e2, r2) : this._moveConstant(t2, e2, r2);
      }
      _moveConstant(t2, e2, r2) {
        if (!this.isIn()) return void (this.plotted += r2);
        const n2 = e2 / r2, i2 = Gt(-t2), a2 = r2 * i2[0], o2 = r2 * i2[1];
        for (let t3 = 0; t3 < n2; t3++) this.x += a2, this.y += o2, this.plotted += r2;
      }
      plotTo(t2, e2, r2, n2 = 1, i2 = void 0) {
        this.movePos(t2, e2, r2, n2, i2);
      }
      movePos(t2, e2, r2, n2 = false, i2 = void 0) {
        const a2 = n2 || 1;
        if (!this.isIn()) return void (this.plotted += r2 / a2);
        const o2 = e2 / r2, s2 = P.field.isActive, c2 = !!n2;
        for (let e3 = 0; e3 < o2; e3++) {
          const n3 = c2 && void 0 !== i2 && 0 === e3 ? i2 : c2 ? t2.angle(this.plotted) : t2, o3 = (s2 ? this.angle(true) : 0) - n3, l2 = Gt(o3);
          this.update(this.x + r2 * l2[0], this.y + r2 * l2[1]), this.plotted += r2 / a2;
        }
      }
      static getRowIndex(t2, e2 = 1) {
        const r2 = t2 + c().y - ee;
        return Math.round(r2 / Qt / e2);
      }
      static getColIndex(t2, e2 = 1) {
        const r2 = t2 + c().x - te;
        return Math.round(r2 / Qt / e2);
      }
      static isIn(t2, e2) {
        return t2 >= 0 && e2 >= 0 && t2 < re && e2 < ne;
      }
    };
    P.field = { isActive: false, current: null, wiggle: 1 };
    ie = /* @__PURE__ */ new Map();
    ae = /* @__PURE__ */ new Set(["degrees", "radians"]);
    ge = class {
      constructor(t2, e2 = false) {
        this.a = t2, this.vertices = e2 ? t2 : t2.map(([t3, e3]) => ({ x: t3, y: e3 })), this.sides = this.vertices.map((t3, e3, r2) => [t3, r2[(e3 + 1) % r2.length]]), this._intersectionCache = {};
      }
      intersect(t2) {
        const e2 = `${t2.point1.x},${t2.point1.y}-${t2.point2.x},${t2.point2.y}`;
        if (this._intersectionCache[e2]) return this._intersectionCache[e2];
        const r2 = [], n2 = this.sides, i2 = n2.length;
        for (let e3 = 0; e3 < i2; e3++) {
          const i3 = jt(t2.point1, t2.point2, n2[e3][0], n2[e3][1]);
          i3 && r2.push(i3);
        }
        return this._intersectionCache[e2] = r2, r2;
      }
      show() {
        P.wash && this.wash(), P.fill && this.fill(), P.mass && this.mass(), P.hatch && this.hatch(), P.stroke && this.draw();
      }
    };
    xe = class {
      constructor(t2) {
        this.segments = [], this.angles = [], this.pres = [], this.type = t2, this.dir = 0, this._cumLen = [], this.length = 0, this.index = 0, this.suma = 0, this.pol = false;
      }
      addSegment(t2 = 0, e2 = 0, r2 = 1, n2 = false) {
        this.angles.length > 0 && this.angles.pop(), t2 = n2 ? (t2 % 360 + 360) % 360 : Vt(t2), this.angles.push(t2, t2), this.pres.push(r2), this._cumLen.push(this.length), this.segments.push(e2), this.length += e2;
      }
      endPlot(t2 = 0, e2 = 1, r2 = false) {
        t2 = r2 ? (t2 % 360 + 360) % 360 : Vt(t2), this.angles[this.angles.length - 1] = t2, this.pres.push(e2);
      }
      rotate(t2) {
        this.dir = Vt(t2);
      }
      pressure(t2) {
        if (t2 > this.length) return this.pres[this.pres.length - 1];
        const e2 = this.pres[this.index], r2 = this.pres[this.index + 1], n2 = this.segments[this.index];
        return 0 === n2 ? e2 : e2 + (t2 - this.suma) / n2 * (r2 - e2);
      }
      angle(t2) {
        if (t2 > this.length) return this.angles[this.angles.length - 1];
        if (this.calcIndex(t2), "curve" !== this.type) return this.angles[this.index] + this.dir;
        let e2 = this.angles[this.index], r2 = this.angles[this.index + 1];
        Math.abs(r2 - e2) > 180 && (r2 > e2 ? r2 = -(360 - r2) : e2 = -(360 - e2));
        const n2 = this.segments[this.index];
        return e2 + (0 === n2 ? 0 : (t2 - this.suma) / n2) * (r2 - e2) + this.dir;
      }
      calcIndex(t2) {
        const e2 = this._cumLen, r2 = e2.length;
        if (0 === r2) return this.index = 0, this.suma = 0, 0;
        let n2 = this.index < r2 ? this.index : r2 - 1;
        for (; n2 + 1 < r2 && e2[n2 + 1] <= t2; ) n2++;
        if (e2[n2] > t2) {
          let r3 = 0, i2 = n2 - 1;
          for (; r3 < i2; ) {
            const n3 = r3 + i2 + 1 >> 1;
            e2[n3] <= t2 ? r3 = n3 : i2 = n3 - 1;
          }
          n2 = r3;
        }
        return this.index = n2, this.suma = e2[n2], n2;
      }
      genPol(t2, n2, i2 = 1, a2) {
        Zt();
        const o2 = a2 < 0 ? 4 : 1, s2 = [], c2 = Math.round(this.length / o2), l2 = new Jt(t2 + e / 2, n2 + r / 2);
        let h2 = 0, u2 = 0;
        for (let t3 = 0; t3 < c2; t3++) {
          l2.plotTo(this, o2, o2);
          const t4 = this.index;
          h2 += o2, (h2 >= (a2 <= 0 ? 8 : Math.max(this.segments[t4] * a2 * At(0.7, 1.3), 20)) || t4 >= u2) && l2.x && (s2.push([l2.x - e / 2, l2.y - r / 2]), h2 = 0, t4 >= u2 && u2++);
        }
        return new ge(s2);
      }
      show(t2, e2, r2 = 1) {
        P.wash && this.wash(t2, e2, r2), P.fill && this.fill(t2, e2, r2), P.mass && this.mass(t2, e2, r2), P.hatch && this.hatch(t2, e2, r2), P.stroke && this.draw(t2, e2, r2);
      }
    };
    Ae = class {
      constructor() {
        this.isClosed = false, this.curvature = we, this.vert = [];
      }
      vertex(t2, e2, r2) {
        this.vert.push([t2, e2, r2]);
      }
      show() {
        let t2 = ke(this.vert, this.curvature, this.isClosed);
        return t2.show(), t2;
      }
    };
    De = { createTipSurface: () => {
      throw new Error("No stroke runtime adapter registered.");
    }, loadImageTip: () => {
      throw new Error("No stroke runtime adapter registered.");
    } };
    Le = false;
    Ne = (t2, e2, r2) => {
      const n2 = t2.createProgram();
      for (let [i2, a2] of [[t2.VERTEX_SHADER, e2], [t2.FRAGMENT_SHADER, r2]]) {
        const e3 = t2.createShader(i2);
        t2.shaderSource(e3, a2), t2.compileShader(e3), t2.attachShader(n2, e3);
      }
      return t2.linkProgram(n2), n2;
    };
    Be = { beginDirectMaskDraw: () => {
      throw new Error("No renderer runtime adapter registered.");
    }, endDirectMaskDraw: () => {
      throw new Error("No renderer runtime adapter registered.");
    }, resetDirectShaderTracking: () => {
    } };
    Ue = (t2, e2) => Be.resetDirectShaderTracking(t2, e2);
    Ve = false;
    He = 0;
    $e = 0;
    We = null;
    qe = {};
    je = {};
    Ke = 1;
    Ze = 0;
    Je = 0;
    Qe = 1;
    tr = 0;
    er = 0;
    rr = 0;
    nr = 0;
    ir = 1;
    ar = 1;
    or = new Float32Array(8192);
    sr = 0;
    cr = 2048;
    lr = 32768;
    hr = null;
    ur = null;
    fr = null;
    mr = null;
    dr = null;
    gr = {};
    xr = {};
    yr = 0;
    pr = new Float32Array(1280);
    br = 0;
    _r = 256;
    vr = null;
    wr = /* @__PURE__ */ new Map();
    Rr = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    Le || (v = { ensureResources: function(t2, e2, r2, n2) {
      return function(t3, e3, r3, n3) {
        return !t3.glMask || t3.glMask.width !== e3 || t3.glMask.height !== r3 || "function" == typeof t3.glMask.pixelDensity && t3.glMask.pixelDensity() !== n3;
      }(t2, e2, r2, n2) && (t2.glMask?.remove && t2.glMask.remove(), t2.glMask = _(t2, { width: e2, height: r2, density: n2, antialias: false, depth: false, stencil: false })), t2.glMask.dirtyRect ??= null, t2.glMask.isDrawn ??= false, t2.glMask;
    }, clearMask: function(t2, e2) {
      t2 && (e2(t2), t2.isDrawn = false, t2.dirtyRect = null);
    }, getCompositeRect: function(t2, e2, r2, n2, i2) {
      return t2 ? t2.dirtyRect ? e2() ? r2() : i2(n2(t2.dirtyRect, 2)) : r2() : null;
    }, getShaderMask: function(t2, e2) {
      return e2;
    } }, Le = true), P.stroke = { color: null, weight: 1, type: "HB", isActive: false, opacity: 1 };
    Cr = /* @__PURE__ */ new Map();
    Fr = { offset: 0.08, scale: 0.08, warp: 0.06, tilt: 0.06 };
    jr = 0;
    Kr = {};
    Jr = [];
    pt(() => {
      Jr.length = 0;
    });
    un = ["weight", "scatter", "sharpness", "grain", "opacity", "spacing", "pressure", "type", "tip", "rotate", "markerTip", "noise"];
    fn = [["pen", [0.3, 0.15, 0.9, 0.7, 150, 0.1, { curve: [0.15, 0.2], min_max: [1.2, 1] }]], ["rotring", [0.15, 0.05, 0.7, 0.9, 210, 0.1, { curve: [0.35, 0.2], min_max: [1.3, 1] }]], ["2B", [0.3, 0.75, 0.45, 0.8, 180, 0.1, { curve: [0.1, 0.3], min_max: [1.1, 0.9] }]], ["HB", [0.3, 0.6, 0.3, 0.7, 170, 0.1, { curve: [0.15, 0.2], min_max: [1.1, 0.9] }]], ["2H", [0.2, 0.6, 0.3, 0.75, 120, 0.1, { curve: [0.15, 0.2], min_max: [1.1, 0.9] }]], ["cpencil", [0.35, 0.55, 0.8, 0.7, 75, 0.1, { curve: [0.15, 0.2], min_max: [0.95, 1.1] }]], ["pastel", [0.7, 5, 0.91, 1, 30, 0.085 / 3, { mode: "gaussian", curve: [0.4, 0.05], min_max: [1.09, 0.93] }, "default", void 0, "natural", true, 1]], ["crayon", [0.33, 1.9, 0.75, 2, 159, 0.07, [1.1, 0.9], "default", void 0, "natural", true, 1]], ["charcoal", [0.35, 1.5, 0.68, 2, 120, 0.03, { curve: [0.15, 0.4], min_max: [1.1, 0.95] }]], ["spray", [0.2, 6, 15, 40, 90, 0.5, { curve: [0.2, 0.35], min_max: [0.7, 1] }, "spray"]], ["marker", [2, 0.2, null, null, 1, 0.03, { curve: [0.35, 0.25], min_max: [1.2, 0.85] }, "marker"]]];
    for (let t2 of fn) {
      let e2 = {};
      for (let r2 = 0; r2 < t2[1].length; r2++) e2[un[r2]] = t2[1][r2];
      Dr(t2[0], e2);
    }
    ge.prototype.draw = function(t2 = false, e2, r2) {
      let n2 = Ir();
      if (t2 && Yr(t2, e2, r2), n2.isActive) for (let t3 of this.sides) ln(t3[0].x, t3[0].y, t3[1].x, t3[1].y);
      return kr(n2), this;
    }, xe.prototype.draw = function(t2, e2, r2) {
      return Ir().isActive && (this.origin && (t2 = this.origin[0], e2 = this.origin[1], r2 = 1), function(t3, e3, r3, n2) {
        Zt(), Zr(e3, r3, t3.length, t3), Qr(n2, true);
      }(this, t2, e2, r2)), this;
    };
    mn = { tips: /* @__PURE__ */ new Map(), add(t2) {
      this.tips.has(t2) || this.tips.set(t2, false);
    }, imageToWhite(t2) {
      t2.loadPixels();
      for (let e2 = 0; e2 < 4 * t2.width * t2.height; e2 += 4) {
        let r2 = (t2.pixels[e2] + t2.pixels[e2 + 1] + t2.pixels[e2 + 2]) / 3;
        t2.pixels[e2] = t2.pixels[e2 + 1] = t2.pixels[e2 + 2] = 255, t2.pixels[e2 + 3] = 255 - r2;
      }
      t2.updatePixels();
    }, async load() {
      const t2 = [...this.tips.keys()].filter((t3) => !this.tips.get(t3));
      await Promise.all(t2.map((t3) => ((t4, e2) => De.loadImageTip(t4, e2))(t3, mn.imageToWhite).then((e2) => {
        this.tips.set(t3, e2);
      })));
    } };
    P.hatch = { isActive: false, dist: 5, angle: 45, options: {}, hBrush: false };
    bn = new Float64Array(256);
    _n = new Float64Array(256);
    vn = new Float64Array(512);
    wn = new Float64Array(512);
    Rn = new Float64Array(512);
    En = new Float64Array(512);
    ge.prototype.hatch = function(t2 = false, e2, r2) {
      let n2 = dn();
      return t2 && xn(t2, e2, r2), P.hatch.isActive && Tn(this), gn(n2), this;
    }, xe.prototype.hatch = function(t2, e2, r2) {
      dn().isActive && (this.origin && (t2 = this.origin[0], e2 = this.origin[1], r2 = 1), this.pol = this.genPol(t2, e2, r2, 0.3), this.pol.hatch());
    }, P.mass = { isActive: false, brush: null, color: null, options: {} }, ge.prototype.mass = function() {
      return P.mass?.isActive && Gn(this, false), this;
    }, xe.prototype.mass = function(t2, e2, r2) {
      return P.mass?.isActive && (this.origin && (t2 = this.origin[0], e2 = this.origin[1], r2 = 1), Gn(this, t2, e2, r2)), this;
    };
    Wn = null;
    qn = false;
    qn || (w = { ensureResources: function(t2, e2, r2, n2, i2) {
      const a2 = Math.max(1, Math.round(e2 * n2)), o2 = Math.max(1, Math.round(r2 * n2));
      return function(t3, e3, r3) {
        return !t3.mask || t3.mask.width !== e3 || t3.mask.height !== r3;
      }(t2, a2, o2) && (t2.mask = p(a2, o2)), function(t3, e3, r3, n3) {
        return !t3.fillMaskFramebuffer || t3.fillMaskFramebuffer.width !== e3 || t3.fillMaskFramebuffer.height !== r3 || "function" == typeof t3.fillMaskFramebuffer.pixelDensity && t3.fillMaskFramebuffer.pixelDensity() !== n3;
      }(t2, e2, r2, n2) && (t2.fillMaskFramebuffer?.remove && t2.fillMaskFramebuffer.remove(), t2.fillMaskFramebuffer = _(t2, { width: e2, height: r2, density: n2, antialias: false, depth: false, stencil: false }), i2(t2.fillMaskFramebuffer)), t2.mask.dirtyRect ??= null, t2.mask.isDrawn ??= false, t2.mask.drawingContext.imageSmoothingEnabled = false, { mask: t2.mask, ctx: t2.mask.drawingContext };
    }, clearMask: function(t2, e2) {
      t2 && (e2(t2), t2.isDrawn = false, t2.dirtyRect = null);
    }, getCompositeRect: function(t2, e2, r2, n2, i2) {
      return t2 ? t2.dirtyRect ? i2(n2(t2.dirtyRect, 4)) : r2() : null;
    }, getShaderMask: function(t2, e2, r2, n2, i2) {
      const a2 = t2.fillMaskFramebuffer, o2 = t2.drawingContext, s2 = r2 ?? n2(), c2 = s2.maxX - s2.minX, l2 = s2.maxY - s2.minY;
      Wn && Wn.width === c2 && Wn.height === l2 || (Wn = p(c2, l2));
      const h2 = Wn.drawingContext;
      return h2.clearRect(0, 0, c2, l2), h2.drawImage(e2, s2.minX, s2.minY, c2, l2, 0, 0, c2, l2), i2(a2), o2.bindTexture(o2.TEXTURE_2D, a2.colorTexture), o2.texSubImage2D(o2.TEXTURE_2D, 0, s2.minX, s2.minY, o2.RGBA, o2.UNSIGNED_BYTE, Wn), a2;
    } }, qn = true);
    Kn = [];
    Zn = [];
    Jn = [];
    Qn = [];
    P.fill = { opacity: 150, bleed_strength: 0.07, texture_strength: 0.8, border_strength: 0.5, direction: "out", angle: null, scatter: true, isActive: false };
    ti = () => ({ ...P.fill });
    hi = [[], []];
    pt(ui);
    fi = class _fi {
      constructor(t2, e2, r2, n2 = [], i2 = false, a2, o2) {
        if (this.v = t2, this.m = e2, this.dir = n2, this.midP = r2, i2) {
          let e3 = 0, n3 = 0;
          const i3 = [];
          for (let a4 = 0; a4 < t2.length; a4++) {
            const o4 = Math.abs(r2.x - t2[a4].x), s3 = Math.abs(r2.y - t2[a4].y);
            e3 = Math.max(e3, o4), n3 = Math.max(n3, s3);
            const c2 = t2[a4], l2 = t2[(a4 + 1) % t2.length], h2 = { x: l2.x - c2.x, y: l2.y - c2.y }, u2 = $t(0, 0, h2.x, h2.y, 90), f2 = { x: c2.x + h2.x / 2, y: c2.y + h2.y / 2 };
            i3.push({ v1: c2, v2: l2, ray: { point1: f2, point2: { x: f2.x + u2.x, y: f2.y + u2.y } } });
          }
          this.sizeX = e3, this.sizeY = n3;
          const a3 = ai.sides;
          this.dir = Array(t2.length);
          for (let t3 = 0; t3 < i3.length; t3++) {
            const e4 = i3[t3], r3 = e4.ray.point1.x, n4 = e4.ray.point1.y, o4 = e4.ray.point2.x - r3, s3 = e4.ray.point2.y - n4, c2 = e4.v2.x - e4.v1.x, l2 = e4.v2.y - e4.v1.y, h2 = -(c2 * c2 + l2 * l2);
            let u2 = 0;
            for (let t4 = 0; t4 < a3.length; t4++) {
              const e5 = a3[t4][0], i4 = a3[t4][1], c3 = i4.x - e5.x, l3 = i4.y - e5.y, f2 = l3 * o4 - c3 * s3;
              if (0 === f2) continue;
              const m2 = (o4 * (n4 - e5.y) - s3 * (r3 - e5.x)) / f2;
              m2 < 0 || m2 > 1 || (c3 * (n4 - e5.y) - l3 * (r3 - e5.x)) / f2 * h2 <= 0.01 || u2++;
            }
            this.dir[t3] = u2 % 2 == 0;
          }
          const o3 = Rt(-0.6, 0.6) * e3, s2 = Rt(-0.6, 0.6) * n3;
          this.midP = { x: r2.x + o3, y: r2.y + s2 };
        } else this.sizeX = a2, this.sizeY = o2;
      }
      trim(t2 = 1) {
        if (t2 >= 1 || t2 < 0 || this.v.length <= 8) return { v: this.v, m: this.m, dir: this.dir };
        const e2 = this.v.length, r2 = ~~((1 - t2) * e2), n2 = ~~(e2 / 2 - r2 / 2), i2 = n2, a2 = n2 + r2, o2 = this.v[(i2 - 1 + e2) % e2], s2 = this.v[a2 % e2], c2 = s2.x - o2.x, l2 = s2.y - o2.y, h2 = Math.hypot(c2, l2), u2 = n2 >= 2 ? ~~Rt(0, n2 - 1) : a2 < e2 - 1 ? a2 : 0, f2 = this.v[u2], m2 = this.v[(u2 + 1) % e2], d2 = Math.max(1, Math.hypot(m2.x - f2.x, m2.y - f2.y)), g2 = Math.max(2, Math.ceil(h2 / d2 * 0.05)), x2 = e2 - r2 + g2, y2 = new Array(x2), p2 = new Array(x2), b2 = new Array(x2);
        let _2 = 0;
        for (let t3 = 0; t3 < n2; t3++, _2++) y2[_2] = this.v[t3], p2[_2] = this.m[t3], b2[_2] = this.dir[t3];
        const v2 = 0.06 * h2, w2 = this.dir[i2 % this.dir.length];
        for (let t3 = 0; t3 < g2; t3++, _2++) {
          const e3 = (t3 + 1) / (g2 + 1);
          y2[_2] = { x: o2.x + c2 * e3 + Rt(-v2, v2), y: o2.y + l2 * e3 + Rt(-v2, v2) }, p2[_2] = Rt(0.3, 0.5), b2[_2] = w2;
        }
        for (let t3 = a2; t3 < e2; t3++, _2++) y2[_2] = this.v[t3], p2[_2] = this.m[t3], b2[_2] = this.dir[t3];
        return { v: y2, m: p2, dir: b2 };
      }
      scatter(t2 = 0.3) {
        const e2 = this.v.length, r2 = Math.max(3, ~~(e2 * t2)), n2 = e2 / r2, i2 = 0.8 * n2, a2 = [], o2 = [], s2 = [], c2 = this.midP, l2 = ai.sides;
        for (let t3 = 0; t3 < r2; t3++) {
          const r3 = ~~(t3 * n2 + Rt(0, i2)) % e2;
          let h2 = this.v[r3], u2 = false;
          if (h2.x < oi || h2.x > ci || h2.y < si || h2.y > li) u2 = true;
          else {
            let t4 = 0;
            for (const [e3, r4] of l2) {
              const n3 = e3.y, i3 = r4.y;
              if (n3 > h2.y == i3 > h2.y) continue;
              const a3 = (h2.y - n3) / (i3 - n3);
              h2.x < e3.x + a3 * (r4.x - e3.x) && t4++;
            }
            u2 = t4 % 2 == 0;
          }
          u2 && (h2 = { x: c2.x + (h2.x - c2.x) * Rt(0.3, 0.6), y: c2.y + (h2.y - c2.y) * Rt(0.3, 0.6) }), a2.push(h2), o2.push(this.m[r3]), s2.push(!this.dir[r3]);
        }
        return new _fi(a2, o2, this.midP, s2, false, this.sizeX, this.sizeY);
      }
      flipDirs() {
        return new _fi(this.v, this.m, this.midP, this.dir.map((t2) => !t2), false, this.sizeX, this.sizeY);
      }
      grow(t2 = 1) {
        const { v: e2, m: r2, dir: n2 } = this.trim(t2), i2 = e2.length, a2 = 2 * i2;
        Kn.length < i2 && (Kn = new Array(i2), Zn = new Array(i2)), Jn.length < a2 && (Jn = new Array(a2), Qn = new Array(a2));
        const o2 = Kn, s2 = Zn, c2 = Jn, l2 = Qn, h2 = "out" === P.fill.direction ? -90 : 90;
        0 === hi[0].length && ui();
        const u2 = hi[0], f2 = u2.length, m2 = hi[1], d2 = m2.length;
        let g2 = 0, x2 = 0, y2 = 999 === t2 ? Rt(0.6, 0.8) : P.fill.bleed_strength;
        const p2 = jn && 2 * i2 > jn ? Math.ceil(2 * i2 / jn) : 1;
        if (p2 >= 2 && !(1 & p2)) {
          for (let e3 = 0; e3 < i2; e3++) {
            const n3 = r2[e3];
            t2 < 997 && (y2 = n3), y2 >= 0.05 && (Rt(-1, 1), u2[~~(Rt(0, 1) * f2)], Rt(0.65, 1.35), m2[~~(Rt(0, 1) * d2)]);
          }
          return new _fi(e2, r2, this.midP, n2, false, this.sizeX, this.sizeY);
        }
        for (let a3 = 0; a3 < i2; a3++) {
          const p3 = e2[a3], b3 = e2[a3 + 1 < i2 ? a3 + 1 : 0], _3 = r2[a3], v3 = n2[a3];
          if (t2 < 997 && (y2 = _3), y2 < 0.05) {
            c2[g2] = _3, l2[g2] = v3, g2++, o2[x2] = (p3.x + b3.x) / 2, s2[x2] = (p3.y + b3.y) / 2, c2[g2] = _3, l2[g2] = v3, g2++, x2++;
            continue;
          }
          const w2 = (v3 ? h2 : -h2) + 5 * Rt(-1, 1), R2 = Gt(w2), E2 = R2[0], A2 = R2[1], M2 = b3.x - p3.x, T2 = b3.y - p3.y, S2 = E2 * M2 + A2 * T2, P2 = E2 * T2 - A2 * M2, C2 = u2[~~(Rt(0, 1) * f2)] * Rt(0.65, 1.35) * y2, F2 = _3 + m2[~~(Rt(0, 1) * d2)];
          c2[g2] = _3, l2[g2] = v3, g2++, o2[x2] = p3.x + 0.5 * M2 + S2 * C2, s2[x2] = p3.y + 0.5 * T2 + P2 * C2, c2[g2] = F2, l2[g2] = v3, g2++, x2++;
        }
        let b2, _2, v2;
        if (jn && g2 > jn) {
          const t3 = Math.ceil(g2 / jn), r3 = Math.ceil(g2 / t3);
          b2 = new Array(r3), _2 = new Array(r3), v2 = new Array(r3);
          let n3 = 0;
          for (let r4 = 0; r4 < g2; r4 += t3, n3++) b2[n3] = r4 % 2 == 0 ? e2[r4 >> 1] : { x: o2[r4 >> 1], y: s2[r4 >> 1] }, _2[n3] = c2[r4], v2[n3] = l2[r4];
        } else {
          b2 = new Array(g2);
          for (let t3 = 0; t3 < g2; t3++) b2[t3] = t3 % 2 == 0 ? e2[t3 >> 1] : { x: o2[t3 >> 1], y: s2[t3 >> 1] };
          _2 = c2.slice(0, g2), v2 = l2.slice(0, g2);
        }
        return new _fi(b2, _2, this.midP, v2, false, this.sizeX, this.sizeY);
      }
      fill(t2, n2, a2) {
        const o2 = 3 * a2, s2 = 2 * n2 * (1 + a2 / 2), l2 = false !== F.isBrush;
        F.isBrush = false, l2 && (F.justChanged = true), F.blend(t2);
        const h2 = c();
        F.ctx.save(), F.ctx.setTransform(i * h2.a, i * h2.b, i * h2.c, i * h2.d, i * (h2.x + e / 2), i * (h2.y + r / 2)), F.ctx.strokeStyle = "rgb(255 0 0 / " + 0.01 * P.fill.border_strength + ")", F.ctx.lineCap = "round", jn = 2024 * Math.max(0.2, 2 * P.fill.bleed_strength);
        const u2 = F.ctx.getTransform(), f2 = Math.max(this.sizeX, this.sizeY), m2 = Rt(0.15, 0.7);
        let d2 = this.grow();
        const g2 = this.scatter(0.1).grow().scatter(0.75).flipDirs();
        let x2;
        for (let e2 = 0; e2 < 20; e2++) {
          e2 % 4 == 0 && (d2 = d2.grow()), e2 % 2 == 0 && (x2 = [d2.grow(1 - 0.0125 * e2), d2.grow(0.7 - 0.0125 * e2), d2.grow(0.4 - 0.0125 * e2)]);
          for (const t3 of x2) t3.grow(999).grow(997).layer(e2, f2, s2, u2);
          P.fill.scatter && g2.grow(999).flipDirs().grow(997).layer(e2, f2, s2 * o2, u2), e2 % 2 == 0 && d2.grow(m2).grow(999).layer(e2, f2, 2 * s2, u2), e2 % 8 != 0 && 19 !== e2 || (0 !== o2 && d2.erase(3 * o2, n2), F.blend(t2, true));
        }
        F.ctx.restore();
      }
      layer(t2, e2, r2, n2 = null) {
        F.ctx.lineWidth = kt(t2, 0, 24, e2 / 25, e2 / 30, true) * P.fill.border_strength, F.ctx.fillStyle = "rgb(255 0 0 / " + r2 + "%)", Hn(this.v, n2), F.ctx.fill(), F.ctx.stroke();
      }
      erase(t2, e2) {
        F.ctx.save();
        const r2 = ~~(Rt(80, 110) * kt(t2, 0, 1, 2, 3.5)), n2 = this.sizeX / 1.3, i2 = this.sizeY / 1.3, a2 = 1.3 * Math.min(this.sizeX, this.sizeY), o2 = 0.03 * a2, s2 = 0.45 * a2, { x: c2, y: l2 } = this.midP;
        F.ctx.globalCompositeOperation = "destination-out";
        const h2 = (5 - kt(e2, 80, 100, 0.3, 0.7, true)) * t2 / 255;
        F.ctx.fillStyle = `rgb(255 0 0 / ${h2})`, F.ctx.lineWidth = 0;
        for (let t3 = 0; t3 < r2; t3++) {
          const e3 = c2 + Ft(0, n2), r3 = l2 + Ft(0, i2), a3 = Rt(o2, s2);
          F.ctx.beginPath(), $n(e3, r3, a3), t3 % 5 != 0 && F.ctx.fill();
        }
        F.ctx.globalCompositeOperation = "source-over", F.ctx.restore();
      }
    };
    ge.prototype.fill = function(t2 = false, e2, r2, n2, i2, a2, o2) {
      let s2 = ti();
      return t2 && (ei(t2, e2), ri(r2, a2, o2), ni(n2, i2)), s2.isActive && (Zt(), function(t3) {
        if (!P.fill.isActive || !P.fill.color) throw new Error("No fill color set. Call brush.fill(color) before drawing shapes.");
        ai = t3, oi = Infinity, si = Infinity, ci = -Infinity, li = -Infinity;
        for (const [e4] of t3.sides) e4.x < oi && (oi = e4.x), e4.x > ci && (ci = e4.x), e4.y < si && (si = e4.y), e4.y > li && (li = e4.y);
        const e3 = [...t3.vertices], r3 = Rt(0, 75), n3 = ~~(0.25 * e3.length * (r3 < 5 ? 1 : r3 < 15 ? 2 : 3)), i3 = P.fill.bleed_strength, a3 = e3.map((t4, e4) => (e4 > n3 ? 1 : 0.3) * Rt(0.85, 1.4) * i3), o3 = null == P.fill.angle ? Tt(0, e3.length) : function(t4, e4) {
          const r4 = Gt(e4), n4 = r4[0], i4 = -r4[1];
          let a4 = 0, o4 = Infinity;
          for (let e5 = 0; e5 < t4.length; e5++) {
            const r5 = t4[e5].x * n4 + t4[e5].y * i4;
            r5 < o4 && (o4 = r5, a4 = e5);
          }
          return a4;
        }(e3, P.fill.angle), s3 = e3.length, c2 = new Array(s3);
        for (let t4 = 0; t4 < s3; t4++) c2[t4] = e3[(t4 + o3) % s3];
        const l2 = function(t4) {
          const e4 = t4.length;
          if (0 === e4) return { x: 0, y: 0 };
          if (e4 < 8) {
            let r5 = 0, n5 = 0;
            for (let i5 = 0; i5 < e4; i5++) r5 += t4[i5].x, n5 += t4[i5].y;
            return { x: r5 / e4, y: n5 / e4 };
          }
          let r4 = 0, n4 = 0, i4 = 0;
          for (let a4 = 0; a4 < e4; a4++) {
            const o4 = a4 + 1 < e4 ? a4 + 1 : 0, s4 = t4[a4].x, c3 = t4[a4].y, l3 = t4[o4].x, h2 = t4[o4].y, u2 = s4 * h2 - l3 * c3;
            r4 += u2, n4 += (s4 + l3) * u2, i4 += (c3 + h2) * u2;
          }
          return r4 *= 0.5, r4 ? { x: n4 / (6 * r4), y: i4 / (6 * r4) } : { x: t4[0].x, y: t4[0].y };
        }(c2);
        new fi(c2, a3, l2, [], true).fill(P.fill.color, kt(P.fill.opacity, 0, 255, 0, 1, true), P.fill.texture_strength);
      }(this)), ((t3) => {
        P.fill = { ...t3 };
      })(s2), this;
    }, xe.prototype.fill = function(t2, e2, r2) {
      ti().isActive && (this.origin && (t2 = this.origin[0], e2 = this.origin[1], r2 = 1), this.pol = this.genPol(t2, e2, r2, P.fill.bleed_strength < 0.06 ? 0 : kt(P.fill.bleed_strength, 0, 0.6, 0.2, 0.6, true)), this.pol.fill());
    }, P.wash = { color: null, opacity: 150, isActive: false }, ge.prototype.wash = function(t2 = false, n2) {
      const a2 = { ...P.wash };
      return false !== t2 && mi(t2, n2), P.wash.isActive && function(t3) {
        if (!P.wash?.isActive || !P.wash.color || t3.vertices.length < 3) return;
        const n3 = false !== F.isBrush;
        F.isBrush = false, n3 && (F.justChanged = true), F.blend(P.wash.color);
        const a3 = c();
        F.ctx.save(), F.ctx.setTransform(i * a3.a, i * a3.b, i * a3.c, i * a3.d, i * (a3.x + e / 2), i * (a3.y + r / 2)), Hn(t3.vertices);
        const o2 = P.wash.opacity / 255;
        F.ctx.fillStyle = "rgb(255 0 0 / " + o2 + ")", F.ctx.fill(), F.ctx.restore();
      }(this), P.wash = { ...a2 }, this;
    }, xe.prototype.wash = function(t2, e2, r2) {
      P.wash?.isActive && (this.origin && (t2 = this.origin[0], e2 = this.origin[1], r2 = 1), this.pol = this.genPol(t2, e2, r2, 0, -1), this.pol.wash());
    }, Si = { load: function(t2 = et) {
      if (!function(t3) {
        return function(t4) {
          return "undefined" != typeof HTMLCanvasElement && t4 instanceof HTMLCanvasElement;
        }(t3) || function(t4) {
          return "undefined" != typeof OffscreenCanvas && t4 instanceof OffscreenCanvas;
        }(t3);
      }(t2)) throw new Error("Standalone brush.load(target) requires an HTMLCanvasElement or OffscreenCanvas.");
      ot(t2, t2.width, t2.height, 1);
    }, syncDensity: function() {
      return f({ Cwidth: it, Cheight: at, Density: nt }), nt;
    }, isCanvasReady: function() {
      if (!rt) throw new Error("No standalone target loaded. Call brush.load(canvasOrOffscreenCanvas) first.");
    }, instance: function() {
    }, activateInstance: function() {
    }, deactivateInstance: function() {
    }, getActiveFramebuffer: function() {
      return null;
    }, isFramebufferTarget: function() {
      return true === arguments[0]?.__brushFramebuffer;
    } }, u = { ...u, ...Si }, K(), function() {
      var t2;
      t2 = { beginDirectMaskDraw: gi, endDirectMaskDraw: xi, resetDirectShaderTracking: yi }, Be = { ...Be, ...t2 };
    }(), function() {
      var t2;
      t2 = { clearTarget: pi, ensureBlendShaderProgram: bi, ensureBlendSourceFramebuffer: vi, createFramebuffer: _i, runBlendShaderPass: wi, blitSourceToFramebuffer: Ri }, b = { ...b, ...t2 };
    }(), function() {
      var t2;
      t2 = { createTipSurface: Mi, loadImageTip: Ti }, De = { ...De, ...t2 };
    }();
  }
});

// js/ui/debug.js
var LOGBOOK_KEY = "www_paint_error_logbook";
var STATUS_MSG_ID = "status-message";
var STATUS_FOOTER_ID = "status-bar";
window.__debugSession = window.__debugSession || [];
var _hasErrors = false;
var _statusRevertTimer = null;
var _origConsoleError = console.error;
var _origConsoleWarn = console.warn;
var _origConsoleLog = console.log;
var _origConsoleInfo = console.log;
function _recordLog(level, message) {
  window.__debugSession.push({
    level,
    message,
    timestamp: Date.now()
  });
  if (level === "error" || level === "warn") {
    _hasErrors = true;
    _flashStatus();
  }
}
function _flashStatus() {
  const msgEl = document.getElementById(STATUS_MSG_ID);
  if (!msgEl) return;
  msgEl.textContent = "ERROR";
  msgEl.classList.add("status__error");
  msgEl.classList.remove("status__loading");
  if (_statusRevertTimer) clearTimeout(_statusRevertTimer);
  _statusRevertTimer = window.setTimeout(() => {
    const stillError = window.__debugSession.some(
      (e2) => e2.level === "error" || e2.level === "warn"
    );
    if (!stillError) {
      msgEl.textContent = "Ready";
      msgEl.classList.remove("status__error");
    }
  }, 4e3);
}
function _installHooks() {
  console.error = function(...args) {
    _recordLog("error", args.map((a2) => typeof a2 === "string" ? a2 : JSON.stringify(a2)).join(" "));
    _origConsoleError.apply(console, args);
  };
  console.warn = function(...args) {
    _recordLog("warn", args.map((a2) => typeof a2 === "string" ? a2 : JSON.stringify(a2)).join(" "));
    _origConsoleWarn.apply(console, args);
  };
  console.log = function(...args) {
    _recordLog("info", args.map((a2) => typeof a2 === "string" ? a2 : JSON.stringify(a2)).join(" "));
    _origConsoleLog.apply(console, args);
  };
  console.info = function(...args) {
    _recordLog("info", args.map((a2) => typeof a2 === "string" ? a2 : JSON.stringify(a2)).join(" "));
    _origConsoleInfo.apply(console, args);
  };
  window.addEventListener("error", (e2) => {
    _recordLog("error", e2.error ? e2.error.message || String(e2.error) : e2.message || "Unknown error");
    _origConsoleError.call(console, e2.error || e2.message);
  });
  window.addEventListener("unhandledrejection", (e2) => {
    const msg = e2.reason ? typeof e2.reason === "string" ? e2.reason : e2.reason.message || JSON.stringify(e2.reason) : "Unhandled rejection";
    _recordLog("error", msg);
    _origConsoleError.call(console, msg);
  });
}
function _getSettingsSnapshot() {
  const snap = {
    style: "unknown",
    strokeCount: 0,
    layers: 0,
    smart: false,
    order: "unknown"
  };
  try {
    const app2 = window._wwwPaint || window.__app;
    if (app2) {
      if (app2.engine && app2.engine.settings) {
        const s2 = app2.engine.settings;
        snap.style = s2.style || s2.name || "unknown";
        snap.strokeCount = s2.strokeCount || s2.count || 0;
        snap.smart = s2.smart ?? false;
        snap.order = s2.order || "unknown";
      }
      if (app2.engine && app2.engine.layers) {
        snap.layers = app2.engine.layers.length;
      }
    }
  } catch (e2) {
    snap.error = e2.message;
  }
  return snap;
}
function _saveToLogbook() {
  if (!_hasErrors) return;
  try {
    const existing = JSON.parse(localStorage.getItem(LOGBOOK_KEY) || "[]");
    existing.push({
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      settings: _getSettingsSnapshot(),
      entries: window.__debugSession.map((e2) => ({
        level: e2.level,
        message: e2.message,
        ts: new Date(e2.timestamp).toISOString()
      })),
      notes: "",
      fixes: ""
    });
    localStorage.setItem(LOGBOOK_KEY, JSON.stringify(existing));
  } catch (e2) {
    _origConsoleError.call(console, "Failed to save debug logbook:", e2);
  }
}
function _loadLogbook() {
  try {
    return JSON.parse(localStorage.getItem(LOGBOOK_KEY) || "[]");
  } catch (e2) {
    return [];
  }
}
var _overlay = null;
function _ensureOverlay() {
  if (_overlay) return _overlay;
  const root = document.getElementById("debug-root");
  if (root) {
    _overlay = document.createElement("div");
    _overlay.id = "debug-overlay";
    _overlay.className = "debug-overlay";
    _overlay.setAttribute("role", "dialog");
    _overlay.setAttribute("aria-hidden", "true");
    root.appendChild(_overlay);
  } else {
    _overlay = document.createElement("div");
    _overlay.id = "debug-overlay";
    _overlay.className = "debug-overlay";
    _overlay.setAttribute("role", "dialog");
    _overlay.setAttribute("aria-hidden", "true");
    document.body.appendChild(_overlay);
  }
  _overlay.innerHTML = "";
  const backdrop = document.createElement("div");
  backdrop.className = "debug-overlay__backdrop";
  const panel = document.createElement("div");
  panel.className = "debug-panel";
  const header = document.createElement("div");
  header.className = "debug-header";
  header.innerHTML = `
    <span class="debug-header__title">WWW_PAINT DEBUG SESSION</span>
    <button type="button" class="debug-close-btn" aria-label="Close debug overlay">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;
  const body = document.createElement("div");
  body.className = "debug-body";
  body.innerHTML = `
    <div class="debug-section">
      <div class="debug-section-title">CURRENT SESSION</div>
      <div class="debug-log" id="debug-log"></div>
    </div>
    <div class="debug-section debug-settings-section" id="debug-settings-section">
      <div class="debug-section-title">SETTINGS SNAPSHOT</div>
      <pre class="debug-settings" id="debug-settings"></pre>
    </div>
    <div class="debug-section debug-logbook-section" id="debug-logbook-section">
      <div class="debug-section-title debug-logbook__toggle" style="cursor:pointer; user-select:none;">
        Previous Sessions \u25BC
      </div>
      <div class="debug-logbook__content" id="debug-logbook-content"></div>
    </div>
  `;
  const footer = document.createElement("div");
  footer.className = "debug-footer";
  footer.innerHTML = `
    <button type="button" class="debug-copy-btn" id="debug-copy">COPY LOG</button>
  `;
  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(footer);
  _overlay.appendChild(backdrop);
  _overlay.appendChild(panel);
  const closeBtn = _overlay.querySelector(".debug-close-btn");
  closeBtn?.addEventListener("click", () => _DebugOverlay.hide());
  backdrop?.addEventListener("click", () => _DebugOverlay.hide());
  const copyBtn = _overlay.querySelector("#debug-copy");
  copyBtn?.addEventListener("click", () => _copyLogToClipboard());
  const logbookToggle = _overlay.querySelector(".debug-logbook__toggle");
  const logbookContent = _overlay.querySelector("#debug-logbook-content");
  if (logbookToggle && logbookContent) {
    logbookToggle.addEventListener("click", () => {
      const expanded = logbookContent.style.display !== "none";
      logbookContent.style.display = expanded ? "none" : "block";
      logbookToggle.innerHTML = expanded ? 'Previous Sessions <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6l6-6"/></svg>' : 'Previous Sessions <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6l-6 6"/></svg>';
    });
  }
  _onDebugKeyDown = (e2) => {
    if (e2.key === "Escape") _DebugOverlay.hide();
  };
  document.addEventListener("keydown", _onDebugKeyDown);
  return _overlay;
}
var _onDebugKeyDown = null;
function _renderLog() {
  const logEl = _overlay?.querySelector("#debug-log");
  if (!logEl) return;
  if (window.__debugSession.length === 0) {
    logEl.innerHTML = '<div class="debug-log-entry">No errors or warnings logged.</div>';
    return;
  }
  logEl.innerHTML = window.__debugSession.map((entry) => {
    const prefix = entry.level === "error" ? "[ERR]" : entry.level === "warn" ? "[WARN]" : entry.level === "sys" ? "[SYS]" : "[INFO]";
    const cls = entry.level === "error" ? "debug-log-entry--error" : entry.level === "warn" ? "debug-log-entry--warn" : "";
    const time = new Date(entry.timestamp).toISOString().slice(11, 23);
    return `<div class="debug-log-entry ${cls}">${time} ${prefix} ${entry.message}</div>`;
  }).join("");
  logEl.scrollTop = logEl.scrollHeight;
}
function _renderSettings() {
  const el = _overlay?.querySelector("#debug-settings");
  if (!el) return;
  const snap = _getSettingsSnapshot();
  let lines = [];
  for (const [k2, v2] of Object.entries(snap)) {
    lines.push(`  ${k2}: ${JSON.stringify(v2)}`);
  }
  el.textContent = "{\n" + lines.join("\n") + "\n}";
}
function _renderLogbook() {
  const section = _overlay?.querySelector("#debug-logbook-section");
  const content = _overlay?.querySelector("#debug-logbook-content");
  if (!section || !content) return;
  const entries = _loadLogbook();
  if (entries.length === 0) {
    section.style.display = "none";
    return;
  }
  section.style.display = "block";
  content.style.display = "none";
  const toggle = _overlay?.querySelector(".debug-logbook__toggle");
  if (toggle) toggle.style.display = "block";
  content.innerHTML = entries.slice().reverse().map((entry) => {
    const time = new Date(entry.timestamp).toISOString().slice(0, 19).replace("T", " ");
    const logLines = (entry.entries || []).map((e2) => `  ${e2.ts.slice(11, 23)} ${e2.level.toUpperCase()} ${e2.message}`).join("\n");
    const settingsLines = Object.entries(entry.settings || {}).map(([k2, v2]) => `  ${k2}: ${JSON.stringify(v2)}`).join("\n");
    const notes = entry.notes || "";
    const fixes = entry.fixes || "";
    return `<div class="debug-logbook-entry">
      <div class="debug-logbook__time">${time}</div>
      <pre class="debug-logbook__settings">${settingsLines || "(no settings)"}</pre>
      <pre class="debug-logbook__log">${logLines || "(no log entries)"}</pre>
      ${notes ? `<div class="debug-section-title">NOTES</div><pre class="debug-logbook__settings">${notes}</pre>` : ""}
      ${fixes ? `<div class="debug-section-title">FIXES</div><pre class="debug-logbook__settings">${fixes}</pre>` : ""}
    </div>`;
  }).join("");
}
function _copyLogToClipboard() {
  const sessionStart = window.__debugSession.length > 0 ? window.__debugSession[0].timestamp : Date.now();
  const startTime = new Date(sessionStart).toISOString();
  const header = [
    "=== WWW_PAINT DEBUG SESSION ===",
    "Site: WWW_PAINT",
    "Session start: " + startTime,
    ""
  ];
  const snap = _getSettingsSnapshot();
  let uiSettings = null;
  try {
    if (window.__UISettings && typeof window.__UISettings.getSettings === "function") {
      uiSettings = window.__UISettings.getSettings();
    }
  } catch (e2) {
    uiSettings = { error: e2.message };
  }
  const settingsLines = ["--- SETTINGS ---"];
  settingsLines.push("engine settings: " + JSON.stringify(snap));
  if (uiSettings) {
    settingsLines.push("ui theme mode: " + (uiSettings.activeMode || "unknown"));
    if (uiSettings.dark) settingsLines.push("dark colors: " + JSON.stringify(uiSettings.dark));
    if (uiSettings.light) settingsLines.push("light colors: " + JSON.stringify(uiSettings.light));
  }
  settingsLines.push("");
  const logLines = ["--- LOG ---"];
  if (window.__debugSession.length > 0) {
    window.__debugSession.forEach((e2) => {
      const prefix = e2.level === "error" ? "[ERR]" : e2.level === "warn" ? "[WARN]" : e2.level === "sys" ? "[SYS]" : "[INFO]";
      const time = new Date(e2.timestamp).toISOString().slice(11, 23);
      logLines.push(`${time} ${prefix} ${e2.message}`);
    });
  } else {
    logLines.push("(no log entries)");
  }
  logLines.push("");
  const causeLines = ["--- CAUSE ---"];
  const errorEntries = window.__debugSession.filter(
    (e2) => e2.level === "error" || e2.level === "warn"
  );
  if (errorEntries.length > 0) {
    const seen = /* @__PURE__ */ new Map();
    errorEntries.forEach((e2) => {
      if (!seen.has(e2.message)) {
        seen.set(e2.message, { count: 0, settings: snap });
      }
      seen.get(e2.message).count += 1;
    });
    seen.forEach((info, msg) => {
      causeLines.push(`ERROR (${info.count}x): ${msg}`);
      causeLines.push(`  settings: ${JSON.stringify(info.settings)}`);
    });
  } else {
    causeLines.push("(no errors or warnings)");
  }
  const fullText = [...header, ...settingsLines, ...logLines, ...causeLines].join("\n");
  const _fallbackDownload = () => {
    const blob = new Blob([fullText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a2 = document.createElement("a");
    a2.href = url;
    a2.download = "www_paint_debug_session.log";
    document.body.appendChild(a2);
    a2.click();
    document.body.removeChild(a2);
    URL.revokeObjectURL(url);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(fullText).then(() => {
      const msgEl = document.getElementById(STATUS_MSG_ID);
      if (msgEl) {
        const prev = msgEl.textContent;
        msgEl.textContent = "COPIED";
        setTimeout(() => {
          msgEl.textContent = prev;
        }, 2e3);
      }
    }).catch(() => {
      _fallbackDownload();
    });
  } else {
    _fallbackDownload();
  }
}
var _DebugOverlay = {
  /** @type {boolean} */
  initialized: false,
  /**
   * Initialize: install hooks and wire double-tap on status bar.
   */
  init() {
    if (this.initialized) return;
    this.initialized = true;
    _installHooks();
    _recordLog("sys", "Debug hooks installed");
    const msgEl = document.getElementById(STATUS_MSG_ID);
    if (msgEl) {
      msgEl.addEventListener("dblclick", (e2) => {
        e2.stopPropagation();
        _DebugOverlay.toggle();
      });
    }
    const footer = document.getElementById(STATUS_FOOTER_ID);
    if (footer && footer !== msgEl?.parentElement) {
      footer.addEventListener("dblclick", (e2) => {
        e2.stopPropagation();
        _DebugOverlay.toggle();
      });
    }
    window.addEventListener("beforeunload", _saveToLogbook);
  },
  /**
   * Open the debug overlay.
   */
  show() {
    _ensureOverlay();
    if (!_overlay) return;
    _overlay.classList.add("debug-overlay--open");
    _overlay.setAttribute("aria-hidden", "false");
    _renderLog();
    _renderSettings();
    _renderLogbook();
  },
  /**
   * Hide the debug overlay.
   */
  hide() {
    if (!_overlay) return;
    _overlay.classList.remove("debug-overlay--open");
    _overlay.setAttribute("aria-hidden", "true");
  },
  /**
   * Toggle the overlay.
   */
  toggle() {
    const isOpen = _overlay && _overlay.classList.contains("debug-overlay--open");
    if (isOpen) {
      _DebugOverlay.hide();
    } else {
      _DebugOverlay.show();
    }
  },
  /**
   * @returns {boolean}
   */
  isOpen() {
    return _overlay && _overlay.classList.contains("debug-overlay--open");
  }
};
window.__DebugOverlay = _DebugOverlay;

// js/ui/settings.js
var SETTINGS_KEY = "www_paint_ui_settings";
var ROOT_EL = document.documentElement;
var DEFAULT_DARK = {
  "--bg": "#000000",
  "--surface": "#0C0C0C",
  "--accent": "#D71921",
  "--primary": "#EDEDED",
  "--secondary": "#8C8C8C",
  "--canvas-bg": "#000000"
};
var DEFAULT_LIGHT = {
  "--bg": "#F5F5F5",
  "--surface": "#FFFFFF",
  "--accent": "#D71921",
  "--primary": "#1A1A1A",
  "--secondary": "#666666",
  "--canvas-bg": "#F5F5F5"
};
var COLOR_KEYS = [
  { key: "--bg", label: "Background" },
  { key: "--surface", label: "Surface" },
  { key: "--accent", label: "Accent" },
  { key: "--primary", label: "Primary Text" },
  { key: "--secondary", label: "Secondary Text" },
  { key: "--canvas-bg", label: "Canvas Background" }
];
var _settings = {
  dark: { ...DEFAULT_DARK },
  light: { ...DEFAULT_LIGHT },
  activeMode: "dark"
};
var _overlay2 = null;
var _onSettingsKeyDown = null;
function _loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      _settings = {
        dark: { ...DEFAULT_DARK, ...parsed.dark || {} },
        light: { ...DEFAULT_LIGHT, ...parsed.light || {} },
        activeMode: parsed.activeMode || "dark"
      };
    }
  } catch (e2) {
    _settings = {
      dark: { ...DEFAULT_DARK },
      light: { ...DEFAULT_LIGHT },
      activeMode: "dark"
    };
  }
}
function _saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(_settings));
}
function _applyColorsToCSS(colors) {
  for (const { key } of COLOR_KEYS) {
    const val = colors[key];
    if (val) {
      ROOT_EL.style.setProperty(key, val);
    }
  }
}
function _applyCurrentMode() {
  _applyColorsToCSS(_settings[_settings.activeMode]);
}
function _ensureOverlay2() {
  if (_overlay2) return _overlay2;
  const root = document.getElementById("settings-root");
  if (!root) return null;
  _overlay2 = document.createElement("div");
  _overlay2.id = "settings-overlay";
  _overlay2.className = "settings-overlay";
  _overlay2.setAttribute("role", "dialog");
  _overlay2.setAttribute("aria-hidden", "true");
  _overlay2.setAttribute("aria-labelledby", "settings-title");
  _overlay2.setAttribute("aria-modal", "true");
  root.appendChild(_overlay2);
  _overlay2.innerHTML = "";
  const content = document.createElement("div");
  content.className = "settings-content";
  const header = document.createElement("div");
  header.className = "settings-header";
  header.innerHTML = `
    <h2 class="modal__title" id="settings-title">UI SETTINGS</h2>
    <button type="button" class="btn btn--icon btn--sm btn--ghost" id="settings-close" aria-label="Close">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;
  const body = document.createElement("div");
  body.className = "settings-body";
  body.innerHTML = `
    <!-- Light/Dark Toggle -->
    <div class="mode-toggle" id="mode-toggle">
      <div class="mode-toggle__track">
        <div class="mode-toggle__fill" id="mode-toggle-fill"></div>
        <button type="button" class="mode-toggle__btn" data-mode="dark">DARK</button>
        <button type="button" class="mode-toggle__btn" data-mode="light">LIGHT</button>
      </div>
      <div class="mode-indicator" id="mode-indicator">Editing: Dark Mode</div>
    </div>

    <!-- Color Pickers -->
    <div class="color-pickers" id="color-pickers">
      ${_renderColorRows()}
    </div>
  `;
  const footer = document.createElement("div");
  footer.className = "settings-footer";
  footer.innerHTML = `
    <button type="button" class="btn btn--ghost btn--sm" id="settings-restore">RESTORE DEFAULT</button>
    <button type="button" class="btn btn--primary btn--sm" id="settings-save">SAVE & EXIT</button>
  `;
  content.appendChild(header);
  content.appendChild(body);
  content.appendChild(footer);
  _overlay2.appendChild(content);
  const closeBtn = _overlay2.querySelector("#settings-close");
  closeBtn?.addEventListener("click", () => _UISettings.hide());
  _overlay2.addEventListener("click", (e2) => {
    if (e2.target === _overlay2) _UISettings.hide();
  });
  _onSettingsKeyDown = (e2) => {
    if (e2.key === "Escape") _UISettings.hide();
  };
  document.addEventListener("keydown", _onSettingsKeyDown);
  const toggleBtns = _overlay2.querySelectorAll(".mode-toggle__btn");
  toggleBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      _settings.activeMode = btn.dataset.mode;
      _updateModeToggle();
      _renderColorRows();
    });
  });
  const restoreBtn = _overlay2.querySelector("#settings-restore");
  restoreBtn?.addEventListener("click", () => {
    _restoreDefault();
    _renderColorRows();
  });
  const saveBtn = _overlay2.querySelector("#settings-save");
  saveBtn?.addEventListener("click", () => {
    _saveSettings();
    _applyCurrentMode();
    _UISettings.hide();
  });
  _overlay2.addEventListener("input", (e2) => {
    const input = e2.target;
    if (input.classList.contains("color-row__input")) {
      const key = input.dataset.colorKey;
      const hexDisplay = input.closest(".color-row").querySelector(".color-row__hex");
      if (key && hexDisplay) {
        _settings[_settings.activeMode][key] = input.value;
        hexDisplay.textContent = input.value;
        _applyCurrentMode();
      }
    }
  });
  return _overlay2;
}
function _renderColorRows() {
  const modeColors = _settings[_settings.activeMode];
  return COLOR_KEYS.map(({ key, label }) => {
    const val = modeColors[key] || "#000000";
    return `
      <div class="color-row">
        <label class="color-row__label" for="color-${key}">${label}</label>
        <input type="color" class="color-row__input" id="color-${key}" data-color-key="${key}" value="${val}" />
        <span class="color-row__hex" id="color-${key}-hex">${val}</span>
      </div>
    `;
  }).join("");
}
function _updateModeToggle() {
  const toggle = _overlay2?.querySelector("#mode-toggle");
  const indicator = _overlay2?.querySelector("#mode-indicator");
  if (!toggle || !indicator) return;
  const mode = _settings.activeMode;
  const buttons = toggle.querySelectorAll(".mode-toggle__btn");
  buttons.forEach((btn) => {
    const isActive = btn.dataset.mode === mode;
    btn.classList.toggle("mode-toggle__btn--active", isActive);
  });
  const fill = toggle.querySelector(".mode-toggle__fill");
  if (fill) {
    const activeBtn = toggle.querySelector(".mode-toggle__btn--active");
    if (activeBtn) {
      const index = Array.from(buttons).indexOf(activeBtn);
      fill.style.transform = `translateX(${index * 100}%)`;
    }
  }
  indicator.textContent = mode === "dark" ? "Editing: Dark Mode" : "Editing: Light Mode";
}
function _restoreDefault() {
  if (_settings.activeMode === "dark") {
    _settings.dark = { ...DEFAULT_DARK };
  } else {
    _settings.light = { ...DEFAULT_LIGHT };
  }
}
var _UISettings = {
  /** @type {boolean} */
  initialized: false,
  /**
   * Initialize: load stored settings and apply them to :root.
   */
  init() {
    if (this.initialized) return;
    this.initialized = true;
    _loadSettings();
    _applyCurrentMode();
    const settingsBtn = document.getElementById("btn-ui-settings");
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => _UISettings.show());
    }
  },
  /**
   * Show the settings modal.
   */
  show() {
    _ensureOverlay2();
    if (!_overlay2) return;
    _updateModeToggle();
    _renderColorRows();
    _overlay2.classList.add("settings-overlay--open");
    _overlay2.setAttribute("aria-hidden", "false");
  },
  /**
   * Hide the settings modal.
   */
  hide() {
    if (!_overlay2) return;
    _overlay2.classList.remove("settings-overlay--open");
    _overlay2.setAttribute("aria-hidden", "true");
  },
  /**
   * @returns {boolean}
   */
  isOpen() {
    return _overlay2 && _overlay2.classList.contains("settings-overlay--open");
  },
  /**
   * Get current settings object (for external inspection).
   * @returns {object}
   */
  getSettings() {
    return { ..._settings };
  }
};
window.__UISettings = _UISettings;

// js/utils/rng.js
function createRNG(seed) {
  let state = seed >>> 0;
  return function next() {
    state = state + 1831565813 >>> 0;
    let t2 = state;
    t2 = Math.imul(t2 ^ t2 >>> 15, t2 | 1);
    t2 = t2 + Math.imul(t2 ^ t2 >>> 7, t2 | 61) ^ t2;
    return ((t2 ^ t2 >>> 14) >>> 0) / 4294967296;
  };
}
function rng(seed) {
  const next = createRNG(seed);
  return {
    /** @returns {number} Float in [0, 1). */
    next() {
      return next();
    },
    /**
     * Float in [min, max).
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    float(min, max) {
      if (max === void 0) {
        max = min;
        min = 0;
      }
      return next() * (max - min) + min;
    },
    /**
     * Integer in [min, max] (inclusive).
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    int(min, max) {
      if (max === void 0) {
        max = min - 1;
        min = 0;
      }
      return Math.floor(next() * (max + 1 - min)) + min;
    },
    /**
     * Alias for float; returns value in [min, max).
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    range(min, max) {
      return this.float(min, max);
    },
    /**
     * Pick a random element from an array (does not mutate).
     * @param {Array} arr
     * @returns {*}
     */
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    /**
     * Boolean with optional probability (default 0.5).
     * @param {number} [p=0.5]
     * @returns {boolean}
     */
    bool(p2 = 0.5) {
      return next() < p2;
    }
  };
}
var globalRNG = rng(322420463);

// js/engine/analyzer.js
var SOBEL_X = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
var SOBEL_Y = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
function analyzeImage(pixels, width, height, options = {}) {
  const {
    edgeThreshold = 0.15,
    paletteSize = 16,
    seed = 12345
  } = options;
  const n2 = width * height;
  const luminance = new Uint8ClampedArray(n2);
  const edgesX = new Float32Array(n2);
  const edgesY = new Float32Array(n2);
  const edges = new Float32Array(n2);
  const regionMap = new Int32Array(n2);
  const rgbSamples = new Array(n2);
  for (let i2 = 0; i2 < n2; i2++) {
    const idx = i2 * 4;
    const r2 = pixels[idx];
    const g2 = pixels[idx + 1];
    const b2 = pixels[idx + 2];
    const l2 = 0.2126 * r2 + 0.7152 * g2 + 0.0722 * b2;
    luminance[i2] = Math.round(l2);
    rgbSamples[i2] = [r2, g2, b2];
  }
  let maxEdge = 0;
  for (let y2 = 0; y2 < height; y2++) {
    for (let x2 = 0; x2 < width; x2++) {
      const idx = y2 * width + x2;
      const gx = sobelPixel(luminance, width, height, x2, y2, SOBEL_X);
      const gy = sobelPixel(luminance, width, height, x2, y2, SOBEL_Y);
      edgesX[idx] = gx;
      edgesY[idx] = gy;
      const mag = Math.sqrt(gx * gx + gy * gy);
      edges[idx] = mag;
      if (mag > maxEdge) maxEdge = mag;
    }
  }
  if (maxEdge > 0) {
    for (let i2 = 0; i2 < n2; i2++) {
      edges[i2] /= maxEdge;
    }
  }
  for (let i2 = 0; i2 < n2; i2++) {
    regionMap[i2] = Math.floor(luminance[i2] / 32);
  }
  const palette = extractPalette(rgbSamples, paletteSize, seed);
  return {
    luminance,
    edges,
    edgeX: edgesX,
    edgeY: edgesY,
    pixels: new Uint8ClampedArray(pixels),
    // copy
    width,
    height,
    palette,
    regionMap: Array.from(regionMap)
  };
}
function sobelPixel(lum, w2, h2, x2, y2, kernel) {
  let sum = 0;
  let ki = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const px = Math.max(0, Math.min(w2 - 1, x2 + dx));
      const py = Math.max(0, Math.min(h2 - 1, y2 + dy));
      sum += lum[py * w2 + px] * kernel[ki++];
    }
  }
  return sum;
}
function extractPalette(samples, k2, seed = 12345) {
  if (samples.length === 0) return [[0, 0, 0]];
  const rnd = createRNG(seed >>> 0);
  const step = Math.max(1, Math.floor(samples.length / 5e3));
  const data = [];
  for (let i2 = 0; i2 < samples.length; i2 += step) {
    const s2 = samples[i2];
    data.push(s2[0], s2[1], s2[2]);
  }
  const clusters = k2;
  const centroids = new Array(clusters);
  const used = /* @__PURE__ */ new Set();
  for (let c2 = 0; c2 < clusters; c2++) {
    let idx;
    do {
      idx = Math.floor(rnd() * (data.length / 3)) * 3;
    } while (used.has(idx));
    used.add(idx);
    centroids[c2] = [data[idx], data[idx + 1], data[idx + 2]];
  }
  for (let iter = 0; iter < 10; iter++) {
    const sums = new Array(clusters).fill(0).map(() => [0, 0, 0, 0]);
    for (let i2 = 0; i2 < data.length; i2 += 3) {
      const r2 = data[i2], g2 = data[i2 + 1], b2 = data[i2 + 2];
      let best = 0, bestDist = Infinity;
      for (let c2 = 0; c2 < clusters; c2++) {
        const d2 = Math.hypot(r2 - centroids[c2][0], g2 - centroids[c2][1], b2 - centroids[c2][2]);
        if (d2 < bestDist) {
          bestDist = d2;
          best = c2;
        }
      }
      sums[best][0] += r2;
      sums[best][1] += g2;
      sums[best][2] += b2;
      sums[best][3]++;
    }
    for (let c2 = 0; c2 < clusters; c2++) {
      if (sums[c2][3] > 0) {
        centroids[c2] = [sums[c2][0] / sums[c2][3], sums[c2][1] / sums[c2][3], sums[c2][2] / sums[c2][3]];
      }
    }
  }
  return centroids.map((c2) => [Math.round(c2[0]), Math.round(c2[1]), Math.round(c2[2])]);
}

// js/engine/shapes.js
function pathLength(s2) {
  const p2 = s2.params;
  switch (s2.type) {
    case "E":
    case "B": {
      const a2 = p2[2] || 0;
      const b2 = p2[3] || 0;
      const h2 = Math.pow(a2 - b2, 2) / Math.pow(a2 + b2, 2);
      return Math.PI * (a2 + b2) * (1 + 3 * h2 / (10 + Math.sqrt(4 - 3 * h2)));
    }
    case "T":
      const l1 = Math.hypot(p2[2] - p2[0], p2[3] - p2[1]);
      const l2 = Math.hypot(p2[4] - p2[2], p2[5] - p2[3]);
      const l3 = Math.hypot(p2[0] - p2[4], p2[1] - p2[5]);
      return l1 + l2 + l3;
    case "R":
      return 2 * (Math.abs(p2[2]) + Math.abs(p2[3]));
    case "S":
      const seg1 = Math.hypot(p2[2] - p2[0], p2[3] - p2[1]);
      const seg2 = Math.hypot(p2[4] - p2[2], p2[5] - p2[3]);
      return seg1 + seg2;
    default:
      return 0;
  }
}
function pointAt(s2, t2) {
  const p2 = s2.params;
  switch (s2.type) {
    case "E":
    case "B": {
      const angle = t2 * Math.PI * 2 + (p2[4] || 0);
      return [
        p2[0] + (p2[2] || 0) * Math.cos(angle),
        p2[1] + (p2[3] || 0) * Math.sin(angle)
      ];
    }
    case "T":
    case "R":
      const perim = pathLength(s2);
      const target = t2 * perim;
      if (s2.type === "T") {
        const l1 = Math.hypot(p2[2] - p2[0], p2[3] - p2[1]);
        if (target < l1) {
          const f3 = target / l1;
          return [p2[0] + f3 * (p2[2] - p2[0]), p2[1] + f3 * (p2[3] - p2[1])];
        }
        const l2 = Math.hypot(p2[4] - p2[2], p2[5] - p2[3]);
        const rest = target - l1;
        if (rest < l2) {
          const f3 = rest / l2;
          return [p2[2] + f3 * (p2[4] - p2[2]), p2[3] + f3 * (p2[5] - p2[3])];
        }
        const l3 = Math.hypot(p2[0] - p2[4], p2[1] - p2[5]);
        const rest2 = rest - l2;
        const f2 = Math.min(1, rest2 / l3);
        return [p2[4] + f2 * (p2[0] - p2[4]), p2[5] + f2 * (p2[1] - p2[5])];
      } else {
        const w2 = Math.abs(p2[2]);
        const h2 = Math.abs(p2[3]);
        let pos = t2 * (2 * w2 + 2 * h2);
        if (pos < w2) return [p2[0] - w2 / 2 + pos, p2[1] - h2 / 2];
        pos -= w2;
        if (pos < h2) return [p2[0] + w2 / 2, p2[1] - h2 / 2 + pos];
        pos -= h2;
        if (pos < w2) return [p2[0] + w2 / 2 - pos, p2[1] + h2 / 2];
        pos -= w2;
        return [p2[0] - w2 / 2, p2[1] + h2 / 2 - pos];
      }
    case "S":
      const mt2 = 1 - t2;
      return [
        mt2 * mt2 * p2[0] + 2 * mt2 * t2 * p2[2] + t2 * t2 * p2[4],
        mt2 * mt2 * p2[1] + 2 * mt2 * t2 * p2[3] + t2 * t2 * p2[5]
      ];
    default:
      return [0, 0];
  }
}
function shapeAxis(s2) {
  const p2 = s2.p;
  const g2 = s2.t === "T" ? p2[6] : s2.t === "S" ? p2[7] : p2[5];
  const dx = Math.cos(g2), dy = Math.sin(g2);
  if (s2.t === "E") {
    const d2 = p2[0] * dx + p2[1] * dy;
    const h2 = Math.hypot(p2[2] * Math.cos(g2 - p2[4]), p2[3] * Math.sin(g2 - p2[4]));
    return [dx, dy, d2 - h2, d2 + h2];
  }
  const pts = s2.t === "T" ? p2.slice(0, 6) : s2.t === "R" ? corners(p2) : p2.slice(0, 6);
  const pad = s2.t === "S" ? p2[6] / 2 : 0;
  let m2 = 1e9, n2 = -1e9;
  for (let i2 = 0; i2 < pts.length; i2 += 2) {
    const d2 = pts[i2] * dx + pts[i2 + 1] * dy;
    if (d2 < m2) m2 = d2;
    if (d2 > n2) n2 = d2;
  }
  return [dx, dy, m2 - pad, n2 + pad];
}
function packShape(s2, styleList) {
  const styleIdx = styleList.indexOf(s2.style);
  return [
    s2.type.charCodeAt(0),
    ...s2.params,
    ...s2.color0,
    ...s2.color1,
    Math.round(s2.alpha * 255),
    styleIdx,
    s2.layer,
    s2.order,
    s2.seed
  ];
}
function drawShape(ctx, s2, progress = 1) {
  const p2 = s2.params;
  const a2 = Math.max(0, Math.min(1, progress)) * (s2.alpha !== void 0 ? s2.alpha : 1);
  ctx.save();
  ctx.globalAlpha = a2;
  const gradAngle = s2.type === "S" && p2[7] !== void 0 ? p2[7] : 0;
  const [sx, sy] = pointAt(s2, 0);
  const [ex, ey] = pointAt(s2, 1);
  const cosA = Math.cos(gradAngle);
  const sinA = Math.sin(gradAngle);
  const halfLen = Math.hypot(ex - sx, ey - sy) * 0.5 + 1;
  const mx = (sx + ex) / 2;
  const my = (sy + ey) / 2;
  const gx0 = mx - cosA * halfLen;
  const gy0 = my - sinA * halfLen;
  const gx1 = mx + cosA * halfLen;
  const gy1 = my + sinA * halfLen;
  const grad = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
  grad.addColorStop(0, `rgb(${Math.round(s2.color0[0])},${Math.round(s2.color0[1])},${Math.round(s2.color0[2])})`);
  grad.addColorStop(1, `rgb(${Math.round(s2.color1[0])},${Math.round(s2.color1[1])},${Math.round(s2.color1[2])})`);
  ctx.fillStyle = grad;
  ctx.strokeStyle = grad;
  switch (s2.type) {
    case "E":
      ctx.beginPath();
      ctx.ellipse(p2[0], p2[1], p2[2], p2[3], p2[4] || 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "B": {
      const feather = 0.3;
      const r2 = Math.max(p2[2] || 1, p2[3] || 1);
      const blobGrad = ctx.createRadialGradient(
        p2[0],
        p2[1],
        r2 * (1 - feather),
        p2[0],
        p2[1],
        r2
      );
      blobGrad.addColorStop(0, `rgb(${Math.round(s2.color0[0])},${Math.round(s2.color0[1])},${Math.round(s2.color0[2])})`);
      blobGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save();
      ctx.fillStyle = blobGrad;
      ctx.beginPath();
      ctx.ellipse(p2[0], p2[1], p2[2], p2[3], p2[4] || 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case "T":
      ctx.beginPath();
      ctx.moveTo(p2[0], p2[1]);
      ctx.lineTo(p2[2], p2[3]);
      ctx.lineTo(p2[4], p2[5]);
      ctx.closePath();
      ctx.fill();
      break;
    case "R": {
      ctx.save();
      ctx.translate(p2[0], p2[1]);
      ctx.rotate(p2[4] || 0);
      ctx.fillRect(-p2[2] / 2, -p2[3] / 2, p2[2], p2[3]);
      ctx.restore();
      break;
    }
    case "S": {
      const w2 = p2[6] || 1;
      ctx.lineWidth = w2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(p2[0], p2[1]);
      ctx.quadraticCurveTo(p2[2], p2[3], p2[4], p2[5]);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}
function shapeToSVG(s2) {
  const p2 = s2.params;
  const c0 = `rgb(${Math.round(s2.color0[0])},${Math.round(s2.color0[1])},${Math.round(s2.color0[2])})`;
  const c1 = `rgb(${Math.round(s2.color1[0])},${Math.round(s2.color1[1])},${Math.round(s2.color1[2])})`;
  const gid = `grad_${s2.id}`;
  const gradAngle = p2[7] !== void 0 ? p2[7] : 0;
  let gradDef = "";
  if (c0 !== c1) {
    const cosA = Math.cos(gradAngle);
    const sinA = Math.sin(gradAngle);
    const [sx, sy] = pointAt(s2, 0);
    const [ex, ey] = pointAt(s2, 1);
    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;
    const len = Math.hypot(ex - sx, ey - sy) + 1;
    gradDef = `<linearGradient id="${gid}" x1="${mx - cosA * len / 2}" y1="${my - sinA * len / 2}" x2="${mx + cosA * len / 2}" y2="${my + sinA * len / 2}"><stop offset="0%" stop-color="${c0}"/><stop offset="100%" stop-color="${c1}"/></linearGradient>`;
  }
  let shapeEl = "";
  switch (s2.type) {
    case "E":
      shapeEl = `<ellipse cx="${p2[0]}" cy="${p2[1]}" rx="${p2[2]}" ry="${p2[3]}" transform="rotate(${(p2[4] || 0) * 180 / Math.PI} ${p2[0]} ${p2[1]})" fill="${c0 === c1 ? c0 : `url(#${gid})`}"/>`;
      break;
    case "T":
      shapeEl = `<polygon points="${p2[0]},${p2[1]} ${p2[2]},${p2[3]} ${p2[4]},${p2[5]}" fill="${c0 === c1 ? c0 : `url(#${gid})`}"/>`;
      break;
    case "R":
      shapeEl = `<rect x="${p2[0] - p2[2] / 2}" y="${p2[1] - p2[3] / 2}" width="${p2[2]}" height="${p2[3]}" transform="rotate(${(p2[4] || 0) * 180 / Math.PI} ${p2[0]} ${p2[1]})" fill="${c0 === c1 ? c0 : `url(#${gid})`}"/>`;
      break;
    case "S":
      shapeEl = `<path d="M${p2[0]},${p2[1]} Q${p2[2]},${p2[3]} ${p2[4]},${p2[5]}" stroke="${c0 === c1 ? c0 : `url(#${gid})`}" stroke-width="${p2[6]}" stroke-linecap="round" fill="none"/>`;
      break;
    case "B":
      shapeEl = `<ellipse cx="${p2[0]}" cy="${p2[1]}" rx="${p2[2]}" ry="${p2[3]}" fill="${c0 === c1 ? c0 : `url(#${gid})`}"/>`;
      break;
  }
  return gradDef + shapeEl;
}
function getRuntimeSource() {
  return `var RUNTIME={};RUNTIME.draw=function(c,q){var x=c.createContext(),p=q.p,x0=p[0],y0=p[1],x1=p[2],y1=p[3],x2=p[4],y2=p[5],w=p[6]||1,gA=p[7]||0;var g=c.createLinearGradient(x0,y0,x1,y1),c0='rgb('+Math.round(q.c0[0])+','+Math.round(q.c0[1])+','+Math.round(q.c0[2])+')',c1='rgb('+Math.round(q.c1[0])+','+Math.round(q.c1[1])+','+Math.round(q.c1[2])+')';g.addColorStop(0,c0);g.addColorStop(1,c1);x.fillStyle=g;x.strokeStyle=g;x.globalAlpha=q.a||1;switch(q.t){case'E':x.beginPath();x.ellipse(x0,y0,p[2],p[3],p[4]||0,0,6.28318);x.fill();break;case'T':x.beginPath();x.moveTo(x0,y0);x.lineTo(x1,y1);x.lineTo(x2,y2);x.closePath();x.fill();break;case'R':x.save();x.translate(x0,y0);x.rotate(p[4]||0);x.fillRect(-p[2]/2,-p[3]/2,p[2],p[3]);x.restore();break;case'S':x.lineWidth=w;x.lineCap='round';x.beginPath();x.moveTo(x0,y0);x.quadraticCurveTo(x1,y1,x2,y2);x.stroke();break;case'B':var f=0.3;x.save();var r=Math.max(p[2],p[3]),rg=x.createRadialGradient(x0,y0,r*(1-f),x0,y0,r);rg.addColorStop(0,c0);rg.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=rg;x.beginPath();x.ellipse(x0,y0,p[2],p[3],p[4]||0,0,6.28318);x.fill();x.restore();break;}};`;
}
function corners(p2) {
  const [x2, y2, w2, h2, r2] = p2, c2 = Math.cos(r2), n2 = Math.sin(r2), o2 = [];
  for (const [u2, v2] of [[-w2 / 2, -h2 / 2], [w2 / 2, -h2 / 2], [w2 / 2, h2 / 2], [-w2 / 2, h2 / 2]]) o2.push(x2 + u2 * c2 - v2 * n2, y2 + u2 * n2 + v2 * c2);
  return o2;
}
function poly(s2) {
  const p2 = s2.p, out = [];
  if (s2.t === "E" || s2.t === "B") {
    const [x2, y2, rx, ry, r2] = p2, c2 = Math.cos(r2), n2 = Math.sin(r2), m2 = Math.max(12, Math.min(40, Math.round((rx + ry) * 0.7)));
    for (let i2 = 0; i2 < m2; i2++) {
      const a2 = i2 / m2 * Math.PI * 2, u2 = Math.cos(a2) * rx, v2 = Math.sin(a2) * ry;
      out.push(x2 + u2 * c2 - v2 * n2, y2 + u2 * n2 + v2 * c2);
    }
  } else if (s2.t === "T") out.push(...p2.slice(0, 6));
  else if (s2.t === "R") out.push(...corners(p2));
  else if (s2.t === "S") {
    const [x0, y0, x1, y1, x2, y2, w2] = p2, hw = w2 / 2, N2 = 10, L2 = [], R2 = [];
    const pt2 = (t2) => {
      const u2 = 1 - t2;
      return [u2 * u2 * x0 + 2 * u2 * t2 * x1 + t2 * t2 * x2, u2 * u2 * y0 + 2 * u2 * t2 * y1 + t2 * t2 * y2];
    };
    const tan = (t2) => {
      const dx = 2 * (1 - t2) * (x1 - x0) + 2 * t2 * (x2 - x1), dy = 2 * (1 - t2) * (y1 - y0) + 2 * t2 * (y2 - y1), d2 = Math.hypot(dx, dy) || 1;
      return [dx / d2, dy / d2];
    };
    for (let i2 = 0; i2 <= N2; i2++) {
      const t2 = i2 / N2, [px, py] = pt2(t2), [tx, ty] = tan(t2);
      L2.push([px - ty * hw, py + tx * hw]);
      R2.push([px + ty * hw, py - tx * hw]);
    }
    const cap = (cx, cy, base) => {
      const o2 = [];
      for (let i2 = 1; i2 < 6; i2++) {
        const a2 = base - i2 / 6 * Math.PI;
        o2.push([cx + Math.cos(a2) * hw, cy + Math.sin(a2) * hw]);
      }
      return o2;
    };
    const [ex, ey] = pt2(1), [sx, sy] = pt2(0), [ex_, ey_] = tan(1), [sx_, sy_] = tan(0);
    for (const q2 of L2) out.push(...q2);
    for (const q2 of cap(ex, ey, Math.atan2(ex_, -ey_))) out.push(...q2);
    for (let i2 = R2.length - 1; i2 >= 0; i2--) out.push(...R2[i2]);
    for (const q2 of cap(sx, sy, Math.atan2(-sx_, sy_))) out.push(...q2);
  }
  return out;
}

// js/engine/painter.js
var cl255 = (v2) => v2 < 0 ? 0 : v2 > 255 ? 255 : v2;
var lerp = (a2, b2, t2) => a2 + (b2 - a2) * t2;
var Painter = class _Painter {
  constructor({ width, height, imageData, options = {} }) {
    this.W = width;
    this.H = height;
    this.options = options;
    this._shapes = [];
    this._running = false;
    this._stopped = false;
    this.style = options.style || "painterly";
    this.smart = options.smart !== false;
    this.abstract = options.abstract || false;
    this.palette = options.palette || null;
    this.sizeK = options.size || 1;
    this.sizeRand = options.sizeRand || false;
    this.order = options.order || null;
    this.outline = options.outline || "off";
    this.rfill = options.rfill || "off";
    this.pen = options.pen || false;
    this.maxShapes = options.maxShapes || 3e3;
    this.seed = options.seed || 12345;
    this.onShape = options.onShape || null;
    this.layerMode = options.layerMode || false;
    this.onProgress = options.onProgress || null;
    this.onDone = options.onDone || null;
    this.count = 0;
    this.gen = 0;
    this.sim = 0;
    this.stuck = 0;
    this.passFails = 0;
    this.HURRY = 1;
    this.UNTIL = null;
    this.ACC = false;
    this.PEN = !!this.pen;
    this.PENS = [];
    this.PEN_ID = 0;
    this.penTurn = 0;
    this.penPos = null;
    this.stepProg = 0;
    this.stepStyle = this.style;
    this.stepBg = null;
    this.styles = [this.style];
    this.bgStyles = [];
    this.LINES = true;
    this.SSZ = {};
    this.SMALL = _Painter.SMALL;
    this.FLAT = _Painter.FLAT;
    this.KIND = _Painter.KIND;
    this.RELIEF_ST = _Painter.RELIEF_ST;
    this.SHAPE_ID = _Painter.SHAPE_ID;
    this.NO_STROKE = _Painter.NO_STROKE;
    this.MIX = _Painter.MIX;
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
    this._seed = this.seed;
    this._initImage(imageData);
    if (this.smart) {
      this.cumE = new Float64Array(this.W * this.H);
    }
    if (this.smart) {
      this.analyse();
    }
    if (this.order) {
      this.orderSetup(this.order, 0);
    }
    if (this.OUTL !== "off") {
      this.OL = this.edgeChains().slice(0, Math.max(20, Math.round(this.maxShapes * 0.35)));
      if (this.OUTL === "last") this.maxShapes = Math.max(this.count + 10, this.maxShapes - this.OL.length);
      if (this.OUTL === "first") this.burnOutlines(this.OL);
    }
    this.rebuildCum();
  }
  _initImage(imageData) {
    const n2 = this.W * this.H;
    this.T = new Float32Array(n2 * 3);
    this.C = new Float32Array(n2 * 3);
    this.errMap = new Float32Array(n2);
    this.cum = new Float64Array(n2);
    this.tBuf = new Float32Array(n2 + 16);
    this.aBuf = new Float32Array(n2 + 16);
    this.spans = new Int32Array(3 * (this.H + 8) * 32);
    this.xs = new Float32Array(256);
    let br2 = 0, bg = 0, bb = 0;
    for (let i2 = 0; i2 < n2; i2++) {
      const o2 = i2 * 3, q2 = i2 * 4;
      this.T[o2] = imageData[q2];
      this.T[o2 + 1] = imageData[q2 + 1];
      this.T[o2 + 2] = imageData[q2 + 2];
      br2 += this.T[o2];
      bg += this.T[o2 + 1];
      bb += this.T[o2 + 2];
    }
    let bgc = [br2 / n2, bg / n2, bb / n2];
    if (this.PAL) {
      bgc = this.PAL.reduce((b2, p2) => {
        const d2 = (p2[0] - bgc[0]) ** 2 + (p2[1] - bgc[1]) ** 2 + (p2[2] - bgc[2]) ** 2;
        return d2 < b2[0] ? [d2, p2] : b2;
      }, [Infinity, this.PAL[0]])[1].slice();
    }
    for (let i2 = 0; i2 < n2; i2++) {
      const o2 = i2 * 3;
      this.C[o2] = bgc[0];
      this.C[o2 + 1] = bgc[1];
      this.C[o2 + 2] = bgc[2];
      this.errMap[i2] = Math.abs(this.C[o2] - this.T[o2]) + Math.abs(this.C[o2 + 1] - this.T[o2 + 1]) + Math.abs(this.C[o2 + 2] - this.T[o2 + 2]);
    }
  }
  // ── RNG ───────────────────────────────────────────────────────────────────
  rnd() {
    this._seed ^= this._seed << 13;
    this._seed >>>= 0;
    this._seed ^= this._seed >>> 17;
    this._seed ^= this._seed << 5;
    this._seed >>>= 0;
    return this._seed / 4294967296;
  }
  gauss() {
    let u2 = 0, v2 = 0;
    while (!u2) u2 = this.rnd();
    while (!v2) v2 = this.rnd();
    return Math.sqrt(-2 * Math.log(u2)) * Math.cos(6.2832 * v2);
  }
  // ── Image analysis (smart mode) ───────────────────────────────────────────
  boxBlur(src, r2) {
    const W2 = this.W, H2 = this.H;
    const out = new Float32Array(W2 * H2), tmp = new Float32Array(W2 * H2);
    for (let y2 = 0; y2 < H2; y2++) {
      let s2 = 0;
      const row = y2 * W2;
      for (let x2 = -r2; x2 <= r2; x2++) s2 += src[row + Math.min(W2 - 1, Math.max(0, x2))];
      for (let x2 = 0; x2 < W2; x2++) {
        tmp[row + x2] = s2 / (2 * r2 + 1);
        s2 += src[row + Math.min(W2 - 1, x2 + r2 + 1)] - src[row + Math.max(0, x2 - r2)];
      }
    }
    for (let x2 = 0; x2 < W2; x2++) {
      let s2 = 0;
      for (let y2 = -r2; y2 <= r2; y2++) s2 += tmp[Math.min(H2 - 1, Math.max(0, y2)) * W2 + x2];
      for (let y2 = 0; y2 < H2; y2++) {
        out[y2 * W2 + x2] = s2 / (2 * r2 + 1);
        s2 += tmp[Math.min(H2 - 1, y2 + r2 + 1) * W2 + x2] - tmp[Math.max(0, y2 - r2) * W2 + x2];
      }
    }
    return out;
  }
  blur2(a2, r2) {
    return this.boxBlur(this.boxBlur(a2, r2), r2);
  }
  pctl(a2, q2) {
    const s2 = Float32Array.from(a2).sort();
    return s2[Math.min(s2.length - 1, Math.floor(q2 * s2.length))] || 1e-6;
  }
  analyse() {
    const W2 = this.W, H2 = this.H, n2 = W2 * H2;
    const L2 = new Float32Array(n2), Y2 = new Float32Array(n2), Cb = new Float32Array(n2), Cr2 = new Float32Array(n2);
    for (let i2 = 0; i2 < n2; i2++) {
      const r3 = this.T[i2 * 3], g2 = this.T[i2 * 3 + 1], b3 = this.T[i2 * 3 + 2];
      Y2[i2] = 0.299 * r3 + 0.587 * g2 + 0.114 * b3;
      L2[i2] = Y2[i2] / 255;
      Cb[i2] = 128 - 0.168736 * r3 - 0.331264 * g2 + 0.5 * b3;
      Cr2[i2] = 128 + 0.5 * r3 - 0.418688 * g2 - 0.081312 * b3;
    }
    const jxx = new Float32Array(n2), jxy = new Float32Array(n2), jyy = new Float32Array(n2);
    const at2 = (x2, y2) => L2[Math.min(H2 - 1, Math.max(0, y2)) * W2 + Math.min(W2 - 1, Math.max(0, x2))];
    for (let y2 = 0; y2 < H2; y2++) for (let x2 = 0; x2 < W2; x2++) {
      const gx = at2(x2 + 1, y2 - 1) + 2 * at2(x2 + 1, y2) + at2(x2 + 1, y2 + 1) - at2(x2 - 1, y2 - 1) - 2 * at2(x2 - 1, y2) - at2(x2 - 1, y2 + 1);
      const gy = at2(x2 - 1, y2 + 1) + 2 * at2(x2, y2 + 1) + at2(x2 + 1, y2 + 1) - at2(x2 - 1, y2 - 1) - 2 * at2(x2, y2 - 1) - at2(x2 + 1, y2 - 1);
      const i2 = y2 * W2 + x2;
      jxx[i2] = gx * gx;
      jxy[i2] = gx * gy;
      jyy[i2] = gy * gy;
    }
    const r2 = Math.max(2, Math.round(Math.max(W2, H2) / 110));
    const a2 = this.blur2(jxx, r2), b2 = this.blur2(jxy, r2), c2 = this.blur2(jyy, r2);
    this.Tan = new Float32Array(n2);
    this.Coh = new Float32Array(n2);
    this.Edge = new Float32Array(n2);
    for (let i2 = 0; i2 < n2; i2++) {
      const d2 = a2[i2] - c2[i2], tr2 = Math.max(0, a2[i2] + c2[i2]);
      this.Tan[i2] = 0.5 * Math.atan2(2 * b2[i2], d2) + Math.PI / 2;
      this.Coh[i2] = tr2 > 1e-6 ? Math.sqrt(d2 * d2 + 4 * b2[i2] * b2[i2]) / tr2 : 0;
      this.Edge[i2] = Math.sqrt(tr2);
    }
    const e98 = this.pctl(this.Edge, 0.98);
    for (let i2 = 0; i2 < n2; i2++) this.Edge[i2] = Math.min(1, this.Edge[i2] / e98);
    const R2 = Math.max(4, Math.round(Math.max(W2, H2) / 30));
    const bY = this.blur2(Y2, R2), bCb = this.blur2(Cb, R2), bCr = this.blur2(Cr2, R2);
    const con = new Float32Array(n2), skin = new Float32Array(n2);
    for (let i2 = 0; i2 < n2; i2++) {
      con[i2] = Math.abs(Y2[i2] - bY[i2]) + 0.6 * (Math.abs(Cb[i2] - bCb[i2]) + Math.abs(Cr2[i2] - bCr[i2]));
      skin[i2] = Y2[i2] > 45 ? Math.exp(-(((Cb[i2] - 102) / 16) ** 2) - ((Cr2[i2] - 153) / 14) ** 2) : 0;
    }
    const conB = this.blur2(con, 3), skinB = this.blur2(skin, 3), edgeB = this.blur2(this.Edge, 3);
    const c98 = this.pctl(conB, 0.98);
    this.Wt = new Float32Array(n2);
    this.Sal = new Float32Array(n2);
    let sum = 0;
    for (let y2 = 0; y2 < H2; y2++) for (let x2 = 0; x2 < W2; x2++) {
      const i2 = y2 * W2 + x2, dx = (x2 / W2 - 0.5) * 2, dy = (y2 / H2 - 0.5) * 2;
      const sal = Math.min(1, 0.45 * Math.min(1, conB[i2] / c98) + 0.35 * edgeB[i2] + 0.6 * skinB[i2]) * (1 - 0.2 * (dx * dx + dy * dy));
      this.Wt[i2] = Number.isFinite(sal) ? 0.45 + 1.8 * sal : 1;
      sum += this.Wt[i2];
      this.Sal[i2] = Number.isFinite(sal) ? sal : 0;
    }
    if (sum > 0) for (let i2 = 0; i2 < n2; i2++) this.Wt[i2] *= n2 / sum;
    this.subject();
  }
  subject() {
    const W2 = this.W, H2 = this.H, n2 = W2 * H2;
    const m2 = Math.max(2, Math.round(Math.min(W2, H2) * 0.04)), bs = [];
    for (let y2 = 0; y2 < H2; y2 += 2) for (let x2 = 0; x2 < W2; x2 += 2) if (x2 < m2 || y2 < m2 || x2 >= W2 - m2 || y2 >= H2 - m2) {
      const o2 = (y2 * W2 + x2) * 3;
      bs.push([this.T[o2], this.T[o2 + 1], this.T[o2 + 2]]);
    }
    const K2 = Math.min(5, bs.length), C2 = [];
    for (let k2 = 0; k2 < K2; k2++) C2.push(bs[Math.floor((k2 + 0.5) / K2 * bs.length)].slice());
    for (let it2 = 0; it2 < 8; it2++) {
      const acc = C2.map(() => [0, 0, 0, 0]);
      for (const b2 of bs) {
        let bk = 0, bd = 1e18;
        for (let k2 = 0; k2 < K2; k2++) {
          const d2 = (b2[0] - C2[k2][0]) ** 2 + (b2[1] - C2[k2][1]) ** 2 + (b2[2] - C2[k2][2]) ** 2;
          if (d2 < bd) {
            bd = d2;
            bk = k2;
          }
        }
        const a2 = acc[bk];
        a2[0] += b2[0];
        a2[1] += b2[1];
        a2[2] += b2[2];
        a2[3]++;
      }
      acc.forEach((a2, k2) => {
        if (a2[3]) C2[k2] = [a2[0] / a2[3], a2[1] / a2[3], a2[2] / a2[3]];
      });
    }
    const sc = new Float32Array(n2), sig = 2 * 32 * 32;
    for (let i2 = 0; i2 < n2; i2++) {
      const o2 = i2 * 3;
      let dm = 1e18;
      for (let k2 = 0; k2 < K2; k2++) {
        const d2 = (this.T[o2] - C2[k2][0]) ** 2 + (this.T[o2 + 1] - C2[k2][1]) ** 2 + (this.T[o2 + 2] - C2[k2][2]) ** 2;
        if (d2 < dm) dm = d2;
      }
      const x2 = i2 % W2, y2 = i2 / W2 | 0, dx = (x2 / W2 - 0.5) * 2, dy = (y2 / H2 - 0.5) * 2;
      sc[i2] = 0.6 * this.Sal[i2] + 0.8 * (1 - Math.exp(-dm / sig)) + 0.3 * (1 - Math.min(1, (dx * dx + dy * dy) / 1.6));
    }
    const sb = this.blur2(sc, Math.max(2, Math.round(Math.max(W2, H2) / 55)));
    let lo = 1e9, hi2 = -1e9;
    for (let i2 = 0; i2 < n2; i2++) {
      if (sb[i2] < lo) lo = sb[i2];
      if (sb[i2] > hi2) hi2 = sb[i2];
    }
    const B2 = 64, hist = new Float64Array(B2), span = Math.max(1e-6, hi2 - lo);
    for (let i2 = 0; i2 < n2; i2++) hist[Math.min(B2 - 1, Math.floor((sb[i2] - lo) / span * B2))]++;
    let tot = 0;
    for (let b2 = 0; b2 < B2; b2++) tot += b2 * hist[b2];
    let w0 = 0, s0 = 0, best = -1, thb = B2 / 2;
    for (let b2 = 0; b2 < B2; b2++) {
      w0 += hist[b2];
      if (!w0 || w0 === n2) continue;
      s0 += b2 * hist[b2];
      const m0 = s0 / w0, m1 = (tot - s0) / (n2 - w0), v2 = w0 * (n2 - w0) * (m0 - m1) ** 2;
      if (v2 > best) {
        best = v2;
        thb = b2 + 1;
      }
    }
    const thr = Math.min(this.pctl(sb, 0.88), Math.max(this.pctl(sb, 0.35), lo + thb / B2 * span)), soft = 0.06 * span;
    this.Sub = new Float32Array(n2);
    for (let i2 = 0; i2 < n2; i2++) {
      const t2 = Math.max(0, Math.min(1, (sb[i2] - thr) / soft + 0.5));
      this.Sub[i2] = t2 * t2 * (3 - 2 * t2);
    }
    const seen = new Uint8Array(n2), q2 = new Int32Array(n2);
    let head = 0, tail = 0;
    const push = (i2) => {
      if (!seen[i2] && this.Sub[i2] < 0.5) {
        seen[i2] = 1;
        q2[tail++] = i2;
      }
    };
    for (let x2 = 0; x2 < W2; x2++) {
      push(x2);
      push((H2 - 1) * W2 + x2);
    }
    for (let y2 = 0; y2 < H2; y2++) {
      push(y2 * W2);
      push(y2 * W2 + W2 - 1);
    }
    while (head < tail) {
      const i2 = q2[head++], x2 = i2 % W2;
      if (x2 > 0) push(i2 - 1);
      if (x2 < W2 - 1) push(i2 + 1);
      if (i2 >= W2) push(i2 - W2);
      if (i2 < n2 - W2) push(i2 + W2);
    }
    for (let i2 = 0; i2 < n2; i2++) if (this.Sub[i2] < 0.5 && !seen[i2]) this.Sub[i2] = 1;
  }
  // ── Flow tracing ──────────────────────────────────────────────────────────
  pix(x2, y2) {
    return Math.min(this.H - 1, Math.max(0, y2 | 0)) * this.W + Math.min(this.W - 1, Math.max(0, x2 | 0));
  }
  trace(x2, y2, sgn, len) {
    const i0 = this.pix(x2, y2);
    let dx = Math.cos(this.Tan[i0]) * sgn, dy = Math.sin(this.Tan[i0]) * sgn, d2 = 0;
    const st2 = Math.max(1, len / 24);
    while (d2 < len) {
      const j2 = this.pix(x2, y2);
      if (this.Coh[j2] > 0.08) {
        let tx = Math.cos(this.Tan[j2]), ty = Math.sin(this.Tan[j2]);
        if (tx * dx + ty * dy < 0) {
          tx = -tx;
          ty = -ty;
        }
        dx = tx;
        dy = ty;
      }
      x2 += dx * st2;
      y2 += dy * st2;
      d2 += st2;
    }
    return [x2, y2];
  }
  // ── Rasterization ─────────────────────────────────────────────────────────
  raster(pts) {
    const W2 = this.W, H2 = this.H;
    const n2 = pts.length >> 1;
    let y0 = 1e9, y1 = -1e9, ns = 0;
    for (let i2 = 1; i2 < pts.length; i2 += 2) {
      if (pts[i2] < y0) y0 = pts[i2];
      if (pts[i2] > y1) y1 = pts[i2];
    }
    y0 = Math.max(0, Math.ceil(y0 - 0.5));
    y1 = Math.min(H2 - 1, Math.floor(y1 - 0.5));
    for (let y2 = y0; y2 <= y1; y2++) {
      const yc = y2 + 0.5;
      let k2 = 0;
      for (let i2 = 0; i2 < n2; i2++) {
        const ax = pts[i2 * 2], ay = pts[i2 * 2 + 1], j2 = (i2 + 1) % n2, bx = pts[j2 * 2], by = pts[j2 * 2 + 1];
        if (ay <= yc && by > yc || by <= yc && ay > yc) {
          if (k2 < 256) this.xs[k2++] = ax + (yc - ay) * (bx - ax) / (by - ay);
        }
      }
      for (let a2 = 1; a2 < k2; a2++) {
        const v2 = this.xs[a2];
        let b2 = a2 - 1;
        while (b2 >= 0 && this.xs[b2] > v2) {
          this.xs[b2 + 1] = this.xs[b2];
          b2--;
        }
        this.xs[b2 + 1] = v2;
      }
      for (let j2 = 0; j2 + 1 < k2; j2 += 2) {
        const xa = Math.max(0, Math.ceil(this.xs[j2] - 0.5)), xb = Math.min(W2 - 1, Math.floor(this.xs[j2 + 1] - 0.5));
        if (xb >= xa && ns < this.spans.length / 3) {
          this.spans[ns * 3] = y2;
          this.spans[ns * 3 + 1] = xa;
          this.spans[ns * 3 + 2] = xb;
          ns++;
        }
      }
    }
    return ns;
  }
  field(s2, ns) {
    const W2 = this.W;
    const a2 = s2.a;
    let j2 = 0;
    if (s2.t === "B") {
      const [ex, ey, rx, ry, r2, f2] = s2.p, c2 = Math.cos(r2), n2 = Math.sin(r2);
      for (let i2 = 0; i2 < ns; i2++) {
        const py = this.spans[i2 * 3] + 0.5;
        for (let x2 = this.spans[i2 * 3 + 1]; x2 <= this.spans[i2 * 3 + 2]; x2++, j2++) {
          const dx = x2 + 0.5 - ex, dy = py - ey, u2 = (dx * c2 + dy * n2) / rx, v2 = (-dx * n2 + dy * c2) / ry, k2 = Math.sqrt(u2 * u2 + v2 * v2);
          this.tBuf[j2] = k2 < 1 ? k2 : 1;
          this.aBuf[j2] = k2 >= 1 ? 0 : a2 * Math.min(1, (1 - k2) / f2);
        }
      }
    } else {
      const [gx, gy, m2, M2] = shapeAxis(s2), inv = 1 / Math.max(1e-6, M2 - m2);
      for (let i2 = 0; i2 < ns; i2++) {
        const py = this.spans[i2 * 3] + 0.5;
        for (let x2 = this.spans[i2 * 3 + 1]; x2 <= this.spans[i2 * 3 + 2]; x2++, j2++) {
          const t2 = s2.fl ? 0 : ((x2 + 0.5) * gx + py * gy - m2) * inv;
          this.tBuf[j2] = t2 < 0 ? 0 : t2 > 1 ? 1 : t2;
          this.aBuf[j2] = a2;
        }
      }
    }
    return j2;
  }
  // ── Color solving ─────────────────────────────────────────────────────────
  evaluate(s2) {
    const W2 = this.W;
    const ns = this.raster(poly(s2));
    if (!ns) return Infinity;
    const np = this.field(s2, ns);
    if (np < 2) return Infinity;
    let A00 = 0, A01 = 0, A11 = 0, n2 = 0;
    const b0 = [0, 0, 0], b1 = [0, 0, 0], wmap = this.smart ? this.Wt : null;
    let j2 = 0;
    for (let i2 = 0; i2 < ns; i2++) {
      const row = this.spans[i2 * 3] * W2;
      for (let x2 = this.spans[i2 * 3 + 1]; x2 <= this.spans[i2 * 3 + 2]; x2++, j2++) {
        const ai2 = this.aBuf[j2];
        if (ai2 <= 0 || !Number.isFinite(ai2)) continue;
        const wp = wmap ? wmap[row + x2] : 1, t2 = this.tBuf[j2], u2 = 1 - t2, w2 = ai2 * ai2 * wp, ia = 1 - ai2, o2 = (row + x2) * 3;
        A00 += w2 * u2 * u2;
        A01 += w2 * u2 * t2;
        A11 += w2 * t2 * t2;
        n2++;
        for (let ch = 0; ch < 3; ch++) {
          const e2 = (this.T[o2 + ch] - this.C[o2 + ch] * ia) * ai2 * wp;
          b0[ch] += u2 * e2;
          b1[ch] += t2 * e2;
        }
      }
    }
    if (n2 < 2 || !Number.isFinite(A00) || !Number.isFinite(A11)) return Infinity;
    const lam = 0.02 * (A00 + A11) + 1e-6, a00 = A00 + lam, a01 = A01 - lam, a11 = A11 + lam, det = a00 * a11 - a01 * a01;
    let c0 = [0, 0, 0], c1 = [0, 0, 0];
    if (this.PAL) {
      let best = Infinity, bi2 = 0, bj = 0;
      for (let i2 = 0; i2 < this.PAL.length; i2++) for (let k2 = 0; k2 < this.PAL.length; k2++) {
        if (s2.fl && k2 !== i2) continue;
        const P2 = this.PAL[i2], Q2 = this.PAL[k2];
        let q2 = 0;
        for (let ch = 0; ch < 3; ch++) q2 += P2[ch] * P2[ch] * A00 + 2 * P2[ch] * Q2[ch] * A01 + Q2[ch] * Q2[ch] * A11 - 2 * P2[ch] * b0[ch] - 2 * Q2[ch] * b1[ch];
        if (q2 < best) {
          best = q2;
          bi2 = i2;
          bj = k2;
        }
      }
      c0 = this.PAL[bi2].slice();
      c1 = this.PAL[bj].slice();
    } else for (let ch = 0; ch < 3; ch++) {
      c0[ch] = cl255((b0[ch] * a11 - b1[ch] * a01) / det);
      c1[ch] = cl255((a00 * b1[ch] - a01 * b0[ch]) / det);
    }
    if (s2.st === "charcoal" && !this.PAL) for (const c2 of [c0, c1]) {
      const g2 = c2[0] * 0.3 + c2[1] * 0.59 + c2[2] * 0.11;
      for (let ch = 0; ch < 3; ch++) c2[ch] = g2 + (c2[ch] - g2) * 0.12;
    }
    let d2 = 0;
    j2 = 0;
    for (let i2 = 0; i2 < ns; i2++) {
      const row = this.spans[i2 * 3] * W2;
      for (let x2 = this.spans[i2 * 3 + 1]; x2 <= this.spans[i2 * 3 + 2]; x2++, j2++) {
        const ai2 = this.aBuf[j2];
        if (ai2 <= 0 || !Number.isFinite(ai2)) continue;
        const t2 = this.tBuf[j2], ia = 1 - ai2, o2 = (row + x2) * 3, wp = wmap ? wmap[row + x2] : 1;
        for (let ch = 0; ch < 3; ch++) {
          const tv = this.T[o2 + ch], cv = this.C[o2 + ch], nv = cv * ia + (c0[ch] + (c1[ch] - c0[ch]) * t2) * ai2 - tv;
          d2 += (nv * nv - (cv - tv) * (cv - tv)) * wp;
        }
      }
    }
    s2.c0 = c0;
    s2.c1 = c1;
    return d2;
  }
  commit(s2) {
    const W2 = this.W;
    const ns = this.raster(poly(s2));
    this.field(s2, ns);
    let j2 = 0;
    for (let i2 = 0; i2 < ns; i2++) {
      const row = this.spans[i2 * 3] * W2;
      for (let x2 = this.spans[i2 * 3 + 1]; x2 <= this.spans[i2 * 3 + 2]; x2++, j2++) {
        const ai2 = this.aBuf[j2];
        if (ai2 <= 0) continue;
        const t2 = this.tBuf[j2], ia = 1 - ai2, o2 = (row + x2) * 3;
        let e2 = 0;
        for (let ch = 0; ch < 3; ch++) {
          this.C[o2 + ch] = this.C[o2 + ch] * ia + (s2.c0[ch] + (s2.c1[ch] - s2.c0[ch]) * t2) * ai2;
          e2 += Math.abs(this.C[o2 + ch] - this.T[o2 + ch]);
        }
        this.errMap[row + x2] = e2;
      }
    }
  }
  // ── Sampling ──────────────────────────────────────────────────────────────
  rebuildCum() {
    const W2 = this.W, H2 = this.H, n2 = W2 * H2;
    let t2 = 0, s2 = 0, te2 = 0;
    const b0 = this.band ? this.band[0] * W2 : 0, b1 = this.band ? this.band[1] * W2 : n2;
    const ok = this.ORD ? this.ORD.key : null, lo = this.ORD ? this.passNo / this.ORD.K - 1e-6 : 0, hi2 = this.ORD ? this.passNo >= this.ORD.K - 1 ? 2 : (this.passNo + 1) / this.ORD.K : 2;
    for (let i2 = 0; i2 < n2; i2++) {
      const e2 = this.errMap[i2] * this.errMap[i2] + 1, w2 = (this.smart ? e2 * this.Wt[i2] : e2) * (i2 >= b0 && i2 < b1 ? 1 : 0) * (ok ? ok[i2] >= lo && ok[i2] < hi2 ? 1 : 0 : 1);
      t2 += w2;
      this.cum[i2] = t2;
      s2 += this.errMap[i2];
      if (this.smart) {
        te2 += w2 * (0.15 + 3 * this.Edge[i2] * this.Edge[i2]);
        this.cumE[i2] = te2;
      }
    }
    this.cumTotal = t2;
    this.cumETotal = te2;
    this.sim = 100 * (1 - s2 / (3 * n2) / 255);
  }
  samplePos(edges) {
    const W2 = this.W, H2 = this.H;
    if (this.abstract && !this.ORD && this.rnd() < 0.3) return [this.rnd() * W2, this.band ? this.band[0] + this.rnd() * (this.band[1] - this.band[0]) : this.rnd() * H2];
    const useEdges = edges && this.cumE;
    const tab = useEdges ? this.cumE : this.cum, r2 = this.rnd() * (useEdges ? this.cumETotal : this.cumTotal);
    let lo = 0, hi2 = W2 * H2 - 1;
    while (lo < hi2) {
      const m2 = lo + hi2 >> 1;
      if (tab[m2] < r2) lo = m2 + 1;
      else hi2 = m2;
    }
    return [lo % W2 + this.rnd(), (lo / W2 | 0) + this.rnd()];
  }
  // ── Shape generation ──────────────────────────────────────────────────────
  pickType(st2) {
    if ((st2 === "hatch" || st2 === "calligraphy" || st2 === "string") && this.stepProg > 0.12) return "S";
    if (this.LINES && !this.SHAPE_ID.has(st2) && (this.stepProg > 0.04 || this.rnd() < 0.6)) return "S";
    const m2 = this.MIX[st2] || this.MIX.painterly;
    let r2 = this.rnd();
    for (const [t2, w2] of m2) {
      if ((r2 -= w2) <= 0) return t2;
    }
    return m2[0][0];
  }
  longer(p2, k2) {
    const cx = (p2[0] + p2[4]) / 2, cy = (p2[1] + p2[5]) / 2;
    for (const i2 of [0, 2, 4]) {
      p2[i2] = cx + (p2[i2] - cx) * k2;
      p2[i2 + 1] = cy + (p2[i2 + 1] - cy) * k2;
    }
  }
  styled(s2, st2) {
    const p2 = s2.p;
    if (st2 === "points" && s2.t === "E") {
      p2[2] = p2[3] = Math.max(1, Math.min(p2[2], p2[3]));
      s2.a = 0.92;
    } else if (st2 === "hatch" && s2.t === "S") {
      const cx = (p2[0] + p2[4]) / 2, cy = (p2[1] + p2[5]) / 2, len = Math.max(Math.hypot(p2[4] - p2[0], p2[5] - p2[1]) * 0.6, Math.max(this.W, this.H) * 0.03), ang = (this.rnd() < 0.5 ? 0.785 : 2.356) + this.gauss() * 0.08;
      p2[0] = cx - Math.cos(ang) * len;
      p2[1] = cy - Math.sin(ang) * len;
      p2[4] = cx + Math.cos(ang) * len;
      p2[5] = cy + Math.sin(ang) * len;
      p2[2] = cx;
      p2[3] = cy;
      p2[6] = lerp(0.6, 1.5, this.rnd());
      s2.a = 0.9;
    } else if (st2 === "calligraphy" && s2.t === "S") {
      p2[6] = Math.max(1, p2[6] * lerp(0.35, 1.4, this.rnd()));
      s2.a = 0.95;
    } else if (st2 === "watercolour") {
      if (s2.t === "S") {
        s2.a = 0.62;
        p2[6] = Math.max(2, p2[6] * lerp(1.1, 1.6, this.rnd()));
        this.longer(p2, 1.2);
      } else {
        s2.a = lerp(0.45, 0.7, this.rnd());
        if (s2.t === "B") p2[5] = 0.15;
      }
    } else if (st2 === "oil" || st2 === "acrylic" || st2 === "gouache") {
      s2.a = 1;
      if (s2.t === "S") {
        p2[6] = Math.max(3, p2[6] * lerp(1, st2 === "oil" ? 1.7 : 1.5, this.rnd()));
        this.longer(p2, lerp(1.1, 1.4, this.rnd()));
      } else if (s2.t === "B") p2[5] = 0.12;
    } else if (st2 === "knife") {
      s2.a = 1;
      if (s2.t === "S") {
        p2[6] = Math.max(4, p2[6] * lerp(1.1, 1.5, this.rnd()));
        p2[2] = (p2[0] + p2[4]) / 2 + (p2[2] - (p2[0] + p2[4]) / 2) * 0.3;
        p2[3] = (p2[1] + p2[5]) / 2 + (p2[3] - (p2[1] + p2[5]) / 2) * 0.3;
        this.longer(p2, 0.95);
      } else if (s2.t === "B") p2[5] = 0.12;
    } else if (st2 === "sumi") {
      s2.a = 0.95;
      if (s2.t === "S") p2[6] = Math.max(1.5, p2[6] * lerp(0.8, 1.6, this.rnd()));
      else if (s2.t === "B") p2[5] = lerp(0.3, 0.6, this.rnd());
    } else if (st2 === "marker") {
      s2.a = 0.7;
      if (s2.t === "S") {
        p2[6] = Math.max(2, Math.min(10, p2[6] * 0.6));
        this.longer(p2, 1.2);
      }
    } else if (st2 === "confetti") s2.a = 0.95;
    else if (st2 === "graffiti") {
      if (s2.t === "S") {
        p2[6] = Math.max(1.5, p2[6] * lerp(1.1, 1.7, this.rnd()));
        s2.a = 0.92;
      } else if (s2.t === "B") {
        s2.a = 0.85;
        p2[5] = lerp(0.7, 1, this.rnd());
      }
    } else if (st2 === "mosaic" || st2 === "glitch") s2.a = 1;
    else if (st2 === "glass") {
      s2.a = 1;
      if (s2.t === "B") p2[5] = 0.12;
    } else if (st2 === "linocut" || st2 === "riso") {
      s2.a = 1;
      if (s2.t === "B") p2[5] = 0.12;
      else if (s2.t === "S") p2[6] = Math.max(3, p2[6] * lerp(1, 1.5, this.rnd()));
    } else if (st2 === "tape") {
      s2.a = 0.95;
      if (s2.t === "S") {
        p2[6] = Math.max(4, Math.min(46, p2[6] * lerp(0.8, 1.2, this.rnd())));
        p2[2] = (p2[0] + p2[4]) / 2 + (p2[2] - (p2[0] + p2[4]) / 2) * 0.25;
        p2[3] = (p2[1] + p2[5]) / 2 + (p2[3] - (p2[1] + p2[5]) / 2) * 0.25;
      }
    } else if (st2 === "scribble" || st2 === "paper" || st2 === "stitch" || st2 === "halftone") {
      s2.a = 1;
      if (s2.t === "B") p2[5] = 0.12;
    } else if (st2 === "bokeh") {
      s2.a = lerp(0.45, 0.75, this.rnd());
      p2[2] = p2[3] = (p2[2] + p2[3]) / 2;
    } else if (st2 === "pencil") {
      s2.a = 0.85;
      if (s2.t === "S") {
        p2[6] = Math.max(1, Math.min(4, p2[6] * lerp(0.25, 0.5, this.rnd())));
        this.longer(p2, 1.5);
      } else if (s2.t === "B") p2[5] = 0.12;
    } else if (st2 === "pastel") {
      s2.a = 0.92;
      if (s2.t === "S") p2[6] = Math.max(2, p2[6] * lerp(1.1, 1.5, this.rnd()));
      else if (s2.t === "B") p2[5] = 0.2;
    } else if (st2 === "pen") {
      s2.a = 1;
      if (s2.t === "B") p2[5] = 0.12;
    } else if (st2 === "ink") {
      s2.a = 0.95;
      if (s2.t === "S") p2[6] = Math.max(1.5, p2[6] * lerp(0.7, 1.5, this.rnd()));
      else if (s2.t === "B") p2[5] = lerp(0.3, 0.6, this.rnd());
    } else if (st2 === "hylics") {
      s2.a = 1;
      if (s2.t === "S") p2[6] = Math.max(3, p2[6] * lerp(1.1, 1.7, this.rnd()));
      else if (s2.t === "B") p2[5] = 0.12;
    } else if (st2 === "lens" || st2 === "crystal" || st2 === "frost") {
      s2.a = 0.9;
      if (s2.t === "B") p2[5] = 0.12;
    } else if (this.RELIEF_ST.includes(st2)) {
      s2.a = 1;
      if (s2.t === "S") {
        p2[6] = Math.max(3, p2[6] * lerp(0.9, 1.4, this.rnd()));
        this.longer(p2, lerp(1.2, 1.6, this.rnd()));
      } else if (s2.t === "B") p2[5] = 0.12;
    } else if (st2 === "neon") {
      s2.a = 1;
      if (s2.t === "S") p2[6] = Math.max(1.5, Math.min(8, p2[6] * lerp(0.4, 0.8, this.rnd())));
    } else if (st2 === "embroid") {
      s2.a = 1;
      if (s2.t === "S") p2[6] = Math.max(4, p2[6] * lerp(1.2, 1.9, this.rnd()));
      else if (s2.t === "B") p2[5] = 0.12;
    } else if (st2 === "thread") {
      s2.a = 1;
      if (s2.t === "S") p2[6] = Math.max(3, p2[6] * lerp(0.9, 1.6, this.rnd()));
    } else if (st2 === "wet") {
      s2.a = lerp(0.5, 0.78, this.rnd());
      if (s2.t === "B") p2[5] = 0.15;
      else if (s2.t === "S") p2[6] = Math.max(2, p2[6] * lerp(1.1, 1.8, this.rnd()));
    } else if (st2 === "wash") {
      s2.a = lerp(0.45, 0.7, this.rnd());
      if (s2.t === "B") p2[5] = 0.15;
    } else if (st2 === "charcoal") {
      s2.a = 0.9;
      if (s2.t === "S") {
        p2[6] = Math.max(2, p2[6] * lerp(0.55, 0.9, this.rnd()));
        this.longer(p2, 1.7);
      } else if (s2.t === "B") p2[5] = 0.3;
    } else if (st2 === "string" && s2.t === "S") {
      const cx = (p2[0] + p2[4]) / 2, cy = (p2[1] + p2[5]) / 2, ang = Math.atan2(p2[5] - p2[1], p2[4] - p2[0]), half = Math.max(Math.hypot(p2[4] - p2[0], p2[5] - p2[1]) * 0.9, Math.max(this.W, this.H) * lerp(0.06, 0.2, this.rnd()));
      p2[0] = cx - Math.cos(ang) * half;
      p2[1] = cy - Math.sin(ang) * half;
      p2[4] = cx + Math.cos(ang) * half;
      p2[5] = cy + Math.sin(ang) * half;
      p2[6] = lerp(0.9, 1.5, this.rnd());
      s2.a = 0.8;
    }
    if (st2 === "glitch" && s2.t === "R") {
      const w2 = Math.max(p2[2], p2[3]);
      p2[2] = w2 * lerp(1.8, 4.5, this.rnd());
      p2[3] = Math.max(1, Math.min(p2[2], p2[3], w2) * lerp(0.1, 0.35, this.rnd()));
    }
    return this.constrain(s2);
  }
  constrain(s2) {
    const p2 = s2.p, st2 = s2.st, L2 = Math.max(this.W, this.H);
    if (st2 === "mosaic" && s2.t === "R") {
      const k2 = Math.max(3, Math.min(8, Math.round(Math.log2(L2 / Math.max(1, p2[2], p2[3]))))), cell = Math.max(2, L2 / 2 ** k2);
      p2[2] = p2[3] = cell;
      p2[4] = 0;
      p2[0] = (Math.floor(p2[0] / cell) + 0.5) * cell;
      p2[1] = (Math.floor(p2[1] / cell) + 0.5) * cell;
    } else if (st2 === "string" && s2.t === "S") {
      const dx = p2[4] - p2[0], dy = p2[5] - p2[1], d2 = Math.hypot(dx, dy) || 1, min = L2 * 0.1;
      if (d2 < min) {
        const cx = (p2[0] + p2[4]) / 2, cy = (p2[1] + p2[5]) / 2, k2 = min / d2 / 2;
        p2[0] = cx - dx * k2;
        p2[1] = cy - dy * k2;
        p2[4] = cx + dx * k2;
        p2[5] = cy + dy * k2;
      }
      p2[2] = (p2[0] + p2[4]) / 2;
      p2[3] = (p2[1] + p2[5]) / 2;
      p2[6] = Math.max(0.9, Math.min(1.6, p2[6]));
    } else if (st2 === "glitch" && s2.t === "R") {
      p2[4] = 0;
      p2[5] = Math.cos(p2[5]) >= 0 ? 0 : Math.PI;
      p2[3] = Math.max(1, Math.min(p2[3], p2[2] * 0.35));
    } else if (st2 === "bokeh" && s2.t === "E") p2[3] = p2[2];
    return s2;
  }
  plainShape(smin, smax, t2, pos) {
    const [x2, y2] = pos || this.samplePos(), s2 = lerp(smin, smax, this.rnd()), r2 = this.rnd() * Math.PI, g2 = this.rnd() * Math.PI * 2;
    if (t2 === "E") return { t: t2, a: 0.8, p: [x2, y2, s2 * lerp(0.25, 1, this.rnd()), s2 * lerp(0.25, 1, this.rnd()), r2, g2] };
    if (t2 === "B") return { t: t2, a: 0.9, p: [x2, y2, s2 * lerp(0.35, 1.2, this.rnd()), s2 * lerp(0.35, 1.2, this.rnd()), r2, lerp(0.25, 0.9, this.rnd())] };
    if (t2 === "R") return { t: t2, a: 0.8, p: [x2, y2, s2 * lerp(0.3, 1.6, this.rnd()), s2 * lerp(0.2, 1, this.rnd()), r2, g2] };
    if (t2 === "T") {
      const p2 = [x2, y2, x2, y2, x2, y2, g2];
      for (let i2 = 0; i2 < 6; i2++) p2[i2] += (this.rnd() - 0.5) * 2 * s2;
      return { t: t2, a: 0.8, p: p2 };
    }
    const dx = Math.cos(r2) * s2, dy = Math.sin(r2) * s2, bend = (this.rnd() - 0.5) * s2;
    return { t: t2, a: 0.8, p: [x2 - dx, y2 - dy, x2 - dy / s2 * bend, y2 + dx / s2 * bend, x2 + dx, y2 + dy, Math.max(1, s2 * lerp(0.08, 0.35, this.rnd())), Math.atan2(dy, dx) + (this.rnd() < 0.5 ? 0 : Math.PI / 2)] };
  }
  guidedShape(smin, smax, prog, t2, st2, pos) {
    const edges = pos ? pos.edges : prog > 0.55 && this.rnd() < 0.5;
    const [x2, y2] = pos || this.samplePos(edges), i2 = this.pix(x2, y2), coh = this.Coh[i2];
    const s2 = lerp(smin, smax, this.rnd());
    const guided = this.rnd() < 0.3 + 0.65 * coh;
    const along = guided ? this.Tan[i2] + this.gauss() * 0.12 : this.rnd() * Math.PI;
    const across = guided ? along + Math.PI / 2 : this.rnd() * Math.PI * 2;
    const long = guided ? lerp(0.55, 1.15, this.rnd()) : lerp(0.25, 1, this.rnd()), thin = guided ? lerp(0.18, 0.6, this.rnd()) : lerp(0.25, 1, this.rnd());
    if (t2 === "E") return { t: t2, a: 0.8, p: [x2, y2, s2 * long, s2 * thin, along, across] };
    if (t2 === "B") return { t: t2, a: 0.9, p: [x2, y2, s2 * lerp(0.4, 1.2, this.rnd()) * (guided ? 1.2 : 1), s2 * lerp(0.4, 1.2, this.rnd()) * (guided ? 0.6 : 1), along, lerp(0.25, 0.9, this.rnd())] };
    if (t2 === "R") return { t: t2, a: 0.8, p: [x2, y2, s2 * lerp(0.6, 1.6, this.rnd()), s2 * lerp(0.15, 0.6, this.rnd()), along, across] };
    if (t2 === "T") {
      const p2 = [x2, y2, x2, y2, x2, y2, across];
      for (let k2 = 0; k2 < 6; k2++) p2[k2] += (this.rnd() - 0.5) * 2 * s2;
      return { t: t2, a: 0.8, p: p2 };
    }
    const w2 = Math.max(1, s2 * (edges ? lerp(0.05, 0.16, this.rnd()) : lerp(0.08, 0.32, this.rnd())));
    if (guided) {
      const reach = st2 === "calligraphy" ? s2 * 1.8 : s2;
      const [x0, y0] = this.trace(x2, y2, -1, reach), [x22, y22] = this.trace(x2, y2, 1, reach);
      return { t: t2, a: 0.8, p: [x0, y0, 2 * x2 - (x0 + x22) / 2, 2 * y2 - (y0 + y22) / 2, x22, y22, w2, across] };
    }
    const dx = Math.cos(along) * s2, dy = Math.sin(along) * s2, bend = (this.rnd() - 0.5) * s2;
    return { t: t2, a: 0.8, p: [x2 - dx, y2 - dy, x2 - dy / s2 * bend, y2 + dx / s2 * bend, x2 + dx, y2 + dy, w2, across] };
  }
  randomShape(smin, smax, prog) {
    let st2 = this.stepStyle, pos = null;
    if (this.stepBg && this.Sub) {
      const edges = this.smart && prog > 0.55 && this.rnd() < 0.5;
      pos = this.samplePos(edges);
      pos.edges = edges;
      if (this.Sub[this.pix(pos[0], pos[1])] < 0.5) st2 = this.stepBg;
    }
    if (this.SMALL[st2] && prog > 0.06) {
      const cap = Math.max(this.W, this.H) * this.SMALL[st2];
      if (smax > cap) {
        smin *= cap / smax;
        smax = cap;
      }
    }
    if (this.abstract) {
      const k2 = lerp(0.7, 1.9, this.rnd());
      smin *= k2;
      smax *= k2;
    }
    const t2 = this.pickType(st2), s2 = this.smart && !(this.abstract && this.rnd() < 0.5) ? this.guidedShape(smin, smax, prog, t2, st2, pos) : this.plainShape(smin, smax, t2, pos);
    s2.st = st2;
    s2.fl = this.FLAT.has(st2);
    return this.styled(s2, st2);
  }
  // ── Mutation ───────────────────────────────────────────────────────────────
  extentOf(s2) {
    const p2 = s2.p;
    if (s2.t === "T") return Math.max(Math.hypot(p2[2] - p2[0], p2[3] - p2[1]), Math.hypot(p2[4] - p2[2], p2[5] - p2[3]), Math.hypot(p2[0] - p2[4], p2[1] - p2[5])) / 2;
    if (s2.t === "S") return Math.max(Math.hypot(p2[4] - p2[0], p2[5] - p2[1]) / 2, p2[6]);
    return Math.max(p2[2], p2[3]);
  }
  mutate(s2, smax) {
    const p2 = s2.p.slice(), j2 = smax * 0.12, i2 = Math.floor(this.rnd() * p2.length), k2 = this.KIND[s2.t][i2];
    if (k2 === "p") p2[i2] += this.gauss() * j2;
    else if (k2 === "s") p2[i2] = Math.max(1, p2[i2] * Math.exp(this.gauss() * 0.2));
    else if (k2 === "a") p2[i2] += this.gauss() * 0.35;
    else if (k2 === "f") p2[i2] = Math.max(0.12, Math.min(1, p2[i2] + this.gauss() * 0.12));
    return this.constrain({ t: s2.t, a: s2.a, p: p2, st: s2.st, fl: s2.fl });
  }
  // ── Order modes ───────────────────────────────────────────────────────────
  orderSetup(kind, c0) {
    this.ORD = null;
    const KINDS = ["down", "up", "right", "left", "diag", "spiral", "spiralin", "rings", "ringsin", "clock"];
    if (!KINDS.includes(kind)) return;
    const W2 = this.W, H2 = this.H, n2 = W2 * H2;
    const key = new Float32Array(n2), L2 = Math.max(W2, H2), cx = W2 / 2, cy = H2 / 2, short = Math.min(W2, H2), TURNS = 3;
    const spiral = kind === "spiral" || kind === "spiralin", rings = kind === "rings" || kind === "ringsin", clock = kind === "clock";
    const K2 = Math.max(2, Math.min(spiral ? 30 : rings ? 10 : clock ? 16 : 12, Math.round(this.maxShapes / 20)));
    let thick = L2 / K2;
    if (kind === "down" || kind === "up") thick = H2 / K2;
    else if (kind === "left" || kind === "right") thick = W2 / K2;
    else if (kind === "diag") thick = (W2 + H2) / (2 * K2);
    else if (spiral) thick = short / (2 * TURNS);
    else if (rings) thick = short / (2 * K2);
    else if (clock) thick = Math.sqrt(W2 * H2 / K2);
    for (let y2 = 0; y2 < H2; y2++) for (let x2 = 0; x2 < W2; x2++) {
      const i2 = y2 * W2 + x2, u2 = (x2 + 0.5 - cx) / cx, v2 = (y2 + 0.5 - cy) / cy;
      let k2;
      if (kind === "down") k2 = (y2 + 0.5) / H2;
      else if (kind === "up") k2 = 1 - (y2 + 0.5) / H2;
      else if (kind === "right") k2 = (x2 + 0.5) / W2;
      else if (kind === "left") k2 = 1 - (x2 + 0.5) / W2;
      else if (kind === "diag") k2 = ((x2 + 0.5) / W2 + (y2 + 0.5) / H2) / 2;
      else {
        const r2 = Math.pow(Math.pow(Math.abs(u2), 4) + Math.pow(Math.abs(v2), 4), 0.25) / 1.1892;
        const phi = (Math.atan2(u2, -v2) + 2 * Math.PI) % (2 * Math.PI) / (2 * Math.PI);
        if (clock) k2 = phi;
        else if (rings) k2 = Math.min(1, r2);
        else {
          const lap = Math.round(Math.min(1, r2) * TURNS - phi);
          k2 = Math.min(1, Math.max(0, (lap + phi) / TURNS));
        }
      }
      key[i2] = Math.min(0.9999, Math.max(0, kind === "spiralin" || kind === "ringsin" ? 1 - k2 : k2));
    }
    this.ORD = { key, K: K2, thick };
    this.passNo = Math.min(K2 - 1, Math.floor((c0 || 0) * K2 / Math.max(1, this.maxShapes)));
    this.passStart = c0 || 0;
    this.passFails = 0;
    this.passLen = Math.max(1, (this.maxShapes - this.passStart) / (K2 - this.passNo));
  }
  advancePass() {
    this.passNo++;
    this.passStart = this.count;
    this.passFails = 0;
    this.passLen = Math.max(1, (this.maxShapes - this.count) / (this.ORD.K - this.passNo));
    this.rebuildCum();
  }
  // ── Edge outlines ─────────────────────────────────────────────────────────
  edgeChains() {
    const W2 = this.W, H2 = this.H, n2 = W2 * H2;
    const L2 = new Float32Array(n2);
    for (let i2 = 0; i2 < n2; i2++) L2[i2] = 0.299 * this.T[i2 * 3] + 0.587 * this.T[i2 * 3 + 1] + 0.114 * this.T[i2 * 3 + 2];
    const B2 = this.blur2(L2, Math.max(1, Math.round(Math.max(W2, H2) / 400))), M2 = new Float32Array(n2), D2 = new Uint8Array(n2);
    const at2 = (x2, y2) => B2[Math.min(H2 - 1, Math.max(0, y2)) * W2 + Math.min(W2 - 1, Math.max(0, x2))];
    for (let y2 = 0; y2 < H2; y2++) for (let x2 = 0; x2 < W2; x2++) {
      const gx = at2(x2 + 1, y2 - 1) + 2 * at2(x2 + 1, y2) + at2(x2 + 1, y2 + 1) - at2(x2 - 1, y2 - 1) - 2 * at2(x2 - 1, y2) - at2(x2 - 1, y2 + 1);
      const gy = at2(x2 - 1, y2 + 1) + 2 * at2(x2, y2 + 1) + at2(x2 + 1, y2 + 1) - at2(x2 - 1, y2 - 1) - 2 * at2(x2, y2 - 1) - at2(x2 + 1, y2 - 1);
      const i2 = y2 * W2 + x2, a2 = Math.atan2(gy, gx);
      M2[i2] = Math.hypot(gx, gy);
      D2[i2] = Math.round((a2 < 0 ? a2 + Math.PI : a2) / Math.PI * 4) % 4;
    }
    const NB = [[1, 0], [1, 1], [0, 1], [-1, 1]], K2 = new Float32Array(n2);
    for (let y2 = 1; y2 < H2 - 1; y2++) for (let x2 = 1; x2 < W2 - 1; x2++) {
      const i2 = y2 * W2 + x2, [dx, dy] = NB[D2[i2]], m2 = M2[i2];
      if (m2 >= M2[i2 + dy * W2 + dx] && m2 >= M2[i2 - dy * W2 - dx]) K2[i2] = m2;
    }
    const hi2 = Math.max(60, this.pctl(K2.filter((v2) => v2 > 0), 0.8)), lo = hi2 * 0.45, E2 = new Uint8Array(n2), st2 = [];
    for (let i2 = 0; i2 < n2; i2++) if (K2[i2] >= hi2 && !E2[i2]) {
      E2[i2] = 1;
      st2.push(i2);
      while (st2.length) {
        const j2 = st2.pop(), x2 = j2 % W2, y2 = j2 / W2 | 0;
        for (let v2 = -1; v2 <= 1; v2++) for (let u2 = -1; u2 <= 1; u2++) {
          const xx = x2 + u2, yy = y2 + v2;
          if (xx < 0 || yy < 0 || xx >= W2 || yy >= H2) continue;
          const k2 = yy * W2 + xx;
          if (!E2[k2] && K2[k2] >= lo) {
            E2[k2] = 1;
            st2.push(k2);
          }
        }
      }
    }
    const nbs = (j2) => {
      const x2 = j2 % W2, y2 = j2 / W2 | 0, o2 = [];
      for (let v2 = -1; v2 <= 1; v2++) for (let u2 = -1; u2 <= 1; u2++) {
        if (!u2 && !v2) continue;
        const xx = x2 + u2, yy = y2 + v2;
        if (xx >= 0 && yy >= 0 && xx < W2 && yy < H2 && E2[yy * W2 + xx] === 1) o2.push(yy * W2 + xx);
      }
      return o2;
    };
    const chains = [], minLen = Math.max(6, Math.round(Math.max(W2, H2) * 0.012));
    const walk = (s0) => {
      const c2 = [s0];
      E2[s0] = 2;
      let j2 = s0;
      for (; ; ) {
        const o2 = nbs(j2);
        if (!o2.length) break;
        j2 = o2[0];
        E2[j2] = 2;
        c2.push(j2);
      }
      return c2;
    };
    for (let pass = 0; pass < 2; pass++) for (let i2 = 0; i2 < n2; i2++) if (E2[i2] === 1 && (pass || nbs(i2).length === 1)) {
      const c2 = walk(i2);
      if (c2.length >= minLen) chains.push(c2);
    }
    const out = [], seg = Math.max(8, Math.round(Math.max(W2, H2) * 0.05)), w2 = Math.max(1, Math.max(W2, H2) * 28e-4);
    for (const c2 of chains) {
      const k2 = Math.max(1, Math.round(c2.length / seg));
      for (let s2 = 0; s2 < k2; s2++) {
        const a2 = Math.floor(s2 * c2.length / k2), b2 = Math.min(c2.length - 1, Math.floor((s2 + 1) * c2.length / k2)), m2 = a2 + b2 >> 1;
        if (b2 - a2 < 3) continue;
        const P2 = (j2) => [c2[j2] % W2 + 0.5, (c2[j2] / W2 | 0) + 0.5], [x0, y0] = P2(a2), [x1, y1] = P2(m2), [x2, y2] = P2(b2);
        const nx = -(y2 - y0), ny = x2 - x0, nl = Math.hypot(nx, ny) || 1, off = 2.5;
        const side = (sg) => {
          const x3 = Math.round(x1 + nx / nl * off * sg), y3 = Math.round(x1 + ny / nl * off * sg), i2 = Math.min(H2 - 1, Math.max(0, y3)) * W2 + Math.min(W2 - 1, Math.max(0, x3));
          return [this.T[i2 * 3], this.T[i2 * 3 + 1], this.T[i2 * 3 + 2]];
        };
        const A2 = side(1), Bc = side(-1), dk = A2[0] + A2[1] + A2[2] < Bc[0] + Bc[1] + Bc[2] ? A2 : Bc, col = dk.map((v2) => v2 * 0.45);
        out.push({ t: "S", a: 0.95, p: [x0, y0, 2 * x1 - (x0 + x2) / 2, 2 * y1 - (y0 + y2) / 2, x2, y2, w2, Math.atan2(y2 - y0, x2 - x0)], col, len: b2 - a2 });
      }
    }
    out.sort((p2, q2) => q2.len - p2.len);
    return out;
  }
  outlineShape(o2, st2) {
    const s2 = { t: "S", p: o2.p.slice(), a: o2.a, st: st2, fl: true };
    if (this.RELIEF_ST.includes(st2)) s2.p[6] = Math.max(2.5, s2.p[6] * 1.6);
    this.evaluate(s2);
    s2.c0 = o2.col.slice();
    s2.c1 = o2.col.slice();
    return s2;
  }
  emitOutline(o2, tag) {
    let st2 = this.styles[Math.floor(this.rnd() * this.styles.length)] || "painterly";
    if (this.SHAPE_ID.has(st2) || this.NO_STROKE.has(st2)) st2 = "flat";
    const s2 = this.outlineShape(o2, st2);
    s2._fromOutline = true;
    this.commit(s2);
    this.count++;
    this._emitShape(s2);
  }
  burnOutlines(list) {
    for (const o2 of list) {
      const s2 = { t: "S", p: o2.p, a: 1 }, ns = this.raster(poly(s2));
      if (!ns) continue;
      this.field(s2, ns);
      let j2 = 0;
      for (let i2 = 0; i2 < ns; i2++) {
        const row = this.spans[i2 * 3] * this.W;
        for (let x2 = this.spans[i2 * 3 + 1]; x2 <= this.spans[i2 * 3 + 2]; x2++, j2++) {
          const ai2 = this.aBuf[j2];
          if (ai2 <= 0) continue;
          const q2 = (row + x2) * 3;
          for (let ch = 0; ch < 3; ch++) this.T[q2 + ch] = this.T[q2 + ch] * (1 - ai2) + o2.col[ch] * ai2;
        }
      }
    }
  }
  // ── Region fill ───────────────────────────────────────────────────────────
  regionAt(sx, sy) {
    const g2 = Math.max(2, Math.round(Math.max(this.W, this.H) / 150)), gw = Math.ceil(this.W / g2), gh = Math.ceil(this.H / g2), mask = new Uint8Array(gw * gh);
    const at2 = (gx, gy) => (Math.min(this.H - 1, gy * g2) * this.W + Math.min(this.W - 1, gx * g2)) * 3;
    const s0 = at2(Math.floor(sx / g2), Math.floor(sy / g2)), r0 = this.T[s0], g0 = this.T[s0 + 1], b0 = this.T[s0 + 2], tol = 34;
    const st2 = [Math.floor(sy / g2) * gw + Math.floor(sx / g2)];
    mask[st2[0]] = 1;
    let n2 = 0, mr2 = 0, mg = 0, mb = 0, err = 0, x0 = gw, y0 = gh, x1 = 0, y1 = 0;
    while (st2.length) {
      const c2 = st2.pop(), cx = c2 % gw, cy = (c2 - cx) / gw, o2 = at2(cx, cy);
      n2++;
      mr2 += this.T[o2];
      mg += this.T[o2 + 1];
      mb += this.T[o2 + 2];
      err += this.errMap[o2 / 3];
      if (cx < x0) x0 = cx;
      if (cx > x1) x1 = cx;
      if (cy < y0) y0 = cy;
      if (cy > y1) y1 = cy;
      if (n2 > gw * gh * 0.35) return null;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const j2 = ny * gw + nx;
        if (mask[j2]) continue;
        const q2 = at2(nx, ny);
        if (Math.abs(this.T[q2] - r0) + Math.abs(this.T[q2 + 1] - g0) + Math.abs(this.T[q2 + 2] - b0) > tol * 3) continue;
        mask[j2] = 1;
        st2.push(j2);
      }
    }
    return { mask, gw, gh, g: g2, n: n2, col: [mr2 / n2, mg / n2, mb / n2], err: err / n2, box: [x0, y0, x1, y1] };
  }
  regionContour(Rg) {
    const { mask, gw, gh, g: g2 } = Rg, inside = (x3, y3) => x3 >= 0 && y3 >= 0 && x3 < gw && y3 < gh && mask[y3 * gw + x3] === 1;
    let sx = -1, sy = -1;
    for (let i2 = 0; i2 < mask.length && sx < 0; i2++) if (mask[i2]) {
      sx = i2 % gw;
      sy = (i2 - sx) / gw;
    }
    const N8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]], out = [];
    let x2 = sx, y2 = sy, d2 = 7;
    for (let k2 = 0; k2 < gw * gh * 2; k2++) {
      out.push([(x2 + 0.5) * g2, (y2 + 0.5) * g2]);
      let found = false;
      for (let j2 = 0; j2 < 8; j2++) {
        const dd = (d2 + 6 + j2) % 8, nx = x2 + N8[dd][0], ny = y2 + N8[dd][1];
        if (inside(nx, ny)) {
          x2 = nx;
          y2 = ny;
          d2 = dd;
          found = true;
          break;
        }
      }
      if (!found || x2 === sx && y2 === sy && out.length > 2) break;
    }
    return out;
  }
  regionStroke(p0, p1, p2, w2, col, a2, st2, tag) {
    const s2 = { t: "S", p: [p0[0], p0[1], p1[0], p1[1], p2[0], p2[1], w2, Math.atan2(p2[1] - p0[1], p2[0] - p0[0])], a: a2, st: st2, fl: true };
    this.evaluate(s2);
    s2.c0 = col.slice();
    s2.c1 = col.map((v2) => Math.max(0, Math.min(255, v2 * (0.94 + this.rnd() * 0.12))));
    this.commit(s2);
    this.count++;
    this._emitShape(s2);
  }
  regionMove(prog, tag) {
    let Rg = null;
    for (let k2 = 0; k2 < 6 && !Rg; k2++) {
      const [x2, y2] = this.samplePos(false), r2 = this.regionAt(x2, y2);
      if (r2 && r2.n * r2.g * r2.g > this.W * this.H * 0.01 && r2.err > 40) Rg = r2;
    }
    if (!Rg) return false;
    let st2 = this.styles[Math.floor(this.rnd() * this.styles.length)] || "painterly";
    if (this.SHAPE_ID.has(st2) || this.NO_STROKE.has(st2)) st2 = "flat";
    const L2 = Math.max(this.W, this.H), area = Rg.n * Rg.g * Rg.g, kk = this.sizeK * (this.SSZ[st2] || 1), col = Rg.col;
    if (this.RFILL !== "scribble") {
      const P2 = this.regionContour(Rg);
      if (P2.length < 8) return false;
      const seg = Math.max(3, Math.round(P2.length / Math.min(36, Math.max(6, P2.length / 6)))), lw = Math.max(1.2, L2 * 4e-3 * kk), dark = col.map((v2) => v2 * 0.55);
      for (let i2 = 0; i2 + seg <= P2.length; i2 += seg) {
        const a3 = P2[i2], b3 = P2[Math.min(P2.length - 1, i2 + seg)], m2 = P2[Math.min(P2.length - 1, i2 + (seg >> 1))];
        this.regionStroke(a3, [2 * m2[0] - (a3[0] + b3[0]) / 2, 2 * m2[1] - (a3[1] + b3[1]) / 2], b3, lw, dark, 1, st2, tag);
      }
      const a2 = P2[P2.length - 1 - (P2.length - 1) % seg], b2 = P2[0];
      if (Math.hypot(a2[0] - b2[0], a2[1] - b2[1]) > 1) this.regionStroke(a2, [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2], b2, lw, dark, 1, st2, tag);
    }
    const fw0 = Math.max(2, Math.min(L2 * 0.035, Math.sqrt(area) / 9) * kk), { mask, gw, gh, g: g2 } = Rg;
    const inside = (x2, y2) => {
      const gx = Math.floor(x2 / g2), gy = Math.floor(y2 / g2);
      return gx >= 0 && gy >= 0 && gx < gw && gy < gh && mask[gy * gw + gx] === 1;
    };
    const [bx0, by0, bx1, by1] = Rg.box, cx = (bx0 + bx1 + 1) / 2 * g2, cy = (by0 + by1 + 1) / 2 * g2, half = Math.hypot(bx1 - bx0 + 1, by1 - by0 + 1) * g2 / 2;
    const tone = () => col.map((v2) => v2 * (0.93 + this.rnd() * 0.14)), wid = () => fw0 * (0.7 + this.rnd() * 0.6);
    const curve = (A2, E2, amt) => {
      const mx = (A2[0] + E2[0]) / 2, my = (A2[1] + E2[1]) / 2, dx = E2[0] - A2[0], dy = E2[1] - A2[1], l2 = Math.hypot(dx, dy) || 1, b2 = (this.rnd() - 0.5) * amt;
      return [mx - dy / l2 * b2, my + dx / l2 * b2];
    };
    let made = 0;
    if (this.RFILL !== "rows" && this.rnd() < 0.55) {
      const cov = new Uint8Array(gw * gh);
      let need = 0;
      for (let i2 = 0; i2 < mask.length; i2++) if (mask[i2]) need++;
      const r2 = Math.max(1, Math.round(fw0 * 0.6 / g2)), mark = (x2, y2) => {
        const gx = Math.floor(x2 / g2), gy = Math.floor(y2 / g2);
        let n2 = 0;
        for (let v2 = -r2; v2 <= r2; v2++) for (let u2 = -r2; u2 <= r2; u2++) {
          const X2 = gx + u2, Y2 = gy + v2;
          if (X2 >= 0 && Y2 >= 0 && X2 < gw && Y2 < gh) {
            const j2 = Y2 * gw + X2;
            if (mask[j2] && !cov[j2]) {
              cov[j2] = 1;
              n2++;
            }
          }
        }
        return n2;
      };
      let p2 = null;
      for (let k2 = 0; k2 < 40 && !p2; k2++) {
        const x2 = (bx0 + this.rnd() * (bx1 - bx0 + 1)) * g2, y2 = (by0 + this.rnd() * (by1 - by0 + 1)) * g2;
        if (inside(x2, y2)) p2 = [x2, y2];
      }
      if (p2) {
        let th = this.rnd() * 6.283, turn = (this.rnd() < 0.5 ? 1 : -1) * (0.25 + this.rnd() * 0.35), got = mark(p2[0], p2[1]), aim = null, pts = [p2];
        const stepL = fw0 * (0.9 + this.rnd() * 0.5);
        for (let k2 = 0; k2 < 600 && got < need * 0.82 && pts.length < 220; k2++) {
          if (k2 % 7 === 0) {
            aim = null;
            let bd = Infinity;
            for (let t2 = 0; t2 < 24; t2++) {
              const j2 = Math.floor(this.rnd() * mask.length);
              if (!mask[j2] || cov[j2]) continue;
              const ax = (j2 % gw + 0.5) * g2, ay = (Math.floor(j2 / gw) + 0.5) * g2, d2 = Math.hypot(ax - p2[0], ay - p2[1]);
              if (d2 < bd) {
                bd = d2;
                aim = [ax, ay];
              }
            }
          }
          if (this.rnd() < 0.15) turn = -turn;
          if (this.rnd() < 0.1) turn = Math.sign(turn) * (0.1 + this.rnd() * 0.7);
          th += turn + (this.rnd() - 0.5) * 0.9;
          if (aim) {
            const want = Math.atan2(aim[1] - p2[1], aim[0] - p2[0]);
            let d2 = want - th;
            d2 = Math.atan2(Math.sin(d2), Math.cos(d2));
            th += d2 * 0.18;
          }
          let q2 = [p2[0] + Math.cos(th) * stepL, p2[1] + Math.sin(th) * stepL];
          for (let t2 = 0; t2 < 8 && !inside(q2[0], q2[1]); t2++) {
            th += Math.PI * (0.45 + this.rnd() * 0.5);
            q2 = [p2[0] + Math.cos(th) * stepL, p2[1] + Math.sin(th) * stepL];
          }
          if (!inside(q2[0], q2[1])) break;
          got += mark(q2[0], q2[1]);
          pts.push(q2);
          p2 = q2;
        }
        for (let k2 = 0; k2 + 2 < pts.length; k2 += 2) {
          this.regionStroke(pts[k2], pts[k2 + 1], pts[k2 + 2], wid(), tone(), 0.9, st2, tag);
          made++;
        }
      }
    }
    if (!made) {
      let an2 = this.rnd() * Math.PI;
      const pass = (an3, from, to, rowsOnly) => {
        const rows = [];
        let v2 = -half + from * 2 * half;
        while (v2 <= -half + to * 2 * half) {
          const a2 = an3 + (this.rnd() - 0.5) * 0.25, dx = Math.cos(a2), dy = Math.sin(a2), nx = -dy, ny = dx;
          let f2 = null, l2 = null;
          for (let u2 = -half; u2 <= half; u2 += g2 * 0.7) {
            const x2 = cx + nx * v2 + dx * u2, y2 = cy + ny * v2 + dy * u2;
            if (inside(x2, y2)) {
              if (!f2) f2 = [x2, y2];
              l2 = [x2, y2];
            }
          }
          if (f2 && Math.hypot(l2[0] - f2[0], l2[1] - f2[1]) > fw0 * 0.5 && this.rnd() > 0.08) {
            const sh = (s2) => {
              const t2 = s2 > 0 ? 0.88 + this.rnd() * 0.22 : 0.85 + this.rnd() * 0.2, mx = (f2[0] + l2[0]) / 2, my = (f2[1] + l2[1]) / 2, P2 = s2 > 0 ? l2 : f2;
              return [mx + (P2[0] - mx) * t2, my + (P2[1] - my) * t2];
            };
            rows.push([sh(-1), sh(1)]);
          }
          v2 += fw0 * (this.RFILL === "rows" ? 0.6 + this.rnd() * 0.5 : 0.7 + this.rnd() * 0.9);
          an3 += (this.rnd() - 0.5) * 0.08;
        }
        for (let k2 = 0; k2 < rows.length && made < 80; k2++) {
          const [f2, l2] = rows[k2], back = k2 % 2, A2 = back ? l2 : f2, nxt = rows[k2 + 1];
          const E2 = rowsOnly || !nxt ? back ? f2 : l2 : back ? nxt[0] : nxt[1];
          this.regionStroke(A2, curve(A2, E2, fw0 * 2.2), E2, wid(), tone(), 0.92, st2, tag);
          made++;
        }
      };
      pass(an2, 0, 1, this.RFILL === "rows");
      if (this.rnd() < 0.4) {
        const a2 = this.rnd() * 0.6;
        pass(an2 + 0.6 + this.rnd() * 0.9, a2, a2 + 0.25 + this.rnd() * 0.3, this.RFILL === "rows");
      }
    }
    return true;
  }
  // ── Abstract ──────────────────────────────────────────────────────────────
  shiftColours(s2) {
    const th = this.gauss() * 0.4, c2 = Math.cos(th), n2 = Math.sin(th), k2 = 1 / Math.sqrt(3), sat = lerp(1.05, 1.35, this.rnd());
    for (const col of [s2.c0, s2.c1]) {
      const m2 = (col[0] + col[1] + col[2]) / 3, r2 = col[0] - m2, g2 = col[1] - m2, b2 = col[2] - m2;
      const cr2 = k2 * (g2 - b2), cg = k2 * (b2 - r2), cb = k2 * (r2 - g2);
      col[0] = cl255(m2 + (r2 * c2 + cr2 * n2) * sat);
      col[1] = cl255(m2 + (g2 * c2 + cg * n2) * sat);
      col[2] = cl255(m2 + (b2 * c2 + cb * n2) * sat);
    }
  }
  // ── Main step ─────────────────────────────────────────────────────────────
  step(prog = this.count / this.maxShapes, tag) {
    const L2 = Math.max(this.W, this.H);
    if (this.RFILL !== "off" && !this.PEN && !this.ACC && prog > 0.06 && prog < 0.8 && this.count >= this.rfNext) {
      this.rfNext = this.count + Math.max(12, Math.round((this.endless ? 60 : this.maxShapes) / 25));
      if (this.regionMove(prog, tag)) return true;
    }
    if (this.ORD) {
      if (this.passNo < this.ORD.K - 1 && (this.count - this.passStart >= this.passLen || this.passFails > 120 || this.cumTotal <= 0)) this.advancePass();
      prog = Math.min(1, (this.count - this.passStart) / this.passLen);
    }
    if (this.PEN) return this.penStep(prog, tag);
    this.stepProg = prog;
    this.stepStyle = this.styles[Math.floor(this.rnd() * this.styles.length)] || "painterly";
    this.stepBg = this.bgStyles.length ? this.bgStyles[Math.floor(this.rnd() * this.bgStyles.length)] : null;
    const kk = (this.sizeRand ? Math.pow(2, this.rnd() * 5.32 - 3.32) : this.sizeK) * (this.SSZ[this.stepStyle] || 1);
    let smax = Math.min(L2 * 0.9, L2 * lerp(0.45, 0.012, Math.pow(prog, 0.5)) * kk);
    if (this.under) smax = Math.min(smax, L2 * (this.endless ? 0.05 : 0.1) * Math.max(1, kk));
    if (this.ORD) smax = Math.min(smax, Math.max(this.ORD.thick, L2 * 0.02));
    const smin = smax * 0.3;
    if (this.count % 8 === 0) this.rebuildCum();
    let best = null, bd = Infinity;
    const nc = Math.round((prog < 0.15 ? 80 : 40) / this.HURRY);
    for (let i2 = 0; i2 < nc; i2++) {
      const s2 = this.randomShape(smin, smax, prog), d2 = this.evaluate(s2);
      if (d2 < bd) {
        bd = d2;
        best = s2;
      }
    }
    if (!best) {
      this.passFails++;
      return false;
    }
    let fails = 0;
    const keep = kk !== 1 || this.under, lo = smin * 0.4, hi2 = smax * 1.6;
    for (let i2 = 0, mi2 = 180 / this.HURRY, mf = 50 / this.HURRY; i2 < mi2 && fails < mf; i2++) {
      const s2 = this.mutate(best, smax);
      if (keep) {
        const x2 = this.extentOf(s2);
        if (x2 > hi2 || x2 < lo) {
          fails++;
          continue;
        }
      }
      const d2 = this.evaluate(s2);
      if (d2 < bd) {
        bd = d2;
        best = s2;
        fails = 0;
      } else fails++;
    }
    if (!best || bd >= 0) {
      this.passFails++;
      return false;
    }
    this.evaluate(best);
    if (this.abstract && !this.PAL) this.shiftColours(best);
    this.commit(best);
    this.count++;
    this.passFails = 0;
    this._emitShape(best);
    return true;
  }
  // ── One-line mode ─────────────────────────────────────────────────────────
  penStep(prog, tag) {
    if (!this.PENS.length || !this.penPos) {
      this.PEN_ID = 0;
      return this.penStep1(prog, tag);
    }
    const k2 = this.penTurn++ % (this.PENS.length + 1);
    if (!k2) {
      this.PEN_ID = 0;
      return this.penStep1(prog, tag);
    }
    const P2 = this.PENS[k2 - 1], keep = this.penPos;
    this.penPos = P2.pos;
    this.PEN_ID = P2.id;
    const ok = this.penStep1(prog, tag);
    P2.pos = this.penPos;
    this.penPos = keep;
    this.PEN_ID = 0;
    if (ok && --P2.life <= 0 || !P2.pos) this.PENS.splice(this.PENS.indexOf(P2), 1);
    return ok;
  }
  penStep1(prog, tag) {
    const L2 = Math.max(this.W, this.H);
    this.stepProg = prog;
    this.stepStyle = this.styles[Math.floor(this.rnd() * this.styles.length)] || "painterly";
    if (this.NO_STROKE.has(this.stepStyle)) this.stepStyle = "flat";
    const kk = (this.sizeRand ? Math.pow(2, this.rnd() * 5.32 - 3.32) : this.sizeK) * (this.SSZ[this.stepStyle] || 1);
    let smax = Math.min(L2 * 0.9, L2 * lerp(0.45, 0.012, Math.pow(prog, 0.5)) * kk);
    if (this.under) smax = Math.min(smax, L2 * 0.1 * Math.max(1, kk));
    if (this.ORD) smax = Math.min(smax, Math.max(this.ORD.thick, L2 * 0.02));
    const smin = smax * 0.3, reach = Math.max(8, smax * 2.4);
    if (this.count % 8 === 0) this.rebuildCum();
    const sx0 = this.penPos ? this.penPos[0] : 0, sy0 = this.penPos ? this.penPos[1] : 0;
    const spots = [];
    const lo = this.ORD ? this.passNo / this.ORD.K - 1e-6 : 0, hi2 = this.ORD ? this.passNo >= this.ORD.K - 1 ? 2 : (this.passNo + 1) / this.ORD.K : 2;
    const inWin = (x2, y2) => !this.ORD || this.ORD.key[this.pix(x2, y2)] >= lo && this.ORD.key[this.pix(x2, y2)] < hi2;
    for (let i2 = 0; i2 < 28 || this.ORD && spots.length < 6 && i2 < 90; i2++) {
      let x2, y2;
      if (!this.penPos || this.ORD && i2 >= 28) {
        [x2, y2] = this.samplePos(prog > 0.55 && this.rnd() < 0.5);
      } else {
        const a2 = this.rnd() * 6.2832, d2 = reach * Math.sqrt(this.rnd()) * (0.35 + 0.65 * this.rnd());
        x2 = Math.min(this.W - 1, Math.max(0, sx0 + Math.cos(a2) * d2));
        y2 = Math.min(this.H - 1, Math.max(0, sy0 + Math.sin(a2) * d2));
      }
      if (!inWin(x2, y2)) continue;
      const k2 = this.pix(x2, y2);
      spots.push([x2, y2, (this.errMap[k2] * this.errMap[k2] + 1) * (this.smart ? this.Wt[k2] : 1) * (0.4 + this.rnd())]);
    }
    if (this.penPos && this.ORD && spots.length > 1) {
      const near = (s2) => Math.hypot(s2[0] - sx0, s2[1] - sy0);
      if (spots.every((s2) => near(s2) > reach)) spots.sort((a2, b2) => near(a2) - near(b2));
    }
    spots.sort((a2, b2) => b2[2] - a2[2]);
    let best = null, bd = Infinity;
    for (let i2 = 0; i2 < Math.min(10, spots.length); i2++) {
      let sh;
      if (!this.penPos) {
        sh = this.guidedShape(smin, smax, prog, "S", this.stepStyle, null);
        sh.st = this.stepStyle;
        sh.fl = this.FLAT.has(this.stepStyle);
        sh = this.styled(sh, this.stepStyle);
      } else {
        const [tx, ty] = spots[i2], dx = tx - sx0, dy = ty - sy0, len = Math.hypot(dx, dy) || 1, bend = (this.rnd() - 0.5) * len * 0.8;
        sh = { t: "S", a: 0.8, p: [sx0, sy0, (sx0 + tx) / 2 - dy / len * bend, (sy0 + ty) / 2 + dx / len * bend, tx, ty, Math.max(1, lerp(smin, smax, this.rnd()) * lerp(0.1, 0.34, this.rnd())), Math.atan2(dy, dx) + (this.rnd() < 0.5 ? 0 : Math.PI / 2)] };
        sh.st = this.stepStyle;
        sh.fl = this.FLAT.has(this.stepStyle);
        sh = this.styled(sh, this.stepStyle);
        sh.p[0] = sx0;
        sh.p[1] = sy0;
      }
      if (sh.t !== "S") continue;
      const d2 = this.evaluate(sh);
      if (d2 < bd) {
        bd = d2;
        best = sh;
      }
    }
    if (!best) {
      if (++this.passFails > 30) this.penPos = null;
      return false;
    }
    for (let i2 = 0, fails = 0; i2 < 50 && fails < 16; i2++) {
      const m2 = this.mutate(best, smax);
      if (this.penPos) {
        m2.p[0] = sx0;
        m2.p[1] = sy0;
      }
      const d2 = this.evaluate(m2);
      if (d2 < bd) {
        bd = d2;
        best = m2;
        fails = 0;
      } else fails++;
    }
    if (bd >= 0 && this.penPos) {
      best.p[6] = 1;
      bd = this.evaluate(best);
    }
    if (bd === Infinity) {
      this.penPos = null;
      return false;
    }
    this.evaluate(best);
    if (this.abstract && !this.PAL) this.shiftColours(best);
    this.commit(best);
    this.count++;
    this.passFails = 0;
    this.penPos = [best.p[4], best.p[5]];
    this._emitShape(best);
    return true;
  }
  // ── Loop ──────────────────────────────────────────────────────────────────
  async start() {
    this._running = true;
    this._stopped = false;
    this._startCount = (this._startCount || 0) + 1;
    if (this._startCount % 50 === 0) console.log(`[Painter] start() #${this._startCount} count=${this.count} stuck=${this.stuck} maxShapes=${this.maxShapes}`);
    if (this.OL && this.OUTL === "first" && this.olI < this.OL.length) {
      while (this.olI < this.OL.length) this.emitOutline(this.OL[this.olI++]);
    }
    if (!this._loopChecked) {
      this._loopChecked = true;
      let e2 = 0;
      for (let i2 = 0; i2 < this.errMap.length; i2 += 7) e2 += this.errMap[i2];
      if (e2 / (this.errMap.length / 7) < 6) this.stuck = 3001;
    }
    while (this._running && this.count < this.maxShapes && (this.UNTIL == null || this.count < this.UNTIL)) {
      if (this.step()) this.stuck = 0;
      else if (++this.stuck > 3e3) break;
    }
    if (this.OL && this.OUTL === "last" && this.olI < this.OL.length) {
      while (this.olI < this.OL.length) this.emitOutline(this.OL[this.olI++]);
    }
    if (this.count >= this.maxShapes || this.stuck > 3e3) {
      this._running = false;
      this.rebuildCum();
      if (this.onDone) this.onDone({ count: this.count, sim: this.sim });
    }
  }
  stop() {
    this._running = false;
    this._stopped = true;
  }
  _emitShape(s2) {
    if (this.layerMode) {
      s2.layer = this._assignLayer(s2);
    }
    this._shapes.push({ ...s2, c0: s2.c0.slice(), c1: s2.c1.slice(), p: s2.p.slice(), layer: s2.layer });
    if (this.onShape) this.onShape({ ...s2, c0: s2.c0.slice(), c1: s2.c1.slice(), p: s2.p.slice(), layer: s2.layer });
    if (this.onProgress) this.onProgress(this.count / this.maxShapes);
  }
  /**
   * Assign a shape to a named layer based on generation progress and visual content.
   * Layers: background, shadows, outline, midtone, highlights
   *
   * @param {object} s - The shape being emitted.
   * @returns {string} Layer name.
   */
  _assignLayer(s2) {
    if (s2._fromOutline) return "outline";
    const prog = this.count / this.maxShapes;
    if (prog < 0.05) return "background";
    const p2 = s2.p;
    let cx, cy;
    if (s2.t === "S" && p2.length >= 8) {
      cx = (p2[0] + p2[2] + p2[4]) / 3;
      cy = (p2[1] + p2[3] + p2[5]) / 3;
    } else if (s2.t === "T" && p2.length >= 4) {
      cx = (p2[0] + p2[2]) / 2;
      cy = (p2[1] + p2[3]) / 2;
    } else if (p2.length >= 2) {
      cx = p2[0];
      cy = p2[1];
    } else {
      cx = this.W / 2;
      cy = this.H / 2;
    }
    const px = Math.floor(cx);
    const py = Math.floor(cy);
    const k2 = this.pix(px, py);
    let luminance = 0.5;
    if (this.T && k2 >= 0 && k2 < this.T.length / 3) {
      const r2 = this.T[k2 * 3];
      const g2 = this.T[k2 * 3 + 1];
      const b2 = this.T[k2 * 3 + 2];
      luminance = (0.2126 * r2 + 0.7152 * g2 + 0.0722 * b2) / 255;
    }
    if (luminance < 0.3) return "shadows";
    if (luminance > 0.7) return "highlights";
    return "midtone";
  }
  getShapes() {
    return this._shapes;
  }
  getProgress() {
    return this.count / this.maxShapes;
  }
  getSimilarity() {
    return this.sim;
  }
  // ── Static tables ─────────────────────────────────────────────────────────
  static get RELIEF_ST() {
    return ["oil", "acrylic", "knife", "plast", "ceramic", "stone", "metal", "foam", "molten", "pewter", "terrazzo", "copper", "gold", "bronze", "beads", "puffy"];
  }
  static get SHAPE_ID() {
    return /* @__PURE__ */ new Set(["mosaic", "glitch", "bubbles", "bokeh", "points", "confetti", "stitch", "glass", "paper", "geometric", "crystal"]);
  }
  static get NO_STROKE() {
    return /* @__PURE__ */ new Set(["mosaic", "glitch"]);
  }
  static get FLAT() {
    return /* @__PURE__ */ new Set(["linocut", "riso", "tape", "flat", "points", "confetti", "hatch", "graffiti", "mosaic", "scribble", "string", "bokeh", "paper", "stitch", "pencil", "pastel", "pen", "ink", "wash", "charcoal", "thread", "hylics", "lens", "crystal", "frost", "neon", "sumi", "marker", ..._Painter.RELIEF_ST.filter((t2) => !["oil", "acrylic", "knife"].includes(t2))]);
  }
  static get KIND() {
    return { E: "ppssaa", B: "ppssaf", T: "ppppppa", R: "ppssaa", S: "pppppsa" };
  }
  static get SMALL() {
    return { points: 0.028, confetti: 0.04 };
  }
  static get MIX() {
    return { painterly: [["S", 0.45], ["B", 0.25], ["E", 0.15], ["T", 0.15]], soft: [["B", 0.75], ["S", 0.25]], mixed: [["E", 0.2], ["B", 0.2], ["T", 0.2], ["R", 0.15], ["S", 0.25]], geometric: [["T", 0.55], ["R", 0.45]], bubbles: [["B", 0.55], ["E", 0.45]], flat: [["S", 0.6], ["E", 0.25], ["T", 0.15]], points: [["E", 1]], hatch: [["S", 0.88], ["B", 0.12]], calligraphy: [["S", 0.85], ["B", 0.15]], watercolour: [["S", 0.6], ["B", 0.3], ["E", 0.1]], oil: [["S", 0.85], ["B", 0.15]], acrylic: [["S", 0.85], ["B", 0.15]], knife: [["S", 0.8], ["B", 0.2]], gouache: [["S", 0.8], ["B", 0.2]], sumi: [["S", 0.8], ["B", 0.2]], marker: [["S", 0.9], ["R", 0.1]], confetti: [["R", 0.7], ["T", 0.3]], graffiti: [["S", 0.82], ["B", 0.18]], mosaic: [["R", 1]], glass: [["T", 0.55], ["E", 0.25], ["R", 0.2]], linocut: [["B", 0.35], ["E", 0.25], ["T", 0.2], ["S", 0.2]], riso: [["B", 0.35], ["E", 0.25], ["R", 0.15], ["S", 0.25]], tape: [["S", 0.8], ["R", 0.2]], scribble: [["B", 0.45], ["E", 0.35], ["T", 0.2]], halftone: [["E", 0.35], ["B", 0.25], ["R", 0.2], ["T", 0.2]], string: [["S", 0.85], ["B", 0.15]], glitch: [["R", 1]], bokeh: [["E", 1]], paper: [["T", 0.35], ["R", 0.3], ["E", 0.2], ["B", 0.15]], stitch: [["B", 0.5], ["E", 0.25], ["R", 0.25]], pencil: [["S", 1]], pastel: [["S", 0.6], ["B", 0.25], ["E", 0.15]], pen: [["B", 0.35], ["E", 0.3], ["T", 0.2], ["S", 0.15]], ink: [["S", 0.75], ["B", 0.25]], wash: [["B", 0.55], ["E", 0.3], ["T", 0.15]], wet: [["B", 0.5], ["E", 0.28], ["S", 0.12], ["T", 0.1]], thread: [["S", 0.62], ["E", 0.16], ["R", 0.12], ["T", 0.1]], hylics: [["S", 0.4], ["B", 0.25], ["E", 0.15], ["T", 0.1], ["R", 0.1]], lens: [["E", 0.45], ["B", 0.25], ["S", 0.2], ["T", 0.1]], crystal: [["T", 0.45], ["R", 0.25], ["E", 0.2], ["S", 0.1]], frost: [["B", 0.4], ["E", 0.3], ["R", 0.2], ["S", 0.1]], neon: [["S", 0.7], ["E", 0.2], ["R", 0.1]], embroid: [["S", 0.55], ["E", 0.2], ["B", 0.15], ["T", 0.1]], plast: [["S", 0.82], ["B", 0.18]], ceramic: [["S", 0.82], ["B", 0.18]], stone: [["S", 0.82], ["B", 0.18]], metal: [["S", 0.82], ["B", 0.18]], foam: [["S", 0.82], ["B", 0.18]], molten: [["S", 0.82], ["B", 0.18]], pewter: [["S", 0.82], ["B", 0.18]], terrazzo: [["S", 0.82], ["B", 0.18]], copper: [["S", 0.82], ["B", 0.18]], gold: [["S", 0.82], ["B", 0.18]], bronze: [["S", 0.82], ["B", 0.18]], beads: [["S", 0.82], ["B", 0.18]], puffy: [["S", 0.82], ["B", 0.18]], charcoal: [["S", 1]] };
  }
};
if (typeof window !== "undefined") window.Painter = Painter;

// js/engine/renderer.js
var Renderer = class {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} [opts]
   */
  constructor(ctx, opts = {}) {
    if (!ctx) throw new Error("Renderer requires a canvas context");
    this.ctx = ctx;
    this.width = opts.width || 0;
    this.height = opts.height || 0;
    this.background = opts.background || "#ffffff";
    this._layers = [];
    this._styles = {};
    this.multiLayer = false;
    this._layerCanvases = /* @__PURE__ */ new Map();
  }
  /**
   * Register a style module that provides custom rendering.
   * @param {string} name
   * @param {object} styleModule - Must expose draw(ctx, shape, progress).
   */
  registerStyle(name, styleModule) {
    this._styles[name] = styleModule;
  }
  /**
   * Set the canvas dimensions (also calls canvas.width/height if available).
   * @param {number} w
   * @param {number} h
   */
  setSize(w2, h2) {
    this.width = w2;
    this.height = h2;
    if (this.ctx.canvas) {
      this.ctx.canvas.width = w2;
      this.ctx.canvas.height = h2;
    }
  }
  /**
   * Create or retrieve an offscreen canvas for a named layer.
   * Used when multiLayer mode is active.
   *
   * @param {string} layerName
   * @returns {OffscreenCanvas|HTMLCanvasElement}
   */
  _getLayerCanvas(layerName) {
    if (!this._layerCanvases.has(layerName)) {
      var canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(this.width, this.height) : typeof document !== "undefined" ? document.createElement("canvas") : null;
      if (canvas) {
        canvas.width = this.width;
        canvas.height = this.height;
        var ctx2 = canvas.getContext("2d");
        if (ctx2) {
          ctx2.fillStyle = this.background;
          ctx2.fillRect(0, 0, this.width, this.height);
        }
      }
      this._layerCanvases.set(layerName, canvas);
    }
    return this._layerCanvases.get(layerName);
  }
  /**
   * Clear the entire canvas with the background color.
   */
  clear() {
    const ctx = this.ctx;
    const prev = ctx.fillStyle;
    ctx.fillStyle = this.background;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = prev;
  }
  /**
   * Set or replace the layer list.
   * @param {Array<object>} layers
   */
  setLayers(layers) {
    this._layers = layers || [];
  }
  /**
   * Render all layers to the canvas.
   *
   * @param {object} [opts]
   * @param {number} [opts.progress=1] - Global reveal 0..1.
   * @param {Array<object>} [opts.layers] - Override layer list.
   * @param {boolean} [opts.clear=true] - Clear canvas first.
   */
  renderAll(opts = {}) {
    const { progress = 1, layers = this._layers, clear: doClear = true } = opts;
    if (doClear) this.clear();
    const sorted = [...layers || []].sort((a2, b2) => a2.id - b2.id);
    if (this.multiLayer) {
      this._layerCanvases.clear();
      for (const layer of sorted) {
        if (!layer.visible) continue;
        var layerName = layer._name || layer.name || "layer_" + layer.id;
        var layerCanvas = this._getLayerCanvas(layerName);
        if (!layerCanvas) continue;
        var layerCtx = layerCanvas.getContext("2d");
        if (!layerCtx) continue;
        layerCtx.clearRect(0, 0, this.width, this.height);
        var oldCtx = this.ctx;
        this.ctx = layerCtx;
        this.renderLayer(layer, progress);
        this.ctx = oldCtx;
      }
      for (const layer of sorted) {
        if (!layer.visible) continue;
        var ln2 = layer._name || layer.name || "layer_" + layer.id;
        var lc = this._layerCanvases.get(ln2);
        if (!lc) continue;
        this.ctx.save();
        this.ctx.globalAlpha = layer.opacity !== void 0 ? layer.opacity : 1;
        if (layer.blendMode) {
          var bm = layer.blendMode === "normal" ? "source-over" : layer.blendMode;
          this.ctx.globalCompositeOperation = bm;
        }
        this.ctx.drawImage(lc, 0, 0);
        this.ctx.restore();
      }
    } else {
      for (const layer of sorted) {
        this.renderLayer(layer, progress);
      }
    }
  }
  /**
   * Render a single layer at a given progress.
   *
   * @param {object} layer - { id, name, visible, opacity, blendMode, strokes }
   * @param {number} progress - 0..1
   */
  renderLayer(layer, progress = 1) {
    if (!layer.visible) return;
    const ctx = this.ctx;
    const strokes = [...layer.strokes || []].sort((a2, b2) => (a2.order || 0) - (b2.order || 0));
    const total = strokes.length;
    const visibleCount = Math.ceil(total * progress);
    ctx.save();
    ctx.globalAlpha = layer.opacity !== void 0 ? layer.opacity : 1;
    if (layer.blendMode) {
      const bm = layer.blendMode === "normal" ? "source-over" : layer.blendMode;
      ctx.globalCompositeOperation = bm;
    }
    for (let i2 = 0; i2 < visibleCount; i2++) {
      const shape = strokes[i2];
      this.drawShapeAt(shape, 1);
    }
    if (this._paintSurfaceProvider) {
      const paintCanvas = this._paintSurfaceProvider(layer.id);
      if (paintCanvas) {
        const prevTransform = ctx.getTransform();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(paintCanvas, 0, 0);
        ctx.setTransform(prevTransform);
      }
    }
    ctx.restore();
  }
  /**
   * Draw a single shape using the registered style or default renderer.
   *
   * @param {object} shape - Shape object.
   * @param {number} [progress=1] - Per-shape reveal progress 0..1.
   */
  drawShapeAt(shape, progress = 1) {
    if (!shape) return;
    const styleMod = this._styles[shape.style];
    if (styleMod && typeof styleMod.draw === "function") {
      styleMod.draw(this.ctx, shape, progress);
    } else {
      drawShape(this.ctx, shape, progress);
    }
  }
  /**
   * Render a flat (merged) image at arbitrary resolution.
   *
   * @param {Array<object>} layers
   * @param {number} width
   * @param {number} height
   * @param {object} [opts]
   * @returns {Promise<Blob>} Resolves with a PNG blob.
   */
  async exportImage(layers, width, height, opts = {}) {
    const exportCanvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : typeof document !== "undefined" ? document.createElement("canvas") : null;
    if (!exportCanvas) throw new Error("Cannot create canvas for export (no document)");
    exportCanvas.width = width;
    exportCanvas.height = height;
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) throw new Error("Cannot get 2D context for export");
    const oldW = this.width;
    const oldH = this.height;
    const oldCtx = this.ctx;
    const oldBg = this.background;
    this.ctx = exportCtx;
    this.setSize(width, height);
    this.background = opts.background || oldBg;
    this.setLayers(layers);
    this.clear();
    this.renderAll({ progress: 1, clear: false });
    this.ctx = oldCtx;
    this.setSize(oldW, oldH);
    this.background = oldBg;
  }
  /**
   * Export a single named layer as a PNG blob.
   *
   * @param {Array<object>} layers - Layer list.
   * @param {string} layerName - The named layer to export.
   * @param {number} width
   * @param {number} height
   * @param {object} [opts]
   * @returns {Promise<Blob>} PNG blob of the isolated layer.
   */
  async exportLayerImage(layers, layerName, width, height, opts = {}) {
    var background = opts.background || this.background;
    var exportCanvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : typeof document !== "undefined" ? document.createElement("canvas") : null;
    if (!exportCanvas) throw new Error("Cannot create canvas for export (no document)");
    exportCanvas.width = width;
    exportCanvas.height = height;
    var exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) throw new Error("Cannot get 2D context for export");
    var oldW = this.width;
    var oldH = this.height;
    var oldCtx = this.ctx;
    var oldBg = this.background;
    this.ctx = exportCtx;
    this.setSize(width, height);
    this.background = background;
    this.clear();
    var target = (layers || []).find(function(l2) {
      return (l2._name || l2.name) === layerName;
    });
    if (target && target.visible) {
      this.renderLayer(target, 1);
    }
    this.ctx = oldCtx;
    this.setSize(oldW, oldH);
    this.background = oldBg;
    if (exportCanvas.convertToBlob) {
      return exportCanvas.convertToBlob({ type: "image/png" });
    }
    return new Promise(function(resolve) {
      exportCanvas.toBlob(resolve, "image/png");
    });
  }
  /**
   * Get the runtime source for embedding in self-contained HTML exports.
   * @returns {string}
   */
  static getRuntimeSource() {
    return getRuntimeSource();
  }
};
function createRenderer(target, opts = {}) {
  let ctx;
  if (target && target.getContext) {
    ctx = target.getContext("2d");
    opts.width = opts.width || target.width;
    opts.height = opts.height || target.height;
  } else if (target && target instanceof CanvasRenderingContext2D) {
    ctx = target;
  } else {
    throw new Error("createRenderer requires a canvas element or 2D context");
  }
  return new Renderer(ctx, opts);
}

// js/engine/style-alias.js
var STYLE_ALIAS = {
  "watercolor": "watercolour",
  "cross-hatch": "hatch",
  "graphic": "flat"
};
function aliasStyle(name) {
  return STYLE_ALIAS[name] || name;
}

// js/engine/exporter.js
async function exportImage(renderer, layers, opts = {}) {
  const {
    width = renderer.width,
    height = renderer.height,
    format = "png",
    quality = 0.92,
    background = "#ffffff"
  } = opts;
  return renderer.exportImage(layers, width, height, {
    type: `image/${format}`,
    quality,
    background
  });
}
async function exportAllLayersAsPNG(renderer, layers, width, height, opts = {}) {
  var result = {};
  for (const layer of layers) {
    var name = layer._name || layer.name;
    if (!name) continue;
    var blob = await renderer.exportLayerImage(layers, name, width, height, opts);
    result[name] = blob;
  }
  return result;
}
function packLayers(layers, styleList) {
  const allShapes = [];
  for (const layer of layers) {
    for (const s2 of layer.strokes || []) {
      allShapes.push({ ...s2, _layer: layer.id });
    }
  }
  const packed = [];
  for (const s2 of allShapes) {
    packed.push(packShape(s2, styleList));
  }
  const ELEMENTS_PER_SHAPE = 20;
  const buf = new Uint8Array(packed.length * ELEMENTS_PER_SHAPE);
  let offset = 0;
  for (const row of packed) {
    for (let i2 = 0; i2 < row.length; i2++) {
      buf[offset++] = Math.max(0, Math.min(255, Math.round(row[i2])));
    }
  }
  return base64Encode(buf);
}
function base64Encode(bytes) {
  const lookup = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let s2 = "";
  const len = bytes.length;
  for (let i2 = 0; i2 < len; i2 += 3) {
    const b0 = bytes[i2];
    const b1 = i2 + 1 < len ? bytes[i2 + 1] : 0;
    const b2 = i2 + 2 < len ? bytes[i2 + 2] : 0;
    s2 += lookup[b0 >> 2];
    s2 += lookup[(b0 & 3) << 4 | b1 >> 4];
    s2 += lookup[(b1 & 15) << 2 | b2 >> 6];
    s2 += lookup[b2 & 63];
  }
  const remainder = len % 3;
  if (remainder === 1) {
    s2 = s2.slice(0, -2) + "==";
  } else if (remainder === 2) {
    s2 = s2.slice(0, -1) + "=";
  }
  return s2;
}
function exportHTML(layers, opts = {}) {
  const {
    width = 1920,
    height = 1080,
    format = "packed",
    strokeDuration = 0.5,
    background = "#ffffff",
    styleList = []
  } = opts;
  let dataStr;
  if (format === "packed") {
    dataStr = packLayers(layers, styleList);
  } else {
    const allShapes = [];
    for (const layer of layers) {
      for (const s2 of layer.strokes || []) {
        allShapes.push(s2);
      }
    }
    dataStr = JSON.stringify(allShapes.map((s2) => ({
      t: s2.type,
      p: s2.params,
      c0: s2.color0,
      c1: s2.color1,
      a: s2.alpha,
      s: s2.style,
      l: s2.layer,
      o: s2.order
    })));
  }
  const runtime = getRuntimeSource();
  const totalStrokes = layers.reduce((sum, l2) => sum + (l2.strokes || []).length, 0);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WWW_PAINT Export</title>
<style>
html,body{margin:0;padding:0;background:${background};display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden}
canvas{max-width:100%;height:auto;image-rendering-pixelated}
</style>
</head>
<body>
<canvas id="c" width="${width}" height="${height}"></canvas>
<script>
${runtime}
(function(){
var canvas=document.getElementById('c'),ctx=canvas.getContext('2d');
var W=canvas.width,H=canvas.height;
var bg='${background}';
var data="${dataStr}";
var packed=${format === "packed"};
var strokeDuration=${strokeDuration};
var totalStrokes=${totalStrokes};
var styles={};

function decodePacked(b64){
var bytes=atob(b64);
var out=[];
for(var i=0;i<bytes.length;i+=20){
var d=[];
for(var j=0;j<20;j++)d.push(bytes.charCodeAt(i+j));
out.push({t:String.fromCharCode(d[0]),p:d.slice(1,9),c0:d.slice(9,12),c1:d.slice(12,15),a:d[15]/255,s:styles[d[16]]||'default',l:d[17],o:d[18],seed:d[19]});
}
return out;
}

var shapes=packed?decodePacked(data):JSON.parse(data);
shapes.sort(function(a,b){return (a.o||0)-(b.o||0);});

// Clear and fill background
ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);

// Progressive replay
var idx=0;
var startTime=null;
function frame(ts){
if(!startTime)startTime=ts;
var elapsed=(ts-startTime)/1000;
var target=Math.min(shapes.length,Math.floor(elapsed/strokeDuration));
while(idx<target){
var sh=shapes[idx];
if(RUNTIME&&RUNTIME.draw){
sh.a=sh.a||1;
sh.c0=sh.c0;
sh.c1=sh.c1;
RUNTIME.draw({createContext:function(){return ctx},createLinearGradient:ctx.createLinearGradient.bind(ctx),createRadialGradient:ctx.createRadialGradient.bind(ctx),fillRect:ctx.fillRect.bind(ctx),ellipse:ctx.ellipse.bind(ctx),fill:ctx.fill.bind(ctx),stroke:ctx.stroke.bind(ctx),beginPath:ctx.beginPath.bind(ctx),moveTo:ctx.moveTo.bind(ctx),lineTo:ctx.lineTo.bind(ctx),quadraticCurveTo:ctx.quadraticCurveTo.bind(ctx),closePath:ctx.closePath.bind(ctx),save:ctx.save.bind(ctx),restore:ctx.restore.bind(ctx),translate:ctx.translate.bind(ctx),rotate:ctx.rotate.bind(ctx),globalAlpha:Object.getOwnPropertyDescriptor(ctx,'globalAlpha'),lineWidth:Object.getOwnPropertyDescriptor(ctx,'lineWidth'),lineCap:Object.getOwnPropertyDescriptor(ctx,'lineCap'),strokeStyle:Object.getOwnPropertyDescriptor(ctx,'strokeStyle'),fillStyle:Object.getOwnPropertyDescriptor(ctx,'fillStyle')},sh);
}
idx++;
}
// Apply per-shape alpha in a simpler way:
if(idx>=shapes.length){cancelAnimationFrame(rafId);return;}
var rafId=requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
<\/script>
</body>
</html>`;
}
function exportProject(layers, settings, opts = {}) {
  const {
    width = 1920,
    height = 1080,
    background = "#ffffff",
    imageData = null
  } = opts;
  const project = {
    version: "1.0",
    width,
    height,
    background,
    image: imageData || "",
    layers: layers.map((layer) => ({
      id: layer.id,
      name: layer.name || "",
      visible: layer.visible !== void 0 ? layer.visible : true,
      opacity: layer.opacity !== void 0 ? layer.opacity : 1,
      blendMode: layer.blendMode || "normal",
      locked: layer.locked || false,
      strokes: layer.strokes || []
    })),
    settings: { ...settings }
  };
  return JSON.stringify(project, null, 2);
}
function importProject(jsonStr) {
  const project = JSON.parse(jsonStr);
  if (!project.version || !Array.isArray(project.layers)) {
    throw new Error("Invalid project file format");
  }
  return project;
}
function exportSVG(layers, width, height, background = "#ffffff") {
  let shapesSVG = "";
  for (const layer of layers) {
    if (!layer.visible) continue;
    for (const s2 of layer.strokes || []) {
      shapesSVG += shapeToSVG(s2);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="${background}"/>
${shapesSVG}
</svg>`;
}

// js/styles/base.js
function rngFor(a2) {
  let h2 = 2166136261;
  for (let i2 = 0; i2 < 6; i2++) {
    h2 ^= Math.round((a2[i2] || 0) * 10);
    h2 = Math.imul(h2, 16777619);
  }
  let s2 = h2 >>> 0 || 1;
  return () => {
    s2 ^= s2 << 13;
    s2 >>>= 0;
    s2 ^= s2 >>> 17;
    s2 ^= s2 << 5;
    s2 >>>= 0;
    return s2 / 4294967296;
  };
}
var gaussR = (R2) => (R2() + R2() + R2() + R2() - 2) * 1.732;
var lerp2 = (a2, b2, t2) => a2 + (b2 - a2) * t2;
var clamp01 = (v2) => v2 < 0 ? 0 : v2 > 1 ? 1 : v2;
function hexRgb(h2) {
  const n2 = parseInt(h2.slice(1, 7), 16);
  return [n2 >> 16 & 255, n2 >> 8 & 255, n2 & 255];
}
function shade(h2, k2) {
  const [r2, g2, b2] = hexRgb(h2);
  const f2 = (v2) => Math.round(k2 < 0 ? v2 * (1 + k2) : v2 + (255 - v2) * k2);
  return `rgb(${f2(r2)},${f2(g2)},${f2(b2)})`;
}
function shade2(h2, k2) {
  const [r2, g2, b2] = hexRgb(h2);
  const f2 = (v2) => Math.round(k2 < 0 ? v2 * (1 + k2) : v2 + (255 - v2) * k2);
  return "#" + [f2(r2), f2(g2), f2(b2)].map((v2) => v2.toString(16).padStart(2, "0")).join("");
}
function mixHex(a2, b2, f2) {
  const A2 = hexRgb(a2), B2 = hexRgb(b2);
  const c2 = A2.map((v2, i2) => Math.round(v2 + (B2[i2] - v2) * f2));
  return "#" + c2.map((v2) => v2.toString(16).padStart(2, "0")).join("");
}
function rgbaOf(c2, a2) {
  const [r2, g2, b2] = c2.startsWith("#") ? hexRgb(c2) : c2.match(/\d+/g).map(Number);
  return `rgba(${r2},${g2},${b2},${Math.max(0, Math.min(1, a2))})`;
}
function rgbToHex([r2, g2, b2]) {
  return "#" + [r2, g2, b2].map((v2) => Math.max(0, Math.min(255, Math.round(v2))).toString(16).padStart(2, "0")).join("");
}
function quadPts(a2, u2 = 1, dir = 1, n2 = 24) {
  let [
    x0,
    y0,
    x1,
    y1,
    x2,
    y2
    /*w*/
  ] = a2;
  if (dir < 0) [x0, y0, x2, y2] = [x2, y2, x0, y0];
  const P2 = [];
  for (let i2 = 0; i2 <= n2; i2++) {
    const s2 = u2 * i2 / n2;
    const v2 = 1 - s2;
    P2.push([
      v2 * v2 * x0 + 2 * v2 * s2 * x1 + s2 * s2 * x2,
      v2 * v2 * y0 + 2 * v2 * s2 * y1 + s2 * s2 * y2
    ]);
  }
  return P2;
}
function normalAt(P2, i2) {
  const a2 = P2[Math.max(0, i2 - 1)];
  const b2 = P2[Math.min(P2.length - 1, i2 + 1)];
  const dx = b2[0] - a2[0];
  const dy = b2[1] - a2[1];
  const d2 = Math.hypot(dx, dy) || 1;
  return [-dy / d2, dx / d2];
}
function boxOf(P2) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i2 = 0; i2 < P2.length; i2 += 2) {
    if (P2[i2] < x0) x0 = P2[i2];
    if (P2[i2] > x1) x1 = P2[i2];
    if (P2[i2 + 1] < y0) y0 = P2[i2 + 1];
    if (P2[i2 + 1] > y1) y1 = P2[i2 + 1];
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
function inPoly(P2, px, py) {
  let c2 = false;
  for (let i2 = 0, j2 = P2.length - 2; i2 < P2.length; j2 = i2, i2 += 2) {
    const yi2 = P2[i2 + 1], yj = P2[j2 + 1];
    if (yi2 > py !== yj > py && px < (P2[j2] - P2[i2]) * (py - yi2) / (yj - yi2) + P2[i2]) c2 = !c2;
  }
  return c2;
}
function offsetPts(P2, off) {
  return P2.map((p2, i2) => {
    const a2 = P2[Math.max(0, i2 - 1)];
    const b2 = P2[Math.min(P2.length - 1, i2 + 1)];
    const dx = b2[0] - a2[0];
    const dy = b2[1] - a2[1];
    const l2 = Math.hypot(dx, dy) || 1;
    return [p2[0] - dy / l2 * off, p2[1] + dx / l2 * off];
  });
}
function hobbsGrow(pts, R2, sigma) {
  const out = [];
  const n2 = pts.length;
  for (let i2 = 0; i2 < n2; i2++) {
    const p2 = pts[i2];
    const q2 = pts[(i2 + 1) % n2];
    const dx = q2[0] - p2[0];
    const dy = q2[1] - p2[1];
    const len = Math.hypot(dx, dy) || 1;
    const d2 = gaussR(R2) * sigma * len * p2[2];
    out.push(p2);
    out.push([
      (p2[0] + q2[0]) / 2 - dy / len * d2,
      (p2[1] + q2[1]) / 2 + dx / len * d2,
      Math.max(0.25, Math.min(2, p2[2] * (1 + gaussR(R2) * 0.12)))
    ]);
  }
  return out;
}
function corners2(p2) {
  const [x2, y2, w2, h2, r2] = p2;
  const c2 = Math.cos(r2);
  const sn2 = Math.sin(r2);
  const o2 = [];
  for (const [u2, v2] of [[-w2 / 2, -h2 / 2], [w2 / 2, -h2 / 2], [w2 / 2, h2 / 2], [-w2 / 2, h2 / 2]]) {
    o2.push(x2 + u2 * c2 - v2 * sn2, y2 + u2 * sn2 + v2 * c2);
  }
  return o2;
}
function shapePoly(s2) {
  s2 = normalizeShape(s2);
  const p2 = s2.p;
  const out = [];
  if (s2.t === "E" || s2.t === "B") {
    const [x2, y2, rx, ry, r2] = p2;
    const c2 = Math.cos(r2);
    const n2 = Math.sin(r2);
    const m2 = Math.max(12, Math.min(40, Math.round((rx + ry) * 0.7)));
    for (let i2 = 0; i2 < m2; i2++) {
      const a2 = i2 / m2 * Math.PI * 2;
      const u2 = Math.cos(a2) * rx;
      const v2 = Math.sin(a2) * ry;
      out.push(x2 + u2 * c2 - v2 * n2, y2 + u2 * n2 + v2 * c2);
    }
  } else if (s2.t === "T") {
    out.push(...p2.slice(0, 6));
  } else if (s2.t === "R") {
    out.push(...corners2(p2));
  } else if (s2.t === "S") {
    const [x0, y0, x1, y1, x2, y2, w2] = p2;
    const hw = w2 / 2;
    const N2 = 10;
    const L2 = [];
    const R2 = [];
    const pt2 = (t2) => {
      const u2 = 1 - t2;
      return [u2 * u2 * x0 + 2 * u2 * t2 * x1 + t2 * t2 * x2, u2 * u2 * y0 + 2 * u2 * t2 * y1 + t2 * t2 * y2];
    };
    const tan = (t2) => {
      const dx = 2 * (1 - t2) * (x1 - x0) + 2 * t2 * (x2 - x1);
      const dy = 2 * (1 - t2) * (y1 - y0) + 2 * t2 * (y2 - y1);
      const d2 = Math.hypot(dx, dy) || 1;
      return [dx / d2, dy / d2];
    };
    for (let i2 = 0; i2 <= N2; i2++) {
      const t2 = i2 / N2;
      const [px, py] = pt2(t2);
      const [tx, ty] = tan(t2);
      L2.push([px - ty * hw, py + tx * hw]);
      R2.push([px + ty * hw, py - tx * hw]);
    }
    const capEnd = (cx, cy, base) => {
      const pts = [];
      for (let i2 = 1; i2 < 6; i2++) {
        const a2 = base - i2 / 6 * Math.PI;
        pts.push([cx + Math.cos(a2) * hw, cy + Math.sin(a2) * hw]);
      }
      return pts;
    };
    const [ex, ey] = pt2(1);
    const [sx, sy] = pt2(0);
    const [exd, eyd] = tan(1);
    const [sxd, syd] = tan(0);
    for (const q2 of L2) out.push(...q2);
    for (const q2 of capEnd(ex, ey, Math.atan2(exd, -eyd))) out.push(...q2);
    for (let i2 = R2.length - 1; i2 >= 0; i2--) out.push(...R2[i2]);
    for (const q2 of capEnd(sx, sy, Math.atan2(-sxd, syd))) out.push(...q2);
  }
  return out;
}
function shapeAxis2(s2) {
  s2 = normalizeShape(s2);
  const p2 = s2.p;
  const g2 = s2.t === "T" ? p2[6] : s2.t === "S" ? p2[7] : typeof p2[5] === "number" ? p2[5] : 0;
  const dx = Math.cos(g2);
  const dy = Math.sin(g2);
  if (s2.t === "E") {
    const d2 = p2[0] * dx + p2[1] * dy;
    const h2 = Math.hypot(p2[2] * Math.cos(g2 - p2[4]), p2[3] * Math.sin(g2 - p2[4]));
    return [dx, dy, d2 - h2, d2 + h2];
  }
  let pts;
  if (s2.t === "T") pts = p2.slice(0, 6);
  else if (s2.t === "R") pts = corners2(p2);
  else if (s2.t === "S") pts = p2.slice(0, 6);
  else pts = p2.slice(0, 4);
  const pad = s2.t === "S" ? p2[6] / 2 : 0;
  let m2 = 1e9, n2 = -1e9;
  for (let i2 = 0; i2 < pts.length; i2 += 2) {
    const d2 = pts[i2] * dx + pts[i2 + 1] * dy;
    if (d2 < m2) m2 = d2;
    if (d2 > n2) n2 = d2;
  }
  return [dx, dy, m2 - pad, n2 + pad];
}
function gradOf(ctx, shape, stops) {
  shape = normalizeShape(shape);
  let G2;
  if (shape.t === "B") {
    const [cx, cy, rx, ry] = shape.p;
    G2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, (rx + ry) / 2));
  } else {
    const [dx, dy, m2, n2] = shapeAxis2(shape);
    G2 = ctx.createLinearGradient(dx * m2, dy * m2, dx * n2, dy * n2);
  }
  for (const [o2, c2] of stops) G2.addColorStop(clamp01(o2), c2);
  return G2;
}
function outlinePath(ctx, q2) {
  q2 = normalizeShape(q2);
  const a2 = q2.p;
  ctx.beginPath();
  if (q2.t === "E" || q2.t === "B") {
    ctx.ellipse(a2[0], a2[1], Math.max(0.1, a2[2]), Math.max(0.1, a2[3]), a2[4], 0, 7);
    return;
  }
  const p2 = shapePoly(q2);
  ctx.moveTo(p2[0], p2[1]);
  for (let i2 = 2; i2 < p2.length; i2 += 2) ctx.lineTo(p2[i2], p2[i2 + 1]);
  ctx.closePath();
}
function raggedPath(q2, R2, amp, k2 = 1) {
  const P2 = shapePoly(q2);
  const b2 = boxOf(P2);
  const size = Math.max(b2.w, b2.h, 2);
  const step = Math.max(2, size / 28);
  const pts = [];
  const n2 = P2.length / 2;
  for (let i2 = 0; i2 < n2; i2++) {
    const ax = P2[i2 * 2];
    const ay = P2[i2 * 2 + 1];
    const j2 = (i2 + 1) % n2;
    const bx = P2[j2 * 2];
    const by = P2[j2 * 2 + 1];
    const m2 = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step));
    for (let s2 = 0; s2 < m2; s2++) {
      pts.push([ax + (bx - ax) * s2 / m2, ay + (by - ay) * s2 / m2]);
    }
  }
  const ph = R2() * 6.28;
  const f2 = 2 + Math.floor(R2() * 3);
  const Q2 = pts.map(([px, py], i2) => {
    const t2 = i2 / pts.length * 6.28;
    const w2 = 1 + amp * (Math.sin(f2 * t2 + ph) * 0.6 + (R2() - 0.5) * 0.8);
    return [b2.cx + (px - b2.cx) * w2 * k2, b2.cy + (py - b2.cy) * w2 * k2];
  });
  const path2 = new Path2D();
  const N2 = Q2.length;
  const mid = (i2) => [(Q2[i2 % N2][0] + Q2[(i2 + 1) % N2][0]) / 2, (Q2[i2 % N2][1] + Q2[(i2 + 1) % N2][1]) / 2];
  const m0 = mid(N2 - 1);
  path2.moveTo(m0[0], m0[1]);
  for (let i2 = 0; i2 < N2; i2++) {
    const m1 = mid(i2);
    path2.quadraticCurveTo(Q2[i2][0], Q2[i2][1], m1[0], m1[1]);
  }
  path2.closePath();
  return path2;
}
function normalizeShape(s2) {
  if (s2.t !== void 0) return s2;
  return {
    t: s2.type,
    p: s2.params,
    c0: s2.color0,
    c1: s2.color1,
    o: s2.alpha,
    s: s2.seed
  };
}
function colsOf(shape) {
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : shape.type === "T" ? 7 : 5;
  let c0 = a2[i2];
  let c1 = a2[i2 + 1];
  let o2 = a2[a2.length - 1];
  if (c0 === void 0) {
    c0 = shape.color0;
    c1 = shape.color1;
    o2 = shape.alpha;
  }
  return [
    Array.isArray(c0) ? rgbToHex(c0) : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? rgbToHex(c1) : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}

// js/engine/brush-stamp-engine.js
var _brush = null;
var _ready = false;
async function _loadBrush() {
  if (_brush) return _brush;
  try {
    _brush = await Promise.resolve().then(() => (init_brush_esm(), brush_esm_exports));
  } catch (err) {
    console.warn("[brush] failed to load p5.brush, fallback stamping will be used:", err.message);
    _brush = null;
  }
  return _brush;
}
var _offscreen = null;
var _offCtx = null;
var _adapter = null;
var _width = 0;
var _height = 0;
async function initBrushEngine(width, height) {
  _width = width;
  _height = height;
  const brush = await _loadBrush();
  if (!brush) {
    console.warn("[brush] init skipped \u2014 p5.brush not loaded");
    _ready = false;
    return false;
  }
  if (typeof OffscreenCanvas !== "undefined") {
    _offscreen = new OffscreenCanvas(width, height);
  } else {
    _offscreen = document.createElement("canvas");
    _offscreen.width = width;
    _offscreen.height = height;
  }
  _offCtx = _offscreen.getContext("2d");
  if (!_offCtx) {
    console.warn("[brush] cannot get 2d context from offscreen canvas");
    _ready = false;
    return false;
  }
  _adapter = _makeAdapter(brush, _offCtx, width, height);
  brush.h({
    createColor: _adapter.createColor,
    getAffineMatrix: _adapter.getAffineMatrix,
    notifyDraw: _adapter.notifyDraw,
    usesRadians: false,
    fromDegrees: (d2) => d2
  });
  brush.f({ Cwidth: width, Cheight: height, Density: 1 });
  brush.u = {
    load: () => {
    },
    syncDensity: () => _adapter.Density,
    isCanvasReady: () => true,
    instance: (opts = {}) => _adapter.instance(opts),
    activateInstance: (inst) => _adapter.activateInstance(inst),
    deactivateInstance: () => _adapter.deactivateInstance(),
    getActiveFramebuffer: () => null,
    isFramebufferTarget: () => false
  };
  brush.b = {
    clearTarget: () => {
    },
    ensureBlendShaderProgram: () => {
    },
    ensureBlendSourceFramebuffer: () => ({}),
    createFramebuffer: (w2, h2) => _makeFbo(_offCtx, w2, h2),
    runBlendShaderPass: () => {
    },
    blitSourceToFramebuffer: () => {
    }
  };
  try {
    brush.load(_offscreen);
  } catch (e2) {
    try {
      brush.load(_offscreen, 1);
    } catch (e22) {
      console.warn("[brush] standalone load failed, continuing without init:", e22.message);
    }
  }
  _ready = true;
  return true;
}
function _stampBezierStroke(brush, a2, progress) {
  const [x0, y0, x1, y1, x2, y2] = [a2[0], a2[1], a2[2], a2[3], a2[4], a2[5]];
  const steps = 50;
  brush.moveTo(x0, y0);
  for (let i2 = 1; i2 <= Math.floor(steps * progress); i2++) {
    const t2 = i2 / steps;
    const mt2 = 1 - t2;
    const x3 = mt2 * mt2 * x0 + 2 * mt2 * t2 * x1 + t2 * t2 * x2;
    const y3 = mt2 * mt2 * y0 + 2 * mt2 * t2 * y1 + t2 * t2 * y2;
    brush.line(x3, y3);
  }
  brush.endStroke();
}
function _stampAreaFill(brush, shape, color, alpha) {
  try {
    if (typeof brush.hatch !== "function" || typeof brush.hatchStyle !== "function") return;
    const poly2 = _shapePoly(shape);
    if (!poly2 || poly2.length < 3) return;
    const bbox = _bbox(poly2);
    const gap = Math.max(1.5, Math.min(bbox.w, bbox.h) * 0.03);
    brush.hatchStyle("cpencil", color, 3);
    brush.hatch(gap, -0.95, { rand: true, continuous: false });
    const lines = _scanPoly(poly2, gap);
    for (const [x1, y1, x2, y2] of lines) {
      brush.moveTo(x1, y1);
      brush.lineTo(x2, y2);
      brush.endStroke();
    }
    brush.noHatch();
  } catch (e2) {
  }
}
function _shapePoly(shape) {
  const t2 = shape.type;
  const a2 = shape.params;
  if (t2 === "S") return [[a2[0], a2[1]], [a2[4], a2[5]], [a2[2], a2[3]]];
  if (t2 === "E") {
    const [cx, cy, rx, ry] = [a2[0], a2[1], a2[2], a2[3]];
    const pts = [];
    for (let i2 = 0; i2 < 24; i2++) {
      const th = i2 / 24 * Math.PI * 2;
      pts.push([cx + Math.cos(th) * rx, cy + Math.sin(th) * ry]);
    }
    return pts;
  }
  if (t2 === "R") {
    const [x2, y2, w2, h2, rot] = [a2[0], a2[1], a2[2], a2[3], a2[4] || 0];
    const c2 = Math.cos(rot), s2 = Math.sin(rot);
    const corners3 = [[-w2 / 2, -h2 / 2], [w2 / 2, -h2 / 2], [w2 / 2, h2 / 2], [-w2 / 2, h2 / 2]];
    return corners3.map(([px, py]) => [x2 + px * c2 - py * s2, y2 + px * s2 + py * c2]);
  }
  if (t2 === "T") return [[a2[0], a2[1]], [a2[2], a2[3]], [a2[4], a2[5]]];
  if (t2 === "B") {
    const [cx, cy, rx, ry, feather] = [a2[0], a2[1], a2[2], a2[3], a2[4] || 0];
    const pts = [];
    for (let i2 = 0; i2 < 24; i2++) {
      const th = i2 / 24 * Math.PI * 2;
      const wobble = 1 + Math.sin(th * 3) * feather * 0.3;
      pts.push([cx + Math.cos(th) * rx * wobble, cy + Math.sin(th) * ry * wobble]);
    }
    return pts;
  }
  return [];
}
function _bbox(poly2) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x2, y2] of poly2) {
    if (x2 < x0) x0 = x2;
    if (y2 < y0) y0 = y2;
    if (x2 > x1) x1 = x2;
    if (y2 > y1) y1 = y2;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
function _scanPoly(poly2, gap) {
  const lines = [];
  let minY = Infinity, maxY = -Infinity;
  for (const p2 of poly2) {
    if (p2[1] < minY) minY = p2[1];
    if (p2[1] > maxY) maxY = p2[1];
  }
  for (let y2 = Math.floor(minY); y2 <= Math.ceil(maxY); y2 += gap) {
    const xs = [];
    for (let i2 = 0, j2 = poly2.length - 1; i2 < poly2.length; j2 = i2++) {
      const [xi2, yi2] = poly2[i2], [xj, yj] = poly2[j2];
      if (yi2 > y2 !== yj > y2) {
        xs.push(xj + (y2 - yj) * (xi2 - xj) / (yi2 - yj));
      }
    }
    if (xs.length >= 2) {
      xs.sort((a2, b2) => a2 - b2);
      for (let k2 = 0; k2 < xs.length - 1; k2 += 2) {
        lines.push([xs[k2], y2, xs[k2 + 1], y2]);
      }
    }
  }
  return lines;
}
function clamp255(v2) {
  return v2 < 0 ? 0 : v2 > 255 ? 255 : Math.round(v2);
}
function _makeAdapter(brush, ctx, width, height) {
  let activeInstance = null;
  function createColor(r2, g2, b2, a2 = 1) {
    return { r: r2 / 255, g: g2 / 255, b: b2 / 255, a: a2 };
  }
  function getAffineMatrix() {
    return { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
  }
  function notifyDraw() {
  }
  function instance(opts = {}) {
    return {
      canvas: _offscreen,
      ctx,
      width,
      height,
      brushName: opts.brushName || "cpencil",
      color: opts.color,
      size: opts.size || 10,
      opacity: opts.opacity ?? 1,
      angle: opts.angle || 0,
      scatter: opts.scatter || 0,
      spacing: opts.spacing || 0.2,
      pressure: opts.pressure || [],
      grain: opts.grain || 0,
      _x: 0,
      _y: 0,
      _step: 0,
      _total: 0
    };
  }
  function activateInstance(inst) {
    activeInstance = inst;
  }
  function deactivateInstance() {
    activeInstance = null;
  }
  function makeFbo(w2, h2) {
    const c2 = document.createElement("canvas");
    c2.width = w2;
    c2.height = h2;
    return c2;
  }
  return {
    createColor,
    getAffineMatrix,
    notifyDraw,
    Density: 1,
    instance,
    activateInstance,
    deactivateInstance,
    _active: null
  };
}
function stampStrokeSync(mainCtx, shape, opts = {}) {
  if (!_ready || !_adapter || !_brush) {
    return false;
  }
  const a2 = shape.params || [];
  const brushName = opts.brushName || shape.brushName || "cpencil";
  const colorArr = Array.isArray(shape.color) ? shape.color : shape.color0 && Array.isArray(shape.color0) ? shape.color0 : [0, 0, 0];
  const alpha = shape.alpha ?? opts.alpha ?? 1;
  const size = Math.max(1.5, Math.min(40, a2[6] || opts.size || 10));
  const brushColor = _adapter.createColor(
    clamp255(colorArr[0]),
    clamp255(colorArr[1]),
    clamp255(colorArr[2]),
    alpha
  );
  _offCtx.setTransform(1, 0, 0, 1, 0, 0);
  _offCtx.clearRect(0, 0, _width, _height);
  const inst = _brush.instance({
    brushName,
    color: brushColor,
    size,
    opacity: alpha,
    angle: opts.angle || 0,
    scatter: opts.scatter ?? 0.4,
    spacing: opts.spacing ?? 0.15,
    grain: opts.grain ?? 0.25,
    pressure: opts.pressure || { curve: [0.15, 0.2], min_max: [0.6, 1.05] }
  });
  _brush.activateInstance(inst);
  _adapter._active = inst;
  try {
    if (shape.type === "S") {
      _stampBezierStroke(_brush, a2, opts.progress || 1);
    } else {
      _stampAreaFill(_brush, shape, brushColor, alpha);
    }
  } catch (e2) {
    console.warn("[brush] stamp error, falling back:", e2.message);
    return false;
  } finally {
    _brush.deactivateInstance();
    _adapter._active = null;
  }
  mainCtx.save();
  mainCtx.globalAlpha = alpha;
  mainCtx.drawImage(_offscreen, 0, 0);
  mainCtx.restore();
  return true;
}
function isBrushReady() {
  return _ready;
}

// js/styles/pencil.js
var PencilStyle = class {
  name = "pencil";
  category = "draw";
  description = "Coloured-pencil lines on paper: stamped, grainy, with a light-firm-light pressure profile. Areas shaded with close parallel strokes.";
  defaults = {
    strokeSize: { min: 4, max: 24 },
    spacing: 0.3,
    // stamp spacing as a fraction of brush width
    scatter: 0.55,
    // sideways drift of stamps (0 = clean line)
    sharp: 0.4,
    // stamp-shape sharpness (affects scatter)
    grain: 0.3,
    // fraction of stamps skipped (0 = solid, 0.5 = very broken)
    pressure: { min: 0.55, max: 1.1, peak: 0.4 },
    // pressure profile
    peakJitter: 0.2,
    // random shift of the pressure peak
    hwJitter: 0.3,
    // random shift of the pressure half-width
    secondPassAlpha: 0.5,
    secondPassScatter: 0.9,
    minStep: 0.5,
    maxSteps: 200,
    hatchGap: 1.7,
    // gap between hatching strokes (times stroke width)
    hatchJitter: 0.15
    // random jitter in hatching position
  };
  /**
   * Propose candidate strokes for this style.
   * @param {object} analyzer - Image analyzer with edges[], regions[]
   * @param {object} params - User/style parameters
   * @returns {Array} shape candidates
   */
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 200)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(...this._makeHatching(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width, so the same
   * edge always produces the same stroke geometry.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeHatching(region, color) {
    const R2 = rngFor([region.cx, region.cy, region.w, region.h, 0, 0]);
    const strokes = [];
    const size = Math.max(region.w, region.h);
    const w2 = lerp2(this.defaults.strokeSize.min * 0.6, this.defaults.strokeSize.max * 0.8, R2());
    const gap = w2 * this.defaults.hatchGap;
    const half = size * 0.75;
    const ang = -0.95 + (R2() - 0.5) * 0.3;
    const cs = Math.cos(ang);
    const sn2 = Math.sin(ang);
    const rot = (px, py) => [region.cx + px * cs - py * sn2, region.cy + px * sn2 + py * cs];
    for (let y2 = -half; y2 <= half; y2 += gap * (0.85 + R2() * 0.3)) {
      const j2 = (R2() - 0.5) * gap * this.defaults.hatchJitter;
      const p0 = rot(-half + R2() * size * 0.15, y2 + j2);
      const mid = rot(0, y2);
      const p1 = rot(half - R2() * size * 0.15, y2 - j2);
      strokes.push({
        type: "S",
        params: [p0[0], p0[1], mid[0], mid[1], p1[0], p1[1], w2, ang, color, color, 1],
        seed: [p0[0], p0[1], p1[0], p1[1], w2, y2]
      });
    }
    return strokes;
  }
  /**
   * Render a pencil stroke or area.
   *
   * Tries the p5.brain (p5.brush) engine via stampStrokeSync() first for
   * authentic brush dynamics. If p5.brush is not ready or stampStroke
   * returns false, falls back to the custom _renderStroke / _renderArea
   * stamped-brush implementation.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape - {type, params, seed, color, alpha}
   * @param {number} progress - 0..1
   */
  render(ctx, shape, progress = 1) {
    const a2 = shape.params;
    if (shape.type === "S") {
      const R2 = rngFor(shape.seed || a2.slice(0, 8));
      if (isBrushReady()) {
        const ok = stampStrokeSync(ctx, shape, {
          brushName: "pencil",
          color: shape.color0 || a2[8] || [0, 0, 0],
          alpha: shape.alpha ?? a2[a2.length - 1] ?? 1,
          size: a2[6],
          progress
        });
        if (ok) return;
      }
      this._renderStroke(ctx, shape, R2, progress);
    } else {
      const R2 = rngFor(a2.slice(0, 6).map((v2, i2) => (v2 || 0) + (shape.seed ? shape.seed[i2] || 0 : 0)));
      this._renderArea(ctx, shape, R2);
    }
  }
  _renderStroke(ctx, shape, R2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(1.5, Math.min(30, a2[6]));
    const P2 = quadPts(a2, progress, 1, 20);
    const fill = a2[8] !== void 0 ? a2[8] : shape.color0 ? Array.isArray(shape.color0) ? rgbToHex(shape.color0) : shape.color0 : "#000000";
    const pen1 = {
      w: w2 * 1.15,
      spacing: 0.3,
      scatter: 0.55,
      sharp: 0.4,
      grain: 0.3,
      pmin: 0.55,
      pmax: 1.1,
      peak: 0.4,
      hw: 0.5,
      alpha: a2[a2.length - 1],
      salt: 1,
      upto: progress,
      maxSteps: 200
    };
    const set1 = this._stampBuild(P2, pen1, R2);
    const side = w2 * 0.5 * (R2() < 0.5 ? 1 : -1);
    const P22 = offsetPts(P2, side);
    const pen2 = {
      w: w2 * 0.7,
      spacing: 0.3,
      scatter: this.defaults.secondPassScatter,
      sharp: 0.4,
      grain: 0.5,
      pmin: 0.55,
      pmax: 1.1,
      peak: 0.4,
      hw: 0.5,
      alpha: a2[a2.length - 1] * this.defaults.secondPassAlpha,
      salt: 2,
      upto: progress,
      maxSteps: 200
    };
    const set2 = this._stampBuild(P22, pen2, R2);
    const fillStr = typeof fill === "string" ? fill : Array.isArray(fill) ? rgbToHex(fill) : "#000000";
    ctx.save();
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.fillStyle = fillStr;
    ctx.globalAlpha = Math.min(1, set1.base);
    ctx.fill(set1.A);
    ctx.globalAlpha = Math.min(1, set1.base * 0.5);
    ctx.fill(set1.B);
    ctx.globalAlpha = Math.min(1, set2.base);
    ctx.fill(set2.A);
    ctx.globalAlpha = Math.min(1, set2.base * 0.5);
    ctx.fill(set2.B);
    ctx.restore();
  }
  /**
   * Core stamped-brush builder.
   * Walks `lines` (array of polylines), stamps tips with pressure + grain +
   * scatter. Returns { A, B, st, base } where A is the main stamped path, B the
   * secondary (scatter) path, and base is the base alpha.
   * Mirrors Code Painter's stampBuild.
   */
  _stampBuild(lines, o2, R2) {
    const seed0 = o2.args ? o2.args.slice(0, 6).map((v2) => (v2 || 0) + o2.salt * 0.5) : [o2.salt || 1, 0, 0, 0, 0, 0];
    const rnd = rngFor(seed0);
    const A2 = new Path2D();
    const B2 = new Path2D();
    const st2 = [];
    const all = Array.isArray(o2) ? [o2] : lines[0] && typeof lines[0][0] === "number" ? [lines] : lines;
    for (const P2 of all) {
      const n2 = P2.length;
      if (n2 < 2) continue;
      const cum = [0];
      for (let i2 = 1; i2 < n2; i2++) cum.push(cum[i2 - 1] + Math.hypot(P2[i2][0] - P2[i2 - 1][0], P2[i2][1] - P2[i2 - 1][1]));
      const L2 = cum[n2 - 1];
      if (L2 < 0.01) continue;
      const step = Math.max(o2.minStep || 0.5, o2.w * o2.spacing);
      const steps = Math.min(o2.maxSteps || 240, Math.max(2, Math.ceil(L2 / step)));
      const peak = o2.peak + (R2() - 0.5) * 0.2;
      const hw = o2.hw * (0.85 + R2() * 0.3);
      const c2 = 1 + R2() * 0.6;
      let j2 = 1;
      for (let k2 = 0; k2 <= steps; k2++) {
        const t2 = k2 / steps;
        if (t2 > o2.upto) break;
        const d2 = t2 * L2;
        while (j2 < n2 - 1 && cum[j2] < d2) j2++;
        const seg = cum[j2] - cum[j2 - 1] || 1;
        const f2 = (d2 - cum[j2 - 1]) / seg;
        const px = P2[j2 - 1][0] + (P2[j2][0] - P2[j2 - 1][0]) * f2;
        const py = P2[j2 - 1][1] + (P2[j2][1] - P2[j2 - 1][1]) * f2;
        const pr2 = o2.pmin + (o2.pmax - o2.pmin) / (1 + Math.pow(Math.abs((t2 - peak) / hw), 2 * c2));
        if (R2() < o2.grain * (0.62 - 0.4 * Math.min(1, pr2))) continue;
        const [nx, ny] = normalAt(P2, j2);
        const sc = gaussR(R2) * o2.scatter * o2.w * 0.5 * (1.15 - o2.sharp * 0.5);
        const par = (R2() - 0.5) * step;
        const r2 = Math.max(0.4, o2.w * 0.5 * (0.4 + 0.6 * Math.min(1.1, pr2)) * (0.8 + R2() * 0.4));
        const sx = px - ny * sc + nx * par;
        const sy = py + nx * sc + ny * par;
        const Q2 = R2() < 0.55 ? A2 : B2;
        if (r2 < 1.5) {
          Q2.rect(sx - r2, sy - r2, r2 * 2, r2 * 2);
        } else {
          Q2.moveTo(sx + r2, sy);
          Q2.arc(sx, sy, r2, 0, 7);
        }
        st2.push(sx, sy, r2, Q2 === A2 ? 0 : 1, t2);
      }
    }
    return { A: A2, B: B2, st: st2, base: o2.alpha * (0.8 + R2() * 0.2) };
  }
  /**
   * Area hatching: parallel stamped strokes across a filled shape.
   * Mirrors Code Painter's pencil area-shading approach.
   */
  _renderArea(ctx, shape, R2) {
    const a2 = shape.params;
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const size = Math.max(b2.w, b2.h, 2);
    const lw = Math.max(0.8, Math.min(2.4, size * 0.02));
    const gap = lw * 1.7;
    const half = size * 0.75;
    const ang = -0.95 + (R2() - 0.5) * 0.3;
    const cs = Math.cos(ang);
    const sn2 = Math.sin(ang);
    const rot = (px, py) => [b2.cx + px * cs - py * sn2, b2.cy + px * sn2 + py * cs];
    const fill = a2[6] !== void 0 ? a2[6] : shape.color0 ? Array.isArray(shape.color0) ? rgbToHex(shape.color0) : shape.color0 : "#000000";
    const fillStr = typeof fill === "string" ? fill : Array.isArray(fill) ? rgbToHex(fill) : "#000000";
    ctx.save();
    ctx.lineCap = ctx.lineJoin = "round";
    outlinePath(ctx, shape);
    ctx.clip();
    const passes = size > 40 && R2() < 0.5 ? 2 : 1;
    for (let pass = 0; pass < passes; pass++) {
      const lines = [];
      for (let y2 = -half; y2 <= half; y2 += gap * (0.85 + R2() * 0.3)) {
        const j2 = (R2() - 0.5) * gap * 0.4;
        lines.push([rot(-half + R2() * size * 0.15, y2 + j2), rot(half - R2() * size * 0.15, y2 - j2)]);
      }
      for (const [p0, p1] of lines) {
        const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
        const pen = {
          w: lw * 1.9,
          spacing: 0.7,
          scatter: 0.55,
          sharp: 0.4,
          grain: 0.3,
          pmin: 0.55,
          pmax: 1.1,
          peak: 0.5,
          hw: 0.5,
          alpha: a2[a2.length - 1] * (pass ? 0.55 : 0.95),
          salt: 3 + pass,
          maxSteps: Math.max(4, Math.min(60, Math.round(700 / (lines.length || 1))))
        };
        const set = this._stampBuild([[p0, mid, p1]], pen, R2);
        ctx.globalAlpha = Math.min(1, set.base);
        ctx.fill(set.A);
        ctx.globalAlpha = Math.min(1, set.base * 0.5);
        ctx.fill(set.B);
      }
    }
    ctx.restore();
  }
};
var pencil_default = PencilStyle;

// js/styles/ink.js
function resolveColors(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c0 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c1 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o2 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c0, c1, o2];
  }
  return colsOf(shape);
}
var InkStyle = class {
  name = "ink";
  category = "paint";
  description = "A loaded ink brush: strokes swell and taper, tails breaking into dry streaks. Filled areas pool denser at the rim with a ragged feathered edge.";
  defaults = {
    strokeSize: { min: 4, max: 24 },
    taper: 0.55,
    // how strongly the stroke narrows at the ends (0=uniform, 1=full taper)
    hairCount: 7,
    // number of dry-hair streaks in the tail
    tailStart: 0.66,
    // fraction along the stroke where the loaded part ends
    poolRimDarken: 0.3,
    // darkening at the ink pool rim
    poolFeather: 0.035
    // edge fray amount for pools
  };
  /**
   * Propose candidate strokes for this style.
   * @param {object} analyzer - Image analyzer with edges[], regions[]
   * @param {object} params - User/style parameters
   * @returns {Array} shape candidates
   */
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 200)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makePool(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makePool(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const w2 = Math.max(region.w, region.h) * 0.3;
    return {
      type: "E",
      params: [region.cx, region.cy, w2, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, w2, 0, 0, 0]
    };
  }
  /**
   * Render an ink-brush stroke or pool.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape - {type, params, seed}
   * @param {number} progress - 0..1 animation progress
   */
  render(ctx, shape, progress = 1) {
    const R2 = rngFor(shape.seed || shape.params.slice(0, 6));
    const [c0, c1, o2] = resolveColors(shape);
    ctx.save();
    ctx.lineCap = ctx.lineJoin = "round";
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, R2, c0, c1, o2, progress);
    } else {
      this._renderPool(ctx, shape, R2, c0, c1, o2);
    }
    ctx.restore();
  }
  /**
   * Render a single ink-brush stroke: loaded ribbon + dry-hair tail.
   *
   * The loaded part swells in the middle and tapers at the start.
   * The dry-hair tail breaks into separate streaks that fade out.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0 - Color (hex)
   * @param {string} c1 - Color (hex)
   * @param {number} o - Opacity
   * @param {number} progress - 0..1
   */
  _renderStroke(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = a2[6];
    const P2 = quadPts(a2, progress, 1, 28);
    const n2 = P2.length;
    if (n2 < 3) return;
    const cut = Math.round((n2 - 1) * this.defaults.tailStart);
    const wid = (i2) => w2 * (0.22 + 0.9 * Math.pow(
      Math.sin(Math.PI * Math.min(1, i2 / (n2 - 1) * progress * 0.92 + 0.06)),
      0.55
    ));
    const L2 = [];
    const Rt2 = [];
    const loadN = Math.min(cut, n2 - 1);
    for (let i2 = 0; i2 <= loadN; i2++) {
      const [nx, ny] = normalAt(P2, i2);
      const h2 = wid(i2) / 2;
      L2.push([P2[i2][0] + nx * h2, P2[i2][1] + ny * h2]);
      Rt2.push([P2[i2][0] - nx * h2, P2[i2][1] - ny * h2]);
    }
    ctx.globalAlpha = o2;
    ctx.fillStyle = c0;
    ctx.beginPath();
    L2.forEach(([px, py], i2) => ctx[i2 ? "lineTo" : "moveTo"](px, py));
    for (let i2 = Rt2.length - 1; i2 >= 0; i2--) ctx.lineTo(Rt2[i2][0], Rt2[i2][1]);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = o2;
    ctx.fillStyle = shade(c0, -0.18);
    ctx.beginPath();
    ctx.arc(P2[0][0], P2[0][1], wid(0) * 0.6, 0, 7);
    ctx.fill();
    if (n2 - 1 > cut && progress > this.defaults.tailStart) {
      const hairs = this.defaults.hairCount;
      const tailProgress = (progress - this.defaults.tailStart) / (1 - this.defaults.tailStart);
      for (let h2 = 0; h2 < hairs; h2++) {
        const off = ((h2 + 0.5) / hairs - 0.5) * wid(cut) * 0.95;
        const stop = cut + Math.round((n2 - 1 - cut) * tailProgress * (0.45 + R2() * 0.55));
        const hairWidth = Math.max(0.6, wid(cut) / hairs * (0.9 + R2() * 0.8));
        ctx.globalAlpha = o2 * (0.55 + R2() * 0.4);
        ctx.strokeStyle = c0;
        ctx.lineWidth = hairWidth;
        ctx.beginPath();
        for (let i2 = cut - 1; i2 <= stop; i2++) {
          const [nx, ny] = normalAt(P2, i2);
          const k2 = off * wid(i2) / Math.max(0.1, wid(cut));
          const px = P2[i2][0] + nx * k2;
          const py = P2[i2][1] + ny * k2;
          if (i2 === cut - 1) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
  }
  /**
   * Render an ink pool (for E/B/T/R shapes):
   * a radial gradient denser at the rim, with a ragged feathered edge.
   * Uses raggedPath from base.js for the frayed, natural-looking edge.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0 - Start color (hex)
   * @param {string} c1 - End color (hex)
   * @param {number} o - Opacity
   */
  _renderPool(ctx, shape, R2, c0, c1, o2) {
    const path2 = raggedPath(shape, R2, this.defaults.poolFeather);
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const r2 = Math.max(1, Math.max(b2.w, b2.h) / 2);
    const G2 = ctx.createRadialGradient(b2.cx, b2.cy, 0, b2.cx, b2.cy, r2);
    G2.addColorStop(0, rgbaOf(c0, 0.62 * o2));
    G2.addColorStop(0.75, rgbaOf(mixHex(c0, c1, 0.3), 0.72 * o2));
    G2.addColorStop(1, rgbaOf(shade2(c0, -0.2), 0.9 * o2));
    ctx.fillStyle = G2;
    ctx.fill(path2);
    ctx.globalAlpha = o2 * 0.35;
    ctx.strokeStyle = shade(c0, -0.3);
    ctx.lineWidth = Math.max(0.6, r2 * 0.04);
    ctx.stroke(path2);
  }
};
var ink_default = InkStyle;

// js/styles/watercolor.js
var WET_TILE = { cv: null, x: null };
var WatercolorStyle = class {
  name = "watercolor";
  category = "paint";
  description = "Transparent glazes that wander, fractal-edged outlines from stacked washes, granulation, and a wet bead of pigment at the tip and rim.";
  defaults = {
    strokeSize: { min: 3, max: 20 },
    layers: 12,
    // number of stacked transparent washes (area) — was 8
    sigma: 0.135,
    // hobbsGrow displacement amount — increased from 0.115
    glazeAlpha: 0.12,
    // alpha per glaze layer — more transparent
    tideDarken: 0.32,
    // tide line darken factor
    granulation: 0.18,
    // granulation opacity — toned down for subtlety
    granulationCount: 120,
    // number of granulation speckles per wash
    beadSize: 0.55,
    // wet bead radius factor (tip)
    rimBeadDarken: 0.45,
    // wet bead darkening at rim (edge pooling)
    strokeLayers: 4,
    // glaze passes for stroke rendering
    dryRun: false
    // skip WebGL-style tile compositing for simplicity
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 200)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeWash(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeWash(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const w2 = Math.max(region.w, region.h) * 0.5;
    return {
      type: "E",
      params: [region.cx, region.cy, w2, w2, 0, c2, c2, 1],
      seed: [region.cx, region.cy, w2, 0, 0, 0]
    };
  }
  render(ctx, shape, progress = 1) {
    const a2 = shape.params;
    const R2 = rngFor(shape.seed || a2.slice(0, Math.min(a2.length, 9)));
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, R2, progress);
    } else {
      this._renderWash(ctx, shape, R2);
    }
  }
  /**
   * Watercolour stroke: 4 stacked transparent glazes on a wobbling ribbon,
   * with a tide line, granulation, and a wet bead at the tip.
   * Faithful to Code Painter's `watercolour` style.
   */
  _renderStroke(ctx, shape, R2, progress) {
    const [c0, c1, o2] = colsOf(shape);
    const a2 = shape.params;
    const w2 = a2[6];
    const P2 = quadPts(a2, progress, 1, 32);
    ctx.save();
    ctx.lineJoin = "round";
    let outer = null;
    for (let L2 = 0; L2 < this.defaults.strokeLayers; L2++) {
      const rib = this._paintRibbon(P2, (s2) => w2 * (0.62 + 0.38 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + 0.92 * s2 * progress)), 0.35)) * (1 - L2 * 0.07), R2, 0.16, L2 * 1.7);
      if (L2 === 0) outer = rib;
      ctx.globalAlpha = o2 * 0.2;
      ctx.fillStyle = mixHex(c0, c1, L2 / 3);
      ctx.fill(rib);
    }
    ctx.globalAlpha = o2 * this.defaults.tideDarken;
    ctx.strokeStyle = shade(mixHex(c0, c1, 0.5), -0.32);
    ctx.lineWidth = Math.max(0.6, w2 * 0.05);
    ctx.stroke(outer);
    ctx.save();
    ctx.clip(outer);
    ctx.globalAlpha = o2 * this.defaults.granulation;
    ctx.fillStyle = shade(c0, -0.35);
    ctx.beginPath();
    const len = P2.length;
    const dots = Math.min(this.defaults.granulationCount, Math.round(w2 * len * 0.25));
    const d2 = Math.max(0.45, w2 * 0.025);
    for (let i2 = 0; i2 < dots; i2++) {
      const p2 = P2[Math.floor(R2() * len)];
      const j2 = (R2() - 0.5) * w2;
      const [nx, ny] = normalAt(P2, Math.floor(R2() * len));
      const cx = p2[0] + nx * j2 + d2;
      const cy = p2[1] + ny * j2;
      ctx.moveTo(cx + d2 * (0.5 + R2()), cy);
      ctx.arc(cx, cy, d2 * (0.5 + R2()), 0, 7);
    }
    ctx.fill();
    ctx.restore();
    const e2 = P2[P2.length - 1];
    const beadR = w2 * this.defaults.beadSize;
    const G2 = ctx.createRadialGradient(e2[0], e2[1], 0, e2[0], e2[1], beadR);
    G2.addColorStop(0, rgbaOf(shade2(c1, -0.15), 0.32 * o2));
    G2.addColorStop(1, rgbaOf(c1, 0));
    ctx.globalAlpha = 1;
    ctx.fillStyle = G2;
    ctx.beginPath();
    ctx.arc(e2[0], e2[1], beadR, 0, 7);
    ctx.fill();
    ctx.restore();
  }
  /**
   * Watercolor wash (for filled shapes): stacked transparent layers with
   * fractal (hobbsGrow) edges, granulation, and multiply glaze.
   * Faithful to Code Painter's `wet` style.
   *
   * Key upgrade: 12 layers (was 8) with more transparent alpha, plus a
   * wet bead at the rim where paint pools.
   */
  _renderWash(ctx, shape, R2) {
    const [c0, c1, o2] = colsOf(shape);
    const a2 = shape.params;
    const mid = mixHex(c0, c1, 0.5);
    const sig = this.defaults.sigma;
    const layers = this.defaults.layers;
    const geo = this._buildWashGeometry(shape, a2, R2, sig, layers);
    const { paths, x0, y0, x1, y1 } = geo;
    const size = Math.max(x1 - x0, y1 - y0, 2);
    const rim = shade(mid, -0.32);
    const tile = this._getTile(ctx, Math.ceil((x1 - x0 + 4) * 2), Math.ceil((y1 - y0 + 4) * 2));
    const t2 = tile.ctx;
    t2.setTransform(2, 0, 0, 2, 2 - x0 * 2, 2 - y0 * 2);
    t2.globalCompositeOperation = "source-over";
    t2.clearRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
    const G2 = gradOf(t2, shape, [[0, c0], [1, c1]]);
    for (let i2 = 0; i2 < paths.length; i2++) {
      t2.globalAlpha = o2 * this.defaults.glazeAlpha;
      t2.fillStyle = G2;
      t2.fill(paths[i2]);
      t2.globalAlpha = o2 * 0.11;
      t2.strokeStyle = rim;
      t2.lineWidth = Math.max(0.5, size * 6e-3);
      t2.stroke(paths[i2]);
    }
    t2.globalCompositeOperation = "destination-out";
    const cnt = Math.min(this.defaults.granulationCount, 30 + Math.round(size * 0.2));
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    for (let i2 = 0; i2 < cnt; i2++) {
      if (i2 % 5 === 4) continue;
      const r2 = size * (0.015 + R2() * 0.12);
      t2.globalAlpha = 0.05 + R2() * 0.07;
      t2.beginPath();
      t2.arc(cx + gaussR(R2) * size * 0.3, cy + gaussR(R2) * size * 0.3, r2, 0, 7);
      t2.fill();
    }
    t2.globalCompositeOperation = "source-atop";
    t2.fillStyle = shade(c0, -0.45);
    t2.globalAlpha = o2 * 0.25;
    t2.beginPath();
    const g2 = Math.min(this.defaults.granulationCount * 2, Math.round(size * 0.5));
    for (let i2 = 0; i2 < g2; i2++) {
      const gx = x0 + R2() * (x1 - x0);
      const gy = y0 + R2() * (y1 - y0);
      const r2 = Math.max(0.3, size * 4e-3 * (0.5 + R2()));
      t2.moveTo(gx + r2, gy);
      t2.arc(gx, gy, r2, 0, 7);
    }
    t2.fill();
    t2.globalCompositeOperation = "source-atop";
    const rimGrad = t2.createRadialGradient(cx, cy, size * 0.45, cx, cy, size * 0.55);
    rimGrad.addColorStop(0, "rgba(0,0,0,0)");
    rimGrad.addColorStop(0.7, rgbaOf(shade2(mid, -0.3), this.defaults.rimBeadDarken * o2));
    rimGrad.addColorStop(1, rgbaOf(shade2(c0, -0.4), this.defaults.rimBeadDarken * o2));
    t2.fillStyle = rimGrad;
    t2.globalAlpha = o2 * this.defaults.rimBeadDarken * 0.4;
    const lastPath = paths[paths.length - 1];
    t2.fill(lastPath);
    t2.globalCompositeOperation = "source-over";
    t2.globalAlpha = 1;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.drawImage(tile.cv, 0, 0);
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.55;
    ctx.drawImage(tile.cv, 0, 0);
    ctx.restore();
    tile.ctx = null;
  }
  /**
   * Build the fractal-edged layer paths via hobbsGrow.
   * More iterations = more frayed, natural edges.
   */
  _buildWashGeometry(shape, a2, R2, sig, layers) {
    const P2 = shapePoly(shape);
    const n2 = P2.length / 2;
    const stepI = Math.max(1, Math.ceil(n2 / 12));
    let base = [];
    for (let i2 = 0; i2 < n2; i2 += stepI) {
      base.push([P2[i2 * 2], P2[i2 * 2 + 1], 0.6 + R2() * 0.8]);
    }
    base = hobbsGrow(hobbsGrow(hobbsGrow(base, R2, sig), R2, sig * 0.85), R2, sig * 0.7);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const paths = [];
    for (let i2 = 0; i2 < layers; i2++) {
      let p2 = base;
      for (let k2 = 0; k2 < 3; k2++) p2 = hobbsGrow(p2, R2, sig * 0.62 * Math.pow(0.82, k2));
      const pa = new Path2D();
      p2.forEach((v2, j2) => {
        pa[j2 ? "lineTo" : "moveTo"](v2[0], v2[1]);
        if (v2[0] < x0) x0 = v2[0];
        if (v2[0] > x1) x1 = v2[0];
        if (v2[1] < y0) y0 = v2[1];
        if (v2[1] > y1) y1 = v2[1];
      });
      pa.closePath();
      paths.push(pa);
    }
    return { paths, x0, y0, x1, y1 };
  }
  /** Get a reusable offscreen canvas tile */
  _getTile(ctx, w2, h2) {
    if (!WET_TILE.cv) {
      WET_TILE.cv = document.createElement("canvas");
      WET_TILE.x = WET_TILE.cv.getContext("2d");
    }
    WET_TILE.cv.width = Math.max(WET_TILE.cv.width, w2);
    WET_TILE.cv.height = Math.max(WET_TILE.cv.height, h2);
    return { cv: WET_TILE.cv, ctx: WET_TILE.x };
  }
  /** PaintRibbon: a wobbling ribbon path with multi-frequency waviness */
  _paintRibbon(P2, wFn, R2, amp, phase) {
    const N2 = P2.length;
    const ph = [R2() * 6.28 + phase, R2() * 6.28 + phase, R2() * 6.28, R2() * 6.28];
    const wav = (s2, a2, b2) => 0.55 * Math.sin(s2 * 7 + a2) + 0.3 * Math.sin(s2 * 17 + b2) + 0.15 * Math.sin(s2 * 37 + a2 * 2);
    const L2 = [];
    const Rt2 = [];
    for (let i2 = 0; i2 < N2; i2++) {
      const s2 = i2 / Math.max(1, N2 - 1);
      const [nx, ny] = normalAt(P2, i2);
      const h2 = wFn(s2) / 2;
      const hl = h2 * (1 + amp * wav(s2, ph[0], ph[1]));
      const hr2 = h2 * (1 + amp * wav(s2, ph[2], ph[3]));
      L2.push([P2[i2][0] + nx * hl, P2[i2][1] + ny * hl]);
      Rt2.push([P2[i2][0] - nx * hr2, P2[i2][1] - ny * hr2]);
    }
    return this._closeRibbon(L2, Rt2, P2, R2, wFn(0));
  }
  /** Build a closed Path2D ribbon from left/right edge point lists with round caps */
  _closeRibbon(L2, Rt2, P2, R2, w2) {
    const path2 = new Path2D();
    const n2 = L2.length;
    const hw = w2 / 2;
    const cap = (cx, cy, base) => {
      for (let i2 = 1; i2 < 6; i2++) {
        const a2 = base - i2 / 6 * Math.PI;
        path2.lineTo(cx + Math.cos(a2) * hw, cy + Math.sin(a2) * hw);
      }
    };
    const tan = (i2, j2) => {
      const dx = P2[j2][0] - P2[i2][0];
      const dy = P2[j2][1] - P2[i2][1];
      const d2 = Math.hypot(dx, dy) || 1;
      return [dx / d2, dy / d2];
    };
    path2.moveTo(L2[0][0], L2[0][1]);
    for (let i2 = 1; i2 < n2; i2++) path2.lineTo(L2[i2][0], L2[i2][1]);
    const t1 = tan(n2 - 2, n2 - 1);
    cap(P2[n2 - 1][0], P2[n2 - 1][1], Math.atan2(t1[0], -t1[1]));
    for (let i2 = n2 - 1; i2 >= 0; i2--) path2.lineTo(Rt2[i2][0], Rt2[i2][1]);
    const t0 = tan(0, Math.min(1, n2 - 1));
    cap(P2[0][0], P2[0][1], Math.atan2(-t0[0], t0[1]));
    path2.closePath();
    return path2;
  }
};
var watercolor_default = WatercolorStyle;

// js/styles/oil.js
function resolveColors2(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c0 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c1 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o2 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c0, c1, o2];
  }
  return colsOf(shape);
}
var OilStyle = class {
  name = "oil";
  category = "paint";
  description = "A loaded bristles brush in thick, glossy oil paint \u2014 both colours side by side, ridges from every bristle, the end running dry. Acrylic mode gives flatter, streaky paint.";
  defaults = {
    strokeSize: { min: 5, max: 25 },
    bristleCount: 12,
    // number of bristles per stroke (4–16)
    bristleVar: 0.5,
    // unevenness of bristle widths
    dryEnd: 0.55,
    // fraction of stroke where paint starts thinning
    dryTaper: 0.8,
    // how sharply it runs dry at the end
    ridgeAmplitude: 0.35,
    // per-bristle colour variation
    wetDrag: 0.6,
    // how much wet paint is dragged behind (oil vs acrylic)
    glossy: true,
    // oil = glossy (highlights), acrylic = satin (matte)
    bristle: "oil"
  };
  /**
   * Propose candidate strokes for this style.
   * @param {object} analyzer - Image analyzer with edges[], regions[]
   * @param {object} params - User/style parameters
   * @returns {Array} shape candidates
   */
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 200)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(...this._makeFill(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeFill(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const strokes = [];
    const R2 = rngFor([region.cx, region.cy, region.w, region.h, 0, 0]);
    const an2 = R2() * Math.PI;
    const size = Math.max(region.w, region.h);
    const sw = Math.max(3, Math.min(size / 2.2, size / 3));
    const n2 = Math.max(1, Math.ceil(size / (sw * 0.8)));
    for (let k2 = 0; k2 < n2; k2++) {
      const t2 = k2 / Math.max(1, n2 - 1);
      const colorA = rgbToHex(mixHex(c2, c2, t2));
      const colorB = rgbToHex(mixHex(c2, c2, Math.min(1, t2 + 0.25)));
      strokes.push({
        type: "S",
        params: [region.cx, region.cy, region.cx, region.cy, region.cx, region.cy, sw, an2, colorA, colorB, 1],
        color0: c2,
        color1: c2,
        alpha: 1,
        seed: [region.cx + k2, region.cy + k2, sw, an2, k2, 1],
        fillStroke: true
      });
    }
    return strokes;
  }
  /**
   * Render an oil/acrylic stroke using the bristle brush algorithm.
   * Each bristle is a ribbon of its own colour/ridge, running dry at the end.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {number} progress - 0..1
   */
  render(ctx, shape, progress = 1) {
    const R2 = rngFor(shape.seed || shape.params.slice(0, 6));
    const [c0, c1, o2] = resolveColors2(shape);
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, R2, c0, c1, o2, progress);
    } else {
      this._renderArea(ctx, shape, R2, c0, c1, o2);
    }
  }
  /**
   * Bristle brush stroke: multiple bristles side by side, each carrying
   * its own colour and ridge, running dry towards the end.
   *
   * Features:
   *  - Per-bristle color variation via blend + tone offset
   *  - Pressure tapering: stroke gets thinner at the end (dryFactor)
   *  - Wet paint dragging: oil drags a translucent trail behind the brush
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape - {type, params, seed}
   * @param {function} R - Seeded RNG
   * @param {string} c0 - Start color (hex)
   * @param {string} c1 - End color (hex)
   * @param {number} o - Opacity
   * @param {number} progress - 0..1
   */
  _renderStroke(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(2, a2[6]);
    const P2 = quadPts(a2, progress, 1, 48);
    const bristles = this._makeBristles(w2, R2);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i2 = 0; i2 < bristles.length; i2++) {
      const br2 = bristles[i2];
      const lo = br2.lo;
      const hi2 = br2.hi;
      const brW = w2 * (hi2 - lo);
      const mixT = br2.mixAt;
      const brC0 = shade2(mixHex(c0, c1, mixT), br2.tone);
      const brC1 = shade2(mixHex(c0, c1, clamp01(mixT + 0.12)), br2.tone);
      const L2 = [];
      const Rt2 = [];
      const N2 = P2.length;
      for (let j2 = 0; j2 < N2; j2++) {
        const s2 = j2 / Math.max(1, N2 - 1);
        const [nx, ny] = normalAt(P2, j2);
        const dryFactor = s2 > this.defaults.dryEnd ? Math.pow(1 - (s2 - this.defaults.dryEnd) / (1 - this.defaults.dryEnd), this.defaults.dryTaper) : 1;
        const hw = brW * (0.5 + (R2() - 0.5) * this.defaults.bristleVar) * Math.max(0.3, dryFactor);
        L2.push([P2[j2][0] + nx * hw, P2[j2][1] + ny * hw]);
        Rt2.push([P2[j2][0] - nx * hw, P2[j2][1] - ny * hw]);
      }
      ctx.globalAlpha = o2 * (0.8 + R2() * 0.2);
      const G2 = ctx.createLinearGradient(P2[0][0], P2[0][1], P2[N2 - 1][0], P2[N2 - 1][1]);
      G2.addColorStop(0, brC0);
      G2.addColorStop(1, brC1);
      ctx.fillStyle = G2;
      ctx.beginPath();
      L2.forEach((p2, j2) => ctx[j2 ? "lineTo" : "moveTo"](p2[0], p2[1]));
      for (let j2 = Rt2.length - 1; j2 >= 0; j2--) ctx.lineTo(Rt2[j2][0], Rt2[j2][1]);
      ctx.closePath();
      ctx.fill();
      if (this.defaults.glossy) {
        ctx.globalAlpha = o2 * 0.3;
        ctx.strokeStyle = shade(brC1, 0.4);
        ctx.lineWidth = Math.max(0.5, brW * 0.15);
        ctx.beginPath();
        const off = brW * 0.15;
        for (let j2 = 0; j2 < N2; j2++) {
          const [nx, ny] = normalAt(P2, j2);
          ctx.lineTo(P2[j2][0] + nx * off, P2[j2][1] + ny * off);
        }
        ctx.stroke();
      }
    }
    if (this.defaults.wetDrag > 0 && progress >= 1) {
      this._wetDrag(ctx, P2, w2, c0, c1, o2, R2);
    }
    ctx.restore();
  }
  /**
   * Wet paint dragging behind the brush (oil effect).
   * Pulls a translucent trail of mixed color behind the main stroke,
   * simulating wet paint being dragged on the canvas.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array} P - Sampled points along the stroke
   * @param {number} w - Brush width
   * @param {string} c0 - Start color (hex)
   * @param {string} c1 - End color (hex)
   * @param {number} o - Opacity
   * @param {function} R - Seeded RNG
   */
  _wetDrag(ctx, P2, w2, c0, c1, o2, R2) {
    const offP = offsetPts(P2, -w2 * 0.65);
    ctx.globalAlpha = o2 * 0.15 * this.defaults.wetDrag;
    ctx.fillStyle = mixHex(c0, c1, 0.5);
    ctx.beginPath();
    offP.forEach((p2, i2) => ctx[i2 ? "lineTo" : "moveTo"](p2[0], p2[1]));
    ctx.closePath();
    ctx.fill("evenodd");
  }
  /**
   * Fill an area (E/B/T/R) with bristle strokes side by side,
   * each ending at the shape's edge — like a painter filling in.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0 - Start color
   * @param {string} c1 - End color
   * @param {number} o - Opacity
   */
  _renderArea(ctx, shape, R2, c0, c1, o2) {
    const a2 = shape.params;
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const an2 = shape.type === "E" || shape.type === "B" || shape.type === "R" ? a2[4] : R2() * Math.PI;
    const dx = Math.cos(an2);
    const dy = Math.sin(an2);
    const nx = -dy;
    const ny = dx;
    let lo = 1e9, hi2 = -1e9, lo2 = 1e9, hi22 = -1e9;
    for (let i2 = 0; i2 < P2.length; i2 += 2) {
      const u2 = P2[i2] * nx + P2[i2 + 1] * ny;
      const v2 = P2[i2] * dx + P2[i2 + 1] * dy;
      lo = Math.min(lo, u2);
      hi2 = Math.max(hi2, u2);
      lo2 = Math.min(lo2, v2);
      hi22 = Math.max(hi22, v2);
    }
    const across = hi2 - lo;
    const sw = Math.max(3, Math.min(across / 2.2, Math.max(b2.w, b2.h) / 3));
    const n2 = Math.max(1, Math.ceil(across / (sw * 0.8)));
    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();
    for (let k2 = 0; k2 < n2; k2++) {
      const u2 = lo + (k2 + 0.5) * across / n2 + (R2() - 0.5) * sw * 0.3;
      let f2 = null;
      let l2 = null;
      for (let j2 = 0; j2 <= 40; j2++) {
        const v2 = lo2 + (hi22 - lo2) * j2 / 40;
        const px = nx * u2 + dx * v2;
        const py = ny * u2 + dy * v2;
        if (inPoly(P2, px, py)) {
          if (!f2) f2 = [px, py];
          l2 = [px, py];
        }
      }
      if (!f2 || Math.hypot(l2[0] - f2[0], l2[1] - f2[1]) < sw * 0.5) continue;
      const A2 = f2;
      const B2 = l2;
      const t2 = k2 / Math.max(1, n2 - 1);
      const ca = mixHex(c0, c1, t2);
      const cb = mixHex(c0, c1, Math.min(1, t2 + 0.25));
      const strokeShape = {
        type: "S",
        params: [A2[0], A2[1], (A2[0] + B2[0]) / 2, (A2[1] + B2[1]) / 2, B2[0], B2[1], sw, an2, ca, cb, o2],
        color0: hexRgb(ca),
        color1: hexRgb(cb),
        alpha: o2,
        seed: [a2[0] + k2 * 7.1, a2[1] + k2 * 3.3, a2[2], a2[3], k2, 1]
      };
      const R22 = rngFor(strokeShape.seed);
      this._renderStroke(ctx, strokeShape, R22, ca, cb, o2, 1);
    }
    ctx.restore();
  }
  /**
   * Create a set of bristles with uneven widths and per-bristle properties.
   * Mirrors Code Painter's bristleSet.
   * @param {number} r - Brush radius (half-width)
   * @param {function} R - Seeded RNG
   * @returns {Array<object>} Bristle descriptors
   */
  _makeBristles(r2, R2) {
    const n2 = Math.max(4, Math.min(16, Math.round(r2 / 3.2)));
    const b2 = [];
    const cuts = [0];
    for (let i2 = 1; i2 < n2; i2++) {
      cuts.push(i2 / n2 + (R2() - 0.5) * 0.6 / n2);
    }
    cuts.push(1);
    for (let i2 = 0; i2 < n2; i2++) {
      b2.push({
        lo: cuts[i2],
        hi: cuts[i2 + 1],
        amp: 0.35 + 0.65 * R2(),
        end: 0.55 + 0.45 * Math.pow(R2(), 0.5),
        tone: (R2() - 0.5) * 0.12,
        mixAt: clamp01((i2 + 0.5) / n2 + (R2() - 0.5) * 0.3)
      });
    }
    return b2;
  }
};
var oil_default = OilStyle;

// js/styles/graffiti.js
var GraffitiStyle = class {
  name = "graffiti";
  category = "paint";
  description = "Particle-spray: soft overspray haze, a dense particle body, speckles flying off, and occasional drips on heavy strokes.";
  defaults = {
    strokeSize: { min: 4, max: 24 },
    oversprayLayers: [[2.1, 0.06], [1.55, 0.1], [1.2, 0.28], [0.92, 0.8]],
    speckleDensity: 0.6,
    // particles per pixel of path length
    dotSize: 0.055,
    // min dot radius as fraction of width
    speckleOpacityMin: 0.2,
    speckleOpacityMax: 0.85,
    dripProbability: 0.62,
    // chance of drips on heavy strokes
    dripLength: 3.2,
    // max drip length as fraction of width
    haloSpeckles: 160
    // speckles for blob shapes
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 200)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeBlob(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeBlob(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor([region.cx, region.cy, region.w, region.h, 0, 0]);
    const r2 = Math.max(5, Math.min(region.w, region.h) * 0.4);
    return {
      type: "E",
      params: [region.cx, region.cy, r2, r2 * (0.7 + R2() * 0.5), 0, c2, c2, 1],
      seed: [region.cx, region.cy, r2, 0, 0, 0]
    };
  }
  /**
   * Render a spray stroke or blob.
   * Faithful to Code Painter's `spray` function.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {number} progress - 0..1 (draws first `progress` of the stroke)
   * @param {number} dir - 1 or -1 (stroke direction)
   */
  render(ctx, shape, progress = 1, dir = 1) {
    const a2 = shape.params;
    const R2 = rngFor(a2);
    let colour = a2[shape.type === "S" ? 8 : 6];
    colour = Array.isArray(colour) ? rgbToHex(colour) : typeof colour === "string" ? colour : "#000000";
    const o2 = a2[a2.length - 1];
    const g2 = () => (R2() + R2() + R2() - 1.5) / 1.5;
    ctx.save();
    ctx.fillStyle = ctx.strokeStyle = colour;
    ctx.lineCap = ctx.lineJoin = "round";
    if (shape.type === "S") {
      this._renderSprayLine(ctx, a2, R2, o2, progress, dir, g2);
    } else {
      this._renderSprayBlob(ctx, a2, R2, o2, progress, g2);
    }
    ctx.restore();
  }
  /**
   * Spray line: overspray haze + speckle body + drips.
   * Mirrors Code Painter's spray() for S-type shapes.
   */
  _renderSprayLine(ctx, a2, R2, o2, u2, dir, g2) {
    let [x0, y0, x1, y1, x2, y2, w2] = a2;
    if (dir < 0) [x0, y0, x2, y2] = [x2, y2, x0, y0];
    const pt2 = (s2) => {
      const v2 = 1 - s2;
      return [v2 * v2 * x0 + 2 * v2 * s2 * x1 + s2 * s2 * x2, v2 * v2 * y0 + 2 * v2 * s2 * y1 + s2 * s2 * y2];
    };
    const tn2 = (s2) => {
      const dx = 2 * (1 - s2) * (x1 - x0) + 2 * s2 * (x2 - x1);
      const dy = 2 * (1 - s2) * (y1 - y0) + 2 * s2 * (y2 - y1);
      const d2 = Math.hypot(dx, dy) || 1;
      return [dx / d2, dy / d2];
    };
    const qx = x0 + (x1 - x0) * u2;
    const qy = y0 + (y1 - y0) * u2;
    const [ex, ey] = pt2(u2);
    for (const [k2, al] of this.defaults.oversprayLayers) {
      ctx.globalAlpha = o2 * al;
      ctx.lineWidth = w2 * k2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(qx, qy, ex, ey);
      ctx.stroke();
    }
    const len = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1);
    const n2 = Math.min(420, Math.round(len * u2 * this.defaults.speckleDensity + w2 * 4 * u2));
    const dot = Math.max(this.defaults.dotSize * 10, w2 * this.defaults.dotSize);
    for (let i2 = 0; i2 < n2; i2++) {
      const s2 = R2() * u2;
      const [px, py] = pt2(s2);
      const [tx, ty] = tn2(s2);
      const off = g2() * w2 * 1.25;
      const r2 = dot * (0.4 + R2() * 1.4);
      ctx.globalAlpha = o2 * (this.defaults.speckleOpacityMin + R2() * this.defaults.speckleOpacityMax);
      ctx.beginPath();
      ctx.arc(px - ty * off, py + tx * off, r2, 0, 7);
      ctx.fill();
    }
    if (u2 >= 1 && w2 > 4 && R2() < this.defaults.dripProbability) {
      const nd = R2() < 0.4 ? 2 : 1;
      for (let d2 = 0; d2 < nd; d2++) {
        const [dx, dy] = pt2(0.15 + R2() * 0.7);
        const L2 = w2 * (0.8 + R2() * this.defaults.dripLength);
        const dw = w2 * (0.1 + R2() * 0.12);
        ctx.globalAlpha = o2 * 0.85;
        ctx.beginPath();
        ctx.moveTo(dx - dw, dy);
        ctx.quadraticCurveTo(dx - dw * 0.5, dy + L2 * 0.6, dx - dw * 0.35, dy + L2);
        ctx.lineTo(dx + dw * 0.35, dy + L2);
        ctx.quadraticCurveTo(dx + dw * 0.5, dy + L2 * 0.6, dx + dw, dy);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(dx, dy + L2, dw * 0.75, 0, 7);
        ctx.fill();
      }
    }
  }
  /**
   * Spray blob/ellipse: airbrushed burst with a speckled halo.
   * Mirrors Code Painter's spray() for non-S shapes.
   */
  _renderSprayBlob(ctx, a2, R2, o2, u2, g2) {
    const [cx, cy, rx, ry, rot] = a2;
    const m2 = Math.max(rx, ry);
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(rx / m2, ry / m2);
    const G2 = ctx.createRadialGradient(0, 0, 0, 0, 0, m2 * 1.25);
    const blobCol = Array.isArray(a2[6]) ? rgbToHex(a2[6]) : typeof a2[6] === "string" ? a2[6] : "#000000";
    G2.addColorStop(0, blobCol);
    G2.addColorStop(0.62, blobCol);
    G2.addColorStop(1, blobCol + "00");
    ctx.globalAlpha = o2 * 0.9 * u2;
    ctx.fillStyle = G2;
    ctx.beginPath();
    ctx.arc(0, 0, m2 * 1.25 * Math.max(0.2, u2), 0, 7);
    ctx.fill();
    ctx.fillStyle = blobCol;
    const n2 = Math.min(this.defaults.haloSpeckles, Math.round(m2 * 1.2));
    for (let i2 = 0; i2 < n2 * u2; i2++) {
      const an2 = R2() * 6.283;
      const rr2 = m2 * (0.95 + Math.abs(g2()) * 0.7);
      ctx.globalAlpha = o2 * (this.defaults.speckleOpacityMin + R2() * 0.6);
      ctx.beginPath();
      ctx.arc(Math.cos(an2) * rr2, Math.sin(an2) * rr2, Math.max(0.5, m2 * 0.03) * (0.4 + R2()), 0, 7);
      ctx.fill();
    }
    ctx.restore();
  }
};
var graffiti_default = GraffitiStyle;

// js/styles/graphic.js
var GraphicStyle = class {
  name = "graphic";
  category = "graphic";
  description = "Clean flat shapes with bold colours and strong contrast. Supports halftone dots, bokeh glow, and geometric reduction sub-modes.";
  defaults = {
    strokeSize: { min: 2, max: 10 },
    mode: "flat",
    // 'flat' | 'halftone' | 'bokeh' | 'geometric'
    contrast: 0.8,
    // colour contrast amplification (0..1)
    outlineWidth: 1.5,
    // outline stroke width
    outlineDarken: 0.6,
    // outline darken factor
    halftoneDotSize: 0.028,
    // dot radius as fraction of shape size
    halftoneAngle: 0.785,
    // 45° screen
    bokehRimLight: 0.55,
    // rim brightness for bokeh
    boldColors: true,
    // amplify saturation for poster look
    minRegionArea: 200
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy, cfg.boldColors ? "poster" : "exact");
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 200)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy, cfg.boldColors ? "poster" : "exact");
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const w2 = Math.max(region.w, region.h) * 0.4;
    return {
      type: "E",
      params: [region.cx, region.cy, w2, w2, 0, c2, c2, 1],
      seed: [region.cx, region.cy, w2, 0, 0, 0]
    };
  }
  /**
   * Render a flat-graphic stroke or shape.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {number} progress
   */
  render(ctx, shape, progress = 1) {
    const a2 = shape.params;
    const [c0, c1, o2] = colsOf(shape);
    const R2 = rngFor(shape.seed || a2.slice(0, 9));
    const cfg = { ...this.defaults, ...shape.styleParams || {} };
    ctx.save();
    if (cfg.mode === "halftone") {
      this._renderHalftone(ctx, shape, R2, c0, c1, o2, progress);
    } else if (cfg.mode === "bokeh") {
      this._renderBokeh(ctx, shape, R2, c0, c1, o2);
    } else if (cfg.mode === "geometric") {
      this._renderGeometric(ctx, shape, R2, c0, c1, o2);
    } else {
      this._renderFlat(ctx, shape, R2, c0, c1, o2, progress);
    }
    ctx.restore();
  }
  /** Flat gradient fill with optional outline */
  _renderFlat(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    ctx.globalAlpha = o2;
    if (shape.type === "S") {
      const G2 = gradOf(ctx, shape, [[0, c0], [1, c1]]);
      ctx.strokeStyle = G2;
      ctx.lineWidth = a2[6];
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a2[0], a2[1]);
      ctx.quadraticCurveTo(a2[2], a2[3], a2[4], a2[5]);
      ctx.stroke();
    } else {
      const G2 = gradOf(ctx, shape, [[0, c0], [1, c1]]);
      ctx.fillStyle = G2;
      outlinePath(ctx, shape);
      ctx.fill();
      const dark = shade(c0, -this.defaults.outlineDarken);
      ctx.globalAlpha = o2 * 0.7;
      ctx.strokeStyle = dark;
      ctx.lineWidth = this.defaults.outlineWidth;
      outlinePath(ctx, shape);
      ctx.stroke();
    }
  }
  /** Halftone: pop-art dots on a 45° screen, sized to the gradient */
  _renderHalftone(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const size = Math.max(b2.w, b2.h, 2);
    const dot = Math.max(1.1, Math.min(2.2, size * 9e-3));
    const n2 = Math.min(2400, Math.round(b2.w * b2.h / (dot * dot * 9)));
    const ang = this.defaults.halftoneAngle;
    const cs = Math.cos(ang);
    const sn2 = Math.sin(ang);
    const axis = shape.t === "E" || shape.t === "B" ? a2[4] || 0 : 0;
    ctx.globalAlpha = o2;
    ctx.fillStyle = mixHex(c0, c1, 0.5);
    ctx.beginPath();
    for (let i2 = 0; i2 < n2; i2++) {
      const px = b2.x0 + R2() * b2.w;
      const py = b2.y0 + R2() * b2.h;
      const t2 = clamp01(((px - b2.cx) * Math.cos(axis) + (py - b2.cy) * Math.sin(axis)) / (size / 2 + 0.01) * 0.5 + 0.5);
      const r2 = dot * (0.5 + t2 * 0.5);
      ctx.moveTo(px + r2, py);
      ctx.arc(px, py, r2, 0, 7);
    }
    ctx.fill();
  }
  /** Bokeh: soft glowing discs with a bright rim */
  _renderBokeh(ctx, shape, R2, c0, c1, o2) {
    const a2 = shape.params;
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const r2 = Math.max(1, Math.max(b2.w, b2.h) / 2);
    const mid = mixHex(c0, c1, 0.5);
    const G2 = ctx.createRadialGradient(b2.cx, b2.cy, 0, b2.cx, b2.cy, r2);
    G2.addColorStop(0, mid);
    G2.addColorStop(1, rgbaOf(mid, 0));
    ctx.globalAlpha = o2 * 0.9;
    ctx.fillStyle = G2;
    ctx.beginPath();
    ctx.arc(b2.cx, b2.cy, r2, 0, 7);
    ctx.fill();
    const rimG = ctx.createRadialGradient(b2.cx, b2.cy, r2 * 0.6, b2.cx, b2.cy, r2);
    rimG.addColorStop(0, rgbaOf("#ffffff", this.defaults.bokehRimLight * o2));
    rimG.addColorStop(1, rgbaOf("#ffffff", 0));
    ctx.globalAlpha = o2;
    ctx.fillStyle = rimG;
    ctx.beginPath();
    ctx.arc(b2.cx, b2.cy, r2, 0, 7);
    ctx.fill();
  }
  /** Geometric: reduce shape to triangles and bars */
  _renderGeometric(ctx, shape, R2, c0, c1, o2) {
    if (shape.type === "S") {
      ctx.globalAlpha = o2;
      ctx.strokeStyle = c0;
      ctx.lineWidth = shape.params[6];
      ctx.lineCap = "round";
      const a3 = shape.params;
      ctx.beginPath();
      ctx.moveTo(a3[0], a3[1]);
      ctx.quadraticCurveTo(a3[2], a3[3], a3[4], a3[5]);
      ctx.stroke();
      return;
    }
    const a2 = shape.params;
    ctx.globalAlpha = o2;
    ctx.fillStyle = c0;
    outlinePath(ctx, shape);
    ctx.fill();
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const triCount = Math.max(2, Math.min(6, Math.round(b2.w * b2.h / 2e3)));
    ctx.globalAlpha = o2 * 0.7;
    for (let i2 = 0; i2 < triCount; i2++) {
      const tri = this._randomTriangle(P2, b2, R2);
      ctx.fillStyle = shade2(c1, (R2() - 0.5) * 0.2);
      ctx.beginPath();
      ctx.moveTo(tri[0][0], tri[0][1]);
      ctx.lineTo(tri[1][0], tri[1][1]);
      ctx.lineTo(tri[2][0], tri[2][1]);
      ctx.closePath();
      ctx.fill();
    }
  }
  _randomTriangle(P2, b2, R2) {
    const i2 = Math.floor(R2() * (P2.length / 2 - 1));
    const j2 = Math.floor(R2() * (P2.length / 2 - 1));
    const k2 = Math.floor(R2() * (P2.length / 2 - 1));
    return [
      [P2[i2 * 2], P2[i2 * 2 + 1]],
      [P2[j2 * 2], P2[j2 * 2 + 1]],
      [P2[k2 * 2], P2[k2 * 2 + 1]]
    ];
  }
};
var graphic_default = GraphicStyle;

// js/styles/charcoal.js
function resolveColors3(shape) {
  if (shape.color0 != null || shape.color1 != null) {
    const c02 = Array.isArray(shape.color0) ? "#" + shape.color0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? "#" + shape.color1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
function stampBuild(lines, o2, R2) {
  const A2 = new Path2D();
  const B2 = new Path2D();
  const st2 = [];
  for (const P2 of lines) {
    const n2 = P2.length;
    if (n2 < 2) continue;
    const cum = [0];
    for (let i2 = 1; i2 < n2; i2++) cum.push(cum[i2 - 1] + Math.hypot(P2[i2][0] - P2[i2 - 1][0], P2[i2][1] - P2[i2 - 1][1]));
    const L2 = cum[n2 - 1];
    if (L2 < 0.01) continue;
    const step = Math.max(o2.minStep || 0.5, o2.w * o2.spacing);
    const steps = Math.min(o2.maxSteps || 240, Math.max(2, Math.ceil(L2 / step)));
    const peak = o2.peak + (R2() - 0.5) * 0.2;
    const hw = o2.hw * (0.85 + R2() * 0.3);
    const c2 = 1 + R2() * 0.6;
    let j2 = 1;
    for (let k2 = 0; k2 <= steps; k2++) {
      const t2 = k2 / steps;
      if (t2 > (o2.upto !== void 0 ? o2.upto : 1)) break;
      const d2 = t2 * L2;
      while (j2 < n2 - 1 && cum[j2] < d2) j2++;
      const seg = cum[j2] - cum[j2 - 1] || 1;
      const f2 = (d2 - cum[j2 - 1]) / seg;
      const px = P2[j2 - 1][0] + (P2[j2][0] - P2[j2 - 1][0]) * f2;
      const py = P2[j2 - 1][1] + (P2[j2][1] - P2[j2 - 1][1]) * f2;
      const pr2 = o2.pmin + (o2.pmax - o2.pmin) / (1 + Math.pow(Math.abs((t2 - peak) / hw), 2 * c2));
      if (R2() < o2.grain * (0.62 - 0.4 * Math.min(1, pr2))) continue;
      const [nx, ny] = normalAt(P2, j2);
      const sc = gaussR(R2) * o2.scatter * o2.w * 0.5 * (1.15 - o2.sharp * 0.5);
      const par = (R2() - 0.5) * step;
      const r2 = Math.max(0.4, o2.w * 0.5 * (0.4 + 0.6 * Math.min(1.1, pr2)) * (0.8 + R2() * 0.4));
      const sx = px - ny * sc + nx * par;
      const sy = py + nx * sc + ny * par;
      const Q2 = R2() < 0.55 ? A2 : B2;
      if (r2 < 1.5) {
        Q2.rect(sx - r2, sy - r2, r2 * 2, r2 * 2);
      } else {
        Q2.moveTo(sx + r2, sy);
        Q2.arc(sx, sy, r2, 0, 7);
      }
      st2.push(sx, sy, r2, Q2 === A2 ? 0 : 1, t2);
    }
  }
  return { A: A2, B: B2, st: st2, base: o2.alpha * (0.8 + R2() * 0.2) };
}
var CharcoalStyle = class {
  name = "charcoal";
  category = "draw";
  description = "Heavy grain, soft edges, smudgy look. Stamped brush with a firm-middle / very-light-at-ends pressure profile, rendered in multiple overlapping passes with decreasing opacity. Uses charcoal grey tones sampled from the source.";
  defaults = {
    strokeSize: { min: 3, max: 16 },
    spacing: 0.35,
    scatter: 1.7,
    // wide scatter for smudgy charcoal
    sharp: 0.4,
    // softer stamp shape
    grain: 0.55,
    // high grain — many stamps skipped
    pressure: { min: 0.55, max: 1.3, peak: 0.35 },
    // firm middle, light ends
    passes: 3,
    passOpacity: [0.42, 0.3, 0.18],
    // decreasing opacity per pass
    charcoalGrey: -0.5,
    // darken source colour to charcoal grey
    minRegionArea: 200
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 200)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(...this._makeHatching(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeHatching(region, color) {
    const R2 = rngFor([region.cx, region.cy, region.w, region.h, 0, 0]);
    const strokes = [];
    const size = Math.max(region.w, region.h);
    const w2 = lerp2(this.defaults.strokeSize.min * 0.5, this.defaults.strokeSize.max * 0.7, R2());
    const gap = w2 * 2;
    const half = size * 0.75;
    const ang = -0.95 + (R2() - 0.5) * 0.3;
    for (let y2 = -half; y2 <= half; y2 += gap * (0.85 + R2() * 0.3)) {
      const j2 = (R2() - 0.5) * gap * 0.2;
      strokes.push({
        type: "S",
        params: [
          region.cx - half + R2() * size * 0.15,
          region.cy + y2 + j2,
          region.cx,
          region.cy + y2,
          region.cx + half - R2() * size * 0.15,
          region.cy + y2 - j2,
          w2,
          ang,
          color,
          color,
          1
        ],
        seed: [region.cx, region.cy, w2, y2]
      });
    }
    return strokes;
  }
  /**
   * Render a charcoal stroke or area.
   *
   * Tries the p5.brain (p5.brush) engine via stampStrokeSync() first for
   * authentic charcoal brush dynamics. Falls back to the custom multi-pass
   * stampBuild renderer when p5.brush is not loaded or fails.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {number} progress - 0..1
   */
  render(ctx, shape, progress = 1) {
    const a2 = shape.params;
    const [c0, c1, o2] = resolveColors3(shape);
    if (shape.type === "S") {
      if (isBrushReady()) {
        const ok = stampStrokeSync(ctx, shape, {
          brushName: "charcoal",
          color: shape.color0 || a2[8] || [0, 0, 0],
          alpha: shape.alpha ?? a2[a2.length - 1] ?? 1,
          size: a2[6],
          progress
        });
        if (ok) return;
      }
      const R2 = rngFor(shape.seed || a2.slice(0, 8));
      this._renderStroke(ctx, shape, R2, c0, c1, o2, progress);
    } else {
      const R2 = rngFor(a2.slice(0, 6));
      this._renderArea(ctx, shape, R2, c0, c1, o2);
    }
  }
  /**
   * Multi-pass charcoal stroke rendering.
   *
   * Based on Code Painter's charcoal function:
   *   1. A faint grey smudge stroke (wide, low-opacity)
   *   2. A charcoal-grey body stroke (paper grain texture)
   *   3. Two passes of stamped dust (coarse + ragged crumbs)
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0 - Colour hex
   * @param {string} c1 - Colour hex
   * @param {number} o - Opacity
   * @param {number} progress - 0..1
   */
  _renderStroke(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(1.5, Math.min(20, a2[6]));
    const col = shade2(c0, this.defaults.charcoalGrey);
    const colAlt = shade2(c1, this.defaults.charcoalGrey);
    const inkGrey = shade2(mixHex(c0, c1, 0.3), this.defaults.charcoalGrey);
    ctx.save();
    ctx.lineCap = ctx.lineJoin = "round";
    const P_all = quadPts(a2, progress, 1, 24);
    ctx.globalAlpha = o2 * 0.1;
    ctx.strokeStyle = mixHex(c0, c1, 0.5);
    ctx.lineWidth = a2[6] * 1.5;
    ctx.beginPath();
    for (let i2 = 0; i2 < P_all.length; i2++) {
      i2 === 0 ? ctx.moveTo(P_all[i2][0], P_all[i2][1]) : ctx.lineTo(P_all[i2][0], P_all[i2][1]);
    }
    ctx.stroke();
    ctx.globalAlpha = Math.min(1, o2 * 0.7);
    ctx.strokeStyle = col;
    ctx.lineWidth = a2[6] * 0.7;
    ctx.beginPath();
    for (let i2 = 0; i2 < P_all.length; i2++) {
      i2 === 0 ? ctx.moveTo(P_all[i2][0], P_all[i2][1]) : ctx.lineTo(P_all[i2][0], P_all[i2][1]);
    }
    ctx.stroke();
    const P2 = quadPts(a2, 1, 1, 20);
    const dustBase = {
      w: Math.max(1.5, w2 * 1.1),
      pmin: 0.55,
      pmax: 1.3,
      peak: 0.35,
      hw: 0.5,
      minStep: 0.55,
      maxSteps: 200,
      sharp: 0.68
    };
    const set1 = stampBuild([P2], {
      ...dustBase,
      spacing: 0.1,
      scatter: 1.7,
      grain: 0.55,
      alpha: Math.min(1, o2 * 1.1),
      upto: progress,
      id: "c",
      salt: 1
    }, R2);
    ctx.globalAlpha = Math.min(1, set1.base);
    ctx.fillStyle = inkGrey;
    ctx.fill(set1.A);
    ctx.globalAlpha = Math.min(1, set1.base * 0.5);
    ctx.fill(set1.B);
    const set2 = stampBuild([P2], {
      ...dustBase,
      spacing: 0.2,
      scatter: 2.6,
      grain: 0.8,
      w: dustBase.w * 0.8,
      alpha: o2 * 0.7,
      upto: progress,
      id: "d",
      salt: 2
    }, R2);
    ctx.globalAlpha = Math.min(1, set2.base);
    ctx.fillStyle = colAlt;
    ctx.fill(set2.A);
    ctx.globalAlpha = Math.min(1, set2.base * 0.5);
    ctx.fillStyle = colAlt;
    ctx.fill(set2.B);
    ctx.restore();
  }
  /**
   * Area fill: charcoal dust filling the shape with a smudged rim.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0
   * @param {string} c1
   * @param {number} o
   */
  _renderArea(ctx, shape, R2, c0, c1, o2) {
    const a2 = shape.params;
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const size = Math.max(b2.w, b2.h, 2);
    ctx.save();
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.globalAlpha = o2 * 0.12;
    ctx.strokeStyle = c0;
    ctx.lineWidth = size * 0.18;
    outlinePath(ctx, shape);
    ctx.stroke();
    const mix = mixHex(c0, c1, 0.5);
    const greyFill = shade2(mix, this.defaults.charcoalGrey);
    ctx.globalAlpha = o2 * 0.3;
    ctx.fillStyle = mix;
    outlinePath(ctx, shape);
    ctx.fill();
    ctx.globalAlpha = Math.min(1, o2 * 0.85);
    ctx.fillStyle = greyFill;
    outlinePath(ctx, shape);
    ctx.fill();
    ctx.restore();
  }
};
var charcoal_default = CharcoalStyle;

// js/styles/marker.js
function resolveColors4(shape) {
  if (shape.color0 != null || shape.color1 != null) {
    const c02 = Array.isArray(shape.color0) ? "#" + shape.color0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? "#" + shape.color1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
var MarkerStyle = class {
  name = "marker";
  category = "draw";
  description = "Alcohol marker with a chisel tip at 45\xB0. Transparent ink that darkens where strokes overlap. Clean edges, no grain. A soft blot appears where the pen rests at the end of a stroke.";
  defaults = {
    strokeSize: { min: 2, max: 14 },
    chiselAngle: 0.785,
    // 45° — cos/sin of this gives the nib offset
    opacity: 0.7,
    // base opacity of a single pass
    streakOpacity: 0.12,
    // highlight streaks along the band
    blotOpacity: 0.25,
    // blot at stroke end
    blotScale: 0.42,
    // blot radius as fraction of stroke width
    minRegionArea: 200
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 200)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w, region.h, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors4(shape);
    const a2 = shape.params;
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, c0, c1, o2, progress);
    } else {
      this._renderArea(ctx, shape, c0, c1, o2);
    }
  }
  /**
   * Chisel-tip band rendering.
   * The marker nib is a chisel at 45°. We offset the centreline
   * left and right by the chisel half-width to create a band path,
   * then fill it with semi-transparent colour.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {string} c0 - Fill colour
   * @param {string} c1 - Unused (marker is single-colour)
   * @param {number} o - Opacity
   * @param {number} progress - 0..1
   */
  _renderStroke(ctx, shape, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(2, a2[6]);
    const angle = this.defaults.chiselAngle;
    const cx = Math.cos(angle) * w2 / 2;
    const cy = Math.sin(angle) * w2 / 2;
    const P2 = progress < 1 ? quadPts(a2, progress, 1, 24) : quadPts(a2, 1, 1, 24);
    const n2 = P2.length;
    const band = new Path2D();
    for (let i2 = 0; i2 < n2; i2++) {
      const pt2 = i2 === 0 ? band.moveTo(P2[i2][0] + cx, P2[i2][1] - cy) : band.lineTo(P2[i2][0] + cx, P2[i2][1] - cy);
    }
    for (let i2 = n2 - 1; i2 >= 0; i2--) {
      band.lineTo(P2[i2][0] - cx, P2[i2][1] + cy);
    }
    band.closePath();
    ctx.save();
    ctx.globalAlpha = o2 * this.defaults.opacity;
    ctx.fillStyle = c0;
    ctx.fill(band);
    ctx.globalAlpha = o2 * this.defaults.streakOpacity;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(0.5, w2 * 0.08);
    for (const f2 of [-0.25, 0.2]) {
      ctx.beginPath();
      for (let i2 = 0; i2 < n2; i2++) {
        const pt2 = P2[i2];
        const sx = pt2[0] + cx * f2 * 2;
        const sy = pt2[1] - cy * f2 * 2;
        i2 === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }
    if (progress >= 1 && !shape.sub) {
      const e2 = P2[n2 - 1];
      ctx.globalAlpha = o2 * this.defaults.blotOpacity;
      ctx.fillStyle = shade2(c0, -0.2);
      ctx.beginPath();
      ctx.arc(e2[0], e2[1], w2 * this.defaults.blotScale, 0, 7);
      ctx.fill();
    }
    ctx.restore();
  }
  /**
   * Area fill: flat colour at reduced opacity, clipped to the shape.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {string} c0
   * @param {string} c1
   * @param {number} o
   */
  _renderArea(ctx, shape, c0, c1, o2) {
    ctx.save();
    ctx.globalAlpha = o2 * 0.6;
    ctx.fillStyle = c0;
    outlinePath(ctx, shape);
    ctx.fill();
    ctx.restore();
  }
};
var marker_default = MarkerStyle;

// js/styles/calligraphy.js
function resolveColors5(shape) {
  if (shape.color0 != null || shape.color1 != null) {
    const c02 = Array.isArray(shape.color0) ? "#" + shape.color0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? "#" + shape.color1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
var CalligraphyStyle = class {
  name = "calligraphy";
  category = "draw";
  description = "Broad-nib calligraphy with pressure-sensitive ribbon strokes. Wide on downstrokes, thin on upstrokes. A 40\xB0 chisel nib creates a linear gradient along the stroke, with ink pooled at both ends as dark elliptical drops.";
  defaults = {
    strokeSize: { min: 2, max: 12 },
    nibAngle: 0.7,
    // ~40° — the chisel nib angle
    minNibWidth: 2,
    // minimum nib width (narrow part)
    endBlotScale: 0.32,
    // ink pool radius as fraction of nib width
    endBlotOpacity: 0.35,
    // opacity of the ink pooled at stroke ends
    bandStrokeWidth: 0.06,
    // outline of the band as fraction of nib width
    minRegionArea: 200
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 200)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "B",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors5(shape);
    const a2 = shape.params;
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, c0, c1, o2, progress);
    } else {
      this._renderArea(ctx, shape, c0, c1, o2);
    }
  }
  /**
   * Broad-nib ribbon rendering.
   *
   * The nib is held at ~40° (cos/sin of 0.7 radians). The band is
   * constructed by offsetting the centreline by half the nib width
   * along the chisel direction. A linear gradient runs from c0 at
   * the start to c1 at the end of the stroke.
   *
   * Pressure sensitivity is approximated via the stroke width:
   * the band is wider where the source path is wider (a[6] is the
   * base width, and the pressure can vary the effective width).
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {string} c0 - Start colour
   * @param {string} c1 - End colour
   * @param {number} o - Opacity
   * @param {number} progress - 0..1
   */
  _renderStroke(ctx, shape, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(2, a2[6]);
    const nibAngle = this.defaults.nibAngle;
    const cx = Math.cos(nibAngle) * w2 / 2;
    const cy = Math.sin(nibAngle) * w2 / 2;
    const P2 = quadPts(a2, progress, 1, 32);
    const n2 = P2.length;
    const band = new Path2D();
    for (let i2 = 0; i2 < n2; i2++) {
      i2 === 0 ? band.moveTo(P2[i2][0] + cx, P2[i2][1] - cy) : band.lineTo(P2[i2][0] + cx, P2[i2][1] - cy);
    }
    for (let i2 = n2 - 1; i2 >= 0; i2--) {
      band.lineTo(P2[i2][0] - cx, P2[i2][1] + cy);
    }
    band.closePath();
    ctx.save();
    const G2 = ctx.createLinearGradient(P2[0][0], P2[0][1], P2[n2 - 1][0], P2[n2 - 1][1]);
    G2.addColorStop(0, c0);
    G2.addColorStop(1, c1);
    ctx.globalAlpha = o2;
    ctx.fillStyle = G2;
    ctx.fill(band);
    ctx.globalAlpha = o2;
    ctx.strokeStyle = G2;
    ctx.lineWidth = Math.max(0.6, w2 * this.defaults.bandStrokeWidth);
    ctx.stroke(band);
    const blotScale = this.defaults.endBlotScale;
    const blotOpacity = this.defaults.endBlotOpacity;
    for (const e2 of [P2[0], P2[n2 - 1]]) {
      ctx.globalAlpha = o2 * blotOpacity;
      ctx.fillStyle = shade2(c0, -0.35);
      ctx.beginPath();
      ctx.ellipse(e2[0], e2[1], w2 * blotScale, w2 * blotScale * 0.5, nibAngle, 0, 7);
      ctx.fill();
    }
    ctx.restore();
  }
  /**
   * Area rendering: flat gradient fill.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {string} c0
   * @param {string} c1
   * @param {number} o
   */
  _renderArea(ctx, shape, c0, c1, o2) {
    ctx.save();
    ctx.globalAlpha = o2;
    const G2 = ctx.createLinearGradient(
      shape.params[0] - shape.params[2],
      shape.params[1] - shape.params[3],
      shape.params[0] + shape.params[2],
      shape.params[1] + shape.params[3]
    );
    G2.addColorStop(0, c0);
    G2.addColorStop(1, c1);
    ctx.fillStyle = G2;
    outlinePath(ctx, shape);
    ctx.fill();
    ctx.restore();
  }
};
var calligraphy_default = CalligraphyStyle;

// js/styles/cross-hatch.js
function resolveColors6(shape) {
  if (shape.color0 != null || shape.color1 != null) {
    const c02 = Array.isArray(shape.color0) ? "#" + shape.color0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? "#" + shape.color1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
function stampBuild2(lines, o2, R2) {
  const A2 = new Path2D();
  const B2 = new Path2D();
  const st2 = [];
  for (const P2 of lines) {
    const n2 = P2.length;
    if (n2 < 2) continue;
    const cum = [0];
    for (let i2 = 1; i2 < n2; i2++) cum.push(cum[i2 - 1] + Math.hypot(P2[i2][0] - P2[i2 - 1][0], P2[i2][1] - P2[i2 - 1][1]));
    const L2 = cum[n2 - 1];
    if (L2 < 0.01) continue;
    const step = Math.max(o2.minStep || 0.5, o2.w * o2.spacing);
    const steps = Math.min(o2.maxSteps || 240, Math.max(2, Math.ceil(L2 / step)));
    const peak = o2.peak + (R2() - 0.5) * 0.2;
    const hw = o2.hw * (0.85 + R2() * 0.3);
    const c2 = 1 + R2() * 0.6;
    let j2 = 1;
    for (let k2 = 0; k2 <= steps; k2++) {
      const t2 = k2 / steps;
      if (t2 > (o2.upto !== void 0 ? o2.upto : 1)) break;
      const d2 = t2 * L2;
      while (j2 < n2 - 1 && cum[j2] < d2) j2++;
      const seg = cum[j2] - cum[j2 - 1] || 1;
      const f2 = (d2 - cum[j2 - 1]) / seg;
      const px = P2[j2 - 1][0] + (P2[j2][0] - P2[j2 - 1][0]) * f2;
      const py = P2[j2 - 1][1] + (P2[j2][1] - P2[j2 - 1][1]) * f2;
      const pr2 = o2.pmin + (o2.pmax - o2.pmin) / (1 + Math.pow(Math.abs((t2 - peak) / hw), 2 * c2));
      if (R2() < o2.grain * (0.62 - 0.4 * Math.min(1, pr2))) continue;
      const [nx, ny] = normalAt(P2, j2);
      const sc = gaussR(R2) * o2.scatter * o2.w * 0.5 * (1.15 - o2.sharp * 0.5);
      const par = (R2() - 0.5) * step;
      const r2 = Math.max(0.4, o2.w * 0.5 * (0.4 + 0.6 * Math.min(1.1, pr2)) * (0.8 + R2() * 0.4));
      const sx = px - ny * sc + nx * par;
      const sy = py + nx * sc + ny * par;
      const Q2 = R2() < 0.55 ? A2 : B2;
      if (r2 < 1.5) {
        Q2.rect(sx - r2, sy - r2, r2 * 2, r2 * 2);
      } else {
        Q2.moveTo(sx + r2, sy);
        Q2.arc(sx, sy, r2, 0, 7);
      }
      st2.push(sx, sy, r2, Q2 === A2 ? 0 : 1, t2);
    }
  }
  return { A: A2, B: B2, st: st2, base: o2.alpha * (0.8 + R2() * 0.2) };
}
var CrossHatchStyle = class {
  name = "cross-hatch";
  category = "draw";
  description = "Parallel lines at \xB145\xB0 forming a cross-hatch pattern. Multiple layers of hatching at different angles are drawn as stamped brush strokes clipped to the shape, building up tonal density where lines cross.";
  defaults = {
    strokeSize: { min: 2, max: 10 },
    angles: [0, 45, 90, 135],
    // hatch angles in degrees
    layerOpacities: [0.55, 0.25, 0.16, 0.12],
    // decreasing opacity per layer
    density: 1,
    // spacing multiplier (1 = default, <1 = denser, >1 = looser)
    stampGrain: 0.25,
    // grain on individual hatch lines
    stampScatter: 0.3,
    // scatter on individual hatch lines
    minRegionArea: 200
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 200)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(...this._makeHatching(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  /**
   * Generate cross-hatching strokes for a filled region.
   * Each layer of parallel lines is a separate stamped stroke.
   */
  _makeHatching(region, color) {
    const strokes = [];
    const size = Math.max(region.w, region.h, 8);
    const w2 = lerp2(this.defaults.strokeSize.min * 0.5, this.defaults.strokeSize.max * 0.7, R2());
    const gap = w2 * 2.5 * (2 - this.defaults.density);
    const half = size * 0.75;
    const R2 = rngFor([region.cx, region.cy, region.w, region.h, w2, 0]);
    for (let layer = 0; layer < this.defaults.angles.length; layer++) {
      const ang = this.defaults.angles[layer] * Math.PI / 180;
      const cs = Math.cos(ang);
      const sn2 = Math.sin(ang);
      const rot = (px, py) => [region.cx + px * cs - py * sn2, region.cy + px * sn2 + py * cs];
      for (let y2 = -half; y2 <= half; y2 += gap) {
        const j2 = (R2() - 0.5) * gap * 0.3;
        const p0 = rot(-half + R2() * size * 0.1, y2 + j2);
        const mid = rot(0, y2);
        const p1 = rot(half - R2() * size * 0.1, y2 - j2);
        strokes.push({
          type: "S",
          params: [
            p0[0],
            p0[1],
            mid[0],
            mid[1],
            p1[0],
            p1[1],
            w2,
            ang,
            color,
            color,
            this.defaults.layerOpacities[layer] || 0.3
          ],
          color0: color,
          color1: color,
          alpha: this.defaults.layerOpacities[layer] || 0.3,
          seed: [p0[0], p0[1], p1[0], p1[1], w2, layer]
        });
      }
    }
    return strokes;
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors6(shape);
    const a2 = shape.params;
    if (shape.type === "S") {
      this._renderHatchStroke(ctx, shape, c0, o2, progress);
    } else {
      this._renderArea(ctx, shape, c0, c1, o2, progress);
    }
  }
  /**
   * Render a single hatch stroke (used when strokes are drawn
   * as individual lines from the generator).
   */
  _renderHatchStroke(ctx, shape, c0, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(1, a2[6]);
    const R2 = rngFor(shape.seed || a2.slice(0, 6));
    const P2 = quadPts(a2, progress, 1, Math.min(40, Math.max(4, Math.round(a2[6] * 4))));
    const pen = {
      w: w2,
      spacing: 0.5,
      scatter: this.defaults.stampScatter,
      sharp: 0.6,
      grain: this.defaults.stampGrain,
      pmin: 0.7,
      pmax: 1.2,
      peak: 0.5,
      hw: 0.5,
      minStep: 0.4,
      maxSteps: 200,
      alpha: a2[a2.length - 1] * o2,
      upto: progress
    };
    const set = stampBuild2([P2], pen, R2);
    ctx.save();
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.fillStyle = c0;
    ctx.globalAlpha = Math.min(1, set.base);
    ctx.fill(set.A);
    ctx.globalAlpha = Math.min(1, set.base * 0.5);
    ctx.fill(set.B);
    ctx.restore();
  }
  /**
   * Render cross-hatching for an area shape.
   * For areas, we draw multiple layers of parallel hatching
   * at different angles, clipped to the shape boundary.
   */
  _renderArea(ctx, shape, c0, c1, o2, progress) {
    const a2 = shape.params;
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const size = Math.max(b2.w, b2.h, 8);
    const w2 = Math.max(1, a2[6] || size * 0.02);
    const gap = w2 * 2.5;
    const half = size * 0.6;
    const R2 = rngFor(a2.slice(0, 6));
    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();
    const angles = this.defaults.angles;
    for (let layer = 0; layer < angles.length; layer++) {
      const ang = angles[layer] * Math.PI / 180;
      const cs = Math.cos(ang);
      const sn2 = Math.sin(ang);
      const alpha = o2 * (this.defaults.layerOpacities[layer] || 0.3);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = c0;
      ctx.lineWidth = w2;
      ctx.lineCap = "round";
      for (let y2 = -half; y2 <= half; y2 += gap) {
        const x0 = b2.cx + -half * cs - y2 * sn2;
        const y0 = b2.cy + -half * sn2 + y2 * cs;
        const x1 = b2.cx + half * cs - y2 * sn2;
        const y1 = b2.cy + half * sn2 + y2 * cs;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
};
var cross_hatch_default = CrossHatchStyle;

// js/styles/mosaic.js
function resolveColors7(shape) {
  if (shape.color0 != null || shape.color1 != null) {
    const c02 = Array.isArray(shape.color0) ? "#" + shape.color0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? "#" + shape.color1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
var MosaicStyle = class {
  name = "mosaic";
  category = "graphic";
  description = "Grid-based square tiles with dark grout between them. Each tile is filled with a gradient sampled from the source colour, with slight variation per tile and random rotation for an organic, hand-set-tile look.";
  defaults = {
    strokeSize: { min: 2, max: 10 },
    tileSizeFactor: 0.09,
    // tile size as fraction of shape size
    tileSizeMin: 0.5,
    // minimum tile size in pixels
    groutDarken: 0.62,
    // how much to darken the grout colour
    tileLighten: 0.2,
    // highlight on tile gradient
    tileDarken: 0.14,
    // shadow on tile gradient
    tileJitter: 0.07,
    // random rotation per tile (radians)
    tileVariety: 0.12,
    // colour variation per tile
    minRegionArea: 100
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 100)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    if (analyzer && analyzer.edges) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeShape(edge, color));
      }
    }
    return strokes;
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "B",
      params: [region.cx, region.cy, Math.max(region.w, 4), Math.max(region.h, 4), 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors7(shape);
    const a2 = shape.params;
    if (shape.type === "S") {
      const w2 = Math.max(3, a2[6]);
      const barShape = {
        type: "B",
        params: [(a2[0] + a2[4]) / 2, (a2[1] + a2[5]) / 2, Math.abs(a2[4] - a2[0]), w2, 0, c0, c1, o2],
        color0: c0,
        color1: c1,
        alpha: o2
      };
      this._renderArea(ctx, barShape, c0, c1, o2);
    } else {
      this._renderArea(ctx, shape, c0, c1, o2, progress);
    }
  }
  /**
   * Render mosaic tiles within a shape.
   *
   * Each tile is a square filled with a linear gradient
   * (light → base → dark) and bordered by a grout line.
   * A slight random rotation gives the tiles an organic look.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {string} c0 - Base tile colour
   * @param {string} c1 - Secondary colour
   * @param {number} o - Opacity
   * @param {number} progress - 0..1
   */
  _renderArea(ctx, shape, c0, c1, o2, progress) {
    const a2 = shape.params;
    const isStroke = shape.type === "S";
    let cx, cy, w2, h2, r2;
    if (isStroke) {
      const s2 = [a2[0], a2[1], a2[4], a2[5]];
      cx = (s2[0] + s2[2]) / 2;
      cy = (s2[1] + s2[3]) / 2;
      w2 = Math.hypot(s2[2] - s2[0], s2[3] - s2[1]);
      h2 = Math.max(3, a2[6]);
      r2 = Math.atan2(s2[3] - s2[1], s2[2] - s2[0]);
    } else {
      [cx, cy, w2, h2, r2] = a2;
    }
    const P2 = shapePoly({ t: "B", p: [cx, cy, w2 / 2, h2 / 2, r2 || 0] });
    const b2 = boxOf(P2);
    const size = Math.max(b2.w, b2.h, 2);
    const tile = Math.max(this.defaults.tileSizeMin, size * this.defaults.tileSizeFactor);
    const R2 = rngFor(a2.slice(0, 6));
    ctx.save();
    ctx.globalAlpha = o2;
    const groutCol = shade(c0, -this.defaults.groutDarken);
    outlinePath(
      ctx,
      shape.type === "S" ? { type: "B", params: [cx, cy, w2 / 2, h2 / 2, r2 || 0, c0, c1, o2], t: "B", p: [cx, cy, w2 / 2, h2 / 2, r2 || 0] } : shape
    );
    ctx.clip();
    const cols = Math.ceil(b2.w / tile) + 1;
    const rows = Math.ceil(b2.h / tile) + 1;
    const halfW = w2 / 2;
    const halfH = h2 / 2;
    for (let i2 = 0; i2 < cols; i2++) {
      for (let j2 = 0; j2 < rows; j2++) {
        const tx = b2.x0 + i2 * tile;
        const ty = b2.y0 + j2 * tile;
        const px = tx + tile / 2;
        const py = ty + tile / 2;
        const varFactor = 1 - R2() * this.defaults.tileVariety;
        const tileCol = shade2(c0, (R2() - 0.5) * this.defaults.tileVariety);
        const G2 = ctx.createLinearGradient(tx, ty, tx + tile, ty + tile);
        G2.addColorStop(0, shade(tileCol, this.defaults.tileLighten * varFactor));
        G2.addColorStop(0.45, tileCol);
        G2.addColorStop(1, shade(tileCol, -this.defaults.tileDarken * varFactor));
        const rot = (R2() - 0.5) * this.defaults.tileJitter;
        const centerX = tx + tile / 2;
        const centerY = ty + tile / 2;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rot);
        ctx.fillStyle = G2;
        ctx.fillRect(-tile / 2, -tile / 2, tile, tile);
        ctx.strokeStyle = groutCol;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(-tile / 2, -tile / 2, tile, tile);
        ctx.restore();
      }
    }
    ctx.restore();
  }
};
var mosaic_default = MosaicStyle;

// js/styles/scribble.js
function resolveColors8(shape) {
  if (shape.color0 != null || shape.color1 != null) {
    const c02 = Array.isArray(shape.color0) ? "#" + shape.color0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? "#" + shape.color1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
var ScribbleStyle = class {
  name = "scribble";
  category = "graphic";
  description = "Chaotic overlapping strokes within shapes. A pen goes back and forth at random angles, clipped to the shape boundary, with multiple passes building up density.";
  defaults = {
    strokeSize: { min: 2, max: 8 },
    passes: 2,
    // 1-2 passes at different angles
    pass1Threshold: 0.45,
    // < this → 2 passes, else 1
    lineWidthFactor: 0.03,
    // line width as fraction of shape size
    gapFactor: 2.3,
    // gap between lines as fraction of line width
    amplitudeFactor: 0.75,
    // half-extent of scribble as fraction of shape size
    angleJitter: 1,
    // random angle jitter (radians)
    passAngleStep: 1.3,
    // angle offset between passes
    minRegionArea: 50
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 50)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "B",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors8(shape);
    const a2 = shape.params;
    const R2 = rngFor(shape.seed || a2.slice(0, 6));
    this._renderArea(ctx, shape, c0, c1, o2, R2, progress);
  }
  /**
   * Render chaotic scribble strokes within a shape.
   *
   * The scribble is a pen going back-and-forth (zigzag) at a random
   * angle, clipped to the shape boundary. Multiple passes at slightly
   * different angles build up density.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {string} c0 - Colour
   * @param {string} c1
   * @param {number} o - Opacity
   * @param {function} R - Seeded RNG
   * @param {number} progress - 0..1
   */
  _renderArea(ctx, shape, c0, c1, o2, R2, progress) {
    const a2 = shape.params;
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const size = Math.max(b2.w, b2.h, 8);
    const lw = Math.max(0.7, Math.min(3.2, size * this.defaults.lineWidthFactor));
    const gap = lw * this.defaults.gapFactor;
    const half = size * this.defaults.amplitudeFactor;
    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();
    ctx.globalAlpha = o2;
    ctx.strokeStyle = c0;
    ctx.lineWidth = lw;
    ctx.lineCap = ctx.lineJoin = "round";
    const np = R2() < this.defaults.pass1Threshold ? 2 : 1;
    const passes = Math.min(np, Math.floor(1 + progress * 2));
    for (let pass = 0; pass < passes; pass++) {
      if (pass === 1 && progress < 0.5) continue;
      ctx.save();
      ctx.translate(b2.cx, b2.cy);
      ctx.rotate(R2() * Math.PI + pass * this.defaults.passAngleStep);
      ctx.beginPath();
      let y2 = -half;
      let side = 1;
      ctx.moveTo(-half, y2);
      while (y2 < half) {
        y2 += gap * (0.8 + R2() * 0.5);
        ctx.lineTo(side * half + (R2() - 0.5) * gap * 3, y2);
        side = -side;
      }
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
};
var scribble_default = ScribbleStyle;

// js/styles/halftone.js
function resolveColors9(shape) {
  if (shape.color0 != null || shape.color1 != null) {
    const c02 = Array.isArray(shape.color0) ? "#" + shape.color0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? "#" + shape.color1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
function gradT(shape, R2) {
  const a2 = shape.p;
  if (shape.t === "B" || shape.t === "E") {
    const cx = a2[0], cy = a2[1], rx = a2[2], ry = a2[3];
    const r2 = Math.max(1, (rx + ry) / 2);
    return (px, py) => clamp01(Math.hypot(px - cx, py - cy) / r2);
  }
  let dx, dy, m2, n2;
  if (shape.t === "S") {
    const [x0, y0, , , x2, y2] = a2;
    const len = Math.hypot(x2 - x0, y2 - y0) || 1;
    dx = (x2 - x0) / len;
    dy = (y2 - y0) / len;
    m2 = x0 * dx + y0 * dy;
    n2 = x2 * dx + y2 * dy;
  } else {
    let gradient = 0;
    if (shape.t === "R") gradient = typeof a2[4] === "number" ? a2[4] : 0;
    else if (shape.t === "T") gradient = typeof a2[6] === "number" ? a2[6] : 0;
    dx = Math.cos(gradient);
    dy = Math.sin(gradient);
    const verts = shapePoly(shape);
    const b2 = boxOf(verts);
    const proj = [];
    for (let i2 = 0; i2 < verts.length; i2 += 2) {
      proj.push(verts[i2] * dx + verts[i2 + 1] * dy);
    }
    m2 = Math.min(...proj);
    n2 = Math.max(...proj);
  }
  const inv = 1 / Math.max(1e-6, n2 - m2);
  if (!R2) R2 = () => 0.5;
  return (px, py) => clamp01((px * dx + py * dy - m2) * inv * (0.9 + 0.2 * R2()));
}
var HalftoneStyle = class {
  name = "halftone";
  category = "graphic";
  description = "Comic-book Ben-Day dots on a 45\xB0 screen. Dot radius varies with luminance \u2014 light areas produce small or no dots, dark areas produce large dots. Multiple colour layers create the classic halftone printing effect.";
  defaults = {
    strokeSize: { min: 2, max: 10 },
    screenAngle: 0.785,
    // 45° in radians
    dotSizeFactor: 0.07,
    // dot spacing as fraction of shape size
    dotSizeMin: 3.2,
    // minimum dot spacing (px)
    dotSizeMax: 13,
    // maximum dot spacing (px)
    dotRadiusMin: 0.2,
    // minimum dot radius as fraction of spacing
    dotRadiusMax: 0.52,
    // maximum dot radius as fraction of spacing
    colours: 4,
    // number of colour layers
    minRegionArea: 50
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 50)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "B",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors9(shape);
    const a2 = shape.params;
    const R2 = rngFor(shape.seed || a2.slice(0, 6));
    this._renderArea(ctx, shape, c0, c1, o2, R2, progress);
  }
  /**
   * Render halftone dots on a 45° screen grid.
   *
   * Dots are placed on a grid rotated 45°. Each dot's radius is
   * proportional to the tone value at its position. Dots are bucketed
   * into 4 layers (quarters of the [0,1] tone range), each filled with
   * an interpolated colour between c0 and c1.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {string} c0 - Light colour
   * @param {string} c1 - Dark colour
   * @param {number} o - Opacity
   * @param {function} R - Seeded RNG
   * @param {number} progress - 0..1
   */
  _renderArea(ctx, shape, c0, c1, o2, R2, progress) {
    const a2 = shape.params;
    const normShape = { t: shape.type, p: a2 };
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const size = Math.max(b2.w, b2.h, 2);
    const d2 = Math.max(this.defaults.dotSizeMin, Math.min(this.defaults.dotSizeMax, size * this.defaults.dotSizeFactor));
    const n2 = Math.ceil(size * 0.75 / d2) + 1;
    const cs = Math.SQRT1_2;
    const tone = gradT(normShape, R2);
    const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    for (let i2 = -n2; i2 <= n2; i2++) {
      for (let j2 = -n2; j2 <= n2; j2++) {
        const u2 = i2 * d2;
        const v2 = j2 * d2;
        const px = b2.cx + (u2 - v2) * cs;
        const py = b2.cy + (u2 + v2) * cs;
        if (px < b2.x0 - d2 || px > b2.x1 + d2 || py < b2.y0 - d2 || py > b2.y1 + d2) continue;
        const t2 = tone(px, py) * progress;
        const k2 = Math.min(3, Math.floor(t2 * 4));
        const r2 = d2 * (this.defaults.dotRadiusMin + this.defaults.dotRadiusMax * t2);
        paths[k2].moveTo(px + r2, py);
        paths[k2].arc(px, py, r2, 0, 7);
      }
    }
    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();
    ctx.globalAlpha = o2;
    paths.forEach((p2, k2) => {
      ctx.fillStyle = mixHex(c0, c1, (k2 + 0.5) / 4);
      ctx.fill(p2);
    });
    ctx.restore();
  }
};
var halftone_default = HalftoneStyle;

// js/styles/string.js
function resolveColors10(shape) {
  if (shape.color0 != null || shape.color1 != null) {
    const c02 = Array.isArray(shape.color0) ? "#" + shape.color0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? "#" + shape.color1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
var StringStyle = class {
  name = "string";
  category = "craft";
  description = "String art: long straight lines connecting points on a grid, following colour gradients from c0 to c1. Thin threads clipped to the shape boundary create a woven, gradient-thread effect.";
  defaults = {
    strokeSize: { min: 1, max: 4 },
    threadWidth: 0.8,
    // thread line width
    pinDensity: 0.1,
    // pins per unit of shape size
    pinCountMin: 8,
    // minimum number of pins on the perimeter
    pinCountMax: 20,
    // maximum number of pins
    threadsFactor: 0.6,
    // ratio of pin pairs to connect
    threadJitter: 0.15,
    // positional jitter of thread endpoints
    minRegionArea: 50
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 50)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    if (analyzer && analyzer.edges) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    return strokes;
  }
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "B",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors10(shape);
    const a2 = shape.params;
    const R2 = rngFor(shape.seed || a2.slice(0, 6));
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, c0, c1, o2, R2, progress);
    } else {
      this._renderArea(ctx, shape, c0, c1, o2, R2, progress);
    }
  }
  /**
   * Render a single thread stroke with a colour gradient along it.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {string} c0 - Start colour
   * @param {string} c1 - End colour
   * @param {number} o - Opacity
   * @param {function} R - Seeded RNG
   * @param {number} progress - 0..1
   */
  _renderStroke(ctx, shape, c0, c1, o2, R2, progress) {
    const a2 = shape.params;
    const P2 = quadPts(a2, progress, 1, 24);
    ctx.save();
    const G2 = ctx.createLinearGradient(P2[0][0], P2[0][1], P2[P2.length - 1][0], P2[P2.length - 1][1]);
    G2.addColorStop(0, c0);
    G2.addColorStop(1, c1);
    ctx.globalAlpha = o2;
    ctx.strokeStyle = G2;
    ctx.lineWidth = Math.max(this.defaults.threadWidth, a2[6] * 0.4);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(P2[0][0], P2[0][1]);
    for (let i2 = 1; i2 < P2.length; i2++) {
      ctx.lineTo(P2[i2][0], P2[i2][1]);
    }
    ctx.stroke();
    ctx.restore();
  }
  /**
   * Render string art: threads connecting pins on the perimeter.
   *
   * Pins are placed around the shape boundary. Threads connect pairs
   * of pins, with colours following a gradient from c0 to c1 based on
   * the position of the thread's midpoint.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {string} c0 - Gradient start colour
   * @param {string} c1 - Gradient end colour
   * @param {number} o - Opacity
   * @param {function} R - Seeded RNG
   * @param {number} progress - 0..1
   */
  _renderArea(ctx, shape, c0, c1, o2, R2, progress) {
    const a2 = shape.params;
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const size = Math.max(b2.w, b2.h, 4);
    const n2 = Math.max(
      this.defaults.pinCountMin,
      Math.min(this.defaults.pinCountMax, Math.round(size * this.defaults.pinDensity * 3))
    );
    const pins = this._getPins(P2, n2, b2, R2);
    let dx = 1, dy = 0, m2, nn2;
    if (shape.type === "B" || shape.type === "E") {
      const P_str = shapePoly(shape);
      const b22 = boxOf(P_str);
      m2 = b22.x0;
      nn2 = b22.x1;
    } else if (shape.type === "S") {
      const [x0, y0, , , x2, y2] = a2;
      const len = Math.hypot(x2 - x0, y2 - y0) || 1;
      dx = (x2 - x0) / len;
      dy = (y2 - y0) / len;
      m2 = x0 * dx + y0 * dy;
      nn2 = x2 * dx + y2 * dy;
    } else {
      let gradient = 0;
      if (shape.type === "R") gradient = typeof a2[4] === "number" ? a2[4] : 0;
      else if (shape.type === "T") gradient = typeof a2[6] === "number" ? a2[6] : 0;
      dx = Math.cos(gradient);
      dy = Math.sin(gradient);
      const P_str = shapePoly(shape);
      const vert = [];
      for (let i2 = 0; i2 < P_str.length; i2 += 2) vert.push(P_str[i2] * dx + P_str[i2 + 1] * dy);
      m2 = Math.min(...vert);
      nn2 = Math.max(...vert);
    }
    const inv = 1 / Math.max(1e-6, nn2 - m2);
    const threadCount = Math.round(pins.length * pins.length * this.defaults.threadsFactor * progress);
    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();
    ctx.lineCap = "round";
    let drawn = 0;
    const maxThreads = Math.min(threadCount, pins.length * 3);
    for (let i2 = 0; i2 < pins.length && drawn < maxThreads; i2++) {
      for (let j2 = i2 + 1; j2 < pins.length && drawn < maxThreads; j2++) {
        const p1 = pins[i2];
        const p2 = pins[j2];
        const midX = (p1[0] + p2[0]) / 2;
        const midY = (p1[1] + p2[1]) / 2;
        const t2 = clamp01((midX * dx + midY * dy - m2) * inv);
        const col = mixHex(c0, c1, t2);
        const jx1 = p1[0] + (R2() - 0.5) * size * this.defaults.threadJitter;
        const jy1 = p1[1] + (R2() - 0.5) * size * this.defaults.threadJitter;
        const jx2 = p2[0] + (R2() - 0.5) * size * this.defaults.threadJitter;
        const jy2 = p2[1] + (R2() - 0.5) * size * this.defaults.threadJitter;
        ctx.globalAlpha = o2;
        ctx.strokeStyle = col;
        ctx.lineWidth = this.defaults.threadWidth;
        ctx.beginPath();
        ctx.moveTo(jx1, jy1);
        ctx.lineTo(jx2, jy2);
        ctx.stroke();
        drawn++;
      }
    }
    ctx.restore();
  }
  /**
   * Get evenly-spaced pins around the shape perimeter.
   *
   * @param {Array} P - Flat vertex array [x0,y0,x1,y1,...]
   * @param {number} n - Number of pins
   * @param {object} b - Bounding box from boxOf
   * @param {function} R - Seeded RNG
   * @returns {Array<[number, number]>} Pin coordinates
   */
  _getPins(P2, n2, b2, R2) {
    const pins = [];
    const numVerts = P2.length / 2;
    const verts = [];
    for (let i2 = 0; i2 < P2.length; i2 += 2) {
      verts.push([P2[i2], P2[i2 + 1]]);
    }
    const perimeter = [];
    let totalLen = 0;
    for (let i2 = 0; i2 < verts.length; i2++) {
      const j2 = (i2 + 1) % verts.length;
      const dx = verts[j2][0] - verts[i2][0];
      const dy = verts[j2][1] - verts[i2][1];
      const len = Math.hypot(dx, dy);
      perimeter.push({ x0: verts[i2][0], y0: verts[i2][1], x1: verts[j2][0], y1: verts[j2][1], dx, dy, len, start: totalLen });
      totalLen += len;
    }
    const targetLen = totalLen / n2;
    const offset = R2() * targetLen;
    let segIdx = 0;
    for (let i2 = 0; i2 < n2; i2++) {
      const target = offset + i2 * targetLen;
      const wrapped = target % totalLen;
      while (segIdx < perimeter.length - 1 && perimeter[segIdx].start + perimeter[segIdx].len < wrapped) {
        segIdx++;
      }
      const seg = perimeter[segIdx];
      const f2 = (wrapped - seg.start) / Math.max(seg.len, 1e-6);
      pins.push([seg.x0 + seg.dx * f2, seg.y0 + seg.dy * f2]);
    }
    return pins;
  }
};
var string_default = StringStyle;

// js/styles/sumi.js
function resolveColors11(shape) {
  if (shape.color0 != null || shape.color1 != null) {
    const c02 = Array.isArray(shape.color0) ? "#" + shape.color0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? "#" + shape.color1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
var SumiStyle = class {
  name = "sumi";
  category = "paint";
  description = "Bold wet sumi-e ink: loaded brush strokes that swell in the middle and taper to a point at each end. Low-alpha layering lets dense regions build up naturally through overlap, with a subtle wet-bleed softness at the edges.";
  defaults = {
    strokeSize: { min: 5, max: 28 },
    opacity: 0.45,
    // base alpha — layers build up
    taper: 0.72,
    // how strongly ends narrow (0=uniform, 1=pinpoint)
    swell: 0.55,
    // extra width in the middle (fraction of base)
    bleed: 0.08,
    // wet-bleed spread beyond the path (fraction of width)
    bleedOpacity: 0.18,
    // opacity of the bleed halo
    passes: 3,
    // number of offset passes for opacity buildup
    minRegionArea: 200
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 200)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makePool(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makePool(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors11(shape);
    const a2 = shape.params;
    const R2 = rngFor(shape.seed || a2.slice(0, 8));
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, R2, c0, c1, o2, progress);
    } else {
      this._renderPool(ctx, shape, R2, c0, c1, o2);
    }
  }
  /**
   * Render a sumi ink stroke: swell + taper ribbon with wet-bleed halo.
   *
   * The stroke width follows a sinusoidal swell (tapered at ends, fat in the
   * middle). Multiple offset passes at low alpha build up density where strokes
   * overlap — mimicking layered wet ink.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0, c1 - Colour hexes
   * @param {number} o - Opacity
   * @param {number} progress - 0..1
   */
  _renderStroke(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(2, a2[6]);
    const P2 = quadPts(a2, progress, 1, 28);
    const n2 = P2.length;
    if (n2 < 3) return;
    const wid = (i2) => {
      const t2 = i2 / (n2 - 1);
      const swell = Math.sin(Math.PI * t2);
      const e2 = Math.pow(swell, 0.55);
      const taper = 1 - this.defaults.taper * (1 - e2);
      return w2 * (0.55 + this.defaults.swell * e2) * taper;
    };
    const L2 = [];
    const Rt2 = [];
    for (let i2 = 0; i2 < n2; i2++) {
      const [nx, ny] = normalAt(P2, i2);
      const h2 = wid(i2) / 2;
      L2.push([P2[i2][0] + nx * h2, P2[i2][1] + ny * h2]);
      Rt2.push([P2[i2][0] - nx * h2, P2[i2][1] - ny * h2]);
    }
    ctx.save();
    ctx.lineCap = ctx.lineJoin = "round";
    const passes = this.defaults.passes;
    for (let p2 = 0; p2 < passes; p2++) {
      const jx = (R2() - 0.5) * w2 * 0.04;
      const jy = (R2() - 0.5) * w2 * 0.04;
      const passAlpha = o2 * this.defaults.opacity * (0.85 - p2 * 0.18);
      ctx.globalAlpha = passAlpha;
      ctx.fillStyle = c0;
      ctx.beginPath();
      ctx.moveTo(L2[0][0] + jx, L2[0][1] + jy);
      for (let i2 = 1; i2 < n2; i2++) ctx.lineTo(L2[i2][0] + jx, L2[i2][1] + jy);
      for (let i2 = n2 - 1; i2 >= 0; i2--) ctx.lineTo(Rt2[i2][0] + jx, Rt2[i2][1] + jy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = o2 * this.defaults.bleedOpacity;
    ctx.strokeStyle = shade2(c0, -0.15);
    ctx.lineWidth = w2 * (1 + this.defaults.bleed);
    ctx.filter = "blur(1.5px)";
    ctx.beginPath();
    ctx.moveTo(P2[0][0], P2[0][1]);
    for (let i2 = 1; i2 < n2; i2++) ctx.lineTo(P2[i2][0], P2[i2][1]);
    ctx.stroke();
    ctx.filter = "none";
    ctx.globalAlpha = o2 * 0.9;
    ctx.fillStyle = shade2(c0, -0.25);
    ctx.beginPath();
    ctx.arc(P2[0][0], P2[0][1], wid(0) * 0.45, 0, 7);
    ctx.fill();
    ctx.restore();
  }
  /**
   * Render an ink pool (for E/B/T/R shapes).
   * A soft radial fill clipped to the shape, darker at the rim.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0
   * @param {string} c1
   * @param {number} o
   */
  _renderPool(ctx, shape, R2, c0, c1, o2) {
    const a2 = shape.params;
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const r2 = Math.max(1, Math.max(b2.w, b2.h) / 2);
    const G2 = ctx.createRadialGradient(b2.cx, b2.cy, 0, b2.cx, b2.cy, r2);
    G2.addColorStop(0, rgbaOf(c0, 0.42 * o2));
    G2.addColorStop(0.72, rgbaOf(mixHex(c0, c1, 0.3), 0.72 * o2));
    G2.addColorStop(1, rgbaOf(shade2(c0, -0.25), 0.9 * o2));
    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();
    ctx.fillStyle = G2;
    outlinePath(ctx, shape);
    ctx.fill();
    ctx.globalAlpha = o2 * 0.35;
    ctx.strokeStyle = shade2(c0, -0.3);
    ctx.lineWidth = Math.max(0.8, r2 * 0.05);
    outlinePath(ctx, shape);
    ctx.stroke();
    ctx.restore();
  }
};
var sumi_default = SumiStyle;

// js/styles/gouache.js
function resolveColors12(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c02 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
var GouacheStyle = class {
  name = "gouache";
  category = "paint";
  description = "Opaque matte gouache paint: flat colour fill with a subtle darker edge. Fully covers what is beneath \u2014 no transparency or bleed. A thin darker rim gives the soft edge of a brush loaded with pigment.";
  defaults = {
    strokeSize: { min: 3, max: 20 },
    opacity: 0.95,
    // gouache is opaque, but not perfectly so
    edgeDarken: 0.18,
    // darken the perimeter edge
    edgeWidth: 0.12,
    // edge width as fraction of stroke width
    minRegionArea: 200
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 200)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeFill(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeFill(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "B",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors12(shape);
    const a2 = shape.params;
    const R2 = rngFor(shape.seed || a2.slice(0, 8));
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, R2, c0, c1, o2, progress);
    } else {
      this._renderFill(ctx, shape, R2, c0, c1, o2);
    }
  }
  /**
   * Render a gouache stroke: opaque flat ribbon with a darker edge.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0, c1 - Colour hexes
   * @param {number} o - Opacity
   * @param {number} progress - 0..1
   */
  _renderStroke(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(1, a2[6]);
    const P2 = quadPts(a2, progress, 1, 24);
    const n2 = P2.length;
    if (n2 < 3) return;
    const band = new Path2D();
    const hw = w2 / 2;
    for (let i2 = 0; i2 < n2; i2++) {
      const [nx, ny] = normalAt(P2, i2);
      if (i2 === 0) band.moveTo(P2[i2][0] + nx * hw, P2[i2][1] + ny * hw);
      else band.lineTo(P2[i2][0] + nx * hw, P2[i2][1] + ny * hw);
    }
    for (let i2 = n2 - 1; i2 >= 0; i2--) {
      const [nx, ny] = normalAt(P2, i2);
      band.lineTo(P2[i2][0] - nx * hw, P2[i2][1] - ny * hw);
    }
    band.closePath();
    ctx.save();
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.globalAlpha = o2 * this.defaults.opacity;
    ctx.fillStyle = c0;
    ctx.fill(band);
    const col = shade2(c0, -this.defaults.edgeDarken);
    ctx.globalAlpha = o2;
    ctx.strokeStyle = col;
    ctx.lineWidth = w2 * this.defaults.edgeWidth;
    ctx.beginPath();
    ctx.moveTo(P2[0][0], P2[0][1]);
    for (let i2 = 1; i2 < n2; i2++) ctx.lineTo(P2[i2][0], P2[i2][1]);
    ctx.stroke();
    ctx.globalAlpha = o2 * this.defaults.opacity;
    ctx.fillStyle = c0;
    ctx.beginPath();
    ctx.arc(P2[0][0], P2[0][1], w2 * 0.18, 0, 7);
    ctx.fill();
    ctx.restore();
  }
  /**
   * Render a gouache area fill: flat colour with a darker edge.
   */
  _renderFill(ctx, shape, R2, c0, c1, o2) {
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const edge = shade2(c0, -this.defaults.edgeDarken);
    ctx.save();
    ctx.globalAlpha = o2 * this.defaults.opacity;
    ctx.fillStyle = c0;
    outlinePath(ctx, shape);
    ctx.fill();
    ctx.globalAlpha = o2;
    ctx.strokeStyle = edge;
    ctx.lineWidth = Math.max(0.6, Math.max(b2.w, b2.h) * this.defaults.edgeWidth * 0.4);
    outlinePath(ctx, shape);
    ctx.stroke();
    ctx.restore();
  }
};
var gouache_default = GouacheStyle;

// js/styles/knife.js
function resolveColors13(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c02 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
var KnifeStyle = class {
  name = "knife";
  category = "paint";
  description = "Palette knife: broad flat strokes with hard edges and a light ridge highlight suggesting impasto paint. The fill is opaque and flat, with a highlight band along one side of each stroke.";
  defaults = {
    strokeSize: { min: 6, max: 30 },
    opacity: 0.92,
    // nearly opaque
    ridgeLighten: 0.22,
    // lighten for the ridge highlight
    ridgeWidth: 0.18,
    // ridge highlight width as fraction of stroke width
    ridgeJitter: 0.3,
    // randomness in ridge position along stroke
    texture: 0.06,
    // subtle texture noise (stamp jitter)
    minRegionArea: 200
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 200)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeFill(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeFill(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "B",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors13(shape);
    const a2 = shape.params;
    const R2 = rngFor(shape.seed || a2.slice(0, 8));
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, R2, c0, c1, o2, progress);
    } else {
      this._renderFill(ctx, shape, R2, c0, c1, o2, progress);
    }
  }
  /**
   * Render a palette-knife stroke: flat ribbon + ridge highlight.
   * The highlight rides on one side of the stroke, with slight position
   * jitter to mimic the knife's travel.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0, c1 - Colour hexes
   * @param {number} o - Opacity
   * @param {number} progress - 0..1
   */
  _renderStroke(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(2, a2[6]);
    const P2 = quadPts(a2, progress, 1, 22);
    const n2 = P2.length;
    if (n2 < 3) return;
    const hw = w2 / 2;
    const ridgeW = w2 * this.defaults.ridgeWidth;
    const highlight = shade2(c0, this.defaults.ridgeLighten);
    const side = R2() > 0.5 ? 1 : -1;
    ctx.save();
    ctx.lineCap = ctx.lineJoin = "round";
    const band = new Path2D();
    for (let i2 = 0; i2 < n2; i2++) {
      const [nx, ny] = normalAt(P2, i2);
      if (i2 === 0) band.moveTo(P2[i2][0] + nx * hw, P2[i2][1] + ny * hw);
      else band.lineTo(P2[i2][0] + nx * hw, P2[i2][1] + ny * hw);
    }
    for (let i2 = n2 - 1; i2 >= 0; i2--) {
      const [nx, ny] = normalAt(P2, i2);
      band.lineTo(P2[i2][0] - nx * hw, P2[i2][1] - ny * hw);
    }
    band.closePath();
    ctx.globalAlpha = o2 * this.defaults.opacity;
    ctx.fillStyle = c0;
    ctx.fill(band);
    ctx.globalAlpha = o2 * (0.7 + R2() * 0.2);
    ctx.fillStyle = highlight;
    const ridge = new Path2D();
    for (let i2 = 0; i2 < n2; i2++) {
      const [nx, ny] = normalAt(P2, i2);
      const jitter = (R2() - 0.5) * w2 * this.defaults.ridgeJitter;
      const inset = hw * 0.2;
      const px = P2[i2][0] + nx * inset * side + nx * jitter;
      const py = P2[i2][1] + ny * inset * side + ny * jitter;
      if (i2 === 0) ridge.moveTo(px, py);
      else ridge.lineTo(px, py);
    }
    for (let i2 = n2 - 1; i2 >= 0; i2--) {
      const [nx, ny] = normalAt(P2, i2);
      const jitter = (R2() - 0.5) * w2 * this.defaults.ridgeJitter;
      const inset = hw * 0.2;
      const px = P2[i2][0] + nx * inset * side + nx * ridgeW * side - nx * jitter;
      const py = P2[i2][1] + ny * inset * side + ny * ridgeW * side - ny * jitter;
      ridge.lineTo(px, py);
    }
    ridge.closePath();
    ctx.fill(ridge);
    ctx.globalAlpha = o2 * 0.5;
    ctx.strokeStyle = shade2(c0, -0.12);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(P2[0][0], P2[0][1]);
    for (let i2 = 1; i2 < n2; i2++) ctx.lineTo(P2[i2][0], P2[i2][1]);
    ctx.stroke();
    ctx.restore();
  }
  /**
   * Render palette-knife area fill: flat opaque fill with directional
   * highlight band suggesting knife-drag impasto ridges.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0
   * @param {string} c1
   * @param {number} o
   * @param {number} progress
   */
  _renderFill(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const size = Math.max(b2.w, b2.h, 2);
    ctx.save();
    ctx.globalAlpha = o2 * this.defaults.opacity;
    ctx.fillStyle = c0;
    outlinePath(ctx, shape);
    ctx.fill();
    const col = shade2(c0, this.defaults.ridgeLighten);
    ctx.globalAlpha = o2 * 0.5;
    ctx.fillStyle = col;
    const bandW = b2.w * 0.18;
    const bandH = b2.h * 1.4;
    const offset = size * 0.06;
    const ang = a2[4] || 0;
    outlinePath(ctx, shape);
    ctx.clip();
    ctx.save();
    ctx.translate(b2.cx + offset * Math.cos(ang), b2.cy + offset * Math.sin(ang));
    ctx.rotate(ang);
    ctx.fillRect(-bandW / 2, -bandH / 2, bandW, bandH);
    ctx.restore();
    ctx.globalAlpha = o2 * 0.4;
    ctx.strokeStyle = shade2(c0, -0.15);
    ctx.lineWidth = Math.max(0.5, size * 0.02);
    outlinePath(ctx, shape);
    ctx.stroke();
    ctx.restore();
  }
};
var knife_default = KnifeStyle;

// js/styles/pastel.js
function resolveColors14(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c02 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
var PastelStyle = class {
  name = "pastel";
  category = "draw";
  description = "Soft pastel: chalky powder with grain, light speckle, and soft blended edges. Dry-medium texture \u2014 pigment sits on the paper surface rather than flowing.";
  defaults = {
    strokeSize: { min: 5, max: 22 },
    opacity: 0.78,
    // pastel is semi-translucent powder
    speckle: 0.15,
    // colour jitter per stamp
    grainSkip: 0.28,
    // fraction of stamps skipped (dry-media look)
    stampScatter: 0.65,
    // sideways drift of stamps
    softEdge: 0.35,
    // edge softness as fraction of stamp radius
    dotSize: 0.7,
    // stamp radius as fraction of half-stroke-width
    minRegionArea: 200
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 200)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeFill(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeFill(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "B",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors14(shape);
    const a2 = shape.params;
    const R2 = rngFor(shape.seed || a2.slice(0, 8));
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, R2, c0, c1, o2, progress);
    } else {
      this._renderFill(ctx, shape, R2, c0, c1, o2, progress);
    }
  }
  /**
   * Render a pastel stroke: scattered soft circular stamps with grain.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0, c1
   * @param {number} o - Opacity
   * @param {number} progress - 0..1
   */
  _renderStroke(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(2, a2[6]);
    const P2 = quadPts(a2, progress, 1, 24);
    const n2 = P2.length;
    if (n2 < 3) return;
    const cum = [0];
    for (let i2 = 1; i2 < n2; i2++) {
      cum.push(cum[i2 - 1] + Math.hypot(P2[i2][0] - P2[i2 - 1][0], P2[i2][1] - P2[i2 - 1][1]));
    }
    const L2 = cum[n2 - 1];
    const stampR = w2 * this.defaults.dotSize * 0.5;
    const step = stampR * 1.6;
    const steps = Math.ceil(L2 / step);
    ctx.save();
    ctx.lineCap = ctx.lineJoin = "round";
    let j2 = 1;
    for (let k2 = 0; k2 <= steps; k2++) {
      const t2 = k2 / steps;
      if (t2 > progress) break;
      if (R2() < this.defaults.grainSkip) continue;
      const d2 = t2 * L2;
      while (j2 < n2 - 2 && cum[j2] < d2) j2++;
      const seg = cum[j2] - cum[j2 - 1] || 1;
      const f2 = (d2 - cum[j2 - 1]) / seg;
      const px = P2[j2 - 1][0] + (P2[j2][0] - P2[j2 - 1][0]) * f2;
      const py = P2[j2 - 1][1] + (P2[j2][1] - P2[j2 - 1][1]) * f2;
      const [nx, ny] = normalAt(P2, j2);
      const sc = gaussR(R2) * this.defaults.stampScatter * stampR * 0.5;
      const sx = px + nx * sc;
      const sy = py + ny * sc;
      const r2 = stampR * (0.7 + R2() * 0.6);
      const jit = this.defaults.speckle;
      const shadeFactor = (R2() - 0.5) * jit;
      const fillCol = shade2(c0, shadeFactor);
      const rad = r2;
      const innerR = r2 * this.defaults.softEdge;
      const G2 = ctx.createRadialGradient(sx, sy, innerR, sx, sy, rad);
      G2.addColorStop(0, fillCol);
      G2.addColorStop(1, `rgba(0,0,0,0)`);
      ctx.globalAlpha = o2 * this.defaults.opacity * (0.75 + R2() * 0.4);
      ctx.fillStyle = G2;
      ctx.beginPath();
      ctx.arc(sx, sy, rad, 0, 7);
      ctx.fill();
      j2++;
    }
    ctx.restore();
  }
  /**
   * Render a pastel area fill: grid of soft chalky dots with variation.
   */
  _renderFill(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const size = Math.max(b2.w, b2.h, 4);
    const dotRad = Math.max(1.5, size * 0.045);
    const gap = dotRad * 1.8;
    ctx.save();
    ctx.lineCap = ctx.lineJoin = "round";
    outlinePath(ctx, shape);
    ctx.clip();
    ctx.globalAlpha = o2 * this.defaults.opacity;
    const cols = Math.ceil(b2.w / gap) + 1;
    const rows = Math.ceil(b2.h / gap) + 1;
    for (let i2 = 0; i2 < cols; i2++) {
      for (let j2 = 0; j2 < rows; j2++) {
        if (R2() > progress) continue;
        if (R2() < 0.15) continue;
        const px = b2.x0 + i2 * gap + (R2() - 0.5) * gap * 0.4;
        const py = b2.y0 + j2 * gap + (R2() - 0.5) * gap * 0.4;
        if (px < b2.x0 - dotRad || px > b2.x1 + dotRad || py < b2.y0 - dotRad || py > b2.y1 + dotRad) continue;
        const r2 = dotRad * (0.5 + R2() * 0.8);
        const shadeFactor = (R2() - 0.5) * this.defaults.speckle;
        const fillCol = shade2(c0, shadeFactor);
        const innerR = r2 * this.defaults.softEdge;
        const G2 = ctx.createRadialGradient(px, py, innerR, px, py, r2);
        G2.addColorStop(0, fillCol);
        G2.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = G2;
        ctx.beginPath();
        ctx.arc(px, py, r2, 0, 7);
        ctx.fill();
      }
    }
    ctx.restore();
  }
};
var pastel_default = PastelStyle;

// js/styles/pen.js
function resolveColors15(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c02 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
var PenStyle = class {
  name = "pen";
  category = "draw";
  description = "Technical pen: thin crisp constant-width lines with perfectly clean edges, no grain or scatter. Area fills are rendered as outline + parallel cross-hatch lines at a fixed angle, like a drafting pen on Bristol board.";
  defaults = {
    strokeSize: { min: 1, max: 6 },
    opacity: 1,
    // solid, no transparency
    hatchGap: 3.5,
    // gap between hatch lines (px)
    hatchAngle: -0.785,
    // default 45° cross-hatch
    minRegionArea: 200
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 200)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeFill(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeFill(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "B",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors15(shape);
    const a2 = shape.params;
    const R2 = rngFor(shape.seed || a2.slice(0, 8));
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, R2, c0, c1, o2, progress);
    } else {
      this._renderFill(ctx, shape, R2, c0, c1, o2, progress);
    }
  }
  /**
   * Render a technical pen stroke: single clean constant-width line.
   * No grain, no scatter, no pressure variation.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG (unused — lines are perfectly straight)
   * @param {string} c0, c1
   * @param {number} o - Opacity
   * @param {number} progress - 0..1
   */
  _renderStroke(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(0.5, a2[6]);
    const P2 = quadPts(a2, progress, 1, 28);
    const n2 = P2.length;
    if (n2 < 2) return;
    ctx.save();
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.globalAlpha = o2;
    ctx.strokeStyle = c0;
    ctx.lineWidth = w2;
    ctx.beginPath();
    ctx.moveTo(P2[0][0], P2[0][1]);
    for (let i2 = 1; i2 < n2; i2++) ctx.lineTo(P2[i2][0], P2[i2][1]);
    ctx.stroke();
    ctx.restore();
  }
  /**
   * Render a technical pen area fill: outline + parallel cross-hatch lines.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0
   * @param {string} c1
   * @param {number} o
   * @param {number} progress
   */
  _renderFill(ctx, shape, R2, c0, c1, o2, progress) {
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const size = Math.max(b2.w, b2.h, 2);
    ctx.save();
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.globalAlpha = o2;
    ctx.strokeStyle = c0;
    const lineW = Math.max(0.5, size * 0.015);
    ctx.lineWidth = lineW;
    outlinePath(ctx, shape);
    ctx.stroke();
    const gap = this.defaults.hatchGap;
    const ang = this.defaults.hatchAngle;
    const cs = Math.cos(ang);
    const sn2 = Math.sin(ang);
    const half = size * 0.65;
    const cols = Math.ceil(2 * half / gap) + 2;
    const hatchPath = new Path2D();
    for (let i2 = -cols; i2 <= cols; i2++) {
      const d2 = i2 * gap;
      const x0 = b2.cx + d2 * cs - half * sn2;
      const y0 = b2.cy + d2 * sn2 + half * cs;
      const x1 = b2.cx + d2 * cs + half * sn2;
      const y1 = b2.cy + d2 * sn2 - half * cs;
      if (x0 < b2.x0 - gap && x1 < b2.x0 - gap) continue;
      if (x0 > b2.x1 + gap && x1 > b2.x1 + gap) continue;
      if (y0 < b2.y0 - gap && y1 < b2.y0 - gap) continue;
      if (y0 > b2.y1 + gap && y1 > b2.y1 + gap) continue;
      hatchPath.moveTo(x0, y0);
      hatchPath.lineTo(x1, y1);
    }
    outlinePath(ctx, shape);
    ctx.clip();
    ctx.globalAlpha = o2 * 0.85;
    ctx.strokeStyle = c0;
    ctx.lineWidth = lineW;
    ctx.stroke(hatchPath);
    ctx.restore();
  }
};
var pen_default = PenStyle;

// js/styles/wash.js
function resolveColors16(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c02 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
var WashStyle = class {
  name = "wash";
  category = "paint";
  description = "Wash: very translucent broad color with soft feathered edges. Overlap darkens naturally \u2014 each pass deposits a thin layer of diluted pigment, building up density where strokes cross.";
  defaults = {
    strokeSize: { min: 8, max: 40 },
    opacity: 0.15,
    // very translucent base layer
    feather: 0.3,
    // edge feathering as fraction of width
    passes: 4,
    // overlapping passes for buildup
    passAlpha: 0.22,
    // alpha per pass (cumulative = heavier overlaps)
    minRegionArea: 200
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 200)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makePool(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makePool(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors16(shape);
    const a2 = shape.params;
    const R2 = rngFor(shape.seed || a2.slice(0, 8));
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, R2, c0, c1, o2, progress);
    } else {
      this._renderPool(ctx, shape, R2, c0, c1, o2, progress);
    }
  }
  /**
   * Render a wash stroke: multiple translucent soft-edged ribbons.
   * Each pass is offset slightly and at reduced alpha, so overlaps
   * accumulate darkness naturally.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0, c1
   * @param {number} o - Opacity
   * @param {number} progress - 0..1
   */
  _renderStroke(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(4, a2[6]);
    const P2 = quadPts(a2, progress, 1, 24);
    const n2 = P2.length;
    if (n2 < 3) return;
    const feather = w2 * this.defaults.feather;
    ctx.save();
    ctx.lineCap = ctx.lineJoin = "round";
    const passes = this.defaults.passes;
    for (let p2 = 0; p2 < passes; p2++) {
      const jx = (R2() - 0.5) * w2 * 0.08;
      const jy = (R2() - 0.5) * w2 * 0.08;
      const pw = w2 + feather * 2;
      const band = new Path2D();
      const hw = pw / 2;
      for (let i2 = 0; i2 < n2; i2++) {
        const [nx, ny] = normalAt(P2, i2);
        if (i2 === 0) band.moveTo(P2[i2][0] + nx * hw + jx, P2[i2][1] + ny * hw + jy);
        else band.lineTo(P2[i2][0] + nx * hw + jx, P2[i2][1] + ny * hw + jy);
      }
      for (let i2 = n2 - 1; i2 >= 0; i2--) {
        const [nx, ny] = normalAt(P2, i2);
        band.lineTo(P2[i2][0] - nx * hw + jx, P2[i2][1] - ny * hw + jy);
      }
      band.closePath();
      ctx.globalAlpha = o2 * this.defaults.opacity * this.defaults.passAlpha * (0.85 + p2 * 0.05);
      ctx.fillStyle = c0;
      ctx.fill(band);
    }
    ctx.filter = `blur(${feather * 0.4}px)`;
    ctx.globalAlpha = o2 * this.defaults.opacity * 0.5;
    ctx.fillStyle = c0;
    ctx.fillRect(
      Math.min(...P2.map((p2) => p2[0])) - feather,
      Math.min(...P2.map((p2) => p2[1])) - feather,
      Math.max(...P2.map((p2) => p2[0])) - Math.min(...P2.map((p2) => p2[0])) + feather * 2,
      Math.max(...P2.map((p2) => p2[1])) - Math.min(...P2.map((p2) => p2[1])) + feather * 2
    );
    ctx.filter = "none";
    ctx.restore();
  }
  /**
   * Render a wash pool (for E/B/T/R shapes).
   * Soft radial gradient: light at center, darker toward rim (pooled pigment).
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {function} R - Seeded RNG
   * @param {string} c0
   * @param {string} c1
   * @param {number} o
   */
  _renderPool(ctx, shape, R2, c0, c1, o2) {
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const r2 = Math.max(1, Math.max(b2.w, b2.h) / 2);
    const G2 = ctx.createRadialGradient(b2.cx, b2.cy, 0, b2.cx, b2.cy, r2);
    G2.addColorStop(0, rgbaOf(c0, o2 * this.defaults.opacity * 0.5));
    G2.addColorStop(0.6, rgbaOf(mixHex(c0, c1, 0.2), o2 * this.defaults.opacity * 0.7));
    G2.addColorStop(1, rgbaOf(shade2(c0, -0.1), o2 * this.defaults.opacity));
    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();
    ctx.fillStyle = G2;
    ctx.fillRect(b2.cx - r2 - 2, b2.cy - r2 - 2, r2 * 2 + 4, r2 * 2 + 4);
    ctx.restore();
  }
};
var wash_default = WashStyle;

// js/styles/dots.js
function resolveColors17(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c02 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
var DotsStyle = class {
  name = "dots";
  category = "graphic";
  description = "Stipple / Ben-Day dots: small round dots with hard edges, placed on a grid with subtle radius and colour jitter. Dot size varies with local tone \u2014 darker areas get larger dots.";
  defaults = {
    strokeSize: { min: 2, max: 10 },
    dotSizeMin: 1.5,
    // minimum dot radius (px)
    dotSizeMax: 5.2,
    // maximum dot radius (px)
    spacingFactor: 0.08,
    // dot spacing as fraction of shape size
    spacingMin: 4,
    // minimum spacing (px)
    spacingMax: 12,
    // maximum spacing (px)
    radiusJitter: 0.25,
    // random radius variation (±fraction)
    colorJitter: 0.08,
    // subtle colour variation
    minRegionArea: 50
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 50)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    if (analyzer && analyzer.edges) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    return strokes;
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "B",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, 3, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 3, 0]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors17(shape);
    const a2 = shape.params;
    const R2 = rngFor(shape.seed || a2.slice(0, 8));
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, R2, c0, c1, o2, progress);
    } else {
      this._renderArea(ctx, shape, R2, c0, c1, o2, progress);
    }
  }
  /**
   * Render dots along a stroke path.
   * Dots are stamped at regular intervals along the centreline.
   */
  _renderStroke(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(2, a2[6]);
    const P2 = quadPts(a2, progress, 1, 30);
    const n2 = P2.length;
    if (n2 < 2) return;
    const cum = [0];
    for (let i2 = 1; i2 < n2; i2++) {
      cum.push(cum[i2 - 1] + Math.hypot(P2[i2][0] - P2[i2 - 1][0], P2[i2][1] - P2[i2 - 1][1]));
    }
    const L2 = cum[n2 - 1];
    const d2 = Math.max(this.defaults.dotSizeMin * 3, w2 * 0.6);
    const steps = Math.ceil(L2 / d2);
    const rad = this.defaults.dotSizeMin + R2() * (this.defaults.dotSizeMax - this.defaults.dotSizeMin);
    ctx.save();
    ctx.globalAlpha = o2;
    ctx.fillStyle = c0;
    let j2 = 1;
    for (let k2 = 0; k2 <= steps; k2++) {
      if (k2 / steps > progress) break;
      const t2 = k2 / steps;
      const target = t2 * L2;
      while (j2 < n2 - 2 && cum[j2] < target) j2++;
      const seg = cum[j2] - cum[j2 - 1] || 1;
      const f2 = (target - cum[j2 - 1]) / seg;
      const px = P2[j2 - 1][0] + (P2[j2][0] - P2[j2 - 1][0]) * f2;
      const py = P2[j2 - 1][1] + (P2[j2][1] - P2[j2 - 1][1]) * f2;
      const r2 = rad * (1 + (R2() - 0.5) * this.defaults.radiusJitter * 2);
      const jit = (R2() - 0.5) * this.defaults.colorJitter;
      const col = shade2(c0, jit);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(px, py, r2, 0, 7);
      ctx.fill();
    }
    ctx.restore();
  }
  /**
   * Render dots within an area shape on a screen grid.
   * Dot radius varies based on a tone gradient projection along the
   * shape's axis: darker (t→1) gets larger dots.
   */
  _renderArea(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const size = Math.max(b2.w, b2.h, 4);
    const spacing = clamp01(
      lerp2(
        this.defaults.spacingMin,
        this.defaults.spacingMax,
        clamp01(size * 0.05)
      )
    );
    const gradAngle = typeof a2[5] === "number" ? a2[5] : 0;
    const dx = Math.cos(gradAngle);
    const dy = Math.sin(gradAngle);
    const proj = [];
    for (let i2 = 0; i2 < P2.length; i2 += 2) {
      proj.push(P2[i2] * dx + P2[i2 + 1] * dy);
    }
    const m2 = Math.min(...proj);
    const n2 = Math.max(...proj);
    const inv = 1 / Math.max(1e-6, n2 - m2);
    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();
    ctx.globalAlpha = o2;
    const cols = Math.ceil(b2.w / spacing) + 2;
    const rows = Math.ceil(b2.h / spacing) + 2;
    for (let i2 = 0; i2 < cols; i2++) {
      for (let j2 = 0; j2 < rows; j2++) {
        const px = b2.x0 + i2 * spacing + (R2() - 0.5) * spacing * 0.3;
        const py = b2.y0 + j2 * spacing + (R2() - 0.5) * spacing * 0.3;
        if (px < b2.x0 - spacing || px > b2.x1 + spacing) continue;
        if (py < b2.y0 - spacing || py > b2.y1 + spacing) continue;
        const t2 = clamp01((px * dx + py * dy - m2) * inv);
        if (t2 * progress < 0.03) continue;
        const rad = clamp01(
          lerp2(this.defaults.dotSizeMin, this.defaults.dotSizeMax, t2)
        ) * (0.8 + R2() * 0.4);
        const jit = (R2() - 0.5) * this.defaults.colorJitter;
        const col = shade2(mixHex(c0, c1, t2), jit);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, 7);
        ctx.fill();
      }
    }
    ctx.restore();
  }
};
var dots_default = DotsStyle;

// js/styles/confetti.js
function resolveColors18(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c02 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
var ConfettiStyle = class {
  name = "confetti";
  category = "graphic";
  description = "Confetti: small rotated rectangles and triangles, opaque, with random orientation and colour variation between c0 and c1. Like party streamers scattered across the canvas.";
  defaults = {
    strokeSize: { min: 2, max: 10 },
    pieceSizeMin: 2.4,
    // minimum piece size (px)
    pieceSizeMax: 8,
    // maximum piece size (px)
    spacingFactor: 0.14,
    // piece spacing as fraction of shape size
    spacingMin: 5,
    // minimum spacing (px)
    spacingMax: 14,
    // maximum spacing (px)
    triRatio: 0.35,
    // fraction of pieces that are triangles
    colorJitter: 0.18,
    // colour variation (fraction c0↔c1)
    sizeJitter: 0.25,
    // random size variation
    spinJitter: 0.2,
    // randomness in rotation
    minRegionArea: 50
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 50)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    if (analyzer && analyzer.edges) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    return strokes;
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "B",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, 3, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 3, 0]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors18(shape);
    const a2 = shape.params;
    const R2 = rngFor(shape.seed || a2.slice(0, 8));
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, R2, c0, c1, o2, progress);
    } else {
      this._renderArea(ctx, shape, R2, c0, c1, o2, progress);
    }
  }
  /**
   * Render confetti pieces along a stroke path.
   */
  _renderStroke(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(2, a2[6]);
    const P2 = quadPts(a2, progress, 1, 30);
    const n2 = P2.length;
    if (n2 < 2) return;
    const cum = [0];
    for (let i2 = 1; i2 < n2; i2++) {
      cum.push(cum[i2 - 1] + Math.hypot(P2[i2][0] - P2[i2 - 1][0], P2[i2][1] - P2[i2 - 1][1]));
    }
    const L2 = cum[n2 - 1];
    const d2 = Math.max(this.defaults.pieceSizeMin * 4, w2 * 0.8);
    const steps = Math.ceil(L2 / d2);
    ctx.save();
    ctx.globalAlpha = o2;
    ctx.lineCap = ctx.lineJoin = "round";
    let j2 = 1;
    for (let k2 = 0; k2 <= steps; k2++) {
      if (k2 / steps > progress) break;
      const t2 = k2 / steps;
      const target = t2 * L2;
      while (j2 < n2 - 2 && cum[j2] < target) j2++;
      const seg = cum[j2] - cum[j2 - 1] || 1;
      const f2 = (target - cum[j2 - 1]) / seg;
      const px = P2[j2 - 1][0] + (P2[j2][0] - P2[j2 - 1][0]) * f2;
      const py = P2[j2 - 1][1] + (P2[j2][1] - P2[j2 - 1][1]) * f2;
      const size = lerp2(this.defaults.pieceSizeMin, this.defaults.pieceSizeMax, R2()) * (0.8 + R2() * this.defaults.sizeJitter);
      const rot = R2() * Math.PI * 2 + gaussR(R2) * this.defaults.spinJitter;
      const colT = R2() * (1 + this.defaults.colorJitter * 2) - this.defaults.colorJitter;
      const col = mixHex(c0, c1, clamp01(colT));
      ctx.fillStyle = col;
      if (R2() < this.defaults.triRatio) {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.866);
        ctx.lineTo(size * 0.75, size * 0.433);
        ctx.lineTo(-size * 0.75, size * 0.433);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.restore();
      }
      j2++;
    }
    ctx.restore();
  }
  /**
   * Render confetti pieces within an area shape.
   */
  _renderArea(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const size = Math.max(b2.w, b2.h, 4);
    const spacing = clamp01(
      lerp2(
        this.defaults.spacingMin,
        this.defaults.spacingMax,
        clamp01(size * this.defaults.spacingFactor)
      )
    );
    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();
    ctx.globalAlpha = o2;
    ctx.lineCap = ctx.lineJoin = "miter";
    const cols = Math.ceil(b2.w / spacing) + 1;
    const rows = Math.ceil(b2.h / spacing) + 1;
    for (let i2 = 0; i2 < cols; i2++) {
      for (let j2 = 0; j2 < rows; j2++) {
        const px = b2.x0 + i2 * spacing + (R2() - 0.5) * spacing * 0.4;
        const py = b2.y0 + j2 * spacing + (R2() - 0.5) * spacing * 0.4;
        if (px < b2.x0 - spacing || px > b2.x1 + spacing) continue;
        if (py < b2.y0 - spacing || py > b2.y1 + spacing) continue;
        const pieceSize = lerp2(this.defaults.pieceSizeMin, this.defaults.pieceSizeMax, R2()) * (0.8 + R2() * this.defaults.sizeJitter);
        const rot = R2() * Math.PI * 2 + gaussR(R2) * this.defaults.spinJitter;
        const colT = R2() * (1 + this.defaults.colorJitter * 2) - this.defaults.colorJitter;
        const col = mixHex(c0, c1, clamp01(colT));
        ctx.fillStyle = col;
        if (R2() < this.defaults.triRatio) {
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(rot);
          ctx.beginPath();
          ctx.moveTo(0, -pieceSize * 0.866);
          ctx.lineTo(pieceSize * 0.75, pieceSize * 0.433);
          ctx.lineTo(-pieceSize * 0.75, pieceSize * 0.433);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(rot);
          ctx.fillRect(-pieceSize / 2, -pieceSize / 2, pieceSize, pieceSize);
          ctx.restore();
        }
      }
    }
    ctx.restore();
  }
};
var confetti_default = ConfettiStyle;

// js/styles/hylics.js
function resolveColors19(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c02 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
var HylicsStyle = class {
  name = "hylics";
  category = "graphic";
  description = "Claymation look: lumpy rounded blobs with wobbly edges, muted clay colors, soft shading, and a gentle drop shadow. Strokes are fat ribbons with uneven width and a matte surface.";
  defaults = {
    strokeSize: { min: 8, max: 30 },
    edgeNoise: 0.18,
    // wobbly edge amplitude (fraction of radius)
    edgeFreq: 5,
    // number of sine cycles around the perimeter
    shadowBlur: 2.5,
    // soft shadow blur radius
    shadowOffset: 1.5,
    // shadow offset distance
    shadowOpacity: 0.18,
    // shadow darkness
    matteDarken: 0.15,
    // rim darkening for clay shading
    matteLighten: 0.25,
    // highlight lighten for clay
    minRegionArea: 100
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 100)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors19(shape);
    const a2 = shape.params;
    const R2 = rngFor(shape.seed || a2.slice(0, 8));
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, R2, c0, c1, o2, progress);
    } else {
      this._renderArea(ctx, shape, R2, c0, c1, o2, progress);
    }
  }
  /**
   * Render a clay ribbon stroke with wobbly edges and soft shadow.
   */
  _renderStroke(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(2, a2[6]);
    const P2 = quadPts(a2, progress, 1, 24);
    const n2 = P2.length;
    if (n2 < 3) return;
    ctx.save();
    ctx.filter = `blur(${this.defaults.shadowBlur}px)`;
    ctx.globalAlpha = o2 * this.defaults.shadowOpacity;
    ctx.fillStyle = "#000000";
    const band = new Path2D();
    for (let i2 = 0; i2 < n2; i2++) {
      const [nx, ny] = normalAt(P2, i2);
      const off = w2 / 2 * (0.5 + this.defaults.edgeNoise * gaussR(R2));
      i2 === 0 ? band.moveTo(P2[i2][0] + nx * off, P2[i2][1] + ny * off) : band.lineTo(P2[i2][0] + nx * off, P2[i2][1] + ny * off);
    }
    for (let i2 = n2 - 1; i2 >= 0; i2--) {
      const [nx, ny] = normalAt(P2, i2);
      const off = w2 / 2 * (0.5 + this.defaults.edgeNoise * gaussR(R2));
      band.lineTo(P2[i2][0] - nx * off, P2[i2][1] - ny * off);
    }
    band.closePath();
    ctx.translate(this.defaults.shadowOffset, this.defaults.shadowOffset);
    ctx.fill(band);
    ctx.filter = "none";
    const fillCol = rgbaOf(mixHex(c0, c1, 0.3), o2 * 0.9);
    ctx.globalAlpha = o2 * 0.9;
    ctx.fillStyle = fillCol;
    const fill = new Path2D();
    for (let i2 = 0; i2 < n2; i2++) {
      const [nx, ny] = normalAt(P2, i2);
      const off = w2 / 2 * (0.5 + this.defaults.edgeNoise * gaussR(R2));
      i2 === 0 ? fill.moveTo(P2[i2][0] + nx * off, P2[i2][1] + ny * off) : fill.lineTo(P2[i2][0] + nx * off, P2[i2][1] + ny * off);
    }
    for (let i2 = n2 - 1; i2 >= 0; i2--) {
      const [nx, ny] = normalAt(P2, i2);
      const off = w2 / 2 * (0.5 + this.defaults.edgeNoise * gaussR(R2));
      fill.lineTo(P2[i2][0] - nx * off, P2[i2][1] - ny * off);
    }
    fill.closePath();
    ctx.fill(fill);
    ctx.globalAlpha = o2 * 0.4;
    ctx.strokeStyle = shade2(c0, this.defaults.matteLighten);
    ctx.lineWidth = Math.max(1, w2 * 0.15);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(P2[0][0], P2[0][1]);
    for (let i2 = 1; i2 < n2; i2++) ctx.lineTo(P2[i2][0], P2[i2][1]);
    ctx.stroke();
    ctx.restore();
  }
  /**
   * Render a clay blob / area with wobbly edges, soft shadow, and
   * matte radial shading.
   */
  _renderArea(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const path2 = raggedPath(shape, R2, this.defaults.edgeNoise);
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const r2 = Math.max(1, Math.max(b2.w, b2.h) / 2);
    ctx.save();
    ctx.filter = `blur(${this.defaults.shadowBlur}px)`;
    ctx.globalAlpha = o2 * this.defaults.shadowOpacity;
    ctx.fillStyle = "#000000";
    ctx.translate(this.defaults.shadowOffset, this.defaults.shadowOffset);
    ctx.fill(path2);
    ctx.translate(-this.defaults.shadowOffset, -this.defaults.shadowOffset);
    ctx.filter = "none";
    const G2 = ctx.createRadialGradient(
      b2.cx,
      b2.cy,
      0,
      b2.cx,
      b2.cy,
      r2
    );
    G2.addColorStop(0, rgbaOf(mixHex(c0, c1, 0.2), o2 * 0.85));
    G2.addColorStop(0.7, rgbaOf(mixHex(c0, c1, 0.5), o2 * 0.9));
    G2.addColorStop(1, rgbaOf(shade2(c0, -this.defaults.matteDarken), o2 * 0.95));
    ctx.globalAlpha = o2 * 0.9;
    ctx.fillStyle = G2;
    ctx.fill(path2);
    ctx.globalAlpha = o2 * 0.5;
    ctx.strokeStyle = shade2(c0, -this.defaults.matteDarken);
    ctx.lineWidth = Math.max(0.8, r2 * 0.03);
    ctx.stroke(path2);
    ctx.restore();
  }
};
var hylics_default = HylicsStyle;

// js/styles/linocut.js
function resolveColors20(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c02 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
function quantizeColor(hex, palette) {
  if (!palette || palette.length === 0) return hex;
  let best = palette[0];
  let bestDist = Infinity;
  const rgb = hex.slice(1);
  const r2 = parseInt(rgb.substr(0, 2), 16);
  const g2 = parseInt(rgb.substr(2, 2), 16);
  const b2 = parseInt(rgb.substr(4, 2), 16);
  for (const p2 of palette) {
    const pr2 = parseInt(p2.substr(1, 2), 16);
    const pg = parseInt(p2.substr(3, 2), 16);
    const pb = parseInt(p2.substr(5, 2), 16);
    const d2 = Math.abs(r2 - pr2) + Math.abs(g2 - pg) + Math.abs(b2 - pb);
    if (d2 < bestDist) {
      bestDist = d2;
      best = p2;
    }
  }
  return best;
}
var LinocutStyle = class {
  name = "linocut";
  category = "graphic";
  description = "Linocut print: bold carved shapes with high contrast, rough chipped edges, and a limited palette of solid ink tones.";
  defaults = {
    strokeSize: { min: 6, max: 28 },
    chipAmp: 0.15,
    // amplitude of chipped edge noise (fraction of width)
    chipFreq: 3.5,
    // frequency of edge chips
    edgeContrast: 0.35,
    // how much darker the chipped outline is
    outlineWidth: 0.8,
    // outline relative to shape size
    paletteMode: true,
    // quantize colors to limited palette
    inkPalette: ["#1a1a1a", "#4a4a4a", "#ff3b3b", "#2a8cff", "#ffd700", "#8a2be2"],
    minRegionArea: 100
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 100)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors20(shape);
    const a2 = shape.params;
    const R2 = rngFor(shape.seed || a2.slice(0, 8));
    const inkC0 = this.defaults.paletteMode ? quantizeColor(c0, this.defaults.inkPalette) : c0;
    const inkC1 = this.defaults.paletteMode ? quantizeColor(c1, this.defaults.inkPalette) : c1;
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, R2, inkC0, inkC1, o2, progress);
    } else {
      this._renderArea(ctx, shape, R2, inkC0, inkC1, o2, progress);
    }
  }
  /**
   * Render a linocut stroke: thick flat ribbon with chipped, carved edges.
   */
  _renderStroke(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(2, a2[6]);
    const P2 = quadPts(a2, progress, 1, 26);
    const n2 = P2.length;
    if (n2 < 3) return;
    ctx.save();
    ctx.lineCap = ctx.lineJoin = "round";
    const band = new Path2D();
    for (let i2 = 0; i2 < n2; i2++) {
      const [nx, ny] = normalAt(P2, i2);
      const t2 = i2 / (n2 - 1);
      const noise = gaussR(R2) * this.defaults.chipAmp * 0.3;
      const off = w2 / 2 + noise;
      i2 === 0 ? band.moveTo(P2[i2][0] + nx * off, P2[i2][1] + ny * off) : band.lineTo(P2[i2][0] + nx * off, P2[i2][1] + ny * off);
    }
    for (let i2 = n2 - 1; i2 >= 0; i2--) {
      const [nx, ny] = normalAt(P2, i2);
      const t2 = i2 / (n2 - 1);
      const noise = gaussR(R2) * this.defaults.chipAmp * 0.3;
      const off = w2 / 2 + noise;
      band.lineTo(P2[i2][0] - nx * off, P2[i2][1] - ny * off);
    }
    band.closePath();
    ctx.globalAlpha = o2;
    ctx.fillStyle = c0;
    ctx.fill(band);
    const path2 = raggedPath(shape, R2, this.defaults.chipAmp * 0.7, 1.2);
    ctx.globalAlpha = o2 * 0.8;
    ctx.strokeStyle = shade2(c0, -this.defaults.edgeContrast);
    ctx.lineWidth = Math.max(0.8, w2 * 0.08);
    ctx.stroke(path2);
    ctx.globalAlpha = o2 * 0.5;
    ctx.strokeStyle = shade2(c0, -this.defaults.edgeContrast * 1.5);
    ctx.lineWidth = 0.5;
    const offBand = new Path2D();
    for (let i2 = 0; i2 < n2; i2++) {
      const [nx, ny] = normalAt(P2, i2);
      const jx = gaussR(R2) * this.defaults.chipAmp * 0.2;
      const off = w2 / 2 + jx;
      i2 === 0 ? offBand.moveTo(P2[i2][0] + nx * off, P2[i2][1] + ny * off) : offBand.lineTo(P2[i2][0] + nx * off, P2[i2][1] + ny * off);
    }
    ctx.stroke(offBand);
    ctx.restore();
  }
  /**
   * Render a linocut area: flat fill + ragged outline + chip detail lines.
   */
  _renderArea(ctx, shape, R2, c0, c1, o2, progress) {
    const path2 = raggedPath(shape, R2, this.defaults.chipAmp, 1.3);
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const r2 = Math.max(1, Math.max(b2.w, b2.h) / 2);
    ctx.save();
    ctx.globalAlpha = o2;
    ctx.fillStyle = c0;
    ctx.fill(path2);
    ctx.globalAlpha = o2 * 0.85;
    ctx.strokeStyle = shade2(c0, -this.defaults.edgeContrast);
    ctx.lineWidth = Math.max(0.8, r2 * this.defaults.outlineWidth * 0.05);
    ctx.stroke(path2);
    ctx.globalAlpha = o2 * 0.5;
    ctx.strokeStyle = shade2(c0, -this.defaults.edgeContrast * 0.5);
    ctx.lineWidth = 0.4;
    outlinePath(ctx, shape);
    ctx.stroke();
    ctx.restore();
  }
};
var linocut_default = LinocutStyle;

// js/styles/riso.js
function resolveColors21(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c02 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
function risoInks(c0, c1, R2) {
  return [
    { color: c0, offset: [0, 0] },
    // base layer (perfect)
    { color: c1, offset: [(R2() - 0.5) * 3, (R2() - 0.5) * 3] },
    // second ink (misaligned)
    { color: shade2(c0, -0.1), offset: [(R2() - 0.5) * 4, (R2() - 0.5) * 2] }
    // third ink (grainy)
  ];
}
var RisoStyle = class {
  name = "riso";
  category = "graphic";
  description = "Risograph: 2-3 flat spot-color inks with slight misregistration offset and paper grain texture. Each ink pass is solid and opaque, shifted slightly to create a characteristic fringe.";
  defaults = {
    strokeSize: { min: 4, max: 22 },
    misregMax: 3.5,
    // max misregistration offset (px)
    inkOpacity: 0.85,
    // opacity of each ink layer
    grainAmount: 0.12,
    // grain texture intensity
    grainFreq: 0.3,
    // grain frequency
    minRegionArea: 100
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 100)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors21(shape);
    const a2 = shape.params;
    const R2 = rngFor(shape.seed || a2.slice(0, 8));
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, R2, c0, c1, o2, progress);
    } else {
      this._renderArea(ctx, shape, R2, c0, c1, o2, progress);
    }
  }
  /**
   * Render a riso stroke: multiple ink layers with misregistration.
   */
  _renderStroke(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(2, a2[6]);
    const P2 = quadPts(a2, progress, 1, 24);
    const n2 = P2.length;
    if (n2 < 3) return;
    const inks = risoInks(c0, c1, R2);
    ctx.save();
    ctx.lineCap = ctx.lineJoin = "round";
    for (const ink of inks) {
      const ox = ink.offset[0];
      const oy = ink.offset[1];
      ctx.globalAlpha = o2 * this.defaults.inkOpacity;
      ctx.fillStyle = ink.color;
      const band = new Path2D();
      const hw = w2 / 2;
      for (let i2 = 0; i2 < n2; i2++) {
        const [nx, ny] = normalAt(P2, i2);
        i2 === 0 ? band.moveTo(P2[i2][0] + nx * hw + ox, P2[i2][1] + ny * hw + oy) : band.lineTo(P2[i2][0] + nx * hw + ox, P2[i2][1] + ny * hw + oy);
      }
      for (let i2 = n2 - 1; i2 >= 0; i2--) {
        const [nx, ny] = normalAt(P2, i2);
        band.lineTo(P2[i2][0] - nx * hw + ox, P2[i2][1] - ny * hw + oy);
      }
      band.closePath();
      ctx.fill(band);
    }
    ctx.globalAlpha = o2 * this.defaults.grainAmount;
    ctx.strokeStyle = "#000000";
    const grainStep = this.defaults.grainFreq * 2 + 1;
    for (let i2 = 0; i2 < n2; i2 += Math.max(1, Math.floor(grainStep))) {
      const g2 = gaussR(R2) * w2 * 0.15;
      ctx.lineWidth = Math.max(0.3, g2);
      ctx.stroke(path);
    }
    ctx.restore();
  }
  /**
   * Render a riso area: flat ink fills with misregistration + grain.
   */
  _renderArea(ctx, shape, R2, c0, c1, o2, progress) {
    const path2 = shapePoly(shape);
    const b2 = boxOf(path2);
    const r2 = Math.max(1, Math.max(b2.w, b2.h) / 2);
    const inks = risoInks(c0, c1, R2);
    ctx.save();
    for (const ink of inks) {
      ctx.save();
      ctx.translate(ink.offset[0], ink.offset[1]);
      ctx.globalAlpha = o2 * this.defaults.inkOpacity;
      ctx.fillStyle = ink.color;
      outlinePath(ctx, shape);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = o2 * this.defaults.grainAmount;
    ctx.fillStyle = "#000000";
    const grains = Math.max(20, Math.round(b2.w * b2.h / 20));
    for (let i2 = 0; i2 < grains; i2++) {
      const px = b2.x0 + R2() * b2.w;
      const py = b2.y0 + R2() * b2.h;
      const sz = R2() * 0.8 + 0.2;
      ctx.fillRect(px, py, sz, sz);
    }
    ctx.globalAlpha = o2 * 0.7;
    ctx.strokeStyle = shade2(c0, -0.2);
    ctx.lineWidth = Math.max(0.5, r2 * 0.02);
    outlinePath(ctx, shape);
    ctx.stroke();
    ctx.restore();
  }
};
var riso_default = RisoStyle;

// js/styles/tape.js
function resolveColors22(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c02 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
var TapeStyle = class {
  name = "tape";
  category = "craft";
  description = "Tape: flat opaque strips with hard straight edges and a slight sheen highlight. Clean cuts, uniform width, matte base with a glossy stripe.";
  defaults = {
    strokeSize: { min: 4, max: 20 },
    sheenLighten: 0.35,
    // highlight brightness (fraction)
    sheenWidth: 0.18,
    // sheen stripe width as fraction of tape width
    sheenSide: 0.3,
    // sheen position (0.3 = 30% from left edge)
    endCapWidth: 0.9,
    // end cap width as fraction of tape width
    minRegionArea: 100
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 100)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "B",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors22(shape);
    const a2 = shape.params;
    const R2 = rngFor(shape.seed || a2.slice(0, 8));
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, R2, c0, c1, o2, progress);
    } else {
      this._renderArea(ctx, shape, R2, c0, c1, o2, progress);
    }
  }
  /**
   * Render a tape strip along the path: hard flat ribbon + sheen.
   */
  _renderStroke(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(2, a2[6]);
    const P2 = quadPts(a2, progress, 1, 28);
    const n2 = P2.length;
    if (n2 < 3) return;
    const hw = w2 / 2;
    const sheenW = w2 * this.defaults.sheenWidth;
    const sheenPos = -hw + w2 * this.defaults.sheenSide;
    const highlight = shade2(c0, this.defaults.sheenLighten);
    ctx.save();
    ctx.globalAlpha = o2;
    ctx.fillStyle = c0;
    const band = new Path2D();
    for (let i2 = 0; i2 < n2; i2++) {
      const [nx, ny] = normalAt(P2, i2);
      i2 === 0 ? band.moveTo(P2[i2][0] + nx * hw, P2[i2][1] + ny * hw) : band.lineTo(P2[i2][0] + nx * hw, P2[i2][1] + ny * hw);
    }
    for (let i2 = n2 - 1; i2 >= 0; i2--) {
      const [nx, ny] = normalAt(P2, i2);
      band.lineTo(P2[i2][0] - nx * hw, P2[i2][1] - ny * hw);
    }
    band.closePath();
    ctx.fill(band);
    ctx.globalAlpha = o2 * 0.6;
    ctx.fillStyle = highlight;
    const sheen = new Path2D();
    for (let i2 = 0; i2 < n2; i2++) {
      const [nx, ny] = normalAt(P2, i2);
      const ox = nx * sheenPos;
      const oy = ny * sheenPos;
      i2 === 0 ? sheen.moveTo(P2[i2][0] + nx * sheenW + ox, P2[i2][1] + ny * sheenW + oy) : sheen.lineTo(P2[i2][0] + nx * sheenW + ox, P2[i2][1] + ny * sheenW + oy);
    }
    for (let i2 = n2 - 1; i2 >= 0; i2--) {
      const [nx, ny] = normalAt(P2, i2);
      const ox = nx * sheenPos;
      const oy = ny * sheenPos;
      sheen.lineTo(P2[i2][0] + ox, P2[i2][1] + oy);
    }
    sheen.closePath();
    ctx.fill(sheen);
    const capR = w2 * this.defaults.endCapWidth * 0.5;
    ctx.globalAlpha = o2;
    ctx.fillStyle = c0;
    ctx.beginPath();
    ctx.ellipse(P2[0][0], P2[0][1], capR, capR, 0, 0, 7);
    ctx.fill();
    const ep = P2[n2 - 1];
    ctx.beginPath();
    ctx.ellipse(ep[0], ep[1], capR, capR, 0, 0, 7);
    ctx.fill();
    ctx.restore();
  }
  /**
   * Render tape strips filling an area shape at varying angles.
   */
  _renderArea(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const size = Math.max(b2.w, b2.h, 4);
    const stripW = size * 0.08 + R2() * size * 0.06;
    const angle = a2[4] || 0;
    const angle2 = angle + (R2() - 0.5) * 0.3;
    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = o2;
    ctx.fillStyle = c0;
    const diag = Math.hypot(b2.w, b2.h) * 2;
    const stripCount = Math.max(3, Math.round(size / stripW));
    for (let i2 = 0; i2 < stripCount; i2++) {
      const t2 = i2 / (stripCount - 1);
      const offset = (t2 - 0.5) * diag;
      ctx.save();
      ctx.translate(b2.cx, b2.cy);
      ctx.rotate(angle2 + gaussR(R2) * 0.1);
      ctx.translate(offset, 0);
      ctx.fillRect(-diag, -stripW / 2, diag * 2, stripW);
      ctx.restore();
    }
    const highlight = shade2(c0, this.defaults.sheenLighten);
    const sheenW = stripW * this.defaults.sheenWidth;
    ctx.globalAlpha = o2 * 0.5;
    ctx.fillStyle = highlight;
    for (let i2 = 0; i2 < stripCount; i2 += 2) {
      const t2 = i2 / Math.max(1, stripCount - 1);
      const offset = (t2 - 0.5) * diag;
      ctx.save();
      ctx.translate(b2.cx, b2.cy);
      ctx.rotate(angle2 + gaussR(R2) * 0.1);
      ctx.translate(offset, 0);
      ctx.fillRect(-diag, -stripW / 2 + sheenW * 0.5, diag * 2, sheenW);
      ctx.restore();
    }
    ctx.restore();
  }
};
var tape_default = TapeStyle;

// js/styles/thread.js
function resolveColors23(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c02 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
var ThreadStyle = class {
  name = "thread";
  category = "craft";
  description = "Thread: thin continuous wound lines with visible stitch direction and slight fuzz. Uniform-width matte strands with a subtle directional sheen and fiber texture.";
  defaults = {
    strokeSize: { min: 1.5, max: 8 },
    fuzzAmount: 0.4,
    // fiber fuzz radius as fraction of width
    fuzzDensity: 0.3,
    // fuzz speckle density (per unit length)
    sheenLighten: 0.28,
    // directional sheen brightness
    sheenWidth: 0.5,
    // sheen coverage as fraction of width
    twistFreq: 3.5,
    // how often the thread twists per segment
    minRegionArea: 80
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 80)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "B",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors23(shape);
    const a2 = shape.params;
    const R2 = rngFor(shape.seed || a2.slice(0, 8));
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, R2, c0, c1, o2, progress);
    } else {
      this._renderArea(ctx, shape, R2, c0, c1, o2, progress);
    }
  }
  /**
   * Render a thread strand: thin line with fuzz and directional sheen.
   *
   * The thread is drawn as a flat ribbon with a matte base color,
   * a brighter sheen band offset to one side (simulating light
   * reflecting off the twisted fibers), and fuzz speckles along
   * the edges.
   */
  _renderStroke(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(1, a2[6]);
    const P2 = quadPts(a2, progress, 1, 30);
    const n2 = P2.length;
    if (n2 < 2) return;
    const hw = w2 / 2;
    const fuzzR = w2 * this.defaults.fuzzAmount;
    const sheenCol = shade2(c0, this.defaults.sheenLighten);
    const sheenOff = w2 * (R2() - 0.5) * this.defaults.sheenWidth;
    ctx.save();
    ctx.lineCap = "round";
    ctx.globalAlpha = o2;
    ctx.fillStyle = c0;
    const band = new Path2D();
    for (let i2 = 0; i2 < n2; i2++) {
      const [nx, ny] = normalAt(P2, i2);
      i2 === 0 ? band.moveTo(P2[i2][0] + nx * hw, P2[i2][1] + ny * hw) : band.lineTo(P2[i2][0] + nx * hw, P2[i2][1] + ny * hw);
    }
    for (let i2 = n2 - 1; i2 >= 0; i2--) {
      const [nx, ny] = normalAt(P2, i2);
      band.lineTo(P2[i2][0] - nx * hw, P2[i2][1] - ny * hw);
    }
    band.closePath();
    ctx.fill(band);
    ctx.globalAlpha = o2 * 0.55;
    ctx.strokeStyle = sheenCol;
    ctx.lineWidth = Math.max(0.3, w2 * this.defaults.sheenWidth);
    ctx.beginPath();
    for (let i2 = 0; i2 < n2; i2++) {
      const [nx, ny] = normalAt(P2, i2);
      const sx = P2[i2][0] + nx * sheenOff;
      const sy = P2[i2][1] + ny * sheenOff;
      i2 === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.globalAlpha = o2 * 0.35;
    ctx.fillStyle = shade2(c0, -0.1);
    const step = Math.max(1, Math.floor(w2 * 2));
    for (let i2 = 0; i2 < n2; i2 += step) {
      if (i2 >= n2) break;
      const [nx, ny] = normalAt(P2, i2);
      for (const side of [-1, 1]) {
        const fx = P2[i2][0] + nx * hw * side + (R2() - 0.5) * fuzzR * 0.6;
        const fy = P2[i2][1] + ny * hw * side + (R2() - 0.5) * fuzzR * 0.6;
        const fr2 = (R2() * 0.4 + 0.1) * fuzzR * 0.3;
        ctx.beginPath();
        ctx.arc(fx, fy, fr2, 0, 7);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  /**
   * Render thread wound in a spiral pattern within an area shape.
   */
  _renderArea(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const size = Math.max(b2.w, b2.h, 4);
    const w2 = Math.max(1, size * 0.02 + R2() * size * 0.015);
    const turns = Math.max(3, Math.round(size / w2 / 3));
    const shear = 0.3 + R2() * 0.4;
    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();
    ctx.lineCap = "round";
    ctx.globalAlpha = o2;
    ctx.strokeStyle = c0;
    ctx.lineWidth = w2;
    const maxR = size * 0.45;
    ctx.beginPath();
    for (let i2 = 0; i2 <= 200; i2++) {
      const t2 = i2 / 200 * turns;
      const r2 = maxR * (1 - i2 / 200) * progress;
      const angle = t2 * Math.PI * 2;
      const x2 = b2.cx + Math.cos(angle) * r2 + gaussR(R2) * w2 * 0.1;
      const y2 = b2.cy + Math.sin(angle) * r2 * shear + gaussR(R2) * w2 * 0.1;
      if (i2 === 0) ctx.moveTo(x2, y2);
      else ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    const sheenCol = shade2(c0, this.defaults.sheenLighten);
    ctx.globalAlpha = o2 * 0.5;
    ctx.strokeStyle = sheenCol;
    ctx.lineWidth = Math.max(0.2, w2 * this.defaults.sheenWidth);
    ctx.beginPath();
    const sheenOff = w2 * 0.3;
    for (let i2 = 0; i2 <= 200; i2++) {
      const t2 = i2 / 200 * turns;
      const r2 = maxR * (1 - i2 / 200) * progress;
      const angle = t2 * Math.PI * 2;
      const nx = Math.cos(angle);
      const ny = Math.sin(angle) * shear;
      const len = Math.hypot(nx, ny) || 1;
      const px = b2.cx + nx * r2 + nx / len * sheenOff;
      const py = b2.cy + Math.sin(angle) * r2 * shear + ny / len * sheenOff;
      if (i2 === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }
};
var thread_default = ThreadStyle;

// js/styles/stitch.js
function resolveColors24(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c02 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
var StitchStyle = class {
  name = "stitch";
  category = "craft";
  description = "Cross-stitch: regular X-stitch marks on a grid, blocky, with limited colors. Each stitch is two diagonal lines forming an X, laid out in a fabric-like grid pattern.";
  defaults = {
    strokeSize: { min: 3, max: 14 },
    stitchLenMin: 4,
    // minimum stitch size (px)
    stitchLenMax: 10,
    // maximum stitch size (px)
    stitchJitter: 0.1,
    // positioning jitter (fraction of stitch size)
    colorVariation: 0.15,
    // color blend jitter between c0/c1
    threadWidth: 1,
    // thread line width relative to stitch size
    minRegionArea: 60
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 60)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    return strokes;
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "B",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, 6, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 6, 0]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors24(shape);
    const a2 = shape.params;
    const R2 = rngFor(shape.seed || a2.slice(0, 8));
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, R2, c0, c1, o2, progress);
    } else {
      this._renderArea(ctx, shape, R2, c0, c1, o2, progress);
    }
  }
  /**
   * Draw a single X-stitch at position (cx, cy) with given size.
   * Each stitch is two diagonal lines forming an 'X'.
   */
  _drawStitch(ctx, cx, cy, size, col, lw) {
    const h2 = size / 2;
    ctx.globalAlpha = ctx.globalAlpha;
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.lineCap = "square";
    ctx.beginPath();
    ctx.moveTo(cx - h2, cy - h2);
    ctx.lineTo(cx + h2, cy + h2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + h2, cy - h2);
    ctx.lineTo(cx - h2, cy + h2);
    ctx.stroke();
  }
  /**
   * Render cross-stitches along a stroke path.
   */
  _renderStroke(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(2, a2[6]);
    const P2 = quadPts(a2, progress, 1, 32);
    const n2 = P2.length;
    if (n2 < 2) return;
    ctx.save();
    const stitchSize = lerp2(this.defaults.stitchLenMin, this.defaults.stitchLenMax, w2 / 20);
    const spacing = stitchSize * 1.3;
    const lw = Math.max(0.4, w2 * 0.15);
    const cum = [0];
    for (let i2 = 1; i2 < n2; i2++) {
      cum.push(cum[i2 - 1] + Math.hypot(P2[i2][0] - P2[i2 - 1][0], P2[i2][1] - P2[i2 - 1][1]));
    }
    const L2 = cum[n2 - 1];
    const count = Math.ceil(L2 / spacing);
    let j2 = 1;
    for (let k2 = 0; k2 <= count; k2++) {
      if (k2 / count > progress) break;
      const t2 = k2 / count;
      const target = t2 * L2;
      while (j2 < n2 - 2 && cum[j2] < target) j2++;
      const seg = cum[j2] - cum[j2 - 1] || 1;
      const f2 = (target - cum[j2 - 1]) / seg;
      const px = P2[j2 - 1][0] + (P2[j2][0] - P2[j2 - 1][0]) * f2;
      const py = P2[j2 - 1][1] + (P2[j2][1] - P2[j2 - 1][1]) * f2;
      const colT = clamp01(gaussR(R2) * this.defaults.colorVariation + 0.5);
      const col = mixHex(c0, c1, colT);
      const sz = stitchSize * (0.8 + R2() * 0.4);
      const jx = (R2() - 0.5) * stitchSize * this.defaults.stitchJitter;
      const jy = (R2() - 0.5) * stitchSize * this.defaults.stitchJitter;
      ctx.globalAlpha = o2;
      this._drawStitch(ctx, px + jx, py + jy, sz, col, Math.max(0.3, lw));
    }
    ctx.restore();
  }
  /**
   * Render cross-stitches filling an area shape on a grid.
   */
  _renderArea(ctx, shape, R2, c0, c1, o2, progress) {
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const size = Math.max(b2.w, b2.h, 4);
    const stitchSize = lerp2(this.defaults.stitchLenMin, this.defaults.stitchLenMax, clamp01(size / 80));
    const spacing = stitchSize * 1.2;
    const lw = Math.max(0.4, stitchSize * 0.15);
    const cols = Math.ceil(b2.w / spacing) + 1;
    const rows = Math.ceil(b2.h / spacing) + 1;
    const maxStitches = cols * rows;
    const drawn = Math.round(maxStitches * progress);
    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();
    ctx.lineCap = "square";
    let count = 0;
    outer:
      for (let i2 = 0; i2 < cols; i2++) {
        for (let j2 = 0; j2 < rows; j2++) {
          if (count >= drawn) break outer;
          const px = b2.x0 + i2 * spacing + (R2() - 0.5) * stitchSize * this.defaults.stitchJitter;
          const py = b2.y0 + j2 * spacing + (R2() - 0.5) * stitchSize * this.defaults.stitchJitter;
          const colT = clamp01(gaussR(R2) * this.defaults.colorVariation + 0.5);
          const col = mixHex(c0, c1, colT);
          const sz = stitchSize * (0.85 + R2() * 0.3);
          ctx.globalAlpha = o2;
          this._drawStitch(ctx, px, py, sz, col, lw);
          count++;
        }
      }
    ctx.restore();
  }
};
var stitch_default = StitchStyle;

// js/styles/neon.js
function resolveColors25(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c02 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
var NeonStyle = class {
  name = "neon";
  category = "graphic";
  description = "Neon: bright glowing tube lines with a bright core and a soft outer glow halo. The glow is built from layered blurred strokes \u2014 wide and diffuse underneath, sharp and bright on top.";
  defaults = {
    strokeSize: { min: 2, max: 16 },
    glowLayers: 3,
    // number of glow layers (outer → inner)
    glowSpread: 0.7,
    // glow radius as fraction of stroke width
    glowOpacity: 0.35,
    // opacity falloff per layer
    coreLighten: 0.4,
    // core brightness boost
    coreWidth: 0.4,
    // core width as fraction of stroke width
    edgeHighlight: 0.8,
    // edge highlight brightness
    minRegionArea: 80
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 80)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors25(shape);
    const a2 = shape.params;
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, c0, c1, o2, progress);
    } else {
      this._renderArea(ctx, shape, c0, c1, o2, progress);
    }
  }
  /**
   * Render a neon tube line: glow layers + bright core.
   *
   * The glow is built from progressively wider, lower-opacity
   * blurred strokes underneath. The core is a bright solid line.
   */
  _renderStroke(ctx, shape, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(2, a2[6]);
    const P2 = quadPts(a2, progress, 1, 30);
    const n2 = P2.length;
    if (n2 < 2) return;
    const glowW = w2 * this.defaults.glowSpread;
    const coreCol = shade2(c0, this.defaults.coreLighten);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.filter = `blur(${glowW * 0.8}px)`;
    for (let i2 = this.defaults.glowLayers - 1; i2 >= 0; i2--) {
      const layerAlpha = (i2 + 1) / this.defaults.glowLayers;
      const layerW = glowW * (1 + i2 * 0.4);
      ctx.globalAlpha = o2 * this.defaults.glowOpacity * layerAlpha;
      ctx.strokeStyle = c0;
      ctx.lineWidth = layerW;
      ctx.beginPath();
      ctx.moveTo(P2[0][0], P2[0][1]);
      for (let j2 = 1; j2 < n2; j2++) ctx.lineTo(P2[j2][0], P2[j2][1]);
      ctx.stroke();
    }
    ctx.filter = "none";
    ctx.globalAlpha = o2;
    ctx.strokeStyle = coreCol;
    ctx.lineWidth = Math.max(1, w2 * this.defaults.coreWidth);
    ctx.beginPath();
    ctx.moveTo(P2[0][0], P2[0][1]);
    for (let j2 = 1; j2 < n2; j2++) ctx.lineTo(P2[j2][0], P2[j2][1]);
    ctx.stroke();
    const R2 = rngFor(shape.seed || a2.slice(0, 6));
    const side = R2() > 0.5 ? 1 : -1;
    const highlightW = w2 * this.defaults.coreWidth * 0.6;
    const off = side * w2 * 0.25;
    ctx.globalAlpha = o2 * 0.8;
    ctx.strokeStyle = shade2(coreCol, this.defaults.edgeHighlight * 0.3);
    ctx.lineWidth = highlightW;
    ctx.beginPath();
    for (let j2 = 0; j2 < n2; j2++) {
      const [nx, ny] = normalAt(P2, j2);
      const px = P2[j2][0] + nx * off;
      const py = P2[j2][1] + ny * off;
      j2 === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }
  /**
   * Render a neon tube outline + fill for area shapes.
   * The shape outline glows with neon, and the fill is a softer glow.
   */
  _renderArea(ctx, shape, c0, c1, o2, progress) {
    const a2 = shape.params;
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const r2 = Math.max(1, Math.max(b2.w, b2.h) / 2);
    const glowWidth = r2 * 0.4;
    const coreCol = shade2(c0, this.defaults.coreLighten);
    ctx.save();
    ctx.filter = `blur(${glowWidth * 0.8}px)`;
    ctx.globalAlpha = o2 * this.defaults.glowOpacity * 1.5;
    ctx.strokeStyle = c0;
    ctx.lineWidth = glowWidth;
    outlinePath(ctx, shape);
    ctx.stroke();
    ctx.filter = "none";
    ctx.globalAlpha = o2 * this.defaults.glowOpacity;
    ctx.strokeStyle = shade2(c0, -0.1);
    ctx.lineWidth = glowWidth * 0.5;
    outlinePath(ctx, shape);
    ctx.stroke();
    ctx.globalAlpha = o2;
    ctx.strokeStyle = coreCol;
    ctx.lineWidth = Math.max(2, r2 * 0.06);
    outlinePath(ctx, shape);
    ctx.stroke();
    ctx.globalAlpha = o2 * 0.25;
    ctx.fillStyle = coreCol;
    outlinePath(ctx, shape);
    ctx.fill();
    ctx.restore();
  }
};
var neon_default = NeonStyle;

// js/styles/bokeh.js
function resolveColors26(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c02 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
var BokehStyle = class {
  name = "bokeh";
  category = "graphic";
  description = "Bokeh: large soft translucent overlapping circles with bright rims. Each circle has a radial gradient that is bright at the center, translucent in the middle ring, and bright again at the edge \u2014 like out-of-focus point light sources.";
  defaults = {
    strokeSize: { min: 4, max: 16 },
    circleSizeMin: 6,
    // minimum circle radius (px)
    circleSizeMax: 22,
    // maximum circle radius (px)
    spacingFactor: 0.25,
    // circle spacing as fraction of shape size
    coreBrighten: 0.4,
    // center brightening
    rimBrighten: 0.3,
    // edge rim brightening
    overlapGlow: 0.18,
    // overlap glow intensity
    minRegionArea: 60
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 60)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    return strokes;
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "B",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors26(shape);
    const a2 = shape.params;
    const R2 = rngFor(shape.seed || a2.slice(0, 8));
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, R2, c0, c1, o2, progress);
    } else {
      this._renderArea(ctx, shape, R2, c0, c1, o2, progress);
    }
  }
  /**
   * Draw a single bokeh circle with radial gradient.
   */
  _drawBokehCircle(ctx, cx, cy, radius, coreCol, rimCol, o2) {
    const G2 = ctx.createRadialGradient(
      cx,
      cy,
      0,
      cx,
      cy,
      radius
    );
    G2.addColorStop(0, rgbaOf(coreCol, o2 * 0.9));
    G2.addColorStop(0.45, rgbaOf(coreCol, o2 * 0.25));
    G2.addColorStop(1, rgbaOf(rimCol, o2 * 0.7));
    ctx.fillStyle = G2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 7);
    ctx.fill();
  }
  /**
   * Render bokeh circles stamped along a stroke path.
   */
  _renderStroke(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(2, a2[6]);
    const P2 = quadPts(a2, progress, 1, 30);
    const n2 = P2.length;
    if (n2 < 2) return;
    const cum = [0];
    for (let i2 = 1; i2 < n2; i2++) {
      cum.push(cum[i2 - 1] + Math.hypot(P2[i2][0] - P2[i2 - 1][0], P2[i2][1] - P2[i2 - 1][1]));
    }
    const L2 = cum[n2 - 1];
    const baseR = lerp2(this.defaults.circleSizeMin, this.defaults.circleSizeMax, w2 / 20);
    ctx.save();
    ctx.filter = "blur(0.5px)";
    let j2 = 1;
    const step = baseR * 1.8;
    const count = Math.ceil(L2 / step);
    for (let k2 = 0; k2 <= count; k2++) {
      if (k2 / count > progress) break;
      const target = k2 / count * L2;
      while (j2 < n2 - 2 && cum[j2] < target) j2++;
      const seg = cum[j2] - cum[j2 - 1] || 1;
      const f2 = (target - cum[j2 - 1]) / seg;
      const px = P2[j2 - 1][0] + (P2[j2][0] - P2[j2 - 1][0]) * f2;
      const py = P2[j2 - 1][1] + (P2[j2][1] - P2[j2 - 1][1]) * f2;
      const rad = baseR * (0.6 + R2() * 0.8);
      const colT = R2();
      const col = mixHex(c0, c1, colT);
      const core = shade2(col, this.defaults.coreBrighten);
      const rim = shade2(col, this.defaults.rimBrighten);
      this._drawBokehCircle(ctx, px, py, rad, core, rim, o2);
    }
    ctx.restore();
  }
  /**
   * Render overlapping bokeh circles filling an area shape.
   */
  _renderArea(ctx, shape, R2, c0, c1, o2, progress) {
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const size = Math.max(b2.w, b2.h, 4);
    const colSize = lerp2(this.defaults.circleSizeMin, this.defaults.circleSizeMax, clamp01(size / 100));
    const spacing = colSize * this.spacingFactor * 4;
    const cols = Math.ceil(b2.w / spacing) + 2;
    const rows = Math.ceil(b2.h / spacing) + 2;
    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();
    ctx.filter = "blur(0.5px)";
    for (let i2 = 0; i2 < cols; i2++) {
      for (let j2 = 0; j2 < rows; j2++) {
        const px = b2.x0 + i2 * spacing + (R2() - 0.5) * spacing * 0.5;
        const py = b2.y0 + j2 * spacing + (R2() - 0.5) * spacing * 0.5;
        if (px < b2.x0 - colSize || px > b2.x1 + colSize) continue;
        if (py < b2.y0 - colSize || py > b2.y1 + colSize) continue;
        const rad = colSize * (0.5 + R2() * 0.8);
        const colT = R2();
        const col = mixHex(c0, c1, colT);
        const core = shade2(col, this.defaults.coreBrighten);
        const rim = shade2(col, this.defaults.rimBrighten);
        this._drawBokehCircle(ctx, px, py, rad, core, rim, o2);
      }
    }
    ctx.restore();
  }
};
var bokeh_default = BokehStyle;

// js/styles/paper.js
function resolveColors27(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c02 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
function tornPath(shape, R2, amp, k2 = 1) {
  const P2 = shapePoly(shape);
  const b2 = boxOf(P2);
  const size = Math.max(b2.w, b2.h, 2);
  const step = Math.max(2, size / 32);
  const pts = [];
  const n2 = P2.length / 2;
  for (let i2 = 0; i2 < n2; i2++) {
    const ax = P2[i2 * 2];
    const ay = P2[i2 * 2 + 1];
    const j2 = (i2 + 1) % n2;
    const bx = P2[j2 * 2];
    const by = P2[j2 * 2 + 1];
    const m2 = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step));
    for (let s2 = 0; s2 < m2; s2++) {
      pts.push([ax + (bx - ax) * s2 / m2, ay + (by - ay) * s2 / m2]);
    }
  }
  const Q2 = pts.map(([px, py]) => {
    const d2 = gaussR(R2) * amp;
    const len = Math.hypot(px - b2.cx, py - b2.cy) || 1;
    const nx = (px - b2.cx) / len;
    const ny = (py - b2.cy) / len;
    return [px + nx * d2 * k2, py + ny * d2 * k2];
  });
  const path2 = new Path2D();
  const N2 = Q2.length;
  if (N2 === 0) return path2;
  path2.moveTo(Q2[0][0], Q2[0][1]);
  for (let i2 = 1; i2 < N2; i2++) path2.lineTo(Q2[i2][0], Q2[i2][1]);
  path2.closePath();
  return path2;
}
var PaperStyle = class {
  name = "paper";
  category = "graphic";
  description = "Torn paper collage: flat opaque shapes with a deckle edge and a subtle drop shadow. Each shape looks like a torn piece of paper sitting on the canvas.";
  defaults = {
    strokeSize: { min: 4, max: 22 },
    tearAmp: 0.12,
    // torn-edge amplitude (fraction of radius)
    tearFreq: 3,
    // sine frequency for deckle edge
    shadowBlur: 3,
    // soft shadow blur radius
    shadowOffset: 2,
    // shadow offset distance
    shadowOpacity: 0.22,
    // shadow darkness
    minRegionArea: 100
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 100)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors27(shape);
    const a2 = shape.params;
    const R2 = rngFor(shape.seed || a2.slice(0, 8));
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, R2, c0, c1, o2, progress);
    } else {
      this._renderArea(ctx, shape, R2, c0, c1, o2, progress);
    }
  }
  /**
   * Render a torn-paper ribbon stroke: jagged torn edge + soft shadow.
   */
  _renderStroke(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(2, a2[6]);
    const P2 = quadPts(a2, progress, 1, 28);
    const n2 = P2.length;
    if (n2 < 3) return;
    const amp = Math.max(1, w2 * this.defaults.tearAmp);
    ctx.save();
    ctx.filter = `blur(${this.defaults.shadowBlur}px)`;
    ctx.globalAlpha = o2 * this.defaults.shadowOpacity;
    ctx.fillStyle = "#000000";
    const shadow = new Path2D();
    for (let i2 = 0; i2 < n2; i2++) {
      const [nx, ny] = normalAt(P2, i2);
      const off = w2 / 2 + amp;
      i2 === 0 ? shadow.moveTo(P2[i2][0] + nx * off, P2[i2][1] + ny * off) : shadow.lineTo(P2[i2][0] + nx * off, P2[i2][1] + ny * off);
    }
    for (let i2 = n2 - 1; i2 >= 0; i2--) {
      const [nx, ny] = normalAt(P2, i2);
      const off = w2 / 2 + amp;
      shadow.lineTo(P2[i2][0] - nx * off, P2[i2][1] - ny * off);
    }
    shadow.closePath();
    ctx.translate(this.defaults.shadowOffset, this.defaults.shadowOffset);
    ctx.fill(shadow);
    ctx.translate(-this.defaults.shadowOffset, -this.defaults.shadowOffset);
    ctx.filter = "none";
    ctx.globalAlpha = o2;
    ctx.fillStyle = c0;
    const fill = new Path2D();
    for (let i2 = 0; i2 < n2; i2++) {
      const [nx, ny] = normalAt(P2, i2);
      const noise = gaussR(R2) * amp * 0.5;
      const off = w2 / 2 + noise;
      i2 === 0 ? fill.moveTo(P2[i2][0] + nx * off, P2[i2][1] + ny * off) : fill.lineTo(P2[i2][0] + nx * off, P2[i2][1] + ny * off);
    }
    for (let i2 = n2 - 1; i2 >= 0; i2--) {
      const [nx, ny] = normalAt(P2, i2);
      const noise = gaussR(R2) * amp * 0.5;
      const off = w2 / 2 + noise;
      fill.lineTo(P2[i2][0] - nx * off, P2[i2][1] - ny * off);
    }
    fill.closePath();
    ctx.fill(fill);
    ctx.globalAlpha = o2 * 0.4;
    ctx.strokeStyle = shade2(c0, -0.15);
    ctx.lineWidth = Math.max(0.5, amp * 0.3);
    ctx.stroke(fill);
    ctx.restore();
  }
  /**
   * Render a torn-paper area shape: ragged edge fill + drop shadow.
   */
  _renderArea(ctx, shape, R2, c0, c1, o2, progress) {
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const size = Math.max(b2.w, b2.h, 4);
    const amp = size * this.defaults.tearAmp * 0.5;
    ctx.save();
    ctx.filter = `blur(${this.defaults.shadowBlur}px)`;
    ctx.globalAlpha = o2 * this.defaults.shadowOpacity;
    ctx.fillStyle = "#000000";
    const shadowPath = tornPath(shape, R2, amp * 2, 1.5);
    ctx.translate(this.defaults.shadowOffset, this.defaults.shadowOffset);
    ctx.fill(shadowPath);
    ctx.translate(-this.defaults.shadowOffset, -this.defaults.shadowOffset);
    ctx.filter = "none";
    ctx.globalAlpha = o2;
    ctx.fillStyle = c0;
    const fillPath = tornPath(shape, R2, amp, 1);
    ctx.fill(fillPath);
    ctx.globalAlpha = o2 * 0.5;
    ctx.strokeStyle = shade2(c0, -0.2);
    ctx.lineWidth = Math.max(0.8, size * 0.015);
    ctx.stroke(fillPath);
    ctx.restore();
  }
};
var paper_default = PaperStyle;

// js/styles/glitch.js
function resolveColors28(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c02 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
function splitChannels(hex) {
  const n2 = parseInt(hex.slice(1), 16);
  const r2 = n2 >> 16 & 255;
  const g2 = n2 >> 8 & 255;
  const b2 = n2 & 255;
  return [
    "#" + r2.toString(16).padStart(2, "0") + "0000",
    "#00" + g2.toString(16).padStart(2, "0") + "00",
    "#0000" + b2.toString(16).padStart(2, "0")
  ];
}
var GlitchStyle = class {
  name = "glitch";
  category = "graphic";
  description = "Digital glitch: RGB channel-split blocks with horizontal displacement slices and hard edges. Each channel is drawn with a small random offset, creating a color-fringe datamosh effect.";
  defaults = {
    strokeSize: { min: 4, max: 24 },
    channelShift: 3.5,
    // max horizontal channel offset (px)
    sliceHeight: 8,
    // glitch slice height (px)
    sliceShift: 12,
    // max horizontal displacement per slice
    sliceCount: 3,
    // number of displacement slices
    minRegionArea: 80
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 80)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors28(shape);
    const a2 = shape.params;
    const R2 = rngFor(shape.seed || a2.slice(0, 8));
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, R2, c0, c1, o2, progress);
    } else {
      this._renderArea(ctx, shape, R2, c0, c1, o2, progress);
    }
  }
  /**
   * Render a glitch stroke: 3 channel-offset ribbons.
   */
  _renderStroke(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(2, a2[6]);
    const P2 = quadPts(a2, progress, 1, 30);
    const n2 = P2.length;
    if (n2 < 3) return;
    const channels = splitChannels(c0);
    const shifts = [
      (R2() - 0.5) * this.defaults.channelShift * 0.6,
      (R2() - 0.5) * this.defaults.channelShift,
      (R2() - 0.5) * this.defaults.channelShift * 0.8
    ];
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let ch = 0; ch < 3; ch++) {
      const sx = shifts[ch];
      ctx.globalAlpha = o2;
      ctx.filter = "none";
      ctx.fillStyle = channels[ch];
      const band = new Path2D();
      for (let i2 = 0; i2 < n2; i2++) {
        const [nx, ny] = normalAt(P2, i2);
        const off = w2 / 2;
        i2 === 0 ? band.moveTo(P2[i2][0] + nx * off + sx, P2[i2][1] + ny * off) : band.lineTo(P2[i2][0] + nx * off + sx, P2[i2][1] + ny * off);
      }
      for (let i2 = n2 - 1; i2 >= 0; i2--) {
        const [nx, ny] = normalAt(P2, i2);
        const off = w2 / 2;
        band.lineTo(P2[i2][0] - nx * off + sx, P2[i2][1] - ny * off);
      }
      band.closePath();
      ctx.fill(band);
    }
    ctx.restore();
  }
  /**
   * Render a glitch area: channel-offset fill + displacement slices.
   */
  _renderArea(ctx, shape, R2, c0, c1, o2, progress) {
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const r2 = Math.max(1, Math.max(b2.w, b2.h) / 2);
    const channels = splitChannels(c0);
    const shifts = [
      (R2() - 0.5) * this.defaults.channelShift * 0.5,
      (R2() - 0.5) * this.defaults.channelShift,
      (R2() - 0.5) * this.defaults.channelShift * 0.7
    ];
    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();
    for (let ch = 0; ch < 3; ch++) {
      ctx.save();
      ctx.translate(shifts[ch], 0);
      ctx.globalAlpha = o2;
      ctx.fillStyle = channels[ch];
      ctx.fillRect(b2.x0 - 20, b2.y0 - 20, b2.w + 40, b2.h + 40);
      ctx.restore();
    }
    ctx.restore();
    ctx.clip();
    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();
    const sliceH = this.defaults.sliceHeight;
    const sliceCount = this.defaults.sliceCount;
    const bandH = b2.h / sliceCount;
    for (let i2 = 0; i2 < sliceCount; i2++) {
      const sy = b2.y0 + i2 * bandH;
      const dh = (R2() - 0.5) * this.defaults.sliceShift;
      ctx.save();
      ctx.translate(dh, 0);
      ctx.globalAlpha = o2;
      ctx.fillStyle = c0;
      ctx.fillRect(b2.x0 - 20, sy, b2.w + 40, sliceH);
      ctx.restore();
    }
    ctx.globalAlpha = o2 * 0.85;
    ctx.strokeStyle = shade2(c0, -0.3);
    ctx.lineWidth = Math.max(0.5, r2 * 0.02);
    ctx.filter = "none";
    outlinePath(ctx, shape);
    ctx.stroke();
    ctx.restore();
  }
};
var glitch_default = GlitchStyle;

// js/styles/frost.js
function resolveColors29(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c02 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
function icyTint(hex) {
  return mixHex(hex, "#e8f4ff", 0.45);
}
var FrostStyle = class {
  name = "frost";
  category = "graphic";
  description = "Frost: icy crystalline speckle in pale blues and whites. Sharp small shards radiate from edges with translucent glinting highlights and a field of frost crystals.";
  defaults = {
    strokeSize: { min: 4, max: 22 },
    shardLen: 6,
    // radial shard length (px)
    shardCount: 12,
    // shards per perimeter sample
    crystalSize: 1.2,
    // frost crystal radius (px)
    crystalDensity: 0.3,
    // crystal field density (per px²)
    iceLighten: 0.55,
    // ice highlight brightness
    frostTint: 0.45,
    // blue-white tint factor
    minRegionArea: 80
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 80)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors29(shape);
    const a2 = shape.params;
    const R2 = rngFor(shape.seed || a2.slice(0, 8));
    const iceC0 = icyTint(c0);
    const iceC1 = icyTint(c1);
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, R2, iceC0, iceC1, o2, progress);
    } else {
      this._renderArea(ctx, shape, R2, iceC0, iceC1, o2, progress);
    }
  }
  /**
   * Render a frost stroke: icy ribbon with crystalline speckles and shards.
   */
  _renderStroke(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(2, a2[6]);
    const P2 = quadPts(a2, progress, 1, 28);
    const n2 = P2.length;
    if (n2 < 3) return;
    ctx.save();
    const fillCol = rgbaOf(mixHex(c0, c1, 0.5), o2 * 0.7);
    ctx.globalAlpha = o2 * 0.7;
    ctx.fillStyle = fillCol;
    const band = new Path2D();
    for (let i2 = 0; i2 < n2; i2++) {
      const [nx, ny] = normalAt(P2, i2);
      const off = w2 / 2;
      i2 === 0 ? band.moveTo(P2[i2][0] + nx * off, P2[i2][1] + ny * off) : band.lineTo(P2[i2][0] + nx * off, P2[i2][1] + ny * off);
    }
    for (let i2 = n2 - 1; i2 >= 0; i2--) {
      const [nx, ny] = normalAt(P2, i2);
      const off = w2 / 2;
      band.lineTo(P2[i2][0] - nx * off, P2[i2][1] - ny * off);
    }
    band.closePath();
    ctx.fill(band);
    ctx.globalAlpha = o2 * 0.5;
    ctx.fillStyle = shade2(c0, this.defaults.iceLighten);
    const step = Math.max(2, Math.floor(w2 / 3));
    for (let i2 = 0; i2 < n2; i2 += step) {
      const sz = this.defaults.crystalSize * (0.5 + R2() * 0.8);
      ctx.fillRect(P2[i2][0] + (R2() - 0.5) * w2 * 0.3, P2[i2][1] + (R2() - 0.5) * w2 * 0.3, sz, sz);
    }
    ctx.globalAlpha = o2 * 0.8;
    ctx.strokeStyle = shade2(c0, this.defaults.iceLighten + 0.15);
    ctx.lineWidth = Math.max(0.5, w2 * 0.12);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(P2[0][0], P2[0][1]);
    for (let i2 = 1; i2 < n2; i2++) ctx.lineTo(P2[i2][0], P2[i2][1]);
    ctx.stroke();
    ctx.restore();
  }
  /**
   * Render an icy area: frost crystal field + radial shards from edge.
   */
  _renderArea(ctx, shape, R2, c0, c1, o2, progress) {
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const size = Math.max(b2.w, b2.h, 4);
    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();
    const G2 = ctx.createRadialGradient(b2.cx, b2.cy, 0, b2.cx, b2.cy, size / 2);
    G2.addColorStop(0, rgbaOf(shade2(c0, 0.3), o2 * 0.5));
    G2.addColorStop(0.6, rgbaOf(mixHex(c0, c1, 0.4), o2 * 0.35));
    G2.addColorStop(1, rgbaOf(shade2(c1, -0.2), o2 * 0.45));
    ctx.globalAlpha = o2 * 0.5;
    ctx.fillStyle = G2;
    ctx.fillRect(b2.x0, b2.y0, b2.w, b2.h);
    ctx.globalAlpha = o2 * 0.45;
    ctx.fillStyle = shade2(c0, this.defaults.iceLighten);
    const crystals = Math.max(30, Math.round(b2.w * b2.h * this.defaults.crystalDensity * 0.01));
    for (let i2 = 0; i2 < crystals; i2++) {
      const px = b2.x0 + R2() * b2.w;
      const py = b2.y0 + R2() * b2.h;
      const sz = this.defaults.crystalSize * (0.3 + R2() * 1.2);
      ctx.fillRect(px, py, sz, sz);
    }
    ctx.globalAlpha = o2 * 0.65;
    ctx.strokeStyle = shade2(c0, this.defaults.iceLighten + 0.1);
    ctx.lineWidth = Math.max(0.6, this.defaults.crystalSize * 0.4);
    const shardN = Math.max(8, Math.round(size * this.defaults.shardCount * 0.02));
    for (let i2 = 0; i2 < shardN; i2++) {
      const idx = Math.floor(R2() * P2.length) / 2;
      const ix = Math.floor(idx) * 2;
      const iy = ix + 1;
      if (ix + 1 >= P2.length) break;
      const px = P2[ix];
      const py = P2[iy];
      const angle = R2() * Math.PI * 2;
      const len = this.defaults.shardLen * (0.5 + R2() * 0.8);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(angle) * len, py + Math.sin(angle) * len);
      ctx.stroke();
    }
    ctx.globalAlpha = o2 * 0.7;
    ctx.strokeStyle = shade2(c0, this.defaults.iceLighten + 0.2);
    ctx.lineWidth = Math.max(0.8, size * 0.02);
    outlinePath(ctx, shape);
    ctx.stroke();
    ctx.restore();
  }
};
var frost_default = FrostStyle;

// js/styles/embroid.js
function resolveColors30(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c02 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
var EmbroidStyle = class {
  name = "embroid";
  category = "craft";
  description = "Embroidery: dense parallel satin-stitch bands filling the shape. Each stitch is a short glossy segment running along the gradient axis, with a border to complete the embroidered patch look.";
  defaults = {
    strokeSize: { min: 4, max: 22 },
    stitchDensity: 3,
    // stitches per unit (higher = denser)
    stitchWidth: 1.5,
    // width of each satin stitch (px)
    glossLighten: 0.35,
    // glossy highlight brightness
    glossWidth: 0.3,
    // highlight width as fraction of stitch
    borderWidth: 1.2,
    // embroidered edge border width
    minRegionArea: 60
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 60)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    return strokes;
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors30(shape);
    const a2 = shape.params;
    const R2 = rngFor(shape.seed || a2.slice(0, 8));
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, R2, c0, c1, o2, progress);
    } else {
      this._renderArea(ctx, shape, R2, c0, c1, o2, progress);
    }
  }
  /**
   * Render a satin-stitch stroke: parallel glossy lines along path centerline.
   */
  _renderStroke(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(2, a2[6]);
    const P2 = quadPts(a2, progress, 1, 30);
    const n2 = P2.length;
    if (n2 < 2) return;
    const sw = Math.max(1, this.defaults.stitchWidth);
    const glossCol = shade2(c0, this.defaults.glossLighten);
    const glossW = sw * this.defaults.glossWidth;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = o2;
    ctx.fillStyle = c0;
    const band = new Path2D();
    for (let i2 = 0; i2 < n2; i2++) {
      const [nx, ny] = normalAt(P2, i2);
      const off = sw / 2;
      i2 === 0 ? band.moveTo(P2[i2][0] + nx * off, P2[i2][1] + ny * off) : band.lineTo(P2[i2][0] + nx * off, P2[i2][1] + ny * off);
    }
    for (let i2 = n2 - 1; i2 >= 0; i2--) {
      const [nx, ny] = normalAt(P2, i2);
      const off = sw / 2;
      band.lineTo(P2[i2][0] - nx * off, P2[i2][1] - ny * off);
    }
    band.closePath();
    ctx.fill(band);
    ctx.globalAlpha = o2 * 0.55;
    ctx.strokeStyle = glossCol;
    ctx.lineWidth = glossW;
    ctx.beginPath();
    for (let i2 = 0; i2 < n2; i2++) {
      const [nx, ny] = normalAt(P2, i2);
      const side = -0.3;
      const px = P2[i2][0] + nx * side * sw;
      const py = P2[i2][1] + ny * side * sw;
      i2 === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.globalAlpha = o2 * 0.7;
    ctx.strokeStyle = shade2(c0, -0.2);
    ctx.lineWidth = Math.max(0.5, w2 * 0.1);
    ctx.filter = "none";
    ctx.beginPath();
    ctx.moveTo(P2[0][0], P2[0][1]);
    for (let i2 = 1; i2 < n2; i2++) ctx.lineTo(P2[i2][0], P2[i2][1]);
    ctx.stroke();
    ctx.restore();
  }
  /**
   * Render satin-stitch fill: dense parallel bands in gradient direction.
   */
  _renderArea(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const size = Math.max(b2.w, b2.h, 4);
    const axis = shapeAxis2(shape);
    const [dx, dy] = axis;
    const sx = -dy;
    const sy = dx;
    const sw = Math.max(1, this.defaults.stitchWidth);
    const density = this.defaults.stitchDensity;
    const spacing = sw / density;
    const diag = Math.hypot(b2.w, b2.h) * 1.5;
    const stitchCount = Math.ceil(diag / spacing);
    const drawn = Math.round(stitchCount * progress);
    const glossCol = shade2(c0, this.defaults.glossLighten);
    const glossW = sw * this.defaults.glossWidth;
    ctx.save();
    outlinePath(ctx, shape);
    ctx.clip();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i2 = 0; i2 < drawn; i2++) {
      const t2 = i2 / Math.max(1, drawn - 1) - 0.5;
      const offset = t2 * diag;
      const startX = b2.cx + sx * offset - dx * diag;
      const startY = b2.cy + sy * offset - dy * diag;
      const endX = b2.cx + sx * offset + dx * diag;
      const endY = b2.cy + sy * offset + dy * diag;
      const jitter = gaussR(R2) * sw * 0.2;
      ctx.globalAlpha = o2;
      ctx.strokeStyle = mixHex(c0, c1, clamp01(R2() * 0.3 + 0.35));
      ctx.lineWidth = sw + jitter;
      ctx.beginPath();
      ctx.moveTo(startX + (R2() - 0.5) * sw * 0.3, startY + (R2() - 0.5) * sw * 0.3);
      ctx.lineTo(endX + (R2() - 0.5) * sw * 0.3, endY + (R2() - 0.5) * sw * 0.3);
      ctx.stroke();
      ctx.globalAlpha = o2 * 0.6;
      ctx.strokeStyle = glossCol;
      ctx.lineWidth = Math.max(0.3, glossW);
      ctx.beginPath();
      ctx.moveTo(startX + (R2() - 0.5) * sw * 0.2, startY + (R2() - 0.5) * sw * 0.2);
      ctx.lineTo(endX + (R2() - 0.5) * sw * 0.2, endY + (R2() - 0.5) * sw * 0.2);
      ctx.stroke();
    }
    ctx.globalAlpha = o2 * 0.8;
    ctx.strokeStyle = shade2(c0, -0.25);
    ctx.lineWidth = Math.max(1, size * this.defaults.borderWidth * 0.05);
    ctx.filter = "none";
    outlinePath(ctx, shape);
    ctx.stroke();
    ctx.restore();
  }
};
var embroid_default = EmbroidStyle;

// js/styles/plast.js
function resolveColors31(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c02 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? "#" + c0.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? "#" + c1.map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join("") : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
var PlastStyle = class {
  name = "plast";
  category = "graphic";
  description = "Plastic: glossy molded plastic with a flat base fill and a bright specular highlight streak. A reflective rim and soft shadow give the curved-surface plastic look.";
  defaults = {
    strokeSize: { min: 4, max: 24 },
    specLighten: 0.65,
    // specular highlight brightness boost
    specWidth: 0.25,
    // highlight streak width (fraction of shape)
    specSide: 0.35,
    // highlight position (fraction of width from edge)
    rimDarken: 0.1,
    // rim shadow darkness
    rimWidth: 0.08,
    // rim line width (fraction of size)
    shadowBlur: 2,
    // soft shadow blur
    shadowOffset: 1.5,
    // shadow offset
    shadowOpacity: 0.15,
    // shadow darkness
    minRegionArea: 80
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges && analyzer.edges.length > 0) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 80)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor(edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, 0, 0]);
    const w2 = lerp2(this.defaults.strokeSize.min, this.defaults.strokeSize.max, R2());
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    const [c0, c1, o2] = resolveColors31(shape);
    const a2 = shape.params;
    const R2 = rngFor(shape.seed || a2.slice(0, 8));
    if (shape.type === "S") {
      this._renderStroke(ctx, shape, R2, c0, c1, o2, progress);
    } else {
      this._renderArea(ctx, shape, R2, c0, c1, o2, progress);
    }
  }
  /**
   * Render a glossy plastic ribbon: flat fill + specular highlight.
   */
  _renderStroke(ctx, shape, R2, c0, c1, o2, progress) {
    const a2 = shape.params;
    const w2 = Math.max(2, a2[6]);
    const P2 = quadPts(a2, progress, 1, 30);
    const n2 = P2.length;
    if (n2 < 3) return;
    const specW = w2 * this.defaults.specWidth;
    const specCol = shade2(c0, this.defaults.specLighten);
    const specSide = this.defaults.specSide;
    ctx.save();
    ctx.filter = `blur(${this.defaults.shadowBlur}px)`;
    ctx.globalAlpha = o2 * this.defaults.shadowOpacity;
    ctx.fillStyle = "#000000";
    const shadow = new Path2D();
    const hw = w2 / 2;
    for (let i2 = 0; i2 < n2; i2++) {
      const [nx, ny] = normalAt(P2, i2);
      i2 === 0 ? shadow.moveTo(P2[i2][0] + nx * hw, P2[i2][1] + ny * hw) : shadow.lineTo(P2[i2][0] + nx * hw, P2[i2][1] + ny * hw);
    }
    for (let i2 = n2 - 1; i2 >= 0; i2--) {
      const [nx, ny] = normalAt(P2, i2);
      shadow.lineTo(P2[i2][0] - nx * hw, P2[i2][1] - ny * hw);
    }
    shadow.closePath();
    ctx.translate(this.defaults.shadowOffset, this.defaults.shadowOffset);
    ctx.fill(shadow);
    ctx.translate(-this.defaults.shadowOffset, -this.defaults.shadowOffset);
    ctx.filter = "none";
    ctx.globalAlpha = o2;
    ctx.fillStyle = c0;
    const fill = new Path2D();
    for (let i2 = 0; i2 < n2; i2++) {
      const [nx, ny] = normalAt(P2, i2);
      i2 === 0 ? fill.moveTo(P2[i2][0] + nx * hw, P2[i2][1] + ny * hw) : fill.lineTo(P2[i2][0] + nx * hw, P2[i2][1] + ny * hw);
    }
    for (let i2 = n2 - 1; i2 >= 0; i2--) {
      const [nx, ny] = normalAt(P2, i2);
      fill.lineTo(P2[i2][0] - nx * hw, P2[i2][1] - ny * hw);
    }
    fill.closePath();
    ctx.fill(fill);
    ctx.globalAlpha = o2 * 0.65;
    ctx.fillStyle = specCol;
    const streak = new Path2D();
    for (let i2 = 0; i2 < n2; i2++) {
      const [nx, ny] = normalAt(P2, i2);
      const jx = nx * specSide * w2;
      const jy = ny * specSide * w2;
      i2 === 0 ? streak.moveTo(P2[i2][0] + nx * specW + jx, P2[i2][1] + ny * specW + jy) : streak.lineTo(P2[i2][0] + nx * specW + jx, P2[i2][1] + ny * specW + jy);
    }
    for (let i2 = n2 - 1; i2 >= 0; i2--) {
      const [nx, ny] = normalAt(P2, i2);
      const jx = nx * specSide * w2;
      const jy = ny * specSide * w2;
      streak.lineTo(P2[i2][0] + jx, P2[i2][1] + jy);
    }
    streak.closePath();
    ctx.fill(streak);
    ctx.globalAlpha = o2 * 0.4;
    ctx.strokeStyle = specCol;
    ctx.lineWidth = Math.max(0.5, specW * 0.4);
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i2 = 0; i2 < n2; i2++) {
      const [nx, ny] = normalAt(P2, i2);
      const off = specSide * w2;
      i2 === 0 ? ctx.moveTo(P2[i2][0] + nx * off, P2[i2][1] + ny * off) : ctx.lineTo(P2[i2][0] + nx * off, P2[i2][1] + ny * off);
    }
    ctx.stroke();
    ctx.restore();
  }
  /**
   * Render a glossy plastic area: flat fill + radial specular highlight.
   */
  _renderArea(ctx, shape, R2, c0, c1, o2, progress) {
    const P2 = shapePoly(shape);
    const b2 = boxOf(P2);
    const size = Math.max(b2.w, b2.h, 4);
    const r2 = size / 2;
    ctx.save();
    ctx.filter = `blur(${this.defaults.shadowBlur}px)`;
    ctx.globalAlpha = o2 * this.defaults.shadowOpacity;
    ctx.fillStyle = "#000000";
    const shadowPath = new Path2D();
    outlinePath(ctx, shape);
    ctx.translate(this.defaults.shadowOffset, this.defaults.shadowOffset);
    ctx.fill(shadowPath);
    ctx.translate(-this.defaults.shadowOffset, -this.defaults.shadowOffset);
    ctx.filter = "none";
    ctx.globalAlpha = o2;
    ctx.fillStyle = c0;
    outlinePath(ctx, shape);
    ctx.fill();
    const specCol = shade2(c0, this.defaults.specLighten);
    const highX = b2.cx + (R2() - 0.5) * b2.w * 0.3;
    const highY = b2.cy + (R2() - 0.5) * b2.h * 0.3;
    const highR = r2 * 0.4;
    const G2 = ctx.createRadialGradient(highX, highY, 0, highX, highY, highR);
    G2.addColorStop(0, rgbaOf(specCol, o2 * 0.8));
    G2.addColorStop(0.5, rgbaOf(specCol, o2 * 0.4));
    G2.addColorStop(1, rgbaOf(specCol, 0));
    ctx.globalAlpha = o2 * 0.7;
    ctx.fillStyle = G2;
    outlinePath(ctx, shape);
    ctx.fill();
    ctx.globalAlpha = o2 * 0.55;
    ctx.strokeStyle = specCol;
    ctx.lineWidth = Math.max(1, size * this.defaults.rimWidth * 0.5);
    outlinePath(ctx, shape);
    ctx.stroke();
    ctx.restore();
  }
};
var plast_default = PlastStyle;

// js/engine/relief.js
var RELIEF = {
  ceramic: { id: 1, layer: 0.55, fuse: 1, hk: 0.95, taper: 0.35 },
  stone: { id: 2, layer: 0.1, fuse: 7, hk: 0.75 },
  metal: { id: 3, layer: 0.5, fuse: 2, hk: 0.95, taper: 0.2 },
  chrome: { id: 6, layer: 0.35, fuse: 5, hk: 0.9, taper: 0.45 },
  glass: { id: 17, clear: "glass", layer: 0.5, fuse: 0, hk: 1 },
  lens: { id: 18, clear: "lens", layer: 0.5, fuse: 0, hk: 1 },
  crystal: { id: 19, clear: "crystal", layer: 0.5, fuse: 0, hk: 1 },
  gold: { id: 10, layer: 0.5, fuse: 2, hk: 0.9, taper: 0.2 },
  bronze: { id: 11, layer: 0.45, fuse: 3, hk: 0.85 },
  copper: { id: 9, layer: 0.5, fuse: 2, hk: 0.9 },
  pewter: { id: 7, layer: 0.45, fuse: 2, hk: 0.85 },
  foam: { id: 4, layer: 0.75, fuse: 0, hk: 1, bead: "foam" },
  beads: { id: 12, layer: 0.75, fuse: 0, hk: 1, bead: "chain" },
  puffy: { id: 13, layer: 0.5, fuse: 2, hk: 1.15, puff: true },
  terrazzo: { id: 8, layer: 0.25, fuse: 5, hk: 0.7 },
  molten: { id: 6, layer: 0.35, fuse: 5, hk: 0.9, taper: 0.45 }
};
var RELIEF_TINT = {
  molten: "#d6d8dc",
  pewter: "#6d6f73",
  copper: "#b8673f",
  gold: "#e2b04a",
  bronze: "#8a6236",
  puffy: "#151517"
};
var LIGHT = { x: -0.62, y: -0.78 };
function resolveColors32(shape) {
  if (Array.isArray(shape.color0) || Array.isArray(shape.color1)) {
    const c02 = Array.isArray(shape.color0) ? rgbToHex(shape.color0) : typeof shape.color0 === "string" ? shape.color0 : "#000000";
    const c12 = Array.isArray(shape.color1) ? rgbToHex(shape.color1) : typeof shape.color1 === "string" ? shape.color1 : "#000000";
    const o3 = typeof shape.alpha === "number" ? shape.alpha : 1;
    return [c02, c12, o3];
  }
  const a2 = shape.params;
  const i2 = shape.type === "S" ? 8 : shape.type === "T" ? 7 : 5;
  const c0 = a2[i2];
  const c1 = a2[i2 + 1];
  const o2 = a2[a2.length - 1];
  return [
    Array.isArray(c0) ? rgbToHex(c0) : typeof c0 === "string" ? c0 : "#000000",
    Array.isArray(c1) ? rgbToHex(c1) : typeof c1 === "string" ? c1 : "#000000",
    typeof o2 === "number" ? o2 : 1
  ];
}
var _activeRelief = null;
function reliefFlat(ctx, shape, progress = 1, materialName = "ceramic") {
  const m2 = RELIEF[materialName];
  const t2 = shape.type;
  const a2 = shape.params;
  if (m2 && m2.clear) {
    return reliefFlatClear(ctx, shape, progress, materialName);
  }
  const [c0, c1, o2] = resolveColors32(shape);
  const tint = RELIEF_TINT[materialName];
  const c2 = tint ? mixHex(tint, mixHex(c0, c1, 0.5), 0.28) : mixHex(c0, c1, 0.5);
  ctx.save();
  ctx.globalAlpha = Math.max(0.9, o2);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (t2 === "S") {
    const w2 = a2[6];
    const P3 = quadPts(a2, progress, 1, 24);
    const n2 = P3.length;
    if (n2 < 2) {
      ctx.restore();
      return [P3[0][0], P3[0][1]];
    }
    const line = () => {
      ctx.beginPath();
      P3.forEach((p2, i2) => ctx[i2 ? "lineTo" : "moveTo"](p2[0], p2[1]));
    };
    ctx.translate(-LIGHT.x * w2 * 0.12, -LIGHT.y * w2 * 0.12);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = w2 * 1.05;
    line();
    ctx.stroke();
    ctx.translate(LIGHT.x * w2 * 0.12, LIGHT.y * w2 * 0.12);
    ctx.strokeStyle = shade(c2, -0.45);
    ctx.lineWidth = w2;
    line();
    ctx.stroke();
    ctx.strokeStyle = c2;
    ctx.lineWidth = w2 * 0.72;
    ctx.translate(LIGHT.x * w2 * 0.06, LIGHT.y * w2 * 0.06);
    line();
    ctx.stroke();
    ctx.strokeStyle = shade(c2, 0.55);
    ctx.lineWidth = w2 * 0.22;
    ctx.translate(LIGHT.x * w2 * 0.14, LIGHT.y * w2 * 0.14);
    line();
    ctx.stroke();
    ctx.restore();
    return [P3[n2 - 1][0], P3[n2 - 1][1]];
  }
  const P2 = shapePoly(shape);
  const b2 = boxOf(P2);
  const s2 = Math.max(2, Math.min(b2.w, b2.h) * 0.08);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.translate(-LIGHT.x * s2, -LIGHT.y * s2);
  outlinePath(ctx, shape);
  ctx.fill();
  ctx.translate(LIGHT.x * s2, LIGHT.y * s2);
  ctx.fillStyle = gradOf(ctx, shape, [[0, shade(c2, 0.25)], [1, shade(c2, -0.3)]]);
  outlinePath(ctx, shape);
  ctx.fill();
  ctx.restore();
  return [a2[0], a2[1]];
}
function reliefFlatClear(ctx, shape, progress = 1, materialName = "glass") {
  const m2 = RELIEF[materialName];
  const [c0, c1, o2] = resolveColors32(shape);
  const a2 = shape.params;
  const t2 = shape.type;
  ctx.save();
  ctx.globalAlpha = Math.max(0.5, o2 * 0.7);
  const tint = mixHex(c0, c1, 0.5);
  const tintedCol = materialName === "glass" ? mixHex(tint, "#ffffff", 0.4) : materialName === "lens" ? mixHex(tint, "#ffffff", 0.6) : mixHex(tint, "#ffffff", 0.5);
  if (t2 === "S") {
    const w2 = a2[6];
    const P2 = quadPts(a2, progress, 1, 24);
    const n2 = P2.length;
    if (n2 < 2) {
      ctx.restore();
      return [P2[0][0], P2[0][1]];
    }
    const off = w2 / 2;
    ctx.beginPath();
    for (let i2 = 0; i2 < n2; i2++) {
      const [nx, ny] = normalAt(P2, i2);
      i2 === 0 ? ctx.moveTo(P2[i2][0] + nx * off, P2[i2][1] + ny * off) : ctx.lineTo(P2[i2][0] + nx * off, P2[i2][1] + ny * off);
    }
    for (let i2 = n2 - 1; i2 >= 0; i2--) {
      const [nx, ny] = normalAt(P2, i2);
      ctx.lineTo(P2[i2][0] - nx * off, P2[i2][1] - ny * off);
    }
    ctx.closePath();
    ctx.fillStyle = tintedCol;
    ctx.fill();
    ctx.globalAlpha = Math.max(0.5, o2 * 0.9);
    ctx.strokeStyle = shade2(tintedCol, 0.7);
    ctx.lineWidth = Math.max(0.5, w2 * 0.3);
    ctx.beginPath();
    P2.forEach((p2, i2) => ctx[i2 ? "lineTo" : "moveTo"](p2[0], p2[1]));
    ctx.stroke();
    ctx.globalAlpha = Math.max(0.5, o2 * 0.4);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(0.5, w2 * 0.15);
    ctx.translate(LIGHT.x * w2 * 0.15, LIGHT.y * w2 * 0.15);
    ctx.beginPath();
    P2.forEach((p2, i2) => ctx[i2 ? "lineTo" : "moveTo"](p2[0], p2[1]));
    ctx.stroke();
  } else {
    ctx.fillStyle = tintedCol;
    outlinePath(ctx, shape);
    ctx.fill();
    ctx.globalAlpha = Math.max(0.5, o2 * 0.9);
    ctx.strokeStyle = shade2(tintedCol, 0.7);
    ctx.lineWidth = Math.max(1, Math.min(a2[2] || 10, a2[3] || 10) * 0.05);
    outlinePath(ctx, shape);
    ctx.stroke();
  }
  ctx.restore();
  return a2[0] !== void 0 ? [a2[0], a2[1]] : [0, 0];
}
function renderReliefShape(ctx, shape, progress, materialName) {
  const m2 = RELIEF[materialName];
  if (!m2) return false;
  if (_activeRelief && _activeRelief.stamp) {
    _activeRelief.stamp(shape, m2);
    return true;
  }
  reliefFlat(ctx, shape, progress, materialName);
  return true;
}

// js/styles/ceramic.js
var CeramicStyle = class {
  name = "ceramic";
  category = "3d";
  description = "Glazed porcelain ropes with a lacquer highlight, ends that drop to a point. Lit in 3D with glossy reflections.";
  defaults = {
    strokeSize: { min: 5, max: 28 },
    minRegionArea: 100
  };
  /**
   * Propose candidate strokes for this style.
   * @param {object} analyzer
   * @param {object} params
   * @returns {Array}
   */
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 100)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor([edge.x0 || 0, edge.y0 || 0, edge.x1 || 0, edge.y1 || 0, 0, 0]);
    const w2 = 5 + R2() * 20;
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  /**
   * Render via the relief renderer (WebGL2) or 2D fallback.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} shape
   * @param {number} progress
   */
  render(ctx, shape, progress = 1) {
    renderReliefShape(ctx, shape, progress, "ceramic");
  }
};
var ceramic_default = CeramicStyle;

// js/styles/stone.js
var StoneStyle = class {
  name = "stone";
  category = "3d";
  description = "Lines that fuse into one rock, matte, with procedural grain on the lit slopes. Lit in 3D with soft shadows.";
  defaults = {
    strokeSize: { min: 5, max: 28 },
    minRegionArea: 100
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 100)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor([edge.x0 || 0, edge.y0 || 0, edge.x1 || 0, edge.y1 || 0, 0, 0]);
    const w2 = 5 + R2() * 20;
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    renderReliefShape(ctx, shape, progress, "stone");
  }
};
var stone_default = StoneStyle;

// js/styles/metal.js
var MetalStyle = class {
  name = "metal";
  category = "3d";
  description = "Polished kinetic metal \u2014 the picture colours as shadow, midtone, and highlight with sharp specular reflections. Lit in 3D.";
  defaults = {
    strokeSize: { min: 5, max: 28 },
    minRegionArea: 100
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 100)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor([edge.x0 || 0, edge.y0 || 0, edge.x1 || 0, edge.y1 || 0, 0, 0]);
    const w2 = 5 + R2() * 20;
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    renderReliefShape(ctx, shape, progress, "metal");
  }
};
var metal_default = MetalStyle;

// js/styles/chrome.js
var ChromeStyle = class {
  name = "chrome";
  category = "3d";
  description = "Liquid chrome ropes that melt together, reflecting a studio environment with fine surface grain. Lit in 3D with environment reflections.";
  defaults = {
    strokeSize: { min: 5, max: 28 },
    minRegionArea: 100
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 100)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width, so the same
   * edge always produces the same stroke geometry.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor([edge.x0 || 0, edge.y0 || 0, edge.x1 || 0, edge.y1 || 0, 0, 0]);
    const w2 = 5 + R2() * 20;
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    renderReliefShape(ctx, shape, progress, "chrome");
  }
};
var chrome_default = ChromeStyle;

// js/styles/glass.js
var GlassStyle = class {
  name = "glass";
  category = "3d";
  description = "Clear rippled glass that bends what lies beneath it, with a bevelled rim, bright glint, and environment reflections. Lit in 3D with refraction.";
  defaults = {
    strokeSize: { min: 5, max: 28 },
    minRegionArea: 100
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 100)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor([edge.x0 || 0, edge.y0 || 0, edge.x1 || 0, edge.y1 || 0, 0, 0]);
    const w2 = 5 + R2() * 20;
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    renderReliefShape(ctx, shape, progress, "glass");
  }
};
var glass_default = GlassStyle;

// js/styles/lens.js
var LensStyle = class {
  name = "lens";
  category = "3d";
  description = "A clear lens that magnifies what lies beneath, with a dome cross-section, Fresnel reflections, and light-gathering. Lit in 3D with refraction.";
  defaults = {
    strokeSize: { min: 5, max: 28 },
    minRegionArea: 100
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 100)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width, so the same
   * edge always produces the same stroke geometry.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor([edge.x0 || 0, edge.y0 || 0, edge.x1 || 0, edge.y1 || 0, 0, 0]);
    const w2 = 5 + R2() * 20;
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    renderReliefShape(ctx, shape, progress, "lens");
  }
};
var lens_default = LensStyle;

// js/styles/crystal.js
var CrystalStyle = class {
  name = "crystal";
  category = "3d";
  description = "Cut crystal with flat facets that each bend what lies beneath, featuring dispersion, sharp glints, and random sparkle. Lit in 3D with refraction.";
  defaults = {
    strokeSize: { min: 5, max: 28 },
    minRegionArea: 100
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 100)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width, so the same
   * edge always produces the same stroke geometry.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor([edge.x0 || 0, edge.y0 || 0, edge.x1 || 0, edge.y1 || 0, 0, 0]);
    const w2 = 5 + R2() * 20;
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    renderReliefShape(ctx, shape, progress, "crystal");
  }
};
var crystal_default = CrystalStyle;

// js/styles/gold.js
var GoldStyle = class {
  name = "gold";
  category = "3d";
  description = "Rough gold-leaf ropes \u2014 flakes laid side by side, each tilted its own way, with dark cracks between them. Lit in 3D with reflections.";
  defaults = {
    strokeSize: { min: 5, max: 28 },
    minRegionArea: 100
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 100)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width, so the same
   * edge always produces the same stroke geometry.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor([edge.x0 || 0, edge.y0 || 0, edge.x1 || 0, edge.y1 || 0, 0, 0]);
    const w2 = 5 + R2() * 20;
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    renderReliefShape(ctx, shape, progress, "gold");
  }
};
var gold_default = GoldStyle;

// js/styles/bronze.js
var BronzeStyle = class {
  name = "bronze";
  category = "3d";
  description = "Dark cast bronze with green patina in the hollows and polished golden-brown on the high points. Lit in 3D.";
  defaults = {
    strokeSize: { min: 5, max: 28 },
    minRegionArea: 100
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 100)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width, so the same
   * edge always produces the same stroke geometry.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor([edge.x0 || 0, edge.y0 || 0, edge.x1 || 0, edge.y1 || 0, 0, 0]);
    const w2 = 5 + R2() * 20;
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    renderReliefShape(ctx, shape, progress, "bronze");
  }
};
var bronze_default = BronzeStyle;

// js/styles/copper.js
var CopperStyle = class {
  name = "copper";
  category = "3d";
  description = "Rough copper ropes with green verdigris in the hollows and polished warm bronze where it catches the light. Lit in 3D.";
  defaults = {
    strokeSize: { min: 5, max: 28 },
    minRegionArea: 100
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 100)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width, so the same
   * edge always produces the same stroke geometry.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor([edge.x0 || 0, edge.y0 || 0, edge.x1 || 0, edge.y1 || 0, 0, 0]);
    const w2 = 5 + R2() * 20;
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    renderReliefShape(ctx, shape, progress, "copper");
  }
};
var copper_default = CopperStyle;

// js/styles/pewter.js
var PewterStyle = class {
  name = "pewter";
  category = "3d";
  description = "Rough granular dark metal with brushed texture \u2014 anisotropic highlights drawn out along the stroke direction. Lit in 3D.";
  defaults = {
    strokeSize: { min: 5, max: 28 },
    minRegionArea: 100
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 100)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width, so the same
   * edge always produces the same stroke geometry.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor([edge.x0 || 0, edge.y0 || 0, edge.x1 || 0, edge.y1 || 0, 0, 0]);
    const w2 = 5 + R2() * 20;
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    renderReliefShape(ctx, shape, progress, "pewter");
  }
};
var pewter_default = PewterStyle;

// js/styles/foam.js
var FoamStyle = class {
  name = "foam";
  category = "3d";
  description = "A heap of soft, bulbous foam beads lying in layers, casting shadows on each other. Lit in 3D with soft wrapped lighting.";
  defaults = {
    strokeSize: { min: 5, max: 28 },
    minRegionArea: 100
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 100)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width, so the same
   * edge always produces the same stroke geometry.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor([edge.x0 || 0, edge.y0 || 0, edge.x1 || 0, edge.y1 || 0, 0, 0]);
    const w2 = 5 + R2() * 20;
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    renderReliefShape(ctx, shape, progress, "foam");
  }
};
var foam_default = FoamStyle;

// js/styles/beads.js
var BeadsStyle = class {
  name = "beads";
  category = "3d";
  description = "Chains of glossy lacquered beads laid along the stroke, each catching the light with a sharp specular highlight. Lit in 3D.";
  defaults = {
    strokeSize: { min: 5, max: 28 },
    minRegionArea: 100
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 100)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width, so the same
   * edge always produces the same stroke geometry.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor([edge.x0 || 0, edge.y0 || 0, edge.x1 || 0, edge.y1 || 0, 0, 0]);
    const w2 = 5 + R2() * 20;
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    renderReliefShape(ctx, shape, progress, "beads");
  }
};
var beads_default = BeadsStyle;

// js/styles/puffy.js
var PuffyStyle = class {
  name = "puffy";
  category = "3d";
  description = "Inflated glossy vinyl ropes \u2014 soft, puffed-up profile with a glossy sheen and rim reflections. Lit in 3D.";
  defaults = {
    strokeSize: { min: 5, max: 28 },
    minRegionArea: 100
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 100)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width, so the same
   * edge always produces the same stroke geometry.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor([edge.x0 || 0, edge.y0 || 0, edge.x1 || 0, edge.y1 || 0, 0, 0]);
    const w2 = 5 + R2() * 20;
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    renderReliefShape(ctx, shape, progress, "puffy");
  }
};
var puffy_default = PuffyStyle;

// js/styles/terrazzo.js
var TerrazzoStyle = class {
  name = "terrazzo";
  category = "3d";
  description = "Polished terrazzo with chips of stone set in a binder \u2014 each stroke becomes a textured slab with light and dark chips. Lit in 3D.";
  defaults = {
    strokeSize: { min: 5, max: 28 },
    minRegionArea: 100
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 100)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width, so the same
   * edge always produces the same stroke geometry.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor([edge.x0 || 0, edge.y0 || 0, edge.x1 || 0, edge.y1 || 0, 0, 0]);
    const w2 = 5 + R2() * 20;
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    renderReliefShape(ctx, shape, progress, "terrazzo");
  }
};
var terrazzo_default = TerrazzoStyle;

// js/styles/molten.js
var MoltenStyle = class {
  name = "molten";
  category = "3d";
  description = "Liquid metal ropes that melt together into a glowing mass, reflecting a studio with fine surface grain. Lit in 3D with reflections.";
  defaults = {
    strokeSize: { min: 5, max: 28 },
    minRegionArea: 100
  };
  generate(analyzer, params) {
    const cfg = { ...this.defaults, ...params };
    const strokes = [];
    if (analyzer && analyzer.edges) {
      for (const edge of analyzer.edges) {
        const color = analyzer.sampleColor(edge.cx, edge.cy);
        strokes.push(this._makeStroke(edge, color));
      }
    }
    if (analyzer && analyzer.regions) {
      for (const region of analyzer.regions) {
        if (region.area < (cfg.minRegionArea || 100)) continue;
        const color = analyzer.sampleColor(region.cx, region.cy);
        strokes.push(this._makeShape(region, color));
      }
    }
    return strokes;
  }
  /**
   * Build a candidate stroke shape from an edge.
   * Uses seeded RNG (rngFor) for deterministic stroke-width, so the same
   * edge always produces the same stroke geometry.
   */
  _makeStroke(edge, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    const R2 = rngFor([edge.x0 || 0, edge.y0 || 0, edge.x1 || 0, edge.y1 || 0, 0, 0]);
    const w2 = 5 + R2() * 20;
    return {
      type: "S",
      params: [edge.x0, edge.y0, edge.cx, edge.cy, edge.x1, edge.y1, w2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: edge.seed || [edge.x0, edge.y0, edge.x1, edge.y1, w2, 0]
    };
  }
  _makeShape(region, color) {
    const c2 = Array.isArray(color) ? color : [color, color, color];
    return {
      type: "E",
      params: [region.cx, region.cy, region.w / 2, region.h / 2, 0, c2, c2, 1],
      color0: c2,
      color1: c2,
      alpha: 1,
      seed: [region.cx, region.cy, region.w, region.h]
    };
  }
  render(ctx, shape, progress = 1) {
    renderReliefShape(ctx, shape, progress, "molten");
  }
};
var molten_default = MoltenStyle;

// js/styles/index.js
var registry = {
  pencil: { class: pencil_default, category: "draw", label: "Pencil / Graphite" },
  ink: { class: ink_default, category: "paint", label: "Ink Brush" },
  watercolor: { class: watercolor_default, category: "paint", label: "Watercolor" },
  oil: { class: oil_default, category: "paint", label: "Oil / Acrylic" },
  graffiti: { class: graffiti_default, category: "paint", label: "Graffiti / Spray" },
  graphic: { class: graphic_default, category: "graphic", label: "Flat Graphic" },
  charcoal: { class: charcoal_default, category: "draw", label: "Charcoal" },
  marker: { class: marker_default, category: "draw", label: "Alcohol Marker" },
  calligraphy: { class: calligraphy_default, category: "draw", label: "Calligraphy" },
  "cross-hatch": { class: cross_hatch_default, category: "draw", label: "Cross-hatch" },
  mosaic: { class: mosaic_default, category: "graphic", label: "Mosaic" },
  scribble: { class: scribble_default, category: "graphic", label: "Scribble" },
  halftone: { class: halftone_default, category: "graphic", label: "Halftone" },
  string: { class: string_default, category: "craft", label: "String Art" },
  sumi: { class: sumi_default, category: "paint", label: "Sumi Ink" },
  gouache: { class: gouache_default, category: "paint", label: "Gouache" },
  knife: { class: knife_default, category: "paint", label: "Palette Knife" },
  pastel: { class: pastel_default, category: "draw", label: "Pastel" },
  pen: { class: pen_default, category: "draw", label: "Pen" },
  wash: { class: wash_default, category: "paint", label: "Wash" },
  dots: { class: dots_default, category: "graphic", label: "Dots" },
  confetti: { class: confetti_default, category: "graphic", label: "Confetti" },
  hylics: { class: hylics_default, category: "graphic", label: "Hylics" },
  linocut: { class: linocut_default, category: "graphic", label: "Linocut" },
  riso: { class: riso_default, category: "graphic", label: "Riso" },
  tape: { class: tape_default, category: "craft", label: "Tape" },
  thread: { class: thread_default, category: "craft", label: "Thread" },
  stitch: { class: stitch_default, category: "craft", label: "Stitch" },
  neon: { class: neon_default, category: "graphic", label: "Neon" },
  bokeh: { class: bokeh_default, category: "graphic", label: "Bokeh" },
  paper: { class: paper_default, category: "graphic", label: "Paper" },
  glitch: { class: glitch_default, category: "graphic", label: "Glitch" },
  frost: { class: frost_default, category: "graphic", label: "Frost" },
  embroid: { class: embroid_default, category: "craft", label: "Embroidery" },
  plast: { class: plast_default, category: "graphic", label: "Plastic" },
  ceramic: { class: ceramic_default, category: "3d", label: "Ceramic" },
  stone: { class: stone_default, category: "3d", label: "Stone" },
  metal: { class: metal_default, category: "3d", label: "Metal" },
  chrome: { class: chrome_default, category: "3d", label: "Chrome" },
  glass: { class: glass_default, category: "3d", label: "Glass" },
  lens: { class: lens_default, category: "3d", label: "Lens" },
  crystal: { class: crystal_default, category: "3d", label: "Crystal" },
  gold: { class: gold_default, category: "3d", label: "Gold" },
  bronze: { class: bronze_default, category: "3d", label: "Bronze" },
  copper: { class: copper_default, category: "3d", label: "Copper" },
  pewter: { class: pewter_default, category: "3d", label: "Pewter" },
  foam: { class: foam_default, category: "3d", label: "Foam" },
  beads: { class: beads_default, category: "3d", label: "Beads" },
  puffy: { class: puffy_default, category: "3d", label: "Puffy" },
  terrazzo: { class: terrazzo_default, category: "3d", label: "Terrazzo" },
  molten: { class: molten_default, category: "3d", label: "Molten" }
};
var ordered = Object.keys(registry);
function getAllStyles() {
  return ordered.map((name) => {
    const entry = registry[name];
    return { name, instance: new entry.class(), category: entry.category, label: entry.label };
  });
}
var CATEGORY_LABELS = {
  draw: "Drawing",
  paint: "Painting",
  graphic: "Graphic",
  craft: "Craft",
  "3d": "3D / Material"
};

// js/engine/generator.js
var DEFAULT_SETTINGS = {
  style: "pencil",
  strokeSize: { min: 6, max: 28, random: true },
  spacing: 0.5,
  scatter: 0.3,
  strokeCount: 5e3,
  detailLevel: 0.7,
  randomness: 0.3,
  styleStrength: 0.8,
  // 0..1 — strength of the chosen style's effect
  opacity: 0.85,
  // 0..1 — default stroke opacity
  colorMode: "exact",
  // exact | quantized | palette
  paletteSize: 8,
  pathOrder: "free",
  // free | top-bottom | spiral | one-line | edges-first
  shapeBias: { E: 0.12, B: 0.12, T: 0.03, R: 0.13, S: 0.6 },
  // Smart sizing: when true, stroke size adapts to local detail
  adaptiveSize: true,
  // Angle bias: when true, stroke orientation follows local gradient direction
  alignToGradient: true,
  // Use residual-based selection for full-coverage painting
  useResidual: true
};
function resolveSettings(userSettings = {}) {
  const out = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(userSettings)) {
    const val = userSettings[key];
    if (val && typeof val === "object" && !Array.isArray(val)) {
      out[key] = { ...out[key], ...val };
    } else {
      out[key] = val;
    }
  }
  return out;
}

// js/engine/engine.js
var PAINTER_ORDER_KINDS = [
  "down",
  "up",
  "right",
  "left",
  "diag",
  "spiral",
  "spiralin",
  "rings",
  "ringsin",
  "clock"
];
var PaintingEngine = class {
  /**
   * @param {object} opts
   * @param {HTMLCanvasElement} opts.canvas
   * @param {number} [opts.width]
   * @param {number} [opts.height]
   * @param {boolean} [opts.useWorker]
   * @param {string} [opts.background='#ffffff']
   */
  constructor(opts = {}) {
    if (!opts.canvas) throw new Error("PaintingEngine requires a canvas element");
    this.canvas = opts.canvas;
    this.width = opts.width || opts.canvas.width || 1024;
    this.height = opts.height || opts.canvas.height || 768;
    this.background = opts.background || "#ffffff";
    this.useWorker = opts.useWorker || false;
    this.renderer = createRenderer(this.canvas, {
      width: this.width,
      height: this.height,
      background: this.background
    });
    this._registerAllStyles();
    this._imageData = null;
    this._pixels = null;
    this._analysis = null;
    this._sourceImage = null;
    this.layers = [];
    this.settings = { ...DEFAULT_SETTINGS };
    this._seed = 322420463;
    this._smart = false;
    this._order = "free";
    this._currentPainter = null;
    this._currentWorker = null;
    this._lastSim = 0;
    this._lastCount = 0;
    this._initLayers();
  }
  /**
   * Register every built-in style onto the CURRENT renderer.
   * Must be re-callable: app.js swaps `this.renderer` for the CanvasManager's
   * renderer after construction, which would otherwise leave `_styles` empty
   * and silently force every style onto the generic fallback draw path.
   * @private
   */
  _registerAllStyles() {
    const styles = getAllStyles();
    this._styleList = styles.map((s2) => s2.name);
    for (const { name, instance } of styles) {
      this.renderer.registerStyle(name, {
        draw: (ctx, shape, progress) => instance.render(ctx, shape, progress)
      });
      const painterName = aliasStyle(name);
      if (painterName !== name) {
        this.renderer.registerStyle(painterName, {
          draw: (ctx, shape, progress) => instance.render(ctx, shape, progress)
        });
      }
    }
  }
  // ─── Initialization ───────────────────────────────────────────────
  _initLayers() {
    this.layers = [
      {
        id: 0,
        name: "Background",
        visible: true,
        opacity: 1,
        blendMode: "normal",
        strokes: [],
        locked: false
      },
      {
        id: 1,
        name: "Layer 1",
        visible: true,
        opacity: 1,
        blendMode: "normal",
        strokes: [],
        locked: false
      }
    ];
  }
  /**
   * Named layer definitions for multi-layer rendering mode.
   * When multiLayer is enabled, shapes are assigned to these layers
   * by the Painter's _assignLayer method.
   */
  static LAYER_NAMES = ["background", "shadows", "outline", "midtone", "highlights"];
  /**
   * Initialize named layer objects for multi-layer mode.
   * Each layer has a _name property used by the Renderer for offscreen compositing.
   * @returns {Array<object>}
   */
  _initMultiLayerLayers() {
    const names = Engine.LAYER_NAMES;
    const labels = ["Background", "Shadows", "Outline", "Midtone", "Highlights"];
    return names.map((name, i2) => ({
      id: i2,
      name,
      _name: name,
      label: labels[i2],
      visible: true,
      opacity: 1,
      blendMode: "normal",
      strokes: [],
      locked: false
    }));
  }
  // ─── Image Loading ────────────────────────────────────────────────
  /**
   * Load an image from an HTMLImageElement, HTMLCanvasElement, or data URL.
   * Performs analysis and populates the engine's internal state for the Painter.
   * Stores raw RGBA pixel data alongside the analysis result.
   *
   * @param {HTMLImageElement|HTMLCanvasElement|string} source
   * @returns {Promise<void>}
   */
  async loadImage(source) {
    return new Promise((resolve, reject) => {
      const handleImage = (img) => {
        this._sourceImage = img;
        this.width = img.width;
        this.height = img.height;
        this.renderer.setSize(this.width, this.height);
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const ctx = tempCanvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        this._imageData = ctx.getImageData(0, 0, img.width, img.height);
        this._pixels = new Uint8ClampedArray(this._imageData.data);
        this._analysis = analyzeImage(
          this._pixels,
          img.width,
          img.height,
          {
            paletteSize: this.settings.paletteSize || 8,
            edgeThreshold: 0.15
          }
        );
        resolve();
      };
      if (typeof source === "string") {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          handleImage(img);
        };
        img.onerror = reject;
        img.src = source;
      } else if (source instanceof HTMLImageElement) {
        handleImage(source);
      } else if (source instanceof HTMLCanvasElement) {
        const img = new Image();
        img.onload = () => {
          handleImage(img);
        };
        img.src = source.toDataURL();
      } else {
        reject(new Error("loadImage: unsupported source type"));
      }
    });
  }
  /**
   * Load an image from a File object (from drag-and-drop or file input).
   * Stores raw RGBA pixel data alongside the analysis result.
   *
   * @param {File} file
   * @returns {Promise<void>}
   */
  async loadImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e2) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          this._sourceImage = img;
          this.width = img.width;
          this.height = img.height;
          this.renderer.setSize(this.width, this.height);
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          const ctx = tempCanvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          this._imageData = ctx.getImageData(0, 0, img.width, img.height);
          this._pixels = new Uint8ClampedArray(this._imageData.data);
          this._analysis = analyzeImage(
            this._pixels,
            img.width,
            img.height,
            {
              paletteSize: this.settings.paletteSize || 8,
              edgeThreshold: 0.15
            }
          );
          resolve();
        };
        img.onerror = reject;
        img.src = e2.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  // ─── Generation ───────────────────────────────────────────────────
  /**
   * Generate stroke candidates and select the best ones using the Painter.
   *
   * The Painter handles all painting logic:
   *   - Size progression (big washes first, fine strokes last)
   *   - Hill-climbing to find optimal positions
   *   - Color solving (weighted least squares over covered pixels)
   *   - Error map tracking (residual after each stroke)
   *   - Smart mode (structure tensor, focus map, subject detection)
   *   - Path ordering ('down', 'up', 'spiral', 'rings', 'clock', etc.)
   *   - Edge outlines, region fill, one-line mode
   *
   * Shapes emitted by the Painter in the `{t, p, c0, c1, a, st, fl}` format are
   * converted to the internal `{type, params, color0, color1, alpha, style,
   * layer, order, seed, flat}` format expected by the Renderer and Exporter.
   *
   * @param {object} opts
   * @param {string} [opts.style]
   * @param {number} [opts.count]
   * @param {number} [opts.layer]
   * @param {boolean} [opts.smart]    Enable smart mode (structure tensor, focus map, subject detection).
   * @param {string} [opts.order]      Path ordering: 'down', 'up', 'right', 'left', 'diag', 'spiral', 'spiralin', 'rings', 'ringsin', 'clock', or 'free'.
   * @param {boolean} [opts.pen]      Enable one-line pen mode.
   * @param {number} [opts.seed]       Override the master seed for this run.
   * @param {function(object, number): void} [opts.onShape]  Optional live callback
   *   invoked once per committed shape (engine-format) as it is generated.
   *   Useful for streaming strokes onto the canvas during generation.
   * @returns {Promise<Array<object>>} Selected shape objects (in internal format).
   */
  async generate(opts = {}) {
    const style = opts.style || this.settings.style || "pencil";
    const count = opts.count || this.settings.strokeCount || 1e3;
    const layerIdx = opts.layer !== void 0 ? opts.layer : 0;
    const seed = opts.seed !== void 0 ? opts.seed : this._seed;
    const multiLayer = opts.multiLayer !== void 0 ? opts.multiLayer : this.settings.multiLayer || false;
    if (opts.style) this.settings.style = style;
    if (opts.count) this.settings.strokeCount = count;
    if (opts.smart !== void 0) this._smart = opts.smart;
    if (opts.order !== void 0) this._order = opts.order;
    if (!this._analysis) {
      throw new Error("No image loaded. Call loadImage first.");
    }
    if (!this._pixels) {
      throw new Error("No pixel data available. Call loadImage first.");
    }
    const selected = [];
    const painterOrder = this._order && PAINTER_ORDER_KINDS.includes(this._order) ? this._order : null;
    if (this.useWorker && typeof Worker !== "undefined") {
      const shapes = await this._generateViaWorker({
        width: this.width,
        height: this.height,
        pixels: this._pixels,
        style,
        smart: this._smart,
        order: painterOrder,
        count,
        seed,
        pen: opts.pen !== void 0 ? opts.pen : this.settings.oneLine,
        layerMode: multiLayer,
        onShape: opts.onShape
      });
      const allShapes = shapes.map((ps, i2) => {
        const s2 = this._convertShape(ps, i2, layerIdx);
        if (multiLayer && ps.layer) s2.layerName = ps.layer;
        return s2;
      });
      if (multiLayer) {
        const namedLayers = this._initMultiLayerLayers();
        const layerByName = {};
        for (const l2 of namedLayers) {
          layerByName[l2._name] = l2;
        }
        for (const s2 of allShapes) {
          const ln2 = s2.layerName || "midtone";
          if (layerByName[ln2]) {
            layerByName[ln2].strokes.push(s2);
          } else if (layerByName["midtone"]) {
            layerByName["midtone"].strokes.push(s2);
          }
        }
        this.layers = namedLayers;
        this.renderer.multiLayer = true;
      } else {
        const layer = this.getLayer(layerIdx);
        if (layer) {
          layer.strokes = allShapes;
        }
        this.renderer.multiLayer = false;
      }
      this.renderer.setLayers(this.layers);
      return allShapes;
    }
    let resolveDone;
    const done = new Promise((resolve) => {
      resolveDone = resolve;
    });
    const painter = new Painter({
      width: this.width,
      height: this.height,
      imageData: this._pixels,
      options: {
        style: aliasStyle(style),
        smart: this._smart,
        abstract: this.settings.abstract || false,
        palette: this.settings.palette || null,
        size: this.settings.sizeK || 1,
        sizeRand: this.settings.sizeRand || false,
        order: painterOrder,
        outline: this.settings.outline || "off",
        rfill: this.settings.rfill || "off",
        maxShapes: count,
        seed,
        pen: this.settings.oneLine || false,
        layerMode: multiLayer,
        // Collect and convert each shape via the onShape callback
        onShape: (ps) => {
          const shape = this._convertShape(ps, selected.length, layerIdx);
          if (multiLayer && ps.layer) {
            shape.layerName = ps.layer;
          }
          selected.push(shape);
        },
        // Resolve the completion promise when painting is done
        onDone: (result) => {
          this._lastSim = result.sim;
          this._lastCount = result.count;
          resolveDone(result);
        }
      }
    });
    this._currentPainter = painter;
    painter.start();
    await done;
    this._currentPainter = null;
    if (multiLayer) {
      const namedLayers = this._initMultiLayerLayers();
      const layerByName = {};
      for (const l2 of namedLayers) {
        layerByName[l2._name] = l2;
      }
      for (const s2 of selected) {
        const ln2 = s2.layerName || "midtone";
        if (layerByName[ln2]) {
          layerByName[ln2].strokes.push(s2);
        } else if (layerByName["midtone"]) {
          layerByName["midtone"].strokes.push(s2);
        }
      }
      this.layers = namedLayers;
      this.renderer.multiLayer = true;
    } else {
      const layer = this.getLayer(layerIdx);
      if (layer) {
        layer.strokes = selected;
      }
      this.renderer.multiLayer = false;
    }
    this.renderer.setLayers(this.layers);
    return selected;
  }
  /**
   * Run the Painter inside a Web Worker so the main thread stays responsive.
   * Streams committed shapes back via postMessage and resolves with the
   * full ordered shape array when the worker reports done.
   * @private
   */
  _generateViaWorker({ width, height, pixels, style, smart, order, count, seed, pen, onShape, layerMode }) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL("./painter-worker.js", import.meta.url), { type: "module" });
      this._currentWorker = worker;
      const shapes = [];
      worker.onmessage = (e2) => {
        const m2 = e2.data;
        if (!m2) return;
        if (m2.type === "shape") {
          shapes.push(m2.shape);
          if (onShape) {
            const idx = shapes.length - 1;
            try {
              const converted = this._convertShape(m2.shape, idx, 0);
              if (layerMode && m2.shape.layer) converted.layerName = m2.shape.layer;
              onShape(converted, idx);
            } catch (e3) {
            }
          }
        } else if (m2.type === "done") {
          this._lastSim = m2.result ? m2.result.sim : 0;
          this._lastCount = shapes.length;
          worker.terminate();
          this._currentWorker = null;
          resolve(shapes);
        } else if (m2.type === "error") {
          worker.terminate();
          this._currentWorker = null;
          reject(new Error(m2.message || "painter worker error"));
        }
      };
      worker.onerror = (err) => {
        worker.terminate();
        this._currentWorker = null;
        reject(new Error(err && err.message || "painter worker failed"));
      };
      const copy = new Uint8ClampedArray(pixels);
      worker.postMessage({
        type: "start",
        id: 1,
        width,
        height,
        imageData: copy,
        options: {
          style: aliasStyle(style),
          smart,
          abstract: this.settings.abstract || false,
          palette: this.settings.palette || null,
          size: this.settings.sizeK || 1,
          sizeRand: this.settings.sizeRand || false,
          order,
          outline: this.settings.outline || "off",
          rfill: this.settings.rfill || "off",
          maxShapes: count,
          seed,
          pen,
          layerMode: layerMode || false
        }
      });
    });
  }
  /**
   * Convert a Painter-emitted shape to the internal format expected by
   * the Renderer and Exporter.
   *
   * Painter shape:  { t, p, a, st, fl, c0, c1 }
   * Engine shape:   { id, type, params, color0, color1, alpha, style, layer, order, seed, flat }
   *
   * @param {object} ps  Shape from Painter's onShape callback.
   * @param {number} order  Paint order index (sequential).
   * @param {number} layerIdx  Target layer index.
   * @returns {object} Converted shape in internal format.
   */
  _convertShape(ps, order, layerIdx) {
    const t2 = ps.t;
    let p2 = ps.p.slice();
    const c0 = ps.c0;
    const c1 = ps.c1;
    const a2 = ps.a;
    if (t2 === "E" || t2 === "B" || t2 === "R") {
      p2[5] = c0;
      p2.push(c1, a2);
    } else {
      p2.push(c0, c1, a2);
    }
    return {
      id: `stroke_${layerIdx}_${order}`,
      type: ps.t,
      params: p2,
      color0: ps.c0,
      color1: ps.c1,
      alpha: ps.a,
      style: ps.st,
      layer: layerIdx,
      order,
      seed: this._seed,
      flat: ps.fl
    };
  }
  // ─── Rendering ────────────────────────────────────────────────────
  /**
   * Render all visible layers to the canvas.
   *
   * @param {object} [opts]
   * @param {number} [opts.progress=1]
   */
  render(opts = {}) {
    const progress = opts.progress !== void 0 ? opts.progress : 1;
    this.renderer.setLayers(this.layers);
    this.renderer.renderAll({
      progress,
      clear: opts.clear !== false
    });
    return this.canvas;
  }
  // ─── Export ───────────────────────────────────────────────────────
  /**
   * Export the current painting as a PNG blob.
   *
   * @param {object} [opts]
   * @param {number} [opts.width]
   * @param {number} [opts.height]
   * @param {number} [opts.quality=0.92]
   * @param {string} [opts.background]
   * @returns {Promise<Blob>}
   */
  async exportPNG(opts = {}) {
    return exportImage(this.renderer, this.layers, {
      width: opts.width || this.width,
      height: opts.height || this.height,
      format: "png",
      quality: opts.quality || 0.92,
      background: opts.background || this.background
    });
  }
  /**
   * Export as JPG blob.
   *
   * @param {object} [opts]
   * @param {number} [opts.width]
   * @param {number} [opts.height]
   * @param {number} [opts.quality=0.92]
   * @param {string} [opts.background]
   * @returns {Promise<Blob>}
   */
  async exportJPG(opts = {}) {
    return exportImage(this.renderer, this.layers, {
      width: opts.width || this.width,
      height: opts.height || this.height,
      format: "jpg",
      quality: opts.quality || 0.92,
      background: opts.background || this.background
    });
  }
  /**
   * Export as a self-contained HTML document string.
   *
   * @param {object} [opts]
   * @param {string} [opts.format='packed']
   * @param {number} [opts.strokeDuration=0.5]
   * @param {number} [opts.width]
   * @param {number} [opts.height]
   * @param {string} [opts.background]
   * @returns {string} HTML document string.
   */
  exportHTML(opts = {}) {
    return exportHTML(this.layers, {
      width: opts.width || this.width,
      height: opts.height || this.height,
      format: opts.format || "packed",
      strokeDuration: opts.strokeDuration || 0.5,
      background: opts.background || this.background,
      styleList: this._styleList
    });
  }
  /**
   * Export as SVG document string.
   *
   * @param {object} [opts]
   * @param {number} [opts.width]
   * @param {number} [opts.height]
   * @param {string} [opts.background]
   * @returns {string} SVG document string.
   */
  exportSVG(opts = {}) {
    return exportSVG(this.layers, opts.width || this.width, opts.height || this.height, opts.background || this.background);
  }
  /**
   * Export each named layer as a separate PNG blob.
   *
   * @param {object} [opts]
   * @param {number} [opts.width]
   * @param {number} [opts.height]
   * @param {string} [opts.background]
   * @returns {Promise<Object<string, Blob>>} Map of layer name to PNG blob.
   */
  async exportAllLayersAsPNG(opts = {}) {
    return exportAllLayersAsPNG(
      this.renderer,
      this.layers,
      opts.width || this.width,
      opts.height || this.height,
      { background: opts.background || this.background }
    );
  }
  /**
   * Export the current project as a JSON string.
   *
   * @param {object} [opts]
   * @param {number} [opts.width]
   * @param {number} [opts.height]
   * @param {string} [opts.background]
   * @param {boolean} [opts.embedImage=true] - Embed the source image as base64.
   * @returns {string} JSON string.
   */
  exportProject(opts = {}) {
    let imageData = null;
    if (opts.embedImage !== false && this._sourceImage) {
      const canvas = document.createElement("canvas");
      canvas.width = this._sourceImage.width;
      canvas.height = this._sourceImage.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(this._sourceImage, 0, 0);
      imageData = canvas.toDataURL("image/png");
    }
    return exportProject(this.layers, this.settings, {
      width: opts.width || this.width,
      height: opts.height || this.height,
      background: opts.background || this.background,
      imageData
    });
  }
  /**
   * Import a project from a JSON string.
   *
   * @param {string} jsonStr
   * @returns {Promise<object>} Parsed project object.
   */
  async importProject(jsonStr) {
    const project = importProject(jsonStr);
    this.settings = { ...DEFAULT_SETTINGS, ...project.settings };
    this.width = project.width;
    this.height = project.height;
    this.background = project.background;
    this.renderer.setSize(this.width, this.height);
    this.renderer.background = this.background;
    this.layers = project.layers.map((l2) => ({
      id: l2.id,
      name: l2.name || `Layer ${l2.id}`,
      visible: l2.visible !== void 0 ? l2.visible : true,
      opacity: l2.opacity !== void 0 ? l2.opacity : 1,
      blendMode: l2.blendMode || "normal",
      strokes: l2.strokes || [],
      locked: l2.locked || false
    }));
    if (project.image) {
      await this.loadImage(project.image);
    }
    this.renderer.setLayers(this.layers);
    this.render();
    return project;
  }
  // ─── Layer Management ─────────────────────────────────────────────
  /**
   * Get a layer by index.
   * @param {number} index
   * @returns {Layer|undefined}
   */
  getLayer(index) {
    return this.layers.find((l2) => l2.id === index);
  }
  /**
   * Get the active (top-most) layer.
   * @returns {Layer|undefined}
   */
  getActiveLayer() {
    return this.layers.length > 0 ? this.layers[this.layers.length - 1] : void 0;
  }
  /**
   * Add a new layer above the current top layer.
   * @param {string} [name]
   * @returns {Layer}
   */
  addLayer(name) {
    const id = this.layers.length > 0 ? Math.max(...this.layers.map((l2) => l2.id)) + 1 : 0;
    const layer = {
      id,
      name: name || `Layer ${id}`,
      visible: true,
      opacity: 1,
      blendMode: "normal",
      strokes: [],
      locked: false
    };
    this.layers.push(layer);
    this.renderer.setLayers(this.layers);
    return layer;
  }
  /**
   * Remove a layer by index.
   * @param {number} index
   */
  removeLayer(index) {
    const idx = this.layers.findIndex((l2) => l2.id === index);
    if (idx === -1) return false;
    if (this.layers.length <= 1) return false;
    this.layers.splice(idx, 1);
    this.renderer.setLayers(this.layers);
    return true;
  }
  /**
   * Move a layer up or down in z-order.
   * @param {number} index
   * @param {number} direction - 1 = up, -1 = down
   */
  moveLayer(index, direction) {
    const idx = this.layers.findIndex((l2) => l2.id === index);
    if (idx === -1) return;
    const target = idx + direction;
    if (target < 0 || target >= this.layers.length) return;
    const [layer] = this.layers.splice(idx, 1);
    this.layers.splice(target, 0, layer);
    this.renderer.setLayers(this.layers);
  }
  /**
   * Duplicate a layer.
   * @param {number} index
   * @returns {Layer}
   */
  duplicateLayer(index) {
    const layer = this.getLayer(index);
    if (!layer) return null;
    const id = this.layers.length > 0 ? Math.max(...this.layers.map((l2) => l2.id)) + 1 : 0;
    const dup = {
      id,
      name: `${layer.name} (Copy)`,
      visible: layer.visible,
      opacity: layer.opacity,
      blendMode: layer.blendMode,
      strokes: layer.strokes.map((s2) => ({ ...s2 })),
      locked: false
    };
    this.layers.push(dup);
    this.renderer.setLayers(this.layers);
    return dup;
  }
  // ─── Settings / Utility ───────────────────────────────────────────
  /**
   * Update settings and recompute derived values.
   * @param {object} settings
   */
  setSettings(settings) {
    this.settings = resolveSettings({ ...this.settings, ...settings });
    if (settings.smart !== void 0) this._smart = !!settings.smart;
    if (settings.order !== void 0) this._order = settings.order;
  }
  /**
   * Enable or disable smart mode (structure tensor, focus map, subject detection).
   * @param {boolean} enabled
   */
  setSmart(enabled) {
    this._smart = !!enabled;
  }
  /**
   * Set the path ordering mode.
   * @param {string} order - 'down', 'up', 'right', 'left', 'diag', 'spiral',
   *                         'spiralin', 'rings', 'ringsin', 'clock', or 'free'.
   */
  setOrder(order) {
    this._order = order || "free";
  }
  /**
   * Get the list of available style names.
   * @returns {string[]}
   */
  getStyleList() {
    return this._styleList;
  }
  /**
   * Get all style metadata for UI rendering.
   * @returns {Array<{name, label, category, description}>}
   */
  getStyleInfo() {
    return getAllStyles().map((s2) => ({
      name: s2.name,
      label: s2.label,
      category: s2.category,
      description: s2.instance.description
    }));
  }
  /**
   * Get the total stroke count across all layers.
   * @returns {number}
   */
  getTotalStrokes() {
    return this.layers.reduce((sum, l2) => sum + (l2.strokes?.length || 0), 0);
  }
  /**
   * Get the analysis result (for previews, etc.).
   * @returns {object|null}
   */
  getAnalysis() {
    return this._analysis;
  }
  /**
   * Get the source image data URL.
   * @returns {string|null}
   */
  getImageDataURL() {
    if (!this._sourceImage) return null;
    const canvas = document.createElement("canvas");
    canvas.width = this._sourceImage.width;
    canvas.height = this._sourceImage.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(this._sourceImage, 0, 0);
    return canvas.toDataURL("image/png");
  }
  /**
   * Get the last similarity score (0–100) from the most recent generate() run.
   * @returns {number}
   */
  getSimilarity() {
    return this._lastSim;
  }
  /**
   * Clear all strokes from a layer (or all layers).
   * @param {number} [layerIndex]
   */
  clearStrokes(layerIndex) {
    if (layerIndex !== void 0) {
      const layer = this.getLayer(layerIndex);
      if (layer) layer.strokes = [];
    } else {
      for (const layer of this.layers) {
        layer.strokes = [];
      }
    }
    this.renderer.setLayers(this.layers);
  }
  /**
   * Stop the current Painter if it is running.
   * The generate() promise will resolve shortly after.
   */
  stop() {
    if (this._currentWorker) {
      try {
        this._currentWorker.postMessage({ type: "stop", id: 1 });
      } catch (_2) {
      }
    }
    if (this._currentPainter) {
      this._currentPainter.stop();
    }
  }
  /**
   * Re-render at a new resolution (for high-DPI export).
   */
  setSize(w2, h2) {
    this.width = w2;
    this.height = h2;
    this.renderer.setSize(w2, h2);
  }
  /**
   * Destroy the engine (clean up resources).
   */
  destroy() {
    this.stop();
    this._pixels = null;
    this._imageData = null;
    this._analysis = null;
    this._sourceImage = null;
    this._currentPainter = null;
  }
};

// js/ui/canvas.js
var CanvasManager = class {
  constructor(canvas, opts = {}) {
    if (!canvas) throw new Error("CanvasManager requires a canvas element");
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.dpr = opts.dpr || window.devicePixelRatio || 1;
    this.background = opts.background || (getComputedStyle(document.documentElement).getPropertyValue("--editor-bg").trim() || "#121212");
    this.renderer = createRenderer(canvas, {
      width: canvas.width,
      height: canvas.height,
      background: this.background
    });
    this._rafId = null;
    this._animating = false;
    this._updateDPR();
  }
  /**
   * Update canvas resolution for device pixel ratio.
   *
   * CRITICAL: never read the canvas's rendered box here. The canvas is sized BY
   * its own width/height attributes, so reading getBoundingClientRect() and
   * writing it back captures whatever the CSS happened to give at that instant
   * and permanently resizes the artwork to it — the canvas silently shrank to
   * its first laid-out size. The backing store is the logical size times the DPR.
   */
  _updateDPR() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const logicalW = this.canvas.width || 1024;
    const logicalH = this.canvas.height || 768;
    this.canvas.width = Math.round(logicalW * this.dpr);
    this.canvas.height = Math.round(logicalH * this.dpr);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
    this.renderer.width = this.canvas.width;
    this.renderer.height = this.canvas.height;
  }
  /**
   * Set canvas display size and update resolution.
   * @param {number} width  — logical pixels
   * @param {number} height — logical pixels
   * @returns {this}
   */
  setSize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.aspectRatio = `${width} / ${height}`;
    this._updateDPR();
    return this;
  }
  /**
   * Resize canvas to fill a container element.
   * @param {HTMLElement} container
   */
  fillContainer(container) {
    const rect = container.getBoundingClientRect();
    this.canvas.style.width = rect.width + "px";
    this.canvas.style.height = rect.height + "px";
    this._updateDPR();
    return this;
  }
  /**
   * Set the background color and clear the canvas.
   * @param {string} color — CSS color string
   */
  setBackground(color) {
    this.background = color;
    this.renderer.background = color;
    this.clear();
  }
  /**
   * Update layers on the renderer.
   * @param {Array<object>} layers
   */
  setLayers(layers) {
    this.renderer.setLayers(layers);
  }
  /**
   * Clear the canvas with the background color.
   */
  clear() {
    this.renderer.clear();
  }
  /**
   * Render all layers immediately at a given progress.
   * @param {object} [opts]
   * @param {number} [opts.progress=1]
   * @param {boolean} [opts.clear=true]
   */
  render(opts = {}) {
    const progress = opts.progress !== void 0 ? opts.progress : 1;
    this.renderer.renderAll({
      progress,
      clear: opts.clear !== false,
      layers: opts.layers
    });
  }
  /**
   * Draw one stroke directly onto the canvas, on top of what is already there.
   * Used for live streaming during generation (no clear, no full re-render).
   * @param {object} shape — engine-format shape
   * @param {number} [progress=1]
   */
  drawStroke(shape, progress = 1) {
    if (!shape) return;
    try {
      this.renderer.drawShapeAt(shape, progress);
    } catch (e2) {
    }
  }
  /**
   * Render the painting progressively (animated reveal) from 0 to 1.
   * @param {object} [opts]
   * @param {number} [opts.duration=2000] — animation duration in ms
   * @param {function} [opts.onFrame] — called with progress each frame
   * @returns {Promise<void>}
   */
  async renderAnimated(opts = {}) {
    const duration = opts.duration || 2e3;
    this._animating = true;
    return new Promise((resolve) => {
      const start = performance.now();
      const step = (now) => {
        const elapsed = now - start;
        const t2 = Math.min(1, elapsed / duration);
        const progress = 1 - Math.pow(1 - t2, 3);
        this.render({ progress });
        if (opts.onFrame) opts.onFrame(progress);
        if (t2 < 1 && this._animating) {
          this._rafId = requestAnimationFrame(step);
        } else {
          this._animating = false;
          this.render({ progress: 1 });
          resolve();
        }
      };
      this._rafId = requestAnimationFrame(step);
    });
  }
  /** Stop any ongoing animation. */
  stopAnimation() {
    this._animating = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }
  /**
   * Handle canvas drag-and-drop events.
   * @param {HTMLElement} dropZone — element to attach drop handlers to
   * @param {function(File)} onFile — called with each dropped file
   */
  setupDropZone(dropZone, onFile) {
    const preventDefaults = (e2) => {
      e2.preventDefault();
      e2.stopPropagation();
    };
    const highlight = () => dropZone.classList.add("drag-over");
    const unhighlight = () => dropZone.classList.remove("drag-over");
    dropZone.addEventListener("dragenter", preventDefaults);
    dropZone.addEventListener("dragover", (e2) => {
      preventDefaults(e2);
      const hasFiles = e2.dataTransfer && e2.dataTransfer.types.includes("Files");
      if (hasFiles) {
        e2.dataTransfer.dropEffect = "copy";
        highlight();
      }
    });
    dropZone.addEventListener("dragleave", unhighlight);
    dropZone.addEventListener("drop", preventDefaults);
    dropZone.addEventListener("drop", (e2) => {
      preventDefaults(e2);
      unhighlight();
      const files = e2.dataTransfer.files;
      if (files.length > 0) onFile(files[0]);
    });
    const picker = dropZone.querySelector(".file-input-picker");
    if (picker) {
      picker.addEventListener("change", (e2) => {
        const file = e2.target.files?.[0];
        if (!file) return;
        e2.target.value = "";
        if (file.type.startsWith("image/")) onFile(file);
      });
    }
    return { highlight, unhighlight };
  }
  /**
   * Destroy the canvas manager (clean up animations).
   */
  destroy() {
    this.stopAnimation();
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }
};

// js/ui/thumbnails.js
var SIZE = 64;
var STROKE_BUDGET = 8;
function makeMockAnalyzer() {
  const w2 = SIZE, h2 = SIZE;
  const edges = [
    { x0: w2 * 0.1, y0: h2 * 0.8, cx: w2 * 0.5, cy: h2 * 0.5, x1: w2 * 0.9, y1: h2 * 0.2, seed: [1, 2, 3, 4, 5, 6] },
    { x0: w2 * 0.2, y0: h2 * 0.3, cx: w2 * 0.5, cy: h2 * 0.5, x1: w2 * 0.8, y1: h2 * 0.7, seed: [7, 8, 9, 10, 11, 12] },
    { x0: w2 * 0.5, y0: h2 * 0.1, cx: w2 * 0.5, cy: h2 * 0.5, x1: w2 * 0.5, y1: h2 * 0.9, seed: [13, 14, 15, 16, 17, 18] }
  ];
  const regions = [
    { cx: w2 * 0.5, cy: h2 * 0.5, w: w2 * 0.6, h: h2 * 0.6, area: w2 * h2 * 0.36 }
  ];
  let ci2 = 0;
  const palette = [
    [40, 40, 60],
    // near-black blue
    [200, 80, 60],
    // warm red
    [60, 140, 180],
    // teal
    [180, 160, 80],
    // ochre
    [100, 60, 140]
    // purple
  ];
  return {
    edges,
    regions,
    sampleColor() {
      const c2 = palette[ci2 % palette.length];
      ci2++;
      return c2;
    }
  };
}
function renderThumbnail(styleInstance) {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, SIZE, SIZE);
  const analyzer = makeMockAnalyzer();
  let strokes = [];
  try {
    strokes = styleInstance.generate(analyzer, {}) || [];
  } catch (e2) {
    ctx.fillStyle = "#666";
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.2, 0, Math.PI * 2);
    ctx.fill();
    return canvas.toDataURL("image/png");
  }
  strokes = strokes.slice(0, STROKE_BUDGET);
  const sx = SIZE / 64;
  const sy = SIZE / 64;
  ctx.save();
  ctx.scale(sx, sy);
  for (let i2 = 0; i2 < strokes.length; i2++) {
    const s2 = strokes[i2];
    const progress = 1;
    try {
      styleInstance.render(ctx, s2, progress);
    } catch (e2) {
    }
  }
  ctx.restore();
  return canvas.toDataURL("image/png");
}
function buildThumbnailCache() {
  const cache = /* @__PURE__ */ new Map();
  const styles = getAllStyles();
  for (const { name, instance } of styles) {
    try {
      cache.set(name, renderThumbnail(instance));
    } catch (e2) {
      const c2 = document.createElement("canvas");
      c2.width = SIZE;
      c2.height = SIZE;
      const ctx = c2.getContext("2d");
      ctx.fillStyle = "#222";
      ctx.fillRect(0, 0, SIZE, SIZE);
      cache.set(name, c2.toDataURL("image/png"));
    }
  }
  return cache;
}

// js/ui/controls.js
var PAINTER_DEFAULT_SETTINGS = {
  style: DEFAULT_SETTINGS.style || "pencil",
  strokeSize: { min: 6, max: 28, random: true },
  strokeCount: DEFAULT_SETTINGS.strokeCount || 5e3,
  detailLevel: DEFAULT_SETTINGS.detailLevel ?? 0.7,
  styleStrength: DEFAULT_SETTINGS.styleStrength ?? 0.8,
  opacity: DEFAULT_SETTINGS.opacity ?? 0.85,
  randomness: DEFAULT_SETTINGS.randomness ?? 0.3,
  scatter: DEFAULT_SETTINGS.scatter ?? 0.3,
  colorMode: DEFAULT_SETTINGS.colorMode || "exact",
  paletteSize: DEFAULT_SETTINGS.paletteSize || 8,
  pathOrder: "free",
  // legacy — kept in settings for backward compat
  smart: true,
  // Painter smart mode on by default
  order: "free",
  // maps to Painter.orderSetup kinds
  oneLine: false,
  // Painter one-line pen mode
  outline: "off",
  // Painter outline mode: off | first | last
  rfill: "off",
  // Painter region fill: off | scribble | rows
  multiLayer: false
  // Multi-layer rendering mode (before generation)
};
var PATH_ORDER_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "down", label: "Down" },
  { value: "up", label: "Up" },
  { value: "right", label: "Right" },
  { value: "left", label: "Left" },
  { value: "diag", label: "Diagonal" },
  { value: "spiral", label: "Spiral" },
  { value: "spiralin", label: "Spiral In" },
  { value: "rings", label: "Rings" },
  { value: "ringsin", label: "Rings In" },
  { value: "clock", label: "Clock" }
];
var COLOR_MODE_OPTIONS = [
  { value: "exact", label: "Exact" },
  { value: "quantized", label: "Quantized" },
  { value: "palette", label: "Palette" }
];
var OUTLINE_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "first", label: "First" },
  { value: "last", label: "Last" }
];
var RFILL_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "scribble", label: "Scribble" },
  { value: "rows", label: "Rows" }
];
var ONELINE_OPTIONS = [
  { value: "false", label: "Off" },
  { value: "true", label: "On" }
];
var SMART_OPTIONS = [
  { value: false, label: "Off" },
  { value: true, label: "On" }
];
var MULTILAYER_OPTIONS = [
  { value: false, label: "Single" },
  { value: true, label: "Multi" }
];
var ControlsManager = class {
  constructor(root, opts = {}) {
    if (!root) throw new Error("ControlsManager requires a root element");
    this.root = root;
    this.settings = { ...PAINTER_DEFAULT_SETTINGS, ...opts.initialSettings };
    this.styles = getAllStyles().map((s2) => s2.name);
    this._inputs = {};
    this._styleThumbs = buildThumbnailCache();
    this._render();
    this._bindEvents();
    this._syncToUI();
  }
  /* ─── Rendering ─────────────────────────────────────────────── */
  /**
   * Build the entire controls panel DOM.
   *
   * The panel's chrome — the identity strip, the header and its collapse chevron,
   * and the collapsed rail icons — belongs to the shell, not to this manager.
   * Clearing innerHTML would delete it, so only the sections are cleared and the
   * chrome is re-appended after them.
   */
  _render() {
    this.root.classList.add("controls-panel");
    const chrome = Array.from(this.root.children).filter(
      (el) => el.classList.contains("panel-strip") || el.classList.contains("panel-head") || el.classList.contains("rail-icons")
    );
    const scrollable = this.root.querySelector(".controls-scroll");
    this.root.innerHTML = "";
    for (const el of chrome) this.root.appendChild(el);
    const host = document.createElement("div");
    host.className = "controls-scroll";
    this.root.appendChild(host);
    const sections = [
      { id: "style-section", title: "STYLE", render: () => this._renderStylePicker() },
      { id: "brush-section", title: "BRUSH", render: () => this._renderBrushControls() },
      { id: "path-section", title: "PATH ORDER", render: () => this._renderPathOrder() },
      { id: "motion-section", title: "MOTION & PATH", render: () => this._renderMotionSection() },
      { id: "color-section", title: "COLOR", render: () => this._renderColorMode() }
    ];
    for (const s2 of sections) {
      const section = document.createElement("section");
      section.className = "control-section";
      section.id = s2.id;
      const header = document.createElement("h3");
      header.className = "control-section__title";
      header.textContent = s2.title;
      section.appendChild(header);
      const body = document.createElement("div");
      body.className = "control-section__body";
      body.appendChild(s2.render());
      section.appendChild(body);
      host.appendChild(section);
    }
    const genSection = document.createElement("section");
    genSection.className = "control-section generate-btn-container";
    genSection.id = "generate-section";
    const generateBtn = document.createElement("button");
    generateBtn.className = "generate-btn";
    generateBtn.type = "button";
    generateBtn.textContent = "Generate Painting";
    generateBtn.dataset.action = "generate";
    genSection.appendChild(generateBtn);
    const stopBtn = document.createElement("button");
    stopBtn.className = "btn btn--sm btn--danger stop-btn";
    stopBtn.type = "button";
    stopBtn.textContent = "Stop";
    stopBtn.dataset.action = "stop";
    stopBtn.setAttribute("disabled", "disabled");
    genSection.appendChild(stopBtn);
    const resetBtn = document.createElement("button");
    resetBtn.className = "btn btn--sm btn--ghost reset-btn";
    resetBtn.type = "button";
    resetBtn.textContent = "Reset";
    resetBtn.dataset.action = "reset";
    genSection.appendChild(resetBtn);
    host.appendChild(genSection);
  }
  /**
   * Render the style picker as categorized dropdown with thumbnail previews.
   *
   * Layout:
   *   .style-picker
   *     .style-picker__trigger    ← shows selected style thumbnail + label
   *     .style-picker__dropdown
   *       .style-cat-list         ← category pills (Draw, Paint, Graphic, Craft, 3D)
   *       .style-thumb-grid       ← thumbnails for the selected category
   *
   * @returns {HTMLElement}
   */
  _renderStylePicker() {
    const wrapper = document.createElement("div");
    wrapper.className = "style-picker";
    const styles = getAllStyles();
    const cats = /* @__PURE__ */ new Map();
    for (const s2 of styles) {
      if (!cats.has(s2.category)) cats.set(s2.category, []);
      cats.get(s2.category).push(s2);
    }
    const orderedCats = [...cats.keys()].sort((a2, b2) => {
      const order = ["draw", "paint", "graphic", "craft", "3d"];
      return order.indexOf(a2) - order.indexOf(b2);
    });
    let selectedCat = orderedCats[0];
    let selectedStyle = this.settings.style;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "style-picker__trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    const triggerThumb = document.createElement("span");
    triggerThumb.className = "style-picker__trigger-thumb";
    const triggerLabel = document.createElement("span");
    triggerLabel.className = "style-picker__trigger-label";
    const triggerChev = document.createElement("span");
    triggerChev.className = "style-picker__chev";
    triggerChev.setAttribute("aria-hidden", "true");
    const chevSvg = document.createElement("svg");
    chevSvg.setAttribute("viewBox", "0 0 24 24");
    chevSvg.setAttribute("fill", "none");
    chevSvg.setAttribute("stroke", "currentColor");
    chevSvg.setAttribute("stroke-width", "1.75");
    chevSvg.setAttribute("stroke-linecap", "round");
    chevSvg.setAttribute("stroke-linejoin", "round");
    chevSvg.innerHTML = '<path d="M6 9l6 6l6-6"/>';
    triggerChev.appendChild(chevSvg);
    trigger.appendChild(triggerThumb);
    trigger.appendChild(triggerLabel);
    trigger.appendChild(triggerChev);
    const updateTrigger = () => {
      const entry = styles.find((s2) => s2.name === selectedStyle);
      triggerLabel.textContent = entry ? entry.label : "Select style\u2026";
      if (entry && this._styleThumbs && this._styleThumbs.has(entry.name)) {
        triggerThumb.style.backgroundImage = `url(${this._styleThumbs.get(entry.name)})`;
        triggerThumb.style.backgroundSize = "cover";
        triggerThumb.title = entry.label;
      } else {
        triggerThumb.style.backgroundImage = "";
        triggerThumb.style.backgroundColor = "var(--line)";
      }
    };
    const dropdown = document.createElement("div");
    dropdown.className = "style-picker__dropdown";
    dropdown.setAttribute("role", "listbox");
    dropdown.style.display = "none";
    const catList = document.createElement("div");
    catList.className = "style-cat-list";
    for (const cat of orderedCats) {
      const catBtn = document.createElement("button");
      catBtn.type = "button";
      catBtn.className = "style-cat-btn" + (cat === selectedCat ? " style-cat-btn--active" : "");
      catBtn.textContent = CATEGORY_LABELS[cat] || cat;
      catBtn.dataset.cat = cat;
      catBtn.addEventListener("click", () => {
        selectedCat = cat;
        catList.querySelectorAll(".style-cat-btn").forEach((b2) => b2.classList.toggle("style-cat-btn--active", b2.dataset.cat === cat));
        rebuildGrid(selectedCat);
        updateTrigger();
      });
      catList.appendChild(catBtn);
    }
    const thumbGrid = document.createElement("div");
    thumbGrid.className = "style-thumb-grid";
    const rebuildGrid = (cat) => {
      thumbGrid.innerHTML = "";
      const items = styles.filter((s2) => s2.category === cat);
      for (const s2 of items) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "style-thumb" + (s2.name === selectedStyle ? " style-thumb--active" : "");
        item.dataset.style = s2.name;
        item.dataset.cat = s2.category;
        item.setAttribute("title", s2.label);
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", s2.name === selectedStyle ? "true" : "false");
        const img = document.createElement("img");
        img.src = this._styleThumbs.get(s2.name) || "";
        img.alt = s2.label;
        img.loading = "lazy";
        img.width = 48;
        img.height = 48;
        const lbl = document.createElement("span");
        lbl.className = "style-thumb__label";
        lbl.textContent = s2.label;
        item.appendChild(img);
        item.appendChild(lbl);
        item.addEventListener("click", () => {
          selectedStyle = s2.name;
          thumbGrid.querySelectorAll(".style-thumb").forEach((t2) => {
            t2.classList.toggle("style-thumb--active", t2.dataset.style === selectedStyle);
            t2.setAttribute("aria-selected", t2.dataset.style === selectedStyle ? "true" : "false");
          });
          this._selectStyle(selectedStyle);
          closeDropdown();
          updateTrigger();
        });
        thumbGrid.appendChild(item);
      }
    };
    rebuildGrid(selectedCat);
    dropdown.appendChild(catList);
    dropdown.appendChild(thumbGrid);
    function openDropdown() {
      dropdown.style.display = "flex";
      trigger.setAttribute("aria-expanded", "true");
    }
    function closeDropdown() {
      dropdown.style.display = "none";
      trigger.setAttribute("aria-expanded", "false");
    }
    trigger.addEventListener("click", () => {
      if (dropdown.style.display === "none") openDropdown();
      else closeDropdown();
    });
    document.addEventListener("click", (e2) => {
      if (!wrapper.contains(e2.target)) closeDropdown();
    });
    dropdown.addEventListener("keydown", (e2) => {
      if (e2.key === "Escape") closeDropdown();
    });
    this._styleTrigger = trigger;
    this._styleThumbGrid = thumbGrid;
    this._styleCatList = catList;
    wrapper.appendChild(trigger);
    wrapper.appendChild(dropdown);
    updateTrigger();
    return wrapper;
  }
  /**
   * Select a style by name and dispatch the change.
   * @param {string} name
   * @private
   */
  /**
   * Select a style and update UI.
   * @param {string} name
   */
  _selectStyle(name) {
    this.root.querySelectorAll(".style-thumb").forEach((b2) => {
      b2.classList.toggle("style-thumb--active", b2.dataset.style === name);
      b2.setAttribute("aria-selected", b2.dataset.style === name ? "true" : "false");
    });
    this.settings.style = name;
    this._dispatchChange("style", name, { key: "style" });
  }
  /**
   * Render brush/stroke controls (sliders + smart toggle).
   * @returns {HTMLElement}
   */
  _renderBrushControls() {
    const wrapper = document.createElement("div");
    wrapper.className = "brush-controls";
    const controls = [
      { key: "strokeSizeMin", label: "Stroke Min", type: "range", min: 0.5, max: 50, step: 0.5, value: this.settings.strokeSize?.min || PAINTER_DEFAULT_SETTINGS.strokeSize.min },
      { key: "strokeSizeMax", label: "Stroke Max", type: "range", min: 0.5, max: 100, step: 0.5, value: this.settings.strokeSize?.max || PAINTER_DEFAULT_SETTINGS.strokeSize.max },
      { key: "strokeCount", label: "Density", type: "range", min: 500, max: 2e4, step: 100, value: this.settings.strokeCount || PAINTER_DEFAULT_SETTINGS.strokeCount },
      { key: "detailLevel", label: "Detail", type: "range", min: 0, max: 1, step: 0.05, value: this.settings.detailLevel ?? PAINTER_DEFAULT_SETTINGS.detailLevel, display: "percent" },
      { key: "styleStrength", label: "Strength", type: "range", min: 0, max: 1, step: 0.05, value: this.settings.styleStrength ?? PAINTER_DEFAULT_SETTINGS.styleStrength, display: "percent" },
      { key: "opacity", label: "Opacity", type: "range", min: 0, max: 1, step: 0.05, value: this.settings.opacity ?? PAINTER_DEFAULT_SETTINGS.opacity, display: "percent" },
      { key: "randomness", label: "Randomness", type: "range", min: 0, max: 1, step: 0.05, value: this.settings.randomness ?? PAINTER_DEFAULT_SETTINGS.randomness, display: "percent" },
      { key: "scatter", label: "Scatter", type: "range", min: 0, max: 1, step: 0.05, value: this.settings.scatter ?? PAINTER_DEFAULT_SETTINGS.scatter, display: "percent" }
    ];
    for (const c2 of controls) {
      wrapper.appendChild(this._renderSlider(c2));
    }
    wrapper.appendChild(this._renderToggle("smart", "Smart Mode", SMART_OPTIONS, this.settings.smart ?? PAINTER_DEFAULT_SETTINGS.smart));
    return wrapper;
  }
  /**
   * Render a single slider control with a value display.
   * @param {object} spec
   * @returns {HTMLElement}
   */
  _renderSlider(spec) {
    const id = `ctrl-${spec.key}`;
    const container = document.createElement("div");
    container.className = "control-slider";
    container.dataset.key = spec.key;
    const label = document.createElement("label");
    label.className = "slider-label";
    label.htmlFor = id;
    label.textContent = spec.label;
    const row = document.createElement("div");
    row.className = "slider-row";
    const input = document.createElement("input");
    input.type = spec.type;
    input.id = id;
    input.min = spec.min;
    input.max = spec.max;
    input.step = spec.step;
    input.value = spec.value;
    input.dataset.display = spec.display || "none";
    const valueSpan = document.createElement("span");
    valueSpan.className = "slider-value";
    valueSpan.textContent = this._formatSliderValue(spec, spec.value);
    input.addEventListener("input", (e2) => {
      valueSpan.textContent = this._formatSliderValue(spec, e2.target.value);
      this._dispatchChange(spec.key, e2.target.value, spec);
    });
    input.addEventListener("change", (e2) => {
      this._dispatchChange(spec.key, e2.target.value, spec);
    });
    this._inputs[spec.key] = { input, valueSpan, spec };
    row.appendChild(input);
    row.appendChild(valueSpan);
    container.appendChild(label);
    container.appendChild(row);
    return container;
  }
  /**
   * Render a boolean toggle as a compact pill.
   * @param {string} key — settings key
   * @param {string} label — display label
   * @param {Array<{value: *, label: string}>} options — exactly 2: Off, On
   * @param {*} currentValue
   * @returns {HTMLElement}
   */
  _renderToggle(key, label, options, currentValue) {
    const wrapper = document.createElement("div");
    wrapper.className = "control-toggle control-toggle--inline";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pill-toggle" + (currentValue ? " pill-toggle--on" : "");
    btn.textContent = label;
    btn.dataset.key = key;
    btn.setAttribute("role", "switch");
    btn.setAttribute("aria-checked", currentValue ? "true" : "false");
    btn.addEventListener("click", () => {
      const next = !(this.settings[key] ?? false);
      btn.classList.toggle("pill-toggle--on", next);
      btn.setAttribute("aria-checked", next ? "true" : "false");
      this.settings[key] = next;
      this._dispatchChange(key, next, { key });
    });
    this._inputs[key] = { input: btn, key, isToggle: true };
    wrapper.appendChild(btn);
    return wrapper;
  }
  /**
   * Render the path order selector as a segmented control.
   * @returns {HTMLElement}
   */
  _renderPathOrder() {
    return this._renderSegmentedControl("order", PATH_ORDER_OPTIONS);
  }
  /**
   * Render the color mode selector as a segmented control.
   * @returns {HTMLElement}
   */
  _renderColorMode() {
    return this._renderSegmentedControl("colorMode", COLOR_MODE_OPTIONS);
  }
  /**
   * Render the motion & path controls: one-line pen toggle, outline mode,
   * and region fill.
   * @returns {HTMLElement}
   */
  _renderMotionSection() {
    const wrapper = document.createElement("div");
    wrapper.className = "motion-controls";
    wrapper.appendChild(this._renderSegmentedControl("multiLayer", MULTILAYER_OPTIONS));
    wrapper.appendChild(this._renderToggle("oneLine", "One Line", ONELINE_OPTIONS, this.settings.oneLine ?? PAINTER_DEFAULT_SETTINGS.oneLine));
    wrapper.appendChild(this._renderSegmentedControl("outline", OUTLINE_OPTIONS));
    wrapper.appendChild(this._renderSegmentedControl("rfill", RFILL_OPTIONS));
    return wrapper;
  }
  /**
   * Render a segmented control from options.
   * @param {string} key — settings key
   * @param {Array<{value: string, label: string}>} options
   * @returns {HTMLElement}
   */
  _renderSegmentedControl(key, options) {
    const wrapper = document.createElement("div");
    wrapper.className = "control-select";
    const segmented = document.createElement("div");
    segmented.className = "segmented";
    segmented.setAttribute("role", "radiogroup");
    segmented.setAttribute("aria-label", key);
    const current = this.settings[key] || PAINTER_DEFAULT_SETTINGS[key];
    for (const opt of options) {
      const btn = document.createElement("button");
      btn.className = "segmented__btn";
      btn.type = "button";
      btn.textContent = opt.label;
      btn.dataset.value = opt.value;
      btn.dataset.key = key;
      btn.setAttribute("role", "radio");
      const isActive = opt.value === current;
      btn.classList.toggle("segmented__btn--active", isActive);
      btn.setAttribute("aria-checked", isActive ? "true" : "false");
      segmented.appendChild(btn);
    }
    this._inputs[key] = { segmented, key };
    wrapper.appendChild(segmented);
    return wrapper;
  }
  /* ─── Events ────────────────────────────────────────────────── */
  /**
   * Dispatch a synthetic settings-change event.
   * @param {string} key
   * @param {string|number|boolean} value
   * @param {object} spec
   * @private
   */
  _dispatchChange(key, value, spec) {
    let settings = {};
    if (key === "strokeSizeMin") {
      settings.strokeSize = { ...this.settings.strokeSize, min: parseFloat(value) };
    } else if (key === "strokeSizeMax") {
      settings.strokeSize = { ...this.settings.strokeSize, max: parseFloat(value) };
    } else if (key === "smart") {
      settings.smart = value === "true" || value === true;
    } else if (key === "multiLayer") {
      settings.multiLayer = value === "true" || value === true;
    } else if (spec && spec.type !== "select") {
      settings[key] = parseFloat(value);
    } else {
      settings[key] = value;
    }
    Object.assign(this.settings, settings);
    const event = new CustomEvent("settings-change", {
      detail: { key, value: settings[key] !== void 0 ? settings[key] : value, settings: { ...this.settings } }
    });
    this.root.dispatchEvent(event);
  }
  /**
   * Bind event listeners.
   */
  _bindEvents() {
    this.root.addEventListener("click", (e2) => {
      const btn = e2.target.closest(".style-btn");
      if (btn) {
        const styleName = btn.dataset.style;
        if (styleName) this._selectStyle(styleName);
      }
      const segBtn = e2.target.closest(".segmented__btn");
      if (segBtn && !segBtn.closest(".style-grid")) {
        const container = segBtn.parentElement;
        const key = segBtn.dataset.key;
        const value = segBtn.dataset.value;
        if (key && value) {
          container.querySelectorAll(".segmented__btn").forEach((b2) => {
            b2.classList.remove("segmented__btn--active");
            b2.setAttribute("aria-checked", "false");
          });
          segBtn.classList.add("segmented__btn--active");
          segBtn.setAttribute("aria-checked", "true");
          let typedValue = value;
          if (this._inputs[key]?.isToggle) {
            typedValue = value === "true" || value === true;
          }
          this.settings[key] = typedValue;
          const event = new CustomEvent("settings-change", {
            detail: { key, value: typedValue, settings: { ...this.settings } }
          });
          this.root.dispatchEvent(event);
        }
      }
    });
    const genBtn = this.root.querySelector('[data-action="generate"]');
    if (genBtn) {
      genBtn.addEventListener("click", () => {
        this.root.dispatchEvent(new CustomEvent("generate", {
          detail: { settings: { ...this.settings } }
        }));
      });
    }
    const stopBtn = this.root.querySelector('[data-action="stop"]');
    if (stopBtn) {
      stopBtn.addEventListener("click", () => {
        this.root.dispatchEvent(new CustomEvent("stop-generation"));
      });
    }
    const resetBtn = this.root.querySelector('[data-action="reset"]');
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        this.root.dispatchEvent(new CustomEvent("reset-canvas"));
      });
    }
  }
  /* ─── Public API ────────────────────────────────────────────── */
  /**
   * Sync internal settings to the UI controls.
   */
  _syncToUI() {
    this.root.querySelectorAll(".style-thumb").forEach((b2) => {
      b2.classList.toggle("style-thumb--active", b2.dataset.style === this.settings.style);
      b2.setAttribute("aria-selected", b2.dataset.style === this.settings.style ? "true" : "false");
    });
    if (this._styleTrigger) {
      const entry = getAllStyles().find((s2) => s2.name === this.settings.style);
      const triggerLabel = this._styleTrigger.querySelector(".style-picker__trigger-label");
      const triggerThumb = this._styleTrigger.querySelector(".style-picker__trigger-thumb");
      if (triggerLabel && entry) triggerLabel.textContent = entry.label;
      if (triggerThumb && entry && this._styleThumbs.has(entry.name)) {
        triggerThumb.style.backgroundImage = `url(${this._styleThumbs.get(entry.name)})`;
        triggerThumb.style.backgroundSize = "cover";
      }
    }
    for (const key of ["strokeSizeMin", "strokeSizeMax", "strokeCount", "detailLevel", "styleStrength", "opacity", "randomness", "scatter"]) {
      const entry = this._inputs[key];
      if (!entry) continue;
      let val;
      if (key === "strokeSizeMin") val = this.settings.strokeSize?.min || PAINTER_DEFAULT_SETTINGS.strokeSize.min;
      else if (key === "strokeSizeMax") val = this.settings.strokeSize?.max || PAINTER_DEFAULT_SETTINGS.strokeSize.max;
      else val = this.settings[key] !== void 0 ? this.settings[key] : PAINTER_DEFAULT_SETTINGS[key];
      entry.input.value = val;
      entry.valueSpan.textContent = this._formatSliderValue(entry.spec, val);
    }
    for (const key of ["smart", "oneLine"]) {
      const entry = this._inputs[key];
      if (!entry || !entry.isToggle) continue;
      const value = this.settings[key] !== void 0 ? this.settings[key] : PAINTER_DEFAULT_SETTINGS[key];
      const btn = entry.input;
      if (btn) {
        btn.classList.toggle("pill-toggle--on", !!value);
        btn.setAttribute("aria-checked", value ? "true" : "false");
      }
    }
    for (const key of ["order", "colorMode", "outline", "rfill", "multiLayer"]) {
      const entry = this._inputs[key];
      if (!entry) continue;
      const container = entry.segmented;
      const value = this.settings[key] || PAINTER_DEFAULT_SETTINGS[key];
      container.querySelectorAll(".segmented__btn").forEach((b2) => {
        const active = b2.dataset.value === value;
        b2.classList.toggle("segmented__btn--active", active);
        b2.setAttribute("aria-checked", active ? "true" : "false");
      });
    }
  }
  /**
   * Format a slider value for display.
   * @param {object} spec
   * @param {string|number} value
   * @returns {string}
   */
  _formatSliderValue(spec, value) {
    const v2 = parseFloat(value);
    if (spec.display === "percent") {
      return `${Math.round(v2 * 100)}%`;
    }
    if (spec.key === "strokeCount") {
      return Math.round(v2).toLocaleString();
    }
    return v2.toFixed(1);
  }
  /**
   * Get current settings.
   * @returns {object}
   */
  getSettings() {
    return { ...this.settings };
  }
  /**
   * Set settings externally and sync UI.
   * @param {object} settings
   */
  setSettings(settings) {
    Object.assign(this.settings, settings);
    this._syncToUI();
  }
  /**
   * Get the currently selected style name.
   * @returns {string}
   */
  getSelectedStyle() {
    return this.settings.style || "pencil";
  }
  /**
   * Destroy the controls manager.
   */
  destroy() {
    this.root.innerHTML = "";
  }
};

// js/ui/layers.js
var LayersManager = class {
  constructor(root) {
    if (!root) throw new Error("LayersManager requires a root element");
    this.root = root;
    this.layers = [];
    this._render();
    this._bindEvents();
  }
  /* ─── Rendering ─────────────────────────────────────────────── */
  /**
   * Build the layers panel structure.
   */
  _render() {
    this.root.classList.add("layers-panel");
    const chrome = Array.from(this.root.children).filter(
      (el) => el.classList.contains("panel-strip") || el.classList.contains("panel-head") || el.classList.contains("rail-icons")
    );
    this.root.innerHTML = "";
    for (const el of chrome) this.root.appendChild(el);
    const header = document.createElement("div");
    header.className = "layers-header";
    header.innerHTML = `
      <button type="button" class="btn btn--icon btn--sm" data-action="add-layer" aria-label="Add layer">
        <span aria-hidden="true">+</span>
      </button>
    `;
    const body = document.createElement("div");
    body.className = "layers-body";
    body.id = "layers-list";
    this.root.appendChild(header);
    this.root.appendChild(body);
  }
  /**
   * Re-render the layer list from this.layers.
   */
  _renderLayers() {
    const list = this.root.querySelector("#layers-list");
    if (!list) return;
    list.innerHTML = "";
    const displayOrder = [...this.layers].reverse();
    if (displayOrder.length === 0) {
      const placeholder = document.createElement("div");
      placeholder.className = "layers-placeholder";
      placeholder.textContent = "No layers";
      list.appendChild(placeholder);
      return;
    }
    for (const layer of displayOrder) {
      list.appendChild(this._renderLayerRow(layer));
    }
  }
  /**
   * Render a single layer row.
   * @param {object} layer
   * @returns {HTMLElement}
   */
  _renderLayerRow(layer) {
    const row = document.createElement("div");
    row.className = "layer-row";
    row.dataset.layerId = layer.id;
    if (layer.visible === false) {
      row.style.opacity = "0.5";
    }
    const isActive = this.layers.findIndex((l2) => l2.id === layer.id) === this.layers.length - 1;
    if (isActive) row.classList.add("layer-row--active");
    const mainRow = document.createElement("div");
    mainRow.className = "layer-row__main";
    const drag = document.createElement("div");
    drag.className = "layer-row__drag";
    drag.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="6" r="1"/><circle cx="16" cy="6" r="1"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/><circle cx="8" cy="18" r="1"/><circle cx="16" cy="18" r="1"/></svg>';
    drag.setAttribute("aria-hidden", "true");
    mainRow.appendChild(drag);
    const name = document.createElement("div");
    name.className = "layer-row__name";
    name.textContent = layer.name || "Layer";
    name.title = layer.name || "Layer";
    mainRow.appendChild(name);
    const visibilityBtn = document.createElement("button");
    visibilityBtn.type = "button";
    visibilityBtn.className = "layer-visibility-btn";
    visibilityBtn.dataset.action = "toggle-visibility";
    visibilityBtn.title = layer.visible === false ? "Show" : "Hide";
    visibilityBtn.textContent = "";
    visibilityBtn.innerHTML = layer.visible === false ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M8 12h8"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>';
    mainRow.appendChild(visibilityBtn);
    const actions = document.createElement("div");
    actions.className = "layer-row__actions";
    const dupBtn = document.createElement("button");
    dupBtn.type = "button";
    dupBtn.className = "layer-action-btn";
    dupBtn.dataset.action = "duplicate-layer";
    dupBtn.title = "Duplicate";
    dupBtn.textContent = "";
    dupBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 5v14M5 12h14"/></svg>';
    actions.appendChild(dupBtn);
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "layer-action-btn layer-action-btn--danger";
    delBtn.dataset.action = "delete-layer";
    delBtn.title = "Delete";
    delBtn.textContent = "";
    delBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    actions.appendChild(delBtn);
    mainRow.appendChild(actions);
    const opacityRow = document.createElement("div");
    opacityRow.className = "layer-opacity-row";
    const opacityLabel = document.createElement("label");
    opacityLabel.className = "layer-opacity-label";
    opacityLabel.textContent = "Op:";
    opacityRow.appendChild(opacityLabel);
    const opacityInput = document.createElement("input");
    opacityInput.type = "range";
    opacityInput.className = "layer-opacity-input";
    opacityInput.min = "0";
    opacityInput.max = "1";
    opacityInput.step = "0.05";
    opacityInput.value = layer.opacity !== void 0 ? layer.opacity : 1;
    opacityInput.dataset.action = "opacity-change";
    opacityRow.appendChild(opacityInput);
    const opacityValue = document.createElement("span");
    opacityValue.className = "layer-opacity-value";
    opacityValue.textContent = `${Math.round((layer.opacity || 1) * 100)}%`;
    opacityRow.appendChild(opacityValue);
    row.appendChild(mainRow);
    row.appendChild(opacityRow);
    return row;
  }
  /* ─── Events ────────────────────────────────────────────────── */
  /**
   * Bind event listeners.
   */
  _bindEvents() {
    const list = this.root.querySelector("#layers-list");
    if (!list) return;
    list.addEventListener("click", (e2) => {
      const btn = e2.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      const row = btn.closest(".layer-row");
      const layerId = row ? parseInt(row.dataset.layerId, 10) : null;
      switch (action) {
        case "toggle-visibility":
          this._emit("layer-toggle-visibility", { layerId });
          break;
        case "duplicate-layer":
          this._emit("layer-duplicate", { layerId });
          break;
        case "delete-layer":
          this._emit("layer-delete", { layerId });
          break;
      }
    });
    list.addEventListener("change", (e2) => {
      if (e2.target.classList.contains("layer-blend-select") || e2.target.dataset.action === "blend-change") {
        const row = e2.target.closest(".layer-row");
        const layerId = parseInt(row.dataset.layerId, 10);
        this._emit("layer-blend-change", { layerId, blendMode: e2.target.value });
      }
    });
    list.addEventListener("input", (e2) => {
      if (e2.target.classList.contains("layer-opacity-input")) {
        const row = e2.target.closest(".layer-row");
        const layerId = parseInt(row.dataset.layerId, 10);
        const opacity = parseFloat(e2.target.value);
        const valueSpan = row.querySelector(".layer-opacity-value");
        if (valueSpan) valueSpan.textContent = `${Math.round(opacity * 100)}%`;
        this._emit("layer-opacity-change", { layerId, opacity });
      }
    });
    const addBtn = this.root.querySelector('[data-action="add-layer"]');
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        this._emit("layer-add");
      });
    }
  }
  /**
   * Emit a custom event on the root element.
   * @param {string} type
   * @param {object} detail
   * @private
   */
  _emit(type, detail = {}) {
    this.root.dispatchEvent(new CustomEvent(type, { detail }));
  }
  /* ─── Public API ────────────────────────────────────────────── */
  /**
   * Set the layers data and re-render.
   * @param {Array<object>} layers
   */
  setLayers(layers) {
    this.layers = layers || [];
    this._renderLayers();
  }
  /**
   * Update the active layer highlight.
   * @param {number} layerId
   */
  setActiveLayer(layerId) {
    this.root.querySelectorAll(".layer-row").forEach((row) => {
      const id = parseInt(row.dataset.layerId, 10);
      row.classList.toggle("layer-row--active", id === layerId);
    });
  }
  /**
   * Destroy the layers manager.
   */
  destroy() {
    this.root.innerHTML = "";
  }
};

// js/ui/export.js
var ExportManager = class {
  constructor(root) {
    if (!root) throw new Error("ExportManager requires a root element");
    this.root = root;
    this.options = {
      width: 0,
      height: 0,
      format: "png",
      quality: 0.92,
      background: "#ffffff"
    };
    this._render();
    this._bindEvents();
  }
  /* ─── Rendering ─────────────────────────────────────────────── */
  /**
   * Build the export dialog DOM.
   */
  _render() {
    this.root.classList.add("export-dialog");
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-hidden", "true");
    this.root.innerHTML = "";
    const overlay = document.createElement("div");
    overlay.className = "export-dialog__overlay";
    overlay.setAttribute("role", "presentation");
    const dialog = document.createElement("div");
    dialog.className = "export-dialog__content";
    dialog.setAttribute("aria-labelledby", "export-title");
    dialog.setAttribute("aria-modal", "true");
    const header = document.createElement("div");
    header.className = "modal__header";
    header.innerHTML = `
      <h2 class="modal__title" id="export-title">Export</h2>
      <button type="button" class="btn btn--icon btn--sm btn--ghost" data-action="close" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    const body = document.createElement("div");
    body.className = "modal__body";
    body.innerHTML = `
      <div class="export-form">
        <div class="form-row">
          <label class="form-label" for="export-width">Width</label>
          <input type="number" id="export-width" class="form-input" data-export="width" min="100" placeholder="Auto"/>
        </div>
        <div class="form-row">
          <label class="form-label" for="export-height">Height</label>
          <input type="number" id="export-height" class="form-input" data-export="height" min="100" placeholder="Auto"/>
        </div>
        <div class="form-row">
          <label class="form-label" for="export-format">Format</label>
          <select id="export-format" class="form-select" data-export="format">
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
          </select>
        </div>
        <div class="form-row">
          <label class="form-label" for="export-quality">Quality</label>
          <input type="range" id="export-quality" class="form-range" data-export="quality" min="0.1" max="1" step="0.05" value="0.92"/>
          <span class="form-value" data-for="quality">92%</span>
        </div>
        <div class="form-row">
          <label class="form-label" for="export-background">Background</label>
          <input type="color" id="export-background" class="form-color" data-export="background" value="#ffffff"/>
        </div>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn--primary" data-action="export-image">
          Export Image
        </button>
        <button type="button" class="btn btn--ghost" data-action="export-layers">
          Export Layers
        </button>
        <button type="button" class="btn btn--ghost" data-action="export-html">
          Export HTML
        </button>
        <button type="button" class="btn btn--ghost" data-action="export-svg">
          Export SVG
        </button>
        <button type="button" class="btn btn--ghost" data-action="save-project">
          Save Project
        </button>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn--ghost" data-action="load-project">
          Load Project
        </button>
        <input type="file" class="file-input" data-action="load-project-file"
               accept=".json,application/json" style="display: none;" aria-label="Load project file"/>
      </div>
    `;
    const footer = document.createElement("div");
    footer.className = "modal__footer";
    footer.innerHTML = `
      <button type="button" class="btn btn--sm btn--ghost" data-action="close">
        Cancel
      </button>
    `;
    dialog.appendChild(header);
    dialog.appendChild(body);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    this.root.appendChild(overlay);
  }
  /* ─── Event Binding ─────────────────────────────────────────── */
  /**
   * Bind event listeners.
   */
  _bindEvents() {
    this.root.addEventListener("click", (e2) => {
      const btn = e2.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === "close") this.hide();
    });
    const overlay = this.root.querySelector(".export-dialog__overlay");
    if (overlay) {
      overlay.addEventListener("click", (e2) => {
        if (e2.target === overlay) this.hide();
      });
    }
    this._onKeyDown = (e2) => {
      if (e2.key === "Escape") this.hide();
    };
    document.addEventListener("keydown", this._onKeyDown);
    const formatSelect = this.root.querySelector('[data-export="format"]');
    if (formatSelect) {
      formatSelect.addEventListener("change", (e2) => {
        this.options.format = e2.target.value;
        this._updateQualityDisplay();
      });
    }
    this.root.addEventListener("input", (e2) => {
      const input = e2.target;
      const key = input.dataset.export;
      if (key) {
        const valueSpan = this.root.querySelector(`[data-for="${key}"]`);
        if (valueSpan) {
          if (key === "quality") {
            valueSpan.textContent = `${Math.round(input.value * 100)}%`;
          } else {
            valueSpan.textContent = input.value;
          }
        }
        this._collectOptions();
      }
    });
    this.root.addEventListener("change", (e2) => {
      const input = e2.target;
      const key = input.dataset.export;
      if (key) this._collectOptions();
    });
    const actions = {
      "export-image": () => this._emit("export-image", { ...this.options }),
      "export-html": () => this._emit("export-html", { ...this.options }),
      "export-svg": () => this._emit("export-svg", { ...this.options }),
      "save-project": () => this._emit("save-project", { ...this.options }),
      "load-project": () => this._emit("load-project", { ...this.options })
    };
    for (const [action, handler] of Object.entries(actions)) {
      const btn = this.root.querySelector(`[data-action="${action}"]`);
      if (btn) btn.addEventListener("click", handler);
    }
    const fileInput = this.root.querySelector('[data-action="load-project-file"]');
    if (fileInput) {
      fileInput.addEventListener("change", (e2) => {
        const file = e2.target.files?.[0];
        if (file) this._emit("load-project-file", { file });
        e2.target.value = "";
      });
    }
  }
  /* ─── Private Methods ───────────────────────────────────────── */
  /**
   * Collect current values from the form into this.options.
   * @private
   */
  _collectOptions() {
    const w2 = this.root.querySelector('[data-export="width"]');
    const h2 = this.root.querySelector('[data-export="height"]');
    const fmt = this.root.querySelector('[data-export="format"]');
    const q2 = this.root.querySelector('[data-export="quality"]');
    const bg = this.root.querySelector('[data-export="background"]');
    this.options.width = w2 && w2.value ? parseInt(w2.value, 10) : 0;
    this.options.height = h2 && h2.value ? parseInt(h2.value, 10) : 0;
    this.options.format = fmt ? fmt.value : "png";
    this.options.quality = q2 ? parseFloat(q2.value) : 0.92;
    this.options.background = bg ? bg.value : "#ffffff";
  }
  /**
   * Update the quality display value.
   * @private
   */
  _updateQualityDisplay() {
    const span = this.root.querySelector('[data-for="quality"]');
    const input = this.root.querySelector('[data-export="quality"]');
    if (span && input) {
      span.textContent = `${Math.round(input.value * 100)}%`;
    }
  }
  /**
   * Emit a custom event.
   * @param {string} type
   * @param {object} detail
   * @private
   */
  _emit(type, detail = {}) {
    this.root.dispatchEvent(new CustomEvent(type, { detail }));
  }
  /* ─── Public API ────────────────────────────────────────────── */
  /**
   * Show the export dialog.
   * @param {object} [opts] — initial options to populate.
   */
  show(opts = {}) {
    const w2 = this.root.querySelector('[data-export="width"]');
    const h2 = this.root.querySelector('[data-export="height"]');
    const fmt = this.root.querySelector('[data-export="format"]');
    const q2 = this.root.querySelector('[data-export="quality"]');
    const bg = this.root.querySelector('[data-export="background"]');
    if (opts.width && w2) w2.value = opts.width;
    if (opts.height && h2) h2.value = opts.height;
    if (opts.format && fmt) fmt.value = opts.format;
    if (opts.quality && q2) q2.value = opts.quality;
    if (opts.background && bg) bg.value = opts.background;
    this._collectOptions();
    this._updateQualityDisplay();
    this.root.classList.add("modal--open");
    this.root.setAttribute("aria-hidden", "false");
    const firstInput = this.root.querySelector('[data-export="width"]');
    if (firstInput) firstInput.focus();
  }
  /**
   * Hide the export dialog.
   */
  hide() {
    this.root.classList.remove("modal--open");
    this.root.setAttribute("aria-hidden", "true");
    this._collectOptions();
  }
  /**
   * Check if the dialog is open.
   * @returns {boolean}
   */
  isOpen() {
    return this.root.classList.contains("modal--open");
  }
  /**
   * Destroy the export manager.
   */
  destroy() {
    document.removeEventListener("keydown", this._onKeyDown);
    this.root.innerHTML = "";
  }
};

// js/ui/motion.js
var SPEED_PRESETS = [
  { value: 0.25, label: "0.25x" },
  { value: 0.5, label: "0.5x" },
  { value: 1, label: "1x" },
  { value: 2, label: "2x" },
  { value: 4, label: "4x" }
];
var DEFAULT_DURATION = 2e3;
var SCRUB_FRAMES = 500;
var MotionController = class {
  constructor({ canvasMgr, container }) {
    if (!canvasMgr) throw new Error("MotionController requires a canvasMgr");
    if (!container) throw new Error("MotionController requires a container element");
    this.canvasMgr = canvasMgr;
    this.container = container;
    this.progress = 0;
    this.speed = 1;
    this.isPlaying = false;
    this._rafId = null;
    this._lastTime = null;
    this._scrubbing = false;
    this._duration = DEFAULT_DURATION;
    this._totalStrokes = 0;
    this._render();
    this._bindEvents();
    this._updateUI();
  }
  /* ─── Rendering ─────────────────────────────────────────────── */
  /**
   * Build the motion control bar DOM.
   * @private
   */
  _render() {
    this.container.classList.add("motion-controls");
    this.container.innerHTML = "";
    const bar = document.createElement("div");
    bar.className = "motion-bar";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Painting playback controls");
    const playGroup = document.createElement("div");
    playGroup.className = "motion-btn-group";
    playGroup.setAttribute("role", "group");
    playGroup.setAttribute("aria-label", "Playback controls");
    this._playBtn = this._makeButton("play", "play", "Play (Space)");
    this._pauseBtn = this._makeButton("pause", "pause", "Pause (Space)");
    this._stopBtn = this._makeButton("stop", "stop", "Stop (S)");
    this._stepBackBtn = this._makeButton("step-back", "step-back", "Step backward");
    this._stepForwardBtn = this._makeButton("step-forward", "step-forward", "Step forward");
    this._pauseBtn.classList.add("hidden");
    playGroup.append(
      this._stepBackBtn,
      this._playBtn,
      this._pauseBtn,
      this._stopBtn,
      this._stepForwardBtn
    );
    bar.appendChild(playGroup);
    const scrubWrap = document.createElement("div");
    scrubWrap.className = "motion-scrubber-wrap";
    this._progressFill = document.createElement("div");
    this._progressFill.className = "motion-progress-fill";
    this._scrubber = document.createElement("input");
    this._scrubber.type = "range";
    this._scrubber.className = "motion-scrubber";
    this._scrubber.min = "0";
    this._scrubber.max = String(SCRUB_FRAMES);
    this._scrubber.value = "0";
    this._scrubber.setAttribute("aria-label", "Painting progress");
    this._scrubber.setAttribute("step", "1");
    scrubWrap.appendChild(this._progressFill);
    scrubWrap.appendChild(this._scrubber);
    bar.appendChild(scrubWrap);
    const speedGroup = document.createElement("div");
    speedGroup.className = "motion-speed";
    const speedLabel = document.createElement("span");
    speedLabel.className = "motion-speed-label";
    speedLabel.textContent = "Speed";
    speedLabel.setAttribute("for", "motion-speed-select");
    this._speedSelect = document.createElement("select");
    this._speedSelect.id = "motion-speed-select";
    this._speedSelect.setAttribute("aria-label", "Playback speed");
    for (const preset of SPEED_PRESETS) {
      const opt = document.createElement("option");
      opt.value = String(preset.value);
      opt.textContent = preset.label;
      opt.selected = preset.value === this.speed;
      this._speedSelect.appendChild(opt);
    }
    speedGroup.append(speedLabel, this._speedSelect);
    bar.appendChild(speedGroup);
    const counter = document.createElement("div");
    counter.className = "motion-counter";
    this._counterText = document.createElement("span");
    this._counterText.className = "motion-counter__text";
    counter.appendChild(this._counterText);
    bar.appendChild(counter);
    this.container.appendChild(bar);
  }
  /**
   * Create a button element.
   * @param {string} action — data-action value
   * @param {string} text — visible + aria text
   * @param {string} title — tooltip
   * @returns {HTMLButtonElement}
   * @private
   */
  _makeButton(action, iconName, title) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "motion-btn";
    btn.dataset.action = action;
    btn.dataset.icon = iconName;
    btn.setAttribute("aria-label", title);
    btn.setAttribute("title", title);
    btn.innerHTML = this._iconSVG(iconName);
    btn.classList.add("motion-btn--icon");
    return btn;
  }
  /**
   * Return inline SVG markup for a motion control icon.
   * @param {string} name — one of: play, pause, stop, step-back, step-forward
   * @returns {string} SVG HTML
   * @private
   */
  _iconSVG(name) {
    const icons = {
      play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 19h14L5 12V19Zm0 0V5v14"/></svg>',
      pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="5" height="14"/><rect x="13" y="5" width="5" height="14"/></svg>',
      stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14"/></svg>',
      "step-back": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="19" x2="13" y2="12"/><line x1="13" y1="12" x2="19" y2="5"/></svg>',
      "step-forward": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="5" x2="11" y2="12"/><line x1="11" y1="12" x2="5" y2="19"/></svg>'
    };
    return icons[name] || "";
  }
  /* ─── Events ────────────────────────────────────────────────── */
  /**
   * Bind all event listeners.
   * @private
   */
  _bindEvents() {
    this._playBtn?.addEventListener("click", () => this.play());
    this._pauseBtn?.addEventListener("click", () => this.pause());
    this._stopBtn?.addEventListener("click", () => this.stop());
    this._stepForwardBtn?.addEventListener("click", () => this.stepForward());
    this._stepBackBtn?.addEventListener("click", () => this.stepBackward());
    this._speedSelect?.addEventListener("change", (e2) => {
      this.setSpeed(parseFloat(e2.target.value));
    });
    this._scrubber?.addEventListener("input", (e2) => {
      if (this._scrubbing) return;
      const raw = parseFloat(e2.target.value);
      const p2 = raw / SCRUB_FRAMES;
      this._scrubbing = true;
      this._setProgress(p2, true);
      this._scrubbing = false;
      this._updateUI();
    });
    let isDown = false;
    const scrub = this._scrubber;
    if (scrub) {
      scrub.addEventListener("pointerdown", () => {
        isDown = true;
        this._scrubbing = true;
      });
      scrub.addEventListener("pointermove", () => {
        if (!isDown) return;
        const raw = parseFloat(scrub.value);
        const p2 = raw / SCRUB_FRAMES;
        this._setProgress(p2, true);
        this._updateUI();
      });
      const endScrub = () => {
        isDown = false;
        this._scrubbing = false;
        this._updateUI();
      };
      scrub.addEventListener("pointerup", endScrub);
      scrub.addEventListener("pointercancel", endScrub);
      scrub.addEventListener("pointerleave", () => {
        if (isDown) endScrub();
      });
    }
    this._onKeyDown = (e2) => {
      const tag = e2.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e2.target.isContentEditable) return;
      switch (e2.key) {
        case " ":
          e2.preventDefault();
          this._togglePlay();
          break;
        case "s":
        case "S":
          e2.preventDefault();
          this.stop();
          break;
        case "ArrowLeft":
          e2.preventDefault();
          this.stepBackward();
          break;
        case "ArrowRight":
          e2.preventDefault();
          this.stepForward();
          break;
      }
    };
    document.addEventListener("keydown", this._onKeyDown);
  }
  /* ─── Playback API ──────────────────────────────────────────── */
  /**
   * Start (or resume) the animation from the current progress.
   */
  play() {
    if (this.progress >= 1) {
      this._reset();
    }
    if (this.isPlaying) return;
    this.isPlaying = true;
    this._pauseBtn.classList.remove("hidden");
    this._playBtn.classList.add("hidden");
    const effectiveDuration = this._duration / this.speed;
    this._lastTime = null;
    const loop = (now) => {
      if (this._lastTime === null) this._lastTime = now;
      const delta = now - this._lastTime;
      const fraction = delta / effectiveDuration;
      this.progress = Math.min(1, this.progress + fraction);
      this._renderProgress(this.progress);
      this._updateUI();
      if (this.progress < 1 && this.isPlaying) {
        this._lastTime = now;
        this._rafId = requestAnimationFrame(loop);
      } else {
        this.progress = 1;
        this._renderProgress(1);
        this._updateUI();
        this._onFinish();
      }
    };
    this._rafId = requestAnimationFrame(loop);
    this._dispatchEvent("play");
  }
  /**
   * Pause the animation.
   */
  pause() {
    this.isPlaying = false;
    this._pauseBtn.classList.add("hidden");
    this._playBtn.classList.remove("hidden");
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._lastTime = null;
    this._updateUI();
    this._dispatchEvent("pause");
  }
  /**
   * Stop the animation and reset to the beginning.
   */
  stop() {
    this.pause();
    this._reset();
    this._renderProgress(0);
    this._updateUI();
    this._dispatchEvent("stop");
  }
  /**
   * Toggle play / pause.
   * @private
   */
  _togglePlay() {
    if (this.isPlaying) this.pause();
    else this.play();
  }
  /**
   * Step forward by a small increment (single frame).
   */
  stepForward() {
    if (this.isPlaying) return;
    const step = 1 / SCRUB_FRAMES;
    this._setProgress(Math.min(1, this.progress + step), true);
    this._updateUI();
    this._dispatchEvent("step-forward");
  }
  /**
   * Step backward by a small increment (single frame).
   */
  stepBackward() {
    if (this.isPlaying) return;
    const step = 1 / SCRUB_FRAMES;
    this._setProgress(Math.max(0, this.progress - step), true);
    this._updateUI();
    this._dispatchEvent("step-backward");
  }
  /**
   * Set playback speed and recompute duration.
   * @param {number} speed — multiplier
   */
  setSpeed(speed) {
    this.speed = speed;
    this._duration = DEFAULT_DURATION / speed;
    if (this._speedSelect) {
      const opts = this._speedSelect.querySelectorAll("option");
      opts.forEach((o2) => {
        o2.selected = parseFloat(o2.value) === speed;
      });
    }
    this._dispatchEvent("speed-change", { speed });
  }
  /**
   * Render the canvas at a given progress and refresh the stroke counter.
   * @param {number} progress — 0 to 1
   * @private
   */
  _renderProgress(progress) {
    this.canvasMgr.render({ progress });
    this._refreshStrokeCount();
  }
  /**
   * Seek to a specific progress without playing.
   * @param {number} progress — 0 to 1
   */
  seekTo(progress) {
    this._scrubbing = true;
    this._setProgress(progress, true);
    this._scrubbing = false;
    this._updateUI();
    this._dispatchEvent("seek", { progress });
  }
  /**
   * Set whether the controller is enabled (e.g. disable during generation).
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.container.classList.toggle("disabled", !enabled);
    this._playBtn.disabled = !enabled;
    this._pauseBtn.disabled = !enabled;
    this._stopBtn.disabled = !enabled;
    this._stepForwardBtn.disabled = !enabled;
    this._stepBackBtn.disabled = !enabled;
    this._scrubber.disabled = !enabled;
    this._speedSelect.disabled = !enabled;
  }
  /**
   * Refresh the cached total stroke count from the canvas manager's renderer.
   * Call this after generation completes to update the frame counter.
   */
  refreshStrokeCount() {
    this._refreshStrokeCount();
    this._updateUI();
  }
  /**
   * Recompute the total stroke count from the renderer's layer list.
   * @private
   */
  _refreshStrokeCount() {
    const layers = this.canvasMgr.renderer?._layers;
    if (layers) {
      this._totalStrokes = layers.reduce(
        (sum, l2) => sum + (l2.strokes?.length || 0),
        0
      );
    }
  }
  /**
   * Set progress internally during scrubbing (render live if not scrubbing).
   * @param {number} progress — 0 to 1
   * @param {boolean} live — render immediately
   * @private
   */
  _setProgress(progress, live) {
    this.progress = progress;
    if (live) {
      this._renderProgress(progress);
    }
  }
  /**
   * Reset internal state to beginning (without rendering).
   * @private
   */
  _reset() {
    this.isPlaying = false;
    this.progress = 0;
    this._pauseBtn.classList.add("hidden");
    this._playBtn.classList.remove("hidden");
    this._lastTime = null;
  }
  /**
   * Called when animation reaches 100%.
   * @private
   */
  _onFinish() {
    this.pause();
    this._dispatchEvent("finish");
  }
  /**
   * Destroy the controller — cancels animations, removes DOM and listeners.
   */
  destroy() {
    this.pause();
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    document.removeEventListener("keydown", this._onKeyDown);
    this.container.innerHTML = "";
  }
  /* ─── Internal: UI updates ──────────────────────────────────── */
  /**
   * Update all UI elements to reflect current state.
   * @private
   */
  _updateUI() {
    if (this._scrubber) {
      const raw = Math.round(this.progress * SCRUB_FRAMES);
      this._scrubber.value = String(raw);
    }
    if (this._progressFill) {
      this._progressFill.style.width = `${this.progress * 100}%`;
    }
    if (this.isPlaying) {
      this._pauseBtn.classList.remove("hidden");
      this._playBtn.classList.add("hidden");
    } else {
      this._pauseBtn.classList.add("hidden");
      this._playBtn.classList.remove("hidden");
    }
    const pct = Math.round(this.progress * 100);
    const visible = Math.ceil(this._totalStrokes * this.progress);
    if (this._counterText) {
      this._counterText.textContent = `${pct}% \xB7 ${visible.toLocaleString()}/${this._totalStrokes.toLocaleString()} strokes`;
    }
  }
  /**
   * Dispatch a custom event on the container.
   * @param {string} type
   * @param {object} [detail]
   * @private
   */
  _dispatchEvent(type, detail = {}) {
    this.container.dispatchEvent(new CustomEvent(`motion-${type}`, {
      detail: {
        ...detail,
        progress: this.progress,
        isPlaying: this.isPlaying,
        speed: this.speed
      }
    }));
  }
};

// js/engine/paint-brush.js
var PaintBrushEngine = class {
  /**
   * @param {object} opts
   * @param {object} [opts.renderer]  — The app's Renderer instance.
   * @param {number} [opts.width=1024]  — Painting dimensions in CSS px.
   * @param {number} [opts.height=768]  — Painting dimensions in CSS px.
   */
  constructor({ renderer = null, width = 1024, height = 768 } = {}) {
    if (typeof document === "undefined") {
      throw new Error("PaintBrushEngine requires a browser environment (document)");
    }
    this.renderer = renderer;
    this.width = width;
    this.height = height;
    this.surfaces = /* @__PURE__ */ new Map();
    this._active = null;
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Surface management
  // ─────────────────────────────────────────────────────────────────────────
  getSurface(layerId) {
    let surface = this.surfaces.get(layerId);
    if (!surface) {
      const canvas = document.createElement("canvas");
      canvas.width = this.width;
      canvas.height = this.height;
      const ctx = canvas.getContext("2d");
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      surface = { canvas, ctx };
      this.surfaces.set(layerId, surface);
    }
    return surface;
  }
  hasSurface(layerId) {
    return this.surfaces.has(layerId);
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Stroking
  // ─────────────────────────────────────────────────────────────────────────
  beginStroke(layerId, { x: x2, y: y2, color = "#222222", weight = 1, brushName = "HB" }) {
    const surface = this.getSurface(layerId);
    const ctx = surface.ctx;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = weight;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 0.85;
    ctx.globalCompositeOperation = "source-over";
    ctx.beginPath();
    ctx.arc(x2, y2, weight / 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    this._active = { layerId, x: x2, y: y2, color, weight, ctx };
  }
  moveStroke(x2, y2) {
    if (!this._active) return;
    const length = Math.hypot(x2 - this._active.x, y2 - this._active.y);
    if (length < 0.5) return;
    const ctx = this._active.ctx;
    ctx.lineTo(x2, y2);
    ctx.stroke();
    this._active.x = x2;
    this._active.y = y2;
  }
  endStroke(x2, y2) {
    if (!this._active) return;
    const length = Math.hypot(x2 - this._active.x, y2 - this._active.y);
    if (length >= 0.5) {
      this._active.ctx.lineTo(x2, y2);
      this._active.ctx.stroke();
    }
    this._active.ctx.restore();
    this._active = null;
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Compositing & lifecycle
  // ─────────────────────────────────────────────────────────────────────────
  renderLayer(layer, progress = 1, ctx) {
    if (!layer.visible) return;
    if (!ctx) return;
    const surface = this.surfaces.get(layer.id);
    if (!surface) return;
    ctx.save();
    ctx.globalAlpha = layer.opacity !== void 0 ? layer.opacity : 1;
    if (layer.blendMode && layer.blendMode !== "normal") {
      ctx.globalCompositeOperation = layer.blendMode;
    }
    ctx.drawImage(surface.canvas, 0, 0);
    ctx.restore();
  }
  clearLayer(layerId) {
    const surface = this.surfaces.get(layerId);
    if (!surface) return;
    surface.ctx.clearRect(0, 0, this.width, this.height);
  }
  removeLayer(layerId) {
    const surface = this.surfaces.get(layerId);
    if (surface && surface.canvas.parentNode) {
      surface.canvas.parentNode.removeChild(surface.canvas);
    }
    this.surfaces.delete(layerId);
  }
  exportLayer(layerId) {
    const surface = this.surfaces.get(layerId);
    return surface ? surface.canvas : null;
  }
  resize(width, height) {
    if (this.surfaces.size > 0) {
      console.warn(`[PaintBrushEngine] resize() will lose all existing brush content on ${this.surfaces.size} layer(s).`);
    }
    this.width = width;
    this.height = height;
    for (const [layerId, surface] of this.surfaces) {
      surface.canvas.width = width;
      surface.canvas.height = height;
      surface.ctx.lineCap = "round";
      surface.ctx.lineJoin = "round";
    }
  }
};

// js/ui/app.js
var App = class {
  constructor(opts = {}) {
    if (!opts.canvas) throw new Error("App requires a canvas element");
    if (!opts.controlsRoot) throw new Error("App requires a controls root");
    if (!opts.layersRoot) throw new Error("App requires a layers root");
    if (!opts.exportRoot) throw new Error("App requires an export root");
    this.canvasEl = opts.canvas;
    this.controlsRoot = opts.controlsRoot;
    this.layersRoot = opts.layersRoot;
    this.exportRoot = opts.exportRoot;
    this.statusBar = opts.statusBar || null;
    this.engine = null;
    this.canvasMgr = null;
    this.controls = null;
    this.layers = null;
    this.exportMgr = null;
    this._generating = false;
    this._statusTimeout = null;
    this._init();
    window.__app = this;
  }
  /* ─── Initialization ────────────────────────────────────────── */
  /**
   * Initialize all managers and bind cross-module events.
   * @private
   */
  _init() {
    this._background = getComputedStyle(document.documentElement).getPropertyValue("--editor-bg").trim() || "#121212";
    this.canvasMgr = new CanvasManager(this.canvasEl, {
      dpr: window.devicePixelRatio || 1,
      background: this._background
    });
    this.engine = new PaintingEngine({
      canvas: this.canvasEl,
      width: this.canvasEl.width,
      height: this.canvasEl.height,
      useWorker: true,
      background: this._background
    });
    this.engine.renderer = this.canvasMgr.renderer;
    this.engine._registerAllStyles();
    this.controls = new ControlsManager(this.controlsRoot, {
      initialSettings: this.engine.settings
    });
    this.layers = new LayersManager(this.layersRoot);
    this.exportMgr = new ExportManager(this.exportRoot);
    const motionContainer = document.getElementById("motion-controls") || null;
    if (motionContainer) {
      this.motion = new MotionController({
        canvasMgr: this.canvasMgr,
        container: motionContainer
      });
    }
    this.paintBrush = new PaintBrushEngine({
      renderer: this.engine.renderer,
      width: this.canvasEl.width,
      height: this.canvasEl.height
    });
    this.engine.renderer._paintSurfaceProvider = (layerId) => {
      return this.paintBrush.exportLayer(layerId);
    };
    initBrushEngine(this.canvasEl.width, this.canvasEl.height).catch((err) => console.warn("[app] p5.brush init failed, using fallback renderers:", err));
    this.engine.renderer.setLayers(this.engine.layers);
    this._paintMode = false;
    this._painting = false;
    this._brushPreset = "HB";
    this._brushColor = "#222222";
    this._brushWeight = 1;
    this._bindAllEvents();
    this._setupDragDrop();
    this._bindCollapseControls();
    this._updateStatus();
    this._syncCanvasHeader();
    if (window.__DebugOverlay) {
      window.__DebugOverlay.init();
    }
    if (window.__UISettings) {
      window.__UISettings.init();
    }
  }
  /**
   * Bind all cross-module event listeners.
   * @private
   */
  _bindAllEvents() {
    this.controls.root.addEventListener("settings-change", (e2) => {
      this._onSettingsChange(e2.detail);
    });
    this.controls.root.addEventListener("generate", () => {
      this.generate();
    });
    this.controls.root.addEventListener("stop-generation", () => {
      this.stopGeneration();
    });
    this.controls.root.addEventListener("reset-canvas", () => {
      this.resetCanvas();
    });
    this.layers.root.addEventListener("layer-add", () => {
      const layer = this.engine.addLayer();
      this.layers.setLayers(this.engine.layers);
    });
    this.layers.root.addEventListener("layer-delete", (e2) => {
      this.engine.removeLayer(e2.detail.layerId);
      this.layers.setLayers(this.engine.layers);
      this.engine.render();
    });
    this.layers.root.addEventListener("layer-duplicate", (e2) => {
      this.engine.duplicateLayer(e2.detail.layerId);
      this.layers.setLayers(this.engine.layers);
      this.engine.render();
    });
    this.layers.root.addEventListener("layer-toggle-visibility", (e2) => {
      const layer = this.engine.getLayer(e2.detail.layerId);
      if (layer) {
        layer.visible = !layer.visible;
        this.engine.renderer.setLayers(this.engine.layers);
        this.engine.render();
      }
    });
    this.layers.root.addEventListener("layer-opacity-change", (e2) => {
      const layer = this.engine.getLayer(e2.detail.layerId);
      if (layer) {
        layer.opacity = e2.detail.opacity;
        this.engine.render();
      }
    });
    this.layers.root.addEventListener("layer-blend-change", (e2) => {
      const layer = this.engine.getLayer(e2.detail.layerId);
      if (layer) {
        layer.blendMode = e2.detail.blendMode;
        this.engine.render();
      }
    });
    this.exportMgr.root.addEventListener("export-image", (e2) => {
      this._handleExportImage(e2.detail);
    });
    this.exportMgr.root.addEventListener("export-layers", (e2) => {
      this._handleExportLayers(e2.detail);
    });
    this.exportMgr.root.addEventListener("export-html", () => {
      this._handleExportHTML();
    });
    this.exportMgr.root.addEventListener("export-svg", () => {
      this._handleExportSVG();
    });
    this.exportMgr.root.addEventListener("save-project", () => {
      this._handleSaveProject();
    });
    this.exportMgr.root.addEventListener("load-project", () => {
      this._handleLoadProjectClick();
    });
    this.exportMgr.root.addEventListener("load-project-file", (e2) => {
      this._handleLoadProjectFile(e2.detail.file);
    });
    const paintToggle = document.getElementById("btn-paint-mode");
    if (paintToggle) {
      paintToggle.addEventListener("click", () => {
        this._togglePaintMode();
      });
    }
    const presetSelect = document.getElementById("paint-preset");
    if (presetSelect) {
      presetSelect.addEventListener("change", () => {
        this._brushPreset = presetSelect.value;
        this._updatePaintStatus();
      });
    }
    const colorInput = document.getElementById("paint-color");
    if (colorInput) {
      colorInput.addEventListener("input", () => {
        this._brushColor = colorInput.value;
        this._updatePaintStatus();
      });
    }
    const weightInput = document.getElementById("paint-weight");
    if (weightInput) {
      weightInput.addEventListener("input", () => {
        this._brushWeight = parseFloat(weightInput.value);
        this._updatePaintStatus();
      });
    }
    const clearBtn = document.getElementById("paint-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        this._clearPaintLayer();
      });
    }
    this._bindPaintEvents();
  }
  /**
   * Bind mouse/touch events on the canvas for freehand painting in Paint mode.
   * @private
   */
  _bindPaintEvents() {
    const canvas = this.canvasEl;
    if (!canvas) return;
    const handleDown = (e2) => {
      if (!this._paintMode) return;
      e2.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x2 = (e2.clientX - rect.left) * (this.engine.renderer.width / rect.width);
      const y2 = (e2.clientY - rect.top) * (this.engine.renderer.height / rect.height);
      const layer = this.engine.getActiveLayer() || this.engine.layers[0];
      if (!layer) return;
      this._painting = true;
      this.paintBrush.beginStroke(layer.id, {
        x: x2,
        y: y2,
        brushName: this._brushPreset,
        color: this._brushColor,
        weight: this._brushWeight
      });
    };
    const handleMove = (e2) => {
      if (!this._paintMode || !this._painting) return;
      e2.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x2 = (e2.clientX - rect.left) * (this.engine.renderer.width / rect.width);
      const y2 = (e2.clientY - rect.top) * (this.engine.renderer.height / rect.height);
      this.paintBrush.moveStroke(x2, y2);
    };
    const handleUp = (e2) => {
      if (!this._paintMode || !this._painting) return;
      e2.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x2 = (e2.clientX - rect.left) * (this.engine.renderer.width / rect.width);
      const y2 = (e2.clientY - rect.top) * (this.engine.renderer.height / rect.height);
      this.paintBrush.endStroke(x2, y2);
      this._painting = false;
      const layer = this.engine.getActiveLayer() || this.engine.layers[0];
      if (layer) {
        this.paintBrush.renderLayer(layer, 1, this.canvasMgr.ctx);
      }
      const placeholder = document.getElementById("canvas-placeholder");
      if (placeholder) placeholder.style.display = "none";
    };
    const handleLeave = () => {
      if (this._painting) {
        this._painting = false;
      }
    };
    canvas.addEventListener("mousedown", handleDown);
    canvas.addEventListener("mousemove", handleMove);
    canvas.addEventListener("mouseup", handleUp);
    canvas.addEventListener("mouseleave", handleLeave);
    canvas.addEventListener("mouseout", handleLeave);
    canvas.addEventListener("touchstart", handleDown, { passive: false });
    canvas.addEventListener("touchmove", handleMove, { passive: false });
    canvas.addEventListener("touchend", (e2) => {
      if (!this._paintMode || !this._painting) return;
      e2.preventDefault();
      const touch = e2.touches[0] || e2.changedTouches[0];
      if (!touch) {
        this._painting = false;
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const x2 = (touch.clientX - rect.left) * (this.engine.renderer.width / rect.width);
      const y2 = (touch.clientY - rect.top) * (this.engine.renderer.height / rect.height);
      this.paintBrush.endStroke(x2, y2);
      this._painting = false;
      const layer = this.engine.getActiveLayer() || this.engine.layers[0];
      if (layer) {
        this.paintBrush.renderLayer(layer, 1, this.canvasMgr.ctx);
      }
      const placeholder = document.getElementById("canvas-placeholder");
      if (placeholder) placeholder.style.display = "none";
    }, { passive: false });
    canvas.addEventListener("touchcancel", handleLeave);
    this._paintHandlers = {
      handleDown,
      handleMove,
      handleUp,
      handleLeave,
      touchEnd: canvas.addEventListener
      // placeholder, actual cleanup in destroy
    };
  }
  /**
   * Toggle between Generate mode and Paint mode.
   *
   * Paint mode swaps the LEFT panel's contents rather than adding a surface: the
   * shell keeps exactly two side panels, and the canvas window stays where it is.
   * @private
   */
  _togglePaintMode() {
    this._paintMode = !this._paintMode;
    const btn = document.getElementById("btn-paint-mode");
    if (btn) {
      btn.classList.toggle("nav-btn--active", this._paintMode);
    }
    const controlsPanel = document.getElementById("controls-root");
    const toolbar = document.getElementById("paint-toolbar");
    if (controlsPanel) controlsPanel.classList.toggle("panel--hidden", this._paintMode);
    if (toolbar) toolbar.classList.toggle("paint-toolbar--active", this._paintMode);
    const modeEl = document.getElementById("canvas-mode");
    if (modeEl) modeEl.textContent = this._paintMode ? "Paint" : "Generate";
    const placeholder = document.getElementById("canvas-placeholder");
    if (placeholder) {
      placeholder.style.display = this._paintMode ? "none" : "";
    }
    this._setStatus(
      this._paintMode ? "Paint mode \u2014 freehand on active layer" : "Generate mode",
      false,
      this._paintMode ? 0 : 2e3
    );
  }
  /**
   * Update the status bar with current brush info.
   * @private
   */
  _updatePaintStatus() {
    if (this._paintMode) {
      this._setStatus(
        `Brush: ${this._brushPreset} | Color: ${this._brushColor} | Weight: ${this._brushWeight}`,
        false,
        0
      );
    }
  }
  /**
   * Wire the per-panel collapse chevrons.
   *
   * Collapsing a panel turns it into a thin black icon rail and widens the canvas
   * window to reclaim the space. The chevron lives in each panel header.
   * @private
   */
  _bindCollapseControls() {
    document.querySelectorAll(".collapse-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const panel = btn.closest(".panel");
        if (!panel) return;
        this._setPanelCollapsed(panel, !panel.classList.contains("is-collapsed"));
      });
    });
  }
  /**
   * Collapse or expand one side panel and move the canvas window with it.
   *
   * Desktop: collapse to the icon rail and widen the window.
   * Mobile: the panels are overlays, so "collapse" slides the panel off-screen
   * instead — the canvas is already full-bleed there.
   * @param {HTMLElement} panel
   * @param {boolean} collapsed
   * @private
   */
  _setPanelCollapsed(panel, collapsed) {
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    if (mobile) {
      panel.classList.toggle("panel--mobile-closed", collapsed);
      const toggle = panel.querySelector(".mobile-toggle");
      if (toggle) {
        toggle.setAttribute("aria-expanded", String(!collapsed));
        toggle.classList.toggle("mobile-toggle--active", !collapsed);
      }
      return;
    }
    panel.classList.toggle("is-collapsed", collapsed);
    const canvasWindow = document.getElementById("canvas-area");
    if (!canvasWindow) return;
    if (panel.classList.contains("panel--controls") || panel.id === "paint-toolbar") {
      canvasWindow.classList.toggle("nav-left", collapsed);
    } else {
      canvasWindow.classList.toggle("nav-right", collapsed);
    }
    panel.querySelectorAll(".collapse-btn").forEach((b2) => {
      b2.setAttribute("aria-expanded", String(!collapsed));
      b2.setAttribute("title", collapsed ? "Expand panel" : "Collapse panel");
    });
  }
  /**
   * Keep the canvas header's dimensions in step with the loaded image.
   * @private
   */
  _syncCanvasHeader() {
    const dims = document.getElementById("canvas-dims");
    if (dims && this.engine) {
      dims.textContent = `${this.engine.width} \xD7 ${this.engine.height}`;
    }
  }
  /**
   * Clear the active layer's brush surface.
   * @private
   */
  _clearPaintLayer() {
    const layer = this.engine.getActiveLayer() || this.engine.layers[0];
    if (layer) {
      this.paintBrush.clearLayer(layer.id);
      this.paintBrush.renderLayer(layer, 1, this.canvasMgr.ctx);
      this._setStatus("Paint layer cleared", false, 2e3);
      const placeholder = document.getElementById("canvas-placeholder");
      if (placeholder) placeholder.style.display = "";
    }
  }
  /* ─── Drag and Drop ────────────────────────────────────────────── */
  /**
   * Load an image file into the engine and bring the whole shell up to date.
   *
   * The single implementation behind every load path (Open button, drag-and-drop,
   * click-to-pick) — there used to be three copies, and they drifted: one resized
   * only the renderer and left the canvas and the header stale.
   * @param {File} file
   * @private
   */
  async loadImageFile(file) {
    this._setStatus("Loading image...", true);
    await this.engine.loadImageFile(file);
    this.canvasMgr.setSize(this.engine.width, this.engine.height);
    this.paintBrush.resize(this.engine.width, this.engine.height);
    this._updateStatus();
    const placeholder = document.getElementById("canvas-placeholder");
    if (placeholder) placeholder.style.display = "none";
    this.engine.render();
    this._syncCanvasHeader();
  }
  /**
   * Set up drag-and-drop image upload on the canvas area.
   * @private
   */
  _setupDragDrop() {
    const dropZone = document.getElementById("canvas-area");
    if (!dropZone) return;
    const handlers = this.canvasMgr.setupDropZone(dropZone, async (file) => {
      if (!file.type.startsWith("image/")) {
        this._showError("Please drop an image file (PNG, JPG, etc.)");
        return;
      }
      try {
        await this.loadImageFile(file);
      } catch (err) {
        console.error(err);
        this._showError("Failed to load image: " + err.message);
      }
    });
    const picker = dropZone.querySelector(".file-input-picker");
    if (picker) {
      picker.addEventListener("change", async (e2) => {
        const file = e2.target.files?.[0];
        if (!file) return;
        e2.target.value = "";
        handlers.unhighlight();
        if (!file.type.startsWith("image/")) {
          this._showError("Please select an image file");
          return;
        }
        try {
          await this.loadImageFile(file);
        } catch (err) {
          console.error(err);
          this._showError("Failed to load image: " + err.message);
        }
      });
    }
  }
  /* ─── Event Handlers ────────────────────────────────────────── */
  /**
   * Handle settings changes from the controls panel.
   * Re-renders if there are existing strokes (for non-style changes).
   * @param {{key: string, value: *, settings: object}} detail
   * @private
   */
  _onSettingsChange(detail) {
    if (detail.key === "style") {
      this._setStatus("Style: " + detail.value, false, 2e3);
    }
    if (this.engine.getTotalStrokes() > 0 && detail.key !== "style") {
      this.engine.render();
    }
  }
  /* ─── Core Actions ──────────────────────────────────────────── */
  /**
   * Run the painting generation pipeline.
   * Updates settings from controls, generates strokes, renders progressively.
   */
  async generate() {
    if (this._generating) {
      this._showError("Generation already in progress");
      return;
    }
    if (!this.engine._sourceImage) {
      this._showError("No image loaded");
      return;
    }
    this._generating = true;
    const genBtn = this.controls.root.querySelector('[data-action="generate"]');
    if (genBtn) genBtn.setAttribute("disabled", "disabled");
    const stopBtn = this.controls.root.querySelector('[data-action="stop"]');
    if (stopBtn) stopBtn.removeAttribute("disabled");
    this._setStatus("Generating strokes...", true);
    try {
      const settings = this.controls.getSettings();
      this.engine.setSettings(settings);
      const startTime = performance.now();
      this.canvasMgr.render({ progress: 0, clear: true });
      let strokeCount = 0;
      const strokes = await this.engine.generate({
        style: settings.style,
        count: settings.strokeCount,
        layer: 0,
        smart: settings.smart,
        order: settings.order,
        multiLayer: settings.multiLayer || false,
        onShape: (shape) => {
          this.canvasMgr.drawStroke(shape, 1);
          strokeCount++;
          if (strokeCount % 50 === 0) {
            this._setStatus(
              "Generating\u2026 " + strokeCount.toLocaleString() + " strokes",
              true,
              0,
              true
            );
          }
        }
      });
      this.engine.render();
      const elapsed = performance.now() - startTime;
      const totalStrokes = strokes.length;
      this.layers.setLayers(this.engine.layers);
      this.motion?.refreshStrokeCount?.();
      this._setStatus(
        "Done \u2014 " + totalStrokes.toLocaleString() + " strokes in " + Math.round(elapsed) + "ms",
        false,
        5e3
      );
    } catch (err) {
      console.error(err);
      this._showError("Generation failed: " + err.message);
      this._setStatus("Generation failed", false, 5e3);
    } finally {
      this._generating = false;
      const genBtn2 = this.controls.root.querySelector('[data-action="generate"]');
      if (genBtn2) genBtn2.removeAttribute("disabled");
      const stopBtn2 = this.controls.root.querySelector('[data-action="stop"]');
      if (stopBtn2) stopBtn2.setAttribute("disabled", "disabled");
    }
  }
  /**
   * Stop an in-progress generation.
   */
  stopGeneration() {
    if (!this._generating) return;
    this.engine.stop();
    this._generating = false;
    const genBtn = this.controls.root.querySelector('[data-action="generate"]');
    if (genBtn) genBtn.removeAttribute("disabled");
    const stopBtn = this.controls.root.querySelector('[data-action="stop"]');
    if (stopBtn) stopBtn.setAttribute("disabled", "disabled");
    this._setStatus("Generation stopped", false, 3e3);
  }
  /**
   * Reset the canvas — clear all strokes and re-render the source image.
   */
  async resetCanvas() {
    if (this._generating) {
      this.stopGeneration();
    }
    this.engine.clearStrokes();
    this.engine.renderer.setLayers(this.engine.layers);
    this.engine.render({ clear: true });
    this.layers.setLayers(this.engine.layers);
    this.motion?.refreshStrokeCount?.();
    this._setStatus("Canvas reset \u2014 ready to generate", false, 3e3);
  }
  /* ─── Export Handlers ───────────────────────────────────────── */
  /**
   * Export the painting as an image (PNG or JPG).
   * @param {object} opts
   * @private
   */
  async _handleExportImage(opts) {
    if (!this.engine._sourceImage) {
      this._showError("No painting to export");
      return;
    }
    try {
      const blob = opts.format === "jpg" ? await this.engine.exportJPG({
        width: opts.width || this.engine.width,
        height: opts.height || this.engine.height,
        quality: opts.quality,
        background: opts.background
      }) : await this.engine.exportPNG({
        width: opts.width || this.engine.width,
        height: opts.height || this.engine.height,
        quality: opts.quality,
        background: opts.background
      });
      this._downloadBlob(blob, "www-paint-export." + opts.format);
      this.exportMgr.hide();
    } catch (err) {
      console.error(err);
      this._showError("Export failed: " + err.message);
    }
  }
  /**
   * Export as self-contained HTML.
   * @private
   */
  async _handleExportHTML() {
    if (!this.engine._sourceImage) {
      this._showError("No painting to export");
      return;
    }
    try {
      const html = this.engine.exportHTML({
        format: "packed",
        width: this.engine.width,
        height: this.engine.height,
        background: this.engine.background
      });
      const blob = new Blob([html], { type: "text/html" });
      this._downloadBlob(blob, "www-paint-export.html");
      this.exportMgr.hide();
    } catch (err) {
      console.error(err);
      this._showError("HTML export failed: " + err.message);
    }
  }
  /**
   * Export as SVG.
   * @private
   */
  async _handleExportSVG() {
    if (!this.engine._sourceImage) {
      this._showError("No painting to export");
      return;
    }
    try {
      const svg = this.engine.exportSVG({
        width: this.engine.width,
        height: this.engine.height,
        background: this.engine.background
      });
      const blob = new Blob([svg], { type: "image/svg+xml" });
      this._downloadBlob(blob, "www-paint-export.svg");
      this.exportMgr.hide();
    } catch (err) {
      console.error(err);
      this._showError("SVG export failed: " + err.message);
    }
  }
  /**
   * Export each named layer as a separate PNG file.
   * @param {object} opts
   * @private
   */
  async _handleExportLayers(opts) {
    if (!this.engine._sourceImage) {
      this._showError("No painting to export");
      return;
    }
    try {
      var layerBlobs = await this.engine.exportAllLayersAsPNG({
        width: opts.width || this.engine.width,
        height: opts.height || this.engine.height,
        background: opts.background
      });
      for (const [name, blob] of Object.entries(layerBlobs)) {
        this._downloadBlob(blob, "www-paint-layer-" + name + ".png");
      }
      this.exportMgr.hide();
    } catch (err) {
      console.error(err);
      this._showError("Layer export failed: " + err.message);
    }
  }
  /**
   * Save the current project as JSON.
   * @private
   */
  _handleSaveProject() {
    if (!this.engine._sourceImage) {
      this._showError("No project to save");
      return;
    }
    try {
      const json = this.engine.exportProject({ embedImage: true });
      const blob = new Blob([json], { type: "application/json" });
      this._downloadBlob(blob, "www-paint-project.json");
      this.exportMgr.hide();
    } catch (err) {
      console.error(err);
      this._showError("Project save failed: " + err.message);
    }
  }
  /**
   * Handle the Load Project button click.
   * @private
   */
  _handleLoadProjectClick() {
    const fileInput = this.exportRoot.querySelector('[data-action="load-project-file"]');
    if (fileInput) fileInput.click();
  }
  /**
   * Handle loading a project file.
   * @param {File} file
   * @private
   */
  async _handleLoadProjectFile(file) {
    if (!file) return;
    try {
      this._setStatus("Loading project...", true);
      const text = await file.text();
      await this.engine.importProject(text);
      this.layers.setLayers(this.engine.layers);
      this.controls.setSettings(this.engine.settings);
      this.canvasMgr.setSize(this.engine.width, this.engine.height);
      this.paintBrush.resize(this.engine.width, this.engine.height);
      this.canvasMgr.setBackground(this.engine.background);
      this.engine.render();
      this._updateStatus();
      this._syncCanvasHeader();
      this._setStatus("Project loaded successfully", false, 2e3);
      this.exportMgr.hide();
    } catch (err) {
      console.error(err);
      this._showError("Failed to load project: " + err.message);
    }
  }
  /* ─── Utility ───────────────────────────────────────────────── */
  /**
   * Download a blob as a file.
   * @param {Blob} blob
   * @param {string} filename
   * @private
   */
  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a2 = document.createElement("a");
    a2.href = url;
    a2.download = filename;
    document.body.appendChild(a2);
    a2.click();
    document.body.removeChild(a2);
    URL.revokeObjectURL(url);
  }
  /**
   * Update the status bar with current painting information.
   * @private
   */
  _updateStatus() {
    if (!this.statusBar) return;
    const totalStrokes = this.engine.getTotalStrokes();
    const style = this.engine.settings.style || "pencil";
    const layerCount = this.engine.layers.length;
    const visibleLayers = this.engine.layers.filter((l2) => l2.visible).length;
    this.statusBar.innerHTML = `
      <span class="status-item">
        <span class="status-label">Style</span>
        <span class="status-value">${style}</span>
      </span>
      <span class="status-item">
        <span class="status-label">Strokes</span>
        <span class="status-value">${totalStrokes.toLocaleString()}</span>
      </span>
      <span class="status-item">
        <span class="status-label">Layers</span>
        <span class="status-value">${visibleLayers}/${layerCount}</span>
      </span>
      <span class="status-item status-item--spacer">
        <span class="status__message" id="status-message">Ready</span>
      </span>
    `;
  }
  /**
   * Set the status bar message.
   * @param {string} message
   * @param {boolean} [loading=false]
   * @param {number} [duration=0] — auto-clear after ms (0 = no auto-clear)
   * @private
   */
  _setStatus(message, loading = false, duration = 0) {
    if (!this.statusBar) return;
    let msgEl = this.statusBar.querySelector("#status-message");
    if (!msgEl) {
      const item = document.createElement("span");
      item.className = "status-item status-item--spacer";
      msgEl = document.createElement("span");
      msgEl.className = "status__message";
      msgEl.id = "status-message";
      item.appendChild(msgEl);
      this.statusBar.appendChild(item);
    }
    msgEl.textContent = message;
    msgEl.classList.toggle("status__loading", loading);
    if (this._statusTimeout) clearTimeout(this._statusTimeout);
    if (duration > 0) {
      this._statusTimeout = setTimeout(() => {
        msgEl.textContent = "Ready";
        msgEl.classList.remove("status__loading", "status__error");
      }, duration);
    }
  }
  /**
   * Show an error message (temporarily).
   * @param {string} message
   * @private
   */
  _showError(message) {
    if (!this.statusBar) return;
    let msgEl = this.statusBar.querySelector("#status-message");
    if (!msgEl) {
      const item = document.createElement("span");
      item.className = "status-item status-item--spacer";
      msgEl = document.createElement("span");
      msgEl.className = "status__message";
      msgEl.id = "status-message";
      item.appendChild(msgEl);
      this.statusBar.appendChild(item);
    }
    msgEl.textContent = message;
    msgEl.classList.add("status__error");
    msgEl.classList.remove("status__loading");
    if (this._statusTimeout) clearTimeout(this._statusTimeout);
    this._statusTimeout = setTimeout(() => {
      msgEl.textContent = "Ready";
      msgEl.classList.remove("status__error", "status__loading");
    }, 4e3);
  }
  /* ─── Teardown ──────────────────────────────────────────────── */
  /**
   * Clean up all managers and event listeners.
   */
  destroy() {
    if (this._statusTimeout) clearTimeout(this._statusTimeout);
    this.canvasMgr?.destroy();
    this.engine?.destroy();
    this.controls?.destroy();
    this.layers?.destroy();
    this.exportMgr?.destroy();
    this.motion?.destroy();
    if (this.paintBrush) {
      for (const [layerId] of this.paintBrush.surfaces) {
        this.paintBrush.removeLayer(layerId);
      }
    }
  }
};
function initApp() {
  const canvas = document.getElementById("paint-canvas");
  const controlsRoot = document.getElementById("controls-root");
  const layersRoot = document.getElementById("layers-root");
  const exportRoot = document.getElementById("export-root");
  const statusBar = document.getElementById("status-bar");
  if (!canvas || !controlsRoot || !layersRoot || !exportRoot) {
    console.error(
      "WWW_PAINT: Required DOM elements missing. Ensure #paint-canvas, #controls-root, #layers-root, and #export-root exist."
    );
    return null;
  }
  return new App({
    canvas,
    controlsRoot,
    layersRoot,
    exportRoot,
    statusBar
  });
}

// js/ui/maestro-entry.js
var app = initApp();
if (app) {
  let closeMobilePanels = function() {
    if (controlsPanel) controlsPanel.classList.add("panel--mobile-closed");
    if (layersPanel) layersPanel.classList.add("panel--mobile-closed");
    if (toggleControls) toggleControls.classList.remove("mobile-toggle--active");
    if (toggleLayers) toggleLayers.classList.remove("mobile-toggle--active");
  };
  window._wwwPaint = app;
  const loadBtn = document.getElementById("btn-load-image");
  const fileInput = document.getElementById("image-file-input");
  loadBtn?.addEventListener("click", () => fileInput?.click());
  fileInput?.addEventListener("change", async (e2) => {
    const file = e2.target.files?.[0];
    if (!file) return;
    e2.target.value = "";
    try {
      await app.loadImageFile(file);
    } catch (err) {
      console.error(err);
      app._showError("Failed to load: " + err.message);
    }
  });
  document.getElementById("btn-gener")?.addEventListener("click", () => app.generate());
  const weightSlider = document.getElementById("paint-weight");
  const weightValue = document.getElementById("paint-weight-value");
  if (weightSlider && weightValue) {
    weightSlider.addEventListener("input", () => {
      weightValue.textContent = weightSlider.value;
    });
  }
  document.getElementById("btn-export")?.addEventListener("click", () => {
    app.exportMgr?.show({
      width: app.engine.width,
      height: app.engine.height,
      background: app.engine.background
    });
  });
  document.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.nav;
      document.querySelectorAll(".panel").forEach((p2) => {
        p2.classList.toggle("panel--active", p2.classList.contains("panel--" + target));
      });
      document.querySelectorAll(".nav-btn").forEach((nav) => {
        nav.classList.toggle("nav-btn--active", nav === btn);
      });
    });
  });
  const controlsPanel = document.querySelector(".panel--controls");
  const layersPanel = document.querySelector(".panel--layers");
  const toggleControls = document.getElementById("toggle-controls");
  const toggleLayers = document.getElementById("toggle-layers");
  const isMobile = () => window.matchMedia("(max-width: 768px)").matches;
  toggleControls?.addEventListener("click", () => {
    if (!controlsPanel) return;
    const closed = controlsPanel.classList.contains("panel--mobile-closed") || controlsPanel.classList.contains("is-collapsed");
    app._setPanelCollapsed(controlsPanel, !closed);
  });
  toggleLayers?.addEventListener("click", () => {
    if (!layersPanel) return;
    const closed = layersPanel.classList.contains("panel--mobile-closed") || layersPanel.classList.contains("is-collapsed");
    app._setPanelCollapsed(layersPanel, !closed);
  });
}
