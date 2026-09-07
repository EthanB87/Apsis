---
phase: 02-hss-engine
plan: 06
subsystem: engine
tags: [typescript, vitest, barrel, calibration, readme, hss]

# Dependency graph
requires:
  - phase: 02-01
    provides: "shared types, DEFAULT_CONFIG/mergeConfig, clampRange (foundation)"
  - phase: 02-02
    provides: "strengthStress / strengthStressDetailed / estimateE1RM"
  - phase: 02-03
    provides: "enduranceStress / enduranceStressDetailed / ifFromHR / ifFromPace / resolveIF"
  - phase: 02-04
    provides: "sessionHSS / sessionHSSDetailed / dailyHSS / ENGINE_VERSION (version.ts)"
  - phase: 02-05
    provides: "computeLoadTrend / computeLoadTrendSeries / readinessBand"
provides:
  - "packages/engine/src/index.ts as the full public @apsis/engine barrel (config/strength/endurance/session/daily/trend/version)"
  - "packages/engine/src/__tests__/calibration.test.ts — the D-13 ±25% cross-modality calibration golden"
  - "DEFAULT_CONFIG.kStrength tuned to 4.4 (from the 2.0 starting guess)"
  - "packages/engine/README.md documenting every formula and constant (BUILD.md §4.4)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Grouped `export * from './x'` barrel re-exports (mirrors packages/db/src/index.ts convention), one comment line per group naming its responsibility"
    - "Calibration test as a dedicated, first-class test file separate from per-module unit tests, asserting a cross-modality property (ratio bound) rather than a single golden number"

key-files:
  created:
    - packages/engine/src/__tests__/calibration.test.ts
    - packages/engine/README.md
  modified:
    - packages/engine/src/index.ts
    - packages/engine/src/config.ts
    - packages/engine/src/__tests__/strength.test.ts
    - packages/engine/src/daily.ts
    - packages/engine/src/endurance.ts
    - packages/engine/src/strength.ts
    - packages/engine/src/trend.ts
    - packages/engine/src/session.ts
  removed:
    - packages/engine/src/__tests__/placeholder.test.ts

key-decisions:
  - "kStrength calibrated to 4.4 (not the BUILD.md 2.0 starting guess): the canonical hard 5x5 squat (140kg/180kg e1RM, 5 reps, RPE 9, lower-body) sums to a pre-kStrength set-stress of 22.75; 4.4 lands liftHSS ~=100.1, ratio ~1.001 against the 60-min threshold-run anchor (runHSS ~=100.0), well inside the D-13 [0.8, 1.25] band and BUILD.md's ~30-120 hard-session range."
  - "Rewrote pre-existing 'Date.now()' mentions in daily/endurance/strength/trend/session.ts module-header comments (left over from plans 02-02..02-05, which used the literal token to document the purity rule) to 'wall-clock reads' — this task's own verify step greps the whole packages/engine/src tree for wall-clock APIs including comments, so the pre-existing documentation comments had to be reworded to keep the grep at zero matches without weakening the stated constraint."
  - "Updated two pre-existing strength.test.ts golden assertions that hardcoded the now-superseded kStrength=2.0 constant (5.0 -> 11.0, 6.5 -> 14.3) so they reflect the calibrated formula instead of failing against this plan's legitimate constant change."

patterns-established:
  - "Barrel index.ts groups re-exports by module responsibility with a one-line comment above each `export * from` line, matching packages/db/src/index.ts's import-order convention."

requirements-completed: [ENG-07]

coverage:
  - id: D1
    description: "The @apsis/engine public API (strength/endurance/session/daily/trend + config + ENGINE_VERSION) is importable from the barrel"
    requirement: "ENG-07"
    verification:
      - kind: other
        ref: "grep -Eq \"export \\* from './trend'\" packages/engine/src/index.ts; pnpm typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "Calibration golden: 60-min threshold run ~=100 HSS; hard 5x5 squat / run ratio in [0.8, 1.25] (D-13)"
    requirement: "ENG-07"
    verification:
      - kind: unit
        ref: "packages/engine/src/__tests__/calibration.test.ts (3 tests: run~=100, ratio bounds, 30-120 readable range)"
        status: pass
    human_judgment: false
  - id: D3
    description: "packages/engine has zero runtime dependencies beyond @apsis/shared and never reads the wall clock"
    requirement: "ENG-07"
    verification:
      - kind: other
        ref: "grep -rIn --include='*.ts' -e 'Date\\.now' -e 'performance\\.now' -e 'new Date(' packages/engine/src -> 0 matches; package.json dependencies check -> 0 third-party"
        status: pass
    human_judgment: false
  - id: D4
    description: "The engine suite has >=20 passing vitest tests; pnpm typecheck is green"
    requirement: "ENG-07"
    verification:
      - kind: unit
        ref: "pnpm --filter @apsis/engine test -> 8 files, 53 tests passed"
        status: pass
      - kind: other
        ref: "pnpm typecheck (tsc --build tsconfig.json)"
        status: pass
    human_judgment: false
  - id: D5
    description: "packages/engine/README.md documents every formula and constant (BUILD.md §4.4)"
    requirement: "ENG-07"
    verification:
      - kind: other
        ref: "packages/engine/README.md (Formulas + DEFAULT_CONFIG constants table + Deviations from BUILD.md sections)"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-07-08
