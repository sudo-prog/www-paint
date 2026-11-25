#!/usr/bin/env node
/**
 * BRIEF 5 visual proof probe (Mac-owned).
 *
 * Real Chromium measurement of C1–C5 at dark/light/mobile/collapsed widths:
 * - desktop: no top-bar cluster anywhere over the canvas top band
 * - canvas header visible at the top of its window, not occluded
 * - rail chrome inside the two rails only, mode switcher 2x4, disclosure state
 * - mobile: the original floating two-row chrome is restored intact
 * - resize desktop -> mobile -> desktop reverses cleanly
 *
 * Usage:
 *   NODE_PATH=<...> node scripts/brief5-probe.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');

const URL = process.env.BRIEF5_URL || 'http://127.0.0.1:8099/index.html';
const OUT = path.resolve(__dirname, '../docs/research');
const CHROME = '/Users/AIR2K/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-x64/chrome-headless-shell';

const results = [];
function check(name, ok, detail = {}) {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${Object.keys(detail).length ? ' ' + JSON.stringify(detail) : ''}`);
}

const r = (n) => Math.round(n * 100) / 100;
const rectOf = (b) => b && ({ x: r(b.x), y: r(b.y), w: r(b.width), h: r(b.height), right: r(b.x + b.width), bottom: r(b.y + b.height) });

async function measure(page) {
  return page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom, top: b.top, left: b.left };
    };
    const all = (sel) => [...document.querySelectorAll(sel)];
    const hit = (x, y) => {
      const el = document.elementFromPoint(x, y);
      return el ? `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}` : null;
    };
    const topClusters = all('.top-bar__left, .top-bar__center, .top-bar__right');
    const canvas = document.querySelector('.canvas-wrapper') || document.querySelector('.canvas-window') || document.querySelector('#canvas-area');
    const canvasHead = document.querySelector('.canvas-head');
    const chromeL = document.getElementById('b5-rail-chrome-left');
    const chromeR = document.getElementById('b5-rail-chrome-right');
    const nav = document.querySelector('.b5-mode-switcher');
    const actions = document.querySelector('.b5-action-row');
    const strips = all('.rail-chrome__strip');
    const disclosure = (window.__brief5Disclosure?.sections || []).map((s) => s);
    const stripChips = all('.rail-chrome--right .strip-chip, #layers-root .strip-chip').map((e) => e.textContent.trim());

    // Probe the top band of the canvas window, densely across its width.
    const cb = box(canvas);
    const bandHits = [];
    if (cb) {
      for (let x = Math.ceil(cb.left + 4); x < cb.right - 4; x += 16) {
        for (let y = Math.ceil(cb.top + 2); y <= Math.min(cb.top + 64, cb.bottom - 2); y += 8) {
          const el = document.elementFromPoint(x, y);
          if (!el) continue;
          if (topClusters.some((c) => c === el || c.contains(el))) bandHits.push({ x, y, hit: hit(x, y) });
        }
      }
    }

    return {
      viewport: { w: innerWidth, h: innerHeight },
      theme: document.documentElement.dataset.theme || null,
      chromeAttached: !!window.__brief5Chrome?.attached,
      topbarDisplay: topbarDisplay(),
      topClusters: topClusters.map((c) => ({ cls: c.className, parent: c.parentElement?.className || '', box: box(c) })),
      canvas: box(canvas),
      canvasHead: { box: box(canvasHead), text: canvasHead?.textContent.trim() || '', hit: canvasHead ? (() => { const b = box(canvasHead); return hit(b.left + 8, b.top + b.height / 2); })() : null },
      bandHits: bandHits.slice(0, 12),
      bandHitCount: bandHits.length,
      chrome: { left: box(chromeL), right: box(chromeR) },
      nav: { box: box(nav), buttons: nav ? nav.querySelectorAll('.nav-btn').length : 0, gridCols: nav ? getComputedStyle(nav).gridTemplateColumns : null, visibleLabels: nav ? [...nav.querySelectorAll('.btn-label')].filter((e) => getComputedStyle(e).display !== 'none').length : 0 },
      actions: { box: box(actions), buttons: actions ? actions.querySelectorAll('button').length : 0 },
      strips: strips.map((s) => ({ box: box(s), text: s.textContent.trim().replace(/\s+/g, ' ') })),
      stripChips,
      disclosure,
      panelPadLeft: (() => { const p = document.getElementById('controls-root'); return p ? getComputedStyle(p).paddingTop : null; })(),
      panelPadRight: (() => { const p = document.getElementById('layers-root'); return p ? getComputedStyle(p).paddingTop : null; })(),
      vars: { left: getComputedStyle(document.documentElement).getPropertyValue('--rail-chrome-h-left').trim(), right: getComputedStyle(document.documentElement).getPropertyValue('--rail-chrome-h-right').trim() },
      docOverflowX: document.documentElement.scrollWidth - innerWidth,
      pageErrors: [],
    };
    function topbarDisplay() {
      const t = document.querySelector('.top-bar');
      return t ? getComputedStyle(t).display : null;
    }
  });
}

async function newPage(browser, width, height, theme = 'dark') {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__brief5Chrome && !!window.__brief5Disclosure, null, { timeout: 15000 }).catch(() => {});
  if (theme === 'light') {
    // Drive the REAL settings UI: it writes both the data-theme attribute and
    // the inline colour tokens that override the stylesheet in this app.
    await page.click('#btn-ui-settings');
    await page.waitForSelector('#settings-overlay.settings-overlay--open', { timeout: 10000 });
    await page.click('#settings-overlay [data-mode="light"]');
    await page.click('#settings-save'); // Save & exit applies the mode + inline colour tokens.
    await page.waitForFunction(() => !document.getElementById('settings-overlay')?.classList.contains('settings-overlay--open'), null, { timeout: 10000 });
  } else {
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  }
  await page.waitForTimeout(700);
  return { ctx, page, errors };
}

let browser;
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const all = {};

  // ── desktop dark ─────────────────────────────────────────────────────────
  {
    const { ctx, page, errors } = await newPage(browser, 1440, 900, 'dark');
    const m = await measure(page);
    m.pageErrors = errors;
    all.desktopDark = m;
    await page.screenshot({ path: path.join(OUT, 'brief5-wp-1440-dark.png'), fullPage: false });
    check('1440 dark chrome attached', m.chromeAttached && m.topbarDisplay === 'none', { topbarDisplay: m.topbarDisplay });
    check('1440 dark canvas exists', !!m.canvas, { canvas: rectOf(m.canvas) });
    check('1440 dark canvas top band clear', m.bandHitCount === 0, { bandHitCount: m.bandHitCount, sample: m.bandHits });
    check('1440 dark canvas head at window top', m.canvasHead.box && m.canvas && m.canvasHead.box.y - m.canvas.y <= 6 && m.canvasHead.hit !== null, { canvasHead: rectOf(m.canvasHead.box), canvas: rectOf(m.canvas), hit: m.canvasHead.hit });
    check('1440 dark chrome inside rails', m.chrome.left.right <= m.canvas.left + 1 && m.chrome.right.left >= m.canvas.right - 1, { left: rectOf(m.chrome.left), right: rectOf(m.chrome.right), canvas: rectOf(m.canvas) });
    check('1440 dark mode switcher 2x4', m.nav.buttons === 8 && (m.nav.gridCols || '').split(/\s+/).filter(Boolean).length === 2 && m.nav.visibleLabels === 8, { buttons: m.nav.buttons, cols: m.nav.gridCols, labels: m.nav.visibleLabels });
    check('1440 dark action row present', m.actions.buttons >= 4, { buttons: m.actions.buttons });
    check('1440 dark sRGB PNG chips', m.stripChips.includes('sRGB') && m.stripChips.includes('PNG'), { chips: m.stripChips });
    const expected = { STYLE: 'true', BRUSH: 'true', STRUCTURE: 'false', 'PATH ORDER': 'false', 'MOTION & PATH': 'false', COLOR: 'false' };
    const actual = Object.fromEntries(m.disclosure.map((s) => [s.title, s.expanded]));
    check('1440 dark disclosure defaults', Object.entries(expected).every(([k, v]) => actual[k] === v), { actual });
    check('1440 dark no doc overflow', m.docOverflowX === 0, { docOverflowX: m.docOverflowX });
    check('1440 dark no page errors', m.pageErrors.length === 0, { errors: m.pageErrors });
    await ctx.close();
  }

  // ── mobile dark ──────────────────────────────────────────────────────────
  {
    const { ctx, page, errors } = await newPage(browser, 390, 844, 'dark');
    const m = await measure(page);
    m.pageErrors = errors;
    all.mobileDark = m;
    await page.screenshot({ path: path.join(OUT, 'brief5-wp-390-dark.png'), fullPage: false });
    check('390 dark chrome detached', !m.chromeAttached && m.topbarDisplay !== 'none', { attached: m.chromeAttached, topbarDisplay: m.topbarDisplay });
    check('390 dark original clusters restored', m.topClusters.length === 3 && m.topClusters.every((c) => c.parent === 'top-bar'), { parents: m.topClusters.map((c) => c.parent) });
    check('390 dark no doc overflow', m.docOverflowX === 0, { docOverflowX: m.docOverflowX });
    check('390 dark no page errors', m.pageErrors.length === 0, { errors: m.pageErrors });
    await ctx.close();
  }

  // ── desktop light ────────────────────────────────────────────────────────
  {
    const { ctx, page, errors } = await newPage(browser, 1440, 900, 'light');
    const m = await measure(page);
    m.pageErrors = errors;
    all.desktopLight = m;
    await page.screenshot({ path: path.join(OUT, 'brief5-wp-1440-light.png'), fullPage: false });
    const tokens = await page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector('.rail-chrome--left'));
      return {
        theme: document.documentElement.dataset.theme,
        rootVar: getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim(),
        bg: cs.backgroundColor,
        color: getComputedStyle(document.querySelector('.b5-mode-switcher .nav-btn')).color,
      };
    });
    check('1440 light chrome uses theme tokens', tokens.theme === 'light' && tokens.rootVar.toLowerCase() === '#ffffff' && tokens.bg === 'rgb(255, 255, 255)' && tokens.color !== tokens.bg, tokens);
    check('1440 light canvas band clear', m.bandHitCount === 0, { bandHitCount: m.bandHitCount });
    check('1440 light no page errors', m.pageErrors.length === 0, { errors: m.pageErrors });
    await ctx.close();
  }

  // ── desktop collapsed rails ──────────────────────────────────────────────
  {
    const { ctx, page, errors } = await newPage(browser, 1440, 900, 'dark');
    await page.evaluate(() => {
      ['controls-root', 'layers-root'].forEach((id) => document.getElementById(id)?.classList.add('is-collapsed'));
    });
    await page.waitForTimeout(500);
    const m = await measure(page);
    m.pageErrors = errors;
    all.desktopRails = m;
    await page.screenshot({ path: path.join(OUT, 'brief5-wp-1440-rails.png'), fullPage: false });
    check('collapsed rails chrome state', m.chromeAttached && m.nav.visibleLabels === 0 && m.chrome.left.width <= 60 && m.chrome.right.width <= 60, { left: rectOf(m.chrome.left), right: rectOf(m.chrome.right), labels: m.nav.visibleLabels });
    check('collapsed rails no page errors', m.pageErrors.length === 0, { errors: m.pageErrors });
    await ctx.close();
  }

  // ── resize round trip ────────────────────────────────────────────────────
  {
    const { ctx, page, errors } = await newPage(browser, 1440, 900, 'dark');
    const start = await measure(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(600);
    const mobile = await measure(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(600);
    const end = await measure(page);
    check('resize D->M->D attaches/detaches/reattaches', start.chromeAttached && !mobile.chromeAttached && end.chromeAttached, { start: start.chromeAttached, mobile: mobile.chromeAttached, end: end.chromeAttached });
    check('resize restores original topbar order', mobile.topClusters.map((c) => c.cls).join('|') === 'top-bar__left|top-bar__center|top-bar__right', { order: mobile.topClusters.map((c) => c.cls) });
    check('resize round trip no page errors', errors.length === 0, { errors });
    all.resize = { start, mobile, end };
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'brief5-probe.json'), JSON.stringify(all, null, 2));
  const failed = results.filter((x) => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
})().catch(async (e) => {
  console.error(e);
  if (browser) await browser.close().catch(() => {});
  process.exitCode = 1;
});
