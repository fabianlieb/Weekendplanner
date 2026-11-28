// Small line symbols (16 px) for weather, schedule and packing list. No emojis, stroke = currentColor.
// Each symbol is decorative next to its text; the text (or title) carries the meaning.
import type { ReactNode } from 'react';

export type MiniIconName =
  | 'temp'
  | 'wind'
  | 'sun'
  | 'cloud'
  | 'snow'
  | 'moon'
  | 'rain'
  | 'fog'
  | 'car'
  | 'train'
  | 'home'
  | 'lift'
  | 'ski'
  | 'up'
  | 'down'
  | 'flag'
  | 'summit'
  | 'camera'
  | 'sunrise'
  | 'sunset'
  | 'beacon'
  | 'probe'
  | 'shovel'
  | 'helmet'
  | 'goggles'
  | 'glove'
  | 'jacket'
  | 'boot'
  | 'snowshoe'
  | 'ticket'
  | 'tripod'
  | 'battery'
  | 'card'
  | 'heat'
  | 'phone'
  | 'firstaid'
  | 'bottle'
  | 'food'
  | 'lamp'
  | 'map'
  | 'dot';

const PATHS: Record<MiniIconName, ReactNode> = {
  temp: (
    <>
      <path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z" />
      <path d="M12 9v7" />
    </>
  ),
  wind: <path d="M3 9h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 17h7" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
    </>
  ),
  cloud: <path d="M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 18z" />,
  snow: <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 6.5l2.5-2M9.5 19.5 12 17.5l2.5 2" />,
  moon: <path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z" />,
  rain: <path d="M12 3.5s5.5 6.3 5.5 10a5.5 5.5 0 0 1-11 0c0-3.7 5.5-10 5.5-10z" />,
  fog: <path d="M3 8h18M5 12h14M3 16h18M7 20h10" />,
  car: (
    <>
      <path d="M3.5 16.5v-4l2-5h13l2 5v4z" />
      <path d="M3.5 12.5h17" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="16.5" cy="17.5" r="1.5" />
    </>
  ),
  train: (
    <>
      <rect x="6" y="3" width="12" height="14" rx="2" />
      <path d="M6 10h12M9 13.5h.01M15 13.5h.01M8.5 17l-2.5 4M15.5 17l2.5 4" />
    </>
  ),
  home: <path d="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5M10 20v-5h4v5" />,
  lift: (
    <>
      <path d="M2.5 5 21.5 3M12 4v5" />
      <rect x="7" y="9" width="10" height="10" rx="1.5" />
      <path d="M7 13h10" />
    </>
  ),
  ski: <path d="M4 20 20 8M6.5 21.5 21 10.5M8 5.5l2 9" />,
  up: <path d="M5 19 19 5M10 5h9v9" />,
  down: <path d="M5 5l14 14M19 10v9h-9" />,
  flag: <path d="M6 21V4M6 4h11l-2.5 4L17 12H6" />,
  summit: (
    <>
      <path d="M2.5 20 10 8l3 4.5 2.5-3.5 6 11z" />
      <path d="M10 8V3.5h4.5L13.5 5l1 1.5H10" />
    </>
  ),
  camera: (
    <>
      <path d="M3 8h4l1.5-2.5h7L17 8h4v11H3z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
  sunrise: <path d="M5 17a7 7 0 0 1 14 0M2.5 20h19M12 3v5M9 6l3-3 3 3M4.5 12.5l1.5 1M19.5 12.5l-1.5 1" />,
  sunset: <path d="M5 17a7 7 0 0 1 14 0M2.5 20h19M12 3v5M9 5l3 3 3-3M4.5 12.5l1.5 1M19.5 12.5l-1.5 1" />,
  beacon: (
    <>
      <rect x="7" y="6" width="10" height="15" rx="2" />
      <path d="M10 10.5h4M9 3.5a5 5 0 0 1 6 0" />
    </>
  ),
  probe: <path d="M12 2.5v19M9.5 6h5M9.5 11h5M9.5 16h5" />,
  shovel: <path d="M12 3v9M9 3h6M8 12h8v4a4 4 0 0 1-8 0z" />,
  helmet: <path d="M4 16a8 8 0 0 1 16 0v1H4zM12 8v-1M4 17l-.5 2.5h17L20 17" />,
  goggles: (
    <>
      <path d="M3 9h18v6.5h-6.5L12 13l-2.5 2.5H3z" />
      <path d="M1.5 12H3M21 12h1.5" />
    </>
  ),
  glove: <path d="M7 21v-5L4.5 12.5a1.5 1.5 0 0 1 2.4-1.8L8 12V5a1.5 1.5 0 0 1 3 0v5M11 5.5V4a1.5 1.5 0 0 1 3 0v6M14 5.5a1.5 1.5 0 0 1 3 0V10M17 8a1.5 1.5 0 0 1 3 0v6.5c0 3-2 6.5-5.5 6.5H7" />,
  jacket: <path d="M9 3h6l5 4v13h-4.5V11M9 3 4 7v13h4.5V11M9 3l3 4 3-4M12 7v13" />,
  boot: <path d="M7 3h6v8l6.5 2.5a1.5 1.5 0 0 1 1 1.4V18H4v-2.5L7 13zM4 21h16.5" />,
  snowshoe: (
    <>
      <ellipse cx="12" cy="12" rx="5" ry="9" />
      <path d="M8 8.5h8M7.3 12h9.4M8 15.5h8" />
    </>
  ),
  ticket: <path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM14 7v10" />,
  tripod: <path d="M8 4h8v4H8zM12 8v4M12 12l-6 9M12 12l6 9M12 12v9" />,
  battery: (
    <>
      <rect x="3" y="7" width="16" height="10" rx="1.5" />
      <path d="M21 10.5v3M6.5 10.5v3M10 10.5v3" />
    </>
  ),
  card: <path d="M6 3h9l3 3v15H6zM9.5 3v4M12.5 3v4" />,
  heat: <path d="M8 20c-2-3 2-5 0-8s0-5 0-8M12 20c-2-3 2-5 0-8s0-5 0-8M16 20c-2-3 2-5 0-8s0-5 0-8" />,
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M11 18.5h2" />
    </>
  ),
  firstaid: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="1.5" />
      <path d="M9 6V3.5h6V6M12 10v6M9 13h6" />
    </>
  ),
  bottle: <path d="M9.5 2.5h5v3l1.5 2V21H8V7.5l1.5-2zM8 11h8" />,
  food: <path d="M12 7.5c-2-2-7-1.5-7 4 0 4 3 8.5 5 8.5 1 0 1.5-.5 2-.5s1 .5 2 .5c2 0 5-4.5 5-8.5 0-5.5-5-6-7-4zM12 7.5c0-2 1-3.5 3-4.5" />,
  lamp: (
    <>
      <path d="M3 12c0-3 3-5 9-5s9 2 9 5-3 5-9 5-9-2-9-5z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  map: <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20zM9 4v13.5M15 6.5V20" />,
  dot: <circle cx="12" cy="12" r="2.5" />,
};