status: complete
---

# Phase 2 Plan 6: Engine Assembly + Calibration Summary

**Wired the @apsis/engine public barrel, added the D-13 calibration golden (60-min threshold run vs. hard 5x5 squat within ±25%), tuned kStrength from 2.0 to 4.4 to pass it, and documented every formula/constant in a new README — 53/53 engine tests green, typecheck clean, zero runtime deps, zero wall-clock reads.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-08T19:16:00-04:00
- **Completed:** 2026-07-08T19:18:40-04:00
- **Tasks:** 3
- **Files modified:** 10 (2 created, 7 modified, 1 removed)

## Accomplishments
- `packages/engine/src/index.ts` is now the full public barrel: `export * from` config, strength, endurance, session, daily, trend, and version, mirroring the `packages/db/src/index.ts` grouped re-export convention. Deleted the Phase-1 `placeholder.test.ts` (real coverage from 02-01..02-05 supersedes it).
- Added `packages/engine/src/__tests__/calibration.test.ts` (D-13's first-class deliverable): asserts a 60-min threshold run lands at HSS ≈ 100, the canonical hard 5x5 squat lands within a [0.8, 1.25] ratio of it, and the squat's HSS falls inside BUILD.md's ~30–120 hard-session range.
- Tuned `DEFAULT_CONFIG.kStrength` from the 2.0 starting guess to **4.4** (kEndurance untouched at 1.6667) — the calibrated value that lands the canonical squat at HSS ≈ 100.1, a ratio of ≈1.001 against the run anchor. Documented the derivation in `config.ts`'s JSDoc.
- Wrote `packages/engine/README.md` documenting the full public API, every formula (endurance ES, strength per-set/SS, session HSS, daily HSS, EWMA ATL/CTL/TSB, readiness band), every `DEFAULT_CONFIG` constant with its final value and rationale, the approved BUILD.md deviations (D-01/D-03/D-05/D-07), and the purity/testing guarantees (BUILD.md §4.4).
- Suite grew from 52 (pre-existing) to 53 tests (net +1: calibration.test.ts added 3, placeholder.test.ts's 2 smoke tests removed, strength.test.ts's ENGINE_VERSION-independent golden assertions updated in place with no net count change).

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire the public barrel, remove the placeholder test, confirm purity** — `88b36cd` (feat)
2. **Task 2: Add the calibration golden and tune kStrength to pass it (D-13/D-14)** — `75713c2` (feat)
3. **Task 3: Write the engine README and verify the ≥20-test / typecheck bar** — `6435f64` (docs)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP update)

