import { getDb } from '../../data/db';
import { currentWeekendPlan, findSuggestion } from '../../data/planner';
import { CATALOG_ATTRIBUTION, getCandidate } from '../../data/catalog';
import { choosePlan, setPacked } from '../../data/repositories';
import { packingList } from '../../engine/packing';
import { formatTime } from '../../engine/util';
import { PageHead, Section, showToast, useAsync } from '../components';
import { NavigateIcon, SportIcon } from '../icons';
import { CalendarButton } from './CalendarButton';
import { RouteSection } from './RouteSection';
import { publicGpxUrl } from '../../data/tracks';
import { PlacePicture } from '../media';
import { ShareButton } from './ShareButton';
import { dayWithDate, formatClock, formatDuration, signedTemp, weatherLine } from '../format';
import { googleMapsUrl, navigationTarget, swisstopoUrl } from '../geo';
import { navigate } from '../router';
import { RiskBlock } from './RiskBlock';
import { TransitSection } from './TransitSection';

export function DetailView({ id }: { id: string | undefined }) {
  const db = getDb();
  const { data, reload } = useAsync(async () => {
    const plan = await currentWeekendPlan(db);
    const s = plan && id ? findSuggestion(plan, id) : undefined;
    const candidate = s ? await getCandidate(db, s.candidateId) : undefined;
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
  const packing = packingList(s, candidate);
  const packed = new Set(plan.packed?.[s.id] ?? []);
  const togglePacked = async (item: string) => {
    const next = new Set(packed);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    await setPacked(db, plan.weekend, s.id, [...next]);
    reload();
  };

  const choose = async () => {
    await choosePlan(db, plan.weekend, s.id);
    showToast('Plan gewählt. Am Vorabend kommt der Check.');
    reload();
  };

  const nav = candidate ? navigationTarget(candidate) : undefined;
  const transit = s.travel.mode === 'transit';
  // By public transport the journey ends at the start of the activity, not at a parking.
  const navUrl = nav ? googleMapsUrl(transit && candidate ? candidate.valley : nav.point, s.travel.mode) : undefined;

  return (
    <>
      {back}
      <PageHead
        icon={<SportIcon activity={s.activity} />}
        overline={`${isPlanB ? 'Plan B · ' : ''}${s.activityLabel} · ${dayWithDate(s.day, s.date)}`}
        title={s.candidateName}
        {...(s.region ? { lead: s.region } : {})}
      />

      <PlacePicture candidateId={s.candidateId} />

      <RiskBlock risk={s.risk} />

      <div className="stack-sm">
        {s.weather && <strong className="card-weather">{weatherLine(s.weather, s.activity, s.slot)}</strong>}
        <span className="small">{s.reasons.join(' ')}</span>
      </div>

      <Section title="Zeitplan" aside={`${formatDuration(s.travel.minutes)} ${transit ? 'ÖV' : 'Auto'}${s.travel.estimated ? ' (geschätzt)' : ''} ab ${s.travel.startPointName}`}>
        <ol className="schedule">
          {s.schedule.map((i) => (
            <li key={`${i.time}-${i.label}`}>
              <span className="time">{formatTime(i.time)}</span>
              <span>{i.label}</span>
            </li>
          ))}
        </ol>
      </Section>

      {transit && <TransitSection s={s} />}

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

      <details className="more" id="packliste" open={chosen && packed.size > 0 && packed.size < packing.length}>
        <summary>
          Packliste · {packed.size} von {packing.length}
        </summary>
        <div className="pack-list">
          {packing.map((item) => (
            <label key={item} className="check">
              <input type="checkbox" checked={packed.has(item)} onChange={() => void togglePacked(item)} />
              <span className={packed.has(item) ? 'muted' : ''}>{item}</span>
            </label>
          ))}
        </div>
        <span className="tiny muted">Eigene Ergänzungen pro Ort im Editor der Liste («Zusätzlich mitnehmen»).</span>
      </details>

      <RouteSection candidate={candidate} />

      <Section title="Unterwegs">
        {s.photo && (
          <span className="small">
            Fotospot {s.photo.spotName} · {s.photo.lightLabel} um {formatTime(s.photo.time)}
          </span>
        )}
        {nav && !transit && <span className="small">Ziel fürs Auto: {nav.label}</span>}
        {candidate?.difficulty && <span className="small">Schwierigkeit: {candidate.difficulty}</span>}
        {s.priceChf !== undefined && <span className="small">Tageskarte CHF {s.priceChf}</span>}
        <div className="row-wrap">
          {candidate && !publicGpxUrl(candidate) && (
            <a className="btn" href={swisstopoUrl(candidate.summit)} target="_blank" rel="noreferrer">
              Karte (swisstopo)
            </a>
          )}
          {candidate?.link && (
            <a className="btn" href={candidate.link} target="_blank" rel="noreferrer">
              {candidate.source?.includes('SAC') ? 'SAC-Tourenportal' : candidate.source?.includes('SchweizMobil') ? 'SchweizMobil' : 'Link'}
            </a>
          )}
        </div>
        {candidate?.note && <span className="tiny muted">{candidate.note}</span>}
        {candidate?.source && candidate.kind !== 'ski_resort' && (
          <span className="tiny muted">Aus dem Katalog: {CATALOG_ATTRIBUTION}. Routenangaben ohne Gewähr, Verlauf hängt von den Verhältnissen ab.</span>
        )}
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
        <CalendarButton s={s} candidate={candidate} tall />
        <ShareButton s={s} candidate={candidate} tall />
        {navUrl && (
          <a
            className="btn btn-icon tall"
            href={navUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`${transit ? 'ÖV-Route' : 'Navigation'} mit Google Maps: ${transit ? 'Start' : (nav?.label ?? 'Ziel')}`}
            title={transit ? 'ÖV-Route (Google Maps)' : 'Navigation (Google Maps)'}
          >
            <NavigateIcon />
          </a>
        )}
      </div>
    </>
  );
}
