/**
 * app.js — Main application orchestrator
 * Handles text search, autocomplete, coordinate submission, and UI wiring.
 *
 * Robustness notes:
 *  - Autocomplete items are built via the DOM API (no innerHTML with API data)
 *  - In-flight searches are aborted so stale responses never win
 *  - Last search + control settings persist across sessions
 */

import { VoxelRenderer } from './voxelRenderer.js';
import { ControlPanel } from './controls.js';

// ──────────────────── Famous Spots Dataset ────────────────────

const FAMOUS_SPOTS = [
  // Global Landmarks
  { name: 'Mount Fuji', region: 'Shizuoka / Yamanashi, Japan', icon: '🗻' },
  { name: 'Grand Canyon', region: 'Arizona, USA', icon: '🏜️' },
  { name: 'Mount Everest', region: 'Himalayas, Nepal / China', icon: '⛰️' },
  { name: 'Matterhorn', region: 'Pennine Alps, Switzerland', icon: '🏔️' },
  { name: 'Hawaii (Mauna Kea)', region: 'Hawaii, USA', icon: '🌺' },
  { name: 'Lake Tahoe', region: 'California / Nevada, USA', icon: '🌊' },
  { name: 'Yellowstone', region: 'Wyoming, USA', icon: '🌋' },
  { name: 'Mount Kilimanjaro', region: 'Tanzania, Africa', icon: '🌍' },
  { name: 'Mont Blanc', region: 'Alps, France / Italy', icon: '🏔️' },
  { name: 'Crater Lake', region: 'Oregon, USA', icon: '🌊' },

  // Indian Mountains & Hill Stations
  { name: 'Shimla', region: 'Himachal Pradesh, India', icon: '🏔️' },
  { name: 'Manali', region: 'Kullu Valley, Himachal Pradesh, India', icon: '🏔️' },
  { name: 'Kullu', region: 'Himachal Pradesh, India', icon: '🏞️' },
  { name: 'Leh Ladakh', region: 'Ladakh, India', icon: '⛰️' },
  { name: 'Gulmarg', region: 'Jammu & Kashmir, India', icon: '❄️' },
  { name: 'Darjeeling', region: 'West Bengal, India', icon: '🍵' },
  { name: 'Ooty', region: 'Nilgiris, Tamil Nadu, India', icon: '🌲' },
  { name: 'Munnar', region: 'Idukki, Kerala, India', icon: '🍃' },
  { name: 'Kedarnath', region: 'Garhwal Himalayas, Uttarakhand, India', icon: '🏔️' },
  { name: 'Mussoorie', region: 'Uttarakhand, India', icon: '🌄' },
  { name: 'Nainital', region: 'Kumaon, Uttarakhand, India', icon: '🌊' },
  { name: 'Rohtang Pass', region: 'Himachal Pradesh, India', icon: '❄️' },
  { name: 'Kanchenjunga', region: 'Sikkim / Nepal border', icon: '🏔️' },
];

// ──────────────────── DOM References ────────────────────

const searchForm      = document.getElementById('search-form');
const searchInput     = document.getElementById('search-input');
const searchBtn       = document.getElementById('search-btn');
const autocompleteBox = document.getElementById('autocomplete-box');

const loadingOverlay  = document.getElementById('loading-overlay');
const loadingText     = document.getElementById('loading-text');
const loadingCancel   = document.getElementById('loading-cancel');
const welcomeScreen   = document.getElementById('welcome-screen');
const welcomeExamples = document.getElementById('welcome-examples');
const resumeChip      = document.getElementById('resume-chip');
const toastContainer  = document.getElementById('toast-container');

// Status bar
const statusBar      = document.getElementById('status-bar');
const statusDot      = document.getElementById('status-dot');
const statusSource   = document.getElementById('status-source');
const statusLocation = document.getElementById('status-location');
const statusElev     = document.getElementById('status-elevation');

// Legend
const legend       = document.getElementById('legend');
const legendMin    = document.getElementById('legend-min');
const legendMax    = document.getElementById('legend-max');

// Coords form inside status bar
const coordsForm    = document.getElementById('coords-form');
const coordLatInput = document.getElementById('coord-lat-input');
const coordLonInput = document.getElementById('coord-lon-input');

// ──────────────────── Init Renderer ────────────────────

const container = document.getElementById('canvas-container');
const renderer  = new VoxelRenderer(container);
const controls  = new ControlPanel(renderer);

// ──────────────────── Persistence ────────────────────

const SEARCH_KEY = 'terracraft:lastSearch';

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
    // Storage unavailable (private mode, quota) — ignore silently.
  }
}

// ──────────────────── Loading Messages ────────────────────

const LOADING_MESSAGES = [
  'Geocoding location…',
  'Checking database cache…',
  'Downloading elevation tiles…',
  'Decoding terrain data…',
  'Building 3D terrain world…',
];

let loadingMsgIndex = 0;
let loadingInterval = null;

