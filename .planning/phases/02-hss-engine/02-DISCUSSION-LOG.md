# Phase 2: HSS Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-08
**Phase:** 02-hss-engine
**Areas discussed:** Cold-start & readiness band, Return shapes & raw components, Engine API scope (helpers), Calibration & input policy

---

## Cold-start & readiness band

| Option | Description | Selected |
|--------|-------------|----------|
| 'calibrating' band (Recommended) | Honest 4th state — shared ReadinessBand type already includes it; neutral UI state until enough history; deviates from BUILD.md's 3-band signature | ✓ |
| Clamp to amber | Keep 3-band signature; degrade red to amber during cold-start | |
| Clamp to green | Keep 3-band signature; cold-start always green | |

**User's choice:** 'calibrating' band

| Option | Description | Selected |
|--------|-------------|----------|
| Days OR low CTL (Recommended) | Calibrating when history < 14 days OR CTL below a floor (~10); covers new users and returning-from-layoff users | ✓ |
| Days only | Strictly first 14 calendar days | |
| CTL floor only | Whenever CTL below floor, regardless of history length | |

**User's choice:** Days OR low CTL

| Option | Description | Selected |
|--------|-------------|----------|
| Add params to readinessBand (Recommended) | readinessBand(tsb, ctl, opts: { historyDays }); thresholds + CTL floor in EngineConfig | ✓ |
| Fold into computeLoadTrend | Trend returns { atl, ctl, tsb, band } | |
| Both | Primitive + convenience | |

**User's choice:** Add params to readinessBand

| Option | Description | Selected |
|--------|-------------|----------|
| TSB/CTL ratio, tuned in tests (Recommended) | red < −0.30, amber −0.30..−0.10, green ≥ −0.10 as starting values; named constants locked by golden tests | ✓ |
| Absolute TSB bands | Fixed cutoffs (red < −20, etc.) like classic TSB guidance | |
| You decide | Claude picks during research/planning | |

**User's choice:** TSB/CTL ratio, tuned in tests

---

## Return shapes & raw components

| Option | Description | Selected |
|--------|-------------|----------|
| Breakdown objects, number facades (Recommended) | Detailed functions return rich objects; BUILD.md-named functions stay thin bare-number wrappers | ✓ |
| Change signatures to return objects | One API, every BUILD.md signature deviates | |
| Bare numbers only | Exactly BUILD.md; no raw-component output | |

**User's choice:** Breakdown objects, number facades

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — engineVersion in breakdowns (Recommended) | Detailed results include ENGINE_VERSION + config used; old scores identifiable/re-computable after re-fits | ✓ |
| No — keep outputs pure | DB layer stamps version at save time | |
| You decide | Claude picks during planning | |

**User's choice:** Yes — engineVersion in breakdowns

| Option | Description | Selected |
|--------|-------------|----------|
| Both: final + series function (Recommended) | computeLoadTrend as specced + computeLoadTrendSeries per-day { atl, ctl, tsb, band }[] for charts | ✓ |
| Final values only | Phase 4 slices the array itself (O(n²) chart prep) | |
| You decide | Claude decides during planning | |

**User's choice:** Both: final + series function

| Option | Description | Selected |
|--------|-------------|----------|
| Start at 0 (Recommended) | ATL/CTL build from zero; 'calibrating' band covers early window | ✓ |
| Seed from first days' average | Initialize to mean of first ~7 days | |
| You decide | Claude picks, anchored to literature | |

**User's choice:** Start at 0

---

## Engine API scope (helpers)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, in the engine (Recommended) | Export ifFromPace + ifFromHR; enduranceStress still takes resolved IF per BUILD.md | ✓ |
| No — caller-resolved, app-side | Logger computes IF from profile thresholds | |
| You decide | Claude decides during planning | |

**User's choice:** Yes, in the engine

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — estimateE1RM in engine (Recommended) | Epley (load × (1 + reps/30)); Phase 3 caches from heaviest logged set per BUILD.md §5 | ✓ |
| No — Phase 3 concern | Logger owns the estimator | |
| You decide | Claude decides during planning | |

**User's choice:** Yes — estimateE1RM in engine

| Option | Description | Selected |
|--------|-------------|----------|
| HR wins when present (Recommended) | HR reflects actual physiological cost; pace is fallback; encode as resolveIF precedence | ✓ |
| Pace wins when present | Pace deliberate/threshold-anchored; HR only when pace missing | |
| Caller chooses per-session | Both helpers, no built-in precedence | |

**User's choice:** HR wins when present

| Option | Description | Selected |
|--------|-------------|----------|
| Defer — caller supplies effective load (Recommended) | Formula stays loadKg/e1rmKg; Phase 3 logger supplies effective load + e1RM for bodyweight movements | ✓ |
| Engine handles it now | Alternate RPE/reps-driven path for bodyweight-flagged sets | |
| You decide | Claude decides during planning | |

**User's choice:** Defer — caller supplies effective load

---

## Calibration & input policy

| Option | Description | Selected |
|--------|-------------|----------|
| Within ±25% (Recommended) | Ratio 0.8–1.25 — neither modality dominates; constants stay literature-plausible | ✓ |
| Within ±10% | Near-equal by construction; aggressive tuning risk | |
| Within ±50% | Loose sanity check; weakens the unified-load claim | |

**User's choice:** Within ±25%

| Option | Description | Selected |
|--------|-------------|----------|
| Anchor: 60-min threshold run = ~100 (Recommended) | Matches TSS convention; kEndurance ≈ 1.67; hard sessions fall in 30–120 range | ✓ |
| Keep BUILD.md's loose 30–120 range | No fixed anchor | |
| You decide | Claude picks anchor during planning | |

**User's choice:** Anchor: 60-min threshold run = ~100

| Option | Description | Selected |
|--------|-------------|----------|
| Clamp + warnings in breakdown (Recommended) | Never throw mid-workout: clamp physiological ranges, skip unusable sets, report in warnings[] | ✓ |
| Throw on invalid | Fail fast with typed errors; callers validate | |
| Silently exclude invalid | Skip bad inputs with no signal | |

**User's choice:** Clamp + warnings in breakdown

| Option | Description | Selected |
|--------|-------------|----------|
| Behavioral + a few goldens (Recommended) | Property/range tests + a handful of exact golden values pinning canonical scenarios | ✓ |
| Exact goldens everywhere | Snapshot every scenario; re-fits rewrite the suite | |
| You decide | Claude picks the mix during planning | |

**User's choice:** Behavioral + a few goldens

---

## Claude's Discretion

- Exact CTL floor value for calibrating (start ≈ 10, tune in tests)
- EWMA smoothing-constant derivation, rest-day zero handling, empty-input semantics
- Config override merging (partial EngineConfig → DEFAULT_CONFIG)
- Breakdown object field names and engine module organization
- Band hysteresis (only if tests reveal flapping)
- README depth beyond BUILD.md's formula/constant documentation requirement

## Deferred Ideas

- Bodyweight-movement stress path in the engine (alternate RPE/reps-driven formula) — revisit in Phase 3 if the effective-load convention proves awkward
