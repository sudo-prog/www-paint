/**
 * Visual smoke test: runs the same test image through both WWW_PAINT Painter
 * and the original code-painter reference, saves side-by-side screenshots.
 */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SHOTS = path.join(os.homedir(), '.hermes', 'profiles', 'chief-of-staff', 'cache', 'scratch');
const URL = 'http://127.0.0.1:8099/visual-smoke-test.html';
const CHROMIUM_PATH = path.join(os.homedir(), '.cache', 'ms-playwright', 'chromium-1243', 'chrome-linux64', 'chrome');

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    executablePath: CHROMIUM_PATH,
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'log') console.log('[PAGE LOG]', m.text());
  });

  console.log('Navigating to test page...');
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1000);

  let status = await page.$eval('#status', el => el.textContent);
  console.log('Initial status:', status);

  // Wait for WWW_PAINT to complete
  console.log('Waiting for WWW_PAINT generation (up to 45s)...');
  await page.waitForFunction(() => {
    const info = document.getElementById('info-wwwp');
    return info && info.textContent !== ' — ';
  }, { timeout: 45000 }).catch(() => {
    console.log('WWW_PAINT did not set info within 45s');
  });

  status = await page.$eval('#status', el => el.textContent);
  const infoWwwp = await page.$eval('#info-wwwp', el => el.textContent);
  console.log('Status after WWW_PAINT:', status);
  console.log('WWW_PAINT info:', infoWwwp);

  const canvasWwwp = await page.$('#canvas-wwwp');
  if (canvasWwwp) {
    await canvasWwwp.screenshot({ path: path.join(SHOTS, 'smoke-test-wwwp.png') });
    console.log('WWW_PAINT screenshot saved');
  }

  // Wait for Code-Painter to complete
  console.log('Waiting for Code-Painter generation (up to 90s)...');
  await page.waitForFunction(() => {
    const btn = document.getElementById('btn-screenshot');
    return btn && btn.style.display !== 'none';
  }, { timeout: 90000 }).catch(() => {
    console.log('Code-Painter did not complete within 90s');
  });

  status = await page.$eval('#status', el => el.textContent);
  const infoCp = await page.$eval('#info-cp', el => el.textContent);
  console.log('Final status:', status);
  console.log('WWW_PAINT shapes:', infoWwwp);
  console.log('Code-Painter shapes:', infoCp);

  if (errors.length > 0) {
    console.log('Errors:', errors.slice(0, 10));
  }

  const canvasCp = await page.$('#canvas-cp');
  if (canvasCp) {
    await canvasCp.screenshot({ path: path.join(SHOTS, 'smoke-test-codepainter.png') });
    console.log('Code-Painter screenshot saved');
  }

  await page.screenshot({
    path: path.join(SHOTS, 'smoke-test-full.png'),
    fullPage: true,
    animations: 'disabled',
  });
  console.log('Full page screenshot saved');

  await browser.close();
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
