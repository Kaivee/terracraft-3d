# TerraCraft v2 — "Field Station" Full Frontend Rebuild

- **Date**: 2026-08-11
- **Status**: Ready for execution
- **Spec**: `docs/superpowers/specs/2026-08-11-terracraft-v2-design.md`

## Problem Statement

The v1 frontend (`public/js/voxelRenderer.js` + `controls.js` + `app.js`) is a
single monolithic renderer class with UI bolted on top. It lacks POV mode,
hover elevation, camera presets, auto-rotate, unit switching, share links,
saved places, my-location, elevation profiles, day/night sky, screenshots, and
terrain stats. The layout/typography were redesigned in the "Warm Earth" theme
but the structure is still the v1 shell. We rebuild the entire frontend as
clean ES-modules with zero build step, reusing the proven v1 Three.js terrain
algorithms verbatim and keeping the backend intact.

## Current State

- Backend (Express + SQLite + Nominatim + Terrarium DEM) works: `server.js`,
  `db.js`, `routes/terrain.js` (`/api/search`, `/api/coords`, `/api/suggest`,
  `/api/cache/:id`), `services/tileMath.js`, `services/tileDownloader.js`,
  `services/waterDetect.js`, `services/terrainCache.js`. **Unchanged except Task 24.**
- v1 frontend: `public/index.html`, `public/css/style.css` (warm-earth theme),
  `public/js/voxelRenderer.js` (827 lines — the renderer to split and reuse),
  `public/js/controls.js` (settings persistence `terracraft:settings`),
  `public/js/app.js` (search/UI glue), inline icons sprite, import map
  `three@0.168.0` + OrbitControls + OBJExporter + STLExporter.
- 12 tests pass (`bun test`), all JS parses. Server runs at
  `http://192.168.16.1:3000` via Windows node (`setsid "/mnt/c/Program Files/nodejs/node.exe" server.js`).
- v1 renderer internals to port (line refs into `voxelRenderer.js`):
  - color fns `getVoxelBiome/voxelColor/topoColor/heatmapColor/satelliteColor/militaryColor` **27–135**
  - `_lerp` 820, `darken` 822
  - constructor (scene/light/controls/camera) **138–244**, `setSunPosition` **245–255**
  - `render` 257, `rerender` 262, `getWaterElevation` 279, `_getColor` 286
  - `_build` **296–374** (grid sampling, cols/norms/isLake, peak, BASE/MAX_H, framing)
  - `_buildVoxel` **377–474**, `_buildSmooth` **475–521**, `_buildWater` **522–…**
  - `_buildPeakPin` **654–690**, `_updatePeakBadge` **691–752**, `_clear` **753–…**
  - `exportOBJ` 717, `exportSTL` 724, `_animate` **788–…**, `dispose` **810–…**
  - (assorted private helpers `_sample`, `_createCamera`, etc. between 138–245 — port as needed)

## Scope

### In scope
- New ES-module frontend (see module map), all 14 v1 improvements + 4 new features from the spec.
- First-person POV walk mode (pointer-lock WASD).
- Backend: only `failedTileCount` passthrough + lower-zoom tile fallback (Task 24).
- Delete v1 `voxelRenderer.js`, `controls.js`, `app.js` **only after** main.js is verified (Task 23).
- Warm Earth visual identity preserved (bg `#171412`, sand `#d9a05b`, moss `#7a8b4f`, Fraunces/Inter/JetBrains Mono).

### Non-goals
- No build step / bundler / TS / framework. Vanilla ES modules.
- No backend schema changes, no auth, no write-back of settings to server.
- No mobile-first touch POV (POV requires keyboard/pointer-lock; on touch it exits gracefully).
- No true hydrological prominence (we show `max − min` as "relative prominence").
- No SRTM-only zoom-0 fallback (fallback goes to zoom-1, see Task 24).

## Architecture

```
public/index.html        → warm-earth shell, import map, <script type="module" src="js/main.js">
public/css/style.css     → full rewrite (design tokens + all overlays)
public/js/
  main.js                → bootstrap + wiring + load flow
  core/
    store.js             → pub/sub state (createStore)
    settings.js          → DEFAULTS, load/save settings + saved places, sanitize
    units.js             → m/ft formatting (pure)
    share.js             → hash deep-link + clipboard (pure-able)
    terrainMath.js       → bilinear, stats, peaks, profile, cell size (pure)
    api.js               → fetch wrappers + normalizeSearchResult
    geolocation.js       → getCurrentPosition promise
  scene/
    renderer.js          → TerrainRenderer orchestrator (ported public API + new methods)
    terrain.js           → computeGrid + buildVoxel + buildSmooth + color fns
    water.js             → buildWaterLayer + waterLevelFromSlider
    markers.js           → Markers: peak pin/badge, center marker, clear
    sky.js               → Sky: sun/hemi lights, auto day-night + stars
    export.js            → exportOBJ / exportSTL / screenshot
    pov.js               → POVController (pointer-lock walk)
  ui/
    toasts.js  search.js  panel.js  hud.js  tooltip.js
    profile.js welcome.js loading.js povui.js
tests/
  core/*.test.js         → node:test suites (bun test)
```

Data flow: `main.js` owns a `createStore()` with `{ data, place, settings, stats, peaks, profile, pov }`.
`settings` is the single source of truth for unit/viewMode/etc. UI modules read via
`store.get()`, write via `store.set()` and re-render on `store.on(fn)`. Renderer is
imperative: `main.js` calls `renderer.render(data, settings)` on search and
`renderer.applySettings(settings)` on any control change.

### Shared state shape
```js
store initial = {
  data: null,   // normalizeSearchResult() output or null
  place: null,  // { name, lat, lon }
  stats: null,  // { min, max, mean, footprintKm2, prominence, failedTileCount }
  peaks: [],    // [{ x, z, elev }] grid coords
  settings: loadSettings(),
  profile: null, // { a: {x,z,elev}, b: {x,z,elev}, points: [...] } or null
  pov: false,
}
```

### Test commands
- Pure logic: `bun test tests/core` (also `node --test tests/core` on Windows).
- All: `bun test`.
- Manual: server up, open `http://192.168.16.1:3000`, DevTools console clean.
- Static check: `node --check` each new `.js` (or `bun build --entry ./public/js/main.js` as a parse check).

---

## Task Breakdown

| # | Task | Depends |
|---|------|---------|
| 1 | core/store.js + test | — |
| 2 | core/units.js + test | — |
| 3 | core/share.js + test | — |
| 4 | core/terrainMath.js + test | — |
| 5 | core/settings.js + test | — |
| 6 | scene/terrain.js (colors + computeGrid + builders) | — |
| 7 | scene/water.js | 6 |
| 8 | scene/markers.js | 6 |
| 9 | scene/export.js | — |
| 10 | scene/sky.js | — |
| 11 | scene/renderer.js (TerrainRenderer) | 6,7,8,9,10 |
| 12 | scene/pov.js | 4,6 |
| 13 | core/api.js + test | — |
| 14 | core/geolocation.js + test | — |
| 15 | ui/toasts.js | — |
| 16 | ui/search.js | 13,15 |
| 17 | ui/panel.js | 1,5,15 |
| 18 | ui/hud.js | 1,2,4,5,15 |
| 19 | ui/tooltip.js | 11 |
| 20 | ui/profile.js | 4,11,15 |
| 21 | ui/welcome.js + ui/loading.js + ui/povui.js | 5,15 |
| 22 | index.html + css/style.css rewrite | all UI |
| 23 | public/js/main.js + delete v1 JS | 11–22 |
| 24 | backend: failedTileCount + tile fallback | — |
| 25 | QA checklist pass | all |

