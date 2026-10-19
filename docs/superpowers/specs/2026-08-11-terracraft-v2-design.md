# TerraCraft 3D — v2 "Field Station" (Design)

Date: 2026-08-11
Status: Approved by user

Note (2026-10-19): The backend has since been ported from Node/Express to plain
Java (no build tool) under `src/terracraft/`. The HTTP API, SQLite terrain cache,
DEM tile pipeline, Nominatim client and rate limits are unchanged. The frontend
(`public/`) remains JavaScript. Build/run/test with `build.bat`, `run.bat`,
`test.bat`. References below to `server.js`, `routes/`, `services/` and
`middleware/` are historical.

## Goal

Rebuild the frontend from scratch into a well-organized ES-module app with a new
"Field Station" layout, add a first-person walk (POV) mode, fix known bugs, and add
new geospatial features. The backend (Express API, SQLite terrain cache, DEM tile
pipeline, Nominatim client, rate limits) stays unchanged.

## 1. Architecture

Zero build step. Frontend reorganized under `public/js/` as ES modules:

```
public/js/
  main.js                 bootstrap + wiring
  core/store.js           tiny pub/sub state store (location, settings, unit, view mode)
  core/settings.js        localStorage load/save, DEFAULTS, migration
  core/units.js           m <-> ft conversion + formatting helpers (pure)
  core/api.js             fetch wrappers for /api/search, /api/coords, /api/suggest
  core/share.js           URL hash read/write (#lat,lon), copy-link (pure-ish)
  core/geolocation.js     browser geolocation -> coords
  core/terrainMath.js     pure matrix helpers: bilinear sample, profile path,
                          stats (mean, footprint, prominence) — used by POV, tooltip, profile
  scene/renderer.js       Three.js orchestrator (camera rigs, lights, sky, resize, loop)
  scene/terrain.js        builds all 5 view modes from the height matrix
  scene/water.js          volumetric water layer
  scene/markers.js        center marker, top-peak pins + labels
  scene/pov.js            first-person walk camera
  scene/export.js         OBJ/STL exporters (refactored from v1)
  ui/search.js            search input + autocomplete (local + live) + keyboard
  ui/panel.js             "Terrain Lab" control panel
  ui/hud.js               status bar, compass, scale bar, unit toggle, coords copy
  ui/tooltip.js           hover raycast -> elevation chip at cursor
  ui/toasts.js            toast notifications
  ui/welcome.js           welcome screen, example chips, random landmark, resume
  ui/loading.js           staged loading overlay (real progress)
  ui/povui.js             POV HUD (crosshair, WASD hint, enter/exit)
public/css/style.css      full rewrite ("Field Station" theme)
public/index.html         full rewrite (same icon sprite, imports)
```

Pure logic lives in `core/` modules (units, share, settings) so it is unit-testable
with `node:test` without a DOM.

## 2. Visual identity — "Field Station"

- Keeps the approved warm-earth palette: warm charcoal `#171412`, surfaces
  `#211d1a`/`#2b2622`, sand accent `#d9a05b`, moss `#7a8b4f`, warm off-white text.
- Fonts: Fraunces (display) + Inter (UI) + JetBrains Mono (data), via Google Fonts `<link>`.
- Layout (all elements as HUD overlays on the 3D canvas):
  - Top bar: brand, search, quick actions (my-location, share, unit toggle, help).
  - Left edge: vertical segmented view-mode control (always visible).
  - Right edge: collapsible "Terrain Lab" panel for sliders/toggles.
  - Bottom center: status bar (coords, elevation, source) + scale bar + compass.
  - Bottom right: legend, camera-preset buttons (Top / Iso / Walk / Home), auto-rotate.
- Grounded solid surfaces, subtle borders, no glassmorphism, no glow, soft shadows.
- Accessibility: visible focus rings, `prefers-reduced-motion`, aria labels, SVG icons only.

## 3. Core pipeline (reused & refactored)

- Search flows: text -> `/api/search?q=`, coords -> `/api/coords?lat&lon`,
  suggestions -> `/api/suggest?q=` (debounced, abortable).
- Response: `{location, lat, lon, minElev, maxElev, hasWater, autoWaterLevel,
  heightMatrix, cached}` drives the whole UI.
