/**
 * nutrition-queries.test.ts — NUTR-02/04/07/17 local-first query-builder tests (07-03-PLAN.md
 * Task 1) + pure `computeNutritionTargetRow` tests (Task 2).
 *
 * Reuses nutrition-schema.test.ts's real in-memory better-sqlite3 harness (applying the
 * committed drizzle migrations in journal order) rather than the sqlite-proxy `.toSQL()`
 * shape-assertion pattern used elsewhere in this package — `dayTotals`/`recentFoods`/
 * `favoriteFoods`/`searchLocalFoods` need actual aggregate/ordering *results*, not just SQL
 * shape, to prove correctness. better-sqlite3 is a devDependency of @apsis/db only.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../schema';
import { food, foodLog, workout } from '../schema';
import {
  searchLocalFoods,
  recentFoods,
  favoriteFoods,
  dayTotals,
  sessionTypesForDate,
  createRecipe,
  addRecipeIngredient,
  listRecipes,
  computeRecipeServingMacros,
} from '../nutritionQueries';
import { recipe, recipeIngredient } from '../schema';
import { computeNutritionTargetRow } from '../nutritionTarget';
import type { NutritionProfile } from '@apsis/shared';

const DRIZZLE_DIR = path.resolve(__dirname, '../../drizzle');

interface JournalEntry {
  idx: number;
  tag: string;
}

/** Apply every committed migration .sql file in journal order — mirrors useMigrations(). */
function applyCommittedMigrations(sqlite: Database.Database): void {
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
}

function openMigratedDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  applyCommittedMigrations(sqlite);
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

const BASE_FOOD = {
  source: 'user' as const,
  kcalPer100g: 100,
  proteinGPer100g: 10,
  carbGPer100g: 10,
  fatGPer100g: 5,
};

describe('searchLocalFoods', () => {
  let harness: ReturnType<typeof openMigratedDb>;
  beforeEach(() => {
    harness = openMigratedDb();
  });
  afterEach(() => {
    harness.sqlite.close();
  });

  it('matches by substring in name (case-insensitive)', () => {
    const { db } = harness;
    db.insert(food)
      .values([
        { id: 'f1', name: 'Chicken breast', ...BASE_FOOD },
        { id: 'f2', name: 'Rice', ...BASE_FOOD },
      ])
      .run();

    const results = searchLocalFoods(db, 'CHICK').all();
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('f1');
  });

  it('matches by substring in brand', () => {
    const { db } = harness;
    db.insert(food)
      .values({ id: 'f1', name: 'Protein bar', brand: 'Quest', ...BASE_FOOD })
      .run();

    const results = searchLocalFoods(db, 'quest').all();
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('f1');
  });

  it('orders results by name', () => {
    const { db } = harness;
    db.insert(food)
      .values([
        { id: 'f1', name: 'Zucchini bread', ...BASE_FOOD },
        { id: 'f2', name: 'Apple pie', ...BASE_FOOD },
      ])
      .run();

    const results = searchLocalFoods(db, 'e').all();
    expect(results.map((r) => r.id)).toEqual(['f2', 'f1']);
  });

  it('finds a food whose name contains % and \' characters, without error (parameterization proof)', () => {
    const { db } = harness;
    db.insert(food)
      .values({ id: 'f1', name: "Ben & Jerry's 100% Vanilla", ...BASE_FOOD })
      .run();

    expect(() => searchLocalFoods(db, "Jerry's 100%").all()).not.toThrow();
    const results = searchLocalFoods(db, "Jerry's 100%").all();
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('f1');
  });
});

