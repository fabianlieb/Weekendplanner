// Weather as small symbols with short values: «[Thermometer] −4 °C  [Wind] 22 km/h  [Sonne] 5 h».
// The full sentence stays available to screen readers and as tooltip.
import type { Activity, ScheduleItem, Slot, TravelMode, WeatherSummary } from '../engine/types';
import { weatherLine, weatherParts } from './format';
import { MiniIcon, type MiniIconName } from './miniIcons';

export function WeatherChips({ w, activity, slot, large = false }: { w: WeatherSummary; activity: Activity; slot: Slot; large?: boolean }) {
  const full = weatherLine(w, activity, slot);
  return (
    <span className={`weather-chips${large ? ' large' : ''}`} role="group" aria-label={full} title={full}>
      {weatherParts(w, activity, slot).map((p) => (
        <span key={p.icon + p.short} className={`chip chip-${p.icon}`} aria-hidden="true">
          <MiniIcon name={p.icon} size={large ? 17 : 15} />
          {p.short}
        </span>
      ))}
    </span>
  );
}

const BY_KIND: Record<NonNullable<ScheduleItem['kind']>, MiniIconName> = {
  depart: 'car',
  home: 'home',
  lift: 'lift',
  ski: 'ski',
  last_run: 'ski',
  ascent: 'up',
  trail: 'flag',
  summit: 'summit',
  descent: 'down',
  end: 'flag',
  spot: 'camera',
  light_morning: 'sunrise',
  light_evening: 'sunset',
  photo: 'camera',
};

/** Symbol for a schedule line; plans stored before `kind` existed get one from the wording. */
export function scheduleIcon(item: ScheduleItem, mode: TravelMode | undefined): MiniIconName {
  const kind =
    item.kind ??
    (/^Abfahrt (?!ins)/.test(item.label)
      ? 'depart'
      : /^Ankunft (?!am Fotospot|Fotospot)/.test(item.label)
        ? 'home'
        : /^Gipfel/.test(item.label)
          ? 'summit'
          : undefined);
  if (!kind) return 'dot';
  if (kind === 'depart' && mode === 'transit') return 'train';
  return BY_KIND[kind];
}
