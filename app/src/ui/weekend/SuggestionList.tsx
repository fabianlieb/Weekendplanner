import type { WeekendPlan } from '../../data/db';
import { chosenSuggestion } from '../../data/planner';
import { Notice } from '../components';
import { formatClock, summaryText } from '../format';
import { SuggestionCard } from './SuggestionCard';

/** Suggestion cards + Plan B card of a weekend plan. The chosen plan is shown separately (PlanCard). */
export function SuggestionList({ plan }: { plan: WeekendPlan }) {
  const list = plan.suggestions.filter((s) => s.id !== plan.chosenId);
  const planB = plan.planB && plan.planB.id !== plan.chosenId ? plan.planB : undefined;
  const summary = summaryText(plan.excludedSummary);
  const w = plan.weather;

  return (
    <>
      {w?.error && (
        <Notice tone="warn">
          {w.fetchedAt ? `Offline: Wetter vom ${formatClock(w.fetchedAt)}.` : 'Keine Wetterdaten – ohne Wetter schlägt die App nichts vor.'}
        </Notice>
      )}

      {plan.suggestions.length === 0 && (
        <Notice tone="warn">
          Diesmal passt nichts zu deinen Angaben.{summary ? ` Nicht vorgeschlagen: ${summary}.` : ''}
        </Notice>
      )}

      {(list.length > 0 || planB) && <h2 className="list-head">{chosenSuggestion(plan) ? 'Weitere Vorschläge' : 'Vorschläge'}</h2>}
      <div className="stack">
        {list.map((s) => (
          <SuggestionCard key={s.id} s={s} />
        ))}
        {planB && <SuggestionCard s={planB} planB {...(plan.suggestions[0] ? { replaces: plan.suggestions[0] } : {})} />}
      </div>

      {plan.suggestions.length > 0 && summary && <span className="tiny muted">Nicht vorgeschlagen: {summary}.</span>}
    </>
  );
}
