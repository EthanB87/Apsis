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
- [x] User can log a lifting session (exercises, sets, reps, load, RPE) with fast entry — Validated in Phase 03: tabular ledger set rows (tap-to-type), on-device UAT 9/9 passed incl. rest timer (LIFT-05) and crash-resume
- [x] Onboarding captures the engine's inputs (sex, bodyweight, thresholds) — Validated in Phase 03: 6-step wizard (units before bodyweight), direct-entry + estimate paths, forward-only Settings edits
- [x] User can log a run / conditioning session (distance, duration, pace, HR if available) — Validated in Phase 04: run entry form with date picker, erg/run IF resolution, on-device UAT passed
- [x] User sees a per-session and per-day HSS, plus a readiness band (green/amber/red) — Validated in Phase 04: HSS ring + readiness band on TODAY, per-day totals with double-day load adjustment in History
- [x] User sees a 14–30 day load / readiness trend on the home screen — Validated in Phase 04: 28-day Skia trend chart with scrub tooltip, calibrating hero <14 days
- [x] All logging works fully offline; local SQLite is the source of truth — Validated in Phases 03–04: op-sqlite JSI + drizzle, write→recompute→UI chain proven on device with no network path
- [x] Apple HealthKit import for runs/HR/weight + push logged workouts back — Validated in Phase 05: 90-day backfill + foreground anchor sync, provenance-based dedupe, write-back with delete-sync, on-device UAT 4/4 passed (post code-review fixes); security review clean (10/10 threats closed)
- [x] Shareable session card (Strava-style) — Validated in Phase 08: photo-first compose (pick/swap/skip + permission fallbacks), Skia card with HSS ring (compact top-left on photo, centered hero on void), stat trio + APSIS footer, PNG export via iOS share sheet from finish screen and History detail; full on-device UAT passed, verification 16/16 (scoped by 08-CONTEXT.md D-01..D-16, no v1.0 REQ-IDs by design)

### Active

- (none — all v1.0 feature requirements validated; Phase 06 is release polish/submission)

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
| iOS-first, HealthKit-only for v1.0                     | Apple integration is straightforward; Garmin/Android deferred | ✓ Good — Phase 05 shipped import/write-back/dedupe on @kingstinct/react-native-healthkit |
| Cut nutrition entirely from v1.0                       | Largest scope item; protects the ~4-week App Store window     | — Pending |
| Monorepo: apps/mobile + packages/engine, db, shared    | Isolates the testable IP; keeps build tooling simple          | — Pending |
| Logging UI: tabular tap-to-type ledger rows, no steppers (user superseded DESIGN-SYSTEM.md component specs for the logging surface; palette stays binding) | Steppers could not fit a single set row at iPhone widths; keypad entry is faster (Strong/Hevy parity) | ✓ Shipped Phase 03, approved on device |
| Session-store access must be focus-gated (useFocusEffect, never bare useEffect) | expo-router keeps prior screens mounted; unfocused screens rehydrating the store caused infinite loops | ✓ Fixed Phase 03 (03-10) |
| Rest-notification invariant: foregrounded ⇒ none pending; backgrounded + live timer ⇒ exactly one | Cancel-on-foreground without reschedule-on-background silently killed LIFT-05 notifications | ✓ Fixed Phase 03 (03-10) |
| Day totals always read persisted load_daily.dayHss, never a local re-sum | One source of truth for daily load; UI re-derivation would drift from the engine's double-day penalty math | ✓ Shipped Phase 04 |
| iOS native linking deferred to EAS cloud builds (Windows host); Metro export is the local gate | Windows cannot prebuild ios/; native-module changes require a fresh EAS dev build before on-device testing | ✓ Working Phase 02–04 (bit us once: stale dev client + out-of-sync pnpm-lock.yaml broke UAT start, fixed 2026-07-11) |
| History paginates client-side over one full-table read per focus | Matches recomputeLoadDaily's read-everything-fold-in-memory discipline; local-first dataset stays small at v1.0 scale | ✓ Shipped Phase 04 |

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

_Last updated: 2026-08-03 after Phase 08 (Share Card Social Overlay) completion — photo-first share card shipped (Skia render → PNG → iOS share sheet, both entry points), on-device UAT passed; code review found 1 blocker (stale-export race on photo swap) + 2 warnings, all fixed and re-verified 16/16; Skia matchFont→useFont lesson logged (expo-font families are invisible to Skia's font manager; TrendChart may share the bug — ledger item open); better-sqlite3 bumped to 12.x for Node 24 ABI; next: Phase 06 Polish & App Store Submission (fresh EAS build already includes the three new native deps)_
