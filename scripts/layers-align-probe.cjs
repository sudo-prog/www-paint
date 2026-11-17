// LAYERS-alignment geometry probe — measures real DOM geometry at multiple
// widths and prints clipped / wrapped / overflowing controls.
// Run: node scripts/layers-align-probe.cjs --url=http://127.0.0.1:8099/index.html
import { chromium } from 'playwright-core';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));
const URL_ = args.url || 'http://127.0.0.1:8099/index.html';
const WIDTHS = String(args.widths || '390,768,1024,1440').split(',').map(Number);

const exe = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await chromium.launch({ executablePath: exe, headless: true });

for (const w of WIDTHS) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await page.goto(URL_, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const r = await page.evaluate(() => {
    const out = {
      theme: document.documentElement.getAttribute('data-theme'),
      tokens: ['--bg-primary', '--surface-panel', '--text-primary', '--accent']
        .map(k => [k, getComputedStyle(document.documentElement).getPropertyValue(k).trim()]),
      docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      clipped: [], wrapped: [], underMin: [], pastViewport: [], noName: [],
    };
    const lh = el => parseFloat(getComputedStyle(el).lineHeight) || 18;
    for (const el of document.querySelectorAll('button, input, select, textarea, a[href], .slider-label, .control-section__title, .layer-row, .status-item')) {
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (b.width === 0 && b.height === 0) continue;
      const id = el.id || el.className || el.tagName;
      // clipped label: its own scrollWidth exceeds its box
      if (el.scrollWidth - el.clientWidth > 1 && el.clientWidth > 0) {
        out.clipped.push(`${el.tagName}.${id} sw=${el.scrollWidth} cw=${el.clientWidth} "${(el.textContent||'').trim().slice(0,28)}"`);
      }
      if (b.right > innerWidth + 0.5 || b.left < -0.5) out.pastViewport.push(`${el.tagName}.${id} right=${b.right.toFixed(0)}`);
      if (el.matches('button, input, select, textarea, a[href]') && (b.width < 31.5 || b.height < 31.5)) {
        out.underMin.push(`${el.tagName}.${id} ${b.width.toFixed(0)}x${b.height.toFixed(0)}`);
      }
      // wrapped: label text spans more than one line
      const label = el.matches('.slider-label, .control-section__title, .btn-label') ? el : el.querySelector('.slider-label, .btn-label');
      if (label) {
        const lines = Math.round(label.getBoundingClientRect().height / lh(label));
        if (lines > 1) out.wrapped.push(`${label.tagName}.${label.className} lines=${lines} "${(label.textContent||'').trim().slice(0,28)}"`);
      }
      if (el.matches('button, input, select, textarea, a[href]') && b.width > 0) {
        const name = (el.getAttribute('aria-label') || '').trim()
          || (el.getAttribute('aria-labelledby') || '').trim()
          || (el.labels && el.labels.length ? el.labels[0].textContent.trim() : '')
          || (el instanceof HTMLButtonElement ? el.textContent.trim() : '');
        if (!name) out.noName.push(`${el.tagName}.${id}`);
      }
    }
    return out;
  });

  console.log(`\n===== ${w}px  theme=${r.theme}  docOverflow=${r.docOverflow} =====`);
  console.log('tokens:', r.tokens.map(([k, v]) => `${k}=${v}`).join(' '));
  const show = (label, arr) => console.log(`${label} (${arr.length}):`, arr.length ? '' : 'none');
  show('CLIPPED ', r.clipped); r.clipped.forEach(x => console.log('   ', x));
  show('WRAPPED ', r.wrapped); r.wrapped.forEach(x => console.log('   ', x));
  show('PAST-VP ', r.pastViewport); r.pastViewport.slice(0, 8).forEach(x => console.log('   ', x));
  show('UNDERMIN', r.underMin); r.underMin.slice(0, 8).forEach(x => console.log('   ', x));
  show('NO-NAME ', r.noName); r.noName.slice(0, 8).forEach(x => console.log('   ', x));
  console.log('console errors:', errors.length ? errors.slice(0, 4) : 'none');
  await page.close();
}
await browser.close();
