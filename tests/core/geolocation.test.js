import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.navigator = {
  geolocation: {
    getCurrentPosition: (ok) => ok({ coords: { latitude: 1, longitude: 2, accuracy: 10 } }),
  },
};

const { getCurrentPosition } = await import('../../public/js/core/geolocation.js');

function stubGeolocation(impl) {
  globalThis.navigator = { geolocation: { getCurrentPosition: impl } };
}

test('getCurrentPosition resolves with lat/lon/accuracy on success', async () => {
  stubGeolocation((ok) => ok({ coords: { latitude: 35.3606, longitude: 138.7274, accuracy: 12 } }));
  try {
    const pos = await getCurrentPosition();
    assert.deepEqual(pos, { lat: 35.3606, lon: 138.7274, accuracy: 12 });
  } finally {
    delete globalThis.navigator;
  }
});

test('getCurrentPosition rejects with the error message', async () => {
  stubGeolocation((ok, err) => err({ message: 'User denied geolocation' }));
  try {
    await assert.rejects(() => getCurrentPosition(), /User denied geolocation/);
  } finally {
    delete globalThis.navigator;
  }
});

test('getCurrentPosition rejects with fallback message when error has none', async () => {
  stubGeolocation((ok, err) => err({}));
  try {
    await assert.rejects(() => getCurrentPosition(), /Location unavailable/);
  } finally {
    delete globalThis.navigator;
  }
});

test('getCurrentPosition rejects when navigator.geolocation is missing', async () => {
  globalThis.navigator = {};
  try {
    await assert.rejects(() => getCurrentPosition(), /Geolocation not supported/);
  } finally {
    delete globalThis.navigator;
  }
});

test('getCurrentPosition rejects when navigator is undefined', async () => {
  delete globalThis.navigator;
  const mod = await import('../../public/js/core/geolocation.js');
  await assert.rejects(() => mod.getCurrentPosition(), /Geolocation not supported/);
});
