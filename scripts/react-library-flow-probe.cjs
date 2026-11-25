#!/usr/bin/env node
// react-library-flow-probe.cjs — drives the React/ui-sdk Style Library in the
// REAL shell (index.html on the static server) through the same journey the
// Maestro flow takes: open → save → row contract → export → delete → close.
//
// Mac-owned. House style copied from scripts/react-ui-probe.cjs. It exists
// because Maestro asserts the ACCESSIBILITY TREE, not geometry: the flow can be
// green while a control is clipped, under the 44px floor, or past the viewport.
//
// The duplicate-row regression (`createRoot()` twice on one node) is invisible
// to "the panel renders", so `rowCount` / `duplicateRows` are the primary
// signal — exactly 1 row after one save, exactly 0 after the delete.
//
// Shell-close gate is width-aware: at <=768px the brush rail (`#controls-root`)
// is legitimately collapsed behind `.mobile-toggle#toggle-controls`, so closing
// the React surface must NOT be required to un-collapse it. At those widths we
// assert shell integrity via `#toggle-controls` existing and `#canvas-area`
// having non-zero size; the strict `#controls-root` visibility gate applies
// only at >768px where the rail is persistently visible. This is a test-gate
// fix, not an app/UI behavior change.
//
// Usage:
//   NODE_PATH=<playwright-core> node scripts/react-library-flow-probe.cjs \
//     --url=http://127.0.0.1:8099/index.html --widths=390,1440 \
//     --out=docs/research/style-library-react-probe.json

const { chromium } = require("playwright-core");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

/* ── args ─────────────────────────────────────────────────────────────── */

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const URL = arg("url", "http://127.0.0.1:8099/index.html");
const WIDTHS = arg("widths", "390,1440")
  .split(",")
  .map((w) => Number(w.trim()))
  .filter(Boolean);
const OUT = arg("out", "");
const PROFILE_NAME = arg("name", "Flow check profile");

/** The flow's own viewport per width: 390x844 mobile, otherwise 1440x900. */
function heightFor(width) {
  return width <= 768 ? 844 : 900;
}

/* ── chromium ──────────────────────────────────────────────────────────── */

