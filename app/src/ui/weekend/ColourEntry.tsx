// Today's Skitourenguru colours, one tap per tour (in addition to the own GRM calculation; the more
// cautious colour counts). Colours are only valid today (fail closed).
// Shown inline on the weekend screen; there is no separate risk page.
import { getDb } from '../../data/db';
import { clearRisk, riskEntriesOn, setRisk } from '../../data/repositories';
import { BULLETIN_HINT, RISK_TEXT } from '../../engine/texts';
import type { Candidate, DangerLevel, RiskColor } from '../../engine/types';
import { zurichToday } from '../../engine/util';
import { Choice, useAsync } from '../components';
import { LINKS, RISK_COLOR_SHORT } from '../labels';

const COLORS: RiskColor[] = ['green', 'orange', 'red'];
const LEVELS: DangerLevel[] = [1, 2, 3, 4, 5];

export function ColourEntry({ tours, onChange }: { tours: Candidate[]; onChange: () => void }) {
  const db = getDb();
  const today = zurichToday();
  const { data: entries, reload } = useAsync(() => riskEntriesOn(db, today), [today]);
  if (!entries) return null;
  const entryFor = (id: string) => entries.find((e) => e.candidateId === id);

  const pick = async (candidateId: string, color: RiskColor) => {
    const current = entryFor(candidateId);
    if (current?.color === color) await clearRisk(db, candidateId, today);
    else await setRisk(db, candidateId, today, color, current?.dangerLevel);
    reload();
    onChange();
  };

  const pickLevel = async (candidateId: string, level: DangerLevel) => {
    const current = entryFor(candidateId);
    if (!current) return;
    await setRisk(db, candidateId, today, current.color, current.dangerLevel === level ? undefined : level);
    reload();
    onChange();
  };

  return (
    <div className="stack">
      <span className="small">
        Farbe von{' '}
        <a href={LINKS.skitourenguru} target="_blank" rel="noreferrer">
          Skitourenguru
        </a>{' '}
        antippen – optional zur Berechnung der App, gilt nur heute; die vorsichtigere Farbe zählt. {BULLETIN_HINT}{' '}
        <a href={LINKS.slfBulletin} target="_blank" rel="noreferrer">
          SLF-Bulletin
        </a>
      </span>
      {tours.map((t) => {
        const e = entryFor(t.id);
        return (
          <div key={t.id} className="colour-row">
            <span className="colour-name">
              <strong>{t.name}</strong>
              <span className="tiny muted">
                {' '}
                {[t.region, t.difficulty, t.elevationGain ? `${t.elevationGain} Hm` : undefined].filter(Boolean).join(' · ')}
              </span>
              {t.link && (
                <>
                  {' '}
                  <a className="tiny" href={t.link} target="_blank" rel="noreferrer">
                    {t.source?.includes('SAC') ? 'Route beim SAC' : 'Route'}
                  </a>
                </>
              )}
            </span>
            <Choice<RiskColor>
              className="risk-choice compact"
              label={`Skitourenguru-Farbe für ${t.name}`}
              options={COLORS.map((c) => ({
                value: c,
                label: (
                  <>
                    <span className={`swatch ${c}`} aria-hidden="true" />
                    {RISK_COLOR_SHORT[c]}
                  </>
                ),
              }))}
              value={e?.color}
              onChange={(c) => void pick(t.id, c)}
            />
            {e && <span className="tiny muted">{RISK_TEXT[e.color]}</span>}
            {e && (
              <div className="row">
                <span className="tiny" style={{ width: 92, flex: 'none' }}>
                  Gefahrenstufe (Bulletin)
                </span>
                <div className="grow">
                  <Choice<DangerLevel>
                    className="level-choice compact"
                    label={`Gefahrenstufe laut Bulletin für ${t.name} (optional)`}
                    options={LEVELS.map((l) => ({ value: l, label: String(l) }))}
                    value={e.dangerLevel}
                    onChange={(l) => void pickLevel(t.id, l)}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
      <span className="tiny muted">Nochmals auf die gewählte Farbe tippen entfernt sie. Die Gefahrenstufe laut Bulletin ist optional.</span>
    </div>
  );
}
