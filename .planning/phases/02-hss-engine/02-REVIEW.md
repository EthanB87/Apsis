---
phase: 02-hss-engine
reviewed: 2026-07-08T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - packages/engine/package.json
  - packages/engine/README.md
  - packages/engine/src/__tests__/calibration.test.ts
  - packages/engine/src/__tests__/clamp.test.ts
  - packages/engine/src/__tests__/daily.test.ts
  - packages/engine/src/__tests__/endurance.test.ts
  - packages/engine/src/__tests__/readiness.test.ts
  - packages/engine/src/__tests__/session.test.ts
  - packages/engine/src/__tests__/strength.test.ts
  - packages/engine/src/__tests__/trend.test.ts
  - packages/engine/src/clamp.ts
  - packages/engine/src/config.ts
  - packages/engine/src/daily.ts
  - packages/engine/src/endurance.ts
  - packages/engine/src/index.ts
  - packages/engine/src/session.ts
  - packages/engine/src/strength.ts
  - packages/engine/src/trend.ts
  - packages/engine/src/version.ts
  - packages/shared/src/index.ts
findings:
  critical: 3
  warning: 2
  info: 3
  total: 8
status: issues_found
---

# Phase 02-hss-engine: Code Review Report

**Reviewed:** 2026-07-08T00:00:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

The engine correctly implements the documented formulas (verified the ES, SS, dailyHSS,
EWMA, and readiness-band arithmetic by hand against the golden tests, and they check out —
`kStrength`/`kEndurance` do land the D-13/D-14 calibration anchor). Purity is intact: no
`Date.now()`/`new Date()`/`Math.random()`/console/debugger anywhere in `src`, zero runtime
deps beyond `@apsis/shared`, `strict`/`noUncheckedIndexedAccess`/`exactOptionalPropertyTypes`
all enabled and respected.

However, the package's core sales pitch — "never throws, clamp + warn, garbage input can't
corrupt the number" (D-15) — has a real hole. `clampRange` only special-cases `Number.isNaN`,
not general non-finite/non-numeric input, and `strengthStressDetailed`'s `e1rmKg <= 0` skip
check is a raw comparison that NaN silently defeats (the classic `NaN <= 0 === false`
footgun). Because `dailyHSS`/`computeLoadTrend`/`computeLoadTrendSeries` fold values
sequentially with no guard of their own, a single bad set anywhere in a user's history
permanently NaNs every ATL/CTL value from that day forward — and `readinessBand`'s ratio
comparisons against NaN all evaluate false, so the band **fails open to `'green'`** instead
of `'calibrating'`. That is the worst possible failure mode for a readiness signal whose
entire purpose (ENG-06 / the cold-start "never mislead the user" guarantee) is to protect an
athlete from being told they're fine when the engine actually lost track. See CR-01..CR-03
below.

## Critical Issues

### CR-01: `clampRange` only guards `Number.isNaN`, not general non-finite/non-numeric input — silently passes `undefined`/non-numbers through unclamped and unwarned

**File:** `packages/engine/src/clamp.ts:19-30`
**Issue:** `clampRange` is the single shared primitive every numeric field (`rpe`, `reps`,
`loadKg`, `durationS`, `intensityFactor`) is clamped through, and the whole point of D-15 is
that it can never let garbage flow into a computed score. But the only non-finite guard is
`Number.isNaN(value)` (line 20). If `value` is `undefined`, `null`-coerced weirdness, or any
non-number sneaking past TypeScript's compile-time-only types (very plausible at the op-sqlite
row boundary, a JSON.parse result, or a form field that failed to parse), the comparisons
`value < min` and `value > max` both evaluate to `false` for `undefined` (since `undefined`
coerces to `NaN` for arithmetic comparison, and every comparison against `NaN` is `false`).
The function then returns `{ value: undefined }` with **no warning at all** — worse than the
NaN case, which at least gets a warning. That `undefined` then flows into arithmetic
(`ifClamp.value ** 2`, `rpeClamp.value / 10`, etc.) and silently becomes `NaN` with zero trace
of what happened.
**Fix:**
```ts
export function clampRange(value: number, min: number, max: number, label: string): ClampResult {
  if (!Number.isFinite(value)) {
    return { value: min, warning: `${label} ${value} is not a finite number, clamped to ${min}` };
  }
  if (value < min) {
    return { value: min, warning: `${label} ${value} below min ${min}, clamped` };
  }
  if (value > max) {
    return { value: max, warning: `${label} ${value} above max ${max}, clamped` };
  }
  return { value };
}
```
Add a regression test in `clamp.test.ts` for `clampRange(undefined as unknown as number, 1, 10, 'rpe')`
and a non-numeric string, asserting a finite value and a warning are always returned.

