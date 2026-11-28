import type { PlanB, RiskInfo, Suggestion } from '../../engine/types';
import { formatTime } from '../../engine/util';
import { DAY_LABEL, DAY_SHORT } from '../../engine/texts';
import { RiskBadge } from '../components';
import { formatDuration } from '../format';
import { navigate } from '../router';
import { SportIcon } from '../icons';
import { Thumb, usePlaceMedia } from '../media';
import { hasTrack } from '../../data/tracks';
import { WeatherChips } from '../WeatherChips';

function riskShort(r: RiskInfo): string | undefined {
  if (!r.applies) return undefined;
  if (r.color) return { green: 'grün · gering', orange: 'orange · erhöht', red: 'rot · hoch' }[r.color];
  return r.signposted ? 'signalisiert' : undefined;
}

export function travelText(s: Suggestion): string {
  return `${formatDuration(s.travel.minutes)}${s.travel.estimated ? ' (geschätzt)' : ''} ab ${s.travel.startPointName}`;
}

/** Compact suggestion card: name, day · activity, weather, reasoning, travel. The whole card opens the detail plan. */
export function SuggestionCard({
  s,
  planB = false,
  replaces,
  linked = true,
}: {
  s: Suggestion | PlanB;
  planB?: boolean;
  /** The suggestion Plan B replaces. */
  replaces?: Suggestion;
  /** false: not clickable (e.g. an alternative not yet stored). */
  linked?: boolean;
}) {
  const { candidate, image } = usePlaceMedia(s.candidateId);
  const meta = [travelText(s)];
  if (s.photo) meta.push(`Foto ${s.photo.spotName} ${formatTime(s.photo.time)}`);
  if (s.priceChf !== undefined) meta.push(`CHF ${s.priceChf}`);
  const badge = riskShort(s.risk);
  const reason = planB && 'planBReason' in s ? s.planBReason : undefined;
  const insteadOf = replaces && replaces.activity === s.activity ? replaces.candidateName : (replaces?.activityLabel ?? 'Vorschlag 1');

  const body = (
    <>
      <span className="card-head">
        <span className="card-head-text">
          <span className="card-top">
            <span className="card-title">{s.candidateName}</span>
            {badge && <RiskBadge {...(s.risk.color ? { color: s.risk.color } : {})} text={badge} />}
          </span>
          <span className="card-sub">
            <SportIcon activity={s.activity} />
            {planB && <span className="tag planb">Plan B</span>}
            {planB ? DAY_SHORT[s.day] : DAY_LABEL[s.day]} · {s.activityLabel}
            {!planB && s.isNew && <span className="accent"> · neu</span>}
            {hasTrack(candidate) && <span className="tag gps">GPS-Track</span>}
          </span>
        </span>
        <Thumb image={image} />
      </span>
      {s.weather && <WeatherChips w={s.weather} activity={s.activity} slot={s.slot} />}
      <span className="card-text">{reason ? `Statt ${insteadOf}, ${reason}.` : s.reasons.join(' ')}</span>
      <span className="card-meta">
        {meta.join(' · ')}
        {linked && <span aria-hidden="true"> ›</span>}
      </span>
    </>
  );
  if (!linked) return <div className="card suggestion">{body}</div>;
  return (
    <button
      type="button"
      className="card suggestion"
      onClick={() => navigate('detail', { id: s.id })}
      aria-label={`${s.candidateName}, ${DAY_LABEL[s.day]}, ${s.activityLabel}. Details öffnen`}
    >
      {body}
    </button>
  );
}
