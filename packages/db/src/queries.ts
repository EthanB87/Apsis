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

import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { enduranceSegment, loadDaily, strengthSet, workout } from './schema';

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
// Recents (LIFT-01/D-10)
// ---------------------------------------------------------------------------

/**
 * Most recently used distinct exercise ids, most recent first — feeds the exercise
 * picker's "Recents" section (D-10). `strength_set` has no timestamp of its own, so
 * recency is derived from the owning (active) workout's `createdAt` via a grouped max().
 * Read-only aggregate over column references only — no user-supplied value is
 * interpolated into the `sql` template (T-1-01).
 */
export function recentExerciseIds(db: QueryableDB, limit: number) {
  return db
    .select({
      exerciseId: strengthSet.exerciseId,
      lastUsed: sql<number>`max(${workout.createdAt})`.as('lastUsed'),
    })
    .from(strengthSet)
    .innerJoin(workout, eq(strengthSet.workoutId, workout.id))
    .where(activeWorkoutFilter)
    .groupBy(strengthSet.exerciseId)
    .orderBy(desc(sql`max(${workout.createdAt})`))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Crash recovery (D-14)
// ---------------------------------------------------------------------------

/**
 * The open (unfinished, non-deleted) workout, if one exists — D-14 auto-resume prompt.
 * Ordered by `createdAt DESC` so, should multiple open rows ever exist (legacy data from
 * before the WR-03 start-guard), the most recent one is returned deterministically.
 */
export function openWorkout(db: QueryableDB) {
  return db
    .select()
    .from(workout)
    .where(and(isNull(workout.finishedAt), isNull(workout.deletedAt)))
    .orderBy(desc(workout.createdAt))
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

// ---------------------------------------------------------------------------
// Home trend + History (HOME-03/04/05/06)
// ---------------------------------------------------------------------------

/**
 * The 28 most recent `load_daily` rows, most recent first (caller reverses to chronological
 * order for chart rendering). `load_daily` rows carry no soft-delete flag of their own — they
 * are the recompute output derived from finished, non-deleted workouts only (see
 * `computeLoadDailyUpsertRows`), so no additional filter is needed here.
 */
export function last28DaysTrend(db: QueryableDB) {
  return db.select().from(loadDaily).orderBy(desc(loadDaily.localDate)).limit(28);
}

/**
 * Per-day session counts across active (finished, non-deleted) workouts — feeds the
 * History/Home calendar's multi-session-day indicator (HOME-05/06). The only `sql` fragment
 * is the `count(*)` aggregate — no user-supplied value is interpolated (T-04-01).
 */
export function sessionCountsByDate(db: QueryableDB) {
  return db
    .select({
      localDate: workout.localDate,
      sessionCount: sql<number>`count(*)`.as('sessionCount'),
    })
    .from(workout)
    .where(and(isNotNull(workout.finishedAt), isNull(workout.deletedAt)))
    .groupBy(workout.localDate);
}

/**
 * Per-session rows for the History list, most recent day first then most recent session
 * within a day — the per-day expansion History renders under each calendar entry (HOME-05).
 */
export function dayGroupedSessions(db: QueryableDB) {
  return db
    .select({
      id: workout.id,
      localDate: workout.localDate,
      type: workout.type,
      title: workout.title,
      hss: workout.hss,
      source: workout.source,
    })
    .from(workout)
    .where(and(isNotNull(workout.finishedAt), activeWorkoutFilter))
    .orderBy(desc(workout.localDate), desc(workout.createdAt));
}

// ---------------------------------------------------------------------------
// HealthKit import dedupe (HK-03/D-06/Pitfall 9)
// ---------------------------------------------------------------------------

/**
 * Active workouts on `localDate` matching `activityType`, for D-06 dedupe comparison
 * (localDate + activityType + duration-within-tolerance — manual entries carry no
 * time-of-day, so time-range overlap is not viable).
 *
 * Deliberately does NOT apply `activeWorkoutFilter`/`isNull(workout.deletedAt)` — this is
 * a tombstone check, not a display read. A swipe-deleted imported run must still block
 * re-import on the next foreground sync (Pitfall 9); filtering out soft-deleted rows here
 * would let a deleted HK import resurrect itself.
 */
export function candidatesForDedupe(
  db: QueryableDB,
  localDate: string,
  activityType: 'run' | 'erg' | 'conditioning' | 'sled' | 'other',
) {
  return db
    .select({ durationS: enduranceSegment.durationS, healthkitUuid: workout.healthkitUuid })
    .from(workout)
    .innerJoin(enduranceSegment, eq(enduranceSegment.workoutId, workout.id))
    .where(and(eq(workout.localDate, localDate), eq(enduranceSegment.activityType, activityType)));
}
