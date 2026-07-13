/**
 * apps/mobile/lib/__tests__/offClient.test.ts
 *
 * Mocked-fetch coverage for offClient.ts + usdaClient.ts (NUTR-08, 07-RESEARCH.md Pitfalls
 * 7/8): a `status:1` OFF product with complete macros parses to normalized fields; `status:0`
 * (and a product missing any core macro) yields `null`, never a zero-macro food; a
 * timeout/aborted fetch resolves to `null` without throwing; USDA's nested and flat
 * `foodNutrients` shapes parse identically (Pitfall 8).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { offLookupBarcode, offSearch } from '../offClient';
import { usdaSearch } from '../usdaClient';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('offLookupBarcode', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('a status:1 product with complete macros parses to normalized fields', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        status: 1,
        product: {
          product_name: 'Protein Bar',
          brands: 'Quest',
          code: '0123456789012',
          nutriments: {
            'energy-kcal_100g': 380,
            proteins_100g: 30,
            carbohydrates_100g: 35,
            fat_100g: 12,
            fiber_100g: 8,
            sodium_100g: 0.4,
          },
          serving_size: '60 g',
        },
      }),
    );

    const result = await offLookupBarcode('0123456789012');

    expect(result).not.toBeNull();
    expect(result?.name).toBe('Protein Bar');
    expect(result?.brand).toBe('Quest');
    expect(result?.kcalPer100g).toBe(380);
    expect(result?.proteinGPer100g).toBe(30);
    expect(result?.carbGPer100g).toBe(35);
    expect(result?.fatGPer100g).toBe(12);
    expect(result?.fiberGPer100g).toBe(8);
    expect(result?.sodiumMgPer100g).toBe(400); // 0.4g -> 400mg
    expect(result?.servingName).toBe('60 g');
  });

  it('a status:0 response yields null (not a zero-macro food)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ status: 0 }));

    const result = await offLookupBarcode('9999999999999');

    expect(result).toBeNull();
  });

  it('a status:1 product missing a core macro (e.g. fat) yields null, not a zero-macro food', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        status: 1,
        product: {
          product_name: 'Sparse Product',
          nutriments: {
            'energy-kcal_100g': 200,
            proteins_100g: 10,
            carbohydrates_100g: 20,
            // fat_100g deliberately missing
          },
        },
      }),
    );

    const result = await offLookupBarcode('1111111111111');

    expect(result).toBeNull();
  });

  it('an aborted/timed-out fetch returns null without throwing', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'));

    await expect(offLookupBarcode('2222222222222')).resolves.toBeNull();
  });

  it('a malformed (non-JSON-object) response returns null without throwing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(null));

    await expect(offLookupBarcode('3333333333333')).resolves.toBeNull();
  });

  it('a non-OK HTTP status returns null without throwing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({}, 500));

    await expect(offLookupBarcode('4444444444444')).resolves.toBeNull();
  });
});

describe('offSearch', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('parses multiple products, tolerating missing nutriment fields (Pitfall 7)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        products: [
          {
            product_name: 'Full Product',
            nutriments: {
              'energy-kcal_100g': 100,
              proteins_100g: 5,
              carbohydrates_100g: 10,
              fat_100g: 2,
            },
          },
          {
            product_name: 'Sparse Product',
            nutriments: {},
          },
        ],
      }),
    );

    const results = await offSearch('protein bar');

    expect(results).toHaveLength(2);
    expect(results[0]?.kcalPer100g).toBe(100);
    expect(results[1]?.kcalPer100g).toBeUndefined();
    expect(results[1]?.name).toBe('Sparse Product');
  });

  it('an empty query returns [] without calling fetch', async () => {
    globalThis.fetch = vi.fn();

    const results = await offSearch('   ');

    expect(results).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('a network failure returns [] without throwing', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));

    await expect(offSearch('rice')).resolves.toEqual([]);
  });
});

describe('usdaSearch — Pitfall 8 dual-shape parsing', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_USDA_FDC_API_KEY', 'TEST_KEY');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('parses the flat foodNutrients shape (nutrientId/nutrientName/value)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        foods: [
          {
            description: 'Chicken breast, raw',
            fdcId: 12345,
            foodNutrients: [
              { nutrientId: 1008, nutrientName: 'Energy', value: 120 },
              { nutrientId: 1003, nutrientName: 'Protein', value: 22 },
              { nutrientId: 1005, nutrientName: 'Carbohydrate, by difference', value: 0 },
              { nutrientId: 1004, nutrientName: 'Total lipid (fat)', value: 3 },
            ],
          },
        ],
      }),
    );

    const results = await usdaSearch('chicken breast');

    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('Chicken breast, raw');
    expect(results[0]?.kcalPer100g).toBe(120);
    expect(results[0]?.proteinGPer100g).toBe(22);
    expect(results[0]?.carbGPer100g).toBe(0);
    expect(results[0]?.fatGPer100g).toBe(3);
  });

  it('parses the nested foodNutrients shape (nutrient.{id,name} + amount) identically', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        foods: [
          {
            description: 'Chicken breast, raw',
            fdcId: 12345,
            foodNutrients: [
              { nutrient: { id: 1008, name: 'Energy' }, amount: 120 },
              { nutrient: { id: 1003, name: 'Protein' }, amount: 22 },
              { nutrient: { id: 1005, name: 'Carbohydrate, by difference' }, amount: 0 },
              { nutrient: { id: 1004, name: 'Total lipid (fat)' }, amount: 3 },
            ],
          },
        ],
      }),
    );

    const results = await usdaSearch('chicken breast');

    expect(results).toHaveLength(1);
    expect(results[0]?.kcalPer100g).toBe(120);
    expect(results[0]?.proteinGPer100g).toBe(22);
    expect(results[0]?.carbGPer100g).toBe(0);
    expect(results[0]?.fatGPer100g).toBe(3);
  });

  it('a kJ energy entry preceding the kcal entry never wins — exact id 1008 is preferred (WR-02)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        foods: [
          {
            description: 'Oats, raw',
            fdcId: 111,
            foodNutrients: [
              // kJ entry FIRST (nutrient id 1062) — the old single-pass name match returned
              // this 502 kJ value as kcalPer100g (~4.2× inflation).
              { nutrient: { id: 1062, name: 'Energy', unitName: 'kJ' }, amount: 502 },
              { nutrient: { id: 1008, name: 'Energy', unitName: 'kcal' }, amount: 120 },
            ],
          },
        ],
      }),
    );

    const results = await usdaSearch('oats');

    expect(results[0]?.kcalPer100g).toBe(120);
  });

  it('the name fallback rejects non-kcal energy units when no exact id matches (WR-02)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        foods: [
          {
            description: 'Oats, raw',
            fdcId: 111,
            foodNutrients: [
              // No entry carries the exact id 1008 — only the name fallback can resolve energy,
              // and it must skip the kJ entry even though it comes first.
              { nutrientName: 'Energy', unitName: 'kJ', value: 502 },
              { nutrientName: 'Energy (Atwater General Factors)', unitName: 'kcal', value: 118 },
            ],
          },
        ],
      }),
    );

    const results = await usdaSearch('oats');

    expect(results[0]?.kcalPer100g).toBe(118);
  });

  it('a 429 rate-limit response returns [] without throwing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({}, 429));

    await expect(usdaSearch('rice')).resolves.toEqual([]);
  });

  it('an aborted/timed-out fetch returns [] without throwing', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'));

    await expect(usdaSearch('rice')).resolves.toEqual([]);
  });
});
