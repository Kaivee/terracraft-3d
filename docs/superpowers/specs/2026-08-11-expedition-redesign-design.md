# Expedition Cartograph — Visual Redesign + Location Feature

Date: 2026-08-11

## Goal

Replace the current weak-looking warm-earth UI with a strong, characterful
"Expedition Cartograph" direction (approved via visual mockup), and make
locations visible — especially for random landmarks.

Not modern-minimal, not the current soft look: an old survey-map / expedition
aesthetic — forest green, cream paper, burnt umber, contour textures, serif
display type, small-radius map-card feel.

## Part 1 — Visual redesign

### Principle

Light parchment "chrome" frame around a dark ink-green 3D "map plate". The
terrain viewport stays dark; topbar/panel/HUD/welcome/overlays become paper.

### Design tokens (replaces `:root` in `public/css/style.css`)

| Token | Value | Use |
|---|---|---|
| `--paper` | `#e9dec4` | page/backdrop background |
| `--paper-light` | `#f6efda` | cards, inputs, HUD band, toasts |
| `--ink` | `#22342a` | deep forest green — primary text, dark surfaces, topbar |
| `--ink-2` | `#1c2c23` | darker hover on ink surfaces |
| `--umber` | `#b85c2e` | primary accent — buttons, peaks, slider thumb, needle |
| `--umber-dark` | `#97471f` | pressed/hover-dark for umber |
| `--ochre` | `#d8a24a` | brighten/hover |
| `--teal` | `#3e6b5e` | data chips, cache badge, active/is-on states |
| `--text-soft` | `#5a4a38` | secondary text on paper |
| `--red` | `#a63b2c` | errors, deletes, warn |
| `--line` | `rgba(34,52,42,.35)` | borders on paper |

Fonts unchanged (Fraunces / Inter / JetBrains Mono already loaded). Fraunces
caps + letter-spacing for brand and titles.

### Component language

- Radii small (4-6px, map-card), crisp 1-1.5px ink borders. No glass, no pill
  blur, no glow, no text shadows.
- Buttons: solid `--umber` bg + `--paper-light` text, radius 4px, hover
  brightens to `--ochre`, active nudges 1px down. Secondary buttons: 1.5px ink
  outline, ink text.
- Welcome backdrop: faint contour rings via repeating radial gradients (map
  motif) on `--paper`. Welcome card: `--paper-light`, ink border.
- Topbar: solid `--ink`, `--paper-light` text, brand in Fraunces caps.
- HUD: `--paper-light` band, ink text, ink rules; elevation in umber mono;
  cache chip teal.
- Panel: `--paper-light` card, ink borders; sliders umber thumb on ink track;
  switches ink track → teal when on; segmented `.is-on`/`.btn-on` = ink bg +
  paper text; legend strip unchanged (mode colors from JS).
- Compass: paper circle, ink ring, umber needle.
- Toasts: `--paper-light`, ink border, colored left rule per kind.
- Tooltip: `--ink` bg, paper text.
- Loading: paper card, umber spinner/bar.
- Profile chart card: paper; dots A/B in teal/umber; close hover red.
- POV HUD: ink reticle, paper hint pill, ink exit button.

### Out-of-CSS tweaks

- `public/index.html`: `<meta name="theme-color">` → `#22342a`; favicon stays umber.
- `public/js/scene/renderer.js`: `scene.background` and fog `0x1a1714` →
  `0x161d18` (deep ink-green) so the canvas sits naturally inside the frame;
  pass it as the fog color to the sky: `new Sky(this.scene, 0x161d18)`.
- `public/js/scene/sky.js`: constructor already takes `fogColor`; line 64's
  `scene.background.setHex(day > 0.9 ? 0x1a1714 : 0x0d0f12)` becomes
  `setHex(day > 0.9 ? fogColor : 0x0d0f12)` so the day sky matches the frame.

## Part 2 — Location feature

### Data

- Rebuild `FAMOUS_SPOTS` in `public/js/ui/search.js`: **20 spots** — global
  landmarks + Indian hill stations — each `{ name, region, lat, lon }`
  (regions e.g. `Shizuoka · Yamanashi, Japan`). Keep `SearchBar.FAMOUS_SPOTS`
  export and the existing 6 to remain pickable (superset).
- All coords validated `lat∈[-90,90]`, `lon∈[-180,180]`.

### Welcome screen

- Chips become two-line: name over region.
- Random landmark button: picks a spot and loads it; on successful load shows a
  toast `🎲 {name} · {region} — {lat.toFixed(4)}, {lon.toFixed(4)}`.

### Wiring

- `Welcome` gets the spot `name` (+ region) passed to `onSearch` so `goTo`
  receives `{ name, region, toast: true }` for random picks, `{ name }` for
  chip picks.
- `main.js` `loadTerrain` accepts an options object; on success, if
  `opts.toast`, emits the location toast; `place.name = opts.name` so the HUD
  shows the real place name (not "Coordinates (…)").
- `Welcome._buildSaved`/delete flow unchanged.

### Tests

- New `tests/places.test.js` (bun): dataset has ≥18 entries, names unique, all
  coords in range, every entry has a non-empty `region`, and the 6 legacy
  spots are still present.
- `bun test` must stay green (63 existing + new).

## Non-goals

- No changes to terrain rendering voxels/colors, camera, POV, profile math.
- No new backend endpoints (region data is static in the frontend list).
- No changes to `SearchBar` suggestion API shape (`getSuggestions` still
  returns `{name, region}`; `SearchBar.parseCoords` untouched).

## Verification

- `bun test` — all pass.
- `bun build public/js/main.js --target browser --external three …` bundles.
- Manual browser: welcome shows paper/green theme + two-line chips; random
  landmark toasts name · region — coords; HUD shows real name; theme-color
  matches topbar.
