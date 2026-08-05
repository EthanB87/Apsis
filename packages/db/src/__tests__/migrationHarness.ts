/**
 * migrationHarness.ts — shared migration round-trip proof harness (schema_push_requirement).
 *
 * Applies every committed drizzle .sql file in journal order to a real in-memory
 * better-sqlite3 database — the same append-only SQL chain that useMigrations() executes
 * on-device. Typecheck alone cannot prove the tables/columns exist (types come from
 * schema.ts); this harness is the proof a committed migration is real.
 *
 * Extracted from nutrition-schema.test.ts (Phase 07 origin) so units-migration.test.ts
 * (Phase 09) can reuse it without pasting a second copy (Phase 09 P01 Task 2).
 *
 * better-sqlite3 is a devDependency of @apsis/db ONLY — it is never a runtime dep and
 * never enters the mobile bundle (op-sqlite is the on-device driver).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const DRIZZLE_DIR = path.resolve(__dirname, '../../drizzle');

interface JournalEntry {
  idx: number;
  tag: string;
}

/** Committed migration tags, in journal (idx) order — the same order useMigrations() applies them. */
export function getJournalTags(): string[] {
  const journal = JSON.parse(
    readFileSync(path.join(DRIZZLE_DIR, 'meta/_journal.json'), 'utf-8'),
  ) as { entries: JournalEntry[] };

  return [...journal.entries].sort((a, b) => a.idx - b.idx).map((e) => e.tag);
}

/** Apply a single committed migration .sql file (statement-breakpoint-delimited) by tag. */
export function applyMigrationFile(sqlite: Database.Database, tag: string): void {
  const migrationSql = readFileSync(path.join(DRIZZLE_DIR, `${tag}.sql`), 'utf-8');
  for (const statement of migrationSql.split('--> statement-breakpoint')) {
    const trimmed = statement.trim();
    if (trimmed.length > 0) sqlite.exec(trimmed);
  }
}

/** Apply every committed migration .sql file in journal order — mirrors useMigrations(). */
export function applyCommittedMigrations(sqlite: Database.Database): string[] {
  const tags = getJournalTags();
  for (const tag of tags) applyMigrationFile(sqlite, tag);
  return tags;
}