function showLoading() {
  loadingMsgIndex = 0;
  loadingText.textContent = LOADING_MESSAGES[0];
  loadingOverlay.classList.add('active');

  loadingInterval = setInterval(() => {
    loadingMsgIndex++;
    if (loadingMsgIndex < LOADING_MESSAGES.length) {
      loadingText.textContent = LOADING_MESSAGES[loadingMsgIndex];
    }
  }, 1800);
}

function hideLoading() {
  loadingOverlay.classList.remove('active');
  if (loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
  }
}

// ──────────────────── Toast Notifications ────────────────────

function showToast(message, duration = 4000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ──────────────────── SVG Icon Helper ────────────────────

function makeIcon(id, className = '') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', `icon ${className}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', `#${id}`);
  svg.appendChild(use);
  return svg;
}

// ──────────────────── Status Bar & Coords ────────────────────

function updateStatus(data) {
  statusSource.textContent = data.cached ? 'Cached' : 'Fresh';
  statusDot.className = data.cached ? 'status-dot cached' : 'status-dot';

  const locName = data.location.length > 32
    ? data.location.substring(0, 32) + '…'
    : data.location;
  statusLocation.textContent = locName;

  coordLatInput.value = data.lat.toFixed(4);
  coordLonInput.value = data.lon.toFixed(4);

  statusElev.textContent = `${Math.round(data.minElev)}m — ${Math.round(data.maxElev)}m`;
  statusBar.classList.add('visible');
}

// ──────────────────── Elevation Legend ────────────────────

function updateLegend(data) {
  legendMin.textContent = `${Math.round(data.minElev)}m`;
  legendMax.textContent = `${Math.round(data.maxElev)}m`;
  controls.updateLegendColors();
  legend.classList.remove('hidden');
}

// ──────────────────── Search Handlers ────────────────────

let currentAbortController = null;
let currentSearch = null; // { type: 'text' | 'coords', value: string | {lat, lon}, label }

async function performSearch(endpoint, search) {
  // Cancel any in-flight search so stale results never override the latest request.
  if (currentAbortController) currentAbortController.abort();

  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;
  currentSearch = search;

  searchBtn.disabled = true;
  searchInput.disabled = true;
  welcomeScreen.classList.add('hidden');
  hideAutocomplete();
  showLoading();

  try {
    const response = await fetch(endpoint, { signal });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Server error: ${response.status}`);
    }

    loadingText.textContent = LOADING_MESSAGES[4];
    await new Promise((r) => setTimeout(r, 100));

    // If backend auto-detected water, tell renderer to use it
    if (data.hasWater) {
      renderer.showWater = true;
      // Relative height percentage (0.0 to 1.0), mapped to the 0–50 slider scale.
      const elevRange = data.maxElev - data.minElev || 1;
      const relHeight = (data.autoWaterLevel - data.minElev) / elevRange;
      const sliderVal = Math.round(relHeight * 50);
      renderer.waterLevel = sliderVal;
      controls.setWaterState(true, sliderVal);
    } else {
      renderer.showWater = false;
      controls.setWaterState(false, 0);
    }

    // Render terrain with smart auto-framing enabled
    renderer.render(data.heightMatrix, data.minElev, data.maxElev, true);
    updateStatus(data);
    updateLegend(data);
    controls.show();

    rememberSearch(search, data.location);
  } catch (err) {
    if (err.name === 'AbortError') return; // superseded by a newer search
    hideLoading();
    showToast(`Error: ${err.message}`);
    console.error('Search failed:', err);
  } finally {
    if (currentAbortController && !currentAbortController.signal.aborted) {
      currentAbortController = null;
    }
    hideLoading();
    searchBtn.disabled = false;
    searchInput.disabled = false;
  }
}

function rememberSearch(search, label) {
  const record = { type: search.type, label: label || search.value };
  if (search.type === 'text') record.value = search.value;
  else record.value = { lat: search.value.lat, lon: search.value.lon };
  writeJSON(SEARCH_KEY, record);
}

function searchByText(query) {
  if (!query || query.trim().length === 0) return;
  const trimmed = query.trim();
  performSearch(`/api/search?q=${encodeURIComponent(trimmed)}`, { type: 'text', value: trimmed });
}

function searchByCoords(lat, lon) {
  performSearch(`/api/coords?lat=${lat}&lon=${lon}`, { type: 'coords', value: { lat, lon } });
}

// ──────────────────── Autocomplete System ────────────────────

let selectedIndex = -1;

function renderAutocomplete(matches) {
  if (matches.length === 0) {
    hideAutocomplete();
    return;
  }

  selectedIndex = -1;
  autocompleteBox.innerHTML = '';
  const fragment = document.createDocumentFragment();

  for (const spot of matches) {
    const item = document.createElement('div');
    item.className = 'autocomplete-item';
    item.dataset.name = spot.name; // safe: dataset is DOM property, not HTML

    item.appendChild(makeIcon('icon-pin', 'autocomplete-icon'));

    const info = document.createElement('div');
    info.className = 'autocomplete-info';

    const name = document.createElement('span');
    name.className = 'autocomplete-name';
    name.textContent = spot.name;

    const region = document.createElement('span');
    region.className = 'autocomplete-region';
    region.textContent = spot.region || '';

    info.appendChild(name);
    info.appendChild(region);
    item.appendChild(info);
    fragment.appendChild(item);
  }

  autocompleteBox.appendChild(fragment);
  autocompleteBox.classList.remove('hidden');
}

function hideAutocomplete() {
  autocompleteBox.classList.add('hidden');
  autocompleteBox.innerHTML = '';
  selectedIndex = -1;
}

let suggestDebounceTimer = null;

async function fetchLiveSuggestions(query) {
  try {
    const res = await fetch(`/api/suggest?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

searchInput.addEventListener('input', (e) => {
  const val = e.target.value.trim().toLowerCase();
  if (val.length === 0) {
    hideAutocomplete();
    return;
  }

  // 1. Instant local matching
  const localMatches = FAMOUS_SPOTS.filter((spot) =>
    spot.name.toLowerCase().includes(val) || spot.region.toLowerCase().includes(val)
  );

  renderAutocomplete(localMatches);

  // 2. Debounced live server lookup (works for ANY location)
  clearTimeout(suggestDebounceTimer);
  suggestDebounceTimer = setTimeout(async () => {
    if (val.length < 2) return;
    const liveMatches = await fetchLiveSuggestions(val);

    const combined = [...localMatches];
    for (const item of liveMatches) {
      if (!combined.some((c) => c.name.toLowerCase() === item.name.toLowerCase())) {
        combined.push(item);
      }
    }

    if (searchInput.value.trim().toLowerCase() === val) {
      renderAutocomplete(combined.slice(0, 8));
    }
  }, 250);
});

searchInput.addEventListener('focus', () => {
  searchInput.select();
  const val = searchInput.value.trim().toLowerCase();
  const matches = FAMOUS_SPOTS.filter((spot) =>
    val === '' || spot.name.toLowerCase().includes(val) || spot.region.toLowerCase().includes(val)
  );
  renderAutocomplete(matches);
});

autocompleteBox.addEventListener('click', (e) => {
  const item = e.target.closest('.autocomplete-item');
  if (!item) return;
  searchInput.value = item.dataset.name;
  hideAutocomplete();
  searchByText(item.dataset.name);
});

// Keyboard navigation for search input & autocomplete
searchInput.addEventListener('keydown', (e) => {
  const items = autocompleteBox.querySelectorAll('.autocomplete-item');

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (items.length === 0) return;
    selectedIndex = (selectedIndex + 1) % items.length;
    items.forEach((it, idx) => it.classList.toggle('selected', idx === selectedIndex));
    if (items[selectedIndex]) searchInput.value = items[selectedIndex].dataset.name;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (items.length === 0) return;
    selectedIndex = (selectedIndex - 1 + items.length) % items.length;
    items.forEach((it, idx) => it.classList.toggle('selected', idx === selectedIndex));
    if (items[selectedIndex]) searchInput.value = items[selectedIndex].dataset.name;
  } else if (e.key === 'Escape') {
    hideAutocomplete();
  }
});

// Hide autocomplete on click outside
document.addEventListener('click', (e) => {
  if (!searchForm.contains(e.target)) {
    hideAutocomplete();
  }
});

// ──────────────────── Event Listeners ────────────────────

// Search form submission
searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  searchByText(searchInput.value);
});