// Same resolution as scripts/a11y-sweep.cjs: prefer the macOS Chrome-for-Testing
// bundle, then the Linux cache.
function findChromium() {
  const macCache = path.join(os.homedir(), "Library/Caches/ms-playwright");
  const dirs = (fs.existsSync(macCache) ? fs.readdirSync(macCache) : [])
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => parseInt(b.split("-")[1], 10) - parseInt(a.split("-")[1], 10));
  for (const d of dirs) {
    const p = path.join(
      macCache,
      d,
      "chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
    );
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

/* ── error classification ─────────────────────────────────────────────── */

/**
 * Split captured console/page errors into real errors and known browser
 * artefacts. `/favicon.ico` is requested by Chromium at <=390px and the shell
 * ships no favicon; the repo's own react surface also injects a data: icon, so
 * this is a browser artefact, not a defect. A REAL 404 carries its URL.
 */
function classify(messages) {
  const artefacts = [];
  const errors = [];
  for (const text of messages) {
    if (text.includes("favicon")) artefacts.push(text);
    else if (/Failed to load resource/.test(text) && !/https?:\/\//.test(text)) artefacts.push(text);
    else errors.push(text);
  }
  return { errors, artefacts };
}

/* ── the journey ───────────────────────────────────────────────────────── */

async function runWidth(browser, width) {
  const height = heightFor(width);
  const page = await browser.newPage({ viewport: { width, height } });

  const captured = [];
  page.on("pageerror", (e) => captured.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") captured.push(m.text());
  });

  await page.goto(URL, { waitUntil: "networkidle" });
  // `attached`, not `visible`: the surface starts CLOSED (`visibility:hidden`),
  // so a visible-wait would time out on a correctly closed panel.
  await page.waitForSelector("#react-root", { state: "attached", timeout: 20000 });

  // A deterministic start: the library persists to localStorage, so a previous
  // run's rows would otherwise be measured as this run's.
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("#react-root", { state: "attached", timeout: 20000 });
  await page.waitForTimeout(600);

  const initial = await page.evaluate(() => {
    const root = document.getElementById("react-root");
    const r = root.getBoundingClientRect();
    return {
      closed: root.dataset.closed === "true",
      box: { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) },
      mounted: root.dataset.mounted === "true",
    };
  });

  // Open via the nav control — the only way a person reaches it.
  await page.click("#btn-react-surface");
  await page.waitForTimeout(700);

  const opened = await page.evaluate(() => {
    const root = document.getElementById("react-root");
    const r = root.getBoundingClientRect();
    const clip = (el) => (el ? el.scrollWidth - el.clientWidth : null);
    const past = [...document.querySelectorAll("#profile-root button, #profile-root input")]
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => ({ id: el.id || null, right: Math.round(el.getBoundingClientRect().right) }))
      .filter((c) => c.right > innerWidth);
    return {
      open: root.dataset.closed !== "true" && r.width > 0 && r.height > 0,
      closed: root.dataset.closed === "true",
      box: { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) },
      clipX: {
        profileRoot: clip(document.getElementById("profile-root")),
        panelBody: clip(document.querySelector("#profile-root .sp-body")),
      },
      pastViewport: past,
      toggleExpanded: document.getElementById("btn-react-surface")?.getAttribute("aria-expanded"),
    };
  });

  // ── Save ──────────────────────────────────────────────────────────────
  // The ui-sdk Dialog portals to <body>, so it is matched by its own
  // `data-slot` — a bare `[role="dialog"]` matches the shell's legacy
  // `#export-root` modal first and never resolves.
  const DIALOG = '[data-slot="dialog-content"]';
  await page.click("#sl-save-current");
  await page.waitForSelector(DIALOG, { timeout: 10000 });
  await page.waitForTimeout(300);
  await page.click("#profile-name-input");
  await page.fill("#profile-name-input", PROFILE_NAME);
  await page.click("#sl-save-confirm");
  await page.waitForSelector(DIALOG, { state: "detached", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);

  const afterSave = await page.evaluate((name) => {
    const rows = [...document.querySelectorAll("#profile-root .sp-row")];
    const names = rows.map((r) => (r.querySelector(".sp-row-name") || {}).textContent || "");
    const unique = new Set(names);
    const btn = (id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { id, w: Math.round(r.width), h: Math.round(r.height) };
    };
    return {
      rowCount: rows.length,
      duplicateRows: rows.length - unique.size,
      rowNames: names,
      savedNamePresent: names.includes(name),
      selectedRows: document.querySelectorAll("#profile-root .sp-row.is-active").length,
      buttons: ["sl-apply", "sl-export", "sl-delete"].map(btn),
      dialogClosed: !document.querySelector('[data-slot="dialog-content"]'),
    };
  }, PROFILE_NAME);

  // ── Export ────────────────────────────────────────────────────────────
  await page.click("#sl-export");
  await page.waitForSelector(DIALOG, { timeout: 10000 });
  await page.waitForTimeout(300);
  const exportDialog = await page.evaluate(() => {
    const el = document.querySelector('[data-slot="dialog-content"]');
    return {
      title: (document.querySelector('[data-slot="dialog-title"]') || {}).textContent || null,
      json: (document.querySelector(".sp-json") || {}).textContent || "",
    };
  });
  await page.click("#sl-export-close");
  await page.waitForSelector(DIALOG, { state: "detached", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);

  // ── Delete ────────────────────────────────────────────────────────────
  await page.click("#sl-delete");
  await page.waitForSelector(DIALOG, { timeout: 10000 });
  await page.waitForTimeout(300);
  const deleteDialog = await page.evaluate(() => {
    const el = document.querySelector('[data-slot="dialog-content"]');
    const confirm = document.getElementById("sl-delete-confirm");
    return {
      title: (document.querySelector('[data-slot="dialog-title"]') || {}).textContent || null,
      description: (document.querySelector('[data-slot="dialog-description"]') || {}).textContent || null,
      confirmLabel: confirm ? confirm.textContent.trim() : null,
      confirmDestructive:
        !!confirm &&
        (/destructive/.test(confirm.className) || confirm.getAttribute("data-variant") === "destructive"),
    };
  });
  await page.click("#sl-delete-confirm");
  await page.waitForSelector(DIALOG, { state: "detached", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);

  const afterDelete = await page.evaluate(() => ({
    rowCount: document.querySelectorAll("#profile-root .sp-row").length,
    duplicateRows: 0,
    emptyText: (document.querySelector("#profile-root .sp-empty") || {}).textContent || null,
    dialogClosed: !document.querySelector('[data-slot="dialog-content"]'),
  }));

  // Screenshot at the open-panel state (after the delete, panel still open).
  await page.screenshot({ path: path.join("docs/research", `style-library-react-${width}.png`) });

  // ── Close ─────────────────────────────────────────────────────────────
  await page.click("#btn-react-surface");
  await page.waitForTimeout(700);
  const closed = await page.evaluate((w) => {
    const root = document.getElementById("react-root");
    const brush = document.getElementById("controls-root");
    const toggle = document.getElementById("toggle-controls");
    const canvas = document.getElementById("canvas-area");
    const br = brush ? brush.getBoundingClientRect() : null;
    const cr = canvas ? canvas.getBoundingClientRect() : null;
    const brushVisible = Boolean(brush && br.width > 0 && getComputedStyle(brush).visibility !== "hidden");
    const shellIntact = Boolean(toggle && cr && cr.width > 0 && cr.height > 0);
    return {
      closed: root.dataset.closed === "true",
      visibility: getComputedStyle(root).visibility,
      brushVisible,
      shellIntact,
      widthGate: w <= 768 ? "shell-intact-mobile" : "brush-visible-desktop",
      toggleExpanded: document.getElementById("btn-react-surface")?.getAttribute("aria-expanded"),
    };
  }, width);

  const { errors, artefacts } = classify(captured);
  await page.close();

  const buttonsOk = afterSave.buttons.every((b) => b && b.w >= 44 && b.h >= 44);
  const shellOk = width <= 768 ? closed.shellIntact : closed.brushVisible;
  const pass =
    initial.closed &&
    initial.box.w > 0 &&
    opened.open &&
    afterSave.rowCount === 1 &&
    afterSave.duplicateRows === 0 &&
    afterSave.savedNamePresent &&
    afterSave.selectedRows === 1 &&
    afterSave.dialogClosed &&
    exportDialog.title === "Export profile" &&
    exportDialog.json.length > 0 &&
    deleteDialog.title === "Delete this profile?" &&
    /cannot be undone/.test(deleteDialog.description || "") &&
    afterDelete.rowCount === 0 &&
    /No profiles in the library yet/.test(afterDelete.emptyText || "") &&
    afterDelete.dialogClosed &&
    closed.closed &&
    shellOk &&
    opened.clipX.profileRoot === 0 &&
    opened.clipX.panelBody === 0 &&
    opened.pastViewport.length === 0 &&
    buttonsOk &&
    errors.length === 0;

  return {
    width,
    height,
    initial,
    open: opened,
    afterSave,
    exportDialog,
    deleteDialog,
    afterDelete,
    closed,
    buttonsOk,
    pageErrors: errors,
    artefacts,
    pass,
  };
}

/* ── main ──────────────────────────────────────────────────────────────── */

(async () => {
  const browser = await chromium.launch({
    executablePath: findChromium(),
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const results = [];
  for (const width of WIDTHS) {
    const r = await runWidth(browser, width);
    results.push(r);
    console.log(`@ ${r.width}px`);
    console.log(
      `  open ${r.open.open} (closed=${r.open.closed} box=${r.open.box.w}x${r.open.box.h}@${r.open.box.x},${r.open.box.y} expanded=${r.open.toggleExpanded})`
    );
    console.log(
      `  rowCount afterSave ${r.afterSave.rowCount}  duplicateRows ${r.afterSave.duplicateRows}  selectedRows ${r.afterSave.selectedRows}  names ${JSON.stringify(r.afterSave.rowNames)}`
    );
    console.log(`  buttons ${JSON.stringify(r.afterSave.buttons)}  all>=44 ${r.buttonsOk}`);
    console.log(
      `  clipX profileRoot ${r.open.clipX.profileRoot}  panelBody ${r.open.clipX.panelBody}  pastViewport ${r.open.pastViewport.length}`
    );
    console.log(
      `  export ${JSON.stringify(r.exportDialog.title)} json ${r.exportDialog.json.length}B  delete ${JSON.stringify(r.deleteDialog.title)} confirm ${JSON.stringify(r.deleteDialog.confirmLabel)}`
    );
    console.log(
      `  rowCount afterDelete ${r.afterDelete.rowCount}  empty ${JSON.stringify(r.afterDelete.emptyText)}  closed ${r.closed.closed} shell ${r.closed.widthGate} brush ${r.closed.brushVisible} intact ${r.closed.shellIntact}`
    );
    console.log(
      `  pageErrors ${r.pageErrors.length}${r.pageErrors.length ? " -> " + r.pageErrors.slice(0, 3).join(" | ") : ""}  artefacts ${r.artefacts.length}`
    );
    console.log(r.pass ? "  PASS" : "  FAIL");
  }

  await browser.close();

  if (OUT) {
    fs.writeFileSync(OUT, JSON.stringify({ url: URL, profileName: PROFILE_NAME, results }, null, 2));
    console.log(`\nwrote ${OUT}`);
  }

  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} width(s) PASS`);
  process.exit(failed ? 1 : 0);
})();
