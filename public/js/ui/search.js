import { getSuggestions, searchByQuery } from '../core/api.js';

export const FAMOUS_SPOTS = [
  { name: 'Mount Fuji', region: 'Shizuoka · Yamanashi, Japan', lat: 35.3606, lon: 138.7274 },
  { name: 'Mount Everest', region: 'Khumbu, Nepal · China border', lat: 27.9881, lon: 86.925 },
  { name: 'Grand Canyon', region: 'Arizona, USA', lat: 36.1069, lon: -112.1129 },
  { name: 'Matterhorn', region: 'Pennine Alps, Switzerland', lat: 45.9766, lon: 7.6585 },
  { name: 'Kilimanjaro', region: 'Tanzania', lat: -3.0674, lon: 37.3556 },
  { name: 'Denali', region: 'Alaska, USA', lat: 63.069, lon: -151.0063 },
  { name: 'Mont Blanc', region: 'Alps, France · Italy', lat: 45.8326, lon: 6.8652 },
  { name: 'Aoraki / Mt Cook', region: 'Canterbury, New Zealand', lat: -43.595, lon: 170.1417 },
  { name: 'Machu Picchu', region: 'Cusco, Peru', lat: -13.1631, lon: -72.545 },
  { name: 'Torres del Paine', region: 'Patagonia, Chile', lat: -50.9417, lon: -72.9515 },
  { name: 'Zion Canyon', region: 'Utah, USA', lat: 37.2982, lon: -113.0263 },
  { name: 'Ayers Rock', region: 'Northern Territory, Australia', lat: -25.3444, lon: 131.0369 },
  { name: 'Mount Etna', region: 'Sicily, Italy', lat: 37.751, lon: 14.9934 },
  { name: 'Lofoten Islands', region: 'Nordland, Norway', lat: 68.1472, lon: 13.6098 },
  { name: 'Shimla', region: 'Himachal Pradesh, India', lat: 31.1048, lon: 77.1734 },
  { name: 'Munnar', region: 'Kerala, India', lat: 10.0889, lon: 77.0595 },
  { name: 'Leh', region: 'Ladakh, India', lat: 34.1526, lon: 77.5771 },
  { name: 'Darjeeling', region: 'West Bengal, India', lat: 27.041, lon: 88.2663 },
  { name: 'Nainital', region: 'Uttarakhand, India', lat: 29.3919, lon: 79.4542 },
  { name: 'Ooty', region: 'Nilgiris, Tamil Nadu, India', lat: 11.4064, lon: 76.6932 },
];

const COORD_RE = /^\s*(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)\s*$/;

