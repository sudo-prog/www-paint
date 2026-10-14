/**
 * Color utilities for the WWW_PAINT engine.
 *
 * Operates on RGB arrays [r, g, b] (each channel 0..255) and hex strings "#rrggbb".
 * All functions are pure and side-effect free.
 *
 * @module color
 */

/**
 * Convert a hex color string to an RGB array.
 *
 * Accepts `#rgb`, `#rrggbb`, `rgb`, or `rrggbb`.
 *
 * @param {string} hex
 * @returns {[number, number, number]} RGB array, channels in 0..255.
 */
export function hexToRgb(hex) {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    h = h.split('').map(c => c + c).join('');
  }
  if (h.length !== 6) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Convert an RGB array to a hex string `#rrggbb`.
 *
 * @param {[number, number, number]} rgb
 * @returns {string}
 */
export function rgbToHex([r, g, b]) {
  const toByte = (c) => Math.max(0, Math.min(255, Math.round(c)));
  return '#' + ((toByte(r) << 16) | (toByte(g) << 8) | toByte(b)).toString(16).padStart(6, '0');
}

/**
 * Convert RGB to CSS string for canvas context.
 *
 * @param {[number, number, number]} rgb
 * @returns {string} `rgb(r, g, b)`
 */
export function rgbToCss([r, g, b]) {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/**
 * Convert hex string to CSS rgb() string.
 * @param {string} hex
 * @returns {string}
 */
export function hexToCss(hex) {
  return rgbToCss(hexToRgb(hex));
}

/**
 * Mix two RGB colors by a factor t in [0, 1].
 *
 * @param {[number, number, number]} c0
 * @param {[number, number, number]} c1
 * @param {number} t - 0 = c0, 1 = c1.
 * @returns {[number, number, number]}
 */
export function mixColors(c0, c1, t = 0.5) {
  return [
    c0[0] + (c1[0] - c0[0]) * t,
    c0[1] + (c1[1] - c0[1]) * t,
    c0[2] + (c1[2] - c0[2]) * t,
  ];
}

/**
 * Compute the relative luminance of an RGB color (Rec. 709).
 * Returns a value in [0, 1].
 *
 * @param {[number, number, number]} rgb
 * @returns {number}
 */
export function luminance([r, g, b]) {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * Compute perceived brightness of an RGB color using the HSP formula.
 *
 * @param {[number, number, number]} rgb
 * @returns {number} Value in [0, 255].
 */
export function brightness([r, g, b]) {
  return Math.sqrt(0.299 * r * r + 0.587 * g * g + 0.114 * b * b);
}

/**
 * Compute the chroma distance between two RGB colors.
 * A simple Euclidean metric; good enough for quick comparisons.
 *
 * @param {[number, number, number]} a
 * @param {[number, number, number]} b
 * @returns {number} Distance in 0..~441.
 */
export function colorDistance(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Weighted Euclidean distance in RGB space that accounts for human
 * perception (red is more sensitive, blue less so).
 *
 * @param {[number, number, number]} a
 * @param {[number, number, number]} b
 * @returns {number} Distance in 0..~441.
 */
export function colorDistanceWeighted(a, b) {
  const rmean = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  const rweight = 2 + rmean / 256;
  const gweight = 4;
  const bweight = 2 + (512 - rmean) / 256;
  return Math.sqrt(rweight * dr * dr + gweight * dg * dg + bweight * db * db);
}

// ─── CIELAB ───────────────────────────────────────────────────────────────

/**
 * Convert an sRGB channel [0, 255] to linear RGB [0, 1].
 * @param {number} c
 * @returns {number}
 */
function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/**
 * Convert linear RGB [0, 1] channel to sRGB [0, 255].
 * @param {number} v
 * @returns {number}
 */
function linearToSrgb(v) {
  const s = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.round(s * 255);
}

/**
 * Convert RGB [r, g, b] (0..255) to CIELAB [L, a, b].
 *
 * L: 0..100, a: -128..127, b: -128..127
 * Uses D65 white point and standard sRGB→linear→Lab conversion.
 *
 * @param {[number, number, number]} rgb
 * @returns {[number, number, number]} Lab values.
 */
export function rgbToLab([r, g, b]) {
  // sRGB to linear RGB
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);

  // Linear RGB to XYZ (D65)
  const X = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750;
  const Z = R * 0.0193339 + G * 0.1191920 + B * 0.9503041;

  // Normalise to D65 white point
  const Xn = X / 0.95047;
  const Yn = Y / 1.00000;
  const Zn = Z / 1.08883;

  // XYZ to Lab
  const fx = Math.cbrt(Xn) || 0;
  const fy = Math.cbrt(Yn) || 0;
  const fz = Math.cbrt(Zn) || 0;

  const L = Y > 0.008856 ? 116 * fy - 16 : 903.3 * Y;
  const a = 500 * (fx - fy);
  const b_lab = 200 * (fy - fz);

  return [L, a, b_lab];
}

/**
 * Convert CIELAB [L, a, b] back to RGB [r, g, b] (0..255).
 *
 * @param {[number, number, number]} lab
 * @returns {[number, number, number]}
 */
export function labToRgb([L, a, b]) {
  // Lab to XYZ
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const xr = Math.pow(fx, 3);
  const zr = Math.pow(fz, 3);
  const yr = L > 903.3 ? L / 903.3 : Math.pow((L + 16) / 116, 3) * 1.2;

  const X = xr * 0.95047;
  const Y = yr * 1.00000;
  const Z = zr * 1.08883;

  // XYZ to linear RGB
  const R = X * 3.2404542 + Y * -1.5371385 + Z * -0.4985026;
  const G = X * -0.9692660 + Y * 1.8760108 + Z * 0.0414196;
  const B = X * 0.0556434 + Y * -0.2040258 + Z * 1.0572252;

  // Linear to sRGB
  return [linearToSrgb(R), linearToSrgb(G), linearToSrgb(B)];
}

/**
 * Compute the CIE76 colour difference ΔE between two RGB colours.
 * Lower values = more perceptually similar.
 *
 * @param {[number, number, number]} rgbA
 * @param {[number, number, number]} rgbB
 * @returns {number} ΔE (0..~100 for colours within sRGB gamut).
 */
export function colorDistanceLab(rgbA, rgbB) {
  const labA = Array.isArray(rgbA[0]) ? rgbA : rgbToLab(rgbA);
  const labB = Array.isArray(rgbB[0]) ? rgbB : rgbToLab(rgbB);
  const dL = labA[0] - labB[0];
  const da = labA[1] - labB[1];
  const db = labA[2] - labB[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}

// ─── Quantisation ───────────────────────────────────────────────────────────

/**
 * Quantize a single RGB channel to the given number of levels.
 *
 * @param {number} channel - 0..255.
 * @param {number} levels - Number of discrete steps.
 * @returns {number} Clamped quantized value.
 */
function quantizeChannel(channel, levels) {
  if (levels <= 1) return 0;
  const q = Math.round((channel / 255) * (levels - 1));
  return Math.round((q / (levels - 1)) * 255);
}

/**
 * Quantize an RGB color to the given number of levels per channel.
 * Returns a new [r, g, b] array.
 *
 * @param {[number, number, number]} rgb
 * @param {number} levels - Levels per channel (2..256).
 * @returns {[number, number, number]}
 */
export function quantizeColor([r, g, b], levels = 4) {
  return [
    quantizeChannel(r, levels),
    quantizeChannel(g, levels),
    quantizeChannel(b, levels),
  ];
}

/**
 * Reduce an array of RGB pixels to a palette using median-cut (simplified).
 *
 * @param {Uint8ClampedArray} pixels - RGBA pixel buffer.
 * @param {number} colorCount - Maximum palette size.
 * @returns {Array<[number, number, number]>} Array of RGB entries.
 */
export function quantizePixels(pixels, colorCount = 8) {
  const samples = [];
  const step = Math.max(1, Math.floor(pixels.length / (colorCount * 64)));
  for (let i = 0; i < pixels.length; i += step * 4) {
    samples.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
  }

  // Simple recursive median-cut
  const palette = [];
  const buckets = [samples];

  while (palette.length < colorCount && buckets.length > 0) {
    const next = buckets.shift();
    if (next.length === 0) continue;
    if (next.length <= 4 || palette.length >= colorCount - 1) {
      // Average the bucket into a single color
      let sr = 0, sg = 0, sb = 0;
      for (const [r, g, b] of next) {
        sr += r; sg += g; sb += b;
      }
      const n = next.length;
      palette.push([sr / n, sg / n, sb / n]);
      continue;
    }

    // Find the channel with the widest spread
    let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
    for (const [r, g, b] of next) {
      if (r < minR) minR = r; if (r > maxR) maxR = r;
      if (g < minG) minG = g; if (g > maxG) maxG = g;
      if (b < minB) minB = b; if (b > maxB) maxB = b;
    }
    const ranges = [maxR - minR, maxG - minG, maxB - minB];
    let splitChannel = 0;
    if (ranges[1] > ranges[0] && ranges[1] >= ranges[2]) splitChannel = 1;
    if (ranges[2] > ranges[splitChannel] && ranges[2] >= ranges[0]) splitChannel = 2;

    // Median split on that channel
    next.sort((a, b) => a[splitChannel] - b[splitChannel]);
    const mid = Math.floor(next.length / 2);
    buckets.push(next.slice(0, mid));
    buckets.push(next.slice(mid));
  }

  return palette.length === 0 ? [[0, 0, 0]] : palette;
}

/**
 * Find the nearest palette color to a given RGB.
 *
 * @param {[number, number, number]} rgb
 * @param {Array<[number, number, number]>} palette
 * @returns {[number, number, number]}
 */
export function nearestColor(rgb, palette) {
  let best = palette[0];
  let bestDist = Infinity;
  for (const entry of palette) {
    const d = colorDistance(rgb, entry);
    if (d < bestDist) {
      bestDist = d;
      best = entry;
    }
  }
  return best;
}

/**
 * Apply gamma correction to an RGB color (returns a new array).
 *
 * @param {[number, number, number]} rgb
 * @param {number} gamma - Exponent (e.g. 1/2.2 for encoding, 2.2 for decoding).
 * @returns {[number, number, number]}
 */
export function applyGamma([r, g, b], gamma) {
  const f = (c) => Math.pow(c / 255, gamma) * 255;
  return [f(r), f(g), f(b)];
}

/**
 * Convert RGB to HSL.
 *
 * @param {[number, number, number]} rgb
 * @returns {{h: number, s: number, l: number}} H in [0,360), S/L in [0,1].
 */
export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h, s;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h = h * 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

/**
 * Convert HSL to RGB.
 *
 * @param {number} h - Hue in [0, 360).
 * @param {number} s - Saturation in [0, 1].
 * @param {number} l - Lightness in [0, 1].
 * @returns {[number, number, number]}
 */
export function hslToRgb(h, s, l) {
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const t = h / 360;
  return [
    Math.round(hue2rgb(p, q, t + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, t) * 255),
    Math.round(hue2rgb(p, q, t - 1 / 3) * 255),
  ];
}

export default {
  hexToRgb,
  rgbToHex,
  rgbToCss,
  hexToCss,
  mixColors,
  luminance,
  brightness,
  colorDistance,
  colorDistanceWeighted,
  rgbToLab,
  labToRgb,
  colorDistanceLab,
  quantizeColor,
  quantizePixels,
  nearestColor,
  applyGamma,
  rgbToHsl,
  hslToRgb,
};
