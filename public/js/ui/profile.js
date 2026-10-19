import { sampleProfile } from '../core/terrainMath.js';
import { formatElevation } from '../core/units.js';

export class ProfileOverlay {
  constructor({ container, store, renderer, toasts }) {
    this.container = container;
    this.store = store;
    this.renderer = renderer;
    this.toasts = toasts;

    this._active = false;
    this._a = null;
    this._b = null;
    this._dots = [];
    this._chartShown = false;

    this._build();

    this._offStore = this.store.on(() => {
      if (this.store.get().profile) this._drawChart();
    });
    this._onResize = () => { if (this.store.get().profile) this._drawChart(); };
    window.addEventListener('resize', this._onResize);
  }

  _build() {
    const card = document.createElement('div');
    card.className = 'profile-chart';
    card.classList.add('hidden');
    card.style.pointerEvents = 'auto';

    const head = document.createElement('div');
    head.className = 'profile-chart-head';

    const title = document.createElement('span');
    title.className = 'profile-chart-title';
    title.textContent = 'Elevation Profile';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'profile-close';
    close.setAttribute('aria-label', 'Close profile');
    close.innerHTML = '<svg class="icon"><use href="#icon-close"/></svg>';
    close.addEventListener('click', () => this.stop());

    head.append(title, close);

    const canvas = document.createElement('canvas');
    canvas.className = 'profile-canvas';
    canvas.style.width = '100%';
    canvas.style.height = '180px';

    card.append(head, canvas);
    this.container.appendChild(card);
    this._canvas = canvas;
  }

  _onPick = (e) => {
    if (!this._active || this._b) return;
    const hit = this.renderer.pickTerrain(e.clientX, e.clientY);
    if (!hit) return;
    if (!this._a) {
      this._a = hit;
      this._placeDot('A', e);
      this.toasts.show('Now click point B', 'info');
      return;
    }
    this._b = hit;
    this._placeDot('B', e);
    this._computeProfile();
  };

  _placeDot(label, e) {
    const dot = document.createElement('div');
    dot.className = `profile-dot profile-dot-${label.toLowerCase()}`;
    dot.textContent = label;
    dot.setAttribute('aria-hidden', 'true');
    const rect = this.container.getBoundingClientRect();
    dot.style.left = `${e.clientX - rect.left}px`;
    dot.style.top = `${e.clientY - rect.top}px`;
    this.container.appendChild(dot);
    this._dots.push(dot);
  }

  _removeDots() {
    for (const d of this._dots) d.remove();
    this._dots = [];
  }

  _computeProfile() {
    const a = this._a;
    const b = this._b;
    const data = this.store.get().data;
    const matrix = (data && data.heightMatrix) ||
      (this.renderer.heightData && this.renderer.heightData.heightMatrix);
    if (!matrix || !matrix.length || !matrix[0] || !matrix[0].length) {
      this.toasts.show('No terrain loaded — cannot build a profile', 'error');
      this.stop();
      return;
    }

    const settings = this.store.get().settings;
    const G = Math.min(settings.resolution, matrix.length, matrix[0].length);
    const halfG = (G - 1) / 2;

    const points = sampleProfile(matrix, a.x, a.z, b.x, b.z, 128);
    this.renderer.drawProfilePath(points.map((p) => ({
      x: p.x - halfG,
      z: p.z - halfG,
      y: this.renderer.sampleWorldHeight(p.x - halfG, p.z - halfG),
    })));

    this.store.set({
      profile: {
        a: { x: a.x, z: a.z, elev: a.elevMeters },
        b: { x: b.x, z: b.z, elev: b.elevMeters },
        points,
      },
    });

    this._showChart(points);

    this.container.classList.remove('picking');
    if (this.renderer.container) this.renderer.container.classList.remove('picking');
    this.toasts.show('Elevation profile ready', 'success', 2400);
  }

  _showChart(points) {
    const card = this.container.querySelector('.profile-chart');
    if (card) card.classList.remove('hidden');
    this._chartShown = true;
    this.container.style.pointerEvents = 'none';
    this._drawChart();
  }

  _drawChart() {
    const canvas = this._canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dpr = window.devicePixelRatio || 1;
    const W = rect.width;
    const H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const profile = this.store.get().profile;
    if (!profile || !profile.points || !profile.points.length) return;

    const unit = (this.store.get().settings && this.store.get().settings.unit) || 'm';
    const points = profile.points;
    const pad = 12;
    const plotW = W - pad * 2;
    const plotH = H - pad * 2;

    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (const p of points) {
      if (p.elev < min) min = p.elev;
      if (p.elev > max) max = p.elev;
      sum += p.elev;
    }
    if (!Number.isFinite(min)) return;
    const mean = sum / points.length;
    const range = (max - min) || 1;

    const yOf = (v) => pad + (1 - (v - min) / range) * plotH;
    const xOf = (i) => pad + (points.length <= 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);

    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (const [v, label] of [
      [min, formatElevation(min, unit)],
      [mean, formatElevation(mean, unit)],
      [max, formatElevation(max, unit)],
    ]) {
      const y = yOf(v);
      ctx.strokeStyle = 'rgba(179,168,148,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(W - pad, y);
      ctx.stroke();
      ctx.fillStyle = '#b3a894';
      ctx.fillText(label, pad + 2, y - 8);
    }

    const grad = ctx.createLinearGradient(0, pad, 0, pad + plotH);
    grad.addColorStop(0, 'rgba(217,160,91,0.25)');
    grad.addColorStop(1, 'rgba(217,160,91,0.02)');
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(points[0].elev));
    for (let i = 1; i < points.length; i++) ctx.lineTo(xOf(i), yOf(points[i].elev));
    ctx.lineTo(xOf(points.length - 1), pad + plotH);
    ctx.lineTo(xOf(0), pad + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(points[0].elev));
    for (let i = 1; i < points.length; i++) ctx.lineTo(xOf(i), yOf(points[i].elev));
    ctx.strokeStyle = '#e8b877';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  start() {
    if (this._active) return;
    this._active = true;
    this._a = null;
    this._b = null;
    this._chartShown = false;

    this.renderer.clearProfile();
    this._removeDots();

    const card = this.container.querySelector('.profile-chart');
    if (card) card.classList.add('hidden');

    this.container.classList.remove('hidden');
    this.container.hidden = false;
    this.container.classList.add('active', 'picking');
    this.container.style.pointerEvents = 'auto';
    if (this.renderer.container) this.renderer.container.classList.add('picking');

    this.store.set({ profile: null });
    this.toasts.show('Click terrain for point A', 'info');
    this.container.addEventListener('click', this._onPick);
  }

  stop() {
    this._active = false;
    this._a = null;
    this._b = null;
    this._chartShown = false;

    this._removeDots();
    this.renderer.clearProfile();

    this.container.classList.remove('active', 'picking');
    this.container.classList.add('hidden');
    this.container.hidden = true;
    this.container.style.pointerEvents = '';
    if (this.renderer.container) this.renderer.container.classList.remove('picking');

    const card = this.container.querySelector('.profile-chart');
    if (card) card.classList.add('hidden');

    this.container.removeEventListener('click', this._onPick);
    this.store.set({ profile: null });
  }

  isActive() {
    return this._active;
  }
}