describe('recentFoods', () => {
  let harness: ReturnType<typeof openMigratedDb>;
  beforeEach(() => {
    harness = openMigratedDb();
  });
  afterEach(() => {
    harness.sqlite.close();
  });

  it('returns distinct foods ordered by most-recently-logged first', () => {
    const { db } = harness;
    db.insert(food)
      .values([
        { id: 'f1', name: 'Oats', ...BASE_FOOD },
        { id: 'f2', name: 'Eggs', ...BASE_FOOD },
      ])
      .run();

    db.insert(foodLog)
      .values([
        {
          id: 'log-1',
          localDate: '2026-07-10',
          meal: 'breakfast',
          foodId: 'f1',
          qtyGrams: 50,
          kcal: 50,
          p: 5,
          c: 5,
          f: 2.5,
          createdAt: new Date('2026-07-10T08:00:00Z'),
        },
        {
          id: 'log-2',
          localDate: '2026-07-11',
          meal: 'breakfast',
          foodId: 'f2',
          qtyGrams: 100,
          kcal: 100,
          p: 10,
          c: 10,
          f: 5,
          createdAt: new Date('2026-07-11T08:00:00Z'),
        },
      ])
      .run();

    const results = recentFoods(db, 10).all();
    expect(results.map((r) => r.id)).toEqual(['f2', 'f1']);
  });

  it('excludes quick-add rows (null foodId) via the inner join', () => {
    const { db } = harness;
    db.insert(foodLog)
      .values({
        id: 'log-qa',
        localDate: '2026-07-10',
        meal: 'snack',
        foodId: null,
        qtyGrams: 0,
        kcal: 200,
        p: 5,
        c: 20,
        f: 8,
        quickAdd: true,
      })
      .run();

    const results = recentFoods(db, 10).all();
    expect(results).toHaveLength(0);
  });
});

describe('favoriteFoods', () => {
  let harness: ReturnType<typeof openMigratedDb>;
  beforeEach(() => {
    harness = openMigratedDb();
  });
  afterEach(() => {
    harness.sqlite.close();
  });

  it('orders foods by log frequency, most-logged first', () => {
    const { db } = harness;
    db.insert(food)
      .values([
        { id: 'f1', name: 'Oats', ...BASE_FOOD },
        { id: 'f2', name: 'Chicken breast', ...BASE_FOOD },
      ])
      .run();

    const logRow = (id: string, foodId: string, localDate: string) => ({
      id,
      localDate,
      meal: 'breakfast' as const,
      foodId,
      qtyGrams: 50,
      kcal: 50,
      p: 5,
      c: 5,
      f: 2.5,
    });

    db.insert(foodLog)
      .values([
        logRow('log-1', 'f1', '2026-07-08'),
        logRow('log-2', 'f1', '2026-07-09'),
        logRow('log-3', 'f1', '2026-07-10'),
        logRow('log-4', 'f2', '2026-07-10'),
      ])
      .run();

    const results = favoriteFoods(db, 10).all();
    expect(results.map((r) => r.id)).toEqual(['f1', 'f2']);
    expect(results[0]?.logCount).toBe(3);
    expect(results[1]?.logCount).toBe(1);
  });
});

describe('dayTotals', () => {
  let harness: ReturnType<typeof openMigratedDb>;
  beforeEach(() => {
    harness = openMigratedDb();
  });
  afterEach(() => {
    harness.sqlite.close();
  });

  it('sums kcal/p/c/f for a date with logged rows', () => {
    const { db } = harness;
    db.insert(foodLog)
      .values([
        {
          id: 'log-1',
          localDate: '2026-07-13',
          meal: 'breakfast',
          foodId: null,
          qtyGrams: 0,
          kcal: 300,
          p: 20,
          c: 30,
          f: 10,
          quickAdd: true,
        },
        {
          id: 'log-2',
          localDate: '2026-07-13',
          meal: 'lunch',
          foodId: null,
          qtyGrams: 0,
          kcal: 500,
          p: 40,
          c: 50,
          f: 15,
          quickAdd: true,
        },
        // Different date — must not be included.
        {
          id: 'log-3',
          localDate: '2026-07-12',
          meal: 'dinner',
          foodId: null,
          qtyGrams: 0,
          kcal: 999,
          p: 99,
          c: 99,
          f: 99,
          quickAdd: true,
        },
      ])
      .run();

    const totals = dayTotals(db, '2026-07-13').get();
    expect(totals).toEqual({ kcal: 800, p: 60, c: 80, f: 25 });
  });

  it('returns zeroed totals (not null/NaN) for a date with no food_log rows', () => {
    const { db } = harness;
    const totals = dayTotals(db, '2026-01-01').get();
    expect(totals).toEqual({ kcal: 0, p: 0, c: 0, f: 0 });
  });
});

