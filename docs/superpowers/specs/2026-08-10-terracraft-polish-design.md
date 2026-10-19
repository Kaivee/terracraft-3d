# TerraCraft 3D — Polished Edition (Design)

Date: 2026-08-10
Status: Approved by user

## Goal

Harden the backend, fix frontend bugs/performance/memory issues, and modernize the UI into a
tactical-dark HUD aesthetic appropriate for a geospatial terrain tool — without adding any new
npm dependencies.

## 1. Visual direction

- Base: deep slate `#0F172A` with green-tinted dark surfaces; glassmorphism panels.
- Accent: run-green `#22C55E` (primary), amber `#c4922a` (secondary/cached), orange `#d4812a` (warm).
- Typography: Orbitron (brand/mode/HUD labels) + JetBrains Mono (data) + Inter (body),
  loaded via non-blocking `<link>` with preconnect (no `@import`).
- All emoji icons replaced with inline SVG (`<svg><use href="#sym-...">` sprite).
- Welcome screen: animated wireframe-mountain SVG background + gradient + staggered fade-in.
- New: elevation color legend (bottom-right), progress-bar loading overlay, favicon
  (inline SVG data URI), `theme-color` meta, `prefers-reduced-motion` support, visible
  keyboard focus states.

## 2. Backend (zero new deps)

- `services/nominatimClient.js`: shared client with 1 req/s throttle, retry (2x with backoff),
  timeout via `AbortController`, constant User-Agent.
- `services/tileDownloader.js`: fetch timeout, retry w/ backoff, concurrency limit (3),
  warn + zero-fill fallback retained (documented limitation).
- `services/waterDetect.js`: extract `analyzeWater` from route.
- `services/terrainCache.js`: add `has_water` + `auto_water_level` columns; persist/read them so
  the 62k-cell scan happens only on first fetch.
- `db.js`: idempotent `initDatabase` (reuse rootPool only when needed), pool `error` handler,
  `closeDatabase()` for graceful shutdown.
- `server.js`: global error middleware, API 404 (JSON, not SPA fallback), graceful shutdown
  on SIGINT/SIGTERM, lightweight request logger, query length limits, reduced JSON limit,
  mount tiny in-memory rate limiter.
- `middleware/rateLimit.js`: fixed-window in-memory limiter (no deps).
- `routes/terrain.js`: use new services, validate/trim inputs, cap query length.

## 3. Frontend code

- `app.js`: fix XSS in autocomplete (DOM building, no `innerHTML` with API data); `AbortController`
  + response sequencing (ignore stale results); persist last location + settings in localStorage;
  update legend from response min/max.
- `controls.js`: debounce expensive rerenders (~150ms); central `DEFAULTS` object used by `reset()`;
  guard water state helpers.
- `voxelRenderer.js`: reuse `THREE.Color` scratch instances (kill per-column allocation);
  dispose peak-pin group, water material, instanced colors; fix `_sunEl` default mismatch (48→45);
  keep export behavior.

## 4. Verification

- Add dependency-free tests under `tests/` using `node --test` for pure utils
  (elevation decode, tile coordinate math, water detection, rate limiter).
- Add `npm test` script and `engines.node >= 18`.
- Node is not available in this sandbox; user verifies with `npm start` + `npm test` locally.

## Non-goals

- No new external dependencies.
- No change to the DEM/tile data sources or the 3D rendering technique.
- No auth/user system.
