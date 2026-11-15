#!/usr/bin/env node
/**
 * primitive-mixer-probe.cjs — real-browser guard for Track-S S5 / M16 (the Mac
 * half, the stroke-language mixer UI).
 *
 * The node suite (`tests/primitive-mixer.test.js`) covers the pure core. This
 * probe drives the REAL page and proves the claims the brief makes about the UI:
 *
 *   1. the mixer is MOUNTED in the Style panel with exactly six weight sliders
 *      (`0..1`, step 0.05), a level picker and a read-out;
 *   2. moving a slider updates the canonical read-out and the resolved
 *      `effectiveStyle`;
 *   3. SAVE writes the mix to `global.primitives` (canonical, summing to 1);
 *   4. CLEAR + SAVE writes NO `primitives` key anywhere — the S5 round-trip
 *      guarantee, exercised through the real save path;
 *   5. selecting a stored profile REPOPULATES the sliders (round-trip in);
 *   6. export → import of a mix profile is byte-identical;
 *   7. every mixer control is reachable at 390 and 1440 (nothing is stacked on
 *      it, nothing overflows the panel).
 *
 * Usage:
 *   NODE_PATH=<dir with playwright-core> node scripts/primitive-mixer-probe.cjs
 *   ... [--json=<path>]
 * Exit: 0 = every check passed, 1 = a check failed (or the probe crashed).
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const JSON_OUT = (process.argv.find((a) => a.startsWith('--json=')) || '').split('=')[1] || '';
const STORAGE_KEY = 'www-paint.styleProfiles.v1';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.wasm': 'application/wasm',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
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

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? `  — ${detail}` : ''}`);
};

/* Runs INSIDE the page: open the library panel and mount the mixer. */
const OPEN_LIBRARY = () => {
  const app = window.__app;
  if (!app) return { error: 'window.__app missing' };
  // Clicking the real nav button exercises the shim's toggle.
  const btn = document.getElementById('btn-library-mode');
  if (btn && !btn.classList.contains('nav-btn--active')) btn.click();
  return { ok: true };
};

/* Runs INSIDE the page: report the mixer's shape + control geometry. */
const MEASURE = (panelId) => {
  const panel = document.getElementById(panelId);
  const section = document.getElementById('primitive-mixer');
  if (!panel || !section) return { missing: !panel ? 'panel' : 'section' };
  const pr = panel.getBoundingClientRect();
  const sliders = [...section.querySelectorAll('input.mixer-range')];
  const controls = [...section.querySelectorAll('button,input,select,textarea,a[href]')]
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
      const centreInPanel = cx >= pr.left - 0.5 && cx <= pr.right + 0.5 && cy >= pr.top - 0.5 && cy <= pr.bottom + 0.5;
      return {
        label: (el.getAttribute('aria-label') || el.id || '').slice(0, 32),
        h: +r.height.toFixed(1),
        underMin: r.height < 43.5 && el.type !== 'range' ? true : false,
        rangeH: el.type === 'range' ? +r.height.toFixed(1) : null,
        belowFold: !centreInPanel,
        unreachable: centreInPanel && !selfHit,
      };
    });
  // The shell's global `.slider-row` collapses to a ~10px band (its input
  // overhangs via negative margins). If the mixer does not restore the row
  // height, the six labelled rows PILE UP and every label overlaps the next —
  // invisible to an a11y-tree assertion, so measure the geometry directly.
  const rows = [...section.querySelectorAll('.mixer-slider-row')].map((el) => {
    const r = el.getBoundingClientRect();
    return {
      t: +r.top.toFixed(1),
      b: +r.bottom.toFixed(1),
      h: +r.height.toFixed(1),
      // The real defect is CONTENT overflowing the row box: a collapsed 10px
      // row whose label + 44px input spill over the next row. scrollHeight -
      // clientHeight exposes it; the row boxes themselves never intersect.
      contentOverflow: Math.max(0, el.scrollHeight - el.clientHeight),
    };
  });
  let rowOverlap = 0;
  for (let i = 1; i < rows.length; i++) if (rows[i].t < rows[i - 1].b - 1) rowOverlap++;
  const level = document.getElementById('primitive-level');
  return {
    sectionCount: document.querySelectorAll('#primitive-mixer').length,
    sliders: sliders.length,
    rows,
    rowOverlap,
    sliderMeta: sliders.map((s) => ({ min: s.min, max: s.max, step: s.step, aria: s.getAttribute('aria-label') })),
    controls,
    levelOptions: level ? [...level.options].map((o) => ({ v: o.value, disabled: o.disabled })) : [],
    readout: (document.getElementById('primitive-readout') || {}).textContent || '',
    panelPos: getComputedStyle(panel).position,
    panel: { l: +pr.left.toFixed(1), r: +pr.right.toFixed(1), w: +pr.width.toFixed(1) },
  };
};

