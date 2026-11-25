/**
 * §20 — AUDIT-FIX host (Assessment A follow-up, 2026-11-20, Mac).
 *
 * Runtime fixes for the design-director audit, in the established shim
 * pattern: NO ThinkPad-owned file is edited (app.js / engine.js / controls.js
 * / index.html markup stay byte-identical). Everything here is additive and
 * idempotent; each fix wraps or observes, never replaces.
 *
 * Fixes (audit issue → mechanism):
 *  P0-1  Generate freezes the main thread 26–92 s, uncancellable
 *        → app.generate is wrapped: the synchronous modular planner
 *          (buildModularPlan) is moved into a module Worker built from a
 *          Blob, so the UI thread stays live; Stop actually stops; status
 *          streams. Falls back to the original path if Workers are blocked.
 *  P0-2  Loaded image renders black; frame collapses to native pixel size
 *        → loadImageFile wrapper: frame aspect follows the image, frame is
 *          sized to ~40% of the window (LAYERS parity), and a dimmed source
 *          preview is drawn until the first stroke lands.
 *  P1-4  No undo; Reset / Clear / delete-layer are unguarded
 *        → snapshot undo stack (Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z redo) +
 *          two-step arm/confirm on Reset and Clear Layer + undo toast.
 *  P1-5  Nav pill occludes the canvas header; Generate below the fold
 *        → CSS §20 handles geometry; here: sticky generate row is kept
 *          labelled, and #btn-gener gets a visible busy state.
 *  minor Placeholder clock icon → image icon; 9 px hint → 11 px (CSS);
 *        status errors mirrored next to the action that caused them.
 *
 * Load LAST in index.html (after every panel has mounted).
 * @module audit-fix-host
 */

const VERSION = '2026-11-20a';

/* ── tiny helpers ──────────────────────────────────────────────────────── */

const $ = (s) => document.querySelector(s);

