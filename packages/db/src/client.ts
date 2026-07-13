/**
 * @apsis/db — op-sqlite + drizzle database client singleton
 *
 * Opens the on-device SQLite database and wraps it with drizzle-orm.
 * The singleton is created once at module load time; JSI keeps it alive
 * for the app's lifetime.
 *
 * This file is NOT imported in vitest (native op-sqlite JSI requires a device).
 * Tests access STARTER_EXERCISES and schema types directly without the singleton.
 *
 * Security: this module establishes the single db handle; all queries from
 * higher layers must use the exported `db` instance (drizzle parameterized
 * builders). Never create secondary connections or raw sqlite3 handles (T-1-01).
 */

import { drizzle } from 'drizzle-orm/op-sqlite';
import { open } from '@op-engineering/op-sqlite';
import * as schema from './schema';

const opsqliteDb = open({ name: 'apsis.db' });

// WR-01: SQLite defaults `foreign_keys` to OFF and op-sqlite does not enable it on open (no
// pragma in its native open path, no SQLITE_DEFAULT_FOREIGN_KEYS compile flag) — without this,
// NO foreign key (including recipe_ingredient's ON DELETE CASCADE and strength_set.workout_id)
// is enforced at runtime, and the test harnesses' `foreign_keys = ON` would be validating a
// configuration the app never runs. The pragma is per-connection; executed synchronously here,
// before useMigrations() runs. Migration-order safe: every committed migration is additive
// (CREATE TABLE / ALTER TABLE ... ADD), no table rebuilds that could trip FK checks mid-chain.
opsqliteDb.executeSync('PRAGMA foreign_keys = ON;');

/**
 * Drizzle database singleton wrapping the on-device apsis.db SQLite file.
 * Import this in _layout.tsx and pass to useMigrations() + seedExercises().
 */
export const db = drizzle(opsqliteDb, { schema });

/**
 * Type alias for the drizzle db instance — use for function parameter types
 * across the db layer so callers don't need to import the singleton directly.
 */
export type DB = typeof db;
