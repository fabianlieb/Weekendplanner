// Travel times of all entries × start points in one table. Empty = estimate (shown as placeholder).
import { useEffect, useState } from 'react';
import { getDb } from '../../data/db';
import { getProfile, listCandidates } from '../../data/repositories';
import { travelFor } from '../../engine/suggest';
import type { Candidate, Profile } from '../../engine/types';
import { Notice, PageHead, showToast, useAsync } from '../components';
import { KIND_LABEL, KIND_ORDER } from '../labels';
import { navigate } from '../router';

type Grid = Record<string, Record<string, string>>;

export function TravelTable() {
  const db = getDb();
  const { data } = useAsync(async () => ({ profile: await getProfile(db), candidates: await listCandidates(db) }), []);
  const [grid, setGrid] = useState<Grid>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!data) return;
    const g: Grid = {};
    for (const c of data.candidates) g[c.id] = Object.fromEntries(Object.entries(c.travelMinutes).map(([k, v]) => [k, String(v)]));
    setGrid(g);
  }, [data]);

  if (!data) return null;
  const { profile, candidates } = data as { profile: Profile; candidates: Candidate[] };
  const back = () => navigate('admin', { tab: 'list' });
  const sorted = [...candidates].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name, 'de-CH'));

  const setCell = (cid: string, sp: string, v: string) => {
    setGrid({ ...grid, [cid]: { ...grid[cid], [sp]: v.replace(/[^\d]/g, '') } });
    setDirty(true);
  };

  const save = async () => {
    await db.transaction('rw', db.candidates, async () => {
      for (const c of candidates) {
        const row = grid[c.id] ?? {};
        const travelMinutes: Record<string, number> = {};
        for (const sp of profile.startPoints) {
          const v = row[sp.id];
          if (v && Number(v) > 0 && Number(v) <= 1440) travelMinutes[sp.id] = Number(v);
        }
        // keep values of start points that no longer exist untouched
        for (const [k, v] of Object.entries(c.travelMinutes)) if (!profile.startPoints.some((s) => s.id === k)) travelMinutes[k] = v;
        await db.candidates.update(c.id, { travelMinutes });
      }
    });
    setDirty(false);
    showToast('Anreisezeiten gespeichert.');
  };

  return (
    <div className="stack">
      <button type="button" className="back-link" onClick={back}>
        ‹ Eigene Liste
      </button>
      <PageHead overline="Verwaltung" title="Anreisezeiten" lead="Minuten, einfache Fahrt mit dem Auto. Leer = Schätzung aus der Luftlinie (grau)." />

      {profile.startPoints.length === 0 ? (
        <Notice>Lege im Profil zuerst einen Startpunkt an.</Notice>
      ) : (
        <>
          <table className="travel">
            <thead>
              <tr>
                <th scope="col">Eintrag</th>
                {profile.startPoints.map((sp) => (
                  <th key={sp.id} scope="col">
                    ab {sp.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id}>
                  <th scope="row">
                    <span className="name">{c.name}</span>
                    <span className="tiny muted">{KIND_LABEL[c.kind]}</span>
                  </th>
                  {profile.startPoints.map((sp) => (
                    <td key={sp.id}>
                      <input
                        className="input"
                        inputMode="numeric"
                        aria-label={`${c.name} ab ${sp.name}, Minuten`}
                        value={grid[c.id]?.[sp.id] ?? ''}
                        placeholder={String(travelFor({ ...c, travelMinutes: {} }, sp).minutes)}
                        onChange={(e) => setCell(c.id, sp.id, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="btn btn-primary" disabled={!dirty} onClick={() => void save()}>
            Speichern
          </button>
        </>
      )}
    </div>
  );
}
