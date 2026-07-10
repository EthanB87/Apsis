---
phase: 04-run-logger-home-dashboard
plan: 09
subsystem: ui
tags: [react-native-reanimated, worklet, victory-native, drizzle-orm, op-sqlite, sqlite]

# Dependency graph
requires:
  - phase: 04-run-logger-home-dashboard
    provides: TrendChart component (04-08) and recomputeLoadDaily (04-01) that this plan patches
provides:
  - Worklet-safe TrendChart scrub tooltip (formatSignedTsb runs on the UI thread without throwing)
  - Delete-aware recomputeLoadDaily (empty-set full clear + notInArray range-shrink cleanup)
affects: [04-10, phase-04-verification, future-history-detail-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Worklet directive on module-scope helper functions called from inside useDerivedValue bodies (not just the outer worklet)"
    - "Upsert-only recompute functions paired with an explicit stale-row DELETE cleanup for soft-delete data flows (D-29)"

key-files:
  created: []
  modified:
    - apps/mobile/components/home/TrendChart.tsx
    - apps/mobile/lib/recomputeLoadDaily.ts

key-decisions:
  - "formatSignedTsb kept as a standalone helper (not inlined) with a 'worklet' directive added, per the plan's preferred fix form"
  - "recomputeLoadDaily's cleanup DELETE stays sequential (non-transactional), issued immediately before the upsert loop -- drizzle-orm's op-sqlite session.transaction() callback is synchronous (returns T, not Promise<T>), incompatible with this function's async upsert loop, so the plan's explicit fallback applies"

patterns-established:
  - "D-29 discarded-session invariant: any recompute function reading from a soft-deleted source table must delete stale downstream rows, not just upsert current ones"

requirements-completed: [HOME-01, HOME-02, HOME-03]

coverage:
  - id: D1
    description: "TrendChart scrub tooltip no longer crashes on first touch -- formatSignedTsb runs as a worklet"
    requirement: "HOME-03"
    verification:
      - kind: unit
        ref: "apps/mobile: npx tsc --noEmit (no new errors)"
        status: pass
    human_judgment: true
    rationale: "The crash only reproduces on-device during an actual chart scrub gesture (UI-thread worklet exception); tsc/vitest cannot exercise the Reanimated UI runtime. On-device confirmation is listed in 04-VERIFICATION.md's human-verification checklist."
  - id: D2
    description: "recomputeLoadDaily deletes load_daily rows on empty input (last session deleted) and cleans up out-of-range rows via notInArray (earliest session deleted)"
    requirement: "HOME-01"
    verification:
      - kind: unit
        ref: "packages/db: pnpm test -- --run (27 tests pass, computeLoadDailyUpsertRows unchanged)"
        status: pass
      - kind: unit
        ref: "apps/mobile: npx tsc --noEmit (no new errors)"
        status: pass
    human_judgment: true
    rationale: "recomputeLoadDaily itself opens a native op-sqlite JSI connection and is out of scope for the apps/mobile vitest harness (lib/** pure modules only). The delete-then-view and earliest-session-delete regressions require an on-device pass, per 04-VERIFICATION.md."

duration: 6min
completed: 2026-07-10
status: complete
---

# Phase 04 Plan 09: TrendChart Worklet Fix + recomputeLoadDaily Delete Cleanup Summary

**Fixed the TrendChart scrub-tooltip UI-thread crash (missing 'worklet' directive) and made recomputeLoadDaily delete-aware so discarded sessions no longer leave ghost HSS/readiness rows in load_daily.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-10T23:13:00Z
- **Completed:** 2026-07-10T23:15:24Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- CR-01 closed: `formatSignedTsb` now carries the `'worklet'` directive, so the `tooltipText` `useDerivedValue` in TrendChart no longer calls a non-worklet host function on the UI thread during a chart scrub
- CR-02 closed: `recomputeLoadDaily` now fully clears `load_daily` when no finished sessions remain, and deletes any previously-persisted row outside the freshly computed date range via a parameterized `notInArray` before the upsert loop
- Both fixes verified against `packages/db`'s full 27-test suite and `apps/mobile`'s existing 9 lib tests with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Make the TrendChart scrub tooltip worklet-safe (CR-01)** - `cdc1ef5` (fix)
2. **Task 2: Delete stale load_daily rows on recompute (CR-02)** - `b64f90f` (fix)

## Files Created/Modified
- `apps/mobile/components/home/TrendChart.tsx` - Added `'worklet'` directive to `formatSignedTsb`, keeping its sign-formatting behavior and call site inside `tooltipText`'s `useDerivedValue` unchanged
- `apps/mobile/lib/recomputeLoadDaily.ts` - Empty-set path now issues `database.delete(loadDaily)` instead of a bare return; added a `notInArray(loadDaily.localDate, keep)` cleanup DELETE (imported `notInArray` from `drizzle-orm`) run immediately before the existing per-row literal-value upsert loop; updated file-level and function docstrings to document the D-29 delete-aware contract

## Decisions Made
- Kept `formatSignedTsb` as a standalone helper with a `'worklet'` directive rather than inlining it into the `tooltipText` worklet body (plan's preferred approach; single formatter, no duplicated sign-formatting logic)
- Used the sequential (non-transactional) form for the cleanup DELETE + upsert loop, per the plan's explicit fallback: confirmed via `node_modules/drizzle-orm/op-sqlite/session.d.ts` that `transaction<T>(cb: (tx) => T)` returns `T` synchronously (not `Promise<T>`), which is incompatible with wrapping this function's existing `await`-based upsert loop. The cleanup DELETE is issued immediately before the upsert loop to minimize the read/write window, as the plan specifies for this fallback case.

## Deviations from Plan

None - plan executed exactly as written. The transaction-vs-sequential fork was an explicit decision point built into the plan's own instructions ("If the op-sqlite/drizzle transaction API surface is uncertain at implementation time, keep the sequential form"), not an unplanned deviation.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Both CR-01 and CR-02 blocking verification gaps from 04-REVIEW.md are closed at the source-code and automated-test level. Three on-device human-verification checks remain open (scrub tooltip render, delete-then-view regression, earliest-session-delete regression) — these were already flagged as "Human Verification Required" in 04-VERIFICATION.md prior to this plan and are unaffected by anything in this plan's scope; they should be exercised during the next on-device UAT pass for Phase 04 (alongside plan 04-10's WR-05/07/08 gap closures).

---
*Phase: 04-run-logger-home-dashboard*
*Completed: 2026-07-10*

## Self-Check: PASSED

- FOUND: apps/mobile/components/home/TrendChart.tsx
- FOUND: apps/mobile/lib/recomputeLoadDaily.ts
- FOUND: .planning/phases/04-run-logger-home-dashboard/04-09-SUMMARY.md
- FOUND: cdc1ef5 (Task 1 commit)
- FOUND: b64f90f (Task 2 commit)
