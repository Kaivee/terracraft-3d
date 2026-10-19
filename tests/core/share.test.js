import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatHash, parseHash, copyToClipboard } from '../../public/js/core/share.js';

test('parseHash parses a valid hash', () => {
  assert.deepEqual(parseHash('#35.3606,138.7274'), { lat: 35.3606, lon: 138.7274 });
});

test('parseHash rejects out-of-range coordinates', () => {
  assert.equal(parseHash('#91,0'), null);
  assert.equal(parseHash('#0,181'), null);
  assert.equal(parseHash('#-91,0'), null);
});

test('parseHash rejects junk', () => {
  assert.equal(parseHash(''), null);
  assert.equal(parseHash('nope'), null);
  assert.equal(parseHash('#35.3606'), null);
});

test('formatHash rounds to 4 decimals', () => {
  assert.equal(formatHash(35.36056, 138.72742), '#35.3606,138.7274');
});

test('copyToClipboard returns true when clipboard works', async () => {
  globalThis.navigator = { clipboard: { writeText: async (text) => { assert.equal(text, 'hi'); } } };
  try {
    assert.equal(await copyToClipboard('hi'), true);
  } finally {
    delete globalThis.navigator;
  }
});

test('copyToClipboard returns false without throwing when clipboard fails', async () => {
  globalThis.navigator = { clipboard: { writeText: async () => { throw new Error('denied'); } } };
  try {
    assert.equal(await copyToClipboard('hi'), false);
  } finally {
    delete globalThis.navigator;
  }
});
