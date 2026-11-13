/**
 * a11y-hardening.js — Mac-owned M13 a11y fixes applied to the live DOM.
 *
 * M13 (`docs/MAC-TASKS.md`) asks for: keyboard operability, visible focus,
 * >= 44x44 targets, `role=dialog` / `aria-modal` / Escape / focus-restore on
 * every overlay, `prefers-reduced-motion`, and responsive 390 -> 1920.
 *
 * The CSS half of that lives at the END of `css/style.css` (the M13 block).
 * This module is the DOM half, and it exists because several fixes need to
 * touch markup that is NOT Mac-owned:
 *
 *   index.html    ThinkPad-owned — the paint toolbar's three controls have
 *                 <label> elements whose `for` does not match the control id,
 *                 so they have no accessible name. Adding an aria-label from
 *                 JS is additive: nothing about layout or behaviour changes,
 *                 and the markup stays untouched.
 *   js/ui/app.js  ThinkPad-owned — owns #btn-gener / #btn-export /
 *                 #btn-ui-settings.
 *   js/ui/layers.js  Mac-owned, but the fix is a single attribute and it is
 *                 applied here so the whole M13 a11y delta is one file.
 *
 * Everything here is idempotent and defensive: it checks that the node exists
 * and it never throws. It is loaded LAST (see index.html) so it runs after
 * every panel has been mounted.
 *
 * @module a11y-hardening
 */

/**
 * Elements that need an explicit accessible name, and the name to apply.
 * `ensureName` only writes when the element has NO name from any other source,
 * so a future markup fix is never overridden by a stale duplicate.
 */
const NAME_FIXES = [
  // Paint toolbar — the <label> elements in index.html point at the wrong ids
  // (or at nothing), so the controls have no accessible name.
  { id: 'paint-preset', label: 'Paint brush preset' },
  { id: 'paint-color', label: 'Paint colour' },
  { id: 'paint-weight', label: 'Paint brush weight' },

  // The layers panel's opacity slider (Mac-owned js/ui/layers.js). The id is
  // not set on the element (it is selected by class), so this fix is applied
  // by class rather than by id.

  // The playback scrubber + speed select (Mac-owned js/ui/motion.js).
  { id: 'motion-scrubber', label: 'Painting progress' },
  { id: 'motion-speed-select', label: 'Playback speed' },
];

/** An element's accessible name, computed the way a browser does.
 *  NOTE: an input's `value` is deliberately NOT treated as a name — a colour
 *  swatch would read as "#222222" and a range as "4", and the browser does
 *  not use it either. Returning it here would make ensureName() skip exactly
 *  the controls that need fixing. */
function accessibleName(el) {
  if (!el) return '';
  const direct = (el.getAttribute('aria-label') || '').trim();
  if (direct) return direct;
  const labelledby = (el.getAttribute('aria-labelledby') || '').trim();
  if (labelledby) {
    const t = labelledby.split(/\s+/)
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .map((n) => (n.textContent || '').trim())
      .join(' ');
    if (t) return t;
  }
  if (el.labels && el.labels.length) {
    const t = [...el.labels].map((l) => (l.textContent || '').trim()).filter(Boolean).join(' ');
    if (t) return t;
  }
  if (el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement) {
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (t) return t;
  }
  if ((el.getAttribute('title') || '').trim()) return el.getAttribute('title').trim();
  if ((el.getAttribute('alt') || '').trim()) return el.getAttribute('alt').trim();
  return '';
}

/**
 * Give a control an accessible name if it has none, by selector.
 * Used for controls that carry no id.
 *
 * @param {string} selector
 * @param {string} label
 * @returns {number} how many elements were fixed
 */
function ensureNameBySelector(selector, label) {
  const els = [...document.querySelectorAll(selector)];
  let n = 0;
  for (const el of els) {
    if (accessibleName(el)) continue;
    el.setAttribute('aria-label', label);
    n++;
  }
  return n;
}

/** Give a control an accessible name if it has none. @returns {boolean} applied */
function ensureName(id, label) {
  const el = document.getElementById(id);
  if (!el) return false;
  if (accessibleName(el)) return false;
  el.setAttribute('aria-label', label);
  return true;
}

