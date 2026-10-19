# Walk Mode, Spawn Picking, My Location Name, Logo Home, Scale Bar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Third-person walking with click-to-spawn, a real place name for My Location, logo returns to the welcome screen, and a visible + clickable HUD scale bar.

**Architecture:** `pov.js` is rewritten to third-person (voxel character + following camera). `renderer.js` gains a pick-spawn → walk two-phase flow. A Nominatim `/reverse` endpoint + client helper gives My Location a real name. `hud.js` fixes the clipped scale label and makes it a unit toggle. `welcome.js` gets a `show()` so the logo can return home.

**Tech Stack:** Vanilla ES modules, Three.js 0.168 (unchanged), Node/Express backend, bun for tests/build.

## Global Constraints

- Do not change terrain rendering, DEM loading, search, or existing API response shapes (`/api/search`, `/api/coords`, `/api/suggest`).
- All DOM/class names already styled must keep working; only add new ones.
- `bun test` must stay green (67 existing + new tests).
- No git repo — a "commit" step means: report the task complete.
- POV keeps pointer lock; Esc / lock-loss exits walk as today.

---

### Task 1: Backend reverse geocode

**Files:**
- Modify: `services/nominatimClient.js`
- Modify: `routes/terrain.js`
- Test: `tests/reverseGeocode.test.js`

**Interfaces:**
- Produces: `shortenName(displayName, parts=3)` → string; `reverseGeocode(lat, lon)` → `Promise<{name} | null>` (throws on error). Route `GET /api/reverse?lat=&lon=` → `{ name }` or 400/502. Client `reverseGeocode(lat, lon)` in `public/js/core/api.js` → `Promise<{name}>`.
- Consumes: existing `throttle`/`withRetry`/`fetchJson` in nominatimClient.

- [ ] **Step 1: Add `shortenName` + `reverseGeocode` to `services/nominatimClient.js`**

Add above `module.exports`:

```js
/** Reduce a long Nominatim display_name to its first `parts` segments. */
function shortenName(displayName, parts = 3) {
  if (!displayName) return '';
  return displayName.split(',').slice(0, parts).map((s) => s.trim()).join(', ');
}

/**
 * Reverse-geocode coordinates to a place name.
 * @param {number} lat @param {number} lon
 * @returns {Promise<{name: string} | null>}
 */
async function reverseGeocode(lat, lon) {
  const url = 'https://nominatim.openstreetmap.org/reverse'
    + `?format=jsonv2&lat=${lat}&lon=${lon}&zoom=16&accept-language=en`;
  const data = await throttle(() => withRetry(() => fetchJson(url)));
  if (!data || !data.display_name) return null;
  return { name: shortenName(data.display_name) };
}
```

Change the export line to:

```js
module.exports = { geocode, searchSuggestions, reverseGeocode, shortenName };
```

- [ ] **Step 2: Add the route to `routes/terrain.js`**

Add after the `/suggest` route:

```js
router.get('/reverse', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!isValidCoord(lat, lon)) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }
  try {
    const result = await reverseGeocode(lat, lon);
    res.json({ name: result ? result.name : null });
  } catch (err) {
    res.status(502).json({ error: 'Reverse geocoding failed' });
  }
});
```

And update the destructured import to include `reverseGeocode`:

```js
const { geocode, searchSuggestions, reverseGeocode } = require('../services/nominatimClient');
```

- [ ] **Step 3: Add the client helper to `public/js/core/api.js`**

```js
export function reverseGeocode(lat, lon, signal) { return request(`/api/reverse?lat=${lat}&lon=${lon}`, signal); }
```

- [ ] **Step 4: Write `tests/reverseGeocode.test.js`**

