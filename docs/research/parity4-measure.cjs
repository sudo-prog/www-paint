/**
 * parity4-measure.cjs — P0 baseline measurement for Brief 4 (canvas-as-window parity).
 * Measures the SAME computed properties on WWW_PAINT (:8099) and the LAYERS
 * reference (:8096), at 1440x900 + 390x844, dark (and light when --light).
 * Read-only. Writes docs/research/parity4-baseline.json (or --out).
 */
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const req = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');

const CHROME = '/Users/AIR2K/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-x64/chrome-headless-shell';
const APPS = {
  wp: 'http://127.0.0.1:8099/index.html',
  layers: 'http://127.0.0.1:8096/',
};
const VIEWS = [{ width: 1440, height: 900 }, { width: 390, height: 844 }];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const out = process.argv.find(a => a.startsWith('--out='))?.split('=')[1]
  || path.join(__dirname, 'parity4-baseline.json');
const themes = process.argv.includes('--light') ? ['dark', 'light'] : ['dark'];
// If the LAYERS reference server (:8096) is down, reuse the values captured in
// P0 — the reference app is static, so those numbers remain authoritative.
const wpOnly = process.argv.includes('--wp-only');
const baseline = path.join(__dirname, 'parity4-baseline.json');

// Selector maps: LAYERS uses #canvas-card / #rail-left etc; WP uses #canvas-area / #controls-root.
const SEL = {
  wp: {
    app: '.app', base: '.app', panel: '.panel--controls', panelR: '.panel--layers',
    canvas: '.canvas-wrapper', frame: '.canvas-frame', bar: '.top-bar',
    pill: '.motion-controls-root', head: '.canvas-head', strip: '.panel--controls .panel-strip',
  },
  layers: {
    app: '#app', base: '.base', panel: '#rail-left', panelR: '#rail-right',
    canvas: '#canvas-card', frame: '.frame', bar: null,
    pill: '.insert-bar', head: '.canvas-head', strip: '.panel-left .panel-strip',
  },
};

