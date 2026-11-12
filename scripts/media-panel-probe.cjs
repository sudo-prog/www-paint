#!/usr/bin/env node
/**
 * Probe: does the media panel provably change rendered output?
 *
 * Mac-owned (M6b QA). Loads a synthetic source image through the app's own
 * loader, then drives the ENGINE directly (`engine.generate` + `exportPNG`)
 * rather than `app.generate()`, whose live-stroke streaming is slow enough to
 * make a behavioural probe impractical.
 *
 *   A. panel defaults            -> must be DRY (output-neutrality, HANDOFF §2.5)
 *   B. first WET slider to max   -> must CHANGE output
 *   C. repeat B                  -> must be byte-identical (determinism)
 *   D. masks band toggle         -> must change the composite preview
 *
 * Usage: NODE_PATH=<playwright-core dir> node scripts/media-panel-probe.cjs [--size=128]
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf',
};
const SIZE = Number((process.argv.find(a => a.startsWith('--size=')) || '').split('=')[1]) || 128;
const STROKES = Number((process.argv.find(a => a.startsWith('--strokes=')) || '').split('=')[1]) || 100;

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
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch({
    executablePath: path.join(process.env.HOME, '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome'),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const seeded = await page.evaluate(() => window.__app.engine.settings.mediaModel);

  // Load a synthetic source image (same shape the visual harness uses).
  // NOTE: it must contain a large FLAT region, otherwise the `background` band
  // has zero coverage and toggling it is correctly a no-op — a probe that used
  // only a smooth gradient produced a false "toggle does nothing" result.
  await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#0a0a0a'; x.fillRect(0, 0, 128, 128);          // flat background
    const g = x.createLinearGradient(20, 20, 108, 108);
    g.addColorStop(0, '#304050'); g.addColorStop(1, '#d0b070');
    x.fillStyle = g; x.fillRect(24, 24, 80, 80);                  // midtone subject
    x.fillStyle = '#802020'; x.beginPath(); x.arc(64, 64, 20, 0, 7); x.fill();
    await window.__app.loadImageFile(await new Promise(r => c.toBlob(r, 'image/png')));
  });
  await page.waitForTimeout(600);

  // Drive the engine directly: app.generate() streams every stroke to the DOM
  // and is far too slow for a behavioural probe.
  const probe = () => page.evaluate(async ({ size, strokes }) => {
    const app = window.__app;
    await app.engine.generate({
      style: 'ink', count: strokes, seed: 3047602159, multiLayer: false,
    });
    app.engine.render();
    const blob = await app.engine.exportPNG({ width: size, height: size });
    const url = URL.createObjectURL(blob);
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
    URL.revokeObjectURL(url);
    return {
      lum: +(sum / (d.length / 4) / 3).toFixed(2),
      bytes: blob.size,
      kind: app.engine.settings.mediaModel.kind,
    };
  }, { size: SIZE, strokes: STROKES });

  const a = await probe();

  const slider = await page.evaluate(() => {
    const r = document.querySelector('#media-root');
    if (!r) return { error: 'no #media-root' };
    const s = r.querySelector('input[type=range]');
    if (!s) return { error: 'no slider' };
    const label = s.getAttribute('aria-label') || s.name || '(unlabelled)';
    s.value = s.max;
    s.dispatchEvent(new Event('input', { bubbles: true }));
    s.dispatchEvent(new Event('change', { bubbles: true }));
    return { label, value: s.value };
  });
  await page.waitForTimeout(400);
  const b = await probe();
  const c = await probe();

  // Mask preview: toggling a band must change the preview canvas pixels.
  const maskBefore = await page.evaluate(() => {
    const panel = window.__app.media;
    const c = panel && panel._previewCanvas;
    if (!c) return null;
    const d = document.createElement('canvas');
    d.width = c.width; d.height = c.height;
    const x = d.getContext('2d'); x.drawImage(c, 0, 0);
    const im = x.getImageData(0, 0, d.width, d.height).data;
    let h = 0;
    for (let i = 0; i < im.length; i += 4) h = (h * 31 + im[i] + im[i + 1] * 3 + im[i + 2] * 7 + im[i + 3] * 13) >>> 0;
    return { hash: h, bands: panel.getSettings().masks.bands };
  });

  const maskClick = await page.evaluate(() => {
    const r = document.querySelector('#media-root');
    const band = r && r.querySelector('[data-band]');
    if (!band) return { error: 'no band control' };
    const key = band.getAttribute('data-band');
    band.click();
    return { key };
  });
  await page.waitForTimeout(600);

  const maskAfter = await page.evaluate(() => {
    const panel = window.__app.media;
    const c = panel && panel._previewCanvas;
    if (!c) return null;
    const d = document.createElement('canvas');
    d.width = c.width; d.height = c.height;
    const x = d.getContext('2d'); x.drawImage(c, 0, 0);
    const im = x.getImageData(0, 0, d.width, d.height).data;
    let h = 0;
    for (let i = 0; i < im.length; i += 4) h = (h * 31 + im[i] + im[i + 1] * 3 + im[i + 2] * 7 + im[i + 3] * 13) >>> 0;
    return { hash: h, bands: panel.getSettings().masks.bands };
  });

  console.log('SEEDED mediaModel :', JSON.stringify(seeded));
  console.log(`A defaults (${STROKES} strokes):`, JSON.stringify(a));
  console.log('slider moved      :', JSON.stringify(slider));
  console.log('B after wet ctrl  :', JSON.stringify(b));
  console.log('C repeat          :', JSON.stringify(c));
  console.log('mask band toggle  :', JSON.stringify(maskClick));
  console.log('  preview before  :', JSON.stringify(maskBefore && { hash: maskBefore.hash }));
  console.log('  preview after   :', JSON.stringify(maskAfter && { hash: maskAfter.hash }));
  console.log('---');
  console.log('PASS default is dry      :', a.kind === 'dry');
  console.log('PASS wet control changes :', a.bytes !== b.bytes || a.lum !== b.lum);
  console.log('PASS deterministic       :', b.bytes === c.bytes && b.lum === c.lum);
  console.log('PASS mask band changes   :',
    !!(maskBefore && maskAfter && maskBefore.hash !== maskAfter.hash));
  console.log('page errors:', errors.length, errors.slice(0, 3));

  await browser.close();
  server.close();
}

main().catch(err => { console.error('probe failed:', err); process.exit(1); });
