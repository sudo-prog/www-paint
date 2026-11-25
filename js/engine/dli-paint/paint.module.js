/**
 * paint.module.js — ES module port of dli/paint paint.js (MIT License).
 * The orchestrator that wires WrappedGL + Brush + Simulator into a complete
 * paint engine with RYB pigment mixing, fluid simulation, and lit output.
 *
 * Copyright (c) 2017 David Li (http://david.li) — MIT License.
 * See index.js for the full licence text.
 */

import { WrappedGL } from './wrappedgl.module.js';
import { Brush } from './brush.module.js';
import { Simulator } from './simulator.module.js';
import { Rectangle } from './rectangle.js';
import { Utilities } from './utilities.js';
import {
    MAX_BRISTLE_COUNT, MIN_BRISTLE_COUNT, BRUSH_HEIGHT, Z_THRESHOLD,
    SPLAT_VELOCITY_SCALE, SPLAT_RADIUS,
    NORMAL_SCALE, ROUGHNESS, F0, SPECULAR_SCALE, DIFFUSE_SCALE, LIGHT_DIRECTION,
    PRESSURE_JACOBI_ITERATIONS, FRAMES_TO_SIMULATE,
    SHADER_FILES
} from './index.js';

// ─── Upstream constants (verbatim from paint.js) ─────────────────────────────

var InteractionMode = { NONE: 0, PAINTING: 1, RESIZING: 2, PANNING: 3 };
var ResizingSide = {
    NONE: 0, LEFT: 1, RIGHT: 2, BOTTOM: 3, TOP: 4,
    TOP_LEFT: 5, TOP_RIGHT: 6, BOTTOM_LEFT: 7, BOTTOM_RIGHT: 8
};
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
var COLOR_PICKER_LEFT = 20;
var COLOR_PICKER_TOP = 523;
var RESIZING_RADIUS = 20;
var RESIZING_FEATHER_SIZE = 8;
var BOX_SHADOW_SIGMA = 5.0;
var BOX_SHADOW_WIDTH = 10.0;
var PAINTING_SHADOW_ALPHA = 0.5;
var PANEL_SHADOW_ALPHA = 1.0;
var BACKGROUND_GRAY = 0.7;
var HISTORY_SIZE = 4;

// ─── Helpers (verbatim) ──────────────────────────────────────────────────────

function pascalRow(n) {
    var line = [1];
    for (var k = 0; k < n; ++k) {
        line.push(line[k] * (n - k) / (k + 1));
    }
    return line;
}

function makeBlurShader(width) {
    var coefficients = pascalRow(width - 1 + 2);
    coefficients.shift();
    coefficients.pop();
    var normalizationFactor = 0;
    for (var i = 0; i < coefficients.length; ++i) {
        normalizationFactor += coefficients[i];
    }
    var shader = [
        'precision highp float;',
        'uniform sampler2D u_input;',
        'uniform vec2 u_step;',
        'uniform vec2 u_resolution;',
        'void main () {',
        '  vec4 total = vec4(0.0);',
        '  vec2 coordinates = gl_FragCoord.xy / u_resolution;',
        '  vec2 delta = u_step / u_resolution;',
    ].join('\n');
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
    var r = [c, x, 0, 0, x, c][mod],
        g = [x, c, c, x, 0, 0][mod],
        b = [0, 0, x, c, c, x][mod];
    var m = v - c;
    r += m; g += m; b += m;
    return [r, g, b];
}

function makeOrthographicMatrix(matrix, left, right, bottom, top, near, far) {
    matrix[0] = 2 / (right - left);
    matrix[1] = 0;
    matrix[2] = 0;
    matrix[3] = 0;
    matrix[4] = 0;
    matrix[5] = 2 / (top - bottom);
    matrix[6] = 0;
    matrix[7] = 0;
    matrix[8] = 0;
    matrix[9] = 0;
    matrix[10] = -2 / (far - near);
    matrix[11] = 0;
    matrix[12] = -(right + left) / (right - left);
    matrix[13] = -(top + bottom) / (top - bottom);
    matrix[14] = -(far + near) / (far - near);
    matrix[15] = 1;
    return matrix;
}

function mix(a, b, t) { return (1.0 - t) * a + t * b; }

function Snapshot(texture, paintingWidth, paintingHeight, resolutionScale) {
    this.texture = texture;
    this.paintingWidth = paintingWidth;
    this.paintingHeight = paintingHeight;
    this.resolutionScale = resolutionScale;
}
Snapshot.prototype.getTextureWidth = function () {
    return Math.ceil(this.paintingWidth * this.resolutionScale);
};
Snapshot.prototype.getTextureHeight = function () {
    return Math.ceil(this.paintingHeight * this.resolutionScale);
};

// ─── Main Paint class ────────────────────────────────────────────────────────

export class Paint {
    constructor(canvas, wgl) {
        this.canvas = canvas;
        this.wgl = wgl;

        // CRITICAL: request float extensions BEFORE any float texture creation
        wgl.getExtension('OES_texture_float');
        wgl.getExtension('OES_texture_float_linear');

        var that = this;

        // Load all shader sources
        WrappedGL.loadTextFilesAsync(SHADER_FILES, function (shaderSources) {
            that._initWithShaders(shaderSources);
        });
    }

