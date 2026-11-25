/* painterly bundles mersenne-twister, BSD-3-Clause — see NOTICE */
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/mersenne-twister/src/mersenne-twister.js
var require_mersenne_twister = __commonJS({
  "node_modules/mersenne-twister/src/mersenne-twister.js"(exports, module) {
    "use strict";
    var MersenneTwister2 = function(seed) {
      if (seed == void 0) {
        seed = (/* @__PURE__ */ new Date()).getTime();
      }
      this.N = 624;
      this.M = 397;
      this.MATRIX_A = 2567483615;
      this.UPPER_MASK = 2147483648;
      this.LOWER_MASK = 2147483647;
      this.mt = new Array(this.N);
      this.mti = this.N + 1;
      if (seed.constructor == Array) {
        this.init_by_array(seed, seed.length);
      } else {
        this.init_seed(seed);
      }
    };
    MersenneTwister2.prototype.init_seed = function(s) {
      this.mt[0] = s >>> 0;
      for (this.mti = 1; this.mti < this.N; this.mti++) {
        var s = this.mt[this.mti - 1] ^ this.mt[this.mti - 1] >>> 30;
        this.mt[this.mti] = (((s & 4294901760) >>> 16) * 1812433253 << 16) + (s & 65535) * 1812433253 + this.mti;
        this.mt[this.mti] >>>= 0;
      }
    };
    MersenneTwister2.prototype.init_by_array = function(init_key, key_length) {
      var i, j, k;
      this.init_seed(19650218);
      i = 1;
      j = 0;
      k = this.N > key_length ? this.N : key_length;
      for (; k; k--) {
        var s = this.mt[i - 1] ^ this.mt[i - 1] >>> 30;
        this.mt[i] = (this.mt[i] ^ (((s & 4294901760) >>> 16) * 1664525 << 16) + (s & 65535) * 1664525) + init_key[j] + j;
        this.mt[i] >>>= 0;
        i++;
        j++;
        if (i >= this.N) {
          this.mt[0] = this.mt[this.N - 1];
          i = 1;
        }
        if (j >= key_length) j = 0;
      }
      for (k = this.N - 1; k; k--) {
        var s = this.mt[i - 1] ^ this.mt[i - 1] >>> 30;
        this.mt[i] = (this.mt[i] ^ (((s & 4294901760) >>> 16) * 1566083941 << 16) + (s & 65535) * 1566083941) - i;
        this.mt[i] >>>= 0;
        i++;
        if (i >= this.N) {
          this.mt[0] = this.mt[this.N - 1];
          i = 1;
        }
      }
      this.mt[0] = 2147483648;
    };
    MersenneTwister2.prototype.random_int = function() {
      var y;
      var mag01 = new Array(0, this.MATRIX_A);
      if (this.mti >= this.N) {
        var kk;
        if (this.mti == this.N + 1)
          this.init_seed(5489);
        for (kk = 0; kk < this.N - this.M; kk++) {
          y = this.mt[kk] & this.UPPER_MASK | this.mt[kk + 1] & this.LOWER_MASK;
          this.mt[kk] = this.mt[kk + this.M] ^ y >>> 1 ^ mag01[y & 1];
        }
        for (; kk < this.N - 1; kk++) {
          y = this.mt[kk] & this.UPPER_MASK | this.mt[kk + 1] & this.LOWER_MASK;
          this.mt[kk] = this.mt[kk + (this.M - this.N)] ^ y >>> 1 ^ mag01[y & 1];
        }
        y = this.mt[this.N - 1] & this.UPPER_MASK | this.mt[0] & this.LOWER_MASK;
        this.mt[this.N - 1] = this.mt[this.M - 1] ^ y >>> 1 ^ mag01[y & 1];
        this.mti = 0;
      }
      y = this.mt[this.mti++];
      y ^= y >>> 11;
      y ^= y << 7 & 2636928640;
      y ^= y << 15 & 4022730752;
      y ^= y >>> 18;
      return y >>> 0;
    };
    MersenneTwister2.prototype.random_int31 = function() {
      return this.random_int() >>> 1;
    };
    MersenneTwister2.prototype.random_incl = function() {
      return this.random_int() * (1 / 4294967295);
    };
    MersenneTwister2.prototype.random = function() {
      return this.random_int() * (1 / 4294967296);
    };
    MersenneTwister2.prototype.random_excl = function() {
      return (this.random_int() + 0.5) * (1 / 4294967296);
    };
    MersenneTwister2.prototype.random_long = function() {
      var a = this.random_int() >>> 5, b = this.random_int() >>> 6;
      return (a * 67108864 + b) * (1 / 9007199254740992);
    };
    module.exports = MersenneTwister2;
  }
});

