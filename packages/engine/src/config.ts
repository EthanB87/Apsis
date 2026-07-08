/**
 * @apsis/engine — engine configuration
 * Versioned, tunable formula constants live in one object (`DEFAULT_CONFIG`) so they can
 * be re-fit later without app releases (PROJECT.md: "engine logs raw components so
 * constants can be re-fit"). Every compute function accepts an optional partial override
 * merged over these defaults via `mergeConfig`.
 */

import type { EngineConfig } from '@apsis/shared';

/**
 * Literature-anchored starting constants for the HSS formulas (BUILD.md §4.3).
 *
 * - `kStrength`: scales summed set-stress onto the HSS axis. Calibrated to 4.4 by plan
 *   02-06's calibration test (D-13/D-14): the canonical hard 5x5 squat (140kg/180kg e1RM,
 *   5 reps, RPE 9, lower-body) sums to a pre-`kStrength` set-stress of 22.75; at 4.4 that
 *   lands liftHSS ≈ 100.1, within ±25% of the 60-min threshold-run anchor (runHSS ≈ 100.0)
 *   and inside BUILD.md's ~30–120 readable range for a hard session. See
 *   `packages/engine/src/__tests__/calibration.test.ts`, the test that drives this value.
 * - `kEndurance`: scales endurance stress onto the HSS axis. Derived from the D-14 anchor —
 *   60 minutes at intensity factor 1.0 should land at ~100 HSS. Since
 *   `ES = durationMin * intensityFactor^2 * kEndurance`, solving `100 = 60 * 1^2 * kEndurance`
 *   gives `kEndurance = 100 / 60 ≈ 1.6667`.
 * - `legMultiplier`: systemic cost multiplier applied to lower-body strength sets.
 * - `doublePenalty`: same-day compounding multiplier when a day has more than one session.
 * - `atlDays` / `ctlDays`: acute/chronic EWMA time constants (days) for load trend.
 * - `calibratingMinHistoryDays` (D-02): below this many days of history, the readiness band
 *   reports `'calibrating'` regardless of TSB/CTL — covers brand-new users.
 * - `calibratingCtlFloor` (D-02): below this CTL value, the readiness band reports
 *   `'calibrating'` — covers users returning from a layoff with too little recent load to
 *   trust the TSB/CTL ratio.
 * - `bandRedRatio` / `bandAmberRatio` (D-04): TSB/CTL ratio thresholds. Ratio below
 *   `bandRedRatio` → red; in [`bandRedRatio`, `bandAmberRatio`) → amber; at/above
 *   `bandAmberRatio` → green.
 */
export const DEFAULT_CONFIG: EngineConfig = {
  kStrength: 4.4,
  kEndurance: 1.6667,
  legMultiplier: 1.3,
  doublePenalty: 1.1,
  atlDays: 7,
  ctlDays: 28,
  calibratingMinHistoryDays: 14,
  calibratingCtlFloor: 10,
  bandRedRatio: -0.3,
  bandAmberRatio: -0.1,
};

/**
 * Merge a partial config override over `DEFAULT_CONFIG`. Every engine compute function
 * accepts an optional partial `EngineConfig` and should resolve it through this helper
 * before use, so callers never have to supply every field.
 */
export function mergeConfig(cfg?: Partial<EngineConfig>): EngineConfig {
  return { ...DEFAULT_CONFIG, ...cfg };
}
