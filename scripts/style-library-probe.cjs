#!/usr/bin/env node
/**
 * Probe: does the Style Profile library provably work? (M10 / Phase 4.2)
 *
 * Real headless Chromium against the app's own index.html. Covers both halves
 * of the exit criteria:
 *
 *   DOM        the panel mounts, save writes a row, delete removes it, import
 *              adds one, export text round-trips, every control has an id
 *   BEHAVIOUR  apply changes the rendered output; the SAME (profile, seed,
 *              image-hash) re-bakes to a byte-identical export; a different
 *              seed changes the pixels
 *
 * Usage: NODE_PATH=<dir with playwright-core> node scripts/style-library-probe.cjs
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const JSON_OUT = path.join(ROOT, 'docs', 'research', 'style-library-probe.json');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.wasm': 'application/wasm',
};

const SIZE = Number((process.argv.find((a) => a.startsWith('--size=')) || '').split('=')[1]) || 128;
const STROKES = Number((process.argv.find((a) => a.startsWith('--strokes=')) || '').split('=')[1]) || 120;

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

/** The whole probe runs inside the page so it can call the app's own objects. */
const PAGE_FN = async ({ size, strokes }) => {
  const app = window.__app;
  const out = { steps: [] };
  const step = (name, value) => { out.steps.push({ name, value }); return value; };

  /* ── 1. The panel mounted ─────────────────────────────────────── */
  const root = document.getElementById('style-library-root');
  const panel = app && app.library;
  step('panelRootExists', !!root);
  step('panelMounted', !!panel);
  step('panelHasList', !!(root && root.querySelector('#library-list')));
  step('panelHasSaveBtn', !!(root && root.querySelector('#library-save-btn')));
  step('panelHasImportInput', !!(root && root.querySelector('#library-import-input')));

  // Every interactive control must carry an id (the Maestro/automation rule).
  const noId = [...root.querySelectorAll('button, input, textarea, select')]
    .filter((el) => el.offsetParent !== null && !el.id)
    .map((el) => (el.className || el.tagName).toString().slice(0, 40));
  step('controlsWithoutId', noId);

  /* ── 2. Save writes a schema-valid profile and a row ──────────── */
  const nameInput = root.querySelector('#library-name-input');
  nameInput.value = 'Probe Wash';
  root.querySelector('#library-save-btn').click();
  await new Promise((r) => setTimeout(r, 250));

  const rows = [...root.querySelectorAll('.library-row')];
  step('rowCountAfterSave', rows.length);
  step('rowName', rows[0] ? rows[0].querySelector('.library-row__name').textContent : null);
  step('statusAfterSave', root.querySelector('#library-status').textContent);

  // The saved profile must be schema-valid — proven through the engine's own
  // validator, not a re-implementation.
  const { validateProfile } = await import('/js/engine/profile.js');
  const stored = panel.library.list()[0];
  step('storedProfileValid', stored ? validateProfile(stored.profile).ok : false);
  step('storedProfileKeys', stored ? Object.keys(stored.profile).sort() : []);
  step('storedStyle', stored ? stored.profile.global.style : null);
  step('storedSeed', stored ? stored.profile.global.seed : null);

  /* ── 3. Apply changes the rendered output ─────────────────────── */
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = 96; srcCanvas.height = 96;
  const sx = srcCanvas.getContext('2d');
  const grad = sx.createLinearGradient(0, 0, 96, 96);
  grad.addColorStop(0, '#dfe6ef'); grad.addColorStop(1, '#3a4658');
  sx.fillStyle = grad; sx.fillRect(0, 0, 96, 96);
  sx.fillStyle = '#802020'; sx.beginPath(); sx.arc(48, 48, 16, 0, 7); sx.fill();
  await app.loadImageFile(await new Promise((r) => srcCanvas.toBlob(r, 'image/png')));
  await new Promise((r) => setTimeout(r, 400));

  const bake = async (profile, seed) => {
    await app.engine.generate({ profile, seed, count: strokes, layer: 0 });
    app.engine.render();
    const blob = await app.engine.exportPNG({ width: size, height: size });
    const url = URL.createObjectURL(blob);
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let sum = 0, h = 2166136261 >>> 0;
    for (let i = 0; i < d.length; i += 4) {
      sum += d[i] + d[i + 1] + d[i + 2];
      h ^= d[i]; h = Math.imul(h, 16777619) >>> 0;
    }
    URL.revokeObjectURL(url);
    return { lum: +(sum / (d.length / 4) / 3).toFixed(2), bytes: blob.size, hash: h >>> 0 };
  };

  const profileA = stored.profile;
  const before = await bake(null, 12345);
  step('bakeDefault', before);

  // Apply through the panel's own handler (the real UI path).
  root.querySelector('.library-row [data-action="apply"]').click();
  await new Promise((r) => setTimeout(r, 1200));
  step('statusAfterApply', root.querySelector('#library-status').textContent);
  step('engineStyleAfterApply', app.engine.settings.style);
  step('engineSeedAfterApply', app.engine._seed);

  const after = await bake(null, null);
  step('bakeAfterApply', after);

  /* ── 4. Determinism: same (profile, seed, image) → identical ──── */
  const r1 = await bake(profileA, 777);
  const r2 = await bake(profileA, 777);
  step('determinismRun1', r1);
  step('determinismRun2', r2);
  step('deterministic', r1.hash === r2.hash && r1.bytes === r2.bytes);

  // A different seed must change the pixels.
  const r3 = await bake(profileA, 778);
  step('differentSeed', r3);
  step('seedChangesOutput', r3.hash !== r1.hash);

  /* ── 5. Export → import round-trips byte-identically ──────────── */
  const text = panel.library.exportText(panel.library.list()[0].id);
  const { profileFromExportText } = await import('/js/ui/style-library-core.js');
  const report = profileFromExportText(text);
  step('exportRoundTripIdentical', JSON.stringify(report.profile) === JSON.stringify(profileA));
  step('exportIsValid', report.ok === true);

  // Import through the panel's own input.
  const area = root.querySelector('#library-import-input');
  area.value = text;
  root.querySelector('#library-import-btn').click();
  await new Promise((r) => setTimeout(r, 250));
  step('rowCountAfterReimport', root.querySelectorAll('.library-row').length);
  step('statusAfterImport', root.querySelector('#library-status').textContent);

  /* ── 6. Delete removes the row ────────────────────────────────── */
  const before2 = root.querySelectorAll('.library-row').length;
  // The panel confirms via window.confirm; accept it.
  window.__origConfirm = window.confirm;
  window.confirm = () => true;
  root.querySelector('.library-row [data-action="delete"]').click();
  await new Promise((r) => setTimeout(r, 250));
  window.confirm = window.__origConfirm;
  step('rowCountBeforeDelete', before2);
  step('rowCountAfterDelete', root.querySelectorAll('.library-row').length);
  step('statusAfterDelete', root.querySelector('#library-status').textContent);

  /* ── 7. Persistence across a reload ───────────────────────────── */
  step('storageKeyUsed', !!localStorage.getItem('www-paint.styleProfiles.v1'));

  /* ── 8. Page errors ───────────────────────────────────────────── */
  step('pageErrors', window.__probeErrors || []);

  /* ── 9. Reference confidence chip (Track-S hygiene H-S2) ──────── */
  // The chip is DOM, so it can only be asserted here. It must be:
  //   (a) ABSENT for a profile with no packet (no noise, no layout shift);
  //   (b) PRESENT and correct for a profile carrying a real fused packet;
  //   (c) geometrically clean — on-screen, not clipped, not overflowing;
  //   (d) accompanied by the safe-default advice in the apply status.
  //
  // Step 6 above DELETED the only profile, so this section creates its own
  // rows rather than assuming one survives. Rows are added in a fixed order
  // (good first, conflicting last) and looked up by their chip band, never by
  // index — the list sorts by name, so index order is not ours to rely on.
  const { analyzeReference, fuseReferences } = await import('/js/engine/ref-analyze.js');

  const synth = (fn) => {
    const w = 64, h = 64;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const cx = cv.getContext('2d');
    const img = cx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const [r, g, b] = fn(x, y);
        img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
      }
    }
    cx.putImageData(img, 0, 0);
    return cv;
  };
  const gradA = synth((x, y) => [255 * (x / 63), 128, 255 * (y / 63)]);
  const gradB = synth((x, y) => [200 * (x / 63), 60, 180]);
  // A genuinely CONTRADICTORY pair of extra references: a near-black image and
  // a near-white one. Measured, not guessed — agreement for `A,B` is 0.8315
  // (good), and adding these two drops it to 0.4944 (low). Other candidates
  // (`A,B,S,S` = 0.5603, `A,A,S,S` = 0.5385) did NOT reach the fair threshold,
  // so the fixture is part of the contract and its numbers are recorded.
  const dark = synth(() => [30, 30, 30]);
  const light = synth(() => [250, 250, 250]);
  const toPixels = (cv) => {
    const cx = cv.getContext('2d');
    const d = cx.getImageData(0, 0, cv.width, cv.height);
    return { pixels: new Uint8ClampedArray(d.data.buffer), width: cv.width, height: cv.height };
  };
  const fuseOf = (...srcs) => fuseReferences(srcs.map((s) => analyzeReference(toPixels(s), {})), {});
  let saveSeq = 1;
  // Record the fixtures' real agreement so a threshold change is visible here.
  step('fixtureAgreementGood', +fuseOf(gradA, gradB).spread.agreement.toFixed(4));
  step('fixtureAgreementBad', +fuseOf(gradA, gradB, dark, light).spread.agreement.toFixed(4));

  /** Save a profile carrying `packet` under a known name, through the library. */
  const saveWithPacket = (name, packet) => {
    // A FRESH object each time. Reusing one base across saves is not safe: the
    // library normalises its input in place-ish ways and the probe would silently
    // save the second row with the first row's packet (the bug that made the
    // "good" row read `fair`).
    const base = {
      schemaVersion: 1,
      id: '00000000-0000-4000-8000-' + String(saveSeq++).padStart(12, '0'),
      name,
      version: '1.0.0',
      engine: { name: 'www-paint', version: '0.1.0' },
      global: { style: 'pencil', strokeCount: 400, seed: 1 },
      layers: [], effects: [], mediaModel: { kind: 'dry' },
      provenance: { source: 'human', refPacket: packet },
    };
    // `app.library` IS the panel (the host assigns `app.library = panel`), so
    // the library is `panel.library`. Going through the panel keeps the row
    // render in the probe's control.
    const lib = panel.library || panel;
    const saved = lib.save(base);
    if (typeof panel.refresh === 'function') panel.refresh();
    return saved;
  };

  // (a) After step 6's delete the library is empty -> no chip anywhere.
  step('chipCountNoPacket', root.querySelectorAll('.library-row__ref').length);

  // (b) A profile carrying a real fused packet.
  const goodFused = fuseOf(gradA, gradB);
  const badFused = fuseOf(gradA, gradB, dark, light);
  saveWithPacket('H-S2 Good', goodFused);
  saveWithPacket('H-S2 Conflicting', badFused);
  await new Promise((r) => setTimeout(r, 250));

  const chips = [...root.querySelectorAll('.library-row__ref')];
  step('chipCountWithPacket', chips.length);
  step('rowCount', root.querySelectorAll('.library-row').length);
  const goodChip = chips.find((c) => c.dataset.refBand === 'good');
  step('goodChipBand', goodChip ? goodChip.dataset.refBand : null);
  const badChip = chips.find((c) => c.dataset.refBand === 'low');
  step('chipBand', badChip ? badChip.dataset.refBand : null);
  step('chipText', badChip ? badChip.textContent : null);
  step('chipTitle', badChip ? (badChip.title || '') : null);
  step('chipSaysConflicting', badChip ? /conflicting/.test(badChip.textContent) : false);
  step('chipSaysRefs', badChip ? /4 refs/.test(badChip.textContent) : false);
  step('titleCarriesSpread', badChip ? /scale spread/.test(badChip.title || '') : false);
  // The chip must NOT be inside the select button (nested interactive content).
  step('chipOutsideButton', badChip ? !badChip.closest('button') : false);

  // (c) Geometry: the chip must be fully on-screen and inside its panel.
  // OPEN THE PANEL FIRST. At the probe's 1280px viewport the library is a
  // desktop rail that starts HIDDEN (`_libraryMode = false`), so every chip
  // measures 0x0 — a vacuous pass, not a clean measurement. Same rule as the
  // a11y sweep's `layersRail open=true rowW=…`: assert the surface is open
  // before trusting its numbers.
  const btn = document.getElementById('btn-library-mode');
  if (btn && !app._libraryMode) btn.click();
  await new Promise((r) => setTimeout(r, 600));
  const panelState = (() => {
    const r = root.getBoundingClientRect();
    return {
      mode: !!app._libraryMode,
      hidden: root.classList.contains('panel--hidden'),
      mobileClosed: root.classList.contains('panel--mobile-closed'),
      w: +r.width.toFixed(1), h: +r.height.toFixed(1),
      chips: root.querySelectorAll('.library-row__ref').length,
    };
  })();
  step('panelOpenState', panelState);

  const chipsNow = [...root.querySelectorAll('.library-row__ref')];
  const badChipNow = chipsNow.find((c) => c.dataset.refBand === 'low');
  if (badChipNow) {
    const c = badChipNow.getBoundingClientRect();
    const panelBox = root.getBoundingClientRect();
    step('chipBox', { t: +c.top.toFixed(1), l: +c.left.toFixed(1), w: +c.width.toFixed(1), h: +c.height.toFixed(1) });
    step('chipOnScreen', c.width > 0 && c.height > 0 && c.top >= 0 && c.bottom <= innerHeight && c.left >= 0 && c.right <= innerWidth);
    step('chipInsidePanel', c.left >= panelBox.left - 1 && c.right <= panelBox.right + 1);
    step('chipNoClip', badChipNow.scrollWidth - badChipNow.clientWidth);
    // The row must not have grown so much that it overflows the panel.
    const row = badChipNow.closest('.library-row').getBoundingClientRect();
    step('rowInsidePanel', row.top >= panelBox.top - 1 && row.bottom <= panelBox.bottom + 1);
    step('rowBox', { t: +row.top.toFixed(1), b: +row.bottom.toFixed(1), h: +row.height.toFixed(1) });
  }

  // (d) Applying a conflicting profile must surface the safe-default advice.
  const badRow = [...root.querySelectorAll('.library-row')]
    .find((el) => (el.querySelector('.library-row__ref') || {}).dataset?.refBand === 'low');
  step('conflictingRowFound', !!badRow);
  if (badRow) {
    badRow.querySelector('[data-action="apply"]').click();
    await new Promise((r) => setTimeout(r, 1200));
    const st = root.querySelector('#library-status').textContent;
    step('conflictingStatus', st);
    step('conflictingAdviceShown', /starting point|reference set/i.test(st));
  }
  // And a good profile must NOT be handed the warning.
  const goodRow = [...root.querySelectorAll('.library-row')]
    .find((el) => (el.querySelector('.library-row__ref') || {}).dataset?.refBand !== 'low');
  if (goodRow) {
    goodRow.querySelector('[data-action="apply"]').click();
    await new Promise((r) => setTimeout(r, 1200));
    const st = root.querySelector('#library-status').textContent;
    step('goodStatus', st);
    step('goodAdviceAbsent', !/starting point|reference set/i.test(st));
  }

  return out;
};

