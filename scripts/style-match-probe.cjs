#!/usr/bin/env node
/**
 * Probe: does the Style-Match Score (Track-S S2) actually discriminate?
 *
 * Structural unit tests can prove the metric is deterministic, symmetric and
 * bounded, but not that it MEANS anything on real images. This drives the repo's
 * own visual-regression harness in headless Chromium, renders two real paintings
 * (`pencil` and `ink`, the pinned 700-stroke cases), analyses each with the
 * Track-S S1 analyser, and then asks the S2 score to judge a pencil-profile
 * render of that content against BOTH references.
 *
 * The claim measured here: the score prefers the reference whose stroke language
 * matches the profile. Everything is reported, not asserted away — a metric that
 * cannot tell two style references apart is not a style metric, and if this
 * number collapses the probe should say so.
 *
 * Usage: NODE_PATH=<dir with playwright-core> node scripts/style-match-probe.cjs
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
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

const PAGE_FN = async () => {
  const { analyzeReference } = await import('/js/engine/ref-analyze.js');
  const { scoreProfileStyle } = await import('/js/engine/score.js');
  const { createStyleRasteriser } = await import('/js/engine/style-render.js');

  const SEED = 3047602159;
  const COUNT = 700;

  /** Render a pinned-style case and decode the exported bytes back to pixels. */
  const renderPixels = async (style) => {
    const r = await window.runCase({ style, seed: SEED, count: COUNT });
    if (!r || !r.ok) throw new Error('runCase failed for ' + style + ': ' + (r && r.error));
    const img = new Image();
    img.src = r.dataURL;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height);
    return { pixels: d.data, width: c.width, height: c.height, bytes: r.bytes, strokes: r.strokes };
  };

  const pencilImg = await renderPixels('pencil');
  const inkImg = await renderPixels('ink');

  const refPencil = analyzeReference({ pixels: pencilImg.pixels, width: pencilImg.width, height: pencilImg.height });
  const refInk = analyzeReference({ pixels: inkImg.pixels, width: inkImg.width, height: inkImg.height });

  // A reference against itself is a perfect style match, by construction.
  const selfPencil = scoreProfileStyle(
    { global: { style: 'pencil', strokeCount: 200 } },
    { pixels: inkImg.pixels, width: inkImg.width, height: inkImg.height },
    refPencil, { seed: 11 },
  );

  // The same pencil profile, judged against each reference: the pencil reference
  // is the one whose stroke language the profile is built to produce.
  const content = { pixels: pencilImg.pixels, width: pencilImg.width, height: pencilImg.height };
  const profile = { global: { style: 'pencil', strokeCount: 200, detailLevel: 0.7 } };
  const nearPencil = scoreProfileStyle(profile, content, refPencil, { seed: 11 });
  const nearInk = scoreProfileStyle(profile, content, refInk, { seed: 11 });
  const repeat = scoreProfileStyle(profile, content, refPencil, { seed: 11 });

  // ── H-S6 (docs/checkpoints/S3.md §7 defect B) ────────────────────────────
  // The defect was that scoreProfileStyle rendered through a STYLE-AGNOSTIC
  // path, so a pencil and an ink profile scored byte-identically. The fix
  // (js/engine/style-render.js) renders through the real style registry. Check
  // it directly: two profiles that differ ONLY in style must produce DIFFERENT
  // pixels. Capture the rendered frame through the style backend.
  const renderForStyle = (style) => {
    const backend = createStyleRasteriser();
    let frame = null;
    const wrap = (shapes, w, h, bg) => { frame = backend(shapes, w, h, bg); return frame; };
    scoreProfileStyle({ global: { style, strokeCount: 200, detailLevel: 0.7 } }, content, refPencil,
      { seed: 11, render: wrap });
    const n = frame.length / 3;
    const bgR = frame[0], bgG = frame[1], bgB = frame[2]; // top-left ≈ background
    let painted = 0, sum = 0;
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      sum += (frame[o] + frame[o + 1] + frame[o + 2]) / 3;
      if (Math.abs(frame[o] - bgR) > 4 || Math.abs(frame[o + 1] - bgG) > 4 || Math.abs(frame[o + 2] - bgB) > 4) painted++;
    }
    return { pixels: frame, paintedFrac: painted / n, meanLum: sum / n };
  };
  const pxPencil = renderForStyle('pencil');
  const pxInk = renderForStyle('ink');
  let diff = 0;
  for (let i = 0; i < pxPencil.pixels.length; i++) {
    if (Math.abs(pxPencil.pixels[i] - pxInk.pixels[i]) > 2) diff++;
  }
  const styleDiffFrac = diff / pxPencil.pixels.length;

  // Cost is held fixed: more strokes trivially move a fidelity metric, so every
  // comparison above runs at the same stroke count.
  const sameCost = nearPencil.strokes === nearInk.strokes && nearPencil.strokes === 200;

  return {
    render: {
      pencil: { bytes: pencilImg.bytes, strokes: pencilImg.strokes },
      ink: { bytes: inkImg.bytes, strokes: inkImg.strokes },
    },
    packet: {
      pencilScaleHistogram: refPencil.scaleHistogram,
      inkScaleHistogram: refInk.scaleHistogram,
      pencilMeanStrokeScale: +refPencil.stats.meanStrokeScale.toFixed(4),
      inkMeanStrokeScale: +refInk.stats.meanStrokeScale.toFixed(4),
      pencilMeanDensity: +refPencil.stats.meanDensity.toFixed(4),
      inkMeanDensity: +refInk.stats.meanDensity.toFixed(4),
    },
    // styleMatch of a render against the reference it was MEANT to match vs the other one
    pencilProfile_vs_pencilRef: +nearPencil.styleMatch.toFixed(4),
    pencilProfile_vs_inkRef: +nearInk.styleMatch.toFixed(4),
    margin: +(nearPencil.styleMatch - nearInk.styleMatch).toFixed(4),
    parts_vs_pencilRef: {
      scale: +nearPencil.styleParts.scale.toFixed(4),
      orientation: +nearPencil.styleParts.orientation.toFixed(4),
      coverage: +nearPencil.styleParts.coverage.toFixed(4),
      bandScale: +nearPencil.styleParts.bandScale.toFixed(4),
      coherence: +nearPencil.styleParts.coherence.toFixed(4),
    },
    parts_vs_inkRef: {
      scale: +nearInk.styleParts.scale.toFixed(4),
      orientation: +nearInk.styleParts.orientation.toFixed(4),
      coverage: +nearInk.styleParts.coverage.toFixed(4),
      bandScale: +nearInk.styleParts.bandScale.toFixed(4),
      coherence: +nearInk.styleParts.coherence.toFixed(4),
    },
    selfPencilDistance: +selfPencil.styleDistance.toFixed(4),
    deterministic: nearPencil.styleMatch === repeat.styleMatch
      && nearPencil.styleDistance === repeat.styleDistance,
    sameCost,
    // H-S6: the style-aware render path actually ran, and two different styles
    // produced different pixels (the old path rendered them identically).
    styleAware: {
      backend: nearPencil.renderBackend,
      // The two renders compared below differ ONLY in `global.style`.
      profileStyle: nearPencil.style,
      rendersDiffer: +styleDiffFrac.toFixed(4),
      pencilPaintedFrac: +pxPencil.paintedFrac.toFixed(4),
      inkPaintedFrac: +pxInk.paintedFrac.toFixed(4),
      pencilMeanLum: +pxPencil.meanLum.toFixed(2),
      inkMeanLum: +pxInk.meanLum.toFixed(2),
    },
    pageErrors: [],
  };
};

