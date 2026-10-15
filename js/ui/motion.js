/**
 * Motion Controller — playback controls for the stroke-by-stroke painting
 * animation.
 *
 * Wraps the existing CanvasManager.renderAnimated() and adds:
 *   - Play / pause / stop
 *   - Speed selector (0.25x, 0.5x, 1x, 2x, 4x)
 *   - Progress scrubber (0–100%)
 *   - Frame-by-frame step forward / step backward
 *   - Live frame counter
 *
 * The MotionController is purely a UI layer: it never touches engine internals.
 * It drives the canvas by calling canvasMgr.render({ progress }) (which the
 * renderer honours by revealing strokes incrementally) and optionally falls
 * back to canvasMgr.renderAnimated() for a single uninterrupted play-through.
 *
 * Warm Dark Creative Tool: uses CSS tokens from :root, DM Sans / DM Mono.
 *
 * @module motion
 */

/**
 * Speed multiplier presets.
 * @type {Array<{value: number, label: string}>}
 */
const SPEED_PRESETS = [
  { value: 0.25, label: '0.25x' },
  { value: 0.5,  label: '0.5x' },
  { value: 1,    label: '1x' },
  { value: 2,    label: '2x' },
  { value: 4,    label: '4x' },
];

/**
 * Default animation duration at 1x speed (ms).
 * @type {number}
 */
const DEFAULT_DURATION = 2000;

/**
 * Scrubber resolution — how many "frames" the animation is divided into.
 * Higher = smoother scrubbing but more renders per drag.
 * @type {number}
 */
const SCRUB_FRAMES = 500;

/**
 * MotionController — builds and manages the playback control bar.
 *
 * @param {object} opts
 * @param {object} opts.canvasMgr — the CanvasManager instance (must expose
 *   renderAnimated, stopAnimation, render, drawStroke).
 * @param {HTMLElement} opts.container — element to render the control bar into.
 */
export class MotionController {
  constructor({ canvasMgr, container }) {
    if (!canvasMgr) throw new Error('MotionController requires a canvasMgr');
    if (!container) throw new Error('MotionController requires a container element');

    /** @type {CanvasManager} */
    this.canvasMgr = canvasMgr;
    /** @type {HTMLElement} */
    this.container = container;

    /** @type {number} current playback progress (0–1) */
    this.progress = 0;
    /** @type {number} current speed multiplier */
    this.speed = 1;
    /** @type {boolean} whether the animation is currently playing */
    this.isPlaying = false;

    /** @type {number|null} rAF id for the current animation loop */
    this._rafId = null;
    /** @type {number|null} timestamp of the last frame */
    this._lastTime = null;
    /** @type {boolean} true while the user is dragging the scrubber */
    this._scrubbing = false;
    /** @type {number} total animated duration at current speed (ms) */
    this._duration = DEFAULT_DURATION;

    /** @type {number} cached total stroke count (for the frame counter) */
    this._totalStrokes = 0;

    this._render();
    this._bindEvents();
    this._updateUI();
  }

  /* ─── Rendering ─────────────────────────────────────────────── */

  /**
   * Build the motion control bar DOM.
   * @private
   */
  _render() {
    this.container.classList.add('motion-controls');
    this.container.innerHTML = '';

    const bar = document.createElement('div');
    bar.className = 'motion-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Painting playback controls');

    // ── Playback buttons ──
    const playGroup = document.createElement('div');
    playGroup.className = 'motion-btn-group';
    playGroup.setAttribute('role', 'group');
    playGroup.setAttribute('aria-label', 'Playback controls');

    this._playBtn = this._makeButton('play', '▶', 'Play (Space)');
    this._pauseBtn = this._makeButton('pause', '❚❚', 'Pause (Space)');
    this._stopBtn = this._makeButton('stop', '■', 'Stop (S)');
    this._stepBackBtn = this._makeButton('step-back', '⏮', 'Step backward');
    this._stepForwardBtn = this._makeButton('step-forward', '⏭', 'Step forward');

