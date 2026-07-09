---
phase: 03-onboarding-lifting-logger
plan: 01
subsystem: engine
tags: [vitest, pure-ts, hss, rep-max-table, loaded-carry, unit-conversion]

# Dependency graph
requires:
  - phase: 02-hss-engine
    provides: strengthStressDetailed/enduranceStressDetailed/sessionHSSDetailed clamp-and-warn
      pattern (D-15), Detailed+facade convention (D-05), DEFAULT_CONFIG calibration-anchor
      style (kStrength/kEndurance)
provides:
  - estimateE1RMFromRepMaxTable(Detailed) — bodyweight-movement e1RM via rep-max table (D-18)
  - carryStress(Detailed) — loaded-carry/sled stress (D-20), kCarry tuned via golden test
  - sessionHSSDetailed folds carrySets into hss = ss + es + cs
  - @apsis/shared units.ts — lb<->kg, km<->mi, pace sec/km<->sec/mi exact display conversions (D-12)
  - @apsis/shared CarrySet/CarryStressDetail types, EngineConfig.kCarry, SessionInput.carrySets,
    SessionHSSResult.cs
  - packages/shared vitest harness (first test infra for @apsis/shared)
affects: [03-02, 03-03, 03-04, 03-05, onboarding, lifting-logger, unit-display]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "bodyweight.ts mirrors strength.ts's Detailed+facade, clamp-and-warn (D-15), never-throw
      discipline exactly, but replaces Epley/Brzycki with a table+interpolation to avoid
      high-rep divergence (Pitfall 3)"
    - "carry.ts clones enduranceStressDetailed's shape; load-vs-bodyweight multiplier is
      itself clamped via clampRange to guard a zero/negative bodyweight to a neutral 1x"
    - "units.ts is a zero-dependency pure module — storage always stays metric, display-only
      conversion happens at the UI boundary (D-05/D-12)"

key-files:
  created:
    - packages/engine/src/bodyweight.ts
    - packages/engine/src/carry.ts
    - packages/engine/src/__tests__/bodyweight.test.ts
    - packages/engine/src/__tests__/carry.test.ts
    - packages/shared/src/units.ts
    - packages/shared/src/__tests__/units.test.ts
    - packages/shared/vitest.config.mts
  modified:
    - packages/engine/src/config.ts
    - packages/engine/src/session.ts
    - packages/engine/src/index.ts
    - packages/engine/src/__tests__/session.test.ts
    - packages/shared/src/index.ts
    - packages/shared/package.json
    - packages/shared/tsconfig.json

key-decisions:
  - "kCarry = 10 (D-20): tuned so a 4x40m heavy farmer's carry (~20s/set, load = 1.5x
    bodyweight, RPE 8) sums to ~21.3 total CS — inside the (8, 60) hard-accessory band, well
    under the ~100 HSS threshold-run anchor"
  - "REP_MAX_TABLE floor row at 30 reps (pct 0.45) — reps above 30 clamp to this row instead
    of extrapolating, per D-18/Pitfall 3"
  - "carryStressDetailed guards a zero/negative bodyweightKg to a neutral 1x load-ratio
    rather than dividing by zero (mirrors the engine's `!(x>0)` NaN-safe idiom)"
  - "packages/shared/tsconfig.json now excludes src/**/__tests__ from the project build,
    mirroring packages/engine's existing tsconfig — this was a pre-existing gap only exposed
    once @apsis/shared got its first test file"

patterns-established:
  - "New engine compute modules (bodyweight.ts, carry.ts) both follow strict RED/GREEN TDD:
    a failing-test commit followed by an implementation commit, matching the git history
    convention already established in Phase 02"

requirements-completed: [ONB-04, LIFT-02, LIFT-08]

coverage:
  - id: D1
    description: "estimateE1RMFromRepMaxTable(Detailed) — bodyweight-movement e1RM from a
      rep-max table that clamps at a hard 30-rep floor instead of extrapolating Epley/Brzycki"
    requirement: "LIFT-02"
    verification:
      - kind: unit
        ref: "packages/engine/src/__tests__/bodyweight.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "carryStress(Detailed) — loaded-carry/sled stress from load+duration+RPE,
      with a 4x40m heavy farmer's carry golden test landing well under the ~100 HSS
      threshold-run anchor"
    requirement: "LIFT-02"
    verification:
      - kind: unit
        ref: "packages/engine/src/__tests__/carry.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "sessionHSSDetailed composes strength sets, endurance segments, AND timed
      carry sets into one session HSS (hss = ss + es + cs)"
    requirement: "LIFT-08"
    verification:
      - kind: unit
        ref: "packages/engine/src/__tests__/session.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Pure km<->mi and kg<->lb display conversions round-trip exactly (225 lb
    never displays as 224.9)"
    requirement: "ONB-04"
    verification:
      - kind: unit
        ref: "packages/shared/src/__tests__/units.test.ts"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-07-09
