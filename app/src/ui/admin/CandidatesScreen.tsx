import { getDb } from '../../data/db';
import { listCandidates, setDone, setFavorite } from '../../data/repositories';
import { StarIcon } from '../icons';
import { SEED_CANDIDATES } from '../../data/seed';
import type { Candidate } from '../../engine/types';
import { Notice, PageHead, Section, showToast, useAsync } from '../components';
import { KIND_ORDER, KIND_PLURAL } from '../labels';
import { navigate } from '../router';

export async function loadSeed(): Promise<number> {
  const db = getDb();
  const existing = new Set((await db.candidates.toArray()).map((c) => c.id));
  const fresh = SEED_CANDIDATES.filter((c) => !existing.has(c.id));
  await db.candidates.bulkPut(fresh);
  return fresh.length;
}

function meta(c: Candidate): string {
  const parts: string[] = [];
  if (c.region) parts.push(c.region);
  if (c.elevationGain) parts.push(`${c.elevationGain} Hm`);
  parts.push(`${c.durationHours} h`);
  if (c.kind === 'snowshoe_trail') parts.push(c.signposted ? 'signalisiert' : 'nicht signalisiert');
  if (!c.active) parts.push('inaktiv');
  return parts.join(' · ');
}

export function CandidatesScreen({ welcome = false }: { welcome?: boolean }) {
  const db = getDb();
  const { data: candidates, reload } = useAsync(() => listCandidates(db), []);
  if (!candidates) return null;

  const addSeed = async () => {
    const n = await loadSeed();
    showToast(n ? `${n} Einträge aus der Startliste hinzugefügt.` : 'Startliste ist schon vollständig vorhanden.');
    reload();
  };

  const toggleFavorite = async (c: Candidate) => {
    await setFavorite(db, c.id, !c.favorite);
    reload();
  };

  const toggleDone = async (c: Candidate) => {
    await setDone(db, c.id, !c.done);
    reload();
  };

  return (
    <>
      <PageHead overline="Liste" title="Deine Orte" lead={`${candidates.length} Einträge · Touren, Trails, Skigebiete, Fotospots`} />
      {welcome && candidates.length > 0 && (
        <button type="button" className="btn btn-primary" onClick={() => navigate('thursday')}>
          Fertig: Vorschläge zeigen
        </button>
      )}
      <div className="grid-2">
        <button type="button" className="btn btn-dark" onClick={() => navigate('list', { edit: 'new' })}>
          Neuer Eintrag
        </button>
        <button type="button" className="btn" disabled={candidates.length === 0} onClick={() => navigate('list', { travel: '1' })}>
          Anreisezeiten
        </button>
      </div>

      {candidates.length === 0 && (
        <Notice>
          Deine Liste ist leer. Du kannst mit der Startliste beginnen: {SEED_CANDIDATES.length} Beispiele aus der Ost- und Zentralschweiz und Graubünden. Koordinaten,
          Höhen, Zeiten und Signalisation sind ungefähr und müssen von dir geprüft werden.
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn" onClick={() => void addSeed()}>
              Startliste laden
            </button>
          </div>
        </Notice>
      )}

      {KIND_ORDER.map((kind) => {
        const items = candidates.filter((c) => c.kind === kind);
        if (items.length === 0) return null;
        return (
          <Section key={kind} title={KIND_PLURAL[kind]} aside={`${items.length}`}>
            <div className="list">
              {items.map((c) => (
                <div key={c.id} className="list-item">
                  <button type="button" className="list-main" onClick={() => navigate('list', { edit: c.id })}>
                    <span className="name">{c.name}</span>
                    <span className="meta">{meta(c)}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-icon btn-ghost"
                    aria-pressed={c.favorite === true}
                    aria-label={`${c.name} auf die Merkliste`}
                    title="Merkliste (Spot-Radar)"
                    onClick={() => void toggleFavorite(c)}
                  >
                    <StarIcon filled={c.favorite === true} />
                  </button>
                  <label className="check small">
                    <input type="checkbox" checked={c.done} onChange={() => void toggleDone(c)} aria-label={`${c.name} schon gemacht`} />
                    gemacht
                  </label>
                </div>
              ))}
            </div>
          </Section>
        );
      })}

      {candidates.length > 0 && (
        <span className="tiny muted">Stern = Merkliste: der Spot-Radar auf der Startseite meldet sehr gute Bedingungen. «gemacht» = bewährt, pro Wochenende kommen etwa 2 bewährte und 1 neue Option.</span>
      )}
    </>
  );
}
