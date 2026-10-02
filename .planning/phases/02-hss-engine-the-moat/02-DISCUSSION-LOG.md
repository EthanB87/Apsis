# Phase 2: HSS Engine (the moat) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-30
**Phase:** 2-hss-engine-the-moat
**Areas discussed:** Lift↔run calibration, Cold-start rule, Readiness band API, e1RM ownership, Missing-RPE handling, Readiness cutoffs, Rest/missing-day handling, Config versioning

---

## Lift↔run calibration (weighting)

| Option | Description | Selected |
|--------|-------------|----------|
| Roughly equal (±25%) | Hard lift ≈ hard threshold hour; cleanest "one currency" reading | |
| Endurance weighted higher | Threshold hour ~1.3–1.5× a hard lift (cardio more recovery-taxing) | ✓ |
| Strength weighted higher | Hard heavy session > steady aerobic hour | |

**User's choice:** Endurance weighted higher
**Notes:** Captured as ~1.4× target. Reflects the athlete's view that sustained cardio is more systemically taxing than an equal-effort lift.

## Lift↔run calibration (test tolerance)

| Option | Description | Selected |
|--------|-------------|----------|
| ±25% ratio band | Within 0.8–1.25× of target — tunable yet meaningful | ✓ |
| ±10% ratio band | Stricter, more brittle | |
| ±40% ratio band | Very forgiving, only guards gross miscalibration | |

**User's choice:** ±25% ratio band
**Notes:** Applied around the 1.4× target (not around equality), so run/lift ∈ ~[1.05, 1.75].

## Cold-start rule (trigger)

| Option | Description | Selected |
|--------|-------------|----------|
| CTL threshold only | Calibrating until CTL ≥ threshold (default 10), config-tunable | ✓ |
| Time-based only | First 14 calendar days | |
| Both must clear | CTL ≥ 10 AND ≥ 14 days | |

**User's choice:** CTL threshold only
**Notes:** Self-correcting; one config knob (`ctlCalibrationThreshold`, default 10).

## Readiness band API

| Option | Description | Selected |
|--------|-------------|----------|
| Composite fn + keep core pure | `computeReadiness(tsb,ctl,cfg)` wraps pure 3-color `readinessBand` | ✓ |
| Extend readinessBand to 4 states | `readinessBand` returns `calibrating` directly | |

**User's choice:** Composite fn + keep core pure
**Notes:** Preserves BUILD.md §4.1 signature; db recompute calls the composite to write `load_daily.readinessBand`.

## e1RM ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Engine helper + still take input | Pure `epley1RM()` helper AND `strengthStress` keeps `e1rmKg` input | ✓ |
| Strictly passed in | Engine never estimates e1RM | |
| Engine computes internally | `strengthStress` derives e1RM, drops the input | |

**User's choice:** Engine helper + still take input
**Notes:** db caches e1rm on the heaviest non-warmup set via the helper; engine stays pure.

## Missing-RPE handling

| Option | Description | Selected |
|--------|-------------|----------|
| Default RPE 8 (0.8) | Tunable `defaultRpe` config, default 8 | ✓ |
| Skip from stress (counts 0) | Under-reports load | |
| Default RPE 7 (0.7) | More conservative | |

**User's choice:** Default RPE 8 (0.8 factor)
**Notes:** Protects logging speed without dishonest under-counting. Warmups still excluded entirely.

## Readiness cutoffs

| Option | Description | Selected |
|--------|-------------|----------|
| Balanced: red<−0.30, amber to −0.10 | Moderate (TSB/CTL) | ✓ |
| Conservative: red<−0.20, amber to 0 | Trips sooner | |
| Forgiving: red<−0.40, amber to −0.15 | Stays green through hard training | |

**User's choice:** Balanced (red `<−0.30`, amber `−0.30..−0.10`, green `≥−0.10`)
**Notes:** Encoded as named, tunable constants regardless.

## Rest/missing-day handling

| Option | Description | Selected |
|--------|-------------|----------|
| Caller passes dense array | Engine takes `number[]`, db fills rest days with 0 (per §4.1) | ✓ |
| Dense array + engine helper | Add pure `densifyDaily()` convenience helper | |
| Engine accepts sparse data | `computeLoadTrend` takes `{date,hss}[]`, fills gaps | |

**User's choice:** Caller passes dense array
**Notes:** Keeps engine pure and §4.1 signature intact; db owns the date-to-dense-series build.

## Config versioning

| Option | Description | Selected |
|--------|-------------|----------|
| CONFIG_VERSION constant only | Version constant, no schema column | |
| Version + store per row | `CONFIG_VERSION` + `config_version` column on `load_daily` | ✓ |
| Unversioned for v1.0 | Rely on stored raw components | |

**User's choice:** Version + store per row
**Notes:** ⚠️ Requires a new drizzle migration adding `config_version` to `load_daily` (Phase-1 schema touch; `drizzle/` is append-only). Planner must sequence the migration.

## Claude's Discretion

- Exact `kStrength`/`kEndurance` numeric values (tune to satisfy the calibration + magnitude targets).
- ATL/CTL EWMA seeding on short series; numeric rounding/precision (return unrounded; display rounding is Phase 3); internal file structure of `packages/engine`.

## Deferred Ideas

- Deriving RPE from load-vs-e1RM intensity instead of a flat default — revisit only if `defaultRpe` proves inaccurate.
- Per-row config re-fit tooling / constants admin surface — post-launch; v1.0 only records `config_version`.
