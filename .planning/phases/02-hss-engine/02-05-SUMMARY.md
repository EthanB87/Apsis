---
phase: 02-hss-engine
plan: 05
subsystem: engine
tags: [typescript, vitest, ewma, readiness-band, pure-functions]

# Dependency graph
requires:
  - phase: 02-hss-engine
    plan: 01
    provides: "EngineConfig/LoadTrendPoint/ReadinessBand types in @apsis/shared, DEFAULT_CONFIG + mergeConfig in packages/engine/src/config.ts"
provides:
  - "computeLoadTrend(dailyHSSByDay, cfg?) -> { atl, ctl, tsb } EWMA rolling load in packages/engine/src/trend.ts"
  - "computeLoadTrendSeries(dailyHSSByDay, cfg?) -> LoadTrendPoint[] per-day trend + band series"
  - "readinessBand(tsb, ctl, opts:{historyDays}, cfg?) -> ReadinessBand with cold-start-safe 'calibrating' gate"
affects: ["02-06"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "EWMA fold: lambda = 1 - exp(-1/days), value += lambda * (today - value), init at 0 (D-08) — reused for both ATL (7d) and CTL (28d) time constants"
    - "Calibrating-gate-before-ratio pattern: readinessBand checks historyDays/ctl-floor before computing tsb/ctl, so a low-history or low-ctl caller never reaches the ratio branch (also prevents near-zero-denominator ratio blowups)"

key-files:
  created:
    - packages/engine/src/trend.ts
    - packages/engine/src/__tests__/trend.test.ts
    - packages/engine/src/__tests__/readiness.test.ts
  modified: []

key-decisions:
  - "readinessBand signature is (tsb, ctl, opts: { historyDays }, cfg?) per D-03 — a deliberate deviation from BUILD.md's 3-band signature, approved in 02-CONTEXT.md."
  - "EWMA convergence test uses 150 days (not 60) — CTL's 28-day time constant needs ~5 time constants to fully settle within a tight tolerance; 60 days left ~12 HSS of residual gap between ATL and CTL, which is real EWMA behavior, not a bug. Tightened the test input rather than loosening the tolerance, to keep the property meaningful."
  - "computeLoadTrendSeries re-implements the day-by-day EWMA fold inline (rather than calling computeLoadTrend per prefix-slice) for O(n) instead of O(n^2) performance over the series."

requirements-completed: [ENG-04, ENG-05, ENG-06]

coverage:
  - id: D1
    description: "computeLoadTrend returns { atl, ctl, tsb } from a chronological daily-HSS array, with tsb = ctl - atl exactly"
    requirement: "ENG-04"
    verification:
      - kind: unit
        ref: "packages/engine/src/__tests__/trend.test.ts (empty-input zeros, tsb === ctl - atl invariant test)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ATL (7-day) responds faster than CTL (28-day): a rest week decays ATL faster than CTL, driving TSB positive"
    requirement: "ENG-04"
    verification:
      - kind: unit
        ref: "packages/engine/src/__tests__/trend.test.ts (steady-then-rest-week test comparing ATL drop vs CTL drop)"
        status: pass
    human_judgment: false
  - id: D3
    description: "computeLoadTrendSeries returns a per-day LoadTrendPoint[] matching computeLoadTrend's final value, for pure engine-output UI rendering (D-07)"
    requirement: "ENG-05"
    verification:
      - kind: unit
        ref: "packages/engine/src/__tests__/trend.test.ts (N-point series length + final-point-matches-computeLoadTrend test)"
        status: pass
    human_judgment: false
  - id: D4
    description: "readinessBand gates to 'calibrating' on short history or low ctl before evaluating the TSB/CTL ratio thresholds, and never returns 'red' for a single cold-start session"
    requirement: "ENG-06"
    verification:
      - kind: unit
        ref: "packages/engine/src/__tests__/readiness.test.ts (calibrating gate tests, red/amber/green boundary tests, single-session-never-red test)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Full engine typecheck and test suite clean"
    requirement: "ENG-04, ENG-05, ENG-06"
    verification:
      - kind: other
        ref: "pnpm typecheck (tsc --build tsconfig.json)"
        status: pass
      - kind: unit
        ref: "pnpm --filter @apsis/engine test (39/39 tests pass across the package)"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-07-08
status: complete
---

# Phase 2 Plan 5: Load Trend + Readiness Band Summary

**EWMA-based ATL/CTL/TSB rolling load trend, a per-day trend series for the UI, and a cold-start-safe readiness band with an approved 4th 'calibrating' state that guarantees a new user is never shown a misleading red.**

## Performance

- **Duration:** ~6 min
- **Tasks:** 2
- **Files modified:** 3 (all created)

## Accomplishments

- Created `packages/engine/src/trend.ts` with `computeLoadTrend` (final `{ atl, ctl, tsb }`), `computeLoadTrendSeries` (per-day `LoadTrendPoint[]` with band, D-07), and `readinessBand` (D-03 `opts:{historyDays}` signature, cold-start-safe `'calibrating'` gate, D-01/D-02/D-04)
- Implemented the EWMA fold (`lambda = 1 - exp(-1/days)`, init at 0 per D-08) shared conceptually between the final-value and per-day-series computations
- Wrote `trend.test.ts` (6 tests) covering empty-input zeros, EWMA convergence toward a constant input, rest-week ATL-decays-faster-than-CTL, the `tsb === ctl - atl` invariant, and series/final-value agreement
- Wrote `readiness.test.ts` (6 tests) covering both calibrating triggers (short history, ctl below floor), the red/amber/green ratio boundaries, and the ENG-06 cold-start-never-red guarantee via a single-session series
- `pnpm typecheck` and `pnpm --filter @apsis/engine test` both exit 0 (39/39 tests pass across the whole engine package)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement trend.ts (computeLoadTrend, computeLoadTrendSeries, readinessBand)** - `a3bd2c6` (feat)
2. **Task 2: Write trend.test.ts and readiness.test.ts** - `24f665b` (test)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP update)

