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

export function MapIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z" />
      <path d="M9 4v13.5M15 6.5V20" />
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

/** One line icon per sport (piste skiing, ski tour, snowshoe, photo). */
export function SportIcon({ activity, size = 18 }: { activity: 'ski' | 'ski_tour' | 'snowshoe' | 'photo'; size?: number }) {
  const label = { ski: 'Ski (Piste)', ski_tour: 'Skitour', snowshoe: 'Schneeschuh', photo: 'Fotografie' }[activity];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={label} className="sport-icon">
      {activity === 'ski' && (
        <>
          <circle cx="15.5" cy="4.5" r="1.8" />
          <path d="M14.5 7.5 10 12l3.5 2.5-2 4" />
          <path d="M3 15.5l17 6" />
          <path d="M6 8.5l4 3.5" />
        </>
      )}
      {activity === 'ski_tour' && (
        <>
          <path d="M2 20 11 5l11 15" />
          <path d="M7.5 18.5 12 16.5 9 13.5l4-2-2.5-2.5" strokeDasharray="1.5 2" />
        </>
      )}
      {activity === 'snowshoe' && (
        <>
          <ellipse cx="12" cy="12" rx="5" ry="9" />
          <path d="M8 8.5h8M7.3 12h9.4M8 15.5h8" />
          <path d="M12 3v18" />
        </>
      )}
      {activity === 'photo' && (
        <>
          <path d="M3 8h4l1.5-2.5h7L17 8h4v11H3z" />
          <circle cx="12" cy="13.5" r="3.5" />
        </>
      )}
    </svg>
  );
}