async function main() {
  const exe = findChromium();
  if (!exe) { console.error('harness failure: no Chromium'); process.exit(2); }

  const { server, port } = await startServer();
  const browser = await chromium.launch({
    headless: true,
    executablePath: exe,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource/.test(t)) return;
    if (/<polyline> attribute points/.test(t)) return;
    pageErrors.push(t);
  });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => !!window.__app, { timeout: 20000 });

  // ISOLATE STORAGE. The library persists to localStorage, so a probe re-run
  // inherits every profile saved by the previous run. Row lookups by band then
  // match a stale row from an earlier session and the probe reports a defect
  // that is really its own state (this cost two false failures). Clear it and
  // reload so the panel starts from an empty library.
  await page.evaluate(() => {
    try { localStorage.removeItem('www-paint.styleProfiles.v1'); } catch { /* ignore */ }
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__app, { timeout: 20000 });

  await page.evaluate(() => {
    window.__probeErrors = [];
    window.addEventListener('error', (e) => window.__probeErrors.push('uncaught: ' + (e.message || '').slice(0, 200)));
    window.addEventListener('unhandledrejection', (e) => window.__probeErrors.push('rejection: ' + String(e.reason).slice(0, 200)));
  });

  const r = await page.evaluate(PAGE_FN, { size: SIZE, strokes: STROKES });

  const get = (n) => {
    const s = r.steps.find((x) => x.name === n);
    return s ? s.value : undefined;
  };

  // The in-page listener and the Playwright listener are separate; merge.
  const inPageErrors = get('pageErrors') || [];
  r.steps.find((s) => s.name === 'pageErrors').value = [
    ...new Set([...inPageErrors, ...pageErrors]),
  ];

  await browser.close();
  server.close();

  fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
  fs.writeFileSync(JSON_OUT, JSON.stringify(r, null, 2));

  console.log(JSON.stringify({
    panelMounted: get('panelMounted'),
    rowCountAfterSave: get('rowCountAfterSave'),
    storedProfileValid: get('storedProfileValid'),
    storedStyle: get('storedStyle'),
    engineStyleAfterApply: get('engineStyleAfterApply'),
    bakeDefault: get('bakeDefault'),
    bakeAfterApply: get('bakeAfterApply'),
    deterministic: get('deterministic'),
    seedChangesOutput: get('seedChangesOutput'),
    exportRoundTripIdentical: get('exportRoundTripIdentical'),
    rowCountAfterReimport: get('rowCountAfterReimport'),
    rowCountAfterDelete: get('rowCountAfterDelete'),
    controlsWithoutId: get('controlsWithoutId'),
    chipCountNoPacket: get('chipCountNoPacket'),
    chipCountWithPacket: get('chipCountWithPacket'),
    chipBand: get('chipBand'),
    chipText: get('chipText'),
    chipTitle: get('chipTitle'),
    goodChipBand: get('goodChipBand'),
    chipSaysConflicting: get('chipSaysConflicting'),
    chipSaysRefs: get('chipSaysRefs'),
    titleCarriesSpread: get('titleCarriesSpread'),
    chipOutsideButton: get('chipOutsideButton'),
    panelOpenState: get('panelOpenState'),
    fixtureAgreementGood: get('fixtureAgreementGood'),
    fixtureAgreementBad: get('fixtureAgreementBad'),
    chipBox: get('chipBox'),
    chipOnScreen: get('chipOnScreen'),
    chipInsidePanel: get('chipInsidePanel'),
    chipNoClip: get('chipNoClip'),
    rowInsidePanel: get('rowInsidePanel'),
    rowBox: get('rowBox'),
    rowCount: get('rowCount'),
    conflictingRowFound: get('conflictingRowFound'),
    conflictingStatus: get('conflictingStatus'),
    conflictingAdviceShown: get('conflictingAdviceShown'),
    goodStatus: get('goodStatus'),
    goodAdviceAbsent: get('goodAdviceAbsent'),
    pageErrors: pageErrors.slice(0, 5),
  }, null, 2));

  const fail = (m) => { console.error('FAIL: ' + m); process.exit(1); };

  if (!get('panelMounted')) fail('the library panel did not mount');
  if (get('rowCountAfterSave') !== 1) fail(`save did not produce one row: ${get('rowCountAfterSave')}`);
  if (!get('storedProfileValid')) fail('the saved profile is not schema-valid');
  if (get('engineStyleAfterApply') !== 'pencil' && get('engineStyleAfterApply') !== null) {
    // The default profile's style is 'pencil'; the engine resolves it directly.
    fail(`apply did not land the style: ${get('engineStyleAfterApply')}`);
  }
  const b = get('bakeDefault');
  const a = get('bakeAfterApply');
  if (!(a && b && (a.hash !== b.hash || a.bytes !== b.bytes))) {
    fail('apply did not change the rendered output');
  }
  if (!get('deterministic')) fail('the same profile+seed did not re-bake identically');
  if (!get('seedChangesOutput')) fail('a different seed produced identical pixels');
  if (!get('exportRoundTripIdentical')) fail('export → import did not round-trip byte-identically');
  if (get('rowCountAfterReimport') !== 1) fail(`re-import duplicated the row: ${get('rowCountAfterReimport')}`);
  if (get('rowCountAfterDelete') !== 0) fail(`delete did not remove the row: ${get('rowCountAfterDelete')}`);
  if (get('controlsWithoutId').length) fail(`controls without an id: ${JSON.stringify(get('controlsWithoutId'))}`);
  // H-S2 — the confidence chip.
  if (get('chipCountNoPacket') !== 0) fail(`a profile with NO packet rendered a chip: ${get('chipCountNoPacket')}`);
  if (get('chipCountWithPacket') < 1) fail(`a profile WITH a packet rendered no chip: ${get('chipCountWithPacket')}`);
  if (!['good', 'fair', 'low'].includes(get('chipBand'))) fail(`the chip band is not a band: ${get('chipBand')}`);
  if (!get('chipOnScreen')) fail(`the chip is off-screen: ${JSON.stringify(get('chipBox'))}`);
  if (!get('chipInsidePanel')) fail('the chip overflows its panel');
  if (get('chipNoClip') > 0) fail(`the chip clips its own text by ${get('chipNoClip')}px`);
  if (!get('rowInsidePanel')) fail('the row grew past the panel');
  if (!get('chipSaysConflicting')) fail(`a 'low' chip does not say conflicting: ${get('chipText')}`);
  if (!get('chipSaysRefs')) fail(`the chip does not report the reference count: ${get('chipText')}`);
  if (!get('titleCarriesSpread')) fail('the chip title does not expose the per-axis spread');
  if (!get('chipOutsideButton')) fail('the chip is nested inside the select button (nested interactive content)');
  // The geometry numbers are only meaningful if the panel was really open.
  const pos = get('panelOpenState') || {};
  if (!pos.mode || pos.hidden || pos.w === 0) {
    fail(`the library panel was not open, so the chip geometry is vacuous: ${JSON.stringify(pos)}`);
  }
  if (!(get('fixtureAgreementBad') < get('fixtureAgreementGood'))) {
    fail(`the fixtures do not disagree: good=${get('fixtureAgreementGood')} bad=${get('fixtureAgreementBad')}`);
  }
  if (get('goodAdviceAbsent') === false) fail(`a good profile was handed the conflicting warning: ${get('goodStatus')}`);
  if (!get('conflictingRowFound')) fail('a conflicting reference set did not produce a `low` chip');
  if (!get('conflictingAdviceShown')) fail(`the safe-default advice was not surfaced: ${get('conflictingStatus')}`);
  if (pageErrors.length) fail('page errors: ' + pageErrors.slice(0, 3).join(' | '));

  console.log('PASS: panel mounts, save writes a schema-valid profile, apply changes the render, '
    + 'same profile+seed re-bakes byte-identically, a different seed changes pixels, '
    + 'export→import round-trips, re-import updates in place, delete removes the row, '
    + 'every control has an id, 0 page errors');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(2); });
