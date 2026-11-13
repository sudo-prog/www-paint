#!/usr/bin/env node
/**
 * Probe (Track-S S2/S3 diagnostics, written for hygiene H-S5): a reference-pair
 * discriminability MATRIX.
 *
 * H-S5 corrected `orientationMatch` (ratio of kernel cross- and self-products),
 * after which `scripts/style-match-probe.cjs`'s pencil-vs-ink margin flipped
 * NEGATIVE. This script answers the question that decides whether that is a
 * metric bug or a probe-premise bug: *are the two references actually different,
 * and which term separates them if any?*
 *
 * It renders the repo's own 9 pinned 700-stroke cases (deterministic: seed
 * 3047602159), analyses each with the S1 analyser, and prints
 *   - the pairwise `orientationMatch` between every pair of reference packets
 *     (1 = same orientation distribution),
 *   - the pairwise `refPacketMatch` between every pair of reference packets
 *     (the composite, 1 = same stroke language),
 *   - for a 200-stroke PENCIL-profile render and a 200-stroke INK-profile
 *     render, the `styleMatch` (and per-term parts) against every reference.
 *
 * Everything is reported; nothing is asserted. Usage:
 *   NODE_PATH=<dir with playwright-core> node scripts/style-ref-matrix.cjs
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const STYLES = ['pencil', 'ink', 'watercolor', 'oil', 'charcoal', 'marker', 'cross-hatch', 'halftone', 'graphic'];

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

const PAGE_FN = async (styles) => {
  const { analyzeReference } = await import('/js/engine/ref-analyze.js');
  const { scoreProfileStyle } = await import('/js/engine/score.js');
  const { orientationMatch, histogramDistance, valueMapDistance } = await import('/js/engine/metrics.js');

  const SEED = 3047602159;

  const renderPixels = async (style, count) => {
    const r = await window.runCase({ style, seed: SEED, count });
    if (!r || !r.ok) throw new Error('runCase failed for ' + style + ': ' + (r && r.error));
    const img = new Image();
    img.src = r.dataURL;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height);
    return { pixels: d.data, width: c.width, height: c.height };
  };

  const refs = {};
  for (const s of styles) {
    const img = await renderPixels(s, 700);
    refs[s] = analyzeReference({ pixels: img.pixels, width: img.width, height: img.height });
  }

  const content = await renderPixels('pencil', 700);
  const contentArg = { pixels: content.pixels, width: content.width, height: content.height };

  // A profile render at a FIXED cost (more strokes trivially moves fidelity).
  const scoreOf = (profileStyle, refName) => {
    const r = scoreProfileStyle(
      { global: { style: profileStyle, strokeCount: 200, detailLevel: 0.7 } },
      contentArg, refs[refName], { seed: 11 },
    );
    return {
      styleMatch: +r.styleMatch.toFixed(4),
      parts: {
        scale: +r.styleParts.scale.toFixed(4),
        orientation: +r.styleParts.orientation.toFixed(4),
        coverage: +r.styleParts.coverage.toFixed(4),
        bandScale: +r.styleParts.bandScale.toFixed(4),
        coherence: +r.styleParts.coherence.toFixed(4),
      },
    };
  };

  const orientation = {};
  const scaleHist = {};
  const coverageHist = {};
  const bandScale = {};
  const coherenceDelta = {};
  for (const a of styles) {
    orientation[a] = {}; scaleHist[a] = {}; coverageHist[a] = {};
    bandScale[a] = {}; coherenceDelta[a] = {};
    for (const b of styles) {
      const pa = refs[a], pb = refs[b];
      orientation[a][b] = +orientationMatch(pa.orientationField.bins, pb.orientationField.bins).toFixed(4);
      scaleHist[a][b] = +histogramDistance(pa.scaleHistogram, pb.scaleHistogram).toFixed(4);
      coverageHist[a][b] = +histogramDistance(
        [pa.coverage.background, pa.coverage.shadows, pa.coverage.midtones, pa.coverage.highlights],
        [pb.coverage.background, pb.coverage.shadows, pb.coverage.midtones, pb.coverage.highlights],
      ).toFixed(4);
      bandScale[a][b] = +valueMapDistance(pa.strokeScaleByBand, pb.strokeScaleByBand).toFixed(4);
      coherenceDelta[a][b] = +Math.min(1, Math.abs(
        (pa.stats.meanCoherence || 0) - (pb.stats.meanCoherence || 0),
      )).toFixed(4);
    }
  }

  const profileMatrix = { pencil: {}, ink: {} };
  for (const rn of styles) {
    profileMatrix.pencil[rn] = scoreOf('pencil', rn);
    profileMatrix.ink[rn] = scoreOf('ink', rn);
  }

  return {
    styles,
    packetStats: Object.fromEntries(styles.map((s) => [s, {
      meanCoherence: +refs[s].stats.meanCoherence.toFixed(4),
      meanStrokeScale: +refs[s].stats.meanStrokeScale.toFixed(4),
      meanDensity: +refs[s].stats.meanDensity.toFixed(4),
      scaleHistogram: refs[s].scaleHistogram,
      orientationBins: refs[s].orientationField.bins.map((v) => +v.toFixed(4)),
    }])),
    orientation, // note: the imported function would NOT survive serialization
    scaleHistogramDistance: scaleHist,
    coverageDistance: coverageHist,
    bandScaleDistance: bandScale,
    coherenceDelta,
    profileMatrix,
    pageErrors: [],
  };
};

async function main() {
  const exe = findChromium();
  if (!exe) { console.error('harness failure: no Chromium'); process.exit(2); }
  const { server, port } = await startServer();
  const browser = await chromium.launch({
    headless: true, executablePath: exe,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/tests/visual/regression.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.harnessReady === true, { timeout: 20000 });
  const r = await page.evaluate(PAGE_FN, STYLES);
  r.pageErrors = pageErrors.slice(0, 5);
  await browser.close();
  server.close();

  console.log(JSON.stringify(r, null, 2));

  const pad = (s, n) => String(s).padEnd(n);
  const cell = (v) => pad(Number(v).toFixed(3), 7);
  console.log('\n== orientationMatch between reference packets (1 = same orientation distribution) ==');
  console.log(pad('', 12) + r.styles.map((s) => pad(s.slice(0, 7), 8)).join(''));
  for (const a of r.styles) {
    console.log(pad(a.slice(0, 11), 12) + r.styles.map((b) => cell(r.orientation[a][b])).join(''));
  }

  console.log('\n== scaleHistogramDistance (0 = same scale distribution) ==');
  console.log(pad('', 12) + r.styles.map((s) => pad(s.slice(0, 7), 8)).join(''));
  for (const a of r.styles) {
    console.log(pad(a.slice(0, 11), 12) + r.styles.map((b) => cell(r.scaleHistogramDistance[a][b])).join(''));
  }

  console.log('\n== styleMatch: a PENCIL-profile render (200 strokes) vs each reference ==');
  for (const s of r.styles) console.log('  ' + pad(s, 12) + r.profileMatrix.pencil[s].styleMatch
    + '  parts ' + JSON.stringify(r.profileMatrix.pencil[s].parts));
  console.log('== styleMatch: an INK-profile render (200 strokes) vs each reference ==');
  for (const s of r.styles) console.log('  ' + pad(s, 12) + r.profileMatrix.ink[s].styleMatch
    + '  parts ' + JSON.stringify(r.profileMatrix.ink[s].parts));

  if (r.pageErrors.length) { console.error('page errors: ' + r.pageErrors.join(' | ')); process.exit(1); }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(2); });
