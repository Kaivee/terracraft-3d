import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS,
  SETTINGS_KEY,
  PLACES_KEY,
  LAST_KEY,
  sanitizeSettings,
  loadSettings,
  saveSettings,
  loadPlaces,
  savePlaces,
  loadLast,
  saveLast,
} from '../../public/js/core/settings.js';

function makeLocalStorage() {
  const store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
}

test('sanitizeSettings(null) returns defaults', () => {
  assert.deepEqual(sanitizeSettings(null), DEFAULTS);
  assert.deepEqual(sanitizeSettings(undefined), DEFAULTS);
});

test('sanitizeSettings drops unknown keys', () => {
  const out = sanitizeSettings({ nonsense: 1, unit: 'm' });
  assert.equal(out.nonsense, undefined);
  assert.equal(out.unit, 'm');
});

test('sanitizeSettings coerces string numbers', () => {
  assert.equal(sanitizeSettings({ resolution: '100' }).resolution, 100);
});

test('sanitizeSettings falls back to voxel for a bogus viewMode', () => {
  assert.equal(sanitizeSettings({ viewMode: 'bogus' }).viewMode, 'voxel');
});

test('sanitizeSettings clamps resolution', () => {
  assert.equal(sanitizeSettings({ resolution: 5 }).resolution, 30);
  assert.equal(sanitizeSettings({ resolution: 999 }).resolution, 250);
});

test('sanitizeSettings preserves unit ft', () => {
  assert.equal(sanitizeSettings({ unit: 'ft' }).unit, 'ft');
});

test('sanitizeSettings clamps other numeric ranges', () => {
  assert.equal(sanitizeSettings({ topoBands: 2 }).topoBands, 4);
  assert.equal(sanitizeSettings({ topoBands: 99 }).topoBands, 16);
  assert.equal(sanitizeSettings({ waterOpacity: 0 }).waterOpacity, 0.1);
  assert.equal(sanitizeSettings({ satHaze: 5 }).satHaze, 0.8);
  assert.equal(sanitizeSettings({ milContrast: 9 }).milContrast, 2);
  assert.equal(sanitizeSettings({ heightScale: 99 }).heightScale, 3);
});

test('saveSettings/loadSettings round-trip through localStorage stub', () => {
  globalThis.localStorage = makeLocalStorage();
  try {
    const settings = sanitizeSettings({ resolution: 200, unit: 'ft', viewMode: 'heatmap' });
    saveSettings(settings);
    assert.deepEqual(loadSettings(), settings);
    assert.ok(globalThis.localStorage.getItem(SETTINGS_KEY));
  } finally {
    delete globalThis.localStorage;
  }
});

test('loadSettings returns defaults on garbage', () => {
  globalThis.localStorage = makeLocalStorage();
  try {
    globalThis.localStorage.setItem(SETTINGS_KEY, 'not json {');
    assert.deepEqual(loadSettings(), DEFAULTS);
  } finally {
    delete globalThis.localStorage;
  }
});

test('loadPlaces filters invalid entries', () => {
  globalThis.localStorage = makeLocalStorage();
  try {
    globalThis.localStorage.setItem(PLACES_KEY, JSON.stringify([
      { name: 'Good', lat: 1, lon: 2 },
      null,
      { name: 'No coords' },
      { lat: 3, lon: 4 },
      { name: 'Bad lat', lat: 'x', lon: 5 },
    ]));
    const places = loadPlaces();
    assert.equal(places.length, 1);
    assert.deepEqual(places[0], { name: 'Good', lat: 1, lon: 2 });
  } finally {
    delete globalThis.localStorage;
  }
});

test('loadPlaces returns [] when nothing stored or not an array', () => {
  globalThis.localStorage = makeLocalStorage();
  try {
    assert.deepEqual(loadPlaces(), []);
    globalThis.localStorage.setItem(PLACES_KEY, JSON.stringify({ not: 'a list' }));
    assert.deepEqual(loadPlaces(), []);
  } finally {
    delete globalThis.localStorage;
  }
});

test('savePlaces caps the list at 12', () => {
  globalThis.localStorage = makeLocalStorage();
  try {
    const many = Array.from({ length: 15 }, (_, i) => ({ name: `Place ${i}`, lat: i, lon: -i }));
    savePlaces(many);
    assert.equal(loadPlaces().length, 12);
  } finally {
    delete globalThis.localStorage;
  }
});

test('saveLast/loadLast round-trip', () => {
  globalThis.localStorage = makeLocalStorage();
  try {
    assert.equal(loadLast(), null);
    saveLast({ name: 'Fuji', lat: 35.3606, lon: 138.7274 });
    assert.deepEqual(loadLast(), { name: 'Fuji', lat: 35.3606, lon: 138.7274 });
    globalThis.localStorage.setItem(LAST_KEY, 'not json {');
    assert.equal(loadLast(), null);
  } finally {
    delete globalThis.localStorage;
  }
});
