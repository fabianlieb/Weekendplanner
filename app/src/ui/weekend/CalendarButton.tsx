// Calendar button (calendar with a small plus). On tap a small sheet offers:
// «Im Kalender öffnen» (direct) and «Als Datei teilen» (share sheet), because iOS behaves
// differently depending on version; one of the two always works.
import { useState } from 'react';
import type { Candidate, PlanB, Suggestion } from '../../engine/types';
import { showToast } from '../components';
import { openCalendarFile, shareCalendarFile } from '../files';
import { googleMapsUrl, navigationTarget } from '../geo';
import { buildIcs } from '../ics';
import { packingList } from '../../engine/packing';
import { CalendarPlusIcon } from '../icons';

export function CalendarButton({ s, candidate, tall = false }: { s: Suggestion | PlanB; candidate: Candidate | undefined; tall?: boolean }) {
  const [open, setOpen] = useState(false);
  const nav = candidate ? navigationTarget(candidate) : undefined;
  if (!nav) {
    return (
      <button type="button" className={`btn btn-icon${tall ? ' tall' : ''}`} aria-label="In Kalender eintragen" disabled>
        <CalendarPlusIcon />
      </button>
    );
  }

  const ics = () => {
    const navUrl = googleMapsUrl(nav.point);
    const appUrl = `${window.location.origin}${window.location.pathname}?view=detail&id=${encodeURIComponent(s.id)}`;
    return buildIcs({
      s,
      place: { name: `${s.candidateName}, ${nav.label}`, lat: nav.point.lat, lon: nav.point.lon },
      navigationUrl: navUrl,
      appUrl,
      packing: packingList(s, candidate),
    });
  };
  const name = `wochenende-${s.date}.ics`;

  return (
    <>
      <button type="button" className={`btn btn-icon${tall ? ' tall' : ''}`} aria-label="In Kalender eintragen" title="In Kalender eintragen" onClick={() => setOpen(true)}>
        <CalendarPlusIcon />
      </button>
      {open && (
        <div className="sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="sheet" role="dialog" aria-label="In Kalender eintragen" onClick={(e) => e.stopPropagation()}>
            <strong>In Kalender eintragen</strong>
            <span className="small muted">
              {s.candidateName} · Abfahrt bis Rückkehr, Erinnerung am Vorabend um 18:00 und 30 min vor der Abfahrt.
            </span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setOpen(false);
                void openCalendarFile(name, ics());
              }}
            >
              Im Kalender öffnen
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setOpen(false);
                void shareCalendarFile(name, ics()).then(() => showToast('Datei öffnen, dann «Alle hinzufügen».'));
              }}
            >
              Als Datei teilen (.ics)
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </>
  );
}
