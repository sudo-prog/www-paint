/**
 * export-panel-core.js — Mac-owned PURE core for the export & share panel
 * (Phase 6 / Track-S S7 UI half · stream M11).
 *
 * No DOM, no engine imports, no network. Everything here is node-testable.
 *
 * The panel itself (`js/ui/export-panel.js`) only renders rows and forwards
 * intent; every decision — which size preset fits an image, what the share
 * text says, which error is worth showing — lives here so it can be proved in
 * `node` in milliseconds instead of in a browser.
 *
 * The panel wraps ThinkPad-owned files (`js/engine/exporter.js`,
 * `engine.exportPNG`) and never edits them. The engine's own export surface is
 * the contract; this module only decides WHAT to ask it for.
 *
 * @module export-panel-core
 */

/** The export size presets. `scale: null` means "use the image's own size". */
export const EXPORT_SIZE_PRESETS = Object.freeze([
  Object.freeze({ id: 'original', label: 'Original', scale: null }),
  Object.freeze({ id: '2x', label: '2×', scale: 2 }),
  Object.freeze({ id: '4x', label: '4×', scale: 4 }),
]);

/** The image formats the panel offers. */
export const EXPORT_FORMATS = Object.freeze([
  Object.freeze({ id: 'png', label: 'PNG', mime: 'image/png', lossless: true }),
  Object.freeze({ id: 'jpg', label: 'JPG', mime: 'image/jpeg', lossless: false }),
]);

/** JPG quality bounds — the engine's exporter clamps nothing, so we do. */
export const JPG_QUALITY_MIN = 0.1;
export const JPG_QUALITY_MAX = 1;
export const JPG_QUALITY_DEFAULT = 0.92;
export const JPG_QUALITY_STEP = 0.05;

/**
 * Hard bounds so a runaway preset cannot ask for a 200 Mpx canvas.
 *
 * The real ceiling is the browser's canvas-area limit (~268 Mpx in Chromium).
 * `MAX_EXPORT_PIXELS` is set well below that at 64 Mpx: an export that a user
 * asks for at 4× a normal photo lands around 40–80 Mpx, so a cap at the raw
 * browser limit would let the tab die before the encoder ever complained.
 */
export const MAX_EXPORT_DIMENSION = 16384;
export const MAX_EXPORT_PIXELS = 8192 * 8192;

/** The default background offered when exporting a transparent PNG. */
export const DEFAULT_BACKGROUND = '#ffffff';

