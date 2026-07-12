/**
 * @apsis/db — exercise library seed data
 *
 * STARTER_EXERCISES: ~150 HYROX / tactical / strength / conditioning movements.
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
// Exercise library (~150 entries)
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
  { id: 'hack-squat', name: 'Hack Squat', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'zercher-squat', name: 'Zercher Squat', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'box-squat', name: 'Box Squat', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'pause-squat', name: 'Pause Squat', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'overhead-squat', name: 'Overhead Squat', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'good-morning', name: 'Good Morning', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'single-leg-rdl', name: 'Single-Leg Romanian Deadlift', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'walking-lunge', name: 'Walking Lunge', type: 'strength' as const, bodyPart: 'lower', bwFactor: 0.85, entryMode: 'reps' as const },
  { id: 'reverse-lunge', name: 'Reverse Lunge', type: 'strength' as const, bodyPart: 'lower', bwFactor: 0.85, entryMode: 'reps' as const },
  { id: 'curtsy-lunge', name: 'Curtsy Lunge', type: 'strength' as const, bodyPart: 'lower', bwFactor: 0.85, entryMode: 'reps' as const },
  { id: 'cossack-squat', name: 'Cossack Squat', type: 'strength' as const, bodyPart: 'lower', bwFactor: 0.85, entryMode: 'reps' as const },
  { id: 'pistol-squat', name: 'Pistol Squat', type: 'strength' as const, bodyPart: 'lower', bwFactor: 0.95, entryMode: 'reps' as const },
  { id: 'glute-bridge', name: 'Glute Bridge', type: 'strength' as const, bodyPart: 'lower', bwFactor: 0.60, entryMode: 'reps' as const },
  { id: 'nordic-curl', name: 'Nordic Curl', type: 'strength' as const, bodyPart: 'lower', bwFactor: 0.80, entryMode: 'reps' as const },
  { id: 'glute-ham-raise', name: 'Glute-Ham Raise', type: 'strength' as const, bodyPart: 'lower', bwFactor: 0.75, entryMode: 'reps' as const },
  { id: 'leg-extension', name: 'Leg Extension', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'leg-curl-lying', name: 'Lying Leg Curl', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'leg-curl-seated', name: 'Seated Leg Curl', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'calf-raise-standing', name: 'Standing Calf Raise', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'calf-raise-seated', name: 'Seated Calf Raise', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'hip-abduction-machine', name: 'Hip Abduction Machine', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'hip-adduction-machine', name: 'Hip Adduction Machine', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'smith-machine-squat', name: 'Smith Machine Squat', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'belt-squat', name: 'Belt Squat', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
  { id: 'single-leg-leg-press', name: 'Single-Leg Leg Press', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },

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
  { id: 'close-grip-bench', name: 'Close-Grip Bench Press', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'decline-bench', name: 'Decline Bench Press', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'db-bench-press', name: 'Dumbbell Bench Press', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'db-incline-press', name: 'Dumbbell Incline Press', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'db-shoulder-press', name: 'Dumbbell Shoulder Press', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'arnold-press', name: 'Arnold Press', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'landmine-press', name: 'Landmine Press', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'floor-press', name: 'Floor Press', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'pendlay-row', name: 'Pendlay Row', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'db-row', name: 'Dumbbell Row', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 't-bar-row', name: 'T-Bar Row', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'seal-row', name: 'Seal Row', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'chest-supported-row', name: 'Chest-Supported Row', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'face-pull', name: 'Face Pull', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'shrug', name: 'Shrug', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'rack-pull', name: 'Rack Pull', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'ring-row', name: 'Ring Row', type: 'strength' as const, bodyPart: 'upper', bwFactor: 0.55, entryMode: 'reps' as const },
  { id: 'archer-pull-up', name: 'Archer Pull-Up', type: 'strength' as const, bodyPart: 'upper', bwFactor: 0.95, entryMode: 'reps' as const },
  { id: 'muscle-up', name: 'Muscle-Up', type: 'strength' as const, bodyPart: 'upper', bwFactor: 1.0, entryMode: 'reps' as const },
  { id: 'decline-push-up', name: 'Decline Push-Up', type: 'strength' as const, bodyPart: 'upper', bwFactor: 0.75, entryMode: 'reps' as const },
  { id: 'incline-push-up', name: 'Incline Push-Up', type: 'strength' as const, bodyPart: 'upper', bwFactor: 0.50, entryMode: 'reps' as const },
  { id: 'diamond-push-up', name: 'Diamond Push-Up', type: 'strength' as const, bodyPart: 'upper', bwFactor: 0.65, entryMode: 'reps' as const },
  { id: 'close-grip-push-up', name: 'Close-Grip Push-Up', type: 'strength' as const, bodyPart: 'upper', bwFactor: 0.65, entryMode: 'reps' as const },
  { id: 'lateral-raise', name: 'Lateral Raise', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'front-raise', name: 'Front Raise', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'rear-delt-fly', name: 'Rear Delt Fly', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'cable-lateral-raise', name: 'Cable Lateral Raise', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'upright-row', name: 'Upright Row', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'bicep-curl', name: 'Bicep Curl', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'hammer-curl', name: 'Hammer Curl', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'preacher-curl', name: 'Preacher Curl', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'cable-curl', name: 'Cable Curl', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'tricep-pushdown', name: 'Tricep Pushdown', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'overhead-tricep-extension', name: 'Overhead Tricep Extension', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'skull-crusher', name: 'Skull Crusher', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'chest-press-machine', name: 'Chest Press Machine', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'pec-deck', name: 'Pec Deck', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'assisted-pull-up-machine', name: 'Assisted Pull-Up Machine', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'cable-fly', name: 'Cable Fly', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'straight-arm-pulldown', name: 'Straight-Arm Pulldown', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },
  { id: 'seated-row-machine', name: 'Seated Row Machine', type: 'strength' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'reps' as const },

  // === Olympic / power lifts ===
  { id: 'power-clean', name: 'Power Clean', type: 'strength' as const, bodyPart: 'full', bwFactor: null, entryMode: 'reps' as const },
  { id: 'hang-clean', name: 'Hang Clean', type: 'strength' as const, bodyPart: 'full', bwFactor: null, entryMode: 'reps' as const },
  { id: 'clean-and-jerk', name: 'Clean and Jerk', type: 'strength' as const, bodyPart: 'full', bwFactor: null, entryMode: 'reps' as const },
  { id: 'snatch', name: 'Snatch', type: 'strength' as const, bodyPart: 'full', bwFactor: null, entryMode: 'reps' as const },
  { id: 'power-snatch', name: 'Power Snatch', type: 'strength' as const, bodyPart: 'full', bwFactor: null, entryMode: 'reps' as const },
  { id: 'clean-pull', name: 'Clean Pull', type: 'strength' as const, bodyPart: 'full', bwFactor: null, entryMode: 'reps' as const },
  { id: 'push-jerk', name: 'Push Jerk', type: 'strength' as const, bodyPart: 'full', bwFactor: null, entryMode: 'reps' as const },

  // === HYROX-specific movements ===
  { id: 'sled-push', name: 'Sled Push', type: 'hybrid' as const, bodyPart: 'full', bwFactor: null, entryMode: 'timed' as const },
  { id: 'sled-pull', name: 'Sled Pull', type: 'hybrid' as const, bodyPart: 'full', bwFactor: null, entryMode: 'timed' as const },
  { id: 'sandbag-lunge', name: 'Sandbag Lunge', type: 'hybrid' as const, bodyPart: 'lower', bwFactor: 0.85, entryMode: 'reps' as const },
  { id: 'wall-ball', name: 'Wall Ball', type: 'hybrid' as const, bodyPart: 'full', bwFactor: 0.30, entryMode: 'reps' as const },
  { id: 'burpee-broad-jump', name: 'Burpee Broad Jump', type: 'hybrid' as const, bodyPart: 'full', bwFactor: 1.0, entryMode: 'reps' as const },
  { id: 'box-step-over', name: 'Box Step-Over', type: 'hybrid' as const, bodyPart: 'lower', bwFactor: 0.90, entryMode: 'reps' as const },
  { id: 'ski-erg', name: 'SkiErg', type: 'endurance' as const, bodyPart: 'full', bwFactor: null, entryMode: null },
  { id: 'rowing-erg', name: 'Rowing Erg', type: 'endurance' as const, bodyPart: 'full', bwFactor: null, entryMode: null },
  { id: 'bear-crawl', name: 'Bear Crawl', type: 'hybrid' as const, bodyPart: 'full', bwFactor: null, entryMode: 'timed' as const },
  { id: 'devils-press', name: "Devil's Press", type: 'hybrid' as const, bodyPart: 'full', bwFactor: 0.30, entryMode: 'reps' as const },
  { id: 'man-maker', name: 'Man Maker', type: 'hybrid' as const, bodyPart: 'full', bwFactor: 0.30, entryMode: 'reps' as const },
  { id: 'sandbag-carry', name: 'Sandbag Carry', type: 'strength' as const, bodyPart: 'full', bwFactor: null, entryMode: 'timed' as const },
  { id: 'sandbag-clean', name: 'Sandbag Clean', type: 'strength' as const, bodyPart: 'full', bwFactor: null, entryMode: 'reps' as const },
  { id: 'sandbag-over-shoulder', name: 'Sandbag Over Shoulder', type: 'strength' as const, bodyPart: 'full', bwFactor: null, entryMode: 'reps' as const },
  { id: 'tire-flip', name: 'Tire Flip', type: 'strength' as const, bodyPart: 'full', bwFactor: null, entryMode: 'reps' as const },
  { id: 'sled-drag', name: 'Sled Drag', type: 'hybrid' as const, bodyPart: 'full', bwFactor: null, entryMode: 'timed' as const },
  { id: 'shuttle-run', name: 'Shuttle Run', type: 'hybrid' as const, bodyPart: 'full', bwFactor: null, entryMode: 'timed' as const },
  { id: 'ruck-carry', name: 'Ruck Carry', type: 'hybrid' as const, bodyPart: 'full', bwFactor: null, entryMode: 'timed' as const },

  // === Tactical / strongman movements ===
  { id: 'farmers-carry', name: "Farmer's Carry", type: 'strength' as const, bodyPart: 'full', bwFactor: null, entryMode: 'timed' as const },
  { id: 'yoke-carry', name: 'Yoke Carry', type: 'hybrid' as const, bodyPart: 'full', bwFactor: null, entryMode: 'timed' as const },
  { id: 'atlas-stone', name: 'Atlas Stone', type: 'strength' as const, bodyPart: 'full', bwFactor: null, entryMode: 'reps' as const },
  { id: 'kb-swing', name: 'Kettlebell Swing', type: 'strength' as const, bodyPart: 'full', bwFactor: 0.30, entryMode: 'reps' as const },
  { id: 'thruster', name: 'Thruster', type: 'hybrid' as const, bodyPart: 'full', bwFactor: null, entryMode: 'reps' as const },
  { id: 'log-press', name: 'Log Press', type: 'strength' as const, bodyPart: 'full', bwFactor: null, entryMode: 'reps' as const },
  { id: 'axle-deadlift', name: 'Axle Deadlift', type: 'strength' as const, bodyPart: 'full', bwFactor: null, entryMode: 'reps' as const },
  { id: 'keg-carry', name: 'Keg Carry', type: 'strength' as const, bodyPart: 'full', bwFactor: null, entryMode: 'timed' as const },
  { id: 'stone-to-shoulder', name: 'Stone to Shoulder', type: 'strength' as const, bodyPart: 'full', bwFactor: null, entryMode: 'reps' as const },
  { id: 'sledgehammer-swing', name: 'Sledgehammer Swing', type: 'hybrid' as const, bodyPart: 'full', bwFactor: null, entryMode: 'timed' as const },
  { id: 'weighted-vest-carry', name: 'Weighted Vest Carry', type: 'hybrid' as const, bodyPart: 'full', bwFactor: null, entryMode: 'timed' as const },
  { id: 'suitcase-carry', name: 'Suitcase Carry', type: 'strength' as const, bodyPart: 'full', bwFactor: null, entryMode: 'timed' as const },
  { id: 'overhead-carry', name: 'Overhead Carry', type: 'strength' as const, bodyPart: 'full', bwFactor: null, entryMode: 'timed' as const },

  // === Conditioning / cardio ===
  { id: 'run', name: 'Run', type: 'endurance' as const, bodyPart: 'full', bwFactor: null, entryMode: null },
  { id: 'assault-bike', name: 'Assault Bike', type: 'endurance' as const, bodyPart: 'full', bwFactor: null, entryMode: null },
  { id: 'battle-rope', name: 'Battle Rope', type: 'endurance' as const, bodyPart: 'upper', bwFactor: null, entryMode: 'timed' as const },
  { id: 'cycling', name: 'Cycling', type: 'endurance' as const, bodyPart: 'full', bwFactor: null, entryMode: null },
  { id: 'swimming', name: 'Swimming', type: 'endurance' as const, bodyPart: 'full', bwFactor: null, entryMode: null },
  { id: 'stair-climber', name: 'Stair Climber', type: 'endurance' as const, bodyPart: 'full', bwFactor: null, entryMode: null },
  { id: 'elliptical', name: 'Elliptical', type: 'endurance' as const, bodyPart: 'full', bwFactor: null, entryMode: null },
  { id: 'jump-rope', name: 'Jump Rope', type: 'endurance' as const, bodyPart: 'full', bwFactor: null, entryMode: null },
  { id: 'incline-walk', name: 'Incline Walk', type: 'endurance' as const, bodyPart: 'full', bwFactor: null, entryMode: null },

  // === Core ===
  { id: 'plank', name: 'Plank', type: 'strength' as const, bodyPart: 'core', bwFactor: null, entryMode: 'timed' as const },
  // D-14 fix: was bwFactor: null, scoring ~0 HSS at 0 entered load. Curated as
  // push-up-style honest bodyweight movements (Claude's discretion per D-14).
  { id: 'ab-wheel', name: 'Ab Wheel', type: 'strength' as const, bodyPart: 'core', bwFactor: 0.25, entryMode: 'reps' as const },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', type: 'strength' as const, bodyPart: 'core', bwFactor: 0.35, entryMode: 'reps' as const },
  { id: 'crunch', name: 'Crunch', type: 'strength' as const, bodyPart: 'core', bwFactor: 0.15, entryMode: 'reps' as const },
  { id: 'sit-up', name: 'Sit-Up', type: 'strength' as const, bodyPart: 'core', bwFactor: 0.35, entryMode: 'reps' as const },
  { id: 'leg-raise', name: 'Leg Raise', type: 'strength' as const, bodyPart: 'core', bwFactor: 0.30, entryMode: 'reps' as const },
  { id: 'v-up', name: 'V-Up', type: 'strength' as const, bodyPart: 'core', bwFactor: 0.40, entryMode: 'reps' as const },
  { id: 'russian-twist', name: 'Russian Twist', type: 'strength' as const, bodyPart: 'core', bwFactor: 0.20, entryMode: 'reps' as const },
  { id: 'mountain-climber', name: 'Mountain Climber', type: 'hybrid' as const, bodyPart: 'core', bwFactor: null, entryMode: 'timed' as const },
  { id: 'side-plank', name: 'Side Plank', type: 'strength' as const, bodyPart: 'core', bwFactor: null, entryMode: 'timed' as const },
  { id: 'dead-bug', name: 'Dead Bug', type: 'strength' as const, bodyPart: 'core', bwFactor: 0.15, entryMode: 'reps' as const },
  { id: 'bird-dog', name: 'Bird Dog', type: 'strength' as const, bodyPart: 'core', bwFactor: 0.15, entryMode: 'reps' as const },
  { id: 'cable-crunch', name: 'Cable Crunch', type: 'strength' as const, bodyPart: 'core', bwFactor: null, entryMode: 'reps' as const },
  { id: 'weighted-sit-up', name: 'Weighted Sit-Up', type: 'strength' as const, bodyPart: 'core', bwFactor: null, entryMode: 'reps' as const },
  { id: 'pallof-press', name: 'Pallof Press', type: 'strength' as const, bodyPart: 'core', bwFactor: null, entryMode: 'reps' as const },
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
