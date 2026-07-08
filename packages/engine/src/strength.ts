/**
 * @apsis/engine — strength-side HSS: e1RM-normalized load stress + Epley estimator
 * Zero runtime dependencies. Pure functions only — no I/O, no wall-clock reads, no side effects.
 * Per-set stress is normalized against a caller-supplied e1RM, amplified for lower-body
 * sets (systemic cost), scaled by proximity-to-failure (RPE), and summed into a session
 * strength score. Never throws: bad input is clamped or the offending set is skipped, and
 * every clamp/skip is reported in the detailed result's `warnings[]` (D-15).
 */

import type { EngineConfig, StrengthSet, StrengthStressDetail } from '@apsis/shared';
import { mergeConfig } from './config';
import { clampRange } from './clamp';

/** Reasonable upper bound for a single set's rep count — guards against fat-fingered input. */
const MAX_REPS = 100;

/**
 * Epley e1RM estimator (D-10): estimates a one-rep max from a working set's load and reps.
 * `estimateE1RM(100, 5)` ≈ 116.667.
 */
export function estimateE1RM(loadKg: number, reps: number): number {
  return loadKg * (1 + reps / 30);
}

/**
 * Detailed strength session score: sums per-set stress (warmups excluded, lower-body sets
 * amplified by `legMultiplier`, RPE-scaled) into a total `ss`, alongside the raw per-set
 * contributions and any clamp/skip warnings (D-05, D-15). Never throws.
 */
export function strengthStressDetailed(
  sets: StrengthSet[],
  cfg?: Partial<EngineConfig>
): StrengthStressDetail {
  const config = mergeConfig(cfg);
  const perSetStress: number[] = [];
  const warnings: string[] = [];

  for (const set of sets) {
    if (set.isWarmup) {
      continue;
    }

    const rpeClamp = clampRange(set.rpe, 1, 10, 'rpe');
    if (rpeClamp.warning) warnings.push(rpeClamp.warning);

    const repsClamp = clampRange(set.reps, 0, MAX_REPS, 'reps');
    if (repsClamp.warning) warnings.push(repsClamp.warning);

    const loadClamp = clampRange(set.loadKg, 0, Number.POSITIVE_INFINITY, 'loadKg');
    if (loadClamp.warning) warnings.push(loadClamp.warning);

    if (set.e1rmKg <= 0) {
      warnings.push(`e1rmKg ${set.e1rmKg} <= 0, skipping set`);
      continue;
    }

    let setStress = (loadClamp.value / set.e1rmKg) * repsClamp.value * (rpeClamp.value / 10);
    if (set.isLowerBody) {
      setStress *= config.legMultiplier;
    }

    perSetStress.push(setStress);
  }

  const ss = perSetStress.reduce((sum, s) => sum + s, 0) * config.kStrength;

  return { ss, perSetStress, warnings };
}

/**
 * Bare-number facade over `strengthStressDetailed` (D-05) — returns just the session
 * strength score (`ss`). Never throws.
 */
export function strengthStress(sets: StrengthSet[], cfg?: Partial<EngineConfig>): number {
  return strengthStressDetailed(sets, cfg).ss;
}
