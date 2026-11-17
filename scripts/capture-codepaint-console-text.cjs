// Hook fillText/strokeText on every canvas to capture Code Paint's console
// output (the S(...) stroke plan it prints while painting).
const { chromium } = require('playwright-core');
const fs = require('fs');
const CHROME = '/home/thinkpad/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const FROG = '/home/thinkpad/Data/20_Projects/20.36_WWW_PAINT/test-images/frog-source.jpg';
const OUT = '/tmp/cp-console-ops.ndjson';
(async () => {
  fs.rmSync(OUT, { force: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    const log = [];
    window.__cpText = log;
    const proto = CanvasRenderingContext2D.prototype;
    for (const op of ['fillText', 'strokeText']) {
      const orig = proto[op];
      Object.defineProperty(proto, op, {
        value: function (text, x, y) {
          if (log.length < 400000) {
            log.push({ t: String(text), x: Math.round(x), y: Math.round(y),
              cw: this.canvas ? this.canvas.width : 0, ch: this.canvas ? this.canvas.height : 0 });
          }
          return orig.apply(this, arguments);
        },
        writable: true, configurable: true,
      });
    }
  });
  const page = await ctx.newPage();
  await page.goto('https://paint.jas.black/', { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(10000);
  await (await page.$('#file')).setInputFiles(FROG);
  const go = await page.$('#phtextgo'); if (go) await go.click().catch(() => {});
  // wait for op stream to quiet
  let last = -1, stable = 0; const t0 = Date.now();
  while (Date.now() - t0 < 200000) {
    await page.waitForTimeout(5000);
    const n = await page.evaluate(() => window.__cpText.length);
    console.log(`t+${Math.round((Date.now()-t0)/1000)}s textOps=${n}`);
    if (n === last && n > 100) { if (++stable >= 3) break; } else { stable = 0; last = n; }
  }
  const total = await page.evaluate(() => window.__cpText.length);
  for (let s = 0; s < total; s += 20000) {
    const slice = await page.evaluate(({ a, c }) => JSON.stringify(window.__cpText.slice(a, a + c)), { a: s, c: 20000 });
    fs.appendFileSync(OUT, JSON.parse(slice).map(o => JSON.stringify(o)).join('\n') + '\n');
  }
  console.log('dumped', total, 'text ops →', OUT);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
