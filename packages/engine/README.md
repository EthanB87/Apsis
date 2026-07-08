# @apsis/engine

Pure TypeScript training-load engine — the Hybrid Stress Score (HSS) compute core. This is
the moat: **zero runtime dependencies** (only the first-party `@apsis/shared` workspace
link), no React, no I/O, no side effects, and it never reads the wall clock — every
compute function that needs "now" is given time explicitly as a parameter (there is no such
parameter in this package; nothing in it is time-of-day sensitive beyond ordered arrays of
daily values). Everything is deterministic, unit-testable, and reusable outside the app.

## Public API

Import everything from the package barrel:

```ts
import {
  // strength
  estimateE1RM,
  strengthStress,
  strengthStressDetailed,
  // endurance
  ifFromHR,
  ifFromPace,
  resolveIF,
  enduranceStress,
  enduranceStressDetailed,
  // session / daily
  sessionHSS,
  sessionHSSDetailed,
  dailyHSS,
  // trend / readiness
  computeLoadTrend,
  computeLoadTrendSeries,
  readinessBand,
  // config
  DEFAULT_CONFIG,
  mergeConfig,
  // version
  ENGINE_VERSION,
} from '@apsis/engine';
```

Every "detailed" function (`strengthStressDetailed`, `enduranceStressDetailed`,
`sessionHSSDetailed`) returns a breakdown object with the raw components (per-set stress,
`ss`/`es`, `warnings[]`) alongside the plain-number "facade" it backs (`strengthStress`,
`enduranceStress`, `sessionHSS`) — see **Deviations from BUILD.md** below (D-05). None of
these functions throw: invalid input is clamped into a physiologically sane range (or the
offending set is skipped) and every clamp/skip is recorded in `warnings[]` (D-15), because
the mid-workout logging loop must never crash.

## Formulas

All formulas take an optional `cfg?: Partial<EngineConfig>` last argument, merged over
`DEFAULT_CONFIG` via `mergeConfig`.

### Endurance stress (ES)

```
ES = durationMin * intensityFactor^2 * kEndurance
```

`durationMin = durationS / 60` (duration is clamped to `>= 0` first). `intensityFactor` is
clamped into `[0.3, 1.3]` before squaring. `intensityFactor` itself can be derived by the
caller via `ifFromHR(avgHR, thresholdHR)` (HR / threshold HR), `ifFromPace(paceSecPerKm,
thresholdPaceSecPerKm)` (threshold pace / pace — faster pace ⇒ higher IF), or
`resolveIF({ avgHR, thresholdHR, paceSecPerKm, thresholdPaceSecPerKm })`, which prefers HR
over pace when both are available (D-11, since HR reflects actual physiological cost) and
falls back to a neutral IF of `1.0` with a warning when neither is available.

### Strength stress (SS)

For each non-warmup set:

```
setStress = (loadKg / e1rmKg) * reps * (rpe / 10)
if (isLowerBody) setStress *= legMultiplier
```

`SS = sum(setStress over all sets) * kStrength`. Warmup sets (`isWarmup: true`) are excluded
entirely. Sets with `e1rmKg <= 0` are skipped (not clamped to a floor — clamping would
fabricate a stress number from a physically meaningless e1RM) and reported in `warnings[]`
(D-15). `rpe` is clamped to `[1, 10]`, `reps` to `[0, 100]`, `loadKg` floored at `0` with no
upper bound.

`estimateE1RM(loadKg, reps) = loadKg * (1 + reps / 30)` — the Epley estimator (D-10), meant
to be called on a lifter's heaviest logged set and cached by the Phase 3 profile layer.

### Session HSS

```
sessionHSS = SS + ES
```

A session may include strength sets, endurance segments, or both (a hybrid session).
`sessionHSSDetailed` sums `enduranceStressDetailed` across every entry in
`enduranceSegments` (an array, since a session can contain more than one endurance block)
and calls `strengthStressDetailed` once over the whole `strengthSets` array, concatenating
all warnings. The detailed result is version-stamped with `engineVersion` (==
`ENGINE_VERSION`) and the resolved `config` used to compute it (D-06), so a persisted score
is always traceable and re-computable after a future constant re-fit.