// src/image/blur.ts
function blur(source, sigma) {
  if (sigma < 0.5) return { ...source, data: source.data.slice() };
  const { width, height } = source;
  const current = source.data.slice();
  const scratch = new Float32Array(current.length);
  for (const radius of boxRadiiForGaussian(sigma, 3)) {
    boxBlurHorizontal(current, scratch, width, height, radius);
    boxBlurVertical(scratch, current, width, height, radius);
  }
  return { width, height, data: current };
}
function boxRadiiForGaussian(sigma, passes) {
  const ideal = Math.sqrt(12 * sigma * sigma / passes + 1);
  let lower = Math.floor(ideal);
  if (lower % 2 === 0) lower--;
  const upper = lower + 2;
  const m = Math.round(
    (12 * sigma * sigma - passes * lower * lower - 4 * passes * lower - 3 * passes) / (-4 * lower - 4)
  );
  const radii = [];
  for (let i = 0; i < passes; i++) radii.push(((i < m ? lower : upper) - 1) / 2);
  return radii;
}
function boxBlurHorizontal(src, dst, width, height, radius) {
  const span = radius * 2 + 1;
  const last = width - 1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 3;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let k = -radius; k <= radius; k++) {
      const i = row + clampIndex(k, last) * 3;
      r += src[i];
      g += src[i + 1];
      b += src[i + 2];
    }
    for (let x = 0; x < width; x++) {
      const out = row + x * 3;
      dst[out] = r / span;
      dst[out + 1] = g / span;
      dst[out + 2] = b / span;
      const leaving = row + clampIndex(x - radius, last) * 3;
      const entering = row + clampIndex(x + radius + 1, last) * 3;
      r += src[entering] - src[leaving];
      g += src[entering + 1] - src[leaving + 1];
      b += src[entering + 2] - src[leaving + 2];
    }
  }
}
function boxBlurVertical(src, dst, width, height, radius) {
  const span = radius * 2 + 1;
  const stride = width * 3;
  const last = height - 1;
  const sums = new Float64Array(stride);
  for (let k = -radius; k <= radius; k++) {
    const row = clampIndex(k, last) * stride;
    for (let c = 0; c < stride; c++) sums[c] = sums[c] + src[row + c];
  }
  for (let y = 0; y < height; y++) {
    const out = y * stride;
    const leaving = clampIndex(y - radius, last) * stride;
    const entering = clampIndex(y + radius + 1, last) * stride;
    for (let c = 0; c < stride; c++) {
      const sum = sums[c];
      dst[out + c] = sum / span;
      sums[c] = sum + src[entering + c] - src[leaving + c];
    }
  }
}
function clampIndex(i, last) {
  return i < 0 ? 0 : i > last ? last : i;
}

