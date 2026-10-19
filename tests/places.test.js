import { test, expect } from 'bun:test';
import { SearchBar } from '../public/js/ui/search.js';

const SPOTS = SearchBar.FAMOUS_SPOTS;

test('places dataset has at least 18 entries', () => {
  expect(SPOTS.length).toBeGreaterThanOrEqual(18);
});

test('every place has a name, region, and finite coords in range', () => {
  for (const p of SPOTS) {
    expect(typeof p.name).toBe('string');
    expect(p.name.length).toBeGreaterThan(0);
    expect(typeof p.region).toBe('string');
    expect(p.region.length).toBeGreaterThan(0);
    expect(Number.isFinite(p.lat)).toBe(true);
    expect(Number.isFinite(p.lon)).toBe(true);
    expect(p.lat).toBeGreaterThanOrEqual(-90);
    expect(p.lat).toBeLessThanOrEqual(90);
    expect(p.lon).toBeGreaterThanOrEqual(-180);
    expect(p.lon).toBeLessThanOrEqual(180);
  }
});

test('place names are unique', () => {
  const names = SPOTS.map((p) => p.name);
  expect(new Set(names).size).toBe(names.length);
});

test('the 6 legacy spots are still present with the same coords', () => {
  const legacy = {
    'Mount Fuji': [35.3606, 138.7274],
    'Mount Everest': [27.9881, 86.925],
    'Grand Canyon': [36.1069, -112.1129],
    'Matterhorn': [45.9766, 7.6585],
    'Kilimanjaro': [-3.0674, 37.3556],
    'Denali': [63.069, -151.0063],
  };
  for (const [name, [lat, lon]] of Object.entries(legacy)) {
    const spot = SPOTS.find((p) => p.name === name);
    expect(spot).toBeTruthy();
    expect(spot.lat).toBeCloseTo(lat, 4);
    expect(spot.lon).toBeCloseTo(lon, 4);
  }
});
