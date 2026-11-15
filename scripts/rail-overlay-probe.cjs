#!/usr/bin/env node
/**
 * rail-overlay-probe.cjs — regression guard for AGENTS.md §0.10, §0.11, §0.12.
 *
 * Three left-rail defects shipped behind eleven green gates because nothing
 * measured these two things:
 *
 *   §0.10  the style library panel was missing from the <=768px `position: fixed`
 *          rule, so it stayed `position: absolute; z-index: 1` underneath the
 *          full-bleed `.canvas-wrapper` (z-index 2) — all six of its controls
 *          were drawn behind the canvas and untappable.
 *   §0.11  the PATH ORDER segmented control rendered 11 options in one
 *          `flex-wrap: nowrap` row: 748px of content inside a 258px rail, so
 *          `.controls-scroll` (overflow-x: hidden) clipped 7 of the 11 buttons
 *          past the edge where no scroll offset could reach them.
 *   §0.12  the two floating rail toggles were anchored 80px above the viewport
 *          bottom, which put them over the library panel's bottom-most row.
 *
 * A defect of this class is invisible to the Maestro flows (they assert the
 * accessibility tree, not geometry), to the visual baselines (they never open a
 * rail panel) and to the a11y sweep (it only measures a panel it happens to
 * open, and only its own viewport). So this probe measures, per width AND per
 * phone height:
 *
 *   1. every control of the OPEN rail panel lies fully inside the viewport
 *      (no negative left, no right-edge overflow), and
 *   2. `elementFromPoint` at its centre returns the control itself (or a
 *      descendant of it) — i.e. nothing is stacked on top of it, and
 *   3. the PATH ORDER `.segmented` row does not overflow its client box
 *      horizontally, and every `.segmented__btn` is inside the panel band.
 *
 * Height matters: a viewport-anchored overlay and a top-anchored panel only
 * collide at some viewport heights, so 390x844 (a real phone) and 390x900 (the
 * height the other probes use) are both checked.
 *
 * Usage:
 *   NODE_PATH=<dir with playwright-core> node scripts/rail-overlay-probe.cjs
 *   ... [--sizes=390x844,390x900,768x900] [--json=<path>]
 * Exit: 0 = every size clean, 1 = a size failed (or the probe crashed).
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const sizesArg = (process.argv.find((a) => a.startsWith('--sizes=')) || '').split('=')[1];
const SIZES = (sizesArg ? sizesArg.split(',') : [
  // phone widths at BOTH heights (a viewport-anchored overlay and a top-anchored
  // panel only collide at some heights), then the desktop rail where §0.11 bites.
  '390x844', '390x900', '400x844', '414x900', '768x844', '768x900',
  '1024x900', '1440x900', '1920x900',
]).map((s) => s.split('x').map(Number));
const JSON_OUT = (process.argv.find((a) => a.startsWith('--json=')) || '').split('=')[1] || '';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.wasm': 'application/wasm',
};

function findChromium() {
  const base = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  const dirs = fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => parseInt(b.split('-')[1], 10) - parseInt(a.split('-')[1], 10));
  for (const d of dirs) {
    for (const sub of [['chrome-linux64', 'chrome'], ['chrome-linux', 'chrome']]) {
      const p = path.join(base, d, ...sub);
      if (fs.existsSync(p)) return p;
    }
  }
  for (const d of dirs) {
    const p = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright', d,
      'chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function startServer() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = path.join(ROOT, url === '/' ? '/index.html' : url);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

/* Runs INSIDE the page. Panel id in, control geometry + stacking out. */
const MEASURE = (panelId) => {
  const panel = document.getElementById(panelId);
  if (!panel) return { missing: true };
  const pr = panel.getBoundingClientRect();
  const cs = getComputedStyle(panel);
  const controls = [...panel.querySelectorAll('button,input,select,textarea,a[href]')]
    .filter((el) => {
      const c = getComputedStyle(el);
      if (c.display === 'none' || c.visibility === 'hidden') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    })
    .map((el) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const hit = document.elementFromPoint(cx, cy);
      const selfHit = !!hit && (hit === el || el.contains(hit) || hit.contains(el));
      // Judge reachability only where the control is actually PAINTED: if its
      // centre is outside the panel's own border box, the panel's scroll host has
      // clipped it (the host scrolls, so it is reachable — not a defect). A centre
      // INSIDE the panel that hit-tests to something else is the real defect: an
      // overlay stacked above the panel (0.10 / 0.12), or a row that no scroll can
      // bring on-screen (0.11).
      const centreInPanel = cx >= pr.left - 0.5 && cx <= pr.right + 0.5
        && cy >= pr.top - 0.5 && cy <= pr.bottom + 0.5;
      return {
        label: (el.getAttribute('aria-label') || el.id || el.textContent || '').trim().slice(0, 28),
        box: { l: +r.left.toFixed(1), t: +r.top.toFixed(1), r: +r.right.toFixed(1), b: +r.bottom.toFixed(1) },
        offLeft: r.left < -0.5,
        offRight: r.right > innerWidth + 0.5,
        belowFold: !centreInPanel,
        hitTag: hit ? (hit.id ? '#' + hit.id : hit.tagName.toLowerCase() + '.' + [...hit.classList].join('.')) : null,
        unreachable: centreInPanel && !selfHit,
      };
    });
  // §0.11: the PATH ORDER row must not overflow horizontally.
  const order = panel.querySelector('#path-section .segmented');
  let segmented = null;
  if (order) {
    const or = order.getBoundingClientRect();
    segmented = {
      clientWidth: order.clientWidth,
      scrollWidth: order.scrollWidth,
      overflowX: order.scrollWidth - order.clientWidth,
      left: +or.left.toFixed(1),
      right: +or.right.toFixed(1),
      buttons: [...order.querySelectorAll('.segmented__btn')].map((b) => {
        const br = b.getBoundingClientRect();
        return {
          label: (b.textContent || '').trim(),
          l: +br.left.toFixed(1), r: +br.right.toFixed(1),
          inside: br.left >= or.left - 0.5 && br.right <= or.right + 0.5,
          clipped: b.scrollWidth > b.clientWidth + 1,
        };
      }),
    };
  }
  return {
    panelPos: cs.position,
    panel: { l: +pr.left.toFixed(1), r: +pr.right.toFixed(1), w: +pr.width.toFixed(1), vis: cs.visibility },
    controls, segmented,
  };
};

