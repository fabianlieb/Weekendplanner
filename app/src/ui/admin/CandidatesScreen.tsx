import { getDb } from '../../data/db';
import { listCandidates, setDone } from '../../data/repositories';
import { SEED_CANDIDATES } from '../../data/seed';
import type { Candidate } from '../../engine/types';
import { Notice, Section, showToast, useAsync } from '../components';
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

export function CandidatesScreen() {
  const db = getDb();
  const { data: candidates, reload } = useAsync(() => listCandidates(db), []);
  if (!candidates) return null;

  const addSeed = async () => {
    const n = await loadSeed();
    showToast(n ? `${n} Einträge aus der Startliste hinzugefügt.` : 'Startliste ist schon vollständig vorhanden.');
    reload();
  };

  const toggleDone = async (c: Candidate) => {
    await setDone(db, c.id, !c.done);
    reload();
  };

  return (
    <div className="stack">
      <button type="button" className="btn btn-dark" onClick={() => navigate('admin', { tab: 'list', edit: 'new' })}>
        Neuer Eintrag
      </button>

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
                  <button type="button" className="list-main" onClick={() => navigate('admin', { tab: 'list', edit: c.id })}>
                    <span className="name">{c.name}</span>
                    <span className="meta">{meta(c)}</span>
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
        <span className="tiny muted">«schon gemacht» = bewährt. Pro Wochenende kommen etwa 2 bewährte und 1 neue Option.</span>
      )}
    </div>
  );
}
