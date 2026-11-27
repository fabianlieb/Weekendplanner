import { describe, expect, it } from 'vitest';
import { smartStartView, type StartState } from './smartStart';

const base: StartState = { weekday: 4, hour: 18, hasPlan: false, chosenUpcoming: false, feedbackMissing: false };

describe('smart start screen', () => {
  it('Thursday evening without suggestions → Thursday inputs', () => {
    expect(smartStartView(base)).toBe('thursday');
  });

  it('Thursday evening with suggestions → suggestions', () => {
    expect(smartStartView({ ...base, hasPlan: true })).toBe('suggestions');
  });

  it('Friday/Saturday evening with a chosen plan → evening check', () => {
    expect(smartStartView({ ...base, weekday: 5, hour: 18, hasPlan: true, chosenUpcoming: true })).toBe('check');
    expect(smartStartView({ ...base, weekday: 6, hour: 19, hasPlan: true, chosenUpcoming: true })).toBe('check');
  });

  it('Friday morning with a chosen plan → suggestions, not yet the check', () => {
    expect(smartStartView({ ...base, weekday: 5, hour: 9, hasPlan: true, chosenUpcoming: true })).toBe('suggestions');
  });

  it('Sunday evening or early week with missing feedback → feedback', () => {
    expect(smartStartView({ ...base, weekday: 0, hour: 19, hasPlan: true, feedbackMissing: true })).toBe('feedback');
    expect(smartStartView({ ...base, weekday: 2, hour: 8, feedbackMissing: true })).toBe('feedback');
  });

  it('Sunday morning → suggestions of the running weekend', () => {
    expect(smartStartView({ ...base, weekday: 0, hour: 8, hasPlan: true, feedbackMissing: true })).toBe('suggestions');
  });

  it('early week without anything pending → Thursday screen', () => {
    expect(smartStartView({ ...base, weekday: 1, hour: 12 })).toBe('thursday');
  });
});
