/**
 * @apsis/db — nutrition query builders (NUTR-02/04/07/08/13/14/17)
 *
 * Parameterized drizzle query-builder factories for the local-first food cache (search,
 * barcode lookup, recents, favorites), the joinless day-totals aggregate, the day-type session
 * query, and recipe CRUD + per-serving macro aggregation — mirroring queries.ts's
 * builder-factory shapes exactly (`previousSessionSet`, `recentExerciseIds`,
 * `sessionCountsByDate`).
 *
 * Security (T-1-01/T-07-05): every builder here uses drizzle's parameterized query API
 * exclusively — search text is always bound as a `like()` value, never interpolated into a
 * raw `sql` template. The only `sql` fragments below are static column/aggregate references
 * (`max`, `count`, `sum`, `coalesce`) — no function parameter is ever spliced into a `sql`
 * template literal.
 */

import { and, desc, eq, isNotNull, like, or, sql } from 'drizzle-orm';
import { activeWorkoutFilter, type QueryableDB } from './queries';
import { food, foodLog, recipe, recipeIngredient, workout } from './schema';

// ---------------------------------------------------------------------------
// Food cache search (NUTR-02)
// ---------------------------------------------------------------------------

/**
 * Case-insensitive substring match against `food.name`/`food.brand` — the local-first
 * search source (NUTR-02) that always runs before any network lookup (RESEARCH Pattern:
 * `searchFoods` composition sketch). `query` is bound as a `like()` parameter value, never
 * interpolated into a raw sql string (T-07-05) — SQLite's LIKE is ASCII case-insensitive by
 * default, matching the "case-insensitive" requirement with no extra collation needed.
 */
