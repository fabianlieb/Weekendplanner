import type { RiskInfo } from '../../engine/types';
import { RiskBadge } from '../components';
import { LINKS } from '../labels';
import { formatClock } from '../format';

/** Risk info for tours and snowshoe trails: colour (with text), danger level, freshness, bulletin hint. */
export function RiskBlock({ risk }: { risk: RiskInfo }) {
  if (!risk.applies) return null;
  return (
    <div className={`risk-block${risk.color === 'red' ? ' red' : ''}`}>
      <div className="row">
        <RiskBadge {...(risk.color ? { color: risk.color } : {})} text={risk.color ? undefined : risk.signposted ? 'signalisiert' : 'unbekannt'} />
        <strong className="small grow">{risk.label}</strong>
      </div>
      {risk.bothNote && <span className="small">{risk.bothNote}</span>}
      {risk.grmNote && <span className="small">{risk.grmNote}</span>}
      <span className="small">{risk.dangerLabel}</span>
      {risk.slf && <span className="tiny muted">Automatisch geladen · gültig bis {formatClock(risk.slf.validTo)}</span>}
      {risk.freshnessNote && <span className="small muted">{risk.freshnessNote}</span>}
      {risk.groupNote && <strong className="small accent">{risk.groupNote}</strong>}
      <span className="small">
        {risk.bulletinHint}{' '}
        <a href={LINKS.slfBulletin} target="_blank" rel="noreferrer">
          SLF-Bulletin
        </a>
      </span>
    </div>
  );
}