describe('sessionTypesForDate', () => {
  let harness: ReturnType<typeof openMigratedDb>;
  beforeEach(() => {
    harness = openMigratedDb();
  });
  afterEach(() => {
    harness.sqlite.close();
  });

  it('returns only finished, non-deleted sessions for the given date', () => {
    const { db } = harness;
    db.insert(workout)
      .values([
        {
          id: 'w1',
          localDate: '2026-07-13',
          type: 'strength',
          finishedAt: new Date('2026-07-13T10:00:00Z'),
        },
        {
          id: 'w2',
          localDate: '2026-07-13',
          type: 'endurance',
          finishedAt: new Date('2026-07-13T18:00:00Z'),
        },
        // Unfinished — excluded.
        { id: 'w3', localDate: '2026-07-13', type: 'strength', finishedAt: null },
        // Soft-deleted — excluded.
        {
          id: 'w4',
          localDate: '2026-07-13',
          type: 'hybrid',
          finishedAt: new Date('2026-07-13T09:00:00Z'),
          deletedAt: new Date('2026-07-13T09:30:00Z'),
        },
        // Different date — excluded.
        {
          id: 'w5',
          localDate: '2026-07-12',
          type: 'strength',
          finishedAt: new Date('2026-07-12T10:00:00Z'),
        },
      ])
      .run();

    const results = sessionTypesForDate(db, '2026-07-13').all();
    expect(results.map((r) => r.type).sort()).toEqual(['endurance', 'strength']);
  });
});

// ---------------------------------------------------------------------------
// Recipes (NUTR-13/14, 07-10-PLAN.md Task 1)
// ---------------------------------------------------------------------------

