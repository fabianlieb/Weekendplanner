// Current position from the device. Stays on the device: only used to pick the start point.

export function currentPosition(timeoutMs = 8000): Promise<{ lat: number; lon: number } | undefined> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(undefined);
      },
      // A position from the last 30 minutes is good enough; low accuracy is fine for start points.
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 30 * 60 * 1000 },
    );
  });
}
