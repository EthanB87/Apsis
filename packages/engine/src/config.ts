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
 * - `kCarry` (D-20): scales loaded-carry/sled stress onto the HSS axis. Tuned via plan
 *   03-01's carry golden test: `CS = durationMin * (RPE/10)^2 * kCarry * loadRatioMultiplier`
 *   where `loadRatioMultiplier = clamp(1 + loadKg/bodyweightKg, 1, 4)`. A 4x40m heavy
 *   farmer's carry (~20s/set, load = 1.5x bodyweight, RPE 8) sums to a pre-`kCarry`
 *   per-set factor of `(20/60) * 0.8^2 * 2.5 ≈ 0.5333`; at `kCarry = 10` the 4-set total is
 *   ≈21.3, comfortably inside the (8, 60) hard-accessory band and well under the ~100 HSS
 *   threshold-run anchor (D-20/A5 — this golden test is authoritative over the formula
 *   shape suggested by research if they ever conflict). See
 *   `packages/engine/src/__tests__/carry.test.ts`.
 * - `atlDays` / `ctlDays`: acute/chronic EWMA time constants (days) for load trend.
 * - `calibratingMinHistoryDays` (D-02): below this many days of history, the readiness band
 *   reports `'calibrating'` regardless of TSB/CTL — covers brand-new users.
 * - `calibratingCtlFloor` (D-02): below this CTL value, the readiness band reports
 *   `'calibrating'` — covers users returning from a layoff with too little recent load to
 *   trust the TSB/CTL ratio.
 * - `bandRedRatio` / `bandAmberRatio` (D-04): TSB/CTL ratio thresholds. Ratio below
 *   `bandRedRatio` → red; in [`bandRedRatio`, `bandAmberRatio`) → amber; at/above
 *   `bandAmberRatio` → green.
 *
 * Nutrition — day-type adaptive macro target model (NUTR-16/17/18, Phase 07 Plan 02).
 * 07-RESEARCH.md Pattern 4 IS the model (no PRD §6 exists in this repo); every constant
 * below is a starting guess pending real-world tuning, calibrated only in the sense that
 * `nutrition.test.ts`'s 5 golden-file cases assert defensible ranges — same "reasonableness
 * test, not precise calibration" framing as `kStrength`'s original starting value.
 * - `proteinGPerKgCut` (2.4) / `proteinGPerKgMaintain` (1.8) / `proteinGPerKgBulk` (1.8):
 *   ISSN position-stand ranges (2.3–3.1 g/kg cutting, 1.4–2.2 g/kg maintenance), mid-points.
 *   Calibrated by golden test 2 (cut+heavy_lift: protein highest relative to kcal).
 * - `neatMultiplier` (1.2): sedentary/light-NEAT baseline multiplier on BMR; exercise kcal
 *   is added separately via `sessionKcal`, not folded into this constant. Calibrated by
 *   golden test 1 (maintain+rest sanity range).
 * - `cutDeltaKcal` (-500) / `bulkDeltaKcal` (300): common ~1lb/week deficit / lean-bulk
 *   surplus heuristics. Calibrated by golden tests 2 (cut) and 3 (bulk).
 * - `kcalPerHssPoint` (5): **lowest-confidence constant (A4)** — derived so a ~100-HSS hard
 *   session adds ≈500 kcal to the day's target; no literature anchor, pure heuristic.
 *   Calibrated by golden test 3 (bulk+double: sessionKcal clearly additive).
 * - `carbGPerKgHeavyLift` (4) / `carbGPerKgLongRun` (7) / `carbGPerKgDouble` (8) /
 *   `carbGPerKgRest` (2.5) / `carbGPerKgMixed` (5): day-type carb g/kg targets, glycogen-
 *   demand ordered rest < heavy_lift < mixed < long_run < double. Calibrated by golden test 3
 *   (bulk+double: highest carb target).
 * - `fatFloorGPerKg` (0.4): essential-fatty-acid/hormonal-health practical floor; clamps an
 *   aggressive-cut kcal budget from starving fat intake, reducing carbs to compensate instead.
 *   Calibrated by golden test 5 (aggressive-cut fat-floor clamp).
 */
export const DEFAULT_CONFIG: EngineConfig = {
  kStrength: 4.4,
  kEndurance: 1.6667,
  legMultiplier: 1.3,
  doublePenalty: 1.1,
  kCarry: 10,
  atlDays: 7,
  ctlDays: 28,
  calibratingMinHistoryDays: 14,
  calibratingCtlFloor: 10,
  bandRedRatio: -0.3,
  bandAmberRatio: -0.1,
  proteinGPerKgCut: 2.4,
  proteinGPerKgMaintain: 1.8,
  proteinGPerKgBulk: 1.8,
  neatMultiplier: 1.2,
  cutDeltaKcal: -500,
  bulkDeltaKcal: 300,
  kcalPerHssPoint: 5,
  carbGPerKgHeavyLift: 4,
  carbGPerKgLongRun: 7,
  carbGPerKgDouble: 8,
  carbGPerKgRest: 2.5,
  carbGPerKgMixed: 5,
  fatFloorGPerKg: 0.4,
};

/**
 * Merge a partial config override over `DEFAULT_CONFIG`. Every engine compute function
 * accepts an optional partial `EngineConfig` and should resolve it through this helper
 * before use, so callers never have to supply every field.
 */
export function mergeConfig(cfg?: Partial<EngineConfig>): EngineConfig {
  return { ...DEFAULT_CONFIG, ...cfg };
}
