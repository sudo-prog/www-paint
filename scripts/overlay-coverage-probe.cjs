#!/usr/bin/env node
/**
 * overlay-coverage-probe.cjs — M15 QA seat.
 *
 * Mac-owned. Maestro asserts the ACCESSIBILITY TREE; this probe measures real
 * DOM geometry: control boxes, overflow, hit-testing and label clipping for
 * EVERY overlay/surface in the app, at every width. The gap it closes: no
 * Maestro flow and no probe opened the legacy `#export-root` dialog, so a real
 * mobile defect sat behind 11 green gates (AGENTS.md §0.9).
 *
 * For each surface: open it via its own trigger, then measure
 *   - root box + computed display/visibility (a collapsed panel is a vacuous
 *     pass — assert the box is non-zero BEFORE trusting the numbers)
 *   - target/content overflowX
 *   - every control: box, elementFromPoint(centre) === itself, scrollWidth vs
 *     clientWidth (clipped label), right edge vs viewport
 *
 * Usage:
 *   NODE_PATH=<dir with playwright-core> node scripts/overlay-coverage-probe.cjs
 *   ... --url=http://127.0.0.1:8099/index.html --widths=390,400,414,768,1024,1440,1920
 *   ... --json=docs/research/overlay-coverage.json
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Match the other probes: prefer the installed chromium-<n> shim, fall back to
// the macOS .app bundle (findChromium() only probes the Linux shim path).
function findChromium() {
  const base = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  const dirs = fs.readdirSync(base)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => parseInt(b.split('-')[1], 10) - parseInt(a.split('-')[1], 10));
  for (const d of dirs) {
    for (const sub of [['chrome-linux64', 'chrome'], ['chrome-linux', 'chrome']]) {
      const p = path.join(base, d, ...sub);
      if (fs.existsSync(p)) return p;
    }
  }
  // macOS bundle fallback
  for (const d of dirs) {
    const p = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright', d,
      'chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? 'true'] : [a, 'true'];
}));

const URL = args.url || 'http://127.0.0.1:8099/index.html';
const OUT = args.json || 'docs/research/overlay-coverage.json';
const WIDTHS = (args.widths || '390,400,414,768,1024,1440,1920').split(',').map(Number);

const SURFACES = [
  // NOTE: `open` is the app's own toggle, not a raw nav-button click — the
  // media/library toggles are wired through window.__app in index.html.
  // `assertOpen` is the class/attribute that proves the surface is OPEN; a
  // surface measured while it is still closed reports a vacuous pass.
  { id: 'export-root',        label: 'Legacy export dialog (#btn-export)',        open: 'btn-export',        root: 'export-root',        openClass: 'export-dialog--open' },
  { id: 'export-panel-root',  label: 'Export & share panel (#btn-export-panel)', open: 'btn-export-panel',  root: 'export-panel-root',  openClass: 'export-panel--open' },
  { id: 'style-library-root', label: 'Style library (#btn-library-mode)',       open: 'btn-library-mode', root: 'style-library-root', openClass: null /* visibility is the proof */ },
  { id: 'media-root',         label: 'Media panel (#btn-media-mode)',           open: 'btn-media-mode',   root: 'media-root',         openClass: null },
  { id: 'controls-root',      label: 'Brush controls (default left rail)',      open: null,               root: 'controls-root',      openClass: null },
  { id: 'layers-root',        label: 'Layers rail (#toggle-layers)',            open: 'toggle-layers',    root: 'layers-root',        openClass: null },
];

