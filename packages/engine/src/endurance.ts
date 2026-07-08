/**
 * @apsis/engine — Endurance-side HSS: duration * IF^2 stress + IF-derivation helpers
 * Zero runtime dependencies. Pure functions only — no I/O, no Date.now(), no side effects.
 * Per-segment endurance stress scales with duration and the square of a resolved intensity
 * factor (IF). The 60-min/IF-1.0 anchor (D-14) is the calibration point the whole "one
 * honest number" thesis is pinned against. Never throws: bad input is clamped and reported
 * in the detailed result's `warnings[]` (D-15).
 */

import type { EngineConfig, EnduranceSegment, EnduranceStressDetail } from '@apsis/shared';
import { mergeConfig } from './config';
import { clampRange } from './clamp';

/** Physiologically reasonable intensity-factor bounds (D-15). */
const MIN_IF = 0.3;
const MAX_IF = 1.3;

/**
 * Derive an intensity factor from average heart rate vs. threshold heart rate (D-09).
 * `ifFromHR(160, 160) = 1.0`. Guards against a zero/negative threshold by returning a
 * neutral 1.0 rather than dividing by zero. Pure.
 */
export function ifFromHR(avgHR: number, thresholdHR: number): number {
  if (!Number.isFinite(thresholdHR) || thresholdHR <= 0) {
    return 1.0;
  }
  return avgHR / thresholdHR;
}

/**
 * Derive an intensity factor from pace vs. threshold pace, both in seconds per km (D-09).
 * Faster pace (smaller sec/km) yields a higher IF: `ifFromPace(240, 300) ≈ 1.25`. Guards
 * against a zero/negative pace by returning a neutral 1.0 rather than dividing by zero. Pure.
 */
export function ifFromPace(paceSecPerKm: number, thresholdPaceSecPerKm: number): number {
  if (!Number.isFinite(paceSecPerKm) || paceSecPerKm <= 0) {
    return 1.0;
  }
  return thresholdPaceSecPerKm / paceSecPerKm;
}

/** Inputs available for IF resolution — HR takes precedence over pace when both present (D-11). */
export interface ResolveIFInputs {
  avgHR?: number;
  thresholdHR?: number;
  paceSecPerKm?: number;
  thresholdPaceSecPerKm?: number;
}

/** Result of IF resolution: the resolved (and clamped) intensity factor plus any warnings. */
export interface ResolveIFResult {
  intensityFactor: number;
  warnings: string[];
}

/**
 * Resolve an intensity factor from whichever inputs are available, preferring HR over pace
 * (D-11) since HR reflects actual physiological cost. Falls back to a neutral 1.0 with a
 * warning when neither is available. The resolved IF is always clamped into [0.3, 1.3]
 * (D-15). Never throws.
 */
export function resolveIF(inputs: ResolveIFInputs): ResolveIFResult {
  const warnings: string[] = [];
  const hasHR =
    Number.isFinite(inputs.avgHR) &&
    Number.isFinite(inputs.thresholdHR) &&
    (inputs.avgHR as number) > 0 &&
    (inputs.thresholdHR as number) > 0;
  const hasPace =
    Number.isFinite(inputs.paceSecPerKm) &&
    Number.isFinite(inputs.thresholdPaceSecPerKm) &&
    (inputs.paceSecPerKm as number) > 0 &&
    (inputs.thresholdPaceSecPerKm as number) > 0;

  let intensityFactor: number;
  if (hasHR) {
    intensityFactor = ifFromHR(inputs.avgHR as number, inputs.thresholdHR as number);
  } else if (hasPace) {
    intensityFactor = ifFromPace(inputs.paceSecPerKm as number, inputs.thresholdPaceSecPerKm as number);
  } else {
    intensityFactor = 1.0;
    warnings.push('IF unresolved, defaulted to 1.0');
  }

  const ifClamp = clampRange(intensityFactor, MIN_IF, MAX_IF, 'intensityFactor');
  if (ifClamp.warning) warnings.push(ifClamp.warning);

  return { intensityFactor: ifClamp.value, warnings };
}

/**
 * Detailed endurance session score: clamps duration (>=0) and intensity factor ([0.3, 1.3])
 * before computing `ES = durationMin * intensityFactor^2 * kEndurance` (D-14), reporting any
 * clamp warnings (D-15). Never throws.
 */
export function enduranceStressDetailed(
  seg: EnduranceSegment,
  cfg?: Partial<EngineConfig>
): EnduranceStressDetail {
  const config = mergeConfig(cfg);
  const warnings: string[] = [];

  const durationClamp = clampRange(seg.durationS, 0, Number.POSITIVE_INFINITY, 'durationS');
  if (durationClamp.warning) warnings.push(durationClamp.warning);

  const ifClamp = clampRange(seg.intensityFactor, MIN_IF, MAX_IF, 'intensityFactor');
  if (ifClamp.warning) warnings.push(ifClamp.warning);

  const durationMin = durationClamp.value / 60;
  const es = durationMin * ifClamp.value ** 2 * config.kEndurance;

  return { es, warnings };
}

/**
 * Bare-number facade over `enduranceStressDetailed` (D-05) — returns just the session
 * endurance score (`es`). Never throws.
 */
export function enduranceStress(seg: EnduranceSegment, cfg?: Partial<EngineConfig>): number {
  return enduranceStressDetailed(seg, cfg).es;
}
