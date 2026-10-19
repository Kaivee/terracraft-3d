/**
 * controls.js — View Mode selector, tool panels, water/peak toggles, and 3D export controls.
 *
 * Improvements over the original:
 *  - Expensive 3D rebuilds are debounced so slider drags stay smooth
 *  - All defaults live in one DEFAULTS object (used by reset())
 *  - User settings persist to localStorage and restore on load
 *  - Mode cards are keyboard accessible
 *  - updateLegendColors() drives the elevation ramp legend
 */

const SETTINGS_KEY = 'terracraft:settings';

const DEFAULTS = {
  resolution: 150,
  heightScale: 1.5,
  sunAz: 135,
  sunEl: 45,
  topoBands: 8,
  heatMin: 0,
  heatMax: 1,
  satHaze: 0,
  milContrast: 1.0,
  waterOpacity: 0.6,
  showPeakPin: true,
  viewMode: 'voxel',
};

/** Color ramps shown in the on-screen legend, matched to the view-mode shaders. */
const LEGEND_RAMPS = {
  voxel: 'linear-gradient(90deg, #0d3a8a, #d4b896, #5cb85c, #2e7d32, #7c9a50, #8c8070, #9a8870, #f4f0ec)',
  topographic: 'linear-gradient(90deg, #1a6b1a, #78c850, #bcd444, #e8d040, #c07828, #8c5018, #e0dcd8)',
  heatmap: 'linear-gradient(90deg, #0000ff, #00ffff, #00ff00, #ffff00, #ff8000, #ff0000)',
  satellite: 'linear-gradient(90deg, #004080, #1560a0, #b8c880, #207820, #606028, #988878, #d0d8e8, #e8eef4)',
  military: 'linear-gradient(90deg, #142838, #2a4a5a, #b8a878, #784840, #4a5820, #281c14)',
};

function readJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable — ignore silently.
  }
}

export class ControlPanel {
  constructor(renderer) {
    this.renderer = renderer;
    this.isOpen = false;
    this.currentMode = 'voxel';

    // Core elements
    this.panel     = document.getElementById('control-panel');
    this.toggleBtn = document.getElementById('panel-toggle-btn');
    this.closeBtn  = document.getElementById('panel-close-btn');
    this.resetBtn  = document.getElementById('reset-btn');

    // Shared sliders
    this.resolutionSlider  = document.getElementById('resolution-slider');
    this.resolutionValue   = document.getElementById('resolution-value');
    this.heightScaleSlider = document.getElementById('height-scale-slider');
    this.heightScaleValue  = document.getElementById('height-scale-value');
    this.sunAzSlider       = document.getElementById('sun-azimuth-slider');
    this.sunAzValue        = document.getElementById('sun-azimuth-value');
    this.sunElSlider       = document.getElementById('sun-elevation-slider');
    this.sunElValue        = document.getElementById('sun-elevation-value');

    // Mode cards
    this.modeCards   = document.querySelectorAll('.mode-card');
    this.modeOptions = document.querySelectorAll('.mode-options');

    // Topographic
    this.topoBandsSlider = document.getElementById('topo-bands-slider');
    this.topoBandsValue  = document.getElementById('topo-bands-value');

    // Heatmap
    this.heatMinSlider = document.getElementById('heat-min-slider');
    this.heatMinValue  = document.getElementById('heat-min-value');
    this.heatMaxSlider = document.getElementById('heat-max-slider');
    this.heatMaxValue  = document.getElementById('heat-max-value');

    // Satellite
    this.satHazeSlider = document.getElementById('sat-haze-slider');
    this.satHazeValue  = document.getElementById('sat-haze-value');

    // Military
    this.milContrastSlider = document.getElementById('mil-contrast-slider');
    this.milContrastValue  = document.getElementById('mil-contrast-value');

    // Water Layer Controls
    this.waterToggle   = document.getElementById('water-toggle');
    this.waterControlsContainer = document.getElementById('water-controls');
    this.waterLevelSlider  = document.getElementById('water-level-slider');
    this.waterLevelValue   = document.getElementById('water-level-value');
    this.waterOpacitySlider = document.getElementById('water-opacity-slider');
    this.waterOpacityValue  = document.getElementById('water-opacity-value');

    // Peak Marker Pin
    this.peakPinToggle = document.getElementById('peak-pin-toggle');

    // Export 3D Buttons
    this.exportObjBtn = document.getElementById('export-obj-btn');
    this.exportStlBtn = document.getElementById('export-stl-btn');

    // Legend
    this.legendBar = document.getElementById('legend-bar');

    // Expensive rebuilds are debounced.
    this._rerenderDebounced = this._debounce((opts) => this.renderer.rerender(opts), 150);
    this._saveDebounced = this._debounce(() => this.saveSettings(), 400);

    this._bindEvents();
    this._restoreSettings();
  }

