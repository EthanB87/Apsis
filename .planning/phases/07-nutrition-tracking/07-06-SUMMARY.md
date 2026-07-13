---
phase: 07-nutrition-tracking
plan: 06
subsystem: ui
tags: [expo-router, zustand, drizzle, gorhom-bottom-sheet, vitest, nutrition]

# Dependency graph
requires:
  - phase: 07-nutrition-tracking (plans 03, 04, 05)
    provides: packages/db nutritionQueries (searchLocalFoods/recentFoods/favoriteFoods/dayTotals) + food/food_log schema; apps/mobile nutritionTargetSignal zustand counter + localDate helpers
provides:
  - buildFoodLogRow/buildQuickAddRow (apps/mobile/lib/logFood.ts) — pure freeze-at-log-time food_log row builders
  - FoodConfirmSheet — shared meal/qty confirm sheet, food-source-agnostic (reusable by 07-08 barcode + 07-09 OCR)
  - nutrition/search.tsx — local search with recents/favorites for <=3-tap repeat logging
  - nutrition/log.tsx — custom-food creation + macro-only quick-add
  - "Log food" entry point wired into nutrition/index.tsx (Rule 2 deviation)
affects: [07-07, 07-08, 07-09, 07-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Freeze-at-log-time row builder: pure function computes food.per100g x qtyGrams once at build time, never a live join later (07-RESEARCH.md Pattern 2)"
    - "Food-source-agnostic confirm sheet: FoodConfirmSheet accepts any object shaped like ConfirmableFood, so barcode/OCR results can reuse it without modification"
    - "Single-owner imperative BottomSheet open/close (visible-driven effect only), mirrored from ExercisePickerSheet.tsx to avoid the documented open/close oscillation bug"

key-files:
  created:
    - apps/mobile/lib/logFood.ts
    - apps/mobile/lib/__tests__/logFood.test.ts
    - apps/mobile/components/FoodConfirmSheet.tsx
    - apps/mobile/app/(tabs)/nutrition/search.tsx
    - apps/mobile/app/(tabs)/nutrition/log.tsx
  modified:
    - apps/mobile/app/(tabs)/nutrition/index.tsx

key-decisions:
  - "logFood.ts excludes id/createdAt from its return shape -- the caller assigns those via expo-crypto's randomUUID at insert time, keeping the builder free of native imports (matches the runEntryLogic.ts vitest-testability boundary)"
  - "FoodConfirmSheet computes a default meal from time-of-day (breakfast <11h, lunch <15h, dinner <21h, else snack) rather than requiring the user to pick every time -- user can still override before confirming"
  - "Meal/mode segmented controls use bone active-fill, not volt, on every screen in this plan -- each screen already has one volt-filled primary CTA (Log food / Save & log / Quick add), matching the established one-volt-per-screen convention from Nutrition Setup's goal-mode selector"

patterns-established:
  - "Reusable food-source-agnostic confirm sheet as the single insert point for food_log rows across manual/barcode/OCR entry paths"

requirements-completed: [NUTR-03, NUTR-04, NUTR-05, NUTR-06, NUTR-07]

coverage:
  - id: D1
    description: "buildFoodLogRow/buildQuickAddRow freeze macros at build time, clamp every numeric input to a safe non-negative value, and are covered by vitest"
    requirement: "NUTR-05"
    verification:
      - kind: unit
        ref: "apps/mobile/lib/__tests__/logFood.test.ts (9 tests: 150g x 200kcal/100g = 300kcal, quick-add shape, negative/NaN/missing-field clamping)"
        status: pass
      - kind: other
        ref: "grep -c '@apsis/db\\|expo-' apps/mobile/lib/logFood.ts (0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "search.tsx surfaces recents/favorites above debounced local search results; tapping a result opens FoodConfirmSheet"
    requirement: "NUTR-03"
    verification:
      - kind: other
        ref: "grep -c 'searchLocalFoods\\|recentFoods\\|favoriteFoods' 'apps/mobile/app/(tabs)/nutrition/search.tsx' (13)"
        status: pass
      - kind: other
        ref: "pnpm --filter @apsis/mobile exec tsc --noEmit (clean)"
        status: pass
    human_judgment: true
    rationale: "The <=3-tap repeat-logging feel and visual layout are UX judgments no automated check covers -- phase UAT."
  - id: D3
    description: "log.tsx supports custom-food creation (food source='user' then log via FoodConfirmSheet) and macro-only quick-add (foodId null, quickAdd true) via buildQuickAddRow"
    requirement: "NUTR-05,NUTR-06"
    verification:
      - kind: other
        ref: "grep -c 'quickAdd\\|buildQuickAddRow' 'apps/mobile/app/(tabs)/nutrition/log.tsx' (13)"
        status: pass
      - kind: other
        ref: "pnpm --filter @apsis/mobile exec tsc --noEmit (clean)"
        status: pass
    human_judgment: true
    rationale: "End-to-end custom-food-then-log and quick-add flows on-device require human verification -- phase UAT."
  - id: D4
    description: "Every food_log insert is tagged to a meal enum value and today's local date; no network/fetch call appears anywhere in this plan's files"
    requirement: "NUTR-07"
    verification:
      - kind: other
        ref: "Manual review: FoodConfirmSheet.handleLog and log.tsx handleQuickAdd both always pass a Meal value + todayLocalDate() into the row builders; grep -rn 'fetch(' across the 4 plan files returns 0 matches"
        status: pass
    human_judgment: false
  - id: D5
    description: "After a confirm/quick-add, nutritionTargetSignal is bumped so the TODAY nutrition screen's totals refresh"
    requirement: "NUTR-07"
    verification:
      - kind: other
        ref: "grep -n useNutritionTargetSignal apps/mobile/components/FoodConfirmSheet.tsx 'apps/mobile/app/(tabs)/nutrition/log.tsx' (both call .getState().bump() after a successful insert)"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-07-13
status: complete
---

# Phase 07 Plan 06: Offline Manual Food Logging Summary

**Search/recents/favorites, custom-food creation, and macro-only quick-add all write frozen `food_log` rows through one shared `FoodConfirmSheet`, fully offline.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-13T22:03:00Z
- **Completed:** 2026-07-13T22:28:00Z
- **Tasks:** 2 completed
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments

- `buildFoodLogRow`/`buildQuickAddRow` (`apps/mobile/lib/logFood.ts`) — pure, native-import-free
  `food_log` row builders that freeze `food.per100g × qtyGrams` at build time (never a live
  join), clamp every numeric input to a safe non-negative value, and are covered by 9 vitest
  cases (150g × 200kcal/100g = 300kcal anchor, quick-add shape, negative/NaN/missing-field
  clamping)
- `FoodConfirmSheet` — the single, food-source-agnostic confirm/edit sheet (meal selector +
  tap-to-type qty + live macro preview) that every logging path in this plan (and the future
  barcode/OCR flows) inserts through
- `nutrition/search.tsx` — debounced local search with recents/favorites surfaced above results
  for ≤3-tap repeat logging (tap food → tap Log food)
- `nutrition/log.tsx` — two-mode entry: custom-food creation (`food` row with `source:'user'`,
  then logged via the shared confirm sheet) and macro-only quick-add (`foodId` null,
  `quickAdd` true, meal-tagged, no confirm sheet needed since there's no serving/qty concept)
- All writes are local-only SQLite inserts — zero network/`fetch` calls anywhere in this plan

## Task Commits

1. **Task 1: Pure logFood row builder (freeze-at-log-time) + tests** - `1aed1bc` (feat)
2. **Task 2: Search + custom-food/quick-add screens + shared FoodConfirmSheet** - `3df9acc` (feat)

**Plan metadata:** (pending — this commit)

## Files Created/Modified

- `apps/mobile/lib/logFood.ts` - pure `buildFoodLogRow`/`buildQuickAddRow` row builders
- `apps/mobile/lib/__tests__/logFood.test.ts` - 9 vitest cases covering the freeze-at-log-time math and every clamp path
- `apps/mobile/components/FoodConfirmSheet.tsx` - shared meal/qty confirm sheet, inserts `food_log`, bumps `nutritionTargetSignal`
- `apps/mobile/app/(tabs)/nutrition/search.tsx` - debounced local search + recents/favorites
- `apps/mobile/app/(tabs)/nutrition/log.tsx` - custom-food creation + quick-add, segmented mode toggle
- `apps/mobile/app/(tabs)/nutrition/index.tsx` - added a "Log food" entry point (Rule 2 deviation)

## Decisions Made

- `logFood.ts` excludes `id`/`createdAt` from its returned row shape — the caller assigns those
  via `expo-crypto`'s `randomUUID` at insert time, keeping the pure builder free of any native
  import (matches `runEntryLogic.ts`'s vitest-testability boundary; verified by
  `grep -c "@apsis/db|expo-" apps/mobile/lib/logFood.ts` returning 0)
- `FoodConfirmSheet` defaults the meal selection from time-of-day (breakfast <11h, lunch <15h,
  dinner <21h, else snack) so the common case needs zero extra taps; the user can still
  override before confirming
- Every segmented control in this plan (meal picker, custom/quick-add mode toggle) uses a bone
  active-fill, not volt — each screen already has exactly one volt-filled primary CTA (Log food /
  Save & log / Quick add), matching the one-volt-per-screen convention established by Nutrition
  Setup's goal-mode selector
- `FoodConfirmSheet`'s open/close is owned exclusively by a `visible`-driven effect (mirrors
  `ExercisePickerSheet.tsx`), avoiding the documented open/close oscillation bug from a
  second state owner

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added a "Log food" entry point to nutrition/index.tsx**
- **Found during:** Task 2 (search + log screens)
- **Issue:** The plan's declared files (`search.tsx`, `log.tsx`, `FoodConfirmSheet.tsx`,
  `logFood.ts`) build the two new nutrition screens, but nothing in the existing app links to
  them — `nutrition/index.tsx` (the tab's landing screen from Plan 07-05) had no navigation
  entry point into `search.tsx`. Without a link, this plan's entire feature surface would be
  unreachable dead code.
- **Fix:** Added a ghost/bone "Log food" button below the macro bars on `nutrition/index.tsx`,
  routing to `/(tabs)/nutrition/search` (which itself links onward to `/(tabs)/nutrition/log`
  for custom-food/quick-add) — one additional tap from the Nutrition tab reaches the full
  logging surface.
- **Files modified:** `apps/mobile/app/(tabs)/nutrition/index.tsx`
- **Verification:** `pnpm --filter @apsis/mobile exec tsc --noEmit` clean; button style matches
  the existing ghost-button convention (`log/index.tsx`'s secondary "Log Run" button, same
  border/transparent-fill treatment) and stays outside the one-volt-per-screen rule (the
  calories bar remains the sole volt-filled element).
- **Committed in:** `3df9acc` (Task 2 commit)

### Fixed During Development (not a deviation from correctness intent)

- The acceptance criterion `grep -c "@apsis/db\|expo-" apps/mobile/lib/logFood.ts` returning 0
  initially failed because the module's own doc comment *mentioned* those strings in prose
  (explaining why the module avoids them) — not because of an actual import. Reworded the
  comment to describe the same constraint without the literal substrings; re-ran the grep to
  confirm 0.

---

**Total deviations:** 1 auto-fixed (1 missing critical — navigation reachability)
**Impact on plan:** The added entry point was necessary for the shipped feature to be usable at
all; no scope creep beyond a single button wired to existing routes.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Offline manual logging (search/recents/favorites/custom-food/quick-add) is fully wired and
  reachable from the Nutrition tab; all writes are meal+date-tagged, denormalized `food_log`
  rows via the shared `FoodConfirmSheet`.
- `pnpm --filter @apsis/mobile test` (53/53 passing, including the 9 new `logFood` cases),
  `pnpm --filter @apsis/mobile exec tsc --noEmit`, and root `pnpm run typecheck` are all clean.
- `FoodConfirmSheet` is intentionally food-source-agnostic — Plan 07-08 (barcode) and 07-09
  (OCR) should reuse it directly rather than building a second confirm surface.
- On-device UAT still needed (deferred per this plan's own verification line: repeat-log a
  favorite in ≤3 taps; create a custom food; quick-add macros; totals update on the nutrition
  tab) — no blockers for continuing to the next nutrition-tracking plan.

---
*Phase: 07-nutrition-tracking*
*Completed: 2026-07-13*
