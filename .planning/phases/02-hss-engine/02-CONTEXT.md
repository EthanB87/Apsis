# Phase 2: HSS Engine - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Pure-TS training-load engine in `packages/engine`: per-session strength/endurance HSS,
per-day HSS with double-session penalty, ATL/CTL/TSB over a 28-day window, and a
readiness band — deterministic, fully unit-tested (≥20 vitest tests), zero runtime
dependencies, no I/O, time always passed in. No UI, no persistence, no screens.
Validates the entire product thesis before any UI is built on top of it.

</domain>

<decisions>
## Implementation Decisions

### Cold-start & readiness band
- **D-01:** Cold-start surfaces as a **`'calibrating'` fourth band** (the shared
  `ReadinessBand` type in `packages/shared/src/index.ts` already includes it). This is a
  deliberate, approved deviation from BUILD.md's 3-band `readinessBand` signature.
- **D-02:** Calibrating triggers when **history < 14 days OR CTL below a floor**
  (starting floor ≈ CTL < 10; encode as a named constant in `EngineConfig`). Covers both
  brand-new users and returning-from-layoff users.
- **D-03:** API shape: **`readinessBand(tsb, ctl, opts: { historyDays })`** — minimal
  deviation from BUILD.md, stays a pure standalone function. Thresholds and the CTL floor
  live in `EngineConfig`.
- **D-04:** Band thresholds use **TSB normalized by CTL (TSB/CTL ratio)**: starting
  values red < −0.30, amber −0.30 to −0.10, green ≥ −0.10. Named constants, locked by
  golden tests, tunable without app releases.

### Return shapes & raw components
- **D-05:** **Breakdown objects with bare-number facades.** Detailed functions (e.g.
  `sessionHSSDetailed`) return rich objects — `{ hss, ss, es, perSetStress[], warnings[] }` —
  while the BUILD.md-named functions (`sessionHSS`, `strengthStress`, etc.) remain thin
  wrappers returning bare numbers. Keeps the BUILD.md contract AND satisfies PROJECT.md's
  "engine logs raw components so constants can be re-fit later" constraint.
- **D-06:** Detailed results are **version-stamped**: include `ENGINE_VERSION` (already
  exported) and the config used, so stored scores are traceable and re-computable after
  future constant re-fits.
- **D-07:** Trend API ships **both** `computeLoadTrend` (final `{ atl, ctl, tsb }` as
  specced in BUILD.md) **and** `computeLoadTrendSeries` returning a per-day
  `{ atl, ctl, tsb, band }[]` so the Phase 4 chart renders pure engine output — no trend
  math in the UI layer.
- **D-08:** **EWMA initialization starts at 0.** ATL/CTL build up from zero; the
  `'calibrating'` band covers the misleading early window. Deterministic and standard.

### Engine API scope (helpers)
- **D-09:** **IF derivation helpers live in the engine**: `ifFromPace(paceSecPerKm,
  thresholdPaceSecPerKm)` and `ifFromHR(avgHR, thresholdHR)`. `enduranceStress` still
  takes a resolved IF per BUILD.md — the helpers keep fitness math tested in the moat.
- **D-10:** **Epley e1RM estimator lives in the engine**: `estimateE1RM(loadKg, reps)`
  = load × (1 + reps/30). Phase 3 calls it on the heaviest logged set and caches the
  result, per BUILD.md §5.
- **D-11:** **HR wins over pace** when both are available for IF resolution (HR reflects
  actual physiological cost; pace is the fallback). Encode as a `resolveIF` helper with
  this precedence so Phases 3–5 all apply the same rule.
- **D-12:** **Bodyweight/no-e1RM movements deferred to Phase 3 convention**: the strength
  formula stays `loadKg / e1rmKg`; the Phase 3 logger is responsible for supplying
  effective load (added weight + bodyweight share) and an e1RM for such movements. No
  engine change in Phase 2.

### Calibration & input policy
- **D-13:** Calibration test: 60-min threshold run and hard 5x5 squat session must land
  **within ±25%** of each other (ratio 0.8–1.25).
- **D-14:** **HSS scale anchored to TSS convention**: 60 minutes at threshold (IF = 1.0)
  ≈ 100 HSS. With `ES = durationMin × IF² × kEndurance`, that puts `kEndurance ≈ 1.67`;
  tune `kStrength` so the calibration test (D-13) passes. Hard sessions should land in
  BUILD.md's 30–120 readable range.
