/**
 * UI Settings — light/dark theme customization modal.
 *
 * Provides a modal dialog for customizing CSS custom properties
 * for both light and dark modes. Persists to localStorage.
 *
 * @module settings
 */

const SETTINGS_KEY = "www_paint_ui_settings";
const ROOT_EL = document.documentElement;

/* ─── Default Colors ───────────────────────────────────────────── */

const DEFAULT_DARK = {
  "--bg": "#000000",
  "--surface": "#0C0C0C",
  "--accent": "#D71921",
  "--primary": "#EDEDED",
  "--secondary": "#8C8C8C",
  "--canvas-bg": "#000000",
};

const DEFAULT_LIGHT = {
  "--bg": "#F5F5F5",
  "--surface": "#FFFFFF",
  "--accent": "#D71921",
  "--primary": "#1A1A1A",
  "--secondary": "#666666",
  "--canvas-bg": "#F5F5F5",
};

const COLOR_KEYS = [
  { key: "--bg",          label: "Background" },
  { key: "--surface",     label: "Surface" },
  { key: "--accent",      label: "Accent" },
  { key: "--primary",     label: "Primary Text" },
  { key: "--secondary",   label: "Secondary Text" },
  { key: "--canvas-bg",   label: "Canvas Background" },
];

/* ─── State ────────────────────────────────────────────────────── */

/** @type {{dark: object, light: object, activeMode: 'dark'|'light'}} */
let _settings = {
  dark: { ...DEFAULT_DARK },
  light: { ...DEFAULT_LIGHT },
  activeMode: "dark",
};

let _initialized = false;
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
        dark: { ...DEFAULT_DARK, ...(parsed.dark || {}) },
        light: { ...DEFAULT_LIGHT, ...(parsed.light || {}) },
        activeMode: parsed.activeMode || "dark",
      };
    }
  } catch (e) {
    _settings = {
      dark: { ...DEFAULT_DARK },
      light: { ...DEFAULT_LIGHT },
      activeMode: "dark",
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
 * Read the current :root custom properties for a given mode's keys.
 * If the property doesn't exist yet, use the stored value.
 * @param {'dark'|'light'} mode
 */
function _readCurrentCSSValues(mode) {
  const modeColors = _settings[mode];
  for (const { key } of COLOR_KEYS) {
    const stored = modeColors[key];
    if (stored && stored.startsWith("#")) {
      modeColors[key] = stored;
    }
  }
}

/**
 * Apply a set of colors to :root CSS custom properties live.
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
 * Apply the current mode's colors to the live document.
 */
function _applyCurrentMode() {
  _applyColorsToCSS(_settings[_settings.activeMode]);
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
  header.innerHTML = `
    <h2 class="modal__title" id="settings-title">UI SETTINGS</h2>
    <button type="button" class="btn btn--icon btn--sm btn--ghost" id="settings-close" aria-label="Close">
      <span aria-hidden="true">✕</span>
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

    <!-- Color Pickers -->
    <div class="color-pickers" id="color-pickers">
      ${_renderColorRows()}
    </div>
  `;

  // Footer
  const footer = document.createElement("div");
  footer.className = "settings-footer";
  footer.innerHTML = `
    <button type="button" class="btn btn--ghost btn--sm" id="settings-restore">RESTORE DEFAULT</button>
    <button type="button" class="btn btn--primary btn--sm" id="settings-save">SAVE & EXIT</button>
  `;

  content.appendChild(header);
  content.appendChild(body);
  content.appendChild(footer);
  _overlay.appendChild(content);

  // Bind events
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
      _renderColorRows();
    });
  });

  // Restore default
  const restoreBtn = _overlay.querySelector("#settings-restore");
  restoreBtn?.addEventListener("click", () => {
    _restoreDefault();
    _renderColorRows();
  });

  // Save & exit
  const saveBtn = _overlay.querySelector("#settings-save");
  saveBtn?.addEventListener("click", () => {
    _saveSettings();
    _applyCurrentMode();
    _UISettings.hide();
  });

  // Wire color input changes
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
 * Render color picker rows for the current mode.
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
 * Restore default colors for the current mode.
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
 */
export const _UISettings = {
  /** @type {boolean} */
  initialized: false,

  /**
   * Initialize: load stored settings and apply them to :root.
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

export default _UISettings;
