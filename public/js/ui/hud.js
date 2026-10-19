import { formatElevation, formatDistance } from '../core/units.js';
import { cellSizeMeters } from '../core/terrainMath.js';
import { sanitizeSettings, saveSettings } from '../core/settings.js';
import { copyToClipboard } from '../core/share.js';

// [data-action, label, icon symbol name (null → text-only button)]
const BUTTONS = [
  ['home', 'Home', 'icon-home'],
  ['top', 'Top', 'icon-top'],
  ['iso', 'Iso', 'icon-iso'],
  ['walk', 'Walk', 'icon-walk'],
  ['mylocation', 'My location', 'icon-locate'],
  ['screenshot', 'Screenshot', 'icon-camera'],
  ['profile', 'Profile', 'icon-graph'],
  ['save', 'Save', 'icon-bookmark'],
  ['share', 'Share', 'icon-share'],
];

// Nice round scale-bar distances (meters). 1/2/5/10/20/50 km.
const SCALE_M = [1000, 2000, 5000, 10000, 20000, 50000];

// Round ft for small spans (1/2/5 kft), round mi for large (1/2/5/10/20/50 mi).
const SCALE_FT = [
  1000 / 3.28084,
  2000 / 3.28084,
  5000 / 3.28084,
  1609.344,
  3218.688,
  8046.72,
  16093.44,
  32186.88,
  80467.2,
];

function el(tag, className, text, type) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  if (type) node.type = type;
  return node;
}

