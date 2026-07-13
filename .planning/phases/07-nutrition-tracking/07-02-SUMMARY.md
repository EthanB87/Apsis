---
phase: 07-nutrition-tracking
plan: 02
subsystem: engine
tags: [nutrition, macros, bmr, engine, tdd, golden-file]

# Dependency graph
requires:
  - phase: 02-hss-engine
    provides: EngineConfig/mergeConfig convention, kStrength/kCarry-style provenance-comment discipline, golden-file calibration testing precedent
provides:
  - "DayType, NutritionProfile, MacroTargetResult types in @apsis/shared"
  - "13 new EngineConfig nutrition constants with provenance comments"
  - "classifyDayType, trainingKcalFromHss, dailyMacroTarget pure functions in @apsis/engine"
  - "5 golden-file tests locking the adaptive-target formula's real output"
affects: [07-nutrition-schema-db-layer, 07-nutrition-ui, 07-nutrition-target-recompute]

# Tech tracking
tech-stack:
  added: []
  patterns: ["day-type adaptive macro target model (07-RESEARCH.md Pattern 4)"]

key-files:
  created:
    - packages/engine/src/nutrition.ts
    - packages/engine/src/__tests__/nutrition.test.ts
  modified:
    - packages/shared/src/index.ts
    - packages/engine/src/config.ts
    - packages/engine/src/index.ts

key-decisions:
  - "07-RESEARCH.md Pattern 4 implemented verbatim as the adaptive-target model since NUTRITION.md's referenced PRD §6 does not exist in this repo"
  - "kcal is computed independently of the fat-floor clamp (only c/f are adjusted), so cut/bulk kcal deltas and sessionKcal additivity hold exactly even when the clamp fires elsewhere"
  - "'other' sex uses -78 BMR constant (midpoint of male +5 / female -161) per 07-RESEARCH A2 assumption"

patterns-established:
  - "Nutrition EngineConfig constants follow kStrength/kCarry's provenance-comment convention: literature source or heuristic status + which golden test calibrates it"

requirements-completed: [NUTR-16, NUTR-17, NUTR-18]

coverage:
  - id: D1
    description: "NutritionProfile/DayType/MacroTargetResult types + 13 new tunable EngineConfig fields (protein/neat/kcal-delta/carb/fat-floor) with provenance comments"
    requirement: "NUTR-16"
    verification:
      - kind: other
        ref: "pnpm --filter @apsis/shared exec tsc --noEmit"
        status: pass
      - kind: other
        ref: "grep -cE 'export type DayType|export interface NutritionProfile|export interface MacroTargetResult' packages/shared/src/index.ts (== 3)"
        status: pass
      - kind: other
        ref: "grep -cE 'proteinGPerKgCut|kcalPerHssPoint|carbGPerKgLongRun|fatFloorGPerKg' packages/engine/src/config.ts (== 8)"
        status: pass
    human_judgment: false
  - id: D2
    description: "classifyDayType, trainingKcalFromHss, dailyMacroTarget pure functions with 5 golden-file macro-target cases + 5 classifyDayType branches, re-exported from the @apsis/engine barrel"
    requirement: "NUTR-16, NUTR-17, NUTR-18"
    verification:
      - kind: unit
        ref: "packages/engine/src/__tests__/nutrition.test.ts (13 tests, all passing)"
        status: pass
      - kind: other
        ref: "pnpm --filter @apsis/engine test (full suite, 94 tests passing)"
        status: pass
      - kind: other
        ref: "root pnpm typecheck (tsc --build, clean)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-07-13
status: complete
---

# Phase 07 Plan 02: Nutrition Engine (Adaptive Macro Targets) Summary

