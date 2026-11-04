const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SHOTS = path.join(os.homedir(), '.hermes', 'profiles', 'chief-of-staff', 'cache', 'scratch');
const CHROMIUM_PATH = path.join(os.homedir(), '.cache', 'ms-playwright', 'chromium-1243', 'chrome-linux64', 'chrome');

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    executablePath: CHROMIUM_PATH,
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const logs = [];
  page.on('console', m => {
    logs.push(m.text());
    console.log('[PAGE]', m.text());
  });
  page.on('pageerror', e => {
    logs.push('ERROR: ' + String(e));
    console.log('[ERROR]', String(e));
  });

  const res = await page.goto('http://127.0.0.1:8099/scripts/debug-worker.html', { waitUntil: 'domcontentloaded' });
  console.log('Page status:', res.status());

  await page.waitForTimeout(35000);

  await page.screenshot({ path: path.join(SHOTS, 'debug-worker.png'), fullPage: true, animations: 'disabled' });
  console.log('Screenshot saved');

  fs.writeFileSync(path.join(SHOTS, 'debug-worker-logs.txt'), logs.join('\n'));
  console.log('Logs saved');
  console.log('Total logs:', logs.length);

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
