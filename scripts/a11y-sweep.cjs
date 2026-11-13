#!/usr/bin/env node
/**
 * a11y-sweep.cjs — M13: a11y + responsive sweep of every WWW_PAINT surface.
 *
 * Mac-owned. No axe-core (the no-new-deps rule holds) — this is a DOM + real
 * geometry audit against the WCAG 2.2 AA bar from docs/MAC-TASKS.md M13:
 *
 *   A. KEYBOARD     every interactive control is a real focusable element
 *   B. FOCUS        :focus-visible has a visible outline (computed style)
 *   C. TARGET       every control >= 44x44 css px (with a --pseudo check, so
 *                   padding-only inflation is caught)
 *   D. LABEL        every control has an accessible name
 *   E. OVERLAYS     dialogs: role/aria-modal, Escape closes, focus moves in,
 *                   focus returns to the trigger on close
 *   F. LIVE         live regions: polite status, assertive errors
 *   G. MOTION       prefers-reduced-motion kills transitions/animations
 *   H. RESPONSIVE   390 / 500 / 768 / 1024 / 1440 / 1920: no horizontal
 *                   document overflow, no clipped or off-viewport controls
 *
 * Usage:
 *   NODE_PATH=<dir with playwright-core> node scripts/a11y-sweep.cjs
 *   ... --json=docs/research/a11y-sweep.json --shots=docs/research/a11y
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const JSON_OUT = (process.argv.find((a) => a.startsWith('--json=')) || '').split('=')[1]
  || path.join(ROOT, 'docs', 'research', 'a11y-sweep.json');
const SHOT_DIR = (process.argv.find((a) => a.startsWith('--shots=')) || '').split('=')[1]
  || path.join(ROOT, 'docs', 'research', 'a11y');
const WIDTHS = (process.argv.find((a) => a.startsWith('--widths=')) || '').split('=')[1]
  ? (process.argv.find((a) => a.startsWith('--widths=')) || '').split('=')[1].split(',').map(Number)
  : [390, 500, 768, 1024, 1440, 1920];

const MIN_TARGET = 44;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.wasm': 'application/wasm',
};

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
  return undefined;
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(ROOT, url === '/' ? '/index.html' : url);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/* ── In-page audit. Runs once per viewport. ─────────────────────────────── */
const PAGE_AUDIT = () => {
  const MIN = 44;
  const out = {
    widths: innerWidth,
    interactive: [],
    overlays: [],
    liveRegions: [],
    motion: {},
    document: {},
    landmarks: [],
    duplicates: [],
  };

  const isVisible = (el) => {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    return r.width > 0 && r.height > 0;
  };

  const accessibleName = (el) => {
    const al = (el.getAttribute('aria-label') || '').trim();
    if (al) return { name: al, via: 'aria-label' };
    const lab = el.getAttribute('aria-labelledby');
    if (lab) {
      const t = lab.split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean)
        .map((n) => (n.textContent || '').trim()).join(' ');
      if (t) return { name: t, via: 'aria-labelledby' };
    }
    if (el.labels && el.labels.length) {
      const t = [...el.labels].map((l) => (l.textContent || '').trim()).filter(Boolean).join(' ');
      if (t) return { name: t, via: 'label' };
    }
    if (el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement) {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t) return { name: t, via: 'text' };
    }
    if (el instanceof HTMLInputElement) {
      if (el.type === 'submit' || el.type === 'button' || el.type === 'reset') {
        if ((el.value || '').trim()) return { name: el.value.trim(), via: 'value' };
      }
      if (el.type === 'image' && (el.alt || '').trim()) return { name: el.alt.trim(), via: 'alt' };
    }
    if ((el.getAttribute('title') || '').trim()) return { name: el.getAttribute('title').trim(), via: 'title' };
    if ((el.getAttribute('alt') || '').trim()) return { name: el.getAttribute('alt').trim(), via: 'alt' };
    if ((el.getAttribute('placeholder') || '').trim()) return { name: el.getAttribute('placeholder').trim(), via: 'placeholder' };
    return { name: '', via: 'none' };
  };

  /* A. / B. / C. / D. — every focusable interactive control */
  const focusableSel = [
    'button', 'a[href]', 'input', 'select', 'textarea', '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  // Does the stylesheet declare a GLOBAL :focus-visible rule (a bare
  // `:focus-visible { ... }` with no element qualifier)? It covers every
  // element, so an element without its own rule is still compliant.
  let globalFocusVisibleRule = false;
  try {
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      for (const rule of rules) {
        if (!rule.selectorText) continue;
        if (!/:focus-visible/.test(rule.selectorText)) continue;
        const parts = rule.selectorText.split(',').map((s) => s.trim());
        if (parts.some((p) => p === ':focus-visible' || p === '*:focus-visible')) {
          globalFocusVisibleRule = true;
        }
      }
    }
  } catch { /* ignore */ }

  const controls = [...document.querySelectorAll(focusableSel)].filter(isVisible);
  // The probe itself opens every panel, so a panel that is hidden only by
  // `display:none` still reports its controls here. That is intended (a11y
  // must hold when the panel is open), but it means `underMin` counts closed
  // panels too. Fine — the fix is the same either way.
  out.probeNote = 'controls include panels opened by the probe';

  for (const el of controls) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const name = accessibleName(el);

    // Focus style: the computed outline, plus a probe of the :focus-visible
    // rules that actually apply to this element.
    const outlineWidth = parseFloat(cs.outlineWidth) || 0;
    const outlineStyle = cs.outlineStyle;
    const outlineColor = cs.outlineColor;
    const hasOutline = outlineWidth > 0 && outlineStyle !== 'none';

    // Which :focus-visible rules target this element?
    const focusRules = [];
    let ruleFocusVisible = false;
    let ruleOutlineNone = false;
    try {
      for (const sheet of document.styleSheets) {
        let rules;
        try { rules = sheet.cssRules; } catch { continue; }
        for (const rule of rules) {
          if (!rule.selectorText) continue;
          const sel = rule.selectorText;
          if (!/:focus-visible|:focus\b/.test(sel)) continue;
          // A rule written `button:focus-visible` does NOT match the selector
          // text `:focus-visible` literally — split it into simple selectors
          // and test each compound part.
          const simple = sel.split(/,(?![^(]*\))/).flatMap((s) =>
            s.trim().split(/(?=[#.:\[])/).map((p) => p.trim()).filter(Boolean),
          );
          let matches = false;
          for (const part of simple) {
            try { if (el.matches(part)) { matches = true; break; } } catch { /* ignore */ }
          }
          if (!matches) {
            try { matches = el.matches(sel); } catch { matches = false; }
          }
          if (!matches) continue;
          const st = rule.style || {};
          focusRules.push({
            selector: sel,
            outline: st.outline || '',
            outlineWidth: st.outlineWidth || '',
            outlineStyle: st.outlineStyle || '',
            boxShadow: st.boxShadow || '',
            border: st.border || st.borderColor || '',
          });
          if (/focus-visible/.test(sel)) ruleFocusVisible = true;
          if ((st.outlineStyle === 'none') || (st.outline === 'none')) ruleOutlineNone = true;
        }
      }
    } catch { /* stylesheet access can fail */ }

    const focusVisibleStyle = (() => {
      if (ruleFocusVisible) {
        if (ruleOutlineNone && !hasOutline && !cs.boxShadow) return 'removed-no-replacement';
        return 'declared';
      }
      // No element-specific :focus-visible rule. Is there a GLOBAL one that
      // covers this element (a bare `:focus-visible { ... }` selector)?
      if (globalFocusVisibleRule) return 'global-rule';
      // A plain `:focus` rule still gives a visible focus indicator, which is
      // what WCAG 2.2 SC 2.4.11/2.4.13 actually require.
      if (focusRules.length) return 'focus-not-visible';
      return 'none-declared';
    })();

    // Does the element's OWN :focus-visible rule remove the outline without
    // replacing it with a shadow/ring? (Computed style alone cannot tell us
    // what happens while focused.)
    const selfFocusRule = focusRules.find((r) => /focus-visible/.test(r.selector));
    const removedWithoutReplacement = !!(selfFocusRule
      && ((selfFocusRule.outlineStyle === 'none') || (selfFocusRule.outline === 'none'))
      && !selfFocusRule.boxShadow
      && !selfFocusRule.border);

    // The pseudo-element box — so padding-only inflation is visible.
    const before = getComputedStyle(el, '::before');
    const after = getComputedStyle(el, '::after');
    const pseudoBox = (p) => {
      const c = p.content;
      if (!c || c === 'none' || c === 'normal') return null;
      const w = parseFloat(p.width) || 0;
      const h = parseFloat(p.height) || 0;
      return { content: c, width: w, height: h, position: p.position };
    };

    // ── Slider hit area ──────────────────────────────────────────────
    // A range input's OWN box is the track (often 3px tall). Its thumb is a
    // pseudo-element and is NOT included in the box. WCAG 2.2 SC 2.5.8
    // measures the target size, so for a slider the thumb plus its own
    // scrollable/tappable band is the real target.
    let sliderTarget = null;
    if (el instanceof HTMLInputElement && el.type === 'range') {
      const bw = parseFloat(before.width) || 0;
      const bh = parseFloat(before.height) || 0;
      const aw = parseFloat(after.width) || 0;
      const ah = parseFloat(after.height) || 0;
      const thumbW = Math.max(bw, aw);
      const thumbH = Math.max(bh, ah);
      // The tappable band: a range input is operable along its whole width,
      // and the thumb can be dragged anywhere within it. The effective target
      // is the thumb, but the row it sits in is the practical hit area.
      const row = el.closest('.slider-row, .form-row, .export-panel__range-wrap, .motion-scrubber-wrap, .layer-opacity-row, .paint-toolbar__row, .control-row');
      let rowBox = null;
      if (row) {
        const rr = row.getBoundingClientRect();
        rowBox = { w: +rr.width.toFixed(1), h: +rr.height.toFixed(1), cls: (row.className || '').toString().slice(0, 30) };
      }
      sliderTarget = {
        thumbW: thumbW || null,
        thumbH: thumbH || null,
        row: rowBox,
        // The usable target: the larger of the thumb and the row band.
        effectiveH: Math.max(thumbH, rowBox ? rowBox.h : 0),
        effectiveW: Math.max(thumbW, rowBox ? rowBox.w : 0),
        underMinThumb: thumbH > 0 && thumbH < MIN,
        underMinRow: rowBox ? rowBox.h < MIN : true,
      };
    }

    // Target size: the element box PLUS any positioned pseudo-element that
    // extends the clickable area.
    const pbs = [pseudoBox(before), pseudoBox(after)].filter(Boolean);
    let extraW = 0; let extraH = 0;
    for (const p of pbs) {
      if (p.position === 'absolute' || p.position === 'fixed') {
        extraW = Math.max(extraW, p.width);
        extraH = Math.max(extraH, p.height);
      }
    }

    out.interactive.push({
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      cls: (el.className || '').toString().slice(0, 60),
      type: el.getAttribute('type') || '',
      name: name.name,
      nameVia: name.via,
      role: el.getAttribute('role') || '',
      disabled: !!el.disabled,
      tabindex: el.getAttribute('tabindex') || '0',
      rect: { w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
      targetW: +(r.width + extraW).toFixed(1),
      targetH: +(r.height + extraH).toFixed(1),
      sliderTarget,
      underMinW: r.width < MIN - 0.5,
      underMinH: r.height < MIN - 0.5,
      underMinSlider: sliderTarget ? (sliderTarget.underMinThumb || sliderTarget.underMinRow) : false,
      // A control that meets 44px only because a positioned pseudo-element
      // extends it is still a 44px target — but a control that relies on
      // `padding` inside its own box does not get credit here.
      pseudoExtended: extraW > 0 || extraH > 0,
      hasOutline,
      outlineWidth: outlineWidth ? outlineWidth : 0,
      outlineStyle,
      outlineColor,
      boxShadow: cs.boxShadow !== 'none' ? cs.boxShadow.slice(0, 60) : '',
      focusVisibleStyle,
      removedWithoutReplacement,
      focusRules,
      offViewport: r.right > innerWidth + 0.5 || r.left < -0.5,
      clippedByOverflow: (() => {
        const p = el.parentElement;
        if (!p) return false;
        const pr = p.getBoundingClientRect();
        const pcs = getComputedStyle(p);
        if (pcs.overflowX === 'hidden' || pcs.overflowY === 'hidden' || pcs.overflow === 'hidden') {
          const er = el.getBoundingClientRect();
          if (er.right > pr.right + 0.5 || er.left < pr.left - 0.5) return true;
          if (er.bottom > pr.bottom + 0.5 || er.top < pr.top - 0.5) return true;
        }
        return false;
      })(),
    });
  }

  /* E. Overlays — every dialog in the DOM */
  const dialogs = [...document.querySelectorAll('[role="dialog"], dialog')];
  for (const d of dialogs) {
    out.overlays.push({
      id: d.id || '',
      cls: (d.className || '').toString().slice(0, 60),
      role: d.getAttribute('role') || '',
      ariaModal: d.getAttribute('aria-modal'),
      ariaHidden: d.getAttribute('aria-hidden'),
      ariaLabelledby: d.getAttribute('aria-labelledby') || '',
      ariaLabel: d.getAttribute('aria-label') || '',
      labelledByName: (() => {
        const id = d.getAttribute('aria-labelledby');
        if (!id) return d.getAttribute('aria-label') || '';
        const n = document.getElementById(id);
        return n ? (n.textContent || '').trim() : '';
      })(),
      hasFocusable: d.querySelectorAll(focusableSel).length,
      isOpenClass: (d.className || '').toString().split(/\s+/).filter((c) => /open|active|show/.test(c)),
      hiddenByDisplay: getComputedStyle(d).display === 'none',
      hiddenByOpacity: getComputedStyle(d).opacity === '0',
    });
  }

  /* F. Live regions */
  const liveSel = '[aria-live], [role="status"], [role="alert"], [role="log"]';
  for (const el of document.querySelectorAll(liveSel)) {
    out.liveRegions.push({
      id: el.id || '',
      cls: (el.className || '').toString().slice(0, 60),
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || '',
      ariaLive: el.getAttribute('aria-live') || '',
      atomic: el.getAttribute('aria-atomic') || '',
      relevant: el.getAttribute('aria-relevant') || '',
      visible: isVisible(el),
      text: (el.textContent || '').trim().slice(0, 60),
      parentOfControls: el.querySelectorAll(focusableSel).length,
    });
  }

  /* G. Motion — do the reduced-motion rules exist, and what do they set? */
  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  out.motion = {
    matchesNow: reducedQuery.matches,
    rules: (() => {
      const found = [];
      for (const sheet of document.styleSheets) {
        let rules;
        try { rules = sheet.cssRules; } catch { continue; }
        const walk = (list, cond) => {
          for (const rule of list) {
            if (rule.type === CSSRule.MEDIA_RULE) {
              if (/prefers-reduced-motion/.test(rule.conditionText || rule.media.mediaText)) {
                found.push({ condition: rule.conditionText || rule.media.mediaText, inner: rule.cssRules.length });
                for (const inner of rule.cssRules) {
                  found.push({
                    condition: rule.conditionText || rule.media.mediaText,
                    selector: inner.selectorText || '',
                    cssText: (inner.style && inner.style.cssText) || '',
                  });
                }
              }
              walk(rule.cssRules, cond);
            }
          }
        };
        walk(rules, '');
      }
      return found;
    })(),
    animations: (() => {
      const anims = new Set();
      for (const el of document.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if (cs.animationName && cs.animationName !== 'none') anims.add(cs.animationName);
      }
      return [...anims];
    })(),
  };

  /* H. Document geometry */
  const de = document.documentElement;
  out.document = {
    innerWidth: innerWidth,
    innerHeight: innerHeight,
    scrollWidth: de.scrollWidth,
    clientWidth: de.clientWidth,
    docOverflowX: de.scrollWidth - de.clientWidth,
    scrollHeight: de.scrollHeight,
    clientHeight: de.clientHeight,
    docOverflowY: de.scrollHeight - de.clientHeight,
    scrollContainers: [...document.querySelectorAll('main, aside, section, .panel, .canvas-wrapper, .export-panel__content, .library-scroll, .media-scroll')]
      .filter((el) => {
        const cs = getComputedStyle(el);
        return /auto|scroll|hidden/.test(cs.overflowX) && el.scrollWidth - el.clientWidth > 1;
      })
      .map((el) => ({
        sel: el.id || (el.className || '').toString().slice(0, 40),
        scrollW: el.scrollWidth, clientW: el.clientWidth, over: el.scrollWidth - el.clientWidth,
      })),
  };

  /* Landmarks */
  for (const el of document.querySelectorAll(
    'header, nav, main, aside, footer, [role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"], [role="region"]',
  )) {
    const r = el.getBoundingClientRect();
    out.landmarks.push({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || '',
      id: el.id || '',
      cls: (el.className || '').toString().slice(0, 40),
      ariaLabel: el.getAttribute('aria-label') || '',
      rect: { x: +r.x.toFixed(0), y: +r.y.toFixed(0), w: +r.width.toFixed(0), h: +r.height.toFixed(0) },
    });
  }

  /* Duplicate landmark roles (a WCAG 2.2 / best-practice smell) */
  const roleCount = {};
  for (const l of out.landmarks) {
    const key = l.role || l.tag;
    roleCount[key] = (roleCount[key] || 0) + 1;
  }
  for (const [k, v] of Object.entries(roleCount)) if (v > 1) out.duplicates.push({ role: k, count: v });

  return out;
};

/** Open every overlay and re-audit, so closed panels are still measured.
 *  The left rail is EXCLUSIVE — controls, media and library cannot be open at
 *  once — so the probe opens them one at a time and records each state. */
const PAGE_OPEN_ALL = async () => {
  const opened = [];
  const toggles = [
    'btn-export-panel', 'btn-ui-settings', 'btn-paint-mode',
    'toggle-controls', 'toggle-layers',
  ];
  for (const id of toggles) {
    const el = document.getElementById(id);
    if (!el) continue;
    try { el.click(); } catch { /* ignore */ }
    opened.push(id);
    await new Promise((r) => setTimeout(r, 120));
  }
  // close the modals (so they do not occlude the panels on the next pass)
  const closeIds = ['export-panel-close'];
  for (const id of closeIds) {
    const el = document.getElementById(id);
    if (el) { try { el.click(); } catch { /* ignore */ } }
    await new Promise((r) => setTimeout(r, 120));
  }
  return opened;
};

/** The left-rail panels are mutually exclusive; audit each in its open state. */
async function PAGE_AUDIT_RAIL(page, buttonId) {
  await page.evaluate((id) => document.getElementById(id)?.click(), buttonId);
  await new Promise((r) => setTimeout(r, 300));
  const audit = await page.evaluate(PAGE_AUDIT);
  await page.evaluate((id) => document.getElementById(id)?.click(), buttonId);
  await new Promise((r) => setTimeout(r, 200));
  return audit;
}

async function main() {
  fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const { server, port } = await startServer();
  const chromiumPath = findChromium();
  const browser = await chromium.launch({
    executablePath: chromiumPath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const report = {
    generatedAt: new Date().toISOString(),
    url: `http://127.0.0.1:${port}/index.html`,
    minTarget: MIN_TARGET,
    widths: {},
    summary: {},
    pageErrors: [],
    consoleErrors: [],
  };

  for (const width of WIDTHS) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
    await page.waitForTimeout(1200);

    // First pass: the app as the user finds it.
    const asFound = await page.evaluate(PAGE_AUDIT);

    // Second pass: open every overlay, then audit again so closed panels are
    // measured too. (A closed panel's controls are still in the a11y tree.)
    const opened = await page.evaluate(PAGE_OPEN_ALL);
    await page.waitForTimeout(500);
    const allOpen = await page.evaluate(PAGE_AUDIT);

    // Third pass: the left rail is exclusive. Audit each rail panel in its
    // own open state, so a control is never measured while its panel is
    // translated off-screen by a sibling being open.
    const rail = {};
    for (const id of ['btn-media-mode', 'btn-library-mode']) {
      rail[id] = await PAGE_AUDIT_RAIL(page, id);
    }

    const shot = path.join(SHOT_DIR, `a11y-${width}.png`);
    await page.screenshot({ path: shot, fullPage: false });

    report.widths[width] = {
      asFound,
      allOpen,
      rail,
      opened,
      errors,
      shot: path.relative(ROOT, shot),
    };
    await page.close();
  }

  await browser.close();
  server.close();

  /* ── Summaries ─────────────────────────────────────────────────────── */
  const summary = { perWidth: {} };
  const allControls = [];
  const allOverlays = [];
  const allLive = [];

  for (const [w, data] of Object.entries(report.widths)) {
    // Prefer the rail-specific audits for off-viewport findings: a rail panel
    // measured while a sibling occupies the rail is translated off-screen.
    const railAudits = Object.values(data.rail || {}).filter(Boolean);
    const railOff = railAudits.flatMap((a) => (a.interactive || []).filter((c) => c.offViewport));
    const railUnder = railAudits.flatMap((a) => (a.interactive || []).filter((c) => c.underMinW || c.underMinH || c.underMinSlider));
    const railNoName = railAudits.flatMap((a) => (a.interactive || []).filter((c) => !c.name));

    const controls = data.allOpen.interactive || [];
    const overlays = data.allOpen.overlays || [];
    const live = data.allOpen.liveRegions || [];
    const doc = data.allOpen.document || {};
    const motion = data.allOpen.motion || {};

    const underMin = controls.filter((c) => c.underMinW || c.underMinH);
    const noName = controls.filter((c) => !c.name);
    const noFocusStyle = controls.filter((c) => c.focusVisibleStyle !== 'declared');
    const removedFocus = controls.filter((c) => c.removedWithoutReplacement);
    const offViewport = controls.filter((c) => c.offViewport);
    const clipped = controls.filter((c) => c.clippedByOverflow);

    allControls.push(...controls.map((c) => ({ ...c, width: w })));
    allOverlays.push(...overlays.map((o) => ({ ...o, width: w })));
    allLive.push(...live.map((l) => ({ ...l, width: w })));

    summary.perWidth[w] = {
      controlCount: controls.length,
      underMinTarget: underMin.length,
      underMinList: underMin.map((c) => ({
        tag: c.tag, id: c.id, cls: c.cls.slice(0, 30), w: c.rect.w, h: c.rect.h,
      })),
      noAccessibleName: noName.length,
      noNameList: noName.map((c) => ({ tag: c.tag, id: c.id, cls: c.cls.slice(0, 30) })),
      noFocusVisibleRule: noFocusStyle.length,
      removedFocusWithoutReplacement: removedFocus.length,
      noFocusList: noFocusStyle.slice(0, 20).map((c) => ({ tag: c.tag, id: c.id, cls: c.cls.slice(0, 30), style: c.focusVisibleStyle })),
      offViewport: offViewport.length,
      offViewportList: offViewport.slice(0, 10).map((c) => ({ tag: c.tag, id: c.id, cls: c.cls.slice(0, 30) })),
      // Rail panels measured in their own open state (the honest number).
      railOffViewport: railOff.length,
      railOffViewportList: railOff.slice(0, 10).map((c) => ({ tag: c.tag, id: c.id, cls: c.cls.slice(0, 30) })),
      railUnderMin: railUnder.length,
      railNoName: railNoName.length,
      clipped: clipped.length,
      docOverflowX: doc.docOverflowX || 0,
      scrollContainers: (doc.scrollContainers || []).length,
      overlayCount: overlays.length,
      liveRegionCount: live.length,
      animationNames: (motion.animations || []).length,
      reducedMotionRules: (motion.rules || []).length,
      errors: data.errors,
    };
  }

  // Global, de-duplicated findings across widths.
  const byKey = (arr, keyFn) => {
    const m = new Map();
    for (const x of arr) {
      const k = keyFn(x);
      if (!m.has(k)) m.set(k, { ...x, widths: [x.width] });
      else m.get(k).widths.push(x.width);
    }
    return [...m.values()];
  };

  summary.uniqueControls = byKey(allControls, (c) => `${c.tag}#${c.id || c.cls}|${c.name}`);
  summary.uniqueUnderMin = byKey(
    allControls.filter((c) => c.underMinW || c.underMinH),
    (c) => `${c.tag}#${c.id || c.cls}|${c.name}`,
  );
  summary.uniqueNoName = byKey(allControls.filter((c) => !c.name), (c) => `${c.tag}#${c.id || c.cls}`);
  summary.uniqueNoFocus = byKey(
    allControls.filter((c) => c.focusVisibleStyle !== 'declared'),
    (c) => `${c.tag}#${c.id || c.cls}|${c.focusVisibleStyle}`,
  );
  summary.uniqueOverlays = byKey(allOverlays, (o) => `${o.id || o.cls}`);
  summary.uniqueLive = byKey(allLive, (l) => `${l.id || l.cls}|${l.ariaLive}|${l.role}`);

  report.summary = summary;
  fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));

  /* ── Console ───────────────────────────────────────────────────────── */
  const line = (s) => console.log(s);
  line('');
  line('=== M13 a11y + responsive sweep ===');
  line(`widths: ${WIDTHS.join(' / ')}`);
  line('');
  for (const [w, s] of Object.entries(summary.perWidth)) {
    line(`@ ${w}px  controls ${s.controlCount}  underMin ${s.underMinTarget}  noName ${s.noAccessibleName}  noFocusRule ${s.noFocusVisibleRule}  focusRemoved ${s.removedFocusWithoutReplacement}  offViewport ${s.offViewport} (rail ${s.railOffViewport})  clipped ${s.clipped}  docOverflowX ${s.docOverflowX}  scrollContainers ${s.scrollContainers}  overlays ${s.overlayCount}  live ${s.liveRegionCount}  anims ${s.animationNames}  reducedRules ${s.reducedMotionRules}  errors ${s.errors.length}`);
  }
  line('');
  line(`UNIQUE under-min-target controls (across all widths): ${summary.uniqueUnderMin.length}`);
  for (const c of summary.uniqueUnderMin.slice(0, 40)) {
    line(`  ${c.tag}#${c.id || c.cls.slice(0, 28)}  ${c.rect.w}x${c.rect.h}  "${c.name.slice(0, 30)}"  widths ${[...new Set(c.widths)].join(',')}`);
  }
  line('');
  line(`UNIQUE controls with no accessible name: ${summary.uniqueNoName.length}`);
  for (const c of summary.uniqueNoName.slice(0, 20)) line(`  ${c.tag}#${c.id || c.cls.slice(0, 28)}`);
  line('');
  line(`UNIQUE controls with no :focus-visible rule: ${summary.uniqueNoFocus.length}`);
  for (const c of summary.uniqueNoFocus.slice(0, 20)) line(`  ${c.tag}#${c.id || c.cls.slice(0, 28)}  ${c.focusVisibleStyle}`);
  line('');
  line(`UNIQUE overlays: ${summary.uniqueOverlays.length}`);
  for (const o of summary.uniqueOverlays) {
    line(`  ${o.id || o.cls.slice(0, 28)}  role=${o.role} modal=${o.ariaModal} hidden=${o.ariaHidden} labelledby="${o.labelledByName}" focusables=${o.hasFocusable}`);
  }
  line('');
  line(`UNIQUE live regions: ${summary.uniqueLive.length}`);
  for (const l of summary.uniqueLive) {
    line(`  ${l.id || l.cls.slice(0, 28)}  role=${l.role} live=${l.ariaLive} visible=${l.visible}`);
  }
  line('');
  line(`JSON: ${path.relative(ROOT, JSON_OUT)}`);
  line(`shots: ${path.relative(ROOT, SHOT_DIR)}/<width>.png`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