/* ── Modal focus management ────────────────────────────────────────────
   Every overlay must move focus in when it opens and put it back when it
   closes (WCAG 2.2 SC 2.4.3 Focus Order, and the M13 exit criterion).
   The Mac-owned export panel already does this (export-panel.js show());
   the ThinkPad-owned modals (`#export-root`, `#settings-overlay`) do not.
   Rather than editing them, this module wraps their hide paths and restores
   focus from the element that opened them. ── */

/** Ids of every modal overlay in the app. */
const MODAL_ROOTS = [
  { id: 'export-root', triggers: ['btn-export'], openClass: 'modal--open' },
  { id: 'export-panel-root', triggers: ['btn-export-panel'], openClass: 'export-panel--open' },
  { id: 'settings-overlay', triggers: ['btn-ui-settings'], openClass: 'settings-overlay--open' },
];

/**
 * Wrap a modal so it remembers its trigger and restores focus on close.
 * Idempotent per root id.
 *
 * @param {{id: string, triggers: string[], openClass: string}} spec
 * @returns {boolean} whether the wrap was newly applied
 */
function wrapModalFocus(spec) {
  const root = document.getElementById(spec.id);
  if (!root) return false;
  if (root.__a11yFocusWrapped) return false;
  root.__a11yFocusWrapped = true;
  root.__a11yLastTrigger = null;

  // The settings overlay is created lazily by `_UISettings.show()`, so the
  // node this function first saw can be replaced. ALWAYS resolve the live node
  // — a cached reference silently stops working after a re-create.
  const live = () => document.getElementById(spec.id) || root;

  const isOpen = () => {
    const el = live();
    if (spec.openClass) return el.classList.contains(spec.openClass);
    return el.getAttribute('aria-hidden') !== 'true';
  };

  // Remember the trigger. A capture-phase listener on the document sees the
  // click before any other handler and survives the overlay being recreated.
  // The listener is registered once per spec, not per root instance.
  const remember = (e) => {
    const t = e.target.closest && e.target.closest('button');
    if (!t) return;
    if (!spec.triggers.includes(t.id)) return;
    const el = live();
    if (!el) return;
    el.__a11yLastTrigger = t;
  };
  document.addEventListener('click', remember, { capture: true });

  // Also record focus on the trigger (keyboard activation path).
  for (const tid of spec.triggers) {
    const trigger = document.getElementById(tid);
    if (!trigger) continue;
    trigger.addEventListener('focus', () => {
      const el = live();
      if (el) el.__a11yLastTrigger = trigger;
    }, { capture: true });
  }

  // Restore focus on ANY path that closes the modal: Escape, backdrop, close
  // button. A single document-level keydown handler covers Escape; the rest
  // are covered by a click handler on the root.
  const restore = () => {
    const el = live();
    const trigger = el.__a11yLastTrigger;
    // Do NOT clear the trigger here. The Escape handler and the focusin
    // handler can both fire for one close, and clearing on the first call
    // makes the second a no-op. It is cleared on the next successful restore
    // and when a new trigger is recorded.
    if (!trigger || typeof trigger.focus !== 'function') return;
    // Wait a frame so the modal has actually hidden before focus moves —
    // moving focus into a `visibility:hidden` subtree would be dropped.
    requestAnimationFrame(() => {
      if (!isOpen()) {
        trigger.focus();
        el.__a11yLastTrigger = null;
      }
    });
  };

  // The Mac-owned export panel hides itself on Escape from its OWN keydown
  // listener. This handler runs alongside it and restores focus afterwards.
  // `setTimeout 0` is enough: both listeners are synchronous, and the export
  // panel's listener only toggles a class.
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    if (!isOpen()) return;
    setTimeout(restore, 0);
  };
  document.addEventListener('keydown', onKey, { capture: true });

  // Backdrop / close-button clicks. Delegated from the document so it keeps
  // working if the root node is replaced.
  document.addEventListener('click', (e) => {
    const el = live();
    if (!el) return;
    const isCloseBtn = e.target.closest(
      '[data-action="close"], .modal__close, #settings-close, #export-panel-close, [data-action="cancel"]',
    );
    const isBackdrop = e.target === el || e.target.classList.contains('export-dialog__overlay');
    if (isCloseBtn || isBackdrop) setTimeout(restore, 0);
  });

  // A modal that closes while focus is inside it leaves focus on
  // `document.body`. Put it back on the trigger — this is the keyboard path
  // where the trigger was never clicked (focused, then Enter), and the path
  // where the Escape handler already ran.
  //
  // The trigger is re-checked at fire time. `focusin` on BODY does NOT fire
  // when focus moves from an element to BODY (Chromium treats that as a
  // no-focus event), so the handler below is not enough on its own — the
  // Escape and click handlers call `restore()` directly.
  document.addEventListener('focusin', (e) => {
    if (isOpen()) return;
    if (e.target !== document.body) return;
    const el = live();
    const trigger = el && el.__a11yLastTrigger;
    if (!trigger || typeof trigger.focus !== 'function') return;
    requestAnimationFrame(() => {
      if (!isOpen()) {
        trigger.focus();
        el.__a11yLastTrigger = null;
      }
    });
  });

  return true;
}