async function measure(page, app, theme) {
  return await page.evaluate(({ sel, theme }) => {
    const q = (s) => s ? document.querySelector(s) : null;
    const cs = (el) => el ? getComputedStyle(el) : null;
    const rect = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1),
               l: +b.left.toFixed(1), r: +b.right.toFixed(1), t: +b.top.toFixed(1), b: +b.bottom.toFixed(1) };
    };
    const shell = q(sel.app), base = q(sel.base), panel = q(sel.panel), panelR = q(sel.panelR);
    const canvas = q(sel.canvas), frame = q(sel.frame), bar = q(sel.bar), pill = q(sel.pill);
    const head = q(sel.head);
    const sc = cs(shell), pc = cs(panel), prc = cs(panelR), cc = cs(canvas), fc = cs(frame);
    const bc = cs(bar), pillc = cs(pill), hc = cs(head), basec = cs(base);

    const cr = rect(canvas), plr = rect(panel), prr = rect(panelR), sr = rect(shell), br = rect(bar);
    const gapL = (cr && plr) ? +(cr.l - plr.r).toFixed(1) : null;
    const gapR = (cr && prr) ? +(prr.l - cr.r).toFixed(1) : null;
    const gapT = (cr && sr) ? +(cr.t - sr.t).toFixed(1) : null;
    const gapB = (cr && sr) ? +(sr.b - cr.b).toFixed(1) : null;

    // elementFromPoint at canvas centre
    let canvasTop = null, canvasHit = false;
    if (cr) {
      const cx = cr.l + cr.w / 2, cy = cr.t + cr.h / 2;
      const top = document.elementFromPoint(cx, cy);
      canvasTop = top ? `${top.tagName.toLowerCase()}${top.id ? '#' + top.id : ''}${top.className ? '.' + String(top.className).split(' ').slice(0,2).join('.') : ''}` : null;
      canvasHit = !!top && (top === canvas || canvas.contains(top));
    }

    // control hit-test (visible controls, centre in viewport)
    const controls = Array.from(document.querySelectorAll('button,[role="button"],a,input,select,[tabindex]'))
      .filter(el => { const b = el.getBoundingClientRect(); const st = getComputedStyle(el);
        // Skip controls inside a closed modal (opacity 0, still laid out): a
        // closed dialog is not a tappable surface, so counting it as a hit-fail
        // is a probe artifact. aria-hidden is set by every overlay here.
        if (el.closest('[aria-hidden="true"]')) return false;
        return b.width >= 2 && b.height >= 2 && st.display !== 'none' && st.visibility !== 'hidden'; });
    let hitFails = 0; const samples = [];
    for (const el of controls) {
      const b = el.getBoundingClientRect();
      if (b.right <= 0 || b.left >= innerWidth || b.bottom <= 0 || b.top >= innerHeight) continue;
      const cx = b.left + b.width/2, cy = b.top + b.height/2;
      const top = document.elementFromPoint(cx, cy);
      const hit = !!top && (el === top || el.contains(top) || top.contains(el));
      if (!hit) { hitFails++; if (samples.length < 6) samples.push({ id: el.id, tag: el.tagName, cls: String(el.className||'').slice(0,30), text: (el.textContent||'').trim().slice(0,22), top: top ? top.tagName + (top.id?'#'+top.id:'') : null }); }
    }

    const docOverflowX = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);

    // Luminance of a computed background (rgb/rgba) ignoring alpha compositing (rough).
    const lum = (c) => { if (!c) return null; const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null;
      const p = m[1].split(',').map(x => parseFloat(x)); return +(0.2126*p[0] + 0.7152*p[1] + 0.0722*p[2]).toFixed(1); };

    return {
      theme,
      shell: { radius: sc?.borderRadius, overflow: sc?.overflow, bg: sc?.backgroundColor, rect: sr },
      base: { bg: basec?.backgroundColor },
      panel: { bg: pc?.backgroundColor, border: pc?.border, borderWidth: pc?.borderWidth,
               backdrop: pc?.backdropFilter || pc?.webkitBackdropFilter, radius: pc?.borderRadius,
               boxShadow: pc?.boxShadow, rect: plr },
      panelR: { bg: prc?.backgroundColor, borderWidth: prc?.borderWidth, backdrop: prc?.backdropFilter, rect: prr },
      canvas: { bg: cc?.backgroundColor, bgImage: cc?.backgroundImage, radius: cc?.borderRadius,
                border: cc?.border, boxShadow: cc?.boxShadow, rect: cr, top: canvasTop, hit: canvasHit,
                lum: lum(cc?.backgroundColor) },
      frame: { bg: fc?.backgroundColor, bgImage: fc?.backgroundImage, radius: fc?.borderRadius, border: fc?.border },
      bar: bar ? { display: bc?.display, h: br?.h, bg: bc?.backgroundColor, borderBottom: bc?.borderBottomWidth, backdrop: bc?.backdropFilter } : { absent: true },
      pill: pill ? { radius: pillc?.borderRadius, backdrop: pillc?.backdropFilter || pillc?.webkitBackdropFilter,
                     bg: pillc?.backgroundColor, border: pillc?.borderWidth, position: pillc?.position } : { absent: true },
      head: head ? { color: hc?.color, fontSize: hc?.fontSize, text: (head.textContent||'').trim().slice(0,60) } : null,
      gaps: { left: gapL, right: gapR, top: gapT, bottom: gapB },
      docOverflowX, controlCount: controls.length, hitFails, hitFailSamples: samples,
      headerVar: getComputedStyle(document.documentElement).getPropertyValue('--header-h').trim(),
    };
  }, { sel: SEL[app], theme });
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const results = { generated: new Date().toISOString(), chrome: CHROME, views: {} };
  try {
    for (const view of VIEWS) {
      const key = `${view.width}x${view.height}`;
      results.views[key] = {};
      for (const app of Object.keys(APPS)) {
        results.views[key][app] = {};
        if (wpOnly && app === 'layers') {
          const saved = JSON.parse(fs.readFileSync(baseline, 'utf8')).views?.[key]?.layers || {};
          for (const theme of themes) {
            results.views[key].layers[theme] = saved[theme] || { reusedFromP0: true, missing: theme };
          }
          continue;
        }
        for (const theme of themes) {
          const context = await browser.newContext({ viewport: view });
          const page = await context.newPage();
          const pageErrors = [];
          page.on('pageerror', e => pageErrors.push(String(e)));
          if (app === 'layers') {
            await page.addInitScript((t) => {
              const set = () => { try { document.documentElement.setAttribute('data-theme',t); document.documentElement.setAttribute('data-mode',t); } catch(e){} };
              set(); document.addEventListener('DOMContentLoaded', set);
            }, theme);
          }
          await page.goto(APPS[app], { waitUntil: 'domcontentloaded', timeout: 30000 });
          if (app === 'layers') {
            await page.evaluate((t) => { document.documentElement.setAttribute('data-theme',t); document.documentElement.setAttribute('data-mode',t); }, theme);
          }
          if (app === 'wp' && theme === 'light') {
            // Use the REAL theme flip: settings.js applies inline colour tokens
            // on <html>, which outrank the stylesheet's [data-theme] block.
            await page.evaluate(() => {
              window.__UISettings?.show();
              document.querySelector('.mode-toggle__btn[data-mode="light"]')?.click();
              // The settings modal applies the theme on "Save & exit".
              document.querySelector('#settings-save')?.click();
            });
          }
          await sleep(1500);
          let m;
          try { m = await measure(page, app, theme); } catch (e) { m = { error: String(e) }; }
          m.pageErrors = pageErrors;
          results.views[key][app][theme] = m;
          await context.close();
        }
      }
    }
  } finally { await browser.close(); }
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log('WROTE ' + out);
  // concise summary
  for (const [vk, apps] of Object.entries(results.views)) {
    for (const [ak, ths] of Object.entries(apps)) {
      for (const [tk, m] of Object.entries(ths)) {
        if (m.error) { console.log(`${vk} ${ak} ${tk}: ERROR ${m.error}`); continue; }
        if (!m.panel) { console.log(`${vk} ${ak} ${tk}: REUSED_FROM_P0 (not captured at this theme)`); continue; }
        console.log(`${vk} ${ak} ${tk}: shellR=${m.shell.radius} panelBg=${m.panel.bg} panelBorder=${m.panel.borderWidth} panelBackdrop=${m.panel.backdrop} canvasBg=${m.canvas.bg} canvasBgImg=${(m.canvas.bgImage||'').slice(0,42)} canvasR=${m.canvas.radius} canvasShadow=${m.canvas.boxShadow} frameBg=${m.frame.bg} barH=${m.bar.h||'absent'} pillR=${m.pill.radius} pillBackdrop=${m.pill.backdrop} gaps=${JSON.stringify(m.gaps)} canvasHit=${m.canvas.hit} docX=${m.docOverflowX} hitFails=${m.hitFails} errs=${m.pageErrors.length}`);
      }
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
