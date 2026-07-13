/**
 * nutrition-schema.test.ts — Phase 07 migration round-trip proof (schema_push_requirement).
 *
 * Unlike the other db tests (sqlite-proxy `.toSQL()` shape assertions / pure functions),
 * this suite applies the COMMITTED drizzle migration .sql files, in journal order, to a
 * real in-memory better-sqlite3 database — the same append-only SQL chain that
 * useMigrations() executes on-device. Typecheck alone cannot prove the tables exist
 * (types come from schema.ts); this test is the proof the 0004 migration is real (T-07-01).
 *
 * better-sqlite3 is a devDependency of @apsis/db ONLY — it is never a runtime dep and
 * never enters the mobile bundle (op-sqlite is the on-device driver).
 *
 * Covers:
 *   - insert + read-back on all 5 new tables (food, food_log, recipe, recipe_ingredient,
 *     nutrition_target) via drizzle query builders
 *   - recipe delete cascades to recipe_ingredient (onDelete: 'cascade')
 *   - food delete does NOT cascade (foodId has no cascade; FK violation instead)
 *   - the 3 new user_profile columns (height_cm, birth_year, goal_mode) accept NULL
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from '../schema';
import { food, foodLog, nutritionTarget, recipe, recipeIngredient, userProfile } from '../schema';

const DRIZZLE_DIR = path.resolve(__dirname, '../../drizzle');

interface JournalEntry {
  idx: number;
  tag: string;
}

/** Apply every committed migration .sql file in journal order — mirrors useMigrations(). */
function applyCommittedMigrations(sqlite: Database.Database): string[] {
  const journal = JSON.parse(
    readFileSync(path.join(DRIZZLE_DIR, 'meta/_journal.json'), 'utf-8'),
  ) as { entries: JournalEntry[] };

  const tags = [...journal.entries].sort((a, b) => a.idx - b.idx).map((e) => e.tag);

  for (const tag of tags) {
    const migrationSql = readFileSync(path.join(DRIZZLE_DIR, `${tag}.sql`), 'utf-8');
    for (const statement of migrationSql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed.length > 0) sqlite.exec(trimmed);
    }
  }

  return tags;
}

function openMigratedDb() {
  const sqlite = new Database(':memory:');
  // client.ts enables FK enforcement at init (`PRAGMA foreign_keys = ON`, WR-01) — SQLite's
  // own default is OFF and op-sqlite does not set it; mirror the client so cascade behavior
  // proven here is the behavior the app actually runs.
  sqlite.pragma('foreign_keys = ON');
  const appliedTags = applyCommittedMigrations(sqlite);
  const db = drizzle(sqlite, { schema });
  return { sqlite, db, appliedTags };
}

