/**
 * dli-paint-backend.js — Production bridge between WWW_PAINT and the dli/paint engine.
 * Creates an OffscreenCanvas (never touched by 2D context), constructs WrappedGL + Paint,
 * exposes a stroke API taking WWW_PAINT shape/stroke data, composites the shaded readback
 * onto the caller's 2D canvas with drawImage + globalAlpha, and masks the upstream grey
 * background to transparent. Falls back gracefully when WebGL is unavailable.
 */

import { WrappedGL } from './dli-paint/wrappedgl.module.js';
import SimulatorModule from './dli-paint/simulator.module.js';
import { Paint } from './dli-paint/paint.module.js';
import { Rectangle } from './dli-paint/rectangle.js';
import { Utilities } from './dli-paint/utilities.js';
import {
    MAX_BRISTLE_COUNT, MIN_BRISTLE_COUNT, BRUSH_HEIGHT, Z_THRESHOLD,
    SPLAT_VELOCITY_SCALE, SPLAT_RADIUS,
    NORMAL_SCALE, ROUGHNESS, F0, SPECULAR_SCALE, DIFFUSE_SCALE, LIGHT_DIRECTION,
    BACKGROUND_GRAY,
    FRAMES_TO_SIMULATE,
    SHADER_FILES
} from './dli-paint/index.js';

// ─── Constants ────────────────────────────────────────────────────────────────

var InteractionMode = { NONE: 0, PAINTING: 1, RESIZING: 2, PANNING: 3 };
var ColorModel = { RYB: 0, RGB: 1 };

var QUALITIES = [
    { name: 'Low', resolutionScale: 1.0 },
    { name: 'Medium', resolutionScale: 1.5 },
    { name: 'High', resolutionScale: 2.0 }
];
var INITIAL_QUALITY = 1;
var INITIAL_PADDING = 100;
var MIN_PAINTING_WIDTH = 300;
var MAX_PAINTING_WIDTH = 4096;

var THIN_MIN_ALPHA = 0.002;
var THIN_MAX_ALPHA = 0.08;
var THICK_MIN_ALPHA = 0.002;
var THICK_MAX_ALPHA = 0.025;

var PANEL_WIDTH = 300;
var PANEL_HEIGHT = 580;
var PANEL_BLUR_SAMPLES = 13;
var PANEL_BLUR_STRIDE = 8;
var RESIZING_RADIUS = 20;
var RESIZING_FEATHER_SIZE = 8;
var BOX_SHADOW_SIGMA = 5.0;
var BOX_SHADOW_WIDTH = 10.0;
var PAINTING_SHADOW_ALPHA = 0.5;
var HISTORY_SIZE = 4;

// Upstream background grey used for masking (exact value from paint.js)
const UPSTREAM_BG_GRAY = BACKGROUND_GRAY; // 0.7 (linear, as cleared by painting.frag)
// The painting pass clears the canvas texture to BACKGROUND_GRAY in LINEAR space.
// The 8-bit sRGB readback of that clear is 244,244,244 — NOT round(0.7*255)=179.
// Masking against 179 left the whole background opaque, so every render reported
// 100% ink with zero chroma. Use the MEASURED sRGB value.
const UPSTREAM_BG_GRAY_255 = 244;
const UPSTREAM_BG_TOLERANCE = 3;

// ─── Helpers (verbatim from paint.js) ────────────────────────────────────────

function pascalRow(n) {
    var line = [1];
    for (var k = 0; k < n; ++k) { line.push(line[k] * (n - k) / (k + 1)); }
    return line;
}

