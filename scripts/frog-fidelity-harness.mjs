#!/usr/bin/env node
/**
 * frog-fidelity-harness.mjs — the overnight measurement harness for WWW_PAINT.
 *
 * PURPOSE
 * -------
 * Every algorithm change must be justified by a NUMBER, not an impression. This
 * harness renders the frog fixture through the REAL app path (PaintingEngine,
 * useWorker:true) under a set of configurations and reports, for each:
 *
 *   - shape count + type breakdown
 *   - mean per-stroke gradient distance (RGB distance between color0/color1)
 *   - inkPct / meanLum / colour buckets vs the SOURCE
 *   - STRUCTURAL correlation (r) and mean-abs-diff (MAD) vs the source, on a
 *     64x48 luminance grid  → this is the "is it still a frog?" metric
 *   - block SSIM on luminance (the repo's own independent metric)
 *
 * A configuration that looks nicer but scores WORSE on r/MAD/SSIM is a
 * regression, no matter how good it looks.
 *
 * USAGE
 *   node scripts/frog-fidelity-harness.mjs                    # default matrix
 *   node scripts/frog-fidelity-harness.mjs --json=<path>      # save results
 *   node scripts/frog-fidelity-harness.mjs --configs=<file>   # custom matrix
 *   node scripts/frog-fidelity-harness.mjs --only=<name>      # one config
 *   node scripts/frog-fidelity-harness.mjs --shots=<dir>      # also save PNGs
 *
 * NOTE: this is a READ-ONLY measurement instrument. It writes only the JSON
 * report and (optionally) PNGs to the paths you pass. It never edits source.
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = 512, H = 384;
const GW = 64, GH = 48;

const argOf = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.txt': 'text/plain',
};

function findChromium() {
  const base = path.join(process.env.HOME || '', '.cache', 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  const dirs = fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => parseInt(b.split('-')[1]) - parseInt(a.split('-')[1]));
  for (const d of dirs) {
    for (const sub of ['chrome-linux64', 'chrome-linux']) {
      const p = path.join(base, d, sub, 'chrome');
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

/**
 * The default configuration matrix. Each entry is passed verbatim to
 * engine.generate(), so any engine option can be swept.
 */
const DEFAULT_CONFIGS = [
  // The legacy Painter path is the YARDSTICK — the modular engine must beat it.
  { name: 'legacy', opts: { modular: false, count: 400, seed: 12345 } },
  { name: 'baseline', opts: { modular: true, count: 400, seed: 12345 } },
  { name: 'gradient', opts: { modular: true, count: 400, seed: 12345, gradientLSQ: true } },
  {
    name: 'all-three',
    opts: {
      modular: true, count: 400, seed: 12345,
      gradientLSQ: true, saliencyWeighted: true, paletteLockedPair: true,
    },
  },
];

