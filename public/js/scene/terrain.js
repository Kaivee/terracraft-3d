import * as THREE from 'three';

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

// ── Utilities ────────────────────────────────────────────
function _lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }

function darken(hex, factor) {
  const r = ((hex >> 16) & 0xff) * factor;
  const g = ((hex >>  8) & 0xff) * factor;
  const b = ( hex        & 0xff) * factor;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

// Reusable scratch colors — avoids allocating a new THREE.Color per column/vertex.
const _scratchColor = new THREE.Color();
const _scratchTop   = new THREE.Color();
const _scratchMid   = new THREE.Color();
const _scratchDeep  = new THREE.Color();

function sampleGrid(matrix, G) {
  const R = matrix.length, C = matrix[0].length;
  return Array.from({ length: G }, (_, z) =>
    Array.from({ length: G }, (__, x) =>
      matrix[Math.min(R-1, Math.floor((z/G)*R))][Math.min(C-1, Math.floor((x/G)*C))]
    )
  );
}

export function computeGrid({ heightMatrix, resolution, minElev, maxElev, heightScale, showWater, waterLevel }) {
  const srcR = heightMatrix.length;
  const srcC = heightMatrix[0].length;
  const G = Math.min(resolution, srcR, srcC);

  const grid      = sampleGrid(heightMatrix, G);
  const elevRange = (maxElev - minElev) || 1;
  const MAX_H     = Math.max(10, Math.round(G * 0.28 * heightScale));

  // Use a much thicker base if water is enabled so we have room to carve a deep basin!
  const BASE      = showWater ? 12 : 3;

  // Precalculate column heights & find maximum peak index
  const cols  = new Int32Array(G * G);
  const norms = new Float32Array(G * G);
  const isLake = new Uint8Array(G * G); // Track exactly where water should be!
  let peakVal = -Infinity;
  let peakX = 0, peakZ = 0;

  const waterNormThresh = showWater ? (waterLevel / 50) : -1;

  for (let z = 0; z < G; z++) {
    for (let x = 0; x < G; x++) {
      const e = grid[z][x];
      let n = Math.max(0, Math.min(1, (e - minElev) / elevRange));

      const idx = z * G + x;
      // 🌊 Carve out the lake/ocean basin!
      if (showWater && n <= waterNormThresh + 0.005) {
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

  return { G, grid, norms, cols, isLake, MAX_H, BASE, peakVal, peakX, peakZ, halfG: (G - 1) / 2 };
}

// ── VOXEL MODE (with surface culling) ─────────────────────
export function buildVoxel(scene, grid, { norms, cols, G, BASE }, colorFor) {
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
  const color = _scratchColor;
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

      const bColors = colorFor(n, isWater);
      // Reuse scratch colors instead of allocating three per column.
      _scratchTop.set(bColors.top);
      _scratchMid.set(bColors.mid);
      _scratchDeep.set(bColors.deep);
      const topC  = _scratchTop;
      const midC  = _scratchMid;
      const deepC = _scratchDeep;

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

  scene.add(mesh);
  return [mesh];
}

// ── SMOOTH TERRAIN MODE ──────────────────────────────────
export function buildSmooth(scene, grid, { norms, G, MAX_H, BASE }, colorFor) {
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

      const bColors = colorFor(n, isWater);
      _scratchColor.set(bColors.top);
      colors[idx * 3]     = _scratchColor.r;
      colors[idx * 3 + 1] = _scratchColor.g;
      colors[idx * 3 + 2] = _scratchColor.b;
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

  scene.add(mesh);
  scene.add(coreMesh);
  return [mesh, coreMesh];
}
