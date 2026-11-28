import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { RiskColor } from '../engine/types';
import { ATTRIBUTION, ATTRIBUTION_LICENSE } from '../data/openMeteo';
import { CATALOG_ATTRIBUTION } from '../data/catalog';
import { ROUTING_ATTRIBUTION } from '../data/routing';
import { SLF_URL, SNOW_ATTRIBUTION } from '../data/snow';
import { LINKS, RISK_COLOR_SHORT } from './labels';

export function PageHead({ overline, title, lead, icon }: { overline?: string; title: string; lead?: ReactNode; icon?: ReactNode }) {
  return (
    <header className="page-head">
      {overline && (
        <span className="overline overline-row">
          {icon}
          {overline}
        </span>
      )}
      <h1>{title}</h1>
      {lead && <span className="lead">{lead}</span>}
    </header>
  );
}

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-title">
        <span>{title}</span>
        {aside && <span className="muted">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

export interface ChoiceOption<T> {
  value: T;
  label: ReactNode;
  ariaLabel?: string;
}

export function Choice<T extends string | number>({
  options,
  value,
  onChange,
  label,
  wrap,
  className,
}: {
  options: ChoiceOption<T>[];
  value: T | undefined;
  onChange: (v: T) => void;
  label: string;
  wrap?: boolean;
  className?: string;
}) {
  return (
    <div className={`choice${wrap ? ' wrap' : ''}${className ? ` ${className}` : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} aria-label={o.ariaLabel} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, error, htmlFor, children }: { label: string; hint?: ReactNode; error?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="field">
      {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span className="label">{label}</span>}
      {children}
      {hint && <span className="hint">{hint}</span>}
      {error && <span className="error">{error}</span>}
    </div>
  );
}

/** Risk colour: always a swatch plus text, never colour alone. */
export function RiskBadge({ color, text }: { color?: RiskColor; text?: string }) {
  return (
    <span className="tag">
      <span className={`swatch ${color ?? 'unknown'}`} aria-hidden="true" />
      {text ?? (color ? RISK_COLOR_SHORT[color] : 'unbekannt')}
    </span>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn'; children: ReactNode }) {
  return <div className={`notice${tone === 'warn' ? ' warn' : ''}`}>{children}</div>;
}

export function Attribution() {
  return (
    <footer className="attribution">
      <a href={LINKS.openMeteo} target="_blank" rel="noreferrer">
        {ATTRIBUTION}
      </a>{' '}
      (
      <a href={LINKS.ccBy} target="_blank" rel="noreferrer">
        {ATTRIBUTION_LICENSE}
      </a>
      ) · {CATALOG_ATTRIBUTION} · {ROUTING_ATTRIBUTION} ·{' '}
      <a href={SLF_URL} target="_blank" rel="noreferrer">
        {SNOW_ATTRIBUTION}
      </a>{' '}
      · Lawinenrisiko: Farben von Skitourenguru, manuell eingetragen · Daten nur auf diesem Gerät
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Hooks

export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[]): { data: T | undefined; error: string | undefined; loading: boolean; reload: () => void } {
  const [state, setState] = useState<{ data: T | undefined; error: string | undefined; loading: boolean }>({ data: undefined, error: undefined, loading: true });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    fnRef
      .current()
      .then((data) => alive && setState({ data, error: undefined, loading: false }))
      .catch((e: unknown) => alive && setState({ data: undefined, error: e instanceof Error ? e.message : String(e), loading: false }));
    return () => {
      alive = false;
    };
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
const toastListeners = new Set<(msg: string | undefined) => void>();

export function showToast(msg: string): void {
  toastListeners.forEach((l) => l(msg));
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastListeners.forEach((l) => l(undefined)), 2500);
}

export function Toast() {
  const [msg, setMsg] = useState<string>();
  useEffect(() => {
    toastListeners.add(setMsg);
    return () => {
      toastListeners.delete(setMsg);
    };
  }, []);
  return msg ? (
    <div className="toast" role="status">
      {msg}
    </div>
  ) : null;
}
