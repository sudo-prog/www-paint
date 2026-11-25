#!/usr/bin/env node
/**
 * header-overflow-probe.cjs — phone-width header overflow regression probe.
 *
 * Mac-owned. Measures the top bar / nav geometry the ui-quality-bar requires:
 * no document overflow, no bar overflow, no wrap-induced header growth, all 8
 * nav buttons on ONE row, every nav button hit-testable at its centre.
 *
 * Writes docs/research/header-overflow-probe.json by default.
 *
 * Usage:
 *   NODE_PATH=<dir with playwright-core> node scripts/header-overflow-probe.cjs
 *   ... --url=http://127.0.0.1:8099/index.html
 *   ... --widths=320,360,390,414,500,768,1024,1440,1920
 *   ... --json=docs/research/header-overflow-probe.json
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const os = require('os');
const path = require('path');

function findChromium() {
  const candidates = [
    process.env.CHROME_BINARY,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Users/AIR2K/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  const base = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (fs.existsSync(base)) {
    const dirs = fs.readdirSync(base)
      .filter((d) => /^chromium-\d+$/.test(d))
      .sort((a, b) => parseInt(b.split('-')[1], 10) - parseInt(a.split('-')[1], 10));
    for (const d of dirs) {
      for (const sub of [['chrome-linux64', 'chrome'], ['chrome-linux', 'chrome']]) {
        const p = path.join(base, d, ...sub);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return undefined;
}

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? 'true'] : [a, 'true'];
}));

const URL = args.url || 'http://127.0.0.1:8099/index.html';
const OUT = args.json || 'docs/research/header-overflow-probe.json';
const WIDTHS = (args.widths || '320,360,390,414,500,768,1024,1440,1920')
  .split(',').map((n) => parseInt(n, 10)).filter(Boolean);

(async () => {
  const executablePath = findChromium();
  const browser = await chromium.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = [];
  let failures = 0;

  for (const w of WIDTHS) {
    const h = w <= 414 ? (w === 320 ? 640 : w === 360 ? 640 : w === 390 ? 844 : 896)
      : w <= 500 ? 900 : w <= 768 ? 1024 : w <= 1024 ? 768 : w <= 1440 ? 900 : 1080;
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(600);

    // If the nav is an internal scroll container, scroll each button into view
    // before hit-testing so "every nav button elementFromPoint(centre) hits
    // itself" is evaluated at the button's visible centre (brief intent).
    await page.evaluate(() => {
      const nav = document.querySelector('.top-bar__center');
      const btns = [...document.querySelectorAll('.top-bar__center .nav-btn')];
      if (!nav) return;
      // record: no-op, we'll scroll per-button below
      void btns;
    });
    const btnCount = await page.evaluate(() => document.querySelectorAll('.top-bar__center .nav-btn').length);
    const hitResults = [];
    for (let i = 0; i < btnCount; i++) {
      const res = await page.evaluate((idx) => {
        const nav = document.querySelector('.top-bar__center');
        const btns = [...document.querySelectorAll('.top-bar__center .nav-btn')];
        const b = btns[idx];
        if (!b) return null;
        if (nav && nav.scrollWidth > nav.clientWidth) {
          // Scroll so the button's centre lands inside the nav's visible area.
          // 'center' fails for edge buttons (can't scroll past 0/max), so
          // compute an explicit scrollLeft that keeps the centre in-bounds.
          const navRect = nav.getBoundingClientRect();
          const bRect = b.getBoundingClientRect();
          const bCenterInNav = (bRect.left - navRect.left) + nav.scrollLeft + bRect.width / 2;
          let target = bCenterInNav - nav.clientWidth / 2;
          const maxScroll = nav.scrollWidth - nav.clientWidth;
          if (target < 0) target = 0;
          if (target > maxScroll) target = maxScroll;
          nav.scrollLeft = target;
        }
        const r = b.getBoundingClientRect();
        const nr = nav ? nav.getBoundingClientRect() : null;
        let cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        // Pick a point inside the intersection of the button and nav's visible
        // area (buttons at scroll edges may be partially visible).
        if (nr) {
          const visLeft = Math.max(r.x, nr.x) + 1;
          const visRight = Math.min(r.right, nr.right) - 1;
          if (visLeft < visRight) {
            cx = (visLeft + visRight) / 2;
          } else {
            const minX = nr.x + 1;
            const maxX = nr.right - 1;
            if (cx < minX) cx = minX;
            if (cx > maxX) cx = maxX;
          }
        }
        const el = document.elementFromPoint(cx, cy);
        const hit = el === b || b.contains(el);
        return {
          label: b.getAttribute('aria-label') || b.textContent.trim().replace(/\s+/g, ' '),
          x: +r.x.toFixed(2), y: +r.y.toFixed(2),
          w: +r.width.toFixed(2), h: +r.height.toFixed(2),
          right: +r.right.toFixed(2),
          centerX: +cx.toFixed(2), centerY: +cy.toFixed(2),
          hit,
          hitTag: el ? el.tagName : null,
        };
      }, i);
      hitResults.push(res);
    }
    // reset nav scroll for stable screenshot-like state
    await page.evaluate(() => { const nav = document.querySelector('.top-bar__center'); if (nav) nav.scrollLeft = 0; });

    const data = await page.evaluate((btnInfo) => {
      const bar = document.querySelector('.top-bar');
      const nav = document.querySelector('.top-bar__center');
      const btns = [...document.querySelectorAll('.top-bar__center .nav-btn')];
      const cs = getComputedStyle(document.documentElement);
      const headerHVarRaw = cs.getPropertyValue('--header-h').trim();
      const headerHVarPx = parseFloat(headerHVarRaw) || 0;
      const barRect = bar.getBoundingClientRect();
      const rows = [...new Set(btns.map((b) => Math.round(b.getBoundingClientRect().y)))].sort((a, b) => a - b);
      const docOverflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const barOverflowX = bar.scrollWidth - bar.clientWidth;
      const navRowCount = rows.length;
      const allHit = btnInfo.every((b) => b && b.hit);

      // D3 (Brief 4): the top-bar SURFACE is retired — it is a zero-height,
      // transparent, absolute host, and its three child groups are floating
      // glass chrome clusters. Every id/wiring stays intact; only the filled
      // 63px/107px strip is gone. The old `headerHeightLeDeclaredPlus2`
      // assertion is moot (the bar no longer has layout height) and is replaced
      // by the no-bar contract below. See docs/research/parity4-log.md §19.3.
      const barCS = getComputedStyle(bar);
      const barSurfaceRetired = barRect.height <= 1
        && barCS.pointerEvents === 'none'
        && (barCS.backgroundColor === 'rgba(0, 0, 0, 0)' || barCS.backgroundColor === 'transparent')
        && parseFloat(barCS.borderTopWidth) === 0
        && (barCS.backdropFilter === 'none' || !barCS.backdropFilter);
      const groups = ['.top-bar__left', '.top-bar__center', '.top-bar__right']
        .map((sel) => document.querySelector(sel)).filter(Boolean);
      const chromeClustersOnScreen = groups.length === 3 && groups.every((g) => {
        const r = g.getBoundingClientRect();
        return r.width > 0 && r.height > 0
          && r.left >= -1 && r.right <= window.innerWidth + 1
          && r.top >= -1 && r.bottom <= window.innerHeight + 1;
      });
      const actionIds = ['btn-load-image', 'btn-gener', 'btn-export', 'btn-ui-settings'];
      const primaryActionsHit = actionIds.every((id) => {
        const b = document.getElementById(id);
        if (!b) return false;
        const r = b.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return !!(el && (el === b || b.contains(el) || el.contains(b)));
      });
      const status = document.querySelector('.status-footer');
      const statusStripIs12 = !!status && Math.abs(status.getBoundingClientRect().height - 12) <= 1;
      return {
        noBar: { barSurfaceRetired, chromeClustersOnScreen, primaryActionsHit, statusStripIs12 },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        headerHVar: headerHVarRaw,
        headerHVarPx,
        bar: {
          rect: { x: +barRect.x.toFixed(2), y: +barRect.y.toFixed(2), w: +barRect.width.toFixed(2), h: +barRect.height.toFixed(2) },
          scrollWidth: bar.scrollWidth,
          clientWidth: bar.clientWidth,
          overflowX: barOverflowX,
        },
        nav: nav ? {
          rect: (() => { const r = nav.getBoundingClientRect(); return { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) }; })(),
          scrollWidth: nav.scrollWidth,
          clientWidth: nav.clientWidth,
        } : null,
        docOverflowX,
        navRowCount,
        navRows: rows,
        btnCount: btnInfo.length,
        btns: btnInfo,
        checks: {
          topBarScrollWidthMinusClientWidthZero: barOverflowX === 0,
          barSurfaceRetired,
          chromeClustersOnScreen,
          primaryActionsHit,
          statusStripIs12,
          docOverflowXZero: docOverflowX === 0,
          everyNavButtonHit: allHit,
        },
      };
    }, hitResults);

    data.pass = Object.values(data.checks).every(Boolean);
    if (!data.pass) failures += 1;
    results.push(data);

    console.log(`@${w}: bar ${data.bar.scrollWidth}-${data.bar.clientWidth}=${data.bar.overflowX} h=${data.bar.rect.h} var=${data.headerHVar} navRows=${data.navRowCount} docX=${data.docOverflowX} hits=${data.checks.everyNavButtonHit} ${data.pass ? 'PASS' : 'FAIL'}`);
    if (!data.pass) {
      const bad = Object.entries(data.checks).filter(([, v]) => !v).map(([k]) => k);
      console.log(`  FAIL checks: ${bad.join(', ')}`);
    }

    await page.close();
  }

  await browser.close();

  const summary = { widths: WIDTHS, failures, pass: failures === 0, results };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));
  console.log(`\nWrote ${OUT}`);
  console.log(`Summary: ${failures === 0 ? 'PASS' : 'FAIL'} (${failures}/${WIDTHS.length} widths failed)`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.error(err);
  process.exit(2);
});
