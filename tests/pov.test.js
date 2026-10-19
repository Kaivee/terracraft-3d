import { test, expect } from 'bun:test';
import { thirdPersonCamTarget } from '../public/js/scene/povMath.js';

const ground = () => 0;

test('camera sits behind the player', () => {
  const pos = { x: 0, y: 3, z: 0 };
  const cam = thirdPersonCamTarget(pos, 0, 4.2, 7.5, ground);
  expect(cam.z).toBeCloseTo(7.5, 5);
  expect(cam.x).toBeCloseTo(0, 5);
  expect(cam.y).toBeCloseTo(7.2, 5);
});

test('yaw rotates the camera around the player', () => {
  const pos = { x: 0, y: 3, z: 0 };
  const cam = thirdPersonCamTarget(pos, Math.PI / 2, 4.2, 7.5, ground);
  expect(cam.x).toBeCloseTo(7.5, 5);
  expect(cam.z).toBeCloseTo(0, 5);
});

test('camera never dips below the terrain surface', () => {
  const pos = { x: 0, y: 1, z: 0 };
  const groundAt = (x, z) => (x > 2 ? 100 : 0);
  const cam = thirdPersonCamTarget(pos, Math.PI / 2, 2, 7.5, groundAt);
  expect(cam.y).toBeGreaterThanOrEqual(100.5);
});
