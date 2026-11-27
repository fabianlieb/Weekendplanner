import { getDb } from '../../data/db';
import { listFeedback } from '../../data/repositories';
import { feedbackAdjustment } from '../../engine/fit';
import { feedbackStats } from '../../engine/stats';
import { shortDate } from '../../engine/texts';
import { PageHead, Section, useAsync } from '../components';
import { navigate } from '../router';

/** Test phase: 8 weekends, success at ≥ 50 % implemented and Ø ≥ 2 fitting suggestions. */
const TEST_WEEKENDS = 8;
const TARGET_RATE = 0.5;
const TARGET_FITTING = 2;

const STRICTNESS = { too_easy: 'zu leicht', fitting: 'passend', too_hard: 'zu streng' } as const;

export function StatsView() {
  const db = getDb();
  const { data: feedback } = useAsync(() => listFeedback(db), []);
  if (!feedback) return null;
  const s = feedbackStats(feedback);
  const adj = feedbackAdjustment(feedback);
  const pct = (x: number | undefined) => (x === undefined ? '–' : `${Math.round(x * 100)} %`);

  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate('profile')}>
        ‹ Profil
      </button>
      <PageHead overline="Testphase" title="Auswertung" lead={`${s.weekends} von ${TEST_WEEKENDS} Testwochenenden erfasst`} />

      <div className="stats">
        <div className="stat">
          <span className="value">{pct(s.implementationRate)}</span>
          <span className="label">Umsetzungsrate · Ziel ≥ {Math.round(TARGET_RATE * 100)} %</span>
        </div>
        <div className="stat">
          <span className="value">{s.averageFitting === undefined ? '–' : s.averageFitting.toFixed(1)}</span>
          <span className="label">Ø passende Vorschläge · Ziel ≥ {TARGET_FITTING}</span>
        </div>
      </div>
      <span className="small">
        Umgesetzt: {s.implemented} von {s.weekends}. Kondition durch Feedback angepasst: {adj === 0 ? 'nein' : `${adj > 0 ? '+' : ''}${Math.round(adj * 100)} %`}.
      </span>

      <Section title="Wochenenden">
        {feedback.length === 0 && <span className="small muted">Noch kein Feedback.</span>}
        <div className="list">
          {[...feedback].reverse().map((f) => (
            <div key={f.weekend} className="list-item">
              <div className="grow stack-sm" style={{ gap: 2 }}>
                <strong className="small">{shortDate(f.weekend)}</strong>
                <span className="tiny muted">
                  {f.implemented ? 'umgesetzt' : `nicht umgesetzt${f.reasonIfNot ? ` (${f.reasonIfNot})` : ''}`}
                  {f.strictness ? ` · ${STRICTNESS[f.strictness]}` : ''}
                </span>
              </div>
              <span className="small">{f.fittingSuggestions} / 3</span>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