export function MiniIcon({ name, size = 16, title }: { name: MiniIconName; size?: number; title?: string }) {
  return (
    <svg
      className="mini-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
    >
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
}

/** Symbol for a packing list item, from its words. */
export function packingIcon(item: string): MiniIconName {
  const s = item.toLowerCase();
  const rules: [RegExp, MiniIconName][] = [
    [/lvs/, 'beacon'],
    [/sonde/, 'probe'],
    [/schaufel/, 'shovel'],
    [/schneeschuh/, 'snowshoe'],
    [/helm/, 'helmet'],
    [/brille/, 'goggles'],
    [/handschuh/, 'glove'],
    [/handwärmer/, 'heat'],
    [/jacke|kleidung/, 'jacket'],
    [/schuh|gamasch/, 'boot'],
    [/skipass|zahlungs/, 'ticket'],
    [/ski|felle|harscheisen|stöcke/, 'ski'],
    [/stativ/, 'tripod'],
    [/kamera|objektiv/, 'camera'],
    [/akku/, 'battery'],
    [/speicherkarte/, 'card'],
    [/karte|gpx/, 'map'],
    [/handy/, 'phone'],
    [/erste-hilfe|rettungsdecke/, 'firstaid'],
    [/sonnencreme/, 'sun'],
    [/thermos|flasche|trink/, 'bottle'],
    [/proviant|essen|snack/, 'food'],
    [/stirnlampe|lampe/, 'lamp'],
  ];
  return rules.find(([re]) => re.test(s))?.[1] ?? 'dot';
}
