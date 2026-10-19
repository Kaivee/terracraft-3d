# Expedition Cartograph Redesign + Location Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the weak warm-earth UI with the "Expedition Cartograph" paper/green theme and make locations visible (region under welcome chips + location toast for random landmarks).

**Architecture:** Pure frontend change. A full rewrite of `public/css/style.css` using new design tokens plus small tweaks to `index.html`, `scene/renderer.js`, `scene/sky.js`. The location feature expands the static `FAMOUS_SPOTS` dataset in `ui/search.js`, renders two-line chips in `ui/welcome.js`, and threads a `{ name, region, toast }` option through `main.js` `goTo`/`loadTerrain`. No backend changes.

**Tech Stack:** Vanilla ES modules, Three.js 0.168 (unchanged), bun for tests/build-check. Fonts (Fraunces/Inter/JetBrains Mono) already loaded via index.html.

## Global Constraints

- Do not change the class names, IDs, or DOM structure that UI modules (`search.js`, `panel.js`, `hud.js`, `tooltip.js`, `welcome.js`, `profile.js`, `povui.js`, `loading.js`, `toasts.js`) build/consume. Only restyle them and add to the fixed element set in `index.html`.
- `FAMOUS_SPOTS` must keep the existing 6 entries (same names/lat/lon) and add 12-14 more, total **20**.
- `SearchBar.parseCoords`, `getSuggestions` API shape, and `SearchBar.FAMOUS_SPOTS` export must remain unchanged.
- Every spot entry is `{ name: string, region: string, lat: number, lon: number }`; coords within `lat∈[-90,90]`, `lon∈[-180,180]`.
- Design tokens (exact values):
  `--paper:#e9dec4; --paper-light:#f6efda; --ink:#22342a; --ink-2:#1c2c23; --umber:#b85c2e; --umber-dark:#97471f; --ochre:#d8a24a; --teal:#3e6b5e; --text-soft:#5a4a38; --red:#a63b2c; --line:rgba(34,52,42,.35)`
- Ink-green scene color: `0x161d18` (replaces `0x1a1714`).
- No glassmorphism, no pill-blur, no glow, no text shadows. Radii 4-6px. No emojis in UI copy except the existing dice/location glyphs already in code.
- `bun test` must stay green (63 existing + new places test).
- No git repo — skip all `git commit` steps; a "commit" step means: stop and report the task complete.

---

### Task 1: Dataset — expand `FAMOUS_SPOTS` with regions + dataset test

**Files:**
- Modify: `public/js/ui/search.js` (the `FAMOUS_SPOTS` array, lines 3-10)
- Create: `tests/places.test.js`

**Interfaces:**
- Produces: `SearchBar.FAMOUS_SPOTS` = array of 20 `{ name, region, lat, lon }` objects. `SearchBar.FAMOUS_SPOTS[0].name === 'Mount Fuji'` still true.
- Consumes: nothing (pure data + tests).

- [ ] **Step 1: Write the failing test** (`tests/places.test.js`)

