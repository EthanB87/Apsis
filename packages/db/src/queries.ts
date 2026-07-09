/**
 * @apsis/db — reusable parameterized query builders
 *
 * Pure drizzle query-builder factories that take a `db` instance as a parameter so they
 * are testable via `.toSQL()` without opening the real op-sqlite JSI connection (which
 * requires a physical device and must never be imported in vitest).
 *
 * Security (T-1-01/T-03-03): every builder here uses drizzle's parameterized query API
 * (eq/and/isNull/isNotNull/desc) exclusively — never a raw `sql` template literal with an
 * interpolated user-supplied value.
 *
 * D-28: `activeWorkoutFilter` is the single soft-delete filter reused by every workout
 * read path — no query anywhere should hand-roll its own `isNull(workout.deletedAt)`.
 */

import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { strengthSet, workout } from './schema';

/**
 * Accepts any drizzle SQLite db instance sharing the base query-builder API — the real
 * op-sqlite-backed `DB` in production, or a `drizzle-orm/sqlite-proxy` instance in tests
 * (both extend `BaseSQLiteDatabase<'async', ...>`, so `.toSQL()` needs no live connection).
 */
export type QueryableDB = BaseSQLiteDatabase<'async', any, any, any>;

// ---------------------------------------------------------------------------
// Soft-delete filtering (D-28)
// ---------------------------------------------------------------------------

/**
 * Shared soft-delete filter — every workout read path applies this so a discarded
 * session (D-28) never leaks into history/HSS/load_daily computations.
 */
export const activeWorkoutFilter = isNull(workout.deletedAt);

/** Active (non-deleted) workouts, most recent first. */
export function selectActiveWorkouts(db: QueryableDB) {
  return db.select().from(workout).where(activeWorkoutFilter).orderBy(desc(workout.createdAt));
}

// ---------------------------------------------------------------------------
// Previous-session pre-fill (LIFT-03/D-07)
// ---------------------------------------------------------------------------

/**
 * The most recent committed strength_set for `exerciseId`, belonging to a finished,
 * non-deleted workout — feeds the first-set-of-an-exercise pre-fill (LIFT-03/D-07).
 */
export function previousSessionSet(db: QueryableDB, exerciseId: string) {
  return db
    .select({
      loadKg: strengthSet.loadKg,
      addedLoadKg: strengthSet.addedLoadKg,
      reps: strengthSet.reps,
      rpe: strengthSet.rpe,
      durationS: strengthSet.durationS,
    })
    .from(strengthSet)
    .innerJoin(workout, eq(strengthSet.workoutId, workout.id))
    .where(
      and(
        eq(strengthSet.exerciseId, exerciseId),
        isNotNull(workout.finishedAt),
        isNull(workout.deletedAt),
      ),
    )
    .orderBy(desc(workout.finishedAt))
    .limit(1);
}

// ---------------------------------------------------------------------------
// Crash recovery (D-14)
// ---------------------------------------------------------------------------

/** The open (unfinished, non-deleted) workout, if one exists — D-14 auto-resume prompt. */
export function openWorkout(db: QueryableDB) {
  return db
    .select()
    .from(workout)
    .where(and(isNull(workout.finishedAt), isNull(workout.deletedAt)))
    .limit(1);
}

// ---------------------------------------------------------------------------
// Discard (D-28)
// ---------------------------------------------------------------------------

/**
 * Soft-deletes a workout by setting `deletedAt`. The timestamp is caller-supplied —
 * this reusable builder never reads the wall clock itself (mirrors engine purity rules).
 */
export function softDeleteWorkout(db: QueryableDB, workoutId: string, deletedAt: Date) {
  return db.update(workout).set({ deletedAt }).where(eq(workout.id, workoutId));
}
