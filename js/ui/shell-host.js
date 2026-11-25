// js/ui/shell-host.js — Mac-owned host for the LAYERS shell controls.
// Wires the radius buttons, Expanded/Navbar mode buttons, theme toggle,
// initial collapse on narrow viewports, and strip-dims sync. Runs after initApp
// + the other hosts.
let applied = false;

export function initShell(app) {
  if (applied || window.__shellHostApplied) return;
  applied = true;
  window.__shellHostApplied = true;

  // Radius buttons
  document.querySelectorAll(".radius-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = Number(btn.getAttribute("data-radius"));
      if (!Number.isFinite(v)) return;
      const root = document.documentElement;
      root.style.setProperty("--r-canvas", v + "px");
      root.style.setProperty("--r-panel", Math.max(6, Math.round(v * 0.7)) + "px");
      document.querySelectorAll(".radius-btn").forEach((b) => {
        b.setAttribute("aria-pressed", String(b === btn));
      });
    });
  });

  const controlsPanel = document.getElementById("controls-root");
  const layersPanel = document.getElementById("layers-root");

  function collapseAll(collapsed) {
    // On mobile, panels are overlays: keep them closed in both modes so the
    // canvas stays full-bleed. The floating toggles open them on demand.
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    const c = mobile ? true : collapsed;
    if (controlsPanel && app && typeof app._setPanelCollapsed === "function") {
      app._setPanelCollapsed(controlsPanel, c);
    }
    if (layersPanel && app && typeof app._setPanelCollapsed === "function") {
      app._setPanelCollapsed(layersPanel, c);
    }
    syncNavButtons(collapsed);
  }

  function syncNavButtons(allCollapsed) {
    const left = controlsPanel;
    const right = layersPanel;
    const ac = (allCollapsed === undefined)
      ? (!!(left && left.classList.contains("is-collapsed")) &&
         !!(right && right.classList.contains("is-collapsed")))
      : allCollapsed;
    document.querySelectorAll(".nav-btn").forEach((b) => {
      const nav = b.getAttribute("data-nav");
      if (nav === "collapsed") b.setAttribute("aria-pressed", String(ac));
      if (nav === "expanded") b.setAttribute("aria-pressed", String(!ac));
    });
  }

  // Expanded / Navbar mode buttons
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    const nav = btn.getAttribute("data-nav");
    if (nav !== "expanded" && nav !== "collapsed") return;
    btn.addEventListener("click", () => {
      const collapseAllFlag = nav === "collapsed";
      collapseAll(collapseAllFlag);
    });
  });

  // Theme toggle
  const themeBtn = document.getElementById("toggle-theme");
  if (themeBtn) {
    const syncIcon = () => {
      const dark = document.documentElement.getAttribute("data-theme") !== "light";
      themeBtn.innerHTML = dark
        ? '<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>'
        : '<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    };
    themeBtn.addEventListener("click", () => {
      try {
        if (window.__UISettings && typeof window.__UISettings.toggleTheme === "function") {
          window.__UISettings.toggleTheme();
        } else {
          const root = document.documentElement;
          const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
          root.setAttribute("data-theme", next);
        }
      } catch (e) {}
      syncIcon();
    });
    syncIcon();
  }

  // On mobile, move the settings button to body so position:fixed is
  // relative to the viewport (its parent .insert-bar has a transform).
  if (window.matchMedia("(max-width: 768px)").matches) {
    const sb = document.getElementById("btn-ui-settings");
    if (sb && sb.parentElement !== document.body) {
      document.body.appendChild(sb);
    }
  }

  // Re-attach status bar as the left rail footer (controls.js clears it).
  const controlsRoot = document.getElementById("controls-root");
  if (controlsRoot && app) {
    // controls.js clears controls-root on init; re-attach the app's status bar
    // (captured before the clear) so its content survives.
    let sb = app.statusBar;
    if (!sb) sb = document.getElementById("status-bar");
    if (!sb) {
      sb = document.createElement("footer");
      sb.id = "status-bar";
      sb.className = "panel-footer status-footer";
      sb.setAttribute("role", "status");
      sb.setAttribute("aria-live", "polite");
      sb.innerHTML = '<span class="status__msg" id="status-message">Ready</span>';
    }
    sb.className = "panel-footer status-footer";
    sb.id = "status-bar";
    if (sb.parentElement !== controlsRoot) controlsRoot.appendChild(sb);
    app.statusBar = sb;
  }

  // ≤900px: default collapsed (navbar) mode
  if (window.innerWidth <= 900) {
    collapseAll(true);
  }

  // strip-dims sync with canvas-dims
  const stripDims = document.getElementById("strip-dims");
  const canvasDims = document.getElementById("canvas-dims");
  if (stripDims && canvasDims) {
    const sync = () => { stripDims.textContent = canvasDims.textContent; };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(canvasDims, { childList: true, subtree: true, characterData: true });
  }
  // also sync the other strip-dims variants if present
  ["strip-dims-paint","strip-dims-media","strip-dims-lib"].forEach((id) => {
    const el = document.getElementById(id);
    if (el && canvasDims) {
      const sync = () => { el.textContent = canvasDims.textContent; };
      sync();
      const obs = new MutationObserver(sync);
      obs.observe(canvasDims, { childList: true, subtree: true, characterData: true });
    }
  });
}