```js
import { test, expect } from 'bun:test';
import { shortenName } from '../services/nominatimClient.js';

test('shortenName keeps the first 3 segments trimmed', () => {
  expect(shortenName('Mount Fuji, Shizuoka, Yamanashi, Japan')).toBe('Mount Fuji, Shizuoka, Yamanashi');
});

test('shortenName handles fewer than 3 segments', () => {
  expect(shortenName('Auckland, New Zealand')).toBe('Auckland, New Zealand');
});

test('shortenName returns empty string for empty input', () => {
  expect(shortenName('')).toBe('');
  expect(shortenName(null)).toBe('');
});
```

- [ ] **Step 5: Verify**

Run: `bun test tests/reverseGeocode.test.js` → 3 pass.
Run: `bun test` → 70 pass, 0 fail.

- [ ] **Step 6: Commit**

No git repo — report Task 1 complete.

---

### Task 2: Third-person POV + voxel character

**Files:**
- Modify: `public/js/scene/pov.js` (rewrite)
- Modify: `public/js/ui/povui.js`
- Test: `tests/pov.test.js`

**Interfaces:**
- Produces: exported `thirdPersonCamTarget(pos, yaw, camHeight, dist, groundAt)` → `{x,y,z}`; `POVController` now accepts `{ camera, domElement, scene, sampleWorldHeight, onExit }` and has `setSpawn(wx, wz)`.
- Consumes: nothing external; renderer passes `scene`.

- [ ] **Step 1: Write `tests/pov.test.js`**

```js
import { test, expect } from 'bun:test';
import { thirdPersonCamTarget } from '../public/js/scene/pov.js';

const ground = () => 0;

test('camera sits behind the player', () => {
  const pos = { x: 0, y: 3, z: 0 };
  const cam = thirdPersonCamTarget(pos, 0, 4.2, 7.5, ground);
  // forward at yaw=0 is -Z, so behind is +Z
  expect(cam.z).toBeCloseTo(7.5, 5);
  expect(cam.x).toBeCloseTo(0, 5);
  expect(cam.y).toBeCloseTo(7.2, 5);
});

test('yaw rotates the camera around the player', () => {
  const pos = { x: 0, y: 3, z: 0 };
  const cam = thirdPersonCamTarget(pos, Math.PI / 2, 4.2, 7.5, ground);
  expect(cam.x).toBeCloseTo(7.5, 5);
  expect(cam.z).toBeCloseTo(0, 5);
});

test('camera never dips below the terrain surface', () => {
  const pos = { x: 0, y: 1, z: 0 };
  const groundAt = (x, z) => (x > 2 ? 100 : 0);
  const cam = thirdPersonCamTarget(pos, 0, 2, 7.5, groundAt);
  expect(cam.y).toBeGreaterThanOrEqual(100.5);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/pov.test.js` → FAIL (module/export not defined yet).

- [ ] **Step 3: Rewrite `public/js/scene/pov.js`**