    // Hide pause initially (we start paused)
    this._pauseBtn.classList.add('hidden');

    playGroup.append(
      this._stepBackBtn,
      this._playBtn,
      this._pauseBtn,
      this._stopBtn,
      this._stepForwardBtn
    );
    bar.appendChild(playGroup);

    // ── Scrubber ──
    const scrubWrap = document.createElement('div');
    scrubWrap.className = 'motion-scrubber-wrap';

    this._progressFill = document.createElement('div');
    this._progressFill.className = 'motion-progress-fill';

    this._scrubber = document.createElement('input');
    this._scrubber.type = 'range';
    this._scrubber.className = 'motion-scrubber';
    this._scrubber.min = '0';
    this._scrubber.max = String(SCRUB_FRAMES);
    this._scrubber.value = '0';
    this._scrubber.setAttribute('aria-label', 'Painting progress');
    this._scrubber.setAttribute('step', '1');

    scrubWrap.appendChild(this._progressFill);
    scrubWrap.appendChild(this._scrubber);
    bar.appendChild(scrubWrap);

    // ── Speed selector ──
    const speedGroup = document.createElement('div');
    speedGroup.className = 'motion-speed';
    const speedLabel = document.createElement('span');
    speedLabel.className = 'motion-speed-label';
    speedLabel.textContent = 'Speed';
    speedLabel.setAttribute('for', 'motion-speed-select');

    this._speedSelect = document.createElement('select');
    this._speedSelect.id = 'motion-speed-select';
    this._speedSelect.setAttribute('aria-label', 'Playback speed');

    for (const preset of SPEED_PRESETS) {
      const opt = document.createElement('option');
      opt.value = String(preset.value);
      opt.textContent = preset.label;
      opt.selected = preset.value === this.speed;
      this._speedSelect.appendChild(opt);
    }

    speedGroup.append(speedLabel, this._speedSelect);
    bar.appendChild(speedGroup);

    // ── Frame / stroke counter ──
    const counter = document.createElement('div');
    counter.className = 'motion-counter';
    this._counterText = document.createElement('span');
    this._counterText.className = 'motion-counter__text';
    counter.appendChild(this._counterText);
    bar.appendChild(counter);

