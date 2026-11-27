import { useEffect, useState } from 'react';
import { Errors, validateCandidate } from '../../data/backup';
import { getDb } from '../../data/db';
import { deleteCandidate, getProfile, listCandidates, newId, saveCandidate } from '../../data/repositories';
import { travelFor } from '../../engine/suggest';
import type { Candidate, CandidateKind, Profile } from '../../engine/types';
import { Choice, Field, Section, showToast, useAsync } from '../components';
import { formatCoordinates, googleMapsUrl, parseCoordinatesOrLink as parseCoordinates, swisstopoUrl } from '../geo';
import { KIND_LABEL } from '../labels';
import { navigate } from '../router';

interface Draft {
  id: string;
  name: string;
  kind: CandidateKind;
  region: string;
  valleyCoords: string;
  valleyElevation: string;
  summitCoords: string;
  summitElevation: string;
  elevationGain: string;
  durationHours: string;
  approachMinutes: string;
  travel: Record<string, string>;
  signposted: boolean;
  eveningPossible: boolean;
  priceChf: string;
  done: boolean;
  active: boolean;
  note: string;
  link: string;
  photoSpotIds: string[];
  gpx?: string;
  parkingCoords: string;
}

const KINDS: CandidateKind[] = ['ski_tour', 'snowshoe_trail', 'ski_resort', 'photo_spot'];

const POINT_LABELS: Record<CandidateKind, { valley: string; valleyHint: string; summit: string }> = {
  ski_resort: { valley: 'Talstation', valleyHint: 'Wo du parkierst bzw. einsteigst.', summit: 'Bergstation (höchster Punkt)' },
  ski_tour: { valley: 'Startpunkt', valleyHint: 'Parkplatz oder Bergstation, wo der Aufstieg beginnt.', summit: 'Gipfel' },
  snowshoe_trail: { valley: 'Start Trail', valleyHint: 'Parkplatz oder Haltestelle.', summit: 'Höchster Punkt' },
  photo_spot: { valley: 'Talpunkt', valleyHint: 'Ort tief im Tal davor – Bezugspunkt für die Nebelmeer-Erkennung.', summit: 'Fotostandort' },
};

const str = (n: number | undefined) => (n === undefined ? '' : String(n));
const num = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')));

function toDraft(c: Candidate | undefined, kind: CandidateKind): Draft {
  return {
    id: c?.id ?? newId(),
    name: c?.name ?? '',
    kind: c?.kind ?? kind,
    region: c?.region ?? '',
    valleyCoords: c ? formatCoordinates(c.valley) : '',
    valleyElevation: str(c?.valley.elevation),
    summitCoords: c ? formatCoordinates(c.summit) : '',
    summitElevation: str(c?.summit.elevation),
    elevationGain: str(c?.elevationGain),
    durationHours: str(c?.durationHours),
    approachMinutes: str(c?.approachMinutes),
    travel: Object.fromEntries(Object.entries(c?.travelMinutes ?? {}).map(([k, v]) => [k, String(v)])),
    signposted: c?.signposted ?? false,
    eveningPossible: c?.eveningPossible ?? false,
    priceChf: str(c?.priceChf),
    done: c?.done ?? false,
    active: c?.active ?? true,
    note: c?.note ?? '',
    link: c?.link ?? '',
    photoSpotIds: c?.photoSpotIds ?? [],
    ...(c?.gpx ? { gpx: c.gpx } : {}),
    parkingCoords: c?.parking ? formatCoordinates(c.parking) : '',
  };
}

