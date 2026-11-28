// Evaluation over the test weekends.

import type { Activity, Feedback } from './types';

export interface FeedbackStats {
  weekends: number;
  implemented: number;
  /** 0–1, undefined without feedback. */
  implementationRate?: number;
  averageFitting?: number;
}

export function feedbackStats(feedback: readonly Feedback[]): FeedbackStats {
  const weekends = feedback.length;
  if (weekends === 0) return { weekends: 0, implemented: 0 };
  const implemented = feedback.filter((f) => f.implemented).length;
  return {
    weekends,
    implemented,
    implementationRate: implemented / weekends,
    averageFitting: feedback.reduce((a, f) => a + f.fittingSuggestions, 0) / weekends,
  };
}

/** Share of suggestions rated «passt» per activity (only activities with ratings). */
export function ratingStats(feedback: readonly Feedback[]): Partial<Record<Activity, { fits: number; total: number }>> {
  const out: Partial<Record<Activity, { fits: number; total: number }>> = {};
  for (const r of feedback.flatMap((f) => f.ratings ?? [])) {
    const s = (out[r.activity] ??= { fits: 0, total: 0 });
    s.total += 1;
    if (r.fits) s.fits += 1;
  }
  return out;
}
