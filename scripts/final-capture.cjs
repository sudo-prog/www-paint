// Final head-to-head capture: WWW_PAINT (modular engine, real app config)
// vs live Code Paint (paint.jas.black), same frog source.
const { chromium } = require('playwright-core');

const CHROME_PATH = '/home/thinkpad/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const URL = 'http://127.0.0.1:8099/app-path-probe.html';
const OUT = '/tmp/head-to-head';

(async () => {
  // ── 1. WWW_PAINT ─────────────────────────────────────────────────────
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: CHROME_PATH,
  });
  const page = await browser.newPage({ viewport: { width: 1500, height: 700 } });
  page.on('pageerror', e => console.log('PAGEERROR', String(e).substring(0, 160)));

  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => {
    const s = document.getElementById('status');
    return s && (s.textContent.startsWith('DONE') || s.textContent.startsWith('FATAL'));
  }, { timeout: 180000 }).catch(() => console.log('TIMEOUT'));

  const caps = await page.evaluate(async () => {
    const { PaintingEngine } = await import('./js/engine/engine.js');
    const { buildModularPlan } = await import('./js/engine/modular-bridge.js');
    const W = 512, H = 384;
    const img = new Image();
    img.src = './test-images/frog-source.jpg';
    await img.decode();
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = W; srcCanvas.height = H;
    srcCanvas.getContext('2d').drawImage(img, 0, 0, W, H);

    function render(style, count) {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const e = new PaintingEngine({ canvas: c, width: W, height: H, useWorker: true, background: '#fff' });
      return e.loadImage(srcCanvas).then(async () => {
        const plan = buildModularPlan(e._analysis, {
          enabled: true, style, count, seed: 12345, width: W, height: H,
        });
        const layer = { id: 0, name: 'l', visible: true, opacity: 1, blendMode: 'normal', strokes: plan.shapes, locked: false };
        e.renderer.setLayers([layer]);
        e.renderer.clear();
        e.renderer.renderAll({ progress: 1, clear: false });
        return c.toDataURL('image/png');
      });
    }
    return {
      pencil2800: await render('pencil', 2800),
      watercolor2800: await render('watercolor', 2800),
      legacy700: await (async () => {
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const e = new PaintingEngine({ canvas: c, width: W, height: H, useWorker: true, background: '#fff' });
        await e.loadImage(srcCanvas);
        await e.generate({ style: 'pencil', count: 700, seed: 12345 });
        e.renderer.setLayers(e.layers);
        e.renderer.clear();
        e.renderer.renderAll({ progress: 1, clear: false });
        return c.toDataURL('image/png');
      })(),
    };
  });
  await browser.close();

  const fs = require('fs');
  fs.mkdirSync(OUT, { recursive: true });
  for (const [k, v] of Object.entries(caps)) {
    fs.writeFileSync(`${OUT}/wwwp-${k}.png`, Buffer.from(v.split(',')[1], 'base64'));
    console.log('saved', `${OUT}/wwwp-${k}.png`);
  }

  // ── 2. Live Code Paint ───────────────────────────────────────────────
  const b2 = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: CHROME_PATH,
  });
  const p2 = await b2.newPage({ viewport: { width: 1440, height: 900 } });
  console.log('loading paint.jas.black ...');
  await p2.goto('https://paint.jas.black/', { waitUntil: 'load', timeout: 90000 });
  await p2.waitForTimeout(12000);
  const fileInput = await p2.$('#file');
  if (!fileInput) { console.log('NO #file input found'); await b2.close(); process.exit(1); }
  await fileInput.setInputFiles('/home/thinkpad/Data/20_Projects/20.36_WWW_PAINT/test-images/frog-source.jpg');
  console.log('frog uploaded, waiting for paint ...');
  // Try the explicit paint button if present, then wait.
  const go = await p2.$('#phtextgo');
  if (go) { await go.click().catch(() => {}); }
  await p2.waitForTimeout(90000);
  // Grab the stage canvas itself if possible (cleaner than the full page).
  const stage = await p2.$('#stage');
  if (stage) {
    await stage.screenshot({ path: `${OUT}/codepaint-stage.png` });
    console.log('saved', `${OUT}/codepaint-stage.png`);
  }
  await p2.screenshot({ path: `${OUT}/codepaint-page.png`, fullPage: false });
  console.log('saved', `${OUT}/codepaint-page.png`);
  await b2.close();
})().catch(e => { console.error(e); process.exit(1); });
