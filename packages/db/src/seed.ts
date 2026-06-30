/**
 * @apsis/db — exercise library seed data
 *
 * STARTER_EXERCISES: >= 40 HYROX / tactical / strength / conditioning movements.
 * All ids are kebab-case, unique, and stable (never rename — they are FK targets).
 *
 * seedExercises(): idempotent (count-before-insert guard).
 *   - Runs on every app launch after useMigrations succeeds.
 *   - If exercise table already has rows, returns immediately — safe to call repeatedly.
 *   - Uses drizzle parameterized query builders exclusively (T-1-01: no raw sql interpolation).
 *
 * Assumption A2 (RESEARCH): count-before-insert has a partial-population window on power-loss
 * during the initial seed. Acceptable for Phase 1: seeding is a single run on first boot,
 * the exercise table is never partially populated in practice, and recovery is a re-install.
 */

import { sql } from 'drizzle-orm';
import type { OPSQLiteDatabase } from 'drizzle-orm/op-sqlite';
import { exercise } from './schema';

// ---------------------------------------------------------------------------
// Exercise library (>= 40 entries)
// ---------------------------------------------------------------------------

export const STARTER_EXERCISES = [
  // === Strength — lower body ===
  { id: 'squat', name: 'Back Squat', type: 'strength' as const, bodyPart: 'lower' },
  { id: 'front-squat', name: 'Front Squat', type: 'strength' as const, bodyPart: 'lower' },
  { id: 'deadlift', name: 'Deadlift', type: 'strength' as const, bodyPart: 'lower' },
  { id: 'rdl', name: 'Romanian Deadlift', type: 'strength' as const, bodyPart: 'lower' },
  { id: 'sumo-deadlift', name: 'Sumo Deadlift', type: 'strength' as const, bodyPart: 'lower' },
  { id: 'trap-bar-deadlift', name: 'Trap Bar Deadlift', type: 'strength' as const, bodyPart: 'lower' },
  { id: 'lunge', name: 'Lunge', type: 'strength' as const, bodyPart: 'lower' },
  { id: 'split-squat', name: 'Bulgarian Split Squat', type: 'strength' as const, bodyPart: 'lower' },
  { id: 'goblet-squat', name: 'Goblet Squat', type: 'strength' as const, bodyPart: 'lower' },
  { id: 'step-up', name: 'Step-Up', type: 'strength' as const, bodyPart: 'lower' },
  { id: 'leg-press', name: 'Leg Press', type: 'strength' as const, bodyPart: 'lower' },
  { id: 'hip-thrust', name: 'Hip Thrust', type: 'strength' as const, bodyPart: 'lower' },
  { id: 'box-jump', name: 'Box Jump', type: 'hybrid' as const, bodyPart: 'lower' },

  // === Strength — upper body ===
  { id: 'bench', name: 'Bench Press', type: 'strength' as const, bodyPart: 'upper' },
  { id: 'incline-bench', name: 'Incline Bench Press', type: 'strength' as const, bodyPart: 'upper' },
  { id: 'ohp', name: 'Overhead Press', type: 'strength' as const, bodyPart: 'upper' },
  { id: 'push-press', name: 'Push Press', type: 'strength' as const, bodyPart: 'upper' },
  { id: 'row', name: 'Barbell Row', type: 'strength' as const, bodyPart: 'upper' },
  { id: 'cable-row', name: 'Cable Row', type: 'strength' as const, bodyPart: 'upper' },
  { id: 'lat-pulldown', name: 'Lat Pulldown', type: 'strength' as const, bodyPart: 'upper' },
  { id: 'pull-up', name: 'Pull-Up', type: 'strength' as const, bodyPart: 'upper' },
  { id: 'chin-up', name: 'Chin-Up', type: 'strength' as const, bodyPart: 'upper' },
  { id: 'dip', name: 'Dip', type: 'strength' as const, bodyPart: 'upper' },
  { id: 'push-up', name: 'Push-Up', type: 'strength' as const, bodyPart: 'upper' },

  // === HYROX-specific movements ===
  { id: 'sled-push', name: 'Sled Push', type: 'hybrid' as const, bodyPart: 'full' },
  { id: 'sled-pull', name: 'Sled Pull', type: 'hybrid' as const, bodyPart: 'full' },
  { id: 'sandbag-lunge', name: 'Sandbag Lunge', type: 'hybrid' as const, bodyPart: 'lower' },
  { id: 'wall-ball', name: 'Wall Ball', type: 'hybrid' as const, bodyPart: 'full' },
  { id: 'burpee-broad-jump', name: 'Burpee Broad Jump', type: 'hybrid' as const, bodyPart: 'full' },
  { id: 'box-step-over', name: 'Box Step-Over', type: 'hybrid' as const, bodyPart: 'lower' },
  { id: 'ski-erg', name: 'SkiErg', type: 'endurance' as const, bodyPart: 'full' },
  { id: 'rowing-erg', name: 'Rowing Erg', type: 'endurance' as const, bodyPart: 'full' },

  // === Tactical / strongman movements ===
  { id: 'farmers-carry', name: "Farmer's Carry", type: 'strength' as const, bodyPart: 'full' },
  { id: 'yoke-carry', name: 'Yoke Carry', type: 'hybrid' as const, bodyPart: 'full' },
  { id: 'atlas-stone', name: 'Atlas Stone', type: 'strength' as const, bodyPart: 'full' },
  { id: 'kb-swing', name: 'Kettlebell Swing', type: 'strength' as const, bodyPart: 'full' },
  { id: 'thruster', name: 'Thruster', type: 'hybrid' as const, bodyPart: 'full' },

  // === Conditioning / cardio ===
  { id: 'run', name: 'Run', type: 'endurance' as const, bodyPart: 'full' },
  { id: 'assault-bike', name: 'Assault Bike', type: 'endurance' as const, bodyPart: 'full' },
  { id: 'battle-rope', name: 'Battle Rope', type: 'endurance' as const, bodyPart: 'upper' },

  // === Core ===
  { id: 'plank', name: 'Plank', type: 'strength' as const, bodyPart: 'core' },
  { id: 'ab-wheel', name: 'Ab Wheel', type: 'strength' as const, bodyPart: 'core' },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', type: 'strength' as const, bodyPart: 'core' },
] as const;

// ---------------------------------------------------------------------------
// Idempotent seeder
// ---------------------------------------------------------------------------

/**
 * Insert the starter exercise library if the table is empty.
 *
 * @param db — drizzle OPSQLiteDatabase instance (passed in to keep seed.ts testable
 *             without importing the module-level db singleton from client.ts).
 *
 * Security (T-1-01): all DB operations use drizzle's query builder — no raw SQL
 * string interpolation. This pattern is the foundation reused when user input
 * reaches the DB in Phase 3.
 */
export async function seedExercises(db: OPSQLiteDatabase<Record<string, unknown>>): Promise<void> {
  // Count-before-insert idempotent guard (RESEARCH Pattern 4, Assumption A2).
  const rows = await db.select({ count: sql<number>`count(*)` }).from(exercise);
  const count = rows[0]?.count ?? 0;
  if (count > 0) return;

  // Insert all starter exercises in a single batched insert (T-1-01: parameterized).
  await db.insert(exercise).values([...STARTER_EXERCISES]);
}
