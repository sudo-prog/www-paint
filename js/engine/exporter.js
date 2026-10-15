/**
 * Export system: PNG/JPG, self-contained HTML, and project files.
 *
 * @module exporter
 */

import { packShape, unpackShape, getRuntimeSource, shapeToSVG } from './shapes.js';

/**
 * Export the current painting to a PNG or JPG blob.
 *
 * @param {Renderer} renderer - Active renderer instance.
 * @param {Array<object>} layers - Layer list to export.
 * @param {object} [opts]
 * @param {number} [opts.width] - Export width (defaults to renderer size).
 * @param {number} [opts.height] - Export height.
 * @param {string} [opts.format='png'] - 'png' or 'jpg'.
 * @param {number} [opts.quality=0.92] - JPG quality 0..1.
 * @param {string} [opts.background='#ffffff']
 * @returns {Promise<Blob>}
 */
export async function exportImage(renderer, layers, opts = {}) {
  const {
    width = renderer.width,
    height = renderer.height,
    format = 'png',
    quality = 0.92,
    background = '#ffffff',
  } = opts;

  return renderer.exportImage(layers, width, height, {
    type: `image/${format}`,
    quality,
    background,
  });
}

/**
 * Serialize layers to a compact packed binary representation.
 *
 * Uses bit-packing: coordinates are quantized to 1px grid with 12-bit
 * fields, angles to 10 bits, colors to 8 bits per channel, alpha to 8 bits.
 *
 * @param {Array<object>} layers
 * @param {Array<string>} styleList - Registry of style names.
 * @returns {string} Base64-encoded packed data.
 */
export function packLayers(layers, styleList) {
  const allShapes = [];
  for (const layer of layers) {
    for (const s of (layer.strokes || [])) {
      allShapes.push({ ...s, _layer: layer.id });
    }
  }

  // Build binary buffer
  const packed = [];
  for (const s of allShapes) {
    packed.push(packShape(s, styleList));
  }

  // Each packed row: [type(1), params(8), color0(3), color1(3), alpha(1), styleIdx(1), layer(1), order(1), seed(1)] = 20
  const ELEMENTS_PER_SHAPE = 20;
  const buf = new Uint8Array(packed.length * ELEMENTS_PER_SHAPE);
  let offset = 0;
  for (const row of packed) {
    for (let i = 0; i < row.length; i++) {
      buf[offset++] = Math.max(0, Math.min(255, Math.round(row[i])));
    }
  }

  return base64Encode(buf);
}

/**
 * Base64-encode a Uint8Array using a fast string builder.
 *
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function base64Encode(bytes) {
  const lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let s = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
    s += lookup[b0 >> 2];
    s += lookup[((b0 & 3) << 4) | (b1 >> 4)];
    s += lookup[((b1 & 15) << 2) | (b2 >> 6)];
    s += lookup[b2 & 63];
  }
  // Handle padding
  const remainder = len % 3;
  if (remainder === 1) {
    s = s.slice(0, -2) + '==';
  } else if (remainder === 2) {
    s = s.slice(0, -1) + '=';
  }
  return s;
}

/**
 * Decode a base64-encoded packed buffer.
 *
 * @param {string} b64
 * @returns {Uint8Array}
 */
function base64Decode(b64) {
  const lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('');
  const bytes = [];
  for (let i = 0; i < b64.length; i += 4) {
    const enc1 = lookup.indexOf(b64[i]);
    const enc2 = lookup.indexOf(b64[i + 1]);
    const enc3 = lookup.indexOf(b64[i + 2]);
    const enc4 = lookup.indexOf(b64[i + 3]);
    bytes.push((enc1 << 2) | (enc2 >> 4));
    if (enc3 !== 64) bytes.push(((enc2 & 15) << 4) | (enc3 >> 2));
    if (enc4 !== 64) bytes.push(((enc3 & 3) << 6) | enc4);
  }
  return new Uint8Array(bytes);
}

/**
 * Generate a self-contained HTML file that can replay the painting.
 *
 * @param {Array<object>} layers
 * @param {object} [opts]
 * @param {number} [opts.width] - Canvas size in HTML.
 * @param {number} [opts.height]
 * @param {string} [opts.format='packed'] - 'packed' | 'readable'.
 * @param {number} [opts.strokeDuration=0.5] - Seconds per stroke in animation.
 * @param {string} [opts.background='#ffffff']
 * @param {Array<string>} [opts.styleList]
 * @returns {string} HTML document string.
 */
