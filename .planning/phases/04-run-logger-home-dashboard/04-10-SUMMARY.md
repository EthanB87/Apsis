---
phase: 04-run-logger-home-dashboard
plan: 10
subsystem: ui
tags: [datetimepicker, expo-router, react-native, drizzle, vitest, units]

requires:
  - phase: 04-run-logger-home-dashboard
    provides: run.tsx date editing (RUN-04), History day-grouped ledger (HOME-05), formatPaceMinSec (RUN-02) from earlier phase-04 plans
provides:
  - Carry-correct formatPaceMinSec (no "X:60" render)
  - Dismissable iOS date picker on the run entry form
  - History fallback that shows finished sessions before load_daily recomputes
affects: [run-logger, history, home-dashboard]

tech-stack:
  added: []
  patterns:
    - "Round-total-then-split for M:SS pace formatting (round once, derive minutes/seconds from the rounded integer, never round minutes and seconds independently)"

key-files:
  created: []
  modified:
    - packages/shared/src/units.ts
    - packages/shared/src/__tests__/units.test.ts
    - apps/mobile/app/(tabs)/log/run.tsx
    - apps/mobile/app/(tabs)/history/index.tsx

key-decisions:
  - "formatPaceMinSec rounds the total seconds once, then derives minutes via Math.floor(rounded/60) and seconds via rounded%60 — replaces the independent Math.round(totalSec%60) that could render 'X:60'"
  - "iOS date picker closes only on event.type === 'set' (a committed selection); Android keeps its pre-existing unconditional setShowDatePicker(false) on every onChange, since Android's dialog self-dismisses and the state flip just unmounts/remounts the RN wrapper"
  - "History's day-entry dates are now the union of dayHssByDate and sessionsByDate keys (not just dayHssByDate), so sessions fetched in the same Promise.all are never discarded when load_daily is empty; dayHss falls back to 0 via the existing ?? 0"

patterns-established:
  - "Pace formatting: round-before-split, not round-per-field"

requirements-completed: [RUN-02, RUN-04, HOME-05]

coverage:
  - id: D1
    description: "formatPaceMinSec carries seconds correctly (359.7 -> '6:00', 59.6 -> '1:00'), no 'X:60' output"
    requirement: RUN-02
    verification:
      - kind: unit
        ref: "packages/shared/src/__tests__/units.test.ts#formatPaceMinSec seconds carry (WR-08)"
        status: pass
    human_judgment: false
  - id: D2
    description: "iOS date picker closes after a committed selection and toggles closed on re-tap of the date row"
    requirement: RUN-04
    verification:
      - kind: manual_procedural
        ref: "On-device: tap date row (opens), select a date (closes), re-tap (toggles closed)"
        status: unknown
    human_judgment: true
    rationale: "Native DateTimePicker open/close behavior cannot be exercised under vitest/tsc; requires an on-device or simulator pass per 04-VERIFICATION.md carry-forward note."
  - id: D3
    description: "History lists finished sessions instead of a false 'No sessions yet' empty state when load_daily has no rows yet"
    requirement: HOME-05
    verification:
      - kind: manual_procedural
        ref: "On-device: seed finished sessions with empty load_daily, confirm History lists them (dayHss may read 0)"
        status: unknown
    human_judgment: true
    rationale: "Requires a real on-device SQLite state (finished sessions present, load_daily empty) that isn't covered by the apps/mobile lib-only vitest harness; source-level fix is typecheck-verified but the end-to-end list render needs a human pass."

duration: 3min
completed: 2026-07-10
status: complete
---

# Phase 04 Plan 10: Gap Closure (WR-05/WR-07/WR-08) Summary

**Fixed three lower-severity Phase 4 review findings: pace-formatter second-carry ("X:60"), a permanently-open iOS date picker, and a History empty state that discarded already-fetched finished sessions.**

## Performance

