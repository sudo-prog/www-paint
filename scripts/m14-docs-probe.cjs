#!/usr/bin/env node
/**
 * Probe: capture REAL output for docs/PANELS.md and docs/STROKE_FORMAT.md (M14).
 *
 * Mac-owned (M14). Serves the repo over HTTP (same pattern as the other
 * probes), loads the real page in Chromium, and dumps:
 *   1. the live panel inventory (id, role, aria-label, classes, rect, control count)
 *   2. the nav-button -> panel wiring actually present in the DOM
 *   3. the engine's own style registry (count + names), read from the live app
 *   4. one REAL stroke record per shape type, built by the engine's own
 *      `createShape` + validated by `isValidShape`
 *   5. a real `engine.exportProject()` structure (keys, counts, sample record)
 *   6. the engine's layer-management API surface
 *
 * Usage: NODE_PATH=<dir containing playwright-core> node scripts/m14-docs-probe.cjs [--width=1440]
 * Output: docs/research/m14-docs-probe.json (+ a stdout summary)
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WIDTH = Number((process.argv.find(a => a.startsWith('--width=')) || '').split('=')[1]) || 1440;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

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
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const CHROME_CANDIDATES = [
  process.env.CHROME_BINARY,
  path.join(process.env.HOME || '', 'Library/Caches/ms-playwright/chromium-1248/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
  path.join(process.env.HOME || '', 'Library/Caches/ms-playwright/chromium-1243/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
  '/tmp/chrome-for-testing-147/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
].filter(Boolean);

async function main() {
  const server = await startServer();
  const port = server.address().port;

  let browser = null;
  let lastErr = null;
  for (const exe of CHROME_CANDIDATES) {
    if (!fs.existsSync(exe)) continue;
    try { browser = await chromium.launch({ executablePath: exe }); break; }
    catch (e) { lastErr = e; }
  }
  if (!browser) throw new Error('no usable Chromium: ' + (lastErr?.message || 'none found'));

  const page = await browser.newPage({ viewport: { width: WIDTH, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!(window.__app || window._wwwPaint), null, { timeout: 30000 });
  await page.waitForTimeout(1200);

  // ── 1. Panel inventory ────────────────────────────────────────────
  const panels = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.panel, .paint-toolbar')) {
      const r = el.getBoundingClientRect();
      out.push({
        id: el.id || null,
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        ariaLabel: el.getAttribute('aria-label'),
        classes: el.className,
        title: el.querySelector('.panel-title')?.textContent?.trim() || null,
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        controlCount: el.querySelectorAll('button, select, input, textarea').length,
      });
    }
    return out;
  });

  // ── 2. Nav wiring (from the DOM, not from memory) ─────────────────
  const nav = await page.evaluate(() => {
    const out = [];
    for (const btn of document.querySelectorAll('.nav-btn')) {
      out.push({
        id: btn.id || null,
        dataNav: btn.getAttribute('data-nav'),
        ariaLabel: btn.getAttribute('aria-label'),
        label: btn.querySelector('.btn-label')?.textContent?.trim() || null,
        active: btn.classList.contains('nav-btn--active'),
      });
    }
    return out;
  });

  // ── 3. Style registry, from the live engine ───────────────────────
  const styles = await page.evaluate(() => {
    const app = window.__app || window._wwwPaint;
    const eng = app && app.engine;
    if (!eng) return null;
    const list = eng.getStyleList ? eng.getStyleList() : null;
    const info = eng.getStyleInfo ? eng.getStyleInfo() : null;
    return { count: list ? list.length : null, list: list, info: info };
  });

  // ── 4. One REAL stroke record per shape type ──────────────────────
  const strokes = await page.evaluate(async () => {
    const mod = await import('./js/engine/shapes.js');
    const types = { E: 'ellipse', B: 'blob', T: 'triangle', R: 'bar', S: 'stroke' };
    const out = {};
    for (const [t, label] of Object.entries(types)) {
      const s = mod.createShape({
        type: t,
        params: t === 'E' ? [64, 64, 40, 24, 0.4, 0, 0, 0]
          : t === 'B' ? [64, 64, 36, 30, 0.2, 0, 0, 0]
          : t === 'T' ? [20, 80, 64, 20, 108, 80, 0, 0]
          : t === 'R' ? [64, 64, 90, 22, 0.5, 0, 0, 0]
          : [16, 64, 64, 8, 112, 64, 6, 0],
        color0: [180, 60, 40],
        color1: [40, 90, 160],
        alpha: 0.85,
        style: 'pencil',
        layer: 1,
        order: 3,
        seed: 7,
      });
      out[t] = { label: label, valid: mod.isValidShape(s), shape: s };
    }
    return out;
  });

  // ── 5. Real project export structure ──────────────────────────────
  const project = await page.evaluate(() => {
    const app = window.__app || window._wwwPaint;
    const eng = app && app.engine;
    if (!eng) return null;
    const parsed = JSON.parse(eng.exportProject({ embedImage: false }));
    return {
      version: parsed.version,
      layerCount: parsed.layers ? parsed.layers.length : 0,
      topLevelKeys: Object.keys(parsed),
      layerKeys: parsed.layers && parsed.layers[0] ? Object.keys(parsed.layers[0]) : [],
      strokeKeys: parsed.layers && parsed.layers[0] && parsed.layers[0].strokes[0]
        ? Object.keys(parsed.layers[0].strokes[0]) : [],
      strokeCount: parsed.layers
        ? parsed.layers.reduce((a, l) => a + (l.strokes ? l.strokes.length : 0), 0) : 0,
      sample: parsed.layers && parsed.layers[0] && parsed.layers[0].strokes[0]
        ? parsed.layers[0].strokes[0] : null,
      settingsKeys: Object.keys(parsed.settings || {}),
    };
  });

  // ── 6. Layer API surface ──────────────────────────────────────────
  const layerApi = await page.evaluate(() => {
    const app = window.__app || window._wwwPaint;
    const eng = app && app.engine;
    if (!eng) return null;
    const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(eng))
      .filter(n => typeof eng[n] === 'function' && /layer|Layer/.test(n));
    return {
      methods: proto.sort(),
      totalStrokes: eng.getTotalStrokes(),
      layerNames: eng.layers.map(l => l.name),
    };
  });

  const result = {
    capturedAt: new Date().toISOString(),
    viewport: { width: WIDTH, height: 900 },
    panels: panels, nav: nav, styles: styles, strokes: strokes,
    project: project, layerApi: layerApi, pageErrors: errors,
  };

  fs.writeFileSync(
    path.join(ROOT, 'docs/research/m14-docs-probe.json'),
    JSON.stringify(result, null, 2),
  );

  console.log('=== M14 DOCS PROBE ===');
  console.log('viewport:', WIDTH + 'x900');
  console.log('panels:', panels.length);
  for (const p of panels) {
    console.log('  ' + (p.id || '(no id)') + '  role=' + p.role + '  controls=' + p.controlCount
      + '  ' + p.rect.w + 'x' + p.rect.h + '@' + p.rect.x + ',' + p.rect.y + '  "' + p.ariaLabel + '"');
  }
  console.log('nav:', nav.map(n => (n.label || '?') + '->' + (n.dataNav || n.id)).join('  '));
  console.log('styles:', styles && styles.count,
    (styles && styles.list ? styles.list.slice(0, 6).join(', ') : '') + '...');
  console.log('shape records:', Object.entries(strokes || {})
    .map(([t, v]) => t + ':' + v.label + '=' + (v.valid ? 'valid' : 'INVALID')).join('  '));
  console.log('project:', project && project.version,
    'layers=' + (project ? project.layerCount : '?'),
    'strokes=' + (project ? project.strokeCount : '?'));
  console.log('layerApi:', layerApi && layerApi.methods.join(', '));
  console.log('page errors:', errors.length);
  console.log('JSON: docs/research/m14-docs-probe.json');

  await browser.close();
  server.close();
}

main().catch(e => { console.error('PROBE FAILED:', e); process.exit(1); });
