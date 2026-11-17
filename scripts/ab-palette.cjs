// Current full config (quantise+gradient+alpha .8) at budget scales 2/4/8.
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
    function stats(cc) {
      const d = cc.getContext('2d', { willReadFrequently: true }).getImageData(0,0,W,H).data;
      let ink=0, lum=0; const cols=new Set();
      for (let i=0;i<d.length;i+=4){const L=d[i]*.299+d[i+1]*.587+d[i+2]*.114;lum+=L;if(L<245)ink++;if(i%400===0)cols.add(`${d[i]>>3},${d[i+1]>>3},${d[i+2]>>3}`);}
      return {ink:+(100*ink/(W*H)).toFixed(2), lum:+(lum/(W*H)).toFixed(1), cols:cols.size};
    }
    const eng = new PaintingEngine({ canvas: document.createElement('canvas'), width: W, height: H, useWorker: false, background: '#fff' });
    await eng.loadImage(src);
    const out = [];
    for (const bs of [8, 8, 8]) {
      const plan = buildModularPlan(eng._analysis, {
        enabled: true, style: 'pencil', count: 700, seed: 12345, width: W, height: H,
        strokeBudgetScale: bs,
        paletteSize: [12, 24, 32][['8','8','8'].indexOf('8') === -1 ? 0 : out.length] || 24,
      });
      const cc = document.createElement('canvas'); cc.width=W; cc.height=H;
      const cx = cc.getContext('2d'); cx.fillStyle='#fff'; cx.fillRect(0,0,W,H);
      eng.renderer.setLayers([{ id:0,name:'l',visible:true,opacity:1,blendMode:'normal',strokes:plan.shapes,locked:false }]);
      eng.renderer.clear(); eng.renderer.renderAll({ progress: 1, clear: false });
      cx.drawImage(eng.renderer.ctx.canvas, 0, 0);
      out.push({ tag: `pal${[12,24,32][out.length]}`, shapes: plan.shapes.length, ...stats(cc), data: cc.toDataURL('image/png') });
    }
    return out;
  });
  for (const r of res) {
    const { data, ...rest } = r;
    require('fs').writeFileSync(`/tmp/app-path/budget-${r.tag}.png`, Buffer.from(data.split(',')[1], 'base64'));
    console.log(JSON.stringify(rest));
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