function makeBlurShader(width) {
    var coefficients = pascalRow(width - 1 + 2);
    coefficients.shift(); coefficients.pop();
    var normalizationFactor = 0;
    for (var i = 0; i < coefficients.length; ++i) { normalizationFactor += coefficients[i]; }
    var shader = ['precision highp float;', 'uniform sampler2D u_input;', 'uniform vec2 u_step;', 'uniform vec2 u_resolution;', 'void main () {', '  vec4 total = vec4(0.0);', '  vec2 coordinates = gl_FragCoord.xy / u_resolution;', '  vec2 delta = u_step / u_resolution;'].join('\n');
    shader += '\n';
    for (var i = 0; i < width; ++i) {
        var offset = i - (width - 1) / 2;
        shader += '  total += texture2D(u_input, coordinates + delta * ' + offset.toFixed(1) + ') * ' + coefficients[i].toFixed(1) + '; \n';
    }
    shader += '  gl_FragColor = total / ' + normalizationFactor.toFixed(1) + ';\n }';
    return shader;
}

function hsvToRyb(h, s, v) {
    h = h % 1;
    var c = v * s, hDash = h * 6;
    var x = c * (1 - Math.abs(hDash % 2 - 1));
    var mod = Math.floor(hDash);
    var r = [c, x, 0, 0, x, c][mod], g = [x, c, c, x, 0, 0][mod], b = [0, 0, x, c, c, x][mod];
    var m = v - c; r += m; g += m; b += m;
    return [r, g, b];
}

function makeOrthographicMatrix(matrix, left, right, bottom, top, near, far) {
    matrix[0] = 2 / (right - left); matrix[1] = 0; matrix[2] = 0; matrix[3] = 0;
    matrix[4] = 0; matrix[5] = 2 / (top - bottom); matrix[6] = 0; matrix[7] = 0;
    matrix[8] = 0; matrix[9] = 0; matrix[10] = -2 / (far - near); matrix[11] = 0;
    matrix[12] = -(right + left) / (right - left);
    matrix[13] = -(top + bottom) / (top - bottom);
    matrix[14] = -(far + near) / (far - near);
    matrix[15] = 1;
    return matrix;
}

function mix(a, b, t) { return (1.0 - t) * a + t * b; }

function Snapshot(texture, paintingWidth, paintingHeight, resolutionScale) {
    this.texture = texture; this.paintingWidth = paintingWidth; this.paintingHeight = paintingHeight; this.resolutionScale = resolutionScale;
}
Snapshot.prototype.getTextureWidth = function () { return Math.ceil(this.paintingWidth * this.resolutionScale); };
Snapshot.prototype.getTextureHeight = function () { return Math.ceil(this.paintingHeight * this.resolutionScale); };

// ─── Internal Paint instance (headless, no DOM event handlers) ───────────────
// NOTE: the float extensions MUST be requested before ANY float/half-float
// texture is created. Upstream dli/paint does this at the top of `Paint`'s
// constructor. The port had it in a DEAD helper, so the Simulator's textures were
// allocated before the extension existed: texImage2D failed with INVALID_ENUM
// (1280), every simulation texture stayed zeroed, and the painting read back as
// a uniform wash. Requesting them here — before the Simulator is constructed —
// is the fix.

// ─── Backend class ───────────────────────────────────────────────────────────

export class DliPaintBackend {
    constructor() {
        this.paint = null;
        this.wgl = null;
        this.offscreenCanvas = null;
        this.ready = false;
        this.fallbackMode = false;
        this.counters = { strokes: 0, fallbackCount: 0 };
        this.initError = null;
    }

