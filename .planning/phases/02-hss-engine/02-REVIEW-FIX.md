---
phase: 02-hss-engine
fixed_at: 2026-07-08T19:44:00Z
review_path: .planning/phases/02-hss-engine/02-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 02-hss-engine: Code Review Fix Report

**Fixed at:** 2026-07-08T19:44:00Z
**Source review:** .planning/phases/02-hss-engine/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (fix_scope: critical_warning — CR-01..CR-03, WR-01..WR-02; IN-01..IN-03 out of scope)
- Fixed: 5
- Skipped: 0

All 5 in-scope findings were fixed and verified. `pnpm --filter @apsis/engine test` went from
53/53 to 61/61 (8 new regression tests added across the fixes). `pnpm typecheck` is clean.

## Fixed Issues

### CR-01: `clampRange` only guards `Number.isNaN`, not general non-finite/non-numeric input

**Files modified:** `packages/engine/src/clamp.ts`, `packages/engine/src/__tests__/clamp.test.ts`
**Commit:** `7e71d88`
**Applied fix:** Changed the guard from `Number.isNaN(value)` to
`typeof value !== 'number' || Number.isNaN(value)`, clamping `undefined`/non-numeric input to
`min` with a warning. Adapted from the review's literal `!Number.isFinite(value)` suggestion,
which would have regressed the existing `Infinity`/`-Infinity` test (that test expects
`Infinity` to clamp toward `max` and `-Infinity` toward `min`, preserving sign — a blanket
non-finite check would have clamped both to `min`). `Infinity`/`-Infinity` still fall through
to the ordinary `< min` / `> max` comparisons. Added regression tests for `undefined` and a
non-numeric string.

### CR-02: `e1rmKg <= 0` skip check is defeated by `NaN`

**Files modified:** `packages/engine/src/strength.ts`, `packages/engine/src/__tests__/strength.test.ts`
**Commit:** `05d56ca`
**Applied fix:** Changed `if (set.e1rmKg <= 0)` to `if (!(set.e1rmKg > 0))`, applied exactly as
the review's suggested fix. Added a regression test asserting `e1rmKg: NaN` is skipped, warned,
and yields a finite (non-NaN) `ss`.

### CR-03: No NaN/finite guard in the EWMA fold or `readinessBand`

**Files modified:** `packages/engine/src/trend.ts`, `packages/engine/src/__tests__/trend.test.ts`, `packages/engine/src/__tests__/readiness.test.ts`, `packages/engine/README.md`
**Commit:** `6b32722`
**Applied fix:** Applied the review's two suggested guards (`ewmaFold` treats non-finite daily
input as `0`; `readinessBand` gates on `!Number.isFinite(tsb) || !Number.isFinite(ctl)` before
the ratio branches), and additionally extended the same non-finite guard to the inlined fold
in `computeLoadTrendSeries` (lines 90-112 were part of the finding's cited range and have the
identical failure mode — the review's example only showed `ewmaFold`, but
`computeLoadTrendSeries` folds independently and needed the same protection). Added regression
tests: `readinessBand(NaN, NaN, { historyDays: 30 })` returns `'calibrating'`; a `NaN` day
mid-series doesn't poison later `computeLoadTrend`/`computeLoadTrendSeries` points. Updated
README.md's documented `readinessBand` pseudocode and EWMA fold description to match.

### WR-01: EWMA lambda formula is duplicated between `ewmaFold` and `computeLoadTrendSeries`

**Files modified:** `packages/engine/src/trend.ts`
**Commit:** `0ca53fb`
**Applied fix:** Extracted `ewmaLambda(days)` and `ewmaStep(prev, today, lambda)` as the single
source of truth for both the smoothing formula and the CR-03 non-finite guard; both `ewmaFold`
and `computeLoadTrendSeries` now call through them instead of re-deriving the formula/guard
independently.

### WR-02: `dailyHSS` performs no input validation/clamping

**Files modified:** `packages/engine/src/daily.ts`, `packages/engine/src/__tests__/daily.test.ts`, `packages/engine/README.md`
**Commit:** `e8fdc87`
**Applied fix:** Applied the review's suggested fix — non-finite entries in `sessionScores` are
mapped to `0` before summing. Strengthened the existing `dailyHSS([NaN])` test (previously only
`not.toThrow()`) to assert a finite `0` result, and added coverage for a mixed
finite/non-finite array and `Infinity`. Documented the behavior in README.md's Daily HSS
section.

## Skipped Issues

None — all in-scope findings were fixed.

_Note: IN-01, IN-02, IN-03 were out of scope for this run (`fix_scope: critical_warning`) and
were not attempted._

---

_Fixed: 2026-07-08T19:44:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
