export function formatHash(lat, lon) {
  return `#${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
}

export function parseHash(hash) {
  const m = /^#(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(String(hash).trim());
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lon = parseFloat(m[2]);
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

export function shareUrl() {
  const { origin, pathname, hash } = window.location;
  const clean = hash.startsWith('#') && parseHash(hash) ? hash : '';
  return `${origin}${pathname}${clean}`;
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}
