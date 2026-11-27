// Start screen when the app is opened without `?view=` (e.g. from the home screen icon).
// iOS Shortcuts cannot reliably open an installed web app with a deep link, so the app itself
// picks the screen that fits the weekly rhythm. Times match the agreed Shortcuts automations.

import type { View } from './router';

export const START_TIMES = {
  /** Thursday from this hour: the 4 inputs. */
  thursdayFrom: 12,
  /** Friday/Saturday from this hour: evening check for the next day's plan. */
  checkFrom: 16,
  /** Sunday from this hour (and Mon–Wed): feedback if still missing. */
  feedbackFrom: 17,
} as const;

export interface StartState {
  /** 0 = Sunday … 6 = Saturday (Zurich). */
  weekday: number;
  /** Hour 0–23 (Zurich). */
  hour: number;
  /** Suggestions exist for the current/upcoming weekend. */
  hasPlan: boolean;
  /** A plan is chosen and its date is tomorrow (or today). */
  chosenUpcoming: boolean;
  /** The last weekend had a plan but no feedback yet. */
  feedbackMissing: boolean;
}

export function smartStartView(s: StartState): View {
  const { weekday: wd, hour } = s;
  const sundayEvening = wd === 0 && hour >= START_TIMES.feedbackFrom;
  const earlyWeek = wd >= 1 && wd <= 3;
  if ((sundayEvening || earlyWeek) && s.feedbackMissing) return 'feedback';

  const checkEvening = (wd === 5 || wd === 6) && hour >= START_TIMES.checkFrom;
  if (checkEvening && s.chosenUpcoming) return 'check';

  const planningTime = (wd === 4 && hour >= START_TIMES.thursdayFrom) || wd === 5;
  if (planningTime && !s.hasPlan) return 'thursday';

  return s.hasPlan && wd !== 1 && wd !== 2 && wd !== 3 ? 'suggestions' : 'thursday';
}
