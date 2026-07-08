# Apsis

## What This Is

Apsis (working title "CONCURRENT") is a hybrid-athlete training tracker for iOS. It logs
**lifting and running in one app**, computes **one unified training-load number** (the Hybrid
Stress Score / HSS), and surfaces a **readiness trend** (green/amber/red). It is built for
serious HYROX and tactical athletes who currently duct-tape Strong/Hevy + Strava + a macro
app together and have no shared unit for total training stress.

## Core Value

Log both lifting and running, instantly see one honest combined training-load number (HSS)
and a readiness band — fully offline. If everything else fails, this must work.

## Requirements

### Validated

- [x] Pure-TS engine computes HSS + readiness on-device, fully unit-tested (the moat) — Validated in Phase 02: HSS Engine (61 vitest tests, calibration anchored at 60-min threshold run ≈ 100 HSS, cold-start 'calibrating' band)

### Active

- [ ] User can log a lifting session (exercises, sets, reps, load, RPE) with fast entry
- [ ] User can log a run / conditioning session (distance, duration, pace, HR if available)
- [ ] User sees a per-session and per-day HSS, plus a readiness band (green/amber/red)
- [ ] User sees a 14–30 day load / readiness trend on the home screen
- [ ] All logging works fully offline; local SQLite is the source of truth
- [ ] Onboarding captures the engine's inputs (sex, bodyweight, thresholds)
- [ ] Apple HealthKit import for runs/HR/weight + push logged workouts back (lowest-priority;
      first to defer if the timeline slips)

### Out of Scope

- Nutrition / macro tracking — cut to fast-follow (v1.1); biggest scope risk to the deadline
- Garmin integration — HealthKit only for launch; Garmin requires program access
- Android — React Native keeps the door open, but ship iOS first
- Programming / coaching, social feed, coach dashboards, hydration — later layers (v1.1+)
- Backend / cloud sync — a v1.1 concern; v1.0 runs entirely offline with no server

## Context

- Solo builder (Ethan Brockman / UnderCloud) with TypeScript / .NET / Azure background.
- The market splits into coaching apps (Edge, ROXFIT, trainhybrid.app) and nutrition apps
  (MacroFactor, Cronometer); nobody owns the logging layer underneath both. The wedge is
  being the single source of truth for what a hybrid athlete actually did, with a defensible
  unified-load model as the moat.
- Two source documents: `BUILD.md` (authoritative executable plan — wins on build decisions)
  and `hybrid_app_brief.docx` (full product/market reasoning, broader long-term vision).
- HSS formulas and default constants are literature-anchored starting points to be tuned;
  the engine logs raw components so constants can be re-fit later without app releases.

## Constraints

- **Timeline**: App Store build submitted for review by ~July 28, 2026 — Why: ~4-week window,
  must leave 1–3 day Apple review buffer before end of July.
- **Tech stack**: Expo (React Native), TypeScript, expo-router; op-sqlite + drizzle (or
  WatermelonDB); Zustand / React Query; victory-native charts — Why: one builder shipping fast,
  matches existing skills, locked in BUILD.md §3.
- **Engine purity**: `packages/engine` is pure TS — no React, no I/O, no `Date.now()` inside;
  time is passed in — Why: it's the IP/moat and must stay testable and reusable.
- **Local-first**: logging never blocks on the network — Why: athletes log mid-workout with no
  signal (basements, trails); the instant on-device feedback loop is the product.
- **Logging speed**: must match Strong/Hevy entry speed — Why: slow entry kills the daily habit;
  existential, not polish.

## Key Decisions

| Decision                                               | Rationale                                                     | Outcome   |
| ------------------------------------------------------ | ------------------------------------------------------------- | --------- |
| Build the pure-TS engine first (Phase 0) before any UI | De-risks the entire thesis; the HSS model is the moat         | — Pending |
| BUILD.md wins over the docx for all build decisions    | One authoritative executable plan prevents scope drift        | — Pending |
| iOS-first, HealthKit-only for v1.0                     | Apple integration is straightforward; Garmin/Android deferred | — Pending |
| Cut nutrition entirely from v1.0                       | Largest scope item; protects the ~4-week App Store window     | — Pending |
| Monorepo: apps/mobile + packages/engine, db, shared    | Isolates the testable IP; keeps build tooling simple          | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

_Last updated: 2026-07-08 after Phase 02 (HSS Engine) completion — engine shipped and verified; next: Phase 03 Onboarding & Lifting Logger_
