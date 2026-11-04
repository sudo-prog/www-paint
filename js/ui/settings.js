/**
 * UI Settings — light/dark theme customization modal.
 *
 * Provides a modal dialog for customizing the LAYERS design tokens
 * for both light and dark modes. Persists to localStorage.
 *
 * Theme switching works by toggling data-theme="dark" on the <html>
 * element. The CSS [data-theme="dark"] block overrides the token values.
 * Custom color overrides are applied to :root and cascade down.
 *
 * @module settings
 */

const SETTINGS_KEY = "www_paint_ui_settings";
const ROOT_EL = document.documentElement;

/* ─── Default Colors ─────────────────────────────────────────────
   These match the LAYERS token names from css/style.css :root.
   Only semantic colour tokens are user-tunable in the settings modal.
   ─────────────────────────────────────────────────────────────── */

const DEFAULT_DARK = {
  "--bg-primary":    "#0a0b0d",
  "--bg-secondary":  "#101215",
  "--accent":        "#7aa2ff",
  "--text-primary":  "#f2f4f7",
  "--text-secondary":"#9aa3af",
};

const DEFAULT_LIGHT = {
  "--bg-primary":    "#ffffff",
  "--bg-secondary":  "#f5f5f5",
  "--accent":        "#0066ff",
  "--text-primary":  "#0a0a0a",
  "--text-secondary":"#555555",
};

/* The keys that the settings modal lets the user customise. */
const COLOR_KEYS = [
  { key: "--bg-primary",    label: "Background" },
  { key: "--bg-secondary",  label: "Secondary" },
  { key: "--accent",        label: "Accent" },
  { key: "--text-primary",  label: "Primary Text" },
  { key: "--text-secondary",label: "Secondary Text" },
];

/* ─── State ────────────────────────────────────────────────────── */

/** @type {{dark: object, light: object, activeMode: 'dark'|'light'}} */
let _settings = {
  dark:  { ...DEFAULT_DARK },
  light: { ...DEFAULT_LIGHT },
  activeMode: "light",
};
let _overlay = null;
let _onSettingsKeyDown = null;

/* ─── Local Storage ────────────────────────────────────────────── */

/**
 * Load settings from localStorage, falling back to defaults.
 */
function _loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      _settings = {
        dark:  { ...DEFAULT_DARK,  ...(parsed.dark  || {}) },
        light: { ...DEFAULT_LIGHT, ...(parsed.light || {}) },
        activeMode: parsed.activeMode || "light",
      };
    }
  } catch (e) {
    _settings = {
      dark:  { ...DEFAULT_DARK },
      light: { ...DEFAULT_LIGHT },
      activeMode: "light",
    };
  }
}

/**
 * Save settings to localStorage.
 */
function _saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(_settings));
}

/* ─── CSS Application ──────────────────────────────────────────── */

/**
 * Apply a set of colours to :root CSS custom properties live.
 * Only the tunable colour keys are written — the rest of the token
 * set (surfaces, borders, glass) falls out from the [data-theme]
 * attribute selector in CSS.
 * @param {object} colors
 */
function _applyColorsToCSS(colors) {
  for (const { key } of COLOR_KEYS) {
    const val = colors[key];
    if (val) {
      ROOT_EL.style.setProperty(key, val);
    }
  }
}

/**
 * Switch the document to a given theme by setting data-theme on <html>.
 * CSS [data-theme="dark"] overrides the surface/border/glass tokens.
 * Colour overrides from user settings are applied on top.
 */
function _applyTheme(theme) {
  ROOT_EL.setAttribute("data-theme", theme);
  _applyColorsToCSS(_settings[theme]);
}

/**
 * Apply the current mode's colours to the live document.
 */
function _applyCurrentMode() {
  _applyTheme(_settings.activeMode);
}

/* ─── Overlay DOM ──────────────────────────────────────────────── */

