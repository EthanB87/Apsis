---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 3
current_phase_name: Onboarding & Lifting Logger
status: executing
stopped_at: Completed 03-02-PLAN.md
last_updated: "2026-07-09T21:04:31.227Z"
last_activity: 2026-07-09
last_activity_desc: Phase 3 execution started
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 15
  completed_plans: 12
  percent: 17
---

# Project State — Apsis

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-29)

**Core value:** Log lifting + running in one app, instantly see one honest combined
training-load number (HSS) and a readiness band — fully offline.
**Current focus:** Phase 3 — Onboarding & Lifting Logger
the pure-TS HSS engine (the moat), which the engine's own `index.ts` explicitly defers to
"Phase 2."

## Current Position

Phase: 3 (Onboarding & Lifting Logger) — EXECUTING
Plan: 7 of 9
Status: Ready to execute
Last activity: 2026-07-09 — Phase 3 execution started
traceability filled; 100% of the 39 pending v1.0 requirements mapped to Phases 02–06.

Progress: [██░░░░░░░░] 17% (1/6 phases complete)

## Performance Metrics

**Velocity:**

- Total plans completed: 6 (all in Phase 01)
- Average duration: not tracked (Phase 01 predates STATE.md instrumentation)
- Total execution time: not tracked

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01. Foundation | 4/4 | - | - |
| 02–06 | 0/TBD | - | - |
| 02 | 6 | - | - |

**Recent Trend:**

- Last 5 plans: 01-01, 01-02, 01-03, 01-04 (durations not recorded)
- Trend: N/A — insufficient instrumented data

*Updated after each plan completion*
| Phase 02 P01 | 5min | 3 tasks | 6 files |
| Phase 02 P02 | 8min | 2 tasks | 2 files |
| Phase 02 P03 | 6min | 2 tasks | 2 files |
| Phase 02 P05 | 6min | 2 tasks | 3 files |
| Phase 02 P04 | 4min | 3 tasks | 6 files |
| Phase 02 P06 | 5min | 3 tasks | 10 files |
| Phase 03 P01 | 7min | 3 tasks | 14 files |
| Phase 03 P02 | 5min | 3 tasks | 11 files |
| Phase 03 P03 | 6min | 2 tasks | 8 files |
| Phase 03 P04 | 13min | 2 tasks | 9 files |
| Phase 03 P05 | 9min | 2 tasks | 9 files |
| Phase 03 P06 | 27min | 3 tasks | 19 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Phase 01]: Engine implementation deferred to Phase 02 — Phase 01 shipped only the
  engine skeleton (`ENGINE_VERSION` const + placeholder test). Differs from the original
  research/SUMMARY.md, which proposed engine-first inside "Phase 0" alongside scaffolding.

- [Phase 01]: op-sqlite pinned to 16.2.2; `.sql` migration bundling wired into Metro/babel;
  EAS dev profile + prebuild configured (Expo Go is a dead end for this stack).

- [Roadmap]: ROADMAP.md rebuilt 2026-07-02 after the original was lost (`.planning/` was
  gitignored). Phase numbering starts at 01 (Foundation, complete) and continues 02–06;
  this is a reconstruction of the same v1.0 milestone, not a new one.