describe('recipe builders + computeRecipeServingMacros', () => {
  let harness: ReturnType<typeof openMigratedDb>;
  beforeEach(() => {
    harness = openMigratedDb();
  });
  afterEach(() => {
    harness.sqlite.close();
  });

  it('a 2-ingredient recipe with 2 servings computes correct per-serving macros', async () => {
    const { db } = harness;
    db.insert(food)
      .values([
        { id: 'f-a', name: 'Chicken breast', ...BASE_FOOD, kcalPer100g: 200, proteinGPer100g: 20, carbGPer100g: 20, fatGPer100g: 5 },
        { id: 'f-b', name: 'Rice', ...BASE_FOOD, kcalPer100g: 100, proteinGPer100g: 5, carbGPer100g: 10, fatGPer100g: 2 },
      ])
      .run();

    await createRecipe(db, { id: 'r1', name: 'Chicken & rice bowl', servings: 2 });
    await addRecipeIngredient(db, { id: 'ri-1', recipeId: 'r1', foodId: 'f-a', qtyGrams: 150 });
    await addRecipeIngredient(db, { id: 'ri-2', recipeId: 'r1', foodId: 'f-b', qtyGrams: 200 });

    // f-a @150g: 300 kcal / 30 p / 30 c / 7.5 f
    // f-b @200g: 200 kcal / 10 p / 20 c / 4 f
    // totals: 500 kcal / 40 p / 50 c / 11.5 f -> / 2 servings
    const perServing = await computeRecipeServingMacros(db, 'r1');
    expect(perServing).toEqual({ kcal: 250, p: 20, c: 25, f: 5.75 });
  });

  it('listRecipes returns saved recipes alphabetically', async () => {
    const { db } = harness;
    await createRecipe(db, { id: 'r-z', name: 'Zucchini soup', servings: 1 });
    await createRecipe(db, { id: 'r-a', name: 'Apple oat bowl', servings: 1 });

    const results = listRecipes(db).all();
    expect(results.map((r) => r.id)).toEqual(['r-a', 'r-z']);
  });

  it('deleting a recipe cascades its recipe_ingredient rows (07-01 FK cascade)', async () => {
    const { db } = harness;
    db.insert(food).values({ id: 'f-c', name: 'Oats', ...BASE_FOOD }).run();
    await createRecipe(db, { id: 'r2', name: 'Oat bowl', servings: 1 });
    await addRecipeIngredient(db, { id: 'ri-3', recipeId: 'r2', foodId: 'f-c', qtyGrams: 100 });

    const beforeCount = db
      .select()
      .from(recipeIngredient)
      .where(eq(recipeIngredient.recipeId, 'r2'))
      .all();
    expect(beforeCount).toHaveLength(1);

    db.delete(recipe).where(eq(recipe.id, 'r2')).run();

    const afterCount = db
      .select()
      .from(recipeIngredient)
      .where(eq(recipeIngredient.recipeId, 'r2'))
      .all();
    expect(afterCount).toHaveLength(0);
  });

  it('a servings=0 recipe does not divide-by-zero (treated as 1)', async () => {
    const { db } = harness;
    db.insert(food).values({ id: 'f-d', name: 'Peanut butter', ...BASE_FOOD, kcalPer100g: 600, proteinGPer100g: 25, carbGPer100g: 20, fatGPer100g: 50 }).run();
    await createRecipe(db, { id: 'r3', name: 'Zero-servings edge case', servings: 0 });
    await addRecipeIngredient(db, { id: 'ri-4', recipeId: 'r3', foodId: 'f-d', qtyGrams: 100 });

    const perServing = await computeRecipeServingMacros(db, 'r3');
    expect(perServing).toEqual({ kcal: 600, p: 25, c: 20, f: 50 });
    expect(Number.isFinite(perServing.kcal)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeNutritionTargetRow (pure, 07-03-PLAN.md Task 2)
// ---------------------------------------------------------------------------

const PROFILE: NutritionProfile = {
  sex: 'male',
  bodyweightKg: 80,
  heightCm: 180,
  age: 30,
  goalMode: 'maintain',
};

describe('computeNutritionTargetRow', () => {
  it('a rest day (empty sessionTypes, dayHss 0) yields dayType "rest" and a rest-day target', () => {
    const row = computeNutritionTargetRow(PROFILE, [], 0, '2026-07-13');

    expect(row.dayType).toBe('rest');
    expect(row.localDate).toBe('2026-07-13');
    expect(row.source).toBe('auto');
    expect(row.kcal).toBeGreaterThan(0);
    expect(row.proteinG).toBeGreaterThan(0);
  });

  it('a double day (2 session types) yields dayType "double" with additive sessionKcal reflected in kcal', () => {
    const restRow = computeNutritionTargetRow(PROFILE, [], 0, '2026-07-13');
    const doubleRow = computeNutritionTargetRow(
      PROFILE,
      ['strength', 'endurance'],
      150,
      '2026-07-13',
    );

    expect(doubleRow.dayType).toBe('double');
    // Training kcal add (from dayHss > 0) must raise the target above the rest-day baseline.
    expect(doubleRow.kcal).toBeGreaterThan(restRow.kcal);
  });

  it('derives a deterministic id from localDate (so the auto row for a date always upserts to itself)', () => {
    const row1 = computeNutritionTargetRow(PROFILE, [], 0, '2026-07-13');
    const row2 = computeNutritionTargetRow(PROFILE, ['strength'], 50, '2026-07-13');

    expect(row1.id).toBe(row2.id);
    expect(row1.id).toBe('auto-2026-07-13');
  });
});