function toast(msg, { undo = false, ms = 5000 } = {}) {
  let el = $('#audit-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'audit-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.innerHTML = '';
  el.appendChild(document.createTextNode(msg));
  if (undo) {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'audit-toast-undo';
    b.textContent = 'Undo';
    b.addEventListener('click', () => { undoAction(); hideToast(); });
    el.appendChild(b);
  }
  el.classList.add('is-visible');
  clearTimeout(el._t);
  el._t = setTimeout(hideToast, ms);
}
function hideToast() { $('#audit-toast')?.classList.remove('is-visible'); }

/* ── undo stack ────────────────────────────────────────────────────────── */

const UNDO_MAX = 20;
let undoStack = [];
let redoStack = [];
let lastUndoLabel = '';

function snapshot(app, label) {
  try {
    const eng = app.engine;
    undoStack.push({
      label,
      layers: JSON.parse(JSON.stringify(eng.layers)),
      multiLayer: !!eng.renderer.multiLayer,
      width: eng.width, height: eng.height,
    });
    if (undoStack.length > UNDO_MAX) undoStack.shift();
    redoStack = [];
    lastUndoLabel = label;
  } catch { /* strokes are plain JSON; a failure here must never break the app */ }
}

function restore(app, snap) {
  const eng = app.engine;
  eng.layers = JSON.parse(JSON.stringify(snap.layers));
  eng.renderer.multiLayer = snap.multiLayer;
  eng.renderer.setLayers(eng.layers);
  // Yielded render — a synchronous eng.render() of 40k strokes freezes the
  // UI thread for ~60s (the same defect the generate wrapper fixes).
  genCancelled = false;
  chunkedRender(app).then(() => {
    app.layers.setLayers(eng.layers);
    app.motion?.refreshStrokeCount?.();
    const ph = $('#canvas-placeholder');
    if (ph) ph.style.display = eng.getTotalStrokes() > 0 || eng._sourceImage ? 'none' : '';
    syncPreview(app);
  });
}

function undoAction() {
  const app = window._wwwPaint;
  if (!app || !undoStack.length) { toast('Nothing to undo'); return; }
  const snap = undoStack.pop();
  try {
    redoStack.push({
      label: snap.label,
      layers: JSON.parse(JSON.stringify(app.engine.layers)),
      multiLayer: !!app.engine.renderer.multiLayer,
      width: app.engine.width, height: app.engine.height,
    });
  } catch { /* ignore */ }
  restore(app, snap);
  toast(`Undid ${snap.label}`);
}

function redoAction() {
  const app = window._wwwPaint;
  if (!app || !redoStack.length) { toast('Nothing to redo'); return; }
  const snap = redoStack.pop();
  undoStack.push({
    label: snap.label,
    layers: JSON.parse(JSON.stringify(app.engine.layers)),
    multiLayer: !!app.engine.renderer.multiLayer,
    width: app.engine.width, height: app.engine.height,
  });
  restore(app, snap);
  toast(`Redid ${snap.label}`);
}

/* ── source preview + frame sizing (P0-2) ──────────────────────────────── */

let previewEl = null;

function ensurePreview() {
  if (previewEl) return previewEl;
  const frame = $('.canvas-frame');
  if (!frame) return null;
  previewEl = document.createElement('img');
  previewEl.id = 'audit-source-preview';
  previewEl.alt = '';
  previewEl.setAttribute('aria-hidden', 'true');
  frame.appendChild(previewEl);
  return previewEl;
}

/** Size the frame to the IMAGE's aspect at ~40% of the window (LAYERS parity). */
function fitFrame(app) {
  const frame = $('.canvas-frame');
  const wrap = $('.canvas-wrapper');
  const eng = app?.engine;
  if (!frame || !wrap || !eng || !eng.width) return;
  const w = eng.width, h = eng.height;
  frame.style.aspectRatio = `${w} / ${h}`;
  // Target ≈40% of window AREA, capped so the frame never touches the edges.
  const wr = wrap.getBoundingClientRect();
  const maxW = wr.width * 0.85, maxH = wr.height * 0.72;
  const targetArea = wr.width * wr.height * 0.40;
  let fw = Math.sqrt(targetArea * (w / h));
  let fh = fw * (h / w);
  if (fw > maxW) { fw = maxW; fh = fw * (h / w); }
  if (fh > maxH) { fh = maxH; fw = fh * (w / h); }
  frame.style.width = `${Math.round(fw)}px`;
  frame.style.height = `${Math.round(fh)}px`;
  frame.style.maxWidth = '85%';
  frame.style.maxHeight = '72%';
  // The canvas fills the frame; its own inline aspect (set by canvas.js)
  // matches the image, so no distortion.
  const canvas = $('#paint-canvas');
  if (canvas) { canvas.style.width = '100%'; canvas.style.height = '100%'; }
}

/** Show the dimmed source until strokes exist; hide once painting starts. */
function syncPreview(app) {
  const eng = app?.engine;
  const el = ensurePreview();
  if (!el || !eng) return;
  const hasStrokes = eng.getTotalStrokes() > 0;
  if (eng._sourceImage && !hasStrokes) {
    try {
      const src = eng._sourceImage;
      if (el._srcFor !== src) {
        const c = document.createElement('canvas');
        c.width = src.width; c.height = src.height;
        c.getContext('2d').drawImage(src, 0, 0);
        el.src = c.toDataURL('image/png');
        el._srcFor = src;
      }
      el.classList.add('is-visible');
    } catch { /* tainted source — skip preview, never break load */ }
  } else {
    el.classList.remove('is-visible');
  }
}

/* ── worker-backed generation (P0-1) ───────────────────────────────────── */

/**
 * The engine's modular branch runs buildModularPlan synchronously on the UI
 * thread (engine.js is BE-owned; the freeze is measured at 26–92 s). We wrap
 * app.generate and run the SAME planner in a module Worker built from a
 * Blob that imports the real ./modular-bridge.js — identical shapes, identical
 * determinism, zero engine edits. The legacy (non-modular) path already
 * streams via Painter/worker and is left untouched.
 */
const WORKER_SRC = `
import { buildModularPlan } from '${new URL('../engine/modular-bridge.js', import.meta.url).href}';
self.onmessage = (e) => {
  const { analysis, args } = e.data;
  try {
    const plan = buildModularPlan(analysis, args);
    self.postMessage({ ok: true, shapes: plan.shapes, used: plan.used });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err && err.message || err) });
  }
};
`;

let genWorker = null;
let genCancelled = false;
let genWallStart = 0;
/** True only while OUR worker-backed run owns the generate path. */
let ownRunActive = false;

function makeGenWorker() {
  const blob = new Blob([WORKER_SRC], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const w = new Worker(url, { type: 'module' });
  URL.revokeObjectURL(url);
  return w;
}

function planInWorker(app, args) {
  return new Promise((resolve, reject) => {
    let w;
    try { w = makeGenWorker(); } catch (e) { reject(e); return; }
    genWorker = w;
    w.onmessage = (e) => {
      w.terminate(); genWorker = null;
      if (e.data.ok) resolve(e.data);
      else reject(new Error(e.data.error));
    };
    w.onerror = (e) => {
      w.terminate(); genWorker = null;
      reject(new Error(e.message || 'planner worker failed'));
    };
    // analysis holds typed arrays + plain data; structured-clone safe.
    w.postMessage({ analysis: app.engine._analysis, args });
  });
}

/** Mirror of engine.js's modular assignment (single + multi layer). */
function assignPlan(app, shapes, { multiLayer, layerIdx }) {
  const eng = app.engine;
  if (multiLayer) {
    const named = eng._initMultiLayerLayers();
    const byName = {};
    for (const l of named) byName[l._name] = l;
    for (const s of shapes) {
      const ln = s.layerName || 'midtone';
      (byName[ln] || byName.midtone).strokes.push(s);
    }
    eng.layers = named;
    eng.renderer.multiLayer = true;
  } else {
    const layer = eng.getLayer(layerIdx);
    if (layer) layer.strokes = shapes;
    eng.renderer.multiLayer = false;
  }
  eng.renderer.setLayers(eng.layers);
  eng._lastCount = shapes.length;
}

function setBusy(app, busy) {
  const round = $('#btn-gener');
  const gen = app.controls?.root?.querySelector('[data-action="generate"]');
  const stop = app.controls?.root?.querySelector('[data-action="stop"]');
  if (round) {
    round.classList.toggle('is-generating', busy);
    // Keep the accessible name STABLE — Maestro flows assert "Generate
    // painting"; the busy affordance is visual + title only.
    round.title = busy ? 'Generating — click to stop' : 'Generate painting';
  }
  if (gen) gen.toggleAttribute('disabled', busy);
  if (stop) stop.toggleAttribute('disabled', !busy);
  document.body.classList.toggle('audit-generating', busy);
}

/**
 * The original app.generate ends with a SYNCHRONOUS eng.render() of every
 * stroke (the second freeze, measured ~60 s for 40 k strokes on the portrait
 * fixture). We neutralise that one call during our wrapped run and render in
 * rAF-yielding chunks instead, so the UI never blocks.
 */
async function chunkedRender(app, onProgress) {
  const eng = app.engine;
  const layers = [...eng.layers].sort((a, b) => a.id - b.id);
  app.canvasMgr.render({ progress: 0, clear: true });
  let done = 0;
  const total = Math.max(1, eng.getTotalStrokes());
  const CHUNK = Math.max(64, Math.round(total / 90));
  for (const layer of layers) {
    if (!layer.visible) continue;
    const strokes = layer.strokes || [];
    for (let i = 0; i < strokes.length; i += CHUNK) {
      if (genCancelled) return;
      const end = Math.min(strokes.length, i + CHUNK);
      for (let j = i; j < end; j++) {
        try { app.canvasMgr.drawStroke(strokes[j], 1); } catch { /* one bad shape must not kill the pass */ }
      }
      done += end - i;
      onProgress?.(Math.min(done, total), total);
      await new Promise((r) => requestAnimationFrame(r));
    }
  }
}

function wrapGenerate(app) {
  const origGenerate = app.generate.bind(app);
  app.generate = async function (...a) {
    const eng = app.engine;
    const modular = !!eng.settings?.modular;
    // Legacy path already streams off-thread — leave it alone.
    if (!modular || !eng._analysis || !eng._sourceImage || app._generating) {
      return origGenerate(...a);
    }
    const opts = a[0] || {};
    const settings = app.controls.getSettings();
    eng.setSettings(settings);
    const style = opts.style || settings.style || 'pencil';
    const count = opts.count || settings.strokeCount || 5000;
    const seed = opts.seed !== undefined ? opts.seed : eng._seed;
    const multiLayer = opts.multiLayer !== undefined ? opts.multiLayer : (settings.multiLayer || false);
    const layerIdx = opts.layer !== undefined ? opts.layer : 0;

    snapshot(app, 'generation');
    app._generating = true;
    ownRunActive = true;
    genCancelled = false;
    genWallStart = performance.now();
    setBusy(app, true);
    app._setStatus('Planning strokes… (Stop to cancel)', true);
    const t0 = performance.now();
    try {
      const args = {
        enabled: true, style, count, seed,
        layerStyles: eng.settings.layerStyles,
        layerBands: multiLayer ? 'bands' : false,
        width: eng.width, height: eng.height,
        smart: settings.smart, order: settings.order,
      };
      // forward the same lever keys engine.js forwards, when present
      for (const k of ['strokeElongation', 'strokeWidthScale', 'strokeBudgetScale',
        'strokeStructureAlign', 'strokeAlpha', 'contourStrokes', 'paletteSize',
        'quantiseColours', 'dabsAsStrokes', 'chainDabs', 'outlineBudgetFrac', 'outlineMax']) {
        if (opts[k] !== undefined) args[k] = opts[k];
        else if (eng.settings[k] !== undefined) args[k] = eng.settings[k];
      }
      const { shapes, used } = await planInWorker(app, args);
      if (genCancelled) { app._setStatus('Generation stopped', false, 3000); return []; }
      if (!used || !shapes.length) {
        // planner declined — fall back to the original engine path
        app._generating = false; ownRunActive = false; setBusy(app, false);
        return origGenerate(...a);
      }
      assignPlan(app, shapes, { multiLayer, layerIdx });
      // Stream the render in rAF-yielding chunks so the UI stays live and the
      // user WATCHES the painting arrive (the audit's "the wait is the show").
      syncPreview(app);
      const total = shapes.length;
      await chunkedRender(app, (done, tot) => {
        app._setStatus(`Painting… ${done.toLocaleString()} / ${tot.toLocaleString()} strokes`, true);
      });
      if (!genCancelled) {
        app.layers.setLayers(eng.layers);
        app.motion?.refreshStrokeCount?.();
        const ms = Math.round(performance.now() - t0);
        app._setStatus(`Done — ${total.toLocaleString()} strokes in ${ms}ms`, false, 5000);
      } else {
        app.layers.setLayers(eng.layers);
        app.motion?.refreshStrokeCount?.();
        app._setStatus('Generation stopped', false, 3000);
      }
      return shapes;
    } catch (err) {
      console.warn('[audit-fix] worker planner failed, falling back:', err.message);
      app._generating = false; ownRunActive = false; setBusy(app, false);
      return origGenerate(...a);
    } finally {
      app._generating = false;
      ownRunActive = false;
      genWorker?.terminate(); genWorker = null;
      setBusy(app, false);
    }
  };

  // Stop must cancel OUR path too (the original only knows Painter/worker).
  const origStop = app.stopGeneration.bind(app);
  app.stopGeneration = function () {
    if (ownRunActive) {
      genCancelled = true;
      genWorker?.terminate(); genWorker = null;
      ownRunActive = false;
      app._generating = false;
      setBusy(app, false);
      app._setStatus('Generation stopped', false, 3000);
      app.layers?.setLayers(app.engine.layers);
      app.motion?.refreshStrokeCount?.();
      return;
    }
    origStop();
  };
  // Round Generate button doubles as Stop while busy.
  $('#btn-gener')?.addEventListener('click', (e) => {
    if (ownRunActive) {
      e.stopImmediatePropagation();
      app.stopGeneration();
    }
  }, true);
}

/* ── load wrapper: frame + preview (P0-2) ──────────────────────────────── */

function wrapLoad(app) {
  const orig = app.loadImageFile.bind(app);
  app.loadImageFile = async function (file) {
    const r = await orig(file);
    fitFrame(app);
    syncPreview(app);
    return r;
  };
  // drag-drop + project-import paths call engine.loadImage directly; observe
  // the dims readout instead (it is updated by every load path).
  const dims = $('#canvas-dims');
  if (dims) {
    new MutationObserver(() => { fitFrame(app); syncPreview(app); })
      .observe(dims, { childList: true, characterData: true, subtree: true });
  }
  window.addEventListener('resize', () => fitFrame(app));
}

/* ── guarded destructive actions + undo shortcuts (P1-4) ───────────────── */

function armButton(btn, label, action) {
  if (!btn || btn._auditArmed) return;
  btn._auditArmed = true;
  let armed = false, timer = null;
  const original = btn.textContent;
  btn.addEventListener('click', (e) => {
    if (!armed) {
      e.stopImmediatePropagation();
      e.preventDefault();
      armed = true;
      btn.classList.add('is-armed');
      btn.textContent = `Sure? ${label}`;
      timer = setTimeout(() => {
        armed = false; btn.classList.remove('is-armed'); btn.textContent = original;
      }, 3500);
      return;
    }
    clearTimeout(timer);
    armed = false; btn.classList.remove('is-armed'); btn.textContent = original;
    // second click: let the original handler run
  }, true);
}

function wrapDestructive(app) {
  const origReset = app.resetCanvas.bind(app);
  app.resetCanvas = async function () {
    if (app.engine.getTotalStrokes() > 0) snapshot(app, 'reset');
    const r = await origReset();
    syncPreview(app);
    if (undoStack.length && lastUndoLabel === 'reset') toast('Canvas reset', { undo: true });
    return r;
  };
  const resetBtn = app.controls?.root?.querySelector('[data-action="reset"]');
  armButton(resetBtn, 'Reset', null);

  const clearBtn = $('#paint-clear');
  if (clearBtn) {
    armButton(clearBtn, 'Clear', null);
    // snapshot before the original handler clears (capture runs first)
    clearBtn.addEventListener('click', () => {
      if (clearBtn.classList.contains('is-armed')) return; // first click only armed
      snapshot(app, 'clear layer');
    }, true);
  }

  // layer delete: snapshot on the panel's event (fires before app handles it)
  app.layers?.root?.addEventListener('layer-delete', () => snapshot(app, 'layer delete'), true);
  app.layers?.root?.addEventListener('layer-add', () => snapshot(app, 'layer add'), true);

  document.addEventListener('keydown', (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redoAction(); else undoAction();
    } else if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault(); redoAction();
    }
  });
}

