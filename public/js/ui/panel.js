import { sanitizeSettings, saveSettings } from '../core/settings.js';
import { formatElevation } from '../core/units.js';

const MODES = [
  { key: 'voxel', label: 'Voxel' },
  { key: 'topographic', label: 'Topo' },
  { key: 'heatmap', label: 'Heatmap' },
  { key: 'satellite', label: 'Satellite' },
  { key: 'military', label: 'Military' },
];

const LEGENDS = {
  voxel: 'linear-gradient(90deg,#d4b896,#5cb85c,#2e7d32,#7c9a50,#8c8070,#9a8870,#f4f0ec)',
  topographic: 'linear-gradient(90deg,#1a6b1a,#78c850,#bcd444,#e8d040,#c07828,#8c5018,#e0dcd8)',
  heatmap: 'linear-gradient(90deg,#0000ff,#00ffff,#00ff00,#ffff00,#ff8000,#ff0000)',
  satellite: 'linear-gradient(90deg,#b8c880,#287820,#206018,#605828,#988860,#807868,#e8eef4)',
  military: 'linear-gradient(90deg,#b8a878,#788840,#4a5820,#283814,#18220c)',
};

const SECTIONS = ['Display', 'Lighting', 'Water', 'Mode'];

const SLIDERS = [
  { key: 'resolution', section: 'Display', label: 'Resolution', min: 30, max: 250, step: 10, heavy: true, fmt: (v) => `${v} px` },
  { key: 'heightScale', section: 'Display', label: 'Height scale', min: 0.5, max: 3, step: 0.05, fmt: (v) => `${v.toFixed(2)}×` },
  { key: 'sunAz', section: 'Lighting', label: 'Sun azimuth', min: 0, max: 360, step: 1, fmt: (v) => `${Math.round(v)}°` },
  { key: 'sunEl', section: 'Lighting', label: 'Sun elevation', min: 0, max: 85, step: 1, fmt: (v) => `${Math.round(v)}°` },
  { key: 'waterLevel', section: 'Water', label: 'Water level', min: 0, max: 100, step: 1, water: true },
  { key: 'waterOpacity', section: 'Water', label: 'Water opacity', min: 0.1, max: 1, step: 0.05, fmt: (v) => v.toFixed(2) },
  { key: 'topoBands', section: 'Mode', label: 'Topo bands', min: 4, max: 16, step: 1, fmt: (v) => String(Math.round(v)) },
  { key: 'heatMinCut', section: 'Mode', label: 'Heat min cut', min: 0, max: 1, step: 0.05, fmt: (v) => v.toFixed(2) },
  { key: 'heatMaxCut', section: 'Mode', label: 'Heat max cut', min: 0, max: 1, step: 0.05, fmt: (v) => v.toFixed(2) },
  { key: 'satHaze', section: 'Mode', label: 'Sat haze', min: 0, max: 0.8, step: 0.05, fmt: (v) => v.toFixed(2) },
  { key: 'milContrast', section: 'Mode', label: 'Military contrast', min: 0.5, max: 2, step: 0.05, fmt: (v) => v.toFixed(2) },
];

const TOGGLES = [
  { key: 'showPeakPin', section: 'Display', label: 'Peak pin' },
  { key: 'autoRotate', section: 'Display', label: 'Auto-rotate' },
  { key: 'showWater', section: 'Water', label: 'Show water' },
];

export class TerrainPanel {
  constructor({ container, store, toasts, renderer }) {
    this.container = container;
    this.store = store;
    this.toasts = toasts;
    this.renderer = renderer;
    this._lastData = null;
    this._resTimer = null;
    this.sliders = {};
    this.toggles = {};

    this._build();
    this._settingsSig = null;
    this._syncFromSettings(store.get().settings);
    store.on(() => {
      this._maybeRenderStats();
      this._maybeSyncSettings();
    });
    this._maybeRenderStats();
  }

  _build() {
    const title = document.createElement('h2');
    title.className = 'panel-title';
    title.textContent = 'Terrain Lab';
    this.container.appendChild(title);

    this.sections = {};
    for (const name of SECTIONS) {
      const det = document.createElement('details');
      det.className = 'panel-section';
      det.open = true;
      const sum = document.createElement('summary');
      sum.className = 'panel-section-title';
      sum.textContent = name;
      det.appendChild(sum);
      this.container.appendChild(det);
      this.sections[name] = det;
    }

    for (const cfg of SLIDERS) {
      const field = this._slider(cfg);
      this.sliders[cfg.key] = field;
      this.sections[cfg.section].appendChild(field.wrap);
      field.input.addEventListener('input', () => {
        const v = Number(field.input.value);
        field.update(v);
        this._change(cfg, v);
      });
    }

    for (const cfg of TOGGLES) {
      const toggle = this._toggle(cfg);
      this.toggles[cfg.key] = toggle;
      this.sections[cfg.section].appendChild(toggle.wrap);
      toggle.input.addEventListener('change', () => {
        this._change(cfg, toggle.input.checked);
      });
    }

    this._buildModeSwitcher();
    this._buildLegend();

    this.statsWrap = document.createElement('div');
    this.statsWrap.className = 'stats';
    this.container.appendChild(this.statsWrap);
  }

