// Small GRM chart (simplified after the official leaflet «Achtung Lawinen»): danger level × steepest
// spot, green / orange / red zones from the app's thresholds, with the tour as a point.
import { THRESHOLDS } from '../../engine/thresholds';
import type { RiskInfo } from '../../engine/types';

const W = 300;
const H = 168;
const X0 = 34;
const X1 = 292;
const Y0 = 10;
const Y1 = 136;
const DEG_TOP = 50;
const DEG_BOTTOM = 25;

const x = (level: number) => X0 + ((Math.min(5, Math.max(1, level)) - 1) / 4) * (X1 - X0);
const y = (deg: number) => Y0 + ((DEG_TOP - Math.min(DEG_TOP, Math.max(DEG_BOTTOM, deg))) / (DEG_TOP - DEG_BOTTOM)) * (Y1 - Y0);

export function greenLine(level: number): number {
  const g = THRESHOLDS.grm;
  return g.greenAtLevel1 - g.greenPerLevel * (level - 1);
}

export function redLine(level: number): number {
  const g = THRESHOLDS.grm;
  return g.redAt.deg - g.redPerLevel * (level - g.redAt.level);
}

const AREA = ['Bereich der Spur', 'ganzer Hang', 'inkl. Auslauf'];
const COLOUR_WORD = { green: 'grün', orange: 'orange', red: 'rot' } as const;

export function GrmChart({ grm }: { grm: NonNullable<RiskInfo['grm']> }) {
  const steps = Array.from({ length: 33 }, (_, i) => 1 + i * 0.125);
  const green = [...steps.map((l) => `${x(l)},${y(greenLine(l))}`), `${x(5)},${y(DEG_BOTTOM)}`, `${x(1)},${y(DEG_BOTTOM)}`].join(' ');
  const red = [...steps.map((l) => `${x(l)},${y(redLine(l))}`), `${x(5)},${y(DEG_TOP)}`, `${x(1)},${y(DEG_TOP)}`].join(' ');
  const px = x(grm.x);
  const py = y(grm.slopeDeg);
  const levels = ['gering', 'mässig', 'erheblich', 'gross'];
  return (
    <figure className="grm-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`GRM: Stufe ${grm.x.toFixed(1)}, steilste Stelle ${Math.round(grm.slopeDeg)}°, ${COLOUR_WORD[grm.color]}`}>
        <rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} className="zone-orange" />
        <polygon points={green} className="zone-green" />
        <polygon points={red} className="zone-red" />
        {[2, 3, 4].map((l) => (
          <line key={l} x1={x(l)} x2={x(l)} y1={Y0} y2={Y1} className="grid" />
        ))}
        {[30, 35, 40, 45].map((d) => (
          <g key={d}>
            <line x1={X0} x2={X1} y1={y(d)} y2={y(d)} className="grid" />
            <text x={X0 - 4} y={y(d) + 3} textAnchor="end" className="axis">
              {d}°
            </text>
          </g>
        ))}
        {levels.map((name, i) => (
          <text key={name} x={x(i + 1.5)} y={Y1 + 14} textAnchor="middle" className="axis">
            {name}
          </text>
        ))}
        <rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} className="frame" />
        <circle cx={px} cy={py} r="6.5" className="point-halo" />
        <circle cx={px} cy={py} r="4.5" className="point" />
      </svg>
      <figcaption className="tiny muted">
        Grafische Reduktionsmethode (vereinfacht nach «Achtung Lawinen», KAT/SLF). Punkt: diese Tour – Stufe {grm.x.toFixed(1).replace('.', ',')}, steilste Stelle
        etwa {Math.round(grm.slopeDeg)}° ({AREA[grm.area]}).
      </figcaption>
    </figure>
  );
}
