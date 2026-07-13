/**
 * @apsis/db — nutrition query builders (NUTR-02/04/07/17)
 *
 * Parameterized drizzle query-builder factories for the local-first food cache (search,
 * recents, favorites), the joinless day-totals aggregate, and the day-type session query —
 * mirroring queries.ts's builder-factory shapes exactly (`previousSessionSet`,
 * `recentExerciseIds`, `sessionCountsByDate`).
 *
 * Security (T-1-01/T-07-05): every builder here uses drizzle's parameterized query API
 * exclusively — search text is always bound as a `like()` value, never interpolated into a
 * raw `sql` template. The only `sql` fragments below are static column/aggregate references
 * (`max`, `count`, `sum`, `coalesce`) — no function parameter is ever spliced into a `sql`
 * template literal.
 */

import { and, desc, eq, isNotNull, like, or, sql } from 'drizzle-orm';
import { activeWorkoutFilter, type QueryableDB } from './queries';
import { food, foodLog, workout } from './schema';

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
