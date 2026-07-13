---
phase: 07-nutrition-tracking
reviewed: 2026-07-13T23:03:08Z
depth: standard
files_reviewed: 46
files_reviewed_list:
  - apps/mobile/app.json
  - apps/mobile/app/(tabs)/_layout.tsx
  - apps/mobile/app/(tabs)/nutrition/_layout.tsx
  - apps/mobile/app/(tabs)/nutrition/index.tsx
  - apps/mobile/app/(tabs)/nutrition/label-scan.tsx
  - apps/mobile/app/(tabs)/nutrition/log.tsx
  - apps/mobile/app/(tabs)/nutrition/recipe-edit.tsx
  - apps/mobile/app/(tabs)/nutrition/recipes.tsx
  - apps/mobile/app/(tabs)/nutrition/scan.tsx
  - apps/mobile/app/(tabs)/nutrition/search.tsx
  - apps/mobile/app/(tabs)/settings/index.tsx
  - apps/mobile/app/nutrition-setup/_layout.tsx
  - apps/mobile/app/nutrition-setup/index.tsx
  - apps/mobile/components/FoodConfirmSheet.tsx
  - apps/mobile/hooks/useNutritionProfile.ts
  - apps/mobile/hooks/useProfile.ts
  - apps/mobile/lib/__tests__/labelOcrParse.test.ts
  - apps/mobile/lib/__tests__/logFood.test.ts
  - apps/mobile/lib/__tests__/nutritionProfile.test.ts
  - apps/mobile/lib/__tests__/offClient.test.ts
  - apps/mobile/lib/finishWorkout.ts
  - apps/mobile/lib/labelOcrParse.ts
  - apps/mobile/lib/logFood.ts
  - apps/mobile/lib/nutritionCameraAuth.ts
  - apps/mobile/lib/nutritionProfile.ts
  - apps/mobile/lib/nutritionSearch.ts
  - apps/mobile/lib/nutritionTargetSignal.ts
  - apps/mobile/lib/offClient.ts
  - apps/mobile/lib/recomputeNutritionTarget.ts
  - apps/mobile/lib/runEntry.ts
  - apps/mobile/lib/usdaClient.ts
  - apps/mobile/package.json
  - packages/db/drizzle/0004_youthful_valkyrie.sql
  - packages/db/drizzle/migrations.js
  - packages/db/package.json
  - packages/db/src/__tests__/nutrition-queries.test.ts
  - packages/db/src/__tests__/nutrition-schema.test.ts
  - packages/db/src/index.ts
  - packages/db/src/nutritionQueries.ts
  - packages/db/src/nutritionTarget.ts
  - packages/db/src/schema.ts
  - packages/engine/src/__tests__/nutrition.test.ts
  - packages/engine/src/config.ts
  - packages/engine/src/index.ts
  - packages/engine/src/nutrition.ts
  - packages/shared/src/index.ts
findings:
  critical: 2
  warning: 9
  info: 7
  total: 18
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-07-13T23:03:08Z
**Depth:** standard
**Files Reviewed:** 46
**Status:** issues_found

## Summary

Reviewed the full Phase 07 nutrition-tracking surface: schema/migration (5 new tables), the pure engine target model, db query builders, the mobile logging/scan/OCR/recipe screens, remote OFF/USDA clients, and the recompute wiring into `finishWorkout`/`runEntry`.

The pure layers (engine `nutrition.ts`, `logFood.ts`, `labelOcrParse.ts`, `computeNutritionTargetRow`) are well-defended and well-tested. Security posture is solid: all queries are parameterized (verified per builder), OCR values are bounds-checked and user-confirmed before persistence, no macro/PII value reaches Sentry surfaces in any reviewed file, and both network clients are timeout-guarded and never throw into the logging path.

However, two data-correctness defects survive the happy path: the label-OCR flow systematically logs inflated macros for per-serving labels (the dominant US format), and the recipe-logging flow writes `food_log.foodId` values that point at `recipe` rows, violating the schema's FK contract — a defect masked on-device only because foreign-key enforcement is not actually enabled there, contrary to what the test harness comment asserts.

## Critical Issues

### CR-01: Label-scan flow logs systematically wrong macros for per-serving labels (value double-scaled by serving size)

