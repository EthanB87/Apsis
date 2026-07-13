---
phase: 07-nutrition-tracking
fixed_at: 2026-07-14T02:45:00Z
review_path: .planning/phases/07-nutrition-tracking/07-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 11
skipped: 0
status: all_fixed
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-07-14T02:45:00Z
**Source review:** .planning/phases/07-nutrition-tracking/07-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning): 11
- Fixed: 11
- Skipped: 0

**Verification:** full workspace test suite green after all fixes (`pnpm -r --if-present test`:
shared 21, engine 95, db 63, mobile 80 — 259 passing, +7 new tests over the 252 baseline);
root `pnpm typecheck` (tsc --build) clean. Re-verified (mobile suite + typecheck) after the
WR-06 wiring landed.

## Fixed Issues

### CR-01: Label-scan flow logs systematically wrong macros for per-serving labels

**Files modified:** `apps/mobile/lib/labelOcrParse.ts`, `apps/mobile/lib/__tests__/labelOcrParse.test.ts`
**Commit:** 88c54b7
**Applied fix:** `labelOcrParse` now normalizes every extracted kcal/macro value to per-100g via
`100 / servingGrams` when a serving size in grams was extracted in the same pass (rounded to 1
decimal); values pass through unchanged when no serving size is found (per-100g-style labels,
e.g. EU format, carry no serving line — the user-review form remains the final gate for that
case). Fixture tests updated to assert the correct math: 230 kcal / 240 g serving → 95.8
kcal/100g, and a new test proves logging one 240 g serving computes back to exactly 230 kcal
(not the pre-fix double-scaled 552).

### CR-02: Recipe logging writes `food_log.foodId` = a `recipe.id`, violating the FK contract

