---
phase: 07-nutrition-tracking
plan: 05
subsystem: ui
tags: [expo-router, zustand, drizzle, nutrition, hss]

# Dependency graph
requires:
  - phase: 07-nutrition-tracking (plans 03, 04)
    provides: packages/db nutritionQueries (searchLocalFoods/recentFoods/favoriteFoods/dayTotals/sessionTypesForDate) + computeNutritionTargetRow; apps/mobile nutritionProfile.ts assembler + useNutritionProfile hook + app/nutrition-setup staged-draft screen
provides:
  - 5th "Nutrition" tab (fork.knife) showing today's adaptive kcal/P/C/F targets vs. logged totals
  - recomputeNutritionTarget(db, localDate) event-driven upsert wrapper (mirrors recomputeLoadDaily)
  - nutritionTargetSignal zustand version counter (mirrors profileVersion)
  - Wiring: finishWorkout.ts (finish + discard) and runEntry.ts both call recomputeNutritionTarget after recomputeLoadDaily
  - Rest-day lazy-compute-on-view fallback in nutrition/index.tsx (Pitfall 5)
affects: [07-06, 07-07, 07-08, 07-09, 07-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Event-driven recompute wrapper (read -> pure-fold -> onConflictDoUpdate loop) mirrors recomputeLoadDaily.ts exactly, keyed on a deterministic id instead of localDate PK"
    - "Lazy-compute-on-view fallback: a focus-gated screen calls the same recompute wrapper directly when no row exists yet for today, rather than requiring a dedicated cron/background trigger"
    - "zustand version-counter cross-screen signal (nutritionTargetSignal) as a useFocusEffect dependency so a background write refreshes a foregrounded screen without a query-invalidation library"

key-files:
  created:
    - apps/mobile/lib/recomputeNutritionTarget.ts
    - apps/mobile/lib/nutritionTargetSignal.ts
    - apps/mobile/app/(tabs)/nutrition/_layout.tsx
    - apps/mobile/app/(tabs)/nutrition/index.tsx
  modified:
    - apps/mobile/app/(tabs)/_layout.tsx
    - apps/mobile/lib/finishWorkout.ts
    - apps/mobile/lib/runEntry.ts

key-decisions:
  - "recomputeNutritionTarget derives NutritionProfile's currentYear from localDate's own year (Number.parseInt(localDate.slice(0,4))) rather than the wall clock, keeping the wrapper's inputs fully caller-supplied like the engine layer it feeds"
  - "Incomplete-profile gate lives inside recomputeNutritionTarget itself (re-checks isNutritionProfileComplete against a fresh DB read), not just at the UI layer -- guarantees the write path can never fabricate a NaN/garbage target even if called from a future non-UI trigger"
  - "nutrition/index.tsx pushes '/nutrition-setup/index' (not the collapsed '/nutrition-setup') -- the literal expo-router's generated typed-routes currently emit for this standalone top-level index route; both resolve to the same screen at runtime"
  - "Kcal is the single volt-accented macro bar (one-volt-per-screen); protein/carb/fat bars use bone fill, matching StatTiles' non-volt convention for supporting metrics"

patterns-established:
  - "Nutrition recompute-on-write + recompute-on-view dual-trigger shape for any future auto-generated daily row that depends on both event data and a fallback default"

requirements-completed: [NUTR-19, NUTR-16, NUTR-17, NUTR-22]

coverage:
  - id: D1
    description: "recomputeNutritionTarget upserts today's nutrition_target row after every session finish/discard, gated on profile completeness, idempotent via onConflictDoUpdate"
    requirement: "NUTR-16"
    verification:
      - kind: other
        ref: "grep -c recomputeNutritionTarget apps/mobile/lib/finishWorkout.ts apps/mobile/lib/runEntry.ts (both non-zero)"
        status: pass
      - kind: other
        ref: "pnpm --filter @apsis/mobile exec tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D2
    description: "5th Nutrition tab registered and routes to the targets-vs-totals screen"
    requirement: "NUTR-19"
    verification:
      - kind: other
        ref: "grep -c 'name=\"nutrition\"' 'apps/mobile/app/(tabs)/_layout.tsx' (1)"
        status: pass
    human_judgment: true
    rationale: "Tab bar rendering, icon correctness, and screen layout on-device are visual/UX judgments no automated check covers -- phase UAT."
  - id: D3
    description: "Nutrition screen gates on an incomplete profile (routes to /nutrition-setup) and shows kcal + P/C/F progress vs. today's target when complete"
    requirement: "NUTR-19"
    verification:
      - kind: other
        ref: "grep -c useFocusEffect 'apps/mobile/app/(tabs)/nutrition/index.tsx' (3)"
        status: pass
    human_judgment: true
    rationale: "Gate-vs-target-display branching and visual correctness require on-device verification per the plan's own Manual (phase UAT) verification line."
  - id: D4
    description: "Rest-day lazy-compute-on-view fallback: recomputeNutritionTarget runs once on focus when no row exists yet for today"
    requirement: "NUTR-17"
    verification:
      - kind: other
        ref: "apps/mobile/app/(tabs)/nutrition/index.tsx loadNutrition() -- targetRows.length===0 branch calls recomputeNutritionTarget then re-queries"
        status: pass
    human_judgment: true
    rationale: "The no-session/rest-day path needs an on-device day with zero logged sessions to observe end-to-end; deferred to phase UAT."
  - id: D5
    description: "No kcal/macro value ever attached to a Sentry breadcrumb/extra/context call"
    requirement: "NUTR-22"
    verification:
      - kind: other
        ref: "Manual review: nutrition/index.tsx and recomputeNutritionTarget.ts only call console.error with hardcoded [Apsis]-prefixed strings, never the loaded totals/target values"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-07-13
status: complete
---

# Phase 07 Plan 05: Nutrition Tab + Recompute Wiring Summary

**5th Nutrition tab showing today's adaptive kcal/P/C/F targets vs. logged totals, wired to recompute on every session finish and lazily on view for rest days.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-13T21:28:36Z
- **Completed:** 2026-07-13T21:37:17Z
- **Tasks:** 2 completed
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments

- `recomputeNutritionTarget(db, localDate)` — the event-driven upsert wrapper mirroring
  `recomputeLoadDaily.ts`'s read → pure-fold → upsert shape exactly, gated on nutrition-profile
  completeness so it never fabricates a target from NULL profile fields
- `finishWorkout.ts` (both `finishWorkout` and `discardWorkout`) and `runEntry.ts`'s `saveRun`
  now call `recomputeNutritionTarget(db, todayLocalDate())` immediately after
  `recomputeLoadDaily`, so today's nutrition target always reflects the freshest `dayHss`
- A 5th "Nutrition" tab (fork.knife icon) renders `apps/mobile/app/(tabs)/nutrition/index.tsx`:
  gates on `useNutritionProfile().complete`, routing to `/nutrition-setup` when incomplete;
  when complete, shows a volt calories bar plus bone protein/carb/fat bars against today's
  `nutrition_target` and `dayTotals`
- Rest-day lazy-compute-on-view fallback: if no `nutrition_target` row exists yet for today when
  the screen focuses, it calls `recomputeNutritionTarget` itself once (idempotent
  `onConflictDoUpdate`), then re-reads — closing the gap where the event-driven trigger alone
  would never produce a target on a day with zero logged sessions
- `nutritionTargetSignal` (zustand version counter, mirrors `profileVersion.ts`) lets the
  nutrition screen refresh after a background logging write without a query-invalidation library

## Task Commits

1. **Task 1: recomputeNutritionTarget wrapper + signal + finish/run wiring** - `abc187d` (feat)
2. **Task 2: 5th Nutrition tab + targets-vs-totals screen (gated + lazy fallback)** - `234e35e` (feat)

**Plan metadata:** (pending — this commit)

## Files Created/Modified

- `apps/mobile/lib/recomputeNutritionTarget.ts` - event-driven read→fold→upsert wrapper around `computeNutritionTargetRow`
- `apps/mobile/lib/nutritionTargetSignal.ts` - zustand version counter bumped after a successful upsert
- `apps/mobile/lib/finishWorkout.ts` - both terminal actions now also recompute today's nutrition target
- `apps/mobile/lib/runEntry.ts` - `saveRun` now also recomputes today's nutrition target
- `apps/mobile/app/(tabs)/_layout.tsx` - registers the 5th `Tabs.Screen name="nutrition"`
- `apps/mobile/app/(tabs)/nutrition/_layout.tsx` - plain Stack, matches the Log tab-group convention
- `apps/mobile/app/(tabs)/nutrition/index.tsx` - the gated targets-vs-totals screen with lazy rest-day fallback

## Decisions Made

- `recomputeNutritionTarget` derives `currentYear` from `localDate`'s own year rather than the
  wall clock, keeping the wrapper's inputs fully caller-supplied (matches the engine-purity
  spirit one layer up, even though this app-layer wrapper is not itself `packages/engine`)
