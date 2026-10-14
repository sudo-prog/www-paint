/**
 * Seeded random number generator (mulberry32).
 *
 * A fast, deterministic PRNG suitable for reproducible stroke generation.
 * The same seed always produces the same sequence of values, which is
 * essential for regenerating identical artwork from stored shape data.
 *
 * @module rng
 */

/**
 * Mulberry32 pseudo-random number generator.
 *
 * @param {number} seed - Integer seed (any 32-bit value).
 * @returns {function(): number} A function that returns the next float in [0, 1).
 */
export function createRNG(seed) {
  // Normalize seed to an unsigned 32-bit integer.
  let state = seed >>> 0;

  return function next() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Create an RNG instance with a convenience API for common ranges.
 *
 * @param {number} seed - Integer seed.
 * @returns {object} RNG wrapper with .float(), .int(), .range(), .pick(), .bool().
 */
export function rng(seed) {
  const next = createRNG(seed);

  return {
    /** @returns {number} Float in [0, 1). */
    next() { return next(); },

    /**
     * Float in [min, max).
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    float(min, max) {
      if (max === undefined) { max = min; min = 0; }
      return next() * (max - min) + min;
    },

    /**
     * Integer in [min, max] (inclusive).
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    int(min, max) {
      if (max === undefined) { max = min - 1; min = 0; }
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
    bool(p = 0.5) {
      return next() < p;
    },
  };
}

/**
 * Default global RNG instance seeded with a fixed value.
 * Useful when a shared stream is acceptable (e.g. non-critical jitter).
 */
export const globalRNG = rng(0x1337BEEF);
