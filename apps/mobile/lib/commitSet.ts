/**
 * apps/mobile/lib/commitSet.ts
 *
 * The persist-then-recompute pipeline (D-13/T-03-13): every checked set writes to SQLite
 * FIRST, then the engine recomputes session HSS over ALL committed sets for the workout
 * (never an incremental delta — the engine stays the single source of truth for the
 * formula, RESEARCH.md Anti-Patterns), then `workout.hss` is updated. `uncommitSet`
 * mirrors this for D-09's "unchecking undoes" and LIFT-06's swipe-to-delete.
 *
 * Security (T-1-01/T-03-13): every query here is a parameterized drizzle builder — no raw
 * sql template literals with interpolated user-supplied values. Set ids are supplied by the
 * caller (expo-crypto randomUUID, generated once in sessionStore.ts — see T-03-06) so a
 * committed set's id never changes across the uncommit/recommit lifecycle.
 */

import { eq } from 'drizzle-orm';
import {
  db,
  exercise as exerciseTable,
  strengthSet,
  userProfile,
  workout,
  type DB,
} from '@apsis/db';
import { estimateE1RM, estimateE1RMFromRepMaxTable, sessionHSSDetailed } from '@apsis/engine';
import type { CarrySet, StrengthSet, Units } from '@apsis/shared';
import { computeEffectiveLoad } from './effectiveLoad';

export interface CommitSetExerciseInfo {
  id: string;
  bwFactor: number | null;
  entryMode: 'reps' | 'timed';
}

export interface CommitSetInput {
  /** Caller-supplied id (expo-crypto randomUUID) — becomes strength_set.id. */
  id: string;
  workoutId: string;
  exercise: CommitSetExerciseInfo;
  setNumber: number;
  reps: number;
  loadFieldKg: number;
  rpe: number;
  isWarmup: boolean;
  durationS: number;
  profileBodyweightKg: number;
}

export interface CommitSetResult {
  hss: number;
  warnings: string[];
}

/** 'lower' body-part exercises get the engine's lower-body stress amplifier. */
function isLowerBody(bodyPart: string | null): boolean {
  return bodyPart === 'lower';
}

/**
 * Re-runs `sessionHSSDetailed` over every committed (persisted) set for `workoutId` and
 * writes the resulting `hss` back onto the `workout` row. Shared by `commitSet` and
 * `uncommitSet` so both paths recompute identically (D-13: always the full set, never a
 * delta).
 */
async function recomputeSessionHss(
  database: DB,
  workoutId: string,
  profileBodyweightKg: number
): Promise<CommitSetResult> {
  const rows = await database
    .select({
      loadKg: strengthSet.loadKg,
      reps: strengthSet.reps,
      rpe: strengthSet.rpe,
      isWarmup: strengthSet.isWarmup,
      e1rmKg: strengthSet.e1rmKg,
      durationS: strengthSet.durationS,
      entryMode: exerciseTable.entryMode,
      bodyPart: exerciseTable.bodyPart,
    })
    .from(strengthSet)
    .innerJoin(exerciseTable, eq(strengthSet.exerciseId, exerciseTable.id))
    .where(eq(strengthSet.workoutId, workoutId));

  const strengthSets: StrengthSet[] = [];
  const carrySets: CarrySet[] = [];

  for (const row of rows) {
    if (row.entryMode === 'timed') {
      carrySets.push({
        loadKg: row.loadKg,
        // No historical bodyweight snapshot exists for carry sets (D-16 only governs the
        // bwFactor effective-load formula); the current profile bodyweight is used for the
        // engine's load-ratio multiplier on every recompute.
        bodyweightKg: profileBodyweightKg,
        durationS: row.durationS ?? 0,
        rpe: row.rpe ?? 0,
        isWarmup: row.isWarmup ?? false,
      });
    } else {
      strengthSets.push({
        loadKg: row.loadKg,
        reps: row.reps,
        rpe: row.rpe ?? 0,
        e1rmKg: row.e1rmKg ?? 0,
        isLowerBody: isLowerBody(row.bodyPart),
        isWarmup: row.isWarmup ?? false,
      });
    }
  }

  const result = sessionHSSDetailed({ strengthSets, carrySets });
  await database.update(workout).set({ hss: result.hss }).where(eq(workout.id, workoutId));

  return { hss: result.hss, warnings: result.warnings };
}

/**
 * Persist-then-recompute (D-13): computes the effective load (D-15/D-17) and the
 * appropriate e1RM estimator — rep-max table for bodyweight movements (D-18), Epley for
 * everything else (D-10) — inserts the `strength_set` row, then recomputes the full session
 * HSS and writes it to `workout.hss`. Timed carry/sled sets (D-19) store `reps: 0` (schema
 * NOT-NULL sentinel) and skip e1RM entirely (`e1rmKg: null`).
 */
export async function commitSet(
  database: DB,
  input: CommitSetInput
): Promise<CommitSetResult> {
  const { exercise } = input;
  const isTimed = exercise.entryMode === 'timed';

  const loadKg = computeEffectiveLoad(
    { bwFactor: exercise.bwFactor },
    input.loadFieldKg,
    input.profileBodyweightKg
  );

  const e1rmKg = isTimed
    ? null
    : exercise.bwFactor != null
      ? estimateE1RMFromRepMaxTable(loadKg, input.reps)
      : estimateE1RM(loadKg, input.reps);

  await database.insert(strengthSet).values({
    id: input.id,
    workoutId: input.workoutId,
    exerciseId: exercise.id,
    setNumber: input.setNumber,
    loadKg,
    reps: isTimed ? 0 : input.reps,
    rpe: input.rpe,
    isWarmup: input.isWarmup,
    e1rmKg,
    addedLoadKg: exercise.bwFactor != null ? input.loadFieldKg : null,
    durationS: isTimed ? input.durationS : null,
  });

  return recomputeSessionHss(database, input.workoutId, input.profileBodyweightKg);
}

/**
 * Undoes a commit (D-09 uncheck, LIFT-06 swipe-delete of an already-committed set): deletes
 * the persisted `strength_set` row, then recomputes the session HSS over the remaining
 * committed sets exactly like `commitSet` does.
 */
export async function uncommitSet(
  database: DB,
  workoutId: string,
  setId: string,
  profileBodyweightKg: number
): Promise<CommitSetResult> {
  await database.delete(strengthSet).where(eq(strengthSet.id, setId));
  return recomputeSessionHss(database, workoutId, profileBodyweightKg);
}

/** The mandatory user_profile row's bodyweight + units (D-01: a profile always exists past
 * the onboarding gate). Falls back to safe neutral defaults if the row is somehow missing. */
export async function fetchProfileSummary(
  database: DB = db
): Promise<{ bodyweightKg: number; units: Units }> {
  const rows = await database
    .select({ bodyweightKg: userProfile.bodyweightKg, units: userProfile.units })
    .from(userProfile)
    .limit(1);
  const row = rows[0];
  return {
    bodyweightKg: row?.bodyweightKg ?? 0,
    units: (row?.units ?? 'metric') as Units,
  };
}