- **D-15:** **Invalid inputs: clamp + warnings, never throw.** Clamp values into
  physiological ranges (RPE 1–10, IF ~0.3–1.3, load ≥ 0), skip truly unusable sets
  (e1RM ≤ 0), and report everything clamped/skipped in the detailed result's `warnings[]`.
  Logging must never crash mid-workout.
- **D-16:** **Test style: behavioral + a few goldens.** Most tests assert properties and
  ranges (warmups excluded, double-day > single-day, rest week decays ATL faster than CTL,
  calibration ratio, band transitions); a handful of exact golden values pin canonical
  scenarios (known threshold run ≈ 100 ± tolerance). Constants stay tunable without
  rewriting the suite.

### Claude's Discretion
- Exact CTL floor value for calibrating (start ≈ 10, tune in tests).
- EWMA formula details (per-day exponential smoothing constant derivation from
  `atlDays`/`ctlDays`), rest-day zero handling, empty-input semantics (empty arrays → 0).
- Config override merging (partial `EngineConfig` → merged with `DEFAULT_CONFIG`).
- Exact breakdown object field names and file/module organization inside
  `packages/engine/src`.
- Band hysteresis (none required for v1.0 unless tests reveal flapping).
- README depth beyond BUILD.md's requirement to document each formula and constant.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Engine spec (authoritative)
- `BUILD.md` §4 (lines ~100–195) — public API signatures, formulas, default constants,
  and acceptance criteria. BUILD.md wins on build decisions; deviations approved in this
  discussion are limited to D-01/D-03 (calibrating band + opts param), D-05 (detailed
  variants alongside facades), and D-07 (series function addition).
- `BUILD.md` §5 — data model context: how Phase 3/4 will persist engine outputs
  (`workouts.hss`, `load_daily` with `dayHss/atl/ctl/tsb/readinessBand`), Epley e1RM
  caching path.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — ENG-01..ENG-07 (all mapped to this phase).
- `.planning/ROADMAP.md` — Phase 02 goal and 5 success criteria (incl. the cold-start
  never-red rule).

### Types & existing code
- `packages/shared/src/index.ts` — `ReadinessBand` (includes `'calibrating'`), `Sex`,
  `Units`, `ActivityType`. Engine input/output types per BUILD.md live in
  `packages/shared`.
- `packages/engine/src/index.ts` — Phase 1 skeleton (`ENGINE_VERSION` export); replace
  placeholder test in `packages/engine/src/__tests__/`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/shared/src/index.ts`: `ReadinessBand`, `Sex`, `Units`, `ActivityType` types
  already defined — extend with engine input/output interfaces (BUILD.md says "types live
  in packages/shared").
- `packages/engine` package: vitest 4.1.9 + TypeScript 6.0.3 already wired
  (`pnpm --filter @apsis/engine test` works via the Phase 1 smoke test).
- `ENGINE_VERSION` constant already exported — reuse for D-06 version stamping.

### Established Patterns
- Engine purity constraint enforced from Phase 1: zero runtime deps, no `Date.now()`,
  time passed in. `packages/engine/package.json` has only devDependencies — keep it so.
- Monorepo: `@apsis/engine` may depend on `@apsis/shared` (workspace, pure TS) but
  nothing else.

### Integration Points
- Phase 3 (lifting logger) calls `sessionHSS`/`strengthStress` live per set and
  `estimateE1RM` for profile caching.
- Phase 4 (run logger + dashboard) calls `enduranceStress`, `dailyHSS`,
  `computeLoadTrendSeries`, and `readinessBand` for the home-screen chart.
- DB layer (Phase 3/4) persists `workouts.hss` and `load_daily` rows from engine output —
  engine itself never touches the DB.

</code_context>

<specifics>
## Specific Ideas

- "One honest combined number" is the product thesis — the calibration anchor
  (60-min threshold run ≈ 100, comparable to a hard 5x5 within ±25%) is what makes the
  number honest. Treat the calibration test as a first-class deliverable, not an
  afterthought.
- The `'calibrating'` band exists so the app never lies to a new user — never show red
  (or a fake green) before the engine has enough history to mean it.
- Engine must never throw during logging: clamp + warn (D-15). The mid-workout logging
  loop is existential per PROJECT.md.

</specifics>

<deferred>
## Deferred Ideas

- **Bodyweight-movement stress path in the engine** (alternate RPE/reps-driven formula
  for pull-ups, lunges, carries) — deferred to Phase 3; revisit if the effective-load
  convention (D-12) proves awkward for HYROX movements.

</deferred>

---

*Phase: 02-hss-engine*
*Context gathered: 2026-07-08*
