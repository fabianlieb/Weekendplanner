// Small inline line icons (no emojis, no icon font). Stroke uses currentColor.

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'square' as const, 'aria-hidden': true };

export function CalendarPlusIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <rect x="3" y="5" width="15" height="15" />
      <path d="M3 9.5h15M7.5 3v4M13.5 3v4" />
      <path d="M19.5 13v8M15.5 17h8" stroke="var(--accent)" strokeWidth="2" />
    </svg>
  );
}

export function NavigateIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}

export function WeekendIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M2.5 19.5 9 9l4 6 2.5-3.5 6 8z" />
      <circle cx="17.5" cy="5.5" r="2" />
    </svg>
  );
}

export function ListIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12" />
      <path d="M3.5 6.5h1M3.5 12h1M3.5 17.5h1" />
    </svg>
  );
}

export function ProfileIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" />
    </svg>
  );
}

export function RefreshIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}

export function ShareIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" />
      <path d="M5 11v9h14v-9" />
    </svg>
  );
}

export function StarIcon({ size = 22, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} fill={filled ? 'var(--accent)' : 'none'} stroke={filled ? 'var(--accent)' : 'currentColor'}>
      <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9-4.3-4.1 5.9-.8z" strokeLinejoin="round" />
    </svg>
  );
}
