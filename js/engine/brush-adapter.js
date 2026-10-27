/**
 * brush-adapter.js — Runtime adapter bridging vendored p5.brush to our canvas.
 *
 * p5.brush standalone needs 4 runtime callbacks registered before use:
 *   createColor(r,g,b,a) → color object
 *   getAffineMatrix()    → 2D transform matrix
 *   notifyDraw()         → per-stamp notification (optional)
 *   usesRadians/fromDegrees → angle unit preferences
 *
 * Plus 7 runtime methods it calls on its host:
 *   load, syncDensity, isCanvasReady, instance, activateInstance,
 *   deactivateInstance, getActiveFramebuffer, isFramebufferTarget
 *
 * And 6 compositor methods:
 *   clearTarget, ensureBlendShaderProgram, ensureBlendSourceFramebuffer,
 *   createFramebuffer, runBlendShaderPass, blitSourceToFramebuffer
 *
 * For our 2D auto-paint pipeline the compositor methods are no-ops —
 * p5.brush stamps directly onto the canvas context we provide.
 */

export function createBrushAdapter(ctx, width, height) {
  let _activeInstance = null;

  return {
    // ── Runtime callbacks ───────────────────────────────────────────
    createColor(r, g, b, a = 1) {
      return { r: r / 255, g: g / 255, b: b / 255, a };
    },

    getAffineMatrix() {
      // Identity matrix — our transforms are applied via canvas API
      return { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
    },

    notifyDraw() {
      // No-op — renderer composites after each shape
    },

    usesRadians: false,
    fromDegrees: d => d,

    // ── Brush instance lifecycle ────────────────────────────────────
    instance(opts = {}) {
      return {
        canvas: opts.canvas || null,
        ctx: ctx,
        width,
        height,
        brushName: opts.brushName || 'cpencil',
        color: opts.color,
        size: opts.size || 10,
        opacity: opts.opacity ?? 1,
        angle: opts.angle || 0,
        scatter: opts.scatter || 0,
        spacing: opts.spacing || 0.2,
        pressure: opts.pressure || [],
        grain: opts.grain || 0,
        _active: false,
      };
    },

    activateInstance(inst) {
      _activeInstance = inst;
      if (inst && inst.ctx) {
        inst.ctx.save();
      }
    },

    deactivateInstance() {
      if (_activeInstance && _activeInstance.ctx) {
        _activeInstance.ctx.restore();
      }
      _activeInstance = null;
    },

    getActiveFramebuffer() {
      return null;
    },

    isFramebufferTarget(target) {
      return target === null;
    },

    isCanvasReady() {
      return !!ctx && width > 0 && height > 0;
    },

    // ── Compositor stubs (2D path: no WebGL blend passes needed) ────
    clearTarget() {},
    ensureBlendShaderProgram() {},
    ensureBlendSourceFramebuffer() {},
    createFramebuffer(w, h) {
      // Return a simple offscreen canvas for p5.brush to use internally
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    },
    runBlendShaderPass() {},
    blitSourceToFramebuffer() {},

    // ── Config ──────────────────────────────────────────────────────
    Cwidth: width,
    Cheight: height,
    Density: 1,
    Instance: null,
    Renderer: null,

    syncDensity() {},
    load() {},
  };
}

/**
 * Install the adapter onto the brushLib module.
 * Call before any brush operations.
 *
 * @param {object} brushLib - The imported p5.brush module
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @returns {object} adapter instance
 */
export function installBrushAdapter(brushLib, ctx, width, height) {
  const adapter = createBrushAdapter(ctx, width, height);

  // Register runtime callbacks
  brushLib.h({
    createColor: adapter.createColor,
    getAffineMatrix: adapter.getAffineMatrix,
    notifyDraw: adapter.notifyDraw,
    usesRadians: false,
    fromDegrees: d => d,
  });

  // Register config
  brushLib.f({ Cwidth: width, Cheight: height, Density: 1 });

  // Register runtime + compositor adapters
  brushLib.u = {
    load: () => {},
    syncDensity: () => adapter.Density,
    isCanvasReady: () => adapter.isCanvasReady(),
    instance: (opts) => adapter.instance(opts),
    activateInstance: (inst) => adapter.activateInstance(inst),
    deactivateInstance: () => adapter.deactivateInstance(),
    getActiveFramebuffer: () => adapter.getActiveFramebuffer(),
    isFramebufferTarget: (t) => adapter.isFramebufferTarget(t),
  };

  brushLib.b = {
    clearTarget: () => adapter.clearTarget(),
    ensureBlendShaderProgram: () => adapter.ensureBlendShaderProgram(),
    ensureBlendSourceFramebuffer: () => adapter.ensureBlendSourceFramebuffer(),
    createFramebuffer: (w, h) => adapter.createFramebuffer(w, h),
    runBlendShaderPass: () => adapter.runBlendShaderPass(),
    blitSourceToFramebuffer: () => adapter.blitSourceToFramebuffer(),
  };

  return adapter;
}
