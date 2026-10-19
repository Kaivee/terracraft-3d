import { TerrainRenderer } from './scene/renderer.js';
import { SearchBar } from './ui/search.js';
import { TerrainPanel } from './ui/panel.js';
import { Hud } from './ui/hud.js';
import { Welcome } from './ui/welcome.js';
import { Loading } from './ui/loading.js';
import { Toasts } from './ui/toasts.js';
import { HoverTooltip } from './ui/tooltip.js';
import { ProfileOverlay } from './ui/profile.js';
import { PovHud } from './ui/povui.js';

import { createStore } from './core/store.js';
import {
  loadSettings, loadPlaces, savePlaces, loadLast, saveLast,
} from './core/settings.js';
import { searchByCoords, normalizeSearchResult, reverseGeocode } from './core/api.js';
import { computeStats, cellSizeMeters, autoWaterDefaults } from './core/terrainMath.js';
import { getCurrentPosition } from './core/geolocation.js';
import { formatHash, parseHash, shareUrl, copyToClipboard } from './core/share.js';

const ZOOM = 12;

function el(id) { return document.getElementById(id); }

// ── DOM ─────────────────────────────────────────────────────────────
const viewport = el('viewport');
const store = createStore({
  place: null,
  data: null,
  stats: null,
  profile: null,
  settings: loadSettings(),
});

// ── Core services ───────────────────────────────────────────────────
const renderer = new TerrainRenderer(viewport);
const toasts = new Toasts(el('toast-root'));
const loading = new Loading(el('loading'), el('loading-bar'), el('loading-text'));

// ── Terrain loading ─────────────────────────────────────────────────
let inflight = 0;

async function loadTerrain(lat, lon, opts = {}) {
  inflight += 1;
  loading.start();
  loading.stage(0);
  try {
    const res = await searchByCoords(lat, lon);
    const data = normalizeSearchResult(res);
    loading.stage(3);

    const settings = store.get().settings;
    const next = { ...settings };
    const water = autoWaterDefaults(data.minElev, data.maxElev, data.hasWater, data.autoWaterLevel);
    if (water) {
      next.showWater = water.showWater;
      next.waterLevel = water.waterLevel;
    }

    renderer.render(data, next, true);
    loading.stage(4);

    const place = {
      lat,
      lon,
      name: opts.name || data.location || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    };
    const cellSize = cellSizeMeters(lat, ZOOM, data.gridSize);
    const base = computeStats(data.heightMatrix, cellSize);

    store.set({
      place,
      data,
      stats: {
        ...base,
        failedTileCount: data.failedTileCount,
      },
      profile: null,
      settings: next,
    });

    saveLast(place);
    welcome.dismiss();
    if (water) {
      toasts.show(`Water detected — level set to ${Math.round(data.autoWaterLevel)} m`, 'info', 4200);
    }
    if (opts.toast) {
      const region = opts.region ? ` · ${opts.region}` : '';
      toasts.show(`🎲 ${place.name}${region} — ${lat.toFixed(4)}, ${lon.toFixed(4)}`, 'info', 4600);
    }
    if (data.failedTileCount > 0) {
      toasts.show(`${data.failedTileCount} tile${data.failedTileCount === 1 ? '' : 's'} failed to load — some areas may be flat`, 'warn', 5200);
    }
    if (data.cached) {
      toasts.show('Loaded from local cache', 'success', 2600);
    }
    return place;
  } catch (err) {
    toasts.show(err && err.message ? `Search failed: ${err.message}` : 'Search failed', 'error');
    return null;
  } finally {
    inflight -= 1;
    if (inflight <= 0) {
      inflight = 0;
      loading.stop();
    }
  }
}

function goTo(lat, lon, opts = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  try {
    history.pushState(null, '', formatHash(lat, lon));
  } catch { /* history unavailable */ }
  loadTerrain(lat, lon, opts);
}

// ── My location ─────────────────────────────────────────────────────
async function myLocation() {
  try {
    const pos = await getCurrentPosition();
    let name = null;
    try {
      const r = await reverseGeocode(pos.lat, pos.lon);
      if (r && r.name) name = r.name;
    } catch { /* fall back to coords label */ }
    goTo(pos.lat, pos.lon, name ? { name } : {});
  } catch (err) {
    const msg = err.message || 'Location unavailable';
    toasts.show(`${msg} — if you opened via an IP address, use http://localhost:3000 so geolocation works`, 'warn', 5200);
  }
}

// ── Save / share ────────────────────────────────────────────────────
function saveCurrentPlace() {
  const place = store.get().place;
  if (!place) { toasts.show('Nothing to save yet', 'warn'); return; }
  const existing = loadPlaces().filter(
    (p) => !(p.name === place.name && p.lat === place.lat && p.lon === place.lon)
  );
  savePlaces([place, ...existing]);
  toasts.show(`Saved “${place.name}”`, 'success', 2600);
}

async function shareCurrentPlace() {
  const place = store.get().place;
  if (place) {
    try {
      history.replaceState(null, '', formatHash(place.lat, place.lon));
    } catch { /* ignore */ }
  }
  const ok = await copyToClipboard(shareUrl());
  toasts.show(ok ? 'Link copied to clipboard' : 'Could not copy link', ok ? 'success' : 'warn', 2600);
}

// ── UI wiring ───────────────────────────────────────────────────────
const welcome = new Welcome({
  container: el('welcome'),
  store,
  toasts,
  onSearch: (lat, lon, opts) => goTo(lat, lon, opts),
  onMyLocation: () => myLocation(),
  onRandom: (spot) => goTo(spot.lat, spot.lon, { name: spot.name, region: spot.region, toast: true }),
});

new SearchBar({
  container: el('search-wrap'),
  store,
  toasts,
  onSearch: (lat, lon, opts) => goTo(lat, lon, opts),
});

new TerrainPanel({
  container: el('panel'),
  store,
  toasts,
  renderer,
});

new Hud({
  container: el('hud'),
  store,
  renderer,
  toasts,
  callbacks: {
    mylocation: () => myLocation(),
    profile: () => profileOverlay.start(),
    save: () => saveCurrentPlace(),
    share: () => shareCurrentPlace(),
  },
});

new HoverTooltip({ container: viewport, store, renderer, toasts });

const profileOverlay = new ProfileOverlay({
  container: el('profile-overlay'),
  store,
  renderer,
  toasts,
});

const povHud = new PovHud({ container: el('pov-hud') });

// POV UI follows pointer-lock state.
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.renderer.domElement;
  if (locked) povHud.show();
  else povHud.hide();
});

// ── Panel toggle ────────────────────────────────────────────────────
const panelToggle = el('panel-toggle');
const panelEl = el('panel');
panelToggle.addEventListener('click', () => {
  const collapsed = panelEl.classList.toggle('collapsed');
  panelToggle.setAttribute('aria-expanded', String(!collapsed));
});

// ── Logo → home ─────────────────────────────────────────────────────
const brand = el('brand');
brand.addEventListener('click', () => welcome.show());
brand.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    welcome.show();
  }
});

// ── Keyboard shortcut: "/" focuses search ───────────────────────────
document.addEventListener('keydown', (e) => {
  const typing = document.activeElement &&
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
  if (e.key === '/' && !typing) {
    e.preventDefault();
    const input = document.querySelector('.searchbar-input');
    if (input) { input.focus(); input.select(); }
  }
});

// ── Boot ────────────────────────────────────────────────────────────
(async function boot() {
  const hash = parseHash(window.location.hash);
  if (hash) {
    const saved = loadLast();
    await loadTerrain(hash.lat, hash.lon, saved ? { name: saved.name } : {});
  }
})();
