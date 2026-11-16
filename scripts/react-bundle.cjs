/**
 * react-bundle.cjs — build the React/ui-sdk surface into ONE committed ES
 * module (`js/ui/react/bundle.js`), so the app can mount it from `index.html`
 * with a plain import-map entry and NO build step at runtime.
 *
 * Run after editing anything in `js/ui/react/`: `npm run react:bundle`
 * (or `node scripts/react-bundle.cjs`). Vite remains the dev server (`npm run
 * ui`); this is the production path.
 *
 * Mac-owned. The bundle is a build artefact that IS committed (unlike
 * `ui-dist/`), because the site itself has no build step — the same reason
 * `index.maestro.html` loads `js/ui/bundle.js`.
 */
const { buildSync } = require("esbuild");
const fs = require("node:fs");
const path = require("node:path");

const OUT_DIR = "js/ui/react";
const OUT = path.join(OUT_DIR, "bundle.js");

const result = buildSync({
  entryPoints: [path.join(OUT_DIR, "main.jsx")],
  bundle: true,
  format: "esm",
  target: ["es2022"],
  platform: "browser",
  jsx: "automatic",
  // The app already has exactly one copy of React; keep this bundle
  // self-contained so it cannot diverge from the page.
  outfile: OUT,
  minify: true,
  sourcemap: false,
  logLevel: "info",
  define: { "process.env.NODE_ENV": '"production"' },
});

const bytes = fs.statSync(OUT).size;
const lines = fs.readFileSync(OUT, "utf8").split("\n").length;

console.log(`\nreact bundle → ${OUT}  ${(bytes / 1024).toFixed(1)} kB  ${lines} line(s)`);
if (result.errors.length) process.exit(1);
