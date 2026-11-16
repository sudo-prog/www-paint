import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The app itself stays a no-build static site (index.html + importmap).
// This config serves ONE Mac-owned React surface: js/ui/react/index.html.
// `npm run ui` (dev) / `npm run ui:build` (bundle to ui-dist/).
export default defineConfig({
  root: "js/ui/react",
  // Relative asset URLs so the built surface works from file:// and any subpath.
  base: "./",
  plugins: [react()],
  server: {
    port: 5178,
    strictPort: true,
  },
  build: {
    // Resolved relative to `root` (js/ui/react) → the repo-root ui-dist/.
    outDir: "../../../ui-dist",
    emptyOutDir: true,
  },
});
