/**
 * @apsis/db — eleven-table SQLite schema via drizzle-orm
 *
 * Tables:
 *   user_profile, exercise, workout, strength_set, endurance_segment, load_daily,
 *   food, food_log, recipe, recipe_ingredient, nutrition_target
 *
 * Security: drizzle table definitions enforce column constraints at the ORM layer.
 * All queries use parameterized query builders — never raw sql template literals
 * with user-supplied values (T-1-01).
 *
 * Note: The load_daily_date_idx index is present even though load_daily.localDate
 * is the primary key; the explicit named index is referenced by the engine's
 * date-range queries and makes the intent clear.
 *
 * Note (Phase 07 / NUTR-01, RESEARCH Pitfall 4): none of the new nutrition tables carry
 * a per-user owner column — this is a single-local-user app with no auth, and no
 * existing table (including the singleton user_profile) carries one either.
 */

import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// user_profile
// ---------------------------------------------------------------------------

export const userProfile = sqliteTable('user_profile', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sex: text('sex', { enum: ['male', 'female', 'other'] }),
  bodyweightKg: real('bodyweight_kg'),
  thresholdHr: integer('threshold_hr'),
  thresholdPaceSecPerKm: integer('threshold_pace_sec_per_km'),
  units: text('units', { enum: ['metric', 'imperial'] }).default('metric'),
  /** Global default rest-timer duration in seconds (D-25/D-32); per-exercise override lives on `exercise.restTimerSec`. */
  restTimerDefaultSec: integer('rest_timer_default_sec').default(120),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  /** When bodyweight was last set, by manual edit or HK import (D-17); drives most-recent-wins conflict resolution. */
  bodyweightSetAt: integer('bodyweight_set_at', { mode: 'timestamp' }),
  /** True once the HealthKit permission sheet has completed (D-19/D-21); toggling off pauses all HK reads/writes. */
  healthkitConnected: integer('healthkit_connected', { mode: 'boolean' }).default(false),
  /** Timestamp of the last successful foreground sync (D-24); null = never synced or last sync failed (D-25). */
  healthkitLastSyncAt: integer('healthkit_last_sync_at', { mode: 'timestamp' }),
  /** Opaque anchor token from HealthKit's anchored query API (D-02 Pattern 2); null = no sync has completed yet. */
  healthkitAnchor: text('healthkit_anchor'),
  /** Height in cm, required for Mifflin-St Jeor BMR (NUTR-15). Null until the user completes nutrition setup. */
  heightCm: real('height_cm'),
  /** Birth year, used to derive age for BMR (NUTR-15). Null until the user completes nutrition setup. */
  birthYear: integer('birth_year'),
  /** Goal mode driving kcal delta in dailyMacroTarget (NUTR-15). Null until the user completes nutrition setup. */
  goalMode: text('goal_mode', { enum: ['cut', 'maintain', 'bulk'] }),
});

// ---------------------------------------------------------------------------
// exercise
// ---------------------------------------------------------------------------

export const exercise = sqliteTable('exercise', {
  /** Kebab-case stable identifier, e.g. 'squat', 'sled-push' */
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: ['strength', 'endurance', 'hybrid'] }).notNull(),
  bodyPart: text('body_part'),
  isSeeded: integer('is_seeded', { mode: 'boolean' }).default(true),
  /** Bodyweight-load factor (D-15/D-21); null = not a bodyweight movement. */
  bwFactor: real('bw_factor'),
  /** Set entry shape (D-19/D-21): 'reps' or 'timed'; null = not logged as strength this phase (endurance rows). */
  entryMode: text('entry_mode', { enum: ['reps', 'timed'] }),
  /** Per-exercise rest-timer override in seconds (D-25); null = use profile default. */
  restTimerSec: integer('rest_timer_sec'),
});

// ---------------------------------------------------------------------------
// workout
// ---------------------------------------------------------------------------

