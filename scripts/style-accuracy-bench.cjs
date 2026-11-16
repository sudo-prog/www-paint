#!/usr/bin/env node
/**
 * Bench (Track-S **S10**): the style-accuracy eval suite.
 *
 * Track S measures *style match to the references* rather than content
 * reconstruction. S1–S9 each added a piece of that measurement; **S10 is the
 * GATE**: a FIXED (content × reference-set) matrix whose numbers are PINNED, so a
 * change that moves Style-Match cannot land unnoticed. It is the exit gate for
 * S1–S8 and the companion of the visual-regression harness — that one pins
 * *pixels*, this one pins *style*.
 *
 * THE CONSTRUCTION (this is what makes it a style measurement, not a content one)
 *   A reference packet analysed from a render on DIFFERENT content is dominated
 *   by the content mismatch — comparing across contents measures "is this the
 *   same picture", not "is this the same stroke language". So the references are
 *   rendered **on the same content** as the candidate:
 *
 *   - **content-set** — deterministic, self-contained procedural images
 *     (`blobs` / `rings` / `stripes`);
 *   - **ref-set** — for each content c, the 9 pinned registry styles rendered on
 *     c through the real `PaintingEngine` (fixed seed, 700 strokes), analysed
 *     with the Track-S S1 analyser → `refsPerContent[c][s]`;
 *   - **cell** `(c, t, s)` — a fixed-cost profile for style `t`
 *     (`{ global: { style: t, strokeCount, detailLevel } }`) rendered on content
 *     `c` and scored with `scoreProfileStyle(profile, c, refsPerContent[c][s])`.
 *
 *   Within a content block the content is held constant, so `(c, t, s)` varies
 *   the stroke language and nothing else. The DIAGONAL `t === s` is the claim
 *   worth measuring: does a render in style `t` match style `t`'s reference
 *   better than any other style's does?
 *
 * WHAT IT ASSERTS
 *   - every `styleMatch` is in `[0, 1]`;
 *   - the score is DETERMINISTIC (the same cell measured twice is bit-equal);
 *   - every cell ran at the SAME stroke cost (a fidelity win bought with more
 *     strokes is not a style win);
 *   - the matrix is complete (contents × styles × styles);
 *   - **vs the pinned baseline**: no cell moved by more than `--tol` — that is
 *     "a Style-Match regression fails the suite".
 *
 * WHAT IT DOES NOT CLAIM
 *   - It does NOT assert that the diagonal always wins. The per-(content, style)
 *     `ownIsBest` count and margins are REPORTED and pinned, never asserted as a
 *     threshold: whether the metric separates styles is exactly what S2 §6 /
 *     H-S5 said must be *measured*, not assumed. If a style's own reference does
 *     not win, the suite says so by name instead of hiding it.
 *
 * Usage
 *   NODE_PATH=<dir with playwright-core> node scripts/style-accuracy-bench.cjs            # verify vs baseline (writes nothing)
 *   NODE_PATH=<dir with playwright-core> node scripts/style-accuracy-bench.cjs --update   # (re)pin the baseline deliberately
 *   ... --tol=0.001   --json=<path>   --baseline=<path>
 *   ... --replay=<record.json>   # re-run ONLY the gate over a recorded matrix (no browser, no NODE_PATH)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_DIR = path.join(ROOT, 'docs', 'research', 'style-accuracy');
const DEFAULT_BASELINE = path.join(DEFAULT_DIR, 'baseline.json');

/** The ref-set: the 9 pinned registry styles (same list the visual harness pins). */
const STYLES = ['pencil', 'ink', 'watercolor', 'oil', 'charcoal', 'marker', 'cross-hatch', 'halftone', 'graphic'];
/** The content-set (self-contained procedural images). */
const CONTENTS = ['blobs', 'rings', 'stripes'];
/** Everything below is FIXED so the matrix is comparable run to run. */
const SEED = 3047602159;
const STROKE_COUNT = 200;   // fixed cost for the candidate render — see the "no fidelity win" note
const REF_STROKES = 700;    // the reference renders on each content
const SIZE = 256;
const BASELINE_VERSION = 1;

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

