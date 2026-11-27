// Small inline line icons (no emojis, no icon font).

export function CalendarPlusIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" aria-hidden="true">
      <rect x="3" y="5" width="15" height="15" />
      <path d="M3 9.5h15M7.5 3v4M13.5 3v4" />
      <path d="M19.5 13v8M15.5 17h8" stroke="var(--accent)" strokeWidth="2" />
    </svg>
  );
}
