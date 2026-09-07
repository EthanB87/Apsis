/**
 * apps/mobile/lib/finishWorkout.ts
 *
 * The two terminal actions of a session (LIFT-07/D-27/D-28):
 *   - `finishWorkout` marks the session closed by setting `workout.finishedAt`. The
 *     timestamp is caller-supplied (mirrors engine purity rules — never `Date.now()`
 *     inside). Called from the finish summary's "Done" action so BOTH entry paths land
 *     here: a normal Finish (session.tsx already set `finishedAt` before navigating,
 *     this is a harmless re-set) and the D-14 crash-resume "Finish Now" path (which
 *     navigates straight to /session/finish WITHOUT ever setting `finishedAt`) — without
 *     this call, "Finish Now" would leave the D-13/D-14 open-session invariant dangling.
 *   - `discardWorkout` is a SOFT delete only (D-28): it calls the Plan 02
 *     `softDeleteWorkout` builder, never a hard row-removal call on the `workout` table,
 *     so the data survives as a support/debug safety net while being excluded from every
 *     history/HSS/load_daily read via `activeWorkoutFilter`.
 *
 * Both terminal actions now also await `recomputeLoadDaily` (Plan 04-03, RESEARCH Pitfall 1 /
 * D-29): previously `load_daily` was never written anywhere, so Home would only ever reflect
 * runs. Finishing OR discarding a lifting session now refreshes the full-history `load_daily`
 * rollup so Home's ring/band/chart stay consistent for lifting sessions too.
 *
 * Both terminal actions also await `recomputeNutritionTarget` (Plan 07-05, NUTR-16/17)
 * immediately AFTER `recomputeLoadDaily` so today's `dayHss` is fresh before the nutrition
 * target folds it in -- today's adaptive kcal/macro target reflects this session the moment
 * it finishes or is discarded, not just on the next app-open.
 *
 * HealthKit write-back/delete-sync (HK-04, D-12/D-14/D-15): `finishWorkout` fires a
 * fire-and-forget `writeBackLift` tail (gated on `healthkitConnected`, go-forward only) and
 * stores the returned sample uuid; `discardWorkout` fires a fire-and-forget delete-sync tail,
 * but ONLY for `source === 'manual'` rows Apsis itself authored (D-14) — an imported
 * (`source === 'healthkit'`) row's `healthkitUuid` refers to a sample Apsis does not own and
 * must never be deleted. Neither tail can fail these functions: `healthkitWriteback.ts`'s
 * helpers already swallow their own errors (never rethrow, D-25), and this file's own
 * follow-up DB writes on top of them are caught locally too.
 *
 * Security (T-1-01): both functions call parameterized drizzle query builders only —
 * no raw sql template literals with interpolated user-supplied values.
 */

import { eq } from 'drizzle-orm';
import { softDeleteWorkout, workout, type DB } from '@apsis/db';
import { getSyncState } from './healthkitSyncState';
import { deleteHealthKitSample, writeBackLift } from './healthkitWriteback';
import { todayLocalDate } from './localDate';
import { recomputeLoadDaily } from './recomputeLoadDaily';
import { recomputeNutritionTarget } from './recomputeNutritionTarget';

/** Sets `workout.finishedAt` (D-14 invariant: an open session must never be left dangling
 * after a normal or crash-resume finish flow), then recomputes `load_daily` so Home reflects
 * this session immediately (Pitfall 1). HK-04/D-12: also fires a fire-and-forget
 * `writeBackLift` tail (gated on `healthkitConnected`) and stores the returned uuid — never
 * awaited in a way that can fail this function. */
export async function finishWorkout(database: DB, workoutId: string, finishedAt: Date): Promise<void> {
  await database.update(workout).set({ finishedAt }).where(eq(workout.id, workoutId));
  await recomputeLoadDaily(database);
  // WR-03: best-effort tail — a nutrition recompute failure must never fail the core finish
  // path (the session is already closed and load_daily recomputed above). The nutrition TODAY
  // screen's lazy-compute fallback self-heals a missed recompute on next focus.
  try {
    await recomputeNutritionTarget(database, todayLocalDate());
  } catch (err: unknown) {
    console.error('[Apsis] nutrition target recompute failed (non-fatal):', err);
  }

  const syncState = await getSyncState(database);
  if (syncState?.healthkitConnected) {
    const [row] = await database
      .select({ createdAt: workout.createdAt, hss: workout.hss, healthkitUuid: workout.healthkitUuid })
      .from(workout)
      .where(eq(workout.id, workoutId));
    // WR-07: the write-back tail must be idempotent — finishWorkout can be re-invoked (finish
    // screen "Done" re-tapped, crash-resume "Finish Now" after a normal finish). A non-null
    // healthkitUuid means a sample was already written; writing again would create a duplicate
    // HK sample and overwrite the stored uuid, orphaning the earlier sample beyond
    // discardWorkout's delete-sync reach.
    if (row?.createdAt != null && row.healthkitUuid == null) {
      const durationS = Math.max(0, Math.round((finishedAt.getTime() - row.createdAt.getTime()) / 1000));
      writeBackLift(durationS, row.hss ?? 0, row.createdAt)
        .then(async (hkUuid) => {
          if (hkUuid != null) {
            await database.update(workout).set({ healthkitUuid: hkUuid }).where(eq(workout.id, workoutId));
          }
        })
        .catch((err: unknown) => {
          console.error('[Apsis] finishWorkout HealthKit write-back tail failed:', err); // D-25 — never blocks finish
        });
    }
  }
}

/** Soft-deletes the workout (D-28) — sets `deletedAt` via the shared Plan 02 builder,
 * never a hard row delete. The discarded session then never appears in history or any
 * HSS/load computation (every read filters `deletedAt IS NULL`). Also recomputes `load_daily`
 * (D-29) so the removed session's load disappears from the trend. HK-04/D-14: fires a
 * fire-and-forget delete-sync tail ONLY when the row is Apsis-authored
 * (`source === 'manual'` AND `healthkitUuid` present) — an imported session's HK sample is
 * never deleted. */
export async function discardWorkout(database: DB, workoutId: string, deletedAt: Date): Promise<void> {
  const [row] = await database
    .select({ source: workout.source, healthkitUuid: workout.healthkitUuid })
    .from(workout)
    .where(eq(workout.id, workoutId));

  await softDeleteWorkout(database, workoutId, deletedAt);
  await recomputeLoadDaily(database);
  // WR-03: best-effort tail, same rationale as finishWorkout — never fail the discard path.
  try {
    await recomputeNutritionTarget(database, todayLocalDate());
  } catch (err: unknown) {
    console.error('[Apsis] nutrition target recompute failed (non-fatal):', err);
  }

  // D-14: only delete Apsis-authored HK samples — an imported session's healthkitUuid refers
  // to a sample we don't own and must never be deleted from Health.
  if (row?.source === 'manual' && row.healthkitUuid != null) {
    void deleteHealthKitSample(row.healthkitUuid);
  }
}
