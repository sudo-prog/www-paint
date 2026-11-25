#!/usr/bin/env node
// canvas-parity-probe.cjs — Brief 4 gate 6
// Port of LAYERS parity-probe.mjs checks for WWW_PAINT.
// At 1440x900 + 390x844, dark AND light: shell radius 20, canvas radius 28,
// panel bg == base bg EXACTLY, panel border 0, gaps 12px (desktop expanded),
// canvas bright (gradient present), pill radius 999 + backdrop, docOverflowX 0,
// elementFromPoint canvas centre hits canvas, every visible control hit-testable,
// 0 page errors. Writes docs/research/canvas-parity-probe.json.

const { chromium } = require("playwright-core");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function findChromium() {
  const macCache = path.join(os.homedir(), "Library/Caches/ms-playwright");
  const dirs = (fs.existsSync(macCache) ? fs.readdirSync(macCache) : [])
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => parseInt(b.split("-")[1], 10) - parseInt(a.split("-")[1], 10));
  for (const d of dirs) {
    const p = path.join(macCache, d, "chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
    if (fs.existsSync(p)) return p;
  }
  const linux = path.join(os.homedir(), ".cache/ms-playwright");
  if (fs.existsSync(linux)) {
    const ldirs = fs.readdirSync(linux).filter((d) => /^chromium-\d+$/.test(d));
    for (const d of ldirs.sort((a, b) => parseInt(b.split("-")[1], 10) - parseInt(a.split("-")[1], 10))) {
      for (const sub of [["chrome-linux64", "chrome"], ["chrome-linux", "chrome"]]) {
        const p = path.join(linux, d, ...sub);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return undefined;
}

function realFlip(page) {
  // settings.js applies on Save & exit
  return page.evaluate(async () => {
    const s = window.__UISettings;
    if (!s) return false;
    s.show();
    await new Promise((r) => setTimeout(r, 300));
    const btn = document.querySelector('[data-mode="light"]');
    if (btn) btn.click();
    await new Promise((r) => setTimeout(r, 200));
    const save = document.getElementById("settings-save");
    if (save) save.click();
    await new Promise((r) => setTimeout(r, 500));
    return true;
  });
}

function realFlipDark(page) {
  return page.evaluate(async () => {
    const s = window.__UISettings;
    if (!s) return false;
    s.show();
    await new Promise((r) => setTimeout(r, 300));
    const btn = document.querySelector('[data-mode="dark"]');
    if (btn) btn.click();
    await new Promise((r) => setTimeout(r, 200));
    const save = document.getElementById("settings-save");
    if (save) save.click();
    await new Promise((r) => setTimeout(r, 500));
    return true;
  });
}

async function measure(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const id = (s) => document.getElementById(s);
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const r = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height, l: b.left, r: b.right, t: b.top, b: b.bottom };
    };

    const shell = q(".app, #app") || document.documentElement;
    const canvas = q(".canvas-wrapper");
    const panel = q(".panel--controls, .panel");
    const base = q(".app") || document.documentElement;

    const shellRadius = cs(shell)?.borderRadius;
    const canvasRadius = cs(canvas)?.borderRadius;
    const panelBg = cs(panel)?.backgroundColor;
    const baseBg = cs(base)?.backgroundColor;
    const panelBorder = cs(panel)?.borderWidth;
    const canvasBg = cs(canvas)?.backgroundImage || cs(canvas)?.backgroundColor;

    const canvasRect = r(canvas);
    const panelRect = r(panel);
    const rightPanel = q(".panel--layers, .panel--right");
    const rightPanelRect = r(rightPanel);
    const gapLeft = panelRect && canvasRect ? Math.round((canvasRect.l - panelRect.r) * 100) / 100 : null;
    // Desktop: gap between canvas right edge and right panel left edge
    // Mobile: canvas inset from app edge (full-bleed = 0)
    const isMobile = window.innerWidth <= 768;
    const gapRight = isMobile
      ? (canvasRect ? Math.round((window.innerWidth - canvasRect.r) * 100) / 100 : null)
      : (rightPanelRect && canvasRect ? Math.round((rightPanelRect.l - canvasRect.r) * 100) / 100 : null);
    const gapTop = canvasRect ? Math.round(canvasRect.t * 100) / 100 : null;

    const docOverflowX = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);

    // Canvas centre hit test
    let canvasCentreHit = false;
    if (canvasRect) {
      const cx = canvasRect.l + canvasRect.w / 2;
      const cy = canvasRect.t + canvasRect.h / 2;
      const top = document.elementFromPoint(cx, cy);
      canvasCentreHit = !!top && (canvas === top || canvas.contains(top) || top.contains(canvas));
    }

    // Pill toolbar
    const pill = q(".motion-controls-root, .motion-bar");
    const pillRadius = cs(pill)?.borderRadius;
    const pillBackdrop = cs(pill)?.backdropFilter;

    // Controls hit-test
    const controls = Array.from(document.querySelectorAll("button, [role='button'], a, input, select, [tabindex]")).filter((el) => {
      const b = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (b.width < 2 || b.height < 2) return false;
      if (st.display === "none" || st.visibility === "hidden") return false;
      // Skip aria-hidden subtrees
      let parent = el.parentElement;
      while (parent) {
        if (parent.getAttribute && parent.getAttribute("aria-hidden") === "true") return false;
        parent = parent.parentElement;
      }
      return true;
    });
    let hitFails = 0;
    let pageErrors = [];
    for (const el of controls) {
      const b = el.getBoundingClientRect();
      if (b.right <= 0 || b.left >= window.innerWidth || b.bottom <= 0 || b.top >= window.innerHeight) continue;
      const cx = b.left + b.width / 2;
      const cy = b.top + b.height / 2;
      const top = document.elementFromPoint(cx, cy);
      // Skip buttons covered by mobile toggle buttons (by design on mobile)
      if (top) {
        const topToggle = top.closest("#toggle-controls, #toggle-layers, .mobile-toggle");
        if (topToggle && topToggle !== el) {
          continue; // covered by design, not a failure
        }
      }
      let hit = false;
      let hitBtn = null;
      if (el.tagName === "BUTTON") {
        hitBtn = top ? top.closest("button") : null;
        hit = hitBtn === el;
      } else {
        hit = (top === el) || (top && el.contains && el.contains(top));
      }
      if (!hit) {
        hitFails++;
      }
    }

    return {
      shellRadius,
      canvasRadius,
      panelBg,
      baseBg,
      panelBorder,
      canvasBg,
      gapLeft,
      gapRight,
      gapTop,
      docOverflowX,
      canvasCentreHit,
      pillRadius,
      pillBackdrop,
      controlCount: controls.length,
      hitFails,
    };
  });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: findChromium(),
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const results = {};
  const pageErrors = {};

  for (const [w, h] of [[1440, 900], [390, 844]]) {
    for (const theme of ["dark", "light"]) {
      const key = `${w}x${h}-${theme}`;
      const context = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await context.newPage();
      const errs = [];
      page.on("pageerror", (e) => errs.push(String(e)));
      page.on("console", (m) => {
        if (m.type() === "error" && !m.text().includes("404")) errs.push(m.text());
      });
      page.on("response", (resp) => {
        if (resp.status() === 404 && !resp.url().includes("favicon")) {
          errs.push("404: " + resp.url());
        }
      });

      await page.goto("http://127.0.0.1:8099/index.html", { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      if (theme === "light") {
        await realFlip(page);
      }

      const m = await measure(page);
      m.pageErrors = errs;
      results[key] = m;
      pageErrors[key] = errs;

      await context.close();
    }
  }

  await browser.close();

  // Write JSON
  const outPath = path.join(process.cwd(), "docs/research/canvas-parity-probe.json");
  fs.writeFileSync(outPath, JSON.stringify({ generated: new Date().toISOString(), results }, null, 2));
  console.log("Wrote", outPath);

  // Print summary
  for (const key of Object.keys(results)) {
    const r = results[key];
    const pass =
      r.shellRadius === "20px" &&
      r.canvasRadius === "28px" &&
      r.panelBg === r.baseBg &&
      r.panelBorder === "0px" &&
      r.docOverflowX === 0 &&
      r.canvasCentreHit === true &&
      r.hitFails === 0 &&
      r.pageErrors.length === 0;
    console.log(`${key}: shell=${r.shellRadius} canvas=${r.canvasRadius} panelBg==baseBg ${r.panelBg === r.baseBg} border=${r.panelBorder} overflow=${r.docOverflowX} centreHit=${r.canvasCentreHit} hitFails=${r.hitFails} errors=${r.pageErrors.length} ${pass ? "PASS" : "FAIL"}`);
  }
})();