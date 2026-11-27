// Home screen. Top to bottom: feedback prompt (Sun evening–Wed), «Dein Plan» with the evening
// check, one compact settings line, today's Skitourenguru colours (collapsed), suggestions.
// Stored suggestions show at once; they update automatically once per morning, otherwise manually.

import { useEffect, useRef, useState } from 'react';
import { getDb, type WeekendPlan } from '../../data/db';
import { HERE, chosenSuggestion, computeSuggestions, currentWeekendPlan, feedbackWeekend, needsAutoCompute, resolveStartPoint } from '../../data/planner';
import { DEFAULT_INPUT, getLastInput, getProfile, getWeekendPlan, listCandidates, riskEntriesOn, saveLastInput } from '../../data/repositories';
import { asksTrainedGroup } from '../../engine/profile';
import { needsAvalancheRating } from '../../engine/risk';
import { TRAINED_GROUP_QUESTION, shortDate } from '../../engine/texts';
import type { Candidate, DayForm, MaxTravelHours, Profile, TimeBudget, WeekendInput } from '../../engine/types';
import { upcomingWeekend, weekday, zurichHour, zurichToday } from '../../engine/util';
import { Choice, Notice, PageHead, Section } from '../components';
import { formatClock } from '../format';
import { RefreshIcon } from '../icons';
import { BUDGET_LABEL, DAY_FORM_LABEL } from '../labels';
import { currentPosition } from '../location';
import { navigate } from '../router';
import { ColourEntry } from './ColourEntry';
import { PlanCard } from './PlanCard';
import { SuggestionList } from './SuggestionList';

const WEEKDAY = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const BUDGETS: TimeBudget[] = ['full', 'half', 'free'];
const FORMS: DayForm[] = ['easy', 'normal', 'strong'];
const BUDGET_SHORT: Record<TimeBudget, string> = { full: 'ganz', half: 'halb', free: 'frei' };

interface Loaded {
  profile: Profile;
  candidates: Candidate[];
  feedbackDue?: string;
}

