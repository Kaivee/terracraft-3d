/**
 * scene/renderer.js — TerrainRenderer orchestrator
 *
 * Rebuild of the v1 VoxelRenderer split into focused scene modules. Keeps the
 * v1 public behavior (render/rerender/water/sun/peak/export) and adds: camera
 * presets, auto-rotate, unit-aware badge, hover/profiling raycasts, world-space
 * height sampling for POV, profile path drawing, and screenshot export.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { computeGrid, buildVoxel, buildSmooth, colorFor } from './terrain.js';
import { buildWaterLayer, waterLevelFromSlider } from './water.js';
import { Markers } from './markers.js';
import { Sky } from './sky.js';
import { screenshot, exportOBJ, exportSTL } from './export.js';
import { POVController } from './pov.js';

const SETTING_KEYS = [
  'viewMode', 'heightScale', 'resolution', 'topoBands', 'heatMinCut', 'heatMaxCut',
  'satHaze', 'milContrast', 'showWater', 'waterLevel', 'waterOpacity', 'showPeakPin', 'autoRotate',
];

export class TerrainRenderer {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.meshes = [];
    this.heightData = null;
    this._grid = null;
    this.raycaster = new THREE.Raycaster();
    this.unit = 'm';
    this.pov = null;
    this._profileLine = null;
    this._last = 0;

    // Current settings (same defaults as v1)
    this.viewMode = 'voxel';
    this.heightScale = 1.5;
    this.resolution = 150;
    this.topoBands = 8;
    this.heatMinCut = 0;
    this.heatMaxCut = 1;
    this.satHaze = 0;
    this.milContrast = 1.0;
    this.showWater = false;
    this.waterLevel = 0;
    this.waterOpacity = 0.6;
    this.showPeakPin = true;
    this.autoRotate = false;

    this.animId = null;
    this._init();
  }

  _init() {
    const W = this.container.clientWidth || window.innerWidth;
    const H = this.container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x161d18);
    this.scene.fog = new THREE.Fog(0x161d18, 200, 500);

    this.camera = new THREE.PerspectiveCamera(48, W / H, 0.5, 1500);
    this.camera.position.set(90, 75, 90);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(W, H);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.LinearToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    this.sky = new Sky(this.scene, 0x161d18);
    this.sky.setSunPosition(135, 45);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 600;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.target.set(0, 6, 0);
    this.controls.update();

    this.markers = new Markers(this.scene, this.container);

    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
    this._animate();
  }

  _onResize() {
    const W = this.container.clientWidth, H = this.container.clientHeight;
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(W, H);
  }

  setSunPosition(az, el) {
    this.sky.setSunPosition(az, el);
  }

  render(data, settings, autoFrame = true) {
    this.heightData = { heightMatrix: data.heightMatrix, minElev: data.minElev, maxElev: data.maxElev };
    for (const key of SETTING_KEYS) {
      if (settings[key] !== undefined) this[key] = settings[key];
    }
    this.unit = settings.unit || 'm';
    this.setSunPosition(settings.sunAz ?? 135, settings.sunEl ?? 45);
    this._build(autoFrame);
  }

  applySettings(opts = {}) {
    if (!this.heightData) return;
    let needsBuild = false;
    for (const key of SETTING_KEYS) {
      if (opts[key] !== undefined) { this[key] = opts[key]; needsBuild = true; }
    }
    if (opts.unit !== undefined) this.unit = opts.unit;
    if (opts.sunAz !== undefined || opts.sunEl !== undefined) {
      this.setSunPosition(opts.sunAz ?? 135, opts.sunEl ?? 45);
    }
    if (needsBuild) this._build(false);
  }

  getWaterElevation(sliderVal = this.waterLevel) {
    if (!this.heightData) return sliderVal;
    return waterLevelFromSlider(sliderVal, this.heightData.minElev, this.heightData.maxElev);
  }

  _build(autoFrame = true) {
    this._clear();
    const { heightMatrix, minElev, maxElev } = this.heightData;

    const grid = computeGrid({
      heightMatrix,
      resolution: this.resolution,
      minElev,
      maxElev,
      heightScale: this.heightScale,
      showWater: this.showWater,
      waterLevel: this.waterLevel,
    });
    this._grid = { ...grid, MIN_ELEV: minElev, MAX_ELEV: maxElev, viewMode: this.viewMode };

    const mode = this.viewMode;
    const color = (n, w) => colorFor(mode, n, w, {
      topoBands: this.topoBands,
      heatMinCut: this.heatMinCut,
      heatMaxCut: this.heatMaxCut,
      satHaze: this.satHaze,
      milContrast: this.milContrast,
    });

    if (mode === 'voxel') {
      this.meshes.push(...buildVoxel(this.scene, grid.grid, { norms: grid.norms, cols: grid.cols, G: grid.G, BASE: grid.BASE }, color));
    } else {
      this.meshes.push(...buildSmooth(this.scene, grid.grid, { norms: grid.norms, G: grid.G, MAX_H: grid.MAX_H, BASE: grid.BASE }, color));
    }

    if (this.showWater) {
      const water = buildWaterLayer(this.scene, {
        G: grid.G, BASE: grid.BASE, MAX_H: grid.MAX_H, isLake: grid.isLake,
        waterOpacity: this.waterOpacity, viewMode: this.viewMode, waterLevel: this.waterLevel,
      });
      if (water) this.meshes.push(...water);
    }

    // 📍 Peak pin + badge
    if (this.showPeakPin) {
      const { G, MAX_H, BASE, norms, cols, peakX, peakZ } = grid;
      const halfG = (G - 1) / 2;
      const peakNorm = norms[peakZ * G + peakX];
      const peakHeightWorld = BASE + (mode === 'voxel' ? cols[peakZ * G + peakX] : peakNorm * MAX_H);
      this.markers.buildPeakPin(peakX - halfG, peakHeightWorld, peakZ - halfG, Math.round(maxElev));
    } else {
      this.markers.setBadgeVisible(false);
    }

    // ◉ Map-center marker
    this.markers.addCenterMarker(0, this.sampleWorldHeight(0, 0), 0);

    // 📷 Camera framing
    const centerY = grid.BASE + grid.MAX_H * 0.4;
    this.controls.target.set(0, centerY, 0);
    if (autoFrame) {
      this.flyToPreset('home');
    } else {
      this.controls.update();
    }
  }

  // World-space terrain height at (x, z) world coords (x,z ∈ [-halfG, halfG]).
  sampleWorldHeight(x, z) {
    if (!this._grid) return 0;
    const { G, MAX_H, BASE, norms, cols, viewMode } = this._grid;
    const hx = x + (G - 1) / 2;
    const hz = z + (G - 1) / 2;
    if (hx < 0 || hz < 0 || hx > G - 1 || hz > G - 1) return BASE;
    const j0 = Math.max(0, Math.floor(hx));
    const i0 = Math.max(0, Math.floor(hz));
    const j1 = Math.min(G - 1, j0 + 1);
    const i1 = Math.min(G - 1, i0 + 1);
    const fx = hx - j0, fz = hz - i0;
    const g = (v00, v10, v01, v11) =>
      v00 * (1 - fx) * (1 - fz) + v10 * fx * (1 - fz) + v01 * (1 - fx) * fz + v11 * fx * fz;
    if (viewMode === 'voxel') {
      return BASE + g(cols[i0 * G + j0], cols[i0 * G + j1], cols[i1 * G + j0], cols[i1 * G + j1]);
    }
    const n = g(norms[i0 * G + j0], norms[i0 * G + j1], norms[i1 * G + j0], norms[i1 * G + j1]);
    return BASE + n * MAX_H;
  }

  // Raycast terrain/water for hover + profile picking.
  pickTerrain(clientX, clientY) {
    if (!this._grid || !this.meshes.length) return null;
    const rect = this.container.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.meshes, false)[0];
    if (!hit) return null;
    const { G, halfG, MIN_ELEV } = this._grid;
    const x = Math.round(hit.point.x + halfG);
    const z = Math.round(hit.point.z + halfG);
    if (x < 0 || z < 0 || x >= G || z >= G) return null;
    const matrix = this.heightData.heightMatrix;
    return { x, z, worldY: hit.point.y, elevMeters: matrix[z]?.[x] ?? MIN_ELEV };
  }

  setAutoRotate(on) {
    this.autoRotate = !!on;
    this.controls.autoRotate = !!on;
  }

  setUnit(unit) {
    this.unit = unit;
    this.markers.updateBadge(this.camera, unit);
  }

  flyToPreset(preset) {
    if (!this._grid) return;
    const { G, MAX_H, BASE } = this._grid;
    const centerY = BASE + MAX_H * 0.4;
    const dist = G * 0.85 + MAX_H * 0.3;
    const target = new THREE.Vector3(0, centerY, 0);
    if (preset === 'top') {
      this.camera.position.set(0, centerY + dist * 1.35, G * 0.12);
    } else if (preset === 'iso') {
      this.camera.position.set(dist * 0.85, centerY + dist * 0.6, dist * 0.85);
    } else {
      this.camera.position.set(dist * 0.7, centerY + dist * 0.45, dist * 0.7);
    }
    this.controls.target.copy(target);
    this.controls.update();
  }

  drawProfilePath(points) {
    this.clearProfile();
    if (!points || points.length < 2) return;
    const positions = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      positions[i * 3] = points[i].x;
      positions[i * 3 + 1] = points[i].y;
      positions[i * 3 + 2] = points[i].z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xd9a05b });
    this._profileLine = new THREE.Line(geo, mat);
    this.scene.add(this._profileLine);
  }

  clearProfile() {
    if (this._profileLine) {
      this.scene.remove(this._profileLine);
      this._profileLine.geometry.dispose();
      this._profileLine.material.dispose();
      this._profileLine = null;
    }
  }

  screenshot(filename) {
    screenshot(this.renderer, this.scene, this.camera, filename);
  }

  exportOBJ(filename) {
    exportOBJ(this.scene, filename);
  }

  exportSTL(filename) {
    exportSTL(this.meshes[0], filename);
  }

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

  isPOV() {
    return !!(this.pov && this.pov.isActive());
  }

  _clear() {
    for (const m of this.meshes) {
      this.scene.remove(m);
      if (m.isInstancedMesh) {
        m.instanceMatrix = null;
        m.instanceColor = null;
      }
      m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) mat.dispose();
    }
    this.meshes = [];
    this.markers.clear();
    this.clearProfile();
  }

  _animate() {
    this.animId = requestAnimationFrame(() => this._animate());
    const now = performance.now();
    const dt = Math.min(0.05, (now - (this._last || now)) / 1000);
    this._last = now;

    this.controls.update();

    if (this.pov && this.pov.isActive()) {
      this.pov.update(dt);
    }

    // Rotate peak ring if active
    if (this.markers.peakGroup && this.markers.peakGroup.children[1]) {
      this.markers.peakGroup.children[1].rotation.y += 0.02;
    }

    this.markers.updateBadge(this.camera, this.unit);

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    cancelAnimationFrame(this.animId);
    this.stopPOV();
    this._clear();
    this.renderer.dispose();
    this.controls.dispose();
  }
}
