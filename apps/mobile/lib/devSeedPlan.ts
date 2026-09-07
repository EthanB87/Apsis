/**
 * apps/mobile/lib/devSeedPlan.ts
 *
 * Pure ~90-day build->taper->peak synthetic session generator for the `__DEV__`-only Settings
 * seeder (quick task 260907-la6 Task 3). Zero I/O, zero `@apsis/db` / `react-native` imports,
 * zero `__DEV__` reference (this module runs under plain Node in vitest, mirroring
 * `runEntryLogic.ts`'s native-import-free testability discipline) -- the RN-native, DB-writing
 * half of the seeder lives in `devSeed.ts` instead.
 *
 * Deterministic by construction (never `Math.random()`): a small seeded PRNG (mulberry32) is
 * seeded from a hash of the caller's `today` string, so screenshots and tests are reproducible
 * across runs. `today` is always caller-supplied -- this module never reads the wall clock
 * (`Date.now()` / bare `new Date()`), matching `@apsis/engine`'s purity convention one layer up.
 *
 * Shape: an easy first week, a rising build through the middle (weeks 2-9), a peak just before
 * the taper, then a lower-effort final week -- a 90/90 unbroken training streak is not
 * plausible, so a deterministic ~20% of days are rest days (no session emitted for that date).
 */

import { addDaysLocal } from './localDate';

export interface DevSeedSession {
  localDate: string;
  activityType: 'run' | 'erg' | 'conditioning';
  distanceM?: number;
  durationS: number;
  avgHr: number;
}

const ACTIVITY_TYPES: DevSeedSession['activityType'][] = ['run', 'erg', 'conditioning'];

/** ~1 in 5 days is a rest day. Selected as an exact count (not an independent per-day
 * probability) via a seeded shuffle below, so the realized fraction is always exactly this
 * value regardless of seed -- never a noisy proportion that could drift outside the plausible
 * 15-25% band for a specific `today`. */
const REST_DAY_FRACTION = 0.2;

/** Final-week taper -- strictly lower effort than the build block that precedes it. */
const TAPER_DAYS = 7;

/** Easy first week -- the lowest-effort block, establishing the "build" trend's baseline. */
const EASY_WEEK_DAYS = 7;

/**
 * mulberry32 -- a small, fast, deterministic PRNG. Not cryptographic; this seeds cosmetic demo
 * data only. Returns a function producing floats in [0, 1), matching `Math.random()`'s contract
 * so it's a drop-in replacement without being `Math.random()` itself (never reproducible).
 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function random(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Small integer hash of the caller's date string into a PRNG seed, so the same `today` always
 * reproduces the same synthetic plan. */
function seedFromDateStr(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

/**
 * Effort multiplier for the day at `dayIndex` (0-indexed, oldest-first) within a `totalDays`
 * window: flat and low for the easy first week, rising linearly through the build block,
 * peaking just before the final taper week, then flat and low again for the taper itself.
 */
function phaseMultiplier(dayIndex: number, totalDays: number): number {
  if (dayIndex < EASY_WEEK_DAYS) return 0.6;
  const taperStart = totalDays - TAPER_DAYS;
  if (dayIndex >= taperStart) return 0.55;
  const buildSpan = taperStart - EASY_WEEK_DAYS - 1;
  const progress = buildSpan > 0 ? (dayIndex - EASY_WEEK_DAYS) / buildSpan : 0;
  return 0.6 + progress * 0.9;
}

/**
 * Builds `days` (default 90) chronologically-ordered synthetic sessions ending on `today`.
 * Rest days (no plausible 90/90 streak) simply emit no entry for that date -- the returned
 * array's dates are a duplicate-free, strictly-increasing subset of the `days`-day window
 * `[addDaysLocal(today, -(days - 1)), today]`. Deterministic for a given `(today, days)` pair.
 */
export function buildDevSeedSessions(today: string, days = 90): DevSeedSession[] {
  const rand = mulberry32(seedFromDateStr(today));
  const startDate = addDaysLocal(today, -(days - 1));

  // Seeded partial Fisher-Yates shuffle to pick exactly `restDayCount` of the `days` indices as
  // rest days -- guarantees the realized rest fraction, not just its expectation.
  const restDayCount = Math.round(days * REST_DAY_FRACTION);
  const dayIndices = Array.from({ length: days }, (_, i) => i);
  for (let i = dayIndices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = dayIndices[i]!;
    dayIndices[i] = dayIndices[j]!;
    dayIndices[j] = tmp;
  }
  const restDaySet = new Set(dayIndices.slice(0, restDayCount));

  const sessions: DevSeedSession[] = [];
  for (let i = 0; i < days; i++) {
    if (restDaySet.has(i)) continue;

    const localDate = addDaysLocal(startDate, i);
    const phase = phaseMultiplier(i, days);
    const activityType = ACTIVITY_TYPES[Math.floor(rand() * ACTIVITY_TYPES.length)] ?? 'run';
    const baseDurationS = 1800 + rand() * 1800; // 30-60 min baseline before the phase/variance scale
    const durationS = Math.max(1, Math.round(baseDurationS * phase * (0.85 + rand() * 0.3)));
    const avgHr = Math.round(110 + rand() * 75); // 110-185 plausible training-session HR

    const session: DevSeedSession = { localDate, activityType, durationS, avgHr };
    if (activityType === 'run') {
      // ~5:00-6:30/km easy-to-moderate training pace.
      const paceSecPerKm = 300 + rand() * 90;
      session.distanceM = Math.round((durationS / paceSecPerKm) * 1000);
    }
    sessions.push(session);
  }

  return sessions;
}