---

## Task-by-Task

### Task 1 — `public/js/core/store.js`

Tiny pub/sub store.

```js
export function createStore(initial) {
  let state = { ...initial };
  const listeners = new Set();
  return {
    get() { return state; },
    set(patch) { state = { ...state, ...patch }; listeners.forEach((fn) => fn(state)); },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
```

**Verify**: `tests/core/store.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../public/js/core/store.js';

test('set merges and notifies', () => {
  const s = createStore({ a: 1 });
  const seen = [];
  s.on((st) => seen.push(st));
  s.set({ b: 2 });
  assert.equal(s.get().a, 1);
  assert.equal(s.get().b, 2);
  assert.equal(seen.length, 1);
});

test('on returns unsubscribe', () => {
  const s = createStore({ a: 1 });
  let count = 0;
  const off = s.on(() => count++);
  off();
  s.set({ a: 2 });
  assert.equal(count, 0);
});
```

---

### Task 2 — `public/js/core/units.js`

```js
export const UNITS = { METERS: 'm', FEET: 'ft' };

export function metersToFeet(m) { return m * 3.28084; }

export function formatElevation(meters, unit = UNITS.METERS, opts = {}) {
  const { precision = 0, suffix = true } = opts;
  const u = unit === UNITS.FEET ? UNITS.FEET : UNITS.METERS;
  const value = u === UNITS.FEET ? metersToFeet(meters) : meters;
  const label = value.toLocaleString(undefined, { maximumFractionDigits: precision });
  return suffix ? `${label} ${u}` : label;
}

export function formatDistance(meters, unit = UNITS.METERS) {
  const u = unit === UNITS.FEET ? UNITS.FEET : UNITS.METERS;
  const v = u === UNITS.FEET ? metersToFeet(meters) : meters;
  if (u === UNITS.METERS && v >= 1000) return `${(v / 1000).toFixed(2)} km`;
  if (u === UNITS.FEET && v >= 5280) return `${(v / 5280).toFixed(2)} mi`;
  return `${Math.round(v).toLocaleString()} ${u}`;
}
```

**Verify**: tests: `metersToFeet(1)` ≈ 3.28084; `formatElevation(1500,'m')` === '1,500 m';
`formatElevation(1500,'ft')` includes 'ft'; `formatDistance(150000,'m')` === '150.00 km';
`formatDistance(10000,'ft')` includes 'mi'; invalid unit falls back to meters.

---

### Task 3 — `public/js/core/share.js`

```js
export function formatHash(lat, lon) {
  return `#${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
}