**Files modified:** `apps/mobile/lib/logFood.ts`, `apps/mobile/components/FoodConfirmSheet.tsx`, `apps/mobile/app/(tabs)/nutrition/recipes.tsx`, `packages/db/src/client.ts`, `packages/db/src/__tests__/nutrition-schema.test.ts`, `apps/mobile/lib/__tests__/logFood.test.ts`
**Commit:** aafc338 (shared with WR-01 per the review's own "fix in the same change" directive)
**Applied fix:** Extended `ConfirmableFood`/`BuildFoodLogRowInput.food` with an optional
`isVirtual` flag; `buildFoodLogRow` writes `foodId: null` for virtual foods.
`recipeToConfirmableFood` sets `isVirtual: true` so logging a recipe serving inserts a
`food_log` row with NULL `foodId` (macros still frozen at log time). Added a db-level test with
FKs ON proving (a) inserting a recipe id into `food_log.foodId` throws `FOREIGN KEY constraint
failed` (the pre-fix behavior), and (b) the NULL-foodId row inserts cleanly; plus a unit test
for the `isVirtual` builder path.

### WR-01: FK enforcement ON in tests but OFF on-device

**Files modified:** `packages/db/src/client.ts`, `packages/db/src/__tests__/nutrition-schema.test.ts` (comment)
**Commit:** aafc338 (same change as CR-02, per the review's directive)
**Applied fix:** `client.ts` now executes `PRAGMA foreign_keys = ON` synchronously
(`executeSync`) at connection open, before `useMigrations()` runs — so `recipe_ingredient`'s
`ON DELETE CASCADE` and every other FK are actually enforced on-device, matching what the test
harnesses prove. Migration-order safety verified: all committed migrations (0000–0004) are
additive (`CREATE TABLE` / `ALTER TABLE ... ADD`), no table rebuilds that could trip FK checks
mid-chain. The false harness comment ("op-sqlite enables FK enforcement on-device") was
replaced with an accurate one referencing the client pragma.

### WR-02: USDA energy parser can return kJ as kcal (~4.2× inflation)

**Files modified:** `apps/mobile/lib/usdaClient.ts`, `apps/mobile/lib/__tests__/offClient.test.ts`
**Commit:** f665157
**Applied fix:** `findNutrientValue` is now two-pass — exact nutrient-id matches are exhausted
across ALL entries before the name-substring fallback runs, and the fallback rejects energy
entries whose `unitName` is present and not `kcal`. Added `unitName` to both raw nutrient
shapes. Two new tests: a kJ entry (id 1062) preceding the kcal entry never wins, and the
name-only fallback skips kJ and picks the kcal Atwater variant.

### WR-03: Nutrition-target recompute failure fails the entire workout save

**Files modified:** `apps/mobile/lib/runEntry.ts`, `apps/mobile/lib/finishWorkout.ts`
**Commit:** 0cf836e
**Applied fix:** All three call sites (`saveRun`, `finishWorkout`, `discardWorkout`) now wrap
`recomputeNutritionTarget` in a catch-and-log best-effort tail (`[Apsis] nutrition target
recompute failed (non-fatal)`), matching the healthkitWriteback.ts precedent — a nutrition
failure can no longer throw out of a completed workout save and provoke a duplicate-session
retry. The TODAY screen's lazy-compute fallback self-heals a missed recompute on next focus.

### WR-04: Nutrition TODAY screen spins forever on load failure

**Files modified:** `apps/mobile/app/(tabs)/nutrition/index.tsx`
**Commit:** 468908b
**Applied fix:** Added an `error` flag to `NutritionState`; the load catch sets it, and the
render now distinguishes loading (spinner) from failure/absent-target (generic error string +
Retry button that resets state and re-invokes `loadNutrition`), mirroring the Settings
load-failure precedent exactly (same style shapes: `loadErrorText`/`retryButton`/`retryLabel`).
Also covers the recompute-returned-without-writing case (profile raced to incomplete), which
previously also spun forever.

### WR-05: Barcode scanner permanently ignores a code after an OFF miss

**Files modified:** `apps/mobile/app/(tabs)/nutrition/scan.tsx`
**Commit:** f5eb991
**Applied fix:** `lastCodeRef.current = null` is now cleared before both
`router.push('/(tabs)/nutrition/log')` calls (OFF-miss path and catch path), so returning to the
still-mounted scan screen and rescanning the same barcode works — the just-created custom food
is reachable by rescan.

### WR-07: Recipe ingredient quantity input cannot accept decimals

**Files modified:** `apps/mobile/app/(tabs)/nutrition/recipe-edit.tsx`
**Commit:** 0789597
**Applied fix:** `DraftIngredient.qtyGrams: number` replaced with `qtyText: string` — the input
keeps sanitized raw text (`[^0-9.]` strip) while typing, and the value is parsed to a number
only in the preview computation and at save time, matching every other numeric field in the
phase. "12." and cleared-field states no longer fight the user.

### WR-08: Recipe save performs multi-row writes without a transaction

**Files modified:** `apps/mobile/app/(tabs)/nutrition/recipe-edit.tsx`
**Commit:** 592e4e1
**Applied fix:** Both save branches (create and edit) now wrap the recipe row write + the
ingredient-insert loop in a single `db.transaction(async (tx) => ...)` (drizzle's op-sqlite
driver supports it; `tx` satisfies the `QueryableDB` parameter of
`createRecipe`/`addRecipeIngredient`). A mid-loop failure rolls the whole save back — the
"Nothing was lost" error copy is now true, and retry can no longer produce partial or duplicate
recipes.

### WR-09: `dailyMacroTarget` lets non-finite `heightCm`/`age` propagate NaN into a persisted row

**Files modified:** `packages/engine/src/nutrition.ts`, `packages/engine/src/__tests__/nutrition.test.ts`
**Commit:** 7e1120d
**Applied fix:** Added a height/age guard mirroring the bodyweight guard: non-finite or
non-positive `heightCm`/`age` returns the all-zero result with warning
`'invalid height/age — cannot compute targets'` instead of computing a NaN BMR. Added golden 4b
covering 0/negative/NaN/Infinity for both fields plus a no-field-is-ever-NaN assertion. Doc
comment updated to reflect the widened D-15 defense.

### WR-06: NUTR-03 remote search fallback (`nutritionSearch`, `offSearch`, `usdaSearch`) is dead code

**Files modified:** `apps/mobile/app/(tabs)/nutrition/search.tsx`
**Commit:** 052a86d
**Applied fix:** (Initially skipped pending a product decision; user directed: wire it now.)
`nutritionSearch` is wired into the search screen: for debounced queries of ≥3 chars it fires
IN PARALLEL with the instant local `searchLocalFoods` render, so the remote fallback never
delays local-first results. `nutritionSearch`'s own sparse-local gate (<3 local hits) decides
whether OFF/USDA actually get called, and both clients are timeout-guarded and never throw —
no-network/timeout degrades silently to local-results-only (no error UI, local results remain).
Remote results render under an "Online results" section with a subtle mono "SEARCHING ONLINE…"
in-flight indicator and a per-row OFF/USDA source tag; candidates with incomplete core macros
are filtered out (Pitfall 7). Tapping a remote row caches it through as a local `food` row
(source 'off'/'usda', the same upsert-on-confirm shape scan.tsx uses for barcode hits) and
opens the shared FoodConfirmSheet on the new LOCAL id — anything logged is always backed by a
local food row and is findable offline afterward. Also added the IN-06 cancelled-flag cleanup
to the search effect (stale-response guard, now load-bearing with the 6s remote window) and a
double-tap insert guard. `nutritionSearch`'s fallback-trigger logic was not changed, so no new
pure-logic test was required; mobile vitest suite (80 tests) and root typecheck re-verified
green.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-07-14T02:22:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
