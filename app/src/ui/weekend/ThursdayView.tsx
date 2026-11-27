import { useEffect, useState } from 'react';
import { getDb } from '../../data/db';
import { computeSuggestions, currentWeekendPlan } from '../../data/planner';
import { DEFAULT_INPUT, getLastInput, getProfile, listCandidates, riskEntriesOn } from '../../data/repositories';
import { needsAvalancheRating } from '../../engine/risk';
import { TRAINED_GROUP_QUESTION, shortDate } from '../../engine/texts';
import type { DayForm, MaxTravelHours, TimeBudget, WeekendInput } from '../../engine/types';
import { upcomingWeekend, weekday, zurichToday } from '../../engine/util';
import { Choice, Notice, PageHead, Section, useAsync } from '../components';
import { BUDGET_LABEL, DAY_FORM_LABEL } from '../labels';
import { navigate } from '../router';

const WEEKDAY = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const BUDGETS: TimeBudget[] = ['full', 'half', 'free'];
const FORMS: DayForm[] = ['easy', 'normal', 'strong'];

export function ThursdayView() {
  const db = getDb();
  const today = zurichToday();
  const weekend = upcomingWeekend(today);
  const { data } = useAsync(async () => {
    const [profile, last, candidates, risks, plan] = await Promise.all([getProfile(db), getLastInput(db), listCandidates(db), riskEntriesOn(db, today), currentWeekendPlan(db)]);
    return { profile, last, candidates, risks, plan };
  }, [today]);
  const [input, setInput] = useState<WeekendInput>();
  const [trained, setTrained] = useState<boolean>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!data) return;
    const sp = data.profile.startPoints;
    const lastStart = data.last && sp.some((s) => s.id === data.last?.startPointId) ? data.last.startPointId : sp[0]?.id ?? '';
    setInput({ ...DEFAULT_INPUT, ...(data.last ?? {}), startPointId: lastStart, trainedGroupConfirmed: false });
  }, [data]);

  if (!data || !input) return null;
  const { profile, candidates, risks, plan } = data;
  const tours = candidates.filter((c) => c.active && needsAvalancheRating(c));
  const toursWithColour = tours.filter((t) => risks.some((r) => r.candidateId === t.id)).length;
  const askTrained = profile.riskLevel === 3;
  const nothingPlanned = (!weekend.sat || input.budget.sat === 'free') && input.budget.sun === 'free';
  const set = (patch: Partial<WeekendInput>) => setInput({ ...input, ...patch });

  const run = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const res = await computeSuggestions(db, { ...input, trainedGroupConfirmed: askTrained && trained === true });
      if (res.weather.error && !res.weather.fetchedAt) setError(`Keine Wetterdaten: ${res.weather.error}`);
      navigate('suggestions');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (profile.startPoints.length === 0 || candidates.length === 0) {
    return (
      <>
        <PageHead overline="Donnerstag" title="Dein Wochenende" />
        <Notice>
          {profile.startPoints.length === 0 ? 'Lege zuerst im Profil einen Startpunkt an.' : 'Deine Liste ist leer. Lade die Startliste oder lege eigene Einträge an.'}
        </Notice>
        <button type="button" className="btn btn-dark" onClick={() => navigate('admin', { tab: profile.startPoints.length === 0 ? 'profile' : 'list' })}>
          Zur Verwaltung
        </button>
      </>
    );
  }

  return (
    <>
      <PageHead overline={WEEKDAY[weekday(today)]} title="Dein Wochenende" lead="4 Angaben, dann kommen die Vorschläge." />

      <Section title="1 · Zeitbudget">
        {weekend.sat && (
          <div className="row">
            <span className="choice-label">Samstag</span>
            <div className="grow">
              <Choice<TimeBudget>
                label="Zeitbudget Samstag"
                options={BUDGETS.map((b) => ({ value: b, label: BUDGET_LABEL[b] }))}
                value={input.budget.sat}
                onChange={(sat) => set({ budget: { ...input.budget, sat } })}
              />
            </div>
          </div>
        )}
        <div className="row">
          <span className="choice-label">Sonntag</span>
          <div className="grow">
            <Choice<TimeBudget>
              label="Zeitbudget Sonntag"
              options={BUDGETS.map((b) => ({ value: b, label: BUDGET_LABEL[b] }))}
              value={input.budget.sun}
              onChange={(sun) => set({ budget: { ...input.budget, sun } })}
            />
          </div>
        </div>
      </Section>

      <Section title="2 · Anreise max.">
        <Choice<MaxTravelHours>
          label="Anreise maximal"
          options={([1, 2, 3] as MaxTravelHours[]).map((h) => ({ value: h, label: `${h} h` }))}
          value={input.maxTravelHours}
          onChange={(maxTravelHours) => set({ maxTravelHours })}
        />
      </Section>

      <Section title="3 · Tagesform">
        <Choice<DayForm> label="Tagesform" options={FORMS.map((f) => ({ value: f, label: DAY_FORM_LABEL[f] }))} value={input.dayForm} onChange={(dayForm) => set({ dayForm })} />
      </Section>

      <Section title="4 · Startpunkt">
        <Choice<string>
          label="Startpunkt"
          wrap={profile.startPoints.length > 3}
          options={profile.startPoints.map((s) => ({ value: s.id, label: s.name }))}
          value={input.startPointId}
          onChange={(startPointId) => set({ startPointId })}
        />
      </Section>

      {askTrained && (
        <Section title="Rote Touren">
          <span className="small">{TRAINED_GROUP_QUESTION}</span>
          <Choice<'yes' | 'no'>
            label={TRAINED_GROUP_QUESTION}
            options={[
              { value: 'yes', label: 'Ja' },
              { value: 'no', label: 'Nein' },
            ]}
            value={trained === undefined ? undefined : trained ? 'yes' : 'no'}
            onChange={(v) => setTrained(v === 'yes')}
          />
          <span className="tiny muted">Nur mit «Ja» erscheinen rote Touren – nur in Gruppen mit geschulten Leuten, nie allein. Die Antwort gilt nur für dieses Wochenende.</span>
        </Section>
      )}

      {tours.length > 0 && (
        <div className="row small">
          <span className="grow">
            Skitourenguru-Farben von heute: <strong>{toursWithColour} von {tours.length}</strong>
            {toursWithColour < tours.length && <span className="muted"> – Touren ohne Farbe werden nicht vorgeschlagen.</span>}
          </span>
          <button type="button" className="btn" onClick={() => navigate('admin', { tab: 'risk' })}>
            Eintragen
          </button>
        </div>
      )}

      {error && (
        <div className="errors" role="alert">
          {error}
        </div>
      )}
      <button type="button" className="btn btn-primary" disabled={busy || nothingPlanned || !input.startPointId} onClick={() => void run()}>
        {busy ? 'Wetter wird geladen …' : 'Vorschläge zeigen →'}
      </button>
      {nothingPlanned && <span className="tiny muted">Beide Tage sind frei – keine Vorschläge nötig.</span>}
      {plan && plan.suggestions.length > 0 && (
        <button type="button" className="back-link" onClick={() => navigate('suggestions')}>
          Letzte Vorschläge vom {shortDate(plan.computedOn)} ansehen ›
        </button>
      )}
    </>
  );
}
