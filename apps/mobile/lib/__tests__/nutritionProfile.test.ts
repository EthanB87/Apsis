/**
 * apps/mobile/lib/__tests__/nutritionProfile.test.ts
 *
 * Coverage for the NUTR-15/NUTR-20 profile assembler: a complete row builds a typed profile
 * with derived age; any missing field returns `null` rather than a fabricated `0`-coerced
 * value (RESEARCH.md Pitfall 3, T-07-07).
 */

import { describe, expect, it } from 'vitest';
import { buildNutritionProfile, isNutritionProfileComplete, type NutritionProfileRow } from '../nutritionProfile';

const completeRow: NutritionProfileRow = {
  sex: 'male',
  bodyweightKg: 82,
  heightCm: 180,
  birthYear: 1990,
  goalMode: 'maintain',
};

describe('isNutritionProfileComplete', () => {
  it('is true when all five fields are present', () => {
    expect(isNutritionProfileComplete(completeRow)).toBe(true);
  });

  it('is false when any single field is null', () => {
    expect(isNutritionProfileComplete({ ...completeRow, sex: null })).toBe(false);
    expect(isNutritionProfileComplete({ ...completeRow, bodyweightKg: null })).toBe(false);
    expect(isNutritionProfileComplete({ ...completeRow, heightCm: null })).toBe(false);
    expect(isNutritionProfileComplete({ ...completeRow, birthYear: null })).toBe(false);
    expect(isNutritionProfileComplete({ ...completeRow, goalMode: null })).toBe(false);
  });
});

describe('buildNutritionProfile', () => {
  it('builds a correct profile with derived age from a complete row', () => {
    const profile = buildNutritionProfile(completeRow, 2026);
    expect(profile).toEqual({
      sex: 'male',
      bodyweightKg: 82,
      heightCm: 180,
      age: 36,
      goalMode: 'maintain',
    });
  });

  it('returns null when heightCm is missing (never coerces NULL to 0)', () => {
    expect(buildNutritionProfile({ ...completeRow, heightCm: null }, 2026)).toBeNull();
  });

  it('returns null when goalMode is missing', () => {
    expect(buildNutritionProfile({ ...completeRow, goalMode: null }, 2026)).toBeNull();
  });

  it('returns null when birthYear is missing', () => {
    expect(buildNutritionProfile({ ...completeRow, birthYear: null }, 2026)).toBeNull();
  });

  it('returns null when sex or bodyweightKg is missing', () => {
    expect(buildNutritionProfile({ ...completeRow, sex: null }, 2026)).toBeNull();
    expect(buildNutritionProfile({ ...completeRow, bodyweightKg: null }, 2026)).toBeNull();
  });
});
