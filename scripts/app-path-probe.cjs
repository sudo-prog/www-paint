const { chromium } = require('playwright-core');
const path = require('path');

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
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  console.log('Loading app-path probe...');
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });

  await page.waitForFunction(() => {
    const s = document.getElementById('status');
    return s && (s.textContent.startsWith('DONE') || s.textContent.startsWith('FATAL'));
  }, { timeout: 180000 }).catch(() => console.log('TIMEOUT waiting for completion'));

  const status = await page.$eval('#status', el => el.textContent);
  console.log('STATUS:', status);

  const infos = await page.evaluate(() => ({
    src: document.getElementById('i-src').textContent,
    mod: document.getElementById('i-mod').textContent,
    leg: document.getElementById('i-leg').textContent,
  }));
  console.log('\n=== SOURCE ===\n' + infos.src);
  console.log('\n=== MODULAR ===\n' + infos.mod);
  console.log('\n=== LEGACY ===\n' + infos.leg);

  const probe = await page.evaluate(() => window.__probe || null);
  if (probe) {
    console.log('\n=== PROBE ===');
    console.log('mod shapes:', probe.mod.shapes, 'ms:', Math.round(probe.mod.ms));
    console.log('leg shapes:', probe.leg.shapes, 'ms:', Math.round(probe.leg.ms));
    console.log('mod sample:', JSON.stringify(probe.modShapesSample[0]));
    console.log('leg sample:', JSON.stringify(probe.legShapesSample[0]));
    console.log('mod geometry:', JSON.stringify(probe.modGeom));
  }

  // Screenshot each canvas individually
  for (const [id, name] of [['c-src', 'source'], ['c-mod', 'modular'], ['c-leg', 'legacy']]) {
    const el = await page.$('#' + id);
    if (el) {
      await el.screenshot({ path: path.join(OUT, `${name}.png`) });
      console.log('saved', name);
    }
  }
  await page.screenshot({ path: path.join(OUT, 'full.png'), fullPage: true });

  console.log('\nERRORS:', errors.slice(0, 8));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