const round1 = (n) => Math.round(n * 10) / 10;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * A formatted byte count for the status line.
 *
 * @param {number} bytes
 * @returns {string} e.g. `"1.4 MB"`
 */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${round1(bytes / 1024)} KB`;
  return `${round1(bytes / (1024 * 1024))} MB`;
}

/**
 * The dimensions an export will produce for a given image size and preset.
 *
 * `scale: null` keeps the image's own dimensions. Results are integers and are
 * clamped to {@link MAX_EXPORT_DIMENSION} on BOTH axes independently, so a
 * 20000×100 image yields 16384×100 rather than being dropped.
 *
 * @param {{width:number, height:number}} imageSize
 * @param {{scale:number|null}} preset
 * @returns {{width:number, height:number, scale:number}}
 */
export function resolveExportSize(imageSize, preset) {
  const srcW = Number(imageSize && imageSize.width) || 0;
  const srcH = Number(imageSize && imageSize.height) || 0;
  const scale = preset && Number.isFinite(preset.scale) ? preset.scale : 1;
  const scaleIsAuto = !preset || preset.scale === null || preset.scale === undefined;

  if (scaleIsAuto) {
    return {
      width: clamp(Math.round(srcW), 0, MAX_EXPORT_DIMENSION),
      height: clamp(Math.round(srcH), 0, MAX_EXPORT_DIMENSION),
      scale: 1,
    };
  }

  return {
    width: clamp(Math.round(srcW * scale), 0, MAX_EXPORT_DIMENSION),
    height: clamp(Math.round(srcH * scale), 0, MAX_EXPORT_DIMENSION),
    scale,
  };
}

/**
 * Clamp a JPG quality into the exporter's usable range.
 *
 * @param {number} q
 * @returns {number}
 */
export function clampQuality(q) {
  const n = Number(q);
  if (!Number.isFinite(n)) return JPG_QUALITY_DEFAULT;
  return clamp(n, JPG_QUALITY_MIN, JPG_QUALITY_MAX);
}

/**
 * Whether an export at these dimensions can be attempted at all.
 *
 * The canvas encoder will refuse (or the tab will die) past ~16384px or ~268
 * Mpx, so the panel reports the reason instead of letting the engine throw.
 *
 * @param {number} width
 * @param {number} height
 * @returns {{ok:boolean, reason:string|null}}
 */
export function checkExportFeasible(width, height) {
  const w = Math.round(Number(width) || 0);
  const h = Math.round(Number(height) || 0);
  if (w <= 0 || h <= 0) {
    return { ok: false, reason: 'There is no painting to export yet.' };
  }
  if (w > MAX_EXPORT_DIMENSION || h > MAX_EXPORT_DIMENSION) {
    return {
      ok: false,
      reason: `That size is beyond the browser's canvas limit (${MAX_EXPORT_DIMENSION.toLocaleString()}px).`,
    };
  }
  if (w * h > MAX_EXPORT_PIXELS) {
    return {
      ok: false,
      reason: 'That size is too many pixels for the browser to encode.',
    };
  }
  return { ok: true, reason: null };
}

/**
 * Build the default panel state from an image size.
 *
 * Pure: the panel calls this on mount and after every image load, so the state
 * it renders is always derivable from the image alone.
 *
 * @param {{width:number, height:number}} imageSize
 * @returns {object}
 */
export function defaultExportState(imageSize = { width: 0, height: 0 }) {
  const size = resolveExportSize(imageSize, EXPORT_SIZE_PRESETS[0]);
  return {
    sizeId: 'original',
    format: 'png',
    quality: JPG_QUALITY_DEFAULT,
    background: DEFAULT_BACKGROUND,
    width: size.width,
    height: size.height,
    imageWidth: Number(imageSize && imageSize.width) || 0,
    imageHeight: Number(imageSize && imageSize.height) || 0,
  };
}

/**
 * Recompute the state when the user changes ONE field.
 *
 * Returns a NEW state object; the caller decides whether to render it. Width
 * and height follow the preset unless the preset is "original", in which case
 * they follow the image.
 *
 * @param {object} state - the current panel state
 * @param {string} key - the field that changed (`sizeId` | `format` | `quality`)
 * @param {*} value - the new value
 * @param {{width:number, height:number}} [imageSize] - overrides the stored one
 * @returns {object} the next state
 */
export function updateExportState(state, key, value, imageSize) {
  const img = imageSize || { width: state.imageWidth, height: state.imageHeight };
  const next = { ...state, imageWidth: img.width, imageHeight: img.height };

  if (key === 'sizeId') {
    next.sizeId = value;
    const preset = EXPORT_SIZE_PRESETS.find((p) => p.id === value) || EXPORT_SIZE_PRESETS[0];
    const size = resolveExportSize(img, preset);
    next.width = size.width;
    next.height = size.height;
  } else if (key === 'format') {
    next.format = value;
    if (value !== 'jpg') next.quality = JPG_QUALITY_DEFAULT;
  } else if (key === 'quality') {
    next.quality = clampQuality(value);
  }

  return next;
}

/**
 * The export request the panel hands to the engine wrapper.
 *
 * Deliberately in the engine's own vocabulary (`format`, `width`, `height`,
 * `quality`, `background`) so the host shim is a one-line translation.
 *
 * @param {object} state
 * @returns {{format:string, width:number, height:number, quality:number, background:string}}
 */