/* ── small polish ──────────────────────────────────────────────────────── */

function polish(app) {
  // Primary action always visible: move the generate/stop/reset row OUT of
  // the scroll host into the panel's flex column, pinned at the bottom.
  // (sticky-inside overlapped the last section in Maestro's viewport.)
  const panel = $('#controls-root');
  const scroll = panel?.querySelector('.controls-scroll');
  const genRow = panel?.querySelector('.generate-btn-container');
  if (panel && scroll && genRow && genRow.parentElement === scroll) {
    panel.appendChild(genRow);
    genRow.classList.add('audit-pinned-actions');
  }
  // Placeholder: clock icon → image icon (same 1.5px stroke language).
  const icon = $('.canvas-placeholder__icon svg');
  if (icon && !icon._auditFixed) {
    icon._auditFixed = true;
    icon.innerHTML = '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m5 17 4.5-4.5 3 3L16 12l3 3"/>';
  }
  // Errors mirror next to the Generate button (the audit: cause top-right,
  // message bottom-right). Observe the live status node.
  const msg = $('#status-message');
  if (msg) {
    new MutationObserver(() => {
      const err = msg.classList.contains('status__error');
      const round = $('#btn-gener');
      if (round) round.classList.toggle('has-error-nearby', err);
      if (err) toast(msg.textContent, { ms: 4000 });
    }).observe(msg, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }
  // Nav/action buttons without titles get one (shell-swap: .insert-btn replaced .round-btn).
  document.querySelectorAll('.rail-icons .nav-btn, .insert-bar .insert-btn').forEach((b) => {
    if (!b.title) b.title = b.getAttribute('aria-label') || b.textContent.trim();
  });
  // Keep the frame fitted once fonts/layout settle.
  requestAnimationFrame(() => { fitFrame(app); syncPreview(app); });
}

/* ── init ──────────────────────────────────────────────────────────────── */

export function initAuditFix() {
  const app = window._wwwPaint;
  if (!app || window.__auditFixApplied === VERSION) return;
  window.__auditFixApplied = VERSION;
  wrapGenerate(app);
  wrapLoad(app);
  wrapDestructive(app);
  polish(app);
}
