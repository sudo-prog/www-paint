#!/usr/bin/env node
// painter-parity-probe.cjs
// Node CJS script for WWW_PAINT painter-parity probe
// Requires playwright-core, http.server, fs, path
// Creates: scripts/painter-parity-probe.cjs + output dir files only

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// ── Parse flags ──
const minimist = require('minimist');
const args = minimist(process.argv.slice(2), {
  string: ['url', 'out', 'size', 'count', 'seed', 'help'],
  alias: { url: 'u', out: 'o', size: 's', count: 'c', seed: 'd', help: 'h' },
  default: { size: 512, count: 32, seed: 7, help: false },
});

if (args.help) {
  console.log(`
Usage: painter-parity-probe.cjs [options]
  --url, -u <url>   URL to load (default: http://127.0.0.1:8099/index.html)
  --out, -o <dir>   Output dir (default: ./painter-parity-out)
  --size, -s <size> Canvas size (default: 512)
  --count, -c <n>   Stroke count (default: 32)
  --seed, -d <n>    Random seed (default: 7)
  --help, -h        Show this help
`);
  process.exit(0);
}

const URL = args.url || 'http://127.0.0.1:8099/index.html';
const OUT_DIR = args.out || path.join(process.cwd(), 'painter-parity-out');
const CANVAS_SIZE = parseInt(args.size, 10) || 512;
const STROKE_COUNT = parseInt(args.count, 10) || 32;
const SEED = parseInt(args.seed, 10) || 7;

fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Locate kraken source ──
const capturedKraken =
  '/home/thinkpad/.hermes/profiles/chief-of-staff/cache/scratch/cp-input-0-img-1200x1200.png';
const localTestImages = path.join(process.cwd(), 'test-images', 'frog-source.jpg');
let krakenSourcePath = null;

if (fs.existsSync(localTestImages)) {
  krakenSourcePath = localTestImages;
} else if (fs.existsSync(capturedKraken)) {
  krakenSourcePath = capturedKraken;
  const tdi = path.join(process.cwd(), 'test-images');
  fs.mkdirSync(tdi, { recursive: true });
  fs.copyFileSync(krakenSourcePath, path.join(tdi, 'frog-source.jpg'));
} else {
  console.error('ERROR: Could not locate kraken source image');
  process.exit(1);
}

// ── Copy Code Painter reference render ──
const codePaintRef =
  '/home/thinkpad/.hermes/profiles/chief-of-staff/cache/scratch/codepaint-painted-kraken.png';
if (fs.existsSync(codePaintRef)) {
  fs.copyFileSync(codePaintRef, path.join(OUT_DIR, 'codepaint-kraken.png'));
} else {
  console.error('ERROR: Could not locate Code Painter reference render');
  process.exit(1);
}

// ── Start http.server ──
const serverProcess = spawn('python3', ['-m', 'http.server', '8099', '--bind', '127.0.0.1'], {
  cwd: process.cwd(),
  detached: true,
  stdio: 'ignore',
});
serverProcess.unref();

