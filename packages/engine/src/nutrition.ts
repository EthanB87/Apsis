/**
 * @apsis/engine — day-type adaptive daily kcal/macro target model (NUTR-16/17/18).
 * Zero runtime dependencies. Pure functions only — no I/O, no wall-clock reads, no side
 * effects.
 *
 * NUTRITION.md defers to "the PRD nutrition model (§6)", which does not exist anywhere in
 * this repo. 07-RESEARCH.md Pattern 4 IS the model: protein anchored to bodyweight by goal
 * mode, kcal built from Mifflin-St Jeor BMR + NEAT + the day's training kcal + a goal-mode
 * delta, carbs set by day type, and fat filling the remainder with a hard floor. Every
 * constant is a starting guess tunable via `EngineConfig` — see `config.ts`'s provenance
 * comments — exactly like the `kStrength`/`kCarry` calibration precedent.
 */

import type { EngineConfig, DayType, NutritionProfile, MacroTargetResult, Sex } from '@apsis/shared';
import { mergeConfig } from './config';

/**
 * Classifies a day's training from the set of session types logged that day. Pure; mirrors
 * `dailyHSS`'s `sessionCount > 1` precedence for `'double'` (BUILD.md §4.2 double-session
 * concept, reused here for nutrition): any day with more than one session is `'double'`
 * regardless of type mix. A single session maps directly (`strength` → `heavy_lift`,
 * `endurance` → `long_run`, `hybrid` → `mixed`); no sessions is `'rest'`.
 */
export function classifyDayType(sessionTypes: Array<'strength' | 'endurance' | 'hybrid'>): DayType {
  if (sessionTypes.length === 0) return 'rest';
  if (sessionTypes.length > 1) return 'double';
  const only = sessionTypes[0];
  if (only === 'strength') return 'heavy_lift';
  if (only === 'endurance') return 'long_run';
  return 'mixed'; // only === 'hybrid'
}

/**
 * Converts a day's total HSS into kcal added to the daily target for that day's training
 * (NUTR-16). Defends its input per D-15: non-finite `dayHss` (NaN/Infinity) and negative
 * values both clamp to 0 rather than propagating a NaN or a negative kcal add. Pure; never
 * throws.
 */
export function trainingKcalFromHss(dayHss: number, cfg?: Partial<EngineConfig>): number {
  const config = mergeConfig(cfg);
  const safeHss = Number.isFinite(dayHss) ? Math.max(dayHss, 0) : 0;
  return safeHss * config.kcalPerHssPoint;
}

/**
 * Mifflin-St Jeor BMR estimate (most-cited, most-accurate of the common formulas per
 * systematic review — see 07-RESEARCH.md). Module-private; only `dailyMacroTarget` calls
 * it. `'other'` sex uses the midpoint of the male (+5) and female (-161) constants (-78),
 * an explicit assumption (07-RESEARCH.md A2) since Mifflin-St Jeor was derived from a
 * binary-sex dataset.
 */
function mifflinStJeorBmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const sexConstant = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + sexConstant;
}

/**
 * Computes a day's adaptive kcal/protein/carb/fat targets from a profile, the day's
 * training day-type, and the day's training kcal add (NUTR-16/18). Pure; resolves
 * `cfg` via `mergeConfig` first, defends every input (D-15 — invalid bodyweight yields an
 * all-zero result with a warning rather than NaN/divide-by-zero; non-finite `sessionKcal`
 * clamps to 0), and never throws.
 *
 * Formula (07-RESEARCH.md Pattern 4):
 * - `p` (protein) is anchored to bodyweight by goal mode (highest on a cut, per ISSN
 *   ranges).
 * - `kcal` = BMR * `neatMultiplier` (NEAT) + `sessionKcal` (training add) + a goal-mode
 *   delta (cut/bulk/0), floored at BMR so a target never asks for less than resting
 *   metabolic rate.
 * - `c` (carbs) is set per day type via the `carbGPerKg*` constants (glycogen demand:
 *   rest < heavy_lift < mixed < long_run < double).
 * - `f` (fat) fills whatever kcal remains after protein and carbs. If that would push fat
 *   below `fatFloorGPerKg * bodyweightKg` (an essential-fatty-acid/hormonal-health
 *   practical floor), fat is pinned at the floor and carbs are reduced to compensate,
 *   with a warning pushed — `kcal` itself is never altered by this clamp.
 * - Final values: `kcal` rounded to the nearest 5, `p`/`c`/`f` rounded to the nearest
 *   integer gram.
 */
export function dailyMacroTarget(
  profile: NutritionProfile,
  dayType: DayType,
  sessionKcal: number,
  cfg?: Partial<EngineConfig>,
): MacroTargetResult {
  const config = mergeConfig(cfg);
  const warnings: string[] = [];

  if (!Number.isFinite(profile.bodyweightKg) || profile.bodyweightKg <= 0) {
    return { kcal: 0, p: 0, c: 0, f: 0, warnings: ['invalid bodyweight — cannot compute targets'] };
  }

  const proteinPerKg =
    profile.goalMode === 'cut'
      ? config.proteinGPerKgCut
      : profile.goalMode === 'bulk'
        ? config.proteinGPerKgBulk
        : config.proteinGPerKgMaintain;
  const p = proteinPerKg * profile.bodyweightKg;

  const bmr = mifflinStJeorBmr(profile.sex, profile.bodyweightKg, profile.heightCm, profile.age);
  const neat = bmr * config.neatMultiplier;
  const safeSessionKcal = Number.isFinite(sessionKcal) ? Math.max(sessionKcal, 0) : 0;
  const maintenanceKcal = neat + safeSessionKcal;
  const goalDelta = profile.goalMode === 'cut' ? config.cutDeltaKcal : profile.goalMode === 'bulk' ? config.bulkDeltaKcal : 0;
  const kcal = Math.max(maintenanceKcal + goalDelta, bmr); // safety floor: never target below BMR

  const carbPerKg = {
    heavy_lift: config.carbGPerKgHeavyLift,
    long_run: config.carbGPerKgLongRun,
    double: config.carbGPerKgDouble,
    rest: config.carbGPerKgRest,
    mixed: config.carbGPerKgMixed,
  }[dayType];
  let c = carbPerKg * profile.bodyweightKg;

  const proteinKcal = p * 4;
  const carbKcal = c * 4;
  let f = (kcal - proteinKcal - carbKcal) / 9;

  const fatFloor = config.fatFloorGPerKg * profile.bodyweightKg;
  if (f < fatFloor) {
    warnings.push('fat target below floor — reduced carb target to compensate');
    f = fatFloor;
    c = Math.max((kcal - proteinKcal - f * 9) / 4, 0);
    if (c === 0) {
      warnings.push('kcal budget too low to hit protein+fat floor — targets are floor-clamped, not diet-optimal');
    }
  }

  return {
    kcal: Math.round(kcal / 5) * 5,
    p: Math.round(p),
    c: Math.round(c),
    f: Math.round(f),
    warnings,
  };
}