    async initialize(width, height) {
        // Create OffscreenCanvas that has NEVER had getContext('2d') called.
        // A canvas yields ONE context type: asking for '2d' here would PERMANENTLY
        // block WebGL, so the 2D context must never be requested on this canvas.
        this.offscreenCanvas = new OffscreenCanvas(width, height);

        // WrappedGL.create() is the public factory AND the owner of the context
        // lookup. Let it create the context exactly once — asking for 'webgl'
        // here as well would race the factory's own getContext call.
        // OffscreenCanvas.getContext only accepts the OffscreenRenderingContextType
        // enum, so 'experimental-webgl' THROWS there; the wrapper handles that.
        this.wgl = WrappedGL.create(this.offscreenCanvas, { preserveDrawingBuffer: true, alpha: true });
        if (!this.wgl || !this.wgl.gl) {
            console.warn('[dli-paint-backend] WebGL unavailable, falling back to 2D');
            this.fallbackMode = true;
            return { fallback: true };
        }
        var gl = this.wgl.gl;

        // Load all shaders
        try {
            var shaderSources = await this._loadShaders();
            this.paint = await this._initPaint(shaderSources, width, height);
            this.ready = true;
            this.initError = null;
            return { fallback: false };
        } catch (err) {
            // A half-built instance is worse than none: record WHY and stay not-ready.
            this.initError = err && err.message ? err.message : String(err);
            this.ready = false;
            console.warn('[dli-paint-backend] init failed:', this.initError);
            throw err;
        }
    }

    _loadShaders() {
        return new Promise(function (resolve, reject) {
            // Shaders live in ./dli-paint/shaders/ — resolve against THIS module's
            // directory, not the site root and not js/engine/.
            var moduleBase = new URL('./dli-paint/', import.meta.url);
            var urls = SHADER_FILES.map(function (p) { return new URL(p, moduleBase).href; });
            var results = {};
            var loaded = 0;
            urls.forEach(function (url, idx) {
                fetch(url)
                    .then(function (r) { if (!r.ok) throw new Error('Failed to load ' + url); return r.text(); })
                    .then(function (text) { results[SHADER_FILES[idx]] = text; loaded++; if (loaded === urls.length) resolve(results); })
                    .catch(reject);
            });
        });
    }

