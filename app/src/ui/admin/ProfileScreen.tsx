// Everything about the person on one page: sports and level, equipment, fitness, start points.
// Changes are saved automatically.
import { useEffect, useRef, useState } from 'react';
import { getDb } from '../../data/db';
import { getProfile, hasProfile, newId, saveProfile } from '../../data/repositories';
import { ACTIVITIES, AVALANCHE_ACTIVITIES, SKI_TOUR_GRADES, SNOWSHOE_GRADES, missingEquipment } from '../../engine/profile';
import type { Activity, Equipment, Profile, RiskLevel, SkiTourGrade, SnowshoeGrade, StartPoint } from '../../engine/types';
import { formatTime, parseTime } from '../../engine/util';
import { Choice, Field, Notice, PageHead, Section, showToast, useAsync } from '../components';
import { formatCoordinates, parseCoordinatesOrLink as parseCoordinates } from '../geo';
import { ACTIVITY_NAME, EQUIPMENT_LABEL, LEVEL_TEXT } from '../labels';
import { navigate } from '../router';

const EQUIPMENT_ORDER: Equipment[] = ['alpine_ski', 'touring_ski', 'skins', 'avalanche_kit', 'snowshoes', 'camera', 'tripod'];

interface StartPointDraft {
  id: string;
  name: string;
  coords: string;
}

interface Draft {
  profile: Profile;
  gain: string;
  hours: string;
  points: StartPointDraft[];
}

function build(d: Draft): { profile?: Profile; errors: string[] } {
  const errors: string[] = [];
  const g = Number(d.gain);
  const h = Number(d.hours.replace(',', '.'));
  if (!Number.isFinite(g) || g < 100 || g > 4000) errors.push('Max. Höhenmeter: Zahl zwischen 100 und 4000.');
  if (!Number.isFinite(h) || h < 1 || h > 16) errors.push('Max. Stunden: Zahl zwischen 1 und 16.');
  const startPoints: StartPoint[] = [];
  d.points.forEach((s, i) => {
    if (!s.name.trim() && !s.coords.trim()) return; // an empty row is ignored
    const c = parseCoordinates(s.coords);
    if (!s.name.trim()) errors.push(`Startpunkt ${i + 1}: Name fehlt.`);
    if (!c) errors.push(`Startpunkt ${i + 1}: Koordinaten nicht lesbar.`);
    if (c && s.name.trim()) startPoints.push({ id: s.id, name: s.name.trim(), lat: c.lat, lon: c.lon });
  });
  if (errors.length) return { errors };
  return { profile: { ...d.profile, fitness: { maxElevationGain: g, maxHours: h }, startPoints }, errors };
}