- View modes (voxel, topographic, heatmap, satellite, military): color/geometry logic
  preserved from v1, moved into `scene/terrain.js`.
- Water detection + volumetric layer kept. Bug fix: water on/off state now persisted
  (was silently lost on reload while other settings persisted).
- Highest-peak beacon kept; extended to top-N peak pins (new).

## 4. HUD & interaction improvements

1. **Hover elevation tooltip** — raycaster on pointermove over the terrain; chip shows
   elevation + local coords near cursor; hides over sky/water surfaces.
2. **Camera presets** — Top-down, Isometric, Reset-to-home. Smooth tween between them.
3. **Auto-rotate** — turntable toggle (slow yaw of the terrain group / camera orbit).
4. **Unit toggle (m/ft)** — applies to tooltip, status bar, peak badges, legend.
5. **Compass** — N arrow that rotates with camera yaw.
6. **Scale bar** — meters across view center, updates with zoom.
7. **Coords click-to-copy** — clicking coords copies to clipboard + toast confirm.
8. **Share/deep-link** — `#lat,lon` in URL read on load and written on search;
   "copy link" copies current state. Deep-link wins over resume-last.
9. **My location** — browser geolocation button -> coords search.
10. **Random landmark** — welcome-screen button picks a random famous spot.
11. **Saved places** — named bookmarks in localStorage; list + jump-back UI.
12. **Real loading stages** — overlay advances on actual fetch/build events, not a timer.
13. **Tile-failure visibility** — backend reports a failed-tile count; frontend shows a
    warning toast ("N elevation tile(s) failed to load — those areas may appear flat")
    instead of silently rendering flat ocean. No zone tint (downsample mapping is fuzzy).
14. **Mobile** — Terrain Lab becomes a bottom drawer; touch orbit preserved; POV disabled
    on small touch screens.

## 5. POV walk mode (headline)

- Enter via Walk preset button or `P` key. Pointer-lock mouse look (pitch clamped).
- WASD movement; player height = bilinear-sampled terrain elevation + eye height.
- Simple slope/edge collision (refuse moves into cells steeper than a threshold).
- Space = jump (simple gravity), Shift = sprint.
- HUD: crosshair + "WASD move · mouse look · Esc to exit".
- Esc exits POV and restores the previous orbit camera. Cached camera state on entry.
- Implementation detail: `scene/pov.js` samples the same height matrix used to build
  terrain so the walker tracks the surface exactly in every view mode.

## 6. New features (entirely new)

- **Elevation profile** — click two points: a line is drawn on the terrain and a 2D
  cross-section chart (Canvas overlay) shows elevation along the line.
- **Day/night sky** — sun-elevation slider drives a gradient sky + light tint
  (reuses existing sun azimuth/elevation controls; adds a sky dome + horizon glow).
- **Screenshot export** — one-click PNG download of the rendered canvas.
- **Terrain stats strip** — footprint (km²), mean elevation, peak prominence (pure
  math on the matrix; unit-tested).

## 7. Backend changes (minimal)

- `routes/terrain.js`: include a `failedTileCount` in the response when the tile
  downloader degraded (zero-filled tiles), so the frontend can warn the user.
- `services/tileDownloader.js`: on partial failure, attempt one lower-zoom fallback for
  failed tiles before zero-filling, and return how many tiles ultimately failed.
- No schema changes, no new dependencies.

## 8. Error handling & accessibility

- Fetch abort handling preserved; validation for coords ranges; toast for all failures.
- Focus rings, `prefers-reduced-motion` (already present), SVG icons only, aria labels
  on icon-only buttons, keyboard navigation for mode switcher and autocomplete.

## 9. Testing

- Unit tests (`node:test`): `units` (m/ft), `share` (URL hash parse/format),
  `settings` (merge + migration), `terrainMath` (bilinear sampling, stats, profile),
  water detect (existing), tile math (existing).
- Manual QA checklist: all 5 view modes render, water persists across reload,
  share-link round trip, POV walk on a hill + lake location, export still works.

## 10. Out of scope

- Backend rewrite, schema changes, new npm dependencies, real-time multiplayer,
  terrain editing, mobile POV controls (desktop-only).
