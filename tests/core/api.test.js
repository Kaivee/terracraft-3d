import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearchResult } from '../../public/js/core/api.js';

test('normalizeSearchResult fills defaults for missing fields', () => {
  const out = normalizeSearchResult({});
  assert.equal(out.location, 'Coordinates');
  assert.equal(out.autoWaterLevel, 0);
  assert.equal(out.gridSize, 250);
  assert.equal(out.failedTileCount, 0);
  assert.equal(out.hasWater, false);
  assert.equal(out.cached, false);
  assert.equal(out.heightMatrix, undefined);
});

test('normalizeSearchResult defaults failedTileCount to 0', () => {
  const out = normalizeSearchResult({ failedTileCount: undefined });
  assert.equal(out.failedTileCount, 0);
  assert.equal(normalizeSearchResult({ failedTileCount: null }).failedTileCount, 0);
});

test('normalizeSearchResult coerces values and preserves fields', () => {
  const raw = {
    location: 'Mount Fuji',
    lat: '35.3606', lon: '138.7274',
    minElev: '0', maxElev: '3776',
    hasWater: true, autoWaterLevel: '33',
    heightMatrix: [[1, 2], [3, 4]],
    gridSize: '150', cached: true, failedTileCount: 3,
  };
  assert.deepEqual(normalizeSearchResult(raw), {
    location: 'Mount Fuji',
    lat: 35.3606, lon: 138.7274,
    minElev: 0, maxElev: 3776,
    hasWater: true, autoWaterLevel: 33,
    heightMatrix: [[1, 2], [3, 4]],
    gridSize: 150, cached: true, failedTileCount: 3,
  });
});

test('normalizeSearchResult defaults location when falsy', () => {
  assert.equal(normalizeSearchResult({ location: '' }).location, 'Coordinates');
  assert.equal(normalizeSearchResult({ location: null }).location, 'Coordinates');
});
