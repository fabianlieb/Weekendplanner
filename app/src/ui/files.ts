// Hand a generated file to the user: share sheet on the iPhone, download elsewhere.

export async function shareOrDownload(name: string, text: string, type = 'application/json'): Promise<void> {
  const file = new File([text], name, { type });
  // On the iPhone the share sheet offers saving to the Files app.
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }
  download(name, new Blob([text], { type }));
}

function download(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Cache read by the service worker (see vite.config.ts: runtimeCaching «wp-ics»). */
export const ICS_CACHE = 'wp-ics';

/** URL of a generated calendar file inside the app's own scope, e.g. /Weekendplanner/calendar/x.ics */
export function calendarFileUrl(name: string): string {
  return new URL(`calendar/${encodeURIComponent(name)}`, document.baseURI).href;
}

/**
 * Opens an .ics in the calendar.
 * iOS: a `data:` or `blob:` URL in a new window is handed to Safari, which cannot load it.
 * Instead the file is put into a cache the service worker serves from a real same-origin URL
 * with `Content-Type: text/calendar`, and the app navigates there in the same window –
 * iOS then shows «Zum Kalender hinzufügen». Without an active service worker: share sheet.
 * Elsewhere: download, which the calendar app opens.
 * Returns false if nothing could be done (caller offers sharing instead).
 */
export async function openCalendarFile(name: string, ics: string): Promise<boolean> {
  if (isIos()) {
    if ('caches' in window && navigator.serviceWorker?.controller) {
      const url = calendarFileUrl(name);
      const cache = await caches.open(ICS_CACHE);
      await cache.put(
        new Request(url),
        new Response(ics, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `inline; filename="${name}"` } }),
      );
      window.location.href = url;
      return true;
    }
    return shareCalendarFile(name, ics);
  }
  download(name, new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  return true;
}

/** Share sheet with the .ics file (iPhone: «In Dateien sichern» or a calendar app), else download. */
export async function shareCalendarFile(name: string, ics: string): Promise<boolean> {
  const file = new File([ics], name, { type: 'text/calendar' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return true;
    }
  }
  download(name, file);
  return true;
}
