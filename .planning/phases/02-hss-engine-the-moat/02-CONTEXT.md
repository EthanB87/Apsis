# Phase 2: HSS Engine (the moat) - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement `packages/engine` — the pure-TypeScript HSS + readiness compute module that
is the product's moat. It turns logged strength sets and endurance segments into stress
numbers, rolls them into a daily training load (ATL/CTL/TSB), and maps that to a readiness
band. Zero runtime dependencies; all time/profile values are passed in as arguments (never
`Date.now()` inside). No UI, no I/O, no DB access.

The public API, core formulas, and default constant starting values are **locked by
`BUILD.md §4.1–§4.3`** and are not re-litigated here. This discussion captured the
product-feel and API-boundary decisions BUILD.md deliberately left open.

**In scope:** `strengthStress`, `enduranceStress`, `sessionHSS`, `dailyHSS`,
`computeLoadTrend`, `readinessBand`, `computeReadiness`, `epley1RM`, `DEFAULT_CONFIG`,
`CONFIG_VERSION`; ≥20 vitest tests incl. calibration + cold-start; `packages/engine/README.md`.

**Out of scope (other phases):** any UI, the db `recomputeLoadDaily()` orchestration
(Phase 3), HealthKit intensity resolution (Phase 4), mapping `exercise.bodyPart` →
`isLowerBody` (db/Phase 3). The one exception that touches the db: the `config_version`
column on `load_daily` (see D-08) — a small migration required to land in this phase.

</domain>

<decisions>
## Implementation Decisions

### Strength↔Endurance calibration (the moat's feel)
- **D-01:** Endurance is weighted **higher** than strength — a 60-min threshold run should
  cost roughly **~1.4×** a hard 5×5 squat session (sustained cardio is treated as more
  systemically/recovery-taxing than an equal-effort lift). Tune `kStrength`/`kEndurance`
  (from `DEFAULT_CONFIG`) to hit this.
- **D-02:** The mandatory calibration test (`BUILD.md §4.3`) asserts the run-vs-lift HSS
  ratio lands within **±25% of the 1.4× target** — i.e. run HSS ÷ lift HSS ∈ roughly
  **[1.05, 1.75]**. The constants are tuned until this passes. (This replaces the naive
  "within ±25% of equality" reading — the target is the 1.4 ratio, not 1.0.)

### Cold-start / calibration state
- **D-03:** Show `calibrating` (not a real readiness band) until chronic load
  **`CTL ≥ ctlCalibrationThreshold`**, a new tunable field on `EngineConfig` with
  **default 10**. CTL-based only — no calendar-day component (self-correcting: heavy
  trainers exit fast, sporadic loggers stay calibrating longer).
- **D-04:** Cold-start unit test (per `BUILD.md §4.4` / RESEARCH Pitfall 2): a single
  moderate session must produce `calibrating`, **never `red`**.

### Readiness API shape
- **D-05:** Keep `readinessBand(tsb, ctl)` as the **pure 3-color core** returning
  `'green' | 'amber' | 'red'`, exactly per `BUILD.md §4.1`. Add a higher-level
  **`computeReadiness(tsb, ctl, cfg?)`** that returns `'calibrating'` when
  `ctl < cfg.ctlCalibrationThreshold`, otherwise delegates to `readinessBand`. The db
  `recomputeLoadDaily()` (Phase 3) calls `computeReadiness` to populate
  `load_daily.readinessBand` (whose enum already includes `'calibrating'`).
- **D-06:** Readiness cutoffs on **TSB normalized by CTL** (`TSB/CTL`), encoded as named,
  tunable constants: **red when `TSB/CTL < −0.30`**, **amber when `−0.30 ≤ TSB/CTL < −0.10`**,
  **green when `TSB/CTL ≥ −0.10`**. Guard the `CTL = 0` divide (that path is `calibrating`
  anyway via D-03).

### e1RM ownership
- **D-07:** Engine exports a **pure `epley1RM(loadKg, reps)` helper** using Epley
  (`1RM = loadKg × (1 + reps/30)`, per `BUILD.md §5`). `strengthStress` **still accepts
  `e1rmKg` as input** per `BUILD.md §4.1`. The db layer (Phase 3) calls `epley1RM` on the
  heaviest **non-warmup** working set to cache `strength_set.e1rmKg` on insert — giving the
  schema comment "recomputed by engine in Phase 2" its home while keeping the engine pure.

### Missing-RPE handling
- **D-09:** A working set with no RPE (`strength_set.rpe` is nullable; the logger may skip
  it for speed) is treated as **RPE 8 → `rpeFactor = 0.8`**, via a tunable `defaultRpe`
  field on `EngineConfig` (default 8). Keeps the load number honest without forcing RPE
  entry. Warmup sets remain excluded from stress entirely (`isWarmup`).

### Trend input contract
- **D-10:** `computeLoadTrend` takes a **dense `number[]`** (daily HSS, oldest→newest, one
  value per calendar day, `0` for rest days), exactly per `BUILD.md §4.1`. The **caller
  (db layer) builds the dense series** from `load_daily` rows — the engine does no date
  math and stays pure. No sparse-data overload in v1.0.

