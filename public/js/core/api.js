async function request(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); if (j && j.error) msg = j.error; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export function searchByQuery(q, signal) { return request(`/api/search?q=${encodeURIComponent(q)}`, signal); }
export function searchByCoords(lat, lon, signal) { return request(`/api/coords?lat=${lat}&lon=${lon}`, signal); }
export function getSuggestions(q, signal) { return request(`/api/suggest?q=${encodeURIComponent(q)}`, signal); }
export function reverseGeocode(lat, lon, signal) { return request(`/api/reverse?lat=${lat}&lon=${lon}`, signal); }

export function normalizeSearchResult(r) {
  return {
    location: String(r.location || 'Coordinates'),
    lat: Number(r.lat), lon: Number(r.lon),
    minElev: Number(r.minElev), maxElev: Number(r.maxElev),
    hasWater: !!r.hasWater, autoWaterLevel: Number(r.autoWaterLevel ?? 0),
    heightMatrix: r.heightMatrix, gridSize: Number(r.gridSize ?? 250),
    cached: !!r.cached, failedTileCount: Number(r.failedTileCount ?? 0),
  };
}