describe('nutrition migration round-trip (0004, schema_push_requirement)', () => {
  let harness: ReturnType<typeof openMigratedDb>;

  beforeEach(() => {
    harness = openMigratedDb();
  });

  afterEach(() => {
    harness.sqlite.close();
  });

  it('the committed journal includes 0004 and every migration applies cleanly', () => {
    expect(harness.appliedTags.at(-1)).toBe('0004_youthful_valkyrie');
    expect(harness.appliedTags).toHaveLength(5);

    const tables = harness.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((r) => (r as { name: string }).name);

    for (const t of ['food', 'food_log', 'recipe', 'recipe_ingredient', 'nutrition_target']) {
      expect(tables).toContain(t);
    }
  });

  it('round-trips a food row', () => {
    const { db } = harness;
    const row = {
      id: 'food-1',
      name: 'Chicken breast',
      brand: null,
      barcode: '0123456789012',
      source: 'user' as const,
      kcalPer100g: 165,
      proteinGPer100g: 31,
      carbGPer100g: 0,
      fatGPer100g: 3.6,
      fiberGPer100g: null,
      sodiumMgPer100g: 74,
      servingName: '1 breast',
      servingGrams: 174,
      verified: false,
    };

    db.insert(food).values(row).run();
    const readBack = db.select().from(food).where(eq(food.id, 'food-1')).get();

    expect(readBack).toMatchObject(row);
    expect(readBack?.createdAt).toBeInstanceOf(Date); // default (unixepoch()) fired
  });

  it('round-trips a food_log row (denormalized macros frozen at log time)', () => {
    const { db } = harness;
    db.insert(food)
      .values({
        id: 'food-1',
        name: 'Oats',
        source: 'usda',
        kcalPer100g: 389,
        proteinGPer100g: 16.9,
        carbGPer100g: 66.3,
        fatGPer100g: 6.9,
      })
      .run();

    const row = {
      id: 'log-1',
      localDate: '2026-07-13',
      meal: 'breakfast' as const,
      foodId: 'food-1',
      qtyGrams: 80,
      kcal: 311.2,
      p: 13.52,
      c: 53.04,
      f: 5.52,
      quickAdd: false,
    };

    db.insert(foodLog).values(row).run();
    const readBack = db.select().from(foodLog).where(eq(foodLog.id, 'log-1')).get();

    expect(readBack).toMatchObject(row);
  });

  it('round-trips a quick-add food_log row with NULL foodId', () => {
    const { db } = harness;
    db.insert(foodLog)
      .values({
        id: 'log-qa',
        localDate: '2026-07-13',
        meal: 'snack',
        foodId: null,
        qtyGrams: 0,
        kcal: 250,
        p: 10,
        c: 30,
        f: 8,
        quickAdd: true,
      })
      .run();

    const readBack = db.select().from(foodLog).where(eq(foodLog.id, 'log-qa')).get();
    expect(readBack?.foodId).toBeNull();
    expect(readBack?.quickAdd).toBe(true);
  });

  it('round-trips recipe + recipe_ingredient rows', () => {
    const { db } = harness;
    db.insert(food)
      .values({
        id: 'food-1',
        name: 'Rice',
        source: 'user',
        kcalPer100g: 130,
        proteinGPer100g: 2.7,
        carbGPer100g: 28,
        fatGPer100g: 0.3,
      })
      .run();

    db.insert(recipe).values({ id: 'recipe-1', name: 'Rice bowl', servings: 4 }).run();
    db.insert(recipeIngredient)
      .values({ id: 'ing-1', recipeId: 'recipe-1', foodId: 'food-1', qtyGrams: 400 })
      .run();

    const recipeBack = db.select().from(recipe).where(eq(recipe.id, 'recipe-1')).get();
    expect(recipeBack).toMatchObject({ id: 'recipe-1', name: 'Rice bowl', servings: 4 });

    const ingBack = db
      .select()
      .from(recipeIngredient)
      .where(eq(recipeIngredient.recipeId, 'recipe-1'))
      .all();
    expect(ingBack).toHaveLength(1);
    expect(ingBack[0]).toMatchObject({ id: 'ing-1', foodId: 'food-1', qtyGrams: 400 });
  });

  it('deleting a recipe cascades to its recipe_ingredient rows (onDelete: cascade)', () => {
    const { db } = harness;
    db.insert(food)
      .values({
        id: 'food-1',
        name: 'Rice',
        source: 'user',
        kcalPer100g: 130,
        proteinGPer100g: 2.7,
        carbGPer100g: 28,
        fatGPer100g: 0.3,
      })
      .run();
    db.insert(recipe).values({ id: 'recipe-1', name: 'Rice bowl' }).run();
    db.insert(recipeIngredient)
      .values([
        { id: 'ing-1', recipeId: 'recipe-1', foodId: 'food-1', qtyGrams: 400 },
        { id: 'ing-2', recipeId: 'recipe-1', foodId: 'food-1', qtyGrams: 50 },
      ])
      .run();

    db.delete(recipe).where(eq(recipe.id, 'recipe-1')).run();

    const orphans = db
      .select()
      .from(recipeIngredient)
      .where(eq(recipeIngredient.recipeId, 'recipe-1'))
      .all();
    expect(orphans).toHaveLength(0);

    // The referenced food row is untouched (foodId FK has no cascade).
    const foodStill = db.select().from(food).where(eq(food.id, 'food-1')).get();
    expect(foodStill).toBeDefined();
  });

  it('deleting a food referenced by an ingredient is rejected (no cascade on foodId)', () => {
    const { db } = harness;
    db.insert(food)
      .values({
        id: 'food-1',
        name: 'Rice',
        source: 'user',
        kcalPer100g: 130,
        proteinGPer100g: 2.7,
        carbGPer100g: 28,
        fatGPer100g: 0.3,
      })
      .run();
    db.insert(recipe).values({ id: 'recipe-1', name: 'Rice bowl' }).run();
    db.insert(recipeIngredient)
      .values({ id: 'ing-1', recipeId: 'recipe-1', foodId: 'food-1', qtyGrams: 400 })
      .run();

    expect(() => db.delete(food).where(eq(food.id, 'food-1')).run()).toThrow(
      /FOREIGN KEY constraint failed/,
    );
  });

  it('a recipe-sourced food_log row must carry NULL foodId under FK enforcement (CR-02)', () => {
    const { db } = harness;
    db.insert(recipe).values({ id: 'recipe-1', name: 'Rice bowl', servings: 2 }).run();

    // A recipe id is NOT a `food` row id — freezing it into food_log.foodId violates the
    // food_log.food_id -> food.id FK (this is exactly what the pre-CR-02 recipe path did).
    expect(() =>
      db
        .insert(foodLog)
        .values({
          id: 'log-recipe-bad',
          localDate: '2026-07-13',
          meal: 'dinner',
          foodId: 'recipe-1',
          qtyGrams: 100,
          kcal: 500,
          p: 30,
          c: 50,
          f: 15,
          quickAdd: false,
        })
        .run(),
    ).toThrow(/FOREIGN KEY constraint failed/);

    // The fixed path (logFood.ts `isVirtual`) writes foodId NULL — inserts cleanly with FKs ON.
    db.insert(foodLog)
      .values({
        id: 'log-recipe',
        localDate: '2026-07-13',
        meal: 'dinner',
        foodId: null,
        qtyGrams: 100,
        kcal: 500,
        p: 30,
        c: 50,
        f: 15,
        quickAdd: false,
      })
      .run();

    const readBack = db.select().from(foodLog).where(eq(foodLog.id, 'log-recipe')).get();
    expect(readBack?.foodId).toBeNull();
    expect(readBack?.quickAdd).toBe(false);
  });

  it('round-trips a nutrition_target row', () => {
    const { db } = harness;
    const row = {
      id: 'target-1',
      localDate: '2026-07-13',
      dayType: 'heavy_lift' as const,
      kcal: 3100,
      proteinG: 180,
      carbG: 350,
      fatG: 90,
      source: 'auto' as const,
    };

    db.insert(nutritionTarget).values(row).run();
    const readBack = db
      .select()
      .from(nutritionTarget)
      .where(eq(nutritionTarget.id, 'target-1'))
      .get();

    expect(readBack).toMatchObject(row);
  });

  it('user_profile accepts NULL for height_cm, birth_year, and goal_mode (existing rows keep NULL)', () => {
    const { db } = harness;
    // Insert a pre-Phase-07-shaped row: none of the three new columns supplied.
    db.insert(userProfile).values({ sex: 'male', bodyweightKg: 82 }).run();

    const readBack = db.select().from(userProfile).get();
    expect(readBack?.heightCm).toBeNull();
    expect(readBack?.birthYear).toBeNull();
    expect(readBack?.goalMode).toBeNull();

    // And the columns round-trip real values too.
    db.update(userProfile)
      .set({ heightCm: 183, birthYear: 1994, goalMode: 'cut' })
      .where(eq(userProfile.id, readBack!.id))
      .run();
    const updated = db.select().from(userProfile).get();
    expect(updated).toMatchObject({ heightCm: 183, birthYear: 1994, goalMode: 'cut' });
  });
});
