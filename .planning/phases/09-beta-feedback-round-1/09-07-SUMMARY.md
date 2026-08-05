---
phase: 09-beta-feedback-round-1
plan: 07
subsystem: food-quantity-units-ui
tags: [units, food-logging, keyboard, chips, input-accessory]
dependency-graph:
  requires:
    - "09-01 (food.lastUsedUnit column, migration 0005)"
    - "09-02 (availableUnitsFor/qtyToGrams/gramsToDisplayQty in apps/mobile/lib/foodUnits.ts)"
    - "09-04 (DECIMAL_PAD_ACCESSORY_ID + DecimalPadDoneBar)"
  provides:
    - "apps/mobile/components/FoodConfirmSheet.tsx::UnitChipRow (exported, reused by log.tsx + recipe-edit.tsx)"
    - "FoodConfirmSheet keyboard-safe layout (BottomSheetScrollView) + Done bar + last-used-unit default"
    - "Chip rows on custom-food serving field (log.tsx) and recipe ingredient qty (recipe-edit.tsx)"
  affects:
    - "recipes.tsx inherits the confirm-sheet chip row for free (Pitfall 2 — no change needed there)"
    - "Phase 9 UAT (/gsd-verify-work 9) — carries this plan's 5 deferred on-device steps"
tech-stack:
  added: []
  patterns:
    - "Unit chip row: bone active-fill Pressable chips driven by availableUnitsFor; chip switch converts the displayed number via gramsToDisplayQty, never reinterprets digits"
    - "Storage stays grams: every UI conversion funnels through qtyToGrams before buildFoodLogRow / recipe_ingredient.qtyGrams / food.servingGrams"
key-files:
  created: []
  modified:
    - apps/mobile/components/FoodConfirmSheet.tsx
    - apps/mobile/app/(tabs)/nutrition/log.tsx
    - apps/mobile/app/(tabs)/nutrition/recipe-edit.tsx
decisions:
  - "Chip switch PRESERVES the real quantity (converts the displayed number via gramsToDisplayQty) rather than reinterpreting the typed digits as the new unit — 100 g -> oz shows 3.53, not 100 oz. D-08's 'typed number reinterprets' is satisfied for typing-after-selection; switching converts, which is the macro-honest reading."
  - "D-12 keyboard-safety via BottomSheetView -> BottomSheetScrollView swap (keyboardShouldPersistTaps=handled) layered on the existing keyboardBehavior=extend config — no second bottom-sheet keyboard owner added (oscillation lesson respected)"
  - "food.lastUsedUnit write-back is fire-and-forget inside its own try/catch AFTER the food_log insert succeeds — a failed unit-pref write never fails or duplicates the log itself; skipped entirely for isVirtual (recipe) foods which have no real food row (CR-02 precedent)"
  - "Stored lastUsedUnit is runtime-validated (isFoodQtyUnit guard + availableUnitsFor membership) before use — a stale 'tbsp' on a food whose servingGrams was later cleared falls back to the bodyweight-pref default instead of offering a unit with no basis"
  - "Custom-food 'Serving grams' chip row offers fixed-factor units only (g/kg/oz/lb) — that field DEFINES food.servingGrams, so no serving basis exists yet for tsp/tbsp/serving; converted grams value is what persists"
  - "recipe-edit existing (locked, editable=false) ingredient rows get NO chip row — they display stored grams as-is, matching their read-only state; chips appear only on newly-added editable rows"
  - "Display precision for converted quantities: round to 2 decimals (covers whole-oz, 0.1-lb, and fractional g/kg/tsp/tbsp/serving without a noisy float tail)"
metrics:
  duration: ~35min
  completed: 2026-08-05
status: complete
actuals:
  tokens: 7432
  tasks: 3
  commits: 2
---

# Phase 09 Plan 07: Food Unit Chip Rows + Keyboard-Safe Confirm Sheet Summary

