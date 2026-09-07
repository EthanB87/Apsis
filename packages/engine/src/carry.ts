/**
 * @apsis/engine — loaded-carry/sled stress (D-20)
 * Zero runtime dependencies. Pure functions only — no I/O, no wall-clock reads, no side
 * effects. Clones `enduranceStressDetailed`'s clamp-and-warn shape: per-carry-set stress
 * scales with duration, RPE-squared (Foster's session-RPE shape), and a load-vs-bodyweight
 * multiplier. `kCarry` is tuned via a golden test (D-20/A5: the golden test is authoritative
 * over the suggested formula shape if they conflict). Never throws — bad input is clamped
 * and reported in the detailed result's `warnings[]` (D-15).
 */

import type { CarrySet, CarryStressDetail, EngineConfig } from '@apsis/shared';
import { mergeConfig } from './config';
import { clampRange } from './clamp';

/** Load-vs-bodyweight multiplier bounds: 1x (bodyweight-only) to 4x (extreme loaded carry). */
const MIN_LOAD_RATIO_MULTIPLIER = 1;
const MAX_LOAD_RATIO_MULTIPLIER = 4;

/**
 * Detailed loaded-carry/sled stress (D-20): clamps `durationS` (>=0), `rpe` ([1,10]), and
 * `loadKg` (>=0), reporting any clamp warnings (D-15). A zero/negative `bodyweightKg`
 * guards to a neutral 1x load-ratio rather than dividing by zero.
 * `CS = durationMin * (RPE/10)^2 * kCarry * loadRatioMultiplier`. Never throws.
 */
export function carryStressDetailed(
  seg: CarrySet,
  cfg?: Partial<EngineConfig>
): CarryStressDetail {
  const config = mergeConfig(cfg);

  // Warmup carry/timed sets are excluded from HSS entirely — mirrors the strength-side
  // warmup skip (strength.ts) and the UI contract (SetRow: "Warmups never warn — they're
  // excluded from HSS entirely, same as the real recompute").
  if (seg.isWarmup) {
    return { cs: 0, warnings: [] };
  }

  const warnings: string[] = [];

  const durationClamp = clampRange(seg.durationS, 0, Number.POSITIVE_INFINITY, 'durationS');
  if (durationClamp.warning) warnings.push(durationClamp.warning);

  const rpeClamp = clampRange(seg.rpe, 1, 10, 'rpe');
  if (rpeClamp.warning) warnings.push(rpeClamp.warning);

  const loadClamp = clampRange(seg.loadKg, 0, Number.POSITIVE_INFINITY, 'loadKg');
  if (loadClamp.warning) warnings.push(loadClamp.warning);

  // `bodyweightKg > 0` (not `!(bodyweightKg <= 0)`) is deliberate here: a NaN bodyweight
  // makes the comparison false either way, and we want the neutral-1x fallback for any
  // non-positive or non-finite bodyweight, mirroring the engine's NaN-safe guard idiom.
  const rawRatio = 1 + (seg.bodyweightKg > 0 ? loadClamp.value / seg.bodyweightKg : 0);
  const loadRatioClamp = clampRange(
    rawRatio,
    MIN_LOAD_RATIO_MULTIPLIER,
    MAX_LOAD_RATIO_MULTIPLIER,
    'loadRatioMultiplier'
  );
  if (loadRatioClamp.warning) warnings.push(loadRatioClamp.warning);

  const durationMin = durationClamp.value / 60;
  const cs = durationMin * (rpeClamp.value / 10) ** 2 * config.kCarry * loadRatioClamp.value;

  return { cs, warnings };
}

/**
 * Bare-number facade over `carryStressDetailed` (D-05) — returns just the carry stress
 * (`cs`). Never throws.
 */
export function carryStress(seg: CarrySet, cfg?: Partial<EngineConfig>): number {
  return carryStressDetailed(seg, cfg).cs;
}
