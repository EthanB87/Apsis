/**
 * apps/mobile/lib/offClient.ts — Open Food Facts fetch client (NUTR-08/09/03/21)
 *
 * The app's FIRST outbound network client (07-RESEARCH.md Summary) — no analog exists
 * elsewhere in the codebase. Two entry points feed the barcode chain and (future) remote
 * search fallback:
 *   - offLookupBarcode: GET /api/v2/product/{barcode}.json — status:1 (found) resolves to an
 *     OffResolvedFood with CONFIRMED macros only; status:0 (not found) resolves to `null`,
 *     never an error (RESEARCH Barcode Scan Flow).
 *   - offSearch: GET /api/v2/search — every nutriment field is optional (Pitfall 7); callers
 *     decide how to handle a candidate with incomplete macros.
 *
 * Security/DoS (T-07-15, mitigate): every fetch is wrapped in an internal AbortController +
 * setTimeout (FETCH_TIMEOUT_MS) so a hung OFF request can never block the logging UI — this is
 * also the "local-first: logging never blocks on the network" hard constraint, not just a
 * security nicety. A caller MAY additionally pass an external `AbortSignal` (e.g. a debounced
 * search cancelling a stale in-flight request); either signal aborts the fetch.
 *
 * Tampering / data-integrity (T-07-16, mitigate): OFF data is crowdsourced (Pitfall 7) — every
 * nutriment field is parsed as optional, never assumed present. `offLookupBarcode` additionally
 * refuses to resolve a product missing ANY of kcal/protein/carb/fat (returns `null` instead of a
 * zero-macro food) so a scanned item with sparse OFF data always falls through to manual
 * completion rather than silently logging garbage macros.
 *
 * Error/logging house style (T-05-01): every failure — timeout, abort, non-OK status, malformed
 * JSON — is caught, logged with an `[Apsis]`-prefixed message (Error object only, never a raw
 * value), and degrades to `null`/`[]`. Nothing in this file ever throws to its caller.
 */

const OFF_BASE = 'https://world.openfoodfacts.org';
/** Required by OFF's API usage policy for read operations (RESEARCH Code Examples). */
const USER_AGENT = 'Apsis/1.0 (support@apsistraining.com)';
/** 5-8s guidance (RESEARCH Security Domain) — mid-point. */
const FETCH_TIMEOUT_MS = 6000;

/** Every nutriment field optional (Pitfall 7) — OFF data is crowdsourced and often sparse. */
export interface OffFoodCandidate {
  name: string;
  brand: string | null;
  kcalPer100g: number | undefined;
  proteinGPer100g: number | undefined;
  carbGPer100g: number | undefined;
  fatGPer100g: number | undefined;
  fiberGPer100g: number | undefined;
  sodiumMgPer100g: number | undefined;
  servingName: string | null;
  servingGrams: number | null;
}

/**
 * A parsed OFF product with all four core macros CONFIRMED present (Pitfall 7) — safe to
 * upsert directly into the local `food` cache and hand straight to `FoodConfirmSheet` without
 * further completion.
 */
export interface OffResolvedFood {
  name: string;
  brand: string | null;
  kcalPer100g: number;
  proteinGPer100g: number;
  carbGPer100g: number;
  fatGPer100g: number;
  fiberGPer100g: number | undefined;
  sodiumMgPer100g: number | undefined;
  servingName: string | null;
  servingGrams: number | null;
}

function toOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toOptionalNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Fetches `url` guarded by BOTH an internal timeout AbortController (T-07-15) and an optional
 * caller-supplied external signal. Returns the parsed JSON body, or `null` on ANY failure
 * (timeout, abort, network error, non-OK status, malformed JSON) — never throws.
 */
