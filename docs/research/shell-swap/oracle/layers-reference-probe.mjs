import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');

const OUT_DIR = '/Users/AIR2K/Data/20_Projects/20.36_WWW_PAINT/docs/research/shell-swap/oracle';
const URL = 'http://127.0.0.1:8096/';
const NODE_PATH = '/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runViewport(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failed404s = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => pageErrors.push(String(err)));
  page.on('response', resp => { if (resp.status() === 404) failed404s.push(resp.url()); });
  page.on('requestfailed', req => { if (req.failure()) failed404s.push(req.url() + ' :: ' + req.failure()?.errorText); });

  const result = { viewport: { width, height }, steps: {} };

  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('#gl-canvas', { timeout: 15000 });
    await sleep(1200); // let render loop/fps settle

    result.base = await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const id = (s) => document.getElementById(s);
      const cs = (el) => el ? getComputedStyle(el) : null;
      const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return {x:b.x,y:b.y,w:b.width,h:b.height,l:b.left,r:b.right,t:b.top,b:b.bottom}; };

      const app = id('app');
      const card = id('canvas-card');
      const baseEl = q('.base');
      const leftPanel = id('rail-left');
      const rightPanel = id('rail-right');

      const shellRadius = cs(app)?.borderRadius;
      const canvasRadius = cs(card)?.borderRadius;
      const panelBg = cs(leftPanel)?.backgroundColor;
      const baseBg = cs(baseEl)?.backgroundColor || cs(document.body)?.backgroundColor;
      const rightPanelBg = cs(rightPanel)?.backgroundColor;
      const leftDisplay = cs(leftPanel)?.display;
      const rightDisplay = cs(rightPanel)?.display;
      const leftVisible = leftPanel ? (leftPanel.getBoundingClientRect().width > 0 && leftDisplay !== 'none' && getComputedStyle(leftPanel).visibility !== 'hidden') : false;
      const rightVisible = rightPanel ? (rightPanel.getBoundingClientRect().width > 0 && rightDisplay !== 'none' && getComputedStyle(rightPanel).visibility !== 'hidden') : false;

      const leftRect = r(leftPanel);
      const rightRect = r(rightPanel);
      const cardRect = r(card);
      const gapLeft = (leftRect && cardRect) ? Math.round((cardRect.l - leftRect.r) * 100) / 100 : null;
      const gapRight = (rightRect && cardRect) ? Math.round((rightRect.l - cardRect.r) * 100) / 100 : null;
      const gapTop = cardRect ? Math.round((cardRect.t - 0) * 100) / 100 : null; // top inset from shell
      // "12px gap panel edge↔canvas window" in the rail-behind-canvas layout: card inset from panel edge
      const cardLeftInset = leftRect && cardRect ? Math.round((cardRect.l - leftRect.l) * 100) / 100 : null;
      const cardRightInset = rightRect && cardRect ? Math.round((rightRect.r - cardRect.r) * 100) / 100 : null;

      const docOverflowX = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);

      const controls = Array.from(document.querySelectorAll('button, [role="button"], a, input, select, [tabindex]'))
        .filter(el => {
          const b = el.getBoundingClientRect();
          const st = getComputedStyle(el);
          if (b.width < 2 || b.height < 2) return false;
          if (st.display === 'none' || st.visibility === 'hidden') return false;
          return true;
        });
      let hitFails = 0;
      let pastViewport = 0;
      const hitFailSamples = [];
      for (const el of controls) {
        const b = el.getBoundingClientRect();
        if (b.right <= 0 || b.left >= window.innerWidth || b.bottom <= 0 || b.top >= window.innerHeight) continue;
        const cx = b.left + b.width / 2;
        const cy = b.top + b.height / 2;
        if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) {
          pastViewport++;
          continue;
        }
        const top = document.elementFromPoint(cx, cy);
        const hit = !!top && (el === top || el.contains(top) || top.contains(el));
        if (!hit) {
          hitFails++;
          if (hitFailSamples.length < 8) hitFailSamples.push({tag: el.tagName, id: el.id, cls: String(el.className||'').slice(0,40), text: (el.textContent||'').trim().slice(0,30), top: top ? {tag: top.tagName, id: top.id, cls: String(top.className||'').slice(0,40)} : null});
        }
        if (b.right > window.innerWidth + 1 || b.left < -1) pastViewport++;
      }

      let webgl2 = false;
      try {
        const c = id('gl-canvas');
        webgl2 = !!(c && c.getContext && c.getContext('webgl2'));
      } catch(e) { webgl2 = false; }

      return {
        shellRadius, canvasRadius,
        panelBg, baseBg, rightPanelBg,
        leftDisplay, rightDisplay, leftVisible, rightVisible,
        leftRect, rightRect, cardRect,
        gapLeft, gapRight, gapTop, cardLeftInset, cardRightInset,
        docOverflowX,
        controlCount: controls.length,
        hitFails, hitFailSamples, pastViewport,
        webgl2,
      };
    });

    // Ensure we capture both states: if initial state is already collapsed (narrow viewports),
    // take navbar screenshot first, then expand for the expanded screenshot; otherwise do the reverse.
    const initiallyCollapsed = await page.evaluate(() => {
      const l = document.getElementById('rail-left');
      const r = document.getElementById('rail-right');
      return !!(l?.classList.contains('is-collapsed') && r?.classList.contains('is-collapsed'));
    });

    if (initiallyCollapsed) {
      await page.screenshot({ path: path.join(OUT_DIR, `parity-navbar-${width}.png`), fullPage: false });
      await page.evaluate(() => document.querySelector('.nav-btn[data-nav="expanded"]')?.click());
      await sleep(350);
      result.expandedState = await page.evaluate(() => {
        const navCollapsed = document.querySelector('.nav-btn[data-nav="collapsed"]')?.getAttribute('aria-pressed');
        const navExpanded = document.querySelector('.nav-btn[data-nav="expanded"]')?.getAttribute('aria-pressed');
        const railLeft = document.getElementById('rail-left');
        const railRight = document.getElementById('rail-right');
        const card = document.getElementById('canvas-card');
        return {
          navCollapsed, navExpanded,
          leftCollapsed: railLeft?.classList.contains('is-collapsed'),
          rightCollapsed: railRight?.classList.contains('is-collapsed'),
          cardNavLeft: card?.classList.contains('nav-left'),
          cardNavRight: card?.classList.contains('nav-right'),
        };
      });
      await page.screenshot({ path: path.join(OUT_DIR, `parity-expanded-${width}.png`), fullPage: false });
      // toggle back to navbar to also verify toggle works both ways
      await page.evaluate(() => document.querySelector('.nav-btn[data-nav="collapsed"]')?.click());
      await sleep(350);
      result.navbarState = await page.evaluate(() => {
        const navCollapsed = document.querySelector('.nav-btn[data-nav="collapsed"]')?.getAttribute('aria-pressed');
        const navExpanded = document.querySelector('.nav-btn[data-nav="expanded"]')?.getAttribute('aria-pressed');
        const railLeft = document.getElementById('rail-left');
        const railRight = document.getElementById('rail-right');
        const card = document.getElementById('canvas-card');
        return {
          navCollapsed, navExpanded,
          leftCollapsed: railLeft?.classList.contains('is-collapsed'),
          rightCollapsed: railRight?.classList.contains('is-collapsed'),
          cardNavLeft: card?.classList.contains('nav-left'),
          cardNavRight: card?.classList.contains('nav-right'),
        };
      });
      // restore expanded for functional checks (props/stack interactions)
      await page.evaluate(() => document.querySelector('.nav-btn[data-nav="expanded"]')?.click());
      await sleep(350);
    } else {
      await page.screenshot({ path: path.join(OUT_DIR, `parity-expanded-${width}.png`), fullPage: false });
      await page.evaluate(() => document.querySelector('.nav-btn[data-nav="collapsed"]')?.click());
      await sleep(350);
      result.navbarState = await page.evaluate(() => {
        const navCollapsed = document.querySelector('.nav-btn[data-nav="collapsed"]')?.getAttribute('aria-pressed');
        const navExpanded = document.querySelector('.nav-btn[data-nav="expanded"]')?.getAttribute('aria-pressed');
        const railLeft = document.getElementById('rail-left');
        const railRight = document.getElementById('rail-right');
        const card = document.getElementById('canvas-card');
        return {
          navCollapsed, navExpanded,
          leftCollapsed: railLeft?.classList.contains('is-collapsed'),
          rightCollapsed: railRight?.classList.contains('is-collapsed'),
          cardNavLeft: card?.classList.contains('nav-left'),
          cardNavRight: card?.classList.contains('nav-right'),
        };
      });
      await page.screenshot({ path: path.join(OUT_DIR, `parity-navbar-${width}.png`), fullPage: false });
      await page.evaluate(() => document.querySelector('.nav-btn[data-nav="expanded"]')?.click());
      await sleep(350);
      result.expandedState = await page.evaluate(() => {
        const navCollapsed = document.querySelector('.nav-btn[data-nav="collapsed"]')?.getAttribute('aria-pressed');
        const navExpanded = document.querySelector('.nav-btn[data-nav="expanded"]')?.getAttribute('aria-pressed');
        const railLeft = document.getElementById('rail-left');
        const railRight = document.getElementById('rail-right');
        const card = document.getElementById('canvas-card');
        return {
          navCollapsed, navExpanded,
          leftCollapsed: railLeft?.classList.contains('is-collapsed'),
          rightCollapsed: railRight?.classList.contains('is-collapsed'),
          cardNavLeft: card?.classList.contains('nav-left'),
          cardNavRight: card?.classList.contains('nav-right'),
        };
      });
    }

    // Theme toggle flips and back
    result.theme = await page.evaluate(async () => {
      const root = document.documentElement;
      const btn = document.getElementById('toggle-theme');
      const before = root.getAttribute('data-theme');
      btn?.click();
      const mid = root.getAttribute('data-theme');
      btn?.click();
      const after = root.getAttribute('data-theme');
      return { before, mid, after };
    });

    // Add Pattern/Dither + Noise/Grain via picker, select Noise/Grain, check props, fps live
    const clickInsert = async (label) => {
      return await page.evaluate((label) => {
        const btns = Array.from(document.querySelectorAll('.insert-btn'));
        const b = btns.find(b => (b.textContent||'').includes(label));
        if (!b) return false;
        b.click();
        return true;
      }, label);
    };
    const pickItem = async (label) => {
      await sleep(250);
      return await page.evaluate((label) => {
        const items = Array.from(document.querySelectorAll('.picker-item'));
        const it = items.find(i => (i.querySelector('.picker-item-name')?.textContent||'').trim() === label);
        if (!it) return false;
        it.click();
        return true;
      }, label);
    };

    const openedTextures1 = await clickInsert('Textures');
    const addedDither = await pickItem('Pattern/Dither');
    await sleep(250);
    const openedTextures2 = await clickInsert('Textures');
    const addedGrain = await pickItem('Noise/Grain');
    await sleep(300);

    const selectedGrain = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#stack-list .tree-row'));
      const row = rows.find(r => (r.textContent||'').includes('Noise/Grain'));
      if (!row) return false;
      row.click();
      return true;
    });
    await sleep(250);

    result.propsCheck = await page.evaluate(() => {
      const host = document.getElementById('props-panel');
      const text = host ? host.textContent || '' : '';
      return {
        hasScale: text.includes('Scale'),
        hasOctaves: text.includes('Octaves'),
        hasStrength: text.includes('Strength'),
        snippet: text.slice(0, 500),
      };
    });
    result.picker = { openedTextures1, addedDither, openedTextures2, addedGrain, selectedGrain };

    const fps1 = await page.evaluate(() => document.getElementById('footer-fps')?.textContent || '');
    await sleep(1400);
    const fps2 = await page.evaluate(() => document.getElementById('footer-fps')?.textContent || '');
    const fps3 = await page.evaluate(() => document.getElementById('footer-fps')?.textContent || '');
    // "live (not static)": updated from the initial placeholder "— fps" by the render loop
    const fpsLive = [fps1, fps2, fps3].some(v => v && !v.includes('—')) && (fps1 !== fps2 || fps2 !== fps3 || !fps1.includes('—'));
    result.fps = { fps1, fps2, fps3, fpsLive };

  } catch (e) {
    result.error = String(e && e.stack ? e.stack : e);
  }

  result.consoleErrors = consoleErrors;
  result.pageErrors = pageErrors;
  result.failed404s = failed404s;

  try { await context.close(); } catch {}
  return result;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_BINARY,
    '/Users/AIR2K/Library/Caches/ms-playwright/chromium-1243/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    '/Users/AIR2K/Library/Caches/ms-playwright/chromium-1234/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    '/tmp/chrome-for-testing-147/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    '/tmp/chrome-for-testing-146/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }
  return undefined;
}

(async () => {
  const executablePath = findChrome();
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: [
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--disable-gpu-sandbox',
      '--no-sandbox',
    ],
  });

  const results = {};
  results.executablePath = executablePath || '(playwright default)';
  try {
    results['1440x900'] = await runViewport(browser, 1440, 900);
    results['390x844'] = await runViewport(browser, 390, 844);
  } finally {
    await browser.close();
  }

  const outPath = path.join(OUT_DIR, 'parity-probe.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  console.log('WROTE ' + outPath);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
