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
 * Security (T-1-01): both functions call parameterized drizzle query builders only —
 * no raw sql template literals with interpolated user-supplied values.
 */

import { eq } from 'drizzle-orm';
import { softDeleteWorkout, workout, type DB } from '@apsis/db';
import { recomputeLoadDaily } from './recomputeLoadDaily';

/** Sets `workout.finishedAt` (D-14 invariant: an open session must never be left dangling
 * after a normal or crash-resume finish flow), then recomputes `load_daily` so Home reflects
 * this session immediately (Pitfall 1). */
export async function finishWorkout(database: DB, workoutId: string, finishedAt: Date): Promise<void> {
  await database.update(workout).set({ finishedAt }).where(eq(workout.id, workoutId));
  await recomputeLoadDaily(database);
}

/** Soft-deletes the workout (D-28) — sets `deletedAt` via the shared Plan 02 builder,
 * never a hard row delete. The discarded session then never appears in history or any
 * HSS/load computation (every read filters `deletedAt IS NULL`). Also recomputes `load_daily`
 * (D-29) so the removed session's load disappears from the trend. */
export async function discardWorkout(database: DB, workoutId: string, deletedAt: Date): Promise<void> {
  await softDeleteWorkout(database, workoutId, deletedAt);
  await recomputeLoadDaily(database);
}
