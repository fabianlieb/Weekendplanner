import { getDb } from '../../data/db';
import { listCandidates, setDone, setFavorite } from '../../data/repositories';
import { StarIcon } from '../icons';
import { SEED_CANDIDATES } from '../../data/seed';
import type { Candidate } from '../../engine/types';
import { Choice, Notice, PageHead, Section, showToast, useAsync } from '../components';
import { CatalogBrowser } from './CatalogBrowser';
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

export function CandidatesScreen({ welcome = false, src = 'own' }: { welcome?: boolean; src?: 'own' | 'catalog' }) {
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
      <PageHead overline="Liste" title="Orte" lead="Die App schlägt aus dem Katalog vor; eigene Orte ergänzen ihn." />
      {welcome && (
        <button type="button" className="btn btn-primary" onClick={() => navigate('thursday')}>
          Fertig: Vorschläge zeigen
        </button>
      )}
      <Choice<'own' | 'catalog'>
        label="Liste"
        options={[
          { value: 'catalog', label: 'Katalog' },
          { value: 'own', label: `Eigene (${candidates.length})` },
        ]}
        value={src}
        onChange={(v) => navigate('list', v === 'catalog' ? { src: 'catalog' } : {}, true)}
      />
      {src === 'catalog' ? (
        <CatalogBrowser />
      ) : (
      <>
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
          Noch keine eigenen Orte. Das ist kein Problem: Die App schlägt aus dem Katalog vor (SAC-Skirouten, Schneeschuh-Trails, Skigebiete). Eigene Orte brauchst du
          vor allem für Fotospots. Für einen schnellen Start gibt es {SEED_CANDIDATES.length} Beispiele (Koordinaten ungefähr, bitte prüfen).
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
      )}
    </>
  );
}
