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
- [ ] **Phase 03: Onboarding & Lifting Logger** - Profile capture + a Strong/Hevy-speed lifting logger with live HSS feedback
- [ ] **Phase 04: Run Logger & Home Dashboard** - Run/conditioning logger plus the home screen readiness band and 28-day trend
- [ ] **Phase 05: HealthKit Integration** - Import runs/HR/bodyweight, write logged sessions back, dedupe against manual entries — lowest priority, first to cut
- [ ] **Phase 06: Polish & App Store Submission** - Icon, screenshots, privacy label/policy, Sentry health-data audit, EAS submission by ~July 25

## Phase Details

### Phase 01: Foundation

**Goal**: A working monorepo with pure-TS package skeletons, a persisted local database with committed migrations, and an Expo app that boots, migrates, and seeds data offline.
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):

  1. [x] The app runs entirely offline; local SQLite (op-sqlite) is the source of truth for all reads/writes.
  2. [x] On first boot, the exercise library is seeded with ≥40 HYROX/tactical movements, and re-running the seed is idempotent (no duplicates).
  3. [x] Schema changes ship as committed drizzle migration files applied automatically on app startup via `useMigrations`.

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

**Goal**: A user completes onboarding once, then logs a full lifting session at Strong/Hevy entry speed with live HSS feedback — fully offline.
**Depends on**: Phase 02 (engine functions callable for live HSS preview + session save)
**Requirements**: ONB-01, ONB-02, ONB-03, ONB-04, LIFT-01, LIFT-02, LIFT-03, LIFT-04, LIFT-05, LIFT-06, LIFT-07, LIFT-08
**Success Criteria** (what must be TRUE):

  1. User completes onboarding (sex, bodyweight, threshold HR, threshold pace) before any readiness number is ever shown, and can later view and edit those inputs from settings.
  2. User can toggle the display unit system (km ↔ mi) anywhere it applies, while all data remains stored in metric internally.
  3. User can find any seeded exercise in under 2 taps and log a set (load, reps, RPE, warmup flag) in ≤ 3 taps, with RPE entered via a persistent quick-row (6–10) that is never behind a modal and pre-selects the last-used value.
  4. Each new set for an exercise pre-populates with that exercise's previous-session weight + reps, and the user can add or remove sets inline.
  5. Completing a set starts a configurable auto-rest timer in a persistent banner; the session HSS updates live as each set is logged; the user can save or discard the session (discard requires confirmation) and sees the session HSS on the finish screen.

**Plans**: 7/9 plans executed

Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Engine + shared foundations: bodyweight rep-max e1RM (D-18), carry/sled stress (D-20), session carry composition, pure km/mi + kg/lb units + shared vitest
- [x] 03-02-PLAN.md — DB schema migration (bwFactor/entryMode/finishedAt/deletedAt/addedLoadKg/durationS/restTimerDefault) + seed metadata + previous-session/soft-delete query builders [BLOCKING migration]
- [x] 03-03-PLAN.md — App deps install + legitimacy checkpoint, dark-only design system, Home/Log/Settings tab shell + Home placeholder

**Wave 2** *(blocked on Wave 1)*

- [x] 03-04-PLAN.md — Onboarding gate (Stack.Protected) + wizard scaffold + sex/bodyweight/units steps + soft validation + resume detection

**Wave 3** *(blocked on Wave 2)*

- [x] 03-05-PLAN.md — Threshold HR/pace capture (direct + estimate paths) + reusable review screen + profile save (ONB-01)
- [x] 03-06-PLAN.md — Lifting logger core: session store, effective-load + commit pipeline, exercise picker, SetRow, live HSS session screen, add/remove sets

**Wave 4** *(blocked on Wave 3)*

- [x] 03-07-PLAN.md — Auto-rest timer banner + background notifications + haptics (LIFT-05) [on-device checkpoint]
- [ ] 03-08-PLAN.md — Finish summary + confirmed soft-delete discard + HSS breakdown sheet + warning badges (LIFT-07)
- [ ] 03-09-PLAN.md — Settings tab: profile editor (ONB-02) + units toggle (ONB-04) + default rest timer

