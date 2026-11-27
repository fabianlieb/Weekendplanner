import { useEffect, useState } from 'react';
import { getDb } from '../../data/db';
import { getProfile, newId, saveProfile } from '../../data/repositories';
import type { Equipment, Profile, RiskLevel, StartPoint } from '../../engine/types';
import { formatTime, parseTime } from '../../engine/util';
import { Choice, Field, Notice, Section, showToast, useAsync } from '../components';
import { formatCoordinates, parseCoordinates } from '../geo';
import { EQUIPMENT_HINT, EQUIPMENT_LABEL, RISK_LEVEL_LABEL } from '../labels';
import { navigate } from '../router';

const EQUIPMENT_ORDER: Equipment[] = ['alpine_ski', 'touring_ski', 'skins', 'avalanche_kit', 'snowshoes', 'camera', 'tripod'];

interface StartPointDraft {
  id: string;
  name: string;
  coords: string;
}

export function ProfileScreen({ welcome }: { welcome: boolean }) {
  const db = getDb();
  const { data } = useAsync(() => getProfile(db), []);
  const [p, setP] = useState<Profile>();
  const [points, setPoints] = useState<StartPointDraft[]>([]);
  const [gain, setGain] = useState('');
  const [hours, setHours] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!data) return;
    setP(data);
    setGain(String(data.fitness.maxElevationGain));
    setHours(String(data.fitness.maxHours));
    setPoints(
      data.startPoints.length
        ? data.startPoints.map((s) => ({ id: s.id, name: s.name, coords: formatCoordinates(s) }))
        : [{ id: 'home', name: 'Zuhause', coords: '' }],
    );
  }, [data]);

  if (!p) return null;

  const toggle = (e: Equipment) =>
    setP({ ...p, equipment: p.equipment.includes(e) ? p.equipment.filter((x) => x !== e) : [...p.equipment, e] });

  const setPoint = (i: number, patch: Partial<StartPointDraft>) => setPoints(points.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const takeLocation = (i: number) => {
    if (!navigator.geolocation) return showToast('Standort ist auf diesem Gerät nicht verfügbar.');
    navigator.geolocation.getCurrentPosition(
      (pos) => setPoint(i, { coords: formatCoordinates({ lat: pos.coords.latitude, lon: pos.coords.longitude }) }),
      () => showToast('Standort konnte nicht ermittelt werden.'),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  const save = async () => {
    const errs: string[] = [];
    const g = Number(gain);
    const h = Number(hours.replace(',', '.'));
    if (!Number.isFinite(g) || g < 100 || g > 4000) errs.push('Max. Höhenmeter: Zahl zwischen 100 und 4000.');
    if (!Number.isFinite(h) || h < 1 || h > 16) errs.push('Max. Stunden: Zahl zwischen 1 und 16.');
    const startPoints: StartPoint[] = [];
    points.forEach((s, i) => {
      const c = parseCoordinates(s.coords);
      if (!s.name.trim()) errs.push(`Startpunkt ${i + 1}: Name fehlt.`);
      if (!c) errs.push(`Startpunkt ${i + 1}: Koordinaten nicht lesbar (z. B. 47.3769, 8.5417 oder LV95 2'683'000, 1'248'000).`);
      if (c && s.name.trim()) startPoints.push({ id: s.id, name: s.name.trim(), lat: c.lat, lon: c.lon });
    });
    if (startPoints.length === 0 && errs.length === 0) errs.push('Mindestens ein Startpunkt ist nötig.');
    setErrors(errs);
    if (errs.length) return;
    await saveProfile(db, { ...p, fitness: { maxElevationGain: g, maxHours: h }, startPoints });
    showToast('Profil gespeichert.');
    if (welcome) navigate('admin', { tab: 'list' });
  };

  return (
    <div className="stack">
      {welcome && (
        <Notice>
          Willkommen. Lege zuerst dein Profil an: Material, Risikostufe, Kondition und mindestens einen Startpunkt. Die Daten bleiben nur auf diesem Gerät.
        </Notice>
      )}

      <Section title="Material">
        <div className="choice wrap" role="group" aria-label="Material">
          {EQUIPMENT_ORDER.map((e) => (
            <button key={e} type="button" aria-pressed={p.equipment.includes(e)} onClick={() => toggle(e)}>
              {EQUIPMENT_LABEL[e]}
              {EQUIPMENT_HINT[e] && <span className="sr-only"> ({EQUIPMENT_HINT[e]})</span>}
            </button>
          ))}
        </div>
        <span className="tiny muted">LVS-Set = LVS, Sonde, Schaufel. Skitouren brauchen Tourenski, Felle und LVS-Set; nicht signalisierte Schneeschuh-Touren Schneeschuhe und LVS-Set.</span>
      </Section>

      <Section title="Risikostufe" aside="Obergrenze">
        <Choice<RiskLevel>
          label="Risikostufe"
          options={[1, 2, 3].map((l) => ({ value: l as RiskLevel, label: RISK_LEVEL_LABEL[l as RiskLevel].title }))}
          value={p.riskLevel}
          onChange={(riskLevel) => setP({ ...p, riskLevel })}
        />
        <span className="small">{RISK_LEVEL_LABEL[p.riskLevel].text}</span>
        <span className="tiny muted">Das Risiko stammt nur aus den Skitourenguru-Farben, die du eintragst. Ohne aktuelle Farbe wird keine Tour vorgeschlagen.</span>
      </Section>

      <Section title="Grundkondition" aside="an einem normalen Tag">
        <div className="grid-2">
          <Field label="Max. Höhenmeter" htmlFor="gain">
            <input id="gain" className="input" inputMode="numeric" value={gain} onChange={(e) => setGain(e.target.value)} />
          </Field>
          <Field label="Max. Stunden" htmlFor="hours">
            <input id="hours" className="input" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Früheste Abfahrt">
        <Field label="Uhrzeit" hint="Vor Sonnenaufgang erlaubt – öffnet Morgenlicht und Nebelmeer." htmlFor="start">
          <input
            id="start"
            className="input"
            type="time"
            value={formatTime(p.earliestStart)}
            onChange={(e) => e.target.value && setP({ ...p, earliestStart: parseTime(e.target.value) })}
          />
        </Field>
      </Section>

      <Section title="Startpunkte" aside="z. B. Zuhause, Ferienhaus">
        {points.map((s, i) => (
          <div key={s.id} className="card">
            <Field label="Name" htmlFor={`sp-name-${i}`}>
              <input id={`sp-name-${i}`} className="input" value={s.name} onChange={(e) => setPoint(i, { name: e.target.value })} />
            </Field>
            <Field label="Koordinaten" hint="WGS84 (47.3769, 8.5417) oder LV95 aus swisstopo" htmlFor={`sp-coords-${i}`}>
              <input id={`sp-coords-${i}`} className="input" inputMode="decimal" value={s.coords} placeholder="47.3769, 8.5417" onChange={(e) => setPoint(i, { coords: e.target.value })} />
            </Field>
            <div className="row">
              <button type="button" className="btn grow" onClick={() => takeLocation(i)}>
                Aktueller Standort
              </button>
              {points.length > 1 && (
                <button type="button" className="btn btn-danger" onClick={() => setPoints(points.filter((_, j) => j !== i))}>
                  Entfernen
                </button>
              )}
            </div>
          </div>
        ))}
        <button type="button" className="btn" onClick={() => setPoints([...points, { id: newId('sp'), name: '', coords: '' }])}>
          Startpunkt hinzufügen
        </button>
      </Section>

      {errors.length > 0 && (
        <div className="errors" role="alert">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}
      <button type="button" className="btn btn-primary" onClick={() => void save()}>
        Profil speichern
      </button>
    </div>
  );
}