```js
import { test, expect } from 'bun:test';
import { SearchBar } from '../public/js/ui/search.js';

const SPOTS = SearchBar.FAMOUS_SPOTS;

test('places dataset has at least 18 entries', () => {
  expect(SPOTS.length).toBeGreaterThanOrEqual(18);
});

test('every place has a name, region, and finite coords in range', () => {
  for (const p of SPOTS) {
    expect(typeof p.name).toBe('string');
    expect(p.name.length).toBeGreaterThan(0);
    expect(typeof p.region).toBe('string');
    expect(p.region.length).toBeGreaterThan(0);
    expect(Number.isFinite(p.lat)).toBe(true);
    expect(Number.isFinite(p.lon)).toBe(true);
    expect(p.lat).toBeGreaterThanOrEqual(-90);
    expect(p.lat).toBeLessThanOrEqual(90);
    expect(p.lon).toBeGreaterThanOrEqual(-180);
    expect(p.lon).toBeLessThanOrEqual(180);
  }
});

test('place names are unique', () => {
  const names = SPOTS.map((p) => p.name);
  expect(new Set(names).size).toBe(names.length);
});

test('the 6 legacy spots are still present with the same coords', () => {
  const legacy = {
    'Mount Fuji': [35.3606, 138.7274],
    'Mount Everest': [27.9881, 86.925],
    'Grand Canyon': [36.1069, -112.1129],
    'Matterhorn': [45.9766, 7.6585],
    'Kilimanjaro': [-3.0674, 37.3556],
    'Denali': [63.069, -151.0063],
  };
  for (const [name, [lat, lon]] of Object.entries(legacy)) {
    const spot = SPOTS.find((p) => p.name === name);
    expect(spot).toBeTruthy();
    expect(spot.lat).toBeCloseTo(lat, 4);
    expect(spot.lon).toBeCloseTo(lon, 4);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/places.test.js`
Expected: FAIL — the 4 new assertions fail (current list has 6 entries with no `region`).

- [ ] **Step 3: Implement the dataset**

Replace the `FAMOUS_SPOTS` array in `public/js/ui/search.js` (keep its export location) with **20 entries**. Keep the first 6 identical to today, then add 14 more with real regions. Example shape and a starter superset (use exactly these 20):