/**
 * Create the settings modal DOM (once) inside the settings-root container.
 */
function _ensureOverlay() {
  if (_overlay) return _overlay;

  const root = document.getElementById("settings-root");
  if (!root) return null;

  _overlay = document.createElement("div");
  _overlay.id = "settings-overlay";
  _overlay.className = "settings-overlay";
  _overlay.setAttribute("role", "dialog");
  _overlay.setAttribute("aria-hidden", "true");
  _overlay.setAttribute("aria-labelledby", "settings-title");
  _overlay.setAttribute("aria-modal", "true");
  root.appendChild(_overlay);

  _overlay.innerHTML = "";

  const content = document.createElement("div");
  content.className = "settings-content";

  // Header
  const header = document.createElement("div");
  header.className = "settings-header";
  const titleId = "settings-title";
  header.innerHTML = `
    <h2 class="modal__title" id="${titleId}">UI SETTINGS</h2>
    <button type="button" class="btn btn--icon btn--sm btn--ghost" id="settings-close" aria-label="Close">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;

  // Body
  const body = document.createElement("div");
  body.className = "settings-body";
  body.innerHTML = `
    <!-- Light/Dark Toggle -->
    <div class="mode-toggle" id="mode-toggle">
      <div class="mode-toggle__track">
        <div class="mode-toggle__fill" id="mode-toggle-fill"></div>
        <button type="button" class="mode-toggle__btn" data-mode="dark">DARK</button>
        <button type="button" class="mode-toggle__btn" data-mode="light">LIGHT</button>
      </div>
      <div class="mode-indicator" id="mode-indicator">Editing: Dark Mode</div>
    </div>

    <!-- Colour Pickers -->
    <div class="color-pickers" id="color-pickers">
      ${_renderColorRows()}
    </div>
  `;

  // Footer
  const footer = document.createElement("div");
  footer.className = "settings-footer";
  footer.innerHTML = `
    <button type="button" class="btn btn--ghost btn--sm" id="settings-restore">RESTORE DEFAULT</button>
    <button type="button" class="btn btn--primary btn--sm" id="settings-save">SAVE &amp; EXIT</button>
  `;

  content.appendChild(header);
  content.appendChild(body);
  content.appendChild(footer);
  _overlay.appendChild(content);

  // Wire events
  const closeBtn = _overlay.querySelector("#settings-close");
  closeBtn?.addEventListener("click", () => _UISettings.hide());

  _overlay.addEventListener("click", (e) => {
    if (e.target === _overlay) _UISettings.hide();
  });

  _onSettingsKeyDown = (e) => {
    if (e.key === "Escape") _UISettings.hide();
  };
  document.addEventListener("keydown", _onSettingsKeyDown);

  // Mode toggle buttons
  const toggleBtns = _overlay.querySelectorAll(".mode-toggle__btn");
  toggleBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      _settings.activeMode = btn.dataset.mode;
      _updateModeToggle();
      const pickers = _overlay.querySelector("#color-pickers");
      if (pickers) pickers.innerHTML = _renderColorRows();
    });
  });

  // Restore default
  const restoreBtn = _overlay.querySelector("#settings-restore");
  restoreBtn?.addEventListener("click", () => {
    _restoreDefault();
    const pickers = _overlay.querySelector("#color-pickers");
    if (pickers) pickers.innerHTML = _renderColorRows();
  });

  // Save & exit
  const saveBtn = _overlay.querySelector("#settings-save");
  saveBtn?.addEventListener("click", () => {
    _saveSettings();
    _applyCurrentMode();
    _UISettings.hide();
  });

  // Wire colour input changes
  _overlay.addEventListener("input", (e) => {
    const input = e.target;
    if (input.classList.contains("color-row__input")) {
      const key = input.dataset.colorKey;
      const hexDisplay = input.closest(".color-row").querySelector(".color-row__hex");
      if (key && hexDisplay) {
        _settings[_settings.activeMode][key] = input.value;
        hexDisplay.textContent = input.value;
        _applyCurrentMode();
      }
    }
  });

  return _overlay;
}

/**
 * Render colour picker rows for the current mode.
 * @returns {string} HTML string
 */
function _renderColorRows() {
  const modeColors = _settings[_settings.activeMode];
  return COLOR_KEYS.map(({ key, label }) => {
    const val = modeColors[key] || "#000000";
    return `
      <div class="color-row">
        <label class="color-row__label" for="color-${key}">${label}</label>
        <input type="color" class="color-row__input" id="color-${key}" data-color-key="${key}" value="${val}" />
        <span class="color-row__hex" id="color-${key}-hex">${val}</span>
      </div>
    `;
  }).join("");
}

/**
 * Update the mode toggle to reflect the currently selected mode.
 */
function _updateModeToggle() {
  const toggle = _overlay?.querySelector("#mode-toggle");
  const indicator = _overlay?.querySelector("#mode-indicator");
  if (!toggle || !indicator) return;

  const mode = _settings.activeMode;
  const buttons = toggle.querySelectorAll(".mode-toggle__btn");
  buttons.forEach((btn) => {
    const isActive = btn.dataset.mode === mode;
    btn.classList.toggle("mode-toggle__btn--active", isActive);
  });

  // Move the fill to the active button
  const fill = toggle.querySelector(".mode-toggle__fill");
  if (fill) {
    const activeBtn = toggle.querySelector(".mode-toggle__btn--active");
    if (activeBtn) {
      const index = Array.from(buttons).indexOf(activeBtn);
      fill.style.transform = `translateX(${index * 100}%)`;
    }
  }

  indicator.textContent = mode === "dark" ? "Editing: Dark Mode" : "Editing: Light Mode";
}

/**
 * Restore default colours for the current mode.
 */
function _restoreDefault() {
  if (_settings.activeMode === "dark") {
    _settings.dark = { ...DEFAULT_DARK };
  } else {
    _settings.light = { ...DEFAULT_LIGHT };
  }
}

/* ─── Public API ──────────────────────────────────────────────── */

/**
 * UISettings — singleton manager for the theme settings modal.
 *
 * Uses the LAYERS token names (--bg-primary, --text-primary, --accent, etc.)
 * and toggles data-theme="dark" on <html> to switch surface colours.
 */
export const _UISettings = {
  /** @type {boolean} */
  initialized: false,

  /**
   * Initialise: load stored settings and apply them to :root.
   * Sets the data-theme attribute so CSS [data-theme] selectors activate.
   */
  init() {
    if (this.initialized) return;
    this.initialized = true;

    _loadSettings();
    _applyCurrentMode();

    // Wire the settings icon button
    const settingsBtn = document.getElementById("btn-ui-settings");
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => _UISettings.show());
    }
  },

  /**
   * Show the settings modal.
   */
  show() {
    _ensureOverlay();
    if (!_overlay) return;
    _updateModeToggle();
    _renderColorRows();
    _overlay.classList.add("settings-overlay--open");
    _overlay.setAttribute("aria-hidden", "false");
  },

  /**
   * Hide the settings modal.
   */
  hide() {
    if (!_overlay) return;
    _overlay.classList.remove("settings-overlay--open");
    _overlay.setAttribute("aria-hidden", "true");
  },

  /**
   * @returns {boolean}
   */
  isOpen() {
    return _overlay && _overlay.classList.contains("settings-overlay--open");
  },

  /**
   * Get current settings object (for external inspection).
   * @returns {object}
   */
  getSettings() {
    return { ..._settings };
  },
};

// Expose on window for App.init() access
window.__UISettings = _UISettings;

// Auto-initialise if the DOM is already loaded, so the settings button
// click handler is attached even if app.js hasn't run yet.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => _UISettings.init());
} else {
  _UISettings.init();
}

export default _UISettings;