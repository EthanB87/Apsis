/**
 * apps/mobile/lib/__tests__/logFood.test.ts
 *
 * Coverage for the freeze-at-log-time row builders (07-RESEARCH.md Pattern 2, Pitfall 7 /
 * T-07-12): macros compute correctly at an arbitrary qty, quick-add rows carry no food
 * reference, and every numeric input clamps to a safe zero rather than ever producing NaN.
 */

import { describe, expect, it } from 'vitest';
import { buildFoodLogRow, buildQuickAddRow, type BuildFoodLogRowInput } from '../logFood';

const baseFood: BuildFoodLogRowInput['food'] = {
  id: 'food-1',
  kcalPer100g: 200,
  proteinGPer100g: 20,
  carbGPer100g: 10,
  fatGPer100g: 5,
};

describe('buildFoodLogRow', () => {
  it('a 150g food at 200 kcal/100g logs 300 kcal', () => {
    const row = buildFoodLogRow({
      food: baseFood,
      qtyGrams: 150,
      meal: 'lunch',
      localDate: '2026-07-13',
    });
    expect(row.kcal).toBe(300);
    expect(row.p).toBe(30);
    expect(row.c).toBe(15);
    expect(row.f).toBe(8); // 5 * 1.5 = 7.5, rounds to 8
  });

  it('freezes foodId, meal, and localDate onto the row and sets quickAdd false', () => {
    const row = buildFoodLogRow({
      food: baseFood,
      qtyGrams: 100,
      meal: 'breakfast',
      localDate: '2026-07-13',
    });
    expect(row.foodId).toBe('food-1');
    expect(row.meal).toBe('breakfast');
    expect(row.localDate).toBe('2026-07-13');
    expect(row.quickAdd).toBe(false);
  });

  it('a 0g qty yields a zero-macro row without throwing', () => {
    const row = buildFoodLogRow({
      food: baseFood,
      qtyGrams: 0,
      meal: 'snack',
      localDate: '2026-07-13',
    });
    expect(row.qtyGrams).toBe(0);
    expect(row.kcal).toBe(0);
    expect(row.p).toBe(0);
    expect(row.c).toBe(0);
    expect(row.f).toBe(0);
  });

  it('a negative qty clamps to a zero-macro row without throwing', () => {
    const row = buildFoodLogRow({
      food: baseFood,
      qtyGrams: -50,
      meal: 'snack',
      localDate: '2026-07-13',
    });
    expect(row.qtyGrams).toBe(0);
    expect(row.kcal).toBe(0);
  });

  it('a NaN qty clamps to a zero-macro row without throwing', () => {
    expect(() =>
      buildFoodLogRow({
        food: baseFood,
        qtyGrams: Number.NaN,
        meal: 'snack',
        localDate: '2026-07-13',
      })
    ).not.toThrow();
    const row = buildFoodLogRow({
      food: baseFood,
      qtyGrams: Number.NaN,
      meal: 'snack',
      localDate: '2026-07-13',
    });
    expect(row.qtyGrams).toBe(0);
    expect(row.kcal).toBe(0);
  });

  it('missing/non-finite per-100g macros clamp to 0 rather than producing NaN', () => {
    const row = buildFoodLogRow({
      food: {
        id: 'food-2',
        kcalPer100g: Number.NaN,
        proteinGPer100g: -5,
        carbGPer100g: Number.POSITIVE_INFINITY,
        fatGPer100g: 5,
      },
      qtyGrams: 100,
      meal: 'dinner',
      localDate: '2026-07-13',
    });
    expect(row.kcal).toBe(0);
    expect(row.p).toBe(0);
    expect(row.c).toBe(0);
    expect(row.f).toBe(5);
    expect(Number.isNaN(row.kcal)).toBe(false);
    expect(Number.isNaN(row.c)).toBe(false);
  });
});

describe('buildQuickAddRow', () => {
  it('yields foodId null and quickAdd true', () => {
    const row = buildQuickAddRow({ kcal: 250, p: 20, c: 15, f: 8, meal: 'snack', localDate: '2026-07-13' });
    expect(row.foodId).toBeNull();
    expect(row.quickAdd).toBe(true);
    expect(row.qtyGrams).toBe(0);
    expect(row.kcal).toBe(250);
    expect(row.p).toBe(20);
    expect(row.c).toBe(15);
    expect(row.f).toBe(8);
  });

  it('freezes meal and localDate', () => {
    const row = buildQuickAddRow({ kcal: 100, p: 5, c: 5, f: 5, meal: 'breakfast', localDate: '2026-07-14' });
    expect(row.meal).toBe('breakfast');
    expect(row.localDate).toBe('2026-07-14');
  });

  it('negative or NaN macros clamp to 0 without throwing', () => {
    const row = buildQuickAddRow({
      kcal: -100,
      p: Number.NaN,
      c: Number.POSITIVE_INFINITY,
      f: 5,
      meal: 'snack',
      localDate: '2026-07-13',
    });
    expect(row.kcal).toBe(0);
    expect(row.p).toBe(0);
    expect(row.c).toBe(0);
    expect(row.f).toBe(5);
  });
});