// src/image/raster.ts
function createRaster(width, height, fill) {
  const data = new Float32Array(width * height * 3);
  if (fill) {
    for (let i = 0; i < data.length; i += 3) {
      data[i] = fill[0];
      data[i + 1] = fill[1];
      data[i + 2] = fill[2];
    }
  }
  return { width, height, data };
}
function rasterFromImageData(image) {
  const raster = createRaster(image.width, image.height);
  const { data } = raster;
  const source = image.data;
  for (let px = 0, s = 0, d = 0; px < image.width * image.height; px++, s += 4, d += 3) {
    data[d] = source[s];
    data[d + 1] = source[s + 1];
    data[d + 2] = source[s + 2];
  }
  return raster;
}
function cloneRaster(raster) {
  return { width: raster.width, height: raster.height, data: raster.data.slice() };
}
function sample(raster, x, y, out = [0, 0, 0]) {
  const cx = x < 0 ? 0 : x >= raster.width ? raster.width - 1 : x | 0;
  const cy = y < 0 ? 0 : y >= raster.height ? raster.height - 1 : y | 0;
  const i = (cy * raster.width + cx) * 3;
  out[0] = raster.data[i];
  out[1] = raster.data[i + 1];
  out[2] = raster.data[i + 2];
  return out;
}
function colorDistance(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}
function dominantColor(raster) {
  const { data } = raster;
  const pixels = raster.width * raster.height;
  const family = new Uint8Array(pixels);
  const counts = new Uint32Array(15);
  for (let px = 0, i = 0; px < pixels; px++, i += 3) {
    const f = hueFamily(data[i], data[i + 1], data[i + 2]);
    family[px] = f;
    counts[f] = counts[f] + 1;
  }
  let best = 0;
  for (let f = 1; f < counts.length; f++) {
    if (counts[f] > counts[best]) best = f;
  }
  const sum = [0, 0, 0];
  for (let px = 0, i = 0; px < pixels; px++, i += 3) {
    if (family[px] !== best) continue;
    sum[0] += data[i];
    sum[1] += data[i + 1];
    sum[2] += data[i + 2];
  }
  const n = counts[best];
  return [Math.round(sum[0] / n), Math.round(sum[1] / n), Math.round(sum[2] / n)];
}
function hueFamily(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const lightness = (max + min) / 2;
  const saturation = chroma === 0 ? 0 : chroma / (255 - Math.abs(2 * lightness - 255));
  if (saturation < 0.18) return lightness < 85 ? 12 : lightness < 170 ? 13 : 14;
  let hue;
  if (max === r) hue = ((g - b) / chroma + 6) % 6;
  else if (max === g) hue = (b - r) / chroma + 2;
  else hue = (r - g) / chroma + 4;
  return Math.floor(hue * 2) % 12;
}

// src/image/gradient.ts
function luminance(raster) {
  const out = new Float32Array(raster.width * raster.height);
  const { data } = raster;
  for (let px = 0, i = 0; px < out.length; px++, i += 3) {
    out[px] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return out;
}
function sobel(raster) {
  const { width, height } = raster;
  const lum = luminance(raster);
  const gx = new Float32Array(width * height);
  const gy = new Float32Array(width * height);
  const at = (x, y) => {
    const cx = x < 0 ? 0 : x >= width ? width - 1 : x;
    const cy = y < 0 ? 0 : y >= height ? height - 1 : y;
    return lum[cy * width + cx];
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      gx[i] = -at(x - 1, y - 1) + at(x + 1, y - 1) + -2 * at(x - 1, y) + 2 * at(x + 1, y) + -at(x - 1, y + 1) + at(x + 1, y + 1);
      gy[i] = -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) + at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
    }
  }
  return { width, height, gx, gy };
}
function smoothGradient(raster, sigma) {
  const { width, height, gx, gy } = sobel(raster);
  const tensor = createRaster(width, height);
  for (let px = 0, i = 0; px < gx.length; px++, i += 3) {
    const x = gx[px];
    const y = gy[px];
    tensor.data[i] = x * x;
    tensor.data[i + 1] = x * y;
    tensor.data[i + 2] = y * y;
  }
  const smooth = blur(tensor, sigma).data;
  for (let px = 0, i = 0; px < gx.length; px++, i += 3) {
    const xx = smooth[i];
    const xy = smooth[i + 1];
    const yy = smooth[i + 2];
    const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
    const magnitude = Math.sqrt(xx + yy);
    gx[px] = Math.cos(angle) * magnitude;
    gy[px] = Math.sin(angle) * magnitude;
  }
  return { width, height, gx, gy };
}