```js
export const FAMOUS_SPOTS = [
  { name: 'Mount Fuji',          region: 'Shizuoka · Yamanashi, Japan',        lat: 35.3606, lon: 138.7274 },
  { name: 'Mount Everest',       region: 'Khumbu, Nepal · China border',       lat: 27.9881, lon: 86.925 },
  { name: 'Grand Canyon',        region: 'Arizona, USA',                       lat: 36.1069, lon: -112.1129 },
  { name: 'Matterhorn',          region: 'Pennine Alps, Switzerland',          lat: 45.9766, lon: 7.6585 },
  { name: 'Kilimanjaro',         region: 'Tanzania',                           lat: -3.0674, lon: 37.3556 },
  { name: 'Denali',              region: 'Alaska, USA',                        lat: 63.069,  lon: -151.0063 },
  { name: 'Mont Blanc',          region: 'Alps, France · Italy',               lat: 45.8326, lon: 6.8652 },
  { name: 'Aoraki / Mt Cook',    region: 'Canterbury, New Zealand',            lat: -43.595, lon: 170.1417 },
  { name: 'Machu Picchu',        region: 'Cusco, Peru',                        lat: -13.1631, lon: -72.545 },
  { name: 'Torres del Paine',    region: 'Patagonia, Chile',                   lat: -50.9417, lon: -72.9515 },
  { name: 'Zion Canyon',         region: 'Utah, USA',                          lat: 37.2982, lon: -113.0263 },
  { name: 'Ayers Rock',          region: 'Northern Territory, Australia',      lat: -25.3444, lon: 131.0369 },
  { name: 'Mount Etna',          region: 'Sicily, Italy',                      lat: 37.751, lon: 14.9934 },
  { name: 'Lofoten Islands',     region: 'Nordland, Norway',                   lat: 68.1472, lon: 13.6098 },
  { name: 'Shimla',              region: 'Himachal Pradesh, India',            lat: 31.1048, lon: 77.1734 },
  { name: 'Munnar',              region: 'Kerala, India',                      lat: 10.0889, lon: 77.0595 },
  { name: 'Leh',                 region: 'Ladakh, India',                      lat: 34.1526, lon: 77.5771 },
  { name: 'Darjeeling',          region: 'West Bengal, India',                 lat: 27.041, lon: 88.2663 },
  { name: 'Nainital',            region: 'Uttarakhand, India',                 lat: 29.3919, lon: 79.4542 },
  { name: 'Ooty',                region: 'Nilgiris, Tamil Nadu, India',        lat: 11.4064, lon: 76.6932 },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/places.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

No git repo — report Task 1 complete with the test output.

---

### Task 2: Location threading — two-line chips + random landmark toast

**Files:**
- Modify: `public/js/ui/welcome.js`
- Modify: `public/js/main.js`
- Test: run `bun test` (existing 63 + Task 1's 4 must stay green); `bun build` bundle check.

**Interfaces:**
- Consumes: `SearchBar.FAMOUS_SPOTS` entries shaped `{ name, region, lat, lon }` (Task 1). `Welcome` constructor already receives `{ container, store, toasts, onSearch, onMyLocation }`.
- Produces:
  - `Welcome` accepts an optional new constructor key `onRandom(spot)` (called with a `{ name, region, lat, lon }` object when the random button is pressed).
  - `main.js` exposes `goTo(lat, lon, opts)` where `opts = { name?, region?, toast? }`.
  - `loadTerrain(lat, lon, opts)` reads `opts.name` for the HUD place name and, on success, when `opts.toast` is truthy, calls `toasts.show(...)`.

- [ ] **Step 1: Update `welcome.js` chip rendering**

In `Welcome._build()` the chips loop currently does:

```js
const b = document.createElement('button');
b.type = 'button';
b.className = 'welcome-chip';
b.textContent = spot.name;
b.addEventListener('click', () => this._onSearch(spot.lat, spot.lon));
```

Replace with two-line chips that pass the name through:

```js
const b = document.createElement('button');
b.type = 'button';
b.className = 'welcome-chip';
const name = document.createElement('span');
name.className = 'welcome-chip-name';
name.textContent = spot.name;
const region = document.createElement('span');
region.className = 'welcome-chip-region';
region.textContent = spot.region || '';
b.append(name, region);
b.addEventListener('click', () => this._onSearch(spot.lat, spot.lon, { name: spot.name }));
```

- [ ] **Step 2: Update `welcome.js` random button + accept `onRandom`**

In the constructor store the new callback:

```js
this._onRandom = onRandom || null;
```

In `_build()`, change the `random` button handler from picking + calling `_onSearch` directly to:

```js
random.addEventListener('click', () => {
  const spots = SearchBar.FAMOUS_SPOTS;
  const spot = spots[Math.floor(Math.random() * spots.length)];
  if (!spot) return;
  if (typeof this._onRandom === 'function') {
    this._onRandom(spot);
  } else {
    this._onSearch(spot.lat, spot.lon, { name: spot.name });
  }
});
```

- [ ] **Step 3: Update `welcome.js` saved-place handler to pass name**

The saved-load button currently calls `this._onSearch(p.lat, p.lon)`. Change to `this._onSearch(p.lat, p.lon, { name: p.name })` so HUD shows the saved name.

- [ ] **Step 4: Update `main.js` `onSearch` signature + `goTo`**

`onSearch` is invoked as `onSearch(lat, lon, opts)`. Change the three wiring call sites and `goTo`:

```js
function goTo(lat, lon, opts = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  try { history.pushState(null, '', formatHash(lat, lon)); } catch { /* ignore */ }
  loadTerrain(lat, lon, opts);
}
```

Wire the Welcome with an `onRandom` callback:

```js
const welcome = new Welcome({
  container: el('welcome'),
  store,
  toasts,
  onSearch: (lat, lon, opts) => goTo(lat, lon, opts),
  onMyLocation: () => myLocation(),
  onRandom: (spot) => goTo(spot.lat, spot.lon, { name: spot.name, region: spot.region, toast: true }),
});
```

Update the `SearchBar` wiring too:

```js
onSearch: (lat, lon, opts) => goTo(lat, lon, opts),
```

- [ ] **Step 5: Update `main.js` `loadTerrain` to use the name + toast**

Change the signature and place construction:

```js
async function loadTerrain(lat, lon, opts = {}) {
  ...
  const place = {
    lat,
    lon,
    name: opts.name || data.location || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
  };
  ...
  welcome.dismiss();
  if (opts.toast) {
    const region = opts.region ? ` · ${opts.region}` : '';
    toasts.show(`🎲 ${place.name}${region} — ${lat.toFixed(4)}, ${lon.toFixed(4)}`, 'info', 4600);
  }
  ...
}
```

Remove the now-dead `boot()` else-branch comment block (it does nothing) and simplify:

```js
(async function boot() {
  const hash = parseHash(window.location.hash);
  if (hash) {
    const saved = loadLast();
    await loadTerrain(hash.lat, hash.lon, saved ? { name: saved.name } : {});
  }
})();
```

- [ ] **Step 6: Verify**

Run: `bun test` → all pass.
Run: `bun build public/js/main.js --target browser --external three --external 'three/*' --outdir /tmp/out` → bundles without error.

- [ ] **Step 7: Commit**

No git repo — report Task 2 complete with test output.

---

### Task 3: Scene background → ink-green

**Files:**
- Modify: `public/js/scene/renderer.js:63-65` and `:79`
- Modify: `public/js/scene/sky.js:4` and `:64`
- Test: `bun test` (unchanged, must stay green); `bun build` bundle check.

**Interfaces:**
- Consumes: nothing.
- Produces: scene/fog/background color `0x161d18` used for both the renderer scene and the day sky.

- [ ] **Step 1: Change renderer scene background + fog**

In `public/js/scene/renderer.js` `_init()`:

```js
this.scene.background = new THREE.Color(0x161d18);
this.scene.fog = new THREE.Fog(0x161d18, 200, 500);
```

And pass the fog color to the sky:

```js
this.sky = new Sky(this.scene, 0x161d18);
```

- [ ] **Step 2: Change sky.js day background to use its fogColor param**

In `public/js/scene/sky.js` line 64:

```js
this.scene.background.setHex(day > 0.9 ? fogColor : 0x0d0f12);
```

(`fogColor` is the existing constructor param defaulting to `0x1a1714`; the renderer now passes `0x161d18` explicitly.)

- [ ] **Step 3: Verify**

Run: `bun test` → all pass.
Run: `bun build public/js/main.js --target browser --external three --external 'three/*' --outdir /tmp/out` → bundles.

- [ ] **Step 4: Commit**

No git repo — report Task 3 complete.

---

### Task 4: Design tokens + theme-color + full stylesheet rewrite

**Files:**
- Modify: `public/css/style.css` (full rewrite)
- Modify: `public/index.html` (theme-color meta)
- Test: none automated; verified by `bun build` (CSS is static, referenced by index.html) and manual browser check.

**Interfaces:**
- Consumes: the token table in Global Constraints; all existing class names/id selectors from `search.js`, `panel.js`, `hud.js`, `tooltip.js`, `welcome.js`, `profile.js`, `povui.js`, `loading.js`, `toasts.js`, plus `#viewport`, `#topbar`, `#panel`, `#panel-toggle`, `#hud`, `#welcome`, `#loading`, `#profile-overlay`, `#pov-hud`, `#toast-root`, `.peak-tag-badge`, `.peak-text`.
- Produces: `:root` tokens (exact values from Global Constraints), `.welcome-chip-name`, `.welcome-chip-region` styles (name on top, region small under it), and all Expedition Cartograph styles.