## Files Created/Modified
- `packages/engine/src/index.ts` - converted from the Phase-1 `ENGINE_VERSION`-only skeleton into the full public barrel re-exporting config/strength/endurance/session/daily/trend/version
- `packages/engine/src/__tests__/placeholder.test.ts` - deleted (superseded by real coverage)
- `packages/engine/src/daily.ts`, `endurance.ts`, `strength.ts`, `trend.ts`, `session.ts` - module-header comments reworded from the literal "Date.now()" token to "wall-clock reads" so the whole-tree purity grep (part of this plan's own verify step) reports zero matches; no behavioral change
- `packages/engine/src/config.ts` - `DEFAULT_CONFIG.kStrength` tuned 2.0 → 4.4; JSDoc updated with the calibration derivation
- `packages/engine/src/__tests__/calibration.test.ts` - new: the D-13 calibration golden (3 tests)
- `packages/engine/src/__tests__/strength.test.ts` - updated two golden expectations (5.0 → 11.0, 6.5 → 14.3) to match the calibrated kStrength
- `packages/engine/README.md` - new: full formula + constant + deviation documentation (BUILD.md §4.4)

## Decisions Made
- `kStrength = 4.4` is the final calibrated value (see key-decisions above and `config.ts` JSDoc for the full derivation). This is now the authoritative tuning constant Phase 3/4 will build against.
- The pre-existing "Date.now()" purity-comment mentions in five compute modules were rewritten rather than left alone, since this plan's own verify step (`grep -rIn ... packages/engine/src | wc -l -eq 0`) scans the entire source tree, not just `index.ts`.
- `strength.test.ts`'s two golden assertions that hardcoded the old `kStrength=2.0` value were updated in place (not deleted) to preserve the exact-value coverage the test was providing, now pinned to the calibrated constant.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworded pre-existing "Date.now()" comments across five compute modules to keep the whole-tree purity grep clean**
- **Found during:** Task 1 verification
- **Issue:** Task 1's own `<verify>` step runs `grep -rIn ... packages/engine/src | wc -l -eq 0` across the entire `packages/engine/src` tree. Plans 02-02 through 02-05 had already documented the purity constraint in each new module's header comment using the literal phrase "no Date.now()", which the grep matches even though it's a comment, not real wall-clock usage.
- **Fix:** Reworded the phrase to "no wall-clock reads" in `daily.ts`, `endurance.ts`, `strength.ts`, `trend.ts`, and `session.ts` — same meaning, no literal API token, grep now returns 0.
- **Files modified:** `packages/engine/src/daily.ts`, `endurance.ts`, `strength.ts`, `trend.ts`, `session.ts`
- **Verification:** `grep -rIn --include='*.ts' -e 'Date\.now' -e 'performance\.now' -e 'new Date(' packages/engine/src | wc -l` → 0. `pnpm typecheck` and `pnpm --filter @apsis/engine test` both green afterward.
- **Committed in:** `88b36cd`

**2. [Rule 1 - Bug] Updated two strength.test.ts golden assertions broken by the kStrength retune**
- **Found during:** Task 2, after tuning `DEFAULT_CONFIG.kStrength` from 2.0 to 4.4
- **Issue:** `strength.test.ts` had two golden tests hardcoding the expected `strengthStress` output for the *old* `kStrength=2.0` default (`5.0` and `6.5`). Since Task 2 explicitly requires retuning `kStrength`, these two tests would fail on the very change the plan mandates.
- **Fix:** Recomputed the expected values for `kStrength=4.4` (`(100/200)*5*1.0 = 2.5` → `2.5*4.4 = 11.0`; lower-body case `2.5*1.3 = 3.25` → `3.25*4.4 = 14.3`) and updated both the assertion values and their descriptive `it()` names.
- **Files modified:** `packages/engine/src/__tests__/strength.test.ts`
- **Verification:** `pnpm --filter @apsis/engine test` → 8 files, 53 tests, all green.
- **Committed in:** `75713c2`

---

**Total deviations:** 2 auto-fixed (1 blocking/preemptive purity-grep fix, 1 bug fix on tests broken by the plan's own required constant change). Neither altered the plan's intended outcome; both were necessary for the plan's own verify steps to pass.
**Impact on plan:** No scope creep — both fixes are direct, unavoidable consequences of applying this plan's own instructions (barrel purity check; kStrength retune) against pre-existing artifacts from earlier plans in the same phase.

## Issues Encountered
None beyond the two deviations above. `pnpm typecheck` and `pnpm --filter @apsis/engine test` were green after every task.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- `@apsis/engine` now exposes its complete, curated public API via `import { ... } from '@apsis/engine'`, ready for Phase 3 (lifting logger) and Phase 4 (run logger + dashboard) to consume directly.
- The calibrated `kStrength=4.4` and unchanged `kEndurance=1.6667` are the values downstream phases should assume; any future re-tune should update `calibration.test.ts`'s bounds check first.
- `packages/engine/README.md` is the canonical formula/constant reference for anyone (human or agent) implementing the DB persistence layer (`workouts.hss`, `load_daily`) in Phase 3/4.
- No blockers or concerns for downstream phases. This closes out Phase 02 (HSS Engine) — BUILD.md §4.4's acceptance checklist is fully satisfied.

---
*Phase: 02-hss-engine*
*Completed: 2026-07-08*

## Self-Check: PASSED

All 5 claimed created/modified files found on disk (`index.ts`, `calibration.test.ts`,
`README.md`, `config.ts`, `strength.test.ts`); `placeholder.test.ts` confirmed removed; all
3 claimed commit hashes (`88b36cd`, `75713c2`, `6435f64`) found in git history.
