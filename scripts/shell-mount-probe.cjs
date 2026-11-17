#!/usr/bin/env node
// shell-mount-probe.cjs — mounts the React/ui-sdk surface in the REAL app shell
// (index.html on the static server) and measures it there, not on the Vite dev
// page. Catches what the dev page cannot: the shim import resolving, the bundle
// loading with no build step, the host bridge reaching the engine, and the panel
// co-existing with the vanilla panels.
//
//   NODE_PATH=<playwright-core> node scripts/shell-mount-probe.cjs [port] [width]
const { chromium } = require("playwright-core");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");

const port = process.argv[2] ?? "8097";
const width = Number(process.argv[3] ?? 1440);
const url = `http://127.0.0.1:${port}/index.html`;

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
  return undefined;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: findChromium(),
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage({ viewport: { width, height: 900 } });

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    // Chromium logs a bare "Failed to load resource … 404 (File not found)"
    // with no URL for the default /favicon.ico request. Match it by the
    // absence of a URL, so a REAL 404 (which carries its URL) still fails.
    if (text.includes("favicon")) return;
    if (/Failed to load resource/.test(text) && !/https?:\/\//.test(text)) return;
    errors.push(text);
  });

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Seed two profiles so the list/row/chip are really measured, then open the
  // surface through its own nav control.
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
      return { id: profile.id, savedAt: new Date().toISOString(), profile };
    };
    if (!localStorage.getItem("www-paint.styleProfiles.v1")) {
      localStorage.setItem(
        "www-paint.styleProfiles.v1",
        JSON.stringify([
          seed("Plain pencil", null),
          seed("Conflicting refs", {
            refPacket: {
              refCount: 4,
              refs: [{}, {}, {}, {}],
              spread: { agreement: 0.49, scale: 0.67, orientation: 0.03, coherence: 0.96 },
            },
          }),
        ])
      );
    }
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Open via the nav control — the only way a person reaches it.
  await page.click("#btn-react-surface");
  await page.waitForTimeout(700);

  const report = await page.evaluate(() => {
    const root = document.getElementById("react-root");
    const panel = document.querySelector("#react-root [data-slot='listbox']");
    const surface = document.querySelector("#react-root .surface");
    const links = [...document.querySelectorAll("link")].map((l) => l.id || l.href);
    const controls = [...document.querySelectorAll("#react-root button, #react-root input")]
      .filter((el) => {
        if (el.getAttribute("aria-hidden") === "true") return false;
        const t = el.getAttribute("tabindex");
        return t === null || Number(t) >= 0;
      });
    return {
      rootMounted: Boolean(root),
      panelMounted: Boolean(panel),
      surfaceMounted: Boolean(surface),
      agentBridge: Boolean(window.__WWW_PAINT_AGENT__),
      hostBridge: Boolean(window.__WWW_PAINT_HOST__),
      stylesheetIds: links,
      reactControls: controls.length,
      rows: document.querySelectorAll("#react-root .library-row").length,
      chip: (document.querySelector("#react-root .library-ref") || {}).textContent || null,
      toggleExpanded: document
        .getElementById("btn-react-surface")
        ?.getAttribute("aria-expanded"),
      rootRect: (() => {
        const r = root.getBoundingClientRect();
        return {
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
          onScreen: r.x >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
        };
      })(),
      appStillAlive: Boolean(window._wwwPaint),
      vanillaLibraryStillThere: Boolean(document.getElementById("style-library-root")),
      agentSees: window.__WWW_PAINT_AGENT__?.snapshot().filter(
        (e) => !e.offPage && e.component !== "more"
      ).length,
      docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  console.log(`@ ${width}px  ${url}`);
  console.log(`  react-root ${report.rootMounted}  panel ${report.panelMounted}  surface ${report.surfaceMounted}`);
  console.log(`  toggle expanded=${report.toggleExpanded}  root rect=${JSON.stringify(report.rootRect)}`);
  console.log(`  agentBridge ${report.agentBridge}  hostBridge ${report.hostBridge}  agentSees ${report.agentSees}`);
  console.log(`  reactControls ${report.reactControls}  rows ${report.rows}  chip ${JSON.stringify(report.chip)}`);
  console.log(`  stylesheet ${JSON.stringify(report.stylesheetIds)}`);
  console.log(`  app ${report.appStillAlive}  vanillaLibrary ${report.vanillaLibraryStillThere}  docOverflowX ${report.docOverflowX}`);
  console.log(`  pageErrors ${errors.length}${errors.length ? " -> " + errors.slice(0, 4).join(" | ") : ""}`);

  const realErrors = errors.filter((e) => !e.includes("favicon"));
  const pass =
    report.rootMounted &&
    report.panelMounted &&
    report.agentBridge &&
    report.hostBridge &&
    report.appStillAlive &&
    report.rows > 0 &&
    report.rootRect.onScreen &&
    report.docOverflowX === 0 &&
    realErrors.length === 0;
  console.log(pass ? "  PASS" : "  FAIL");
  await browser.close();
  process.exit(pass ? 0 : 1);
})();