export function searchLocalFoods(db: QueryableDB, query: string, limit = 20) {
  const pattern = `%${query}%`;
  return db
    .select()
    .from(food)
    .where(or(like(food.name, pattern), like(food.brand, pattern)))
    .orderBy(food.name)
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Barcode lookup (NUTR-08 — 07-08-PLAN.md Task 2, Rule 2 deviation: added outside this
// plan's declared files_modified since the barcode chain's local-cache step depends on it)
// ---------------------------------------------------------------------------

/**
 * Exact match against `food.barcode` — the instant, offline first step of the barcode scan
 * chain (07-RESEARCH.md Barcode Scan Flow: "local `food` WHERE barcode=?", tried before any
 * OFF network call). `barcode` is bound as an `eq()` parameter, never interpolated (T-1-01).
 * `food.barcode` is not declared unique in the schema, but the app only ever upserts one row
 * per barcode via the OFF cache-through path (a local hit always short-circuits before a
 * second row for the same code could be created) — `limit(1)` is a defensive cap, not a
 * correctness assumption.
 */
export function findFoodByBarcode(db: QueryableDB, barcode: string) {
  return db.select().from(food).where(eq(food.barcode, barcode)).limit(1);
}

// ---------------------------------------------------------------------------
// Recents (NUTR-04)
// ---------------------------------------------------------------------------

/**
 * Distinct foods logged most recently, most recent first — mirrors `recentExerciseIds`'s
 * grouped-max shape (queries.ts). Quick-add `food_log` rows (`foodId` null) carry no food
 * to recommend and are excluded by the inner join.
 */
export function recentFoods(db: QueryableDB, limit: number) {
  return db
    .select({
      id: food.id,
      name: food.name,
      brand: food.brand,
      kcalPer100g: food.kcalPer100g,
      proteinGPer100g: food.proteinGPer100g,
      carbGPer100g: food.carbGPer100g,
      fatGPer100g: food.fatGPer100g,
      servingName: food.servingName,
      servingGrams: food.servingGrams,
      lastLoggedAt: sql<number>`max(${foodLog.createdAt})`.as('lastLoggedAt'),
    })
    .from(foodLog)
    .innerJoin(food, eq(foodLog.foodId, food.id))
    .groupBy(food.id)
    .orderBy(desc(sql`max(${foodLog.createdAt})`))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Favorites (NUTR-04 — the "≤3-tap repeat" source)
// ---------------------------------------------------------------------------

/**
 * Most-frequently-logged foods, highest count first — the repeat-food quick-pick source
 * (NUTR-04's "≤3-tap repeat" bar). Same grouped-aggregate shape as `recentFoods`, ordered by
 * `count(*)` instead of `max(created_at)`.
 */
export function favoriteFoods(db: QueryableDB, limit: number) {
  return db
    .select({
      id: food.id,
      name: food.name,
      brand: food.brand,
      kcalPer100g: food.kcalPer100g,
      proteinGPer100g: food.proteinGPer100g,
      carbGPer100g: food.carbGPer100g,
      fatGPer100g: food.fatGPer100g,
      servingName: food.servingName,
      servingGrams: food.servingGrams,
      logCount: sql<number>`count(*)`.as('logCount'),
    })
    .from(foodLog)
    .innerJoin(food, eq(foodLog.foodId, food.id))
    .groupBy(food.id)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Day totals (NUTR-07 — joinless per RESEARCH Pattern 2)
// ---------------------------------------------------------------------------

/**
 * `SUM(kcal/p/c/f)` over `food_log` for a single `localDate` — no join required, since
 * `food_log`'s macros are denormalized/frozen at log time (RESEARCH Pattern 2). `coalesce`
 * guards the empty-date case: SQLite's `sum()` over zero matching rows returns `NULL`, which
 * would otherwise surface as `NaN`/`null` totals on a rest day with nothing logged yet.
 */
export function dayTotals(db: QueryableDB, localDate: string) {
  return db
    .select({
      kcal: sql<number>`coalesce(sum(${foodLog.kcal}), 0)`.as('kcal'),
      p: sql<number>`coalesce(sum(${foodLog.p}), 0)`.as('p'),
      c: sql<number>`coalesce(sum(${foodLog.c}), 0)`.as('c'),
      f: sql<number>`coalesce(sum(${foodLog.f}), 0)`.as('f'),
    })
    .from(foodLog)
    .where(eq(foodLog.localDate, localDate));
}

// ---------------------------------------------------------------------------
// Day-type session query (NUTR-17, RESEARCH Pattern 3)
// ---------------------------------------------------------------------------

/**
 * Session types logged on `localDate` for finished, non-deleted workouts — the caller maps
 * rows to a `string[]` and folds it through `@apsis/engine`'s `classifyDayType` (never
 * re-implemented here). Reuses `activeWorkoutFilter` (queries.ts, D-28) rather than
 * hand-rolling its own `isNull(workout.deletedAt)`.
 */
export function sessionTypesForDate(db: QueryableDB, localDate: string) {
  return db
    .select({ type: workout.type })
    .from(workout)
    .where(
      and(eq(workout.localDate, localDate), isNotNull(workout.finishedAt), activeWorkoutFilter),
    );
}

// ---------------------------------------------------------------------------
// Recipes (NUTR-13/14)
// ---------------------------------------------------------------------------

export interface CreateRecipeInput {
  id: string;
  name: string;
  servings: number;
}

/**
 * Insert-builder for a new `recipe` row — mirrors `softDeleteWorkout`'s unexecuted-builder
 * shape (queries.ts): the caller `await`s this directly, `id` is assigned by the caller via
 * the platform random-UUID helper (matches `workout`/`strengthSet`/`food` insert convention).
 */
export function createRecipe(db: QueryableDB, input: CreateRecipeInput) {
  return db.insert(recipe).values({ id: input.id, name: input.name, servings: input.servings });
}

export interface AddRecipeIngredientInput {
  id: string;
  recipeId: string;
  foodId: string;
  qtyGrams: number;
}

/**
 * Insert-builder for a `recipe_ingredient` row. `recipeId` cascades on the owning recipe's
 * delete (schema onDelete cascade, 07-01); `foodId` does not (mirrors `strengthSet.exerciseId`
 * — a food is never deleted by deleting a recipe).
 */
export function addRecipeIngredient(db: QueryableDB, input: AddRecipeIngredientInput) {
  return db.insert(recipeIngredient).values({
    id: input.id,
    recipeId: input.recipeId,
    foodId: input.foodId,
    qtyGrams: input.qtyGrams,
  });
}

/** All saved recipes, alphabetical — the recipes list screen's source. */
export function listRecipes(db: QueryableDB) {
  return db.select().from(recipe).orderBy(recipe.name);
}

export interface RecipeServingMacros {
  kcal: number;
  p: number;
  c: number;
  f: number;
}

/**
 * Per-serving macro aggregation for a recipe (NUTR-13, 07-RESEARCH.md "Recipe Per-Serving
 * Macro Aggregation"): inner-joins `recipe_ingredient` -> `food`, sums each ingredient's
 * `per100g x (qtyGrams / 100)`, then divides the totals by `recipe.servings`.
 *
 * Unlike every other builder in this file, this is an executing function (not an unexecuted
 * query builder) — it needs two sequential reads (ingredients, then the recipe's own
 * `servings`) folded into one computed result, mirroring the RESEARCH sketch exactly. The
 * exported signature is deliberately not declared `async` itself (it delegates to an internal
 * async helper) so it stays a plain `export function` matching this file's builder-factory
 * convention; it still returns a `Promise` the caller awaits exactly like every other async
 * db call in this codebase.
 *
 * T-07-24 (Tampering/data-integrity, mitigate): `servings` is guarded against <= 0 or
 * non-finite values (treated as 1) so a zero/garbage `servings` value can never divide-by-zero
 * or produce a NaN/Infinity per-serving macro.
 */
export function computeRecipeServingMacros(
  db: QueryableDB,
  recipeId: string,
): Promise<RecipeServingMacros> {
  return computeRecipeServingMacrosAsync(db, recipeId);
}

async function computeRecipeServingMacrosAsync(
  db: QueryableDB,
  recipeId: string,
): Promise<RecipeServingMacros> {
  const ingredients = await db
    .select({
      qtyGrams: recipeIngredient.qtyGrams,
      kcalPer100g: food.kcalPer100g,
      proteinGPer100g: food.proteinGPer100g,
      carbGPer100g: food.carbGPer100g,
      fatGPer100g: food.fatGPer100g,
    })
    .from(recipeIngredient)
    .innerJoin(food, eq(recipeIngredient.foodId, food.id))
    .where(eq(recipeIngredient.recipeId, recipeId));

  const recipeRows = await db
    .select({ servings: recipe.servings })
    .from(recipe)
    .where(eq(recipe.id, recipeId))
    .limit(1);
  const rawServings = recipeRows[0]?.servings;
  const servings = Number.isFinite(rawServings) && (rawServings as number) > 0 ? (rawServings as number) : 1;

  const totals = ingredients.reduce(
    (acc, ing) => {
      const factor = ing.qtyGrams / 100;
      acc.kcal += ing.kcalPer100g * factor;
      acc.p += ing.proteinGPer100g * factor;
      acc.c += ing.carbGPer100g * factor;
      acc.f += ing.fatGPer100g * factor;
      return acc;
    },
    { kcal: 0, p: 0, c: 0, f: 0 },
  );

  return {
    kcal: totals.kcal / servings,
    p: totals.p / servings,
    c: totals.c / servings,
    f: totals.f / servings,
  };
}
