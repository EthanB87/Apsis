/**
 * @apsis/db — pure `nutrition_target` upsert-row builder (NUTR-16/17, RESEARCH Pattern 3/4).
 *
 * `computeNutritionTargetRow` is the testable, I/O-free core of the daily nutrition-target
 * recompute — mirrors `loadDaily.ts`'s discipline exactly: it performs no DB access and
 * never reads the wall clock. `localDate` is always passed in by the caller; this module
 * only folds a day's session types + HSS through `@apsis/engine`'s three nutrition
 * functions (`classifyDayType`, `trainingKcalFromHss`, `dailyMacroTarget`) — never
 * re-implementing any of them.
 *
 * The op-sqlite read + upsert wrapper around this pure function lives in apps/mobile
 * (a later plan); this module has zero DB imports.
 */

import { classifyDayType, dailyMacroTarget, trainingKcalFromHss } from '@apsis/engine';
import type { DayType, NutritionProfile } from '@apsis/shared';

export interface NutritionTargetUpsertRow {
  id: string;
  localDate: string;
  dayType: DayType;
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  source: 'auto';
}

/**
 * Deterministic id for the single `source: 'auto'` row a given `localDate` may have — unlike
 * `load_daily` (PK'd on `localDate` directly), `nutrition_target`'s PK is a UUID-shaped `id`
 * because a manual `'override'` row may coexist with the auto-generated row for the same
 * date. Deriving the auto row's id from `localDate` (rather than generating a random UUID
 * here) keeps this function pure/deterministic and lets the upsert wrapper
 * `onConflictDoUpdate({ target: nutritionTarget.id, ... })` safely replace only the prior
 * auto row for that date, never touching an `'override'` row.
 */
function autoRowId(localDate: string): string {
  return `auto-${localDate}`;
}

/**
 * Pure fold: session types (RESEARCH Pattern 3) -> `DayType` (`classifyDayType`) ->
 * training-kcal add (`trainingKcalFromHss(dayHss)`) -> macro target (`dailyMacroTarget`) ->
 * an upsert-ready `nutrition_target` row. Never throws — every non-finite/invalid input is
 * already defended by the underlying `@apsis/engine` functions (D-15).
 */
export function computeNutritionTargetRow(
  profile: NutritionProfile,
  sessionTypes: Array<'strength' | 'endurance' | 'hybrid'>,
  dayHss: number,
  localDate: string,
): NutritionTargetUpsertRow {
  const dayType = classifyDayType(sessionTypes);
  const sessionKcal = trainingKcalFromHss(dayHss);
  const target = dailyMacroTarget(profile, dayType, sessionKcal);

  return {
    id: autoRowId(localDate),
    localDate,
    dayType,
    kcal: target.kcal,
    proteinG: target.p,
    carbG: target.c,
    fatG: target.f,
    source: 'auto',
  };
}