async function openPanel(page, which) {
  // The left rail is exclusive, so establish a known state first.
  await page.evaluate(() => {
    const lib = document.getElementById('style-library-root');
    const ctl = document.getElementById('controls-root');
    const off = document.getElementById('btn-library-mode');
    const mobile = matchMedia('(max-width: 768px)').matches;
    // library mode off
    if (lib && lib.classList.contains('panel--mobile-closed') === false && !mobile) { /* desktop keeps it hidden */ }
    if (off && off.classList.contains('nav-btn--active')) off.click();
    if (ctl) {
      ctl.classList.toggle('panel--mobile-closed', mobile);
      ctl.classList.remove('panel--hidden');
    }
  });
  await page.waitForTimeout(700);
  if (which === 'library') {
    await page.click('#btn-library-mode');
  } else {
    const closed = await page.evaluate(() => document.getElementById('controls-root').classList.contains('panel--mobile-closed'));
    if (closed) await page.click('#toggle-controls');
  }
  await page.waitForTimeout(750); // > the 280ms slide, so nothing is mid-transition
}

(async () => {
  const { server, port } = await startServer();
  const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const results = { url: `http://127.0.0.1:${port}/index.html`, sizes: [] };
  let failed = 0;

  for (const [W, H] of SIZES) {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
    await page.waitForTimeout(900);
    const per = { width: W, height: H, panels: {} };
    let sizeBad = 0;

    for (const which of ['library', 'controls']) {
      await openPanel(page, which);
      const panelId = which === 'library' ? 'style-library-root' : 'controls-root';
      const d = await page.evaluate(MEASURE, panelId);
      if (d.missing) { console.log(`@${W}x${H} ${which}: PANEL MISSING`); failed++; sizeBad++; continue; }
      const bad = d.controls.filter((c) => c.offLeft || c.offRight || c.unreachable);
      // A panel that did not actually open measures as a vacuous pass.
      const vacuous = d.controls.length === 0 || d.panel.w < 50;
      const orderBad = d.segmented ? (d.segmented.overflowX > 1 || d.segmented.buttons.some((b) => !b.inside || b.clipped)) : false;
      if (bad.length || vacuous || orderBad) sizeBad++;
      per.panels[which] = { ...d, bad, vacuous, orderBad };
      const detail = bad.map((c) => `${c.label}[${c.hitTag || 'below'}]`).join(',');
      console.log(`@${W}x${H} ${which.padEnd(8)} pos=${d.panelPos.padEnd(8)} panel=${d.panel.l}..${d.panel.r} ctrl=${d.controls.length}` +
        ` unreachable=${bad.length}${detail ? ' ' + detail : ''}` +
        (d.segmented ? `  order row ${d.segmented.scrollWidth}/${d.segmented.clientWidth}` +
          ` btns=${d.segmented.buttons.length} inside=${d.segmented.buttons.filter((b) => b.inside && !b.clipped).length}` : '') +
        (vacuous ? '  VACUOUS (panel not open)' : ''));
    }
    if (sizeBad) failed++;
    per.verdict = sizeBad ? 'DEFECT' : 'ok';
    results.sizes.push(per);
    await page.close();
  }

  await browser.close();
  server.close();
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(results, null, 2));
  console.log(`\n${failed ? 'FAIL' : 'PASS'} — ${failed} of ${SIZES.length} sizes failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