### Daily HSS

```
dailyHSS = sum(sessionScores)
if (sessionScores.length > 1) dailyHSS *= doublePenalty
```

Reflects the added systemic cost of training twice in one day (ENG-03). An empty day
returns `0`; a single session gets no penalty. Non-finite entries in `sessionScores`
(`NaN`/`Infinity`) are treated as `0` rather than corrupting the day total — `sessionScores`
is a public parameter, not an internal detail guaranteed to already be clamped, so `dailyHSS`
defends its own input per D-15 rather than trusting the caller.

### Rolling load trend (ATL / CTL / TSB)

ATL (acute training load, ~7-day time constant) and CTL (chronic training load, ~28-day
time constant) are exponentially-weighted moving averages of daily HSS, folded
day-by-day from a starting value of `0` (D-08):

```
lambda = 1 - exp(-1 / days)          // days = atlDays or ctlDays
value  = value + lambda * (todayHSS - value)
```

A non-finite `todayHSS` (`NaN`/`Infinity`, e.g. from a bad persisted row) is treated as `0`
for that day's fold step rather than corrupting `value` — without this, a single bad day
would `NaN` every subsequent day's ATL/CTL for the rest of the series.

```
TSB = CTL - ATL
```

Positive TSB means recent load has eased relative to the chronic baseline (fresher);
negative TSB means acute load is spiking above baseline (more fatigued).
`computeLoadTrend(dailyHSSByDay)` returns just the final `{ atl, ctl, tsb }`.
`computeLoadTrendSeries(dailyHSSByDay)` (D-07) additionally returns one
`{ atl, ctl, tsb, band }` point per input day, so the Phase 4 chart renders pure engine
output with no trend math duplicated in the UI layer.

### Readiness band

```
ratio = TSB / CTL
if (!isFinite(tsb) || !isFinite(ctl) ||
    historyDays < calibratingMinHistoryDays || ctl < calibratingCtlFloor) → 'calibrating'
else if (ratio < bandRedRatio)   → 'red'
else if (ratio < bandAmberRatio) → 'amber'
else                             → 'green'
```

The `'calibrating'` gate (D-01/D-02) is checked before any red/amber/green branch, so it
always wins — this is what guarantees a brand-new user (or a user returning from a layoff,
via the CTL floor) is never shown a misleading band, and also protects the ratio from a
near-zero `ctl` denominator. The gate also fails toward `'calibrating'` (never falls through
to `'green'`) when `tsb`/`ctl` themselves are non-finite — `NaN < x` is always `false`, so
without this explicit check a corrupted upstream value would silently fail open to
`'green'` instead of surfacing as a signal the engine lost track.

## `DEFAULT_CONFIG` constants (`packages/engine/src/config.ts`)