const PAGE_FN = async ({ styles, contents, seed, count, refStrokes, size }) => {
  const { PaintingEngine } = await import('/js/engine/engine.js');
  const { analyzeReference } = await import('/js/engine/ref-analyze.js');
  const { scoreProfileStyle } = await import('/js/engine/score.js');

  const canvasOf = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  };

  // ── content-set: deterministic procedural images (self-contained) ─────────
  const buildContent = (name) => {
    const c = canvasOf(size, size);
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, '#2b3a55'); g.addColorStop(0.5, '#7d9d9c'); g.addColorStop(1, '#e8ded1');
    x.fillStyle = g; x.fillRect(0, 0, size, size);

    if (name === 'blobs') {
      const pal = ['#d94f4f', '#e0a63c', '#4f8ed9', '#5bbf7a', '#8a5bd9'];
      for (let i = 0; i < pal.length; i++) {
        x.beginPath();
        x.fillStyle = pal[i];
        x.arc(size * (0.18 + 0.16 * i), size * (0.30 + 0.10 * Math.sin(i * 1.7)),
          size * (0.07 + 0.02 * i), 0, Math.PI * 2);
        x.fill();
      }
      x.fillStyle = '#1c1c24';
      x.fillRect(size * 0.10, size * 0.70, size * 0.32, size * 0.18);
    } else if (name === 'rings') {
      for (let i = 12; i > 0; i--) {
        x.beginPath();
        x.strokeStyle = (i % 2) ? '#1c1c24' : '#f4f1ea';
        x.lineWidth = size / 26;
        x.arc(size / 2, size / 2, (i / 12) * (size * 0.46), 0, Math.PI * 2);
        x.stroke();
      }
    } else { // stripes
      x.save();
      x.translate(size / 2, size / 2); x.rotate(Math.PI / 4); x.translate(-size / 2, -size / 2);
      for (let i = -size; i < size * 2; i += 16) {
        x.fillStyle = (((i / 16) | 0) % 2) ? '#1c1c24' : '#f4f1ea';
        x.fillRect(i, -size, 8, size * 3);
      }
      x.restore();
      x.fillStyle = 'rgba(217,79,79,0.85)';
      x.fillRect(size * 0.55, size * 0.55, size * 0.30, size * 0.30);
    }
    return c;
  };

  /**
   * Render `style` ON `srcCanvas` through the real engine (the app path), then
   * read the pixels back. This is what makes the reference and the candidate
   * share their content, so the score varies the stroke language only.
   */
  const renderOnContent = async (style, srcCanvas, strokes) => {
    const canvas = canvasOf(size, size);
    const engine = new PaintingEngine({ canvas, width: size, height: size, useWorker: false, background: '#ffffff' });
    await engine.loadImage(srcCanvas);
    await engine.generate({ style, count: strokes, seed, multiLayer: false });
    engine.render();
    const px = canvas.getContext('2d').getImageData(0, 0, size, size);
    const out = { pixels: px.data, width: size, height: size, strokes: engine.getTotalStrokes() };
    engine.destroy();
    return out;
  };

  const contentCanvases = {};
  for (const name of contents) contentCanvases[name] = buildContent(name);

  // ── ref-set PER CONTENT: style s rendered on content c, analysed ──────────
  const refsPerContent = {};
  const refStrokesSeen = {};
  for (const content of contents) {
    refsPerContent[content] = {};
    for (const s of styles) {
      const px = await renderOnContent(s, contentCanvases[content], refStrokes);
      if (px.strokes !== refStrokes) throw new Error(`reference ${content}/${s} rendered ${px.strokes} strokes, expected ${refStrokes}`);
      refsPerContent[content][s] = analyzeReference({ pixels: px.pixels, width: px.width, height: px.height });
      refStrokesSeen[`${content}|${s}`] = px.strokes;
    }
  }

  // ── the matrix: content × candidate-style × reference-style ───────────────
  const cells = [];
  const blocks = [];
  for (const content of contents) {
    const cImg = { pixels: contentCanvases[content].getContext('2d').getImageData(0, 0, size, size).data, width: size, height: size };
    const matrix = []; // rows = candidate style, cols = reference style
    for (const t of styles) {
      const row = [];
      for (const s of styles) {
        const r = scoreProfileStyle(
          { global: { style: t, strokeCount: count, detailLevel: 0.7 } },
          cImg, refsPerContent[content][s], { seed: 11 },
        );
        const cell = {
          content, candidate: t, reference: s,
          styleMatch: +r.styleMatch.toFixed(6),
          styleDistance: +r.styleDistance.toFixed(6),
          strokes: r.strokes,
          parts: {
            scale: +r.styleParts.scale.toFixed(6),
            orientation: +r.styleParts.orientation.toFixed(6),
            coverage: +r.styleParts.coverage.toFixed(6),
            bandScale: +r.styleParts.bandScale.toFixed(6),
            coherence: +r.styleParts.coherence.toFixed(6),
          },
        };
        row.push(cell);
        cells.push(cell);
      }
      matrix.push({ candidate: t, cells: row });
    }
    blocks.push({ content, matrix });
  }

  // ── discrimination: within a content block, does the DIAGONAL win? ────────
  // Reported + pinned, NEVER asserted as a threshold (see the header).
  const discrimination = [];
  for (const b of blocks) {
    for (const row of b.matrix) {
      const own = row.cells.find((c) => c.reference === row.candidate);
      let bestOther = -Infinity, bestOtherStyle = null;
      for (const c of row.cells) {
        if (c.reference === row.candidate) continue;
        if (c.styleMatch > bestOther) { bestOther = c.styleMatch; bestOtherStyle = c.reference; }
      }
      discrimination.push({
        content: b.content, candidate: row.candidate,
        own: own.styleMatch, bestOther: +bestOther.toFixed(6), bestOtherStyle,
        margin: +(own.styleMatch - bestOther).toFixed(6),
        ownIsBest: own.styleMatch > bestOther,
      });
    }
  }
  const ownIsBestCount = discrimination.filter((d) => d.ownIsBest).length;

  // ── determinism: measure one cell TWICE and require a bit-equal score ─────
  const detProfile = { global: { style: styles[0], strokeCount: count, detailLevel: 0.7 } };
  const detImg = { pixels: contentCanvases[contents[0]].getContext('2d').getImageData(0, 0, size, size).data, width: size, height: size };
  const q1 = scoreProfileStyle(detProfile, detImg, refsPerContent[contents[0]][styles[0]], { seed: 11 });
  const q2 = scoreProfileStyle(detProfile, detImg, refsPerContent[contents[0]][styles[0]], { seed: 11 });
  const deterministic = q1.styleMatch === q2.styleMatch
    && q1.styleDistance === q2.styleDistance
    && Math.abs(q1.styleMatch - cells[0].styleMatch) < 1e-6;

  return {
    styles, contents, seed, strokeCount: count, refStrokes, size,
    refStrokesSeen,
    cells,
    discrimination,
    ownIsBestCount,
    deterministic,
    equalCost: cells.every((c) => c.strokes === count),
    range: {
      min: +Math.min(...cells.map((c) => c.styleMatch)).toFixed(6),
      max: +Math.max(...cells.map((c) => c.styleMatch)).toFixed(6),
    },
    pageErrors: [],
  };
};

