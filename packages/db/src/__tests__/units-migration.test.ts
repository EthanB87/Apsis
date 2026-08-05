/**
 * units-migration.test.ts — Phase 09 P01 Task 2: units-split migration 0005 round-trip proof
 * (must_haves truth, T-09-01).
 *
 * Reuses `applyCommittedMigrations`/`applyMigrationFile`/`getJournalTags` from
 * migrationHarness.ts (extracted from nutrition-schema.test.ts) — applies committed drizzle
 * .sql files, in journal order, to a real in-memory better-sqlite3 database, the same
 * append-only SQL chain useMigrations() executes on-device. Typecheck alone cannot prove
 * the D-04 silent backfill produced correct values; this is that proof, before the .sql
 * ever ships in build 10.
 *
 * Covers:
 *   - migration 0005 is committed and applies cleanly (last in journal order)
 *   - the three new user_profile columns + food.last_used_unit exist after full apply
 *   - D-04 silent backfill: a row inserted with ONLY the legacy `units='imperial'` value,
 *     BEFORE 0005 runs, has lifts_units/bodyweight_units/run_units all equal to 'imperial'
 *     immediately after 0005's real ALTER+UPDATE statements apply (the exact on-device
 *     build-9 -> build-10 update path)
 *   - a row written directly with mixed buckets (imperial lifts, metric runs) round-trips
 *     exactly — the exact beta case (D-01)
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from '../schema';
import { food, userProfile } from '../schema';
import { applyCommittedMigrations, applyMigrationFile, getJournalTags } from './migrationHarness';

const UNITS_SPLIT_TAG = '0005_clean_champions';

function openMigratedDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const appliedTags = applyCommittedMigrations(sqlite);
  const db = drizzle(sqlite, { schema });
  return { sqlite, db, appliedTags };
}

/** Opens a fresh in-memory db with every committed migration applied EXCEPT the units-split
 * one — lets a test insert a pre-Phase-09-shaped row (only the legacy `units` column exists)
 * before applying the real 0005 migration file and observing its backfill. */
function openDbBeforeUnitsSplit() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  for (const tag of getJournalTags()) {
    if (tag === UNITS_SPLIT_TAG) break;
    applyMigrationFile(sqlite, tag);
  }
  return sqlite;
}

describe('units-split migration round-trip (0005, T-09-01)', () => {
  let harness: ReturnType<typeof openMigratedDb>;

  beforeEach(() => {
    harness = openMigratedDb();
  });

  afterEach(() => {
    harness.sqlite.close();
  });

  it('the committed journal includes 0005 and every migration applies cleanly', () => {
    expect(harness.appliedTags).toContain(UNITS_SPLIT_TAG);
    expect(harness.appliedTags.at(-1)).toBe(UNITS_SPLIT_TAG);
  });

  it('user_profile carries lifts_units/bodyweight_units/run_units and food carries last_used_unit', () => {
    const userProfileColumns = harness.sqlite
      .prepare("PRAGMA table_info('user_profile')")
      .all()
      .map((c) => (c as { name: string }).name);
    expect(userProfileColumns).toContain('lifts_units');
    expect(userProfileColumns).toContain('bodyweight_units');
    expect(userProfileColumns).toContain('run_units');

    const foodColumns = harness.sqlite
      .prepare("PRAGMA table_info('food')")
      .all()
      .map((c) => (c as { name: string }).name);
    expect(foodColumns).toContain('last_used_unit');
  });

  it('D-04 silent backfill: a pre-Phase-09 row seeded with only legacy units resolves all three buckets to that value', () => {
    // Pre-0005 db: only the legacy `units` column exists on user_profile (mirrors an
    // existing build-9 tester row before updating to build 10).
    const sqlite = openDbBeforeUnitsSplit();
    sqlite
      .prepare("INSERT INTO user_profile (units) VALUES ('imperial')")
      .run();

    // Apply the REAL committed 0005 migration file — the exact ALTER+UPDATE statements
    // that will ship in build 10.
    applyMigrationFile(sqlite, UNITS_SPLIT_TAG);

    const row = sqlite
      .prepare('SELECT lifts_units, bodyweight_units, run_units FROM user_profile')
      .get() as { lifts_units: string; bodyweight_units: string; run_units: string };

    expect(row.lifts_units).toBe('imperial');
    expect(row.bodyweight_units).toBe('imperial');
    expect(row.run_units).toBe('imperial');

    sqlite.close();
  });

  it('a row written directly with mixed buckets (imperial lifts, metric runs) round-trips exactly (D-01 beta case)', () => {
    const { db } = harness;

    db.insert(userProfile)
      .values({
        sex: 'male',
        bodyweightKg: 82,
        units: 'imperial',
        liftsUnits: 'imperial',
        bodyweightUnits: 'imperial',
        runUnits: 'metric',
      })
      .run();

    const readBack = db.select().from(userProfile).get();
    expect(readBack).toMatchObject({
      liftsUnits: 'imperial',
      bodyweightUnits: 'imperial',
      runUnits: 'metric',
    });
  });

  it('food.last_used_unit round-trips and defaults to NULL', () => {
    const { db } = harness;

    db.insert(food)
      .values({
        id: 'food-units-1',
        name: 'Peanut butter',
        source: 'user',
        kcalPer100g: 588,
        proteinGPer100g: 25,
        carbGPer100g: 20,
        fatGPer100g: 50,
      })
      .run();

    const inserted = db.select().from(food).where(eq(food.id, 'food-units-1')).get();
    expect(inserted?.lastUsedUnit).toBeNull();

    db.update(food).set({ lastUsedUnit: 'oz' }).where(eq(food.id, 'food-units-1')).run();
    const updated = db.select().from(food).where(eq(food.id, 'food-units-1')).get();
    expect(updated?.lastUsedUnit).toBe('oz');
  });
});
