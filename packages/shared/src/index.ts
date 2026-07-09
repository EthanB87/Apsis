/**
 * @apsis/shared — foundational shared types
 * Pure TypeScript; no runtime dependencies.
 */

/** Biological sex for engine calibration */
export type Sex = 'male' | 'female' | 'other';

/** Unit preference for display */
export type Units = 'metric' | 'imperial';

/** Readiness traffic-light band derived from ATL/CTL/TSB */
export type ReadinessBand = 'green' | 'amber' | 'red' | 'calibrating';

/** Activity type for workouts and segments */
export type ActivityType = 'strength' | 'endurance' | 'hybrid';

/** A single logged strength working set (or warmup, flagged via isWarmup) */
export interface StrengthSet {
  loadKg: number;
  reps: number;
  rpe: number;
  e1rmKg: number;
  isLowerBody: boolean;
  isWarmup: boolean;
}

/** A single logged endurance segment with a caller-resolved intensity factor */
export interface EnduranceSegment {
  durationS: number;
  intensityFactor: number;
}

/** A single logged loaded-carry/sled set (farmer's carry, yoke carry, sled push/pull) (D-20) */
export interface CarrySet {
  loadKg: number;
  bodyweightKg: number;
  durationS: number;
  rpe: number;
  isWarmup: boolean;
}

/** Carry-side breakdown: total CS plus any clamp warnings */
export interface CarryStressDetail {
  cs: number;
  warnings: string[];
}

/** Combined session input: a session may have strength sets, endurance segments, carry sets, or any combination */
export interface SessionInput {
  strengthSets?: StrengthSet[];
  enduranceSegments?: EnduranceSegment[];
  carrySets?: CarrySet[];
}

/** Versioned, tunable engine config — all formula constants live here so they can be re-fit without code changes */
export interface EngineConfig {
  kStrength: number;
  kEndurance: number;
  legMultiplier: number;
  doublePenalty: number;
  kCarry: number;
  atlDays: number;
  ctlDays: number;
  calibratingMinHistoryDays: number;
  calibratingCtlFloor: number;
  bandRedRatio: number;
  bandAmberRatio: number;
}

/** Strength-side breakdown: total SS plus per-set stress contributions and any clamp warnings */
export interface StrengthStressDetail {
  ss: number;
  perSetStress: number[];
  warnings: string[];
}

/** Endurance-side breakdown: total ES plus any clamp warnings */
export interface EnduranceStressDetail {
  es: number;
  warnings: string[];
}

/** Full session HSS result, version-stamped with the engine version and config used */
export interface SessionHSSResult {
  hss: number;
  ss: number;
  es: number;
  cs?: number;
  perSetStress: number[];
  warnings: string[];
  engineVersion: string;
  config: EngineConfig;
}

/** One day's point on the load/readiness trend series */
export interface LoadTrendPoint {
  atl: number;
  ctl: number;
  tsb: number;
  band: ReadinessBand;
}

export * from './units';