async function main() {
  const exe = findChromium();
  if (!exe) { console.error('harness failure: no Chromium'); process.exit(2); }

  const { server, port } = await startServer();
  const browser = await chromium.launch({
    headless: true,
    executablePath: exe,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource/.test(t)) return;
    pageErrors.push(t);
  });

  await page.goto(`http://127.0.0.1:${port}/tests/visual/regression.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.harnessReady === true, { timeout: 20000 });
  const r = await page.evaluate(PAGE_FN);
  r.pageErrors = pageErrors.slice(0, 5);

  await browser.close();
  server.close();

  console.log(JSON.stringify(r, null, 2));

  const fail = (m) => { console.error('FAIL: ' + m); process.exit(1); };
  if (pageErrors.length) fail('page errors: ' + pageErrors.slice(0, 3).join(' | '));
  if (!(r.selfPencilDistance >= 0 && r.selfPencilDistance <= 1)) fail('distance out of range');
  if (!r.deterministic) fail('the score is not deterministic');
  if (!r.sameCost) fail('the comparison was not made at equal cost');
  const m = (n) => n >= 0 && n <= 1;
  for (const k of Object.keys(r.parts_vs_pencilRef)) {
    if (!m(r.parts_vs_pencilRef[k]) || !m(r.parts_vs_inkRef[k])) fail('a term is out of range: ' + k);
  }
  if (r.pencilProfile_vs_pencilRef === r.pencilProfile_vs_inkRef) {
    fail('the reference had no effect on the score — the metric cannot discriminate');
  }

  // ── H-S6: the render honours the profile's style ──────────────────────────
  if (r.styleAware.backend !== 'style') {
    fail('the style-aware render backend did not run in the browser: ' + r.styleAware.backend);
  }
  if (!(r.styleAware.rendersDiffer > 0.05)) {
    fail('a pencil and an ink profile rendered (nearly) identically — H-S6 is NOT fixed; '
      + 'differing fraction ' + r.styleAware.rendersDiffer);
  }
  if (!(r.styleAware.pencilPaintedFrac > 0.05 && r.styleAware.inkPaintedFrac > 0.05)) {
    fail('a styled render is blank: ' + JSON.stringify(r.styleAware));
  }

  console.log(`MEASURED: a pencil profile scores styleMatch ${r.pencilProfile_vs_pencilRef} `
    + `against the pencil reference vs ${r.pencilProfile_vs_inkRef} against the ink reference `
    + `(margin ${r.margin}); deterministic; ${r.pencilProfile_vs_pencilRef >= r.pencilProfile_vs_inkRef
      ? 'the matching reference wins' : 'MISMATCHED — the metric did NOT prefer the matching reference'}`);
  if (r.margin <= 0) process.exit(1);
  console.log(`H-S6 MEASURED: renderBackend=${r.styleAware.backend}; a pencil and an ink profile differ `
    + `in ${(r.styleAware.rendersDiffer * 100).toFixed(1)}% of pixels (was 0% before the fix); `
    + `painted ${(r.styleAware.pencilPaintedFrac * 100).toFixed(1)}% / ${(r.styleAware.inkPaintedFrac * 100).toFixed(1)}%`);
  console.log('PASS: style match is deterministic, bounded, measured at equal cost, prefers '
    + 'the reference whose stroke language matches the profile, and the render honours the profile style');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(2); });
