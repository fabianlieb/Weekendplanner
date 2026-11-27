// Minimal URL-based routing via `?view=` (also the deep links for the Shortcuts automation).
import { useEffect, useState } from 'react';

export type View = 'thursday' | 'suggestions' | 'detail' | 'check' | 'feedback' | 'stats' | 'list' | 'profile' | 'backup' | 'admin';
const VIEWS: View[] = ['thursday', 'suggestions', 'detail', 'check', 'feedback', 'stats', 'list', 'profile', 'backup', 'admin'];

export interface Route {
  view: View;
  params: Record<string, string>;
}

export function parseRoute(search: string): Route {
  const q = new URLSearchParams(search);
  const v = q.get('view') as View | null;
  const params: Record<string, string> = {};
  q.forEach((value, key) => {
    if (key !== 'view') params[key] = value;
  });
  const view: View = v && VIEWS.includes(v) ? v : 'thursday';
  // Old links ?view=admin&tab=… (the separate risk page is gone: colours are entered on the weekend screen).
  if (view === 'admin') {
    const { tab, ...rest } = params;
    const target: View = tab === 'list' ? 'list' : tab === 'backup' ? 'backup' : tab === 'risk' ? 'thursday' : 'profile';
    return { view: target, params: tab === 'risk' ? { colours: '1' } : rest };
  }
  return { view, params };
}

export function routeToSearch(r: Route): string {
  const q = new URLSearchParams({ view: r.view, ...r.params });
  return `?${q.toString()}`;
}

const listeners = new Set<(r: Route) => void>();

export function navigate(view: View, params: Record<string, string> = {}, replace = false): void {
  const route = { view, params };
  const url = `${window.location.pathname}${routeToSearch(route)}`;
  if (replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
  window.scrollTo(0, 0);
  listeners.forEach((l) => l(route));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.search));
  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.search));
    listeners.add(setRoute);
    window.addEventListener('popstate', onPop);
    return () => {
      listeners.delete(setRoute);
      window.removeEventListener('popstate', onPop);
    };
  }, []);
  return route;
}
