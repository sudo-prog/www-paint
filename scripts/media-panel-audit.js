#!/usr/bin/env node
/**
 * CDP responsive audit for WWW_PAINT (Mac-owned media panel).
 *
 * Measures real DOM geometry at six widths and writes a JSON report plus
 * screenshots. Maestro asserts visibility; this measures usability.
 *
 * Usage:
 *   node scripts/media-panel-audit.js [--url http://127.0.0.1:8099/index.html]
 *                                    [--widths 390,500,768,1024,1440,1920]
 *                                    [--out /tmp/media-audit]
 */

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

const CHROME_CANDIDATES = [
  process.env.CHROME_BINARY,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
].filter(Boolean);

const WIDTHS = (process.argv.find((a) => a.startsWith("--widths=")) || "")
  .split("=")[1]?.split(",").map(Number)
  .filter(Boolean) || [390, 500, 768, 1024, 1440, 1920];

const URL_ARG = (process.argv.find((a) => a.startsWith("--url=")) || "").split("=")[1]
  || "http://127.0.0.1:8099/index.html";

const OUT_DIR = (process.argv.find((a) => a.startsWith("--out=")) || "").split("=")[1]
  || path.join(os.tmpdir(), "media-panel-audit");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── Chrome launch ──────────────────────────────────────────────────────── */

function launchChrome() {
  const binary = CHROME_CANDIDATES.find((b) => fs.existsSync(b));
  if (!binary) throw new Error("No Chrome binary found");

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "wwwpaint-audit-"));
  const port = 9222 + Math.floor(Math.random() * 500);

  const proc = spawn(binary, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ], { stdio: "ignore" });

  return { proc, port, profile };
}

async function waitForCdp(port, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const json = await new Promise((resolve, reject) => {
        const req = http.get({ host: "127.0.0.1", port, path: "/json/version", timeout: 2000 }, (res) => {
          let body = "";
          res.on("data", (c) => (body += c));
          res.on("end", () => resolve(JSON.parse(body)));
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
      });
      if (json.webSocketDebuggerUrl) return json.webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(300);
  }
  throw new Error("Chrome CDP did not come up");
}

/* ── Minimal CDP client over WebSocket (no external deps) ────────────────── */

const { WebSocket } = (() => {
  try {
    return require("ws");
  } catch {
    return {};
  }
})();

function connectWs(url) {
  if (WebSocket) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.on("open", () => resolve(ws));
      ws.on("error", reject);
    });
  }
  // Node 22+ ships a global WebSocket (undici). It opens asynchronously, so
  // wait for the open event before handing it back.
  if (typeof globalThis.WebSocket === "function") {
    return new Promise((resolve, reject) => {
      const ws = new globalThis.WebSocket(url);
      ws.addEventListener("open", () => resolve(ws));
      ws.addEventListener("error", (ev) => reject(new Error("ws error: " + (ev.message || "unknown"))));
    });
  }
  throw new Error("No WebSocket implementation available");
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    const onMessage = (data) => {
      let raw;
      if (typeof data === "string") raw = data;
      else if (data && typeof data.toString === "function" && data.constructor?.name === "Buffer") raw = data.toString();
      else if (data?.data) raw = String(data.data);
      else raw = String(data);
      const msg = JSON.parse(raw);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    };
    // Node's global WebSocket (undici) uses addEventListener; the ws package uses .on.
    if (typeof ws.addEventListener === "function") {
      ws.addEventListener("message", (ev) => onMessage(ev.data));
    } else if (typeof ws.on === "function") {
      ws.on("message", onMessage);
    }
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || "eval failed");
    }
    return res.result.value;
  }

  close() {
    try { this.ws.close(); } catch { /* ignore */ }
  }
}

/* ── Measurement expression ──────────────────────────────────────────────── */

