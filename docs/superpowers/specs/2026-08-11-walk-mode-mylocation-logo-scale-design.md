# Walk Mode, Spawn Picking, My Location Name, Logo Home, Scale Bar — Design

**Goal:** Make walking third-person with click-to-choose spawn, show a real place name for My Location, let the logo return to home, and make the HUD scale bar visible + functional. No changes to terrain rendering, DEM, or search.

**Architecture:** Frontend-heavy with one small backend addition (Nominatim reverse geocode). `pov.js` is rewritten from first-person to third-person (camera follows a voxel character). `renderer.js` gains a two-phase Walk flow: pick-spawn, then enter POV. `main.js` wires My Location → reverse-geocoded name, and logo → welcome re-show. `hud.js` fixes the clipped scale label and makes it a unit toggle.

---

## Feature 1 — Third-person walking (`public/js/scene/pov.js`)

- Add pure exported helper `thirdPersonCamTarget(pos, yaw, camHeight, dist, groundAt)`:
  - Behind the player = `(sin yaw, cos yaw)`; `camX = pos.x + sin(yaw)*dist`, `camZ = pos.z + cos(yaw)*dist`.
  - `camY = max(pos.y + camHeight, groundAt(camX, camZ) + 0.5)` so the camera never goes underground.
  - Returns `{ x, y, z }`.
- `POVController` constructor gains a `scene` parameter (for the character). Constants `CAM_DIST = 7.5`, `CAM_HEIGHT = 4.2`.
- `setSpawn(wx, wz)` replaces `_initialPos()` center-only behavior; spawn height = `sampleWorldHeight(wx, wz) + EYE`.
- `buildPlayer()`: `THREE.Group` of boxes (all `castShadow`): torso `0.9×1.1×0.5` @y1.15 teal `#3e6b5e`, head `0.6³` @y2.05 paper `#e9dec4`, legs `0.28×0.9×0.28` @x±0.22 ink `#22342a`, arms `0.24×0.9×0.24` @x±0.6 ink. Group origin at feet.
- `update(dt)`: movement/gravity/jump math unchanged (pos.y = eye height = ground + EYE).
  - `playerGroup.position.set(pos.x, pos.y - EYE, pos.z)`.
  - Character faces travel direction while moving: `rotation.y = atan2(dx, dz)`; when idle faces `yaw + π`.
  - Camera: eased follow `this.camPos.lerp(target, min(1, dt*8))`; `camera.lookAt(pos.x, pos.y, pos.z)`.
  - Pitch slightly raises/lowers the camera: `camHeight = CAM_HEIGHT + pitch * 2.2`, pitch clamp `[-1.0, 0.6]`.
- Exit/listener behavior unchanged (pointer-lock driven).

`public/js/ui/povui.js`:
- Remove the reticle element (no longer needed in third-person); update hint to `'Click to look · WASD move · Space jump · Shift sprint · Esc exit'`.

## Feature 2 — Choose spawn point (`public/js/scene/renderer.js`)

- `startPOV()` becomes a state machine:
  - No grid loaded → return.
  - Already picking → cancel pick (cleanup, return).
  - Already in active POV → `stopPOV()`.
  - Otherwise enter pick mode: `this._pickSpawn = true`, add `.picking` class to container, add one-shot click listener.
- `_onSpawnPick(e)`: `hit = pickTerrain(e.clientX, e.clientY)`; no hit → keep picking. Otherwise clear pick mode (remove listener, remove `.picking`), then `_enterWalk(hit.x - halfG, hit.z - halfG)`.
- `_enterWalk(wx, wz)`: build `POVController` with `{ camera, domElement, scene, sampleWorldHeight, onExit: () => this.stopPOV() }`, `setBounds(halfG)`, `setSpawn(wx, wz)`, `controls.enabled = false`, `pov.enter()`.
- `stopPOV()` also clears any active pick mode and the `.picking` class. Add `isPicking()`.

## Feature 3 — My Location real name

`services/nominatimClient.js`:
- Add `shortenName(displayName, parts = 3)`: take first `parts` comma-separated segments, trim, join with `, `. Empty → `''`.
- Add `reverseGeocode(lat, lon)`: fetch `https://nominatim.openstreetmap.org/reverse` with `format=jsonv2&lat&lon&zoom=16&accept-language=en`, through the existing throttle+retry queue. Returns `{ name: shortenName(display_name) }` or `null` if no `display_name`. Throws on network/HTTP error.
- Export both.

`routes/terrain.js`:
- `GET /api/reverse?lat=&lon=`: validate coords (400 on bad), `reverseGeocode` → `res.json({ name })`; on error → 502 with `{ error: 'Reverse geocoding failed' }`.

`public/js/core/api.js`:
- Add `reverseGeocode(lat, lon)` → `request('/api/reverse?...')`, returns `{ name }` (or throws).

`public/js/main.js`:
- `myLocation()`: after `getCurrentPosition()`, best-effort `reverseGeocode(lat, lon)` for a name; `goTo(lat, lon, name ? { name } : {})`. No hardcoded `'My location'`.
- Geolocation failure toast includes a hint to use `http://localhost:3000` (browsers block geolocation on LAN-IP origins).

## Feature 4 — Logo returns home

`public/index.html`: give `.brand` `id="brand"`, `role="button"`, `tabindex="0"`, `title="Back to home"`.
`public/css/style.css`: `.brand { cursor: pointer; }`.
`public/js/ui/welcome.js`: add `show()` — reset `_dismissed`, remove `hidden`/`dismissing`, re-run `_buildSaved()`.
`public/js/main.js`: click + Enter/Space on brand → `welcome.show()`. Existing terrain stays rendered behind the welcome card.

## Feature 5 — Scale bar visible + functional

`public/js/ui/hud.js`:
- Append `scaleLabel` to `scaleWrap` (outside the 8px `.scale-bar`), so the label is no longer clipped.
- Export `pickScaleDistance`.
- Make `scaleWrap` a button-like element: click toggles `m`/`ft` via existing `_onUnit`; `title="Click to switch units"`.

`public/css/style.css`: `.hud-scale { cursor: pointer; }`.

## Testing

- `tests/pov.test.js` (bun): `thirdPersonCamTarget` is behind the player and clamps above ground.
- `tests/scale.test.js` (bun): `pickScaleDistance` returns the largest nice round value ≤ target for both m and ft lists.
- `tests/reverseGeocode.test.js` (bun): `shortenName` truncates to 3 segments, trims whitespace, returns `''` for empty.
- Existing 67 tests stay green; `bun build public/js/main.js --target browser --external three --external 'three/*'` bundles clean.
- Manual browser QA (localhost, not LAN IP): walk + spawn pick, third-person camera, My Location name on the bottom bar, logo→home, scale bar label + unit toggle.