const SUGGEST_DELAY = 200;
const MAX_SUGGESTIONS = 5;
const SVG_NS = 'http://www.w3.org/2000/svg';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export class SearchBar {
  static FAMOUS_SPOTS = FAMOUS_SPOTS;

  static parseCoords(text) {
    const m = COORD_RE.exec(String(text || ''));
    if (!m) return null;
    const lat = parseFloat(m[1]);
    const lon = parseFloat(m[2]);
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return { lat, lon };
  }

  constructor({ container, store, toasts, onSearch }) {
    this.container = container;
    this.store = store;
    this.toasts = toasts;
    this.onSearch = onSearch;
    this._timer = null;
    this._active = -1;
    this._suggestions = [];
    this._build();
    this._bind();
  }

  _build() {
    this.form = document.createElement('form');
    this.form.className = 'searchbar';
    this.form.setAttribute('role', 'search');

    const icon = document.createElementNS(SVG_NS, 'svg');
    icon.setAttribute('class', 'searchbar-icon');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#icon-search');
    icon.appendChild(use);

    this.input = document.createElement('input');
    this.input.type = 'search';
    this.input.className = 'searchbar-input';
    this.input.placeholder = 'Search places or lat, lon…';
    this.input.setAttribute('autocomplete', 'off');
    this.input.setAttribute('spellcheck', 'false');
    this.input.setAttribute('aria-label', 'Search places or coordinates');
    this.input.setAttribute('role', 'combobox');
    this.input.setAttribute('aria-autocomplete', 'list');
    this.input.setAttribute('aria-expanded', 'false');

    this.box = document.createElement('div');
    this.box.className = 'suggest-box hidden';
    this.box.setAttribute('role', 'listbox');

    this.form.appendChild(icon);
    this.form.appendChild(this.input);
    this.form.appendChild(this.box);
    this.container.appendChild(this.form);
  }

  _bind() {
    this.input.addEventListener('input', () => this._onInput());
    this.input.addEventListener('keydown', (e) => this._onKeydown(e));
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this._submit();
    });
    this._onDocClick = (e) => {
      if (!this.form.contains(e.target)) this._close();
    };
    document.addEventListener('click', this._onDocClick);
  }

  _onInput() {
    clearTimeout(this._timer);
    this._active = -1;
    const q = this.input.value.trim();
    if (!q) { this._close(); return; }
    this._timer = setTimeout(() => this._suggest(q), SUGGEST_DELAY);
  }

  async _suggest(q) {
    let list = [];
    try {
      const res = await getSuggestions(q);
      list = Array.isArray(res) ? res.slice(0, MAX_SUGGESTIONS) : [];
    } catch {
      list = [];
    }
    if (this.input.value.trim() !== q) return;
    this._suggestions = list;
    this._render(list);
  }

  _render(list) {
    this.box.innerHTML = '';
    if (!list.length) { this._close(); return; }
    this._active = -1;
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'suggest-row';
      row.setAttribute('role', 'option');
      row.innerHTML =
        `<span class="suggest-name">${escapeHtml(item.name || '')}</span>` +
        (item.region ? `<span class="suggest-region">${escapeHtml(item.region)}</span>` : '');
      row.addEventListener('click', () => this._pick(item));
      row.addEventListener('mousemove', () => this._setActive(i));
      this.box.appendChild(row);
    }
    this.box.classList.remove('hidden');
    this.input.setAttribute('aria-expanded', 'true');
  }

  _setActive(index) {
    const rows = this.box.children;
    if (!rows.length) return;
    this._active = index;
    for (let i = 0; i < rows.length; i++) {
      rows[i].classList.toggle('is-active', i === index);
    }
  }

  _onKeydown(e) {
    if (e.key === 'Escape') {
      if (!this.box.classList.contains('hidden')) {
        e.preventDefault();
        this._close();
      }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (this.box.classList.contains('hidden')) return;
      const n = this._suggestions.length;
      if (!n) return;
      e.preventDefault();
      if (e.key === 'ArrowDown') this._setActive((this._active + 1) % n);
      else this._setActive(this._active <= 0 ? n - 1 : this._active - 1);
      return;
    }
    if (e.key === 'Enter' && this._active >= 0 && this._active < this._suggestions.length) {
      e.preventDefault();
      this._pick(this._suggestions[this._active]);
    }
  }

  _pick(item) {
    this._close();
    const lat = Number(item.lat);
    const lon = Number(item.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon) &&
        lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      this.onSearch(lat, lon, { name: item.name });
      return;
    }
    this.input.value = item.region || item.name || '';
    this._submit();
  }

  async _submit() {
    const q = this.input.value.trim();
    if (!q) return;
    const coords = SearchBar.parseCoords(q);
    if (coords) {
      this._close();
      this.onSearch(coords.lat, coords.lon);
      return;
    }
    this._close();
    try {
      const res = await searchByQuery(q);
      this.onSearch(Number(res.lat), Number(res.lon), { name: res.location });
    } catch {
      this.toasts.show('Could not find that place', 'error');
    }
  }

  _close() {
    clearTimeout(this._timer);
    this._suggestions = [];
    this._active = -1;
    this.box.classList.add('hidden');
    this.box.innerHTML = '';
    this.input.setAttribute('aria-expanded', 'false');
  }
}