    _initWithShaders(shaderSources) {
        var wgl = this.wgl;
        var maxTextureSize = wgl.getParameter(wgl.MAX_TEXTURE_SIZE);
        this.maxPaintingWidth = Math.min(MAX_PAINTING_WIDTH, maxTextureSize / QUALITIES[QUALITIES.length - 1].resolutionScale);

        this.framebuffer = wgl.createFramebuffer();

        // Painting programs (RYB + RGB variants, plus resizing/save variants)
        this.paintingProgram = wgl.createProgram(
            shaderSources['shaders/painting.vert'], shaderSources['shaders/painting.frag']);
        this.paintingProgramRGB = wgl.createProgram(
            shaderSources['shaders/painting.vert'], '#define RGB \n ' + shaderSources['shaders/painting.frag']);
        this.resizingPaintingProgram = wgl.createProgram(
            shaderSources['shaders/painting.vert'], '#define RESIZING \n ' + shaderSources['shaders/painting.frag']);
        this.resizingPaintingProgramRGB = wgl.createProgram(
            shaderSources['shaders/painting.vert'], '#define RESIZING \n #define RGB \n ' + shaderSources['shaders/painting.frag']);
        this.savePaintingProgram = wgl.createProgram(
            shaderSources['shaders/painting.vert'], '#define SAVE \n ' + shaderSources['shaders/painting.frag']);
        this.savePaintingProgramRGB = wgl.createProgram(
            shaderSources['shaders/painting.vert'], '#define SAVE \n #define RGB \n ' + shaderSources['shaders/painting.frag']);

        this.brushProgram = wgl.createProgram(
            shaderSources['shaders/brush.vert'], shaderSources['shaders/brush.frag'], { 'a_position': 0 });
        this.panelProgram = wgl.createProgram(
            shaderSources['shaders/fullscreen.vert'], shaderSources['shaders/panel.frag'], { 'a_position': 0 });
        this.blurProgram = wgl.createProgram(
            shaderSources['shaders/fullscreen.vert'], makeBlurShader(PANEL_BLUR_SAMPLES), { 'a_position': 0 });
        this.outputProgram = wgl.createProgram(
            shaderSources['shaders/fullscreen.vert'], shaderSources['shaders/output.frag'], { 'a_position': 0 });
        this.shadowProgram = wgl.createProgram(
            shaderSources['shaders/fullscreen.vert'], shaderSources['shaders/shadow.frag'], { 'a_position': 0 });

        this.quadVertexBuffer = wgl.createBuffer();
        wgl.bufferData(this.quadVertexBuffer, wgl.ARRAY_BUFFER, new Float32Array([-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]), wgl.STATIC_DRAW);

        // Painting rectangle (position + size in canvas pixels)
        this.paintingRectangle = new Rectangle(
            INITIAL_PADDING, INITIAL_PADDING,
            Utilities.clamp(this.canvas.width - INITIAL_PADDING * 2, MIN_PAINTING_WIDTH, this.maxPaintingWidth),
            Utilities.clamp(this.canvas.height - INITIAL_PADDING * 2, MIN_PAINTING_WIDTH, this.maxPaintingWidth));

        this.resolutionScale = QUALITIES[INITIAL_QUALITY].resolutionScale;

        this.simulator = new Simulator(wgl, shaderSources, this.getPaintingResolutionWidth(), this.getPaintingResolutionHeight());

        // History snapshots (reused textures)
        this.snapshots = [];
        for (var i = 0; i < HISTORY_SIZE; ++i) {
            var texture = wgl.buildTexture(wgl.RGBA, wgl.FLOAT, this.getPaintingResolutionWidth(), this.getPaintingResolutionHeight(), null, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.LINEAR, wgl.LINEAR);
            wgl.framebufferTexture2D(this.framebuffer, wgl.FRAMEBUFFER, wgl.COLOR_ATTACHMENT0, wgl.TEXTURE_2D, texture, 0);
            wgl.clear(wgl.createClearState().bindFramebuffer(this.framebuffer), wgl.COLOR_BUFFER_BIT);
            this.snapshots.push(new Snapshot(texture, this.paintingRectangle.width, this.paintingRectangle.height, this.resolutionScale));
        }
        this.snapshotIndex = 0;
        this.undoing = false;
        this.maxRedoIndex = 0;

        this.brushInitialized = false;
        this.brushX = 0;
        this.brushY = 0;
        this.brushScale = 50;
        this.brushColorHSVA = [Math.random(), 1, 1, 0.8]; // deterministic RNG not used here; color is user-controlled
        this.colorModel = ColorModel.RYB;
        this.needsRedraw = true;

        this.brush = new Brush(wgl, shaderSources, MAX_BRISTLE_COUNT);

        // Main projection matrix (screen space)
        this.mainProjectionMatrix = makeOrthographicMatrix(new Float32Array(16), 0.0, this.canvas.width, 0, this.canvas.height, -5000.0, 5000.0);

        // Interaction state
        this.mouseX = 0;
        this.mouseY = 0;
        this.spaceDown = false;
        this.resizingSide = ResizingSide.NONE;
        this.newPaintingRectangle = null;
        this.interactionState = InteractionMode.NONE;

        // Bind events
        this._bindEvents();

        // Initial resize to set up canvas textures
        this.onResize();
    }