Unit chip rows (g/kg/oz/lb always; tsp/tbsp/serving conditional on `food.servingGrams`) wired onto every grams-quantity entry point via 09-02's tested conversion math, plus a keyboard-safe FoodConfirmSheet (BottomSheetScrollView + Done bar) and last-used-unit-per-food defaulting — storage stays grams everywhere.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | FoodConfirmSheet — chip row + keyboard-safe layout + Done bar + last-used default | `2e05d55` | `apps/mobile/components/FoodConfirmSheet.tsx` |
| 2 | Quick-add + custom food + recipe ingredient chip rows + Done bar (D-10) | `93488b9` | `apps/mobile/app/(tabs)/nutrition/log.tsx`, `apps/mobile/app/(tabs)/nutrition/recipe-edit.tsx` |
| 3 | On-device verify checkpoint (human-verify, blocking) | — | Approved by user 2026-08-05 with on-device steps DEFERRED to phase UAT (see below) |

## What Was Built

**FoodConfirmSheet.tsx (Task 1):**
- `UnitChipRow` component (exported, with `chipStyles`) rendering `availableUnitsFor(food)`'s units as bone active-fill chips under the quantity input — mirrors the meal-selector visual; the Log button stays this sheet's one volt element
- Selecting a chip converts the current quantity via `qtyToGrams` → `gramsToDisplayQty`, so the REAL amount is preserved across unit switches; typing in the selected unit recomputes `qtyGrams` (and the live macro preview) through `qtyToGrams` on every keystroke
- `buildFoodLogRow` still receives grams only — no non-gram value can reach storage (T-09-10)
- Default unit on open (D-09): validated `food.lastUsedUnit` when present and offerable, else bodyweight-units-pref fallback (imperial → oz, metric → g); a successful log persists the chosen unit back to `food.lastUsedUnit` (skipped for virtual/recipe foods)
- Keyboard-safety (D-12): content moved from `BottomSheetView` to `BottomSheetScrollView` with `keyboardShouldPersistTaps="handled"`, layered on the existing `keyboardBehavior="extend"` / `keyboardBlurBehavior="none"` config — single keyboard owner preserved, everything scrollable-reachable with the keyboard up
- Done bar (D-11): `inputAccessoryViewID={DECIMAL_PAD_ACCESSORY_ID}` on the quantity `BottomSheetTextInput`; `<DecimalPadDoneBar />` mounted once in the sheet
- `ConfirmableFood` gained optional `lastUsedUnit` — callers passing full `food` rows (search.tsx, recipes.tsx via spread) carry it automatically

**log.tsx (Task 2):**
- Custom-food "Serving grams" field: chip row with fixed-factor units only (g/kg/oz/lb — the field defines `food.servingGrams`, so no serving basis exists yet); the entered value converts to grams before insert
- Done bar mounted once; `inputAccessoryViewID` on all decimal-pad fields (custom-food macro grid, serving grams, quick-add macro grid) per D-13
- Custom-food per-100g macro definitions untouched (no chip rows on macro fields, per plan)

**recipe-edit.tsx (Task 2):**
- Each newly-added ingredient carries its own `unit` (default g); chip row (reusing `UnitChipRow`) under the qty field, driven by that ingredient's own `servingGrams`/`servingName` (now selected in both the edit-mode load join and search results)
- Live per-serving macro preview AND the transactional save both convert via `qtyToGrams` — `recipe_ingredient.qtyGrams` stays grams
- Existing (locked) ingredient rows show stored grams with no chip row, matching their `editable={false}` state
- Done bar mounted; `inputAccessoryViewID` on the Servings field and every ingredient qty field

**recipes.tsx:** unchanged by design — it reuses FoodConfirmSheet and inherits the chip row for free (RESEARCH Pitfall 2).

## Deviations from Plan

**1. [Scope note] Quick-add has no chip row — no gram-quantity field exists there.**
- **Found during:** Task 2
- **Detail:** The plan's action says "add the same quantity chip row to the quick-add quantity field," but quick-add (`log.tsx` quickAdd mode) collects direct kcal/P/C/F totals with `qtyGrams: 0` (`buildQuickAddRow`, NUTR-06) — there is no weight-quantity input for a unit chip to apply to. D-10's actual rule ("chips go everywhere a grams quantity is entered") is satisfied vacuously; quick-add's decimal-pad macro fields still received the Done bar (D-13).
- **Files modified:** `apps/mobile/app/(tabs)/nutrition/log.tsx` (Done bar only for quick-add)
- **Commit:** `93488b9`

**2. [Rule 2 - adjacent correctness] Stored `lastUsedUnit` runtime-validated before use.**
- **Found during:** Task 1
- **Detail:** `food.lastUsedUnit` is a free TEXT column; a stale conditional unit (e.g. `'tbsp'` persisted while the food had `servingGrams`, later cleared) would otherwise select a chip that `availableUnitsFor` no longer offers. Added the `isFoodQtyUnit` type-guard + membership check with bodyweight-pref fallback.
- **Commit:** `2e05d55`