**File:** `apps/mobile/lib/labelOcrParse.ts:29-36, 135-140`; `apps/mobile/app/(tabs)/nutrition/label-scan.tsx:101-108, 274`; `apps/mobile/components/FoodConfirmSheet.tsx:96`
**Issue:** US "Nutrition Facts" labels state values **per serving**, but `labelOcrParse` returns the raw extracted numbers under `kcalPer100g`/`proteinGPer100g`/... names without normalizing by the serving size it *also* extracts. The label-scan screen then pre-fills these per-serving values into a form labeled "Per 100g" and saves them as per-100g on the `food` row. The error then **compounds**: `FoodConfirmSheet` defaults the quantity to `servingGrams` (line 96), so logging one serving computes `perServing × servingGrams/100`.

Concrete trace using the project's own test fixture (`labelOcrParse.test.ts` lines 16-51): label says "Serving size 1 cup (240g)", "Calories 230". Saved food: `kcalPer100g=230`, `servingGrams=240`. Sheet opens with qty 240g → logged kcal = `230 × 2.4 = 552` for a 230 kcal serving — a 2.4× overstatement, silently, in the flow's happy path. The user-review mitigation does not catch this: a user checking "230" against the label sees a match and confirms. The parser has the data to fix this (`servingGrams` is extracted in the same pass).
**Fix:**
```ts
// labelOcrParse.ts — normalize to per-100g when a serving size was extracted:
const servingGrams = boundedNonNegative(serving.servingGrams, MAX_SERVING_G);
const scale = servingGrams != null && servingGrams > 0 ? 100 / servingGrams : 1;
const norm = (v: number | undefined) => (v != null ? v * scale : undefined);
return {
  kcalPer100g: norm(boundedNonNegative(extractKcal(safeLines), MAX_KCAL)),
  proteinGPer100g: norm(boundedNonNegative(extractProteinG(safeLines), MAX_MACRO_G)),
  // ... same for carb/fat
  servingName: serving.servingName,
  servingGrams,
};
```
When no serving grams are found, leave values `undefined` (or label the review form "Per serving" and store accordingly) rather than presenting per-serving numbers as per-100g. Update `labelOcrParse.test.ts` golden expectations (currently locking in the wrong semantics: `kcalPer100g` expected `230` from a 240g serving).

### CR-02: Recipe logging writes `food_log.foodId` = a `recipe.id`, violating the `food_log.food_id → food.id` FK contract

**File:** `apps/mobile/app/(tabs)/nutrition/recipes.tsx:51-62`; `apps/mobile/lib/logFood.ts:74`; `packages/db/drizzle/0004_youthful_valkyrie.sql:32`
**Issue:** `recipeToConfirmableFood` sets `id: recipe.id` and hands the result to `FoodConfirmSheet`, whose `buildFoodLogRow` freezes `foodId: input.food.id` into `food_log`. A recipe id is not a `food` row id, and `food_log.food_id` carries `FOREIGN KEY (food_id) REFERENCES food(id)` (migration 0004, line 32).

Consequences by environment:
- **On-device today:** the insert succeeds only because FK enforcement is not enabled on-device (see WR-01) — every "Log 1 serving" writes a dangling reference into `food_log`, corrupting referential integrity. These rows are silently dropped by every `INNER JOIN food` read (`recentFoods`/`favoriteFoods`).
- **Under the project's own test harness semantics** (`PRAGMA foreign_keys = ON`, which the harness comment claims mirrors the device): the insert throws `FOREIGN KEY constraint failed` and NUTR-14 "log 1 serving" fails 100% of the time. The moment WR-01 is fixed by enabling FKs, this feature hard-breaks.

No test covers logging a recipe serving into `food_log` — the one path that would have exposed this.
**Fix:** Log recipe servings without a `foodId` (it is not a food), e.g. extend `ConfirmableFood` with an optional `isVirtual`/`sourceRecipeId` flag and build the row with `foodId: null`:
```ts
// logFood.ts
foodId: input.food.isVirtual ? null : input.food.id,
```
or add a nullable `recipe_id` column to `food_log` if recipe provenance must be queryable. Add a db-level test that inserts a recipe-sourced `food_log` row with FKs ON.

## Warnings

### WR-01: Foreign-key enforcement is ON in the test harness but OFF on-device — cascade behavior the tests "prove" does not exist in production

