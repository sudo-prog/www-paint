// Why did the blob render appear? Compare the RENDERED canvas from
// app-path-probe (modular, count 700→1464 strokes) vs a fresh render at
// the same config — isolate whether probe's cMod canvas is stale.
const { chromium } = require('playwright-core');
const CHROME = '/home/thinkpad/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1200, height: 600 } });
  page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0,200)));
  await page.goto('http://127.0.0.1:8099/app-path-probe.html', { waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('status')?.textContent.startsWith('DONE'), null, { timeout: 180000 });
  const res = await page.evaluate(async () => {
    const { PaintingEngine } = await import('./js/engine/engine.js');
    const { buildModularPlan } = await import('./js/engine/modular-bridge.js');
    const W = 512, H = 384;
    const img = new Image(); img.src = './test-images/frog-source.jpg'; await img.decode();
    const src = document.createElement('canvas'); src.width = W; src.height = H;
    src.getContext('2d').drawImage(img, 0, 0, W, H);
    const eng = new PaintingEngine({ canvas: document.createElement('canvas'), width: W, height: H, useWorker: false, background: '#fff' });
    await eng.loadImage(src);
    const plan = buildModularPlan(eng._analysis, {
      enabled: true, style: 'pencil', count: 700, seed: 12345, width: W, height: H,
    });
    const cc = document.createElement('canvas'); cc.width=W; cc.height=H;
    const cx = cc.getContext('2d'); cx.fillStyle='#fff'; cx.fillRect(0,0,W,H);
    eng.renderer.setLayers([{ id:0,name:'l',visible:true,opacity:1,blendMode:'normal',strokes:plan.shapes,locked:false }]);
    eng.renderer.clear(); eng.renderer.renderAll({ progress: 1, clear: false });
    cx.drawImage(eng.renderer.ctx.canvas, 0, 0);
    return { tag: 'fresh-700', data: cc.toDataURL('image/png'), shapes: plan.shapes.length };
  });
  require('fs').writeFileSync(`/tmp/app-path/${res.tag}.png`, Buffer.from(res.data.split(',')[1], 'base64'));
  console.log('saved', res.tag, res.shapes, 'shapes');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