status: complete
---

# Phase 3 Plan 01: Engine Additions + Units Module Summary

**Bodyweight rep-max-table e1RM (D-18), loaded-carry stress (D-20) folded into session HSS, and a pure km/kg display-conversion module in @apsis/shared with its own vitest harness**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-09T19:39:21Z
- **Completed:** 2026-07-09T19:45:49Z
- **Tasks:** 3
- **Files modified:** 14 (7 created, 7 modified, across packages/engine and packages/shared)

## Accomplishments
- `estimateE1RMFromRepMaxTable`/`Detailed` (D-18): a rep-max table with linear interpolation
  between rows and a hard 30-rep floor, replacing bare Epley/Brzycki for bodyweight movements
  so a 25-rep push-up set no longer produces an inflated or undefined e1RM
- `carryStress`/`Detailed` (D-20): loaded-carry/sled stress from duration + RPE + a
  load-vs-bodyweight multiplier, with `kCarry` tuned (=10) so a 4x40m heavy farmer's carry
  lands ~21.3 total — well under the ~100 HSS threshold-run anchor
- `sessionHSSDetailed` now folds `carrySets` into `hss = ss + es + cs`, so a hybrid
  lifting+carry session gets one honest combined number
- `@apsis/shared/units.ts`: `lbToKgExact`/`kgToDisplayLb`, `kmToDisplayMi`/`miToKmExact`,
  `paceSecPerKmToSecPerMi`/`paceSecPerMiToSecPerKm` — storage stays metric, display converts,
  and 225 lb round-trips to exactly 225 (never 224.9)
- Stood up `@apsis/shared`'s first vitest harness (`vitest.config.mts`, test script + devDeps)

## Task Commits

Each task was committed with a strict RED/GREEN TDD split, matching Phase 02's established
git history convention:

1. **Task 1: Extend @apsis/shared types + pure units module + shared vitest harness**
   - `0bebba3` test(03-01): add failing tests for @apsis/shared units module (RED)
   - `87d680b` feat(03-01): implement @apsis/shared units module + extend types (GREEN)
2. **Task 2: Bodyweight rep-max e1RM estimator (D-18)**
   - `84a3866` test(03-01): add failing test for bodyweight e1RM rep-max table (RED)
   - `fa9e257` feat(03-01): implement bodyweight rep-max table e1RM estimator (GREEN)
3. **Task 3: Loaded-carry/sled stress (D-20) + kCarry config + session composition**
   - `5549ed0` test(03-01): add failing tests for carry stress + session composition (RED)
   - `d588892` feat(03-01): implement carry stress + kCarry + session composition (GREEN)

**Plan metadata:** _(to be added — final docs commit)_

## Files Created/Modified
- `packages/engine/src/bodyweight.ts` - REP_MAX_TABLE + interpolateRepMaxPct +
  estimateE1RMFromRepMaxTable(Detailed) (D-18)