| Constant | Value | Meaning |
|---|---|---|
| `kStrength` | `4.4` | Scales summed strength set-stress onto the HSS axis. Calibrated (not the BUILD.md 2.0 starting guess) by this plan's `calibration.test.ts`: the canonical hard 5x5 squat (140 kg / 180 kg e1RM, 5 reps, RPE 9, lower-body) sums to a pre-`kStrength` set-stress of `22.75`; at `4.4` that lands `liftHSS ≈ 100.1`, within ±25% of the 60-min threshold-run anchor (D-13) and inside the ~30–120 hard-session range. |
| `kEndurance` | `1.6667` | Scales endurance stress onto the HSS axis. Derived from the D-14 anchor: 60 minutes at intensity factor 1.0 should land at ~100 HSS. Since `ES = durationMin * IF^2 * kEndurance`, solving `100 = 60 * 1^2 * kEndurance` gives `kEndurance = 100 / 60 ≈ 1.6667`. |
| `legMultiplier` | `1.3` | Systemic cost multiplier applied to lower-body strength sets (squats, deadlifts, lunges, etc.) — reflects the greater whole-body fatigue cost of heavy lower-body work vs. upper-body work of the same normalized intensity. |
| `doublePenalty` | `1.1` | Same-day compounding multiplier applied to the day total when more than one session is logged that day (ENG-03). |
| `atlDays` | `7` | Acute training load EWMA time constant, in days. |
| `ctlDays` | `28` | Chronic training load EWMA time constant, in days. |
| `calibratingMinHistoryDays` | `14` | Below this many days of logged history, `readinessBand` always reports `'calibrating'` regardless of TSB/CTL — covers brand-new users (D-02). |
| `calibratingCtlFloor` | `10` | Below this CTL value, `readinessBand` always reports `'calibrating'` — covers users returning from a layoff with too little recent chronic load to trust the TSB/CTL ratio (D-02). |
| `bandRedRatio` | `-0.3` | TSB/CTL ratio threshold: below this value the band is `'red'` (D-04). |
| `bandAmberRatio` | `-0.1` | TSB/CTL ratio threshold: at/above `bandRedRatio` but below this value the band is `'amber'`; at/above this value the band is `'green'` (D-04). |

Every compute function accepts an optional `cfg?: Partial<EngineConfig>` last argument,
resolved through `mergeConfig(cfg)` (spread over `DEFAULT_CONFIG`) so callers only ever need
to override the fields they care about.

## Deviations from BUILD.md (approved, 02-CONTEXT.md)

BUILD.md §4.1 wins on build decisions; these are the specific, approved deviations from its
literal signatures, decided during Phase 2 context-gathering:

- **D-01 — `'calibrating'` fourth band.** `readinessBand` returns `'calibrating' | 'green' |
  'amber' | 'red'`, not BUILD.md's literal 3-value union, so a cold-start or
  returning-from-layoff user is never shown a misleading red/amber/green signal.
- **D-03 — `readinessBand` opts param.** Signature is `readinessBand(tsb, ctl, opts: {
  historyDays }, cfg?)` rather than BUILD.md's bare `readinessBand(tsb, ctl)`, so the
  calibrating gate (D-01/D-02) has the history-length input it needs while staying a pure
  standalone function.
- **D-05 — detailed variants alongside facades.** Every BUILD.md-named function
  (`strengthStress`, `enduranceStress`, `sessionHSS`) is a thin bare-number wrapper over a
  `*Detailed` sibling (`strengthStressDetailed`, `enduranceStressDetailed`,
  `sessionHSSDetailed`) that returns the full breakdown (raw components, per-set stress,
  warnings). This keeps the BUILD.md contract intact while satisfying PROJECT.md's "engine
  logs raw components so constants can be re-fit later."
- **D-07 — `computeLoadTrendSeries` addition.** Ships alongside BUILD.md's
  `computeLoadTrend`, returning a per-day `{ atl, ctl, tsb, band }[]` so the Phase 4 chart
  can render pure engine output with zero trend math in the UI layer.

## Purity

- `packages/engine/package.json` has no runtime `dependencies` other than the first-party
  `@apsis/shared` workspace link — zero third-party runtime dependencies.
- No file under `packages/engine/src` reads the wall clock (no `Date.now()`,
  `performance.now()`, or `new Date()`); every time-ordered input (e.g.
  `dailyHSSByDay`) is passed in by the caller as a plain array.
- Every public function is a pure function: same input always produces the same output, no
  side effects, and (per D-15) never throws — invalid input is clamped/skipped and reported
  in `warnings[]` instead.

## Testing

`pnpm --filter @apsis/engine test` runs the full vitest suite (≥20 tests, including the
`calibration.test.ts` golden that anchors the D-13 ±25% cross-modality ratio). Test style
follows D-16: most tests assert behavioral properties and ranges (warmups excluded,
double-day > single-day, rest week decays ATL faster than CTL, band transitions), with a
handful of exact golden values pinning canonical scenarios (a known threshold run ≈ 100, the
calibration ratio).