export function exportHTML(layers, opts = {}) {
  const {
    width = 1920,
    height = 1080,
    format = 'packed',
    strokeDuration = 0.5,
    background = '#ffffff',
    styleList = [],
  } = opts;

  let dataStr;
  if (format === 'packed') {
    dataStr = packLayers(layers, styleList);
  } else {
    // Readable: JSON array of shapes
    const allShapes = [];
    for (const layer of layers) {
      for (const s of (layer.strokes || [])) {
        allShapes.push(s);
      }
    }
    dataStr = JSON.stringify(allShapes.map(s => ({
      t: s.type,
      p: s.params,
      c0: s.color0,
      c1: s.color1,
      a: s.alpha,
      s: s.style,
      l: s.layer,
      o: s.order,
    })));
  }

  const runtime = getRuntimeSource();
  const totalStrokes = layers.reduce((sum, l) => sum + (l.strokes || []).length, 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WWW_PAINT Export</title>
<style>
html,body{margin:0;padding:0;background:${background};display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden}
canvas{max-width:100%;height:auto;image-rendering-pixelated}
</style>
</head>
<body>
<canvas id="c" width="${width}" height="${height}"></canvas>
<script>
${runtime}
(function(){
var canvas=document.getElementById('c'),ctx=canvas.getContext('2d');
var W=canvas.width,H=canvas.height;
var bg='${background}';
var data="${dataStr}";
var packed=${format === 'packed'};
var strokeDuration=${strokeDuration};
var totalStrokes=${totalStrokes};
var styles={};

function decodePacked(b64){
var bytes=atob(b64);
var out=[];
for(var i=0;i<bytes.length;i+=20){
var d=[];
for(var j=0;j<20;j++)d.push(bytes.charCodeAt(i+j));
out.push({t:String.fromCharCode(d[0]),p:d.slice(1,9),c0:d.slice(9,12),c1:d.slice(12,15),a:d[15]/255,s:styles[d[16]]||'default',l:d[17],o:d[18],seed:d[19]});
}
return out;
}

var shapes=packed?decodePacked(data):JSON.parse(data);
shapes.sort(function(a,b){return (a.o||0)-(b.o||0);});

// Clear and fill background
ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);

// Progressive replay
var idx=0;
var startTime=null;
function frame(ts){
if(!startTime)startTime=ts;
var elapsed=(ts-startTime)/1000;
var target=Math.min(shapes.length,Math.floor(elapsed/strokeDuration));
while(idx<target){
var sh=shapes[idx];
if(RUNTIME&&RUNTIME.draw){
sh.a=sh.a||1;
sh.c0=sh.c0;
sh.c1=sh.c1;
RUNTIME.draw({createContext:function(){return ctx},createLinearGradient:ctx.createLinearGradient.bind(ctx),createRadialGradient:ctx.createRadialGradient.bind(ctx),fillRect:ctx.fillRect.bind(ctx),ellipse:ctx.ellipse.bind(ctx),fill:ctx.fill.bind(ctx),stroke:ctx.stroke.bind(ctx),beginPath:ctx.beginPath.bind(ctx),moveTo:ctx.moveTo.bind(ctx),lineTo:ctx.lineTo.bind(ctx),quadraticCurveTo:ctx.quadraticCurveTo.bind(ctx),closePath:ctx.closePath.bind(ctx),save:ctx.save.bind(ctx),restore:ctx.restore.bind(ctx),translate:ctx.translate.bind(ctx),rotate:ctx.rotate.bind(ctx),globalAlpha:Object.getOwnPropertyDescriptor(ctx,'globalAlpha'),lineWidth:Object.getOwnPropertyDescriptor(ctx,'lineWidth'),lineCap:Object.getOwnPropertyDescriptor(ctx,'lineCap'),strokeStyle:Object.getOwnPropertyDescriptor(ctx,'strokeStyle'),fillStyle:Object.getOwnPropertyDescriptor(ctx,'fillStyle')},sh);
}
idx++;
}
// Apply per-shape alpha in a simpler way:
if(idx>=shapes.length){cancelAnimationFrame(rafId);return;}
var rafId=requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
</script>
</body>
</html>`;
}

/**
 * Export the entire project as a JSON object.
 *
 * @param {Array<object>} layers
 * @param {object} settings
 * @param {object} [opts]
 * @param {number} [opts.width]
 * @param {number} [opts.height]
 * @param {string} [opts.background]
 * @param {string} [opts.imageData] - Base64 image data for embedding.
 * @returns {string} JSON string of the project.
 */
export function exportProject(layers, settings, opts = {}) {
  const {
    width = 1920,
    height = 1080,
    background = '#ffffff',
    imageData = null,
  } = opts;

  const project = {
    version: '1.0',
    width,
    height,
    background,
    image: imageData || '',
    layers: layers.map(layer => ({
      id: layer.id,
      name: layer.name || '',
      visible: layer.visible !== undefined ? layer.visible : true,
      opacity: layer.opacity !== undefined ? layer.opacity : 1,
      blendMode: layer.blendMode || 'normal',
      locked: layer.locked || false,
      strokes: layer.strokes || [],
    })),
    settings: { ...settings },
  };

  return JSON.stringify(project, null, 2);
}

/**
 * Parse a project JSON string back into the working structure.
 *
 * @param {string} jsonStr
 * @returns {object} Parsed project object.
 */
export function importProject(jsonStr) {
  const project = JSON.parse(jsonStr);
  // Validate
  if (!project.version || !Array.isArray(project.layers)) {
    throw new Error('Invalid project file format');
  }
  return project;
}

/**
 * Export layers as SVG.
 *
 * @param {Array<object>} layers
 * @param {number} width
 * @param {number} height
 * @param {string} [background='#ffffff']
 * @returns {string} SVG document string.
 */
export function exportSVG(layers, width, height, background = '#ffffff') {
  let shapesSVG = '';
  for (const layer of layers) {
    if (!layer.visible) continue;
    for (const s of (layer.strokes || [])) {
      shapesSVG += shapeToSVG(s);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="${background}"/>
${shapesSVG}
</svg>`;
}

export default {
  exportImage,
  packLayers,
  exportHTML,
  exportProject,
  importProject,
  exportSVG,
};
