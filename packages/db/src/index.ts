/**
 * @apsis/db — public API
 *
 * Re-exports:
 *   - schema tables (for drizzle query builders in the mobile app)
 *   - db singleton + DB type (for useMigrations and seedExercises calls)
 *   - seedExercises (idempotent starter exercise library seed)
 *   - migrations (generated drizzle artifacts for useMigrations hook — added in Task 3)
 *
 * Import order is intentional: schema → client (which imports schema) → seed → migrations.
 */

// Schema table references
export * from './schema';

// db singleton and DB type alias
export { db, type DB } from './client';

// Idempotent exercise seed
export { STARTER_EXERCISES, seedExercises } from './seed';

// Generated drizzle migrations — exported after drizzle-kit generate (Task 3)
// export { migrations } from './migrations';
