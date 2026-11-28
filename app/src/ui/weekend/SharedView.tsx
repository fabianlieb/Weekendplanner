// Read-only view of a plan someone shared by link. Nothing is stored on this device.
import { useEffect, useState } from 'react';
import { formatTime } from '../../engine/util';
import { Notice, PageHead, Section } from '../components';
import { googleMapsUrl, swisstopoUrl } from '../geo';
import { NavigateIcon } from '../icons';
import { decodeSharedPlan, type SharedPlan } from '../share';
import { RiskBlock } from './RiskBlock';

function readHash(): SharedPlan | undefined {
  const m = window.location.hash.match(/[#&]p=([A-Za-z0-9_-]+)/);
  return decodeSharedPlan(m?.[1]);
}

export function SharedView() {
  const [p, setP] = useState(readHash);
  useEffect(() => {
    const on = () => setP(readHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  if (!p) {
    return (
      <>
        <PageHead overline="Geteilter Plan" title="Link nicht lesbar" lead="Der Link ist unvollständig. Bitte nochmals schicken lassen." />
      </>
    );
  }

  return (
    <>
      <PageHead overline={`Geteilter Plan · ${p.activityLabel} · ${p.dayLabel}`} title={p.name} {...(p.region ? { lead: p.region } : {})} />
      <Notice>Jemand hat diesen Plan mit dir geteilt. Er wird auf deinem Gerät nicht gespeichert.</Notice>

      <RiskBlock risk={p.risk} />

      <div className="stack-sm">
        {p.weather && <strong className="card-weather">{p.weather}</strong>}
        <span className="small">{p.reasons.join(' ')}</span>
        {p.photo && <span className="small">Fotospot {p.photo}</span>}
      </div>

      <Section title="Zeitplan">
        <ol className="schedule">
          {p.schedule.map((i) => (
            <li key={`${i.time}-${i.label}`}>
              <span className="time">{formatTime(i.time)}</span>
              <span>{i.label}</span>
            </li>
          ))}
        </ol>
      </Section>

      {p.packing.length > 0 && (
        <details className="more">
          <summary>Packliste · {p.packing.length}</summary>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            {p.packing.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </details>
      )}

      {p.nav && (
        <div className="row">
          <a className="btn btn-dark grow" href={googleMapsUrl(p.nav)} target="_blank" rel="noreferrer">
            <NavigateIcon /> Navigation: {p.nav.label}
          </a>
          <a className="btn" href={swisstopoUrl(p.nav)} target="_blank" rel="noreferrer">
            Karte
          </a>
        </div>
      )}
    </>
  );
}
