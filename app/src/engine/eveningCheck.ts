// Evening check: recompute with current data. «Plan steht.» or switch to Plan B with a reason.

import { evaluateOptions, type EngineContext, type ScoredOption } from './suggest';
import { CHECK_REASON, PLAN_B_REASON } from './texts';
import { THRESHOLDS } from './thresholds';
import type { ExclusionReason, PlanB, Suggestion } from './types';

export type CheckResult =
  | { status: 'holds'; plan: Suggestion }
  | { status: 'switch'; reason: string; reasonCode: ExclusionReason | 'score_drop'; alternative?: PlanB };

function reasonText(reasons: readonly ExclusionReason[]): { code: ExclusionReason; text: string } {
  const pick = (code: ExclusionReason, text: string) => ({ code, text });
  if (reasons.includes('risk_unknown') || reasons.includes('risk_stale')) return pick(reasons.includes('risk_stale') ? 'risk_stale' : 'risk_unknown', CHECK_REASON.riskMissing);
  if (reasons.includes('risk_above_level')) return pick('risk_above_level', CHECK_REASON.riskAbove);
  if (reasons.includes('risk_red_unconfirmed')) return pick('risk_red_unconfirmed', CHECK_REASON.redUnconfirmed);
  if (reasons.includes('weather_missing')) return pick('weather_missing', CHECK_REASON.weatherMissing);
  const weather = reasons.find((r) => r === 'weather_knockout' || r === 'conditions_poor');
  if (weather) return pick(weather, CHECK_REASON.weatherWorse);
  return pick(reasons[0] ?? 'conditions_poor', CHECK_REASON.other);
}

/**
 * `ctx.today` is the evening-check date; risk entries must be from that date (fail closed).
 * Only the plan's date is evaluated.
 */
export function eveningCheck(ctx: EngineContext, plan: Suggestion, previousPlanB?: Suggestion): CheckResult {
  const { valid, excluded } = evaluateOptions({ ...ctx, onlyDates: [plan.date] });
  const current = valid.find((o) => o.suggestion.id === plan.id);
  const cfg = THRESHOLDS.eveningCheck;

  if (current && plan.score - current.suggestion.score <= cfg.maxScoreDrop && current.suggestion.conditionScore >= cfg.minConditionScore) {
    return { status: 'holds', plan: current.suggestion };
  }

  let reason: { code: ExclusionReason | 'score_drop'; text: string };
  if (current) reason = { code: 'score_drop', text: CHECK_REASON.weatherWorse };
  else {
    const ex = excluded.find((e) => e.candidateId === plan.candidateId && e.slot === plan.slot);
    reason = reasonText(ex?.reasons ?? []);
  }

  const alternatives = valid.filter((o) => o.option.candidate.id !== plan.candidateId);
  const keep = previousPlanB ? alternatives.find((o) => o.suggestion.id === previousPlanB.id) : undefined;
  const best: ScoredOption | undefined =
    keep ??
    [...alternatives].sort((a, b) => {
      // After a risk problem prefer options without avalanche dependency.
      const riskIssue = reason.code.startsWith('risk');
      const bonus = (o: ScoredOption) => (riskIssue && !o.suggestion.avalancheDependent ? THRESHOLDS.selection.planBIndependenceBonus : 0);
      return b.total + bonus(b) - (a.total + bonus(a));
    })[0];

  const planBReason = best && plan.avalancheDependent && !best.suggestion.avalancheDependent ? PLAN_B_REASON.avalanche : PLAN_B_REASON.generic;
  return {
    status: 'switch',
    reason: reason.text,
    reasonCode: reason.code,
    ...(best ? { alternative: { ...best.suggestion, planBReason } } : {}),
  };
}
