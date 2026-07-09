/**
 * @apsis/engine — bodyweight-movement e1RM: rep-max table estimator (D-18)
 * Zero runtime dependencies. Pure functions only — no I/O, no wall-clock reads, no side
 * effects. Barbell lifts use Epley (`estimateE1RM` in strength.ts, D-10); bodyweight
 * movements (pull-ups, push-ups) use this rep-max table instead, because Epley/Brzycki
 * both diverge past ~10-12 reps (Pitfall 3). A hard 30-rep floor row + clamp-and-warn (D-15)
 * replaces extrapolation past the table's valid range — never throws.
 */

import { clampRange } from './clamp';

/**
 * NSCA-style %1RM-by-reps table (D-18): flat rows that clamp at a 30-rep floor instead of
 * dividing by a shrinking (or negative, past 37 reps) Brzycki denominator. Row 30 is the
 * floor — reps above 30 clamp to this row rather than extrapolating further.
 */
const REP_MAX_TABLE: ReadonlyArray<{ reps: number; pct: number }> = [
  { reps: 1, pct: 1.0 },
  { reps: 2, pct: 0.95 },
  { reps: 3, pct: 0.93 },
  { reps: 5, pct: 0.87 },
  { reps: 8, pct: 0.8 },
  { reps: 10, pct: 0.75 },
  { reps: 12, pct: 0.7 },
  { reps: 15, pct: 0.65 },
  { reps: 20, pct: 0.55 },
  { reps: 25, pct: 0.5 },
  { reps: 30, pct: 0.45 }, // floor — do not extrapolate below this row
];

/**
 * Linear interpolation of %1RM between the two `REP_MAX_TABLE` rows bracketing `reps`.
 * An exact table-row rep count returns that row's pct. `reps` at or above the table's max
 * (30, the floor row) returns the floor row's pct; at or below the table's min (1) returns
 * the min row's pct. Assumes `reps` has already been clamped into [1, 30] by the caller.
 */
function interpolateRepMaxPct(reps: number): number {
  const first = REP_MAX_TABLE[0];
  const last = REP_MAX_TABLE[REP_MAX_TABLE.length - 1];
  if (!first || !last) {
    return 1.0;
  }
  if (reps <= first.reps) {
    return first.pct;
  }
  if (reps >= last.reps) {
    return last.pct;
  }

  for (let i = 0; i < REP_MAX_TABLE.length - 1; i++) {
    const lo = REP_MAX_TABLE[i];
    const hi = REP_MAX_TABLE[i + 1];
    if (!lo || !hi) continue;
    if (reps === lo.reps) return lo.pct;
    if (reps > lo.reps && reps < hi.reps) {
      const t = (reps - lo.reps) / (hi.reps - lo.reps);
      return lo.pct + t * (hi.pct - lo.pct);
    }
  }

  return last.pct;
}

/** Detailed result of the rep-max-table e1RM estimate: the estimate plus any clamp warnings. */
export interface EstimateE1RMFromRepMaxTableDetail {
  e1rm: number;
  warnings: string[];
}

/**
 * Detailed bodyweight-movement e1RM estimate (D-18): clamps `reps` into [1, 30] (the
 * table's valid range, with 30 acting as a hard floor row instead of extrapolating) and
 * `loadKg` into [0, +Inf), reports any clamp warnings (D-15), then divides the clamped load
 * by the interpolated rep-max percentage. Guards against a non-finite result. Never throws.
 */
export function estimateE1RMFromRepMaxTableDetailed(
  loadKg: number,
  reps: number
): EstimateE1RMFromRepMaxTableDetail {
  const warnings: string[] = [];

  const repsClamp = clampRange(reps, 1, 30, 'reps');
  if (repsClamp.warning) warnings.push(repsClamp.warning);

  const loadClamp = clampRange(loadKg, 0, Number.POSITIVE_INFINITY, 'loadKg');
  if (loadClamp.warning) warnings.push(loadClamp.warning);

  const pct = interpolateRepMaxPct(repsClamp.value);
  let e1rm = loadClamp.value / pct;
  if (!Number.isFinite(e1rm)) {
    warnings.push(`e1rm computed as non-finite (${e1rm}), clamped to 0`);
    e1rm = 0;
  }

  return { e1rm, warnings };
}

/**
 * Bare-number facade over `estimateE1RMFromRepMaxTableDetailed` (D-05) — returns just the
 * e1RM estimate. Used by the app ONLY when `exercise.bwFactor != null`; barbell lifts keep
 * Epley (`estimateE1RM`) per Phase 02 D-10. Never throws.
 */
export function estimateE1RMFromRepMaxTable(loadKg: number, reps: number): number {
  return estimateE1RMFromRepMaxTableDetailed(loadKg, reps).e1rm;
}