/* Runs INSIDE the page: set a slider like a user (value + `input` event). */
const SET_WEIGHT = (arg) => {
  const [id, value] = arg;
  const input = document.getElementById('primitive-weight-' + id);
  if (!input) return { error: 'no slider for ' + id };
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return { ok: true };
};

(async () => {
  const { server, port } = await startServer();
  const base = `http://127.0.0.1:${port}/index.html`;
  const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const out = { url: base, at: new Date().toISOString(), widths: {} };
  let failed = 0;
  const fail = (n, ok, d) => { record(n, ok, d); if (!ok) failed++; };

  // ── Geometry + mount at both ends ───────────────────────────────────────
  for (const [W, H] of [[1440, 900], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForTimeout(1000);
    await page.evaluate(OPEN_LIBRARY);
    await page.waitForTimeout(700);
    // Self-test hook: `PMX_BROKEN_ROW=1` re-collapses the mixer rows at runtime,
    // reproducing the pre-fix bug, so the "no pile-up" guard can be shown to
    // FAIL on the broken layout and PASS on the fix (guards verified both ways).
    if (process.env.PMX_BROKEN_ROW === '1') {
      await page.addStyleTag({ content: '.primitive-mixer .mixer-slider-row{height:10px !important;min-height:0 !important}' });
      await page.waitForTimeout(60);
    }
    const m = await page.evaluate(MEASURE, 'style-library-root');
    out.widths[`${W}x${H}`] = m;

    fail(`${W}px: mixer section mounted once inside the Style panel`, m.sectionCount === 1 && m.sliders === 6, `sections=${m.sectionCount} sliders=${m.sliders}`);
    fail(`${W}px: six sliders are 0..1 step 0.05`, m.sliderMeta && m.sliderMeta.length === 6 && m.sliderMeta.every((s) => s.min === '0' && s.max === '1' && s.step === '0.05'), JSON.stringify(m.sliderMeta && m.sliderMeta[0]));
    fail(`${W}px: level picker offers global/layer/pass`, m.levelOptions && m.levelOptions.map((o) => o.v).join(',') === 'global,layer,pass', JSON.stringify(m.levelOptions));
    const unreachable = (m.controls || []).filter((c) => c.unreachable);
    const under = (m.controls || []).filter((c) => c.underMin);
    fail(`${W}px: no mixer control is stacked on / unreachable`, unreachable.length === 0, unreachable.map((c) => c.label).join(', '));
    fail(`${W}px: every non-range mixer control is >= 44px`, under.length === 0, under.map((c) => `${c.label} ${c.h}px`).join(', '));
    const rangeHeights = (m.controls || []).filter((c) => c.rangeH !== null).map((c) => c.rangeH);
    fail(`${W}px: slider targets are >= 44px`, rangeHeights.length > 0 && rangeHeights.every((h) => h >= 43.5), rangeHeights.join(', '));
    const badRows = (m.rows || []).filter((r) => r.h < 44 || r.contentOverflow > 1);
    fail(`${W}px: six slider rows each keep their own height (no content pile-up)`,
      (m.rows || []).length === 6 && badRows.length === 0 && m.rowOverlap === 0,
      `rows=${(m.rows || []).length} overlap=${m.rowOverlap} heights=${(m.rows || []).map((r) => r.h).join(',')} overflow=${(m.rows || []).map((r) => r.contentOverflow).join(',')}`);

    if (W === 1440) {
      await page.screenshot({ path: path.join(ROOT, 'docs', 'research', 'primitive-mixer.png') }).catch(() => {});

      // ── Drive a mix ────────────────────────────────────────────────────
      // Fresh profile: layer/pass have no targets, so they must be DISABLED.
      const disabled = m.levelOptions.filter((o) => o.v !== 'global').every((o) => o.disabled);
      fail('1440px: layer/pass levels are disabled on a profile with no layers/passes', disabled, JSON.stringify(m.levelOptions));

      await page.evaluate(SET_WEIGHT, ['wet-wash', 0.75]);
      await page.evaluate(SET_WEIGHT, ['hatch', 0.25]);
      await page.waitForTimeout(120);
      const readout = await page.evaluate(() => document.getElementById('primitive-readout').textContent);
      fail('moving sliders updates the read-out with canonical weights + effectiveStyle',
        readout.includes('Wet wash 75%') && readout.includes('Hatch 25%') && readout.includes('wash'), readout);
      out.readoutAfterMix = readout;

      // Evidence: scroll the panel to the mixer and capture it with a live mix.
      await page.evaluate(() => document.getElementById('primitive-mixer').scrollIntoView({ block: 'start' }));
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(ROOT, 'docs', 'research', 'primitive-mixer-section.png') }).catch(() => {});

      // ── Save: the mix lands in global.primitives, canonical ─────────────
      await page.fill('#library-name-input', 'Mixer Probe');
      await page.click('#library-save-btn');
      await page.waitForTimeout(300);
      const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), STORAGE_KEY);
      const mixed = stored.find((e) => e.profile && e.profile.name === 'Mixer Probe');
      out.savedMix = mixed ? mixed.profile.global.primitives : null;
      fail('SAVE writes global.primitives canonical (wet-wash .75 / hatch .25)',
        !!mixed && JSON.stringify(mixed.profile.global.primitives) === JSON.stringify({ 'wet-wash': 0.75, hatch: 0.25 }),
        JSON.stringify(out.savedMix));

      // ── Clear + save: NO primitives key invented anywhere ───────────────
      await page.click('#primitive-clear');
      await page.fill('#library-name-input', 'No Mix Probe');
      await page.click('#library-save-btn');
      await page.waitForTimeout(300);
      const stored2 = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), STORAGE_KEY);
      const noMix = stored2.find((e) => e.profile && e.profile.name === 'No Mix Probe');
      const json = noMix ? JSON.stringify(noMix.profile) : '';
      fail('CLEAR + SAVE writes no `primitives` key anywhere (round-trip-safe)',
        !!noMix && !json.includes('primitives'), json.slice(0, 120));

      // ── Select the mix profile: sliders repopulate ──────────────────────
      await page.evaluate(() => {
        const rows = [...document.querySelectorAll('.library-row')];
        const row = rows.find((r) => (r.textContent || '').includes('Mixer Probe'));
        if (row) row.querySelector('.library-row__select').click();
      });
      await page.waitForTimeout(200);
      const back = await page.evaluate(() => ({
        wet: document.getElementById('primitive-weight-wet-wash').value,
        hatch: document.getElementById('primitive-weight-hatch').value,
        readout: document.getElementById('primitive-readout').textContent,
      }));
      out.reloaded = back;
      fail('selecting a stored mix profile repopulates the sliders',
        Number(back.wet) === 0.75 && Number(back.hatch) === 0.25 && back.readout.includes('Wet wash 75%'),
        JSON.stringify(back));

      // ── Export → import round-trip ──────────────────────────────────────
      // Two distinct claims, both real:
      //   (a) the export TEXT parses back to a profile byte-identical to what
      //       was exported (the module-level round-trip `profileFromExportText`
      //       performs — the M10 contract);
      //   (b) a library IMPORT re-saves the profile (which re-stamps
      //       provenance.updatedAt by design) but PRESERVES the mix exactly.
      const rt = await page.evaluate(async () => {
        const core = await import('./js/ui/style-library-core.js');
        const panel = window.__app.library;
        const row = panel.library.list().find((r) => r.name === 'Mixer Probe');
        if (!row) return { error: 'no stored mix profile' };
        const text = panel.library.exportText(row.id);
        const report = core.profileFromExportText(text);
        const identical = JSON.stringify(report.profile) === JSON.stringify(JSON.parse(text));
        const res = panel.library.importText(text);
        const after = JSON.parse(panel.library.exportText(row.id));
        const strip = (o) => { const c = JSON.parse(JSON.stringify(o)); if (c.provenance) delete c.provenance.updatedAt; return JSON.stringify(c); };
        return {
          parseOk: report.ok,
          identical,
          importOk: res.every((r) => r.ok),
          mixPreserved: strip(after) === strip(JSON.parse(text)),
          primitives: after.global.primitives,
        };
      });
      out.roundTrip = rt;
      fail('export parses back byte-identically (module round-trip)',
        rt.parseOk && rt.identical, JSON.stringify(rt));
      fail('library import preserves the mix exactly',
        rt.importOk && rt.mixPreserved && JSON.stringify(rt.primitives) === JSON.stringify({ 'wet-wash': 0.75, hatch: 0.25 }),
        JSON.stringify(rt));
    }

    await page.close();
  }

  await browser.close();
  server.close();

  out.passed = results.filter((r) => r.ok).length;
  out.failed = failed;
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 2));

  console.log(`\n=== primitive-mixer probe: ${out.passed} passed / ${failed} failed ===`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error('probe crashed:', err);
  process.exit(1);
});