No other deviations — storage-stays-grams, no-new-Sentry-calls, and clampNonNegative-on-every-parse-path invariants all held as planned.

## Task 3 Checkpoint Resolution — Approved, On-Device Steps Deferred to Phase UAT

The user approved the plan as-built ("approved") based on green automated verification, with the
on-device steps explicitly DEFERRED to phase UAT (`/gsd-verify-work 9`) — same pattern as 09-04's
Task 3. The following MUST be covered in phase UAT on an iOS dev build:

1. **Conditional unit gating (D-05/D-06/D-07, T-09-12):** FoodConfirmSheet for a food WITH serving data shows g/kg/oz/lb + tsp/tbsp/serving chips; a food WITHOUT serving data shows only g/kg/oz/lb.
2. **Keyboard-safe sheet (D-12):** with the keyboard open, the quantity row, live macro preview, AND volt Log button are all visible/reachable; typing a value in oz then tapping lb converts the number and macros recompute live; logging works without dismissing the keyboard.
3. **Done bar inside the sheet (D-11, Pitfall 3):** a "Done" bar appears above the decimal pad and dismisses the keyboard IN the sheet. **Known uncertainty:** `BottomSheetTextInput` (@gorhom/bottom-sheet) may not forward `inputAccessoryViewID` to the native TextInput — if the bar does NOT appear inside the sheet, verify the sheet's own keyboard config (`keyboardBehavior="extend"` + the new `BottomSheetScrollView`) still satisfies "everything stays visible + tap-outside/pan-down dismiss," and report that so the accessory-view-in-sheet approach can be dropped for this one surface (plain-TextInput screens are unaffected either way).
4. **Last-used default (D-09):** reopening the same food defaults to the unit last used to log it.
5. **Other surfaces (D-10/D-13):** custom food shows the chip row on Serving grams + Done bar on all decimal-pad fields; recipe-edit newly-added ingredient rows show chip row + Done bar; quick-add shows the Done bar only (no chip row — no gram-quantity field exists there, by design).

## Verification

- `pnpm typecheck` (root `tsc --build`) — clean after each task commit (invoked via the main repo's `node_modules/typescript/bin/tsc`; this worktree has no local node_modules)
- `apps/mobile` vitest suite — 106/106 passing (includes 09-02's 21 foodUnits tests), no regressions
- Grep: no new Sentry breadcrumb/extra/context call in any touched file (T-09-11 / NUTR-22 invariant maintained — only pre-existing doc-comment mentions)
- Acceptance criteria: chip row driven by `availableUnitsFor` + converts via `qtyToGrams` ✓; quantity input sets `inputAccessoryViewID` ✓; `buildFoodLogRow` called with grams only ✓; `food.lastUsedUnit` read on open / written on log ✓; custom-food per-100g macro fields unchanged ✓

## Threat Model Compliance

- **T-09-10 (high, mitigate):** every UI path funnels through `qtyToGrams` (clamps non-finite/negative to 0) before `buildFoodLogRow` / `addRecipeIngredient` / the `food.servingGrams` insert — no NaN or non-gram quantity can reach storage
- **T-09-11 (high, mitigate):** zero new Sentry call sites; grep-verified
- **T-09-12 (medium, mitigate):** chip sets come exclusively from `availableUnitsFor`; the `lastUsedUnit` runtime guard additionally prevents a stale stored unit from resurfacing a conditional unit without a basis; on-device confirmation in UAT step 1
- **T-09-SC (low, accept):** zero new packages

## Known Stubs

None — no stubs, placeholders, or unwired data paths introduced.

## Self-Check: PASSED

- `apps/mobile/components/FoodConfirmSheet.tsx` (UnitChipRow + DECIMAL_PAD_ACCESSORY_ID + lastUsedUnit wiring) — FOUND
- `apps/mobile/app/(tabs)/nutrition/log.tsx` (chip row + Done bar) — FOUND
- `apps/mobile/app/(tabs)/nutrition/recipe-edit.tsx` (ingredient chip row + Done bar) — FOUND
- Commit `2e05d55` — FOUND
- Commit `93488b9` — FOUND