const MEASURE = `(() => {
  const q = (s) => [...document.querySelectorAll(s)];
  const visible = (e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed';
  const overflow = (e) => e.scrollWidth - e.clientWidth;
  const rect = (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }; };

  const docOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;

  // Any element extending past the right edge of the viewport.
  const pastViewport = q('body *').filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.right > innerWidth + 1 && r.height > 0;
  }).map((e) => (e.className || e.tagName).toString().slice(0, 60));

  // A control whose content is wider than its box = clipped label.
  const clipped = q('.btn, .control-section__title, .slider-label, .media-band-toggle, .strip-chip, .strip-name, .nav-btn')
    .filter(visible)
    .filter((e) => overflow(e) > 1)
    .map((e) => (e.className || e.tagName) + ':' + overflow(e) + ':' + (e.textContent || '').trim().slice(0, 30));

  // Icon-only controls with no accessible name.
  const unnamed = q('.media-band-toggle, .media-action-btn, .rail-icon-btn, .collapse-btn, .layer-action-btn')
    .filter((e) => !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby') && !(e.textContent || '').trim())
    .length;

  // Slider labels that wrapped to more than one line.
  const sliderLabels = q('.media-slider .slider-label');
  const labelRows = new Set(sliderLabels.map((l) => Math.round(l.getBoundingClientRect().top))).size;

  // The media panel's own geometry.
  const mediaRoot = document.getElementById('media-root');
  const media = mediaRoot ? rect(mediaRoot) : null;
  const mediaScroll = mediaRoot ? mediaRoot.querySelector('.media-scroll') : null;
  const mediaScrollInfo = mediaScroll ? {
    scrollHeight: mediaScroll.scrollHeight,
    clientHeight: mediaScroll.clientHeight,
    scrollWidth: mediaScroll.scrollWidth,
    clientWidth: mediaScroll.clientWidth,
  } : null;

  // Band toggle row: must be one row, four equal columns.
  const bandRow = document.querySelector('.media-band-row');
  const bandToggles = q('.media-band-toggle');
  const bandRects = bandToggles.map(rect);
  const bandRows = new Set(bandRects.map((r) => r.y)).size;
  const bandWidths = [...new Set(bandRects.map((r) => r.w))];
  const bandMinHeight = bandRects.length ? Math.min(...bandRects.map((r) => r.h)) : 0;

  // Touch targets on the media panel.
  const touchTargets = q('.media-band-toggle, .media-action-btn, .media-slider input[type=range]')
    .map(rect)
    .filter((r) => r.h > 0);
  const minTouchHeight = touchTargets.length ? Math.min(...touchTargets.map((r) => r.h)) : 0;

  // Console errors collected by the host page.
  const consoleErrors = window.__auditErrors || [];

  // Did the media panel actually mount its sections?
  const sections = q('.media-section').map((s) => s.id);

  // Slider value readouts (tabular-nums check is in CSS; here we just count).
  const sliders = q('.media-slider').length;
  const valueReadouts = q('.media-slider .slider-value').map((v) => v.textContent.trim());

  // Sections hidden by the collapsed rail.
  const collapsed = mediaRoot ? mediaRoot.classList.contains('is-collapsed') : false;

  return {
    viewport: innerWidth,
    docOverflow,
    pastViewport: pastViewport.slice(0, 20),
    pastViewportCount: pastViewport.length,
    clipped: clipped.slice(0, 20),
    clippedCount: clipped.length,
    unnamed,
    sliderLabelRows: labelRows,
    sliderLabelCount: sliderLabels.length,
    media,
    mediaScrollInfo,
    mediaSections: sections,
    mediaSliders: sliders,
    mediaValueReadouts: valueReadouts.slice(0, 20),
    bandRows,
    bandWidths,
    bandMinHeight,
    minTouchHeight,
    collapsed,
    consoleErrors: consoleErrors.slice(0, 20),
    hasMediaRoot: !!mediaRoot,
    hasMediaPanel: !!(window.__app && window.__app.media),
    mediaSettings: window.__app && window.__app.media ? window.__app.media.getSettings() : null,
  };
})()`;

