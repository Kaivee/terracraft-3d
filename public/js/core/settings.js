export const SETTINGS_KEY = 'terracraft:settings';
export const PLACES_KEY = 'terracraft:places';
export const LAST_KEY = 'terracraft:last';

export const DEFAULTS = {
  unit: 'm', viewMode: 'voxel', resolution: 150, heightScale: 1.5,
  sunAz: 135, sunEl: 45, waterLevel: 40, waterOpacity: 0.6,
  showWater: false, showPeakPin: true, autoRotate: false,
  topoBands: 8, heatMinCut: 0, heatMaxCut: 1, satHaze: 0, milContrast: 1,
};

const VALID_MODES = new Set(['voxel', 'topographic', 'heatmap', 'satellite', 'military']);
const NUMERIC = ['resolution', 'heightScale', 'sunAz', 'sunEl', 'waterLevel', 'waterOpacity',
  'topoBands', 'heatMinCut', 'heatMaxCut', 'satHaze', 'milContrast'];
const BOOLEAN = ['showWater', 'showPeakPin', 'autoRotate'];

export function sanitizeSettings(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS };
  const out = { ...DEFAULTS };
  for (const k of NUMERIC) {
    const v = Number(raw[k]);
    if (Number.isFinite(v)) out[k] = v;
  }
  for (const k of BOOLEAN) {
    if (typeof raw[k] === 'boolean') out[k] = raw[k];
  }
  if (typeof raw.unit === 'string' && (raw.unit === 'm' || raw.unit === 'ft')) out.unit = raw.unit;
  if (typeof raw.viewMode === 'string' && VALID_MODES.has(raw.viewMode)) out.viewMode = raw.viewMode;
  out.resolution = Math.min(250, Math.max(30, out.resolution));
  out.topoBands = Math.min(16, Math.max(4, Math.round(out.topoBands)));
  out.waterOpacity = Math.min(1, Math.max(0.1, out.waterOpacity));
  out.satHaze = Math.min(0.8, Math.max(0, out.satHaze));
  out.milContrast = Math.min(2, Math.max(0.5, out.milContrast));
  out.heightScale = Math.min(3, Math.max(0.5, out.heightScale));
  return out;
}

export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    return sanitizeSettings(raw);
  } catch { return { ...DEFAULTS }; }
}

export function saveSettings(settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
}

export function loadPlaces() {
  try {
    const list = JSON.parse(localStorage.getItem(PLACES_KEY));
    return Array.isArray(list) ? list.filter((p) => p && typeof p.lat === 'number' && typeof p.lon === 'number' && typeof p.name === 'string') : [];
  } catch { return []; }
}

export function savePlaces(list) {
  try { localStorage.setItem(PLACES_KEY, JSON.stringify(list.slice(0, 12))); } catch {}
}

export function loadLast() {
  try { return JSON.parse(localStorage.getItem(LAST_KEY)) || null; } catch { return null; }
}

export function saveLast(place) {
  try { localStorage.setItem(LAST_KEY, JSON.stringify(place)); } catch {}
}