  _debounce(fn, ms = 150) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  _bindEvents() {
    this.toggleBtn.addEventListener('click', () => this.toggle());
    this.closeBtn.addEventListener('click', () => this.close());
    this.resetBtn.addEventListener('click', () => this.reset());

    // ── Shared sliders ──
    this._liveSlider(this.resolutionSlider, this.resolutionValue, (v) => `${v}`, null);
    this.resolutionSlider.addEventListener('change', (e) => {
      this._rerenderDebounced({ resolution: parseInt(e.target.value, 10) });
      this._saveDebounced();
    });

    this._liveSlider(this.heightScaleSlider, this.heightScaleValue, (v) => `${parseFloat(v).toFixed(1)}×`, null);
    this.heightScaleSlider.addEventListener('change', (e) => {
      this._rerenderDebounced({ heightScale: parseFloat(e.target.value) });
      this._saveDebounced();
    });

    this.sunAzSlider.addEventListener('input', (e) => {
      this.sunAzValue.textContent = `${e.target.value}°`;
      this.renderer.setSunPosition(parseInt(e.target.value, 10), parseInt(this.sunElSlider.value, 10));
    });
    this.sunElSlider.addEventListener('input', (e) => {
      this.sunElValue.textContent = `${e.target.value}°`;
      this.renderer.setSunPosition(parseInt(this.sunAzSlider.value, 10), parseInt(e.target.value, 10));
    });
    this.sunAzSlider.addEventListener('change', () => this._saveDebounced());
    this.sunElSlider.addEventListener('change', () => this._saveDebounced());

    // ── Mode card selection (mouse + keyboard) ──
    this.modeCards.forEach((card) => {
      const activate = () => {
        const mode = card.dataset.mode;
        if (mode === this.currentMode) return;
        this._setMode(mode);
      };
      card.addEventListener('click', activate);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      });
    });

    // ── Topographic ──
    if (this.topoBandsSlider) {
      this._liveSlider(this.topoBandsSlider, this.topoBandsValue,
        (v) => `${v} bands`,
        (v) => this._rerenderDebounced({ topoBands: parseInt(v, 10) }));
    }

    // ── Heatmap ──
    if (this.heatMinSlider) {
      this._liveSlider(this.heatMinSlider, this.heatMinValue,
        (v) => `${Math.round(v * 100)}%`,
        (v) => this._rerenderDebounced({ heatMinCut: parseFloat(v) }));

      this._liveSlider(this.heatMaxSlider, this.heatMaxValue,
        (v) => `${Math.round(v * 100)}%`,
        (v) => this._rerenderDebounced({ heatMaxCut: parseFloat(v) }));
    }

    // ── Satellite ──
    if (this.satHazeSlider) {
      this._liveSlider(this.satHazeSlider, this.satHazeValue,
        (v) => `${Math.round(v * 100)}%`,
        (v) => this._rerenderDebounced({ satHaze: parseFloat(v) }));
    }

    // ── Military ──
    if (this.milContrastSlider) {
      this._liveSlider(this.milContrastSlider, this.milContrastValue,
        (v) => `${parseFloat(v).toFixed(1)}`,
        (v) => this._rerenderDebounced({ milContrast: parseFloat(v) }));
    }

    // ── Water Layer Events ──
    if (this.waterToggle) {
      this.waterToggle.addEventListener('change', (e) => {
        const active = e.target.checked;
        this.waterControlsContainer.classList.toggle('hidden', !active);
        this._rerenderDebounced({ showWater: active });
      });

      this._liveSlider(this.waterLevelSlider, this.waterLevelValue,
        (v) => {
          const elev = this.renderer.getWaterElevation ? this.renderer.getWaterElevation(v) : v;
          return `${Math.round(elev)}m`;
        },
        (v) => this._rerenderDebounced({ waterLevel: parseFloat(v) }));

      this._liveSlider(this.waterOpacitySlider, this.waterOpacityValue,
        (v) => `${Math.round(v * 100)}%`,
        (v) => this._rerenderDebounced({ waterOpacity: parseFloat(v) }));
    }

    // ── Peak Marker Toggle Event ──
    if (this.peakPinToggle) {
      this.peakPinToggle.addEventListener('change', (e) => {
        this._rerenderDebounced({ showPeakPin: e.target.checked });
        this._saveDebounced();
      });
    }

    // ── Export 3D Model Events ──
    if (this.exportObjBtn) {
      this.exportObjBtn.addEventListener('click', () => {
        const name = document.getElementById('status-location').textContent.replace(/[^a-z0-9]/gi, '_');
        this.renderer.exportOBJ(name || 'TerraCraft_3D');
      });
    }

    if (this.exportStlBtn) {
      this.exportStlBtn.addEventListener('click', () => {
        const name = document.getElementById('status-location').textContent.replace(/[^a-z0-9]/gi, '_');
        this.renderer.exportSTL(name || 'TerraCraft_3D');
      });
    }
  }

  _setMode(mode) {
    this.currentMode = mode;
    this.modeCards.forEach((c) => c.classList.toggle('active', c.dataset.mode === mode));
    this.modeOptions.forEach((opt) => opt.classList.toggle('visible', opt.dataset.forMode === mode));
    this.updateLegendColors();
    this._rerenderDebounced({ viewMode: mode });
    this._saveDebounced();
  }

  _liveSlider(slider, label, formatter, onChange) {
    if (!slider || !label) return;
    slider.addEventListener('input', (e) => {
      label.textContent = formatter(e.target.value);
      if (onChange) onChange(e.target.value);
    });
    if (onChange) slider.addEventListener('change', () => this._saveDebounced());
  }

  // ── Legend ──
  updateLegendColors() {
    if (!this.legendBar) return;
    this.legendBar.style.background = LEGEND_RAMPS[this.currentMode] || LEGEND_RAMPS.voxel;
  }

  // ── Persistence ──
  saveSettings() {
    const settings = {
      resolution: this.resolutionSlider.value,
      heightScale: this.heightScaleSlider.value,
      sunAz: this.sunAzSlider.value,
      sunEl: this.sunElSlider.value,
      topoBands: this.topoBandsSlider ? this.topoBandsSlider.value : undefined,
      heatMin: this.heatMinSlider ? this.heatMinSlider.value : undefined,
      heatMax: this.heatMaxSlider ? this.heatMaxSlider.value : undefined,
      satHaze: this.satHazeSlider ? this.satHazeSlider.value : undefined,
      milContrast: this.milContrastSlider ? this.milContrastSlider.value : undefined,
      waterOpacity: this.waterOpacitySlider ? this.waterOpacitySlider.value : undefined,
      showPeakPin: this.peakPinToggle ? this.peakPinToggle.checked : true,
      viewMode: this.currentMode,
    };
    writeJSON(SETTINGS_KEY, settings);
  }

  _restoreSettings() {
    const s = readJSON(SETTINGS_KEY);
    if (!s) return;

    const apply = (slider, label, value, formatter) => {
      if (!slider || value === undefined) return;
      slider.value = value;
      if (label) label.textContent = formatter(value);
    };

    apply(this.resolutionSlider, this.resolutionValue, s.resolution, (v) => `${v}`);
    apply(this.heightScaleSlider, this.heightScaleValue, s.heightScale, (v) => `${parseFloat(v).toFixed(1)}×`);
    apply(this.sunAzSlider, this.sunAzValue, s.sunAz, (v) => `${v}°`);
    apply(this.sunElSlider, this.sunElValue, s.sunEl, (v) => `${v}°`);
    apply(this.topoBandsSlider, this.topoBandsValue, s.topoBands, (v) => `${v} bands`);
    apply(this.heatMinSlider, this.heatMinValue, s.heatMin, (v) => `${Math.round(v * 100)}%`);
    apply(this.heatMaxSlider, this.heatMaxValue, s.heatMax, (v) => `${Math.round(v * 100)}%`);
    apply(this.satHazeSlider, this.satHazeValue, s.satHaze, (v) => `${Math.round(v * 100)}%`);
    apply(this.milContrastSlider, this.milContrastValue, s.milContrast, (v) => `${parseFloat(v).toFixed(1)}`);
    apply(this.waterOpacitySlider, this.waterOpacityValue, s.waterOpacity, (v) => `${Math.round(v * 100)}%`);
    if (this.peakPinToggle && s.showPeakPin !== undefined) this.peakPinToggle.checked = !!s.showPeakPin;

    // Push restored values into the renderer so the next render uses them.
    const opts = {
      resolution: parseInt(s.resolution, 10) || DEFAULTS.resolution,
      heightScale: parseFloat(s.heightScale) || DEFAULTS.heightScale,
      topoBands: parseInt(s.topoBands, 10) || DEFAULTS.topoBands,
      heatMinCut: parseFloat(s.heatMin),
      heatMaxCut: parseFloat(s.heatMax),
      satHaze: parseFloat(s.satHaze),
      milContrast: parseFloat(s.milContrast),
      waterOpacity: parseFloat(s.waterOpacity),
      showPeakPin: this.peakPinToggle ? this.peakPinToggle.checked : true,
    };
    this.renderer.rerender(opts);

    if (s.sunAz !== undefined && s.sunEl !== undefined) {
      this.renderer.setSunPosition(parseInt(s.sunAz, 10), parseInt(s.sunEl, 10));
    }

    if (s.viewMode) {
      this._setMode(s.viewMode);
    }
  }

  show() {
    this.toggleBtn.classList.remove('hidden');
    this.open();
  }

  open()   { this.isOpen = true;  this.panel.classList.add('visible');    this.toggleBtn.classList.add('hidden'); }
  close()  { this.isOpen = false; this.panel.classList.remove('visible'); this.toggleBtn.classList.remove('hidden'); }
  toggle() { this.isOpen ? this.close() : this.open(); }

  setWaterState(active, level = 0) {
    if (!this.waterToggle) return;
    this.waterToggle.checked = active;
    this.waterControlsContainer.classList.toggle('hidden', !active);

    this.waterLevelSlider.value = level;
    const elev = this.renderer.getWaterElevation ? this.renderer.getWaterElevation(level) : level;
    this.waterLevelValue.textContent = `${Math.round(elev)}m`;
  }

  reset() {
    const d = DEFAULTS;

    this.resolutionSlider.value = d.resolution; this.resolutionValue.textContent = `${d.resolution}`;
    this.heightScaleSlider.value = d.heightScale; this.heightScaleValue.textContent = `${d.heightScale}×`;
    this.sunAzSlider.value = d.sunAz; this.sunAzValue.textContent = `${d.sunAz}°`;
    this.sunElSlider.value = d.sunEl; this.sunElValue.textContent = `${d.sunEl}°`;

    if (this.topoBandsSlider) { this.topoBandsSlider.value = d.topoBands; this.topoBandsValue.textContent = `${d.topoBands} bands`; }
    if (this.heatMinSlider)   { this.heatMinSlider.value = d.heatMin;   this.heatMinValue.textContent = `${Math.round(d.heatMin * 100)}%`; }
    if (this.heatMaxSlider)   { this.heatMaxSlider.value = d.heatMax;   this.heatMaxValue.textContent = `${Math.round(d.heatMax * 100)}%`; }
    if (this.satHazeSlider)   { this.satHazeSlider.value = d.satHaze;   this.satHazeValue.textContent = `${Math.round(d.satHaze * 100)}%`; }
    if (this.milContrastSlider) { this.milContrastSlider.value = d.milContrast; this.milContrastValue.textContent = `${d.milContrast}`; }

    if (this.waterToggle) {
      this.waterToggle.checked = false;
      this.waterControlsContainer.classList.add('hidden');
      this.waterLevelSlider.value = 0; this.waterLevelValue.textContent = '0m';
      this.waterOpacitySlider.value = d.waterOpacity; this.waterOpacityValue.textContent = `${Math.round(d.waterOpacity * 100)}%`;
    }

    if (this.peakPinToggle) {
      this.peakPinToggle.checked = d.showPeakPin;
    }

    this._setMode(d.viewMode);

    this.renderer.setSunPosition(d.sunAz, d.sunEl);
    this.renderer.rerender({
      resolution: d.resolution, heightScale: d.heightScale, viewMode: d.viewMode,
      topoBands: d.topoBands, heatMinCut: d.heatMin, heatMaxCut: d.heatMax,
      satHaze: d.satHaze, milContrast: d.milContrast,
      showWater: false, waterLevel: 0, waterOpacity: d.waterOpacity, showPeakPin: d.showPeakPin,
    });
    this.saveSettings();
  }
}
