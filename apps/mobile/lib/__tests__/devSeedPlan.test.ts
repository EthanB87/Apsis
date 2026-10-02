/**
 * apps/mobile/lib/__tests__/devSeedPlan.test.ts
 *
 * RED/GREEN coverage for `buildDevSeedSessions` (quick task 260907-la6 Task 3): a pure,
 * deterministic ~90-day build->taper->peak synthetic training-session generator. This module
 * has zero `@apsis/db` / native imports (mirrors `runEntryLogic.test.ts`'s vitest-testability
 * discipline) so it can run under plain Node/vitest, exactly like the `devSeed.ts` DB-writing
 * half it feeds cannot.
 */

import { describe, expect, it } from 'vitest';
import { addDaysLocal } from '../localDate';
import { buildDevSeedSessions } from '../devSeedPlan';

const TODAY = '2026-09-07';
const DAYS = 90;

describe('buildDevSeedSessions', () => {
  const sessions = buildDevSeedSessions(TODAY, DAYS);
  const expectedWindowStart = addDaysLocal(TODAY, -(DAYS - 1));

  it('spans a 90-day window ending on the supplied date, oldest first, no gaps/duplicates', () => {
    // The window itself covers exactly 90 distinct consecutive calendar dates ending on TODAY.
    expect(addDaysLocal(expectedWindowStart, DAYS - 1)).toBe(TODAY);

    const dates = sessions.map((s) => s.localDate);
    expect(new Set(dates).size).toBe(dates.length); // no duplicate dates among entries

    // oldest-first, strictly increasing -- no entry is ever out of order (no gaps in ordering)
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]! > dates[i - 1]!).toBe(true);
    }

    // every entry falls inside the 90-day window
    for (const date of dates) {
      expect(date >= expectedWindowStart).toBe(true);
      expect(date <= TODAY).toBe(true);
    }
  });

  it('roughly 15-25% of the 90 days are rest days (a 90/90 streak is not plausible)', () => {
    const restDays = DAYS - sessions.length;
    const restFraction = restDays / DAYS;
    expect(restFraction).toBeGreaterThanOrEqual(0.15);
    expect(restFraction).toBeLessThanOrEqual(0.25);
  });

  it('every emitted session has plausible duration/distance/HR fields', () => {
    expect(sessions.length).toBeGreaterThan(0);
    for (const session of sessions) {
      expect(session.durationS).toBeGreaterThan(0);
      expect(Number.isFinite(session.avgHr)).toBe(true);
      expect(session.avgHr).toBeGreaterThanOrEqual(110);
      expect(session.avgHr).toBeLessThanOrEqual(185);
      if (session.activityType === 'run') {
        expect(session.distanceM).toBeDefined();
        expect(Number.isFinite(session.distanceM)).toBe(true);
        expect(session.distanceM!).toBeGreaterThan(0);
      }
    }
  });

  it('mixes activity types so History does not read as 90 identical runs', () => {
    const types = new Set(sessions.map((s) => s.activityType));
    expect(types.size).toBeGreaterThan(1);
  });

  it('shapes build -> taper -> peak: weeks 2-9 trend up from week 1, and a final taper', () => {
    // Reconstruct a full 90-slot duration timeline (0 for rest days) so weekly means are
    // computed over calendar days, not just over emitted sessions.
    const durationByDate = new Map(sessions.map((s) => [s.localDate, s.durationS]));
    const dayDurations = Array.from({ length: DAYS }, (_, i) => {
      const date = addDaysLocal(expectedWindowStart, i);
      return durationByDate.get(date) ?? 0;
    });
    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    const week1 = dayDurations.slice(0, 7);
    const weeks2to9 = dayDurations.slice(7, 70);
    expect(mean(weeks2to9)).toBeGreaterThan(mean(week1));

    const precedingTwoWeeks = dayDurations.slice(69, 83);
    const finalWeek = dayDurations.slice(83, 90);
    expect(mean(finalWeek)).toBeLessThan(mean(precedingTwoWeeks));

    // Single highest-duration day falls inside the build block (day index 7..82), never in
    // week 1 (0..6) or the final taper week (83..89).
    let peakIndex = 0;
    for (let i = 1; i < dayDurations.length; i++) {
      if (dayDurations[i]! > dayDurations[peakIndex]!) peakIndex = i;
    }
    expect(peakIndex).toBeGreaterThanOrEqual(7);
    expect(peakIndex).toBeLessThanOrEqual(82);
  });

  it('is deterministic -- two calls with the same date produce deeply-equal output', () => {
    const again = buildDevSeedSessions(TODAY, DAYS);
    expect(again).toEqual(sessions);
  });

  it('produces a different (but still deterministic) plan for a different date', () => {
    const otherDay = buildDevSeedSessions('2026-01-01', DAYS);
    expect(otherDay).not.toEqual(sessions);
    expect(buildDevSeedSessions('2026-01-01', DAYS)).toEqual(otherDay);
  });
});

