---
phase: 02-hss-engine
plan: 02
subsystem: engine
tags: [typescript, vitest, pure-functions, hss, strength]

# Dependency graph
requires:
  - phase: 02-hss-engine (plan 01)
    provides: "@apsis/shared engine I/O + config types (StrengthSet, EngineConfig, StrengthStressDetail), DEFAULT_CONFIG/mergeConfig, clampRange never-throw primitive"
provides:
  - "strengthStress / strengthStressDetailed / estimateE1RM in packages/engine/src/strength.ts — the strength-side half of ENG-01"
affects: ["02-03", "02-04", "02-05", "02-06"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Detailed compute function returns a rich breakdown object; bare-number BUILD.md-named function is a thin facade over it (D-05)"
    - "Per-set clamp via clampRange collected into warnings[]; e1rmKg<=0 sets are skipped (not clamped) to avoid a divide-by-zero, with a dedicated warning message"

key-files:
  created:
    - packages/engine/src/strength.ts
    - packages/engine/src/__tests__/strength.test.ts
  modified: []

key-decisions:
  - "e1rmKg<=0 sets are skipped entirely (not pushed into perSetStress, not counted toward SS) rather than clamped to a minimum, since any positive floor value would fabricate a stress number from a physically meaningless e1RM."
  - "Rep count clamped to 0..100 (MAX_REPS local const) as the 'reasonable max' called for in the plan; no upper clamp needed for loadKg (only a floor of 0), per the plan's explicit clamp ranges."

patterns-established:
  - "Strength module JSDoc header names its exact formula responsibility (e1RM-normalized load stress + Epley estimator) matching the packages/engine/src/index.ts skeleton convention."

requirements-completed: [ENG-01]

coverage:
  - id: D1
    description: "strengthStress/strengthStressDetailed/estimateE1RM implement the ENG-01 formula: warmup exclusion, leg-multiplier amplification, RPE scaling, Epley e1RM estimator"
    requirement: "ENG-01"
    verification:
      - kind: unit
        ref: "packages/engine/src/__tests__/strength.test.ts#computes SS for a single working set, #excludes warmup sets, #amplifies lower-body sets, #estimateE1RM computes the Epley estimate"
        status: pass
      - kind: other
        ref: "pnpm typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "Invalid inputs (out-of-range RPE, e1rmKg<=0) are clamped/skipped with warnings and never throw or produce NaN/Infinity (D-15)"
    requirement: "ENG-01"
    verification:
      - kind: unit
        ref: "packages/engine/src/__tests__/strength.test.ts#clamps an out-of-range rpe, #clamps a below-range rpe, #skips a set with e1rmKg<=0, #never throws on a mixed batch"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-07-08
status: complete
---

# Phase 2 Plan 2: Strength Engine Summary

**Per-set strength stress engine — e1RM-normalized load, warmup exclusion, lower-body leg-multiplier amplification, RPE scaling, and an Epley e1RM estimator, all clamp-and-warn safe (never throws).**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-08T22:47:38Z
- **Completed:** 2026-07-08T22:50:58Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- `strengthStressDetailed` sums per-set stress `(loadKg/e1rmKg) * reps * (rpe/10)`, excludes warmup sets entirely, amplifies lower-body sets by `legMultiplier`, and scales the session total by `kStrength`
- `strengthStress` is a bare-number facade over the detailed breakdown (D-05)
- `estimateE1RM(loadKg, reps)` implements the Epley formula `load*(1+reps/30)` (D-10)
- Robustness: RPE clamped to 1..10, reps clamped to 0..100, loadKg floored at 0 (all via `clampRange`, warnings collected); sets with `e1rmKg<=0` are skipped (not clamped) with a dedicated warning to avoid fabricating a divide-by-zero-adjacent stress value — never throws (D-15)
- 8 new tests (16 total in the engine package including plan 01's clamp suite) covering goldens (Epley, single-set SS, leg-multiplier SS) and behavioral cases (warmup exclusion, empty array, RPE clamp both directions, e1rmKg<=0 skip, mixed-batch no-throw)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement strength.ts (strengthStress, strengthStressDetailed, estimateE1RM)** - `8798146` (feat)
2. **Task 2: Write strength.test.ts (behavioral + golden)** - `788eb2a` (test)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP update)

_Note: Task 1 was marked `tdd="true"` in the plan but its `<action>` block specified implementation only (test-writing was explicitly deferred to the separate Task 2); followed the plan's literal task breakdown rather than a strict RED-before-GREEN single-task cycle, since Task 2's tests import and exercise the exact exports Task 1 produced and all pass green on first run._

## Files Created/Modified
- `packages/engine/src/strength.ts` - `strengthStress`, `strengthStressDetailed`, `estimateE1RM` — the strength-side ENG-01 formula, clamp-and-warn safe
- `packages/engine/src/__tests__/strength.test.ts` - 8 behavioral + golden tests covering warmup exclusion, leg multiplier, RPE scaling, Epley estimator, and clamp/skip robustness

## Decisions Made
- `e1rmKg<=0` sets are skipped entirely (excluded from `perSetStress` and the SS sum) rather than clamped to a floor value, since clamping would fabricate a stress number from a physically meaningless e1RM — a skip + warning is the honest response per D-15.
- Reps clamped to `0..100` (a local `MAX_REPS` constant) as the plan's "reasonable max"; `loadKg` only floored at 0 with no upper bound, matching the plan's explicit clamp-range instructions.

## Deviations from Plan

None - plan executed exactly as written (see Task 1 commit note above regarding the `tdd="true"` attribute vs. the plan's literal two-task split; this was a plan-authoring detail, not a deviation in implementation).

## Issues Encountered
None. `pnpm typecheck` and `pnpm --filter @apsis/engine test` both passed clean on first run after Task 2.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `strengthStress`/`strengthStressDetailed`/`estimateE1RM` are ready for 02-03 (endurance engine) and later plans (`sessionHSS`, `dailyHSS`) to compose alongside `enduranceStress`.
- No blockers or concerns for downstream plans in this phase.

---
*Phase: 02-hss-engine*
*Completed: 2026-07-08*

## Self-Check: PASSED

Both claimed files found on disk (`packages/engine/src/strength.ts`, `packages/engine/src/__tests__/strength.test.ts`); both claimed commit hashes (`8798146`, `788eb2a`) found in git history.
