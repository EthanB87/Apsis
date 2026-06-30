# Roadmap: Apsis (CONCURRENT)

## Overview

Apsis ships a single-builder iOS MVP that logs lifting and running in one app, computes a
unified Hybrid Stress Score (HSS), and surfaces a green/amber/red readiness band — fully
offline. The journey runs dependency-first: lay the monorepo + offline data layer, build
and exhaustively unit-test the pure-TS HSS engine (the moat), wire the fast logging UI and
home-screen readiness chart on top, layer in optional HealthKit import, then polish and
submit to the App Store before the ~July 28, 2026 deadline.

> **Reconstructed 2026-06-30** from git history + `BUILD.md §6` after the original
> `.planning/ROADMAP.md` was lost (`.planning/` is gitignored). Phase 01 plan breakdown is
> recovered from committed history; Phases 02–05 are derived from `BUILD.md §4–§6` and the
> research SUMMARY, and will be refined at plan time. The executed roadmap renumbered
> `BUILD.md`'s phases 1-based and deferred the engine to Phase 02 (per the
> `packages/engine/src/index.ts` skeleton comment).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Foundation — Monorepo + Expo App + DB Layer** - Offline-ready scaffold, six-table SQLite schema, migrations, exercise seed, boot sequence
- [ ] **Phase 2: HSS Engine (the moat)** - Pure-TS HSS + readiness compute, fully unit-tested per BUILD.md §4
- [ ] **Phase 3: Core Logger UI — Lifting + Run + Home Screen** - Fast offline logging, session HSS, readiness band + load trend chart
- [ ] **Phase 4: HealthKit Integration** - Import runs/HR/bodyweight; push workouts back (lowest priority; first to cut)
- [ ] **Phase 5: Polish + App Store Submission** - Onboarding, settings, icon/splash, privacy labels, TestFlight, submit

## Phase Details

### Phase 1: Foundation — Monorepo + Expo App + DB Layer
**Goal**: A buildable Expo SDK 56 dev-client app over a pnpm monorepo with a working offline SQLite data layer — schema, bundled migrations, and a seeded exercise library — running on first boot.
**Depends on**: Nothing (first phase)
**Requirements**: Local-first SQLite source of truth; seeded exercise library (~40 HYROX/tactical movements); clean migrations on fresh install (DATA-01); parameterized queries only (T-1-01)
**Success Criteria** (what must be TRUE):
  1. `pnpm` workspace resolves `@apsis/shared`, `@apsis/engine`, `@apsis/db` across package boundaries (node-linker=hoisted)
  2. Expo SDK 56 dev-client app builds and boots (op-sqlite pinned 16.2.2, `.sql` migration bundling wired into Metro/babel)
  3. `useMigrations()` runs the drizzle migration chain clean on a fresh install
  4. Exercise seed is idempotent and inserts ≥40 movements on first boot
  5. `vitest` runs green for engine + db packages
**Plans**: 4 plans (complete)

Plans:
- [x] 01-01: Root workspace config + strict TS base + pure-TS packages (shared, engine, db skeleton) + vitest infra
- [x] 01-02: Expo SDK 56 app scaffold + op-sqlite 16.2.2 pin + `.sql` migration bundling chain + EAS dev profile + Metro resolution gate
- [x] 01-03: Idempotent exercise seed (≥40) + op-sqlite client singleton + drizzle migrations generated (DATA-01 gate) + `@apsis/db` exports
- [x] 01-04: Boot sequence wired (`useMigrations` + `seedExercises` in `_layout.tsx`) + expo-dev-client

### Phase 2: HSS Engine (the moat)
**Goal**: Implement `packages/engine` exactly to the BUILD.md §4.1 public API as pure, zero-dependency TypeScript (time passed in, never `Date.now()`), with the full formula set and a literature-default versioned config, exhaustively unit-tested.
**Depends on**: Phase 1
**Requirements**: Pure-TS engine computes HSS + readiness on-device, fully unit-tested; cold-start must not show red on a single moderate day
**Success Criteria** (what must be TRUE):
  1. All BUILD.md §4.1 signatures implemented: `strengthStress`, `enduranceStress`, `sessionHSS`, `dailyHSS`, `computeLoadTrend`, `readinessBand`, plus `DEFAULT_CONFIG`
  2. ≥20 vitest tests pass, including golden lift/run cases, a double-session day, and a decaying rest week
  3. Calibration test asserts a 60-min threshold run HSS ≈ a hard 5×5 squat session HSS within a chosen ratio
  4. Cold-start test asserts a single moderate session does NOT produce a red band (calibrating state)
  5. Zero runtime deps in `packages/engine`; `tsc --noEmit` and `vitest` both green; `packages/engine/README.md` documents each formula + constant
