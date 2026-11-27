// Evaluation over the test weekends.

import type { Feedback } from './types';

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
