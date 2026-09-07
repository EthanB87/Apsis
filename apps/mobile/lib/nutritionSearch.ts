/**
 * apps/mobile/lib/nutritionSearch.ts — local-first search with a debounced, time-bounded
 * OFF/USDA fallback (NUTR-03, 07-RESEARCH.md Pattern 1).
 *
 * `searchLocalFoods` (op-sqlite JSI, instant, offline) always runs first. Only when local
 * results are sparse (< MIN_LOCAL_RESULTS) AND the caller reports the device online does this
 * module fire the remote OFF + USDA search — and even then, both remote clients
 * (offClient.ts/usdaClient.ts) own their own AbortController timeout and never throw, so a
 * hung/failed network call degrades to "local results only," never a blocked search box.
 * Debouncing is the CALLER's responsibility (a `useDebouncedValue`-style hook in the search
 * screen) — this function assumes it is only invoked after that debounce has already fired,
 * matching the RESEARCH.md `searchFoods` composition sketch.
 *
 * Remote results are NOT upserted into the local `food` cache here — that stays the confirm/log
 * step's job (the same upsert-on-confirm shape `scan.tsx` uses for barcode hits), keeping this
 * module a pure read/aggregate layer with no write side effects.
 *
 * Imports `@apsis/db` (searchLocalFoods/food/QueryableDB) and therefore cannot be unit-tested
 * under this app's `lib/**` vitest harness (client.ts opens a native op-sqlite JSI connection
 * at import time — see vitest.config.mts's own doc comment). `offClient.ts`/`usdaClient.ts`
 * carry no such import and are covered by `offClient.test.ts` instead.
 */

import { food, searchLocalFoods, type QueryableDB } from '@apsis/db';
import { offSearch, type OffFoodCandidate } from './offClient';
import { usdaSearch, type UsdaFoodCandidate } from './usdaClient';

/** Below this many local hits, a remote fallback is worth firing (RESEARCH Pattern 1). */
const MIN_LOCAL_RESULTS = 3;

export type LocalFoodResult = typeof food.$inferSelect;

/** A remote (not-yet-cached) search candidate — may carry incomplete macros (Pitfall 7); the
 * confirm/create flow that consumes this is responsible for completion before logging. */
export interface RemoteFoodResult {
  source: 'off' | 'usda';
  name: string;
  brand: string | null;
  kcalPer100g: number | undefined;
  proteinGPer100g: number | undefined;
  carbGPer100g: number | undefined;
  fatGPer100g: number | undefined;
}

export interface NutritionSearchResult {
  local: LocalFoodResult[];
  remote: RemoteFoodResult[];
}

export interface NutritionSearchOptions {
  isOnline: boolean;
}

function offToRemote(c: OffFoodCandidate): RemoteFoodResult {
  return {
    source: 'off',
    name: c.name,
    brand: c.brand,
    kcalPer100g: c.kcalPer100g,
    proteinGPer100g: c.proteinGPer100g,
    carbGPer100g: c.carbGPer100g,
    fatGPer100g: c.fatGPer100g,
  };
}

function usdaToRemote(c: UsdaFoodCandidate): RemoteFoodResult {
  return {
    source: 'usda',
    name: c.name,
    brand: null,
    kcalPer100g: c.kcalPer100g,
    proteinGPer100g: c.proteinGPer100g,
    carbGPer100g: c.carbGPer100g,
    fatGPer100g: c.fatGPer100g,
  };
}

/** Case-insensitive exact-name dedupe against the already-shown local results — cheap and
 * sufficient for "don't show the same food twice," not a fuzzy-match engine. */
function dedupeAgainstLocal(local: LocalFoodResult[], remote: RemoteFoodResult[]): RemoteFoodResult[] {
  const localNames = new Set(local.map((f) => f.name.trim().toLowerCase()));
  return remote.filter((r) => !localNames.has(r.name.trim().toLowerCase()));
}

/**
 * Always runs `searchLocalFoods` first (instant, offline). Only fires the remote OFF/USDA
 * fallback when local results are sparse AND the caller reports the device online — assumes
 * the caller already debounced the trigger (RESEARCH Pattern 1). Both remote clients are
 * internally timeout-guarded and never throw, so a hung/failed request degrades to
 * `remote: []`, never a blocked search.
 */
export async function nutritionSearch(
  db: QueryableDB,
  query: string,
  options: NutritionSearchOptions,
): Promise<NutritionSearchResult> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return { local: [], remote: [] };

  const local = await searchLocalFoods(db, trimmed);
  if (local.length >= MIN_LOCAL_RESULTS || !options.isOnline) {
    return { local, remote: [] };
  }

  const [offResults, usdaResults] = await Promise.all([offSearch(trimmed), usdaSearch(trimmed)]);
  const remote = dedupeAgainstLocal(local, [
    ...offResults.map(offToRemote),
    ...usdaResults.map(usdaToRemote),
  ]);
  return { local, remote };
}
