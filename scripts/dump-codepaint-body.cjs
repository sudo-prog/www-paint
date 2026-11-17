// Dump paint.jas.black's full body innerText after painting the frog, to
// recover the on-page stroke console (S(...) lines) from wherever it lives.
const { chromium } = require('playwright-core');
const fs = require('fs');

const CHROME = '/home/thinkpad/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const FROG = '/home/thinkpad/Data/20_Projects/20.36_WWW_PAINT/test-images/frog-source.jpg';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('https://paint.jas.black/', { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(10000);
  await (await page.$('#file')).setInputFiles(FROG);
  const go = await page.$('#phtextgo'); if (go) await go.click().catch(() => {});
  await page.waitForTimeout(120000);
  const txt = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync('/tmp/cp-body.txt', txt);
  console.log('body chars:', txt.length, 'S-lines:', (txt.match(/S\(/g) || []).length);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