- `packages/engine/src/carry.ts` - carryStress(Detailed): duration*RPE²*kCarry*loadRatio (D-20)
- `packages/engine/src/config.ts` - add `kCarry: 10` to DEFAULT_CONFIG with calibration comment
- `packages/engine/src/session.ts` - sessionHSSDetailed sums carrySets into `cs`; `hss = ss+es+cs`
- `packages/engine/src/index.ts` - barrel exports for `./bodyweight` and `./carry`
- `packages/engine/src/__tests__/bodyweight.test.ts` - table lookup, interpolation, floor clamp
- `packages/engine/src/__tests__/carry.test.ts` - clamp robustness + D-20 golden test
- `packages/engine/src/__tests__/session.test.ts` - carry-only + strength+carry composition cases
- `packages/shared/src/units.ts` - pure km<->mi, kg<->lb, pace conversions (D-05/D-12)
- `packages/shared/src/__tests__/units.test.ts` - exact round-trip + tolerance tests
- `packages/shared/src/index.ts` - CarrySet, CarryStressDetail, kCarry, carrySets?, cs?; re-export units
- `packages/shared/package.json` - test script + vitest/typescript/vite devDeps
- `packages/shared/vitest.config.mts` - new shared vitest harness (no workspace-alias needed)
- `packages/shared/tsconfig.json` - exclude `src/**/__tests__` (fix, see Deviations)

## Decisions Made
- `kCarry = 10`, chosen so the D-20 golden anchor (4x40m heavy farmer's carry) lands ~21.3
  total CS, comfortably inside the required (8, 60) hard-accessory band
- REP_MAX_TABLE uses the plan's exact row set (1/1.0 ... 30/0.45) with 30 as a hard floor —
  no extrapolation past that row, per Pitfall 3
- `carryStressDetailed`'s load-ratio guard treats any non-positive `bodyweightKg` as a
  neutral 1x multiplier rather than dividing by zero, matching the engine's existing
  NaN-safe `!(x>0)` idiom used elsewhere (e.g. `strength.ts`'s e1rmKg guard)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed packages/shared/tsconfig.json missing test-file exclusion**
- **Found during:** Task 3 (running `pnpm typecheck` as part of the plan's overall
  verification step)
- **Issue:** `packages/shared/tsconfig.json` had no `exclude` for `src/**/__tests__`, unlike
  `packages/engine/tsconfig.json` which already excludes its test directory from the
  project's type-check scope. Since Task 1 added `@apsis/shared`'s first-ever test file
  (`units.test.ts`), this pre-existing gap surfaced for the first time: `tsc --build` failed
  with `Cannot find name 'describe'/'it'/'expect'` because the shared project's tsconfig
  pulled the vitest-global-using test file into a compile scope with no vitest types
  configured.
- **Fix:** Added `"exclude": ["src/**/__tests__"]` to `packages/shared/tsconfig.json`,
  mirroring the engine package's already-established pattern exactly.
- **Files modified:** `packages/shared/tsconfig.json`
- **Verification:** `pnpm run typecheck` (root `tsc --build tsconfig.json`) passes clean
  after the fix; confirmed via a full clean rebuild (temporarily removed and regenerated
  `packages/shared/dist` to rule out stale project-reference output).
- **Committed in:** `d588892` (Task 3 commit, alongside the carry.ts GREEN implementation)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to satisfy the plan's own verification requirement
(`pnpm -r build` / `tsc` succeeds with no type errors). No scope creep — the fix is a
one-line tsconfig change matching an existing sibling-package pattern.

## Issues Encountered
- Root `package.json` has no `pnpm -r build` script; the plan's verification line
  `pnpm -r build (or tsc) succeeds` was satisfied via the existing root `pnpm run typecheck`
  script (`tsc --build tsconfig.json`), which is this repo's actual cross-package type-check
  entry point (project references, not flat `tsc --noEmit`).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `estimateE1RMFromRepMaxTable`, `carryStress(Detailed)`, and the extended
  `sessionHSSDetailed` are ready for the app-layer effective-load path and the lifting
  logger UI (plans 03-02+) to consume when `exercise.bwFactor != null` or a carry/sled
  exercise is logged.
- `@apsis/shared/units.ts` is ready for the onboarding unit-toggle UI and any imperial
  display steppers.
- No blockers for downstream plans in this wave.

---
*Phase: 03-onboarding-lifting-logger*
*Completed: 2026-07-09*

## Self-Check: PASSED

All 8 created files verified present on disk; all 6 task commit hashes
(0bebba3, 87d680b, 84a3866, fa9e257, 5549ed0, d588892) verified present
in `git log --oneline --all`.
