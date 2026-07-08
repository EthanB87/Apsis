---
phase: 02-hss-engine
plan: 03
subsystem: engine
tags: [typescript, vitest, tdd, engine-purity]

# Dependency graph
requires:
  - phase: 02-01
    provides: "EnduranceSegment/EngineConfig/EnduranceStressDetail types, DEFAULT_CONFIG/mergeConfig, clampRange"
provides:
  - "enduranceStress / enduranceStressDetailed: per-session endurance HSS (ES = durationMin * IF^2 * kEndurance), the D-14 calibration anchor"
  - "ifFromHR, ifFromPace: pure intensity-factor derivation helpers (D-09)"
  - "resolveIF: HR-priority IF resolution with pace fallback and neutral 1.0 default, clamped to [0.3, 1.3] (D-11, D-15)"
affects: ["02-04", "02-05", "02-06"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IF resolution precedence (HR > pace > neutral default) encoded once in resolveIF so downstream phases apply the same rule consistently"
    - "Endurance module mirrors the strength module's detailed-object + bare-number-facade split (D-05) established in 02-02"

key-files:
  created:
    - packages/engine/src/endurance.ts
    - packages/engine/src/__tests__/endurance.test.ts
  modified: []

key-decisions:
  - "resolveIF treats HR as present only when both avgHR and thresholdHR are finite and > 0 (same gate applied to pace); this avoids a partial/garbage IF derivation from a single valid field paired with a missing or zero counterpart."
  - "ifFromHR/ifFromPace each guard their own denominator (threshold <=0, or pace <=0) by returning a neutral 1.0, independent of resolveIF's gating -- keeps them safe to call directly, not just through resolveIF."
  - "Task 2's test-writing was effectively completed during Task 1's TDD RED commit (the full behavioral+golden suite was written before the implementation, not a minimal scaffold); Task 2's only remaining work was a toBeCloseTo precision-arg fix, committed separately."

requirements-completed: [ENG-02]

coverage:
  - id: D1
    description: "enduranceStress/enduranceStressDetailed implement ES = durationMin*IF^2*kEndurance, with the 60min/IF-1.0 calibration anchor landing at ~100 HSS"
    requirement: "ENG-02"
    verification:
      - kind: unit
        ref: "packages/engine/src/__tests__/endurance.test.ts (calibration-anchor + IF-squared-scaling describe blocks)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ifFromHR, ifFromPace, resolveIF derive and resolve an intensity factor, with resolveIF preferring HR over pace (D-11) and falling back to a neutral 1.0 with a warning when neither is available"
    requirement: "ENG-02"
    verification:
      - kind: unit
        ref: "packages/engine/src/__tests__/endurance.test.ts (ifFromHR/ifFromPace + resolveIF describe blocks)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Out-of-range intensityFactor is clamped to [0.3, 1.3] with a warning; enduranceStress never throws on bad input (D-15)"
    requirement: "ENG-02"
    verification:
      - kind: unit
        ref: "packages/engine/src/__tests__/endurance.test.ts (clamp/no-throw robustness describe block)"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-07-08
status: complete
---

# Phase 2 Plan 3: Endurance HSS Engine Summary

**Per-segment endurance stress (ES = durationMin × IF² × kEndurance) anchored at 60min/IF-1.0 ≈100, plus HR-priority IF-derivation helpers (ifFromHR, ifFromPace, resolveIF) — TDD RED→GREEN, 27/27 engine tests green.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-08T18:53:00Z
- **Completed:** 2026-07-08T18:55:20Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments

- Implemented `packages/engine/src/endurance.ts`: `enduranceStress`/`enduranceStressDetailed` (the D-14 calibration anchor — 60-min segment at IF 1.0 scores ≈100 HSS), `ifFromHR`, `ifFromPace` (pure IF-derivation helpers, D-09), and `resolveIF` (HR-priority resolution with pace fallback and neutral-default, D-11), all clamped and never-throwing (D-15)
- Wrote `packages/engine/src/__tests__/endurance.test.ts` covering the calibration anchor, IF-squared scaling, both IF-derivation helpers, HR-over-pace precedence, pace fallback, neutral-default fallback, and clamp/no-throw robustness — 11 `it` cases across 5 `describe` blocks
- Followed the RED→GREEN TDD cycle: wrote the full test suite first (confirmed failing on missing module), then implemented `endurance.ts` to make all 27 engine-package tests (existing + new) pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement endurance.ts (enduranceStress + IF helpers)** — TDD: `5641f02` (test, RED) → `9a48be7` (feat, GREEN). No REFACTOR commit needed — the initial implementation was already minimal and clean.
2. **Task 2: Write endurance.test.ts (behavioral + calibration-anchor golden)** — the comprehensive test suite was authored upfront as Task 1's RED commit (`5641f02`) rather than a minimal scaffold; Task 2's remaining work was a `toBeCloseTo` precision-argument fix on the calibration-anchor assertion, committed as `ac56ae3` (test).

## Files Created/Modified

- `packages/engine/src/endurance.ts` — `enduranceStress`, `enduranceStressDetailed`, `ifFromHR`, `ifFromPace`, `resolveIF`, `ResolveIFInputs`/`ResolveIFResult` interfaces
- `packages/engine/src/__tests__/endurance.test.ts` — 11 behavioral + golden test cases across 5 `describe` blocks

## Decisions Made

- `resolveIF` requires both halves of a pair (avgHR+thresholdHR, or paceSecPerKm+thresholdPaceSecPerKm) to be finite and positive before using that pair — prevents deriving an IF from one valid field paired with a missing/zero counterpart.
- `ifFromHR`/`ifFromPace` independently guard their own denominators (returning a neutral 1.0 on a non-positive threshold/pace) so they remain safe to call directly, not only through `resolveIF`'s gating.
- Task 2's test-authoring was effectively front-loaded into Task 1's TDD RED commit; documented as a deviation from the plan's literal task split (see below), not a scope gap — all of Task 2's acceptance criteria are satisfied by the existing suite plus the precision fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `toBeCloseTo` precision-argument misuse on the calibration-anchor golden**
- **Found during:** Task 2 (finalizing the test file)
- **Issue:** The calibration-anchor assertion used `toBeCloseTo(100, 0.5)`. Vitest's (Jest-compatible) `toBeCloseTo(expected, numDigits)` takes an integer decimal-places count, not a raw tolerance — passing `0.5` happened to still pass (actual value ≈100.002 is well within any reasonable tolerance) but did not correctly encode the plan's "±0.5 tolerance" intent.
- **Fix:** Changed to `toBeCloseTo(100, 0)`, which checks `|actual - 100| < 0.5` — the exact tolerance the plan specifies.
- **Files modified:** `packages/engine/src/__tests__/endurance.test.ts`
- **Commit:** `ac56ae3`

### Task-split deviation (informational, not a fix)

The plan's Task 1 (tdd="true") scoped only `endurance.ts` as its file, and Task 2 (type="auto") separately scoped `endurance.test.ts`. Following the mandatory TDD RED→GREEN protocol, the RED step for Task 1 required a failing test to exist first — so the full behavioral+golden suite (matching Task 2's exact spec) was written and committed as part of Task 1's RED commit, not a minimal scaffold. Task 2 was then completed by fixing the one precision-argument issue found on review. No test coverage or acceptance criteria were skipped; all of Task 2's listed assertions are present and passing.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `enduranceStress`, `enduranceStressDetailed`, `ifFromHR`, `ifFromPace`, `resolveIF` are ready for 02-04 (session HSS combiner) to compose alongside `strengthStress`/`strengthStressDetailed` from 02-02.
- No blockers or concerns for downstream plans in this phase.

---
*Phase: 02-hss-engine*
*Completed: 2026-07-08*

## Self-Check: PASSED

Both claimed files found on disk (`packages/engine/src/endurance.ts`, `packages/engine/src/__tests__/endurance.test.ts`); all 3 claimed commit hashes (`5641f02`, `9a48be7`, `ac56ae3`) found in git history.
