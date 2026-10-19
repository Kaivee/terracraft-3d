import { test, expect } from 'bun:test';
import { pickScaleDistance } from '../public/js/ui/hud.js';

test('picks the largest nice round meter value below the target', () => {
  expect(pickScaleDistance(3500, 'm')).toBe(2000);
  expect(pickScaleDistance(700, 'm')).toBe(1000);
  expect(pickScaleDistance(50000, 'm')).toBe(50000);
});

test('picks a positive value from the ft list for ft units', () => {
  const v = pickScaleDistance(4000, 'ft');
  expect(v).toBeLessThanOrEqual(4000);
  expect(v).toBeGreaterThan(0);
});