export function parseHash(hash) {
  const m = /^#(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(String(hash).trim());
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lon = parseFloat(m[2]);
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

export function shareUrl() {
  const { origin, pathname, hash } = window.location;
  const clean = hash.startsWith('#') && parseHash(hash) ? hash : '';
  return `${origin}${pathname}${clean}`;
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}
```

**Verify**: `parseHash('#35.3606,138.7274')` → `{lat:35.3606, lon:138.7274}`;
`parseHash('#91,0')` → null; `parseHash('')`/`parseHash('nope')` → null;
`formatHash(35.36056, 138.72742)` === `#35.3606,138.7274`. `copyToClipboard` returns
a boolean without throwing (stub `navigator.clipboard` in test; the DOM fallback path
is guarded so it won't run in node).

---

### Task 4 — `public/js/core/terrainMath.js`

```js
export function bilinearSample(matrix, x, z) {
  const G = matrix.length;
  if (!G) return 0;
  const x0 = Math.min(G - 1, Math.max(0, Math.floor(x)));
  const z0 = Math.min(G - 1, Math.max(0, Math.floor(z)));
  const x1 = Math.min(G - 1, x0 + 1);
  const z1 = Math.min(G - 1, z0 + 1);
  const fx = x - x0, fz = z - z0;
  const a = matrix[z0][x0], b = matrix[z0][x1];
  const c = matrix[z1][x0], d = matrix[z1][x1];
  return a * (1 - fx) * (1 - fz) + b * fx * (1 - fz) + c * (1 - fx) * fz + d * fx * fz;
}

export function computeStats(matrix, cellSizeMeters = 40) {
  let min = Infinity, max = -Infinity, sum = 0, n = 0;
  for (const row of matrix) for (const v of row) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v; n++;
  }
  const G = matrix.length;
  const footprintKm2 = ((G * cellSizeMeters) / 1000) ** 2;
  return {
    min, max,
    mean: n ? sum / n : 0,
    footprintKm2,
    prominence: max - min,
  };
}

export function findTopPeaks(matrix, n = 3, minSeparation = 3) {
  const G = matrix.length;
  const cells = [];
  for (let z = 0; z < G; z++) for (let x = 0; x < G; x++) {
    cells.push({ x, z, elev: matrix[z][x] });
  }
  cells.sort((a, b) => b.elev - a.elev);
  const peaks = [];
  for (const c of cells) {
    const tooClose = peaks.some((p) => Math.abs(p.x - c.x) <= minSeparation && Math.abs(p.z - c.z) <= minSeparation);
    if (tooClose) continue;
    peaks.push(c);
    if (peaks.length >= n) break;
  }
  return peaks;
}

export function sampleProfile(matrix, ax, az, bx, bz, steps = 128) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    out.push({ x, z, elev: bilinearSample(matrix, x, z) });
  }
  return out;
}

export function elevationToNorm(elev, minElev, maxElev) {
  const range = (maxElev - minElev) || 1;
  return Math.max(0, Math.min(1, (elev - minElev) / range));
}

export function normToElevation(norm, minElev, maxElev) {
  return minElev + norm * (maxElev - minElev);
}

// Ground meters per DEM cell at a lat/lon and zoom (3x3 tile stitch → gridSize).
export function cellSizeMeters(lat, zoom = 12, gridSize = 250) {
  const degPerTile = 360 / (2 ** zoom);
  const totalDeg = 3 * degPerTile;
  const meters = totalDeg * 111320 * Math.cos((lat * Math.PI) / 180);
  return meters / gridSize;
}
```

**Verify**: tests —
- `bilinearSample([[0,0],[0,0]], 0,0)` = 0; `bilinearSample([[0,10],[20,30]], 0,0)` = 0;
  `bilinearSample([[0,10],[20,30]], 1,1)` = 30; midpoint `bilinearSample([[0,10],[20,30]], .5,.5)` = 15;
  out-of-range clamps (negative/`> G-1`).
- `computeStats([[1,2],[3,4]], 100)` → `{min:1, max:4, mean:2.5, footprintKm2: 0.04, prominence: 3}`.
- `findTopPeaks` on a matrix with one obvious max returns it first; separation: peaks too close are skipped.
- `sampleProfile([[1,1],[1,1]], 0,0, 1,1, 4)` has 5 points, all elev 1, endpoints match.
- `elevationToNorm/normToElevation` round-trip.
- `cellSizeMeters(0, 12, 250)` > `cellSizeMeters(60, 12, 250)`; both positive; at equator `≈117.4` (3*(360/4096)*111320/250 ≈ 29.36 km ground span / 250).

---

### Task 5 — `public/js/core/settings.js`

```js
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
```

**Verify**: `sanitizeSettings(null)` → `{...DEFAULTS}`; unknown keys dropped; string numbers coerced;
`viewMode: 'bogus'` falls back to 'voxel'; `resolution: 5` clamps to 30; `resolution: 999` clamps to 250;
`unit: 'ft'` preserved. load/save round-trip with a `globalThis.localStorage` stub
(getItem/setItem/removeItem backed by a plain object). `loadPlaces` filters invalid entries and caps at 12 on save.

---

### Task 6 — `public/js/scene/terrain.js`

Move **verbatim** from `public/js/voxelRenderer.js`: `getVoxelBiome` (27–36),
`voxelColor` (38–40), `topoColor` (42–67), `heatmapColor` (69–86),
`satelliteColor` (88–115), `militaryColor` (117–135), `_lerp` (820–820), `darken` (822–827).

Export:
```js
export const COLOR_FN = {
  voxel: (n, w) => voxelColor(n, w),
  topographic: (n, w, o) => topoColor(n, w, o.topoBands),
  heatmap: (n, w, o) => heatmapColor(n, w, o.heatMinCut, o.heatMaxCut),
  satellite: (n, w, o) => satelliteColor(n, w, o.satHaze),
  military: (n, w, o) => militaryColor(n, w, o.milContrast),
};
export function colorFor(mode, norm, isWater, opts = {}) {
  const fn = COLOR_FN[mode] || COLOR_FN.voxel;
  return fn(norm, isWater, opts);
}
```

Port `_build` (296–374) into `computeGrid({ heightMatrix, resolution, minElev, maxElev, heightScale, showWater, waterLevel })`:
- `G = Math.min(resolution, heightMatrix.length, heightMatrix[0].length)`
- `grid = sampleGrid(heightMatrix, G)` — port `this._sample` (between 138–245) into a local helper `sampleGrid`.
- `elevRange`, `MAX_H = Math.max(10, Math.round(G * 0.28 * heightScale))`,
  `BASE = showWater ? 12 : 3`
- Loop exactly as 320–342: `n`, lake carve `n -= 0.15` when `showWater && n <= waterLevel/50 + 0.005`,
  `cols`, `norms`, `isLake`, track `peakVal/peakX/peakZ`.
- Return `{ G, grid, norms, cols, isLake, MAX_H, BASE, peakVal, peakX, peakZ, halfG: (G-1)/2 }`.

Port `_buildVoxel` (377–474) → `buildVoxel(scene, grid, { norms, cols, G, BASE }, colorFor)`. Uses the
`_scratchColor` pattern (3 scratch THREE.Color instances) exactly as v1; attach mesh to `scene`.
Port `_buildSmooth` (475–521) → `buildSmooth(scene, grid, { norms, G, MAX_H, BASE }, colorFor)`.

All builders return the created `mesh` (so `renderer.js` can raycast/dispose them).

**Verify**: `node --check` each file. Manual (after Task 11): each of the 5 view modes renders identically
to v1 at same settings.

---

### Task 7 — `public/js/scene/water.js`

Port `_buildWater` (522–~650) → `buildWaterLayer(scene, { G, BASE, MAX_H, isLake, waterOpacity, viewMode })`
returning the mesh. Port `getWaterElevation` (279–284) → `waterLevelFromSlider(sliderVal, minElev, maxElev)`.
**Verify**: `waterLevelFromSlider(50, 0, 100)` = 100; `waterLevelFromSlider(0,0,100)` = 0. Manual: water
renders in voxel + smooth modes, opacity slider works.

---

### Task 8 — `public/js/scene/markers.js`

```js
export class Markers {
  constructor(scene, domContainer) { /* port peak pin/badge DOM from v1; this.group = new THREE.Group() */ }
  buildPeakPin(worldX, worldY, worldZ, elevMeters) { /* port _buildPeakPin 654–690 */ }
  setBadgeVisible(bool) { /* port badge show/hide logic from _build 361–363 */ }
  updateBadge(camera, unit) { /* port _updatePeakBadge 691–752; use formatElevation(elevMeters, unit) from core/units.js */ }
  addCenterMarker(x, y, z) { /* small THREE.Cone+Mesh ring at map center on the terrain surface */ }
  clear() { /* dispose group children (geometry/materials) + remove group + hide badge — port _clear peakGroup/badge part (753–…) */ }
}
```

Center marker: cylinder ring radius `G*0.03`, sand color `0xd9a05b`, rotated flat, `y = surfaceY + 0.2`, plus a
`ConeGeometry` on top. It is separate from the peak pin and sits at `(0, *, 0)` world (map center).
**Verify**: pin badge shows labeled peak elevation; badge text updates when unit toggles m↔ft;
center marker visible at map center; `clear()` removes all scene/group artifacts.

---

### Task 9 — `public/js/scene/export.js`

Port `exportOBJ` (717–723) and `exportSTL` (724–…). Add:

```js
export function screenshot(renderer, scene, camera, filename = 'terrain') {
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
```

**Verify**: manual — OBJ/STL export produce files; screenshot PNG downloads a valid image.

---

### Task 10 — `public/js/scene/sky.js`

```js
export class Sky {
  constructor(scene, fogColor = 0x1a1714) {
    this.scene = scene;
    this.hemi = new THREE.HemisphereLight(0xefe9e2, 0x2a2018, 1.0); // warm sky / dark ground
    this.sun = new THREE.DirectionalLight(0xffe6c4, 1.4);
    this.sun.castShadow = true;
    this.ambient = new THREE.AmbientLight(0xefe9e2, 0.35);
    scene.add(this.hemi, this.sun, this.ambient);
    this.stars = this._buildStars();
    scene.add(this.stars);
    this._updateIntensity(45);
  }
  _buildStars() {
    // 500 random points on a big dome (r ~ 1200), opacity 0 until night
    // THREE.Points, material: PointsMaterial({ color: 0xfff2d9, size: 1.2, transparent: true, opacity: 0, fog: false })
  }
  setSunPosition(az, el) {
    /* port 245–255 exactly (sun.position math, distance 240) */
    this._updateIntensity(el);
  }
  _updateIntensity(el) {
    const day = Math.max(0, Math.min(1, el / 25));
    this.hemi.intensity = 0.35 + 0.65 * day;
    this.sun.intensity = 0.4 + 1.6 * day;
    this.stars.material.opacity = 1 - day; // day→0, night→1
    this.scene.background.setHex(day > 0.9 ? 0x1a1714 : 0x0d0f12); // deeper night tint
  }
}
```

**Verify**: manual — dragging sun elevation down dims lights and fades stars in; up brightens.
Fog color stays `0x1a1714` (per current theme).

---

### Task 11 — `public/js/scene/renderer.js`

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { computeGrid, buildVoxel, buildSmooth, colorFor } from './terrain.js';
import { buildWaterLayer, waterLevelFromSlider } from './water.js';
import { Markers } from './markers.js';
import { Sky } from './sky.js';
import { screenshot } from './export.js';
import { POVController } from './pov.js';
import { formatElevation } from '../core/units.js';

export class TerrainRenderer {
  constructor(container) { /* port v1 constructor 138–244 (renderer, scene, camera, controls, lights→Sky, scratch colors, _sample bind) */ }
  setSunPosition(az, el) { this.sky.setSunPosition(az, el); }

  render(data, settings, autoFrame = true) {
    this.heightData = { heightMatrix: data.heightMatrix, minElev: data.minElev, maxElev: data.maxElev };
    Object.assign(this, pick(settings, ['resolution','heightScale','viewMode','topoBands','heatMinCut','heatMaxCut','satHaze','milContrast','showWater','waterLevel','waterOpacity','showPeakPin']));
    this._build(autoFrame);
  }

  applySettings(opts) { /* port rerender 262–277 semantics: merge + this._build(false).
    Also: if opts.sunAz/sunEl present → this.sky.setSunPosition(opts.sunAz, opts.sunEl). */ }

  getWaterElevation(sliderVal = this.waterLevel) { return waterLevelFromSlider(sliderVal, this.heightData.minElev, this.heightData.maxElev); }

  _build(autoFrame = true) { /* port 296–374 using computeGrid/buildVoxel/buildSmooth/buildWaterLayer/Markers */ }

  setAutoRotate(on) { this.autoRotate = on; this.controls.autoRotate = on; }

  setUnit(unit) { this.markers.updateBadge(this.camera, unit); }

  // World-space height of terrain at (x, z) world coords (x,z ∈ [-halfG, halfG]).
  sampleWorldHeight(x, z) {
    const { G, MAX_H, BASE, norms, cols, viewMode } = this._grid;
    const hx = x + (G - 1) / 2, hz = z + (G - 1) / 2;
    if (hx < 0 || hz < 0 || hx > G - 1 || hz > G - 1) return BASE;
    const j0 = Math.max(0, Math.floor(hx)), i0 = Math.max(0, Math.floor(hz));
    const j1 = Math.min(G - 1, j0 + 1), i1 = Math.min(G - 1, i0 + 1);
    const fx = hx - j0, fz = hz - i0;
    const g = (v00, v10, v01, v11) =>
      v00 * (1 - fx) * (1 - fz) + v10 * fx * (1 - fz) + v01 * (1 - fx) * fz + v11 * fx * fz;
    const n = viewMode === 'voxel' ? g(cols[i0*G+j0], cols[i0*G+j1], cols[i1*G+j0], cols[i1*G+j1]) : g(norms[i0*G+j0], norms[i0*G+j1], norms[i1*G+j0], norms[i1*G+j1]);
    const top = viewMode === 'voxel' ? n : n * MAX_H;
    return BASE + top;
  }

  // Raycast terrain for hover/profile picking. Returns { x, z, worldY, elevMeters } or null.
  pickTerrain(clientX, clientY) {
    const rect = this.container.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this._terrainMeshes, false)[0];
    if (!hit) return null;
    const { G, MIN_ELEV, MAX_ELEV, halfG } = this._grid;
    const x = Math.round(hit.point.x + halfG), z = Math.round(hit.point.z + halfG);
    if (x < 0 || z < 0 || x >= G || z >= G) return null;
    const matrix = this.heightData.heightMatrix;
    return { x, z, worldY: hit.point.y, elevMeters: matrix[z]?.[x] ?? 0 };
  }

  flyToPreset(preset) {
    const { G, MAX_H, BASE } = this._grid;
    const cy = BASE + MAX_H * 0.4;
    const dist = G * 0.85 + MAX_H * 0.3;
    const target = new THREE.Vector3(0, cy, 0);
    if (preset === 'top')      this.camera.position.set(0, cy + dist * 1.35, G * 0.12);
    else if (preset === 'iso') this.camera.position.set(dist * 0.85, cy + dist * 0.6, dist * 0.85);
    else this.camera.position.set(dist * 0.7, cy + dist * 0.45, dist * 0.7); // home
    this.controls.target.copy(target);
    this.controls.update();
  }

  drawProfilePath(points) { /* THREE.Line, buffer geometry from points (world coords via sampleWorldHeight), sand color 0xd9a05b, stored in this._profileLine */ }
  clearProfile() { /* dispose + remove this._profileLine */ }

  screenshot(filename) { screenshot(this.renderer, this.scene, this.camera, filename); }
  exportOBJ(fn) { /* port */ }
  exportSTL(fn) { /* port */ }

  startPOV() {
    if (this.pov) return;
    this.pov = new POVController({ camera: this.camera, domElement: this.renderer.domElement, sampleWorldHeight: (x,z) => this.sampleWorldHeight(x,z), onExit: () => this.stopPOV() });
    this._povSaved = { target: this.controls.target.clone() };
    this.pov.enter();
  }
  stopPOV() { if (this.pov) { this.pov.exit(); this.pov = null; } }

  _animate() { /* port 788–…; add: if (this.autoRotate) this.controls.autoRotate = true; this.pov?.update(dt); this.markers.updateBadge(this.camera, this.unit); */ }

  dispose() { /* port 810–…; add this.pov?.exit(); this.sky cleanup; markers.clear(); */ }
}
```

Notes:
- `pick(settings, keys)` = object of whitelisted keys (small local helper).
- `this._grid` is cached by `_build` from `computeGrid` and stores `G, MAX_H, BASE, halfG, MIN_ELEV, MAX_ELEV, norms, cols, viewMode`.
- `this._terrainMeshes = []` — every built mesh pushed here; water mesh too. `_clear()` empties it (port 753–…).
- `this.raycaster = new THREE.Raycaster()`.
- The v1 camera/controls default camera rig stays (perspective 45°, near/far, orbit constraints) — port from constructor.
- Unit changes: `setUnit` only affects badge text (kept in `this.unit`).

**Verify**: manual — every v1 interaction (orbit, zoom, pan, mode switch, water, peak pin, export, sun slider) works identically; hover `pickTerrain` returns correct elev; `flyToPreset` all three presets frame the map; `setAutoRotate` spins; POV (Task 12) entry/exit.

---

### Task 12 — `public/js/scene/pov.js`

```js
const EYE = 1.6, WALK = 12, SPRINT = 26, GRAVITY = 60, JUMP = 10;

export class POVController {
  constructor({ camera, domElement, sampleWorldHeight, onExit }) {
    this.camera = camera; this.domElement = domElement; this.onExit = onExit || (() => {});
    this.sampleWorldHeight = sampleWorldHeight;
    this.active = false;
    this.yaw = 0; this.pitch = 0;
    this.pos = { x: 0, y: 0, z: 0 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.keys = new Set();
    this._onMove = (e) => { /* yaw -= e.movementX * 0.0022; pitch = clamp(pitch - e.movementY * 0.0022, -1.4, 1.4) */ };
    this._onDown = (e) => this.keys.add(e.code);
    this._onUp = (e) => this.keys.delete(e.code);
    this._onLock = () => { this.active = true; this._initialPos(); };
    this._onUnlock = () => { this.active = false; this._removeListeners(); this.onExit(); };
  }
  _initialPos() {
    // place POV at map center, standing on terrain
    this.pos.x = 0; this.pos.z = 0;
    this.pos.y = this.sampleWorldHeight(0, 0) + EYE;
    this.vel.y = 0;
    this.yaw = Math.PI / 4; this.pitch = -0.2;
  }
  enter() { this.domElement.requestPointerLock(); }
  exit() { if (document.pointerLockElement) document.exitPointerLock(); }
  isActive() { return this.active; }
  _addListeners() { /* pointerlockchange, mousemove, keydown/keyup on document */ }
  _removeListeners() { /* same */ }
  update(dt) {
    if (!this.active) return;
    const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? SPRINT : WALK;
    const fwd = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const right = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    // Camera looks down -Z at yaw=0 (rotation order YXZ). Forward = (-sin yaw, 0, -cos yaw),
    // Right = (cos yaw, 0, -sin yaw). W must move the camera the way it is looking:
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const dx = (-fwd * sin + right * cos) * speed * dt;
    const dz = (-fwd * cos - right * sin) * speed * dt;
    // bounds: stay inside [-halfG, halfG]
    const lim = (this._halfG ?? 40);
    const nx = Math.max(-lim, Math.min(lim, this.pos.x + dx));
    const nz = Math.max(-lim, Math.min(lim, this.pos.z + dz));
    const ground = this.sampleWorldHeight(nx, nz);
    // gravity + jump
    if (this.keys.has('Space')) { if (Math.abs(this.pos.y - (ground + EYE)) < 0.05) this.vel.y = JUMP; }
    this.vel.y -= GRAVITY * dt;
    this.pos.x = nx; this.pos.z = nz;
    const ny = this.pos.y + this.vel.y * dt;
    if (ny <= ground + EYE) { this.pos.y = ground + EYE; this.vel.y = 0; }
    else this.pos.y = ny;
    this.camera.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
```

`_halfG` is injected after the first build via a setter `setBounds(halfG)` called from `renderer.startPOV()`
(`this._grid.halfG`). `startPOV` must set `this.pov.setBounds(halfG)`. On exit, camera rotation/orbit state is restored by the renderer (disable controls during POV: `this.controls.enabled = false`, restore on exit).
**Verify**: manual — pointer lock engages, WASD moves, mouse looks, space jumps, shift sprints, cannot walk through terrain, stays in bounds, Esc exits cleanly and orbit resumes.

---

---

## Cross-module contracts (read before Tasks 13–23)

These are the shared interfaces the UI modules must use so independently-written files stay compatible.

**DOM containers (Task 22 provides exactly these elements; UI modules build their own inner DOM):**
- `#viewport` — renderer mounts here; `position: relative` in CSS (tooltip anchors here).
- `#topbar` — holds `#search-wrap` (SearchBar builds into it) + the app wordmark.
- `#panel` — TerrainPanel builds all controls + stats here.
- `#hud` — Hud builds the full status/scale/compass/buttons bar here.
- `#welcome`, `#loading`, `#tooltip`, `#profile-overlay`, `#pov-hud`, `#toast-root` — overlay containers.

**store shape (main.js initializes):**
```js
{ data: null, place: null, stats: null, peaks: [], settings: loadSettings(), profile: null, pov: false }
```
`settings` keys = DEFAULTS in `core/settings.js`. Modules that mutate settings call
`store.set({ settings: sanitizeSettings({ ...store.get().settings, [k]: v }) })` + `saveSettings(...)`,
then push to the renderer via `renderer.applySettings({ [k]: v })`.

**toasts (Task 15):** `new Toasts(rootEl)`; `show(message, kind, ms)` with `kind ∈ {error, info, success, warn}`.

**renderer surface used by UI modules (`scene/renderer.js`, already built):**
`applySettings(opts)`, `setSunPosition(az, el)`, `flyToPreset('home'|'top'|'iso')`, `setAutoRotate(bool)`,
`startPOV()`, `stopPOV()`, `isPOV()`, `screenshot(filename)`, `getWaterElevation(sliderVal)`,
`pickTerrain(clientX, clientY) → { x, z, worldY, elevMeters } | null`,
`drawProfilePath(points)` / `clearProfile()` (points are world `{x, y, z}`), `sampleWorldHeight(x, z)`,
`setUnit(unit)`. `pickTerrain` coords are **grid indices** (0..G-1); G is recomputed by callers as
`Math.min(settings.resolution, matrix.length, matrix[0].length)`.

**Icon sprite:** UI buttons may reference `<use href="#icon-...">`. Allowed symbols (Task 22 provides them):
`icon-search, icon-mountain, icon-home, icon-top, icon-iso, icon-walk, icon-camera, icon-locate,
icon-graph, icon-bookmark, icon-share, icon-water, icon-pin, icon-compass, icon-sun, icon-close,
icon-ruler, icon-dice, icon-layers, icon-chevron`. Do not reference any other symbol.

---

### Task 13 — `public/js/core/api.js`

```js
async function request(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); if (j && j.error) msg = j.error; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export function searchByQuery(q, signal) { return request(`/api/search?q=${encodeURIComponent(q)}`, signal); }
export function searchByCoords(lat, lon, signal) { return request(`/api/coords?lat=${lat}&lon=${lon}`, signal); }
export function getSuggestions(q, signal) { return request(`/api/suggest?q=${encodeURIComponent(q)}`, signal); }

export function normalizeSearchResult(r) {
  return {
    location: String(r.location || 'Coordinates'),
    lat: Number(r.lat), lon: Number(r.lon),
    minElev: Number(r.minElev), maxElev: Number(r.maxElev),
    hasWater: !!r.hasWater, autoWaterLevel: Number(r.autoWaterLevel ?? 0),
    heightMatrix: r.heightMatrix, gridSize: Number(r.gridSize ?? 250),
    cached: !!r.cached, failedTileCount: Number(r.failedTileCount ?? 0),
  };
}
```

**Verify**: unit test `normalizeSearchResult` (missing fields get defaults; `failedTileCount` defaults 0).
Manual (after Task 23): searches hit `/api/search` and `/api/coords` correctly.

---

### Task 14 — `public/js/core/geolocation.js`

```js
export function getCurrentPosition({ timeout = 8000, maximumAge = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(new Error((err && err.message) || 'Location unavailable')),
      { enableHighAccuracy: false, timeout, maximumAge }
    );
  });
}
```

**Verify**: test with a stubbed `globalThis.navigator = { geolocation: { getCurrentPosition: (ok, err) => ok({ coords: { latitude: 1, longitude: 2, accuracy: 10 } }) } }`
resolves `{lat:1, lon:2}`; an error stub rejects. Restore navigator after.

---

### Task 15 — `public/js/ui/toasts.js`

```js
const KINDS = { error: 'toast-error', info: 'toast-info', success: 'toast-success', warn: 'toast-warn' };
export class Toasts {
  constructor(container = document.body) { this.container = container; }
  show(message, kind = 'error', ms = 4200) {
    const el = document.createElement('div');
    el.className = `toast ${KINDS[kind] || KINDS.info}`;
    el.innerHTML = `<span class="toast-dot" aria-hidden="true"></span><span>${message}</span>`;
    this.container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('toast-in'));
    setTimeout(() => {
      el.classList.remove('toast-in');
      el.classList.add('toast-out');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, ms);
  }
}
```

Kinds: error (red `#c4553f`), warn (amber `#d9a05b`), success (moss `#7a8b4f`), info (sand text).
**Verify**: manual — each toast type shows, animates in/out, auto-removes.

---

### Task 16 — `public/js/ui/search.js`

```js
const FAMOUS_SPOTS = [
  { name: 'Mount Fuji', lat: 35.3606, lon: 138.7274 },
  { name: 'Mount Everest', lat: 27.9881, lon: 86.9250 },
  { name: 'Grand Canyon', lat: 36.1069, lon: -112.1129 },
  { name: 'Matterhorn', lat: 45.9766, lon: 7.6585 },
  { name: 'Kilimanjaro', lat: -3.0674, lon: 37.3556 },
  { name: 'Denali', lat: 63.0690, lon: -151.0063 },
];

const COORD_RE = /^\s*(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)\s*$/;

export class SearchBar {
  constructor({ container, store, toasts, onSearch })
  // container = #search-wrap. Builds its own <form class="searchbar"> + <div class="suggest-box"> inside.
  // onSearch(lat, lon) → main.js load flow
  // input events: debounce 200ms → getSuggestions → render box
  // Enter → if COORD_RE matches → onSearch(lat, lon) else searchByQuery(q) → onSearch(lat, lon); errors → toast
  // keyboard: ArrowDown/Up move active index, Enter picks, Esc closes
  // click on suggestion row → onSearch(lat, lon)
  static FAMOUS_SPOTS = FAMOUS_SPOTS;
  static parseCoords(text) { /* COORD_RE exec → {lat, lon} | null */ }
}
```

Text search flow: Enter with a non-coordinate query → `searchByQuery(q)` → on success
`onSearch(result.lat, result.lon)`; on failure → toast `Could not find that place`. Coordinate text
(`35.36, 138.72`) skips the server search and goes straight to `onSearch(lat, lon)`.

Suggestions rows show `display_name`; picking one uses `lat`/`lon` from the suggestion (Nominatim returns them).
**Verify**: `parseCoords('35.36, 138.72')` works; `parseCoords('shimla')` is null. Manual: typing shows ≤5 suggestions, arrow keys work, Enter triggers search.

---

### Task 17 — `public/js/ui/panel.js`

```js
export class TerrainPanel {
  constructor({ container, store, toasts, renderer }) // container = #panel
}
```

"Terrain Lab" panel. For each setting control, `input` event →
`store.set({ settings: sanitizeSettings({ ...settings, [key]: val }) })` + `saveSettings` +
`renderer.applySettings({ [key]: val })` (debounced ~120ms for heavy rebuilds like resolution).

Controls (map to settings keys):
- resolution (range 30–250, step 10)
- heightScale (0.5–3, step 0.05)
- sunAz (0–360), sunEl (0–85) → `renderer.applySettings({ sunAz, sunEl })`
- waterLevel (0–100), waterOpacity (0.1–1) — water slider reads `renderer.getWaterElevation` for the "≈ 1234 m" readout
- toggles: showWater, showPeakPin, autoRotate (autoRotate also calls `renderer.setAutoRotate`)
- mode-specific: topoBands (4–16), heatMinCut/heatMaxCut (0–1 step 0.05), satHaze (0–0.8), milContrast (0.5–2)
- view mode switcher (5 buttons: Voxel / Topo / Heatmap / Satellite / Military) + a CSS gradient legend strip per mode — ALL built inside `#panel` (no separate topbar switcher)

Stats strip: render from `store.get().stats` **only when `store.get().data` reference changes** (track
`this._lastData`) so slider input never rebuilds panel DOM (would break slider focus): min / max / mean /
relative prominence / footprint km² / grid resolution + failedTileCount warning (amber,
"N tiles failed to load — some areas may be flat").

On init, set every slider/toggle position from `store.get().settings`.
**Verify**: every control live-updates; settings survive reload (localStorage); stats match `computeStats`.

---

### Task 18 — `public/js/ui/hud.js`

```js
export class Hud {
  constructor({ container, store, renderer, toasts, callbacks })
  // callbacks (wired by main.js): { onMyLocation, onProfile, onSavePlace, onShare }
}
```

Bottom HUD (`#hud`):
- **Status line**: place name, `lat, lon` (click-to-copy → toast "Coordinates copied"), center elevation
  `formatElevation(centerElev, settings.unit)`, dataset badge `Cache HIT` (moss) vs `Live DEM` (sand).
- **Scale bar**: `spanM = cellSizeMeters(lat, 12, gridSize) * gridSize`, pick a nice round distance
  (1/2/5/10/20/50 km, or ft/mi in ft mode) that fits ≤ 35% of HUD width; label `formatDistance`.
- **Compass**: static N/E/S/W ring + sun azimuth needle rotated `settings.sunAz`.
- **Unit toggle**: `m` / `ft` segmented; flips `settings.unit`, calls `renderer.setUnit`, saves settings.
- **Buttons** (icon + label): Home / Top / Iso (→ `renderer.flyToPreset`), Walk (→ `renderer.startPOV()`),
  Auto-rotate (toggle → settings + `renderer.setAutoRotate`), Screenshot (→ `renderer.screenshot('terrain-' + name)`),
  Water toggle + Peak Pin toggle (settings + `renderer.applySettings`), then via `callbacks`: My Location, Profile, Save Place, Share.
- **Error/source line**: `failedTileCount > 0` → amber note.

Share callback: `copyToClipboard(shareUrl())` + toast. Share also sets `window.location.hash = formatHash(lat, lon)`
on place change (main.js handles the hash write; the HUD only reads `store.get().place`).

`store.on` subscription re-renders status/scale/compass when `place` or `settings.unit` changes (track a
`this._lastSig` = place.lat + unit to avoid needless DOM churn during slider drags).
**Verify**: manual — all buttons work; scale bar ≈ correct (Fuji ≈ 29 km at z12); unit toggle flips all numeric labels.

---

### Task 19 — `public/js/ui/tooltip.js`

```js
export class HoverTooltip {
  constructor({ container, store, renderer, toasts }) // container = #viewport (position:relative)
  // pointermove (throttled via rAF) on container:
  //   const hit = renderer.pickTerrain(e.clientX, e.clientY);
  //   if (!hit) hide(); else position + fill: elev = formatElevation(hit.elevMeters, settings.unit),
  //   lat = place.lat + (halfG - x)/G * spanDeg, lon likewise
  //   place the tooltip div next to the cursor within container (absolute; clamp inside)
  // pointerleave → hide
}
```

The tooltip div is created by this module and appended to `container`. `spanDeg = 3 * (360 / 2**12)`
(total DEM ground span); G = `Math.min(settings.resolution, matrix.length, matrix[0].length)`, halfG = `(G-1)/2`.
Lat/lon per cell: `lat = place.lat + (halfG - x)/G * spanDeg`; `lon = place.lon + (x - halfG)/G * spanDeg`.
(Cos-lat correction ignored at these small spans — acceptable.) No HUD coupling.
**Verify**: manual — hovering shows a floating card with elevation + coords; follows pointer; hides on leave.

---

### Task 20 — `public/js/ui/profile.js`

```js
export class ProfileOverlay {
  constructor({ container, store, renderer, toasts }) // container = #profile-overlay
  start() / stop() / isActive()
  // start(): entering "pick mode" — crosshair cursor on viewport, hint toast "Click terrain for point A"
  // click A → renderer.pickTerrain → temp marker (small THREE.Sphere added via a helper the overlay owns,
  //   or a CSS dot) + hint "Now click point B"
  // click B → compute profile:
  //   G = Math.min(settings.resolution, matrix.length, matrix[0].length), halfG = (G-1)/2
  //   points = sampleProfile(matrix, a.x, a.z, b.x, b.z, 128)
  //   renderer.drawProfilePath(points.map(p => ({ x: p.x - halfG, z: p.z - halfG,
  //                                              y: renderer.sampleWorldHeight(p.x - halfG, p.z - halfG) })))
  //   render canvas chart: 2D line, min/max/mean gridlines, fill gradient sand, axis labels formatElevation
  //   store.set({ profile: { a, b, points } }); show overlay
  // stop(): renderer.clearProfile() + remove temp markers + hide overlay + reset pick mode
}
```

Chart drawing: plain Canvas2D, width = canvas.clientWidth * devicePixelRatio, height likewise; padding 12px;
scale y to [min, max] of profile; gridlines at min, mid, max with labels; redraw on window resize and on
`settings.unit` change (subscribe via store.on, guard against profile===null).
**Verify**: manual — two clicks draw terrain line + open chart; chart matches terrain; close/stop cleans up.

---

### Task 21 — `ui/welcome.js`, `ui/loading.js`, `ui/povui.js`

**welcome.js** (`#welcome` overlay):
```js
export class Welcome {
  constructor({ container, store, toasts, onSearch, onMyLocation })
  dismiss()
}
```
- Title "TERRACRAFT" + tagline, Famous Spots chips (import FAMOUS_SPOTS from `./search.js`), a small
  coordinate quick-input (`lat, lon` → `onSearch(lat, lon)`), "Random landmark" button (random spot →
  `onSearch`), "My location" button (→ `onMyLocation`), Saved places list (from `loadPlaces()`, each with a
  delete ×) — clicking loads it. No saved places → hide section.
- No text-search field here: the topbar SearchBar owns text/autocomplete search.
- `dismiss()` on first successful search (fade out via class + `hidden`).

**loading.js** (`#loading` overlay):
```js
const STAGES = [
  [0, 'Contacting terrain service…'],
  [20, 'Fetching elevation tiles…'],
  [55, 'Analyzing water features…'],
  [80, 'Building 3D terrain…'],
  [95, 'Placing markers…'],
];
export class Loading {
  constructor(overlay, bar, text) { }
  start() { overlay.hidden = false; }
  stage(i) { const [pct, msg] = STAGES[Math.min(i, STAGES.length - 1)]; bar.style.width = pct + '%'; text.textContent = msg; }
  stop() { overlay.hidden = true; }
}
```

**povui.js** (`#pov-hud` overlay):
```js
export class PovHud {
  constructor({ container }) // container = #pov-hud
  show() / hide()
}
```
- Center reticle (small crosshair), hint "Click to look · WASD move · Space jump · Shift sprint · Esc exit",
  exit button (redundant with Esc, but clear on touch), and a note when pointer lock is unsupported.
- `show()`/`hide()` driven by `store.on` `pov` flag.
**Verify**: manual — welcome shows first visit; loading stages advance during a cold search; POV overlay appears only during POV.

---

### Task 22 — `public/index.html` + `public/css/style.css` rewrite

Keep from v1: `<link>` warm fonts (Fraunces, Inter, JetBrains Mono), theme-color `#171412`, favicon `#d9a05b`,
the inline SVG icon sprite, import map (`three` + OrbitControls + OBJExporter + STLExporter @0.168.0).

**HTML structure** (module script `src="js/main.js"`, `defer`):
```
<header id="topbar">   wordmark + <div id="search-wrap"> (SearchBar builds into it)
<aside id="panel">     Terrain Lab (Task 17)
<main id="viewport">   → renderer mounts here
<footer id="hud">      Task 18
<div id="welcome">     Task 21
<div id="loading">     Task 21
<div id="tooltip">     Task 19 (module appends its own div)
<div id="profile-overlay"> Task 20
<div id="pov-hud">     Task 21
<div id="toast-root">  Task 15
```

**Design tokens** (`:root` in style.css):
```
--bg:#171412; --surface:#211d1a; --surface2:#2b2622; --surface3:#332c27;
--text:#efe9e2; --text-dim:#b3a894; --text-faint:#8a7f6d;
--sand:#d9a05b; --sand-bright:#e8b877; --moss:#7a8b4f; --moss-bright:#93a862;
--red:#c4553f; --amber:#d9a05b;
--font-display:'Fraunces',serif; --font-ui:'Inter',sans-serif; --font-mono:'JetBrains Mono',monospace;
--radius:14px; --radius-sm:9px;
--shadow:0 10px 30px rgba(0,0,0,.45);
```

Layout rules: topbar is a horizontal flex bar (sticky top), panel is a left column that collapses to a
full-width drawer above the viewport on ≤ 900px (toggle button), HUD is a bottom bar (flex-wrap), welcome/loading
are full-screen overlays over a blurred backdrop. No glassmorphism, no glow, no drop-shadows on text. Buttons:
solid sand background with dark text, radius `--radius-sm`, `:hover` brightens, `:active` translates 1px,
`.is-on` state uses moss. Range inputs styled with a sand thumb. Sliders get mono value readouts.
**Verify**: `node --check` the module script; manual — responsive at 1280px and 375px widths, no horizontal scroll, all overlays centered.

---

### Task 23 — `public/js/main.js` (bootstrap) + delete v1

```js
import { createStore } from './core/store.js';
import { loadSettings, loadPlaces, loadLast, saveLast, savePlaces, saveSettings } from './core/settings.js';
import { searchByCoords, normalizeSearchResult } from './core/api.js';
import { computeStats, cellSizeMeters, findTopPeaks } from './core/terrainMath.js';
import { formatElevation } from './core/units.js';
import { parseHash, formatHash, shareUrl, copyToClipboard } from './core/share.js';
import { getCurrentPosition } from './core/geolocation.js';
import { TerrainRenderer } from './scene/renderer.js';
import { Toasts } from './ui/toasts.js';
import { SearchBar } from './ui/search.js';
import { TerrainPanel } from './ui/panel.js';
import { Hud } from './ui/hud.js';
import { HoverTooltip } from './ui/tooltip.js';
import { ProfileOverlay } from './ui/profile.js';
import { Welcome } from './ui/welcome.js';
import { Loading } from './ui/loading.js';
import { PovHud } from './ui/povui.js';

const store = createStore({ data: null, place: null, stats: null, peaks: [], settings: loadSettings(), profile: null, pov: false });
const toasts = new Toasts(document.getElementById('toast-root'));
const renderer = new TerrainRenderer(document.getElementById('viewport'));
// construct all ui modules with (store, renderer, toasts) — wire onSearch below

async function load(lat, lon) {
  const loading = ui.loading; loading.start(); loading.stage(0);
  try {
    const ctrl = new AbortController();
    ui.loading.ctrl = ctrl;
    loading.stage(1);
    const raw = await searchByCoords(lat, lon, ctrl.signal);
    const data = normalizeSearchResult(raw);
    loading.stage(2);
    const st = store.get().settings;
    loading.stage(3);
    renderer.render(data, st, true);
    loading.stage(4);
    const cell = cellSizeMeters(lat, 12, data.gridSize);
    const stats = computeStats(data.heightMatrix, cell);
    stats.failedTileCount = data.failedTileCount;
    const peaks = findTopPeaks(data.heightMatrix, 3);
    store.set({ data, place: { name: data.location, lat: data.lat, lon: data.lon }, stats, peaks });
    saveLast({ name: data.location, lat: data.lat, lon: data.lon });
    history.replaceState(null, '', formatHash(data.lat, data.lon));
    loading.stop();
    if (data.failedTileCount > 0) toasts.show(`${data.failedTileCount} tile(s) failed to load — some areas may be flat`, 'warn');
    if (data.cached) toasts.show('Loaded from local cache', 'success', 2600);
    ui.welcome.dismiss();
  } catch (err) {
    loading.stop();
    toasts.show(`Could not load terrain: ${err.message}`);
  }
}

// boot: hash first, then last place, else welcome
const hashLoc = parseHash(location.hash);
if (hashLoc) load(hashLoc.lat, hashLoc.lon);
else { const last = loadLast(); if (last) load(last.lat, last.lon); }

// search wiring: SearchBar resolves a query to {lat, lon} then calls onSearch(lat, lon) => load(lat, lon)
// store.on: if profile cleared externally → re-render; if pov toggled → povui.show/hide + controls.enabled flip
```

The SearchBar owns text→coords resolution: `searchByQuery(q)` returns lat/lon, then it calls `onSearch(lat, lon)`.
`load` itself only ever calls `searchByCoords` (the server re-geocodes the stored cache name). Delete
`public/js/voxelRenderer.js`, `public/js/controls.js`, `public/js/app.js` only after full QA passes.
**Verify**: fresh load → welcome; hash `#35.3606,138.7274` → loads Fuji; search, my-location, saved place,
random landmark all trigger `load`; console has zero errors.

---

### Task 24 — backend: `failedTileCount` + tile fallback

`services/tileDownloader.js`:
- In `getElevationMatrix`, after `mapLimit`, count specs whose catch ran → `let failed = 0` incremented in catch.
- Replace the zero-fill fallback with a **zoom-1 retry**: on tile failure at zoom `z`, attempt
  `downloadTile(z - 1, Math.floor(tileX / 2), Math.floor(tileY / 2))`, decode it, then **upscale** 2×
  (nearest neighbor — each src pixel → 2×2 block) to 256×256 so it still fills the stitch grid. If the
  zoom-1 attempt also fails, fall back to zero-fill (and count it).
- Return `{ matrix, minElev, maxElev, failedTileCount: failed }`.
- Add a helper `upscale2x(elevation)` (pure, add to `tileMath.js` with a unit test: 1×1 → 2×2 copy; 2×2 → 4×4 blocks).

`routes/terrain.js`:
- `processCoordinates` cache MISS: `const { matrix, minElev, maxElev, failedTileCount } = await getElevationMatrix(...)`;
  include `failedTileCount` in the returned object. Cache HIT: include `failedTileCount: 0`.
- Cache `saveToCache` unchanged (do not persist failure counts).
**Verify**: `bun test` — new `upscale2x` test passes, existing 12 still pass. Manual: block a tile host
(via devtools offline for one request) → map still renders, toast warns about N failed tiles.

---

### Task 25 — Final QA

One checklist run after Task 23/24. Evidence required before declaring done:
- `bun test` → all pass (old 12 + new core suites).
- `node --check` on every new/changed `.js`.
- Manual (browser at `http://192.168.16.1:3000`), DevTools console with zero errors:

1. Fresh load shows Welcome overlay; title/fonts/colors match warm-earth tokens.
2. Search "Mount Fuji" → loading stages advance; terrain renders in **voxel** mode; toast "Loaded from local cache" or data loads.
3. All 5 view modes render; mode-specific sliders (topo bands, heat cutoffs, sat haze, mil contrast) live-update.
4. Water toggle on/off + water level slider updates water surface (auto level matches `autoWaterLevel`).
5. Peak pin + badge shows summit elevation; toggle hides it; unit m↔ft flips the badge label and all numbers.
6. Hover shows elevation + lat/lon tooltip; HUD coords update while hovering.
7. Camera presets Home/Top/Iso frame correctly; auto-rotate spins and disables.
8. POV: Walk → pointer lock, WASD, mouse look, Space jump, Shift sprint, cannot pass through terrain, Esc exits and orbit resumes.
9. Elevation profile: pick A, pick B → terrain line + 2D chart with min/max/mean labels; closing cleans up.
10. Scale bar ≈ 29 km at Fuji z12 and flips to miles in ft mode; compass needle tracks sun azimuth.
11. Screenshot downloads PNG; OBJ/STL export files download.
12. Share copies URL with `#lat,lon`; pasting it in a new tab loads the same place; copy toast shown.
13. My location (if granted) loads; denied shows an error toast.
14. Save Place adds to saved list; Welcome shows it; delete removes it; settings persist across reload.
15. Random landmark loads a new spot each click.
16. Tile-failure path: `failedTileCount > 0` renders warning toast (verified via forced single-tile failure in Task 24).
17. Responsive: 375px width — panel becomes drawer, no horizontal scroll, HUD wraps, tooltips still usable.
18. `public/js/voxelRenderer.js`, `controls.js`, `app.js` deleted (after everything above passes); fresh hard-reload still works.

---

## Risks / Notes

- **POV terrain collision**: uses `sampleWorldHeight` (world space), so POV works in every view mode. Voxel mode uses `cols` (rounded), smooth uses `norms` — collision is sampled on the *rendered* surface, not the DEM, which is intentional.
- **POV + OrbitControls**: disable `controls.enabled` during POV and restore after to avoid fighting.
- **`failedTileCount` on cache hits**: always 0 (failures are transient network events, not stored).
- **zoom-1 upscale**: 256px tiles become 512px of raw data, but the stitch→downsample pipeline already handles any input size; keep `TILE_SIZE` assumption intact by upscaling to 256×256.
- **delete v1 files last** — they are the porting source of truth.