### Config versioning (⚠️ has a Phase-1-schema ripple)
- **D-08:** Engine exports a **`CONFIG_VERSION`** constant (start at `1`) and
  `DEFAULT_CONFIG` carries it. **A `config_version` column is added to `load_daily`** so
  every computed row records which constant set produced it — enabling post-launch re-fit
  without ambiguity. **This requires a new drizzle migration** (touches the Phase 1 schema;
  `drizzle/` is append-only — generate, never edit). Planner must sequence this:
  schema change → `drizzle-kit generate` → commit migration → engine emits version → db
  writes it. Raw stress components (`strength_set.stressScore`,
  `endurance_segment.stressScore`) are already stored, so re-fit is doubly supported.

### Claude's Discretion
- Exact `kStrength`/`kEndurance` numeric values — tune empirically to satisfy D-01/D-02
  (start from `BUILD.md §4.3`: kStrength≈2.0, kEndurance≈1.0) and the ~30–120 HSS/hard-session
  target.
- EWMA seeding/initialization details for ATL/CTL on short series, rounding/precision of
  returned numbers (store/return unrounded; display rounding is a UI concern in Phase 3),
  and internal module/file structure of `packages/engine`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Engine spec (authoritative — wins on build decisions)
- `BUILD.md §4.1` — exact public API signatures (`StrengthSet`, `EnduranceSegment`,
  `EngineConfig`, `DEFAULT_CONFIG`, and the six core functions)
- `BUILD.md §4.2` — formulas (endurance, per-set strength, session HSS, daily HSS +
  double penalty, ATL/CTL EWMA, `TSB = CTL − ATL`, readiness band)
- `BUILD.md §4.3` — default constant starting values + the calibration-test mandate
- `BUILD.md §4.4` — engine acceptance criteria (≥20 tests, calibration test, zero deps,
  vitest + tsc green, README)
- `BUILD.md §5` — data model + Epley e1RM guidance ("estimate e1RM from the heaviest
  logged set via Epley and cache it")

### Project context
- `.planning/PROJECT.md` — constraints (engine purity, local-first, deadline) + Active
  requirement: "Pure-TS engine computes HSS + readiness on-device, fully unit-tested"
- `.planning/research/SUMMARY.md` — cold-start pitfall (Pitfall 2), CTL>10 calibration
  threshold rationale, "store raw components so constants can be re-fit" gap

### Existing schema (the engine's data shape, already built in Phase 1)
- `packages/db/src/schema.ts` — `strength_set` (nullable `rpe`, `e1rmKg`, `stressScore`),
  `endurance_segment` (`intensityFactor`, `stressScore`), `load_daily` (`atl`/`ctl`/`tsb`,
  `readinessBand` enum incl. `'calibrating'`; **needs `config_version` added per D-08**)
- `packages/shared/src/index.ts` — `ReadinessBand` type already includes `'calibrating'`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/engine/src/index.ts` — current skeleton (`ENGINE_VERSION = '0.0.1'` only);
  this phase fills it in. Keep/raise `ENGINE_VERSION`; add `CONFIG_VERSION` (D-08).
- `packages/shared/src/index.ts` — `ReadinessBand`, `Sex`, `Units`, `ActivityType` types
  already defined and align with D-05/D-06. New engine input/config types
  (`StrengthSet`, `EnduranceSegment`, `EngineConfig`) live in `packages/shared` per
  `BUILD.md §4.1` ("types live in packages/shared").
- `packages/engine` vitest infra already wired (Phase 1, plan 01-01) — tests go in
  `packages/engine/src/__tests__/`.

### Established Patterns
- **Engine purity is a hard constraint** (PROJECT.md + `BUILD.md §4`): zero runtime deps,
  no React, no I/O, time/profile passed in. The `__tests__/placeholder.test.ts` should be
  replaced by real golden-case tests.
- **Raw stress components are persisted** (`stressScore` columns) specifically so HSS
  constants can be re-fit later without a migration — engine must expose/return the raw
  `strengthStress`/`enduranceStress` values, not just the combined HSS.

### Integration Points
- Engine is consumed by the db `recomputeLoadDaily()` orchestration in **Phase 3** (write →
  recompute → `useLiveQuery` reactive chain). `computeReadiness` (D-05) and the dense-array
  contract (D-10) define that boundary now so Phase 3 can wire to it without surprises.
- D-08's `config_version` column is the one place this phase reaches back into the
  Phase-1 db schema; everything else is self-contained in `packages/engine` + `packages/shared`.

</code_context>

<specifics>
## Specific Ideas

- The "hybrid athlete, one currency" thesis drove D-01: the athlete explicitly wants
  endurance to carry slightly more stress weight than lifting (~1.4×), not strict equality.
- Logging speed is existential (PROJECT.md), which is why missing RPE must degrade
  gracefully to a sane default (D-09) rather than block entry or under-count.

</specifics>

<deferred>
## Deferred Ideas

- Deriving RPE from load-vs-e1RM intensity instead of a flat default — interesting but
  over-engineered for v1.0; revisit only if the flat `defaultRpe` proves inaccurate.
- Per-row config re-fit tooling / a constants admin surface — a post-launch concern; v1.0
  just records `config_version` (D-08) to make it possible later.

None of these expand Phase 2 scope — discussion stayed within the engine boundary.

</deferred>

---

*Phase: 2-hss-engine-the-moat*
*Context gathered: 2026-06-30*
