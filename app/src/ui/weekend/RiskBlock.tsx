import { BULLETIN_HINT, GRM_HINT } from '../../engine/texts';
import type { RiskInfo } from '../../engine/types';
import { RiskBadge } from '../components';
import { LINKS } from '../labels';
import { formatClock } from '../format';
import { AvalancheProblems } from './AvalancheProblems';
import { GrmChart } from './GrmChart';

/**
 * Risk info for tours and snowshoe trails. Always visible (safety rule): colour with text, danger
 * level, freshness, group note and the bulletin hint. The details (calculation, avalanche problems,
 * GRM chart) open on demand.
 */
export function RiskBlock({ risk }: { risk: RiskInfo }) {
  if (!risk.applies) return null;
  const hasProblems = !!risk.slf?.problems?.length;
  const hasDetails = !!(risk.grmNote || risk.grm || hasProblems || risk.slf);
  return (
    <div className={`risk-block${risk.color === 'red' ? ' red' : ''}`}>
      <div className="row">
        <RiskBadge {...(risk.color ? { color: risk.color } : {})} text={risk.color ? undefined : risk.signposted ? 'signalisiert' : 'unbekannt'} />
        <strong className="small grow">{risk.label}</strong>
      </div>
      <span className="small">{risk.dangerLabel}</span>
      {risk.bothNote && <span className="small">{risk.bothNote}</span>}
      {risk.freshnessNote && <span className="small muted">{risk.freshnessNote}</span>}
      {risk.groupNote && <strong className="small accent">{risk.groupNote}</strong>}
      <span className="small">
        {BULLETIN_HINT}{' '}
        <a href={LINKS.slfBulletin} target="_blank" rel="noreferrer">
          SLF-Bulletin
        </a>
      </span>
      {hasDetails && (
        <details className="risk-more">
          <summary>{risk.source === 'grm' ? 'Berechnung und Lawinenprobleme' : hasProblems ? 'Lawinenprobleme' : 'Details'}</summary>
          <div className="stack-sm">
            {risk.grmNote && <span className="small">{risk.grmNote}</span>}
            {risk.slf && <span className="tiny muted">Bulletin automatisch geladen · gültig bis {formatClock(risk.slf.validTo)}</span>}
            {hasProblems && <AvalancheProblems problems={risk.slf!.problems!} {...(risk.slf!.tour ? { tour: risk.slf!.tour } : {})} />}
            {risk.grm && <GrmChart grm={risk.grm} />}
            {risk.source === 'grm' && <span className="tiny muted">{GRM_HINT}</span>}
          </div>
        </details>
      )}
    </div>
  );
}
