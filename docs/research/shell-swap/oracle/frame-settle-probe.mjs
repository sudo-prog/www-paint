import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8096/', { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
const r = await page.evaluate(() => {
  const f = document.getElementById('frame'), b = document.querySelector('.canvas-body');
  const cs = getComputedStyle(f);
  const fr = f.getBoundingClientRect(), br = b.getBoundingClientRect();
  return {
    rect: {x:fr.x,y:fr.y,w:fr.width,h:fr.height},
    offset: {l:f.offsetLeft,t:f.offsetTop,w:f.offsetWidth,h:f.offsetHeight},
    transform: cs.transform, zoomAttr: f.getAttribute('style'),
    bodyRect: {x:br.x,y:br.y,w:br.width,h:br.height},
    bodyDisplay: getComputedStyle(b).display, placeItems: getComputedStyle(b).placeItems,
    frameMargin: cs.margin, framePosition: cs.position,
    centeredRect: {l: fr.x-br.x, r: (br.x+br.width)-(fr.x+fr.width), t: fr.y-br.y, b: (br.y+br.height)-(fr.y+fr.height)},
    areaPct: +(100*fr.width*fr.height/(br.width*br.height)).toFixed(1),
    canvasStyle: document.getElementById('gl-canvas').getAttribute('style'),
  };
});
console.log(JSON.stringify(r,null,1));
await page.screenshot({ path: 'layers-settled-1440.png' });
await browser.close();
