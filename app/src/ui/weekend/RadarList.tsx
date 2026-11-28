// «Merkliste – lohnt sich»: favourite places with very good conditions in the coming days.
import type { RadarHit } from '../../engine/radar';
import { shortDate } from '../../engine/texts';
import { ACTIVITY_NAME } from '../labels';
import { navigate } from '../router';

export function RadarList({ hits, hasFavorites }: { hits: RadarHit[] | undefined; hasFavorites: boolean }) {
  if (!hasFavorites) {
    return (
      <span className="tiny muted">
        Tipp: Markiere Orte in der Liste mit dem Stern – der Spot-Radar meldet dann hier, wann es sich dort lohnt.
      </span>
    );
  }
  return (
    <section className="section">
      <div className="section-title">
        <span>Merkliste · lohnt sich</span>
        <span className="muted">nächste 7 Tage</span>
      </div>
      {!hits || hits.length === 0 ? (
        <span className="small muted">Gerade keine besonders guten Bedingungen an deinen Merkorten.</span>
      ) : (
        <div className="list">
          {hits.map((h) => (
            <button key={`${h.candidateId}-${h.date}-${h.slot}`} type="button" className="list-item radar-item" onClick={() => navigate('list', { edit: h.candidateId })}>
              <span className="list-main">
                <span className="name">
                  {h.name} <span className="muted small">· {shortDate(h.date)}</span>
                </span>
                <span className="meta">
                  {h.activity === 'photo' ? (h.slot === 'morning' ? 'Foto am Morgen' : 'Foto am Abend') : ACTIVITY_NAME[h.activity]} · {h.headline}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      <span className="tiny muted">Touren im Lawinengelände erscheinen hier nicht – sie brauchen die Skitourenguru-Farbe von heute.</span>
    </section>
  );
}