async function main() {
  const chrome = findChromium();
  if (!chrome) { console.error('FAIL: no chromium found under ~/.cache/ms-playwright'); process.exit(2); }

  let configs = DEFAULT_CONFIGS;
  const cfgFile = argOf('configs', '');
  if (cfgFile) {
    configs = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
  }
  const only = argOf('only', '');
  if (only) configs = configs.filter((c) => c.name === only);
  if (!configs.length) { console.error('FAIL: no configs to run'); process.exit(2); }

  const { server, port } = await startServer();
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({
    headless: true, executablePath: chrome,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).substring(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().substring(0, 300)); });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(async ({ origin, configs }) => {
    const { PaintingEngine } = await import(`${origin}/js/engine/engine.js`);
    const { ssimLuma } = await import(`${origin}/js/engine/metrics.js`);

    const W = 512, H = 384, GW = 64, GH = 48;

    const img = new Image();
    img.src = `${origin}/test-images/frog-source.jpg`;
    await img.decode();
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = W; srcCanvas.height = H;
    const sctx = srcCanvas.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(img, 0, 0, W, H);
    const srcData = sctx.getImageData(0, 0, W, H).data;

    function stats(data) {
      let ink = 0, lum = 0; const colours = new Set(); let hash = 2166136261;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const L = r * 0.299 + g * 0.587 + b * 0.114;
        lum += L;
        if (L < 245) ink++;
        if (i % 400 === 0) colours.add(`${r >> 3},${g >> 3},${b >> 3}`);
        hash ^= (r << 16) | (g << 8) | b;
        hash = Math.imul(hash, 16777619) >>> 0;
      }
      const n = data.length / 4;
      return {
        inkPct: +(100 * ink / n).toFixed(2),
        meanLum: +(lum / n).toFixed(2),
        colourBuckets: colours.size,
        digest: hash >>> 0,
      };
    }

    /** Downsample luminance to a GW x GH grid (the structural metric). */
    function lumaGrid(data) {
      const out = new Float32Array(GW * GH);
      const cw = W / GW, ch = H / GH;
      for (let gy = 0; gy < GH; gy++) {
        for (let gx = 0; gx < GW; gx++) {
          let s = 0, n = 0;
          const x0 = Math.floor(gx * cw), x1 = Math.floor((gx + 1) * cw);
          const y0 = Math.floor(gy * ch), y1 = Math.floor((gy + 1) * ch);
          for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
              const i = (y * W + x) * 4;
              s += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
              n++;
            }
          }
          out[gy * GW + gx] = s / Math.max(1, n);
        }
      }
      return out;
    }

    const srcGrid = lumaGrid(srcData);
    function structural(grid) {
      let ma = 0, mb = 0;
      for (let i = 0; i < srcGrid.length; i++) { ma += srcGrid[i]; mb += grid[i]; }
      ma /= srcGrid.length; mb /= grid.length;
      let cov = 0, va = 0, vb = 0, mad = 0;
      for (let i = 0; i < srcGrid.length; i++) {
        const da = srcGrid[i] - ma, db = grid[i] - mb;
        cov += da * db; va += da * da; vb += db * db;
        mad += Math.abs(srcGrid[i] - grid[i]);
      }
      return {
        r: +(cov / Math.sqrt(va * vb || 1)).toFixed(4),
        mad: +(mad / srcGrid.length).toFixed(2),
      };
    }

    /** Full-res interleaved RGB float buffer — ssimLuma()'s expected input. */
    function rgbFull(data) {
      const out = new Float32Array(W * H * 3);
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        out[p * 3] = data[i];
        out[p * 3 + 1] = data[i + 1];
        out[p * 3 + 2] = data[i + 2];
      }
      return out;
    }
    const srcRgb = rgbFull(srcData);

    const source = { stats: stats(srcData) };

    const out = [];
    for (const cfg of configs) {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const engine = new PaintingEngine({
        canvas: c, width: W, height: H, useWorker: true, background: '#fff',
      });
      await engine.loadImage(srcCanvas);
      const t0 = performance.now();
      const shapes = await engine.generate(cfg.opts);
      const ms = Math.round(performance.now() - t0);

      const layer = {
        id: 0, name: 'l', visible: true, opacity: 1, blendMode: 'normal',
        strokes: shapes, locked: false,
      };
      engine.renderer.setLayers([layer]);
      engine.renderer.clear();
      engine.renderer.renderAll({ progress: 1, clear: false });

      const rc = document.createElement('canvas');
      rc.width = W; rc.height = H;
      const rctx = rc.getContext('2d', { willReadFrequently: true });
      rctx.fillStyle = '#fff'; rctx.fillRect(0, 0, W, H);
      rctx.drawImage(engine.renderer.ctx.canvas, 0, 0, W, H);
      const rdata = rctx.getImageData(0, 0, W, H).data;

      const typeCounts = {};
      for (const s of shapes) typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;

      let gd = 0, gn = 0, nonFlat = 0;
      for (const s of shapes) {
        if (s.color0 && s.color1) {
          const d = Math.hypot(s.color0[0]-s.color1[0], s.color0[1]-s.color1[1], s.color0[2]-s.color1[2]);
          gd += d; gn++;
          if (d > 0.5) nonFlat++;
        }
      }

      const st = structural(lumaGrid(rdata));
      let ssim = null;
      try {
        ssim = +(ssimLuma(rgbFull(rdata), srcRgb, W, H) || 0).toFixed(4);
      } catch (e) { ssim = 'ERR:' + String(e).substring(0, 80); }

      out.push({
        name: cfg.name,
        opts: cfg.opts,
        shapes: shapes.length,
        typeCounts,
        ms,
        meanGradDist: gn ? +(gd / gn).toFixed(2) : 0,
        nonFlatPct: gn ? +(100 * nonFlat / gn).toFixed(1) : 0,
        stats: stats(rdata),
        structural: st,
        ssim,
        dataUrl: rc.toDataURL('image/png'),
      });
    }
    return { source, runs: out };
  }, { origin: `http://127.0.0.1:${port}`, configs });

  const shots = argOf('shots', '');
  if (shots) {
    fs.mkdirSync(shots, { recursive: true });
    const srcB64 = await page.evaluate(() => {
      const c = document.createElement('canvas');
      return null;
    });
    for (const r of result.runs) {
      const b64 = r.dataUrl.split(',')[1];
      fs.writeFileSync(path.join(shots, `${r.name}.png`), Buffer.from(b64, 'base64'));
      delete r.dataUrl;
    }
  } else {
    for (const r of result.runs) delete r.dataUrl;
  }

  const src = result.source.stats;
  const rows = result.runs.map((r) => ({
    name: r.name,
    shapes: r.shapes,
    ms: r.ms,
    gradDist: r.meanGradDist,
    nonFlatPct: r.nonFlatPct,
    inkPct: r.stats.inkPct,
    inkErr: +(r.stats.inkPct - src.inkPct).toFixed(2),
    meanLum: r.stats.meanLum,
    lumErr: +(r.stats.meanLum - src.meanLum).toFixed(2),
    buckets: r.stats.colourBuckets,
    r: r.structural.r,
    mad: r.structural.mad,
    ssim: r.ssim,
    digest: r.stats.digest,
  }));

  // ── report ──────────────────────────────────────────────────────────────
  console.log(`SOURCE  inkPct=${src.inkPct} meanLum=${src.meanLum} buckets=${src.colourBuckets}`);
  console.log('');
  const hdr = ['config', 'shapes', 'ms', 'gradD', 'nonFlat%', 'inkPct', 'inkErr', 'lumErr', 'buckets', 'r', 'mad', 'ssim'];
  const widths = [12, 7, 5, 6, 9, 7, 7, 7, 8, 8, 7, 7];
  const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join(' ');
  console.log(line(hdr));
  console.log(widths.map((w) => '-'.repeat(w - 1)).join(' '));
  for (const r of rows) {
    console.log(line([
      r.name, r.shapes, r.ms, r.gradDist, r.nonFlatPct, r.inkPct,
      r.inkErr, r.lumErr, r.buckets, r.r, r.mad, r.ssim ?? '—',
    ]));
  }

  // Best-by-r, and whether any run is a structural regression vs baseline.
  const best = rows.reduce((a, b) => (b.r > a.r ? b : a));
  console.log(`\nBEST r: ${best.name} (r=${best.r} mad=${best.mad})`);
  const base = rows.find((r) => r.name === 'baseline');
  if (base) {
    for (const r of rows) {
      if (r.name === 'baseline') continue;
      const delta = +(r.r - base.r).toFixed(4);
      console.log(`  ${r.name} vs baseline: r ${delta >= 0 ? '+' : ''}${delta}  ${delta < 0 ? 'REGRESSION' : 'better'}`);
    }
  }

  const jsonOut = argOf('json', '');
  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify({ source: result.source, runs: result.runs, rows }, null, 2));
    console.log(`\nJSON: ${jsonOut}`);
  }
  if (errors.length) console.log('\nERRORS:', errors.slice(0, 5));

  await browser.close();
  server.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