/** Builds the raw object for validation; only fields relevant for the kind are kept. */
function fromDraft(d: Draft): Record<string, unknown> {
  const v = parseCoordinates(d.valleyCoords);
  const s = parseCoordinates(d.summitCoords);
  const isTour = d.kind === 'ski_tour' || d.kind === 'snowshoe_trail';
  const travel: Record<string, number> = {};
  for (const [k, val] of Object.entries(d.travel)) {
    const n = num(val);
    if (n !== undefined) travel[k] = n;
  }
  const opt = (key: string, value: unknown, when = true) => (when && value !== undefined && value !== '' ? { [key]: value } : {});
  return {
    id: d.id,
    name: d.name,
    kind: d.kind,
    valley: v ? { ...v, elevation: num(d.valleyElevation) } : undefined,
    summit: s ? { ...s, elevation: num(d.summitElevation) } : undefined,
    durationHours: num(d.durationHours),
    travelMinutes: travel,
    done: d.done,
    active: d.active,
    ...opt('region', d.region.trim()),
    ...opt('elevationGain', num(d.elevationGain), isTour),
    ...opt('approachMinutes', num(d.approachMinutes), d.kind === 'photo_spot'),
    ...opt('signposted', d.signposted, d.kind === 'snowshoe_trail'),
    ...opt('eveningPossible', d.eveningPossible, isTour),
    ...opt('priceChf', num(d.priceChf), d.kind === 'ski_resort'),
    ...opt('note', d.note.trim()),
    ...opt('link', d.link.trim()),
    ...opt('photoSpotIds', d.photoSpotIds.length ? d.photoSpotIds : undefined, d.kind !== 'photo_spot'),
    ...opt('gpx', d.gpx, isTour),
    ...opt('parking', parseCoordinates(d.parkingCoords)),
  };
}

