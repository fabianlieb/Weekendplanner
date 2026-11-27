// «Dein Plan»: the chosen plan on top of the weekend screen, with the evening check built in.
import type { WeekendPlan } from '../../data/db';
import type { Candidate, PlanB, Suggestion } from '../../engine/types';
import { CHECK_HOLDS } from '../../engine/texts';
import { addDays, formatTime } from '../../engine/util';
import { RiskBadge } from '../components';
import { openCalendarFile } from '../files';
import { dayWithDate, weatherLine } from '../format';
import { googleMapsUrl, navigationTarget } from '../geo';
import { buildIcs } from '../ics';
import { CalendarPlusIcon, NavigateIcon } from '../icons';
import { navigate } from '../router';

/** From this hour on the day before, the evening check is the main action. */
const CHECK_FROM_HOUR = 16;

export function PlanCard({
  plan,
  chosen,
  candidate,
  today,
  hour,
}: {
  plan: WeekendPlan;
  chosen: Suggestion | PlanB;
  candidate: Candidate | undefined;
  today: string;
  hour: number;
}) {
  const departure = chosen.schedule[0];
  const back = chosen.schedule.at(-1);
  const isToday = chosen.date === today;
  const isTomorrow = chosen.date === addDays(today, 1);
  const past = chosen.date < today;
  const checkToday = [...plan.checks].reverse().find((c) => c.date === today);
  const checkTime = isTomorrow && hour >= CHECK_FROM_HOUR;
  const nav = candidate ? navigationTarget(candidate) : undefined;
  const navUrl = nav ? googleMapsUrl(nav.point) : undefined;
  const badge = chosen.risk.applies ? (chosen.risk.color ? undefined : chosen.risk.signposted ? 'signalisiert' : 'unbekannt') : undefined;

  const addToCalendar = () => {
    if (!nav || !navUrl) return;
    const appUrl = `${window.location.origin}${window.location.pathname}?view=detail&id=${encodeURIComponent(chosen.id)}`;
    const ics = buildIcs({ s: chosen, place: { name: `${chosen.candidateName}, ${nav.label}`, lat: nav.point.lat, lon: nav.point.lon }, navigationUrl: navUrl, appUrl });
    openCalendarFile(`wochenende-${chosen.date}.ics`, ics);
  };

  return (
    <section className="plan-card" aria-label="Dein Plan">
      <div className="card-top">
        <span className="overline">{isToday ? 'Heute' : isTomorrow ? 'Morgen' : 'Dein Plan'} · {dayWithDate(chosen.day, chosen.date)}</span>
        {chosen.risk.applies && <RiskBadge {...(chosen.risk.color ? { color: chosen.risk.color } : {})} {...(badge ? { text: badge } : {})} />}
      </div>
      <button type="button" className="plan-title" onClick={() => navigate('detail', { id: chosen.id })}>
        <span className="card-title">{chosen.candidateName}</span>
        <span className="card-sub">{chosen.activityLabel}</span>
      </button>
      {chosen.weather && <span className="card-weather">{weatherLine(chosen.weather, chosen.activity, chosen.slot)}</span>}
      {departure && back && (
        <span className="small">
          <strong>Abfahrt {formatTime(departure.time)}</strong> ab {chosen.travel.startPointName} · zurück {formatTime(back.time)}
        </span>
      )}
      {chosen.risk.applies && chosen.risk.freshnessNote && <span className="tiny muted">{chosen.risk.freshnessNote}</span>}

      {!past && checkToday && (
        <div className={`check-status${checkToday.status === 'switch' ? ' switch' : ''}`}>
          <strong>{checkToday.status === 'holds' ? CHECK_HOLDS : 'Wechsel auf Plan B empfohlen'}</strong>
          {checkToday.reason && <span className="small"> {checkToday.reason}</span>}
        </div>
      )}

      <div className="row">
        {past ? (
          <button type="button" className="btn btn-primary grow" onClick={() => navigate('feedback')}>
            Wie war es? Feedback geben
          </button>
        ) : checkTime && !checkToday ? (
          <button type="button" className="btn btn-primary grow" onClick={() => navigate('check')}>
            Vorabend-Check machen
          </button>
        ) : (
          <button type="button" className="btn btn-dark grow" onClick={() => navigate(checkToday ? 'check' : 'detail', checkToday ? {} : { id: chosen.id })}>
            {checkToday ? 'Check ansehen' : 'Plan öffnen'}
          </button>
        )}
        <button type="button" className="btn btn-icon" aria-label="In Kalender eintragen" title="In Kalender eintragen" disabled={!nav} onClick={addToCalendar}>
          <CalendarPlusIcon />
        </button>
        {navUrl && (
          <a className="btn btn-icon" href={navUrl} target="_blank" rel="noreferrer" aria-label={`Navigation mit Google Maps: ${nav?.label ?? 'Ziel'}`} title="Navigation (Google Maps)">
            <NavigateIcon />
          </a>
        )}
      </div>
    </section>
  );
}