// Cancel loading
loadingCancel.addEventListener('click', () => {
  if (currentAbortController) currentAbortController.abort();
  hideLoading();
});

// Editable Coords form submission
coordsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const lat = parseFloat(coordLatInput.value);
  const lon = parseFloat(coordLonInput.value);

  if (isNaN(lat) || isNaN(lon)) {
    showToast('Please enter valid numerical coordinates');
    return;
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    showToast('Coordinates out of range (Lat -90 to 90, Lon -180 to 180)');
    return;
  }

  searchByCoords(lat, lon);
});

// Welcome screen example chips
welcomeExamples.addEventListener('click', (e) => {
  const chip = e.target.closest('.example-chip');
  if (!chip) return;
  const query = chip.dataset.query;
  searchInput.value = query;
  searchByText(query);
});

// Resume last search chip
resumeChip.addEventListener('click', () => {
  const saved = readJSON(SEARCH_KEY);
  if (!saved) return;
  if (saved.type === 'coords' && saved.value) {
    searchByCoords(saved.value.lat, saved.value.lon);
  } else if (saved.value) {
    searchByText(saved.value);
  }
});

// Keyboard shortcut '/' to focus search input
document.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;
  if (e.key === '/' && !typing) {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
});

// ──────────────────── Init ────────────────────

// Show a "resume" chip if a previous search exists
const savedSearch = readJSON(SEARCH_KEY);
if (savedSearch && savedSearch.value) {
  const label = savedSearch.label || (savedSearch.type === 'coords' ? 'coordinates' : savedSearch.value);
  const short = label.length > 34 ? label.substring(0, 34) + '…' : label;
  resumeChip.textContent = `↺ Resume: ${short}`;
  resumeChip.classList.remove('hidden');
}

console.log('🌍 TerraCraft 3D initialized with Autocomplete & 3D Export');
searchInput.focus();