    async _initPaint(shaderSources, width, height) {
        var wgl = this.wgl;
        var paint = Object.create(Paint.prototype);
        paint.canvas = this.offscreenCanvas;
        paint.wgl = wgl;

        // CRITICAL ORDER: request the float extensions BEFORE any float or
        // half-float texture is created. Without this, texImage2D fails with
        // INVALID_ENUM (1280) and every simulation texture stays zeroed.
        wgl.getExtension('OES_texture_float');
        wgl.getExtension('OES_texture_float_linear');
        // The Simulator prefers HALF_FLOAT when these are present — request them
        // here too so the half-float textures are allocated with the extension live.
        wgl.getExtension('OES_texture_half_float');
        wgl.getExtension('OES_texture_half_float_linear');

        var maxTextureSize = wgl.getParameter(wgl.MAX_TEXTURE_SIZE);
        paint.maxPaintingWidth = Math.min(MAX_PAINTING_WIDTH, maxTextureSize / QUALITIES[QUALITIES.length - 1].resolutionScale);

        paint.framebuffer = wgl.createFramebuffer();

        // Painting programs
        paint.paintingProgram = wgl.createProgram(shaderSources['shaders/painting.vert'], shaderSources['shaders/painting.frag']);
        paint.paintingProgramRGB = wgl.createProgram(shaderSources['shaders/painting.vert'], '#define RGB \n ' + shaderSources['shaders/painting.frag']);
        paint.resizingPaintingProgram = wgl.createProgram(shaderSources['shaders/painting.vert'], '#define RESIZING \n ' + shaderSources['shaders/painting.frag']);
        paint.resizingPaintingProgramRGB = wgl.createProgram(shaderSources['shaders/painting.vert'], '#define RESIZING \n #define RGB \n ' + shaderSources['shaders/painting.frag']);
        paint.savePaintingProgram = wgl.createProgram(shaderSources['shaders/painting.vert'], '#define SAVE \n ' + shaderSources['shaders/painting.frag']);
        paint.savePaintingProgramRGB = wgl.createProgram(shaderSources['shaders/painting.vert'], '#define SAVE \n #define RGB \n ' + shaderSources['shaders/painting.frag']);

        paint.brushProgram = wgl.createProgram(shaderSources['shaders/brush.vert'], shaderSources['shaders/brush.frag'], { 'a_position': 0 });
        paint.panelProgram = wgl.createProgram(shaderSources['shaders/fullscreen.vert'], shaderSources['shaders/panel.frag'], { 'a_position': 0 });
        paint.blurProgram = wgl.createProgram(shaderSources['shaders/fullscreen.vert'], makeBlurShader(PANEL_BLUR_SAMPLES), { 'a_position': 0 });
        paint.outputProgram = wgl.createProgram(shaderSources['shaders/fullscreen.vert'], shaderSources['shaders/output.frag'], { 'a_position': 0 });
        paint.shadowProgram = wgl.createProgram(shaderSources['shaders/fullscreen.vert'], shaderSources['shaders/shadow.frag'], { 'a_position': 0 });

        paint.quadVertexBuffer = wgl.createBuffer();
        wgl.bufferData(paint.quadVertexBuffer, wgl.ARRAY_BUFFER, new Float32Array([-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]), wgl.STATIC_DRAW);

        // Painting rectangle covers the full offscreen canvas
        paint.paintingRectangle = new Rectangle(0, 0, width, height);
        // Simulation resolution scale. The fluid sim dominates the cost of a
        // stroke (one full advect+divergence+jacobi pass per sample point), so
        // the sim runs at half the painting resolution: 192x192 for a 384x384
        // canvas. The pigment is still sampled at full res by the shading pass.
        paint.resolutionScale = 0.5;

        // Simulator
        var Simulator = SimulatorModule;
        paint.simulator = new Simulator(wgl, shaderSources, paint.getPaintingResolutionWidth(), paint.getPaintingResolutionHeight());

        // History snapshots
        paint.snapshots = [];
        for (var i = 0; i < HISTORY_SIZE; ++i) {
            var texture = wgl.buildTexture(wgl.RGBA, wgl.FLOAT, paint.getPaintingResolutionWidth(), paint.getPaintingResolutionHeight(), null, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.LINEAR, wgl.LINEAR);
            wgl.framebufferTexture2D(paint.framebuffer, wgl.FRAMEBUFFER, wgl.COLOR_ATTACHMENT0, wgl.TEXTURE_2D, texture, 0);
            wgl.clear(wgl.createClearState().bindFramebuffer(paint.framebuffer), wgl.COLOR_BUFFER_BIT);
            paint.snapshots.push(new Snapshot(texture, paint.paintingRectangle.width, paint.paintingRectangle.height, paint.resolutionScale));
        }
        paint.snapshotIndex = 0;
        paint.undoing = false;
        paint.maxRedoIndex = 0;

        paint.brushInitialized = false;
        paint.brushX = 0;
        paint.brushY = 0;
        paint.brushScale = 50;
        paint.brushColorHSVA = [0, 0, 0, 0.8]; // default black
        // Upstream's default colour model. hsvToRyb is really HSV->RGB, and the
        // shader's rybToRgb() trilinear interpolation converts that pigment into
        // the displayed colour. The '#define RGB' variant (1.0 - ryb.yxz) is the
        // INVERTED convention and does not reproduce the requested sRGB colour.
        paint.colorModel = ColorModel.RYB;
        paint.needsRedraw = true;

        // Brush
        var Brush = (await import('./dli-paint/brush.module.js')).default;
        paint.brush = new Brush(wgl, shaderSources, MAX_BRISTLE_COUNT);

        // Projection matrix (offscreen canvas space)
        paint.mainProjectionMatrix = makeOrthographicMatrix(new Float32Array(16), 0.0, width, 0, height, -5000.0, 5000.0);

        // Interaction state (headless)
        paint.mouseX = 0;
        paint.mouseY = 0;
        paint.spaceDown = false;
        paint.resizingSide = 0;
        paint.newPaintingRectangle = null;
        paint.interactionState = InteractionMode.NONE;

        // Canvas textures for compositing
        paint.canvasTexture = wgl.buildTexture(wgl.RGBA, wgl.UNSIGNED_BYTE, width, height, null, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.LINEAR, wgl.LINEAR);
        paint.tempCanvasTexture = wgl.buildTexture(wgl.RGBA, wgl.UNSIGNED_BYTE, width, height, null, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.LINEAR, wgl.LINEAR);
        paint.blurredCanvasTexture = wgl.buildTexture(wgl.RGBA, wgl.UNSIGNED_BYTE, width, height, null, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.LINEAR, wgl.LINEAR);

        return paint;
    }

