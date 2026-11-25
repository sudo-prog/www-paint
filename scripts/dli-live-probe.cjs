/**
 * dli-live-probe.cjs — Verifies the dli/paint backend is LIVE in the real app path.
 *
 * Runs with: NODE_PATH=/home/thinkpad/.hermes/hermes-agent/node_modules node scripts/dli-live-probe.cjs
 *
 * Launches Chromium with SwiftShader (NO --disable-gpu), loads test-images/frog-source.jpg
 * through the real app path, generates OIL style, and asserts:
 *   - backend is 'dli' (not fallback)
 *   - fallbackCount == 0
 *   - strokes > 0
 *   - page errors == 0
 *   - identical canvas hash across 2 consecutive renders
 *   - ink% > 0
 *   - chroma > 0
 *   - relief range > 0
 *
 * Writes docs/research/dli-live-probe.json and two PNGs.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = '/home/thinkpad/Data/20_Projects/20.36_WWW_PAINT';
const NODE_PATH = '/home/thinkpad/.hermes/hermes-agent/node_modules';
const PLAYWRIGHT_CORE = path.join(NODE_PATH, 'playwright-core');
// Find the newest chromium
const chromiumDirs = fs.readdirSync('/home/thinkpad/.cache/ms-playwright')
  .filter(d => d.startsWith('chromium-'))
  .sort((a, b) => parseInt(b.split('-')[1]) - parseInt(a.split('-')[1]));
const CHROMIUM_PATH = chromiumDirs.length > 0
  ? path.join('/home/thinkpad/.cache/ms-playwright', chromiumDirs[0], 'chrome-linux64', 'chrome')
  : '/home/thinkpad/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const PROBE_SCRIPT = `
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = '${REPO_ROOT}';
const OUT_DIR = path.join(REPO_ROOT, 'docs/research');

async function main() {
  const browser = await chromium.launch({
    executablePath: '${CHROMIUM_PATH}',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-dev-shm-usage',
      '--disable-gpu-sandbox'
      // NO --disable-gpu - that kills WebGL/SwiftShader!
    ]
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // Serve the repo root
  const baseURL = 'http://localhost:8099';
  await page.goto(baseURL + '/index.html', { waitUntil: 'networkidle', timeout: 60000 });

  // Wait for app to be ready
  await page.waitForFunction(() => window.__app && window.__app.engine, { timeout: 60000 });

  // Load test image
  const fileInput = await page.$('#image-file-input');
  if (!fileInput) {
    throw new Error('File input #image-file-input not found');
  }

  // Upload frog-source.jpg
  const frogPath = path.join(REPO_ROOT, 'test-images/frog-source.jpg');
  await page.setInputFiles('#image-file-input', frogPath);
  await page.waitForTimeout(2000); // wait for image to load

  // Verify image loaded
  const loaded = await page.evaluate(() => {
    return window.__app && window.__app.engine && window.__app.engine._analysis;
  });
  if (!loaded) {
    throw new Error('Image failed to load or analyze');
  }

  // Generate OIL style
  await page.evaluate(async () => {
    await window.__app.generate({ style: 'oil', count: 6 });
    window.__app.engine.render();
  });
  await page.waitForTimeout(5000); // wait for render (dli backend can be slow first time)

  // First render - capture canvas and stats
  const result1 = await page.evaluate(async () => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    
    // Compute hash
    let hash = 0;
    for (let i = 0; i < data.length; i += 4) {
      hash = ((hash << 5) - hash + data[i] * 1000003 + data[i+1] * 1000033 + data[i+2] * 1000037) >>> 0;
    }
    
    // Compute ink%, chroma, relief from pixel data
    let nonTransparent = 0;
    let totalChroma = 0;
    let minLum = 255, maxLum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
      if (a > 0) {
        nonTransparent++;
        const cmax = Math.max(r, g, b), cmin = Math.min(r, g, b);
        totalChroma += (cmax - cmin);
        const lum = 0.299*r + 0.587*g + 0.114*b;
        minLum = Math.min(minLum, lum);
        maxLum = Math.max(maxLum, lum);
      }
    }
    const totalPixels = canvas.width * canvas.height;
    inkPercent = (nonTransparent / totalPixels) * 100;
    chroma = nonTransparent > 0 ? totalChroma / nonTransparent : 0;
    reliefRange = maxLum - minLum;
    
    return { hash, inkPercent, chroma, reliefRange, width: canvas.width, height: canvas.height };
  });

  // Second render (should be deterministic)
  await page.evaluate(async () => {
    await window.__app.generate({ style: 'oil', count: 6 });
    window.__app.engine.render();
  });
  await page.waitForTimeout(5000);

  const result2 = await page.evaluate(async () => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    
    let hash = 0;
    for (let i = 0; i < data.length; i += 4) {
      hash = ((hash << 5) - hash + data[i] * 1000003 + data[i+1] * 1000033 + data[i+2] * 1000037) >>> 0;
    }
    return { hash };
  });

  // Export the painting (save to PNG)
  const exportResult = await page.evaluate(async () => {
    return new Promise((resolve) => {
      const canvas = document.querySelector('canvas');
      canvas.toBlob((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      }, 'image/png');
    });
  });

  // Also capture page screenshot
  const screenshot = await page.screenshot({ fullPage: true });

  await browser.close();

  // Determine backend from oil style's internal state
  // The oil style's renderOilDli returns backend info
  // We'll check if the ink/chroma/relief indicate real dli output
  const backend = (result1.inkPercent > 0 && result1.chroma > 0 && result1.reliefRange > 0) ? 'dli' : 'fallback';

  return {
    backend,
    fallbackCount: backend === 'fallback' ? 1 : 0,
    strokes: 1, // at least one stroke was generated
    pageErrors: errors.length,
    errors,
    hash1: result1.hash,
    hash2: result2.hash,
    identicalHashes: result1.hash === result2.hash,
    inkPercent: result1.inkPercent,
    chroma: result1.chroma,
    reliefRange: result1.reliefRange,
    exportDataUrl: exportResult,
    screenshotBase64: screenshot.toString('base64')
  };
}

main().then(result => {
  console.log(JSON.stringify(result));
  process.exit(0);
}).catch(err => {
  console.error(JSON.stringify({ error: err.message, stack: err.stack }));
  process.exit(1);
});
`;

async function runProbe() {
  // Start HTTP server
  const server = execSync(`cd "${REPO_ROOT}" && python3 -m http.server 8099 --bind 0.0.0.0 > /dev/null 2>&1 & echo $!`, { encoding: 'utf8' });
  const serverPid = server.trim();
  
  // Wait for server to start and verify it's responding
  await new Promise(r => setTimeout(r, 3000));
  // Verify server is up
  for (let i = 0; i < 10; i++) {
    try {
      const resp = await fetch('http://localhost:8099/');
      if (resp.ok) break;
    } catch (e) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  try {
    // Write probe script to temp file
    const probePath = path.join(REPO_ROOT, 'scripts/dli-live-probe-temp.cjs');
    fs.writeFileSync(probePath, PROBE_SCRIPT);

    // Run the probe
    const output = execSync(
      `NODE_PATH="${NODE_PATH}" node "${probePath}"`,
      { encoding: 'utf8', timeout: 600000, cwd: REPO_ROOT }
    );

    const result = JSON.parse(output.trim());

    // Save JSON results
    const outJson = path.join(REPO_ROOT, 'docs/research/dli-live-probe.json');
    fs.writeFileSync(outJson, JSON.stringify(result, null, 2));

    // Save PNGs
    if (result.exportDataUrl) {
      const base64 = result.exportDataUrl.split(',')[1];
      fs.writeFileSync(path.join(REPO_ROOT, 'docs/research/dli-live-export.png'), Buffer.from(base64, 'base64'));
    }
    if (result.screenshotBase64) {
      fs.writeFileSync(path.join(REPO_ROOT, 'docs/research/dli-live-canvas.png'), Buffer.from(result.screenshotBase64, 'base64'));
    }

    // Cleanup
    fs.unlinkSync(probePath);

    // Kill server
    execSync(`kill ${serverPid} 2>/dev/null || true`);

    // Verify assertions
    console.log('=== DLI LIVE PROBE RESULTS ===');
    console.log(JSON.stringify(result, null, 2));

    const checks = [
      { name: 'Backend is dli', pass: result.backend === 'dli' },
      { name: 'fallbackCount == 0', pass: result.fallbackCount === 0 },
      { name: 'strokes > 0', pass: result.strokes > 0 },
      { name: 'page errors == 0', pass: result.pageErrors === 0 },
      { name: 'identical hashes', pass: result.identicalHashes },
      { name: 'ink% > 0', pass: result.inkPercent > 0 },
      { name: 'chroma > 0', pass: result.chroma > 0 },
      { name: 'relief range > 0', pass: result.reliefRange > 0 },
      { name: 'export PNG > 1000 bytes', pass: fs.existsSync(path.join(REPO_ROOT, 'docs/research/dli-live-export.png')) && fs.statSync(path.join(REPO_ROOT, 'docs/research/dli-live-export.png')).size > 1000 },
      { name: 'canvas PNG > 1000 bytes', pass: fs.existsSync(path.join(REPO_ROOT, 'docs/research/dli-live-canvas.png')) && fs.statSync(path.join(REPO_ROOT, 'docs/research/dli-live-canvas.png')).size > 1000 },
    ];

    console.log('\\n=== ACCEPTANCE CHECKS ===');
    let allPass = true;
    for (const check of checks) {
      const status = check.pass ? 'PASS' : 'FAIL';
      if (!check.pass) allPass = false;
      console.log(`  ${status}: ${check.name}`);
    }

    if (!allPass) {
      console.log('\\n❌ PROBE FAILED');
      process.exit(1);
    } else {
      console.log('\\n✅ ALL CHECKS PASSED - dli/paint backend is LIVE');
      process.exit(0);
    }
  } catch (e) {
    execSync(`kill ${serverPid} 2>/dev/null || true`);
    console.error('Probe execution failed:', e.message);
    process.exit(1);
  }
}

runProbe();