// Runs INSIDE the page. ROOT is substituted with the surface id as a literal.
const MEASURE = (ROOT) => {
  const root = document.getElementById(ROOT);
  if (!root) return { missing: true };
  const cs = getComputedStyle(root);
  const content = root.querySelector('.export-dialog__content, .export-panel__content, .panel__body, .panel__content');
  const target = content || root;
  const tcs = getComputedStyle(target);
  const rows = [...root.querySelectorAll('.form-actions, .export-panel__actions, .layer-row, .control-section, .panel__section')];
  // A control is measured when it is RENDERED and has a real box. Elements
  // below the fold of a scrollable panel are legitimately off-viewport — that
  // is what scrolling is for — so they are not defects and are excluded from
  // the per-control checks. The PANEL's own overflow is measured separately
  // (`targetOverflowX`), so an off-screen panel cannot pass vacuously.
  // `offsetParent` is null for a `position: fixed` element, so it cannot be the
  // visibility test here; the root's own rect is the proof the surface is open.
  const btns = [...root.querySelectorAll('button, input, select, textarea, [role="switch"]')]
    .filter((el) => el.getBoundingClientRect().width > 0);

  // A control is ON-SCREEN when its box intersects the viewport. Only these are
  // hit-tested: `elementFromPoint` returns null for anything below the fold,
  // which would report every off-screen control as "untappable".
  const onScreen = (b) => b.r > 0 && b.b > 0 && b.l < innerWidth && b.t < innerHeight;
  const doc = document.documentElement;
  const view = { w: innerWidth, h: innerHeight };
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const controls = btns.map((el) => {
    const b = rect(el);
    const cx = b.l + b.w / 2, cy = b.t + b.h / 2;
    const visible = onScreen(b);
    let hit = null;
    if (visible) {
      try { hit = document.elementFromPoint(cx, cy); } catch (e) { hit = null; }
    }
    // A point is TAPPABLE when the topmost element is the control itself, or
    // INSIDE the control (an icon/label child), or an ANCESTOR of it (the
    // control is a child of a larger tap target). Anything else is occluded.
    const tappable = !!(hit && (hit === el || el.contains(hit) || hit.contains(el)));
    const scrollClip = el.scrollWidth - el.clientWidth;
    return {
      tag: el.tagName.toLowerCase(),
      action: el.dataset.action || el.dataset.export || null,
      label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 28),
      box: b, visible, tappable,
      hitTag: hit ? hit.tagName.toLowerCase() + (hit.className ? '.' + String(hit.className).split(' ')[0] : '') : null,
      scrollClip, pastRight: b.r > view.w, underMin: b.w < 24 || b.h < 24,
    };
  });
  return {
    rootClass: root.className,
    rootDisplay: cs.display,
    rootVisibility: cs.visibility,
    rootPosition: cs.position,
    rootTransform: cs.transform,
    targetRect: rect(target),
    targetOverflowX: target.scrollWidth - target.clientWidth,
    targetMaxWidth: tcs.maxWidth,
    docOverflowX: doc.scrollWidth - doc.clientWidth,
    rows: rows.map((r) => ({ cls: r.className, ...rect(r), overflowX: r.scrollWidth - r.clientWidth })),
    controlCount: controls.length,
    onScreenCount: controls.filter((c) => c.visible).length,
    belowFoldCount: controls.filter((c) => !c.visible).length,
    controlsPastViewport: controls.filter((c) => c.pastRight),
    controlsHitFail: controls.filter((c) => c.visible && !c.tappable),
    controlsClipped: controls.filter((c) => c.scrollClip > 1),
    controlsUnderMin: controls.filter((c) => c.underMin),
    minControl: controls.length ? controls.reduce((m, c) => Math.min(m, Math.min(c.box.w, c.box.h)), Infinity) : null,
    controls,
  };
};

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: findChromium() });
  const report = { url: URL, widths: {}, generatedAt: new Date().toISOString() };

  for (const w of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message || e)));
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const widthReport = { surfaces: {}, pageErrors: errors };

    // A CLEAN baseline is required before any surface is measured: a previous
    // surface left open (e.g. a modal whose close control is itself clipped)
    // occludes every later surface and its controls report false hit-failures.
    for (const s of SURFACES) {
      await page.evaluate((rootId) => {
        const root = document.getElementById(rootId);
        if (!root) return;
        const cs = getComputedStyle(root);
        const open = cs.display !== 'none' && cs.visibility !== 'hidden'
          && parseFloat(cs.opacity) > 0.01;
        if (!open) return;
        const close = root.querySelector('[data-action="close"], [data-action="cancel"], .panel__close');
        if (close) { close.click(); return; }
        const overlay = root.querySelector('.export-dialog__overlay, .export-panel__overlay, .modal__overlay');
        if (overlay) overlay.click();
      }, s.root);
      await page.waitForTimeout(80);
    }

    for (const s of SURFACES) {
      // Open via the app's own trigger. In-page `.click()` bypasses hit-testing,
      // so a control that is itself clipped (the §0.9 defect) can still be
      // opened — and a clipped panel is therefore measured, not skipped.
      await page.evaluate((id) => document.getElementById(id)?.click(), s.open);
      // The mobile panels slide in over 280ms; a shorter wait measures them
      // mid-transition (transform still -340px) and reports a false off-screen.
      await page.waitForTimeout(600);
      // Toggle state can be reset by a sibling shim (the library host wraps
      // toggleMediaMode and clears BOTH panels when entering media mode). Clear
      // the mode flags and the hidden/mobile-closed classes, then re-open, so
      // the surface under test is actually the one on screen.
      await page.evaluate(({ rootId, openId, openClass }) => {
        const app = window.__app;
        const root = document.getElementById(rootId);
        if (!root) return;
        root.style.display = '';
        root.classList.remove('panel--hidden');
        if (openClass) root.classList.add(openClass);
        if (rootId === 'media-root' && app) {
          app._mediaMode = true; app._libraryMode = false;
          root.classList.remove('panel--mobile-closed');
          const lib = document.getElementById('style-library-root');
          if (lib) { lib.classList.add('panel--mobile-closed'); lib.classList.add('panel--hidden'); }
        }
        if (rootId === 'style-library-root' && app) {
          app._libraryMode = true; app._mediaMode = false;
          root.classList.remove('panel--mobile-closed');
          const media = document.getElementById('media-root');
          if (media) { media.classList.add('panel--mobile-closed'); media.classList.add('panel--hidden'); }
        }
        if (rootId === 'controls-root' && app) {
          app._libraryMode = false; app._mediaMode = false;
          root.classList.remove('panel--mobile-closed');
        }
        if (rootId === 'layers-root') {
          root.classList.remove('is-collapsed', 'panel--mobile-closed');
          // Collapsing the layers panel adds `nav-right` to the canvas, which
          // widens the canvas UNDER the open panel and occludes it. Clear it.
          const cw = document.getElementById('canvas-area');
          if (cw) cw.classList.remove('nav-right', 'nav-left');
        }
      }, { rootId: s.root, openId: s.open, openClass: s.openClass });
      await page.waitForTimeout(600);
      const m = await page.evaluate(MEASURE, s.root);
      // Prove the surface actually OPENED. A toggle that does not land (e.g. the
      // mobile library panel's `panel--mobile-closed` class is not removed by the
      // host) would otherwise be measured closed and report a vacuous pass.
      m.openVerified = await page.evaluate(({ rootId, openClass }) => {
        const root = document.getElementById(rootId);
        if (!root) return false;
        const cs = getComputedStyle(root);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) <= 0.01) return false;
        const r = root.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        if (openClass) return root.classList.contains(openClass);
        return true;
      }, { rootId: s.root, openClass: s.openClass });
      widthReport.surfaces[s.id] = { label: s.label, ...m };
      // Close ONLY this surface. A modal whose close control is itself clipped
      // stays open and occludes every later surface — that is what produces
      // false hit-failures. Verify the close worked; if not, force it.
      await page.evaluate((rootId) => {
        const root = document.getElementById(rootId);
        if (!root) return;
        const close = root.querySelector('[data-action="close"], [data-action="cancel"], .panel__close');
        if (close) { close.click(); return; }
        const overlay = root.querySelector('.export-dialog__overlay, .export-panel__overlay, .modal__overlay');
        if (overlay) overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }, s.root);
      await page.waitForTimeout(150);
      const stillOpen = await page.evaluate((rootId) => {
        const root = document.getElementById(rootId);
        if (!root) return false;
        const cs = getComputedStyle(root);
        return cs.display !== 'none' && parseFloat(cs.opacity) > 0.01
          && !root.classList.contains('panel--hidden');
      }, s.root);
      if (stillOpen) {
        await page.evaluate((rootId) => {
          const root = document.getElementById(rootId);
          // Reset to the surface's own closed class so the NEXT surface is not
          // measured underneath it (media/library share one rail).
          if (root.classList.contains('panel--media') || root.classList.contains('panel--library')) {
            root.classList.add('panel--mobile-closed');
          }
          root.classList.remove('export-dialog--open', 'export-panel--open', 'panel--open');
          root.classList.add('panel--hidden');
          root.style.display = 'none';
        }, s.root);
        await page.waitForTimeout(400);
      }
      widthReport.surfaces[s.id].closeVerified = !stillOpen;
    }
    report.widths[w] = widthReport;
    await page.close();
  }

  await browser.close();
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`wrote ${OUT}`);
  for (const [w, r] of Object.entries(report.widths)) {
    console.log(`\n@ ${w}px`);
    for (const [id, s] of Object.entries(r.surfaces)) {
      const bad = (s.controlsPastViewport?.length || 0) + (s.controlsHitFail?.length || 0) + (s.controlsClipped?.length || 0) + (s.controlsUnderMin?.length || 0);
      console.log(`  ${bad ? 'FAIL' : 'ok  '} ${id.padEnd(20)} controls=${String(s.controlCount).padEnd(3)} ` +
        `pastViewport=${s.controlsPastViewport?.length || 0} hitFail=${s.controlsHitFail?.length || 0} ` +
        `clip=${s.controlsClipped?.length || 0} underMin=${s.controlsUnderMin?.length || 0} ` +
        `targetOverflowX=${s.targetOverflowX ?? 'n/a'} docOverflowX=${s.docOverflowX ?? 'n/a'} ` +
        `minControl=${s.minControl ?? 'n/a'}`);
      for (const c of s.controlsPastViewport || []) console.log(`      PAST-VIEWPORT ${c.label} box=${JSON.stringify(c.box)} hit=${c.hitTag}`);
      for (const c of s.controlsHitFail || []) console.log(`      HIT-FAIL      ${c.label} box=${JSON.stringify(c.box)} hit=${c.hitTag}`);
      for (const c of s.controlsClipped || []) console.log(`      CLIPPED       ${c.label} scrollClip=${c.scrollClip}`);
      for (const c of s.controlsUnderMin || []) console.log(`      UNDER-MIN     ${c.label} box=${JSON.stringify(c.box)}`);
    }
    if (r.pageErrors?.length) console.log(`  pageErrors: ${JSON.stringify(r.pageErrors)}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
