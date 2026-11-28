// Learning from what you choose and rate: small score bonuses per activity and per place.
// Signals: a chosen plan (strong), «passt» / «passt nicht» per suggestion (feedback).
// Pure function; the planner collects the signals from storage.

import { THRESHOLDS } from './thresholds';
import type { Activity, Feedback } from './types';

export interface ChoiceSignal {
  candidateId: string;
  activity: Activity;
}

export interface Preferences {
  /** Score points per activity (positive = you tend to like it). */
  activity: Partial<Record<Activity, number>>;
  /** Score points per place. */
  candidate: Record<string, number>;
  /** Number of signals behind the numbers. */
  signals: number;
}

export const NO_PREFERENCES: Preferences = { activity: {}, candidate: {}, signals: 0 };

/**
 * Activity: (likes − dislikes) / (signals + prior) × max points, only from a few signals on.
 * Place: + per «passt» or chosen, − per «passt nicht», each capped.
 */
export function learnPreferences(feedback: readonly Feedback[], choices: readonly ChoiceSignal[]): Preferences {
  const L = THRESHOLDS.learning;
  const act = new Map<Activity, { like: number; dislike: number }>();
  const cand = new Map<string, { like: number; dislike: number; chosen: number }>();
  const a = (k: Activity) => act.get(k) ?? (act.set(k, { like: 0, dislike: 0 }), act.get(k)!);
  const c = (k: string) => cand.get(k) ?? (cand.set(k, { like: 0, dislike: 0, chosen: 0 }), cand.get(k)!);
  let signals = 0;

  for (const r of feedback.flatMap((f) => f.ratings ?? [])) {
    signals++;
    if (r.fits) {
      a(r.activity).like += 1;
      c(r.candidateId).like += 1;
    } else {
      a(r.activity).dislike += 1;
      c(r.candidateId).dislike += 1;
    }
  }
  for (const ch of choices) {
    signals++;
    a(ch.activity).like += L.choiceWeight;
    c(ch.candidateId).chosen += 1;
  }

  const activity: Partial<Record<Activity, number>> = {};
  for (const [k, v] of act) {
    const n = v.like + v.dislike;
    if (n < L.minSignals) continue;
    const pts = Math.round(((v.like - v.dislike) / (n + L.prior)) * L.maxActivityPoints);
    if (pts !== 0) activity[k] = pts;
  }
  const candidate: Record<string, number> = {};
  for (const [k, v] of cand) {
    const plus = Math.min(L.placeLikeMax, v.like * L.placeLike + v.chosen * L.placeChosen);
    const minus = Math.min(L.placeDislikeMax, v.dislike * L.placeDislike);
    const pts = plus - minus;
    if (pts !== 0) candidate[k] = pts;
  }
  return { activity, candidate, signals };
}

/** Bonus for one option (0 without preferences). */
export function preferenceBonus(p: Preferences | undefined, candidateId: string, activity: Activity): number {
  if (!p) return 0;
  return (p.activity[activity] ?? 0) + (p.candidate[candidateId] ?? 0);
}
