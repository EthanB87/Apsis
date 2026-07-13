/**
 * apps/mobile/lib/logFood.ts
 *
 * Pure `food_log` insert-row builders — freeze-at-log-time (07-RESEARCH.md Pattern 2): macros
 * are computed from `food.per100g × qtyGrams` at BUILD time and never recomputed from a live
 * join later (an edited `food` row never retroactively rewrites logged history). Factored out
 * with zero database-package / Expo native imports (mirrors `runEntryLogic.ts`'s
 * vitest-testability discipline) so it is unit-testable under plain vitest. `id`/`createdAt` are
 * intentionally excluded from the returned row shape — the caller (FoodConfirmSheet / log.tsx)
 * assigns those at insert time via the platform's random-UUID helper, exactly like
 * `workout`/`strengthSet` inserts elsewhere in the app (that native import boundary is what this
 * module must stay outside of).
 *
 * Pitfall 7 / T-07-12 (Tampering / data-integrity, mitigate): every numeric input is clamped to
 * a finite, non-negative value BEFORE it's used in a computation — a missing/NaN/negative
 * per-100g macro or a negative/NaN qty never produces a NaN or negative row; it clamps to a
 * zero-macro row instead. The confirm sheet remains the review gate a user actually sees before
 * a row is ever inserted.
 */

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** The subset of a `food` row this builder needs — per-100g macros only. */
export interface FoodPer100g {
  kcalPer100g: number;
  proteinGPer100g: number;
  carbGPer100g: number;
  fatGPer100g: number;
}

/** `food_log` insert row shape, minus `id`/`createdAt` (assigned by the caller at insert time). */
export interface FoodLogRow {
  localDate: string;
  meal: Meal;
  foodId: string | null;
  qtyGrams: number;
  kcal: number;
  p: number;
  c: number;
  f: number;
  quickAdd: boolean;
}

/** Never NaN/negative: a non-finite or negative input clamps to 0 (Pitfall 7 / T-07-12). */
function clampNonNegative(value: number | null | undefined): number {
  return Number.isFinite(value) && (value as number) >= 0 ? (value as number) : 0;
}

export interface BuildFoodLogRowInput {
  food: { id: string } & FoodPer100g;
  qtyGrams: number;
  meal: Meal;
  localDate: string;
}

/**
 * `food.per100g × (qtyGrams / 100)`, frozen onto the row at build time (Pattern 2) — never a
 * live join. Rounds each macro to a sane whole number (matches the day-totals display's own
 * `formatWhole` rounding on the TODAY screen); clamps every input defensively so a malformed
 * food row or a negative/NaN qty can never propagate a NaN into `food_log`.
 */
export function buildFoodLogRow(input: BuildFoodLogRowInput): FoodLogRow {
  const qtyGrams = clampNonNegative(input.qtyGrams);
  const ratio = qtyGrams / 100;
  const kcalPer100g = clampNonNegative(input.food.kcalPer100g);
  const proteinGPer100g = clampNonNegative(input.food.proteinGPer100g);
  const carbGPer100g = clampNonNegative(input.food.carbGPer100g);
  const fatGPer100g = clampNonNegative(input.food.fatGPer100g);

  return {
    localDate: input.localDate,
    meal: input.meal,
    foodId: input.food.id,
    qtyGrams,
    kcal: Math.round(kcalPer100g * ratio),
    p: Math.round(proteinGPer100g * ratio),
    c: Math.round(carbGPer100g * ratio),
    f: Math.round(fatGPer100g * ratio),
    quickAdd: false,
  };
}

export interface BuildQuickAddRowInput {
  kcal: number;
  p: number;
  c: number;
  f: number;
  meal: Meal;
  localDate: string;
}

/** Macro-only quick-add row (NUTR-06): `foodId` null, `quickAdd` true, `qtyGrams` 0. */
export function buildQuickAddRow(input: BuildQuickAddRowInput): FoodLogRow {
  return {
    localDate: input.localDate,
    meal: input.meal,
    foodId: null,
    qtyGrams: 0,
    kcal: Math.round(clampNonNegative(input.kcal)),
    p: Math.round(clampNonNegative(input.p)),
    c: Math.round(clampNonNegative(input.c)),
    f: Math.round(clampNonNegative(input.f)),
    quickAdd: true,
  };
}