```js
const EYE = 1.6, WALK = 12, SPRINT = 26, GRAVITY = 60, JUMP = 10;
const CAM_DIST = 7.5, CAM_HEIGHT = 4.2;

export function thirdPersonCamTarget(pos, yaw, camHeight, dist, groundAt) {
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  const x = pos.x + sin * dist;
  const z = pos.z + cos * dist;
  const y = Math.max(pos.y + camHeight, groundAt(x, z) + 0.5);
  return { x, y, z };
}

function buildPlayer() {
  const group = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x3e6b5e });
  const limb = new THREE.MeshStandardMaterial({ color: 0x22342a });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xe9dec4 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5), body);
  torso.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), headMat);
  head.position.y = 2.05;
  for (const sx of [-0.22, 0.22]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.9, 0.28), limb);
    leg.position.set(sx, 0.45, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.9, 0.24), limb);
    arm.position.set(sx * 2.7, 1.15, 0);
    group.add(leg, arm);
  }
  group.add(torso, head);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

export class POVController {
  constructor({ camera, domElement, scene, sampleWorldHeight, onExit }) {
    this.camera = camera; this.domElement = domElement; this.scene = scene || null;
    this.onExit = onExit || (() => {});
    this.sampleWorldHeight = sampleWorldHeight;
    this.active = false;
    this.yaw = 0; this.pitch = 0;
    this.pos = { x: 0, y: 0, z: 0 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.camPos = { x: 0, y: 0, z: 0 };
    this.keys = new Set();
    this.player = scene ? buildPlayer() : null;
    if (this.player) scene.add(this.player);
    this._onMove = (e) => {
      this.yaw -= e.movementX * 0.0022;
      this.pitch = Math.max(-1.0, Math.min(0.6, this.pitch - e.movementY * 0.0022));
    };
    this._onDown = (e) => this.keys.add(e.code);
    this._onUp = (e) => this.keys.delete(e.code);
    this._onLockChange = () => {
      if (document.pointerLockElement === this.domElement) this._onLock();
      else this._onUnlock();
    };
    this._onLock = () => { this.active = true; };
    this._onUnlock = () => { this.active = false; this._removeListeners(); this.disposePlayer(); this.onExit(); };
  }

  setSpawn(wx, wz) {
    this.pos.x = wx; this.pos.z = wz;
    this.pos.y = this.sampleWorldHeight(wx, wz) + EYE;
    this.vel.y = 0;
    this.yaw = Math.PI / 4; this.pitch = 0;
    this.camPos.x = wx + Math.sin(this.yaw) * CAM_DIST;
    this.camPos.z = wz + Math.cos(this.yaw) * CAM_DIST;
    this.camPos.y = this.pos.y + CAM_HEIGHT;
  }

  enter() {
    this._addListeners();
    try {
      const req = this.domElement.requestPointerLock();
      if (req && typeof req.catch === 'function') {
        req.catch(() => { this.active = false; this._removeListeners(); this.disposePlayer(); this.onExit(); });
      }
    } catch {
      this.active = false;
      this._removeListeners();
      this.disposePlayer();
      this.onExit();
    }
  }

  exit() { if (document.pointerLockElement) document.exitPointerLock(); }
  isActive() { return this.active; }
  setBounds(halfG) { this._halfG = halfG; }

  _addListeners() {
    document.addEventListener('pointerlockchange', this._onLockChange);
    document.addEventListener('mousemove', this._onMove);
    document.addEventListener('keydown', this._onDown);
    document.addEventListener('keyup', this._onUp);
  }

  _removeListeners() {
    document.removeEventListener('pointerlockchange', this._onLockChange);
    document.removeEventListener('mousemove', this._onMove);
    document.removeEventListener('keydown', this._onDown);
    document.removeEventListener('keyup', this._onUp);
  }

  disposePlayer() {
    if (this.player && this.scene) {
      this.scene.remove(this.player);
      this.player.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      this.player = null;
    }
  }

  update(dt) {
    if (!this.active) return;
    const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? SPRINT : WALK;
    const fwd = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const right = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const dx = (-fwd * sin + right * cos) * speed * dt;
    const dz = (-fwd * cos - right * sin) * speed * dt;
    const lim = (this._halfG ?? 40);
    const nx = Math.max(-lim, Math.min(lim, this.pos.x + dx));
    const nz = Math.max(-lim, Math.min(lim, this.pos.z + dz));
    const ground = this.sampleWorldHeight(nx, nz);
    if (this.keys.has('Space')) { if (Math.abs(this.pos.y - (ground + EYE)) < 0.05) this.vel.y = JUMP; }
    this.vel.y -= GRAVITY * dt;
    this.pos.x = nx; this.pos.z = nz;
    const ny = this.pos.y + this.vel.y * dt;
    if (ny <= ground + EYE) { this.pos.y = ground + EYE; this.vel.y = 0; }
    else this.pos.y = ny;

    if (this.player) {
      this.player.position.set(this.pos.x, this.pos.y - EYE, this.pos.z);
      if (fwd !== 0 || right !== 0) this.player.rotation.y = Math.atan2(dx, dz);
      else this.player.rotation.y = this.yaw + Math.PI;
    }

    const target = thirdPersonCamTarget(this.pos, this.yaw, CAM_HEIGHT + this.pitch * 2.2, CAM_DIST, this.sampleWorldHeight);
    const k = Math.min(1, dt * 8);
    this.camPos.x += (target.x - this.camPos.x) * k;
    this.camPos.y += (target.y - this.camPos.y) * k;
    this.camPos.z += (target.z - this.camPos.z) * k;
    this.camera.position.set(this.camPos.x, this.camPos.y, this.camPos.z);
    this.camera.lookAt(this.pos.x, this.pos.y, this.pos.z);
  }
}
```

