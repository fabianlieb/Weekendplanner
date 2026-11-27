import { getDb } from '../../data/db';
import { currentWeekendPlan } from '../../data/planner';
import { shortDate } from '../../engine/texts';
import { Notice, PageHead, useAsync } from '../components';
import { formatClock, summaryText } from '../format';
import { navigate } from '../router';
import { SuggestionCard } from './SuggestionCard';

export function SuggestionsView() {
  const db = getDb();
  const { data: plan, loading } = useAsync(() => currentWeekendPlan(db), []);
  if (loading) return null;

  const back = (
    <button type="button" className="back-link" onClick={() => navigate('thursday')}>
      ‹ Angaben ändern
    </button>
  );

  if (!plan) {
    return (
      <>
        {back}
        <PageHead title="Noch keine Vorschläge" lead="Gib zuerst deine 4 Angaben ein." />
      </>
    );
  }

  const n = plan.suggestions.length;
  const summary = summaryText(plan.excludedSummary);
  const w = plan.weather;

  return (
    <>
      {back}
      <PageHead
        title={n === 1 ? '1 Vorschlag' : `${n} Vorschläge`}
        lead={`Dieses Wochenende · berechnet ${shortDate(plan.computedOn)} · passend zu deinem Profil`}
      />

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
        {plan.planB && <SuggestionCard s={plan.planB} chosen={plan.chosenId === plan.planB.id} {...(plan.suggestions[0] ? { replaces: plan.suggestions[0] } : {})} />}
      </div>

      {n > 0 && summary && <span className="tiny muted">Nicht vorgeschlagen: {summary}.</span>}
      {w?.fetchedAt && !w.error && <span className="tiny muted">Wetter: MeteoSchweiz ICON-CH (ab Tag 5 globales Modell) via Open-Meteo, Stand {formatClock(w.fetchedAt)}.</span>}
    </>
  );
}