/**
 * Trap Tab inside an open modal so keyboard focus cannot escape to the page
 * behind it (WCAG 2.2 SC 2.4.3 / 2.1.2 No Keyboard Trap is the opposite
 * requirement — the trap must be escapable, and Escape already closes).
 * The Mac-owned export panel keeps its own handler; this is additive.
 *
 * @param {string} rootId
 * @returns {boolean}
 */
function wrapFocusTrap(rootId) {
  const root = document.getElementById(rootId);
  if (!root || root.__a11yTrapWrapped) return false;
  root.__a11yTrapWrapped = true;

  const FOCUSABLE = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = [...root.querySelectorAll(FOCUSABLE)]
      .filter((el) => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !root.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !root.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  });

  return true;
}

/**
 * Keep `aria-hidden` and the tab order in step. A closed modal must not be
 * reachable by Tab. The CSS `visibility:hidden` already handles this in
 * current browsers; this is the belt-and-braces guard for the two older
 * modals that only toggle a class.
 *
 * @returns {string[]} the root ids that were wired
 */
function wireAriaHidden() {
  const wired = [];
  for (const spec of MODAL_ROOTS) {
    const root = document.getElementById(spec.id);
    if (!root || root.__a11yAriaWrapped) continue;
    root.__a11yAriaWrapped = true;

    const sync = () => {
      const open = spec.openClass
        ? root.classList.contains(spec.openClass)
        : root.getAttribute('aria-hidden') !== 'true';
      // Do NOT write aria-hidden from here. The two ThinkPad-owned modals
      // already manage it, and a mutation observer that writes an observed
      // attribute re-fires itself — an infinite loop that hangs the page.
      const focusables = root.querySelectorAll('button, input, select, textarea, a[href]');
      for (const el of focusables) {
        if (open) el.removeAttribute('data-a11y-inert');
        else el.setAttribute('data-a11y-inert', 'true');
      }
    };

    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ['class', 'aria-hidden'] });
    wired.push(spec.id);
  }
  return wired;
}

/**
 * Watch for a modal root that appears later (the settings overlay is created
 * on first open, so it does not exist when this module first runs).
 * Re-runs the whole wiring pass when a new `[role=dialog]` shows up.
 *
 * @param {number} [timeoutMs] how long to watch
 * @returns {MutationObserver}
 */
function watchForLateModals(timeoutMs = 20000) {
  let runs = 0;
  const mo = new MutationObserver(() => {
    if (runs++ > 20) { mo.disconnect(); return; }
    const late = MODAL_ROOTS.some((spec) => {
      const root = document.getElementById(spec.id);
      return root && !root.__a11yFocusWrapped;
    });
    if (!late) return;
    applyA11yHardening();
    try { window.__a11y = { ...(window.__a11y || {}), ...applyA11yHardening() }; } catch { /* ignore */ }
  });
  mo.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => mo.disconnect(), timeoutMs);
  return mo;
}