## Files Created/Modified

- `packages/engine/src/trend.ts` - `computeLoadTrend`, `computeLoadTrendSeries`, `readinessBand`, internal `ewmaFold` helper
- `packages/engine/src/__tests__/trend.test.ts` - 6 behavioral tests for `computeLoadTrend`/`computeLoadTrendSeries`
- `packages/engine/src/__tests__/readiness.test.ts` - 6 behavioral tests for `readinessBand`, including the cold-start never-red guarantee

## Decisions Made

- `readinessBand(tsb, ctl, opts: { historyDays }, cfg?)` — the D-03-approved deviation from BUILD.md's 3-band signature, kept as a pure standalone function so Phase 4 can call it directly per day or via `computeLoadTrendSeries`.
- The EWMA convergence test needed 150 simulated days (not the originally sketched 60) to let CTL's 28-day time constant fully settle within a tight (±5) TSB tolerance — this is genuine EWMA math, not a defect, so the test input was extended rather than loosening the assertion.
- `computeLoadTrendSeries` re-derives the EWMA fold inline day-by-day (O(n)) instead of calling `computeLoadTrend` on each growing prefix slice (which would be O(n^2)) — kept both implementations logically identical (same lambda derivation, same init-at-0) but the series path is the performance-correct one for real per-day chart rendering.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Tightened EWMA convergence test's simulated history length**
- **Found during:** Task 2 (initial test run)
- **Issue:** The convergence test used 60 days of constant HSS=100 input with a ±5 TSB tolerance; CTL's 28-day time constant only reaches ~88% convergence by day 60, leaving a real ~11.7 TSB residual gap — the test failed, but the code was correct.
- **Fix:** Extended the simulated series to 150 days (roughly 5 CTL time constants), which brings the residual TSB gap to well under 1, comfortably inside the ±5 tolerance. No changes to `trend.ts` were needed.
- **Files modified:** `packages/engine/src/__tests__/trend.test.ts`
- **Commit:** `24f665b`

## Issues Encountered

None beyond the auto-fixed test-tolerance issue above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `computeLoadTrend`, `computeLoadTrendSeries`, and `readinessBand` are ready for Phase 3's `load_daily` persistence path and Phase 4's dashboard/chart to consume directly — no trend math needs to live in the UI layer.
- Plan 02-06 (calibration tuning) can now exercise the full engine surface (strength, endurance, session HSS, trend, readiness) end-to-end for the D-13 calibration test.
- No blockers or concerns for downstream plans in this phase.

---
*Phase: 02-hss-engine*
*Completed: 2026-07-08*