  _slider(cfg) {
    const wrap = document.createElement('div');
    wrap.className = 'field';

    const row = document.createElement('div');
    row.className = 'field-row';

    const label = document.createElement('label');
    label.className = 'label';
    label.textContent = cfg.label;
    label.setAttribute('for', `panel-${cfg.key}`);

    const val = document.createElement('span');
    val.className = 'val';

    row.appendChild(label);
    row.appendChild(val);

    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'slider';
    input.id = `panel-${cfg.key}`;
    input.min = String(cfg.min);
    input.max = String(cfg.max);
    input.step = String(cfg.step);

    const update = (v) => {
      if (cfg.water) {
        const elev = this.renderer.getWaterElevation(v);
        const unit = this.store.get().settings.unit || 'm';
        val.textContent = `≈ ${formatElevation(elev, unit)}`;
      } else {
        val.textContent = cfg.fmt(v);
      }
    };

    wrap.appendChild(row);
    wrap.appendChild(input);
    return { wrap, input, update };
  }

  _toggle(cfg) {
    const wrap = document.createElement('div');
    wrap.className = 'field';

    const row = document.createElement('label');
    row.className = 'field-row';
    row.setAttribute('for', `panel-${cfg.key}`);

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = cfg.label;

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'switch';
    input.id = `panel-${cfg.key}`;

    row.appendChild(label);
    row.appendChild(input);
    wrap.appendChild(row);
    return { wrap, input };
  }

  _buildModeSwitcher() {
    const group = document.createElement('div');
    group.className = 'seg';
    group.setAttribute('role', 'tablist');
    this.modeBtns = {};
    for (const m of MODES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'seg-btn mode-btn';
      btn.dataset.mode = m.key;
      btn.textContent = m.label;
      btn.setAttribute('role', 'tab');
      btn.addEventListener('click', () => this._setMode(m.key));
      group.appendChild(btn);
      this.modeBtns[m.key] = btn;
    }
    this.sections.Mode.appendChild(group);
  }

  _buildLegend() {
    this.legend = document.createElement('div');
    this.legend.className = 'legend';
    this.sections.Mode.appendChild(this.legend);
  }

  _setMode(mode) {
    const settings = sanitizeSettings({ ...this.store.get().settings, viewMode: mode });
    this.store.set({ settings });
    saveSettings(settings);
    this.renderer.applySettings({ viewMode: mode });
    this._updateModeUI(mode);
  }

  _updateModeUI(mode) {
    for (const key in this.modeBtns) {
      const on = key === mode;
      this.modeBtns[key].classList.toggle('btn-on', on);
      this.modeBtns[key].setAttribute('aria-pressed', String(on));
    }
    this.legend.style.background = LEGENDS[mode] || LEGENDS.voxel;
  }

  _change(cfg, value) {
    const settings = sanitizeSettings({ ...this.store.get().settings, [cfg.key]: value });
    this.store.set({ settings });
    saveSettings(settings);
    if (cfg.key === 'autoRotate') this.renderer.setAutoRotate(value);
    if (cfg.key === 'resolution') {
      clearTimeout(this._resTimer);
      this._resTimer = setTimeout(() => {
        this.renderer.applySettings({ resolution: value });
      }, 120);
    } else {
      this.renderer.applySettings({ [cfg.key]: value });
    }
  }

  _syncFromSettings(settings) {
    for (const key in this.sliders) {
      const v = Number(settings[key]);
      this.sliders[key].input.value = String(v);
      this.sliders[key].update(v);
    }
    for (const key in this.toggles) {
      this.toggles[key].input.checked = !!settings[key];
    }
    this._updateModeUI(settings.viewMode || 'voxel');
  }

  _maybeRenderStats() {
    const data = this.store.get().data;
    if (data === this._lastData) return;
    this._lastData = data;
    this._renderStats();
  }

  _maybeSyncSettings() {
    const s = this.store.get().settings || {};
    const sig = SLIDERS.map((c) => c.key).join('|') + ':' +
      SLIDERS.map((c) => s[c.key]).join('|') + '|' +
      TOGGLES.map((c) => s[c.key]).join('|') + '|' +
      s.viewMode + '|' + s.unit;
    if (sig === this._settingsSig) return;
    this._settingsSig = sig;
    this._syncFromSettings(s);
  }

  _renderStats() {
    this.statsWrap.innerHTML = '';
    const stats = this.store.get().stats;
    if (!stats) return;
    const unit = this.store.get().settings.unit || 'm';
    const rows = [
      ['Min', formatElevation(stats.min, unit)],
      ['Max', formatElevation(stats.max, unit)],
      ['Mean', formatElevation(stats.mean, unit)],
      ['Prominence', formatElevation(stats.prominence, unit)],
      ['Footprint', `${stats.footprintKm2.toFixed(2)} km²`],
      ['Resolution', `${this.store.get().settings.resolution} px`],
    ];
    for (const [label, value] of rows) {
      const stat = document.createElement('div');
      stat.className = 'stat';
      const lab = document.createElement('span');
      lab.className = 'label';
      lab.textContent = label;
      const val = document.createElement('span');
      val.className = 'val';
      val.textContent = value;
      stat.appendChild(lab);
      stat.appendChild(val);
      this.statsWrap.appendChild(stat);
    }
    if (stats.failedTileCount > 0) {
      const warn = document.createElement('div');
      warn.className = 'warn';
      warn.textContent = `${stats.failedTileCount} tiles failed to load — some areas may be flat`;
      this.statsWrap.appendChild(warn);
    }
  }
}
