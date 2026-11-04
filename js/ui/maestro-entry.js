// Maestro-compatible bundle entry — imports modules in load order
// debug and settings must load before app for console hooks and preferences
import './debug.js';
import './settings.js';

import { initApp } from './app.js';

const app = initApp();

if (app) {
  window._wwwPaint = app;

  // Load image button
  const loadBtn = document.getElementById('btn-load-image');
  const fileInput = document.getElementById('image-file-input');

  loadBtn?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      await app.loadImageFile(file);
    } catch (err) {
      console.error(err);
      app._showError('Failed to load: ' + err.message);
    }
  });

  // Generate button (round, top bar)
  document.getElementById('btn-gener')?.addEventListener('click', () => app.generate());

  // Paint mode weight slider value display
  const weightSlider = document.getElementById('paint-weight');
  const weightValue = document.getElementById('paint-weight-value');
  if (weightSlider && weightValue) {
    weightSlider.addEventListener('input', () => {
      weightValue.textContent = weightSlider.value;
    });
  }

  // Export button (round, top bar)
  document.getElementById('btn-export')?.addEventListener('click', () => {
    app.exportMgr?.show({
      width: app.engine.width,
      height: app.engine.height,
      background: app.engine.background,
    });
  });

  // Navigation between panels
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.nav;
      document.querySelectorAll('.panel').forEach(p => {
        p.classList.toggle('panel--active', p.classList.contains('panel--' + target));
      });
      document.querySelectorAll('.nav-btn').forEach(nav => {
        nav.classList.toggle('nav-btn--active', nav === btn);
      });
    });
  });
  // Mobile toggle buttons — the panels are overlays below tablet, so they
  // slide in and out. On desktop both panels are always visible and these
  // buttons are hidden, so the handlers are inert there.
  const controlsPanel = document.querySelector('.panel--controls');
  const layersPanel = document.querySelector('.panel--layers');
  const toggleControls = document.getElementById('toggle-controls');
  const toggleLayers = document.getElementById('toggle-layers');

  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

  function closeMobilePanels() {
    if (controlsPanel) controlsPanel.classList.add('panel--mobile-closed');
    if (layersPanel) layersPanel.classList.add('panel--mobile-closed');
    if (toggleControls) toggleControls.classList.remove('mobile-toggle--active');
    if (toggleLayers) toggleLayers.classList.remove('mobile-toggle--active');
  }

  toggleControls?.addEventListener('click', () => {
    if (!controlsPanel) return;
    const closed = controlsPanel.classList.contains('panel--mobile-closed') || controlsPanel.classList.contains('is-collapsed');
    app._setPanelCollapsed(controlsPanel, !closed);
  });

  toggleLayers?.addEventListener('click', () => {
    if (!layersPanel) return;
    const closed = layersPanel.classList.contains('panel--mobile-closed') || layersPanel.classList.contains('is-collapsed');
    app._setPanelCollapsed(layersPanel, !closed);
  });

  // On mobile, panels start closed so the canvas takes the full screen.
  if (isMobile()) {
    closeMobilePanels();
  }

  // Re-evaluate on resize
  window.addEventListener('resize', () => {
    if (isMobile()) {
      closeMobilePanels();
    } else {
      controlsPanel?.classList.remove('panel--mobile-closed');
      layersPanel?.classList.remove('panel--mobile-closed');
    }
  });

}