function iconEl(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${name}`);
  svg.appendChild(use);
  return svg;
}

function centerElev(data) {
  const m = data.heightMatrix;
  if (!m || !m.length || !m[0] || !m[0].length) return 0;
  return m[Math.floor(m.length / 2)][Math.floor(m[0].length / 2)];
}

export function pickScaleDistance(targetM, unit) {
  const cand = unit === 'ft' ? SCALE_FT : SCALE_M;
  let chosen = cand[0];
  for (const c of cand) if (c <= targetM) chosen = c;
  return chosen;
}

export class Hud {
  constructor({ container, store, renderer, toasts, callbacks }) {
    this.container = container;
    this.store = store;
    this.renderer = renderer;
    this.toasts = toasts;
    this.callbacks = callbacks || {};
    this._sig = null;
    this.buttons = {};

    this._build();
    this._offStore = this.store.on(() => this._onStore(this.store.get()));
    this._onStore(this.store.get());
  }

  _build() {
    const c = this.container;

    const status = el('div', 'hud-status');
    this.nameEl = el('span', 'hud-name');
    this.coordsEl = el('span', 'hud-coords');
    this.coordsEl.title = 'Click to copy coordinates';
    this.elevEl = el('span', 'hud-elev');
    this.dataEl = el('span', 'hud-data');
    status.append(this.nameEl, this.coordsEl, this.elevEl, this.dataEl);

    const scaleWrap = el('div', 'hud-scale');
    this.scaleBar = el('div', 'scale-bar');
    this.scaleBarInner = el('div', 'scale-bar-inner');
    this.scaleLabel = el('span', 'scale-label');
    this.scaleBar.appendChild(this.scaleBarInner);
    scaleWrap.append(this.scaleBar, this.scaleLabel);

    const seg = el('div', 'seg');
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', 'Units');
    this.segM = el('button', 'seg-btn', 'm', 'button');
    this.segM.dataset.unit = 'm';
    this.segFt = el('button', 'seg-btn', 'ft', 'button');
    this.segFt.dataset.unit = 'ft';
    seg.append(this.segM, this.segFt);

    const actions = el('div', 'hud-actions');
    for (const [action, label, icon] of BUTTONS) {
      const b = el('button', 'hud-btn', '', 'button');
      b.dataset.action = action;
      if (icon) b.appendChild(iconEl(icon));
      b.appendChild(el('span', 'hud-btn-label', label));
      actions.appendChild(b);
      this.buttons[action] = b;
    }

    const controls = el('div', 'hud-controls');
    controls.append(seg, actions);

    this.warnEl = el('div', 'hud-warn');
    this.warnEl.style.display = 'none';

    c.append(status, scaleWrap, controls, this.warnEl);

    c.addEventListener('click', (e) => this._onClick(e));
  }

  _onClick(e) {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      this._onAction(btn.dataset.action);
      return;
    }
    const unitBtn = e.target.closest('.seg-btn[data-unit]');
    if (unitBtn) {
      this._onUnit(unitBtn.dataset.unit);
      return;
    }
    if (e.target.closest('.hud-coords')) this._copyCoords();
  }

  _onAction(action) {
    switch (action) {
      case 'home':
      case 'top':
      case 'iso':
        this.renderer.flyToPreset(action);
        break;
      case 'walk': {
        const result = this.renderer.startPOV();
        if (result === 'no-data') this.toasts.show('Load a terrain first', 'warn');
        else if (result === 'picking') this.toasts.show('Click a spot on the terrain to start walking', 'info', 4200);
        break;
      }
      case 'screenshot':
        this._screenshot();
        break;
      case 'mylocation':
      case 'profile':
      case 'save':
      case 'share': {
        const cb = this.callbacks[action];
        if (typeof cb === 'function') cb();
        break;
      }
    }
  }

  _onUnit(unit) {
    if (unit !== 'm' && unit !== 'ft') return;
    const settings = sanitizeSettings({ ...(this.store.get().settings || {}), unit });
    saveSettings(settings);
    this.store.set({ settings });
    this.renderer.setUnit(unit);
  }

  async _copyCoords() {
    const place = this.store.get().place;
    if (!place) return;
    const ok = await copyToClipboard(`${place.lat}, ${place.lon}`);
    this.toasts.show('Coordinates copied', ok ? 'success' : 'warn', 2600);
  }

  _screenshot() {
    const place = this.store.get().place;
    const raw = place ? place.name : '';
    const safe = String(raw).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'map';
    this.renderer.screenshot(`terrain-${safe}`);
  }

  _onStore(state) {
    const { place, data, settings, stats } = state;
    const sig = place ? `${place.lat}|${place.lon}|${settings.unit}|${data ? data.cached : ''}` : null;
    if (sig !== this._sig) {
      this._sig = sig;
      this._renderStatus(state);
      this._renderScale(state);
    }
    this._updateToggles(state);
    this._updateWarn(state);
  }

  _renderStatus(state) {
    const { place, data, settings } = state;
    if (!place || !data) {
      this.nameEl.textContent = '';
      this.coordsEl.textContent = '';
      this.elevEl.textContent = '';
      this.dataEl.textContent = '';
      this.dataEl.classList.remove('is-cached', 'is-live');
      return;
    }
    this.nameEl.textContent = place.name;
    this.coordsEl.textContent = `${place.lat.toFixed(4)}, ${place.lon.toFixed(4)}`;
    this.elevEl.textContent = formatElevation(centerElev(data), settings.unit);
    this.dataEl.textContent = data.cached ? 'Cache HIT' : 'Live DEM';
    this.dataEl.classList.toggle('is-cached', !!data.cached);
    this.dataEl.classList.toggle('is-live', !data.cached);
  }

  _renderScale(state) {
    const { place, data, settings } = state;
    if (!place || !data) {
      this.scaleBar.style.display = 'none';
      return;
    }
    this.scaleBar.style.display = '';
    const spanM = cellSizeMeters(place.lat, 12, data.gridSize) * data.gridSize;
    const chosen = pickScaleDistance(spanM * 0.35, settings.unit);
    const pct = Math.min(100, Math.max(2, (chosen / spanM) * 100));
    this.scaleBarInner.style.width = `${pct}%`;
    this.scaleLabel.textContent = `≈ ${formatDistance(chosen, settings.unit)}`;
  }

  _updateToggles(state) {
    const s = state.settings;
    this._setOn(this.segM, s.unit === 'm');
    this._setOn(this.segFt, s.unit === 'ft');
  }

  _setOn(node, on) {
    node.classList.toggle('is-on', on);
    node.setAttribute('aria-pressed', String(on));
  }

  _updateWarn(state) {
    const n = state.stats ? state.stats.failedTileCount || 0 : 0;
    if (n > 0) {
      this.warnEl.textContent = `${n} tile${n === 1 ? '' : 's'} failed to load — some areas may be flat`;
      this.warnEl.style.display = '';
    } else {
      this.warnEl.style.display = 'none';
    }
  }
}
