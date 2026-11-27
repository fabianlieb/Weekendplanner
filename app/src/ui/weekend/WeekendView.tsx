// Weekend screen: suggestions right away with the last settings and the current location.
// «Anpassen» opens the 4 inputs; «Neu vorschlagen» recomputes.

import { useEffect, useRef, useState } from 'react';
import { getDb, type WeekendPlan } from '../../data/db';
import { HERE, computeSuggestions, currentWeekendPlan, needsAutoCompute, resolveStartPoint } from '../../data/planner';
import { DEFAULT_INPUT, getLastInput, getProfile, listCandidates, riskEntriesOn, saveLastInput } from '../../data/repositories';
import { needsAvalancheRating } from '../../engine/risk';
import { TRAINED_GROUP_QUESTION, shortDate } from '../../engine/texts';
import type { Candidate, DayForm, MaxTravelHours, Profile, TimeBudget, WeekendInput } from '../../engine/types';
import { upcomingWeekend, weekday, zurichToday } from '../../engine/util';
import { Choice, Notice, PageHead, Section } from '../components';
import { BUDGET_LABEL, DAY_FORM_LABEL } from '../labels';
import { currentPosition } from '../location';
import { navigate } from '../router';
import { SuggestionList } from './SuggestionList';

const WEEKDAY = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const BUDGETS: TimeBudget[] = ['full', 'half', 'free'];
const FORMS: DayForm[] = ['easy', 'normal', 'strong'];
const BUDGET_SHORT: Record<TimeBudget, string> = { full: 'ganzer Tag', half: 'halber Tag', free: 'frei' };

interface Loaded {
  profile: Profile;
  candidates: Candidate[];
  toursWithColour: number;
  tours: number;
}

