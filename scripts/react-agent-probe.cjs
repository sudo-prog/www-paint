#!/usr/bin/env node
// react-agent-probe.cjs — the ui-sdk agent-readiness check for the React
// surface (skill: references/agent-ready.md#prove-it-with-a-test).
//
//   1. every component the bridge sees has a label (an agent finds controls by
//      label, so an unnamed one is unreachable);
//   2. the labels a task names are present;
//   3. an agent can act: press Save, set the name, press Save profile.
//
// NODE_PATH=<playwright-core> node scripts/react-agent-probe.cjs [width]
const { chromium } = require("playwright-core");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");

const width = Number(process.argv[2] ?? 1440);

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
  await page.goto("http://localhost:5178/js/ui/react/index.html", {
    waitUntil: "networkidle",
  });

  // Seed the same two profiles as react-ui-probe.cjs, or the list is empty.
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
  await page.waitForSelector(".library-row", { timeout: 15000 });
  // Re-render after the seed reload: the bridge is created before React renders,
  // so a reload gives a fresh bridge bound to the seeded list.
  await page.waitForFunction(() => window.__WWW_PAINT_AGENT__?.snapshot().length > 0, null, {
    timeout: 15000,
  });

  const result = await page.evaluate(async () => {
    const agent = window.__WWW_PAINT_AGENT__;
    const live = () =>
      agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more");
    const pick = (list, label, component) =>
      list.find((entry) => entry.label === label && entry.component === component) ??
      list.find((entry) => entry.label === label);

    const first = live();
    const unnamed = first.filter((entry) => !entry.label);
    const trigger = pick(first, "Save current settings as a profile", "button");

    // A closed dialog's contents are not on the page: open it first, then the
    // bridge sees the field and the confirming button.
    const opened = await agent.act({ steps: [{ ref: trigger.ref, action: "press" }] });
    const second = live();
    const nameField = pick(second, "Profile name", "input");
    const confirm = pick(second, "Save profile", "button");

    const applied = nameField
      ? await agent.act({
          steps: [
            { ref: nameField.ref, action: "setValue", args: ["Agent saved"] },
            { ref: confirm.ref, action: "press" },
          ],
        })
      : { ok: false, error: { message: "Profile name field never appeared" } };
    // A press can report ok while a change callback cancelled the value; read
    // the field back rather than trusting `ok` alone.
    const fieldValue = nameField ? nameField.get?.()?.value ?? null : null;

    const labels = live().map((entry) => entry.label);
    return {
      componentCount: first.length,
      unnamed: unnamed.map((entry) => `${entry.component} ${entry.ref}`),
      labels,
      resolved: {
        trigger: `${trigger?.component}:${trigger?.ref}`,
        nameField: `${nameField?.component}:${nameField?.ref}`,
        confirm: `${confirm?.component}:${confirm?.ref}`,
      },
      openOk: opened.ok,
      openError: opened.error?.message ?? null,
      actOk: applied.ok,
      actError: applied.error?.message ?? null,
      fieldValue,
      rowsBefore: 2,
      rowsAfter: document.querySelectorAll(".library-row").length,
    };
  });

  console.log(`@ ${width}px`);
  console.log(`  components ${result.componentCount}  unnamed ${result.unnamed.length}`);
  console.log(`  labels: ${result.labels.join(" | ")}`);
  console.log(`  resolved refs: ${JSON.stringify(result.resolved)}`);
  console.log(`  open ok=${result.openOk}  error=${result.openError ?? "none"}`);
  console.log(`  agent act ok=${result.actOk}  error=${result.actError ?? "none"}`);
  console.log(`  field value after agent: ${JSON.stringify(result.fieldValue)}`);
  console.log(`  rows ${result.rowsBefore} -> ${result.rowsAfter}`);
  if (result.unnamed.length) console.log("  UNNAMED:", result.unnamed);

  const pass =
    result.unnamed.length === 0 &&
    result.actOk &&
    result.rowsAfter === result.rowsBefore + 1;
  console.log(pass ? "  PASS" : "  FAIL");
  await browser.close();
  process.exit(pass ? 0 : 1);
})();