- [ ] **Step 1: Update theme-color in `index.html`**

Change `<meta name="theme-color" content="#1a1714">` → `<meta name="theme-color" content="#22342a">`.

- [ ] **Step 2: Write the token block + base styles**

Rewrite `public/css/style.css`. Start with:

```css
:root {
  --paper: #e9dec4;
  --paper-light: #f6efda;
  --ink: #22342a;
  --ink-2: #1c2c23;
  --umber: #b85c2e;
  --umber-dark: #97471f;
  --ochre: #d8a24a;
  --teal: #3e6b5e;
  --text-soft: #5a4a38;
  --red: #a63b2c;
  --line: rgba(34, 52, 42, .35);
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --font-display: 'Fraunces', Georgia, serif;
  --topbar-h: 58px;
  --hud-h: 84px;
  --shadow-sm: 0 3px 12px rgba(30, 24, 14, .22);
  --shadow-lg: 0 16px 44px rgba(30, 24, 14, .38);
}
```

Set: `body { background: var(--paper); color: var(--ink); font-family: var(--font-sans); }`, keep `[hidden]`/`.hidden` display rules, `.icon` sizing, and the `.viewport` layer (background `#161d18`). Every component below uses these tokens; exact pixel values are at implementer discretion within the design language in the spec.

- [ ] **Step 3: Restyle every component (complete inventory)**