/* ── Run ─────────────────────────────────────────────────────────────────── */

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { proc, port, profile } = launchChrome();
  const report = { url: URL_ARG, widths: {}, startedAt: new Date().toISOString() };

  try {
    const wsUrl = await waitForCdp(port);
    const ws = await connectWs(wsUrl);
    const cdp = new Cdp(ws);

    // Reuse the page Chrome already opened — do NOT create and close a target,
    // that races /json/list. Resolve the existing page target.
    const targets = await new Promise((resolve, reject) => {
      http.get({ host: "127.0.0.1", port, path: "/json/list", timeout: 3000 }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve(JSON.parse(body)));
      }).on("error", reject);
    });
    const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
    if (!page) throw new Error("No page target exposed by Chrome");

    const pageWs = await connectWs(page.webSocketDebuggerUrl);
    const pageCdp = new Cdp(pageWs);

    await pageCdp.send("Page.enable");
    await pageCdp.send("Runtime.enable");
    await pageCdp.send("Log.enable");

    // Capture console errors
    await pageCdp.eval(`
      window.__auditErrors = [];
      const origErr = console.error;
      console.error = function (...args) {
        window.__auditErrors.push(args.map(String).join(' ').slice(0, 300));
        origErr.apply(console, args);
      };
      window.addEventListener('error', (e) => {
        window.__auditErrors.push('uncaught: ' + (e.message || '').slice(0, 300));
      });
      window.addEventListener('unhandledrejection', (e) => {
        window.__auditErrors.push('rejection: ' + String(e.reason).slice(0, 300));
      });
      true;
    `);

    for (const width of WIDTHS) {
      await pageCdp.send("Emulation.setDeviceMetricsOverride", {
        width,
        height: width < 769 ? 844 : 900,
        deviceScaleFactor: 1,
        mobile: width < 769,
      });

      await pageCdp.send("Page.navigate", { url: URL_ARG });
      await sleep(2500); // let modules load and panels render

      // Install error capture after navigation (nav wipes it)
      await pageCdp.eval(`
        window.__auditErrors = window.__auditErrors || [];
        if (!window.__auditHooked) {
          window.__auditHooked = true;
          window.addEventListener('error', (e) => {
            window.__auditErrors.push('uncaught: ' + (e.message || '').slice(0, 300));
          });
          window.addEventListener('unhandledrejection', (e) => {
            window.__auditErrors.push('rejection: ' + String(e.reason).slice(0, 300));
          });
        }
        true;
      `);

      const measure = await pageCdp.eval(MEASURE);

      const shot = await pageCdp.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      const shotPath = path.join(OUT_DIR, `width-${width}.png`);
      fs.writeFileSync(shotPath, Buffer.from(shot.data, "base64"));

      // Also capture with the media panel open.
      await pageCdp.eval(`
        (() => {
          const app = window.__app;
          if (!app) return 'no-app';
          if (!app._mediaMode && typeof app.toggleMediaMode === 'function') {
            app.toggleMediaMode();
          }
          // Desktop: the panel is hidden by default; make sure it is visible.
          const root = document.getElementById('media-root');
          if (root) {
            root.classList.remove('panel--hidden');
            root.classList.remove('panel--mobile-closed');
          }
          return 'media-mode';
        })()
      `);
      await sleep(600);
      const mediaOpen = await pageCdp.eval(MEASURE);
      const shotOpen = await pageCdp.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      fs.writeFileSync(path.join(OUT_DIR, `width-${width}-media.png`), Buffer.from(shotOpen.data, "base64"));

      report.widths[width] = { closed: measure, open: mediaOpen };
      console.log(
        `  ${width}px: docOverflow=${measure.docOverflow} pastViewport=${measure.pastViewportCount} ` +
        `clipped=${measure.clippedCount} mediaSections=${measure.mediaSections.length} ` +
        `bandRows=${measure.bandRows} bandMinH=${measure.bandMinHeight} minTouchH=${measure.minTouchHeight} ` +
        `errors=${measure.consoleErrors.length} mediaOpen=${mediaOpen.hasMediaPanel}`
      );
    }

    pageCdp.close();
    cdp.close();
  } finally {
    proc.kill("SIGKILL");
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(`\nReport: ${path.join(OUT_DIR, "report.json")}`);
  console.log(`Shots:  ${OUT_DIR}`);
}

main().catch((err) => {
  console.error("audit failed:", err);
  process.exit(1);
});
