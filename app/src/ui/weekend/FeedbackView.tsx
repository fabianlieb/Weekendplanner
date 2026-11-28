import { useEffect, useState } from 'react';
import { getDb } from '../../data/db';
import { chosenSuggestion, feedbackWeekend } from '../../data/planner';
import { getWeekendPlan, saveFeedback } from '../../data/repositories';
import { shortDate } from '../../engine/texts';
import type { Feedback, Strictness, SuggestionRating } from '../../engine/types';
import { DAY_SHORT } from '../../engine/texts';
import { addDays, zurichToday } from '../../engine/util';
import { Choice, Field, PageHead, Section, showToast, useAsync } from '../components';
import { navigate } from '../router';

const REASONS = ['Wetter', 'Zeit', 'Energie', 'Risiko', 'Anderes'] as const;

export function FeedbackView() {
  const db = getDb();
  const weekend = feedbackWeekend(zurichToday());
  const { data } = useAsync(async () => {
    const [existing, plan] = await Promise.all([db.feedback.get(weekend), getWeekendPlan(db, weekend)]);
    return { existing, plan };
  }, [weekend]);
  const [implemented, setImplemented] = useState<boolean>();
  const [reason, setReason] = useState<string>();
  const [reasonText, setReasonText] = useState('');
  const [fitting, setFitting] = useState<Feedback['fittingSuggestions']>();
  const [ratings, setRatings] = useState<Record<string, boolean>>({});
  const [strictness, setStrictness] = useState<Strictness>();

  useEffect(() => {
    const f = data?.existing;
    if (!f) return;
    setImplemented(f.implemented);
    setFitting(f.fittingSuggestions);
    if (f.ratings) setRatings(Object.fromEntries(f.ratings.map((r) => [r.suggestionId, r.fits])));
    if (f.strictness) setStrictness(f.strictness);
    if (f.reasonIfNot) {
      const chip = REASONS.find((r) => f.reasonIfNot?.startsWith(r));
      setReason(chip);
      setReasonText(chip ? f.reasonIfNot.slice(chip.length).replace(/^:\s*/, '') : f.reasonIfNot);
    }
  }, [data]);

  if (!data) return null;
  const chosen = data.plan ? chosenSuggestion(data.plan) : undefined;
  // Rate each of the (up to) 3 suggestions; the count of fitting ones follows from that.
  const rateable = data.plan?.suggestions.slice(0, 3) ?? [];
  const perSuggestion = rateable.length > 0;
  const allRated = rateable.every((s) => ratings[s.id] !== undefined);
  const fittingNow = (perSuggestion ? rateable.filter((s) => ratings[s.id]).length : fitting) as Feedback['fittingSuggestions'] | undefined;
  const complete = implemented !== undefined && (perSuggestion ? allRated : fitting !== undefined) && (!implemented || strictness !== undefined);

  const save = async () => {
    if (implemented === undefined || fittingNow === undefined) return;
    const why = [reason, reasonText.trim()].filter(Boolean).join(': ');
    const rated: SuggestionRating[] = rateable.map((s) => ({ suggestionId: s.id, candidateId: s.candidateId, activity: s.activity, fits: ratings[s.id] === true }));
    await saveFeedback(db, {
      weekend,
      implemented,
      fittingSuggestions: fittingNow,
      ...(perSuggestion ? { ratings: rated } : {}),
      ...(implemented && strictness ? { strictness } : {}),
      ...(!implemented && why ? { reasonIfNot: why } : {}),
    });
    showToast('Danke! Feedback gespeichert.');
    navigate('stats');
  };

  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate('thursday')}>
        ‹ Wochenende
      </button>
      <PageHead
        overline="Sonntagabend · Feedback"
        title="Wie war dein Wochenende?"
        lead={`Wochenende ${shortDate(weekend)} – ${shortDate(addDays(weekend, 1))}${chosen ? ` · Plan: ${chosen.activityLabel} ${chosen.candidateName}` : ''}`}
      />
      {data.existing && <span className="tiny muted">Schon erfasst – du kannst es hier ändern.</span>}

      <Section title="Hast du den Plan umgesetzt?">
        <Choice<'yes' | 'no'>
          label="Plan umgesetzt"
          options={[
            { value: 'yes', label: 'Ja' },
            { value: 'no', label: 'Nein' },
          ]}
          value={implemented === undefined ? undefined : implemented ? 'yes' : 'no'}
          onChange={(v) => setImplemented(v === 'yes')}
        />
        {implemented === false && (
          <>
            <Choice<string> label="Grund" wrap options={REASONS.map((r) => ({ value: r, label: r }))} value={reason} onChange={setReason} />
            <Field label="Kurz notieren (optional)" htmlFor="fb-why">
              <input id="fb-why" className="input" value={reasonText} onChange={(e) => setReasonText(e.target.value)} />
            </Field>
          </>
        )}
      </Section>

      <Section title="Haben die Vorschläge gepasst?" aside={perSuggestion ? `${rateable.filter((s) => ratings[s.id]).length} von ${rateable.length} passend` : undefined}>
        {perSuggestion ? (
          rateable.map((s) => (
            <div key={s.id} className="rate-row">
              <span className="small grow">
                <strong>{s.candidateName}</strong>
                <span className="muted">
                  {' '}
                  {DAY_SHORT[s.day]} · {s.activityLabel}
                </span>
              </span>
              <Choice<'yes' | 'no'>
                className="compact rate-choice"
                label={`${s.candidateName} passend`}
                options={[
                  { value: 'yes', label: 'Passt' },
                  { value: 'no', label: 'Passt nicht' },
                ]}
                value={ratings[s.id] === undefined ? undefined : ratings[s.id] ? 'yes' : 'no'}
                onChange={(v) => setRatings({ ...ratings, [s.id]: v === 'yes' })}
              />
            </div>
          ))
        ) : (
        <Choice<Feedback['fittingSuggestions']>
          label="Passende Vorschläge"
          wrap
          options={[
            { value: 0, label: 'Keiner' },
            { value: 1, label: '1 passte' },
            { value: 2, label: '2 passten' },
            { value: 3, label: 'Alle 3' },
          ]}
          value={fitting}
          onChange={setFitting}
        />
        )}
      </Section>

      {implemented && (
        <Section title="Wie streng war die Tour?">
          <Choice<Strictness>
            label="Strenge"
            options={[
              { value: 'too_easy', label: 'Zu leicht' },
              { value: 'fitting', label: 'Passend' },
              { value: 'too_hard', label: 'Zu streng' },
            ]}
            value={strictness}
            onChange={setStrictness}
          />
          <span className="tiny muted">«Zu leicht» oder «zu streng» verschiebt deine Kondition leicht (je 5 %, höchstens 15 %).</span>
        </Section>
      )}

      <button type="button" className="btn btn-primary" disabled={!complete} onClick={() => void save()}>
        Feedback speichern
      </button>
      <button type="button" className="back-link" onClick={() => navigate('stats')}>
        Auswertung ansehen ›
      </button>
    </>
  );
}
