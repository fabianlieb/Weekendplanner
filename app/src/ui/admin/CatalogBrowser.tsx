// Browse the catalogue (swisstopo/SAC routes, ASTRA trails, built-in ski areas): search, filter,
// star, hide. Sorted by estimated travel time from the first start point.
import { useMemo, useState } from 'react';
import { CATALOG_ATTRIBUTION, getCatalog, setCatalogState } from '../../data/catalog';
import { getDb } from '../../data/db';
import { getProfile } from '../../data/repositories';
import { travelFor } from '../../engine/travel';
import type { Candidate, CandidateKind } from '../../engine/types';
import { Choice, useAsync } from '../components';
import { formatDuration } from '../format';
import { StarIcon } from '../icons';
import { KIND_LABEL } from '../labels';
import { navigate } from '../router';

type KindFilter = 'all' | CandidateKind;
const PAGE = 40;

export function catalogMeta(c: Candidate, travel?: number): string {
  const parts: string[] = [KIND_LABEL[c.kind]];
  if (c.difficulty) parts.push(c.difficulty);
  if (c.elevationGain) parts.push(`${c.elevationGain} Hm`);
  if (c.kind !== 'ski_resort') parts.push(`${c.durationHours} h`);
  if (travel !== undefined) parts.push(`ca. ${formatDuration(travel)}`);
  if (c.kind === 'snowshoe_trail') parts.push(c.signposted ? 'signalisiert' : 'nicht signalisiert');
  return parts.join(' · ');
}

export function CatalogBrowser() {
  const db = getDb();
  const { data, reload } = useAsync(async () => ({ catalog: await getCatalog(db), profile: await getProfile(db) }), []);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [showHidden, setShowHidden] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => {
    if (!data) return [];
    const sp = data.profile.startPoints[0];
    const needle = q.trim().toLowerCase();
    return data.catalog
      .filter((c) => (kind === 'all' || c.kind === kind) && (showHidden ? !c.active : c.active) && (!needle || c.name.toLowerCase().includes(needle)))
      .map((c) => ({ c, travel: sp ? travelFor(c, sp).minutes : undefined }))
      .sort((a, b) => Number(!!b.c.favorite) - Number(!!a.c.favorite) || (a.travel ?? 0) - (b.travel ?? 0));
  }, [data, q, kind, showHidden]);

  if (!data) return <span className="small muted">Katalog wird geladen …</span>;

  const toggleStar = async (c: Candidate) => {
    await setCatalogState(db, c.id, { favorite: !c.favorite });
    reload();
  };

  return (
    <div className="stack">
      <input className="input" type="search" placeholder="Suchen, z. B. Pizol" value={q} onChange={(e) => (setQ(e.target.value), setLimit(PAGE))} aria-label="Katalog durchsuchen" />
      <Choice<KindFilter>
        className="compact"
        label="Art"
        options={[
          { value: 'all', label: 'Alle' },
          { value: 'ski_tour', label: 'Skitour' },
          { value: 'snowshoe_trail', label: 'Schneeschuh' },
          { value: 'ski_resort', label: 'Ski' },
        ]}
        value={kind}
        onChange={(k) => (setKind(k), setLimit(PAGE))}
      />
      <span className="tiny muted">
        {rows.length} {showHidden ? 'ausgeblendete' : ''} Einträge · sortiert nach geschätzter Anreise ab {data.profile.startPoints[0]?.name ?? 'Startpunkt'}. Die App wählt daraus automatisch –
        hier kannst du Orte merken, als gemacht markieren oder ausblenden.
      </span>
      <div className="list">
        {rows.slice(0, limit).map(({ c, travel }) => (
          <div key={c.id} className="list-item">
            <button type="button" className="list-main" onClick={() => navigate('list', { catalog: c.id })}>
              <span className="name">{c.name}</span>
              <span className="meta">{catalogMeta(c, travel)}</span>
            </button>
            <button
              type="button"
              className="btn btn-icon btn-ghost"
              aria-pressed={c.favorite === true}
              aria-label={`${c.name} auf die Merkliste`}
              onClick={() => void toggleStar(c)}
            >
              <StarIcon filled={c.favorite === true} />
            </button>
          </div>
        ))}
      </div>
      {rows.length > limit && (
        <button type="button" className="btn" onClick={() => setLimit(limit + PAGE)}>
          Mehr anzeigen ({rows.length - limit})
        </button>
      )}
      <button type="button" className="back-link" onClick={() => (setShowHidden(!showHidden), setLimit(PAGE))}>
        {showHidden ? '‹ Zurück zum Katalog' : 'Ausgeblendete anzeigen ›'}
      </button>
      <span className="tiny muted">{CATALOG_ATTRIBUTION}. Routenangaben ohne Gewähr – sorgfältige Tourenplanung, SAC-Tourenportal.</span>
    </div>
  );
}
