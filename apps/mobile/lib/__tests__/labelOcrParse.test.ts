/**
 * apps/mobile/lib/__tests__/labelOcrParse.test.ts
 *
 * Fixture-based coverage for `labelOcrParse` (NUTR-11, 07-RESEARCH.md Pitfall 9): a
 * representative US "Nutrition Facts" label extracts the expected kcal/P/C/F/serving; an
 * absurd/negative reading is dropped (bounds-checked, never coerced to 0); garbage/empty input
 * never throws and yields an all-`undefined` result.
 */

import { describe, expect, it } from 'vitest';
import { labelOcrParse } from '../labelOcrParse';

/** Simulates Apple's on-device text recognizer's per-block line output for a typical US
 * "Nutrition Facts" label — including "Calories" and its number as separate OCR blocks, which
 * is common when the number is rendered as a large standalone glyph. */
const REPRESENTATIVE_LABEL_LINES = [
  'Nutrition Facts',
  '8 servings per container',
  'Serving size 1 cup (240g)',
  'Amount per serving',
  'Calories',
  '230',
  '% Daily Value*',
  'Total Fat 8g',
  '10%',
  'Saturated Fat 1g',
  '5%',
  'Trans Fat 0g',
  'Cholesterol 0mg',
  '0%',
  'Sodium 160mg',
  '7%',
  'Total Carbohydrate 37g',
  '13%',
  'Dietary Fiber 4g',
  '14%',
  'Total Sugars 12g',
  'Protein 3g',
];

describe('labelOcrParse', () => {
  it('extracts kcal/P/C/F/serving from a representative label fixture', () => {
    const result = labelOcrParse(REPRESENTATIVE_LABEL_LINES);

    expect(result.kcalPer100g).toBe(230);
    expect(result.proteinGPer100g).toBe(3);
    expect(result.carbGPer100g).toBe(37);
    expect(result.fatGPer100g).toBe(8);
    expect(result.servingName).toBe('1 cup');
    expect(result.servingGrams).toBe(240);
  });

  it('picks Total Fat over Saturated Fat / Trans Fat sub-lines', () => {
    const result = labelOcrParse(['Total Fat 8g', 'Saturated Fat 1g', 'Trans Fat 0g']);
    expect(result.fatGPer100g).toBe(8);
  });

  it('picks Total Carbohydrate over a bare Carbohydrate fallback when both exist', () => {
    const result = labelOcrParse(['Total Carbohydrate 37g']);
    expect(result.carbGPer100g).toBe(37);
  });

  it('drops an absurd calorie reading (>50,000) rather than pre-filling a nonsense value', () => {
    const result = labelOcrParse(['Calories 90000']);
    expect(result.kcalPer100g).toBeUndefined();
  });

  it('drops an absurd macro reading (>2,000g) rather than pre-filling a nonsense value', () => {
    const result = labelOcrParse(['Protein 5000g']);
    expect(result.proteinGPer100g).toBeUndefined();
  });

  it('drops a negative reading rather than coercing it to a positive/zero value', () => {
    const result = labelOcrParse(['Calories -50', 'Protein -3g']);
    expect(result.kcalPer100g).toBeUndefined();
    expect(result.proteinGPer100g).toBeUndefined();
  });

  it('returns an all-undefined result without throwing on garbage/unrelated text', () => {
    expect(() => labelOcrParse(['asdkjh', '###', '', '12345 random noise'])).not.toThrow();
    const result = labelOcrParse(['asdkjh', '###', '', '12345 random noise']);
    expect(result.kcalPer100g).toBeUndefined();
    expect(result.proteinGPer100g).toBeUndefined();
    expect(result.carbGPer100g).toBeUndefined();
    expect(result.fatGPer100g).toBeUndefined();
    expect(result.servingName).toBeUndefined();
    expect(result.servingGrams).toBeUndefined();
  });

  it('returns an all-undefined result without throwing on empty input', () => {
    expect(() => labelOcrParse([])).not.toThrow();
    const result = labelOcrParse([]);
    expect(result.kcalPer100g).toBeUndefined();
    expect(result.servingGrams).toBeUndefined();
  });

  it('extracts a nameless serving size (no parenthetical text before the gram count)', () => {
    const result = labelOcrParse(['Serving size 30g']);
    expect(result.servingName).toBeUndefined();
    expect(result.servingGrams).toBe(30);
  });
});