- [Phase 02]: EngineConfig interface lives in @apsis/shared; DEFAULT_CONFIG value lives in packages/engine to avoid circular workspace dependency
- [Phase 02]: kEndurance set to 1.6667 (D-14 anchor); kStrength left at 2.0 starting guess for plan 02-06 to tune
- [Phase 02]: e1rmKg<=0 sets are skipped entirely (not clamped to a floor) since clamping would fabricate a stress number from a physically meaningless e1RM — D-15 clamp-and-warn policy; a skip + warning is the honest response when e1RM data is invalid
- [Phase 02]: Reps clamped to 0..100 (MAX_REPS local const); loadKg only floored at 0 with no upper bound — Matches the plan's explicit clamp-range instructions for strengthStressDetailed
- [Phase 02]: resolveIF gates HR and pace pairs independently (both fields finite+positive) before deriving an IF, preventing a partial/garbage derivation from a single valid field paired with a missing or zero counterpart
- [Phase 02]: ifFromHR/ifFromPace each independently guard against a non-positive denominator (returning neutral 1.0), so they remain safe to call directly, not only through resolveIF's gating
- [Phase 02]: readinessBand signature is (tsb, ctl, opts: { historyDays }, cfg?) per D-03 approved deviation from BUILD.md's 3-band signature
- [Phase 02]: EWMA convergence test extended to 150 simulated days so CTL's 28-day time constant fully settles within tolerance -- real EWMA math, not a defect
- [Phase 02]: ENGINE_VERSION split out of index.ts into version.ts so session.ts can import it without a future circular import once index.ts becomes the full public barrel in plan 02-06
- [Phase 02]: sessionHSSDetailed sums enduranceStressDetailed per-segment across the enduranceSegments array; strength stays a single strengthStressDetailed call over the whole strengthSets array
- [Phase 02]: dailyHSS empty array returns 0, single session has no penalty, only length > 1 triggers doublePenalty (Claude's Discretion per 02-CONTEXT.md)
- [Phase 02]: kStrength calibrated to 4.4 (from 2.0 starting guess) via the D-13 calibration golden -- canonical hard 5x5 squat lands at HSS ~=100.1, ratio ~1.001 vs the 60-min threshold-run anchor (~=100.0)
- [Phase 02]: @apsis/engine public barrel wired in index.ts (config/strength/endurance/session/daily/trend/version); placeholder.test.ts removed
- [Phase ?]: kCarry = 10 tuned via D-20 golden test (4x40m heavy farmer's carry ~= 21.3 total CS, inside the 8..60 hard-accessory band)
- [Phase ?]: REP_MAX_TABLE floor row at 30 reps (pct 0.45) -- reps above 30 clamp instead of extrapolating (D-18/Pitfall 3)
- [Phase ?]: packages/shared/tsconfig.json now excludes src/**/__tests__ from the project build, mirroring packages/engine's existing pattern (pre-existing gap exposed by @apsis/shared's first test file)
- [Phase 03]: [Phase 03 P02]: battle-rope/plank get entryMode 'timed' despite battle-rope's endurance seed type -- PLAN.md scoped the Pitfall-5 endurance-null bucket to only run/ski-erg/rowing-erg/assault-bike
- [Phase 03]: [Phase 03 P02]: query builders typed against drizzle-orm's BaseSQLiteDatabase base class so the same builder functions work against both the real op-sqlite db and a sqlite-proxy mock in tests
- [Phase 03]: Used pnpm (not npm) to install @gorhom/bottom-sheet -- monorepo is pnpm-workspace-driven
- [Phase 03]: All five deps resolved to SDK-56-line versions via expo install/pnpm add, never hand-pinned to 57.x tags
- [Phase ?]: [Phase 03 P04]: Verified Stack.Protected's guard prop shape against installed expo-router 56.2.11 .d.ts files directly rather than trusting the research doc's web-synthesized example -- matched exactly, no Redirect fallback needed
- [Phase ?]: [Phase 03 P04]: TS project-reference redirect (composite+references) resolves @apsis/db imports to packages/db/dist declarations, not live src -- root pnpm run typecheck (tsc --build) is the actual cross-package verification entry point, confirmed again after Plan 01's same finding
- [Phase ?]: [Phase 03 P05]: Race-pace-to-threshold offsets: 5K x1.05, 10K x1.02, half-marathon x1.00 -- offset shrinks toward 1.0 as race distance approaches the engine's ~60-minute threshold-run calibration anchor
- [Phase ?]: [Phase 03 P05]: Added lib/profileVersion.ts (bumped zustand counter) + extended useProfileExists.ts to depend on it -- closes a gap where the review screen's profile insert would never flip the Stack.Protected gate without an app relaunch (Rule 2 deviation, outside this plan's declared files)
- [Phase ?]: loadFieldKg stores the full load for barbell lifts and only the added weight for bodyweight movements, so computeEffectiveLoad applies uniformly to both
- [Phase ?]: Carry-set bodyweightKg is not persisted per set; every recompute uses the current profile bodyweight for the engine's load-ratio multiplier
- [Phase ?]: Committed sets lock their input fields until unchecked, preventing draft/DB drift

### Pending Todos

None yet.

### Blockers/Concerns

- Per-phase artifacts (CONTEXT/PLAN/SUMMARY) for Phase 01 were never committed — history
  for that phase lives only in git commit messages (`6c02971`…`44f6017`). Not blocking;
  noted for context only.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none — first milestone, nothing closed yet)* | | | |

## Session Continuity

Last session: 2026-07-09T21:01:40.184Z
Stopped at: Completed 03-02-PLAN.md
Resume file: None