export function buildExportRequest(state) {
  const format = state.format === 'jpg' ? 'jpg' : 'png';
  return {
    format,
    width: Math.round(state.width) || 0,
    height: Math.round(state.height) || 0,
    quality: format === 'jpg' ? clampQuality(state.quality) : JPG_QUALITY_DEFAULT,
    background: state.background || DEFAULT_BACKGROUND,
  };
}

/**
 * The summary text shown under the controls: what will be produced.
 *
 * @param {object} state
 * @returns {string}
 */
export function describeExport(state) {
  const fmt = state.format === 'jpg' ? 'JPG' : 'PNG';
  const dims = `${Math.round(state.width)} × ${Math.round(state.height)}`;
  const quality = state.format === 'jpg'
    ? ` · ${Math.round(clampQuality(state.quality) * 100)}%`
    : '';
  return `${fmt} · ${dims}${quality}`;
}

/**
 * A short human description of a Blob the engine produced.
 *
 * Reads the blob's own size and type; never trusts the request.
 *
 * @param {Blob} blob
 * @param {object} [req] - the request that produced it
 * @returns {{bytes:number, mime:string, label:string}}
 */
export function describeBlob(blob, req = {}) {
  const bytes = blob && Number.isFinite(blob.size) ? blob.size : 0;
  const mime = (blob && blob.type) || (req.format === 'jpg' ? 'image/jpeg' : 'image/png');
  return { bytes, mime, label: `${formatBytes(bytes)} ${mime.split('/')[1] || 'file'}` };
}

/**
 * Build the copy-to-clipboard share text for an export.
 *
 * Deliberately plain text (not JSON) — it is meant to be pasted into a chat or
 * a ticket, so it reads like a caption.
 *
 * @param {object} state
 * @param {{bytes:number, mime:string}} [blobInfo]
 * @returns {string}
 */
export function buildShareText(state, blobInfo = null) {
  const lines = [
    'WWW_PAINT export',
    describeExport(state),
    blobInfo && blobInfo.bytes ? `file size: ${formatBytes(blobInfo.bytes)}` : null,
  ];
  return lines.filter(Boolean).join('\n');
}

/**
 * The filename the download should use.
 *
 * @param {object} state
 * @param {string} [stem='www-paint']
 * @returns {string}
 */
export function exportFilename(state, stem = 'www-paint') {
  const ext = state.format === 'jpg' ? 'jpg' : 'png';
  const size = EXPORT_SIZE_PRESETS.find((p) => p.id === state.sizeId);
  const suffix = size && size.scale ? `-${size.scale}x` : '';
  return `${stem}${suffix}.${ext}`;
}

/**
 * Wrap an async engine call so a failure becomes a status message instead of an
 * unhandled rejection.
 *
 * The engine's exporter can reject (no source image, canvas too large, encoder
 * failure). The panel must never crash the page because of it.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {object} [out]
 * @param {string} [out.failureMessage] - prefix for the error text
 * @returns {Promise<{ok:boolean, value:T|null, error:string|null}>}
 */
export async function safeExport(fn, out = {}) {
  try {
    const value = await fn();
    if (!value) {
      return {
        ok: false,
        value: null,
        error: out.failureMessage || 'The export produced nothing.',
      };
    }
    return { ok: true, value, error: null };
  } catch (err) {
    return {
      ok: false,
      value: null,
      error: (out.failureMessage ? out.failureMessage + ' ' : '')
        + (err && err.message ? err.message : String(err)),
    };
  }
}

export default {
  EXPORT_SIZE_PRESETS,
  EXPORT_FORMATS,
  JPG_QUALITY_MIN,
  JPG_QUALITY_MAX,
  JPG_QUALITY_DEFAULT,
  JPG_QUALITY_STEP,
  MAX_EXPORT_DIMENSION,
  MAX_EXPORT_PIXELS,
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
};