// Quick task 260907-qe6 Task 3: DEV_SEED_DAYS widens the seeder to ~400 days so the /trends
// screen's 1Y range is demonstrable. phaseMultiplier now repeats the 90-day build->taper shape
// as a sequence of macrocycle blocks rather than one implausible 400-day linear ramp -- these
// cases cover ONLY the long-window behavior; every existing 90-day case above is untouched.
describe('buildDevSeedSessions -- long window (400 days)', () => {
  const LONG_TODAY = '2026-09-07';
  const LONG_DAYS = 400;
  const longSessions = buildDevSeedSessions(LONG_TODAY, LONG_DAYS);
  const longWindowStart = addDaysLocal(LONG_TODAY, -(LONG_DAYS - 1));

  it('spans the 400-day window ending on the supplied date, oldest first, no gaps/duplicates', () => {
    const dates = longSessions.map((s) => s.localDate);
    expect(new Set(dates).size).toBe(dates.length);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]! > dates[i - 1]!).toBe(true);
    }
    for (const date of dates) {
      expect(date >= longWindowStart).toBe(true);
      expect(date <= LONG_TODAY).toBe(true);
    }
  });

  it('roughly 15-25% of the 400 days are rest days', () => {
    const restDays = LONG_DAYS - longSessions.length;
    const restFraction = restDays / LONG_DAYS;
    expect(restFraction).toBeGreaterThanOrEqual(0.15);
    expect(restFraction).toBeLessThanOrEqual(0.25);
  });

  it('is deterministic across two calls, and differs for a different date', () => {
    expect(buildDevSeedSessions(LONG_TODAY, LONG_DAYS)).toEqual(longSessions);
    const otherDay = buildDevSeedSessions('2026-01-01', LONG_DAYS);
    expect(otherDay).not.toEqual(longSessions);
  });

  it('mixes more than one activity type across the long window', () => {
    const types = new Set(longSessions.map((s) => s.activityType));
    expect(types.size).toBeGreaterThan(1);
  });

  it('ends each ~90-day macrocycle block in a taper (final 7 days average strictly less than the preceding 14)', () => {
    // Mirrors the implementation's own near-equal-length block split: round(400/90) = 4 blocks
    // of 100 days each, tiling exactly (each block's end is the next block's start).
    const blockCount = Math.round(LONG_DAYS / 90);
    const durationByDate = new Map(longSessions.map((s) => [s.localDate, s.durationS]));
    const dayDurations = Array.from({ length: LONG_DAYS }, (_, i) => {
      const date = addDaysLocal(longWindowStart, i);
      return durationByDate.get(date) ?? 0;
    });
    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    for (let b = 0; b < blockCount; b++) {
      const blockStart = Math.round((b * LONG_DAYS) / blockCount);
      const blockEnd = Math.round(((b + 1) * LONG_DAYS) / blockCount);
      const finalWeek = dayDurations.slice(blockEnd - 7, blockEnd);
      const precedingTwoWeeks = dayDurations.slice(blockEnd - 21, blockEnd - 7);
      expect(mean(finalWeek)).toBeLessThan(mean(precedingTwoWeeks));
      void blockStart; // block boundary retained for readability, not otherwise asserted here
    }
  });
});
