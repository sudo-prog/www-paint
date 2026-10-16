/**
 * Debug Overlay — terminal-style error/warning capture panel.
 *
 * Hooks console.error, console.warn, window 'error', and
 * 'unhandledrejection'. Stores all logs in window.__debugSession.
 * Status bar turns red on any error/warn and reverts after 4s.
 * Double-tap the status message to toggle the overlay.
 *
 * @module debug
 */

const LOGBOOK_KEY = "www_paint_error_logbook";
const STATUS_MSG_ID = "status-message";
const STATUS_FOOTER_ID = "status-bar";

/* ─── Session Storage ─────────────────────────────────────────── */

/** @type {Array<{level:'error'|'warn'|'info'|'sys', message:string, timestamp:number}>} */
window.__debugSession = window.__debugSession || [];

/** @type {boolean} */
let _hasErrors = false;
/** @type {number|null} */
let _statusRevertTimer = null;

/* ─── Console Hooks ──────────────────────────────────────────── */

const _origConsoleError = console.error;
const _origConsoleWarn = console.warn;
const _origConsoleLog = console.log;
const _origConsoleInfo = console.log;

/**
 * Record a log entry.
 * @param {'error'|'warn'|'info'|'sys'} level
 * @param {string} message
 */
function _recordLog(level, message) {
  window.__debugSession.push({
    level,
    message,
    timestamp: Date.now(),
  });
  if (level === "error" || level === "warn") {
    _hasErrors = true;
    _flashStatus();
  }
}

/**
 * Flash the status bar text red → ERROR, then revert after 4s.
 */
function _flashStatus() {
  const msgEl = document.getElementById(STATUS_MSG_ID);
  if (!msgEl) return;

  msgEl.textContent = "ERROR";
  msgEl.classList.add("status__error");
  msgEl.classList.remove("status__loading");

  if (_statusRevertTimer) clearTimeout(_statusRevertTimer);
  _statusRevertTimer = window.setTimeout(() => {
    const stillError = window.__debugSession.some(
      (e) => e.level === "error" || e.level === "warn"
    );
    if (!stillError) {
      msgEl.textContent = "Ready";
      msgEl.classList.remove("status__error");
    }
  }, 4000);
}

/**
 * Hook console and window events so everything passes through our logger
 * but also still outputs to the original console.
 */
