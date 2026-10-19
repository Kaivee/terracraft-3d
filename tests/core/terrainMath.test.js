import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bilinearSample,
  computeStats,
  findTopPeaks,
  sampleProfile,
  elevationToNorm,
  normToElevation,
  waterLevelForElevation,
  autoWaterDefaults,
  cellSizeMeters,
} from '../../public/js/core/terrainMath.js';

test('bilinearSample handles flat and corner values', () => {
  assert.equal(bilinearSample([[0, 0], [0, 0]], 0, 0), 0);
  assert.equal(bilinearSample([[0, 10], [20, 30]], 0, 0), 0);
  assert.equal(bilinearSample([[0, 10], [20, 30]], 1, 1), 30);
  assert.equal(bilinearSample([[0, 10], [20, 30]], 0.5, 0.5), 15);
});

test('bilinearSample clamps out-of-range coordinates', () => {
  assert.equal(bilinearSample([[0, 10], [20, 30]], -5, -5), 0);
  assert.equal(bilinearSample([[0, 10], [20, 30]], 5, 5), 30);
});

test('bilinearSample returns 0 for an empty matrix', () => {
  assert.equal(bilinearSample([], 0, 0), 0);
});

test('computeStats computes min max mean footprint and prominence', () => {
  const s = computeStats([[1, 2], [3, 4]], 100);
  assert.equal(s.min, 1);
  assert.equal(s.max, 4);
  assert.equal(s.mean, 2.5);
  assert.equal(s.prominence, 3);
  assert.ok(Math.abs(s.footprintKm2 - 0.04) < 1e-9);
});

test('findTopPeaks returns the obvious max first', () => {
  const matrix = [
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [1, 1, 9, 1, 1],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
  ];
  const peaks = findTopPeaks(matrix, 3);
  assert.equal(peaks[0].elev, 9);
  assert.equal(peaks[0].x, 2);
  assert.equal(peaks[0].z, 2);
});

test('findTopPeaks skips peaks that are too close', () => {
  const matrix = [
    [1, 1, 1, 1],
    [1, 7, 1, 1],
    [1, 1, 1, 1],
    [1, 1, 1, 8],
  ];
  const peaks = findTopPeaks(matrix, 2);
  assert.equal(peaks.length, 1);
  assert.equal(peaks[0].elev, 8);
  assert.ok(!peaks.some((p) => p.elev === 7));
});

test('sampleProfile walks the line between endpoints', () => {
  const pts = sampleProfile([[1, 1], [1, 1]], 0, 0, 1, 1, 4);
  assert.equal(pts.length, 5);
  assert.ok(pts.every((p) => p.elev === 1));
  assert.deepEqual({ x: pts[0].x, z: pts[0].z }, { x: 0, z: 0 });
  assert.deepEqual({ x: pts[4].x, z: pts[4].z }, { x: 1, z: 1 });
});

test('elevationToNorm and normToElevation round-trip', () => {
  assert.equal(elevationToNorm(100, 0, 200), 0.5);
  assert.equal(normToElevation(0.5, 0, 200), 100);
  assert.equal(normToElevation(elevationToNorm(37, 10, 90), 10, 90), 37);
});

test('elevationToNorm clamps and handles zero range', () => {
  assert.equal(elevationToNorm(-100, 0, 200), 0);
  assert.equal(elevationToNorm(500, 0, 200), 1);
  assert.equal(elevationToNorm(50, 50, 50), 0);
});

test('waterLevelForElevation maps meters onto the 0-100 slider', () => {
  assert.equal(waterLevelForElevation(0, 0, 200), 0);
  assert.equal(waterLevelForElevation(100, 0, 200), 25);
  assert.equal(waterLevelForElevation(200, 0, 200), 50);
});

test('autoWaterDefaults enables water at the detected surface level', () => {
  const w = autoWaterDefaults(400, 1000, true, 410);
  assert.deepEqual(w, { showWater: true, waterLevel: waterLevelForElevation(410, 400, 1000) });
});

test('autoWaterDefaults stays off without water or at a summit plateau', () => {
  assert.equal(autoWaterDefaults(0, 200, false, 50), null);
  assert.equal(autoWaterDefaults(0, 200, true, Number.NaN), null);
  assert.equal(autoWaterDefaults(100, 1000, true, 900), null);
});

test('cellSizeMeters shrinks with latitude and is positive', () => {
  const eq = cellSizeMeters(0, 12, 250);
  const hi = cellSizeMeters(60, 12, 250);
  assert.ok(eq > 0);
  assert.ok(hi > 0);
  assert.ok(eq > hi);
  assert.ok(Math.abs(eq - (3 * (360 / (2 ** 12)) * 111320) / 250) < 1e-9);
});