    // ─── Stroke API ──────────────────────────────────────────────────────────

    /**
     * Paint a stroke from WWW_PAINT shape data.
     * @param {Array<{x:number,y:number}>} points - Points in canvas space (0..width, 0..height)
     * @param {Object} style - WWW_PAINT style settings { color, opacity, size, ... }
     * @returns {Promise<Object>} Result with counters
     */
    async paintStroke(points, style) {
        if (this.fallbackMode || !this.ready) {
            this.counters.fallbackCount++;
            return { fallback: true, fallbackCount: this.counters.fallbackCount };
        }

        if (!points || !points.length) {
            return { fallback: false, strokes: 0 };
        }

        var paint = this.paint;
        var wgl = this.wgl;

        // Convert WWW_PAINT color (0-255 RGB) to HSV for dli/paint
        var color = style.color || { r: 0, g: 0, b: 0, a: 1 };
        if (typeof color === 'string') { color = this._hexToRgb(color); }
        var hsv = this._rgbToHsv(color.r / 255, color.g / 255, color.b / 255);
        paint.brushColorHSVA = [hsv.h, hsv.s, hsv.v, color.a];

        // Brush scale from style size (clamped)
        paint.brushScale = Math.max(5, Math.min(75, style.size || 50));

        // Initialize brush at first point
        var first = points[0];
        paint.brushX = first.x;
        paint.brushY = first.y;
        paint.brush.initialize(paint.brushX, paint.brushY, BRUSH_HEIGHT * paint.brushScale, paint.brushScale);
        paint.brushInitialized = true;
        paint.interactionState = InteractionMode.PAINTING;
        paint.saveSnapshot();

        // Splat along the stroke
        for (var i = 1; i < points.length; ++i) {
            paint.brushX = points[i].x;
            paint.brushY = points[i].y;
            paint.update();
        }

        // Settle the fluid: upstream's simulator keeps each splat alive for
        // FRAMES_TO_SIMULATE frames so the paint advects and settles before it
        // is shaded. The stroke must stay in PAINTING state for the first
        // update() so the splat is actually queued — setting NONE first means
        // the segment is never splatted and the canvas stays flat.
        // 6 settle frames is enough for the wet paint to spread visibly; upstream
        // runs 60 in its animation loop, which is far too slow for a batch render.
        var settleFrames = Math.max(1, Math.min(FRAMES_TO_SIMULATE, 6));
        for (var f = 0; f < settleFrames; ++f) {
            paint.update();
        }
        paint.interactionState = InteractionMode.NONE;

        // Force one final shading pass. update() clears needsRedraw at the end, and
        // simulate() returns false once the splat areas drain — so without this the
        // canvas texture can still hold the pre-pigment background when the caller
        // reads it back.
        paint.needsRedraw = true;
        paint.update();

        this.counters.strokes++;

        return { fallback: false, strokes: this.counters.strokes };
    }

    _hexToRgb(hex) {
        var h = String(hex).trim().replace('#', '');
        if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
        var n = parseInt(h, 16);
        if (isNaN(n)) { return { r: 0, g: 0, b: 0, a: 1 }; }
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
    }