async function fetchOffJson(url: string, externalSignal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const onExternalAbort = (): void => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error('[Apsis] OFF request returned non-OK status:', res.status);
      return null;
    }
    return await res.json();
  } catch (err: unknown) {
    console.error('[Apsis] OFF request failed:', err);
    return null;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

/**
 * Parses a raw OFF `product` object into an `OffFoodCandidate` — every nutriment field is
 * optional (Pitfall 7); OFF's `sodium_100g` is in grams, converted to mg for schema
 * consistency (`food.sodiumMgPer100g`). `serving_size` is a free-text string (e.g. "30 g") not
 * reliably parseable to a numeric gram value, so `servingGrams` is always left `null` here —
 * the confirm sheet's own 100g default applies instead.
 */
function parseOffProduct(product: Record<string, unknown>): OffFoodCandidate {
  const nutriments = (product.nutriments as Record<string, unknown> | undefined) ?? {};
  const sodiumG = toOptionalNumber(nutriments['sodium_100g']);
  return {
    name: toOptionalNonEmptyString(product.product_name) ?? 'Unknown product',
    brand: toOptionalNonEmptyString(product.brands),
    kcalPer100g: toOptionalNumber(nutriments['energy-kcal_100g']),
    proteinGPer100g: toOptionalNumber(nutriments['proteins_100g']),
    carbGPer100g: toOptionalNumber(nutriments['carbohydrates_100g']),
    fatGPer100g: toOptionalNumber(nutriments['fat_100g']),
    fiberGPer100g: toOptionalNumber(nutriments['fiber_100g']),
    sodiumMgPer100g: sodiumG != null ? sodiumG * 1000 : undefined,
    servingName: toOptionalNonEmptyString(product.serving_size),
    servingGrams: null,
  };
}

function hasCompleteMacros(c: OffFoodCandidate): c is OffFoodCandidate & OffResolvedFood {
  return (
    typeof c.kcalPer100g === 'number' &&
    typeof c.proteinGPer100g === 'number' &&
    typeof c.carbGPer100g === 'number' &&
    typeof c.fatGPer100g === 'number'
  );
}

/**
 * Barcode -> product lookup (NUTR-08, RESEARCH Barcode Scan Flow). `status:1` with all four
 * core macros present resolves to an `OffResolvedFood`; `status:0` (not found), a malformed
 * response, OR a found product missing any core macro (Pitfall 7 — never save a zero-macro
 * food) all resolve to `null`. The caller (`scan.tsx`) treats `null` as a miss and falls
 * through to manual/custom entry (NUTR-10 — never a dead end).
 */
export async function offLookupBarcode(
  barcode: string,
  externalSignal?: AbortSignal,
): Promise<OffResolvedFood | null> {
  const url = `${OFF_BASE}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,code,nutriments,serving_size`;
  const json = await fetchOffJson(url, externalSignal);
  if (json == null || typeof json !== 'object') return null;
  const body = json as Record<string, unknown>;
  if (body.status !== 1) return null; // status:0 = not found, not an error
  const product = body.product;
  if (product == null || typeof product !== 'object') return null;
  const candidate = parseOffProduct(product as Record<string, unknown>);
  if (!hasCompleteMacros(candidate)) return null;
  return candidate;
}

/**
 * Text search against OFF's product catalog (NUTR-03 remote fallback). Every returned
 * candidate may have incomplete macros (Pitfall 7) — unlike `offLookupBarcode`, this endpoint
 * does not filter incomplete candidates out, since the caller (`nutritionSearch.ts`) surfaces a
 * list the user picks from rather than auto-resolving a single scanned item. Never throws:
 * returns `[]` on any failure, empty query, or malformed response.
 */
export async function offSearch(
  query: string,
  externalSignal?: AbortSignal,
): Promise<OffFoodCandidate[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];
  const url = `${OFF_BASE}/api/v2/search?search_terms=${encodeURIComponent(trimmed)}&fields=product_name,brands,code,nutriments,serving_size&page_size=20`;
  const json = await fetchOffJson(url, externalSignal);
  if (json == null || typeof json !== 'object') return [];
  const products = (json as Record<string, unknown>).products;
  if (!Array.isArray(products)) return [];
  return products
    .filter((p): p is Record<string, unknown> => p != null && typeof p === 'object')
    .map(parseOffProduct);
}
