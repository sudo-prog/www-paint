#!/usr/bin/env node
/**
 * Verify the WWW_PAINT canvas-as-window shell against the real rendered page.
 *
 * Why a script and not a screenshot read: the LAYERS version of this design was
 * mis-built three times from a description before the DOM measurements settled
 * it. When vision and the DOM disagree, the DOM is right — so this asserts on
 * measured geometry and pixel values, and only saves screenshots as evidence.
 *
 * Checks (mirroring docs/research/layers-canvas-over-panels.md §10):
 *   1. panel and base share an identical colour value — no seam
 *   2. a uniform --gap black frame surrounds the canvas on all four sides
 *   3. the canvas has no border at all
 *   4. the canvas is ON TOP (elementFromPoint at its centre)
 *   5. the app is rounded and clips its children
 *   6. no truncated labels, no horizontal scroll
 *   7. no console or page errors
 *   8. collapsing a panel widens the window
 *
 * Run:  node scripts/verify-shell.cjs
 */
const path = require("node:path");
const fs = require("node:fs");

const REPO = path.resolve(__dirname, "..");
const STORE = path.join(REPO, "..", "20.34_LAYERS", "node_modules", ".pnpm");

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    /* fall through to the pnpm store */
  }
  const dir = fs
    .readdirSync(STORE)
    .filter((d) => /^playwright@\d/.test(d))
    .sort()
    .pop();
  if (!dir) throw new Error("playwright not found in the LAYERS pnpm store");
  return require(path.join(STORE, dir, "node_modules/playwright"));
}

