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

// Reusable parameterized query builders (LIFT-03 pre-fill, LIFT-07/D-28 soft-delete, D-14 crash recovery)
export {
  type QueryableDB,
  activeWorkoutFilter,
  selectActiveWorkouts,
  previousSessionSet,
  openWorkout,
  softDeleteWorkout,
} from './queries';

// Generated drizzle migrations for useMigrations() hook in _layout.tsx
export { migrations } from './migrations';