function parseArgs(argv) {
  // A GATE must not dirty the tree: by default the run writes nothing and only
  // verifies. `--update` writes the baseline; `--json=<path>` additionally dumps
  // a run record (evidence), which is the only way a matrix.json is produced.
  const out = { update: false, tol: 1e-9, json: null, baseline: DEFAULT_BASELINE, replay: null };
  for (const a of argv.slice(2)) {
    if (a === '--update') out.update = true;
    else if (a.startsWith('--tol=')) out.tol = Number(a.slice(6));
    else if (a.startsWith('--json=')) out.json = a.slice(7);
    else if (a.startsWith('--baseline=')) out.baseline = a.slice(11);
    else if (a.startsWith('--replay=')) out.replay = a.slice(9);
  }
  return out;
}

function keyOf(cell) { return `${cell.content}|${cell.candidate}|${cell.reference}`; }

function printMatrix(r) {
  const pad = (s, n) => String(s).padEnd(n);
  for (const content of r.contents) {
    console.log(`\n== Style-Match matrix — content "${content}" (rows candidate style, cols reference style) ==`);
    console.log(pad('cand \\ ref', 12) + r.styles.map((s) => pad(s.slice(0, 9), 10)).join(''));
    for (const t of r.styles) {
      const cellsOf = r.cells.filter((c) => c.content === content && c.candidate === t);
      console.log(pad(t.slice(0, 11), 12) + cellsOf.map((c) => {
        const v = c.styleMatch.toFixed(4);
        return pad(c.reference === t ? `[${v}]` : v, 10);
      }).join(''));
    }
  }
  console.log(`\n== discrimination: does a style's OWN reference win? (${r.ownIsBestCount}/${r.discrimination.length} rows) ==`);
  for (const d of r.discrimination) {
    console.log('  ' + pad(`${d.content}/${d.candidate}`, 24) + 'own ' + d.own.toFixed(4)
      + '  bestOther ' + d.bestOther.toFixed(4) + ' (' + d.bestOtherStyle + ')'
      + '  margin ' + (d.margin >= 0 ? '+' : '') + d.margin.toFixed(4)
      + (d.ownIsBest ? '  WIN' : '  LOSS'));
  }
}