**UI hint**: yes

---

### Phase 04: Run Logger & Home Dashboard

**Goal**: A user logs a run/conditioning session in under a minute and sees a live readiness band + 28-day trend on the home screen that reflects both lifting and running.
**Depends on**: Phase 03 (onboarding profile for intensityFactor resolution; write→recompute→UI reactive chain proven end-to-end via the lifting logger)
**Requirements**: RUN-01, RUN-02, RUN-03, RUN-04, RUN-05, RUN-06, HOME-01, HOME-02, HOME-03, HOME-04, HOME-05, HOME-06
**Success Criteria** (what must be TRUE):

  1. User picks an activity type (Run / Erg / Conditioning), enters distance + duration with pace auto-calculating live, optionally enters average HR and a free-text note/tag, and the session date defaults to today but is editable.
  2. User sees the session HSS on the run finish screen immediately after saving.
  3. Home screen shows today's readiness band and today's total HSS prominently, above the fold.
  4. Home screen shows a 28-day ATL/CTL/TSB trend chart, and shows a "Building trend…" calibrating state instead of a readiness band until 14+ days of data exist.
  5. User can view workout history grouped by day showing day HSS + session count, with the double-session penalty explicitly labeled when sessionCount > 1 for that day.

**Plans**: TBD
**UI hint**: yes

---

### Phase 05: HealthKit Integration

**Goal**: A user's existing Apple Health data flows into Apsis without duplicate entries, and Apsis writes logged sessions back to Health — the lowest-priority v1.0 feature, first to defer if the timeline slips.
**Depends on**: Phase 04 (endurance_segment write path from the run logger; write→recompute reactive chain)
**Requirements**: HK-01, HK-02, HK-03, HK-04
**Success Criteria** (what must be TRUE):

  1. User grants HealthKit permission on request and the app imports their existing runs (distance, duration, HR) from Health.
  2. App imports the user's most-recent bodyweight from HealthKit into their profile.
  3. Imported HealthKit runs never create duplicate entries alongside manually logged runs covering the same time range.
  4. After a user saves a lifting or running session in Apsis, that session appears in the Health app.

**Plans**: TBD
**UI hint**: no (adapter/import logic; no new screens beyond the permission prompt)

---

### Phase 06: Polish & App Store Submission

**Goal**: A privacy-compliant, submittable build reaches App Store review with a buffer before the July 28 deadline.
**Depends on**: Phase 04 (feature-complete core required for submission); Phase 05 recommended but not blocking — per PROJECT.md, HealthKit is the designated cut if the timeline slips, and Phase 06 can proceed with an offline-only build if needed
**Requirements**: REL-01, REL-02, REL-03, REL-04
**Success Criteria** (what must be TRUE):

  1. App Store Connect listing has a 1024×1024 icon (no alpha channel), screenshots at required device sizes, and complete store metadata (description, keywords).
  2. App Store Connect's privacy nutrition label accurately declares Health & Fitness data collection, and a privacy policy is live at an HTTPS URL.
  3. Any crash/analytics reporting (Sentry) is audited and confirmed to scrub all HealthKit-derived values (HR, HSS, workout details) before any event or breadcrumb is sent.
  4. The binary is built via EAS and submitted to App Store review by ~July 25, 2026, leaving a 1–3 day buffer before July 28.

**Plans**: TBD
**UI hint**: no (submission logistics; no new app screens)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 01. Foundation | 4/4 | Complete | 2026-07-02 |
| 02. HSS Engine | 6/6 | Complete    | 2026-07-08 |
| 03. Onboarding & Lifting Logger | 7/9 | In Progress|  |
| 04. Run Logger & Home Dashboard | 0/TBD | Not started | - |
| 05. HealthKit Integration | 0/TBD | Not started | - |
| 06. Polish & App Store Submission | 0/TBD | Not started | - |