export function CandidateEditor({ id, kind }: { id?: string; kind?: string }) {
  const db = getDb();
  const { data } = useAsync(async () => ({ profile: await getProfile(db), all: await listCandidates(db) }), [id]);
  const [d, setD] = useState<Draft>();
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!data) return;
    const existing = id ? data.all.find((c) => c.id === id) : undefined;
    setD(toDraft(existing, (KINDS.includes(kind as CandidateKind) ? kind : 'ski_tour') as CandidateKind));
  }, [data, id, kind]);

  if (!data || !d) return null;
  const { profile, all } = data;
  const set = (patch: Partial<Draft>) => setD({ ...d, ...patch });
  const labels = POINT_LABELS[d.kind];
  const isTour = d.kind === 'ski_tour' || d.kind === 'snowshoe_trail';
  const photoSpots = all.filter((c) => c.kind === 'photo_spot' && c.id !== d.id);
  const back = () => navigate('admin', { tab: 'list' });

  const save = async () => {
    const e = new Errors();
    const c = validateCandidate(fromDraft(d), 'Eintrag', e);
    if (!parseCoordinates(d.valleyCoords)) e.add(labels.valley, 'Koordinaten nicht lesbar');
    if (!parseCoordinates(d.summitCoords)) e.add(labels.summit, 'Koordinaten nicht lesbar');
    if (d.parkingCoords.trim() && !parseCoordinates(d.parkingCoords)) e.add('Parkplatz', 'Koordinaten nicht lesbar');
    if (!c || e.list.length) {
      setErrors([...new Set(e.list.map((m) => m.replace(/^Eintrag\.?/, '').replace(/^: /, '')))]);
      return;
    }
    await saveCandidate(db, c);
    showToast('Gespeichert.');
    back();
  };

  const remove = async () => {
    if (!window.confirm(`«${d.name}» löschen? Auch die Risikoeinträge dazu werden gelöscht.`)) return;
    await deleteCandidate(db, d.id);
    showToast('Gelöscht.');
    back();
  };

  const loadGpx = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    if (!/<gpx[\s>]/i.test(text)) return showToast('Das ist keine GPX-Datei.');
    set({ gpx: text });
  };

  const isNew = !all.some((c) => c.id === d.id);

  return (
    <div className="stack">
      <button type="button" className="back-link" onClick={back}>
        ‹ Eigene Liste
      </button>
      <header className="page-head">
        <span className="overline">{isNew ? 'Neuer Eintrag' : KIND_LABEL[d.kind]}</span>
        <h1>{d.name || 'Ohne Namen'}</h1>
      </header>

      <Section title="Grunddaten">
        <Choice<CandidateKind> label="Typ" wrap options={KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} value={d.kind} onChange={(k) => set({ kind: k })} />
        <Field label="Name" htmlFor="c-name">
          <input id="c-name" className="input" value={d.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Region" htmlFor="c-region">
          <input id="c-region" className="input" value={d.region} onChange={(e) => set({ region: e.target.value })} />
        </Field>
      </Section>

      <PointFields
        title={labels.valley}
        hint={labels.valleyHint}
        coords={d.valleyCoords}
        elevation={d.valleyElevation}
        onCoords={(valleyCoords) => set({ valleyCoords })}
        onElevation={(valleyElevation) => set({ valleyElevation })}
        idPrefix="v"
      />
      <PointFields
        title={labels.summit}
        coords={d.summitCoords}
        elevation={d.summitElevation}
        onCoords={(summitCoords) => set({ summitCoords })}
        onElevation={(summitElevation) => set({ summitElevation })}
        idPrefix="s"
      />

      <ParkingField value={d.parkingCoords} onChange={(parkingCoords) => set({ parkingCoords })} kind={d.kind} />

      <Section title="Aufwand">
        <div className="grid-2">
          {isTour && (
            <Field label="Höhenmeter" htmlFor="c-gain">
              <input id="c-gain" className="input" inputMode="numeric" value={d.elevationGain} onChange={(e) => set({ elevationGain: e.target.value })} />
            </Field>
          )}
          <Field label={d.kind === 'ski_resort' ? 'Skitag (h)' : d.kind === 'photo_spot' ? 'Mind. Zeit vor Ort (h)' : 'Dauer total (h)'} htmlFor="c-dur">
            <input id="c-dur" className="input" inputMode="decimal" value={d.durationHours} onChange={(e) => set({ durationHours: e.target.value })} />
          </Field>
          {d.kind === 'photo_spot' && (
            <Field label="Zustieg (min, einfach)" htmlFor="c-appr">
              <input id="c-appr" className="input" inputMode="numeric" value={d.approachMinutes} onChange={(e) => set({ approachMinutes: e.target.value })} />
            </Field>
          )}
          {d.kind === 'ski_resort' && (
            <Field label="Tageskarte (CHF)" htmlFor="c-price">
              <input id="c-price" className="input" inputMode="decimal" value={d.priceChf} onChange={(e) => set({ priceChf: e.target.value })} />
            </Field>
          )}
        </div>
        {d.kind === 'snowshoe_trail' && (
          <label className="check">
            <input type="checkbox" checked={d.signposted} onChange={(e) => set({ signposted: e.target.checked })} />
            Signalisierter Trail
          </label>
        )}
        {d.kind === 'snowshoe_trail' && !d.signposted && (
          <span className="tiny muted">Nicht signalisiert: wird nur mit aktueller Skitourenguru-Farbe vorgeschlagen und braucht ein LVS-Set.</span>
        )}
        {isTour && (
          <label className="check">
            <input type="checkbox" checked={d.eveningPossible} onChange={(e) => set({ eveningPossible: e.target.checked })} />
            Auch als Abendtour möglich
          </label>
        )}
      </Section>

      <TravelFields profile={profile} draft={d} onChange={(travel) => set({ travel })} />

      {d.kind !== 'photo_spot' && photoSpots.length > 0 && (
        <Section title="Fotospots zuordnen" aside="sonst automatisch im Umkreis">
          {photoSpots.map((s) => (
            <label key={s.id} className="check">
              <input
                type="checkbox"
                checked={d.photoSpotIds.includes(s.id)}
                onChange={(e) => set({ photoSpotIds: e.target.checked ? [...d.photoSpotIds, s.id] : d.photoSpotIds.filter((x) => x !== s.id) })}
              />
              {s.name}
            </label>
          ))}
        </Section>
      )}

      <Section title="Weiteres">
        <label className="check">
          <input type="checkbox" checked={d.done} onChange={(e) => set({ done: e.target.checked })} />
          Schon gemacht (bewährt)
        </label>
        <label className="check">
          <input type="checkbox" checked={d.active} onChange={(e) => set({ active: e.target.checked })} />
          Aktiv (wird vorgeschlagen)
        </label>
        <Field label="Link" hint="z. B. swisstopo, SAC-Tourenportal oder Instagram" htmlFor="c-link">
          <input id="c-link" className="input" type="url" inputMode="url" value={d.link} placeholder="https://" onChange={(e) => set({ link: e.target.value })} />
        </Field>
        <Field label="Notiz" htmlFor="c-note">
          <textarea id="c-note" className="input" value={d.note} onChange={(e) => set({ note: e.target.value })} />
        </Field>
        {isTour && (
          <Field label="GPX-Track" hint={d.gpx ? 'Track hinterlegt.' : 'Optional, für den GPX-Export im Detailplan.'}>
            <div className="row">
              <label className="btn grow">
                {d.gpx ? 'Anderen Track wählen' : 'GPX-Datei wählen'}
                <input type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" className="sr-only" onChange={(e) => void loadGpx(e.target.files?.[0])} />
              </label>
              {d.gpx && (
                <button type="button" className="btn btn-danger" onClick={() => set({ gpx: undefined })}>
                  Entfernen
                </button>
              )}
            </div>
          </Field>
        )}
      </Section>

      {errors.length > 0 && (
        <div className="errors" role="alert">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}
      <button type="button" className="btn btn-primary" onClick={() => void save()}>
        Speichern
      </button>
      {!isNew && (
        <button type="button" className="btn btn-danger" onClick={() => void remove()}>
          Löschen
        </button>
      )}
    </div>
  );
}

function PointFields(props: {
  title: string;
  hint?: string;
  coords: string;
  elevation: string;
  onCoords: (v: string) => void;
  onElevation: (v: string) => void;
  idPrefix: string;
}) {
  const parsed = parseCoordinates(props.coords);
  return (
    <Section title={props.title}>
      {props.hint && <span className="tiny muted">{props.hint}</span>}
      <Field label="Koordinaten" hint="swisstopo-Link einfügen, LV95 (2'683'000, 1'248'000) oder WGS84 (46.8, 9.83)" htmlFor={`${props.idPrefix}-coords`}>
        <input
          id={`${props.idPrefix}-coords`}
          className="input"
          inputMode="decimal"
          value={props.coords}
          aria-invalid={props.coords !== '' && !parsed}
          onChange={(e) => props.onCoords(e.target.value)}
        />
      </Field>
      {parsed && /https?:/.test(props.coords) && <span className="tiny">Gelesen: {formatCoordinates(parsed)}</span>}
      <div className="row">
        <Field label="Höhe (m ü. M.)" htmlFor={`${props.idPrefix}-elev`}>
          <input id={`${props.idPrefix}-elev`} className="input" inputMode="numeric" value={props.elevation} onChange={(e) => props.onElevation(e.target.value)} />
        </Field>
        {parsed && (
          <a className="btn" style={{ alignSelf: 'flex-end' }} href={swisstopoUrl(parsed)} target="_blank" rel="noreferrer">
            In swisstopo prüfen
          </a>
        )}
      </div>
    </Section>
  );
}

function TravelFields({ profile, draft, onChange }: { profile: Profile; draft: Draft; onChange: (t: Record<string, string>) => void }) {
  const valley = parseCoordinates(draft.valleyCoords);
  if (profile.startPoints.length === 0) {
    return (
      <Section title="Anreise">
        <span className="small muted">Lege im Profil zuerst einen Startpunkt an.</span>
      </Section>
    );
  }
  return (
    <Section title="Anreise" aside="Minuten, einfache Fahrt">
      <div className="grid-2">
        {profile.startPoints.map((sp) => {
          const estimate = valley
            ? travelFor({ valley: { ...valley, elevation: 0 }, travelMinutes: {} } as unknown as Candidate, sp).minutes
            : undefined;
          return (
            <Field key={sp.id} label={`ab ${sp.name}`} hint={estimate !== undefined ? `Schätzung ca. ${estimate} min` : undefined} htmlFor={`t-${sp.id}`}>
              <input
                id={`t-${sp.id}`}
                className="input"
                inputMode="numeric"
                value={draft.travel[sp.id] ?? ''}
                placeholder={estimate !== undefined ? String(estimate) : ''}
                onChange={(e) => onChange({ ...draft.travel, [sp.id]: e.target.value })}
              />
            </Field>
          );
        })}
      </div>
      <span className="tiny muted">Leer = Schätzung aus der Luftlinie (wird als «geschätzt» angezeigt).</span>
    </Section>
  );
}

function ParkingField({ value, onChange, kind }: { value: string; onChange: (v: string) => void; kind: CandidateKind }) {
  const parsed = parseCoordinates(value);
  return (
    <Section title="Parkplatz" aside="optional, für die Navigation">
      <Field
        label="Koordinaten"
        hint={`swisstopo-Link oder Koordinaten. Leer = Navigation zum ${kind === 'photo_spot' ? 'Fotostandort' : 'Startpunkt'}.`}
        htmlFor="p-coords"
      >
        <input id="p-coords" className="input" inputMode="url" value={value} aria-invalid={value !== '' && !parsed} onChange={(e) => onChange(e.target.value)} />
      </Field>
      {parsed && (
        <div className="row">
          <span className="small grow">{formatCoordinates(parsed)}</span>
          <a className="btn" href={googleMapsUrl(parsed)} target="_blank" rel="noreferrer">
            In Google Maps prüfen
          </a>
        </div>
      )}
    </Section>
  );
}