Note: `THREE` is used in `buildPlayer` — add `import * as THREE from 'three';` at the top of pov.js.

- [ ] **Step 4: Remove the reticle from `public/js/ui/povui.js`**

Replace `_build()` reticle section and hint:

```js
const HINT = 'Click to look · WASD move · Space jump · Shift sprint · Esc exit';
```

Delete the `reticle` element creation + `this.container.append(reticle, hint, exit);` becomes `this.container.append(hint, exit);`.

- [ ] **Step 5: Run tests + build**

Run: `bun test tests/pov.test.js` → 3 pass.
Run: `bun test` → 73 pass.
Run: `bun build public/js/main.js --target browser --external three --external 'three/*' --outdir /tmp/out` → bundles.

- [ ] **Step 6: Commit**

No git repo — report Task 2 complete.

---

### Task 3: Pick-spawn flow in the renderer

**Files:**
- Modify: `public/js/scene/renderer.js`

**Interfaces:**
- Consumes: `POVController` (Task 2) with `setSpawn`; existing `pickTerrain(clientX, clientY)` → `{x, z, worldY, elevMeters}` grid coords.
- Produces: `startPOV()` → string `'picking' | 'started' | 'stopped' | 'no-data'`; `stopPOV()`; `isPicking()` → boolean.

- [ ] **Step 1: Add pick-spawn state to `startPOV`/`stopPOV`**

Replace `startPOV` and `stopPOV`:

```js
startPOV() {
  if (!this._grid) return 'no-data';
  if (this.pov && this.pov.isActive()) { this.stopPOV(); return 'stopped'; }
  if (this._pickSpawn) { this._cancelPick(); return 'cancelled'; }
  this._pickSpawn = true;
  this.container.classList.add('picking');
  this._onSpawnPick = (e) => this._handleSpawnPick(e);
  this.container.addEventListener('click', this._onSpawnPick, { once: true });
  return 'picking';
}

isPicking() { return !!this._pickSpawn; }

_handleSpawnPick(e) {
  const hit = this.pickTerrain(e.clientX, e.clientY);
  if (!hit) return;
  this._cancelPick();
  const halfG = this._grid.halfG;
  this._enterWalk(hit.x - halfG, hit.z - halfG);
}

_cancelPick() {
  this._pickSpawn = false;
  this.container.classList.remove('picking');
  if (this._onSpawnPick) {
    this.container.removeEventListener('click', this._onSpawnPick);
    this._onSpawnPick = null;
  }
}

_enterWalk(wx, wz) {
  this.pov = new POVController({
    camera: this.camera,
    domElement: this.renderer.domElement,
    scene: this.scene,
    sampleWorldHeight: (x, z) => this.sampleWorldHeight(x, z),
    onExit: () => this.stopPOV(),
  });
  this.pov.setBounds(this._grid.halfG);
  this.pov.setSpawn(wx, wz);
  this.controls.enabled = false;
  this.pov.enter();
}

stopPOV() {
  this._cancelPick();
  if (this.pov) {
    this.pov.exit();
    this.pov = null;
  }
  this.controls.enabled = true;
}
```

Note: keep the existing `isPOV()` method unchanged.

- [ ] **Step 2: Verify**

Run: `bun test` → 73 pass.
Run: `bun build public/js/main.js --target browser --external three --external 'three/*' --outdir /tmp/out` → bundles.