- The incomplete-profile gate is re-checked inside `recomputeNutritionTarget` against a fresh DB
  read (not just trusted from the UI's `useNutritionProfile` hook state) — guarantees the write
  path can never fabricate a NaN/garbage target even if called from a future non-UI trigger
- `nutrition/index.tsx` pushes `/nutrition-setup/index` rather than the collapsed
  `/nutrition-setup` — expo-router's currently-generated typed-routes `.d.ts` only emits the
  `/index`-suffixed literal for this standalone top-level route (both resolve to the same
  screen at runtime; documented inline per the Phase 06 typed-route-adaptation precedent)
- Kcal is the sole volt-accented macro bar; protein/carb/fat bars use bone fill, keeping the
  screen inside DESIGN-SYSTEM.md's one-volt-per-screen rule (same pattern as `StatTiles`)

## Deviations from Plan

None - plan executed exactly as written. (The `/nutrition-setup/index` route literal above is
an implementation detail forced by the currently-generated typed-routes file, not a deviation
from the plan's intent — the CTA still routes to the Nutrition Setup screen exactly as specified.)

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The nutrition tab, recompute wiring, and rest-day fallback are all in place and typecheck/test
  clean (`pnpm --filter @apsis/mobile exec tsc --noEmit`, root `pnpm run typecheck`, and
  `pnpm --filter @apsis/mobile test` — 44/44 passing).
- On-device UAT still needed (deferred per this plan's own verification line: "Manual (phase
  UAT): tab appears; incomplete profile → setup; complete profile → targets vs totals; a rest
  day still shows a target") — no blockers for continuing to the next nutrition-tracking plan
  (manual food logging surfaces: search/recents/favorites/quick-add), which is the natural next
  consumer of this screen's `dayTotals` read.

---
*Phase: 07-nutrition-tracking*
*Completed: 2026-07-13*

## Self-Check: PASSED

- All created files verified present on disk via `[ -f ]`.
- All three commit hashes (`abc187d`, `234e35e`, `83e668d`) verified present via `git log --oneline --all`.
- All task-level `<acceptance_criteria>` grep/tsc checks re-run and passed.
- Plan-level `<verification>` re-run: `pnpm --filter @apsis/mobile test` (44/44 passed), root `pnpm run typecheck` clean, `pnpm --filter @apsis/mobile exec tsc --noEmit` clean.