// src/paint/brushes.ts
var brushes = {
  bristle: {
    name: "bristle",
    bristles: 8,
    spread: 0.9,
    weight: [0.12, 0.38],
    alpha: 0.55,
    drift: 14,
    dots: false,
    ragged: 0.25
  },
  ribbon: {
    name: "ribbon",
    bristles: 6,
    spread: 0.8,
    weight: [0.18, 0.5],
    alpha: 0.6,
    drift: 12,
    dots: false,
    ragged: 0
  },
  round: {
    name: "round",
    bristles: 1,
    spread: 0,
    weight: [1.6, 2.2],
    alpha: 0.9,
    drift: 8,
    dots: true,
    ragged: 0
  },
  flat: {
    name: "flat",
    bristles: 2,
    spread: 0.45,
    weight: [1, 1.2],
    alpha: 0.85,
    drift: 6,
    dots: false,
    ragged: 0.08
  }
};

// src/random.ts
var import_mersenne_twister = __toESM(require_mersenne_twister(), 1);
function createRandom(seed) {
  const twister = new import_mersenne_twister.default(seed >>> 0);
  const next = () => twister.random_long();
  return {
    next,
    between: (min, max) => min + (max - min) * next(),
    index: (n) => Math.floor(next() * n),
    shuffle(items) {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const swap = items[i];
        items[i] = items[j];
        items[j] = swap;
      }
      return items;
    }
  };
}
function jitter(seed) {
  let state = seed >>> 0;
  return () => {
    state = state + 1831565813 >>> 0;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// src/paint/painter.ts
function createPainter(context, painting, brush) {
  let painted = 0;
  const reset = () => {
    context.save();
    context.globalAlpha = 1;
    context.fillStyle = css(painting.ground);
    context.fillRect(0, 0, painting.width, painting.height);
    context.restore();
    painted = 0;
  };
  const paintTo = (count) => {
    const target = Math.max(0, Math.min(count, painting.strokes.length));
    if (target < painted) reset();
    if (painted >= target) return;
    context.save();
    applyBrush(context, brush);
    for (; painted < target; painted++) {
      drawStroke(context, painting.strokes[painted], brush);
    }
    context.restore();
  };
  const resume = (snapshot, count) => {
    context.save();
    context.globalAlpha = 1;
    context.drawImage(snapshot, 0, 0);
    context.restore();
    painted = count;
  };
  reset();
  return {
    paintTo,
    reset,
    resume,
    get painted() {
      return painted;
    }
  };
}
function paintStroke(context, stroke, brush) {
  context.save();
  applyBrush(context, brush);
  drawStroke(context, stroke, brush);
  context.restore();
}
function applyBrush(context, brush) {
  context.lineCap = "round";
  context.lineJoin = "round";
  context.globalAlpha = brush.alpha;
}
function drawStroke(context, stroke, brush) {
  const random = jitter(stroke.jitter);
  const { radius, points } = stroke;
  const first = points[0];
  if (!first) return;
  const second = points[1] ?? first;
  let nx = -(second[1] - first[1]);
  let ny = second[0] - first[0];
  const norm = Math.hypot(nx, ny) || 1;
  nx /= norm;
  ny /= norm;
  for (let b = 0; b < brush.bristles; b++) {
    const fan = brush.bristles === 1 ? 0 : (b / (brush.bristles - 1) - 0.5) * 2;
    const offset = fan * brush.spread * radius + (random() - 0.5) * radius * 0.3;
    const ox = nx * offset;
    const oy = ny * offset;
    const width = radius * lerp(brush.weight[0], brush.weight[1], random());
    const color = drift(stroke.color, brush.drift, random);
    context.strokeStyle = color;
    context.lineWidth = width;
    if (brush.dots || points.length === 1) {
      context.fillStyle = color;
      for (const [x, y] of points) {
        context.beginPath();
        context.arc(x + ox, y + oy, width / 2, 0, Math.PI * 2);
        context.fill();
      }
      continue;
    }
    const path = slice(points, random() * brush.ragged, 1 - random() * brush.ragged);
    const start = path[0];
    context.beginPath();
    context.moveTo(start[0] + ox, start[1] + oy);
    for (let i = 1; i < path.length - 1; i++) {
      const [cx, cy] = path[i];
      const [nx2, ny2] = path[i + 1];
      context.quadraticCurveTo(cx + ox, cy + oy, (cx + nx2) / 2 + ox, (cy + ny2) / 2 + oy);
    }
    const end = path[path.length - 1];
    context.lineTo(end[0] + ox, end[1] + oy);
    context.stroke();
  }
}
function slice(points, from, to) {
  const first = Math.min(points.length - 2, Math.floor(from * points.length));
  const last = Math.max(first + 1, Math.ceil(to * points.length) - 1);
  return points.slice(first, last + 1);
}
function drift(color, amount, random) {
  const r = clamp(color[0] + (random() - 0.5) * 2 * amount);
  const g = clamp(color[1] + (random() - 0.5) * 2 * amount);
  const b = clamp(color[2] + (random() - 0.5) * 2 * amount);
  return `rgb(${r | 0} ${g | 0} ${b | 0})`;
}
function css([r, g, b]) {
  return `rgb(${r} ${g} ${b})`;
}
var clamp = (v) => v < 0 ? 0 : v > 255 ? 255 : v;
var lerp = (a, b, t) => a + (b - a) * t;

// src/paint/schedule.ts
var LAYER_SHARES = [0.08, 0.12, 0.18, 0.27, 0.35];
var COARSER = 1.5;
function sharesFor(count) {
  if (count <= 0) return [];
  if (count <= LAYER_SHARES.length) return LAYER_SHARES.slice(-count);
  const shares = [...LAYER_SHARES];
  while (shares.length < count) shares.unshift(shares[0] / COARSER);
  return shares;
}
function createSchedule(painting, duration) {
  const layers = painting.layerSizes.filter((size) => size > 0);
  const shares = sharesFor(layers.length);
  const shareTotal = shares.reduce((a, b) => a + b, 0) || 1;
  const spans = [];
  let time = 0;
  let stroke = 0;
  layers.forEach((size, i) => {
    const length = shares[i] / shareTotal * duration;
    spans.push([time, time + length, stroke, stroke + size]);
    time += length;
    stroke += size;
  });
  const total = stroke;
  return {
    duration,
    strokesAt(elapsed) {
      if (elapsed <= 0) return 0;
      if (elapsed >= duration) return total;
      for (const [t0, t1, s0, s1] of spans) {
        if (elapsed < t1) return Math.floor(s0 + (elapsed - t0) / (t1 - t0) * (s1 - s0));
      }
      return total;
    },
    timeOf(count) {
      if (count <= 0) return 0;
      if (count >= total) return duration;
      for (const [t0, t1, s0, s1] of spans) {
        if (count < s1) return t0 + (count - s0) / (s1 - s0) * (t1 - t0);
      }
      return duration;
    }
  };
}

// src/plan/pack.ts
function packPlan(plan2) {
  const count = plan2.strokes.length;
  let pointCount = 0;
  for (const stroke of plan2.strokes) pointCount += stroke.points.length;
  const layers = new Uint8Array(count);
  const radii = new Float64Array(count);
  const colors = new Float64Array(count * 3);
  const jitters = new Uint32Array(count);
  const starts = new Uint32Array(count + 1);
  const points = new Float64Array(pointCount * 2);
  let at = 0;
  plan2.strokes.forEach((stroke, i) => {
    layers[i] = stroke.layer;
    radii[i] = stroke.radius;
    colors.set(stroke.color, i * 3);
    jitters[i] = stroke.jitter;
    starts[i] = at;
    for (const [x, y] of stroke.points) {
      points[at * 2] = x;
      points[at * 2 + 1] = y;
      at++;
    }
  });
  starts[count] = at;
  return {
    seed: plan2.seed,
    width: plan2.width,
    height: plan2.height,
    ground: [...plan2.ground],
    layerSizes: [...plan2.layerSizes],
    layers,
    radii,
    colors,
    jitters,
    starts,
    points
  };
}
function unpackPlan(packed) {
  const { layers, radii, colors, jitters, starts, points } = packed;
  const strokes = new Array(layers.length);
  for (let i = 0; i < layers.length; i++) {
    const from = starts[i];
    const to = starts[i + 1];
    const path = new Array(to - from);
    for (let p = from; p < to; p++) {
      path[p - from] = [points[p * 2], points[p * 2 + 1]];
    }
    strokes[i] = {
      layer: layers[i],
      radius: radii[i],
      color: [colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]],
      points: path,
      jitter: jitters[i]
    };
  }
  return {
    seed: packed.seed,
    width: packed.width,
    height: packed.height,
    ground: [...packed.ground],
    strokes,
    layerSizes: [...packed.layerSizes]
  };
}
function packedBuffers(packed) {
  const { layers, radii, colors, jitters, starts, points } = packed;
  return [layers, radii, colors, jitters, starts, points].map(
    (array) => array.buffer
  );
}

// src/plan/stamp.ts
function stampStroke(canvas, points, radius, color) {
  const first = points[0];
  if (!first) return;
  if (points.length === 1) {
    stampDisc(canvas, first[0], first[1], radius, color);
    return;
  }
  const step = Math.max(1, radius / 2);
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const length = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(length / step));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      stampDisc(canvas, ax + (bx - ax) * t, ay + (by - ay) * t, radius, color);
    }
  }
}
function stampDisc(canvas, cx, cy, radius, color) {
  const { width, height, data } = canvas;
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(width - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(height - 1, Math.ceil(cy + radius));
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      if (dx * dx + dy * dy > r2) continue;
      const i = (y * width + x) * 3;
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
    }
  }
}

