/**
 * apps/mobile/lib/recomputeNutritionTarget.ts
 *
 * The op-sqlite read + upsert wrapper around @apsis/db's pure `computeNutritionTargetRow`
 * (NUTR-16/17, mirrors `recomputeLoadDaily.ts`'s read -> pure-fold -> upsert-loop shape
 * exactly): reads today's session types (`sessionTypesForDate`) and today's persisted
 * `load_daily.dayHss`, loads the singleton `user_profile` row, and upserts the auto-generated
 * `nutrition_target` row for `localDate`.
 *
 * Divergence from the source pattern (07-PATTERNS.md / 07-RESEARCH.md Pitfall 5):
 * `recomputeLoadDaily` is only ever triggered by a workout write. `recomputeNutritionTarget` is
 * triggered the same way (called from `finishWorkout.ts`/`runEntry.ts` right after
 * `recomputeLoadDaily`) BUT also needs a lazy-compute-on-view fallback for rest days — see the
 * call site in `app/(tabs)/nutrition/index.tsx` (Task 2), which invokes this same function on
 * focus when no `nutrition_target` row exists yet for today (sessionTypes=[] folds to
 * dayType='rest', dayHss=0 via the loadDaily read below when no row exists).
 *
 * Gate ownership (NUTR-20): if the profile is incomplete, this returns EARLY without writing
 * any `nutrition_target` row — the gate (`useNutritionProfile`/Nutrition Setup prompt) owns
 * that state, and writing a target from a NULL-derived profile would fabricate a NaN/garbage
 * target that could briefly flash before the gate redirects.
 *
 * Idempotency: `computeNutritionTargetRow` derives a deterministic `id` (`auto-${localDate}`),
 * so the upsert below is `onConflictDoUpdate({ target: nutritionTarget.id, ... })` — safe to
 * call multiple times per day (event-driven recompute + lazy-view fallback) without ever
 * touching a manual `'override'` row for the same date.
 *
 * Security/error-handling (T-1-01, house style): parameterized drizzle query builders only;
 * errors are console.error'd with an `[Apsis]`-prefixed message then re-thrown — never
 * swallowed here (orchestration layer, matches recomputeLoadDaily.ts).
 */

import { eq } from 'drizzle-orm';
import {
  computeNutritionTargetRow,
  loadDaily,
  nutritionTarget,
  sessionTypesForDate,
  userProfile,
  type DB,
} from '@apsis/db';
import { buildNutritionProfile, isNutritionProfileComplete, type NutritionProfileRow } from './nutritionProfile';
import { useNutritionTargetSignal } from './nutritionTargetSignal';

/**
 * Reads today's session types + `load_daily.dayHss` + the profile, folds them through
 * `computeNutritionTargetRow`, and upserts the resulting row into `nutrition_target`. No-ops
 * (returns without writing) when the profile is incomplete (NUTR-20 gate). Bumps
 * `nutritionTargetSignal` after a successful upsert so any mounted nutrition screen re-reads.
 */
export async function recomputeNutritionTarget(database: DB, localDate: string): Promise<void> {
  try {
    const profileRows = await database
      .select({
        sex: userProfile.sex,
        bodyweightKg: userProfile.bodyweightKg,
        heightCm: userProfile.heightCm,
        birthYear: userProfile.birthYear,
        goalMode: userProfile.goalMode,
      })
      .from(userProfile)
      .limit(1);
    const profileRow: NutritionProfileRow | undefined = profileRows[0];
    if (profileRow == null || !isNutritionProfileComplete(profileRow)) {
      // NUTR-20: incomplete profile -- the gate owns this state, never write a target here.
      return;
    }

    // `age = currentYear - birthYear` (buildNutritionProfile) -- derived from `localDate`'s own
    // year rather than the wall clock, keeping this wrapper's inputs fully caller-supplied.
    const currentYear = Number.parseInt(localDate.slice(0, 4), 10);
    const profile = buildNutritionProfile(profileRow, currentYear);
    if (profile == null) return; // Defends against a race with the completeness check above.

    const sessionRows = await sessionTypesForDate(database, localDate);
    const sessionTypes = sessionRows.map((row) => row.type);

    const dayRows = await database
      .select({ dayHss: loadDaily.dayHss })
      .from(loadDaily)
      .where(eq(loadDaily.localDate, localDate));
    const dayHss = dayRows[0]?.dayHss ?? 0;

    const row = computeNutritionTargetRow(profile, sessionTypes, dayHss, localDate);
    const updatedAt = new Date();

    await database
      .insert(nutritionTarget)
      .values({
        id: row.id,
        localDate: row.localDate,
        dayType: row.dayType,
        kcal: row.kcal,
        proteinG: row.proteinG,
        carbG: row.carbG,
        fatG: row.fatG,
        source: row.source,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: nutritionTarget.id,
        set: {
          dayType: row.dayType,
          kcal: row.kcal,
          proteinG: row.proteinG,
          carbG: row.carbG,
          fatG: row.fatG,
          updatedAt,
        },
      });

    useNutritionTargetSignal.getState().bump();
  } catch (err: unknown) {
    console.error('[Apsis] Failed to recompute nutrition_target:', err);
    throw err;
  }
}
