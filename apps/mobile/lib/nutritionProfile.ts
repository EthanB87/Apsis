/**
 * apps/mobile/lib/nutritionProfile.ts
 *
 * Pure NutritionProfile assembler + completeness gate, factored out for vitest-testability
 * exactly like `runEntryLogic.ts` — zero database-client and zero Expo native imports.
 * `currentYear` is passed in by the caller (the hook layer) so this module never reads the
 * wall clock, matching the `@apsis/engine` purity convention (RESEARCH.md Pitfall 2/3).
 *
 * Pitfall 3 (Tampering/data-integrity, T-07-07, mitigate): `buildNutritionProfile` returns
 * `null` rather than coercing a missing field to `0` — a NULL height/age must never reach
 * `dailyMacroTarget` disguised as a real value.
 */

import type { NutritionProfile, Sex } from '@apsis/shared';

/** The subset of the `user_profile` row `NutritionProfile` assembly depends on. */
export interface NutritionProfileRow {
  sex: Sex | null;
  bodyweightKg: number | null;
  heightCm: number | null;
  birthYear: number | null;
  goalMode: 'cut' | 'maintain' | 'bulk' | null;
}

/**
 * True iff all five `NutritionProfile` inputs are present on the row. Gates whether
 * `buildNutritionProfile` can return a non-null result, and whether the Nutrition Setup
 * prompt (NUTR-20) needs to show for an already-onboarded user (RESEARCH.md Pitfall 3).
 */
export function isNutritionProfileComplete(row: NutritionProfileRow): boolean {
  return (
    row.sex != null &&
    row.bodyweightKg != null &&
    row.heightCm != null &&
    row.birthYear != null &&
    row.goalMode != null
  );
}

/**
 * Assembles a typed `NutritionProfile` for `@apsis/engine`'s `dailyMacroTarget`, deriving
 * `age = currentYear - birthYear`. Returns `null` — never a profile with a fabricated `0` —
 * when any required field is missing.
 */
export function buildNutritionProfile(row: NutritionProfileRow, currentYear: number): NutritionProfile | null {
  const { sex, bodyweightKg, heightCm, birthYear, goalMode } = row;
  if (sex == null || bodyweightKg == null || heightCm == null || birthYear == null || goalMode == null) {
    return null;
  }
  return {
    sex,
    bodyweightKg,
    heightCm,
    age: currentYear - birthYear,
    goalMode,
  };
}