- **Duration:** ~3 min (test commit 19:18:07 to final fix commit 19:19:48, plus SUMMARY/state work)
- **Started:** 2026-07-10T23:18:07Z
- **Completed:** 2026-07-10T23:19:48Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- `formatPaceMinSec` now rounds the total seconds once before splitting into minutes/seconds, eliminating the "X:60" render bug (WR-08); proven with 4 new unit tests (RED then GREEN).
- The run entry form's iOS `DateTimePicker` closes on a committed selection and toggles closed on a re-tap of the date row; Android's existing unmount-on-any-change behavior is unchanged (WR-05).
- History's `loadHistory` no longer discards already-fetched finished sessions when `load_daily` is empty — the day-entry build now unions `dayHssByDate` and `sessionsByDate` keys, so sessions render with a `dayHss` of `0` until the next recompute (WR-07).

## Task Commits

Each task was committed atomically (Task 1 followed the TDD RED/GREEN cycle):

1. **Task 1: Fix pace seconds carry in formatPaceMinSec (WR-08)**
   - `6c13d58` (test) — add failing `formatPaceMinSec` carry cases
   - `7d4b339` (fix) — round-then-split implementation, tests green
2. **Task 2: Close the iOS date picker after selection / re-tap (WR-05)** - `f105aaa` (fix)
3. **Task 3: Show finished sessions in History when load_daily is empty (WR-07)** - `2e8625b` (fix)

**Plan metadata:** (this commit, following SUMMARY/STATE update)

## Files Created/Modified
- `packages/shared/src/units.ts` - `formatPaceMinSec` rounds total seconds once, then derives minutes/seconds from the rounded integer
- `packages/shared/src/__tests__/units.test.ts` - added 4 behavior tests for the carry fix (baseline, two carry cases, zero)
- `apps/mobile/app/(tabs)/log/run.tsx` - `handleDateChange` closes the iOS picker on `event.type === 'set'`; Android keeps its unconditional close; date row `onPress` toggles `showDatePicker`
- `apps/mobile/app/(tabs)/history/index.tsx` - empty guard requires both `dailyRows` and `sessions` empty; day-entry dates union `dayHssByDate`/`sessionsByDate` keys instead of only `dayHssByDate`

## Decisions Made
- Kept Android's original unconditional `setShowDatePicker(false)` at the top of `handleDateChange` (moved into a `Platform.OS === 'android'` branch) rather than folding it into the iOS-only close, to avoid any behavior change on Android per the plan's explicit "keep the existing Android behavior intact" instruction.
- Used a `Set` union of `dayHssByDate.keys()` and `sessionsByDate.keys()` for `sortedDates` rather than a narrower "only fall back when dailyRows is empty" branch — this is a strict superset of the required behavior (also self-heals if a future date exists in one map but not the other) while still satisfying the plan's acceptance criteria (empty-`dailyRows`-with-sessions renders sessions with `dayHss` defaulting to 0).

## Deviations from Plan

None — plan executed exactly as written. All three fixes matched the plan's diagnosed root cause and prescribed fix shape; no additional bugs, missing functionality, or blocking issues were discovered during implementation.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three Phase 4 lower-severity warnings (WR-05, WR-07, WR-08) from 04-REVIEW.md are closed at the source level; automated verification (`packages/shared` vitest: 21/21 pass, `apps/mobile` vitest: 9/9 pass, `apps/mobile` tsc: clean except the two documented pre-existing route-typing errors) confirms no regressions.
- Three coverage deliverables (D2 date-picker toggle, D3 History fallback list render) are marked `human_judgment: true` and remain for an on-device pass — native picker/list behavior cannot be exercised under vitest per 04-VERIFICATION.md's carry-forward note. D1 (pace carry) is fully unit-proven and auto-passes.
- Phase 04 is now complete (10/10 plans); ready for phase closure / next-phase kickoff.

---
*Phase: 04-run-logger-home-dashboard*
*Completed: 2026-07-10*

## Self-Check: PASSED

All 4 modified/created files verified present on disk; all 4 task commit hashes (6c13d58, 7d4b339, f105aaa, 2e8625b) verified present in git log.
