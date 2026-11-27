import type { WeekendPlan } from '../../data/db';
import { Notice } from '../components';
import { formatClock, summaryText } from '../format';
import { SuggestionCard } from './SuggestionCard';

/** The 3 suggestion cards + Plan B card of a weekend plan, with weather and exclusion notes. */
export function SuggestionList({ plan }: { plan: WeekendPlan }) {
  const n = plan.suggestions.length;
  const summary = summaryText(plan.excludedSummary);
  const w = plan.weather;

  return (
    <>
      {w?.error && (
        <Notice tone="warn">
          {w.fetchedAt ? `Offline: Wetterdaten vom ${formatClock(w.fetchedAt)}.` : 'Keine Wetterdaten – ohne Wetter schlägt die App nichts vor.'} ({w.error})
        </Notice>
      )}

      {n === 0 && (
        <Notice tone="warn">
          Diesmal passt nichts zu deinen Angaben.{summary ? ` Nicht vorgeschlagen: ${summary}.` : ''}
        </Notice>
      )}

      <div className="stack">
        {plan.suggestions.map((s, i) => (
          <SuggestionCard key={s.id} s={s} index={i + 1} chosen={plan.chosenId === s.id} />
        ))}
        {plan.planB && (
          <SuggestionCard s={plan.planB} chosen={plan.chosenId === plan.planB.id} {...(plan.suggestions[0] ? { replaces: plan.suggestions[0] } : {})} />
        )}
      </div>

      {n > 0 && summary && <span className="tiny muted">Nicht vorgeschlagen: {summary}.</span>}
      {w?.fetchedAt && !w.error && (
        <span className="tiny muted">Wetter: MeteoSchweiz ICON-CH (ab Tag 5 globales Modell) via Open-Meteo, Stand {formatClock(w.fetchedAt)}.</span>
      )}
    </>
  );
}