    getPaintingResolutionWidth() {
        return Math.ceil(this.paintingRectangle.width * this.resolutionScale);
    }
    getPaintingResolutionHeight() {
        return Math.ceil(this.paintingRectangle.height * this.resolutionScale);
    }

    _bindEvents() {
        var canvas = this.canvas;
        var that = this;

        canvas.addEventListener('mousemove', function (e) { that.onMouseMove(e); });
        canvas.addEventListener('mousedown', function (e) { that.onMouseDown(e); });
        document.addEventListener('mouseup', function (e) { that.onMouseUp(e); });
        canvas.addEventListener('mouseover', function (e) { that.onMouseOver(e); });
        document.addEventListener('wheel', function (e) { that.onWheel(e); });

        document.addEventListener('keydown', function (e) {
            if (e.keyCode === 32) { that.spaceDown = true; }
            else if (e.keyCode === 90) { that.undo(); }
            else if (e.keyCode === 82) { that.redo(); }
        });
        document.addEventListener('keyup', function (e) {
            if (e.keyCode === 32) { that.spaceDown = false; }
        });

        canvas.addEventListener('touchstart', function (e) { that.onTouchStart(e); });
        canvas.addEventListener('touchmove', function (e) { that.onTouchMove(e); });
        canvas.addEventListener('touchend', function (e) { that.onTouchEnd(e); });
        canvas.addEventListener('touchcancel', function (e) { that.onTouchCancel(e); });

        window.addEventListener('resize', function () { that.onResize(); });
    }

    onResize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        this.paintingRectangle.left = Utilities.clamp(this.paintingRectangle.left, -this.paintingRectangle.width, this.canvas.width);
        this.paintingRectangle.bottom = Utilities.clamp(this.paintingRectangle.bottom, -this.paintingRectangle.height, this.canvas.height);

        this.mainProjectionMatrix = makeOrthographicMatrix(new Float32Array(16), 0.0, this.canvas.width, 0, this.canvas.height, -5000.0, 5000.0);

        this.canvasTexture = wgl.buildTexture(wgl.RGBA, wgl.UNSIGNED_BYTE, this.canvas.width, this.canvas.height, null, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.LINEAR, wgl.LINEAR);
        this.tempCanvasTexture = wgl.buildTexture(wgl.RGBA, wgl.UNSIGNED_BYTE, this.canvas.width, this.canvas.height, null, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.LINEAR, wgl.LINEAR);
        this.blurredCanvasTexture = wgl.buildTexture(wgl.RGBA, wgl.UNSIGNED_BYTE, this.canvas.width, this.canvas.height, null, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.LINEAR, wgl.LINEAR);

