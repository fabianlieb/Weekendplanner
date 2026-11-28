// Public transport: the concrete connections for the planned day (asked on demand from
// transport.opendata.ch). Nothing is shown without stops; a failed request shows a short note.
import { fetchConnections, type Connection } from '../../data/routing';
import { THRESHOLDS } from '../../engine/thresholds';
import type { Suggestion } from '../../engine/types';
import { formatTime } from '../../engine/util';
import { Section, useAsync } from '../components';
import { MiniIcon } from '../miniIcons';

const clock = (iso: string) => iso.slice(11, 16);

function Leg({ label, c, from, to }: { label: string; c: Connection | undefined; from: string; to: string }) {
  if (!c) return <span className="small muted">{label}: keine passende Verbindung gefunden.</span>;
  return (
    <div className="transit-leg">
      <span className="small icon-line">
        <MiniIcon name="train" />
        <span>
          <strong>{label}</strong> {clock(c.departure)} {from} → {clock(c.arrival)} {to}
        </span>
      </span>
      <span className="tiny muted">
        {c.transfers === 0 ? 'direkt' : `${c.transfers}× umsteigen`}
        {c.products.length ? ` · ${c.products.join(', ')}` : ''}
      </span>
    </div>
  );
}

export function TransitSection({ s }: { s: Suggestion }) {
  const t = s.travel.transit;
  const first = s.schedule[0];
  const last = s.schedule.at(-1);
  const { data, loading } = useAsync(async () => {
    if (!t || !first || !last) return undefined;
    // Arrive at the stop in time to walk to the start; leave once back at the stop.
    const arriveBy = first.time + s.travel.minutes - t.walkFromMinutes;
    const leaveFrom = last.time - s.travel.minutes + t.walkFromMinutes + THRESHOLDS.routing.transitReturnBufferMinutes;
    try {
      const [outbound, back] = await Promise.all([
        fetchConnections(t.from, t.to, s.date, formatTime(arriveBy), { arrival: true, limit: 3 }),
        fetchConnections(t.to, t.from, s.date, formatTime(leaveFrom), { limit: 3 }),
      ]);
      const toMin = (iso: string) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
      return {
        outbound: outbound.filter((c) => toMin(c.arrival) <= arriveBy).at(-1) ?? outbound[0],
        back: back.find((c) => toMin(c.departure) >= leaveFrom) ?? back[0],
      };
    } catch {
      return 'offline' as const;
    }
  }, [s.id]);
  if (!t) return null;

  return (
    <Section title="ÖV-Verbindung" aside="Fahrplan transport.opendata.ch">
      {loading && !data && <span className="small muted">Verbindung wird gesucht …</span>}
      {data === 'offline' && <span className="small muted">Fahrplan gerade nicht erreichbar.</span>}
      {data && data !== 'offline' && (
        <>
          <Leg label="Hin" c={data.outbound} from={t.from.name} to={t.to.name} />
          <Leg label="Zurück" c={data.back} from={t.to.name} to={t.from.name} />
        </>
      )}
      <span className="tiny muted">
        Fussweg: {t.walkToMinutes} min zur Haltestelle {t.from.name}, {t.walkFromMinutes} min ab {t.to.name} (geschätzt). Fahrplan vor der Abfahrt
        in der SBB-App prüfen.
      </span>
    </Section>
  );
}