// src/plan/stroke.ts
var scratchA = [0, 0, 0];
var scratchB = [0, 0, 0];
function growStroke(x0, y0, reference, canvas, gradient, options) {
  const { radius, minLength, maxLength, curvature } = options;
  const color = sample(reference, x0, y0, [0, 0, 0]);
  const points = [[x0, y0]];
  let x = x0;
  let y = y0;
  let lastDx = 0;
  let lastDy = 0;
  for (let i = 1; i <= maxLength; i++) {
    const px = x | 0;
    const py = y | 0;
    if (i > minLength) {
      const ref = sample(reference, px, py, scratchA);
      const already = colorDistance(ref, sample(canvas, px, py, scratchB));
      if (already < colorDistance(ref, color)) break;
    }
    const gi = py * gradient.width + px;
    const gx = gradient.gx[gi];
    const gy = gradient.gy[gi];
    const magnitude = Math.hypot(gx, gy);
    if (magnitude < 1e-3) break;
    let dx = -gy / magnitude;
    let dy = gx / magnitude;
    if (lastDx * dx + lastDy * dy < 0) {
      dx = -dx;
      dy = -dy;
    }
    dx = curvature * dx + (1 - curvature) * lastDx;
    dy = curvature * dy + (1 - curvature) * lastDy;
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    x += radius * dx;
    y += radius * dy;
    if (x < 0 || y < 0 || x >= reference.width || y >= reference.height) break;
    lastDx = dx;
    lastDy = dy;
    points.push([x, y]);
  }
  return { color, points };
}

