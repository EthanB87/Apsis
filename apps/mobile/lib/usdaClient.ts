/**
 * apps/mobile/lib/usdaClient.ts — USDA FoodData Central fetch client (NUTR-03)
 *
 * Sibling to `offClient.ts` (RESEARCH.md — no shared parent module exists yet; each remote
 * client is self-contained and owns its own timeout guard). Covers generic/whole-food search
 * only — USDA has no barcode-lookup endpoint, so the barcode chain (`scan.tsx`) uses OFF
 * exclusively.
 *
 * Pitfall 8 (USDA `foodNutrients` shape inconsistency): two independently-observed JSON shapes
 * exist for the same conceptual nutrient data — a flat form (`nutrientId`/`nutrientName`/
 * `value`) and a nested form (`nutrient.{id,name}` + `amount`). `findNutrientValue` below checks
 * BOTH shapes (nutrient id first, name-substring fallback) so a shape mismatch degrades to a
 * missing (optional) field rather than a parse failure.
 *
 * Security (T-07-15 DoS / T-05-01 logging, same convention as offClient.ts): every fetch is
 * guarded by an internal AbortController + setTimeout so a hung USDA request never blocks the
 * logging UI; every failure (timeout, abort, rate limit, malformed JSON) is caught, logged
 * `[Apsis]`-prefixed (Error object only), and degrades to `[]` — never throws to the caller.
 *
 * V6 Cryptography (RESEARCH Security Domain): `EXPO_PUBLIC_USDA_FDC_API_KEY` is a free,
 * non-billing US government key with no meaningful secret value — client-embedding it is
 * standard/acceptable for a backend-less app (same class of exposure as `EXPO_PUBLIC_SENTRY_DSN`).
 * Falls back to the public `DEMO_KEY` (30 req/hr, 50/day) when unset, so USDA search degrades
 * gracefully rather than failing outright before a real key is provisioned (07-USER-SETUP.md).
 */

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';
const API_KEY = process.env.EXPO_PUBLIC_USDA_FDC_API_KEY ?? 'DEMO_KEY';
/** 5-8s guidance (RESEARCH Security Domain) — mid-point, matches offClient.ts. */
const FETCH_TIMEOUT_MS = 6000;

/** Every nutrient field optional — mirrors offClient.ts's OffFoodCandidate defensiveness. */
export interface UsdaFoodCandidate {
  name: string;
  fdcId: number | undefined;
  kcalPer100g: number | undefined;
  proteinGPer100g: number | undefined;
  carbGPer100g: number | undefined;
  fatGPer100g: number | undefined;
  fiberGPer100g: number | undefined;
  sodiumMgPer100g: number | undefined;
}

interface RawUsdaFoodNutrient {
  /** Flat shape (Pitfall 8). */
  nutrientId?: number;
  nutrientName?: string;
  value?: number;
  /** Nested shape (Pitfall 8). */
  nutrient?: { id?: number; name?: string };
  amount?: number;
}

/** USDA standard nutrient IDs (Energy/Protein/Carbohydrate/Fat/Fiber/Sodium). */
const NUTRIENT_ID = {
  energyKcal: 1008,
  protein: 1003,
  carb: 1005,
  fat: 1004,
  fiber: 1079,
  sodium: 1093,
} as const;

function toOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Finds a nutrient's value by ID first (either shape, Pitfall 8), falling back to a
 * case-insensitive name substring match if the ID doesn't match — some USDA responses report
 * slightly different IDs for closely related nutrients (e.g. "Energy" vs "Energy (Atwater
 * General Factors)"), so the name fallback catches those without a hand-maintained ID list.
 */
function findNutrientValue(
  nutrients: RawUsdaFoodNutrient[],
  id: number,
  nameSubstring: string,
): number | undefined {
  for (const n of nutrients) {
    const nid = n.nutrient?.id ?? n.nutrientId;
    const nname = (n.nutrient?.name ?? n.nutrientName ?? '').toLowerCase();
    if (nid === id || nname.includes(nameSubstring)) {
      const value = toOptionalNumber(n.amount ?? n.value);
      if (value != null) return value;
    }
  }
  return undefined;
}

function parseUsdaFood(raw: Record<string, unknown>): UsdaFoodCandidate {
  const nutrients = Array.isArray(raw.foodNutrients) ? (raw.foodNutrients as RawUsdaFoodNutrient[]) : [];
  return {
    name: typeof raw.description === 'string' && raw.description.trim().length > 0 ? raw.description.trim() : 'Unknown food',
    fdcId: toOptionalNumber(raw.fdcId),
    kcalPer100g: findNutrientValue(nutrients, NUTRIENT_ID.energyKcal, 'energy'),
    proteinGPer100g: findNutrientValue(nutrients, NUTRIENT_ID.protein, 'protein'),
    carbGPer100g: findNutrientValue(nutrients, NUTRIENT_ID.carb, 'carbohydrate'),
    fatGPer100g: findNutrientValue(nutrients, NUTRIENT_ID.fat, 'lipid'),
    fiberGPer100g: findNutrientValue(nutrients, NUTRIENT_ID.fiber, 'fiber'),
    sodiumMgPer100g: findNutrientValue(nutrients, NUTRIENT_ID.sodium, 'sodium'),
  };
}

/**
 * Text search against USDA FoodData Central's Foundation + SR Legacy datasets (generic/whole
 * foods, NUTR-03 remote fallback). Restricted to `dataType=Foundation,SR%20Legacy` per RESEARCH
 * Code Examples — branded-product search is OFF's job, not USDA's, in this phase. Never
 * throws: a rate limit (429), timeout, network failure, or malformed response all degrade to
 * `[]` (logged `[Apsis]`-prefixed).
 */
export async function usdaSearch(
  query: string,
  externalSignal?: AbortSignal,
): Promise<UsdaFoodCandidate[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const onExternalAbort = (): void => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort);
  try {
    const url = `${USDA_BASE}/foods/search?api_key=${API_KEY}&query=${encodeURIComponent(trimmed)}&dataType=Foundation,SR%20Legacy&pageSize=20`;
    const res = await fetch(url, { signal: controller.signal });
    if (res.status === 429) {
      console.error('[Apsis] USDA rate limit exceeded');
      return [];
    }
    if (!res.ok) {
      console.error('[Apsis] USDA request returned non-OK status:', res.status);
      return [];
    }
    const json = (await res.json()) as Record<string, unknown>;
    const foods = json.foods;
    if (!Array.isArray(foods)) return [];
    return foods
      .filter((f): f is Record<string, unknown> => f != null && typeof f === 'object')
      .map(parseUsdaFood);
  } catch (err: unknown) {
    console.error('[Apsis] USDA request failed:', err);
    return [];
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}