        this.needsRedraw = true;
    }

    drawShadow(alpha, rectangle) {
        var wgl = this.wgl;
        var shadowDrawState = wgl.createDrawState()
            .uniform2f('u_bottomLeft', rectangle.left, rectangle.bottom)
            .uniform2f('u_topRight', rectangle.getRight(), rectangle.getTop())
            .uniform1f('u_sigma', BOX_SHADOW_SIGMA)
            .uniform1f('u_alpha', alpha)
            .enable(wgl.BLEND)
            .blendFunc(wgl.ONE, wgl.ONE_MINUS_SRC_ALPHA)
            .useProgram(this.shadowProgram)
            .vertexAttribPointer(this.quadVertexBuffer, 0, 2, wgl.FLOAT, wgl.FALSE, 0, 0);

        var rectangles = [
            new Rectangle(rectangle.left - BOX_SHADOW_WIDTH, rectangle.bottom - BOX_SHADOW_WIDTH, rectangle.width + 2 * BOX_SHADOW_WIDTH, BOX_SHADOW_WIDTH),
            new Rectangle(rectangle.left - BOX_SHADOW_WIDTH, rectangle.getTop(), rectangle.width + 2 * BOX_SHADOW_WIDTH, BOX_SHADOW_WIDTH),
            new Rectangle(rectangle.left - BOX_SHADOW_WIDTH, rectangle.bottom, BOX_SHADOW_WIDTH, rectangle.height),
            new Rectangle(rectangle.getRight(), rectangle.bottom, BOX_SHADOW_WIDTH, rectangle.height)
        ];
        var screenRectangle = new Rectangle(0, 0, this.canvas.width, this.canvas.height);
        for (var i = 0; i < rectangles.length; ++i) {
            var rect = rectangles[i];
            rect.intersectRectangle(screenRectangle);
            if (rect.getArea() > 0) {
                shadowDrawState.viewport(rect.left, rect.bottom, rect.width, rect.height);
                wgl.drawArrays(shadowDrawState, wgl.TRIANGLE_STRIP, 0, 4);
            }
        }
    }

    update() {
        var wgl = this.wgl;

        // Update brush
        if (this.brushInitialized) {
            this.brush.update(this.brushX, this.brushY, BRUSH_HEIGHT * this.brushScale, this.brushScale);
        }

        // Splat paint + velocity
        if (this.interactionState === InteractionMode.PAINTING) {
            var splatRadius = SPLAT_RADIUS * this.brushScale;
            var splatColor = hsvToRyb(this.brushColorHSVA[0], this.brushColorHSVA[1], this.brushColorHSVA[2]);
            var alphaT = this.brushColorHSVA[3];
            var bristleT = (this.brush.bristleCount - MIN_BRISTLE_COUNT) / (MAX_BRISTLE_COUNT - MIN_BRISTLE_COUNT);
            var minAlpha = mix(THIN_MIN_ALPHA, THICK_MIN_ALPHA, bristleT);
            var maxAlpha = mix(THIN_MAX_ALPHA, THICK_MAX_ALPHA, bristleT);
            var alpha = mix(minAlpha, maxAlpha, alphaT);
            splatColor[3] = alpha;
            var splatVelocityScale = SPLAT_VELOCITY_SCALE * splatColor[3] * this.resolutionScale;
            this.simulator.splat(this.brush, Z_THRESHOLD * this.brushScale, this.paintingRectangle, splatColor, splatRadius, splatVelocityScale);
        }

        var simulationUpdated = this.simulator.simulate();
        if (simulationUpdated) this.needsRedraw = true;

        // Clipped painting rectangle for drawing
        var clippedPaintingRectangle = (this.interactionState === InteractionMode.RESIZING ? this.newPaintingRectangle : this.paintingRectangle).clone()
            .intersectRectangle(new Rectangle(0, 0, this.canvas.width, this.canvas.height));

        if (this.needsRedraw) {
            // Draw painting into texture
            wgl.framebufferTexture2D(this.framebuffer, wgl.FRAMEBUFFER, wgl.COLOR_ATTACHMENT0, wgl.TEXTURE_2D, this.canvasTexture, 0);
            var clearState = wgl.createClearState()
                .bindFramebuffer(this.framebuffer)
                .clearColor(BACKGROUND_GRAY, BACKGROUND_GRAY, BACKGROUND_GRAY, 1.0);
            wgl.clear(clearState, wgl.COLOR_BUFFER_BIT | wgl.DEPTH_BUFFER_BIT);

            var paintingProgram;
            if (this.colorModel === ColorModel.RYB) {
                paintingProgram = this.interactionState === InteractionMode.RESIZING ? this.resizingPaintingProgram : this.paintingProgram;
            } else {
                paintingProgram = this.interactionState === InteractionMode.RESIZING ? this.resizingPaintingProgramRGB : this.paintingProgramRGB;
            }

            var paintingDrawState = wgl.createDrawState()
                .bindFramebuffer(this.framebuffer)
                .vertexAttribPointer(this.quadVertexBuffer, paintingProgram.getAttribLocation('a_position'), 2, wgl.FLOAT, false, 0, 0)
                .useProgram(paintingProgram)
                .uniform1f('u_featherSize', RESIZING_FEATHER_SIZE)
                .uniform1f('u_normalScale', NORMAL_SCALE / this.resolutionScale)
                .uniform1f('u_roughness', ROUGHNESS)
                .uniform1f('u_diffuseScale', DIFFUSE_SCALE)
                .uniform1f('u_specularScale', SPECULAR_SCALE)
                .uniform1f('u_F0', F0)
                .uniform3f('u_lightDirection', LIGHT_DIRECTION[0], LIGHT_DIRECTION[1], LIGHT_DIRECTION[2])
                .uniform2f('u_paintingPosition', this.paintingRectangle.left, this.paintingRectangle.bottom)
                .uniform2f('u_paintingResolution', this.simulator.resolutionWidth, this.simulator.resolutionHeight)
                .uniform2f('u_paintingSize', this.paintingRectangle.width, this.paintingRectangle.height)
                .uniform2f('u_screenResolution', this.canvas.width, this.canvas.height)
                .uniformTexture('u_paintTexture', 0, wgl.TEXTURE_2D, this.simulator.paintTexture)
                .viewport(clippedPaintingRectangle.left, clippedPaintingRectangle.bottom, clippedPaintingRectangle.width, clippedPaintingRectangle.height);

            wgl.drawArrays(paintingDrawState, wgl.TRIANGLE_STRIP, 0, 4);
        }

        // Output painting to screen
        var outputDrawState = wgl.createDrawState()
            .viewport(0, 0, this.canvas.width, this.canvas.height)
            .useProgram(this.outputProgram)
            .uniformTexture('u_input', 0, wgl.TEXTURE_2D, this.canvasTexture)
            .vertexAttribPointer(this.quadVertexBuffer, 0, 2, wgl.FLOAT, wgl.FALSE, 0, 0);
        wgl.drawArrays(outputDrawState, wgl.TRIANGLE_STRIP, 0, 4);

        this.drawShadow(PAINTING_SHADOW_ALPHA, clippedPaintingRectangle);

        // Draw brush preview
        if (this.interactionState === InteractionMode.PAINTING ||
            (this.interactionState === InteractionMode.NONE && this.desiredInteractionMode(this.mouseX, this.mouseY) === InteractionMode.PAINTING)) {
            var brushDrawState = wgl.createDrawState()
                .bindFramebuffer(null)
                .viewport(0, 0, this.canvas.width, this.canvas.height)
                .vertexAttribPointer(this.brush.brushTextureCoordinatesBuffer, 0, 2, wgl.FLOAT, wgl.FALSE, 0, 0)
                .useProgram(this.brushProgram)
                .bindIndexBuffer(this.brush.brushIndexBuffer)
                .uniform4f('u_color', 0.6, 0.6, 0.6, 1.0)
                .uniformMatrix4fv('u_projectionViewMatrix', false, this.mainProjectionMatrix)
                .enable(wgl.DEPTH_TEST)
                .enable(wgl.BLEND)
                .blendFunc(wgl.DST_COLOR, wgl.ZERO)
                .uniformTexture('u_positionsTexture', 0, wgl.TEXTURE_2D, this.brush.positionsTexture);
            wgl.drawElements(brushDrawState, wgl.LINES, this.brush.indexCount * this.brush.bristleCount / this.brush.maxBristleCount, wgl.UNSIGNED_SHORT, 0);
        }

        // Panel blur + draw
        var panelBottom = this.canvas.height - PANEL_HEIGHT;
        if (this.needsRedraw) {
            var BLUR_FEATHER = ((PANEL_BLUR_SAMPLES - 1) / 2) * PANEL_BLUR_STRIDE;
            var blurDrawState = wgl.createDrawState()
                .useProgram(this.blurProgram)
                .viewport(
                    0,
                    Utilities.clamp(panelBottom - BLUR_FEATHER, 0, this.canvas.height),
                    PANEL_WIDTH + BLUR_FEATHER,
                    PANEL_HEIGHT + BLUR_FEATHER)
                .bindFramebuffer(this.framebuffer)
                .uniform2f('u_resolution', this.canvas.width, this.canvas.height)
                .vertexAttribPointer(this.quadVertexBuffer, 0, 2, wgl.FLOAT, false, 0, 0);

            wgl.framebufferTexture2D(this.framebuffer, wgl.FRAMEBUFFER, wgl.COLOR_ATTACHMENT0, wgl.TEXTURE_2D, this.tempCanvasTexture, 0);
            blurDrawState.uniformTexture('u_input', 0, wgl.TEXTURE_2D, this.canvasTexture)
                .uniform2f('u_step', PANEL_BLUR_STRIDE, 0);
            wgl.drawArrays(blurDrawState, wgl.TRIANGLE_STRIP, 0, 4);

            wgl.framebufferTexture2D(this.framebuffer, wgl.FRAMEBUFFER, wgl.COLOR_ATTACHMENT0, wgl.TEXTURE_2D, this.blurredCanvasTexture, 0);
            blurDrawState.uniformTexture('u_input', 0, wgl.TEXTURE_2D, this.tempCanvasTexture)
                .uniform2f('u_step', 0, PANEL_BLUR_STRIDE);
            wgl.drawArrays(blurDrawState, wgl.TRIANGLE_STRIP, 0, 4);
        }

        var panelDrawState = wgl.createDrawState()
            .viewport(0, panelBottom, PANEL_WIDTH, PANEL_HEIGHT)
            .uniformTexture('u_canvasTexture', 0, wgl.TEXTURE_2D, this.blurredCanvasTexture)
            .uniform2f('u_canvasResolution', this.canvas.width, this.canvas.height)
            .uniform2f('u_panelResolution', PANEL_WIDTH, PANEL_HEIGHT)
            .useProgram(this.panelProgram)
            .vertexAttribPointer(this.quadVertexBuffer, 0, 2, wgl.FLOAT, wgl.FALSE, 0, 0);
        wgl.drawArrays(panelDrawState, wgl.TRIANGLE_STRIP, 0, 4);

        this.drawShadow(PANEL_SHADOW_ALPHA, new Rectangle(0, panelBottom, PANEL_WIDTH, PANEL_HEIGHT));

        this.needsRedraw = false;
    }

    // ─── Interaction handlers ────────────────────────────────────────────────

    getResizingSide(mouseX, mouseY) {
        if (Math.abs(mouseX - this.paintingRectangle.left) <= RESIZING_RADIUS && Math.abs(mouseY - this.paintingRectangle.getTop()) <= RESIZING_RADIUS) return ResizingSide.TOP_LEFT;
        if (Math.abs(mouseX - this.paintingRectangle.getRight()) <= RESIZING_RADIUS && Math.abs(mouseY - this.paintingRectangle.getTop()) <= RESIZING_RADIUS) return ResizingSide.TOP_RIGHT;
        if (Math.abs(mouseX - this.paintingRectangle.left) <= RESIZING_RADIUS && Math.abs(mouseY - this.paintingRectangle.bottom) <= RESIZING_RADIUS) return ResizingSide.BOTTOM_LEFT;
        if (Math.abs(mouseX - this.paintingRectangle.getRight()) <= RESIZING_RADIUS && Math.abs(mouseY - this.paintingRectangle.bottom) <= RESIZING_RADIUS) return ResizingSide.BOTTOM_RIGHT;
        if (mouseY > this.paintingRectangle.bottom && mouseY <= this.paintingRectangle.getTop()) {
            if (Math.abs(mouseX - this.paintingRectangle.left) <= RESIZING_RADIUS) return ResizingSide.LEFT;
            if (Math.abs(mouseX - this.paintingRectangle.getRight()) <= RESIZING_RADIUS) return ResizingSide.RIGHT;
        }
        if (mouseX > this.paintingRectangle.left && mouseX <= this.paintingRectangle.getRight()) {
            if (Math.abs(mouseY - this.paintingRectangle.bottom) <= RESIZING_RADIUS) return ResizingSide.BOTTOM;
            if (Math.abs(mouseY - this.paintingRectangle.getTop()) <= RESIZING_RADIUS) return ResizingSide.TOP;
        }
        return ResizingSide.NONE;
    }

    desiredInteractionMode(mouseX, mouseY) {
        var mouseOverPanel = mouseX < PANEL_WIDTH && mouseY > this.canvas.height - PANEL_HEIGHT;
        if (mouseOverPanel) return InteractionMode.NONE;
        if (this.spaceDown || mouseX < this.paintingRectangle.left - RESIZING_RADIUS || mouseX > this.paintingRectangle.left + this.paintingRectangle.width + RESIZING_RADIUS || mouseY < this.paintingRectangle.bottom - RESIZING_RADIUS || mouseY > this.paintingRectangle.bottom + this.paintingRectangle.height + RESIZING_RADIUS) {
            return InteractionMode.PANNING;
        } else if (this.getResizingSide(mouseX, mouseY) !== ResizingSide.NONE) {
            return InteractionMode.RESIZING;
        } else {
            return InteractionMode.PAINTING;
        }
    }

    onMouseMove(event) {
        if (event.preventDefault) event.preventDefault();
        var position = Utilities.getMousePosition(event, this.canvas);
        var mouseX = position.x;
        var mouseY = this.canvas.height - position.y;
        this.brushX = mouseX;
        this.brushY = mouseY;

        if (!this.brushInitialized) {
            this.brush.initialize(this.brushX, this.brushY, BRUSH_HEIGHT * this.brushScale, this.brushScale);
            this.brushInitialized = true;
        }

        if (this.interactionState === InteractionMode.PANNING) {
            var deltaX = mouseX - this.mouseX;
            var deltaY = mouseY - this.mouseY;
            this.paintingRectangle.left += deltaX;
            this.paintingRectangle.bottom += deltaY;
            this.paintingRectangle.left = Utilities.clamp(this.paintingRectangle.left, -this.paintingRectangle.width, this.canvas.width);
            this.paintingRectangle.bottom = Utilities.clamp(this.paintingRectangle.bottom, -this.paintingRectangle.height, this.canvas.height);
            this.needsRedraw = true;
        } else if (this.interactionState === InteractionMode.RESIZING) {
            if (this.resizingSide === ResizingSide.LEFT || this.resizingSide === ResizingSide.TOP_LEFT || this.resizingSide === ResizingSide.BOTTOM_LEFT) {
                this.newPaintingRectangle.left = Utilities.clamp(mouseX, this.paintingRectangle.getRight() - this.maxPaintingWidth, this.paintingRectangle.getRight() - MIN_PAINTING_WIDTH);
                this.newPaintingRectangle.width = this.paintingRectangle.left + this.paintingRectangle.width - this.newPaintingRectangle.left;
            }
            if (this.resizingSide === ResizingSide.RIGHT || this.resizingSide === ResizingSide.TOP_RIGHT || this.resizingSide === ResizingSide.BOTTOM_RIGHT) {
                this.newPaintingRectangle.width = Utilities.clamp(mouseX - this.paintingRectangle.left, MIN_PAINTING_WIDTH, this.maxPaintingWidth);
            }
            if (this.resizingSide === ResizingSide.BOTTOM || this.resizingSide === ResizingSide.BOTTOM_LEFT || this.resizingSide === ResizingSide.BOTTOM_RIGHT) {
                this.newPaintingRectangle.bottom = Utilities.clamp(mouseY, this.paintingRectangle.getTop() - this.maxPaintingWidth, this.paintingRectangle.getTop() - MIN_PAINTING_WIDTH);
                this.newPaintingRectangle.height = this.paintingRectangle.bottom + this.paintingRectangle.height - this.newPaintingRectangle.bottom;
            }
            if (this.resizingSide === ResizingSide.TOP || this.resizingSide === ResizingSide.TOP_LEFT || this.resizingSide === ResizingSide.TOP_RIGHT) {
                this.newPaintingRectangle.height = Utilities.clamp(mouseY - this.paintingRectangle.bottom, MIN_PAINTING_WIDTH, this.maxPaintingWidth);
            }
            this.needsRedraw = true;
        }
        this.mouseX = mouseX;
        this.mouseY = mouseY;
    }

    onMouseDown(event) {
        if (event.preventDefault) event.preventDefault();
        if ('button' in event && event.button !== 0) return;
        var position = Utilities.getMousePosition(event, this.canvas);
        var mouseX = position.x;
        var mouseY = this.canvas.height - position.y;
        this.mouseX = mouseX;
        this.mouseY = mouseY;
        this.brushX = mouseX;
        this.brushY = mouseY;

        var mode = this.desiredInteractionMode(mouseX, mouseY);
        if (mode === InteractionMode.PANNING) {
            this.interactionState = InteractionMode.PANNING;
        } else if (mode === InteractionMode.RESIZING) {
            this.saveSnapshot();
            this.interactionState = InteractionMode.RESIZING;
            this.resizingSide = this.getResizingSide(mouseX, mouseY);
            this.newPaintingRectangle = this.paintingRectangle.clone();
        } else if (mode === InteractionMode.PAINTING) {
            this.interactionState = InteractionMode.PAINTING;
            this.saveSnapshot();
        }
    }

    onMouseUp(event) {
        if (event.preventDefault) event.preventDefault();
        var position = Utilities.getMousePosition(event, this.canvas);

        if (this.interactionState === InteractionMode.RESIZING) {
            var offsetX = 0, offsetY = 0;
            if (this.resizingSide === ResizingSide.LEFT || this.resizingSide === ResizingSide.TOP_LEFT || this.resizingSide === ResizingSide.BOTTOM_LEFT) {
                offsetX = (this.paintingRectangle.left - this.newPaintingRectangle.left) * this.resolutionScale;
            }
            if (this.resizingSide === ResizingSide.BOTTOM || this.resizingSide === ResizingSide.BOTTOM_LEFT || this.resizingSide === ResizingSide.BOTTOM_RIGHT) {
                offsetY = (this.paintingRectangle.bottom - this.newPaintingRectangle.bottom) * this.resolutionScale;
            }
            this.paintingRectangle = this.newPaintingRectangle;
            this.simulator.resize(this.getPaintingResolutionWidth(), this.getPaintingResolutionHeight(), offsetX, offsetY, RESIZING_FEATHER_SIZE);
            this.needsRedraw = true;
        }
        this.interactionState = InteractionMode.NONE;
    }

    onMouseOver(event) {
        event.preventDefault();
        var position = Utilities.getMousePosition(event, this.canvas);
        var mouseX = position.x;
        var mouseY = this.canvas.height - position.y;
        this.brushX = mouseX;
        this.brushY = mouseY;
        this.brush.initialize(this.brushX, this.brushY, BRUSH_HEIGHT * this.brushScale, this.brushScale);
        this.brushInitialized = true;
    }

    onWheel(event) {
        event.preventDefault();
        var scrollDelta = event.deltaY < 0.0 ? -1.0 : 1.0;
        this.brushScale = Utilities.clamp(this.brushScale + scrollDelta * -5.0, 5, 75);
    }

    onTouchStart(event) {
        event.preventDefault();
        if (event.touches.length === 1) {
            this.onMouseDown(event.targetTouches[0]);
            if (this.interactionState === InteractionMode.PAINTING) {
                this.brush.initialize(this.brushX, this.brushY, BRUSH_HEIGHT * this.brushScale, this.brushScale);
                this.brushInitialized = true;
            }
        } else if (event.touches.length === 2) {
            if (this.interactionState === InteractionMode.PAINTING) {
                this.interactionState = InteractionMode.PANNING;
            }
        }
    }

    onTouchMove(event) {
        event.preventDefault();
        this.onMouseMove(event.targetTouches[0]);
    }

    onTouchEnd(event) {
        event.preventDefault();
        if (event.touches.length > 0) return;
        this.onMouseUp({});
    }

    onTouchCancel(event) {
        event.preventDefault();
        if (event.touches.length > 0) return;
        this.onMouseUp({});
    }

    // ─── History / snapshots ────────────────────────────────────────────────

    saveSnapshot() {
        if (this.snapshotIndex === HISTORY_SIZE) {
            var front = this.snapshots.shift();
            this.snapshots.push(front);
            this.snapshotIndex -= 1;
        }
        this.undoing = false;
        var snapshot = this.snapshots[this.snapshotIndex];
        if (snapshot.getTextureWidth() !== this.simulator.resolutionWidth || snapshot.getTextureHeight() !== this.simulator.resolutionHeight) {
            this.wgl.rebuildTexture(snapshot.texture, this.wgl.RGBA, this.wgl.FLOAT, this.simulator.resolutionWidth, this.simulator.resolutionHeight, null, this.wgl.CLAMP_TO_EDGE, this.wgl.CLAMP_TO_EDGE, this.wgl.LINEAR, this.wgl.LINEAR);
        }
        this.simulator.copyPaintTexture(snapshot.texture);
        snapshot.paintingWidth = this.paintingRectangle.width;
        snapshot.paintingHeight = this.paintingRectangle.height;
        snapshot.resolutionScale = this.resolutionScale;
        this.snapshotIndex += 1;
    }

    applySnapshot(snapshot) {
        this.paintingRectangle.width = snapshot.paintingWidth;
        this.paintingRectangle.height = snapshot.paintingHeight;
        if (this.resolutionScale !== snapshot.resolutionScale) {
            for (var i = 0; i < QUALITIES.length; ++i) {
                if (QUALITIES[i].resolutionScale === snapshot.resolutionScale) {
                    this.resolutionScale = QUALITIES[i].resolutionScale;
                    break;
                }
            }
        }
        if (this.simulator.width !== this.getPaintingResolutionWidth() || this.simulator.height !== this.getPaintingResolutionHeight()) {
            this.simulator.changeResolution(this.getPaintingResolutionWidth(), this.getPaintingResolutionHeight());
        }
        this.simulator.applyPaintTexture(snapshot.texture);
    }

    canUndo() { return this.snapshotIndex >= 1; }
    canRedo() { return this.undoing && this.snapshotIndex <= this.maxRedoIndex - 1; }

    undo() {
        if (!this.undoing) {
            this.saveSnapshot();
            this.undoing = true;
            this.snapshotIndex -= 1;
            this.maxRedoIndex = this.snapshotIndex;
        }
        if (this.canUndo()) {
            this.applySnapshot(this.snapshots[this.snapshotIndex - 1]);
            this.snapshotIndex -= 1;
        }
        this.needsRedraw = true;
    }

    redo() {
        if (this.canRedo()) {
            this.applySnapshot(this.snapshots[this.snapshotIndex + 1]);
            this.snapshotIndex += 1;
        }
        this.needsRedraw = true;
    }

    clear() {
        this.simulator.clear();
        this.needsRedraw = true;
    }

    // ─── Export / readback ──────────────────────────────────────────────────

    saveToTexture(saveWidth, saveHeight) {
        var wgl = this.wgl;
        var saveTexture = wgl.buildTexture(wgl.RGBA, wgl.UNSIGNED_BYTE, saveWidth, saveHeight, null, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.NEAREST, wgl.NEAREST);
        var saveFramebuffer = wgl.createFramebuffer();
        wgl.framebufferTexture2D(saveFramebuffer, wgl.FRAMEBUFFER, wgl.COLOR_ATTACHMENT0, wgl.TEXTURE_2D, saveTexture, 0);

        var paintingProgram = this.colorModel === ColorModel.RYB ? this.savePaintingProgram : this.savePaintingProgramRGB;
        var saveDrawState = wgl.createDrawState()
            .bindFramebuffer(saveFramebuffer)
            .viewport(0, 0, saveWidth, saveHeight)
            .vertexAttribPointer(this.quadVertexBuffer, paintingProgram.getAttribLocation('a_position'), 2, wgl.FLOAT, false, 0, 0)
            .useProgram(paintingProgram)
            .uniform2f('u_paintingSize', this.paintingRectangle.width, this.paintingRectangle.height)
            .uniform2f('u_paintingResolution', this.simulator.resolutionWidth, this.simulator.resolutionHeight)
            .uniform2f('u_screenResolution', this.paintingRectangle.width, this.paintingRectangle.height)
            .uniform2f('u_paintingPosition', 0, 0)
            .uniformTexture('u_paintTexture', 0, wgl.TEXTURE_2D, this.simulator.paintTexture)
            .uniform1f('u_normalScale', NORMAL_SCALE / this.resolutionScale)
            .uniform1f('u_roughness', ROUGHNESS)
            .uniform1f('u_diffuseScale', DIFFUSE_SCALE)
            .uniform1f('u_specularScale', SPECULAR_SCALE)
            .uniform1f('u_F0', F0)
            .uniform3f('u_lightDirection', LIGHT_DIRECTION[0], LIGHT_DIRECTION[1], LIGHT_DIRECTION[2]);

        wgl.drawArrays(saveDrawState, wgl.TRIANGLE_STRIP, 0, 4);
        return { saveTexture, saveFramebuffer };
    }

    readbackTexture(texture, width, height) {
        var wgl = this.wgl;
        var pixels = new Uint8Array(width * height * 4);
        wgl.readPixels(wgl.createReadState().bindFramebuffer(this.framebuffer), 0, 0, width, height, wgl.RGBA, wgl.UNSIGNED_BYTE, pixels);
        return pixels;
    }

    dispose() {
        // Cleanup WebGL resources
        this.wgl.deleteFramebuffer(this.framebuffer);
        this.wgl.deleteBuffer(this.quadVertexBuffer);
        this.snapshots.forEach(function (s) { this.wgl.deleteTexture(s.texture); }, this);
    }
}