export function WeekendView({ params }: { params: Record<string, string> }) {
  const db = getDb();
  const today = zurichToday();
  const hour = zurichHour();
  const weekend = upcomingWeekend(today);
  const [data, setData] = useState<Loaded>();
  const [plan, setPlan] = useState<WeekendPlan>();
  const [input, setInput] = useState<WeekendInput>();
  const [trained, setTrained] = useState<boolean>();
  const [panel, setPanel] = useState(false);
  const [colours, setColours] = useState(params.colours === '1');
  const [coloursChanged, setColoursChanged] = useState(false);
  const [colourCount, setColourCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const started = useRef(false);

  const countColours = async (candidates: Candidate[]) => {
    const entries = await riskEntriesOn(db, today);
    setColourCount(candidates.filter((c) => c.active && needsAvalancheRating(c) && entries.some((e) => e.candidateId === c.id)).length);
  };

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
        { ...inp, startPointId: r.startPoint.id, trainedGroupConfirmed: asksTrainedGroup(profile) && trained === true },
        r.adhoc ? { extraStartPoint: r.startPoint } : {},
      );
      await saveLastInput(db, inp);
      setPlan(res.plan);
      setPanel(false);
      setColours(false);
      setColoursChanged(false);
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
      const [profile, last, candidates, existing] = await Promise.all([getProfile(db), getLastInput(db), listCandidates(db), currentWeekendPlan(db)]);
      // Feedback prompt: Sunday evening to Wednesday, if last weekend had a chosen plan without feedback.
      const fbWeekend = feedbackWeekend(today);
      const wd = weekday(today);
      const fbTime = (wd === 0 && hour >= 17) || (wd >= 1 && wd <= 3);
      const fbPlan = fbTime ? await getWeekendPlan(db, fbWeekend) : undefined;
      const feedbackDue = fbPlan?.chosenId && !(await db.feedback.get(fbWeekend)) ? fbWeekend : undefined;
      setData({ profile, candidates, ...(feedbackDue ? { feedbackDue } : {}) });
      await countColours(candidates);
      const choice = last && (last.startPointId === HERE || profile.startPoints.some((s) => s.id === last.startPointId)) ? last.startPointId : HERE;
      const inp: WeekendInput = { ...DEFAULT_INPUT, ...(last ?? {}), startPointId: choice, trainedGroupConfirmed: false };
      setInput(inp);
      setPlan(existing);
      if (candidates.length > 0 && needsAutoCompute(existing, today, hour)) await compute(inp, profile);
    })();
    // runs once on open
  }, []);

  if (!data || !input) return null;
  const { profile, candidates } = data;
  const set = (patch: Partial<WeekendInput>) => setInput({ ...input, ...patch });
  const nothingPlanned = (!weekend.sat || input.budget.sat === 'free') && input.budget.sun === 'free';
  const head = <PageHead overline={WEEKDAY[weekday(today)]} title="Dein Wochenende" />;

  if (candidates.length === 0) {
    return (
      <>
        {head}
        <Notice>Deine Liste ist leer. Lade die Startliste oder lege eigene Einträge an.</Notice>
        <button type="button" className="btn btn-dark" onClick={() => navigate('list')}>
          Zur Liste
        </button>
      </>
    );
  }

  // One compact line: «Sa ganz · So frei · 2 h · Normal · Zuhause»
  const planInput = plan?.input ?? input;
  const startName =
    plan?.startPoint?.name ?? profile.startPoints.find((s) => s.id === planInput.startPointId)?.name ?? (input.startPointId === HERE ? 'Standort' : '–');
  const settings = [
    ...(weekend.sat ? [`Sa ${BUDGET_SHORT[planInput.budget.sat]}`] : []),
    `So ${BUDGET_SHORT[planInput.budget.sun]}`,
    `${planInput.maxTravelHours} h`,
    DAY_FORM_LABEL[planInput.dayForm],
    startName,
  ].join(' · ');

  const chosen = plan ? chosenSuggestion(plan) : undefined;
  const allTours = candidates.filter((c) => c.active && profile.activities[c.kind === 'ski_tour' ? 'ski_tour' : 'snowshoe'].enabled && needsAvalancheRating(c));
  const awaiting = (plan?.awaitingColour ?? []).map((id) => candidates.find((c) => c.id === id)).filter((c): c is Candidate => !!c);
  // Tours waiting for a colour first; if none wait, all tours (to correct an entry).
  const colourTours = awaiting.length ? awaiting : allTours;

  return (
    <>
      {head}

      {data.feedbackDue && (
        <div className="prompt-card">
          <span className="small">
            <strong>Wie war dein Wochenende vom {shortDate(data.feedbackDue)}?</strong> 3 kurze Fragen.
          </span>
          <button type="button" className="btn btn-primary" onClick={() => navigate('feedback')}>
            Feedback
          </button>
        </div>
      )}

      {plan && chosen && <PlanCard plan={plan} chosen={chosen} candidate={candidates.find((c) => c.id === chosen.candidateId)} today={today} hour={hour} />}

      <div className="settings-bar">
        <button type="button" className="settings-text" aria-expanded={panel} onClick={() => setPanel(!panel)}>
          <span className="small">{settings}</span>
          <span className="settings-edit">{panel ? 'Schliessen' : 'Anpassen'}</span>
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
          </Section>
          {asksTrainedGroup(profile) && (
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

      {allTours.length > 0 && (
        <div className={`colour-block${awaiting.length ? ' due' : ''}`}>
          <button type="button" className="colour-head" aria-expanded={colours} onClick={() => setColours(!colours)}>
            <span className="small grow">
              {awaiting.length ? (
                <>
                  <strong>{awaiting.length === 1 ? '1 passende Tour wartet' : `${awaiting.length} passende Touren warten`}</strong> auf die Skitourenguru-Farbe von heute
                </>
              ) : (
                <>
                  Skitourenguru-Farben von heute: {colourCount} von {allTours.length}
                </>
              )}
            </span>
            <span className="settings-edit">{colours ? 'Schliessen' : awaiting.length ? 'Eintragen' : 'Ändern'}</span>
          </button>
          {colours && (
            <>
              <ColourEntry
                tours={colourTours}
                onChange={() => {
                  setColoursChanged(true);
                  void countColours(candidates);
                }}
              />
              {coloursChanged && (
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void compute(input, profile)}>
                  {busy ? 'Wetter wird geladen …' : 'Mit diesen Farben neu vorschlagen'}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {notice && <Notice tone="warn">{notice}</Notice>}
      {error && (
        <div className="errors" role="alert">
          {error}
        </div>
      )}

      {plan && <SuggestionList plan={plan} />}
      {!plan && busy && <span className="small muted">Vorschläge werden berechnet …</span>}

      <div className="status-line">
        <span className="tiny muted grow">
          {busy ? 'Aktualisiere mit aktuellem Wetter …' : plan ? `Stand ${formatClock(plan.createdAt)} · aktualisiert sich jeden Morgen` : ''}
        </span>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void compute(input, profile)}>
          <RefreshIcon /> Aktualisieren
        </button>
      </div>
    </>
  );
}