Write full CSS for each of these, using the design language from the spec (4-6px radii, crisp ink borders, umber buttons, teal active/is-on, Fraunces caps for titles, contour-ring welcome backdrop):

1. `.topbar` — solid `var(--ink)` background, paper text, bottom ink rule. `.brand-icon` umber; `.brand-name` Fraunces caps letter-spaced; `.panel-toggle` solid umber, paper text, radius 4px.
2. `.searchbar` / `.searchbar-icon` / `.searchbar-input` — paper-light pill (radius 999px for the input only is acceptable; keep it readable on ink), focus ring uses `--ochre`.
3. `.suggest-box` / `.suggest-row` / `.is-active` — paper-light card, ink border; active row ink text on ochre tint.
4. `.panel` / `.panel-title` / `.panel-section` / `.panel-section-title` / `.field` / `.field-row` / `.label` / `.val` / `.slider` (umber thumb on ink track) / `.switch` (ink track, teal when checked) / `.seg` / `.seg-btn` (`.is-on`/`.btn-on` = ink bg + paper text) / `.mode-btn` / `.legend` / `.stats` / `.stat` / `.warn` — paper-light card surfaces, ink text.
5. `.hud` — paper-light band, top ink rule. `.hud-name` ink; `.hud-coords` text-soft mono; `.hud-elev` umber mono; `.hud-data.is-cached` teal; `.is-live` umber; `.scale-bar` ink-track with umber inner; `.scale-label` text-soft mono; `.compass` paper circle w/ ink ring + umber needle; `.hud-btn` paper-light, ink border, ink-dim text, hover umber text; `.is-on` teal text + teal border; `.hud-warn` red-tinted.
6. `.tooltip` / `.tooltip-elev` / `.tooltip-coords` — ink bg, paper text, umber elev.
7. `.welcome` — `var(--paper)` backdrop with contour rings: `radial-gradient` circles like `radial-gradient(circle at 20% 30%, rgba(62,107,94,.14) 0 34px, transparent 35px)` layered over paper; `.welcome-card` paper-light, ink border, radius 14px, big shadow. `.welcome-title` Fraunces caps ink; `.welcome-tagline` text-soft; `.welcome-chip` ink-border, name (`.welcome-chip-name`) ink, region (`.welcome-chip-region`) text-soft small; `.welcome-random` solid umber; `.welcome-locate` ink outline; `.welcome-coord-input` paper-light ink border; `.welcome-coord-go` ink solid paper text; `.welcome-saved-*` paper surfaces.
8. `.loading` — paper-tinted backdrop; `.loading-card` paper-light ink border; `.spinner` ink border, umber top arc; `.loading-bar` umber; `.loading-text` text-soft mono.
9. `.profile-overlay` / `.profile-chart` (paper-light card) / `.profile-chart-head` / `.profile-close` (hover red) / `.profile-canvas` / `.profile-dot-a` (teal) / `.profile-dot-b` (umber).
10. `.pov-hud` / `.pov-reticle` (ink crosshair) / `.pov-hint` (ink pill, paper text) / `.pov-exit` (paper card, ink border, hover red) / `.pov-note` (red).
11. `.toast-root` / `.toast` (paper-light, ink border, left rule per kind: error `--red`, warn `--umber`, success `--teal`, info `--ochre`) / `.toast-dot`.
12. `.peak-tag-badge` / `.peak-text` — ink pill, paper text, umber mountain icon.
13. Responsive block (≤900px): panel drawer, HUD wrap, hidden brand name — same behavior as today, just the new palette.

