// Keeps the installed app up to date. iOS often resumes a home screen app instead of reloading it,
// so we look for a new version whenever the app comes to the foreground (and hourly). With
// registerType 'autoUpdate' the page reloads itself once the new service worker has taken over.
import { registerSW } from 'virtual:pwa-register';

export function setupAutoUpdate(): void {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) void registration.update().catch(() => undefined);
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      setInterval(check, 60 * 60 * 1000);
    },
  });
}
