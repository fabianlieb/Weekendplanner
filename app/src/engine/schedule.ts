import { LIGHT_LABEL, SCHEDULE } from './texts';
import { THRESHOLDS } from './thresholds';
import type { AstroDay, Option, PhotoAddOn, ScheduleItem } from './types';
import type { Timing } from './timing';

export function buildSchedule(input: {
  option: Option;
  timing: Timing;
  startPointName: string;
  astro: AstroDay;
  photo?: PhotoAddOn;
  back: number;
}): ScheduleItem[] {
  const { option, timing, startPointName, astro, photo } = input;
  const items: ScheduleItem[] = [{ time: timing.departure, label: SCHEDULE.departure(startPointName), kind: 'depart' }];
  const c = option.candidate;

  switch (option.activity) {
    case 'ski':
      items.push(
        timing.activityStart <= THRESHOLDS.time.liftOpen
          ? { time: timing.activityStart, label: SCHEDULE.firstLift, kind: 'lift' }
          : { time: timing.activityStart, label: SCHEDULE.startSki, kind: 'ski' },
      );
      items.push({ time: timing.activityEnd, label: SCHEDULE.lastRun, kind: 'last_run' });
      break;
    case 'ski_tour':
    case 'snowshoe': {
      const ascent = c.durationHours * 60 * THRESHOLDS.time.ascentShare;
      items.push(
        option.activity === 'ski_tour'
          ? { time: timing.activityStart, label: SCHEDULE.startAscent, kind: 'ascent' }
          : { time: timing.activityStart, label: SCHEDULE.startTrail, kind: 'trail' },
      );
      items.push({ time: timing.activityStart + ascent, label: SCHEDULE.summit, kind: 'summit' });
      if (option.activity === 'ski_tour') items.push({ time: timing.activityStart + ascent + 15, label: SCHEDULE.startDescent, kind: 'descent' });
      items.push({ time: timing.activityEnd, label: SCHEDULE.endTour, kind: 'end' });
      break;
    }
    case 'photo':
      items.push({ time: timing.activityStart, label: SCHEDULE.arriveSpot, kind: 'spot' });
      if (option.slot === 'morning') {
        items.push({ time: astro.blueMorning.start, label: LIGHT_LABEL.blueMorning, kind: 'light_morning' });
        items.push({ time: astro.sunrise, label: LIGHT_LABEL.sunrise, kind: 'light_morning' });
      } else {
        items.push({ time: astro.sunset, label: LIGHT_LABEL.sunset, kind: 'light_evening' });
        items.push({ time: astro.blueEvening.start, label: LIGHT_LABEL.blueEvening, kind: 'light_evening' });
      }
      break;
  }

  if (photo) {
    items.push({ time: photo.time - THRESHOLDS.photoAddOn.arriveBeforeLightMinutes, label: SCHEDULE.arrivePhotoSpot(photo.spotName), kind: 'spot' });
    items.push({ time: photo.time, label: SCHEDULE.photo(photo.lightLabel), kind: 'photo' });
  }
  items.push({ time: input.back, label: SCHEDULE.back(startPointName), kind: 'home' });
  // Plan items in 5-minute steps (departure rounded down so the plan never gets later);
  // light events (sunrise, sunset, blue hour) stay to the minute.
  const exact = new Set<string>([...Object.values(LIGHT_LABEL)]);
  return items
    .sort((a, b) => a.time - b.time)
    .map((i, idx) => ({
      ...i,
      time: exact.has(i.label) ? Math.round(i.time) : idx === 0 ? Math.floor(i.time / 5) * 5 : Math.round(i.time / 5) * 5,
    }));
}
