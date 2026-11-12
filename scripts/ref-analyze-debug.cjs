#!/usr/bin/env node
/**
 * Reference-analysis debug visual (Track S, S1).
 *
 * Renders a reference image with the S1 analysis grid overlaid, so the packet
 * can be reviewed by eye — the assertion suite proves the geometry, not that
 * the grid *reads* the way a painter would.
 *
 *   - Each cell is tinted by its implied stroke scale: blue = fine strokes
 *     (busy / detailed), red = coarse strokes (flat).
 *   - A short quiver at the cell centre shows the tangent orientation, with
 *     length scaled by orientation strength.
 *
 * Usage:
 *   node scripts/ref-analyze-debug.cjs
 *   node scripts/ref-analyze-debug.cjs --out=/tmp/ref.png --grid=16
 *
 * Node-safe: builds the PNG with the same `zlib` + manual chunking approach the
 * other debug scripts use (no canvas, no new dependency).
 */

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const { analyzeReference } = require('../js/engine/ref-analyze.js');

// ─── Args ─────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argOf = (k) => {
  const hit = args.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : null;
};
const OUT = argOf('out') || path.join(__dirname, '..', 'docs', 'research', 'ref-analyze-debug.png');
const FORCE_GRID = argOf('grid') ? parseInt(argOf('grid'), 10) : null;

// ─── Minimal PNG writer (truecolour, no filter) ───────────────────
function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function writePNG(file, w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type RGBA
  const raw = Buffer.alloc(h * (1 + w * 4));
  const src = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  for (let y = 0; y < h; y++) {
    const row = y * (1 + w * 4);
    raw[row] = 0; // filter none
    src.copy(raw, row + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  fs.writeFileSync(file, Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]));
}

// ─── Fixture: a dark field with a bright square + ring ───────────
const W = 220, H = 220;
const px = new Uint8ClampedArray(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const inSquare = x >= 30 && x < 110 && y >= 30 && y < 110;
    const inMid = x >= 128 && x < 212 && y >= 18 && y < 66; // mid-tone patch -> exercises the midtones band
    const d = Math.hypot(x - 165, y - 150);
    const inRing = d > 34 && d < 46;
    const v = inSquare || inRing ? 238 : inMid ? 118 : 26;
    px[i] = v; px[i + 1] = v; px[i + 2] = v; px[i + 3] = 255;
  }
}

// ─── Analyse ──────────────────────────────────────────────────────
const opts = FORCE_GRID ? { gridSize: FORCE_GRID } : {};
const pk = analyzeReference({ pixels: px, width: W, height: H }, opts);

// ─── Compose the visual: dimmed source + grid ─────────────────────
const out = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) {
  const o = i * 4;
  out[o] = px[o] * 0.4;
  out[o + 1] = px[o + 1] * 0.4;
  out[o + 2] = px[o + 2] * 0.4;
  out[o + 3] = 255;
}

// Cell tint by stroke scale: blue (fine) -> red (coarse).
for (const c of pk.cells) {
  const t = 1 - c.strokeScale;            // 0 = coarse, 1 = fine
  const r = Math.round(60 + 170 * (1 - t));
  const b = Math.round(60 + 170 * t);
  for (let y = c.y0; y < c.y1; y++) {
    for (let x = c.x0; x < c.x1; x++) {
      const j = (y * W + x) * 4;
      out[j] = Math.min(255, out[j] + r * 0.28);
      out[j + 1] = Math.min(255, out[j + 1] + 40 * 0.28);
      out[j + 2] = Math.min(255, out[j + 2] + b * 0.28);
    }
  }
}

// Grid lines.
for (let g = 0; g <= pk.gridSize; g++) {
  const x = Math.min(W - 1, Math.round(g * pk.cellSize[0]));
  const y = Math.min(H - 1, Math.round(g * pk.cellSize[1]));
  for (let k = 0; k < H; k++) { const j = (k * W + x) * 4; out[j] = 40; out[j + 1] = 40; out[j + 2] = 40; }
  for (let k = 0; k < W; k++) { const j = (y * W + k) * 4; out[j] = 40; out[j + 1] = 40; out[j + 2] = 40; }
}

// Orientation quiver per cell (white), length ~ strength.
for (const c of pk.cells) {
  const cx = (c.x0 + c.x1) / 2;
  const cy = (c.y0 + c.y1) / 2;
  const half = Math.min(pk.cellSize[0], pk.cellSize[1]) * 0.42;
  const len = half * Math.max(0.25, c.orientationStrength);
  const dx = Math.cos(c.orientation) * len;
  const dy = Math.sin(c.orientation) * len;
  const steps = Math.max(2, Math.ceil(len));
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(cx + (dx * s) / steps);
    const y = Math.round(cy + (dy * s) / steps);
    const xm = Math.round(cx - (dx * s) / steps);
    const ym = Math.round(cy - (dy * s) / steps);
    for (const [qx, qy] of [[x, y], [xm, ym]]) {
      if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue;
      const j = (qy * W + qx) * 4;
      out[j] = 255; out[j + 1] = 255; out[j + 2] = 255;
    }
  }
}

writePNG(OUT, W, H, out);

console.log(`grid: ${pk.gridSize}x${pk.gridSize} (${pk.stats.cells} cells)`);
console.log(`scaleHistogram (fine -> coarse): ${pk.scaleHistogram.join(' ')}`);
console.log(`meanStrokeScale: ${pk.stats.meanStrokeScale.toFixed(3)}  meanCoherence: ${pk.stats.meanCoherence.toFixed(3)}`);
console.log(`strokeScaleByBand: ${JSON.stringify(pk.strokeScaleByBand)}`);
console.log(`coverage: ${JSON.stringify(pk.coverage)}`);
console.log(`wrote ${OUT}`);