/**
 * Apply every M13 a11y fix. Safe to call more than once.
 *
 * @returns {{names: string[], modals: string[], traps: string[], ariaHidden: string[]}}
 */
export function applyA11yHardening() {
  const names = [];
  const modals = [];
  const traps = [];
  const ariaHidden = [];
  const wrappedApps = [];

  for (const fix of NAME_FIXES) {
    if (ensureName(fix.id, fix.label)) names.push(fix.id);
  }

  // Controls with no id (the layers panel's opacity slider is selected by
  // class; its own aria-label is set in layers.js, this is the backstop).
  const n = ensureNameBySelector('.layer-opacity-input', 'Layer opacity');
  if (n) names.push('.layer-opacity-input x' + n);

  for (const spec of MODAL_ROOTS) {
    if (wrapModalFocus(spec)) modals.push(spec.id);
    if (wrapFocusTrap(spec.id)) traps.push(spec.id);
  }

  ariaHidden.push(...wireAriaHidden());

  // The settings overlay is created lazily by `_UISettings.show()`, so no
  // click listener can reliably observe the trigger before the root exists.
  // Wrap the App instance's `toggleSettings`-style entry point instead: the
  // App is created before any of this runs, and `window.__UISettings` is the
  // module singleton that owns `show()`/`hide()`. Wrapping `show()` lets us
  // record the trigger from `document.activeElement` at the moment the modal
  // actually opens — which is exactly what focus restore needs.
  if (!applyA11yHardening.__appWrapped) {
    applyA11yHardening.__appWrapped = true;

    const wireSettingsSingleton = () => {
      const s = window.__UISettings;
      if (!s || typeof s.show !== 'function' || s.__a11yWrapped) return;
      s.__a11yWrapped = true;
      const origShow = s.show.bind(s);
      const origHide = typeof s.hide === 'function' ? s.hide.bind(s) : null;
      let lastTrigger = null;

      s.show = function a11yShow(...args) {
        // The element that opened the modal is whatever had focus (keyboard)
        // or the trigger button (pointer). The closure variable is shared
        // between show/hide, so it must be set here, not in a click handler —
        // by the time any listener runs the pointer has already blurred the
        // trigger and `activeElement` is `BODY`.
        const t = document.activeElement && document.activeElement !== document.body
          ? document.activeElement
          : document.getElementById('btn-ui-settings');
        lastTrigger = t;
        return origShow(...args);
      };
      if (origHide) {
        s.hide = function a11yHide(...args) {
          // Capture the trigger BEFORE the original hide() runs: it may move
          // focus, and `lastTrigger` is only meaningful pre-close.
          const trigger = lastTrigger;
          const out = origHide(...args);
          if (trigger && typeof trigger.focus === 'function') {
            requestAnimationFrame(() => {
              if (!s.isOpen || !s.isOpen()) trigger.focus();
            });
          }
          lastTrigger = null;
          return out;
        };
      }
      wrappedApps.push('__UISettings');
    };

    wireSettingsSingleton();
    // The singleton may not exist yet on the very first pass.
    if (!wrappedApps.length) {
      const mo = new MutationObserver(() => {
        wireSettingsSingleton();
        if (wrappedApps.length) mo.disconnect();
      });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => mo.disconnect(), 5000);
    }
  }

  return { names, modals, traps, ariaHidden, wrappedApps };
}

/* ── Automatic ─────────────────────────────────────────────────────── */

let applied = null;

export function initA11yHardening() {
  if (applied) return applied;
  applied = applyA11yHardening();
  // The settings overlay is created on first open, so it is not in the DOM
  // yet. Watch for it and the other late-created surfaces.
  watchForLateModals();
  // Exposed for probes/tests. Never throws.
  try { window.__a11y = applied; } catch { /* ignore */ }
  // Panels render on the first frame; re-apply so any control that appeared
  // late still gets its name.
  if (window.requestAnimationFrame) {
    requestAnimationFrame(() => {
      applied = { ...applied, ...applyA11yHardening() };
      try { window.__a11y = applied; } catch { /* ignore */ }
    });
  }
  return applied;
}

export default initA11yHardening;
