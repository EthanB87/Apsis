/**
 * @apsis/db — exercise library seed data
 *
 * STARTER_EXERCISES: >= 40 HYROX / tactical / strength / conditioning movements.
 * All ids are kebab-case, unique, and stable (never rename — they are FK targets).
 *
 * seedExercises(): idempotent per-id upsert.
 *   - Runs on every app launch after useMigrations succeeds.
 *   - INSERT ... ON CONFLICT(id) DO UPDATE keeps the phase-added columns (bw_factor,
 *     entry_mode) in sync with STARTER_EXERCISES for rows seeded by earlier builds —
 *     migration 0001 adds those columns as NULL and a count guard would never backfill
 *     them, leaving timed/bodyweight movements scoring 0 HSS on upgraded installs.
 *   - Uses drizzle parameterized query builders exclusively (T-1-01: no raw sql
 *     interpolation — the `excluded.*` refs below are static column identifiers, never
 *     user input).
 *   - The upsert also self-heals the Assumption A2 partial-population window (power-loss
 *     mid-seed): the next launch simply inserts the missing rows.
 */

import { sql } from 'drizzle-orm';
import type { OPSQLiteDatabase } from 'drizzle-orm/op-sqlite';
import { exercise } from './schema';

// ---------------------------------------------------------------------------
// Exercise library (>= 40 entries)
// ---------------------------------------------------------------------------

export const STARTER_EXERCISES = [
  // === Strength — lower body ===
  { id: 'squat', name: 'Back Squat', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'front-squat', name: 'Front Squat', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'deadlift', name: 'Deadlift', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'rdl', name: 'Romanian Deadlift', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'sumo-deadlift', name: 'Sumo Deadlift', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'trap-bar-deadlift', name: 'Trap Bar Deadlift', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'lunge', name: 'Lunge', type: 'strength' as const, bodyPart: 'lower', bwFactor: 0.85, entryMode: 'reps' as const },
  { id: 'split-squat', name: 'Bulgarian Split Squat', type: 'strength' as const, bodyPart: 'lower', bwFactor: 0.85, entryMode: 'reps' as const },
  { id: 'goblet-squat', name: 'Goblet Squat', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'step-up', name: 'Step-Up', type: 'strength' as const, bodyPart: 'lower', bwFactor: 0.90, entryMode: 'reps' as const },
  { id: 'leg-press', name: 'Leg Press', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'hip-thrust', name: 'Hip Thrust', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'box-jump', name: 'Box Jump', type: 'hybrid' as const, bodyPart: 'lower', bwFactor: 1.0, entryMode: 'reps' as const },

  // === Strength — upper body ===
  { id: 'bench', name: 'Bench Press', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'incline-bench', name: 'Incline Bench Press', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'ohp', name: 'Overhead Press', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'push-press', name: 'Push Press', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'row', name: 'Barbell Row', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'cable-row', name: 'Cable Row', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'lat-pulldown', name: 'Lat Pulldown', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'pull-up', name: 'Pull-Up', type: 'strength' as const, bodyPart: 'upper', bwFactor: 0.95, entryMode: 'reps' as const },
  { id: 'chin-up', name: 'Chin-Up', type: 'strength' as const, bodyPart: 'upper', bwFactor: 0.95, entryMode: 'reps' as const },
  { id: 'dip', name: 'Dip', type: 'strength' as const, bodyPart: 'upper', bwFactor: 0.95, entryMode: 'reps' as const },
  { id: 'push-up', name: 'Push-Up', type: 'strength' as const, bodyPart: 'upper', bwFactor: 0.65, entryMode: 'reps' as const },

  // === HYROX-specific movements ===
  { id: 'sled-push', name: 'Sled Push', type: 'hybrid' as const, bodyPart: 'full', bwFactor: null, entryMode: 'timed' as const },
  { id: 'sled-pull', name: 'Sled Pull', type: 'hybrid' as const, bodyPart: 'full', bwFactor: null, entryMode: 'timed' as const },
  { id: 'sandbag-lunge', name: 'Sandbag Lunge', type: 'hybrid' as const, bodyPart: 'lower', bwFactor: 0.85, entryMode: 'reps' as const },
  { id: 'wall-ball', name: 'Wall Ball', type: 'hybrid' as const, bodyPart: 'full', bwFactor: 0.30, entryMode: 'reps' as const },
  { id: 'burpee-broad-jump', name: 'Burpee Broad Jump', type: 'hybrid' as const, bodyPart: 'full', bwFactor: 1.0, entryMode: 'reps' as const },
  { id: 'box-step-over', name: 'Box Step-Over', type: 'hybrid' as const, bodyPart: 'lower', bwFactor: 0.90, entryMode: 'reps' as const },
  { id: 'ski-erg', name: 'SkiErg', type: 'endurance' as const, bodyPart: 'full', bwFactor: null, entryMode: null },
  { id: 'rowing-erg', name: 'Rowing Erg', type: 'endurance' as const, bodyPart: 'full', bwFactor: null, entryMode: null },

  // === Tactical / strongman movements ===
  { id: 'farmers-carry', name: "Farmer's Carry", type: 'strength' as const, bodyPart: 'full', bwFactor: null, entryMode: 'timed' as const },
  { id: 'yoke-carry', name: 'Yoke Carry', type: 'hybrid' as const, bodyPart: 'full', bwFactor: null, entryMode: 'timed' as const },
  { id: 'atlas-stone', name: 'Atlas Stone', type: 'strength' as const, bodyPart: 'full', bwFactor: null, entryMode: 'reps' as const },
  { id: 'kb-swing', name: 'Kettlebell Swing', type: 'strength' as const, bodyPart: 'full', bwFactor: 0.30, entryMode: 'reps' as const },
  { id: 'thruster', name: 'Thruster', type: 'hybrid' as const, bodyPart: 'full', bwFactor: null, entryMode: 'reps' as const },

  // === Conditioning / cardio ===
  { id: 'run', name: 'Run', type: 'endurance' as const, bodyPart: 'full', bwFactor: null, entryMode: null },
  { id: 'assault-bike', name: 'Assault Bike', type: 'endurance' as const, bodyPart: 'full', bwFactor: null, entryMode: null },
  { id: 'battle-rope', name: 'Battle Rope', type: 'endurance' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'timed' as const },

  // === Core ===
  { id: 'plank', name: 'Plank', type: 'strength' as const, bodyPart: 'core', bwFactor: null, entryMode: 'timed' as const },
  { id: 'ab-wheel', name: 'Ab Wheel', type: 'strength' as const, bodyPart: 'core', bwFactor: null, entryMode: 'reps' as const },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', type: 'strength' as const, bodyPart: 'core', bwFactor: null, entryMode: 'reps' as const },
] as const;