### CR-02: `e1rmKg <= 0` skip check is defeated by `NaN` — poisons `ss`/`hss` with no warning

**File:** `packages/engine/src/strength.ts:52-55`
**Issue:** Unlike every other numeric field on `StrengthSet`, `e1rmKg` is never routed
through `clampRange` — it's checked with a raw `if (set.e1rmKg <= 0)`. In JavaScript,
`NaN <= 0` evaluates to `false`, so a set with `e1rmKg: NaN` is **not** skipped. Execution
falls through to line 57, `(loadClamp.value / set.e1rmKg) * ...`, which divides by `NaN` and
produces `NaN` for that set's stress — with no warning recorded, unlike every other clamp/skip
path in this module. `NaN` then propagates through `perSetStress.reduce(...)` (line 65),
poisoning the whole session's `ss`, then `sessionHSSDetailed`'s `hss = ss + es`, and from
there `dailyHSS`'s sum (see CR-03).
**Fix:**
```ts
if (!(set.e1rmKg > 0)) {
  warnings.push(`e1rmKg ${set.e1rmKg} <= 0, skipping set`);
  continue;
}
```
(`!(x > 0)` is `true` for `NaN`, unlike `x <= 0`.) Add a regression test: `e1rmKg: NaN` should
skip the set, push a warning, and return `Number.isFinite(ss) === true` — the existing test
suite only covers `e1rmKg: 0`, not `NaN`.

### CR-03: No NaN/finite guard in the EWMA fold or `readinessBand` — one corrupted day permanently poisons ATL/CTL and the band fails open to `'green'`

**File:** `packages/engine/src/trend.ts:29-36, 61-81, 90-112`
**Issue:** `ewmaFold` (and the inlined equivalent in `computeLoadTrendSeries`) do
`value = value + lambda * (todayHSS - value)` with no check that `todayHSS` — or the running
`value` itself — is finite. Once a single `NaN` enters `dailyHSSByDay` (via CR-01/CR-02, or
any future bug/bad persisted row), `value` becomes `NaN` and **stays `NaN` for every
subsequent day**, because `NaN` propagates through every future fold step. Downstream,
`readinessBand(tsb, ctl, ...)` (line 61) checks `ctl < config.calibratingCtlFloor` at line 69
— but `NaN < 10` is `false`, so the calibrating gate does **not** trigger. Execution falls
through to `ratio = tsb / ctl` (= `NaN`), and both `ratio < bandRedRatio` and
`ratio < bandAmberRatio` are `false` for `NaN`, so the function falls through to the final
`return 'green'` (line 80). This is a fail-open, not fail-safe, outcome: a single bad logged
set anywhere in a user's history silently and permanently turns their readiness signal into
"always green" — the exact opposite of ENG-06's cold-start "never mislead the user" guarantee,
and arguably worse than showing `'red'` incorrectly, since the user gets false reassurance
with no visible warning anywhere in the returned band value.
**Fix:** Guard at both layers (defense in depth, given CR-01/CR-02 are the root cause but this
is the safety-critical backstop):
```ts
// ewmaFold — treat non-finite daily input as 0 rather than corrupting all future days
function ewmaFold(dailyHSSByDay: number[], days: number): number {
  const lambda = 1 - Math.exp(-1 / days);
  let value = 0;
  for (const todayHSS of dailyHSSByDay) {
    const safeToday = Number.isFinite(todayHSS) ? todayHSS : 0;
    value = value + lambda * (safeToday - value);
  }
  return value;
}
```
```ts
// readinessBand — fail toward 'calibrating', never silently toward 'green'
if (
  !Number.isFinite(tsb) ||
  !Number.isFinite(ctl) ||
  opts.historyDays < config.calibratingMinHistoryDays ||
  ctl < config.calibratingCtlFloor
) {
  return 'calibrating';
}
```
Add a regression test asserting `readinessBand(NaN, NaN, { historyDays: 30 })` returns
`'calibrating'`, not `'green'`.

## Warnings

### WR-01: EWMA lambda formula is duplicated between `ewmaFold` and `computeLoadTrendSeries` — drift risk

**File:** `packages/engine/src/trend.ts:30, 95-96`
**Issue:** `ewmaFold` computes `lambda = 1 - Math.exp(-1 / days)` and folds a full array in one
pass. `computeLoadTrendSeries` needs incremental per-day values (to emit a band at every point),
so it re-derives `atlLambda`/`ctlLambda` with the identical formula instead of reusing
`ewmaFold`. The two implementations currently agree (proven only by the
`trend.test.ts` "final point matches computeLoadTrend" assertion), but the smoothing formula
is now defined in two places that must be kept manually in sync — a future constant re-fit or
formula tweak (e.g. a half-life derivation) applied to one and not the other would silently
break trend/series agreement, and nothing at compile time would catch it.
**Fix:** Extract a shared `ewmaLambda(days: number): number` helper (or an incremental
`ewmaStep(prev, today, lambda)` helper) used by both `ewmaFold` and
`computeLoadTrendSeries`, so the formula has exactly one source of truth.

