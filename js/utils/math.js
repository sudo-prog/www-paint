/**
 * Math helpers for the WWW_PAINT engine.
 *
 * All functions are pure, dependency-free, and operate on raw JS values
 * (numbers, arrays) so they can run in both the main thread and a Web Worker.
 *
 * @module math
 */

/**
 * Clamp a number to the range [min, max].
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation between two values.
 *
 * @param {number} a - Start value.
 * @param {number} b - End value.
 * @param {number} t - Interpolation factor in [0, 1].
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Linearly map a value from one range to another.
 *
 * @param {number} value - Input value.
 * @param {number} inMin - Source range minimum.
 * @param {number} inMax - Source range maximum.
 * @param {number} outMin - Destination range minimum.
 * @param {number} outMax - Destination range maximum.
 * @returns {number}
 */
export function mapRange(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return outMin;
  const t = (value - inMin) / (inMax - inMin);
  return lerp(outMin, outMax, t);
}

/**
 * Generate a Gaussian (normally distributed) random value using the
 * central limit theorem: sum of four uniform [-1, 1] samples scaled.
 *
 * @param {function(): number} randomFn - Uniform random in [0, 1).
 * @returns {number} Value with mean ~0, stddev ~1.
 */
export function gaussian(randomFn) {
  return (randomFn() + randomFn() + randomFn() + randomFn() - 2) * 1.7320508075688772;
}

/**
 * Compute the mean of an array of numbers.
 * @param {number[]} values
 * @returns {number}
 */
export function mean(values) {
  if (values.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i];
  return sum / values.length;
}

/**
 * Compute the standard deviation of an array of numbers.
 * @param {number[]} values
 * @param {boolean} [sample=true] - Use sample stddev (N-1) if true.
 * @returns {number}
 */
export function stdDev(values, sample = true) {
  if (values.length < 2) return 0;
  const m = mean(values);
  let sq = 0;
  for (let i = 0; i < values.length; i++) {
    const d = values[i] - m;
    sq += d * d;
  }
  const n = sample ? values.length - 1 : values.length;
  return Math.sqrt(sq / n);
}

/**
 * Compute dot product of two equal-length vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
export function dot(a, b) {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

/**
 * Euclidean distance between two 2D points.
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 * @returns {number}
 */
export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Squared distance (avoids sqrt).
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 * @returns {number}
 */
export function dist2Sq(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/**
 * Angle between two 2D vectors in radians, in [-PI, PI].
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {number}
 */
export function angleBetween(x0, y0, x1, y1) {
  return Math.atan2(y1, x1) - Math.atan2(y0, x0);
}

/**
 * Normalize an angle to [-PI, PI].
 * @param {number} a
 * @returns {number}
 */
export function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Linear conversion from degrees to radians.
 * @param {number} deg
 * @returns {number}
 */
export function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Linear conversion from radians to degrees.
 * @param {number} rad
 * @returns {number}
 */
export function toDeg(rad) {
  return rad * (180 / Math.PI);
}

/**
 * Quantize a value to the nearest step multiple.
 * @param {number} value
 * @param {number} step
 * @returns {number}
 */
export function quantize(value, step) {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

/**
 * Weighted average of numbers.
 * @param {number[]} values
 * @param {number[]} weights
 * @returns {number}
 */
export function weightedAverage(values, weights) {
  let num = 0;
  let den = 0;
  const n = Math.min(values.length, weights.length);
  for (let i = 0; i < n; i++) {
    num += values[i] * weights[i];
    den += weights[i];
  }
  return den === 0 ? 0 : num / den;
}

/**
 * Generate a value using a 2D value-noise-style falloff (for jitter).
 * @param {number} t - Phase parameter.
 * @returns {number} Value in [-1, 1].
 */
export function sawtooth(t) {
  return ((t % 2) + 2) % 2 - 1;
}