// src/plan/plan.ts
function defaultRadii(width, height) {
  const side = Math.max(width, height);
  return [40, 80, 160, 320, 640].map((d) => Math.max(1.5, side / d));
}
function plan(source, options = {}) {
  const {
    seed = 1,
    radii = defaultRadii(source.width, source.height),
    threshold = 40,
    gridFactor = 1,
    blurFactor = 0.5,
    minLength = 3,
    maxLength = 10,
    curvature = 1,
    flow = "gradient",
    flowScale = 2,
    onLayer
  } = options;
  const random = createRandom(seed);
  const { width, height } = source;
  const ground = dominantColor(source);
  const canvas = createRaster(width, height, ground);
  const strokes = [];
  const layerSizes = [];
  radii.forEach((radius, layer) => {
    const reference = blur(source, blurFactor * radius);
    const gradient = flow === "tensor" ? smoothGradient(reference, flowScale * radius) : sobel(reference);
    const grid = Math.max(1, Math.round(gridFactor * radius));
    const difference = differenceMap(reference, canvas);
    const layerStrokes = [];
    for (let gy = 0; gy < height; gy += grid) {
      for (let gx = 0; gx < width; gx += grid) {
        let sum = 0;
        let worst = -1;
        let worstX = gx;
        let worstY = gy;
        let count = 0;
        const yEnd = Math.min(height, gy + grid);
        const xEnd = Math.min(width, gx + grid);
        for (let y = gy; y < yEnd; y++) {
          for (let x = gx; x < xEnd; x++) {
            const d = difference[y * width + x];
            sum += d;
            count++;
            if (d > worst) {
              worst = d;
              worstX = x;
              worstY = y;
            }
          }
        }
        if (sum / count <= threshold) continue;
        const grown = growStroke(worstX, worstY, reference, canvas, gradient, {
          radius,
          minLength,
          maxLength,
          curvature
        });
        layerStrokes.push({
          layer,
          radius,
          color: grown.color,
          points: grown.points,
          jitter: 0
        });
      }
    }
    const last = layer === radii.length - 1;
    random.shuffle(layerStrokes);
    for (const stroke of layerStrokes) {
      stroke.jitter = Math.floor(random.next() * 4294967296);
      if (!last) stampStroke(canvas, stroke.points, radius, stroke.color);
      strokes.push(stroke);
    }
    layerSizes.push(layerStrokes.length);
    onLayer?.(layer + 1, radii.length);
  });
  return { seed, width, height, ground, strokes, layerSizes };
}
function differenceMap(a, b) {
  const out = new Float32Array(a.width * a.height);
  for (let px = 0, i = 0; px < out.length; px++, i += 3) {
    const dr = a.data[i] - b.data[i];
    const dg = a.data[i + 1] - b.data[i + 1];
    const db = a.data[i + 2] - b.data[i + 2];
    out[px] = Math.sqrt(dr * dr + dg * dg + db * db);
  }
  return out;
}
function simulate(painting, upTo = painting.strokes.length) {
  const canvas = createRaster(painting.width, painting.height, painting.ground);
  for (let i = 0; i < upTo && i < painting.strokes.length; i++) {
    const stroke = painting.strokes[i];
    stampStroke(canvas, stroke.points, stroke.radius, stroke.color);
  }
  return canvas;
}
function meanDifference(a, b) {
  let sum = 0;
  const pixels = a.width * a.height;
  const pa = [0, 0, 0];
  const pb = [0, 0, 0];
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      sum += colorDistance(sample(a, x, y, pa), sample(b, x, y, pb));
    }
  }
  return sum / pixels;
}

// src/plan/styles.ts
var styles = {
  painting: {
    label: "Painting",
    options: () => ({})
  },
  underpainting: {
    label: "Underpainting",
    options: (width, height) => ({
      radii: [Math.max(width, height) / 40],
      threshold: 60,
      minLength: 4,
      maxLength: 16
    })
  }
};
function isStyleName(name) {
  return name !== null && name in styles;
}
export {
  blur,
  brushes,
  cloneRaster,
  colorDistance,
  createPainter,
  createRandom,
  createRaster,
  createSchedule,
  defaultRadii,
  dominantColor,
  isStyleName,
  jitter,
  luminance,
  meanDifference,
  packPlan,
  packedBuffers,
  paintStroke,
  plan,
  rasterFromImageData,
  sample,
  simulate,
  smoothGradient,
  sobel,
  styles,
  unpackPlan
};
//# sourceMappingURL=index.js.map