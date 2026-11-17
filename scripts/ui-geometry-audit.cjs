#!/usr/bin/env node
/**
 * CDP UI geometry audit for WWW_PAINT (Mac-owned, no build step).
 *
 * Why this exists: Maestro's web device runs a desktop Chromium and clamps
 * `--screen-size` to >=500px, so 390px phone layout cannot be measured that
 * way (maestro-web-verification skill, pitfall 9). This drives headless Chrome
 * over the DevTools protocol with Emulation.setDeviceMetricsOverride for TRUE
 * widths, which is the fallback that skill prescribes.
 *
 * It reports, per width:
 *   - document overflow-x (scrollWidth - clientWidth)
 *   - elements whose right edge passes the viewport
 *   - per-panel control geometry: scrollWidth>clientWidth (clipped label),
 *     rect.right>innerWidth (untappable), wrapped labels, row count
 *   - zero-area / zero-size controls (collapsed but still asserted)
 *   - occlusion: elementFromPoint(centre) === the control itself
 * and writes a PNG per width for vision review.
 *
 * Usage:
 *   node scripts/ui-geometry-audit.cjs --url http://127.0.0.1:8099/index.html
 *   node scripts/ui-geometry-audit.cjs --url ... --widths 390,768,1440
 *
 * Exit 0 always (it is a report, not a gate). Read the JSON.
 */
'use strict';

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const arg = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const URL_TO_TEST = arg('--url', 'http://127.0.0.1:8099/index.html');
const OUT_DIR = arg('--out', require('os').tmpdir() + '/wwwpaint-ui-audit');
const WIDTHS = (arg('--widths', '390,500,768,1024,1440,1920')).split(',').map(Number);
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36';

// ── Minimal CDP client (no deps) ────────────────────────────────────────────
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function freePort() {
  return new Promise((resolve, reject) => {
    const s = http.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
    s.on('error', reject);
  });
}

async function getJSON(url) {
  const r = await fetch(url);
  return r.json();
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        const hs = this.events.get(msg.method) || [];
        hs.forEach((h) => h(msg.params));
      }
    });
  }
  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });
    return new CDP(ws);
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }
  on(method, handler) {
    const hs = this.events.get(method) || [];
    hs.push(handler);
    this.events.set(method, hs);
  }
}

async function waitForChrome(port, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { return await getJSON(`http://127.0.0.1:${port}/json/version`); }
    catch { await sleep(250); }
  }
  throw new Error('chrome never came up on ' + port);
}

// ── The measurement ─────────────────────────────────────────────────────────
const MEASURE = `(() => {
  const W = innerWidth, H = innerHeight;
  const out = { width: W, height: H, overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, panels: {}, offenders: [], controls: [] };
  const rectOf = (el) => { const r = el.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; };
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };

  out.theme = document.documentElement.getAttribute('data-theme') || '(none)';
  out.tokens = (() => {
    const s = getComputedStyle(document.documentElement);
    const pick = (k) => s.getPropertyValue(k).trim();
    return { bgPrimary: pick('--bg-primary'), surfacePanel: pick('--surface-panel'), panelAlpha: pick('--panel-alpha'), glassBrightness: pick('--glass-brightness'), accent: pick('--accent'), textPrimary: pick('--text-primary'), fUi: pick('--f-ui'), fMono: pick('--f-mono') };
  })();
  out.surfaces = {};
  for (const sel of ['.panel', '.top-bar', '.canvas-wrapper', '.motion-controls-root']) {
    const el = document.querySelector(sel);
    if (!el) { out.surfaces[sel] = null; continue; }
    const s = getComputedStyle(el);
    out.surfaces[sel] = { bg: s.backgroundColor, backdrop: s.backdropFilter || s.webkitBackdropFilter || 'none', border: s.borderTopWidth + ' ' + s.borderTopColor, radius: s.borderRadius, z: s.zIndex, font: s.fontFamily.slice(0, 40), rect: rectOf(el), visible: visible(el) };
  }

  for (const p of document.querySelectorAll('.panel')) {
    const id = p.id || p.className;
    const r = rectOf(p);
    const s = getComputedStyle(p);
    const cs = { id, rect: r, w: r.w, display: s.display, pos: s.position, z: s.zIndex, visible: visible(p), scrollW: p.scrollWidth, clientW: p.clientWidth, overflowX: p.scrollWidth - p.clientWidth };
    // controls inside the panel
    const ctrls = [...p.querySelectorAll('button, input, select, a[href], .btn, .nav-btn, .pill-toggle, .segmented__btn, .slider-row, .layer-row')].filter(visible);
    cs.controlCount = ctrls.length;
    cs.clipped = ctrls.filter(c => c.scrollWidth - c.clientWidth > 1).map(c => ({ tag: c.tagName.toLowerCase(), cls: (c.className||'').toString().slice(0,40), id: c.id || '', over: c.scrollWidth - c.clientWidth, text: (c.textContent||'').trim().slice(0,30) }));
    cs.pastViewport = ctrls.filter(c => { const b = c.getBoundingClientRect(); return b.right > W + 0.5 || b.left < -0.5; }).map(c => ({ id: c.id || (c.className||'').toString().slice(0,30), r: Math.round(c.getBoundingClientRect().right) }));
    cs.zeroArea = ctrls.filter(c => { const b = c.getBoundingClientRect(); return b.width < 1 || b.height < 1; }).map(c => ({ id: c.id || (c.className||'').toString().slice(0,30) }));
    cs.untappable = ctrls.filter(c => {
      const b = c.getBoundingClientRect();
      if (b.width < 1 || b.height < 1) return false;
      const top = document.elementFromPoint(Math.min(Math.max(b.left + b.width/2, 1), W-1), Math.min(Math.max(b.top + b.height/2, 1), H-1));
      return top !== null && !c.contains(top) && top !== c;
    }).map(c => ({ id: c.id || (c.className||'').toString().slice(0,30), hit: (document.elementFromPoint(Math.min(Math.max(c.getBoundingClientRect().left + c.getBoundingClientRect().width/2,1),W-1), Math.min(Math.max(c.getBoundingClientRect().top + c.getBoundingClientRect().height/2,1),H-1))||{}).className?.toString().slice(0,30) }));
    cs.wrapped = ctrls.filter(c => {
      const l = c.querySelector('.btn-label, .nav-btn__label, .strip-name, .panel-title, .layer-name, .segmented__btn span, .pill-toggle__label');
      if (!l) return false;
      const lh = parseFloat(getComputedStyle(l).lineHeight) || 16;
      return Math.round(l.getBoundingClientRect().height / lh) > 1;
    }).map(c => ({ id: c.id || (c.className||'').toString().slice(0,30), label: (c.querySelector('.btn-label, .layer-name, .strip-name, .panel-title')||{}).textContent }));
    out.panels[id] = cs;
  }

  // document-level offenders: any visible element wider than the viewport
  out.offenders = [...document.querySelectorAll('body *')].filter(e => {
    if (!visible(e)) return false;
    const r = e.getBoundingClientRect();
    return r.right > W + 1 || r.left < -1;
  }).slice(0, 40).map(e => ({ tag: e.tagName.toLowerCase(), id: e.id || '', cls: (e.className||'').toString().slice(0,40), l: Math.round(e.getBoundingClientRect().left), r: Math.round(e.getBoundingClientRect().right) }));

  // text under 11px and uppercase-everything census
  out.microType = [...document.querySelectorAll('body *')].filter(e => visible(e) && e.children.length === 0 && (e.textContent||'').trim()).map(e => ({ fs: parseFloat(getComputedStyle(e).fontSize), tt: getComputedStyle(e).textTransform, ff: getComputedStyle(e).fontFamily.slice(0,20), text: (e.textContent||'').trim().slice(0,24) })).filter(x => x.fs < 11).slice(0, 40);

  out.emoji = [...document.querySelectorAll('button, .btn, .nav-btn, .panel-title, .strip-name, .strip-chip, .btn-label')].map(e => (e.textContent||'').trim()).filter(t => /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t)).slice(0, 20);

  return out;
})()`;

