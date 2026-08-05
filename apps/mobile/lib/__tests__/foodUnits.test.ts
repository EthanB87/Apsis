/**
 * apps/mobile/lib/__tests__/foodUnits.test.ts
 *
 * Coverage for the conditional food-quantity unit availability + qty->grams conversion logic
 * (09-02, D-05/D-06/D-07). tsp/tbsp/serving are ONLY offered when `food.servingGrams` exists —
 * no fabricated water-standard density anywhere (D-06 macro honesty). Every parse path is
 * clamped to a finite non-negative value before use (V5), mirroring `logFood.ts`'s
 * `clampNonNegative` discipline.
 */

import { describe, expect, it } from 'vitest';
import { availableUnitsFor, gramsToDisplayQty, qtyToGrams, type FoodUnitBasis } from '../foodUnits';

const foodWithServing: FoodUnitBasis = { servingGrams: 40, servingName: '1 scoop' };
const foodWithoutServing: FoodUnitBasis = { servingGrams: null, servingName: null };

describe('availableUnitsFor', () => {
  it('always includes g, kg, oz, lb regardless of servingGrams', () => {
    const withoutServing = availableUnitsFor(foodWithoutServing);
    expect(withoutServing).toEqual(expect.arrayContaining(['g', 'kg', 'oz', 'lb']));

    const withServing = availableUnitsFor(foodWithServing);
    expect(withServing).toEqual(expect.arrayContaining(['g', 'kg', 'oz', 'lb']));
  });

  it('excludes tsp, tbsp, and serving when food.servingGrams is null (D-06 no fabricated density)', () => {
    const units = availableUnitsFor(foodWithoutServing);
    expect(units).not.toContain('tsp');
    expect(units).not.toContain('tbsp');
    expect(units).not.toContain('serving');
  });

  it('includes serving, tsp, and tbsp when food.servingGrams is a finite > 0 value (D-07)', () => {
    const units = availableUnitsFor(foodWithServing);
    expect(units).toContain('serving');
    expect(units).toContain('tsp');
    expect(units).toContain('tbsp');
  });

  it('excludes tsp/tbsp/serving when servingGrams is 0, NaN, or negative', () => {
    expect(availableUnitsFor({ servingGrams: 0, servingName: null })).not.toContain('serving');
    expect(availableUnitsFor({ servingGrams: Number.NaN, servingName: null })).not.toContain('serving');
    expect(availableUnitsFor({ servingGrams: -10, servingName: null })).not.toContain('serving');
  });
});

describe('qtyToGrams — fixed-factor units', () => {
  it('g: qty passes through unchanged', () => {
    expect(qtyToGrams(150, 'g', foodWithoutServing)).toBe(150);
  });

  it('kg: qty * 1000', () => {
    expect(qtyToGrams(0.5, 'kg', foodWithoutServing)).toBe(500);
  });

  it('oz: uses ozToGramsExact (whole-oz round-trip precision)', () => {
    const grams = qtyToGrams(4, 'oz', foodWithoutServing);
    expect(Number.isFinite(grams)).toBe(true);
    expect(grams).toBeGreaterThan(113);
    expect(grams).toBeLessThan(114);
  });

  it('lb: uses lbToGramsExact', () => {
    const grams = qtyToGrams(1, 'lb', foodWithoutServing);
    expect(Number.isFinite(grams)).toBe(true);
    expect(grams).toBeGreaterThan(453);
    expect(grams).toBeLessThan(454);
  });
});

describe('qtyToGrams — conditional serving-basis units (D-07)', () => {
  it("qtyToGrams(2, 'serving', food) === 2 * food.servingGrams", () => {
    expect(qtyToGrams(2, 'serving', foodWithServing)).toBe(80);
  });

  it('serving on a food without servingGrams returns a safe 0, never NaN', () => {
    const grams = qtyToGrams(2, 'serving', foodWithoutServing);
    expect(Number.isNaN(grams)).toBe(false);
    expect(grams).toBe(0);
  });

  it('tsp on a food WITH servingGrams derives from the serving basis, never a hardcoded water constant', () => {
    const grams = qtyToGrams(1, 'tsp', foodWithServing);
    expect(Number.isFinite(grams)).toBe(true);
    expect(grams).toBeGreaterThan(0);
    // Must NOT equal the fabricated water-standard tsp constant (4.92892 g/tsp for water)
    expect(grams).not.toBeCloseTo(4.92892, 2);
  });

  it('tbsp on a food WITH servingGrams derives from the serving basis, never a hardcoded water constant', () => {
    const grams = qtyToGrams(1, 'tbsp', foodWithServing);
    expect(Number.isFinite(grams)).toBe(true);
    expect(grams).toBeGreaterThan(0);
    // Must NOT equal the fabricated water-standard tbsp constant (14.7868 g/tbsp for water)
    expect(grams).not.toBeCloseTo(14.7868, 2);
  });

  it('tsp/tbsp called directly on a food lacking servingGrams returns a safe 0/guard, not a fabricated density result', () => {
    expect(qtyToGrams(1, 'tsp', foodWithoutServing)).toBe(0);
    expect(qtyToGrams(1, 'tbsp', foodWithoutServing)).toBe(0);
  });
});

describe('qtyToGrams — input validation (V5, mirrors clampNonNegative)', () => {
  it('a NaN qty never returns NaN from qtyToGrams', () => {
    expect(Number.isNaN(qtyToGrams(Number.NaN, 'g', foodWithoutServing))).toBe(false);
    expect(qtyToGrams(Number.NaN, 'g', foodWithoutServing)).toBe(0);
  });

  it('a negative qty never returns NaN and clamps to 0', () => {
    expect(Number.isNaN(qtyToGrams(-50, 'g', foodWithoutServing))).toBe(false);
    expect(qtyToGrams(-50, 'g', foodWithoutServing)).toBe(0);
  });

  it('a negative qty in oz/lb/serving units also clamps to 0, never NaN', () => {
    expect(qtyToGrams(-1, 'oz', foodWithoutServing)).toBe(0);
    expect(qtyToGrams(-1, 'lb', foodWithoutServing)).toBe(0);
    expect(qtyToGrams(-1, 'serving', foodWithServing)).toBe(0);
  });

  it('Infinity qty never propagates as a non-finite grams value', () => {
    expect(Number.isFinite(qtyToGrams(Number.POSITIVE_INFINITY, 'g', foodWithoutServing))).toBe(true);
  });
});

describe('gramsToDisplayQty — inverse of qtyToGrams for the selected unit', () => {
  it('reinterprets stored grams in the currently selected unit (g)', () => {
    expect(gramsToDisplayQty(150, 'g', foodWithoutServing)).toBe(150);
  });

  it('reinterprets stored grams in kg', () => {
    expect(gramsToDisplayQty(500, 'kg', foodWithoutServing)).toBe(0.5);
  });

  it('reinterprets stored grams in serving units using the food basis', () => {
    expect(gramsToDisplayQty(80, 'serving', foodWithServing)).toBe(2);
  });

  it('never returns NaN even with a missing basis', () => {
    expect(Number.isNaN(gramsToDisplayQty(80, 'serving', foodWithoutServing))).toBe(false);
  });
});
