export function bilinearSample(matrix, x, z) {
  const G = matrix.length;
  if (!G) return 0;
  const cx = Math.min(G - 1, Math.max(0, x));
  const cz = Math.min(G - 1, Math.max(0, z));
  const x0 = Math.min(G - 1, Math.max(0, Math.floor(cx)));
  const z0 = Math.min(G - 1, Math.max(0, Math.floor(cz)));
  const x1 = Math.min(G - 1, x0 + 1);
  const z1 = Math.min(G - 1, z0 + 1);
  const fx = cx - x0, fz = cz - z0;
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

// Map an absolute water-surface elevation (meters) onto the 0-100 water slider.
export function waterLevelForElevation(elev, minElev, maxElev) {
  const range = (maxElev - minElev) || 1;
  return Math.max(0, Math.min(100, ((elev - minElev) / range) * 50));
}

// Smart default water settings for a terrain with a detected water body.
// Returns { showWater, waterLevel } or null when water should stay off
// (no water detected, or the "water" is a summit plateau near the top).
export function autoWaterDefaults(minElev, maxElev, hasWater, autoWaterLevel) {
  if (!hasWater || !Number.isFinite(autoWaterLevel)) return null;
  const range = (maxElev - minElev) || 1;
  const rel = (autoWaterLevel - minElev) / range;
  if (rel > 0.6) return null;
  return {
    showWater: true,
    waterLevel: waterLevelForElevation(autoWaterLevel, minElev, maxElev),
  };
}

// Ground meters per DEM cell at a lat/lon and zoom (3x3 tile stitch → gridSize).
export function cellSizeMeters(lat, zoom = 12, gridSize = 250) {
  const degPerTile = 360 / (2 ** zoom);
  const totalDeg = 3 * degPerTile;
  const meters = totalDeg * 111320 * Math.cos((lat * Math.PI) / 180);
  return meters / gridSize;
}
