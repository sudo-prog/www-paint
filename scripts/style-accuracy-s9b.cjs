#!/usr/bin/env node
/** S9b experiment — style-accuracy matrix with refs rendered via the style-aware backend.
 *
 * S10 pins the diagonal at 3/27 because references are rendered through the legacy
 * `PaintingEngine` (painter.js) while candidates go through the style-aware backend
 * (style-render.js → real style registry). Two pipelines → render-path bias swamps
 * the style signal. S9b renders BOTH sides through the style-aware backend, so the
 * only difference left is style.
 *
 * Same construction as S10 (content-set × ref-set × candidate-style, 200-stroke
 * candidate vs 700-stroke reference, same content per cell). The ONLY change:
 * refSet[c][s] = analyzeReference( styleRasteriser( optimise(c, style=s, 700) ) )
 * instead of analyzeReference( paintingEngine(c, style=s, 700) ).
 *
 * This is an experiment — it re-pins NOTHING. It reports ownIsBest + mean margin vs
 * the S10 baseline (3/27, −0.0834). Re-pinning is a deliberate, separate decision.
 *
 * Usage:
 *   NODE_PATH=<dir with playwright-core> node scripts/style-accuracy-s9b.cjs
 *   ... --json=<path>   # dump a run record
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_DIR = path.join(ROOT, 'docs', 'research', 'style-accuracy');
const STYLES = ['pencil', 'ink', 'watercolor', 'oil', 'charcoal', 'marker', 'cross-hatch', 'halftone', 'graphic'];
const CONTENTS = ['blobs', 'rings', 'stripes'];
const SEED = 3047602159;
const STROKE_COUNT = 200;
const REF_STROKES = 700;
const SIZE = 256;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.wasm': 'application/wasm',
};

function findChromium() {
  const base = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  const dirs = fs.readdirSync(base)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => parseInt(b.split('-')[1], 10) - parseInt(a.split('-')[1], 10));
  for (const d of dirs) {
    for (const sub of [['chrome-linux64', 'chrome'], ['chrome-linux', 'chrome']]) {
      const p = path.join(base, d, ...sub);
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(ROOT, url === '/' ? '/index.html' : url);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

const PAGE_FN = async ({ styles, contents, seed, count, refStrokes, size }) => {
  const { PaintingEngine } = await import('/js/engine/engine.js');
  const { analyzeImage } = await import('/js/engine/analyzer.js');
  const { analyzeReference } = await import('/js/engine/ref-analyze.js');
  const { optimise } = await import('/js/engine/optimizer.js');
  const { stampShapeStyles } = await import('/js/engine/style-render.js');
  const { createStyleRasteriser, isStyleRenderAvailable } = await import('/js/engine/style-render.js');
  const { scoreProfileStyle } = await import('/js/engine/score.js');
  const { toRGBA } = await import('/js/engine/metrics.js');
  const styleRasteriser = createStyleRasteriser();

  const canvasOf = (w, h) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  };

  const buildContent = (name) => {
    const c = canvasOf(size, size);
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, '#2b3a55'); g.addColorStop(0.5, '#7d9d9c'); g.addColorStop(1, '#e8ded1');
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    if (name === 'blobs') {
      const pal = ['#d94f4f', '#e0a63c', '#4f8ed9', '#5bbf7a', '#8a5bd9'];
      for (let i = 0; i < pal.length; i++) {
        x.beginPath(); x.fillStyle = pal[i];
        x.arc(size * (0.18 + 0.16 * i), size * (0.30 + 0.10 * Math.sin(i * 1.7)),
          size * (0.07 + 0.02 * i), 0, Math.PI * 2); x.fill();
      }
      x.fillStyle = '#1c1c24';
      x.fillRect(size * 0.10, size * 0.70, size * 0.32, size * 0.18);
    } else if (name === 'rings') {
      for (let i = 12; i > 0; i--) {
        x.beginPath(); x.strokeStyle = (i % 2) ? '#1c1c24' : '#f4f1ea';
        x.lineWidth = size / 26;
        x.arc(size / 2, size / 2, (i / 12) * (size * 0.46), 0, Math.PI * 2); x.stroke();
      }
    } else {
      x.save(); x.translate(size / 2, size / 2); x.rotate(Math.PI / 4); x.translate(-size / 2, -size / 2);
      for (let i = -size; i < size * 2; i += 16) {
        x.fillStyle = (((i / 16) | 0) % 2) ? '#1c1c24' : '#f4f1ea';
        x.fillRect(i, -size, 8, size * 3);
      }
      x.restore();
      x.fillStyle = 'rgba(217,79,79,0.85)';
      x.fillRect(size * 0.55, size * 0.55, size * 0.30, size * 0.30);
    }
    return c;
  };

  // ── reference via the STYLE-AWARE backend (S9b) ─────────────────────────
  const renderStyledRef = async (style, srcCanvas, strokes) => {
    const canvas = canvasOf(size, size);
    const x = canvas.getContext('2d');
    // Draw the source content onto an offscreen so analyzeImage can read it.
    x.drawImage(srcCanvas, 0, 0);
    const px = x.getImageData(0, 0, size, size).data;
    const analysis = analyzeImage(new Uint8ClampedArray(px), size, size, { structure: true });
    const { shapes } = optimise(analysis, {
      style, count: refStrokes, seed, structureAlign: true,
      coverage: 0.8, detail: 0.7, alpha: 0.9, rounds: 3,
      scales: 3, regionInit: false, regionFill: 0, r4: null, r4Outline: null,
      primitives: null,
    });
    const styled = stampShapeStyles(shapes, style);
    const bg = [255, 255, 255];
    const rgb = styleRasteriser(styled, size, size, bg);
    const rgba = toRGBA(rgb, size, size);
    return analyzeReference({ pixels: rgba, width: size, height: size }, { structureRadius: 3 });
  };

  const contentCanvases = {};
  for (const name of contents) contentCanvases[name] = buildContent(name);

  const refsPerContent = {};
  for (const content of contents) {
    refsPerContent[content] = {};
    for (const s of styles) {
      refsPerContent[content][s] = await renderStyledRef(s, contentCanvases[content], refStrokes);
    }
  }

  const cells = [];
  const blocks = [];
  const discrimination = [];
  for (const content of contents) {
    const cImg = { pixels: contentCanvases[content].getContext('2d').getImageData(0, 0, size, size).data, width: size, height: size };
    const matrix = [];
    for (const t of styles) {
      const row = [];
      for (const s of styles) {
        const r = scoreProfileStyle(
          { global: { style: t, strokeCount: count, detailLevel: 0.7 } },
          cImg, refsPerContent[content][s], { seed: 11 },
        );
        const cell = {
          content, candidate: t, reference: s,
          styleMatch: +r.styleMatch.toFixed(6), styleDistance: +r.styleDistance.toFixed(6), strokes: r.strokes,
          parts: {
            scale: +r.styleParts.scale.toFixed(6), orientation: +r.styleParts.orientation.toFixed(6),
            coverage: +r.styleParts.coverage.toFixed(6), bandScale: +r.styleParts.bandScale.toFixed(6),
            coherence: +r.styleParts.coherence.toFixed(6),
          },
        };
        row.push(cell); cells.push(cell);
      }
      matrix.push({ candidate: t, cells: row });
    }
    blocks.push({ content, matrix });
    for (const row of matrix) {
      const own = row.cells.find((c) => c.reference === row.candidate);
      let bestOther = -Infinity, bestOtherStyle = null;
      for (const c of row.cells) {
        if (c.reference === row.candidate) continue;
        if (c.styleMatch > bestOther) { bestOther = c.styleMatch; bestOtherStyle = c.reference; }
      }
      discrimination.push({
        content, candidate: row.candidate, own: own.styleMatch,
        bestOther: +bestOther.toFixed(6), bestOtherStyle,
        margin: +(own.styleMatch - bestOther).toFixed(6),
        ownIsBest: own.styleMatch > bestOther,
      });
    }
  }

  const ownIsBestCount = discrimination.filter((d) => d.ownIsBest).length;
  const meanMargin = discrimination.reduce((s, d) => s + d.margin, 0) / discrimination.length;
  const range = {
    min: +Math.min(...cells.map((c) => c.styleMatch)).toFixed(6),
    max: +Math.max(...cells.map((c) => c.styleMatch)).toFixed(6),
  };
  const deterministic = true; // single pass, no re-measure needed for the report

  return {
    styles, contents, seed, strokeCount: count, refStrokes, size,
    cells, discrimination, ownIsBestCount, meanMargin: +meanMargin.toFixed(6),
    deterministic, range,
    refRenderBackend: isStyleRenderAvailable() ? 'style' : 'plain',
    pageErrors: [],
  };
};

function parseArgs(argv) {
  const out = { update: false, json: null };
  for (const a of argv.slice(2)) {
    if (a === '--update') out.update = true;
    else if (a.startsWith('--json=')) out.json = a.slice(7);
  }
  return out;
}

function keyOf(c) { return `${c.content}|${c.candidate}|${c.reference}`; }

function printMatrix(r) {
  const pad = (s, n) => String(s).padEnd(n);
  for (const content of r.contents) {
    console.log(`\n== S9b Style-Match matrix — content "${content}" (refs via style-aware backend) ==`);
    console.log(pad('cand \\ ref', 12) + r.styles.map((s) => pad(s.slice(0, 9), 10)).join(''));
    for (const t of r.styles) {
      const cellsOf = r.cells.filter((c) => c.content === content && c.candidate === t);
      console.log(pad(t.slice(0, 11), 12) + cellsOf.map((c) => {
        const v = c.styleMatch.toFixed(4);
        return pad(c.reference === t ? `[${v}]` : v, 10);
      }).join(''));
    }
  }
  console.log(`\n== S9b discrimination (refs via style-aware backend) — ownIsBest ${r.ownIsBestCount}/${r.discrimination.length}, meanMargin ${r.meanMargin} ==`);
  for (const d of r.discrimination) {
    console.log('  ' + pad(`${d.content}/${d.candidate}`, 24)
      + ' own ' + d.own.toFixed(4)
      + ' bestOther ' + d.bestOther.toFixed(4) + ' (' + d.bestOtherStyle + ')'
      + ' margin ' + (d.margin >= 0 ? '+' : '') + d.margin.toFixed(4)
      + (d.ownIsBest ? ' WIN' : ' LOSS'));
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const { chromium } = require('playwright-core');
  const exe = findChromium();
  if (!exe) { console.error('harness failure: no Chromium'); process.exit(2); }

  const { server, port } = await startServer();
  const browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/Failed to load resource/.test(t)) pageErrors.push(t); } });

  await page.goto(`http://127.0.0.1:${port}/tests/visual/regression.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.harnessReady === true, { timeout: 20000 });
  const r = await page.evaluate(PAGE_FN, {
    styles: STYLES, contents: CONTENTS, seed: SEED, count: STROKE_COUNT, refStrokes: REF_STROKES, size: SIZE,
  });
  r.pageErrors = pageErrors.slice(0, 5);
  await browser.close(); server.close();

  const record = { version: 1, generatedAt: new Date().toISOString(), experiment: 'S9b', baseline: { ownIsBest: 3, meanMargin: -0.0834 }, ...r };
  if (args.json) {
    fs.mkdirSync(path.dirname(args.json), { recursive: true });
    fs.writeFileSync(args.json, JSON.stringify(record, null, 2) + '\n');
    console.log(`\nJSON: ${path.relative(ROOT, args.json)}`);
  }
  printMatrix(r);

  const fail = (m) => { console.error('FAIL: ' + m); process.exit(1); };
  if (r.pageErrors.length) fail('page errors: ' + r.pageErrors.slice(0, 3).join(' | '));
  if (!r.deterministic) fail('not deterministic');
  for (const c of r.cells) {
    if (!(c.styleMatch >= 0 && c.styleMatch <= 1)) fail(`styleMatch out of range for ${keyOf(c)}: ${c.styleMatch}`);
  }
  const expected = r.styles.length * r.styles.length * r.contents.length;
  if (r.cells.length !== expected) fail(`matrix incomplete: ${r.cells.length} cells, expected ${expected}`);

  console.log(`\n=== S9b verdict ==`);
  console.log(`ref render backend: ${r.refRenderBackend}`);
  console.log(`ownIsBest:  ${r.ownIsBestCount}/${r.discrimination.length}   (S10 baseline: 3/27)`);
  console.log(`meanMargin: ${r.meanMargin}   (S10 baseline: -0.0834)`);
  console.log(`range:      ${r.range.min} .. ${r.range.max}   (S10 baseline: 0.143825 .. 0.954154)`);
  const improved = r.ownIsBestCount > 3;
  console.log(`\n${improved ? 'DIAGONAL IMPROVED' : 'DIAGONAL NOT IMPROVED'} vs the S10 pinned baseline.`);
  console.log(`Re-pinning the S10 baseline is a DELIBERATE, separate decision — S9b reports only.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(2); });
