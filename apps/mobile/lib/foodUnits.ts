/**
 * apps/mobile/lib/foodUnits.ts
 *
 * Conditional food-quantity unit availability + qty<->grams conversion (09-02,
 * D-05/D-06/D-07). g/kg/oz/lb are always available; tsp, tbsp, and serving are ONLY
 * offered when the specific food carries a real `servingGrams` basis — there is NO
 * fabricated water-standard density table anywhere in this module (D-06 "macro honesty
 * over convenience"). Storage stays grams everywhere; this module is display/entry-only.
 *
 * This module needs a `food`-shaped input (unlike `packages/shared/src/units.ts`'s pure
 * fixed-factor constants), so it lives in `apps/mobile/lib/`, not `packages/shared/`
 * (09-RESEARCH.md Pattern 3).
 *
 * tsp/tbsp derivation: per RESEARCH.md Pattern 3, the conversion is `qty * food.servingGrams`
 * scaled by the food's OWN serving basis, never a universal constant. tbsp anchors directly to
 * one `servingGrams` unit; tsp is a third of that (1 tbsp = 3 tsp is a pure volume-to-volume
 * fact, not a density claim) — every food's tsp/tbsp gram size scales with ITS OWN
 * `servingGrams`, so two different foods with different `servingGrams` never share a tsp/tbsp
 * gram value the way a universal water-density table would produce.
 */

import { gramsToDisplayLb, gramsToDisplayOz, lbToGramsExact, ozToGramsExact } from '@apsis/shared';

export type FoodQtyUnit = 'g' | 'kg' | 'oz' | 'lb' | 'tsp' | 'tbsp' | 'serving';

/** The subset of a `food` row this module needs — the serving-data basis for conditional units. */
export interface FoodUnitBasis {
  servingGrams: number | null;
  servingName: string | null;
}

const FIXED_UNITS: readonly FoodQtyUnit[] = ['g', 'kg', 'oz', 'lb'];
const CONDITIONAL_UNITS: readonly FoodQtyUnit[] = ['tsp', 'tbsp', 'serving'];

/** True iff `food.servingGrams` is a finite, positive number the conditional units can key off. */
function hasServingBasis(food: FoodUnitBasis): boolean {
  return Number.isFinite(food.servingGrams) && (food.servingGrams as number) > 0;
}

/**
 * Which quantity units this food supports. g/kg/oz/lb are always available; tsp, tbsp, and
 * serving are ONLY available when `food.servingGrams` is a finite positive value (D-06/D-07,
 * "same conditional-availability mechanism" per D-07) — with no servingGrams, none of the
 * three conditional units are offered.
 */
export function availableUnitsFor(food: FoodUnitBasis): FoodQtyUnit[] {
  if (!hasServingBasis(food)) return [...FIXED_UNITS];
  return [...FIXED_UNITS, ...CONDITIONAL_UNITS];
}

/** Never NaN/negative: a non-finite or negative input clamps to 0 (V5, mirrors logFood.ts's clampNonNegative). */
function clampNonNegative(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

/** Grams represented by one tbsp of THIS food, anchored to its own servingGrams (0 if no basis). */
function gramsPerTbsp(food: FoodUnitBasis): number {
  return hasServingBasis(food) ? (food.servingGrams as number) : 0;
}

/** Grams represented by one tsp of THIS food — a third of its tbsp basis (0 if no basis). */
function gramsPerTsp(food: FoodUnitBasis): number {
  return hasServingBasis(food) ? (food.servingGrams as number) / 3 : 0;
}

/**
 * Convert a quantity typed in `unit` to storage grams. Fixed-factor units (g/kg/oz/lb) always
 * convert; conditional units (tsp/tbsp/serving) convert only when the food carries a usable
 * `servingGrams` basis — calling with a conditional unit on a food lacking one is unreachable
 * via `availableUnitsFor`, but if called directly it returns a safe 0, never a fabricated
 * density result (D-06). Every input is clamped to finite non-negative before arithmetic (V5).
 */
export function qtyToGrams(qty: number, unit: FoodQtyUnit, food: FoodUnitBasis): number {
  const safeQty = clampNonNegative(qty);
  switch (unit) {
    case 'g':
      return safeQty;
    case 'kg':
      return safeQty * 1000;
    case 'oz':
      return ozToGramsExact(safeQty);
    case 'lb':
      return lbToGramsExact(safeQty);
    case 'serving':
      return hasServingBasis(food) ? safeQty * (food.servingGrams as number) : 0;
    case 'tbsp':
      return safeQty * gramsPerTbsp(food);
    case 'tsp':
      return safeQty * gramsPerTsp(food);
    default:
      return 0;
  }
}

/**
 * Inverse of `qtyToGrams`: reinterprets a stored grams value as a display quantity in `unit`
 * (D-08 "typed number reinterprets in the selected unit" when the chip selection changes).
 * Never returns NaN, even for a conditional unit on a food lacking a serving basis (returns 0).
 */
export function gramsToDisplayQty(grams: number, unit: FoodQtyUnit, food: FoodUnitBasis): number {
  const safeGrams = clampNonNegative(grams);
  switch (unit) {
    case 'g':
      return safeGrams;
    case 'kg':
      return safeGrams / 1000;
    case 'oz':
      return gramsToDisplayOz(safeGrams);
    case 'lb':
      return gramsToDisplayLb(safeGrams);
    case 'serving': {
      const basis = hasServingBasis(food) ? (food.servingGrams as number) : 0;
      return basis > 0 ? safeGrams / basis : 0;
    }
    case 'tbsp': {
      const basis = gramsPerTbsp(food);
      return basis > 0 ? safeGrams / basis : 0;
    }
    case 'tsp': {
      const basis = gramsPerTsp(food);
      return basis > 0 ? safeGrams / basis : 0;
    }
    default:
      return 0;
  }
}
