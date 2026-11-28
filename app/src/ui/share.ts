// Share a plan by link without a server: the plan travels inside the URL fragment (#p=…),
// which browsers never send to the web server. The recipient gets a read-only view.

import type { RiskInfo, ScheduleItem, Suggestion } from '../engine/types';
import { weatherLine } from './format';

export interface SharedPlan {
  v: 1;
  name: string;
  region?: string;
  activityLabel: string;
  date: string;
  dayLabel: string;
  reasons: string[];
  weather?: string;
  schedule: ScheduleItem[];
  risk: RiskInfo;
  photo?: string;
  packing: string[];
  nav?: { lat: number; lon: number; label: string };
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function sharedPlanFrom(s: Suggestion, dayLabel: string, packing: string[], nav?: SharedPlan['nav']): SharedPlan {
  return {
    v: 1,
    name: s.candidateName,
    ...(s.region ? { region: s.region } : {}),
    activityLabel: s.activityLabel,
    date: s.date,
    dayLabel,
    reasons: s.reasons,
    ...(s.weather ? { weather: weatherLine(s.weather, s.activity, s.slot) } : {}),
    schedule: s.schedule,
    risk: s.risk,
    ...(s.photo ? { photo: `${s.photo.spotName} · ${s.photo.lightLabel}` } : {}),
    packing,
    ...(nav ? { nav } : {}),
  };
}

export function encodeSharedPlan(p: SharedPlan): string {
  return toBase64Url(JSON.stringify(p));
}

/** Undefined for anything that is not a valid shared plan (never throws). */
export function decodeSharedPlan(data: string | undefined): SharedPlan | undefined {
  if (!data) return undefined;
  try {
    const p = JSON.parse(fromBase64Url(data)) as Partial<SharedPlan>;
    if (p.v !== 1 || typeof p.name !== 'string' || !Array.isArray(p.schedule) || !p.risk || typeof p.risk.label !== 'string') return undefined;
    return { ...p, packing: Array.isArray(p.packing) ? p.packing : [], reasons: Array.isArray(p.reasons) ? p.reasons : [] } as SharedPlan;
  } catch {
    return undefined;
  }
}

export function shareUrl(p: SharedPlan, base: string): string {
  const u = new URL(base);
  u.search = '?view=shared';
  u.hash = `p=${encodeSharedPlan(p)}`;
  return u.href;
}
