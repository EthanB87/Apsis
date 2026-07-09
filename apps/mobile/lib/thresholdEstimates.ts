/**
 * apps/mobile/lib/thresholdEstimates.ts
 *
 * Pure threshold-estimate helpers for the D-02 "Estimate for me" onboarding paths.
 * No wall-clock, no I/O — same purity discipline as packages/engine, kept here since
 * these are onboarding-only UI helpers rather than engine inputs.
 *
 * Race-pace-to-threshold offset constants (03-RESEARCH.md Assumption A6, Claude's
 * discretion per 03-CONTEXT.md): shorter races are run well above sustainable
 * threshold effort, so the offset shrinks toward 1.0 as race distance approaches the
 * ~60-minute threshold-run benchmark used by the engine's own calibration (Phase 02
 * D-13).
 *   - 5K:   race pace x 1.05 (5K is raced well above threshold effort)
 *   - 10K:  race pace x 1.02 (10K sits just above threshold)
 *   - Half: race pace x 1.00 (half-marathon effort is close to threshold pace)
 */

export type RaceDistanceKey = '5k' | '10k' | 'half';

/** Race distance in meters, keyed by the wizard's distance picker. */
const RACE_DISTANCE_M: Record<RaceDistanceKey, number> = {
  '5k': 5000,
  '10k': 10000,
  half: 21097.5,
};

/** Race-pace -> threshold-pace multiplier, keyed by race distance (see module doc). */
const RACE_THRESHOLD_OFFSET: Record<RaceDistanceKey, number> = {
  '5k': 1.05,
  '10k': 1.02,
  half: 1.0,
};

/**
 * Derives threshold pace in sec/km from a race distance + finish time (D-02).
 * `finishSec` is the total race finish time in seconds.
 */
export function thresholdPaceFromRace(distanceKey: RaceDistanceKey, finishSec: number): number {
  const distanceKm = RACE_DISTANCE_M[distanceKey] / 1000;
  const racePaceSecPerKm = finishSec / distanceKm;
  return racePaceSecPerKm * RACE_THRESHOLD_OFFSET[distanceKey];
}

/** Threshold HR from a known max HR (D-02): threshold ~= max HR x 0.90. */
export function thresholdHrFromMax(maxHr: number): number {
  return Math.round(maxHr * 0.9);
}

/** Threshold HR age-based fallback (D-02) when max HR isn't known: (220 - age) x 0.90. */
export function thresholdHrFromAge(age: number): number {
  return Math.round((220 - age) * 0.9);
}
