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
