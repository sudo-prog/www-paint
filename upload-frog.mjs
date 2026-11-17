import { chromium } from 'playwright-core';
const CHROME_PATH = '/home/thinkpad/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], executablePath: CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
console.log('Navigating to Code Paint...');
await page.goto('https://paint.jas.black/', { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);
const fileInput = await page.$('#file');
if (fileInput) {
  await fileInput.setInputFiles('/home/thinkpad/Data/20_Projects/20.36_WWW_PAINT/test-images/frog-source.jpg');
  console.log('Frog uploaded');
  await page.waitForTimeout(90000);
  await page.screenshot({ path: '/tmp/codepaint-frog-painted.png', fullPage: true });
  console.log('Screenshot saved');
}
await browser.close();
