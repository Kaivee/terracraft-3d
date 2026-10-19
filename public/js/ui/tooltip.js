import { formatElevation } from '../core/units.js';

// Total DEM ground span in degrees (3x3 tiles at zoom 12).
const SPAN_DEG = 3 * (360 / 2 ** 12);

export class HoverTooltip {
  constructor({ container, store, renderer, toasts }) {
    this.container = container;
    this.store = store;
    this.renderer = renderer;
    this._raf = null;

    this.el = document.createElement('div');
    this.el.className = 'tooltip';
    this.el.style.display = 'none';
    this.el.style.position = 'absolute';
    this.el.style.pointerEvents = 'none';

    this.elevEl = document.createElement('span');
    this.elevEl.className = 'tooltip-elev';
    this.coordsEl = document.createElement('span');
    this.coordsEl.className = 'tooltip-coords';
    this.el.append(this.elevEl, this.coordsEl);
    this.container.appendChild(this.el);

    this.container.addEventListener('pointermove', (e) => this._onMove(e));
    this.container.addEventListener('pointerleave', () => this.hide());
  }

  _onMove(e) {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = null;
      this._update(e);
    });
  }

  hide() {
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
    this.el.style.display = 'none';
  }

  _update(e) {
    const st = this.store.get();
    const matrix = st.data && st.data.heightMatrix;
    if (!matrix || !matrix.length || !matrix[0] || !st.place) {
      this.hide();
      return;
    }
    const hit = this.renderer.pickTerrain(e.clientX, e.clientY);
    if (!hit) {
      this.hide();
      return;
    }

    const G = Math.min(st.settings.resolution, matrix.length, matrix[0].length);
    const halfG = (G - 1) / 2;
    const lat = st.place.lat + ((halfG - hit.x) / G) * SPAN_DEG;
    const lon = st.place.lon + ((hit.x - halfG) / G) * SPAN_DEG;

    this.elevEl.textContent = formatElevation(hit.elevMeters, st.settings.unit);
    this.coordsEl.textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

    this._position(e);
  }

  _position(e) {
    const rect = this.container.getBoundingClientRect();
    this.el.style.display = 'block';
    this.el.style.left = '0px';
    this.el.style.top = '0px';
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    const pad = 8;
    const x = Math.max(pad, Math.min(rect.width - w - pad, e.clientX - rect.left + 14));
    const y = Math.max(pad, Math.min(rect.height - h - pad, e.clientY - rect.top + 14));
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
  }
}