// ---------------------------------------------------------------------------
// Idempotent seeder
// ---------------------------------------------------------------------------

/**
 * Upsert the starter exercise library: insert missing rows, and backfill the
 * phase-added `bw_factor`/`entry_mode` columns on rows seeded by earlier builds
 * (WR-01: migration 0001 leaves them NULL and the old count guard skipped them,
 * so upgraded installs routed timed sets through the strength branch and scored 0).
 *
 * @param db — drizzle OPSQLiteDatabase instance (passed in to keep seed.ts testable
 *             without importing the module-level db singleton from client.ts).
 *
 * Security (T-1-01): all DB operations use drizzle's query builder — no raw SQL
 * string interpolation. The `excluded.*` sql fragments reference static column
 * names only (SQLite upsert syntax), never user input. This pattern is the
 * foundation reused when user input reaches the DB in Phase 3.
 */
export async function seedExercises(db: OPSQLiteDatabase<Record<string, unknown>>): Promise<void> {
  // Per-id upsert (idempotent): insert new rows; on conflict, sync the seed-owned
  // engine-critical columns so the in-memory STARTER_EXERCISES array and the DB rows
  // can never diverge on entryMode/bwFactor (the two-sources-of-truth hazard).
  // User-adjustable columns (restTimerSec) are deliberately NOT overwritten.
  await db
    .insert(exercise)
    .values([...STARTER_EXERCISES])
    .onConflictDoUpdate({
      target: exercise.id,
      set: {
        bwFactor: sql`excluded.bw_factor`,
        entryMode: sql`excluded.entry_mode`,
      },
    });
}