// ── Run probe ──
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath:
      '/home/thinkpad/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  });
  const page = await browser.newPage({ viewport: { width: 1500, height: 700 } });

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err).substring(0, 200)));

  console.log(`Navigating to ${URL}`);
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });

  // Give the app time to initialise
  await page.waitForTimeout(1000);

  console.log('Running probe in browser context...');

  // All canvas/metrics work happens in-page; returns data URLs + numbers
  const results = await page.evaluate(
    async (params) => {
      const { CANVAS_SIZE, STROKE_COUNT, SEED, KRAKEN_SRC } = params;

      // ── Load kraken source ──
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = KRAKEN_SRC;
      await img.decode();

      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = CANVAS_SIZE;
      srcCanvas.height = CANVAS_SIZE;
      const srcCtx = srcCanvas.getContext('2d');
      const scale = Math.min(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height);
      const width = img.width * scale;
      const height = img.height * scale;
      const x = (CANVAS_SIZE - width) / 2;
      const y = (CANVAS_SIZE - height) / 2;
      srcCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      srcCtx.drawImage(img, x, y, width, height);

      // ── Import PaintingEngine ──
      const { PaintingEngine } = await import('./js/engine/engine.js');

      // ── Capture source on plain canvas ──
      const originalCanvas = document.createElement('canvas');
      originalCanvas.width = CANVAS_SIZE;
      originalCanvas.height = CANVAS_SIZE;
      originalCanvas.getContext('2d').drawImage(srcCanvas, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      const originalDataURL = originalCanvas.toDataURL('image/png');

      // ── Helper: fresh engine ──
      function makeEngine() {
        const c = document.createElement('canvas');
        c.width = CANVAS_SIZE;
        c.height = CANVAS_SIZE;
        const e = new PaintingEngine({
          canvas: c,
          width: CANVAS_SIZE,
          height: CANVAS_SIZE,
          useWorker: true,
          background: '#fff',
        });
        return e;
      }

      // ── Helper: generate + render all ──
      async function generateAndRender(engine, opts) {
        await engine.loadImage(srcCanvas);
        await engine.generate(opts);
        engine.renderer.setLayers(engine.layers);
        engine.renderer.clear();
        engine.renderer.renderAll({ progress: 1, clear: false });
        return engine.canvas.toDataURL('image/png');
      }

      // ── Route A: legacy ──
      const legacyDataURL = await generateAndRender(makeEngine(), {
        count: STROKE_COUNT,
        seed: SEED,
        style: 'pencil',
      });

      // ── Route B: painter ──
      const painterDataURL = await generateAndRender(makeEngine(), {
        generationEngine: 'painter',
        layerBands: 'painter',
        count: STROKE_COUNT,
        seed: SEED,
        style: 'pencil',
        multiLayer: true,
      });

      // ── Capture per-layer images (Route B) with before/after checksums ──
      const layerNames = PaintingEngine.LAYER_NAMES;
      const layerResults = {};

      for (const layerName of layerNames) {
        const engine = makeEngine();
        await engine.loadImage(srcCanvas);
        await engine.generate({
          generationEngine: 'painter',
          layerBands: 'painter',
          count: STROKE_COUNT,
          seed: SEED,
          style: 'pencil',
          multiLayer: true,
        });

        // Set ONLY this layer visible
        const layers = engine.layers.map((layer) => {
          const lname = layer._name || layer.name || `layer_${layer.id}`;
          return { ...layer, visible: lname === layerName };
        });
        engine.renderer.setLayers(layers);
        engine.renderer.clear();
        engine.renderer.renderAll({ progress: 1, clear: false });

        const beforeDataURL = engine.canvas.toDataURL('image/png');
        const checksumBefore = beforeDataURL.split(',')[1]; // base64 payload

        // Toggle this layer off
        const idx = layers.findIndex(
        (l) => (l._name || l.name || `layer_${l.id}`) === layerName
        );
        if (idx >= 0) layers[idx].visible = false;

        engine.renderer.clear();
        engine.renderer.renderAll({ progress: 1, clear: false });

        const afterDataURL = engine.canvas.toDataURL('image/png');
        const checksumAfter = afterDataURL.split(',')[1]; // base64 payload

        // Render again with layer visible for the layer PNG
        const visibleLayers = engine.layers.map((layer) => {
        const lname = layer._name || layer.name || `layer_${layer.id}`;
        return { ...layer, visible: lname === layerName };
        });
        engine.renderer.setLayers(visibleLayers);
        engine.renderer.clear();
        engine.renderer.renderAll({ progress: 1, clear: false });
        const layerPngDataURL = engine.canvas.toDataURL('image/png');

        layerResults[layerName] = {
        dataURL: layerPngDataURL,
        visible: true,
        checksumBefore,
        checksumAfter,
        changed: beforeDataURL !== afterDataURL,
        };
      }

      // ── ImageData helper ──
      function getImageData(dataURL) {
        return new Promise((resolve, reject) => {
          const i = new Image();
          i.onload = () => {
            const c = document.createElement('canvas');
            c.width = CANVAS_SIZE;
            c.height = CANVAS_SIZE;
            const ctx = c.getContext('2d');
            ctx.drawImage(i, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
            resolve(ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE));
          };
          i.onerror = reject;
          i.src = dataURL;
        });
      }

      function computeCorrelationAndMAD(d1, d2) {
        const a1 = d1.data;
        const a2 = d2.data;
        const n = a1.length / 4;
        let sum1 = 0,
          sum2 = 0,
          sum1sq = 0,
          sum2sq = 0,
          sum12 = 0,
          madSum = 0;

        for (let i = 0; i < n; i++) {
          const idx = i * 4;
          const alpha1 = a1[idx + 3];
          const alpha2 = a2[idx + 3];
          if (alpha1 > 0 && alpha2 > 0) {
            const l1 = a1[idx] * 0.299 + a1[idx + 1] * 0.587 + a1[idx + 2] * 0.114;
            const l2 = a2[idx] * 0.299 + a2[idx + 1] * 0.587 + a2[idx + 2] * 0.114;
            sum1 += l1;
            sum2 += l2;
            sum1sq += l1 * l1;
            sum2sq += l2 * l2;
            sum12 += l1 * l2;
            madSum += Math.abs(l1 - l2);
          }
        }

        const mean1 = sum1 / n;
        const mean2 = sum2 / n;
        const var1 = sum1sq / n - mean1 * mean1;
        const var2 = sum2sq / n - mean2 * mean2;
        const covar = sum12 / n - mean1 * mean2;
        let correlation = null;
        if (var1 > 0 && var2 > 0) correlation = covar / Math.sqrt(var1 * var2);

        return { correlation, mad: madSum / n };
      }

      // ── Compute metrics ──
      const originalData = await getImageData(originalDataURL);
      const legacyData = await getImageData(legacyDataURL);
      const painterData = await getImageData(painterDataURL);

      const metrics = {
        legacy: computeCorrelationAndMAD(originalData, legacyData),
        painter: computeCorrelationAndMAD(originalData, painterData),
        painterVsLegacy: computeCorrelationAndMAD(legacyData, painterData),
      };

      // ── Sweep all 51 styles ──
      const { getAllStyles } = await import('./js/styles/index.js');
      const allStyles = getAllStyles();

      const styleResults = [];
      let renderedCount = 0;
      let erroredCount = 0;
      let blackOutputCount = 0;

      for (const entry of allStyles) {
        const styleName = entry.name;
        try {
          const engine = makeEngine();
          await engine.loadImage(srcCanvas);
          await engine.generate({
            generationEngine: 'painter',
            layerBands: 'painter',
            count: STROKE_COUNT,
            seed: SEED,
            style: styleName,
          });
          engine.renderer.setLayers(engine.layers);
          engine.renderer.clear();
          engine.renderer.renderAll({ progress: 1, clear: false });

          const styleDataURL = engine.canvas.toDataURL('image/png');
          const styleData = await getImageData(styleDataURL);
          const pixels = styleData.data;
          let opaqueCount = 0;
          let blackCount = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 3] > 0) {
              opaqueCount++;
              const lum =
                pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
              if (lum < 24) blackCount++;
            }
          }
          const blackFraction =
            opaqueCount > 0 ? parseFloat((blackCount / opaqueCount).toFixed(4)) : 0;
          if (blackFraction > 0.98) blackOutputCount++;

          styleResults.push({
            style: styleName,
            rendered: true,
            error: null,
            blackFraction,
          });
          renderedCount++;
        } catch (e) {
          styleResults.push({
            style: styleName,
            rendered: false,
            error: String(e),
            blackFraction: null,
          });
          erroredCount++;
        }
      }

      return {
        originalDataURL,
        legacyDataURL,
        painterDataURL,
        layerResults,
        metrics,
        styles: {
          styles: styleResults,
          summary: {
            total: allStyles.length,
            rendered: renderedCount,
            errored: erroredCount,
            blackOutput: blackOutputCount,
          },
        },
      };
    },
    { CANVAS_SIZE, STROKE_COUNT, SEED, KRAKEN_SRC: URL.replace('/index.html', '/test-images/frog-source.jpg') }
  );

  console.log('Probe complete in browser, writing files...');

  // ── Write PNGs from data URLs ──
  const writePng = (name, dataURL) => {
    const buf = Buffer.from(dataURL.split(',')[1], 'base64');
    fs.writeFileSync(path.join(OUT_DIR, name), buf);
    console.log(`Saved ${name}`);
  };

  writePng('original-kraken.png', results.originalDataURL);
  writePng('legacy-kraken.png', results.legacyDataURL);
  writePng('painter-kraken.png', results.painterDataURL);

  for (const [layerName, layerData] of Object.entries(results.layerResults)) {
    writePng(`layer-${layerName}-kraken.png`, layerData.dataURL);
  }

  // ── layer-toggles.json ──
  const layerToggles = {};
  for (const [layerName, layerData] of Object.entries(results.layerResults)) {
    layerToggles[layerName] = {
      visible: layerData.visible,
      checksumBefore: layerData.checksumBefore,
      checksumAfter: layerData.checksumAfter,
      changed: layerData.changed,
    };
  }
  fs.writeFileSync(
    path.join(OUT_DIR, 'layer-toggles.json'),
    JSON.stringify(layerToggles, null, 2)
  );
  console.log('Saved layer-toggles.json');

  // ── metrics.json ──
  fs.writeFileSync(
    path.join(OUT_DIR, 'metrics.json'),
    JSON.stringify(results.metrics, null, 2)
  );
  console.log('Saved metrics.json');

  // ── styles-51.json ──
  fs.writeFileSync(
    path.join(OUT_DIR, 'styles-51.json'),
    JSON.stringify(results.styles, null, 2)
  );
  console.log('Saved styles-51.json');

  // ── panels-kraken.png via HTML screenshot ──
  const panelsHtml = `
<!DOCTYPE html>
<html>
<head><title>Panels</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{background:#000;display:flex;justify-content:center;align-items:center;height:100vh;}
.grid{display:flex;gap:10px;}
img{width:512px;height:512px;object-fit:contain;display:block;}
</style>
</head>
<body>
  <div class="grid">
    <img src="${results.originalDataURL}" alt="Original">
    <img src="file://${path.join(OUT_DIR, 'codepaint-kraken.png')}" alt="Code Painter">
    <img src="${results.legacyDataURL}" alt="Legacy">
    <img src="${results.painterDataURL}" alt="Painter">
  </div>
</body>
</html>
  `;
  const panelsHtmlPath = path.join(OUT_DIR, 'panels.html');
  fs.writeFileSync(panelsHtmlPath, panelsHtml);

  const panelBrowser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath:
      '/home/thinkpad/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  });
  const panelPage = await panelBrowser.newPage({ viewport: { width: 2048, height: 1024 } });
  await panelPage.goto('file://' + panelsHtmlPath);
  await panelPage.waitForTimeout(2000);
  await panelPage.screenshot({
    path: path.join(OUT_DIR, 'panels-kraken.png'),
    clip: { x: 0, y: 0, width: 2048, height: 512 },
  });
  await panelBrowser.close();
  console.log('Saved panels-kraken.png');

  // ── Print output ──
  console.log('\n=== OUTPUT DIR LISTING ===');
  console.log(execSync(`ls -la ${OUT_DIR}`, { encoding: 'utf8' }));

  console.log('\n=== METRICS.JSON ===');
  console.log(JSON.stringify(results.metrics, null, 2));

  console.log('\n=== STYLES-51.JSON SUMMARY ===');
  console.log(`Total styles: ${results.styles.summary.total}`);
  console.log(`Rendered: ${results.styles.summary.rendered}`);
  console.log(`Errored: ${results.styles.summary.errored}`);
  console.log(`BlackOutput: ${results.styles.summary.blackOutput}`);

  console.log('\n=== PAGE CONSOLE ERRORS ===');
  if (consoleErrors.length > 0) {
    consoleErrors.forEach((err) => console.log(err));
  } else {
    console.log('No console errors');
  }

  if (pageErrors.length > 0) {
    console.log('\n=== PAGE ERRORS ===');
    pageErrors.forEach((err) => console.log(err));
  }

  await browser.close();
  serverProcess.kill();
  console.log('\nProbe completed successfully');
  process.exit(0);
})().catch((err) => {
  console.error('FATAL ERROR:', err);
  serverProcess.kill();
  process.exit(1);
});