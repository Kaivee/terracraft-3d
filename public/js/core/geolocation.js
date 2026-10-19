export function getCurrentPosition({ timeout = 8000, maximumAge = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(new Error((err && err.message) || 'Location unavailable')),
      { enableHighAccuracy: false, timeout, maximumAge }
    );
  });
}