    this.container.appendChild(bar);
  }

  /**
   * Create a button element.
   * @param {string} action — data-action value
   * @param {string} text — visible + aria text
   * @param {string} title — tooltip
   * @returns {HTMLButtonElement}
   * @private
   */
  _makeButton(action, text, title) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'motion-btn';
    btn.dataset.action = action;
    btn.setAttribute('aria-label', title);
    btn.setAttribute('title', title);
    // Visible text is the label text (emoji icons)
    btn.textContent = text;
    return btn;
  }

  /* ─── Events ────────────────────────────────────────────────── */

  /**
   * Bind all event listeners.
   * @private
   */
  _bindEvents() {
    // Playback buttons
    this._playBtn?.addEventListener('click', () => this.play());
    this._pauseBtn?.addEventListener('click', () => this.pause());
    this._stopBtn?.addEventListener('click', () => this.stop());
    this._stepForwardBtn?.addEventListener('click', () => this.stepForward());
    this._stepBackBtn?.addEventListener('click', () => this.stepBackward());

    // Speed
    this._speedSelect?.addEventListener('change', (e) => {
      this.setSpeed(parseFloat(e.target.value));
    });

    // Scrubber — click/drag to seek
    this._scrubber?.addEventListener('input', (e) => {
      if (this._scrubbing) return; // handled by pointer events below
      const raw = parseFloat(e.target.value);
      const p = raw / SCRUB_FRAMES;
      this._scrubbing = true;
      this._setProgress(p, true);
      this._scrubbing = false;
      this._updateUI();
    });

    // Pointer-based scrubbing for smooth drag + render on every move
    let isDown = false;
    const scrub = this._scrubber;
    if (scrub) {
      scrub.addEventListener('pointerdown', () => {
        isDown = true;
        this._scrubbing = true;
      });
      scrub.addEventListener('pointermove', () => {
        if (!isDown) return;
        const raw = parseFloat(scrub.value);
        const p = raw / SCRUB_FRAMES;
        this._setProgress(p, true);
        this._updateUI();
      });
      const endScrub = () => {
        isDown = false;
        this._scrubbing = false;
        this._updateUI();
      };
      scrub.addEventListener('pointerup', endScrub);
      scrub.addEventListener('pointercancel', endScrub);
      scrub.addEventListener('pointerleave', () => {
        if (isDown) endScrub();
      });
    }

    // Keyboard shortcuts (global)
    this._onKeyDown = (e) => {
      // Don't capture keys when typing in an input
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          this._togglePlay();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          this.stop();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.stepBackward();
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.stepForward();
          break;
      }
    };
    document.addEventListener('keydown', this._onKeyDown);
  }

  /* ─── Playback API ──────────────────────────────────────────── */

  /**
   * Start (or resume) the animation from the current progress.
   */
  play() {
    // If already at the end, restart from beginning
    if (this.progress >= 1) {
      this._reset();
    }
    if (this.isPlaying) return;
    this.isPlaying = true;
    this._pauseBtn.classList.remove('hidden');
    this._playBtn.classList.add('hidden');

    const effectiveDuration = this._duration / this.speed;
    this._lastTime = null;

    const loop = (now) => {
      if (this._lastTime === null) this._lastTime = now;
      const delta = now - this._lastTime;
      const fraction = delta / effectiveDuration;

      this.progress = Math.min(1, this.progress + fraction);
      this._renderProgress(this.progress);
      this._updateUI();

      if (this.progress < 1 && this.isPlaying) {
        this._lastTime = now;
        this._rafId = requestAnimationFrame(loop);
      } else {
        // Reached the end — stop
        this.progress = 1;
        this._renderProgress(1);
        this._updateUI();
        this._onFinish();
      }
    };

    this._rafId = requestAnimationFrame(loop);
    this._dispatchEvent('play');
  }

  /**
   * Pause the animation.
   */
  pause() {
    this.isPlaying = false;
    this._pauseBtn.classList.add('hidden');
    this._playBtn.classList.remove('hidden');

    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._lastTime = null;
    this._updateUI();
    this._dispatchEvent('pause');
  }

  /**
   * Stop the animation and reset to the beginning.
   */
  stop() {
    this.pause();
    this._reset();
    this._renderProgress(0);
    this._updateUI();
    this._dispatchEvent('stop');
  }

  /**
   * Toggle play / pause.
   * @private
   */
  _togglePlay() {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  /**
   * Step forward by a small increment (single frame).
   */
  stepForward() {
    if (this.isPlaying) return;
    const step = 1 / SCRUB_FRAMES;
    this._setProgress(Math.min(1, this.progress + step), true);
    this._updateUI();
    this._dispatchEvent('step-forward');
  }

  /**
   * Step backward by a small increment (single frame).
   */
  stepBackward() {
    if (this.isPlaying) return;
    const step = 1 / SCRUB_FRAMES;
    this._setProgress(Math.max(0, this.progress - step), true);
    this._updateUI();
    this._dispatchEvent('step-backward');
  }

  /**
   * Set playback speed and recompute duration.
   * @param {number} speed — multiplier
   */
  setSpeed(speed) {
    this.speed = speed;
    // Duration scales inversely with speed: faster playback = shorter duration
    this._duration = DEFAULT_DURATION / speed;

    // If currently playing, the next rAF loop iteration will use the new
    // effectiveDuration (computed from this._duration / this.speed).
    // Update select UI
    if (this._speedSelect) {
      const opts = this._speedSelect.querySelectorAll('option');
      opts.forEach((o) => {
        o.selected = parseFloat(o.value) === speed;
      });
    }
    this._dispatchEvent('speed-change', { speed });
  }

  /**
   * Render the canvas at a given progress and refresh the stroke counter.
   * @param {number} progress — 0 to 1
   * @private
   */
  _renderProgress(progress) {
    this.canvasMgr.render({ progress });
    this._refreshStrokeCount();
  }

  /**
   * Seek to a specific progress without playing.
   * @param {number} progress — 0 to 1
   */
  seekTo(progress) {
    this._scrubbing = true;
    this._setProgress(progress, true);
    this._scrubbing = false;
    this._updateUI();
    this._dispatchEvent('seek', { progress });
  }

  /**
   * Set whether the controller is enabled (e.g. disable during generation).
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.container.classList.toggle('disabled', !enabled);
    this._playBtn.disabled = !enabled;
    this._pauseBtn.disabled = !enabled;
    this._stopBtn.disabled = !enabled;
    this._stepForwardBtn.disabled = !enabled;
    this._stepBackBtn.disabled = !enabled;
    this._scrubber.disabled = !enabled;
    this._speedSelect.disabled = !enabled;
  }

  /**
   * Refresh the cached total stroke count from the canvas manager's renderer.
   * Call this after generation completes to update the frame counter.
   */
  refreshStrokeCount() {
    this._refreshStrokeCount();
    this._updateUI();
  }

  /**
   * Recompute the total stroke count from the renderer's layer list.
   * @private
   */
  _refreshStrokeCount() {
    const layers = this.canvasMgr.renderer?._layers;
    if (layers) {
      this._totalStrokes = layers.reduce(
        (sum, l) => sum + (l.strokes?.length || 0), 0
      );
    }
  }

  /**
   * Set progress internally during scrubbing (render live if not scrubbing).
   * @param {number} progress — 0 to 1
   * @param {boolean} live — render immediately
   * @private
   */
  _setProgress(progress, live) {
    this.progress = progress;
    if (live) {
      this._renderProgress(progress);
    }
  }

  /**
   * Reset internal state to beginning (without rendering).
   * @private
   */
  _reset() {
    this.isPlaying = false;
    this.progress = 0;
    this._pauseBtn.classList.add('hidden');
    this._playBtn.classList.remove('hidden');
    this._lastTime = null;
  }

  /**
   * Called when animation reaches 100%.
   * @private
   */
  _onFinish() {
    this.pause();
    this._dispatchEvent('finish');
  }

  /**
   * Destroy the controller — cancels animations, removes DOM and listeners.
   */
  destroy() {
    this.pause();
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    document.removeEventListener('keydown', this._onKeyDown);
    this.container.innerHTML = '';
  }

  /* ─── Internal: UI updates ──────────────────────────────────── */

  /**
   * Update all UI elements to reflect current state.
   * @private
   */
  _updateUI() {
    // Scrubber
    if (this._scrubber) {
      const raw = Math.round(this.progress * SCRUB_FRAMES);
      this._scrubber.value = String(raw);
    }

    // Progress fill width
    if (this._progressFill) {
      this._progressFill.style.width = `${this.progress * 100}%`;
    }

    // Play/pause button visibility
    if (this.isPlaying) {
      this._pauseBtn.classList.remove('hidden');
      this._playBtn.classList.add('hidden');
    } else {
      this._pauseBtn.classList.add('hidden');
      this._playBtn.classList.remove('hidden');
    }

    // Counter
    const pct = Math.round(this.progress * 100);
    const visible = Math.ceil(this._totalStrokes * this.progress);
    if (this._counterText) {
      this._counterText.textContent =
        `${pct}% · ${visible.toLocaleString()}/${this._totalStrokes.toLocaleString()} strokes`;
    }
  }

  /**
   * Dispatch a custom event on the container.
   * @param {string} type
   * @param {object} [detail]
   * @private
   */
  _dispatchEvent(type, detail = {}) {
    this.container.dispatchEvent(new CustomEvent(`motion-${type}`, {
      detail: {
        ...detail,
        progress: this.progress,
        isPlaying: this.isPlaying,
        speed: this.speed,
      },
    }));
  }
}

export default MotionController;
