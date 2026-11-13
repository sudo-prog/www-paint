#!/usr/bin/env node
/**
 * Probe: does the Style-Match Score (Track-S S2) actually discriminate?
 *
 * Structural unit tests can prove the metric is deterministic, symmetric and
 * bounded, but not that it MEANS anything on real images. This drives the repo's
 * own visual-regression harness in headless Chromium, renders real paintings
 * (`pencil`, `ink` and `cross-hatch`, the pinned 700-stroke cases), analyses each
 * with the Track-S S1 analyser, and then asks the S2 score to judge a
 * pencil-profile and an ink-profile render of that content against those
 * references.
 *
 * The claim ASSERTED here (since H-S5 corrected the orientation kernel): the
 * score prefers the reference whose stroke language matches the profile over a
 * GENUINELY DIFFERENT one (`cross-hatch`, whose orientation histogram is 0.60 —
 * not 1.0 — similar to the pencil reference). The pencil-vs-ink pair is an
 * ADJACENT pair: both references are 700-stroke structure-aligned renders of the
 * SAME content, so their packets are near-identical (orientationMatch ≈ 0.96) and
 * they cannot separate a render; it is REPORTED as a known limitation, not
 * asserted away. A metric that cannot tell two style references apart is not a
 * style metric, and if a number collapses the probe should say so.
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
  const { orientationMatch } = await import('/js/engine/metrics.js');

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

  // A reference whose stroke language is genuinely DIFFERENT from pencil/ink:
  // cross-hatch draws fixed-angle hatching, so its orientation histogram is not
  // content-driven the way a structure-aligned stroke is. Needed since H-S5:
  // the pencil and ink references turn out to be 0.96-similar in orientation
  // (both are 700-stroke structure-aligned renders of the SAME content), so they
  // cannot serve as the discriminating pair. Measured, not assumed — the probe
  // prints orientationMatch(pencilRef, inkRef) below.
  const crossHatchImg = await renderPixels('cross-hatch');
  const refCrossHatch = analyzeReference({
    pixels: crossHatchImg.pixels, width: crossHatchImg.width, height: crossHatchImg.height,
  });

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
  const nearCrossHatch = scoreProfileStyle(profile, content, refCrossHatch, { seed: 11 });
  const repeat = scoreProfileStyle(profile, content, refPencil, { seed: 11 });

  // The mirror-image case: an INK profile must prefer the ink reference.
  const inkProfile = { global: { style: 'ink', strokeCount: 200, detailLevel: 0.7 } };
  const inkNearInk = scoreProfileStyle(inkProfile, content, refInk, { seed: 11 });
  const inkNearCrossHatch = scoreProfileStyle(inkProfile, content, refCrossHatch, { seed: 11 });

  // How different are the two "adjacent" references at all? (`orientationMatch`
  // 1 = identical orientation distribution; the H-S5 correction is what makes
  // this number meaningful.)
  const refOrientation = orientationMatch(refPencil.orientationField.bins, refInk.orientationField.bins);
  const refOrientationCross = orientationMatch(refPencil.orientationField.bins, refCrossHatch.orientationField.bins);

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
    // ── the DISCRIMINATING pair (H-S5) ───────────────────────────────────────
    // pencil vs ink is an ADJACENT pair: both references are 700-stroke
    // structure-aligned renders of the same content, so their packets barely
    // differ (orientationMatch ≈ 0.96). cross-hatch is a genuinely different
    // stroke language, so it is the pair the metric can be held to.
    pencilProfile_vs_crossHatchRef: +nearCrossHatch.styleMatch.toFixed(4),
    margin_vs_crossHatch: +(nearPencil.styleMatch - nearCrossHatch.styleMatch).toFixed(4),
    inkProfile_vs_inkRef: +inkNearInk.styleMatch.toFixed(4),
    inkProfile_vs_crossHatchRef: +inkNearCrossHatch.styleMatch.toFixed(4),
    margin_ink_vs_crossHatch: +(inkNearInk.styleMatch - inkNearCrossHatch.styleMatch).toFixed(4),
    refOrientation_pencil_vs_ink: +refOrientation.toFixed(4),
    refOrientation_pencil_vs_crossHatch: +refOrientationCross.toFixed(4),
    parts_vs_crossHatchRef: {
      scale: +nearCrossHatch.styleParts.scale.toFixed(4),
      orientation: +nearCrossHatch.styleParts.orientation.toFixed(4),
      coverage: +nearCrossHatch.styleParts.coverage.toFixed(4),
      bandScale: +nearCrossHatch.styleParts.bandScale.toFixed(4),
      coherence: +nearCrossHatch.styleParts.coherence.toFixed(4),
    },
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
    if (!m(r.parts_vs_crossHatchRef[k])) fail('a term is out of range vs cross-hatch: ' + k);
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

  // ── H-S5: the metric is held to a pair the references can actually separate ─
  // cross-hatch is a different stroke language (orientationMatch to the pencil
  // reference ≈ 0.60). The pencil/ink pair is 0.96-identical in orientation
  // because both are structure-aligned renders of the SAME content, so it is
  // reported below as a known limitation rather than asserted.
  if (!(r.margin_vs_crossHatch > 0)) {
    fail('a pencil profile did not prefer the pencil reference over cross-hatch: '
      + 'styleMatch ' + r.pencilProfile_vs_pencilRef + ' vs ' + r.pencilProfile_vs_crossHatchRef);
  }
  if (!(r.margin_ink_vs_crossHatch > 0)) {
    fail('an ink profile did not prefer the ink reference over cross-hatch: '
      + 'styleMatch ' + r.inkProfile_vs_inkRef + ' vs ' + r.inkProfile_vs_crossHatchRef);
  }

  console.log(`H-S5 MEASURED (discriminating pair): a pencil profile scores styleMatch `
    + `${r.pencilProfile_vs_pencilRef} against the pencil reference vs ${r.pencilProfile_vs_crossHatchRef} `
    + `against the cross-hatch reference (margin ${r.margin_vs_crossHatch}); the matching reference wins. `
    + `An ink profile: ${r.inkProfile_vs_inkRef} vs ${r.inkProfile_vs_crossHatchRef} `
    + `(margin ${r.margin_ink_vs_crossHatch}).`);
  console.log(`H-S5 KNOWN LIMITATION (reported, not asserted): the ADJACENT pair cannot be separated — `
    + `pencil ${r.pencilProfile_vs_pencilRef} vs ink ${r.pencilProfile_vs_inkRef} `
    + `(margin ${r.margin}), because the two references are near-identical: `
    + `orientationMatch(pencilRef, inkRef) = ${r.refOrientation_pencil_vs_ink} `
    + `vs ${r.refOrientation_pencil_vs_crossHatch} for cross-hatch. Both references are `
    + `structure-aligned 700-stroke renders of the SAME content, so their packets are `
    + `content-dominated — S9's job (a genuinely different reference pair).`);
  console.log(`H-S6 MEASURED: renderBackend=${r.styleAware.backend}; a pencil and an ink profile differ `
    + `in ${(r.styleAware.rendersDiffer * 100).toFixed(1)}% of pixels (was 0% before the fix); `
    + `painted ${(r.styleAware.pencilPaintedFrac * 100).toFixed(1)}% / ${(r.styleAware.inkPaintedFrac * 100).toFixed(1)}%`);
  console.log('PASS: style match is deterministic, bounded, measured at equal cost, prefers '
    + 'the reference whose stroke language matches the profile, and the render honours the profile style');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(2); });
