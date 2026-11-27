import { getDb } from '../../data/db';
import { currentWeekendPlan, findSuggestion } from '../../data/planner';
import { choosePlan } from '../../data/repositories';
import { formatTime } from '../../engine/util';
import { Notice, PageHead, Section, showToast, useAsync } from '../components';
import { shareOrDownload } from '../files';
import { dayWithDate, formatDuration } from '../format';
import { swisstopoUrl } from '../geo';
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
      ‹ Vorschläge
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

      <p className="small" style={{ margin: 0 }}>
        {s.reasons.join(' ')}
      </p>

      <Section title="Zeitplan">
        <ol className="schedule">
          {s.schedule.map((i) => (
            <li key={`${i.time}-${i.label}`}>
              <span className="time">{formatTime(i.time)}</span>
              <span>{i.label}</span>
            </li>
          ))}
        </ol>
      </Section>

      {s.photo && (
        <Section title="Fotospot">
          <span className="small">
            {s.photo.spotName} · {s.photo.lightLabel} um {formatTime(s.photo.time)}
          </span>
        </Section>
      )}

      <Section title="Route & Anreise">
        {candidate && (
          <div className="grid-2">
            <a className="btn" href={swisstopoUrl(candidate.summit)} target="_blank" rel="noreferrer">
              In swisstopo öffnen
            </a>
            <button type="button" className="btn" disabled={!candidate.gpx} onClick={() => void exportGpx()}>
              GPX exportieren
            </button>
          </div>
        )}
        {candidate && !candidate.gpx && <span className="tiny muted">Kein GPX-Track hinterlegt (in der Liste ergänzen).</span>}
        <span className="small">
          Start: {s.travel.startPointName} · Auto, ca. {formatDuration(s.travel.minutes)}
          {s.travel.estimated ? ' (geschätzt)' : ''}
        </span>
        {candidate && (
          <a className="small" href={swisstopoUrl(candidate.valley, 8)} target="_blank" rel="noreferrer">
            Ausgangspunkt in swisstopo
          </a>
        )}
        {s.priceChf !== undefined && <span className="small">Tageskarte CHF {s.priceChf}</span>}
        {candidate?.link && (
          <a className="small" href={candidate.link} target="_blank" rel="noreferrer">
            Link: {candidate.link.replace(/^https?:\/\//, '').slice(0, 40)}
          </a>
        )}
        {candidate?.note && <span className="tiny muted">{candidate.note}</span>}
      </Section>

      {chosen ? (
        <Notice>Das ist dein Plan für dieses Wochenende. Am Vorabend prüft die App ihn mit aktuellen Daten.</Notice>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => void choose()}>
          Plan wählen
        </button>
      )}
      {chosen && (
        <button type="button" className="btn btn-dark" onClick={() => navigate('check')}>
          Zum Vorabend-Check
        </button>
      )}
    </>
  );
}
