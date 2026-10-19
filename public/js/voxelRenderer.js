/**
 * voxelRenderer.js — Multi-mode voxel and smooth terrain renderer
 * Features: Dual-path rendering, Surface culling, 3D Water layer, Peak Marker Beacon, OBJ/STL Exporters
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

// ═══════════════════════════════════════════════════════════
//  VIEW MODE COLOR FUNCTIONS
// ═══════════════════════════════════════════════════════════

const VOXEL_BIOMES = {
  water:  { top: 0x2979ff, mid: 0x1a5ccf, deep: 0x0d3a8a },
  sand:   { top: 0xd4b896, mid: 0xb89c78, deep: 0x907860 },
  grass:  { top: 0x5cb85c, mid: 0x3d8f3d, deep: 0x2a6a2a },
  forest: { top: 0x2e7d32, mid: 0x1e5c22, deep: 0x124018 },
  shrub:  { top: 0x7c9a50, mid: 0x5a7838, deep: 0x3d5225 },
  rock:   { top: 0x8c8070, mid: 0x706050, deep: 0x504438 },
  alpine: { top: 0x9a8870, mid: 0x7a6858, deep: 0x584c40 },
  snow:   { top: 0xf4f0ec, mid: 0xd8d0c4, deep: 0xb8b0a4 },
  bedrock:{ top: 0x4a4640, mid: 0x363230, deep: 0x242220 },
};

function getVoxelBiome(norm, isWater) {
  if (isWater)      return 'water';
  if (norm < 0.04)  return 'sand';
  if (norm < 0.22)  return 'grass';
  if (norm < 0.40)  return 'forest';
  if (norm < 0.55)  return 'shrub';
  if (norm < 0.68)  return 'rock';
  if (norm < 0.82)  return 'alpine';
  return 'snow';
}

function voxelColor(norm, isWater) {
  return VOXEL_BIOMES[getVoxelBiome(norm, isWater)];
}

function topoColor(norm, isWater, bandCount = 8) {
  if (isWater) return { top: 0x2060c8, mid: 0x1848a0, deep: 0x0e3070 };
  const n = bandCount > 1 ? Math.floor(norm * bandCount) / bandCount : norm;
  let r, g, b;
  if (n < 0.25) {
    const t = n / 0.25;
    r = _lerp(0x1a, 0x78, t); g = _lerp(0x6b, 0xc8, t); b = _lerp(0x1a, 0x50, t);
  } else if (n < 0.40) {
    const t = (n - 0.25) / 0.15;
    r = _lerp(0x78, 0xbc, t); g = _lerp(0xc8, 0xd4, t); b = _lerp(0x50, 0x44, t);
  } else if (n < 0.55) {
    const t = (n - 0.40) / 0.15;
    r = _lerp(0xbc, 0xe8, t); g = _lerp(0xd4, 0xd0, t); b = _lerp(0x44, 0x40, t);
  } else if (n < 0.70) {
    const t = (n - 0.55) / 0.15;
    r = _lerp(0xe8, 0xc0, t); g = _lerp(0xd0, 0x78, t); b = _lerp(0x40, 0x28, t);
  } else if (n < 0.85) {
    const t = (n - 0.70) / 0.15;
    r = _lerp(0xc0, 0x8c, t); g = _lerp(0x78, 0x50, t); b = _lerp(0x28, 0x18, t);
  } else {
    const t = (n - 0.85) / 0.15;
    r = _lerp(0x8c, 0xe0, t); g = _lerp(0x50, 0xdc, t); b = _lerp(0x18, 0xd8, t);
  }
  const topHex = (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
  return { top: topHex, mid: darken(topHex, 0.75), deep: darken(topHex, 0.55) };
}

function heatmapColor(norm, isWater, minCut = 0, maxCut = 1) {
  if (isWater) return { top: 0x000080, mid: 0x000060, deep: 0x000040 };
  const n = Math.max(0, Math.min(1, (norm - minCut) / (maxCut - minCut || 1)));
  let r, g, b;
  if (n < 0.20) {
    const t = n / 0.20; r = 0; g = Math.round(_lerp(0, 255, t)); b = 255;
  } else if (n < 0.40) {
    const t = (n - 0.20) / 0.20; r = 0; g = 255; b = Math.round(_lerp(255, 0, t));
  } else if (n < 0.60) {
    const t = (n - 0.40) / 0.20; r = Math.round(_lerp(0, 255, t)); g = 255; b = 0;
  } else if (n < 0.80) {
    const t = (n - 0.60) / 0.20; r = 255; g = Math.round(_lerp(255, 128, t)); b = 0;
  } else {
    const t = (n - 0.80) / 0.20; r = 255; g = Math.round(_lerp(128, 0, t)); b = 0;
  }
  const topHex = (r << 16) | (g << 8) | b;
  return { top: topHex, mid: darken(topHex, 0.70), deep: darken(topHex, 0.50) };
}

function satelliteColor(norm, isWater, haze = 0) {
  if (isWater) {
    const depth = norm < 0.02 ? 0x004080 : 0x1560a0;
    return { top: depth, mid: darken(depth, 0.75), deep: darken(depth, 0.55) };
  }
  let r, g, b;
  if (norm < 0.05) {
    r = 0xb8; g = 0xc8; b = 0x80;
  } else if (norm < 0.25) {
    const t = (norm - 0.05) / 0.20; r = _lerp(0x28, 0x20, t); g = _lerp(0x78, 0x60, t); b = _lerp(0x20, 0x18, t);
  } else if (norm < 0.45) {
    const t = (norm - 0.25) / 0.20; r = _lerp(0x20, 0x60, t); g = _lerp(0x60, 0x58, t); b = _lerp(0x18, 0x28, t);
  } else if (norm < 0.62) {
    const t = (norm - 0.45) / 0.17; r = _lerp(0x60, 0x98, t); g = _lerp(0x58, 0x88, t); b = _lerp(0x28, 0x60, t);
  } else if (norm < 0.78) {
    const t = (norm - 0.62) / 0.16; r = _lerp(0x98, 0x80, t); g = _lerp(0x88, 0x78, t); b = _lerp(0x60, 0x68, t);
  } else if (norm < 0.90) {
    const t = (norm - 0.78) / 0.12; r = _lerp(0x80, 0xd0, t); g = _lerp(0x78, 0xd4, t); b = _lerp(0x68, 0xd8, t);
  } else {
    r = 0xe8; g = 0xee; b = 0xf4;
  }
  if (haze > 0) {
    const hz = haze * norm;
    r = _lerp(r, 0xb8, hz); g = _lerp(g, 0xcc, hz); b = _lerp(b, 0xd8, hz);
  }
  const topHex = (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
  return { top: topHex, mid: darken(topHex, 0.70), deep: darken(topHex, 0.52) };
}

function militaryColor(norm, isWater, contrast = 1.0) {
  if (isWater) return { top: 0x2a4a5a, mid: 0x1e3848, deep: 0x142838 };
  const n = Math.pow(norm, 1 / Math.max(0.3, contrast));
  let r, g, b;
  if (n < 0.30) {
    const t = n / 0.30; r = _lerp(0xb8, 0x78, t); g = _lerp(0xa8, 0x88, t); b = _lerp(0x78, 0x40, t);
  } else if (n < 0.60) {
    const t = (n - 0.30) / 0.30; r = _lerp(0x78, 0x4a, t); g = _lerp(0x88, 0x58, t); b = _lerp(0x40, 0x20, t);
  } else if (n < 0.85) {
    const t = (n - 0.60) / 0.25; r = _lerp(0x4a, 0x28, t); g = _lerp(0x58, 0x38, t); b = _lerp(0x20, 0x14, t);
  } else {
    const t = (n - 0.85) / 0.15; r = _lerp(0x28, 0x18, t); g = _lerp(0x38, 0x22, t); b = _lerp(0x14, 0x0c, t);
  }
  const topHex = (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
  return { top: topHex, mid: darken(topHex, 0.72), deep: darken(topHex, 0.52) };
}

// ══════════════════════════════════════════════════════════
//  VoxelRenderer class
// ══════════════════════════════════════════════════════════
export class VoxelRenderer {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.dirLight = null;
    this.meshes = [];
    this.heightData = null;

    // Current settings
    this.viewMode    = 'voxel';
    this.heightScale = 1.5;
    this.resolution  = 150;
    this._sunAz      = 135;
    this._sunEl      = 45;

    // Mode-specific settings
    this.topoBands    = 8;
    this.heatMinCut   = 0;
    this.heatMaxCut   = 1;
    this.satHaze      = 0;
    this.milContrast  = 1.0;

    // 🌊 3D Water Layer
    this.showWater    = false;
    this.waterLevel   = 0;
    this.waterOpacity = 0.6;
    this.waterMesh    = null;

    // 📍 Peak Marker Pin
    this.showPeakPin  = true;
    this.peakGroup    = null;
    this.peakPosWorld = null;
    this.peakTagBadge = document.getElementById('peak-tag-badge');
    this.peakTagText  = document.getElementById('peak-tag-text');

    this.animId = null;

    // Reusable scratch colors — avoids allocating a new THREE.Color per column/vertex.
    this._scratchColor = new THREE.Color();
    this._scratchTop   = new THREE.Color();
    this._scratchMid   = new THREE.Color();
    this._scratchDeep  = new THREE.Color();

    this._init();
  }

  _init() {
    const W = this.container.clientWidth  || window.innerWidth;
    const H = this.container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
   this.scene.background = new THREE.Color(0x1a1714);
   this.scene.fog = new THREE.Fog(0x1a1714, 200, 500);

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

    this._setupLights();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 600;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.target.set(0, 6, 0);
    this.controls.update();

    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
    this._animate();
  }

  _setupLights() {
    this.scene.add(new THREE.AmbientLight(0xfff8e8, 1.0));
    this.scene.add(new THREE.HemisphereLight(0xe8f0c8, 0x806040, 0.75));

    this.dirLight = new THREE.DirectionalLight(0xfff0cc, 3.0);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(2048, 2048);
    this.dirLight.shadow.camera.near   = 0.5;
    this.dirLight.shadow.camera.far    = 600;
    this.dirLight.shadow.camera.left   = -180;
    this.dirLight.shadow.camera.right  =  180;
    this.dirLight.shadow.camera.top    =  180;
    this.dirLight.shadow.camera.bottom = -180;
    this.dirLight.shadow.bias = -0.0004;
    this.scene.add(this.dirLight);

    const fill = new THREE.DirectionalLight(0xc8e0ff, 0.5);
    fill.position.set(-120, 80, -120);
    this.scene.add(fill);

    this.setSunPosition(this._sunAz, this._sunEl);
  }

  setSunPosition(az, el) {
    this._sunAz = az; this._sunEl = el;
    const a = (az * Math.PI) / 180;
    const e = (el * Math.PI) / 180;
    const d = 240;
    this.dirLight.position.set(
      d * Math.cos(e) * Math.sin(a),
      d * Math.sin(e),
      d * Math.cos(e) * Math.cos(a)
    );
  }

  render(heightMatrix, minElev, maxElev, autoFrame = true) {
    this.heightData = { heightMatrix, minElev, maxElev };
    this._build(autoFrame);
  }

  rerender(opts = {}) {
    if (!this.heightData) return;
    if (opts.resolution   !== undefined) this.resolution   = opts.resolution;
    if (opts.heightScale  !== undefined) this.heightScale  = opts.heightScale;
    if (opts.viewMode     !== undefined) this.viewMode     = opts.viewMode;
    if (opts.topoBands    !== undefined) this.topoBands    = opts.topoBands;
    if (opts.heatMinCut   !== undefined) this.heatMinCut   = opts.heatMinCut;
    if (opts.heatMaxCut   !== undefined) this.heatMaxCut   = opts.heatMaxCut;
    if (opts.satHaze      !== undefined) this.satHaze      = opts.satHaze;
    if (opts.milContrast  !== undefined) this.milContrast  = opts.milContrast;
    if (opts.showWater    !== undefined) this.showWater    = opts.showWater;
    if (opts.waterLevel   !== undefined) this.waterLevel   = opts.waterLevel;
    if (opts.waterOpacity !== undefined) this.waterOpacity = opts.waterOpacity;
    if (opts.showPeakPin  !== undefined) this.showPeakPin  = opts.showPeakPin;
    this._build(false);
  }

  getWaterElevation(sliderVal = this.waterLevel) {
    if (!this.heightData) return sliderVal;
    const relHeight = sliderVal / 50;
    const range = (this.heightData.maxElev - this.heightData.minElev) || 1;
    return this.heightData.minElev + relHeight * range;
  }

  _getColor(norm, isWater) {
    switch (this.viewMode) {
      case 'topographic': return topoColor(norm, isWater, this.topoBands);
      case 'heatmap':     return heatmapColor(norm, isWater, this.heatMinCut, this.heatMaxCut);
      case 'satellite':   return satelliteColor(norm, isWater, this.satHaze);
      case 'military':    return militaryColor(norm, isWater, this.milContrast);
      default:            return voxelColor(norm, isWater);
    }
  }

  _build(autoFrame = true) {
    this._clear();
    const { heightMatrix, minElev, maxElev } = this.heightData;

    const srcR = heightMatrix.length;
    const srcC = heightMatrix[0].length;
    const G = Math.min(this.resolution, srcR, srcC);

    const grid      = this._sample(heightMatrix, G);
    const elevRange = (maxElev - minElev) || 1;
    const MAX_H     = Math.max(10, Math.round(G * 0.28 * this.heightScale));
    
    // Use a much thicker base if water is enabled so we have room to carve a deep basin!
    const BASE      = this.showWater ? 12 : 3;

    // Precalculate column heights & find maximum peak index
    const cols  = new Int32Array(G * G);
    const norms = new Float32Array(G * G);
    const isLake = new Uint8Array(G * G); // Track exactly where water should be!
    let peakVal = -Infinity;
    let peakX = 0, peakZ = 0;

    const waterNormThresh = this.showWater ? (this.waterLevel / 50) : -1;

    for (let z = 0; z < G; z++) {
      for (let x = 0; x < G; x++) {
        const e = grid[z][x];
        let n = Math.max(0, Math.min(1, (e - minElev) / elevRange));
        
        const idx = z * G + x;
        // 🌊 Carve out the lake/ocean basin!
        if (this.showWater && n <= waterNormThresh + 0.005) {
           isLake[idx] = 1; // Mark this pixel as having water
           // Drop the terrain by a significant amount (e.g. 15% of max height)
           n -= 0.15; 
        }

        // Allow cols to be negative so we can dig into the BASE thickness!
        cols[idx]  = Math.round(n * MAX_H);
        norms[idx] = n;

        if (e > peakVal) {
          peakVal = e;
          peakX = x; peakZ = z;
        }
      }
    }

    if (this.viewMode === 'voxel') {
      this._buildVoxel(grid, norms, cols, G, BASE);
    } else {
      this._buildSmooth(grid, norms, G, MAX_H, BASE);
    }

    // 🌊 3D Water Layer
    if (this.showWater) {
      this._buildWater(G, BASE, MAX_H, isLake);
    }

    // 📍 Peak Marker Pin
    if (this.showPeakPin) {
      const halfG = (G - 1) / 2;
      const peakNorm = norms[peakZ * G + peakX];
      const peakHeightWorld = BASE + (this.viewMode === 'voxel' ? cols[peakZ * G + peakX] : peakNorm * MAX_H);
      this._buildPeakPin(peakX - halfG, peakHeightWorld, peakZ - halfG, Math.round(maxElev));
    } else {
      if (this.peakTagBadge) this.peakTagBadge.classList.add('hidden');
    }

    // 📷 Smart Camera Auto-Framing
    const centerY = BASE + MAX_H * 0.4;
    this.controls.target.set(0, centerY, 0);

    if (autoFrame) {
      const cameraDist = G * 0.85 + MAX_H * 0.3;
      this.camera.position.set(cameraDist * 0.7, centerY + cameraDist * 0.45, cameraDist * 0.7);
    }
    this.controls.update();
  }

  // ── VOXEL MODE (with surface culling) ─────────────────────
  _buildVoxel(grid, norms, cols, G, BASE) {
    let total = 0;
    for (let z = 0; z < G; z++) {
      for (let x = 0; x < G; x++) {
        const h = cols[z * G + x];
        const hRight = x < G - 1 ? cols[z * G + (x + 1)] : 0;
        const hLeft  = x > 0     ? cols[z * G + (x - 1)] : 0;
        const hDown  = z < G - 1 ? cols[(z + 1) * G + x] : 0;
        const hUp    = z > 0     ? cols[(z - 1) * G + x] : 0;

        for (let y = 0; y < h + BASE; y++) {
          if (y >= h + BASE - 1 || 
              x === 0 || x === G - 1 || z === 0 || z === G - 1 || 
              y >= hRight + BASE || y >= hLeft + BASE || y >= hDown + BASE || y >= hUp + BASE) {
            total++;
          }
        }
      }
    }

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: false });
    const mesh = new THREE.InstancedMesh(geo, mat, total);
    mesh.castShadow = mesh.receiveShadow = true;

    const mtx = new THREE.Matrix4();
    const color = this._scratchColor;
    const halfG = (G - 1) / 2;
    const bedrockC = new THREE.Color(0x36322e);
    let idx = 0;

    for (let z = 0; z < G; z++) {
      for (let x = 0; x < G; x++) {
        const i = z * G + x;
        const h = cols[i];
        const n = norms[i];
        const e = grid[z][x];
        const isWater = e < 1 && n < 0.03;

        const hRight = x < G - 1 ? cols[z * G + (x + 1)] : 0;
        const hLeft  = x > 0     ? cols[z * G + (x - 1)] : 0;
        const hDown  = z < G - 1 ? cols[(z + 1) * G + x] : 0;
        const hUp    = z > 0     ? cols[(z - 1) * G + x] : 0;

        const bColors = this._getColor(n, isWater);
        // Reuse scratch colors instead of allocating three per column.
        this._scratchTop.set(bColors.top);
        this._scratchMid.set(bColors.mid);
        this._scratchDeep.set(bColors.deep);
        const topC  = this._scratchTop;
        const midC  = this._scratchMid;
        const deepC = this._scratchDeep;

        for (let y = 0; y < h + BASE; y++) {
          if (!(y >= h + BASE - 1 || 
                x === 0 || x === G - 1 || z === 0 || z === G - 1 || 
                y >= hRight + BASE || y >= hLeft + BASE || y >= hDown + BASE || y >= hUp + BASE)) {
            continue;
          }

          mtx.makeTranslation(x - halfG, y, z - halfG);
          mesh.setMatrixAt(idx, mtx);

          if (y < BASE) {
            const v = 0.75 + Math.random() * 0.25;
            color.setRGB(bedrockC.r * v, bedrockC.g * v, bedrockC.b * v);
          } else {
            const relY = (y - BASE) / (h - 1 || 1);
            let r, g, b2;
            if (relY > 0.88) {
              const jitter = 0.88 + Math.random() * 0.22;
              r = topC.r * jitter; g = topC.g * jitter; b2 = topC.b * jitter;
            } else if (relY > 0.45) {
              const t = (relY - 0.45) / 0.43;
              const jitter = 0.82 + Math.random() * 0.18;
              r = _lerp(midC.r, topC.r, t) * jitter; g = _lerp(midC.g, topC.g, t) * jitter; b2 = _lerp(midC.b, topC.b, t) * jitter;
            } else {
              const t = relY / 0.45;
              const jitter = 0.70 + Math.random() * 0.20;
              r = _lerp(deepC.r, midC.r, t) * jitter; g = _lerp(deepC.g, midC.g, t) * jitter; b2 = _lerp(deepC.b, midC.b, t) * jitter;
            }
            color.setRGB(Math.min(1, Math.max(0, r)), Math.min(1, Math.max(0, g)), Math.min(1, Math.max(0, b2)));
          }
          mesh.setColorAt(idx, color); 
          idx++;
        }
      }
    }

    mesh.count = idx;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    this.scene.add(mesh);
    this.meshes.push(mesh);
  }

  // ── SMOOTH TERRAIN MODE ──────────────────────────────────
  _buildSmooth(grid, norms, G, MAX_H, BASE) {
    const geo = new THREE.PlaneGeometry(G - 1, G - 1, G - 1, G - 1);
    geo.rotateX(-Math.PI / 2);

    const posAttr = geo.attributes.position;
    const colors = new Float32Array(G * G * 3);
    const bedrockLevel = BASE - 1;

    for (let z = 0; z < G; z++) {
      for (let x = 0; x < G; x++) {
        const idx = z * G + x;
        const n = norms[idx];
        const e = grid[z][x];
        const isWater = e < 1 && n < 0.03;

        const h = n * MAX_H; 
        posAttr.setY(idx, bedrockLevel + h);

        const bColors = this._getColor(n, isWater);
        this._scratchColor.set(bColors.top);
        colors[idx * 3]     = this._scratchColor.r;
        colors[idx * 3 + 1] = this._scratchColor.g;
        colors[idx * 3 + 2] = this._scratchColor.b;
      }
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const coreGeo = new THREE.BoxGeometry(G - 1, BASE, G - 1);
    coreGeo.translate(0, bedrockLevel - (BASE / 2), 0); 
    const coreMat = new THREE.MeshLambertMaterial({ color: 0x36322e });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.castShadow = true;
    coreMesh.receiveShadow = true;

    this.scene.add(mesh);
    this.scene.add(coreMesh);
    this.meshes.push(mesh, coreMesh);
  }

  // ── 🌊 3D VOLUMETRIC WATER LAYER ─────────────────────────
  _buildWater(G, BASE, MAX_H, isLake) {
    // Determine exact water Y level.
    const waterY = BASE + (this.waterLevel / 50) * MAX_H;
    const waterBottomY = 0.5; // just above floor
    
    // Count faces
    let topFaces = 0;
    let sideFaces = 0;
    for (let z = 0; z < G; z++) {
      for (let x = 0; x < G; x++) {
        if (isLake[z * G + x]) {
          topFaces++;
          if (x === 0 || !isLake[z * G + (x - 1)]) sideFaces++; // Left
          if (x === G - 1 || !isLake[z * G + (x + 1)]) sideFaces++; // Right
          if (z === 0 || !isLake[(z - 1) * G + x]) sideFaces++; // Back
          if (z === G - 1 || !isLake[(z + 1) * G + x]) sideFaces++; // Front
        }
      }
    }
    
    if (topFaces === 0) return; // No water to draw!

    // Create a custom BufferGeometry that ONLY draws water where isLake is 1.
    const vertices = new Float32Array((topFaces + sideFaces) * 6 * 3); 
    const halfG = (G - 1) / 2;
    let vIdx = 0;

    for (let z = 0; z < G; z++) {
      for (let x = 0; x < G; x++) {
        const idx = z * G + x;
        if (isLake[idx]) {
          const wx = x - halfG;
          const wz = z - halfG;
          
          const x0 = wx - 0.5, x1 = wx + 0.5;
          const z0 = wz - 0.5, z1 = wz + 0.5;

          // TOP FACE (y = waterY)
          vertices[vIdx++] = x0; vertices[vIdx++] = waterY; vertices[vIdx++] = z0;
          vertices[vIdx++] = x0; vertices[vIdx++] = waterY; vertices[vIdx++] = z1;
          vertices[vIdx++] = x1; vertices[vIdx++] = waterY; vertices[vIdx++] = z0;

          vertices[vIdx++] = x1; vertices[vIdx++] = waterY; vertices[vIdx++] = z0;
          vertices[vIdx++] = x0; vertices[vIdx++] = waterY; vertices[vIdx++] = z1;
          vertices[vIdx++] = x1; vertices[vIdx++] = waterY; vertices[vIdx++] = z1;

          // LEFT FACE (x = x0)
          if (x === 0 || !isLake[idx - 1]) {
            vertices[vIdx++] = x0; vertices[vIdx++] = waterY; vertices[vIdx++] = z1;
            vertices[vIdx++] = x0; vertices[vIdx++] = waterBottomY; vertices[vIdx++] = z1;
            vertices[vIdx++] = x0; vertices[vIdx++] = waterY; vertices[vIdx++] = z0;

            vertices[vIdx++] = x0; vertices[vIdx++] = waterY; vertices[vIdx++] = z0;
            vertices[vIdx++] = x0; vertices[vIdx++] = waterBottomY; vertices[vIdx++] = z1;
            vertices[vIdx++] = x0; vertices[vIdx++] = waterBottomY; vertices[vIdx++] = z0;
          }

          // RIGHT FACE (x = x1)
          if (x === G - 1 || !isLake[idx + 1]) {
            vertices[vIdx++] = x1; vertices[vIdx++] = waterY; vertices[vIdx++] = z0;
            vertices[vIdx++] = x1; vertices[vIdx++] = waterBottomY; vertices[vIdx++] = z0;
            vertices[vIdx++] = x1; vertices[vIdx++] = waterY; vertices[vIdx++] = z1;

            vertices[vIdx++] = x1; vertices[vIdx++] = waterY; vertices[vIdx++] = z1;
            vertices[vIdx++] = x1; vertices[vIdx++] = waterBottomY; vertices[vIdx++] = z0;
            vertices[vIdx++] = x1; vertices[vIdx++] = waterBottomY; vertices[vIdx++] = z1;
          }

          // BACK FACE (z = z0)
          if (z === 0 || !isLake[(z - 1) * G + x]) {
            vertices[vIdx++] = x0; vertices[vIdx++] = waterY; vertices[vIdx++] = z0;
            vertices[vIdx++] = x0; vertices[vIdx++] = waterBottomY; vertices[vIdx++] = z0;
            vertices[vIdx++] = x1; vertices[vIdx++] = waterY; vertices[vIdx++] = z0;

            vertices[vIdx++] = x1; vertices[vIdx++] = waterY; vertices[vIdx++] = z0;
            vertices[vIdx++] = x0; vertices[vIdx++] = waterBottomY; vertices[vIdx++] = z0;
            vertices[vIdx++] = x1; vertices[vIdx++] = waterBottomY; vertices[vIdx++] = z0;
          }

          // FRONT FACE (z = z1)
          if (z === G - 1 || !isLake[(z + 1) * G + x]) {
            vertices[vIdx++] = x1; vertices[vIdx++] = waterY; vertices[vIdx++] = z1;
            vertices[vIdx++] = x1; vertices[vIdx++] = waterBottomY; vertices[vIdx++] = z1;
            vertices[vIdx++] = x0; vertices[vIdx++] = waterY; vertices[vIdx++] = z1;

            vertices[vIdx++] = x0; vertices[vIdx++] = waterY; vertices[vIdx++] = z1;
            vertices[vIdx++] = x1; vertices[vIdx++] = waterBottomY; vertices[vIdx++] = z1;
            vertices[vIdx++] = x0; vertices[vIdx++] = waterBottomY; vertices[vIdx++] = z1;
          }
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.computeVertexNormals();

    // Use a premium glass/water material with transmission
    // Revert to fixed transmission, but bind the slider to opacity so it correctly fades out
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x1da5cc,           
      transmission: 0.85,     
      opacity: this.waterOpacity,              
      metalness: 0.05,
      roughness: 0.1,
      ior: 1.333,                
      thickness: waterY * 0.5,    
      attenuationColor: 0x0a3c85, 
      attenuationDistance: waterY * 0.4, 
      side: THREE.DoubleSide,
      transparent: true,
    });

    this.waterMesh = new THREE.Mesh(geo, mat);
    this.waterMesh.receiveShadow = true;
    
    // We add an invisible underwater floor to ensure no "papery" look
    // The floor is now only as big as the grid
    const size = this.viewMode === 'voxel' ? G : G - 1;
    const floorGeo = new THREE.PlaneGeometry(size, size);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x36322e });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, 0.5, 0); // just above 0
    this.scene.add(floorMesh);
    this.meshes.push(floorMesh);

    this.scene.add(this.waterMesh);
    this.meshes.push(this.waterMesh);
  }

  // ── 📍 PEAK MARKER PIN ──────────────────────────────────
  _buildPeakPin(worldX, worldY, worldZ, maxElevMeters) {
    this.peakGroup = new THREE.Group();
    this.peakGroup.position.set(worldX, worldY, worldZ);

    // Glowing vertical beam line
    const beamGeo = new THREE.CylinderGeometry(0.3, 0.3, 12, 8);
    beamGeo.translate(0, 6, 0);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xa8c43a,
      transparent: true,
      opacity: 0.7,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);

    // Spinning peak ring
    const ringGeo = new THREE.RingGeometry(1.2, 1.8, 16);
    ringGeo.rotateX(-Math.PI / 2);
    ringGeo.translate(0, 12, 0);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xa8c43a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);

    this.peakGroup.add(beam);
    this.peakGroup.add(ring);
    this.scene.add(this.peakGroup);

    this.peakPosWorld = new THREE.Vector3(worldX, worldY + 12.5, worldZ);

    if (this.peakTagText) {
      this.peakTagText.textContent = `Peak: ${maxElevMeters.toLocaleString()}m`;
    }
  }

  _updatePeakBadge() {
    if (!this.showPeakPin || !this.peakPosWorld || !this.peakTagBadge) {
      if (this.peakTagBadge) this.peakTagBadge.classList.add('hidden');
      return;
    }

    const vec = this.peakPosWorld.clone();
    vec.project(this.camera);

    // Check if behind camera
    if (vec.z > 1) {
      this.peakTagBadge.classList.add('hidden');
      return;
    }

    const W = this.container.clientWidth;
    const H = this.container.clientHeight;
    const screenX = (vec.x * 0.5 + 0.5) * W;
    const screenY = (-(vec.y * 0.5) + 0.5) * H;

    this.peakTagBadge.style.left = `${screenX}px`;
    this.peakTagBadge.style.top  = `${screenY}px`;
    this.peakTagBadge.classList.remove('hidden');
  }

  // ── 💾 3D MODEL EXPORTERS ────────────────────────────────
  exportOBJ(filename = 'Terrain_3D') {
    if (this.meshes.length === 0) return;
    const exporter = new OBJExporter();
    const result = exporter.parse(this.scene);
    this._downloadFile(`${filename}_Model.obj`, result, 'text/plain');
  }

  exportSTL(filename = 'Terrain_3D') {
    if (this.meshes.length === 0) return;
    const exporter = new STLExporter();
    // Parse target primary mesh
    const targetMesh = this.meshes[0];
    const result = exporter.parse(targetMesh, { binary: true });
    this._downloadFile(`${filename}_Printable.stl`, result, 'application/octet-stream');
  }

  _downloadFile(filename, data, mimeType) {
    const blob = new Blob([data], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // ──────────── Helpers ────────────────────────────────────

  _sample(matrix, G) {
    const R = matrix.length, C = matrix[0].length;
    return Array.from({ length: G }, (_, z) =>
      Array.from({ length: G }, (__, x) =>
        matrix[Math.min(R-1, Math.floor((z/G)*R))][Math.min(C-1, Math.floor((x/G)*C))]
      )
    );
  }

  _clear() {
    for (const m of this.meshes) {
      this.scene.remove(m);
      // InstancedMesh keeps its own attribute buffers on the mesh — drop them so
      // the GPU-side instance buffers are released with the geometry.
      if (m.isInstancedMesh) {
        m.instanceMatrix = null;
        m.instanceColor = null;
      }
      m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) mat.dispose();
    }
    this.meshes = [];

    // Dispose peak beacon geometry/material (previously leaked every rebuild)
    if (this.peakGroup) {
      this.scene.remove(this.peakGroup);
      this.peakGroup.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      this.peakGroup = null;
      this.peakPosWorld = null;
    }

    // Dispose the (expensive) water material + geometry
    if (this.waterMesh) {
      this.scene.remove(this.waterMesh);
      this.waterMesh.geometry.dispose();
      this.waterMesh.material.dispose();
      this.waterMesh = null;
    }
  }

  _animate() {
    this.animId = requestAnimationFrame(() => this._animate());
    this.controls.update();

    // Rotate peak ring if active
    if (this.peakGroup && this.peakGroup.children[1]) {
      this.peakGroup.children[1].rotation.y += 0.02;
    }

    // Update 3D peak tag screen badge position
    this._updatePeakBadge();

    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    const W = this.container.clientWidth, H = this.container.clientHeight;
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(W, H);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    cancelAnimationFrame(this.animId);
    this._clear();
    this.renderer.dispose();
    this.controls.dispose();
  }
}

// ── Utilities ────────────────────────────────────────────
function _lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }

function darken(hex, factor) {
  const r = ((hex >> 16) & 0xff) * factor;
  const g = ((hex >>  8) & 0xff) * factor;
  const b = ( hex        & 0xff) * factor;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
