---
phase: 07-nutrition-tracking
plan: 03
subsystem: database
tags: [drizzle, sqlite, better-sqlite3, nutrition, query-builders]

# Dependency graph
requires:
  - phase: 07-nutrition-tracking (plan 01)
    provides: food/food_log/recipe/recipe_ingredient/nutrition_target schema + migration 0004, better-sqlite3 test harness
  - phase: 07-nutrition-tracking (plan 02)
    provides: "@apsis/engine classifyDayType/trainingKcalFromHss/dailyMacroTarget + NutritionProfile/DayType/MacroTargetResult shared types"
provides:
  - "Local-first food-cache query builders: searchLocalFoods, recentFoods, favoriteFoods"
  - "Joinless day-totals aggregate: dayTotals"
  - "Day-type session query: sessionTypesForDate"
  - "Pure nutrition_target upsert-row builder: computeNutritionTargetRow"
affects: [07-nutrition-tracking (logging UI, recompute-on-write wrapper, day-type target screens)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Query-builder-factory pattern (queries.ts convention) applied to nutrition: parameterized like()/sql-aggregate builders taking QueryableDB as first param"
    - "Pure recompute-row-builder pattern (loadDaily.ts convention) applied to nutrition: computeNutritionTargetRow has zero DB imports and never reads Date.now()"
    - "Deterministic id derivation (auto-{localDate}) to keep a pure function upsert-safe without generating randomness"

key-files:
  created:
    - packages/db/src/nutritionQueries.ts
    - packages/db/src/nutritionTarget.ts
    - packages/db/src/__tests__/nutrition-queries.test.ts
  modified:
    - packages/db/src/index.ts

key-decisions:
  - "computeNutritionTargetRow derives a deterministic id (auto-{localDate}) rather than accepting an id parameter or generating a random UUID — keeps the function pure/deterministic while giving the future upsert wrapper a stable onConflictDoUpdate target for the day's auto row, leaving any 'override' row (different id) untouched"
  - "nutrition-queries.test.ts reuses nutrition-schema.test.ts's real in-memory better-sqlite3 + committed-migration harness instead of the sqlite-proxy .toSQL()-shape pattern used elsewhere in this package, since search/ordering/aggregate correctness needs actual query results, not just SQL shape"

patterns-established:
  - "Real-SQLite integration test harness (better-sqlite3 + applyCommittedMigrations) is now used by two test files (nutrition-schema.test.ts, nutrition-queries.test.ts) — the harness function itself is duplicated per-file rather than extracted to a shared test-util, matching this package's existing convention of small self-contained test files"

requirements-completed: [NUTR-02, NUTR-04, NUTR-07, NUTR-17]

coverage:
  - id: D1
    description: "searchLocalFoods/recentFoods/favoriteFoods: parameterized food-cache query builders (search by name/brand, recents by max(created_at), favorites by log frequency)"
    requirement: "NUTR-02, NUTR-04"
    verification:
      - kind: unit
        ref: "packages/db/src/__tests__/nutrition-queries.test.ts#searchLocalFoods / recentFoods / favoriteFoods"
        status: pass
    human_judgment: false
  - id: D2
    description: "dayTotals: joinless SUM(kcal/p/c/f) aggregate over food_log for a localDate, coalesced to zero on an empty date"
    requirement: "NUTR-07"
    verification:
      - kind: unit
        ref: "packages/db/src/__tests__/nutrition-queries.test.ts#dayTotals"
        status: pass
    human_judgment: false
  - id: D3
    description: "sessionTypesForDate: finished, non-deleted workout.type rows for a localDate, feeding classifyDayType"
    requirement: "NUTR-17"
    verification:
      - kind: unit
        ref: "packages/db/src/__tests__/nutrition-queries.test.ts#sessionTypesForDate"
        status: pass
    human_judgment: false
  - id: D4
    description: "computeNutritionTargetRow: pure fold of session types + dayHss through classifyDayType/trainingKcalFromHss/dailyMacroTarget into an upsert-ready nutrition_target row"
    requirement: "NUTR-17"
    verification:
      - kind: unit
        ref: "packages/db/src/__tests__/nutrition-queries.test.ts#computeNutritionTargetRow"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-07-13
status: complete
---

# Phase 07 Plan 03: Nutrition Data-Access Layer Summary

**Parameterized local-first query builders (search/recents/favorites/day-totals/day-type) plus a pure `computeNutritionTargetRow` fold over `@apsis/engine`'s nutrition functions, mirroring `queries.ts`/`loadDaily.ts` conventions exactly.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-13T21:03:00Z
- **Completed:** 2026-07-13T21:12:00Z
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- `searchLocalFoods`/`recentFoods`/`favoriteFoods` — parameterized food-cache builders (case-insensitive name/brand LIKE search; recents by grouped `max(created_at)`; favorites by grouped `count(*)`), all with `query`/limit values bound via drizzle's parameterized API, never interpolated into a raw `sql` template
- `dayTotals` — joinless `SUM(kcal/p/c/f)` over `food_log` for a `localDate`, `coalesce`d to zero so an empty/rest day never surfaces `null`/`NaN`
- `sessionTypesForDate` — finished, non-deleted `workout.type` rows for a date, reusing `activeWorkoutFilter` (D-28) rather than hand-rolling a soft-delete filter
- `computeNutritionTargetRow` — pure fold: session types → `classifyDayType` → `DayType`, `dayHss` → `trainingKcalFromHss` → session kcal add, then `dailyMacroTarget(profile, dayType, sessionKcal)` → an upsert-ready `nutrition_target` row (`id`, `localDate`, `dayType`, `kcal`, `proteinG`, `carbG`, `fatG`, `source: 'auto'`); zero DB imports, never reads `Date.now()`
- All five functions re-exported from `packages/db/src/index.ts`
- 13 tests in `nutrition-queries.test.ts`, all running against a real in-memory better-sqlite3 database with the committed drizzle migrations applied (not just `.toSQL()` shape assertions), including a `%`/`'`-in-name parameterization-proof case

## Task Commits

Each task was committed atomically:

1. **Task 1: nutritionQueries.ts parameterized builders + tests** - `a485bb3` (feat)
2. **Task 2: nutritionTarget.ts pure row builder + tests** - `9ea463b` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `packages/db/src/nutritionQueries.ts` - 5 parameterized query builders: searchLocalFoods, recentFoods, favoriteFoods, dayTotals, sessionTypesForDate
- `packages/db/src/nutritionTarget.ts` - pure computeNutritionTargetRow + NutritionTargetUpsertRow type
- `packages/db/src/__tests__/nutrition-queries.test.ts` - 13 tests over a real migrated in-memory SQLite database
- `packages/db/src/index.ts` - barrel re-exports for both new modules

## Decisions Made

- `computeNutritionTargetRow` derives a deterministic `id = auto-{localDate}` rather than taking an `id` parameter (the plan's signature literally listed 4 params but the target row shape needs an `id`). This keeps the function pure (no randomness, no wall clock) while giving the future recompute wrapper a stable `onConflictDoUpdate` target for the day's single auto-generated row — a coexisting `'override'` row (different, caller-chosen id) is never touched by this collision.
- Test file reuses the real-SQLite (`better-sqlite3` + committed-migration) harness from `nutrition-schema.test.ts` rather than the `sqlite-proxy` `.toSQL()`-shape pattern used by the rest of this package's query-builder tests — necessary because `dayTotals`/`recentFoods`/`favoriteFoods`/`searchLocalFoods` need actual ordering/aggregate *results* to prove correctness (the plan's phase context explicitly authorized reusing this harness).

## Deviations from Plan

None - plan executed exactly as written. The only interpretation call was the `computeNutritionTargetRow` id derivation (documented above under Decisions Made, not a deviation from correctness/security rules — no auto-fix rule applied, it's a design choice within the plan's stated output shape).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The local-first nutrition data-access layer (search/recents/favorites/day-totals/day-type-session-query + pure target-row builder) is complete and tested; no raw SQL interpolation anywhere.
- Ready for the next plan in Wave 2/3: the op-sqlite recompute-on-write wrapper (`recomputeNutritionTarget.ts`, mirroring `recomputeLoadDaily.ts`) and the logging UI screens can now consume these five builders directly from the `@apsis/db` barrel.
- No blockers.

---
*Phase: 07-nutrition-tracking*
*Completed: 2026-07-13*

## Self-Check: PASSED

- FOUND: packages/db/src/nutritionQueries.ts
- FOUND: packages/db/src/nutritionTarget.ts
- FOUND: packages/db/src/__tests__/nutrition-queries.test.ts
- FOUND: commit a485bb3 (Task 1)
- FOUND: commit 9ea463b (Task 2)
- `pnpm --filter @apsis/db test` — 9 test files, 55 tests, all passed
- Root `pnpm typecheck` — clean