- [ ] **Step 4: Verify**

Run: `bun test` → all pass (no JS changed in this task, but confirm nothing regressed).
Run: `bun build public/js/main.js --target browser --external three --external 'three/*' --outdir /tmp/out` → bundles.
Manual (best-effort in a browser): welcome overlay, topbar, HUD, panel, toasts, tooltip, loading card, profile chart card all show the paper/green/umber theme.

- [ ] **Step 5: Commit**

No git repo — report Task 4 complete.

---

### Task 5: Full QA pass

**Files:** none modified (verification only).

- [ ] **Step 1: Run the whole suite**

Run: `bun test`
Expected: 67 pass, 0 fail (63 + 4 new places tests).

- [ ] **Step 2: Bundle check**

Run: `bun build public/js/main.js --target browser --external three --external 'three/*' --outdir /tmp/out` → clean.

- [ ] **Step 3: Cross-check icons + IDs**

Run:
```bash
used=$(grep -rhoE 'icon-[a-z]+' public/js | sort -u)
defined=$(grep -oE 'id="icon-[a-z]+"' public/index.html | sed 's/id="//;s/"//' | sort -u)
comm -23 <(echo "$used") <(echo "$defined")
```
Expected: no missing symbols.

- [ ] **Step 4: Manual browser checklist (best-effort)**

1. Fresh load: welcome shows paper/green theme, contour backdrop, two-line chips with regions.
2. Click a chip → terrain loads, HUD shows the real spot name (not "Coordinates (…)").
3. Random landmark → loads and toasts `🎲 <name> · <region> — lat, lon`.
4. Search, my-location, saved place still work; saved place name shows in HUD.
5. All 5 view modes, water toggle, peak pin, hover tooltip, presets, POV, profile, screenshot, share, save, settings persistence — no regressions.
6. Panel toggle collapses the panel; responsive ≤900px still works.
7. theme-color in DevTools matches `#22342a`; terrain canvas reads deep ink-green against the paper chrome.

- [ ] **Step 5: Report**

No git repo — report QA results and any issues found.

---

## Self-Review

**Spec coverage:**
- Palette/tokens → Task 4 Step 2. ✓
- Per-component styling (topbar, HUD, panel, welcome, overlays, toasts, tooltip, profile, POV, peak badge, responsive) → Task 4 Step 3. ✓
- index.html theme-color → Task 4 Step 1. ✓
- renderer scene bg/fog + sky alignment → Task 3. ✓
- 20-spot dataset + regions → Task 1 Step 3. ✓
- Two-line chips with region → Task 2 Step 1. ✓
- Random landmark location toast → Task 2 Steps 2-5. ✓
- HUD real name (not "Coordinates (…)") → Task 2 Steps 4-5 (name threading). ✓
- `tests/places.test.js` ≥18 unique, coords valid, region present, legacy preserved → Task 1 Step 1. ✓
- No backend changes, no SearchBar API shape change → Global Constraints + Task boundaries. ✓

**Placeholder scan:** No TBD/TODO; every code step contains concrete code or an exact value. Token values are verbatim from the spec.

**Type consistency:** `onSearch(lat, lon, opts)` signature is uniform across welcome chips, saved loads, random fallback, and main.js wiring. `onRandom(spot)` produced in Task 2 Step 2 and consumed in Task 2 Step 4 match. `goTo(lat, lon, opts)` / `loadTerrain(lat, lon, opts)` consistent between Task 2 Steps 4-5. `fogColor` param exists in sky.js before Task 3 modifies it.