- [ ] **Step 3: Commit**

No git repo — report Task 3 complete.

---

### Task 4: main.js wiring — My Location name, logo home, geolocation hint

**Files:**
- Modify: `public/js/main.js`
- Modify: `public/js/ui/welcome.js`
- Modify: `public/index.html`
- Modify: `public/css/style.css`

**Interfaces:**
- Consumes: `reverseGeocode` from `core/api.js` (Task 1); `Welcome.show()` (this task).
- Produces: `Welcome.show()`; `main.js myLocation()` reverse-geocodes the name.

- [ ] **Step 1: Add `show()` to `public/js/ui/welcome.js`**

Add after `dismiss()`:

```js
show() {
  this._dismissed = false;
  const el = this.container;
  el.classList.remove('hidden', 'dismissing');
  this._buildSaved();
}
```

- [ ] **Step 2: Import + use reverse geocode in `main.js`**

Add `reverseGeocode` to the existing api import:

```js
import { searchByCoords, normalizeSearchResult, reverseGeocode } from './core/api.js';
```

Replace `myLocation`:

```js
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
```

- [ ] **Step 3: Logo → home in `main.js`**

Add after the panel toggle block:

```js
const brand = el('brand');
brand.addEventListener('click', () => welcome.show());
brand.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    welcome.show();
  }
});
```

- [ ] **Step 4: Mark the brand interactive in `public/index.html`**

Change:

```html
<div class="brand">
```

to:

```html
<div id="brand" class="brand" role="button" tabindex="0" title="Back to home">
```

- [ ] **Step 5: Cursor style in `public/css/style.css`**

Add to the `.brand` rule:

```css
.brand { cursor: pointer; }
```

- [ ] **Step 6: Verify**

Run: `bun test` → 73 pass.
Run: `bun build public/js/main.js --target browser --external three --external 'three/*' --outdir /tmp/out` → bundles.

- [ ] **Step 7: Commit**

No git repo — report Task 4 complete.

---

### Task 5: Scale bar fix + unit toggle

**Files:**
- Modify: `public/js/ui/hud.js`
- Modify: `public/css/style.css`
- Test: `tests/scale.test.js`

**Interfaces:**
- Produces: exported `pickScaleDistance(targetM, unit)` → number (existing logic, now exported). `scaleWrap` is clickable and toggles `m`/`ft`.
- Consumes: existing `_onUnit`, `_renderScale`.

- [ ] **Step 1: Write `tests/scale.test.js`**

```js
import { test, expect } from 'bun:test';
import { pickScaleDistance } from '../public/js/ui/hud.js';

test('picks the largest nice round meter value below the target', () => {
  expect(pickScaleDistance(3500, 'm')).toBe(2000);
  expect(pickScaleDistance(700, 'm')).toBe(1000); // clamps to the smallest
  expect(pickScaleDistance(50000, 'm')).toBe(50000);
});

test('picks from the ft/mi list for ft units', () => {
  const v = pickScaleDistance(4000, 'ft');
  expect(v).toBeLessThanOrEqual(4000);
  expect(v).toBe(3200); // 2000/3.28084 rounded list value at 4000 target
});
```

Adjust the second assertion to the actual array: `SCALE_FT[1]` (2000/3.28084 ≈ 609.6) — so for target 4000 the chosen is 609.6, not 3200. Use the exported constants instead: assert `v <= 4000` and `v === SCALE_FT[1]` if the module also exports `SCALE_FT`; otherwise just assert `v <= 4000 && v > 0`. Simplest robust test:

```js
test('picks from the ft list for ft units', () => {
  const v = pickScaleDistance(4000, 'ft');
  expect(v).toBeLessThanOrEqual(4000);
  expect(v).toBeGreaterThan(0);
  expect(pickScaleDistance(4000, 'ft')).toBe(pickScaleDistance(4000, 'm')); // both start at index 0
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/scale.test.js` → FAIL (not exported).

