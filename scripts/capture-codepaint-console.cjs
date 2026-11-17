/**
 * Capture Code Paint's OWN stroke console (the on-page log the site prints:
 * S(x0,y0,x1,y1,width,?,colourA,colourB,alpha) per stroke).
 * This is the exact stroke plan the site renders — length, width, colour pair,
 * alpha — far cleaner than intercepting canvas calls.
 */
const { chromium } = require('playwright-core');
const fs = require('fs');

const CHROME = '/home/thinkpad/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const OUT = '/tmp/cp-console.txt';
const FROG = '/home/thinkpad/Data/20_Projects/20.36_WWW_PAINT/test-images/frog-source.jpg';

(async () => {
  fs.rmSync(OUT, { force: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: CHROME,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  console.log('loading paint.jas.black ...');
  await page.goto('https://paint.jas.black/', { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(10000);

  const fileInput = await page.$('#file');
  if (!fileInput) { console.log('NO #file input'); await browser.close(); process.exit(1); }
  await fileInput.setInputFiles(FROG);
  const go = await page.$('#phtextgo');
  if (go) { await go.click().catch(() => {}); }
  console.log('frog uploaded, waiting for paint + console ...');

  // Poll the console element's text until it stops growing.
  let last = -1, stable = 0, i = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 200000) {
    await page.waitForTimeout(5000);
    const txt = await page.evaluate(() => {
      // The console panel: find the element holding 'S(' lines.
      const els = [...document.querySelectorAll('div,pre,textarea')];
      let best = null;
      for (const el of els) {
        const t = el.textContent || '';
        if (t.includes('S(') && (best === null || t.length > best.length)) best = el;
      }
      return best ? best.textContent : '';
    }).catch(() => '');
    const n = (txt.match(/\n/g) || []).length;
    console.log(`t+${Math.round((Date.now() - t0) / 1000)}s console lines≈${n}`);
    if (n === last && n > 50) { if (++stable >= 3) break; } else { stable = 0; last = n; }
    i++;
  }

  const txt = await page.evaluate(() => {
    const els = [...document.querySelectorAll('div,pre,textarea')];
    let best = null;
    for (const el of els) {
      const t = el.textContent || '';
      if (t.includes('S(') && (best === null || t.length > best.length)) best = el;
    }
    return best ? best.textContent : '';
  });
  fs.writeFileSync(OUT, txt);
  console.log('saved', OUT, txt.length, 'chars,', (txt.match(/\n/g) || []).length, 'lines');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