    _rgbToHsv(r, g, b) {
        var max = Math.max(r, g, b), min = Math.min(r, g, b);
        var h, s, v = max;
        var d = max - min;
        s = max === 0 ? 0 : d / max;
        if (max === min) { h = 0; }
        else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h, s: s, v: v };
    }

    // ─── Readback + Composite ────────────────────────────────────────────────

    /**
     * Read back the painting, mask the upstream grey background to transparent,
     * and composite onto the target 2D canvas using drawImage + globalAlpha.
     * @param {CanvasRenderingContext2D} targetCtx - Target 2D context
     * @param {number} targetWidth - Target canvas width
     * @param {number} targetHeight - Target canvas height
     * @param {number} globalAlpha - Global alpha for compositing (0-1)
     * @returns {Promise<Object>} Result with pixel stats
     */
    async compositeToCanvas(targetCtx, targetWidth, targetHeight, globalAlpha) {
        if (this.fallbackMode || !this.ready) {
            this.counters.fallbackCount++;
            return { fallback: true, fallbackCount: this.counters.fallbackCount, inkPercent: 0, chroma: 0, reliefRange: 0 };
        }

        var paint = this.paint;
        var wgl = this.wgl;

        // Render the current simulation state into canvasTexture before reading it
        // back. update() performs the shading pass (painting.frag over the
        // simulator's paint texture) and writes the result into canvasTexture;
        // without this the texture can still hold the cleared background.
        paint.update();

        // Read back as RGBA UNSIGNED_BYTE.
        // Read at the CANVAS TEXTURE's own size — not the target canvas size. If the
        // backend was initialised at a different size than the caller's canvas, the
        // read is misaligned and returns the cleared background.
        var width = this.offscreenCanvas.width;
        var height = this.offscreenCanvas.height;
        var pixels = new Uint8Array(width * height * 4);

        // Bind the canvasTexture's framebuffer and read
        wgl.framebufferTexture2D(paint.framebuffer, wgl.FRAMEBUFFER, wgl.COLOR_ATTACHMENT0, wgl.TEXTURE_2D, paint.canvasTexture, 0);
        wgl.readPixels(wgl.createReadState().bindFramebuffer(paint.framebuffer), 0, 0, width, height, wgl.RGBA, wgl.UNSIGNED_BYTE, pixels);

        // MASK: Convert upstream background grey (and near-black) to transparent
        // Upstream renders BACKGROUND_GRAY (0.7) as the "paper" color.
        // We treat pixels close to this grey as transparent.
        var nonTransparent = 0;
        var totalChroma = 0;
        var minRelief = 255, maxRelief = 0;
        for (var i = 0; i < pixels.length; i += 4) {
            var r = pixels[i], g = pixels[i+1], b = pixels[i+2], a = pixels[i+3];
            // Check if pixel is the upstream background grey (all channels ~179)
            var isBgGrey = (Math.abs(r - UPSTREAM_BG_GRAY_255) <= UPSTREAM_BG_TOLERANCE &&
                            Math.abs(g - UPSTREAM_BG_GRAY_255) <= UPSTREAM_BG_TOLERANCE &&
                            Math.abs(b - UPSTREAM_BG_GRAY_255) <= UPSTREAM_BG_TOLERANCE);
            // Also treat near-black (shadows) as transparent
            var isNearBlack = (r < 10 && g < 10 && b < 10);
            if (isBgGrey || isNearBlack) {
                pixels[i+3] = 0; // transparent
            } else {
                pixels[i+3] = 255; // opaque
                nonTransparent++;
                // Chroma = max - min of RGB
                var cmax = Math.max(r, g, b), cmin = Math.min(r, g, b);
                totalChroma += (cmax - cmin);
                // Relief proxy = luminance
                var lum = 0.299*r + 0.587*g + 0.114*b;
                minRelief = Math.min(minRelief, lum);
                maxRelief = Math.max(maxRelief, lum);
            }
        }

        var inkPercent = (nonTransparent / (width * height)) * 100;
        var chroma = nonTransparent > 0 ? totalChroma / nonTransparent : 0;
        var reliefRange = maxRelief - minRelief;

        // Create ImageData and draw to a temporary canvas, then drawImage to target
        var tempCanvas = new OffscreenCanvas(width, height);
        var tempCtx = tempCanvas.getContext('2d');
        var imageData = tempCtx.createImageData(width, height);
        imageData.data.set(pixels);
        tempCtx.putImageData(imageData, 0, 0);

        // Composite onto target with drawImage + globalAlpha
        targetCtx.save();
        targetCtx.globalAlpha = globalAlpha || 1.0;
        targetCtx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);
        targetCtx.restore();

        return {
            fallback: false,
            strokes: this.counters.strokes,
            fallbackCount: this.counters.fallbackCount,
            inkPercent: inkPercent,
            chroma: chroma,
            reliefRange: reliefRange
        };
    }

    // ─── Resize ──────────────────────────────────────────────────────────────

    resize(width, height) {
        if (this.fallbackMode || !this.ready) return;
        this.offscreenCanvas.width = width;
        this.offscreenCanvas.height = height;
        var paint = this.paint;
        var wgl = this.wgl;
        paint.canvas.width = width;
        paint.canvas.height = height;
        paint.paintingRectangle.width = width;
        paint.paintingRectangle.height = height;
        paint.mainProjectionMatrix = makeOrthographicMatrix(new Float32Array(16), 0.0, width, 0, height, -5000.0, 5000.0);
        paint.canvasTexture = wgl.buildTexture(wgl.RGBA, wgl.UNSIGNED_BYTE, width, height, null, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.LINEAR, wgl.LINEAR);
        paint.tempCanvasTexture = wgl.buildTexture(wgl.RGBA, wgl.UNSIGNED_BYTE, width, height, null, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.LINEAR, wgl.LINEAR);
        paint.blurredCanvasTexture = wgl.buildTexture(wgl.RGBA, wgl.UNSIGNED_BYTE, width, height, null, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.LINEAR, wgl.LINEAR);
        paint.simulator.changeResolution(paint.getPaintingResolutionWidth(), paint.getPaintingResolutionHeight());
        paint.needsRedraw = true;
    }

    // ─── Dispose ─────────────────────────────────────────────────────────────

    dispose() {
        if (this.paint && typeof this.paint.dispose === 'function') {
            try { this.paint.dispose(); } catch (e) { /* ignore */ }
        }
        this.paint = null;
        this.wgl = null;
        this.offscreenCanvas = null;
        this.ready = false;
    }

    isReady() { return this.ready && !this.fallbackMode; }
    isFallback() { return this.fallbackMode; }
}