// ─── Reusable headless API (Step 2 requirement) ──────────────────────────────

export async function loadPaintEngine(canvas) {
    var wgl = WrappedGL.create(canvas, { preserveDrawingBuffer: true, alpha: true });
    if (!wgl) throw new Error('WebGL not available');
    var paint = new Paint(canvas, wgl);
    // Wait for shaders to load and initialization to complete
    await new Promise(function (resolve) {
        var check = function () {
            if (paint.brush && paint.simulator) resolve();
            else setTimeout(check, 10);
        };
        check();
    });
    return {
        engine: paint,
        paintStroke: function (points, color) {
            // points: [{x, y}, ...] in canvas space; color: [r, g, b, a] 0-1
            if (!points.length) return;
            var first = points[0];
            paint.brushX = first.x;
            paint.brushY = first.y;
            paint.brushColorHSVA = color; // simplified; real impl would convert RGB->HSV
            paint.brush.initialize(paint.brushX, paint.brushY, BRUSH_HEIGHT * paint.brushScale, paint.brushScale);
            paint.brushInitialized = true;
            paint.interactionState = InteractionMode.PAINTING;
            paint.saveSnapshot();
            for (var i = 1; i < points.length; ++i) {
                paint.brushX = points[i].x;
                paint.brushY = points[i].y;
                paint.update();
            }
            paint.interactionState = InteractionMode.NONE;
        },
        update: function () { paint.update(); },
        readback: function (width, height) {
            var save = paint.saveToTexture(width, height);
            var pixels = paint.readbackTexture(save.saveTexture, width, height);
            paint.wgl.deleteTexture(save.saveTexture);
            paint.wgl.deleteFramebuffer(save.saveFramebuffer);
            return pixels;
        },
        dispose: function () { paint.dispose(); }
    };
}

export default Paint;