export const workout = sqliteTable('workout', {
  /** UUID v4 */
  id: text('id').primaryKey(),
  localDate: text('local_date').notNull(),
  type: text('type', { enum: ['strength', 'endurance', 'hybrid'] }).notNull(),
  title: text('title'),
  /** Free-text session note (RUN-05); workout-level so CONDITIONING sessions with no
   * endurance_segment still carry a note (RESEARCH Assumption A4). */
  note: text('note'),
  /** Session HSS written by the engine after all sets/segments logged */
  hss: real('hss').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  /** Set when the session is finished (D-14); null = open/in-progress session (crash recovery). */
  finishedAt: integer('finished_at', { mode: 'timestamp' }),
  /** Soft-delete marker (D-28); null = active. Every load/HSS read must filter this IS NULL. */
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  /** Provenance (D-08): 'manual' = logged in Apsis, 'healthkit' = imported from Apple Health. */
  source: text('source', { enum: ['manual', 'healthkit'] }).default('manual'),
  /** HealthKit sample UUID (D-11/D-14): for 'healthkit' rows, the imported sample's uuid
   * (echo-exclusion + tombstone check); for 'manual' rows, the uuid of Apsis's own write-back. */
  healthkitUuid: text('healthkit_uuid'),
});

// ---------------------------------------------------------------------------
// strength_set
// ---------------------------------------------------------------------------

