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
 * A simple Euclidean metric; good enough for scoring.
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