### WR-02: `dailyHSS` performs no input validation/clamping, unlike every other public engine function

**File:** `packages/engine/src/daily.ts:19-26`
**Issue:** Every other public compute function in this package (`strengthStressDetailed`,
`enduranceStressDetailed`, `resolveIF`) validates/clamps its numeric inputs and reports
warnings per D-15. `dailyHSS` sums `sessionScores` with a bare `reduce` and no guard at all —
it relies entirely on callers only ever passing already-clamped `sessionHSS` outputs. Given
`sessionScores` is a public function parameter (not an internal detail), a caller passing a
stray `NaN`/`Infinity` (e.g., from an unrelated bug, or before CR-01/CR-02 are fixed) will
silently corrupt the day total with no warning, breaking the package-wide "never produce
garbage silently" contract stated in the README's Purity section. `daily.test.ts` line
28-31 asserts only `not.toThrow()` for `dailyHSS([NaN])`, not that the result is finite —
so this gap has no regression coverage either.
**Fix:** At minimum, filter/guard non-finite entries defensively:
```ts
export function dailyHSS(sessionScores: number[], cfg?: Partial<EngineConfig>): number {
  const config = mergeConfig(cfg);
  const safeScores = sessionScores.map((s) => (Number.isFinite(s) ? s : 0));
  const total = safeScores.reduce((sum, s) => sum + s, 0);
  return sessionScores.length > 1 ? total * config.doublePenalty : total;
}
```

## Info

### IN-01: `MAX_REPS`, `MIN_IF`, `MAX_IF` are hardcoded module constants instead of `EngineConfig` fields

**File:** `packages/engine/src/strength.ts:15`, `packages/engine/src/endurance.ts:15-16`
**Issue:** `config.ts`'s stated design philosophy (and the README's "Every formula takes an
optional `cfg?`... resolved via `mergeConfig`") is that tunable constants live in
`EngineConfig` so they can be re-fit without a code change. `MAX_REPS = 100` and
`MIN_IF = 0.3` / `MAX_IF = 1.3` are exactly this kind of physiological-range tuning constant,
but they're hardcoded as file-local `const`s outside the config object, inconsistent with
`kStrength`, `legMultiplier`, `bandRedRatio`, etc., which all live in `EngineConfig`.
**Fix:** Add `maxReps`, `minIntensityFactor`, `maxIntensityFactor` to `EngineConfig`/
`DEFAULT_CONFIG` and reference `config.maxReps` etc. in `strengthStressDetailed`/
`enduranceStressDetailed` instead of the module-level constants.

### IN-02: Clamp warnings are recorded for a set even when it is subsequently skipped for bad `e1rmKg`

**File:** `packages/engine/src/strength.ts:38-63`
**Issue:** `rpeClamp`/`repsClamp`/`loadClamp` warnings are pushed to `warnings[]` (lines
43-50) before the `e1rmKg <= 0` skip check (line 52). If a set has both an out-of-range
`rpe`/`reps`/`loadKg` and a non-positive `e1rmKg`, the caller sees clamp warnings for fields
that turned out not to matter (the set contributes nothing to `ss` either way), which is
noisy/confusing if `warnings[]` is ever surfaced directly in a logging UI.
**Fix:** Move the `e1rmKg` skip check above the rpe/reps/load clamp calls so a skipped set
only ever produces the one "skipping set" warning.

### IN-03: Heavy internal planning-ID jargon embedded throughout doc comments

**File:** `packages/engine/src/trend.ts`, `packages/engine/src/strength.ts`,
`packages/engine/src/endurance.ts`, `packages/engine/src/version.ts` (pervasive)
**Issue:** Doc comments throughout reference internal decision/requirement IDs (`D-01`
through `D-16`, `ENG-01` through `ENG-06`, `T-02-05-Div`, `"plan 02-06"`) that are only
resolvable by reading `.planning/phases/02-hss-engine/02-CONTEXT.md`. This couples the
shipped code's documentation to an external, non-shipped planning artifact — a future
contributor (or the App Store reviewer's static-analysis tooling, or just future-you in six
months without the planning directory open) can't fully understand a comment like
`version.ts:6` ("once index.ts becomes the full public barrel (plan 02-06)") without that
external context.
**Fix:** Not urgent, but consider ensuring each comment is self-contained on a first read
(explain the *what/why* in-line) and treat the decision ID as a supplementary cross-reference
rather than the only explanation.

---

_Reviewed: 2026-07-08T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
