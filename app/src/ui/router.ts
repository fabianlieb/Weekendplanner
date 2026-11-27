// Minimal URL-based routing via `?view=` (also the deep links for the Shortcuts automation).
import { useEffect, useState } from 'react';

export type View = 'thursday' | 'suggestions' | 'detail' | 'check' | 'feedback' | 'stats' | 'admin';
const VIEWS: View[] = ['thursday', 'suggestions', 'detail', 'check', 'feedback', 'stats', 'admin'];

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
  return { view: v && VIEWS.includes(v) ? v : 'thursday', params };
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