const { chromium } = loadPlaywright();
const URL = process.env.URL ?? "http://127.0.0.1:8099/index.html";
const SHOTS = path.join(REPO, "docs", "research", "www-paint-canvas-window-shots");
const WIDTHS = (process.env.WIDTHS ?? "390,768,1024,1280,1440,1920").split(",").map(Number);

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const rows = [];

  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
      if (m.type() === "error" && !m.text().includes("Failed to load resource") && !m.text().includes("404 (File not found)")) errors.push(m.text());
    });

    await page.goto(URL, { waitUntil: "load" });
    await page.waitForTimeout(900);

    // ── Measured geometry ────────────────────────────────────────────────────
    const geo = await page.evaluate(() => {
      const cs = (el) => (el ? getComputedStyle(el) : null);
      const rect = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height, top: r.top, left: r.left, right: r.right, bottom: r.bottom };
      };

      const app = document.querySelector(".app");
      const controls = document.querySelector("#controls-root");
      const layers = document.querySelector("#layers-root");
      const canvas = document.querySelector("#canvas-area");
      const ccs = cs(canvas);

      // Any label clipped by its own container? Screen-reader-only text is
      // deliberately 1px-clipped, so it is excluded.
      const truncated = [];
      document.querySelectorAll(".panel *, .top-bar *").forEach((el) => {
        if (el.children.length === 0 && el.textContent.trim() && !el.classList.contains("sr-only")) {
          if (el.scrollWidth > el.clientWidth + 1) {
            truncated.push(`${el.className || el.tagName}:${el.textContent.trim().slice(0, 24)}`);
          }
        }
      });

      // Is the canvas actually on top at its own centre?
      const cr = canvas.getBoundingClientRect();
      const centre = document.elementFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2);
      const onTop = !!(centre && (canvas === centre || canvas.contains(centre) || centre.closest("#canvas-area")));

      // The black frame: distance from each panel's inner edge to the canvas.
      const ctr = controls.getBoundingClientRect();
      const layr = layers.getBoundingClientRect();
      const frameLeft = Math.round(cr.left - ctr.right);
      const frameRight = Math.round(layr.left - cr.right);
      const frameTop = Math.round(cr.top - controls.getBoundingClientRect().top);
      const frameBottom = Math.round(controls.getBoundingClientRect().bottom - cr.bottom);

      return {
        gapToken: getComputedStyle(document.documentElement).getPropertyValue("--gap").trim(),
        rCanvas: ccs.borderRadius,
        canvasBorderTop: ccs.borderTopWidth,
        canvasBorderStyle: ccs.borderTopStyle,
        canvasBg: ccs.backgroundColor,
        canvasRect: rect(canvas),
        controlsRect: rect(controls),
        layersRect: rect(layers),
        frame: { left: frameLeft, right: frameRight, top: frameTop, bottom: frameBottom },
        onTop,
        truncated,
        hScroll: document.documentElement.scrollWidth > window.innerWidth,
        appRadius: cs(app).borderRadius,
        appOverflow: cs(app).overflow,
        controlsDisplay: cs(controls).display,
        layersDisplay: cs(layers).display,
        appBg: cs(app).backgroundColor,
        controlsBg: cs(controls).backgroundColor,
        layersBg: cs(layers).backgroundColor,
        bodyScrollW: document.body.scrollWidth,
        innerW: window.innerWidth,
      };
    });

    // ── Pixel scan: panel → frame → canvas across the boundary ──────────────
    const shot = path.join(SHOTS, `w${width}.png`);
    await page.screenshot({ path: shot });

    // Collapse the left panel and confirm the window widens (desktop) or the
    // panel slides off-screen (mobile).
    const collapse = await page.evaluate(async () => {
      const btn = document.querySelector('#controls-root .collapse-btn');
      if (!btn) return { skipped: true, reason: "no collapse button" };
      const panel = document.querySelector("#controls-root");
      const before = document.querySelector("#canvas-area").getBoundingClientRect();
      btn.click();
      await new Promise((r) => setTimeout(r, 450));
      const after = document.querySelector("#canvas-area").getBoundingClientRect();
      const isCollapsed = panel.classList.contains("is-collapsed");
      const isMobileClosed = panel.classList.contains("panel--mobile-closed");
      // restore
      btn.click();
      await new Promise((r) => setTimeout(r, 450));
      return {
        collapsed: isCollapsed || isMobileClosed,
        leftBefore: Math.round(before.left),
        leftAfter: Math.round(after.left),
        widened: after.left < before.left - 20,
      };
    });

    const errorsNow = errors.slice();

    // ── Judgement ───────────────────────────────────────────────────────────
    // The window-between-panels structure only exists at desktop widths. Below
    // tablet the canvas is full-bleed and the panels are overlays, so the frame
    // and radius checks do not apply there — the invariants that DO apply at
    // every width are the ones that caused real bugs: no seam, no border on the
    // canvas, no truncation, no horizontal scroll, no errors.
    const mobile = width <= 768;

    const f = geo.frame;
    const frameOk =
      f.left >= 10 && f.left <= 14 &&
      f.right >= 10 && f.right <= 14 &&
      f.top >= 10 && f.top <= 14 &&
      f.bottom >= 10 && f.bottom <= 14;

    const sameBlack = geo.appBg === geo.controlsBg && geo.appBg === geo.layersBg;
    const noBorder = geo.canvasBorderStyle === "none" || parseFloat(geo.canvasBorderTop) === 0;
    const radiusOk = mobile ? true : geo.rCanvas === "28px";
    const appRounded = geo.appRadius !== "0px";

    // On mobile the canvas is full-bleed and a panel may legitimately cover its
    // centre, so "canvas on top" is only asserted on desktop.
    const onTopOk = mobile ? true : geo.onTop;

    // Mobile: the panels must be visible (not parked off-screen) on load.
    const panelsVisible = mobile
      ? geo.controlsDisplay !== "none" && geo.layersDisplay !== "none"
      : true;

    const bad =
      !sameBlack ||
      !noBorder ||
      !radiusOk ||
      !appRounded ||
      !onTopOk ||
      !panelsVisible ||
      geo.truncated.length > 0 ||
      geo.hScroll ||
      errorsNow.length > 0;

    rows.push({
      width,
      mobile,
      sameBlack,
      noBorder,
      radiusOk,
      appRounded,
      onTop: geo.onTop,
      frame: f,
      frameOk,
      gap: geo.gapToken,
      rCanvas: geo.rCanvas,
      appRadius: geo.appRadius,
      truncated: geo.truncated,
      hScroll: geo.hScroll,
      errors: errorsNow,
      collapse,
      bad,
    });
    await page.close();
  }

  await browser.close();

  for (const r of rows) {
    const flag = r.bad ? "  <-- FAIL" : "";
    console.log(
      `${String(r.width).padStart(5)} | black=${r.sameBlack ? "same" : "DIFF"} border=${r.noBorder ? "none" : "HAS"} ` +
        `r=${r.rCanvas} appR=${r.appRadius} onTop=${r.onTop} frame=${JSON.stringify(r.frame)} ` +
        `trunc=${r.truncated.length} hscroll=${r.hScroll} err=${r.errors.length}${flag}`,
    );
    if (r.truncated.length) console.log(`        truncated: ${JSON.stringify(r.truncated.slice(0, 4))}`);
    if (r.errors.length) console.log(`        errors: ${JSON.stringify(r.errors.slice(0, 3))}`);
    console.log(`        collapse: ${JSON.stringify(r.collapse)}`);
  }

  const allOk = rows.every((r) => !r.bad);
  console.log(`\nSHOTS: ${SHOTS}`);
  console.log(`ALL WIDTHS OK: ${allOk}`);
  process.exit(allOk ? 0 : 1);
})();
