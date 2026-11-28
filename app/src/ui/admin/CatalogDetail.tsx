// One catalogue entry: facts, links, and the user's markings. «In eigene Liste übernehmen»
// copies it into the own list (to add travel times, parking, packing extras).
import { CATALOG_ATTRIBUTION, copyToOwn, getCandidate, setCatalogState } from '../../data/catalog';
import { getDb } from '../../data/db';
import { getProfile, newId, saveCandidate } from '../../data/repositories';
import { travelFor } from '../../engine/travel';
import { Notice, PageHead, Section, showToast, useAsync } from '../components';
import { googleMapsUrl, navigationTarget, swisstopoUrl } from '../geo';
import { StarIcon } from '../icons';
import { navigate } from '../router';
import { catalogMeta } from './CatalogBrowser';

export function CatalogDetail({ id }: { id: string }) {
  const db = getDb();
  const { data, reload } = useAsync(async () => ({ c: await getCandidate(db, id), profile: await getProfile(db) }), [id]);
  const back = (
    <button type="button" className="back-link" onClick={() => navigate('list', { src: 'catalog' })}>
      ‹ Katalog
    </button>
  );
  if (!data) return null;
  const { c, profile } = data;
  if (!c) {
    return (
      <>
        {back}
        <PageHead title="Nicht gefunden" />
      </>
    );
  }
  const sp = profile.startPoints[0];
  const nav = navigationTarget(c);
  const mark = async (patch: Parameters<typeof setCatalogState>[2], msg: string) => {
    await setCatalogState(db, c.id, patch);
    showToast(msg);
    reload();
  };
  const copy = async () => {
    const own = copyToOwn(c, newId());
    await saveCandidate(db, own);
    showToast('In deine Liste übernommen.');
    navigate('list', { edit: own.id });
  };

  return (
    <>
      {back}
      <PageHead overline={c.source ?? 'Katalog'} title={c.name} lead={catalogMeta(c, sp ? travelFor(c, sp).minutes : undefined)} />
      {!c.active && <Notice tone="warn">Ausgeblendet – wird nicht vorgeschlagen.</Notice>}

      <Section title="Eckdaten">
        <span className="small">
          Start {c.valley.elevation} m · Ziel {c.summit.elevation} m{c.elevationGain ? ` · ${c.elevationGain} Hm` : ''} · ca. {c.durationHours} h
        </span>
        {c.difficulty && <span className="small">Schwierigkeit: {c.difficulty}</span>}
        {c.note && <span className="small muted">{c.note}</span>}
        <div className="row-wrap">
          {c.link && (
            <a className="btn" href={c.link} target="_blank" rel="noreferrer">
              {c.source?.includes('SAC') ? 'SAC-Tourenportal' : c.source?.includes('SchweizMobil') ? 'SchweizMobil' : 'Link'}
            </a>
          )}
          <a className="btn" href={swisstopoUrl(c.summit)} target="_blank" rel="noreferrer">
            Karte (swisstopo)
          </a>
          <a className="btn" href={googleMapsUrl(nav.point)} target="_blank" rel="noreferrer">
            Navigation: {nav.label}
          </a>
        </div>
      </Section>

      <Section title="Für dich">
        <div className="row-wrap">
          <button type="button" className="btn" aria-pressed={c.favorite === true} onClick={() => void mark({ favorite: !c.favorite }, c.favorite ? 'Von der Merkliste entfernt.' : 'Auf der Merkliste.')}>
            <StarIcon filled={c.favorite === true} size={18} /> {c.favorite ? 'Gemerkt' : 'Merken'}
          </button>
          <button type="button" className="btn" aria-pressed={c.done} onClick={() => void mark({ done: !c.done }, c.done ? 'Nicht mehr als gemacht markiert.' : 'Als gemacht markiert.')}>
            {c.done ? 'Gemacht' : 'Schon gemacht'}
          </button>
          <button type="button" className="btn" onClick={() => void mark({ hidden: c.active }, c.active ? 'Wird nicht mehr vorgeschlagen.' : 'Wird wieder vorgeschlagen.')}>
            {c.active ? 'Nicht vorschlagen' : 'Wieder vorschlagen'}
          </button>
        </div>
        <button type="button" className="btn btn-dark" onClick={() => void copy()}>
          In eigene Liste übernehmen (bearbeiten)
        </button>
        <span className="tiny muted">In der eigenen Liste kannst du Anreisezeiten, Parkplatz und Packliste ergänzen; der Katalog-Eintrag fällt dann als Duplikat weg.</span>
      </Section>

      <span className="tiny muted">{CATALOG_ATTRIBUTION}. Routenangaben ohne Gewähr; der effektive Routenverlauf hängt von den Verhältnissen ab.</span>
    </>
  );
}
