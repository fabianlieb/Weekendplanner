// Avalanche problems of the SLF bulletin: which aspects and elevations (the core zone), with a small
// aspect rose, and whether the elevation band touches the tour.
import type { AvalancheProblemInfo } from '../../engine/types';

const PROBLEM_LABEL: Record<string, string> = {
  new_snow: 'Neuschnee',
  wind_slab: 'Triebschnee',
  persistent_weak_layers: 'Altschnee',
  wet_snow: 'Nassschnee',
  gliding_snow: 'Gleitschnee',
  cornices: 'Wechten',
  no_distinct_avalanche_problem: 'Kein ausgeprägtes Lawinenproblem',
  favourable_situation: 'Günstige Situation',
};

const ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
const ASPECT_DE: Record<string, string> = { N: 'N', NE: 'NO', E: 'O', SE: 'SO', S: 'S', SW: 'SW', W: 'W', NW: 'NW' };

export function problemLabel(type: string): string {
  return PROBLEM_LABEL[type] ?? type.replace(/_/g, ' ');
}

export function elevationText(p: Pick<AvalancheProblemInfo, 'lower' | 'upper'>): string {
  if (p.lower !== undefined && p.upper !== undefined) return `${p.lower}–${p.upper} m`;
  if (p.lower !== undefined) return `über ${p.lower} m`;
  if (p.upper !== undefined) return `unter ${p.upper} m`;
  return 'alle Höhenlagen';
}

/** True if the problem's elevation band overlaps the tour (start to summit). */
export function touchesTour(p: Pick<AvalancheProblemInfo, 'lower' | 'upper'>, tour: { low: number; high: number }): boolean {
  return (p.lower === undefined || tour.high >= p.lower) && (p.upper === undefined || tour.low <= p.upper);
}

/** 8 sectors, north up; marked sectors in the accent colour. */
export function AspectRose({ aspects, size = 34 }: { aspects: readonly string[]; size?: number }) {
  const r = 15;
  const c = 17;
  const sector = (i: number) => {
    const a0 = ((i * 45 - 22.5 - 90) * Math.PI) / 180;
    const a1 = ((i * 45 + 22.5 - 90) * Math.PI) / 180;
    return `M${c} ${c} L${c + r * Math.cos(a0)} ${c + r * Math.sin(a0)} A${r} ${r} 0 0 1 ${c + r * Math.cos(a1)} ${c + r * Math.sin(a1)} Z`;
  };
  const label = aspects.length ? `Expositionen ${ORDER.filter((a) => aspects.includes(a)).map((a) => ASPECT_DE[a]).join(', ')}` : 'keine Exposition angegeben';
  return (
    <svg className="aspect-rose" width={size} height={size} viewBox="0 0 34 34" role="img" aria-label={label}>
      {ORDER.map((a, i) => (
        <path key={a} d={sector(i)} className={aspects.includes(a) ? 'on' : 'off'} />
      ))}
      <text x="17" y="6.2" textAnchor="middle" className="rose-n">
        N
      </text>
    </svg>
  );
}

export function AvalancheProblems({ problems, tour }: { problems: readonly AvalancheProblemInfo[]; tour?: { low: number; high: number } }) {
  if (!problems.length) return null;
  return (
    <div className="aval-problems">
      <span className="tiny muted">Lawinenprobleme laut Bulletin</span>
      {problems.map((p, i) => {
        const relevant = tour ? touchesTour(p, tour) : undefined;
        const aspects = ORDER.filter((a) => p.aspects.includes(a)).map((a) => ASPECT_DE[a]);
        return (
          <div key={`${p.type}-${i}`} className="aval-problem">
            {p.aspects.length > 0 && <AspectRose aspects={p.aspects} />}
            <span className="small">
              <strong>{problemLabel(p.type)}</strong>
              {aspects.length > 0 && aspects.length < 8 ? ` · ${aspects.join(', ')}` : aspects.length === 8 ? ' · alle Expositionen' : ''} · {elevationText(p)}
              {relevant !== undefined && (
                <span className={relevant ? 'accent' : 'muted'}>
                  {' '}
                  · {relevant ? 'in der Höhe der Tour' : 'nicht in der Höhe der Tour'}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
