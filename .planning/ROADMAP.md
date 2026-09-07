# Roadmap: Apsis

## Overview

Apsis ships as a pure-TS training-load engine wrapped in an offline-first Expo app. The
build order follows the dependency chain, not a generic template: foundation (done) →
the HSS engine that is the entire product thesis → the two logging surfaces (lifting,
running) plus the home dashboard that makes the engine's output visible → HealthKit as an
isolated, cuttable adapter → App Store submission. Every phase after Foundation earns its
place because the next one is hollow without it: the loggers are meaningless without an
engine to score them, the dashboard is meaningless without loggers producing data, and
HealthKit and submission are additive layers on top of a working core.

> **Note on requirement count:** the Traceability table in REQUIREMENTS.md previously
> stated "37 total / 34 pending" — that was a stale placeholder. A full recount of the
> checklist gives **42 total v1.0 requirements (3 complete via Phase 01, 39 pending)**.
> This roadmap maps all 39 pending requirements; see Coverage below.


## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 01: Foundation** - Monorepo, pure-TS package skeletons, drizzle schema + migrations, seeded exercise library, Expo boot sequence — COMPLETE
- [x] **Phase 02: HSS Engine** - Pure-TS training-load engine (strength/endurance HSS, day HSS, ATL/CTL/TSB trend, readiness band), ≥20 vitest tests — the moat (completed 2026-07-08)
- [x] **Phase 03: Onboarding & Lifting Logger** - Profile capture + a Strong/Hevy-speed lifting logger with live HSS feedback (completed 2026-07-09)
- [x] **Phase 04: Run Logger & Home Dashboard** - Run/conditioning logger plus the home screen readiness band and 28-day trend (completed 2026-07-10)
- [x] **Phase 05: HealthKit Integration** - Import runs/HR/bodyweight, write logged sessions back, dedupe against manual entries — lowest priority, first to cut (completed 2026-07-12)
- [ ] **Phase 06: Polish & App Store Submission** - Icon, screenshots, privacy label/policy, Sentry health-data audit, EAS submission by ~July 25
- [x] **Phase 07: Nutrition Tracking** - Manual food logging, barcode scanning, custom recipes, day-type adaptive macro targets (per NUTRITION.md; promoted from v2 into v1, ships IN the July 28 submission build — executes before Phase 6's build/submission waves). Label OCR descoped 2026-07-20 after failing on-device. (completed 2026-07-20)

## Phase Details

### Phase 01: Foundation


**Plans**: 4 plans (complete)

Plans:

- [x] 01-01: Root workspace config + strict TypeScript base; pure-TS packages (shared, engine skeleton, db skeleton); vitest 4 test infra
- [x] 01-02: Expo SDK 56 mobile app scaffold; op-sqlite 16.2.2 pin + `.sql` migration bundling (Metro/babel); EAS dev profile + prebuild
- [x] 01-03: Idempotent exercise seed (≥40 movements) with test; op-sqlite client singleton + `@apsis/db` public exports; drizzle migrations generated + committed (0000_mushy_satana.sql)
- [x] 01-04: Boot sequence wired in `_layout.tsx` (useMigrations + seedExercises, BootStates.tsx); expo-dev-client added for EAS dev-client build

**Status**: COMPLETE — committed and pushed (commits `6c02971`…`44f6017`).

---

### Phase 02: HSS Engine

**Goal**: The pure-TS engine computes deterministic, fully unit-tested training-load and readiness numbers — validating the entire product thesis before any UI is built on top of it.
**Depends on**: Phase 01 (packages/shared types, monorepo, test infra)
**Requirements**: ENG-01, ENG-02, ENG-03, ENG-04, ENG-05, ENG-06, ENG-07
**Success Criteria** (what must be TRUE):

  1. Given a set of strength sets (load, reps, RPE), the engine returns a per-session strength HSS that excludes sets flagged as warmup.
  2. Given endurance segments (distance/duration/pace, optional HR), the engine returns a per-session endurance HSS.
  3. Given multiple sessions logged on the same day, the engine returns a per-day HSS that applies a double-session penalty when sessionCount > 1.
  4. Given a rolling window of daily HSS values, the engine returns ATL/CTL/TSB over a 28-day window and derives a green/amber/red readiness band from TSB and CTL — and a single cold-start session (< 14 days of history or low CTL) never produces a red band.
  5. `packages/engine` has zero runtime dependencies, never calls `Date.now()` internally (time is always passed in), and its ≥20 vitest unit tests pass via `pnpm --filter @apsis/engine test`.

**Plans**: 6/6 plans complete


Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Foundation: shared engine types + EngineConfig, DEFAULT_CONFIG constants, clamp-and-warn helper, @apsis/shared wiring (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Strength HSS: strengthStress/strengthStressDetailed + Epley estimateE1RM, warmup exclusion, leg multiplier (Wave 2)
- [x] 02-03-PLAN.md — Endurance HSS: enduranceStress + IF helpers (ifFromPace/ifFromHR/resolveIF), 60-min/IF-1.0 ≈100 anchor (Wave 2)
- [x] 02-05-PLAN.md — Trend + readiness: computeLoadTrend/Series (EWMA ATL/CTL/TSB) + readinessBand with cold-start 'calibrating' (Wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-04-PLAN.md — Session + daily rollup: sessionHSS (version-stamped) + dailyHSS with double-session penalty (Wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-06-PLAN.md — Barrel + calibration golden (kStrength tuning) + README + ≥20-test/purity verification (Wave 4)

**UI hint**: no (pure TS, no screens)

---

### Phase 03: Onboarding & Lifting Logger


## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 01. Foundation | 4/4 | Complete | 2026-07-02 |
| 02. HSS Engine | 6/6 | Complete    | 2026-07-08 |
| 03. Onboarding & Lifting Logger | 11/11 | Complete    | 2026-07-10 |
| 04. Run Logger & Home Dashboard | 10/10 | Complete    | 2026-07-10 |
| 05. HealthKit Integration | 9/9 | Complete    | 2026-07-12 |
| 06. Polish & App Store Submission | 6/8 | In Progress|  |

