import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../public/js/core/store.js';

test('set merges and notifies', () => {
  const s = createStore({ a: 1 });
  const seen = [];
  s.on((st) => seen.push(st));
  s.set({ b: 2 });
  assert.equal(s.get().a, 1);
  assert.equal(s.get().b, 2);
  assert.equal(seen.length, 1);
});

test('on returns unsubscribe', () => {
  const s = createStore({ a: 1 });
  let count = 0;
  const off = s.on(() => count++);
  off();
  s.set({ a: 2 });
  assert.equal(count, 0);
});
