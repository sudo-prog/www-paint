// Sweep stroke counts on the real frog through the modular engine and save
// the renders, so the best setting can be picked visually.
const { chromium } = require('playwright-core');

const CHROME_PATH = '/home/thinkpad/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const URL = 'http://127.0.0.1:8099/app-path-probe.html';
const OUT = '/tmp/app-path';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: CHROME_PATH,
  });
  const page = await browser.newPage({ viewport: { width: 1500, height: 700 } });
  page.on('pageerror', e => console.log('PAGEERROR', String(e).substring(0, 200)));

  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => {
    const s = document.getElementById('status');
    return s && (s.textContent.startsWith('DONE') || s.textContent.startsWith('FATAL'));
  }, { timeout: 180000 }).catch(() => console.log('TIMEOUT'));

  const results = await page.evaluate(async () => {
    const { PaintingEngine } = await import('./js/engine/engine.js');
    const { buildModularPlan } = await import('./js/engine/modular-bridge.js');

    const W = 512, H = 384;
    const img = new Image();
    img.src = './test-images/frog-source.jpg';
    await img.decode();

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = W; srcCanvas.height = H;
    const sctx = srcCanvas.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(img, 0, 0, W, H);

    function stats(canvas) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let ink = 0, lum = 0; const colours = new Set();
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i+1], b = d[i+2];
        const L = r*0.299 + g*0.587 + b*0.114;
        lum += L;
        if (L < 245) ink++;
        if ((i % 400) === 0) colours.add(`${r>>3},${g>>3},${b>>3}`);
      }
      const n = d.length / 4;
      return { inkPct: +(100*ink/n).toFixed(2), meanLum: +(lum/n).toFixed(2), colours: colours.size };
    }

    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const engine = new PaintingEngine({ canvas: c, width: W, height: H, useWorker: false, background: '#fff' });
    await engine.loadImage(srcCanvas);
    const src = stats(srcCanvas);

    const out = [];
    for (const style of ['pencil', 'oil', 'watercolor']) {
      for (const count of [700, 1400, 2800, 5600]) {
        const plan = buildModularPlan(engine._analysis, {
          enabled: true, style, count, seed: 12345,
          width: W, height: H,
        });
        const cc = document.createElement('canvas');
        cc.width = W; cc.height = H;
        const cctx = cc.getContext('2d', { willReadFrequently: true });
        cctx.fillStyle = '#fff'; cctx.fillRect(0, 0, W, H);
        const layer = { id: 0, name: 'l', visible: true, opacity: 1, blendMode: 'normal', strokes: plan.shapes, locked: false };
        engine.renderer.setLayers([layer]);
        engine.renderer.clear();
        engine.renderer.renderAll({ progress: 1, clear: false });
        cctx.drawImage(engine.renderer.ctx.canvas, 0, 0, W, H);
        const st = stats(cc);
        out.push({ style, count, shapes: plan.shapes.length, ...st,
          inkErr: +(st.inkPct - src.inkPct).toFixed(2),
          lumErr: +(st.meanLum - src.meanLum).toFixed(2),
          dataUrl: cc.toDataURL('image/png') });
      }
    }
    return { src, out };
  });

  console.log('SOURCE:', JSON.stringify(results.src));
  for (const r of results.out) {
    const { dataUrl, ...rest } = r;
    console.log(JSON.stringify(rest));
  }
  // Save each render
  for (const r of results.out) {
    const name = `${OUT}/sweep-${r.style}-${r.count}.png`;
    const b64 = r.dataUrl.split(',')[1];
    require('fs').writeFileSync(name, Buffer.from(b64, 'base64'));
    console.log('saved', name);
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
