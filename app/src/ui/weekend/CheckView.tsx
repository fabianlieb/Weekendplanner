import { getDb } from '../../data/db';
import { adoptAlternative, runEveningCheck } from '../../data/planner';
import { CHECK_HOLDS, CHECK_REASON, CHECK_SWITCH, DAY_LABEL, shortDate } from '../../engine/texts';
import type { Suggestion } from '../../engine/types';
import { formatTime, zurichToday } from '../../engine/util';
import { Notice, PageHead, showToast, useAsync } from '../components';
import { formatClock } from '../format';
import { navigate } from '../router';
import { RiskBlock } from './RiskBlock';
import { SuggestionCard } from './SuggestionCard';

const departure = (s: Suggestion) => s.schedule[0]?.time;

export function CheckView() {
  const db = getDb();
  const today = zurichToday();
  const { data: outcome, loading, reload } = useAsync(() => runEveningCheck(db), []);

  const head = (
    <>
      <button type="button" className="back-link" onClick={() => navigate('thursday')}>
        ‹ Wochenende
      </button>
      <PageHead overline={`${shortDate(today)} · Vorabend-Check`} title="Hält der Plan?" />
    </>
  );
  if (loading || !outcome) {
    return (
      <>
        {head}
        <span className="small muted">Prüfe mit aktuellem Wetter und den Farben von heute …</span>
      </>
    );
  }

  if (outcome.status === 'no_plan') {
    return (
      <>
        {head}
        <Notice>Für dieses Wochenende gibt es noch keine Vorschläge.</Notice>
        <button type="button" className="btn btn-primary" onClick={() => navigate('thursday')}>
          Vorschläge berechnen
        </button>
      </>
    );
  }

  if (outcome.status === 'no_choice') {
    return (
      <>
        {head}
        <Notice>Du hast noch keinen Plan gewählt. Öffne einen Vorschlag und tippe auf «Plan wählen».</Notice>
        <button type="button" className="btn btn-dark" onClick={() => navigate('thursday')}>
          Zu den Vorschlägen
        </button>
      </>
    );
  }

  if (outcome.status === 'past') {
    return (
      <>
        {head}
        <Notice>Dein Plan war am {DAY_LABEL[outcome.chosen.day]}. Wie lief es?</Notice>
        <button type="button" className="btn btn-primary" onClick={() => navigate('feedback')}>
          Feedback geben
        </button>
      </>
    );
  }

  const { chosen, result, weather, plan } = outcome;
  const riskMissing = result.status === 'switch' && result.reason === CHECK_REASON.riskMissing;
  const weatherNote = weather.error ? (
    <Notice tone="warn">
      {weather.fetchedAt ? `Offline: Wetter vom ${formatClock(weather.fetchedAt)}.` : 'Keine aktuellen Wetterdaten.'} ({weather.error})
    </Notice>
  ) : null;

  if (result.status === 'holds') {
    const p = result.plan;
    const dep = departure(p);
    return (
      <>
        {head}
        <h2 className="verdict">{CHECK_HOLDS}</h2>
        <div className="card">
          <span className="overline-sm">
            {p.activityLabel} · {DAY_LABEL[p.day]}
          </span>
          <span className="card-title">{p.candidateName}</span>
          <span className="card-text">
            Prognose stabil{p.risk.color ? `, weiter ${p.risk.color === 'green' ? 'grün' : p.risk.color === 'orange' ? 'orange' : 'rot'}` : ''}.
            {dep !== undefined ? ` Abfahrt ${formatTime(dep)}.` : ''}
          </span>
        </div>
        <RiskBlock risk={p.risk} />
        {weatherNote}
        <button type="button" className="btn btn-dark" onClick={() => navigate('detail', { id: chosen.id })}>
          Plan öffnen ›
        </button>
        <button type="button" className="back-link" onClick={reload}>
          Neu prüfen
        </button>
      </>
    );
  }

  const adopt = async () => {
    if (!result.alternative) return;
    await adoptAlternative(db, plan.weekend, result.alternative);
    showToast('Plan B ist jetzt dein Plan.');
    navigate('detail', { id: result.alternative.id });
  };

  return (
    <>
      {head}
      <h2 className="verdict switch">{CHECK_SWITCH}</h2>
      <span className="small">
        <strong>{chosen.activityLabel} {chosen.candidateName}</strong> ({DAY_LABEL[chosen.day]}) – Grund: {result.reason}
      </span>
      {riskMissing && (
        <Notice tone="warn">
          Trage die Skitourenguru-Farben von heute ein, dann prüfe neu. Ohne aktuelle Farbe bleibt die Tour gesperrt.
          <div className="row" style={{ marginTop: 10 }}>
            <button type="button" className="btn" onClick={() => navigate('thursday', { colours: '1' })}>
              Farben eintragen
            </button>
            <button type="button" className="btn" onClick={reload}>
              Neu prüfen
            </button>
          </div>
        </Notice>
      )}
      {weatherNote}
      {result.alternative ? (
        <>
          <SuggestionCard s={result.alternative} replaces={chosen} linked={false} />
          <button type="button" className="btn btn-primary" onClick={() => void adopt()}>
            Plan B übernehmen
          </button>
        </>
      ) : (
        <Notice>Für {DAY_LABEL[chosen.day]} passt gerade keine Alternative. Vielleicht ist es ein Ruhetag.</Notice>
      )}
      {!riskMissing && (
        <button type="button" className="back-link" onClick={reload}>
          Neu prüfen
        </button>
      )}
    </>
  );
}