function _installHooks() {
  console.error = function (...args) {
    _recordLog("error", args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    _origConsoleError.apply(console, args);
  };
  console.warn = function (...args) {
    _recordLog("warn", args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    _origConsoleWarn.apply(console, args);
  };
  console.log = function (...args) {
    _recordLog("info", args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    _origConsoleLog.apply(console, args);
  };
  console.info = function (...args) {
    _recordLog("info", args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    _origConsoleInfo.apply(console, args);
  };

  window.addEventListener("error", (e) => {
    _recordLog("error", e.error ? e.error.message || String(e.error) : (e.message || "Unknown error"));
    _origConsoleError.call(console, e.error || e.message);
  });

  window.addEventListener("unhandledrejection", (e) => {
    const msg = e.reason ? (typeof e.reason === "string" ? e.reason : (e.reason.message || JSON.stringify(e.reason))) : "Unhandled rejection";
    _recordLog("error", msg);
    _origConsoleError.call(console, msg);
  });
}

/* ─── Settings Snapshot ──────────────────────────────────────── */

/**
 * Gather current app settings for display in the debug overlay.
 * @returns {object}
 */
function _getSettingsSnapshot() {
  const snap = {
    style: "unknown",
    strokeCount: 0,
    layers: 0,
    smart: false,
    order: "unknown",
  };

  try {
    const app = window._wwwPaint || window.__app;
    if (app) {
      if (app.engine && app.engine.settings) {
        const s = app.engine.settings;
        snap.style = s.style || s.name || "unknown";
        snap.strokeCount = s.strokeCount || s.count || 0;
        snap.smart = s.smart ?? false;
        snap.order = s.order || "unknown";
      }
      if (app.engine && app.engine.layers) {
        snap.layers = app.engine.layers.length;
      }
    }
  } catch (e) {
    snap.error = e.message;
  }

  return snap;
}

/* ─── Logbook Persistence ────────────────────────────────────── */

/**
 * Save the current session to localStorage logbook (only if errors occurred).
 */
function _saveToLogbook() {
  if (!_hasErrors) return;
  try {
    const existing = JSON.parse(localStorage.getItem(LOGBOOK_KEY) || "[]");
    existing.push({
      timestamp: new Date().toISOString(),
      settings: _getSettingsSnapshot(),
      entries: window.__debugSession.map((e) => ({
        level: e.level,
        message: e.message,
        ts: new Date(e.timestamp).toISOString(),
      })),
      notes: "",
      fixes: "",
    });
    localStorage.setItem(LOGBOOK_KEY, JSON.stringify(existing));
  } catch (e) {
    _origConsoleError.call(console, "Failed to save debug logbook:", e);
  }
}

/**
 * Load previous logbook entries from localStorage.
 * @returns {Array}
 */
function _loadLogbook() {
  try {
    return JSON.parse(localStorage.getItem(LOGBOOK_KEY) || "[]");
  } catch (e) {
    return [];
  }
}

/* ─── Overlay DOM ─────────────────────────────────────────────── */

let _overlay = null;

/**
 * Build (once) the debug overlay DOM and append it to the debug-root container.
 */
function _ensureOverlay() {
  if (_overlay) return _overlay;

  const root = document.getElementById("debug-root");
  if (root) {
    _overlay = document.createElement("div");
    _overlay.id = "debug-overlay";
    _overlay.className = "debug-overlay";
    _overlay.setAttribute("role", "dialog");
    _overlay.setAttribute("aria-hidden", "true");
    root.appendChild(_overlay);
  } else {
    // Fallback: create at the end of body
    _overlay = document.createElement("div");
    _overlay.id = "debug-overlay";
    _overlay.className = "debug-overlay";
    _overlay.setAttribute("role", "dialog");
    _overlay.setAttribute("aria-hidden", "true");
    document.body.appendChild(_overlay);
  }

  _overlay.innerHTML = "";

  const backdrop = document.createElement("div");
  backdrop.className = "debug-overlay__backdrop";

  const panel = document.createElement("div");
  panel.className = "debug-panel";

  const header = document.createElement("div");
  header.className = "debug-header";
  header.innerHTML = `
    <span class="debug-header__title">WWW_PAINT DEBUG SESSION</span>
    <button type="button" class="debug-close-btn" aria-label="Close debug overlay">✕</button>
  `;

  const body = document.createElement("div");
  body.className = "debug-body";
  body.innerHTML = `
    <div class="debug-section">
      <div class="debug-section-title">CURRENT SESSION</div>
      <div class="debug-log" id="debug-log"></div>
    </div>
    <div class="debug-section debug-settings-section" id="debug-settings-section">
      <div class="debug-section-title">SETTINGS SNAPSHOT</div>
      <pre class="debug-settings" id="debug-settings"></pre>
    </div>
    <div class="debug-section debug-logbook-section" id="debug-logbook-section">
      <div class="debug-section-title debug-logbook__toggle" style="cursor:pointer; user-select:none;">
        Previous Sessions ▼
      </div>
      <div class="debug-logbook__content" id="debug-logbook-content"></div>
    </div>
  `;

  const footer = document.createElement("div");
  footer.className = "debug-footer";
  footer.innerHTML = `
    <button type="button" class="debug-copy-btn" id="debug-copy">COPY LOG</button>
  `;

  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(footer);

  _overlay.appendChild(backdrop);
  _overlay.appendChild(panel);

  // Bind events
  const closeBtn = _overlay.querySelector(".debug-close-btn");
  closeBtn?.addEventListener("click", () => _DebugOverlay.hide());

  backdrop?.addEventListener("click", () => _DebugOverlay.hide());

  const copyBtn = _overlay.querySelector("#debug-copy");
  copyBtn?.addEventListener("click", () => _copyLogToClipboard());

  const logbookToggle = _overlay.querySelector(".debug-logbook__toggle");
  const logbookContent = _overlay.querySelector("#debug-logbook-content");
  if (logbookToggle && logbookContent) {
    logbookToggle.addEventListener("click", () => {
      const expanded = logbookContent.style.display !== "none";
      logbookContent.style.display = expanded ? "none" : "block";
      logbookToggle.textContent = expanded ? "Previous Sessions ▼" : "Previous Sessions ▲";
    });
  }

  // Escape key
  _onDebugKeyDown = (e) => {
    if (e.key === "Escape") _DebugOverlay.hide();
  };
  document.addEventListener("keydown", _onDebugKeyDown);

  return _overlay;
}

/** @type {function|null} */
let _onDebugKeyDown = null;

/**
 * Render the session log into the overlay body.
 */
function _renderLog() {
  const logEl = _overlay?.querySelector("#debug-log");
  if (!logEl) return;

  if (window.__debugSession.length === 0) {
    logEl.innerHTML = '<div class="debug-log-entry">No errors or warnings logged.</div>';
    return;
  }

  logEl.innerHTML = window.__debugSession.map((entry) => {
    const prefix = entry.level === "error" ? "[ERR]" :
                   entry.level === "warn" ? "[WARN]" :
                   entry.level === "sys" ? "[SYS]" : "[INFO]";
    const cls = entry.level === "error" ? "debug-log-entry--error" :
                entry.level === "warn" ? "debug-log-entry--warn" : "";
    const time = new Date(entry.timestamp).toISOString().slice(11, 23);
    return `<div class="debug-log-entry ${cls}">${time} ${prefix} ${entry.message}</div>`;
  }).join("");

  logEl.scrollTop = logEl.scrollHeight;
}

/**
 * Render settings snapshot.
 */
function _renderSettings() {
  const el = _overlay?.querySelector("#debug-settings");
  if (!el) return;
  const snap = _getSettingsSnapshot();
  let lines = [];
  for (const [k, v] of Object.entries(snap)) {
    lines.push(`  ${k}: ${JSON.stringify(v)}`);
  }
  el.textContent = "{\n" + lines.join("\n") + "\n}";
}

/**
 * Render previous logbook sessions.
 */
function _renderLogbook() {
  const section = _overlay?.querySelector("#debug-logbook-section");
  const content = _overlay?.querySelector("#debug-logbook-content");
  if (!section || !content) return;

  const entries = _loadLogbook();
  if (entries.length === 0) {
    section.style.display = "none";
    return;
  }
  section.style.display = "block";

  content.style.display = "none";
  const toggle = _overlay?.querySelector(".debug-logbook__toggle");
  if (toggle) toggle.style.display = "block";

  content.innerHTML = entries.slice().reverse().map((entry) => {
    const time = new Date(entry.timestamp).toISOString().slice(0, 19).replace("T", " ");
    const logLines = (entry.entries || [])
      .map((e) => `  ${e.ts.slice(11, 23)} ${e.level.toUpperCase()} ${e.message}`)
      .join("\n");
    const settingsLines = Object.entries(entry.settings || {})
      .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
      .join("\n");
    const notes = entry.notes || "";
    const fixes = entry.fixes || "";
    return `<div class="debug-logbook-entry">
      <div class="debug-logbook__time">${time}</div>
      <pre class="debug-logbook__settings">${settingsLines || "(no settings)"}</pre>
      <pre class="debug-logbook__log">${logLines || "(no log entries)"}</pre>
      ${notes ? `<div class="debug-section-title">NOTES</div><pre class="debug-logbook__settings">${notes}</pre>` : ""}
      ${fixes ? `<div class="debug-section-title">FIXES</div><pre class="debug-logbook__settings">${fixes}</pre>` : ""}
    </div>`;
  }).join("");
}

/**
 * Copy the entire session log to the clipboard.
 */
function _copyLogToClipboard() {
  const sessionStart = window.__debugSession.length > 0
    ? window.__debugSession[0].timestamp
    : Date.now();
  const startTime = new Date(sessionStart).toISOString();

  // (a) Header
  const header = [
    "=== WWW_PAINT DEBUG SESSION ===",
    "Site: WWW_PAINT",
    "Session start: " + startTime,
    "",
  ];

  // (b) Settings snapshot (include UI theme mode + custom colors)
  const snap = _getSettingsSnapshot();
  let uiSettings = null;
  try {
    if (window.__UISettings && typeof window.__UISettings.getSettings === "function") {
      uiSettings = window.__UISettings.getSettings();
    }
  } catch (e) {
    uiSettings = { error: e.message };
  }
  const settingsLines = ["--- SETTINGS ---"];
  settingsLines.push("engine settings: " + JSON.stringify(snap));
  if (uiSettings) {
    settingsLines.push("ui theme mode: " + (uiSettings.activeMode || "unknown"));
    if (uiSettings.dark) settingsLines.push("dark colors: " + JSON.stringify(uiSettings.dark));
    if (uiSettings.light) settingsLines.push("light colors: " + JSON.stringify(uiSettings.light));
  }
  settingsLines.push("");

  // (c) Log section
  const logLines = ["--- LOG ---"];
  if (window.__debugSession.length > 0) {
    window.__debugSession.forEach((e) => {
      const prefix = e.level === "error" ? "[ERR]" :
                     e.level === "warn" ? "[WARN]" :
                     e.level === "sys" ? "[SYS]" : "[INFO]";
      const time = new Date(e.timestamp).toISOString().slice(11, 23);
      logLines.push(`${time} ${prefix} ${e.message}`);
    });
  } else {
    logLines.push("(no log entries)");
  }
  logLines.push("");

  // (d) Cause summary — distinct error-level messages + active settings
  const causeLines = ["--- CAUSE ---"];
  const errorEntries = window.__debugSession.filter(
    (e) => e.level === "error" || e.level === "warn"
  );
  if (errorEntries.length > 0) {
    const seen = new Map();
    errorEntries.forEach((e) => {
      if (!seen.has(e.message)) {
        seen.set(e.message, { count: 0, settings: snap });
      }
      seen.get(e.message).count += 1;
    });
    seen.forEach((info, msg) => {
      causeLines.push(`ERROR (${info.count}x): ${msg}`);
      causeLines.push(`  settings: ${JSON.stringify(info.settings)}`);
    });
  } else {
    causeLines.push("(no errors or warnings)");
  }

  const fullText = [...header, ...settingsLines, ...logLines, ...causeLines].join("\n");

  // Try clipboard API first
  const _fallbackDownload = () => {
    const blob = new Blob([fullText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "www_paint_debug_session.log";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(fullText).then(() => {
      const msgEl = document.getElementById(STATUS_MSG_ID);
      if (msgEl) {
        const prev = msgEl.textContent;
        msgEl.textContent = "COPIED";
        setTimeout(() => { msgEl.textContent = prev; }, 2000);
      }
    }).catch(() => {
      _fallbackDownload();
    });
  } else {
    _fallbackDownload();
  }
}

/* ─── Public API ──────────────────────────────────────────────── */

/**
 * DebugOverlay — singleton that exposes init, show, hide, isOpen.
 */
export const _DebugOverlay = {
  /** @type {boolean} */
  initialized: false,

  /**
   * Initialize: install hooks and wire double-tap on status bar.
   */
  init() {
    if (this.initialized) return;
    this.initialized = true;

    _installHooks();

    // Record a system entry that debug hooks are active
    _recordLog("sys", "Debug hooks installed");

    // Double-tap on status message to open overlay
    const msgEl = document.getElementById(STATUS_MSG_ID);
    if (msgEl) {
      msgEl.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        _DebugOverlay.toggle();
      });
    }

    // Also listen on the status footer as a fallback
    const footer = document.getElementById(STATUS_FOOTER_ID);
    if (footer && footer !== msgEl?.parentElement) {
      footer.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        _DebugOverlay.toggle();
      });
    }

    // Save to logbook on unload if errors occurred
    window.addEventListener("beforeunload", _saveToLogbook);
  },

  /**
   * Open the debug overlay.
   */
  show() {
    _ensureOverlay();
    if (!_overlay) return;
    _overlay.classList.add("debug-overlay--open");
    _overlay.setAttribute("aria-hidden", "false");
    _renderLog();
    _renderSettings();
    _renderLogbook();
  },

  /**
   * Hide the debug overlay.
   */
  hide() {
    if (!_overlay) return;
    _overlay.classList.remove("debug-overlay--open");
    _overlay.setAttribute("aria-hidden", "true");
  },

  /**
   * Toggle the overlay.
   */
  toggle() {
    const isOpen = _overlay && _overlay.classList.contains("debug-overlay--open");
    if (isOpen) {
      _DebugOverlay.hide();
    } else {
      _DebugOverlay.show();
    }
  },

  /**
   * @returns {boolean}
   */
  isOpen() {
    return _overlay && _overlay.classList.contains("debug-overlay--open");
  },
};

// Expose on window for App.init() access
window.__DebugOverlay = _DebugOverlay;

export default _DebugOverlay;