export function ProfileScreen({ welcome }: { welcome: boolean }) {
  const db = getDb();
  const { data } = useAsync(async () => ({ profile: await getProfile(db), exists: await hasProfile(db) }), []);
  const [d, setD] = useState<Draft>();
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (!data) return;
    const p = data.profile;
    setD({
      profile: p,
      gain: String(p.fitness.maxElevationGain),
      hours: String(p.fitness.maxHours),
      points: p.startPoints.length
        ? p.startPoints.map((s) => ({ id: s.id, name: s.name, coords: formatCoordinates(s) }))
        : [{ id: 'home', name: 'Zuhause', coords: '' }],
    });
  }, [data]);

  // Auto-save (debounced) whenever the draft is valid. The first draft is the loaded profile.
  useEffect(() => {
    if (!d) return;
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    setSaved(false);
    const t = setTimeout(() => {
      const r = build(d);
      setErrors(r.errors);
      if (r.profile) void saveProfile(db, r.profile).then(() => setSaved(true));
    }, 500);
    return () => clearTimeout(t);
  }, [d]);

  if (!d || !data) return null;
  const p = d.profile;
  const setProfile = (patch: Partial<Profile>) => setD({ ...d, profile: { ...p, ...patch } });
  const setActivity = (a: Activity, patch: Partial<Profile['activities'][Activity]>) =>
    setProfile({ activities: { ...p.activities, [a]: { ...p.activities[a], ...patch } } });
  const toggleEquipment = (e: Equipment) => setProfile({ equipment: p.equipment.includes(e) ? p.equipment.filter((x) => x !== e) : [...p.equipment, e] });
  const addEquipment = (list: Equipment[]) => setProfile({ equipment: [...new Set([...p.equipment, ...list])] });
  const setPoint = (i: number, patch: Partial<StartPointDraft>) => setD({ ...d, points: d.points.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  const takeLocation = (i: number) => {
    if (!navigator.geolocation) return showToast('Standort ist auf diesem Gerät nicht verfügbar.');
    navigator.geolocation.getCurrentPosition(
      (pos) => setPoint(i, { coords: formatCoordinates({ lat: pos.coords.latitude, lon: pos.coords.longitude }) }),
      () => showToast('Standort konnte nicht ermittelt werden.'),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  const ready = errors.length === 0 && d.points.some((s) => s.name.trim() && parseCoordinates(s.coords));

  return (
    <>
      <PageHead overline="Profil" title="Über dich" lead={saved ? 'Gespeichert.' : 'Änderungen werden automatisch gespeichert.'} />
      {welcome && <Notice>Willkommen. Sag der App, welche Sportarten du machst, was du hast und wo du startest. Alles bleibt auf diesem Gerät.</Notice>}

      <Section title="Sportarten und Niveau">
        {ACTIVITIES.map((a) => {
          const s = p.activities[a];
          const missing = s.enabled ? missingEquipment(p, a) : [];
          return (
            <div key={a} className="activity-row">
              <label className="check">
                <input type="checkbox" checked={s.enabled} onChange={(e) => setActivity(a, { enabled: e.target.checked })} />
                <strong>{ACTIVITY_NAME[a]}</strong>
              </label>
              {s.enabled && AVALANCHE_ACTIVITIES.includes(a) && (
                <>
                  <Choice<RiskLevel>
                    className="compact"
                    label={`Niveau ${ACTIVITY_NAME[a]}`}
                    options={([1, 2, 3] as RiskLevel[]).map((l) => ({ value: l, label: `Stufe ${l}` }))}
                    value={s.level}
                    onChange={(level) => setActivity(a, { level })}
                  />
                  <span className="tiny">{LEVEL_TEXT[s.level]}</span>
                  {a === 'ski_tour' ? (
                    <div className="row">
                      <span className="tiny" style={{ width: 92, flex: 'none' }}>
                        Schwierigkeit bis (SAC)
                      </span>
                      <div className="grow">
                        <Choice<SkiTourGrade>
                          className="compact"
                          label="Schwierigkeit Skitour bis"
                          options={SKI_TOUR_GRADES.map((g) => ({ value: g, label: g }))}
                          value={p.maxDifficulty.ski_tour}
                          onChange={(g) => setProfile({ maxDifficulty: { ...p.maxDifficulty, ski_tour: g } })}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="row">
                      <span className="tiny" style={{ width: 92, flex: 'none' }}>
                        Schwierigkeit bis
                      </span>
                      <div className="grow">
                        <Choice<SnowshoeGrade>
                          className="compact"
                          label="Schwierigkeit Schneeschuh bis"
                          options={SNOWSHOE_GRADES.map((g) => ({ value: g, label: g }))}
                          value={p.maxDifficulty.snowshoe}
                          onChange={(g) => setProfile({ maxDifficulty: { ...p.maxDifficulty, snowshoe: g } })}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
              {missing.length > 0 && (
                <div className="row tiny">
                  <span className="grow accent">Fehlt: {missing.map((m) => EQUIPMENT_LABEL[m]).join(', ')}</span>
                  <button type="button" className="btn btn-ghost" onClick={() => addEquipment(missing)}>
                    Habe ich
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <span className="tiny muted">
          Die Stufe begrenzt, welche Skitourenguru-Farben vorgeschlagen werden; die Farbe selbst trägst du tagesaktuell auf dem Wochenende-Screen ein. Die
          Schwierigkeit begrenzt die Routen aus dem Katalog (SAC-Skala L · WS · ZS · S; Schneeschuh leicht · mittel · schwer).
        </span>
      </Section>

      <Section title="Material">
        <div className="choice wrap" role="group" aria-label="Material">
          {EQUIPMENT_ORDER.map((e) => (
            <button key={e} type="button" aria-pressed={p.equipment.includes(e)} onClick={() => toggleEquipment(e)}>
              {EQUIPMENT_LABEL[e]}
            </button>
          ))}
        </div>
        <span className="tiny muted">LVS-Set = LVS, Sonde, Schaufel.</span>
      </Section>

      <Section title="Kondition" aside="an einem normalen Tag">
        <div className="grid-3">
          <Field label="Höhenmeter" htmlFor="gain">
            <input id="gain" className="input" inputMode="numeric" value={d.gain} onChange={(e) => setD({ ...d, gain: e.target.value })} />
          </Field>
          <Field label="Stunden" htmlFor="hours">
            <input id="hours" className="input" inputMode="decimal" value={d.hours} onChange={(e) => setD({ ...d, hours: e.target.value })} />
          </Field>
          <Field label="Abfahrt ab" htmlFor="start">
            <input
              id="start"
              className="input"
              type="time"
              value={formatTime(p.earliestStart)}
              onChange={(e) => e.target.value && setProfile({ earliestStart: parseTime(e.target.value) })}
            />
          </Field>
        </div>
      </Section>

      <Section title="Startpunkte" aside="für Anreisezeiten">
        {d.points.map((s, i) => (
          <div key={s.id} className="card">
            <div className="grid-2">
              <Field label="Name" htmlFor={`sp-name-${i}`}>
                <input id={`sp-name-${i}`} className="input" value={s.name} placeholder="z. B. Zuhause" onChange={(e) => setPoint(i, { name: e.target.value })} />
              </Field>
              <Field label="Koordinaten" htmlFor={`sp-coords-${i}`}>
                <input id={`sp-coords-${i}`} className="input" inputMode="url" value={s.coords} placeholder="47.37, 8.54" onChange={(e) => setPoint(i, { coords: e.target.value })} />
              </Field>
            </div>
            <div className="row">
              <button type="button" className="btn grow" onClick={() => takeLocation(i)}>
                Aktueller Standort
              </button>
              {d.points.length > 1 && (
                <button type="button" className="btn btn-danger" onClick={() => setD({ ...d, points: d.points.filter((_, j) => j !== i) })}>
                  Entfernen
                </button>
              )}
            </div>
          </div>
        ))}
        <button type="button" className="btn" onClick={() => setD({ ...d, points: [...d.points, { id: newId('sp'), name: '', coords: '' }] })}>
          Startpunkt hinzufügen
        </button>
        <span className="tiny muted">Koordinaten als swisstopo-Link, LV95 oder WGS84. Auf dem Wochenende-Screen kannst du auch «Standort» wählen.</span>
      </Section>

      {errors.length > 0 && (
        <div className="errors" role="alert">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}

      {(welcome || !data.exists) && (
        <button type="button" className="btn btn-primary" disabled={!ready} onClick={() => navigate('list', { welcome: '1' })}>
          Weiter: deine Liste
        </button>
      )}

      <Section title="Daten">
        <div className="grid-2">
          <button type="button" className="btn" onClick={() => navigate('backup')}>
            Backup & Import
          </button>
          <button type="button" className="btn" onClick={() => navigate('stats')}>
            Auswertung
          </button>
        </div>
      </Section>
    </>
  );
}
