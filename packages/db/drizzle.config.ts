/**
 * Drizzle Kit migration generation config for @apsis/db.
 *
 * CRITICAL: driver must be 'expo' (not 'better-sqlite' or omitted).
 * The 'expo' driver generates migration files in the format that
 * drizzle-orm/op-sqlite/migrator's useMigrations() hook can consume.
 * Using any other driver produces migrations that appear to run but
 * leave the database empty (RESEARCH Pitfall 5).
 *
 * Run from packages/db:
 *   npx drizzle-kit generate
 *
 * Output (append-only — never hand-edit):
 *   drizzle/0000_*.sql        — schema SQL
 *   drizzle/meta/journal.json — migration journal
 *   drizzle/migrations.js     — auto-generated importer (T-1-04)
 */

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'expo',
});
