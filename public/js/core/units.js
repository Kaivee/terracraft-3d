export const UNITS = { METERS: 'm', FEET: 'ft' };

export function metersToFeet(m) { return m * 3.28084; }

export function formatElevation(meters, unit = UNITS.METERS, opts = {}) {
  const { precision = 0, suffix = true } = opts;
  const u = unit === UNITS.FEET ? UNITS.FEET : UNITS.METERS;
  const value = u === UNITS.FEET ? metersToFeet(meters) : meters;
  const label = value.toLocaleString(undefined, { maximumFractionDigits: precision });
  return suffix ? `${label} ${u}` : label;
}

export function formatDistance(meters, unit = UNITS.METERS) {
  const u = unit === UNITS.FEET ? UNITS.FEET : UNITS.METERS;
  const v = u === UNITS.FEET ? metersToFeet(meters) : meters;
  if (u === UNITS.METERS && v >= 1000) return `${(v / 1000).toFixed(2)} km`;
  if (u === UNITS.FEET && v >= 5280) return `${(v / 5280).toFixed(2)} mi`;
  return `${Math.round(v).toLocaleString()} ${u}`;
}
