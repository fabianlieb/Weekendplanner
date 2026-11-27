import type { PlanB, RiskInfo, Suggestion } from '../../engine/types';
import { formatTime } from '../../engine/util';
import { DAY_SHORT, DAY_LABEL } from '../../engine/texts';
import { RiskBadge } from '../components';
import { formatDuration, weatherLine } from '../format';
import { navigate } from '../router';

function riskShort(r: RiskInfo): string | undefined {
  if (!r.applies) return undefined;
  if (r.color) return { green: 'grün · gering', orange: 'orange · erhöht', red: 'rot · hoch' }[r.color];
  return r.signposted ? 'signalisiert' : undefined;
}

export function travelText(s: Suggestion): string {
  return `Anreise ${formatDuration(s.travel.minutes)}${s.travel.estimated ? ' (geschätzt)' : ''}`;
}

export function SuggestionCard({
  s,
  index,
  chosen,
  replaces,
  linked = true,
}: {
  s: Suggestion | PlanB;
  index?: number;
  chosen?: boolean;
  /** The suggestion Plan B replaces. */
  replaces?: Suggestion;
  /** false: not clickable (e.g. an alternative not yet stored). */
  linked?: boolean;
}) {
  const isPlanB = 'planBReason' in s && index === undefined;
  const meta = [travelText(s)];
  if (s.photo) meta.push(`Fotospot ${s.photo.spotName}, ${s.photo.lightLabel} ${formatTime(s.photo.time)}`);
  if (s.priceChf !== undefined) meta.push(`Tageskarte CHF ${s.priceChf}`);
  const badge = riskShort(s.risk);

  const body = (
    <>
      <span className="card-head">
        <span className="overline-sm">
          {isPlanB ? 'Plan B · automatisch' : `${index} · ${s.activityLabel} · ${DAY_LABEL[s.day]}`}
          {!isPlanB && s.isNew ? ' · neu' : ''}
        </span>
        {badge && <RiskBadge {...(s.risk.color ? { color: s.risk.color } : {})} text={badge} />}
      </span>
      <span className="card-title">
        {isPlanB ? `${s.activityLabel} ${DAY_SHORT[s.day]} · ${s.candidateName}` : s.candidateName}
        {chosen && <span className="tag chosen">gewählt</span>}
      </span>
      {isPlanB ? (
        <span className="card-text">
          {replaces && replaces.activity === s.activity ? `${s.candidateName} statt ${replaces.candidateName}` : `${s.activityLabel} statt ${replaces?.activityLabel ?? 'Vorschlag 1'}`} –{' '}
          {(s as PlanB).planBReason}.
        </span>
      ) : (
        <span className="card-text">{s.reasons.join(' ')}</span>
      )}
      {s.weather && <span className="card-weather">{weatherLine(s.weather, s.activity, s.slot)}</span>}
      <span className="card-meta">
        {meta.join(' · ')}
        {linked ? ' · Details ›' : ''}
      </span>
    </>
  );
  if (!linked) return <div className="card">{body}</div>;
  return (
    <button type="button" className="card suggestion" onClick={() => navigate('detail', { id: s.id })} aria-label={`${s.activityLabel} ${DAY_LABEL[s.day]}: ${s.candidateName}. Details`}>
      {body}
    </button>
  );
}