export const strengthSet = sqliteTable('strength_set', {
  id: text('id').primaryKey(),
  workoutId: text('workout_id')
    .notNull()
    .references(() => workout.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id')
    .notNull()
    .references(() => exercise.id),
  setNumber: integer('set_number').notNull(),
  loadKg: real('load_kg').notNull(),
  reps: integer('reps').notNull(),
  /** RPE on the 6–10 Borg/RPE scale */
  rpe: real('rpe'),
  isWarmup: integer('is_warmup', { mode: 'boolean' }).default(false),
  /** Epley e1RM estimate cached at insert; recomputed by engine in Phase 2 */
  e1rmKg: real('e1rm_kg'),
  /** Raw strength stress component — written by engine */
  stressScore: real('stress_score'),
  /** User-entered added weight for bodyweight/implement movements (D-17); null for barbell lifts. */
  addedLoadKg: real('added_load_kg'),
  /** Duration in seconds for timed carry/sled sets (D-19); null for rep sets. Timed sets store reps=0. */
  durationS: integer('duration_s'),
});

// ---------------------------------------------------------------------------
// endurance_segment
// ---------------------------------------------------------------------------

export const enduranceSegment = sqliteTable('endurance_segment', {
  id: text('id').primaryKey(),
  workoutId: text('workout_id')
    .notNull()
    .references(() => workout.id, { onDelete: 'cascade' }),
  activityType: text('activity_type', {
    enum: ['run', 'erg', 'conditioning', 'sled', 'other'],
  }).notNull(),
  distanceM: real('distance_m'),
  durationS: integer('duration_s').notNull(),
  avgHr: integer('avg_hr'),
  /** Intensity factor resolved from HR or pace; used by HSS engine */
  intensityFactor: real('intensity_factor'),
  /** Raw endurance stress component — written by engine */
  stressScore: real('stress_score'),
});

// ---------------------------------------------------------------------------
// load_daily
// ---------------------------------------------------------------------------

export const loadDaily = sqliteTable(
  'load_daily',
  {
    /** YYYY-MM-DD primary key */
    localDate: text('local_date').primaryKey(),
    dayHss: real('day_hss').default(0),
    atl: real('atl').default(0),
    ctl: real('ctl').default(0),
    tsb: real('tsb').default(0),
    readinessBand: text('readiness_band', {
      enum: ['green', 'amber', 'red', 'calibrating'],
    }),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  },
  (table) => ({
    /**
     * Explicit named index for the engine's date-range queries.
     * Required even though localDate is the PK — see RESEARCH Pitfall 6.
     */
    dateIdx: index('load_daily_date_idx').on(table.localDate),
  }),
);

// ---------------------------------------------------------------------------
// food (Phase 07 / NUTR-01, NUTR-05, NUTR-08, NUTR-11)
// ---------------------------------------------------------------------------

export const food = sqliteTable('food',
  {
    /** UUID v4 */
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    brand: text('brand'),
    barcode: text('barcode'),
    /** Provenance of this food row. 'apsis' is intentionally unused in v1 (no backend;
     * shared-DB contribution deferred per 07-CONTEXT.md discretion #6). */
    source: text('source', { enum: ['user', 'off', 'usda', 'apsis', 'commercial'] }).notNull(),
    kcalPer100g: real('kcal_per_100g').notNull(),
    proteinGPer100g: real('protein_g_per_100g').notNull(),
    carbGPer100g: real('carb_g_per_100g').notNull(),
    fatGPer100g: real('fat_g_per_100g').notNull(),
    fiberGPer100g: real('fiber_g_per_100g'),
    sodiumMgPer100g: real('sodium_mg_per_100g'),
    servingName: text('serving_name'),
    servingGrams: real('serving_grams'),
    verified: integer('verified', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  },
  (table) => ({
    barcodeIdx: index('food_barcode_idx').on(table.barcode),
  }),
);

// ---------------------------------------------------------------------------
// food_log (Phase 07 / NUTR-06, NUTR-07)
// ---------------------------------------------------------------------------

export const foodLog = sqliteTable('food_log',
  {
    /** UUID v4 */
    id: text('id').primaryKey(),
    localDate: text('local_date').notNull(),
    meal: text('meal', { enum: ['breakfast', 'lunch', 'dinner', 'snack'] }).notNull(),
    /** No cascade (mirrors strengthSet.exerciseId) — a quick-add row has no food. Nullable. */
    foodId: text('food_id').references(() => food.id),
    qtyGrams: real('qty_grams').notNull(),
    /** Denormalized macros, frozen at log time (RESEARCH Pattern 2) — never recomputed from a
     * live join against `food`, so editing a food later never rewrites logged history. */
    kcal: real('kcal').notNull(),
    p: real('p').notNull(),
    c: real('c').notNull(),
    f: real('f').notNull(),
    quickAdd: integer('quick_add', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  },
  (table) => ({
    dateIdx: index('food_log_date_idx').on(table.localDate),
  }),
);

// ---------------------------------------------------------------------------
// recipe (Phase 07 / NUTR-13, NUTR-14)
// ---------------------------------------------------------------------------

export const recipe = sqliteTable('recipe', {
  /** UUID v4 */
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  servings: real('servings').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// ---------------------------------------------------------------------------
// recipe_ingredient (Phase 07 / NUTR-13)
// ---------------------------------------------------------------------------

export const recipeIngredient = sqliteTable('recipe_ingredient', {
  /** UUID v4 */
  id: text('id').primaryKey(),
  recipeId: text('recipe_id')
    .notNull()
    .references(() => recipe.id, { onDelete: 'cascade' }),
  /** No cascade (mirrors strengthSet.exerciseId) — a food is never deleted by deleting a recipe. */
  foodId: text('food_id')
    .notNull()
    .references(() => food.id),
  qtyGrams: real('qty_grams').notNull(),
});

// ---------------------------------------------------------------------------
// nutrition_target (Phase 07 / NUTR-16, NUTR-17)
// ---------------------------------------------------------------------------

export const nutritionTarget = sqliteTable('nutrition_target',
  {
    /** UUID v4 — not localDate PK, since a manual override row may coexist with an auto row. */
    id: text('id').primaryKey(),
    localDate: text('local_date').notNull(),
    dayType: text('day_type', {
      enum: ['heavy_lift', 'long_run', 'double', 'rest', 'mixed'],
    }).notNull(),
    kcal: real('kcal').notNull(),
    proteinG: real('protein_g').notNull(),
    carbG: real('carb_g').notNull(),
    fatG: real('fat_g').notNull(),
    source: text('source', { enum: ['auto', 'override'] }).notNull().default('auto'),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  },
  (table) => ({
    dateIdx: index('nutrition_target_date_idx').on(table.localDate),
  }),
);
