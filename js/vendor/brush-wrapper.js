/**
 * brush-wrapper.js — Dynamically imports the vendored p5.brush ESM bundle
 * and re-exports the API we need for the auto-paint pipeline.
 *
 * The bundled brush.esm.js IS a valid ES module (it ends with `export { ... }`)
 * but it expects runtime adapters to be registered before any brush operation.
 * We import it, then call the registration hooks before use.
 */

const BRUSH_BUNDLE_URL = new URL('./brush.esm.js', import.meta.url);

let _brushModule = null;
let _loadPromise = null;

export async function getBrushAPI() {
  if (!_loadPromise) {
    _loadPromise = import(BRUSH_BUNDLE_URL)
      .then(mod => {
        _brushModule = mod;
        return mod;
      })
      .catch(err => {
        console.error('[brush] failed to load bundle:', err);
        throw err;
      });
  }
  return _loadPromise;
}

export function isBrushLoaded() {
  return !!_brushModule;
}

export async function ensureBrushLoaded() {
  if (!_brushModule) {
    await getBrushAPI();
  }
  return _brushModule;
}
