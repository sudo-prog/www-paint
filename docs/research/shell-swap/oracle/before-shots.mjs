import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const OUT = '/Users/AIR2K/Data/20_Projects/20.36_WWW_PAINT/docs/research/shell-swap/oracle/pre-edit';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
});
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8099/index.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/wwwpaint-before-${w}.png` });
  console.log(`${w}x${h} pageErrors=${errs.length}`, errs.slice(0, 3));
  await ctx.close();
}
await browser.close();
console.log('BEFORE SHOTS DONE');
