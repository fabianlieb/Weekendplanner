// Thursday (and evening-check) risk entry: one tap per tour. Colours are only valid today.
import { getDb } from '../../data/db';
import { clearRisk, getProfile, listCandidates, riskEntriesOn, setRisk } from '../../data/repositories';
import { needsAvalancheRating } from '../../engine/risk';
import { BULLETIN_HINT, RISK_TEXT, shortDate } from '../../engine/texts';
import type { DangerLevel, RiskColor } from '../../engine/types';
import { zurichToday } from '../../engine/util';
import { Choice, Notice, RiskBadge, Section, useAsync } from '../components';
import { LINKS, RISK_COLOR_SHORT } from '../labels';

const COLORS: RiskColor[] = ['green', 'orange', 'red'];
const LEVELS: DangerLevel[] = [1, 2, 3, 4, 5];

export function RiskScreen() {
  const db = getDb();
  const today = zurichToday();
  const { data, reload } = useAsync(async () => {
    const [candidates, entries, profile] = await Promise.all([listCandidates(db), riskEntriesOn(db, today), getProfile(db)]);
    return { candidates, entries, profile };
  }, [today]);
  if (!data) return null;

  const tours = data.candidates.filter((c) => c.active && needsAvalancheRating(c));
  const signposted = data.candidates.filter((c) => c.active && c.kind === 'snowshoe_trail' && c.signposted);
  const entryFor = (id: string) => data.entries.find((e) => e.candidateId === id);
  const done = tours.filter((t) => entryFor(t.id)).length;

  const pick = async (candidateId: string, color: RiskColor) => {
    const current = entryFor(candidateId);
    if (current?.color === color) await clearRisk(db, candidateId, today);
    else await setRisk(db, candidateId, today, color, current?.dangerLevel);
    reload();
  };

  const pickLevel = async (candidateId: string, level: DangerLevel) => {
    const current = entryFor(candidateId);
    if (!current) return;
    await setRisk(db, candidateId, today, current.color, current.dangerLevel === level ? undefined : level);
    reload();
  };

  return (
    <div className="stack">
      <Notice>
        <strong>Heute, {shortDate(today)}.</strong> Trage pro Tour die aktuelle Farbe von{' '}
        <a href={LINKS.skitourenguru} target="_blank" rel="noreferrer">
          Skitourenguru
        </a>{' '}
        ein. Die Farben gelten nur heute: Ohne Eintrag von heute gilt das Risiko als unbekannt, und die Tour wird nicht vorgeschlagen. {BULLETIN_HINT}{' '}
        <a href={LINKS.slfBulletin} target="_blank" rel="noreferrer">
          SLF-Bulletin öffnen
        </a>
      </Notice>

      {data.profile.riskLevel < 3 && (
        <span className="tiny muted">
          Deine Risikostufe {data.profile.riskLevel}: {data.profile.riskLevel === 1 ? 'orange und rot werden' : 'rot wird'} nicht vorgeschlagen.
        </span>
      )}

      <Section title="Touren" aside={`${done} von ${tours.length} eingetragen`}>
        {tours.length === 0 && <span className="small muted">Keine Skitouren oder nicht signalisierten Schneeschuh-Touren in deiner Liste.</span>}
        {tours.map((t) => {
          const e = entryFor(t.id);
          return (
            <div key={t.id} className="card">
              <div className="row">
                <div className="grow stack-sm" style={{ gap: 2 }}>
                  <strong>{t.name}</strong>
                  <span className="tiny muted">{t.region ?? ''}</span>
                </div>
                <RiskBadge {...(e ? { color: e.color } : {})} text={e ? RISK_COLOR_SHORT[e.color] : 'nicht eingetragen'} />
              </div>
              <Choice<RiskColor>
                className="risk-choice"
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
              {e && (
                <>
                  <span className="tiny muted">{RISK_TEXT[e.color]}</span>
                  <span className="tiny">Gefahrenstufe laut Bulletin (optional)</span>
                  <Choice<DangerLevel>
                    className="level-choice"
                    label={`Gefahrenstufe für ${t.name}`}
                    options={LEVELS.map((l) => ({ value: l, label: String(l) }))}
                    value={e.dangerLevel}
                    onChange={(l) => void pickLevel(t.id, l)}
                  />
                </>
              )}
            </div>
          );
        })}
        {tours.length > 0 && <span className="tiny muted">Nochmals auf die gewählte Farbe tippen entfernt den Eintrag.</span>}
      </Section>

      {signposted.length > 0 && (
        <Section title="Signalisierte Trails" aside="keine Farbe nötig">
          <div className="list">
            {signposted.map((s) => (
              <div key={s.id} className="list-item">
                <span className="grow">{s.name}</span>
                <span className="tiny muted">signalisiert</span>
              </div>
            ))}
          </div>
          <span className="tiny muted">{BULLETIN_HINT}</span>
        </Section>
      )}
    </div>
  );
}
