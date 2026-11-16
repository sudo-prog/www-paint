#!/usr/bin/env node
// react-ui-probe.cjs — drives the React/ui-sdk surface in real Chromium.
//
// Mac-owned. Measures what the build cannot: every control has an accessible
// name, meets the 44px floor, sits inside the viewport, and the ui-sdk Dialog
// really opens with a labelled title + a focusable field.
//
// Usage: NODE_PATH=<playwright-core> node scripts/react-ui-probe.cjs [url] [width] [out.json]

const { chromium } = require("playwright-core");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const url = process.argv[2] ?? "http://localhost:5178/";
const width = Number(process.argv[3] ?? 1440);
const out = process.argv[4] ?? "";

// Same resolution as scripts/a11y-sweep.cjs: prefer the macOS Chrome-for-Testing
// bundle, then the Linux cache, then the shell shim.
function findChromium() {
  const macCache = path.join(
    os.homedir(),
    "Library/Caches/ms-playwright"
  );
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

(async () => {
  const browser = await chromium.launch({
    executablePath: findChromium(),
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage({ viewport: { width, height: 900 } });

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-slot="listbox"]', { timeout: 15000 });

  // Seed one packet-less and one referenced profile, so the list, the row and
  // the confidence chip are all measured rather than skipped as empty. The
  // seed writes to localStorage only — it never touches a file. The payload
  // shape is the library's own (`[{id, savedAt, profile}]`).
  await page.evaluate(() => {
    const seed = (name, provenance) => {
      const profile = {
        schemaVersion: 1,
        id: `probe-${name.replace(/\s+/g, "-").toLowerCase()}`,
        name,
        version: "1.0.0",
        engine: { name: "www-paint", version: "0.1.0" },
        global: { style: "pencil", strokeCount: 1000 },
      };
      if (provenance) profile.provenance = provenance;
      return {
        id: profile.id,
        savedAt: new Date().toISOString(),
        profile,
      };
    };
    const rows = [
      seed("Plain pencil", null),
      seed("Conflicting refs", {
        refPacket: {
          refCount: 4,
          refs: [{}, {}, {}, {}],
          spread: { agreement: 0.49, scale: 0.67, orientation: 0.03, coherence: 0.96 },
        },
      }),
    ];
    if (!localStorage.getItem("www-paint.styleProfiles.v1")) {
      localStorage.setItem("www-paint.styleProfiles.v1", JSON.stringify(rows));
    }
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".library-row", { timeout: 15000 });

  const report = await page.evaluate(() => {
    // `offsetParent` is null for anything inside the top layer (a ui-sdk
    // dialog portals to <body> with position:fixed), so visibility is checked
    // by box + computed style instead.
    const shown = (el) => {
      if (el.getClientRects().length === 0) return false;
      const style = getComputedStyle(el);
      return style.visibility !== "hidden" && style.display !== "none";
    };
    const controls = [...document.querySelectorAll("button, input, [role]")].filter(
      (el) =>
        shown(el) &&
        // ui-sdk renders hidden submit helpers (aria-hidden) and the slider's
        // own 1px hit input; they are not controls a person can reach.
        el.getAttribute("aria-hidden") !== "true" &&
        (el.getAttribute("tabindex") === null || Number(el.getAttribute("tabindex")) >= 0)
    );
    const named = (el) => {
      const name =
        el.getAttribute("aria-label") ||
        el.getAttribute("aria-labelledby") ||
        (el.labels && el.labels[0] ? el.labels[0].textContent.trim() : "") ||
        el.textContent.trim();
      return Boolean(name && name.trim());
    };
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        x: Math.round(r.x),
        y: Math.round(r.y),
      };
    };
    return {
      controls: controls.length,
      unnamed: controls.filter((el) => !named(el)).map((el) => el.outerHTML.slice(0, 90)),
      underMin: controls
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width < 44 || r.height < 24;
        })
        .map((el) => ({ tag: el.tagName, name: el.getAttribute("aria-label"), ...box(el) })),
      offscreen: controls
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.right > innerWidth || r.bottom > innerHeight + 200;
        })
        .map((el) => ({ name: el.getAttribute("aria-label"), ...box(el) })),
      docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      listbox: Boolean(document.querySelector('[data-slot="listbox"]')),
      listboxItems: document.querySelectorAll('[data-slot="listbox-item"]').length,
      chip: (document.querySelector(".library-ref") || {}).textContent || null,
    };
  });

  await page.getByRole("button", { name: "Save current" }).click();
  await page.waitForTimeout(700);
  const dialog = await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"]');
    if (!el) return { open: false };
    const r = el.getBoundingClientRect();
    return {
      open: true,
      title: (document.querySelector('[data-slot="dialog-title"]') || {}).textContent || null,
      clipped: r.width > innerWidth || r.right > innerWidth,
      rect: { w: Math.round(r.width), h: Math.round(r.height) },
      fields: [...el.querySelectorAll("input")].map((i) => ({
        name: i.getAttribute("aria-label") || (i.labels && i.labels[0] ? i.labels[0].textContent.trim() : ""),
        w: Math.round(i.getBoundingClientRect().width),
        h: Math.round(i.getBoundingClientRect().height),
      })),
    };
  });

  if (out) fs.writeFileSync(out, JSON.stringify({ width, report, dialog, errors }, null, 2));

  console.log(`@ ${width}px`);
  console.log(
    `  controls ${report.controls}  unnamed ${report.unnamed.length}  underMin ${report.underMin.length}  offscreen ${report.offscreen.length}`
  );
  console.log(
    `  docOverflowX ${report.docOverflowX}  listbox ${report.listbox}  items ${report.listboxItems}  chip ${JSON.stringify((report.chip || "").trim())}`
  );
  console.log(`  dialog ${JSON.stringify(dialog)}`);
  console.log(
    `  pageErrors ${errors.length}${errors.length ? " -> " + errors.slice(0, 3).join(" | ") : ""}`
  );
  if (report.unnamed.length) console.log("  UNNAMED:", report.unnamed.slice(0, 5));
  if (report.underMin.length) console.log("  UNDERMIN:", report.underMin.slice(0, 5));

  await browser.close();
})();