// ─── Factory function for oil-impasto.js ────────────────────────────────────

let _backendInstance = null;
let _backendInitPromise = null;

export async function getDliPaintBackend(width, height) {
    // One in-flight init per instance. Concurrent callers (the app's render loop
    // and a probe) must NOT dispose an instance that is still initialising —
    // that nulls this.wgl under the first caller's feet and the init then dies
    // with "Cannot read properties of null (reading 'getParameter')".
    if (!_backendInstance) {
        _backendInstance = new DliPaintBackend();
        _backendInitPromise = _backendInstance.initialize(width, height);
    } else if (_backendInstance.isReady()) {
        // Resize if dimensions changed
        if (_backendInstance.offscreenCanvas.width !== width || _backendInstance.offscreenCanvas.height !== height) {
            _backendInstance.resize(width, height);
        }
    } else if (_backendInitPromise) {
        // Still initialising — wait for that attempt rather than starting another.
        await _backendInitPromise;
    } else {
        // A previous attempt failed outright: rebuild from scratch.
        _backendInstance.dispose();
        _backendInstance = new DliPaintBackend();
        _backendInitPromise = _backendInstance.initialize(width, height);
    }
    if (_backendInitPromise) {
        try {
            await _backendInitPromise;
        } catch (e) {
            _backendInitPromise = null;
            throw e;
        }
        _backendInitPromise = null;
    }
    return _backendInstance;
}

export function resetDliPaintBackend() {
    _backendInitPromise = null;
    if (_backendInstance) {
        _backendInstance.dispose();
        _backendInstance = null;
    }
}