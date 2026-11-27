import { getDb } from '../../data/db';
import { currentWeekendPlan, findSuggestion } from '../../data/planner';
import { choosePlan } from '../../data/repositories';
import { formatTime } from '../../engine/util';
import { PageHead, Section, showToast, useAsync } from '../components';
import { openCalendarFile, shareOrDownload } from '../files';
import { buildIcs } from '../ics';
import { CalendarPlusIcon, NavigateIcon } from '../icons';
import { dayWithDate, formatClock, formatDuration, signedTemp, weatherLine } from '../format';
import { googleMapsUrl, navigationTarget, swisstopoUrl } from '../geo';
import { navigate } from '../router';
import { RiskBlock } from './RiskBlock';

export function DetailView({ id }: { id: string | undefined }) {
  const db = getDb();
  const { data, reload } = useAsync(async () => {
    const plan = await currentWeekendPlan(db);
    const s = plan && id ? findSuggestion(plan, id) : undefined;
    const candidate = s ? await db.candidates.get(s.candidateId) : undefined;
    return { plan, s, candidate };
  }, [id]);
  if (!data) return null;
  const { plan, s, candidate } = data;

  const back = (
    <button type="button" className="back-link" onClick={() => navigate('suggestions')}>
      ‹ Wochenende
    </button>
  );
  if (!plan || !s) {
    return (
      <>
        {back}
        <PageHead title="Plan nicht gefunden" lead="Die Vorschläge wurden inzwischen neu berechnet." />
      </>
    );
  }

  const chosen = plan.chosenId === s.id;
  const isPlanB = plan.planB?.id === s.id;

  const choose = async () => {
    await choosePlan(db, plan.weekend, s.id);
    showToast('Plan gewählt. Am Vorabend kommt der Check.');
    reload();
  };

  const nav = candidate ? navigationTarget(candidate) : undefined;
  const navUrl = nav ? googleMapsUrl(nav.point) : undefined;

  const addToCalendar = () => {
    if (!nav || !navUrl) return;
    const appUrl = `${window.location.origin}${window.location.pathname}?view=detail&id=${encodeURIComponent(s.id)}`;
    const ics = buildIcs({ s, place: { name: `${s.candidateName}, ${nav.label}`, lat: nav.point.lat, lon: nav.point.lon }, navigationUrl: navUrl, appUrl });
    openCalendarFile(`wochenende-${s.date}.ics`, ics);
  };

  const exportGpx = async () => {
    if (!candidate?.gpx) return;
    const name = `${candidate.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')}.gpx`;
    await shareOrDownload(name, candidate.gpx, 'application/gpx+xml');
  };

  return (
    <>
      {back}
      <PageHead overline={`${isPlanB ? 'Plan B · ' : ''}${s.activityLabel} · ${dayWithDate(s.day, s.date)}`} title={s.candidateName} {...(s.region ? { lead: s.region } : {})} />

      <RiskBlock risk={s.risk} />

      <div className="stack-sm">
        {s.weather && <strong className="card-weather">{weatherLine(s.weather, s.activity, s.slot)}</strong>}
        <span className="small">{s.reasons.join(' ')}</span>
      </div>

      <Section title="Zeitplan" aside={`${formatDuration(s.travel.minutes)}${s.travel.estimated ? ' (geschätzt)' : ''} ab ${s.travel.startPointName}`}>
        <ol className="schedule">
          {s.schedule.map((i) => (
            <li key={`${i.time}-${i.label}`}>
              <span className="time">{formatTime(i.time)}</span>
              <span>{i.label}</span>
            </li>
          ))}
        </ol>
      </Section>

      {s.weather && (
        <details className="more">
          <summary>Wetter Stunde für Stunde</summary>
          <table className="hours">
            <thead>
              <tr>
                <th scope="col">Zeit</th>
                <th scope="col">Temp.</th>
                <th scope="col">Böen</th>
                <th scope="col">Wolken</th>
                <th scope="col">Sonne</th>
              </tr>
            </thead>
            <tbody>
              {s.weather.hours.map((h) => (
                <tr key={h.hour}>
                  <td>{String(h.hour).padStart(2, '0')}:00</td>
                  <td>{signedTemp(h.temperature)}</td>
                  <td>{h.windGusts}</td>
                  <td>{h.cloudCover} %</td>
                  <td>{h.sunshineMinutes === undefined ? '–' : `${h.sunshineMinutes}′`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <span className="tiny muted">
            {s.activity === 'photo' ? 'Am Fotostandort' : 'Oben, während der Aktivität'}. Böen in km/h, Sonne in Minuten pro Stunde. {s.weather.model}
            {plan.weather?.fetchedAt ? `, Stand ${formatClock(plan.weather.fetchedAt)}` : ''}. Weather data by Open-Meteo.com.
          </span>
        </details>
      )}

      <Section title="Unterwegs">
        {s.photo && (
          <span className="small">
            Fotospot {s.photo.spotName} · {s.photo.lightLabel} um {formatTime(s.photo.time)}
          </span>
        )}
        {nav && <span className="small">Ziel fürs Auto: {nav.label}</span>}
        {s.priceChf !== undefined && <span className="small">Tageskarte CHF {s.priceChf}</span>}
        <div className="row-wrap">
          {candidate && (
            <a className="btn" href={swisstopoUrl(candidate.summit)} target="_blank" rel="noreferrer">
              Karte (swisstopo)
            </a>
          )}
          {candidate?.gpx && (
            <button type="button" className="btn" onClick={() => void exportGpx()}>
              GPX exportieren
            </button>
          )}
          {candidate?.link && (
            <a className="btn" href={candidate.link} target="_blank" rel="noreferrer">
              Link
            </a>
          )}
        </div>
        {candidate?.note && <span className="tiny muted">{candidate.note}</span>}
      </Section>

      <div className="action-bar">
        {chosen ? (
          <button type="button" className="btn btn-dark grow" onClick={() => navigate('check')}>
            Dein Plan · Vorabend-Check
          </button>
        ) : (
          <button type="button" className="btn btn-primary grow" onClick={() => void choose()}>
            Plan wählen
          </button>
        )}
        <button type="button" className="btn btn-icon tall" aria-label="In Kalender eintragen" title="In Kalender eintragen" disabled={!nav} onClick={addToCalendar}>
          <CalendarPlusIcon />
        </button>
        {navUrl && (
          <a className="btn btn-icon tall" href={navUrl} target="_blank" rel="noreferrer" aria-label={`Navigation mit Google Maps: ${nav?.label ?? 'Ziel'}`} title="Navigation (Google Maps)">
            <NavigateIcon />
          </a>
        )}
      </div>
    </>
  );
}
