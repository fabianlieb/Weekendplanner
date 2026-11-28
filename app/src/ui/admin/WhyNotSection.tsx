// «Warum nicht vorgeschlagen?» for one place: evaluated on demand with this weekend's settings
// (same rules as the suggestions). Shows the reasons per day, or why a possible option lost.
import { useState } from 'react';
import { getDb } from '../../data/db';
import { explainCandidate, type WhyNot } from '../../data/planner';
import { DAY_SHORT } from '../../engine/texts';
import type { DayKey, Exclusion, ExclusionReason } from '../../engine/types';
import { Section } from '../components';
import { dayWithDate, formatDuration } from '../format';
import { navigate } from '../router';

const WHY: Record<ExclusionReason, string> = {
  inactive: 'ausgeblendet («Nicht vorschlagen»)',
  activity_disabled: 'Sportart im Profil ausgeschaltet',
  too_difficult: 'schwieriger als im Profil erlaubt',
  equipment_missing: 'Material fehlt laut Profil',
  risk_unknown: 'keine Skitourenguru-Farbe von heute',
  risk_stale: 'keine Skitourenguru-Farbe von heute',
  risk_above_level: 'Risiko über deiner Stufe im Profil',
  risk_red_unconfirmed: 'rot – nur mit Bestätigung «geschulte Gruppe»',
  travel_too_long: 'Anreise zu lang',
  travel_unknown: 'kein Startpunkt',
  time_budget: 'passt nicht ins Zeitbudget',
  day_free: 'Tag ist als frei markiert',
  start_too_early: 'Start wäre vor deiner frühesten Abfahrt',
  daylight: 'zu lang fürs Tageslicht',
  fitness: 'über deiner Kondition und Tagesform',
  weather_missing: 'keine Wetterdaten',
  weather_knockout: 'Sturm',
  conditions_poor: 'Wetter und Bedingungen zu schlecht',
  snow_low: 'zu wenig Schnee laut SLF-Messstation',
};

/** Reasons per day, merged over the time slots of that day. */
function byDay(excluded: readonly Exclusion[]): [DayKey, string[]][] {
  const m = new Map<DayKey, Set<string>>();
  for (const e of excluded) {
    const set = m.get(e.day) ?? new Set<string>();
    for (const r of e.reasons) set.add(WHY[r]);
    m.set(e.day, set);
  }
  return [...m.entries()].map(([d, s]) => [d, [...s]]);
}

function Result({ r }: { r: WhyNot }) {
  if (r.status === 'no_plan') return <span className="small">Noch keine Vorschläge für dieses Wochenende.</span>;
  if (r.status === 'not_found') return <span className="small">Ort nicht gefunden.</span>;
  if (r.status === 'suggested') {
    return (
      <div className="stack-sm">
        <span className="small">
          {r.planB ? 'Ist Plan B' : 'Ist vorgeschlagen'}: {dayWithDate(r.suggestion.day, r.suggestion.date)}, {r.suggestion.activityLabel}.
        </span>
        <button type="button" className="btn" onClick={() => navigate('detail', { id: r.suggestion.id })}>
          Detailplan öffnen
        </button>
      </div>
    );
  }
  const travel = r.travel;
  const travelText = travel
    ? `Anreise ${Number.isFinite(travel.minutes) ? formatDuration(travel.minutes) : 'mit ÖV nicht erreichbar'} ${travel.mode === 'transit' ? 'ÖV' : 'Auto'}${travel.estimated ? ' (geschätzt)' : ''}.`
    : undefined;
  const best = r.valid[0];
  return (
    <div className="stack-sm">
      {byDay(r.excluded).map(([day, reasons]) => (
        <span key={day} className="small">
          <strong>{DAY_SHORT[day]}:</strong> {reasons.join(', ')}.
        </span>
      ))}
      {best && (
        <span className="small">
          <strong>Möglich</strong> am {DAY_SHORT[best.option.day]} mit {best.suggestion.score} Punkten
          {r.bar !== undefined
            ? best.suggestion.score < r.bar
              ? ` – die Vorschläge hatten mindestens ${r.bar}.`
              : ' – gut bewertet, fiel aber wegen der Abwechslung weg (ähnliche Sportart, gleicher Tag oder Ort in der Nähe).'
            : '.'}
        </span>
      )}
      {best && !r.inPool && (
        <span className="small muted">
          Wurde beim Vorschlagen nicht geprüft: Pro Sportart kommen nur die nächstgelegenen Orte in die Auswahl. Gemerkte Orte (Stern) werden immer geprüft.
        </span>
      )}
      {travelText && <span className="tiny muted">{travelText}</span>}
      <span className="tiny muted">Geprüft mit den Einstellungen dieses Wochenendes und dem aktuellen Wetter.</span>
    </div>
  );
}

export function WhyNotSection({ candidateId }: { candidateId: string }) {
  const [state, setState] = useState<WhyNot | 'loading' | 'error'>();
  const run = async () => {
    setState('loading');
    try {
      setState(await explainCandidate(getDb(), candidateId));
    } catch {
      setState('error');
    }
  };
  return (
    <Section title="Dieses Wochenende">
      {state === undefined && (
        <button type="button" className="btn" onClick={() => void run()}>
          Warum nicht vorgeschlagen?
        </button>
      )}
      {state === 'loading' && <span className="small muted">Wird geprüft …</span>}
      {state === 'error' && <span className="small muted">Prüfung gerade nicht möglich (offline?).</span>}
      {state && state !== 'loading' && state !== 'error' && <Result r={state} />}
    </Section>
  );
}
