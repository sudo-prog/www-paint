/**
 * export-panel.test.js — node tests for the export & share panel core (M11).
 *
 * Run: node tests/export-panel.test.js
 * No DOM, no browser, no engine — pure core only.
 */
import {
  EXPORT_SIZE_PRESETS,
  EXPORT_FORMATS,
  JPG_QUALITY_DEFAULT,
  JPG_QUALITY_MIN,
  JPG_QUALITY_MAX,
  MAX_EXPORT_DIMENSION,
  DEFAULT_BACKGROUND,
  formatBytes,
  resolveExportSize,
  clampQuality,
  checkExportFeasible,
  defaultExportState,
  updateExportState,
  buildExportRequest,
  describeExport,
  describeBlob,
  buildShareText,
  exportFilename,
  safeExport,
} from '../js/ui/export-panel-core.js';

let pass = 0;
let fail = 0;
const failures = [];

function ok(cond, msg) {
  if (cond) { pass++; } else { fail++; failures.push(msg); console.error('  ✗ ' + msg); }
}

function eq(a, b, msg) {
  ok(JSON.stringify(a) === JSON.stringify(b), `${msg} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
}

function approx(a, b, msg) {
  ok(Math.abs(a - b) < 1e-9, `${msg} — got ${a}, want ${b}`);
}

/* ── formatBytes ─────────────────────────────────────────────── */
console.log('formatBytes');
eq(formatBytes(0), '0 B', '0 bytes');
eq(formatBytes(512), '512 B', 'bytes under 1 KB');
eq(formatBytes(1024), '1 KB', 'exactly 1 KB rounds to 1 KB');
approx(parseFloat(formatBytes(1536)), 1.5, '1.5 KB');
eq(formatBytes(1024 * 1024), '1 MB', 'exactly 1 MB');
eq(formatBytes(-5), '—', 'negative is a dash');
eq(formatBytes(NaN), '—', 'NaN is a dash');
eq(formatBytes(Infinity), '—', 'Infinity is a dash');

/* ── resolveExportSize ───────────────────────────────────────── */
console.log('resolveExportSize');
eq(resolveExportSize({ width: 100, height: 50 }, EXPORT_SIZE_PRESETS[0]), { width: 100, height: 50, scale: 1 }, 'original keeps the image size');
eq(resolveExportSize({ width: 100, height: 50 }, EXPORT_SIZE_PRESETS[1]), { width: 200, height: 100, scale: 2 }, '2x doubles');
eq(resolveExportSize({ width: 100, height: 50 }, EXPORT_SIZE_PRESETS[2]), { width: 400, height: 200, scale: 4 }, '4x quadruples');
eq(resolveExportSize({ width: 99, height: 51 }, EXPORT_SIZE_PRESETS[1]), { width: 198, height: 102, scale: 2 }, '2x on odd dims');
eq(resolveExportSize({ width: 9000, height: 100 }, EXPORT_SIZE_PRESETS[2]).width, MAX_EXPORT_DIMENSION, 'width is clamped to the canvas limit');
eq(resolveExportSize({ width: 9000, height: 100 }, EXPORT_SIZE_PRESETS[2]).height, 400, 'height is NOT clamped when only width overflows');
eq(resolveExportSize({ width: 0, height: 0 }, EXPORT_SIZE_PRESETS[1]), { width: 0, height: 0, scale: 2 }, 'zero stays zero');
eq(resolveExportSize(null, null), { width: 0, height: 0, scale: 1 }, 'null input is safe');
eq(resolveExportSize({ width: 100, height: 50 }, { scale: null }), { width: 100, height: 50, scale: 1 }, 'explicit null scale = original');

/* ── clampQuality ────────────────────────────────────────────── */
console.log('clampQuality');
eq(clampQuality(0.5), 0.5, 'in-range quality passes through');
eq(clampQuality(0), JPG_QUALITY_MIN, 'below the floor clamps up');
eq(clampQuality(2), JPG_QUALITY_MAX, 'above the ceiling clamps down');
eq(clampQuality(NaN), JPG_QUALITY_DEFAULT, 'NaN falls back to the default');
eq(clampQuality(undefined), JPG_QUALITY_DEFAULT, 'undefined falls back to the default');
eq(clampQuality('0.6'), 0.6, 'a numeric string is accepted');

/* ── checkExportFeasible ─────────────────────────────────────── */
console.log('checkExportFeasible');
eq(checkExportFeasible(100, 100).ok, true, 'a normal size is feasible');
eq(checkExportFeasible(0, 100).ok, false, 'zero width is not feasible');
eq(checkExportFeasible(100, 0).ok, false, 'zero height is not feasible');
eq(checkExportFeasible(-1, 100).ok, false, 'negative width is not feasible');
ok(/no painting/i.test(checkExportFeasible(0, 0).reason), 'zero size says there is no painting');
eq(checkExportFeasible(MAX_EXPORT_DIMENSION + 1, 100).ok, false, 'over the dimension limit is refused');
eq(checkExportFeasible(MAX_EXPORT_DIMENSION, 100).ok, true, 'exactly at the dimension limit is allowed');
eq(checkExportFeasible(8200, 8200).ok, false, 'an over-the-pixel-cap canvas is refused');
ok(/pixels/i.test(checkExportFeasible(8200, 8200).reason), 'the pixel reason is reported');
eq(checkExportFeasible(4096, 4096).ok, true, 'a large but legal canvas is allowed');

/* ── defaultExportState ──────────────────────────────────────── */
console.log('defaultExportState');
{
  const s = defaultExportState({ width: 640, height: 480 });
  eq(s.sizeId, 'original', 'default size preset is original');
  eq(s.format, 'png', 'default format is png');
  eq(s.quality, JPG_QUALITY_DEFAULT, 'default quality is the default');
  eq(s.width, 640, 'default width follows the image');
  eq(s.height, 480, 'default height follows the image');
  eq(s.background, DEFAULT_BACKGROUND, 'default background is white');
}
{
  const s = defaultExportState();
  eq(s.width, 0, 'no image means zero width');
}

/* ── updateExportState ───────────────────────────────────────── */
console.log('updateExportState');
{
  const base = defaultExportState({ width: 100, height: 50 });
  const s2 = updateExportState(base, 'sizeId', '2x');
  eq(s2.width, 200, 'switching to 2x recomputes width');
  eq(s2.height, 100, 'switching to 2x recomputes height');
  eq(s2.sizeId, '2x', 'the size id is recorded');
  eq(base.width, 100, 'the original state is NOT mutated');

  const s4 = updateExportState(base, 'sizeId', '4x', { width: 200, height: 100 });
  eq(s4.width, 800, 'a supplied imageSize overrides the stored one');
  eq(s4.imageWidth, 200, 'the stored image width is updated');

  const back = updateExportState(s4, 'sizeId', 'original', { width: 200, height: 100 });
  eq(back.width, 200, 'returning to original restores the image size');

  const bad = updateExportState(base, 'sizeId', 'bogus');
  eq(bad.sizeId, 'bogus', 'an unknown preset id is kept');
  eq(bad.width, 100, 'an unknown preset falls back to original dimensions');

  const jpg = updateExportState(base, 'format', 'jpg');
  eq(jpg.format, 'jpg', 'format change is recorded');
  eq(jpg.quality, JPG_QUALITY_DEFAULT, 'switching to jpg resets quality');

  const q = updateExportState(jpg, 'quality', 0.7);
  eq(q.quality, 0.7, 'quality change is recorded');

  const png = updateExportState(jpg, 'format', 'png');
  eq(png.format, 'png', 'format change back to png');
  eq(png.quality, JPG_QUALITY_DEFAULT, 'quality is reset again');
}

/* ── buildExportRequest ──────────────────────────────────────── */
console.log('buildExportRequest');
{
  const s = { ...defaultExportState({ width: 100, height: 50 }), format: 'jpg', quality: 0.8 };
  const req = buildExportRequest(s);
  eq(req, { format: 'jpg', width: 100, height: 50, quality: 0.8, background: DEFAULT_BACKGROUND }, 'a jpg request carries quality');
  eq(req.background, DEFAULT_BACKGROUND, 'the background is included');

  const png = buildExportRequest({ ...s, format: 'png' });
  eq(png.format, 'png', 'a png request is png');
  eq(png.quality, JPG_QUALITY_DEFAULT, 'png ignores quality');

  const bogus = buildExportRequest({ ...s, format: 'gif' });
  eq(bogus.format, 'png', 'an unknown format falls back to png');

  const clamped = buildExportRequest({ ...s, quality: 99 });
  eq(clamped.quality, JPG_QUALITY_MAX, 'quality is clamped in the request');

  const rounded = buildExportStateRounded();
  eq(rounded.width, 100, 'fractional widths are rounded');
}
function buildExportStateRounded() {
  const req = buildExportRequest({ ...defaultExportState({ width: 100.4, height: 50.6 }) });
  return { width: req.width, height: req.height };
}

/* ── describeExport ──────────────────────────────────────────── */
console.log('describeExport');
eq(describeExport({ format: 'png', width: 640, height: 480 }), 'PNG · 640 × 480', 'png description');
eq(describeExport({ format: 'jpg', width: 640, height: 480, quality: 0.9 }), 'JPG · 640 × 480 · 90%', 'jpg description carries quality');
eq(describeExport({ format: 'png', width: 640.4, height: 480.6 }), 'PNG · 640 × 481', 'dimensions are rounded in the description');

/* ── describeBlob ───────────────────────────────────────────── */
console.log('describeBlob');
{
  const info = describeBlob({ size: 2048, type: 'image/png' }, { format: 'png' });
  eq(info.bytes, 2048, 'blob size is read');
  eq(info.mime, 'image/png', 'blob type is read');
  ok(/KB/.test(info.label), 'the label carries a human size');
}
{
  const info = describeBlob({ size: 10, type: '' }, { format: 'jpg' });
  eq(info.mime, 'image/jpeg', 'a typeless jpg blob falls back to the request mime');
}
{
  const info = describeBlob(null, { format: 'png' });
  eq(info.bytes, 0, 'a null blob reports zero bytes');
  eq(info.mime, 'image/png', 'a null blob falls back to the request format');
}

/* ── buildShareText ─────────────────────────────────────────── */
console.log('buildShareText');
{
  const text = buildShareText({ format: 'png', width: 640, height: 480 }, { bytes: 2048 });
  ok(text.includes('WWW_PAINT export'), 'the share text has a title');
  ok(text.includes('PNG · 640 × 480'), 'the share text describes the export');
  ok(text.includes('2 KB'), 'the share text includes the file size');
}
{
  const text = buildShareText({ format: 'png', width: 640, height: 480 });
  eq(text.split('\n').length, 2, 'without a blob there is no size line');
}

/* ── exportFilename ──────────────────────────────────────────── */
console.log('exportFilename');
eq(exportFilename({ format: 'png', sizeId: 'original' }), 'www-paint.png', 'original png filename');
eq(exportFilename({ format: 'png', sizeId: '2x' }), 'www-paint-2x.png', '2x png filename');
eq(exportFilename({ format: 'jpg', sizeId: '4x' }, 'my-painting'), 'my-painting-4x.jpg', 'custom stem and jpg extension');
eq(exportFilename({ format: 'png', sizeId: 'bogus' }), 'www-paint.png', 'an unknown preset has no suffix');

/* ── safeExport ──────────────────────────────────────────────── */
console.log('safeExport');
{
  const r = await safeExport(async () => ({ blob: true }), { failureMessage: 'Export failed.' });
  eq(r.ok, true, 'a resolving call is ok');
  eq(r.value.blob, true, 'the value is passed through');
  eq(r.error, null, 'no error');
}
{
  const r = await safeExport(async () => null, { failureMessage: 'Export failed.' });
  eq(r.ok, false, 'a null result is not ok');
  ok(/Export failed/.test(r.error), 'the failure prefix is used');
}
{
  const r = await safeExport(async () => { throw new Error('canvas too big'); });
  eq(r.ok, false, 'a thrown error is captured');
  ok(/canvas too big/.test(r.error), 'the error message is surfaced');
}
{
  const r = await safeExport(async () => { throw new Error('nope'); }, { failureMessage: 'Could not export.' });
  ok(r.error.startsWith('Could not export.'), 'the prefix comes before the message');
}

/* ── preset / format tables ──────────────────────────────────── */
console.log('tables');
eq(EXPORT_SIZE_PRESETS.map((p) => p.id), ['original', '2x', '4x'], 'three size presets');
eq(EXPORT_FORMATS.map((f) => f.id), ['png', 'jpg'], 'two formats');
ok(EXPORT_FORMATS.every((f) => f.mime.startsWith('image/')), 'every format has an image mime');
ok(EXPORT_SIZE_PRESETS.every((p) => p.label && (p.scale === null || p.scale > 0)), 'every preset has a label and a usable scale');

/* ── summary ─────────────────────────────────────────────────── */
console.log('');
console.log(`Passed: ${pass}  Failed: ${fail}`);
if (fail) {
  console.log('FAILURES:');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
process.exit(0);
