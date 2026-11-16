/**
 * Track-S S7 / Phase 6 — the bake + worker batch path, browser probe (BE).
 *
 * Verifies the automation path against a real Chromium and the REAL module
 * worker (`js/engine/worker.js`):
 *   1. re-bake guarantee — the same (profile, seed, image) exports a
 *      **bit-identical PNG** twice (fresh engine each run);
 *   2. the worker bakes a batch of N images, streaming progress + per-job
 *      results, and every job has its own reproducible digest;
 *   3. a `cancel` sent mid-batch stops the worker cleanly (completed < total).
 *
 * Exit 0 = every assertion passed.
 *
 * Run:
 *   NODE_PATH=<dir containing playwright-core> node scripts/bake-probe.cjs [--width=1440]
 *       [--json=docs/research/bake-probe.json] [--shot=docs/research/bake-probe.png]
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const argOf = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const WIDTH = parseInt(argOf('width', '1440'), 10);
const HEIGHT = parseInt(argOf('height', '900'), 10);
const JSON_OUT = argOf('json', path.join(ROOT, 'docs', 'research', 'bake-probe.json'));
const SHOT = argOf('shot', path.join(ROOT, 'docs', 'research', 'bake-probe.png'));

function findChromium() {
  const base = path.join(process.env.HOME || '', '.cache', 'ms-playwright');
  if (fs.existsSync(base)) {
    const dirs = fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort();
    for (const d of dirs.reverse()) {
      const exe = path.join(base, d, 'chrome-linux64', 'chrome');
      if (fs.existsSync(exe)) return exe;
    }
  }
  return process.env.CHROME_BINARY || undefined;
}

async function main() {
  const exe = findChromium();
  if (!exe) { console.error('FAIL: no Chromium found (set CHROME_BINARY)'); process.exit(2); }

  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    const file = path.join(ROOT, url === '/' ? '/index.html' : url);
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      const ext = path.extname(file);
      const type = ext === '.js' || ext === '.mjs' ? 'text/javascript' : ext === '.html' ? 'text/html'
        : ext === '.css' ? 'text/css' : ext === '.json' ? 'application/json' : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type });
      res.end(data);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  const consoleErrors = [];
  const notFound = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('response', (r) => { if (r.status() === 404) notFound.push(r.url()); });

  await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(async ({ origin }) => {
    const { PaintingEngine } = await import(`${origin}/js/engine/engine.js`);
    const bake = await import(`${origin}/js/engine/bake.js`);
    const S = 200;

    // Deterministic source: soft blobs + concentric rings.
    function makeSource(variant) {
      const src = document.createElement('canvas');
      src.width = S; src.height = S;
      const sctx = src.getContext('2d');
      const id = sctx.createImageData(S, S);
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = (y * S + x) * 4;
          let r = 235, g = 235, b = 232;
          const blobs = [[50, 60, 26, [40, 60, 120]], [140, 70, 20, [150, 60, 40]], [100, 140, 22, [40, 120, 70]]];
          const rings = [[100, 100, 46, [20, 20, 20]], [46, 142, 22, [90, 30, 90]]];
          for (const [cx, cy, rad, col] of blobs) {
            const d = Math.hypot(x - cx, y - cy) / rad;
            if (d < 1) { const k = Math.max(0, 1 - d) ** 1.6; r = r * (1 - k) + col[0] * k; g = g * (1 - k) + col[1] * k; b = b * (1 - k) + col[2] * k; }
          }
          for (const [cx, cy, rad, col] of rings) {
            const dd = Math.abs(Math.hypot(x - cx, y - cy) - rad);
            if (dd < 3.5) { const k = 1 - dd / 3.5; r = r * (1 - k) + col[0] * k; g = g * (1 - k) + col[1] * k; b = b * (1 - k) + col[2] * k; }
          }
          if (variant) r = Math.min(255, r + variant * 4);
          id.data[i] = r; id.data[i + 1] = g; id.data[i + 2] = b; id.data[i + 3] = 255;
        }
      }
      sctx.putImageData(id, 0, 0);
      return src;
    }

    const blobToB64 = (blob) => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(blob); });

    // ── 1. Re-bake guarantee: same (profile, seed, image) → bit-identical PNG.
    const PROFILE = { schemaVersion: 1, id: 'probe', name: 'probe', version: '1.0.0',
      global: { style: 'ink', strokeCount: 200, detailLevel: 0.7, opacity: 0.9, smart: true, seed: 4242 } };
    async function bakePng() {
      const canvas = document.createElement('canvas');
      canvas.width = S; canvas.height = S;
      const eng = new PaintingEngine({ canvas, width: S, height: S, background: '#ffffff', useWorker: false });
      await eng.loadImage(makeSource(0));
      await eng.generate({ profile: PROFILE, modular: true, style: 'ink', count: 200, seed: 4242 });
      const blob = await eng.exportPNG();
      return { b64: await blobToB64(blob), bytes: blob.size };
    }
    const run1 = await bakePng();
    const run2 = await bakePng();

    // ── 2. bake.js in-page determinism (the same core the worker runs).
    const img1 = (() => { const c = makeSource(0); const ctx = c.getContext('2d'); return { pixels: ctx.getImageData(0, 0, S, S).data, width: S, height: S }; })();
    const b1 = bake.bakeImage(PROFILE, img1, { seed: 11, score: false });
    const b2 = bake.bakeImage(PROFILE, img1, { seed: 11, score: false });

    // ── 3. The REAL module worker: batch + progress + per-job digests.
    const jobs = [0, 1, 2].map((v) => {
      const c = makeSource(v);
      const d = c.getContext('2d').getImageData(0, 0, S, S).data;
      return { id: v, pixels: new Uint8ClampedArray(d), width: S, height: S };
    });

    function runWorkerBatch(jobsIn, cancelAfter) {
      return new Promise((resolve, reject) => {
        const w = new Worker(`${origin}/js/engine/worker.js`, { type: 'module' });
        const progress = [];
        const results = [];
        let sentCancel = false;
        const timer = setTimeout(() => { w.terminate(); reject(new Error('worker timeout')); }, 60000);
        w.onmessage = (e) => {
          const m = e.data || {};
          if (m.type === 'progress') {
            progress.push(m.index);
            if (cancelAfter !== undefined && !sentCancel && m.index >= cancelAfter) {
              sentCancel = true;
              w.postMessage({ type: 'cancel', id: 1 });
            }
          } else if (m.type === 'result') {
            results.push({ jobId: m.jobId, digest: m.digest, count: m.count, score: m.score, imageHash: m.imageHash });
          } else if (m.type === 'complete') {
            clearTimeout(timer);
            w.terminate();
            resolve({ progress, results, complete: m });
          } else if (m.type === 'error') {
            clearTimeout(timer);
            w.terminate();
            reject(new Error(m.message));
          }
        };
        w.onerror = (err) => { clearTimeout(timer); w.terminate(); reject(new Error(String(err && err.message || err))); };
        w.postMessage({ type: 'bake', id: 1, profile: PROFILE, seed: 77, jobs: jobsIn });
      });
    }

    const batch = await runWorkerBatch(jobs);
    const cancelRun = await runWorkerBatch([0, 1, 2, 3, 4, 5].map((v) => {
      const c = makeSource(v);
      const d = c.getContext('2d').getImageData(0, 0, S, S).data;
      return { id: v, pixels: new Uint8ClampedArray(d), width: S, height: S };
    }), 0);

    const shotCanvas = makeSource(0);
    return {
      S,
      png: { identical: run1.b64 === run2.b64, bytes1: run1.bytes, bytes2: run2.bytes, head: run1.b64.slice(0, 30) },
      bakeCore: { digest1: b1.digest, digest2: b2.digest, sameDigest: b1.digest === b2.digest, count: b1.count, scoreType: typeof b1.score },
      batch: {
        progress: batch.progress,
        results: batch.results,
        complete: batch.complete,
        distinctDigests: new Set(batch.results.map((r) => r.digest)).size,
      },
      cancel: { complete: cancelRun.complete, results: cancelRun.results.length },
      shot: shotCanvas.toDataURL('image/png'),
    };
  }, { origin });

  await browser.close();
  server.close();

  fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
  fs.writeFileSync(JSON_OUT, JSON.stringify(result, null, 2) + '\n');
  if (result.shot) fs.writeFileSync(SHOT, Buffer.from(result.shot.replace(/^data:image\/png;base64,/, ''), 'base64'));

  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); else console.log(`  \u2713 ${msg}`); };
  console.log(`\n=== bake / worker batch probe @ ${WIDTH}x${HEIGHT} ===`);
  ok(result.png.identical, `same (profile, seed, image) ⇒ bit-identical PNG twice (${result.png.bytes1}B)`);
  ok(result.png.bytes1 > 1000, `the exported PNG is a real image (${result.png.bytes1} bytes)`);
  ok(result.bakeCore.sameDigest, `bake.js re-bake digest is stable (${result.bakeCore.digest1})`);
  ok(result.bakeCore.count > 0, `bake.js bakes shapes (${result.bakeCore.count})`);
  ok(result.batch.complete.completed === 3 && result.batch.results.length === 3, `worker batch completed 3/3`);
  ok(result.batch.complete.cancelled === false, `a full batch is not cancelled`);
  ok(result.batch.distinctDigests === 3, `each job carries its own digest (${result.batch.distinctDigests})`);
  ok(result.batch.progress[0] === -1 && result.batch.progress.length >= 4, `worker streams progress (${result.batch.progress.join(',')})`);
  ok(result.cancel.complete.cancelled === true, `a cancel mid-batch stops the worker (cancelled=${result.cancel.complete.cancelled})`);
  ok(result.cancel.complete.completed < 6, `the cancelled batch is short of the total (${result.cancel.complete.completed}/6)`);
  const realErrors = consoleErrors.filter((t) => !/status of 404/.test(t));
  ok(realErrors.length === 0, `0 non-404 console errors (got ${realErrors.length})`);
  ok(notFound.every((u) => /favicon\.ico/.test(u)), `every 404 is the favicon (${notFound.length})`);
  console.log(`  json: ${JSON_OUT}\n  shot: ${SHOT}`);
  if (fails.length) {
    console.log(`\nFAIL \u2014 ${fails.length} assertion(s):`);
    fails.forEach((f) => console.log('  \u2717 ' + f));
    consoleErrors.forEach((e) => console.log('    console-error: ' + e));
    process.exit(1);
  }
  console.log('\nPASS');
}

main().catch((e) => { console.error('probe crashed:', e); process.exit(2); });
