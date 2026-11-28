// «Karte»: this weekend's suggestions, Plan B, your plan, the spot radar and the start point on the
// swisstopo winter map, with optional overlays (ski and snowshoe routes, wildlife rest areas).
// Leaflet is loaded only with this view (code split). Tiles need internet.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { getCatalog } from '../../data/catalog';
import { getDb } from '../../data/db';
import { currentWeekendPlan, chosenSuggestion } from '../../data/planner';
import { getProfile } from '../../data/repositories';
import { hasTrack, loadTrack } from '../../data/tracks';
import { DAY_SHORT } from '../../engine/texts';
import type { Candidate, Suggestion } from '../../engine/types';
import { PageHead, useAsync } from '../components';
import { navigate } from '../router';

const WMTS = (layer: string, ext: 'jpeg' | 'png') => `https://wmts.geo.admin.ch/1.0.0/${layer}/default/current/3857/{z}/{x}/{y}.${ext}`;
const SWISSTOPO = '<a href="https://www.swisstopo.admin.ch" target="_blank" rel="noreferrer">© swisstopo</a>';

type Kind = 'suggestion' | 'planB' | 'chosen' | 'radar' | 'start';

function icon(kind: Kind, label: string): L.DivIcon {
  const size = kind === 'radar' || kind === 'start' ? 22 : 30;
  return L.divIcon({
    className: `map-pin map-pin-${kind}`,
    html: `<span>${label}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

/** Popup content as DOM, so the button can navigate inside the app. */
function popup(title: string, lines: string[], detailId?: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'map-popup';
  const h = document.createElement('strong');
  h.textContent = title;
  el.append(h);
  for (const l of lines) {
    const p = document.createElement('span');
    p.textContent = l;
    el.append(p);
  }
  if (detailId) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    b.textContent = 'Detailplan';
    b.onclick = () => navigate('detail', { id: detailId });
    el.append(b);
  }
  return el;
}

const subLine = (s: Suggestion) => `${s.activityLabel} · ${DAY_SHORT[s.day]} · ${s.weather ? `${Math.round(s.weather.temperature)} °C` : ''}`.replace(/ · $/, '');

export function MapView() {
  const db = getDb();
  const { data } = useAsync(async () => {
    const [plan, profile, catalog] = await Promise.all([currentWeekendPlan(db), getProfile(db), getCatalog(db)]);
    const own = await db.candidates.toArray();
    const byId = new Map<string, Candidate>([...catalog, ...own].map((c) => [c.id, c]));
    return { plan, profile, byId };
  }, []);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data || !box.current) return;
    const { plan, profile, byId } = data;
    const map = L.map(box.current, { zoomControl: true, attributionControl: true, maxBounds: [[45.2, 5.2], [48.3, 11.2]] });
    // Plain text prefix (no flag icon).
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noreferrer">Leaflet</a>');

    const winter = L.tileLayer(WMTS('ch.swisstopo.pixelkarte-farbe-winter', 'jpeg'), { maxZoom: 18, minZoom: 7, attribution: SWISSTOPO });
    const summer = L.tileLayer(WMTS('ch.swisstopo.pixelkarte-farbe', 'jpeg'), { maxZoom: 18, minZoom: 7, attribution: SWISSTOPO });
    winter.addTo(map);
    const overlays = {
      Skirouten: L.tileLayer(WMTS('ch.swisstopo-karto.skitouren', 'png'), { maxZoom: 18, opacity: 0.9, attribution: '© swisstopo / SAC' }),
      Schneeschuhrouten: L.tileLayer(WMTS('ch.swisstopo-karto.schneeschuhrouten', 'png'), { maxZoom: 18, opacity: 0.9, attribution: '© swisstopo / SAC' }),
      'Wildruhezonen': L.tileLayer(WMTS('ch.bafu.wrz-wildruhezonen_portal', 'png'), { maxZoom: 18, opacity: 0.7, attribution: 'BAFU' }),
      'Jagdbanngebiete': L.tileLayer(WMTS('ch.bafu.bundesinventare-jagdbanngebiete', 'png'), { maxZoom: 18, opacity: 0.6, attribution: 'BAFU' }),
    };
    L.control.layers({ Winterkarte: winter, Landeskarte: summer }, overlays, { collapsed: true }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);

    const points: L.LatLngExpression[] = [];
    const add = (lat: number, lon: number, kind: Kind, label: string, content: HTMLElement) => {
      L.marker([lat, lon], { icon: icon(kind, label), keyboard: true, title: content.querySelector('strong')?.textContent ?? '' })
        .bindPopup(content)
        .addTo(map);
      points.push([lat, lon]);
    };

    const sp = profile.startPoints.find((s) => s.id === plan?.input.startPointId) ?? plan?.startPoint ?? profile.startPoints[0];
    if (sp) add(sp.lat, sp.lon, 'start', '', popup(sp.name, ['Startpunkt']));

    const chosen = plan ? chosenSuggestion(plan) : undefined;
    const shown: { s: Suggestion; kind: Kind; label: string }[] = [];
    plan?.suggestions.forEach((s, i) => shown.push({ s, kind: chosen?.id === s.id ? 'chosen' : 'suggestion', label: String(i + 1) }));
    if (plan?.planB) shown.push({ s: plan.planB, kind: chosen?.id === plan.planB.id ? 'chosen' : 'planB', label: 'B' });
    if (chosen && !shown.some((x) => x.s.id === chosen.id)) shown.push({ s: chosen, kind: 'chosen', label: '•' });

    for (const { s, kind, label } of shown) {
      const c = byId.get(s.candidateId);
      if (!c) continue;
      const lines = [subLine(s), `Anreise ${Math.round(s.travel.minutes)} min ${s.travel.mode === 'transit' ? 'ÖV' : 'Auto'}`];
      if (kind === 'chosen') lines.unshift('Dein Plan');
      if (kind === 'planB') lines.unshift('Plan B');
      const at = s.activity === 'photo' ? c.summit : c.valley;
      add(at.lat, at.lon, kind, label, popup(s.candidateName, lines, s.id));
      if (hasTrack(c)) {
        void loadTrack(db, c).then((t) => {
          if (t) L.polyline(t.lines, { color: kind === 'planB' ? '#111111' : '#d52b1e', weight: 3, opacity: 0.85 }).addTo(map);
        });
      }
    }

    for (const r of plan?.radar ?? []) {
      const c = byId.get(r.candidateId);
      if (!c || shown.some((x) => x.s.candidateId === c.id)) continue;
      add(c.summit.lat, c.summit.lon, 'radar', '', popup(c.name, ['Merkliste · lohnt sich', r.headline]));
    }

    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 12 });
    else map.setView(points[0] ?? [46.8, 8.2], points.length ? 11 : 8);

    return () => {
      map.remove();
    };
  }, [data]);

  const empty = data && !data.plan;
  return (
    <>
      <PageHead overline="Karte" title="Dieses Wochenende" lead="1–3 Vorschläge, B = Plan B, Kreis = Merkort, Quadrat = Startpunkt. Ebenen oben rechts: Skirouten, Wildruhezonen." />
      {empty && <span className="small muted">Noch keine Vorschläge – sie erscheinen hier nach dem Berechnen.</span>}
      <div ref={box} className="map-view" role="region" aria-label="Karte der Vorschläge" />
      <span className="tiny muted">Karte: © swisstopo (Winterkarte, Routen), BAFU (Wildruhezonen, Jagdbanngebiete). Wildruhezonen und Schutzgebiete vor Ort beachten. Braucht Internet.</span>
    </>
  );
}