**File:** `packages/db/src/client.ts:20-26` (context); `packages/db/src/__tests__/nutrition-schema.test.ts:57-58`; `packages/db/src/__tests__/nutrition-queries.test.ts:61`
**Issue:** Both test harnesses run `sqlite.pragma('foreign_keys = ON')` with the comment "op-sqlite enables FK enforcement on-device; mirror it so cascade behavior is real." That claim is false: op-sqlite's native sources contain no `PRAGMA foreign_keys` on open and its podspec sets no `SQLITE_DEFAULT_FOREIGN_KEYS` compile flag (verified in `node_modules/@op-engineering/op-sqlite`), and neither `client.ts` nor any app code issues the pragma. SQLite's default is OFF. So `recipe_ingredient`'s `ON DELETE CASCADE` (tested at `nutrition-schema.test.ts:201-234`) will NOT cascade on-device, and no FK (including `strength_set.workout_id`) is enforced at runtime. Tests are validating a database configuration the app never runs.
**Fix:** Execute the pragma once at client init:
```ts
// packages/db/src/client.ts
const opsqliteDb = open({ name: 'apsis.db' });
opsqliteDb.execute('PRAGMA foreign_keys = ON;');
```
Note: doing this without fixing CR-02 first will hard-break recipe logging — fix CR-02 in the same change.

### WR-02: USDA energy parser can return kJ as kcal (~4.2× inflation) via the name-substring fallback

**File:** `apps/mobile/lib/usdaClient.ts:74-88, 95`
**Issue:** `findNutrientValue(nutrients, 1008, 'energy')` iterates entries and accepts the FIRST entry whose id matches OR whose name contains "energy". USDA FoodData Central responses routinely include a second energy entry in kilojoules (e.g. nutrient id 1062, name "Energy", unit kJ; also "Energy (Atwater General Factors)" variants). If a kJ entry precedes the kcal entry in the array, its value is returned as `kcalPer100g` — roughly 4.18× too high. The parser never inspects `unitName`. The existing tests only feed a single "Energy" entry, so this is uncovered.
**Fix:** Two-pass lookup — exhaust exact-id matches across ALL entries first, then fall back to name; and reject energy entries whose unit is not kcal:
```ts
const unit = (n.nutrient?.unitName ?? n.unitName ?? '').toLowerCase();
if (nameSubstring === 'energy' && unit && unit !== 'kcal') continue;
```

### WR-03: Nutrition-target recompute failure fails the entire workout save — retry after a thrown `saveRun` duplicates the session