**Plans**: TBD (estimate 2–3)

Plans:
- [ ] 02-01: TBD at plan time

### Phase 3: Core Logger UI — Lifting + Run + Home Screen
**Goal**: The minimum lovable product — log a lift and a run fully offline at Strong/Hevy entry speed, see session HSS on save, and watch the home-screen readiness band + load trend update via the write→recompute→useLiveQuery chain.
**Depends on**: Phase 2
**Requirements**: Fast lifting log (exercises/sets/reps/load/RPE, ≤3 taps/set, previous-session recall, warmup flag, rest timer); run/conditioning log (distance+duration→pace, optional avgHR); per-session + per-day HSS; readiness band + 14–30 day trend chart; onboarding captures engine inputs (sex, bodyweight, thresholds)
**Success Criteria** (what must be TRUE):
  1. User logs a lifting session with inline previous-session recall and warmup flagging
  2. User logs a run/conditioning session (distance+duration→auto-pace, optional HR)
  3. Session finish screen shows the computed HSS immediately on save
  4. Home screen shows the readiness band (calibrating state while CTL<10) + a 14–30 day load chart, updating live after a save
  5. Onboarding captures sex, bodyweight, thresholdHr, thresholdPace into `user_profile`
**Plans**: TBD (estimate 3–4)

Plans:
- [ ] 03-01: TBD at plan time

### Phase 4: HealthKit Integration
**Goal**: Import runs/HR/bodyweight from HealthKit into `endurance_segment` via the same `recomputeLoadDaily()` path as manual entry, deduplicate against manual rows, and write logged workouts back — on a physical device.
**Depends on**: Phase 3
**Requirements**: HealthKit import for runs/HR/weight + push workouts back (lowest priority; first to defer if timeline slips)
**Success Criteria** (what must be TRUE):
  1. An Apple Watch run appears in-app with a computed HSS without manual entry
  2. `intensityFactor` resolves from HR vs profile thresholds
  3. Imported sessions deduplicate against manual entries by timestamp range
  4. Custom `NSHealthShareUsageDescription` / `NSHealthUpdateUsageDescription` strings set in `app.json` (no generic defaults)
**Plans**: TBD (estimate 2)

Plans:
- [ ] 04-01: TBD at plan time

### Phase 5: Polish + App Store Submission
**Goal**: Ship — onboarding/settings/empty states, icon/splash, units toggle, Sentry with HealthKit data scrubbed, privacy nutrition label, screenshots, TestFlight, and submit before ~July 28, 2026.
**Depends on**: Phase 4 (HealthKit cut tolerated — can submit offline-only)
**Requirements**: App Store submittable v1.0; Definition of Done per BUILD.md §9
**Success Criteria** (what must be TRUE):
  1. App Store Connect app record created; privacy policy live at an HTTPS URL
  2. Privacy nutrition label completed (Health & Fitness data types declared)
  3. Sentry configured with HealthKit-derived values scrubbed from all events/breadcrumbs
  4. 1024×1024 icon (no alpha), screenshots at required resolutions, description + keywords ready
  5. TestFlight build verified on device; binary submitted for review on/before ~July 28, 2026
**Plans**: TBD (estimate 2)

Plans:
- [ ] 05-01: TBD at plan time

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation — Monorepo + Expo + DB | 4/4 | Complete | 2026-06-30 |
| 2. HSS Engine | 0/TBD | Not started | - |
| 3. Core Logger UI | 0/TBD | Not started | - |
| 4. HealthKit Integration | 0/TBD | Not started | - |
| 5. Polish + App Store Submission | 0/TBD | Not started | - |
