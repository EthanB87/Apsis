/**
 * apps/mobile/lib/healthkitMapping.ts
 *
 * Pure HealthKit decision logic (activity-type mapping, dedupe tolerance, bodyweight
 * recency, write-back HSS metadata shaping, and hostile-numeric clamping), factored out so
 * it is unit-testable under vitest without importing the workspace db package (whose barrel
 * eagerly opens the native op-sqlite JSI connection at module load) or any Expo/HealthKit
 * native module. Zero I/O, zero wall-clock reads — mirrors `runEntryLogic.ts`'s purity
 * convention.
 *
 * IMPORTANT — HK_ACTIVITY_TYPE is a LOCAL numeric mirror of the library's real
 * `WorkoutActivityType` enum, not an import of it. Importing any value from
 * `@kingstinct/react-native-healthkit` transitively `require('react-native')` inside the
 * library's commonjs build, which throws under plain Node/vitest (same "unimportable under
 * vitest" class of problem the workspace db package's native barrel already has — see
 * `packages/db/src/client.ts`). The numeric values below were read directly from the shipped
 * `.d.ts` (`lib/typescript/generated/healthkit.generated.d.ts`, `WorkoutActivityType` enum) at
 * `@kingstinct/react-native-healthkit@14.0.2` and must stay in sync with that enum if the
 * dependency is upgraded.
 *
 * Every branch below cites the decision ID driving it (D-04, D-05, D-06, D-13, D-17) per the
 * plan's requirement. No function throws — every function returns a value or a
 * `{ value, warnings: string[] }`-shaped result (V5/T-05-02 — clamp-and-warn, never throw).
 */

import type { RunActivityType } from './runEntryLogic';

/**
 * Local numeric mirror of `@kingstinct/react-native-healthkit`'s `WorkoutActivityType` enum
 * (see file header — importing the real enum breaks vitest). Only the identifiers this
 * module's mapping actually branches on are declared here.
 */
export const HK_ACTIVITY_TYPE = {
  crossTraining: 11,
  cycling: 13,
  elliptical: 16,
  functionalStrengthTraining: 20,
  hiking: 24,
  mixedMetabolicCardioTraining: 30,
  rowing: 35,
  running: 37,
  stairClimbing: 44,
  swimming: 46,
  traditionalStrengthTraining: 50,
  walking: 52,
  highIntensityIntervalTraining: 63,
  jumpRope: 64,
  mixedCardio: 73,
} as const;

/**
 * D-04: Running -> 'run', Rowing -> 'erg', the broad-cardio conditioning allowlist -> 'conditioning'
 * (duration + HR only, no pace). D-05: strength training workouts are NEVER imported -> null.
 * Every other/unknown `WorkoutActivityType` value -> null (Claude's discretion boundary, RESEARCH
 * Open Question 1 resolution — ambiguous mind/body/sports types are excluded, not imported).
 */
export function mapHKActivityType(hkActivityType: number): RunActivityType | null {
  switch (hkActivityType) {
    case HK_ACTIVITY_TYPE.running:
      return 'run'; // D-04
    case HK_ACTIVITY_TYPE.rowing:
      return 'erg'; // D-04
    case HK_ACTIVITY_TYPE.cycling:
    case HK_ACTIVITY_TYPE.highIntensityIntervalTraining:
    case HK_ACTIVITY_TYPE.hiking:
    case HK_ACTIVITY_TYPE.swimming:
    case HK_ACTIVITY_TYPE.elliptical:
    case HK_ACTIVITY_TYPE.walking:
    case HK_ACTIVITY_TYPE.mixedCardio:
    case HK_ACTIVITY_TYPE.mixedMetabolicCardioTraining:
    case HK_ACTIVITY_TYPE.crossTraining:
    case HK_ACTIVITY_TYPE.stairClimbing:
    case HK_ACTIVITY_TYPE.jumpRope:
      return 'conditioning'; // D-04 — broad-cardio allowlist
    case HK_ACTIVITY_TYPE.traditionalStrengthTraining:
    case HK_ACTIVITY_TYPE.functionalStrengthTraining:
      return null; // D-05 — strength is never imported, Apsis is the strength source of truth
    default:
      return null; // unknown/unlisted type — not imported (discretion boundary)
  }
}

/** D-06 discretion constant — the duration-tolerance band for the dedupe comparator, ~±15%. */
export const DUPE_TOLERANCE = 0.15;

/**
 * D-06: dedupe is localDate + activityType + duration-within-tolerance ONLY — manual workouts
 * carry no time-of-day (schema fact), so time-range overlap is not a viable comparator. The
 * localDate/activityType match is the caller's responsibility (see
 * `packages/db/src/queries.ts`'s `candidatesForDedupe`); this function only judges duration.
 */
export function isDuplicateOfExisting(candidateDurationS: number, existingDurationS: number): boolean {
  const delta = Math.abs(candidateDurationS - existingDurationS);
  return delta <= existingDurationS * DUPE_TOLERANCE;
}

/**
 * D-17: most-recent-wins conflict resolution between a manual bodyweight edit and an
 * imported HK sample. `sampleStartAt` must be the HK sample's own recorded time (its
 * `startDate`), NOT the time of import — a sample recorded on-watch hours before a sync must
 * still compare correctly against a same-day manual edit. A null `profileBodyweightSetAt`
 * means the profile has never had a bodyweight-set timestamp recorded, so any sample wins.
 * Ties (same instant) are NOT newer — see `Date.getTime() >` (strict), not `>=`.
 */
export function bodyweightSampleIsNewer(sampleStartAt: Date, profileBodyweightSetAt: Date | null): boolean {
  if (profileBodyweightSetAt == null) return true;
  return sampleStartAt.getTime() > profileBodyweightSetAt.getTime();
}

/** D-13: the single named metadata key every Apsis-authored HK write-back carries the session HSS under. */
export const HSS_METADATA_KEY = 'ApsisHSS';

/**
 * D-13: write-back payload is basics + HSS metadata only — explicitly NO calorie/energy
 * fields. Returns a plain object keyed by `HSS_METADATA_KEY` for `saveWorkoutSample`'s
 * `metadata` parameter.
 */
export function buildHSSMetadata(hss: number): Record<string, number> {
  return { [HSS_METADATA_KEY]: hss };
}

export interface SanitizeNumericBounds {
  min: number;
  max: number;
}

export interface SanitizeNumericResult {
  value: number | null;
  warnings: string[];
}

/**
 * V5/T-05-02 (Tampering — mitigate): clamp-and-warn every HK-sourced numeric value before it
 * can reach the engine or SQLite. `null`/`undefined`/`NaN`/non-finite (Infinity/-Infinity)
 * values are discarded to `null` (never fabricated into a fake in-range number); an
 * out-of-bounds finite value is clamped to the nearest bound. Both cases record a warning
 * string describing what happened — this function never throws.
 */
export function sanitizeHKNumeric(
  value: number | null | undefined,
  bounds: SanitizeNumericBounds,
  label: string,
): SanitizeNumericResult {
  if (value == null || !Number.isFinite(value)) {
    return { value: null, warnings: [`HK ${label} was null/NaN/non-finite — discarded (V5/T-05-02)`] };
  }
  if (value < bounds.min) {
    return {
      value: bounds.min,
      warnings: [`HK ${label} ${value} below minimum ${bounds.min} — clamped (V5/T-05-02)`],
    };
  }
  if (value > bounds.max) {
    return {
      value: bounds.max,
      warnings: [`HK ${label} ${value} above maximum ${bounds.max} — clamped (V5/T-05-02)`],
    };
  }
  return { value, warnings: [] };
}
