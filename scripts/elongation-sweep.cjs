// Sweep the dab→stroke elongation factor and measure ink/colour fidelity.
// Runs in the browser (real Canvas + real analysis) so the numbers are the
// ones a user would see.
const { chromium } = require('playwright-core');

const CHROME_PATH = '/home/thinkpad/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const URL = 'http://127.0.0.1:8099/app-path-probe.html';

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

  // Sweep elongation × align, measuring ink / colour / lum against the source.
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

    // One engine → one analysis, reused for every configuration.
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const engine = new PaintingEngine({ canvas: c, width: W, height: H, useWorker: false, background: '#fff' });
    await engine.loadImage(srcCanvas);

    const src = stats(srcCanvas);
    const out = [];

    // Fidelity score: |inkErr| and |lumErr|, normalised. Lower is better.
    const score = (r) => Math.abs(r.inkErr) * 0.6 + Math.abs(r.lumErr) * 0.4;

    for (const elong of [1.0, 1.5, 2.0, 2.5]) {
      for (const ws of [0.35, 0.45, 0.55, 0.7, 1.0]) {
        for (const count of [700, 1400]) {
          const plan = buildModularPlan(engine._analysis, {
            enabled: true, style: 'pencil', count, seed: 12345,
            width: W, height: H,
            strokeElongation: elong,
            strokeStructureAlign: 0.0,
            strokeWidthScale: ws,
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
          const r = { elong, ws, count, shapes: plan.shapes.length, ...st,
            inkErr: +(st.inkPct - src.inkPct).toFixed(2),
            lumErr: +(st.meanLum - src.meanLum).toFixed(2) };
          r.score = +score(r).toFixed(2);
          out.push(r);
        }
      }
    }
    out.sort((a, b) => a.score - b.score);
    return { src, out };
  });

  console.log('SOURCE:', JSON.stringify(results.src));
  console.log('\nBEST 12 by fidelity score (|inkErr|*.6 + |lumErr|*.4):');
  console.log('elong  ws    count shapes  inkPct  inkErr  lum    lumErr  colours  score');
  for (const r of results.out.slice(0, 12)) {
    console.log(
      `${String(r.elong).padEnd(6)} ${String(r.ws).padEnd(5)} ${String(r.count).padEnd(5)} ${String(r.shapes).padEnd(6)} ` +
      `${String(r.inkPct).padEnd(7)} ${String(r.inkErr).padEnd(7)} ${String(r.meanLum).padEnd(6)} ` +
      `${String(r.lumErr).padEnd(7)} ${String(r.colours).padEnd(8)} ${r.score}`
    );
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
