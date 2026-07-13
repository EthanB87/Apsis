/**
 * @apsis/db — public API
 *
 * Re-exports:
 *   - schema tables (for drizzle query builders in the mobile app)
 *   - db singleton + DB type (for useMigrations and seedExercises calls)
 *   - seedExercises (idempotent starter exercise library seed)
 *   - queries (reusable parameterized query builders — pre-fill, soft-delete, crash recovery)
 *   - migrations (generated drizzle artifacts for useMigrations hook — added in Task 3)
 *
 * Import order is intentional: schema → client (which imports schema) → seed → queries → migrations.
 */

// Schema table references
export * from './schema';

// db singleton and DB type alias
export { db, type DB } from './client';

// Idempotent exercise seed
export { STARTER_EXERCISES, seedExercises } from './seed';

// Reusable parameterized query builders (LIFT-03 pre-fill, LIFT-07/D-28 soft-delete, D-14
// crash recovery, HOME-03/04/05/06 trend + History)
export {
  type QueryableDB,
  activeWorkoutFilter,
  selectActiveWorkouts,
  previousSessionSet,
  recentExerciseIds,
  openWorkout,
  softDeleteWorkout,
  last28DaysTrend,
  sessionCountsByDate,
  dayGroupedSessions,
  candidatesForDedupe,
} from './queries';

// Pure load_daily recompute-row builder (RUN/HOME foundation — RESEARCH Pattern 1)
export { computeLoadDailyUpsertRows, type LoadDailyUpsertRow } from './loadDaily';

// Local-first nutrition query builders (NUTR-02/04/07/13/14/17 — search/recents/favorites/
// day-totals/day-type session query/recipe CRUD + per-serving aggregation)
export {
  searchLocalFoods,
  recentFoods,
  favoriteFoods,
  dayTotals,
  sessionTypesForDate,
  createRecipe,
  addRecipeIngredient,
  listRecipes,
  computeRecipeServingMacros,
  type RecipeServingMacros,
} from './nutritionQueries';

// Pure nutrition_target upsert-row builder (NUTR-16/17)
export { computeNutritionTargetRow, type NutritionTargetUpsertRow } from './nutritionTarget';

// Generated drizzle migrations for useMigrations() hook in _layout.tsx
export { migrations } from './migrations';
