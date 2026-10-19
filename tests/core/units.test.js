import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, metersToFeet, formatElevation, formatDistance } from '../../public/js/core/units.js';

test('metersToFeet converts meters to feet', () => {
  assert.ok(Math.abs(metersToFeet(1) - 3.28084) < 1e-5);
});

test('formatElevation formats meters with thousands separator', () => {
  assert.equal(formatElevation(1500, 'm'), '1,500 m');
});

test('formatElevation in feet includes ft suffix', () => {
  assert.ok(formatElevation(1500, 'ft').includes('ft'));
});

test('formatElevation suffix option omits unit label', () => {
  assert.equal(formatElevation(1500, 'm', { suffix: false }), '1,500');
});

test('formatDistance converts large distances to km', () => {
  assert.equal(formatDistance(150000, 'm'), '150.00 km');
});

test('formatDistance in feet converts to miles', () => {
  assert.ok(formatDistance(10000, 'ft').includes('mi'));
});

test('invalid unit falls back to meters', () => {
  assert.equal(formatElevation(1500, 'bogus'), '1,500 m');
  assert.equal(formatDistance(150000, 'bogus'), '150.00 km');
});
