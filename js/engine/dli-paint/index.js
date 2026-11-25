/**
 * dli-paint — Faithful port of David Li's Fluid Paint (MIT License).
 * 
 * This module provides the core dli/paint implementation that will be used as the
 * backend for WWW_PAINT's OIL style. The port preserves the algorithmic structure
 * and constants from the reference implementation while adapting to modern ES modules.
 * 
 * MIT License (dli/paint):
 * Copyright (c) 2017 David Li (http://dli/paint)
 * See index.js for full license text.
 */

export { default as Paint } from './paint.module.js';
export { default as Brush, BRUSH_CONSTANTS } from './brush.module.js';
export { default as Simulator } from './simulator.module.js';
export { WrappedGL } from './wrappedgl.module.js';
export { Rectangle } from './rectangle.js';

// ─── Upstream constants (dli/paint paint.js / profile.js) ───────────────────
export const MAX_BRISTLE_COUNT = 100;
export const MIN_BRISTLE_COUNT = 10;

export const BRUSH_HEIGHT = 2.0;
export const Z_THRESHOLD = 0.13333;

export const SPLAT_VELOCITY_SCALE = 0.14;
export const SPLAT_RADIUS = 0.05;

export const NORMAL_SCALE = 7.0;
export const ROUGHNESS = 0.075;
export const F0 = 0.05;
export const SPECULAR_SCALE = 0.5;
export const DIFFUSE_SCALE = 0.15;
export const LIGHT_DIRECTION = [0, 1, 1];

export const PRESSURE_JACOBI_ITERATIONS = 2;
export const FRAMES_TO_SIMULATE = 60;

// Path prefix the backend uses to resolve `shaders/*.frag|vert` over HTTP.
export const SHADER_PATH_PREFIX = 'js/engine/dli-paint/';

// List of every shader the Brush + Simulator constructors read, keyed by the
// exact `shaders/<name>` identifiers those constructors look up. Given to
// WrappedGL.loadTextFilesAsync() to preload sources before constructing.
export const BACKGROUND_GRAY = 0.7;

export const SHADER_FILES = [
  'shaders/fullscreen.vert',
  'shaders/project.frag',
  'shaders/distanceconstraint.frag',
  'shaders/planeconstraint.frag',
  'shaders/bendingconstraint.frag',
  'shaders/setbristles.frag',
  'shaders/updatevelocity.frag',
  'shaders/splat.vert',
  'shaders/splat.frag',
  'shaders/advect.frag',
  'shaders/divergence.frag',
  'shaders/jacobi.frag',
  'shaders/subtract.frag',
  'shaders/output.frag',
  'shaders/resize.frag',
  'shaders/shadow.frag',
  'shaders/painting.vert',
  'shaders/painting.frag',
];