**Pure `dailyMacroTarget`/`classifyDayType`/`trainingKcalFromHss` functions in `@apsis/engine`, implementing 07-RESEARCH.md's Mifflin-St Jeor + day-type-carb + fat-floor-clamp formula with 5 golden-file tests locking real computed output.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-13T20:51:08Z (approx, following 07-01 completion)
- **Completed:** 2026-07-13T21:01:01Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- Extended `@apsis/shared`'s `EngineConfig` with 13 new tunable nutrition constants (protein g/kg by goal mode, NEAT multiplier, cut/bulk kcal deltas, kcal-per-HSS-point, day-type carb g/kg rates, fat floor g/kg) and added `DayType`/`NutritionProfile`/`MacroTargetResult` types.
- Added matching `DEFAULT_CONFIG` values in `packages/engine/src/config.ts` with provenance comments (literature source or heuristic status, plus which golden test calibrates each constant), following the `kStrength`/`kCarry` convention exactly.
- Implemented `classifyDayType` (day-type classification mirroring `dailyHSS`'s `>1`-session-wins precedence), `trainingKcalFromHss` (day HSS → added training kcal, clamped/defended), and `dailyMacroTarget` (the full adaptive-target formula: Mifflin-St Jeor BMR, NEAT, goal-mode kcal delta, day-type carbs, fat-floor clamp) in `packages/engine/src/nutrition.ts`.
- Wrote 5 golden-file test cases with real computed numbers (not hand-waved) covering: maintain+rest sanity range, cut+heavy_lift kcal-delta/protein-share, bulk+double highest-carb/sessionKcal-additivity, invalid-bodyweight all-zero+warning, and an extreme-cut fat-floor-clamp case — plus all 5 `classifyDayType` branches and `trainingKcalFromHss` clamping. All 13 tests pass; full engine suite (94 tests) stays green.

## Task Commits

Each task followed the TDD RED→GREEN cycle:

1. **Task 1: Add nutrition types + EngineConfig constants** - `05effc6` (feat)
2. **Task 2 RED: failing golden-file test for nutrition engine functions** - `51b777a` (test)
2. **Task 2 GREEN: implement nutrition engine functions** - `21b954f` (feat)

**Plan metadata:** _pending (this commit)_

_No refactor commit was needed — the GREEN implementation matched the intended pure-function shape without further cleanup._

## Files Created/Modified

- `packages/shared/src/index.ts` - Added `DayType`, `NutritionProfile`, `MacroTargetResult` types; extended `EngineConfig` with 13 nutrition fields
- `packages/engine/src/config.ts` - Added 13 `DEFAULT_CONFIG` nutrition values with provenance doc comments
- `packages/engine/src/nutrition.ts` - New: `classifyDayType`, `trainingKcalFromHss`, `dailyMacroTarget`, private `mifflinStJeorBmr`
- `packages/engine/src/__tests__/nutrition.test.ts` - New: 5 golden-file macro-target cases + classifyDayType/trainingKcalFromHss unit tests
- `packages/engine/src/index.ts` - Added `export * from './nutrition'` to the public barrel

## Decisions Made

- Implemented 07-RESEARCH.md Pattern 4 verbatim as the adaptive-target model, since NUTRITION.md's referenced "PRD §6 nutrition model" does not exist anywhere in this repo (confirmed by the research phase via grep across the working tree).
- Confirmed via direct testing that the fat-floor clamp only reassigns `c`/`f`, never `kcal` — so cut/bulk kcal-delta and sessionKcal-additivity properties hold exactly (bit-for-bit after rounding) regardless of whether a given test case happens to trip the clamp.
- Chose golden-test input profiles/session-kcal values deliberately to keep cases 1–4 unclamped (isolating the fat-floor-clamp behavior to case 5 only), after discovering via direct computation that the model's default constants clamp fairly easily on cut days with moderate training loads — a real, informative property of the constants as currently tuned, not a bug.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' `<action>`, `<behavior>`, and `<acceptance_criteria>` were followed precisely; all constant values and formula shape match 07-RESEARCH.md Pattern 4 exactly (Mifflin-St Jeor BMR, 'other' sex constant -78, kcal rounded to nearest 5, p/c/f rounded to nearest integer).

## Issues Encountered

- `pnpm --filter @apsis/engine exec tsc --noEmit` initially failed with "Module has no exported member 'DayType'" etc. even though `packages/shared/src/index.ts` had the new types. Root cause: this monorepo's TS composite-project-reference setup resolves `@apsis/shared` imports against `packages/shared/dist/*.d.ts` (built declaration output), not live `src/`, matching a documented Phase 03 finding (STATE.md: "TS project-reference redirect... resolves @apsis/db imports to packages/db/dist declarations, not live src"). Running root `pnpm typecheck` (`tsc --build`) rebuilt `packages/shared/dist` with the new declarations, after which both the per-package `tsc --noEmit` and the root build passed clean. No code change was needed — this is expected, pre-existing project behavior, not a defect introduced by this plan. All three plan-level `<verification>` commands (engine test suite, engine `tsc --noEmit`, root `pnpm typecheck`) are now green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `dailyMacroTarget`/`classifyDayType`/`trainingKcalFromHss` are ready to be consumed by the DB/query layer (`packages/db/src/nutritionTarget.ts`, per 07-PATTERNS.md) once the nutrition schema (07-01, already complete) and a recompute-on-write wrapper are wired up.
- No blockers for downstream plans. The engine layer for NUTR-16/17/18 is complete and independently testable — UI/DB plans can import `@apsis/engine`'s new exports directly.

---
*Phase: 07-nutrition-tracking*
*Completed: 2026-07-13*

## Self-Check: PASSED

- Verified on disk: `packages/engine/src/nutrition.ts`, `packages/engine/src/__tests__/nutrition.test.ts`, `.planning/phases/07-nutrition-tracking/07-02-SUMMARY.md`
- Verified in git log: `05effc6` (types+config), `51b777a` (RED test), `21b954f` (GREEN implementation), `91e702f` (SUMMARY commit)