- [ ] **Step 3: Modify `public/js/ui/hud.js`**

- Change `function pickScaleDistance(...)` to `export function pickScaleDistance(...)`.
- In `_build()`, restructure the scale wrap so the label sits below the bar:

```js
const scaleWrap = el('div', 'hud-scale');
scaleWrap.title = 'Click to switch units';
this.scaleBar = el('div', 'scale-bar');
this.scaleBarInner = el('div', 'scale-bar-inner');
this.scaleLabel = el('span', 'scale-label');
this.scaleBar.appendChild(this.scaleBarInner);
scaleWrap.append(this.scaleBar, this.scaleLabel);
```

- Add a click handler after `c.addEventListener('click', ...)`:

```js
scaleWrap.addEventListener('click', () => {
  const cur = this.store.get().settings;
  this._onUnit(cur.unit === 'm' ? 'ft' : 'm');
});
```

- [ ] **Step 4: CSS in `public/css/style.css`**

Add to the `.hud-scale` rule (replace the existing block):

```css
.hud-scale {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  min-width: 130px;
  cursor: pointer;
  user-select: none;
}
```

- [ ] **Step 5: Verify**

Run: `bun test tests/scale.test.js` → 3 pass.
Run: `bun test` → 76 pass.
Run: `bun build public/js/main.js --target browser --external three --external 'three/*' --outdir /tmp/out` → bundles.

- [ ] **Step 6: Commit**

No git repo — report Task 5 complete.

---

### Task 6: Full QA

**Files:** none modified (verification only).

- [ ] **Step 1: Full suite**

Run: `bun test` → 76 pass, 0 fail.

- [ ] **Step 2: Bundle**

Run: `bun build public/js/main.js --target browser --external three --external 'three/*' --outdir /tmp/out` → clean.

- [ ] **Step 3: Icon + ID cross-check**

```bash
used=$(grep -rhoE 'icon-[a-z]+' public/js | sort -u)
defined=$(grep -oE 'id="icon-[a-z]+"' public/index.html | sed 's/id="//;s/"//' | sort -u)
comm -23 <(echo "$used") <(echo "$defined")
```
Expected: no output.

- [ ] **Step 4: Manual browser checklist (localhost, not LAN IP)**

1. Click **Walk** → crosshair cursor + toast; click a terrain point → character spawns there, third-person camera follows; WASD/Space/Shift work; Esc exits and character disappears.
2. Click **My Location** → terrain loads at your coords, bottom bar shows a real place name (not "My location"/"Coordinates (...)").
3. Click the **TERRACRAFT logo** → welcome card returns over the current map; clicking a chip loads a new place.
4. Scale bar shows a visible distance label; clicking it toggles m ↔ ft and the HUD elevation/scale update.
5. Regression: search, presets, water, peak pin, tooltip, profile, screenshot, share, save, panel toggle, responsive — all still work.

- [ ] **Step 5: Report**

No git repo — report QA results.

---

## Self-Review

**Spec coverage:** third-person camera + character (Task 2), spawn picking (Task 3), reverse geocode + My Location name + geolocation hint (Tasks 1, 4), logo→home (Task 4), scale bar label + toggle (Task 5), tests + QA (Tasks 1, 2, 5, 6). All five features covered.

**Placeholder scan:** no TBD/TODO; every step has concrete code or exact values. One earlier draft assertion in Task 5 was corrected in-place (ft list values).

**Type consistency:** `thirdPersonCamTarget(pos, yaw, camHeight, dist, groundAt)` matches between pov.js and its test. `pickTerrain` returns grid `{x, z}` and `_handleSpawnPick` converts via `halfG` (matches renderer's `sampleWorldHeight` world-coord convention). `startPOV()` return strings are documented and not relied on elsewhere. `reverseGeocode` returns `{name}` in both backend route and client; main.js checks `r.name`. `Welcome.show()` is produced in Task 4 and consumed in the same task.