**File:** `apps/mobile/lib/runEntry.ts:125`; `apps/mobile/lib/finishWorkout.ts:56, 99`; `apps/mobile/lib/recomputeNutritionTarget.ts:113-116`
**Issue:** `recomputeNutritionTarget` logs then **re-throws**, and `saveRun`/`finishWorkout` `await` it inline with no isolation. In `saveRun`, the `workout` + `endurance_segment` rows are already inserted and `load_daily` recomputed before this call; if the nutrition recompute throws (e.g. a transient sqlite error), `saveRun` throws, the caller shows "couldn't save", and the user's natural retry inserts a **duplicate workout**. A failure in the new, non-core nutrition feature should never be able to fail the core logging path ("if everything else fails, this must work" — HSS logging is the product's stated survival feature).
**Fix:** Treat the nutrition recompute as a best-effort tail at these two call sites:
```ts
await recomputeLoadDaily(database);
try {
  await recomputeNutritionTarget(database, todayLocalDate());
} catch (err: unknown) {
  console.error('[Apsis] nutrition target recompute failed (non-fatal):', err);
}
```
(The nutrition TODAY screen's lazy-compute fallback already self-heals a missed recompute on next focus.)

### WR-04: Nutrition TODAY screen spins forever on load failure — no error state, no retry

**File:** `apps/mobile/app/(tabs)/nutrition/index.tsx:159-162, 206-214`
**Issue:** On any `loadNutrition` failure the catch sets `loading: false` but leaves `target: null`; the render guard `state.loading || state.target == null` then shows the `ActivityIndicator` indefinitely with no message and no retry — the exact anti-pattern the codebase already fixed in Settings (WR-07 precedent, `settings/index.tsx:166-185`). Same applies if `recomputeNutritionTarget` returns without writing (profile raced to incomplete) — permanent spinner.
**Fix:** Track an error flag in `NutritionState`; render the generic error string + Retry button (re-invoke `loadNutrition`) matching the Settings load-failure state.

### WR-05: Barcode scanner permanently ignores a code after an OFF miss — rescan of the same product is silently dead

**File:** `apps/mobile/app/(tabs)/nutrition/scan.tsx:78-80, 102-108, 147-151`
**Issue:** `lastCodeRef.current = data` is set at the top of `handleBarcodeScanned` and is only cleared in `handleSheetClose` (the confirm-sheet path). On the OFF-miss path (`router.push('/(tabs)/nutrition/log')`) and on the error path, `lastCodeRef` retains the code. The scan screen stays mounted beneath the pushed screen; when the user returns (e.g. after creating the food manually — which now exists in the local cache), scanning the same barcode is silently ignored by the `data === lastCodeRef.current` guard until a *different* barcode is scanned first. The just-created custom food is unreachable by rescan.
**Fix:** Clear `lastCodeRef.current = null` before both `router.push('/(tabs)/nutrition/log')` calls (miss and catch paths), or clear it on screen focus.

### WR-06: NUTR-03 remote search fallback (`nutritionSearch`, `offSearch`, `usdaSearch`) is dead code — no screen consumes it

**File:** `apps/mobile/lib/nutritionSearch.ts:92-111`; `apps/mobile/app/(tabs)/nutrition/search.tsx:96`
**Issue:** `nutritionSearch` (the local-first + OFF/USDA composite that NUTR-03 specifies) has zero call sites — grep confirms its only references are its own file and the clients it imports. `search.tsx` calls `searchLocalFoods` directly and its header comment still says the remote fallback "lands in 07-08", but 07-08 shipped only the barcode chain. Net effect: the entire USDA client and OFF text-search exist, are tested, and are unreachable; sparse local results never trigger the remote fallback the requirement describes.
**Fix:** Wire `nutritionSearch` into `search.tsx` (with an `isOnline` source and remote-result rows that route into the custom-food create flow), or delete `nutritionSearch.ts`/`usdaClient.ts`/`offSearch` and formally defer NUTR-03's remote half.

### WR-07: Recipe ingredient quantity input cannot accept decimals and fights the user's typing

**File:** `apps/mobile/app/(tabs)/nutrition/recipe-edit.tsx:189-192, 311-318`
**Issue:** The ingredient qty `TextInput` is controlled by `value={String(ing.qtyGrams)}` where `qtyGrams` is re-parsed on every keystroke via `parseNumberInput`. Typing "12." parses to `12`, re-renders as "12", and the decimal point is deleted as typed — decimal gram quantities are impossible to enter. Clearing the field parses `''` → NaN → `0` and instantly re-renders "0", so the user must fight a phantom leading zero. Every other numeric field in this phase correctly keeps raw text state and parses on commit.
**Fix:** Store the draft qty as a string (`qtyText`) on `DraftIngredient`, sanitize with the same `[^0-9.]` regex, and parse to a number only in the preview computation and at save time.

### WR-08: Recipe save performs multi-row writes without a transaction — mid-save failure leaves partial recipes, and retry duplicates them

**File:** `apps/mobile/app/(tabs)/nutrition/recipe-edit.tsx:227-262`
**Issue:** `handleSave` issues `createRecipe` (or `update`) followed by a sequential `await addRecipeIngredient(...)` loop, with no transaction. If an ingredient insert fails mid-loop: (create mode) a recipe exists with a partial ingredient list, the user sees "Nothing was lost — try again" (false — a partial recipe WAS saved), and the retry generates a fresh `randomUUID()` recipe id → a duplicate, second partial/complete recipe. (Edit mode) retry re-inserts already-added new ingredients as duplicates. drizzle/op-sqlite supports `db.transaction(...)`.
**Fix:** Wrap the recipe row + ingredient inserts in a single `db.transaction`, and generate the create-mode recipe id once outside the retry-able handler (or make inserts idempotent on stable draft ids).

### WR-09: `dailyMacroTarget` claims to defend every input but lets non-finite `heightCm`/`age` propagate NaN into a persisted row

**File:** `packages/engine/src/nutrition.ts:59-62, 100-105, 130-136`
**Issue:** The doc comment states the function "defends every input (D-15) ... and never throws", and golden test 4 proves this for `bodyweightKg` — but `heightCm` and `age` flow unvalidated into `mifflinStJeorBmr`. A NaN/Infinity height or age yields `bmr = NaN` → `kcal = Math.max(NaN, NaN) = NaN` → `Math.round(NaN/5)*5 = NaN`, and `recomputeNutritionTarget` will happily upsert a NaN `kcal` into `nutrition_target` (all-`real` columns accept NaN as NULL-ish garbage). The mobile gate checks only `!= null`, not finiteness. The engine is the project's stated moat ("over-type it") and every sibling function clamps its inputs.
**Fix:** Mirror the bodyweight guard:
```ts
if (!Number.isFinite(profile.heightCm) || profile.heightCm <= 0 ||
    !Number.isFinite(profile.age) || profile.age <= 0) {
  return { kcal: 0, p: 0, c: 0, f: 0, warnings: ['invalid height/age — cannot compute targets'] };
}
```
Add the corresponding golden-4-style cases to `nutrition.test.ts`.

## Info

### IN-01: TODAY screen picks an arbitrary `nutrition_target` row if an `override` row ever coexists with the auto row

**File:** `apps/mobile/app/(tabs)/nutrition/index.tsx:133, 142`
**Issue:** The query filters only by `localDate` and takes `targetRows[0]` with no `orderBy` and no `source` filter, while the schema explicitly allows an `'override'` row to coexist with the `auto-` row for the same date. Which row displays would be nondeterministic. Latent today (nothing writes `'override'` yet), but the schema invites it.
**Fix:** Prefer override explicitly: `.where(and(eq(localDate, today)))` + order/filter by `source` (`override` first), documented at the call site.

### IN-02: `defaultMealForNow` and `parseNumberInput` duplicated across four files

**File:** `apps/mobile/components/FoodConfirmSheet.tsx:68-79`; `apps/mobile/app/(tabs)/nutrition/log.tsx:51-62`; `apps/mobile/app/(tabs)/nutrition/label-scan.tsx:50-53`; `apps/mobile/app/(tabs)/nutrition/recipe-edit.tsx:72-75`
**Issue:** Identical time-of-day meal heuristic in two files and identical numeric-input parser in four. Drift risk (e.g. changing meal cutoffs in one place only).
**Fix:** Hoist both into `lib/logFood.ts` (already the pure food-logging helper module) and import.

### IN-03: Remote clients don't handle an already-aborted external signal

**File:** `apps/mobile/lib/offClient.ts:84-85`; `apps/mobile/lib/usdaClient.ts:120-121`
**Issue:** `externalSignal?.addEventListener('abort', ...)` never fires if the caller's signal was aborted *before* the call — the fetch proceeds for the full timeout instead of aborting immediately.
**Fix:** `if (externalSignal?.aborted) controller.abort();` before registering the listener.

### IN-04: `scan.tsx` doc comment says "upsert" but the OFF hit path is a plain insert on a non-unique barcode column

**File:** `apps/mobile/app/(tabs)/nutrition/scan.tsx:5-7, 111-125`; `packages/db/src/schema.ts:184`
**Issue:** `food.barcode` has no UNIQUE constraint and the OFF-hit path does `db.insert(food)`. The local-cache-first check makes duplicates unlikely, but two rapid scans that both miss locally before the first insert lands (guard is per-mount refs; also possible across scan-screen remounts mid-flight) can create duplicate `food` rows for one barcode. `findFoodByBarcode`'s `limit(1)` then hides them forever.
**Fix:** Add a unique index on `food.barcode` (nullable-unique is fine in SQLite) and use `onConflictDoUpdate`, or at minimum re-check the cache immediately before insert.

### IN-05: `vi.stubEnv` for the USDA API key is ineffective (module-level const captured at import)

**File:** `apps/mobile/lib/__tests__/offClient.test.ts:170-172`; `apps/mobile/lib/usdaClient.ts:28`
**Issue:** `API_KEY` is evaluated once at module import; `vi.stubEnv('EXPO_PUBLIC_USDA_FDC_API_KEY', 'TEST_KEY')` in `beforeEach` runs after import and changes nothing. Tests pass only because they never assert the key. Misleading harness code.
**Fix:** Read the env var inside `usdaSearch` (or drop the stub).

### IN-06: Stale-response race in search screens — no cancellation of superseded queries

**File:** `apps/mobile/app/(tabs)/nutrition/search.tsx:91-102`; `apps/mobile/app/(tabs)/nutrition/recipe-edit.tsx:159-170`
**Issue:** Each debounced query fires `searchLocalFoods(...).then(setResults)` without a cancelled-flag or effect-cleanup guard; an out-of-order resolution can overwrite newer results with older ones. Low risk while queries are local/fast, but becomes real the moment the WR-06 remote fallback is wired in (6s timeout window).
**Fix:** Standard `let cancelled = false` cleanup in the effect (the codebase already uses this pattern in `useNutritionProfile.ts:34-62`).

### IN-07: Back-dated run leaves that day's persisted `nutrition_target` stale

**File:** `apps/mobile/lib/runEntry.ts:100-106, 125`
**Issue:** `saveRun` persists the workout under `input.localDate` (date-picker back-dating supported) but recomputes the nutrition target only for `todayLocalDate()`. A previously-computed `nutrition_target` row for the back-dated day keeps its old `dayType`/kcal even though that day's sessions changed. Harmless for the current TODAY-only UI, but wrong data at rest for any future history view.
**Fix:** Also call `recomputeNutritionTarget(database, input.localDate)` when `input.localDate !== todayLocalDate()`.

---

_Reviewed: 2026-07-13T23:03:08Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
