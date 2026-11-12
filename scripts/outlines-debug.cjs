#!/usr/bin/env node
/**
 * Outline debug visual (Round 2, M7).
 *
 * Renders a target image with its extracted outlines overlaid, so the walk can
 * be reviewed by eye — the assertion suite proves the geometry, not that the
 * result *looks* like the contours.
 *
 * Usage:
 *   node scripts/outlines-debug.cjs
 *   node scripts/outlines-debug.cjs --threshold=0.5 --out=/tmp/outlines.png
 *
 * Node-safe: builds the PNG with the same `zlib` + manual chunking approach the
 * other debug scripts use (no canvas, no new dependency).
 */

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const { analyzeImage } = require('../js/engine/analyzer.js');
const { extractOutlines } = require('../js/engine/outlines.js');

// ─── Args ─────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argOf = (k) => {
  const hit = args.find(a => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : null;
};
const THRESHOLD = parseFloat(argOf('threshold') || '0.3');
const OUT = argOf('out') || path.join(__dirname, '..', 'docs', 'research', 'outlines-debug.png');

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
const W = 200, H = 200;
const px = new Uint8ClampedArray(W * H * 4);
const cx0 = 100, cy0 = 100;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const inSquare = x >= 40 && x < 110 && y >= 40 && y < 110;
    const d = Math.hypot(x - cx0, y - cy0);
    const inRing = d > 70 && d < 82;
    const v = inSquare || inRing ? 235 : 28;
    px[i] = v; px[i + 1] = v; px[i + 2] = v; px[i + 3] = 255;
  }
}

// ─── Extract ──────────────────────────────────────────────────────
const an = analyzeImage(px, W, H, { structure: false });
const res = extractOutlines(an, { threshold: THRESHOLD, minLength: 10, minStrength: 0.3 });

// ─── Compose the visual: dimmed source + outlines ─────────────────
const out = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) {
  const o = i * 4;
  out[o] = px[o] * 0.35;
  out[o + 1] = px[o + 1] * 0.35;
  out[o + 2] = px[o + 2] * 0.35;
  out[o + 3] = 255;
}

// Draw each outline as a 1px polyline, coloured by rank (hue rotation).
for (let r = 0; r < res.outlines.length; r++) {
  const o = res.outlines[r];
  const hue = (r * 137.5) % 360;
  const [rr, gg, bb] = hsl(hue, 0.9, 0.55);
  for (const [x, y] of o.points) {
    const j = (y * W + x) * 4;
    out[j] = rr; out[j + 1] = gg; out[j + 2] = bb; out[j + 3] = 255;
  }
}

writePNG(OUT, W, H, out);

console.log(`outlines: ${res.outlines.length}`);
for (let r = 0; r < Math.min(res.outlines.length, 8); r++) {
  const o = res.outlines[r];
  console.log(`  #${r} len=${o.points.length} strength=${o.strength.toFixed(3)} start=(${o.points[0][0]},${o.points[0][1]})`);
}
console.log(`wrote ${OUT}`);

function hsl(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) { r = c; g = x; } else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; } else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; } else { r = c; b = x; }
  const m = l - c / 2;
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
