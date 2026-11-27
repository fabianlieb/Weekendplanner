// All tunable limits of the decision engine live in this one file.
// Adjust after the test weekends; every value is plain data.
//
// Score ramps: a value at `bad` scores 0, at `good` scores 100, linear in between.
// `bad` may be larger than `good` (e.g. wind: 70 km/h bad, 30 km/h good).

export interface Ramp {
  bad: number;
  good: number;
}

export const THRESHOLDS = {
  // -------------------------------------------------------------------------
  // Time
  time: {
    /** Door-to-door hours (incl. travel there and back) per time budget. */
    budgetHours: { full: 12, half: 6 },
    /** First and last lift (minutes since midnight). */
    liftOpen: 8 * 60 + 30,
    liftClose: 16 * 60 + 30,
    /** Minimum hours on the slopes to make a ski outing worth it. */
    minSkiHours: 3,
    /** Preferred start of a day tour at the trailhead. */
    tourStartPreferred: 8 * 60 + 30,
    /** Day tours must be back in the valley this many minutes before sunset. */
    daylightMarginMinutes: 30,
    /** Evening tours start this many minutes after sunset. */
    eveningStartAfterSunset: 30,
    /** Share of a tour's duration spent ascending. */
    ascentShare: 0.65,
    /** Minutes at the photo spot before the light event (setting up). */
    photoSetupMinutes: 20,
    /** Buffer added between parking and start, minutes. */
    arrivalBufferMinutes: 15,
  },

  // -------------------------------------------------------------------------
  // Travel estimate when no manual travel time is stored for a start point
  travelEstimate: {
    /** Road distance ≈ air distance × factor. */
    roadFactor: 1.3,
    /** Average speed incl. mountain roads, km/h. */
    averageSpeedKmh: 70,
    /** Fixed extra minutes (parking, last kilometres). */
    fixedMinutes: 10,
  },

  // -------------------------------------------------------------------------
  // Fitness and day form
  fitness: {
    dayFormFactor: { easy: 0.7, normal: 1.0, strong: 1.15 },
    /** Each strictness feedback shifts the capacity by this share. */
    feedbackStep: 0.05,
    /** The feedback shift is capped at ± this share. */
    feedbackCap: 0.15,
    /** Ideal use of the (adjusted) capacity: within this range the fit is 100. */
    idealLoadMin: 0.45,
    idealLoadMax: 0.9,
  },

  // -------------------------------------------------------------------------
  // Weather → condition sub-scores
  weather: {
    /** Daytime window used for day outings when no other window applies. */
    dayWindow: { start: 9 * 60, end: 16 * 60 },
    eveningWindowHours: 3,

    ski: {
      cloudCover: { bad: 85, good: 20 } as Ramp,
      /** New snow in 72 h, cm. With 0 cm the sub-score is `newSnowBase`. */
      newSnow: { bad: 0, good: 15 } as Ramp,
      newSnowBase: 40,
      gusts: { bad: 70, good: 30 } as Ramp,
      /** Gusts at or above this value exclude the option (lifts closed). */
      gustKnockout: 70,
      cold: { bad: -20, good: -8 } as Ramp,
      warm: { bad: 8, good: 2 } as Ramp,
      /** Precipitation sum in the window, mm. */
      precipitation: { bad: 6, good: 0 } as Ramp,
      weights: { sun: 0.35, newSnow: 0.2, wind: 0.2, temperature: 0.1, precipitation: 0.15 },
    },

    tour: {
      cloudCover: { bad: 85, good: 20 } as Ramp,
      /** Mean visibility, metres. */
      visibility: { bad: 1000, good: 10000 } as Ramp,
      /** Proxy if the model has no visibility: total cloud at the summit. */
      visibilityProxyCloud: { bad: 95, good: 40 } as Ramp,
      newSnow: { bad: 0, good: 20 } as Ramp,
      newSnowBase: 30,
      gusts: { bad: 60, good: 25 } as Ramp,
      gustKnockout: 60,
      precipitation: { bad: 4, good: 0 } as Ramp,
      weights: { visibility: 0.3, wind: 0.25, sun: 0.2, newSnow: 0.15, precipitation: 0.1 },
    },

    eveningTour: {
      clearNight: { bad: 70, good: 20 } as Ramp,
      /** Moon illumination 0–1. */
      moon: { bad: 0.2, good: 0.8 } as Ramp,
      gusts: { bad: 50, good: 20 } as Ramp,
      gustKnockout: 60,
      precipitation: { bad: 2, good: 0 } as Ramp,
      weights: { clearNight: 0.35, moon: 0.3, wind: 0.25, precipitation: 0.1 },
    },

    photo: {
      /** Low cloud at the spot itself blocks the view. */
      lowCloudAtSpot: { bad: 70, good: 15 } as Ramp,
      /** Mid + high clouds: some are good for colour. Score 100 between min and max. */
      colourClouds: { zeroAt: 100, idealMin: 20, idealMax: 60, emptySkyScore: 55 },
      visibility: { bad: 2000, good: 30000 } as Ramp,
      visibilityProxyCloud: { bad: 95, good: 30 } as Ramp,
      gusts: { bad: 60, good: 20 } as Ramp,
      weightsClear: { clouds: 0.4, visibility: 0.2, lowCloud: 0.3, wind: 0.1 },
      weightsFogSea: { fogSea: 0.55, lowCloud: 0.15, clouds: 0.15, visibility: 0.1, wind: 0.05 },
      /** Bonus points when the moon rises in the window and is at least this full. */
      moonBonus: 8,
      moonBonusMinIllumination: 0.6,
    },
  },

  // -------------------------------------------------------------------------
  // Fog sea (Nebelmeer) heuristic, first version. Evaluated in the morning window.
  fogSea: {
    window: { start: 6 * 60, end: 10 * 60 },
    /** Minimum low cloud at the valley point, %. */
    valleyLowCloudMin: 70,
    /** Maximum total cloud at the summit point, %. */
    summitCloudMax: 30,
    /** Summit temperature minus valley temperature must be at least this (inversion), °C. */
    inversionMinDelta: 0,
    /** Summit must be this much higher than the valley point, metres. */
    minHeightDifference: 300,
    /** Likelihood at or above which a fog sea is mentioned. */
    likelyAt: 70,
  },

  // -------------------------------------------------------------------------
  // Astronomy (sun altitude angles in degrees)
  astro: {
    blueHourUpper: -4,
    blueHourLower: -8,
    goldenHourUpper: 6,
  },

  // -------------------------------------------------------------------------
  // Scoring and selection
  scoring: {
    /** Weight of conditions vs. fit in the total score. */
    conditionWeight: 0.7,
    fitWeight: 0.3,
    /** Options below this condition score are not suggested. */
    minConditionScore: 35,
    /** Points subtracted per risk colour (ranking only; filtering is done by risk level). */
    riskPenalty: { green: 0, orange: 8, red: 15 },
  },

  selection: {
    count: 3,
    /** Diversity penalties applied to options similar to already chosen ones. */
    sameActivityPenalty: 12,
    sameDayPenalty: 6,
    /** Options within this distance (km) count as the same place. */
    samePlaceKm: 10,
    samePlacePenalty: 15,
    /** Target mix: this many new (not yet done) options per weekend. */
    targetNew: 1,
    /** A new option may replace a proven one if it is at most this many points worse. */
    mixTolerance: 15,
    /** Plan B bonus when it does not depend on the avalanche rating while suggestion 1 does. */
    planBIndependenceBonus: 20,
    planBOtherDayBonus: 5,
  },

  photoAddOn: {
    /** Photo spots within this distance (km) of the outing are considered. */
    radiusKm: 15,
    /** Light events may be this many minutes outside the activity window. */
    windowSlackMinutes: 60,
  },

  eveningCheck: {
    /** The plan holds if its score dropped by at most this many points ... */
    maxScoreDrop: 20,
    /** ... and its condition score is still at least this. */
    minConditionScore: 40,
  },
} as const;

export type Thresholds = typeof THRESHOLDS;