async function main() {
  const args = parseArgs(process.argv);
  let r;

  if (args.replay) {
    // Re-run ONLY the gate over a RECORDED matrix — no browser, milliseconds.
    // This is what makes the guard verifiable BOTH ways on any machine: replay
    // the good record → PASS; replay a perturbed copy → FAIL naming the cell.
    if (!fs.existsSync(args.replay)) { console.error('no such replay file: ' + args.replay); process.exit(2); }
    r = JSON.parse(fs.readFileSync(args.replay, 'utf8'));
    console.log(`(replay) loaded ${path.relative(ROOT, args.replay)} — no browser launched`);
  } else {
    // `playwright-core` is required LAZILY so `--replay` (and this module's
    // import) works on a machine with no browser and no NODE_PATH.
    const { chromium } = require('playwright-core');
    const exe = findChromium();
    if (!exe) { console.error('harness failure: no Chromium'); process.exit(2); }

    const { server, port } = await startServer();
    const browser = await chromium.launch({
      headless: true, executablePath: exe,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (/Failed to load resource/.test(t)) return;
      pageErrors.push(t);
    });

    await page.goto(`http://127.0.0.1:${port}/tests/visual/regression.html`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.harnessReady === true, { timeout: 20000 });
    r = await page.evaluate(PAGE_FN, {
      styles: STYLES, contents: CONTENTS, seed: SEED, count: STROKE_COUNT, refStrokes: REF_STROKES, size: SIZE,
    });
    r.pageErrors = pageErrors.slice(0, 5);

    await browser.close();
    server.close();
  }

  const generatedAt = new Date().toISOString();
  const record = { version: BASELINE_VERSION, generatedAt, tolerance: args.tol, ...r };
  if (args.json) {
    fs.mkdirSync(path.dirname(args.json), { recursive: true });
    fs.writeFileSync(args.json, JSON.stringify(record, null, 2) + '\n');
  }
  printMatrix(r);
  if (args.json) console.log(`\nJSON: ${path.relative(ROOT, args.json)}`);

  const fail = (m) => { console.error('FAIL: ' + m); process.exit(1); };

  const pageErrs = r.pageErrors || [];
  if (pageErrs.length) fail('page errors: ' + pageErrs.slice(0, 3).join(' | '));
  if (!r.deterministic) fail('the style score is not deterministic (one cell re-measured differed)');
  if (!r.equalCost) fail('cells were not measured at equal stroke cost');
  for (const c of r.cells) {
    if (!(c.styleMatch >= 0 && c.styleMatch <= 1)) fail(`styleMatch out of range for ${keyOf(c)}: ${c.styleMatch}`);
  }
  const expected = r.styles.length * r.styles.length * r.contents.length;
  if (r.cells.length !== expected) fail(`matrix is incomplete: ${r.cells.length} cells, expected ${expected}`);

  console.log(`\nNOTE (reported, not asserted): a style's own reference is the best match in `
    + `${r.ownIsBestCount}/${r.discrimination.length} (content, style) rows. Read this against `
    + `docs/checkpoints/S2.md §6 / H-S5 — the magnitude is what S10 measures, not assumes.`);

  if (args.update) {
    fs.mkdirSync(path.dirname(args.baseline), { recursive: true });
    fs.writeFileSync(args.baseline, JSON.stringify(record, null, 2) + '\n');
    console.log(`\nPASS (--update): baseline (re)pinned -> ${path.relative(ROOT, args.baseline)}`);
    console.log(`  ${r.cells.length} cells, styleMatch range ${r.range.min}..${r.range.max}, tolerance ${args.tol}`);
    process.exit(0);
  }

  if (!fs.existsSync(args.baseline)) {
    fail(`no baseline at ${path.relative(ROOT, args.baseline)} — run with --update to pin it deliberately`);
  }
  const base = JSON.parse(fs.readFileSync(args.baseline, 'utf8'));
  if (base.version !== BASELINE_VERSION) {
    fail(`baseline version ${base.version} != ${BASELINE_VERSION} — re-pin deliberately with --update`);
  }
  const pinByKey = new Map(base.cells.map((c) => [keyOf(c), c]));
  const tol = Math.abs(args.tol);
  let worst = { key: null, delta: 0 };
  const drifted = [];
  for (const c of r.cells) {
    const p = pinByKey.get(keyOf(c));
    if (!p) { drifted.push({ key: keyOf(c), delta: NaN, reason: 'missing from baseline' }); continue; }
    const delta = c.styleMatch - p.styleMatch;
    if (Math.abs(delta) > Math.abs(worst.delta)) worst = { key: keyOf(c), delta };
    if (Math.abs(delta) > tol) drifted.push({ key: keyOf(c), pinned: p.styleMatch, measured: c.styleMatch, delta });
  }

  if (drifted.length) {
    const first = drifted[0];
    fail(`${drifted.length} cell(s) moved by more than tolerance ${tol}; worst ${worst.key} Δ${worst.delta.toFixed(6)}. `
      + `First: ${JSON.stringify(first)}. A style-match regression must not land silently — investigate, then re-pin `
      + 'deliberately with --update only if the change is intended.');
  }
  console.log(`\nPASS: ${r.cells.length} cells agree with the pinned baseline (tolerance ${tol}); `
    + `worst |Δ| ${Math.abs(worst.delta).toExponential(2)} at ${worst.key}`);
  console.log('PASS: style-accuracy matrix holds — cost fixed, deterministic, and no cell regressed');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(2); });