export function WeekendView() {
  const db = getDb();
  const today = zurichToday();
  const weekend = upcomingWeekend(today);
  const [data, setData] = useState<Loaded>();
  const [plan, setPlan] = useState<WeekendPlan>();
  const [input, setInput] = useState<WeekendInput>();
  const [trained, setTrained] = useState<boolean>();
  const [panel, setPanel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const started = useRef(false);

  const compute = async (inp: WeekendInput, profile: Profile) => {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const pos = inp.startPointId === HERE ? await currentPosition() : undefined;
      const r = resolveStartPoint(inp.startPointId, profile.startPoints, pos);
      if (!r.startPoint) {
        setError('Kein Startpunkt: Standort freigeben oder im Profil einen Startpunkt anlegen.');
        return;
      }
      if (inp.startPointId === HERE && !pos) setNotice(`Standort nicht verfügbar – gerechnet ab ${r.startPoint.name}.`);
      const res = await computeSuggestions(
        db,
        { ...inp, startPointId: r.startPoint.id, trainedGroupConfirmed: profile.riskLevel === 3 && trained === true },
        r.adhoc ? { extraStartPoint: r.startPoint } : {},
      );
      await saveLastInput(db, inp);
      setPlan(res.plan);
      setPanel(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const [profile, last, candidates, risks, existing] = await Promise.all([getProfile(db), getLastInput(db), listCandidates(db), riskEntriesOn(db, today), currentWeekendPlan(db)]);
      const tours = candidates.filter((c) => c.active && needsAvalancheRating(c));
      setData({ profile, candidates, tours: tours.length, toursWithColour: tours.filter((t) => risks.some((r) => r.candidateId === t.id)).length });
      const choice = last && (last.startPointId === HERE || profile.startPoints.some((s) => s.id === last.startPointId)) ? last.startPointId : HERE;
      const inp: WeekendInput = { ...DEFAULT_INPUT, ...(last ?? {}), startPointId: choice, trainedGroupConfirmed: false };
      setInput(inp);
      setPlan(existing);
      if (candidates.length > 0 && needsAutoCompute(existing, today)) await compute(inp, profile);
    })();
    // runs once on open
  }, []);

  if (!data || !input) return null;
  const { profile, candidates } = data;
  const set = (patch: Partial<WeekendInput>) => setInput({ ...input, ...patch });
  const nothingPlanned = (!weekend.sat || input.budget.sat === 'free') && input.budget.sun === 'free';

  if (candidates.length === 0) {
    return (
      <>
        <PageHead overline={WEEKDAY[weekday(today)]} title="Dein Wochenende" />
        <Notice>Deine Liste ist leer. Lade die Startliste oder lege eigene Einträge an.</Notice>
        <button type="button" className="btn btn-dark" onClick={() => navigate('admin', { tab: 'list' })}>
          Zur Liste
        </button>
      </>
    );
  }

  // Settings line: «Sa ganzer Tag · So frei · max. 2 h · Normal · ab Zuhause (Standort)»
  const planInput = plan?.input ?? input;
  const startName =
    plan?.startPoint?.name ?? profile.startPoints.find((s) => s.id === planInput.startPointId)?.name ?? (input.startPointId === HERE ? 'Standort' : '–');
  const settings = [
    ...(weekend.sat ? [`Sa ${BUDGET_SHORT[planInput.budget.sat]}`] : []),
    `So ${BUDGET_SHORT[planInput.budget.sun]}`,
    `max. ${planInput.maxTravelHours} h`,
    DAY_FORM_LABEL[planInput.dayForm],
    `ab ${startName}${input.startPointId === HERE && startName !== 'Standort' ? ' (Standort)' : ''}`,
  ].join(' · ');

  return (
    <>
      <PageHead overline={WEEKDAY[weekday(today)]} title="Dein Wochenende" />

      <div className="settings-bar">
        <span className="small grow">{settings}</span>
        <button type="button" className="btn" aria-expanded={panel} onClick={() => setPanel(!panel)}>
          {panel ? 'Schliessen' : 'Anpassen'}
        </button>
      </div>

      {panel && (
        <div className="panel stack">
          <Section title="Zeitbudget">
            {weekend.sat && (
              <div className="row">
                <span className="choice-label">Samstag</span>
                <div className="grow">
                  <Choice<TimeBudget>
                    className="compact"
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
                  className="compact"
                  label="Zeitbudget Sonntag"
                  options={BUDGETS.map((b) => ({ value: b, label: BUDGET_LABEL[b] }))}
                  value={input.budget.sun}
                  onChange={(sun) => set({ budget: { ...input.budget, sun } })}
                />
              </div>
            </div>
          </Section>
          <Section title="Anreise max.">
            <Choice<MaxTravelHours>
              label="Anreise maximal"
              options={([1, 2, 3] as MaxTravelHours[]).map((h) => ({ value: h, label: `${h} h` }))}
              value={input.maxTravelHours}
              onChange={(maxTravelHours) => set({ maxTravelHours })}
            />
          </Section>
          <Section title="Tagesform">
            <Choice<DayForm> label="Tagesform" options={FORMS.map((f) => ({ value: f, label: DAY_FORM_LABEL[f] }))} value={input.dayForm} onChange={(dayForm) => set({ dayForm })} />
          </Section>
          <Section title="Startpunkt">
            <Choice<string>
              label="Startpunkt"
              wrap={profile.startPoints.length > 2}
              options={[{ value: HERE, label: 'Standort' }, ...profile.startPoints.map((s) => ({ value: s.id, label: s.name }))]}
              value={input.startPointId}
              onChange={(startPointId) => set({ startPointId })}
            />
            {input.startPointId === HERE && (
              <span className="tiny muted">
                Nahe bei einem gespeicherten Startpunkt (unter 10 km) gelten dessen Anreisezeiten, sonst wird ab dem Standort geschätzt. Der Standort bleibt auf dem Gerät.
              </span>
            )}
          </Section>
          {profile.riskLevel === 3 && (
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
              <span className="tiny muted">Nur mit «Ja» erscheinen rote Touren – nur in Gruppen mit geschulten Leuten, nie allein.</span>
            </Section>
          )}
          <button type="button" className="btn btn-primary" disabled={busy || nothingPlanned} onClick={() => void compute(input, profile)}>
            {busy ? 'Wetter wird geladen …' : 'Neu vorschlagen'}
          </button>
          {nothingPlanned && <span className="tiny muted">Beide Tage sind frei – keine Vorschläge nötig.</span>}
        </div>
      )}

      {data.tours > 0 && (
        <div className="row small">
          <span className="grow">
            Skitourenguru-Farben von heute: <strong>{data.toursWithColour} von {data.tours}</strong>
            {data.toursWithColour < data.tours && <span className="muted"> – Touren ohne Farbe werden nicht vorgeschlagen.</span>}
          </span>
          <button type="button" className="btn" onClick={() => navigate('admin', { tab: 'risk' })}>
            Eintragen
          </button>
        </div>
      )}

      {notice && <Notice tone="warn">{notice}</Notice>}
      {error && (
        <div className="errors" role="alert">
          {error}
        </div>
      )}

      {busy && !panel && <span className="small muted">Vorschläge werden berechnet …</span>}

      {plan && !busy && (
        <>
          {plan.chosenId && plan.computedOn !== today && (
            <div className="row small">
              <span className="grow muted">Berechnet {shortDate(plan.computedOn)}. Dein Plan ist gewählt, deshalb rechnet die App nicht automatisch neu.</span>
              <button type="button" className="btn" onClick={() => void compute(input, profile)}>
                Neu vorschlagen
              </button>
            </div>
          )}
          <SuggestionList plan={plan} />
        </>
      )}
    </>
  );
}