async function main() {
  const port = await freePort();
  const profile = path.join(OUT_DIR, 'chrome-profile');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(profile, { recursive: true });

  const CHROME = process.env.CHROME_BINARY ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const { spawn } = require('child_process');
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--window-size=1440,900', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeErr = '';
  chrome.stderr.on('data', (d) => { chromeErr += d; });

  try {
    await waitForChrome(port);
    const targets = await getJSON(`http://127.0.0.1:${port}/json/list`);
    const page = targets.find((t) => t.type === 'page');
    const cdp = await CDP.connect(page.webSocketDebuggerUrl);

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    const report = { url: URL_TO_TEST, chrome: (await getJSON(`http://127.0.0.1:${port}/json/version`)).Browser, widths: [] };

    for (const w of WIDTHS) {
      const h = w < 768 ? Math.round(w * 844 / 390) : (w <= 1024 ? 900 : 900);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: w, height: h, deviceScaleFactor: w < 500 ? 3 : 1, mobile: w < 768,
      });
      await cdp.send('Emulation.setUserAgentOverride', { userAgent: w < 768 ? MOBILE_UA : DESKTOP_UA });
      await cdp.send('Page.navigate', { url: URL_TO_TEST + (URL_TO_TEST.includes('?') ? '&' : '?') + '_cdp=' + Date.now() });
      await sleep(3500);
      // wait for the app to say Ready
      try {
        for (let i = 0; i < 40; i++) {
          const r = await cdp.send('Runtime.evaluate', { expression: `!!document.querySelector('#canvas-placeholder') || /Ready/.test(document.body.innerText)`, returnByValue: true });
          if (r.result.value) break;
          await sleep(250);
        }
      } catch (e) { /* fall through */ }
      await sleep(600);

      const res = await cdp.send('Runtime.evaluate', { expression: MEASURE, returnByValue: true });
      const data = res.result.value;
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const file = path.join(OUT_DIR, `ui-${w}.png`);
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
      data.screenshot = file;
      report.widths.push(data);
      console.log(`\n=== ${w}x${h} ===`);
      console.log(JSON.stringify({
        theme: data.theme, overflowX: data.overflowX,
        surfaces: data.surfaces, panels: Object.fromEntries(Object.entries(data.panels).map(([k, v]) => [k, { w: v.w, visible: v.visible, controlCount: v.controlCount, clipped: v.clipped.length, pastViewport: v.pastViewport.length, zeroArea: v.zeroArea.length, untappable: v.untappable.length, wrapped: v.wrapped.length }])),
        offenders: data.offenders.length, microType: data.microType.length, emoji: data.emoji,
      }, null, 1));
    }

    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    console.log('\nReport: ' + path.join(OUT_DIR, 'report.json'));
  } finally {
    chrome.kill('SIGKILL');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
