/**
 * apps/mobile/lib/runEntryLogic.ts
 *
 * Pure endurance-segment IF-resolution + stress logic, factored out of `runEntry.ts` so it is
 * unit-testable under vitest without importing `@apsis/db` (whose barrel eagerly opens the
 * native op-sqlite JSI connection at module load - see `packages/db/src/client.ts`'s own "NOT
 * imported in vitest" note) or any Expo native module. Zero I/O, zero wall-clock reads -
 * mirrors the `@apsis/engine` purity convention (RESEARCH Pattern 3).
 *
 * Pitfall 6 / T-04-10 (Tampering - erg IF resolution, mitigate): `paceSecPerKm` /
 * `thresholdPaceSecPerKm` are only ever passed into `resolveIF` for `activityType === 'run'`.
 * An erg /500m split compared against the athlete's RUNNING threshold pace is physiologically
 * nonsensical - ERG and CONDITIONING resolve IF from HR alone, falling back to a neutral,
 * warned 1.0 when HR is absent (a valid momentary state per the engine's own documented
 * behavior, not an error to fix here).
 */

import { enduranceStressDetailed, resolveIF } from '@apsis/engine';
import type { EnduranceStressDetail } from '@apsis/shared';

export type RunActivityType = 'run' | 'erg' | 'conditioning';

export interface RunSegmentInputs {
  activityType: RunActivityType;
  durationS: number;
  distanceM?: number;
  avgHr?: number;
  thresholdHr?: number | null;
  thresholdPaceSecPerKm?: number | null;
}

export interface RunSegmentResult extends EnduranceStressDetail {
  intensityFactor: number;
  /** The computed pace, for display purposes only - NOT gated to activityType (the caller's
   * live pace readout needs it for ERG's /500m split too); only IF resolution is gated. */
  paceSecPerKm?: number;
}

/**
 * `durationS / (distanceM / 1000)` when a positive distance and duration are both present,
 * else `undefined` (never divides by zero / produces `Infinity`).
 */
export function computePaceSecPerKm(distanceM: number | undefined, durationS: number): number | undefined {
  if (distanceM == null || distanceM <= 0 || durationS <= 0) return undefined;
  return durationS / (distanceM / 1000);
}

/**
 * Resolves the endurance segment's intensity factor (gating pace to RUN only, Pitfall 6) and
 * the resulting stress score via `enduranceStressDetailed`. Never throws - all clamp/fallback
 * robustness is inherited from the engine's `resolveIF`/`enduranceStressDetailed`.
 */
export function resolveRunSegment(inputs: RunSegmentInputs): RunSegmentResult {
  const paceSecPerKm = computePaceSecPerKm(inputs.distanceM, inputs.durationS);

  const { intensityFactor, warnings: ifWarnings } = resolveIF({
    avgHR: inputs.avgHr,
    thresholdHR: inputs.thresholdHr ?? undefined,
    // Pitfall 6 / T-04-10: ERG/CONDITIONING must never pass a pace into IF resolution.
    paceSecPerKm: inputs.activityType === 'run' ? paceSecPerKm : undefined,
    thresholdPaceSecPerKm: inputs.thresholdPaceSecPerKm ?? undefined,
  });

  const { es, warnings: stressWarnings } = enduranceStressDetailed({
    durationS: inputs.durationS,
    intensityFactor,
  });

  return { es, intensityFactor, paceSecPerKm, warnings: [...ifWarnings, ...stressWarnings] };
}
