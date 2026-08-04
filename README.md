# Apsis

**One training-load number for hybrid athletes.** Apsis logs lifting *and* running in a
single iOS app, computes one unified **Hybrid Stress Score (HSS)**, and surfaces a
**readiness trend** (green / amber / red) — fully offline, with logging as fast as
Strong or Hevy.

Built for serious HYROX and tactical athletes who currently duct-tape a lifting app +
Strava + a macro app together and have no shared unit for total training stress.

> **Status:** Feature-complete v1.0 (Phases 1–8 shipped) — in TestFlight beta review /
> App Store submission. See [`.planning/ROADMAP.md`](.planning/ROADMAP.md) for the full
> phase history.

> **License:** Source-available for viewing only — **not** open source. See
> [LICENSE](LICENSE).

---

## Why it exists

The market splits into coaching apps and nutrition apps; nobody owns the **logging layer**
underneath both. A HYROX athlete's squats and their 5k intervals both cost recovery, but no
tool expresses them in one unit. Apsis is the single source of truth for *what a hybrid
athlete actually did* — with a defensible unified-load model (HSS) as the moat.

## The core idea — the HSS engine

The heart of the product is [`packages/engine`](packages/engine): a **pure-TypeScript,
zero-runtime-dependency** training-load engine. It is deliberately isolated from the app so
it stays testable and reusable:

- **No React, no I/O, no side effects.** Time is always passed in as a parameter — the
  engine never reads the wall clock, so every calculation is deterministic and unit-testable.
- **Strength side:** e1RM-normalized load stress (Epley estimator), plus bodyweight-movement
  and loaded-carry/sled models.
- **Endurance side:** `duration × IF²` stress with intensity-factor derivation from pace/HR.
- **Composition:** per-session HSS → per-day rollup (with a same-day double-session penalty)
  → rolling **ATL / CTL / TSB** trend via EWMA → readiness banding.
- Formula constants live in a **versioned, tunable config**, and the engine logs raw
  components so the model can be re-fit later *without shipping a new app build*.

Backed by 60+ Vitest tests calibrated against literature anchors (a 60-minute threshold run
≈ 100 HSS).

## Local-first by design

Logging never blocks on the network. Athletes log mid-workout in basements and on trails
with no signal, so on-device SQLite is the source of truth and the instant feedback loop
*is* the product. HealthKit sync (import runs/HR/bodyweight, write sessions back, dedupe
against manual entries) layers on top — but the app is fully functional with zero
connectivity.

## Repository layout

This is a pnpm monorepo. The IP is isolated in `packages/`; the app is a thin consumer.

| Path | What's inside |
|------|---------------|
| [`packages/engine`](packages/engine) | Pure-TS HSS compute engine — the moat. Strength, endurance, session/daily composition, ATL/CTL/TSB trend, readiness banding, nutrition targets. |
| [`packages/db`](packages/db) | op-sqlite + Drizzle schema, migrations, seeded exercise library, `load_daily` recompute-on-write, queries. |
| [`packages/shared`](packages/shared) | Shared units/duration helpers and types used across engine, db, and app. |
| [`apps/mobile`](apps/mobile) | Expo (React Native) app — expo-router screens, logging surfaces, Skia charts, Zustand session state, HealthKit integration. |
| [`docs-site`](docs-site) | Static privacy + support pages ([apsistraining.com](https://apsistraining.com)). |
| [`docs/`](docs) | Product brief, design prompt, and visual design reference. |
| [`.planning/`](.planning) | The full planning trail — roadmap, per-phase plans, research, verification reports, and decision logs. |

Key docs: [`BUILD.md`](BUILD.md) (executable build spec), [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md)
(UI contract), [`NUTRITION.md`](NUTRITION.md) (nutrition data model).

## Tech stack

| Area | Choice |
|------|--------|
| Framework | Expo SDK 56 · React Native 0.85 · React 19.2 · TypeScript 6 (strict) |
| Navigation | expo-router (file-based) |
| Local DB | `@op-engineering/op-sqlite` (JSI) + Drizzle ORM |
| State | Zustand (session/UI) |
| Charts | victory-native + `@shopify/react-native-skia` (GPU canvas) |
| Health | `@kingstinct/react-native-healthkit` |
| Testing | Vitest (engine + db logic) · Testing Library (key UI flows) |

## What's shipped (v1.0)

- ✅ Pure-TS HSS + readiness engine, fully unit-tested
- ✅ Fast lifting logger (tabular tap-to-type set rows, rest timer, crash-resume)
- ✅ Run / conditioning logger (distance, duration, pace, HR)
- ✅ Per-session & per-day HSS, readiness band, 28-day trend chart
- ✅ Onboarding wizard capturing engine inputs (sex, bodyweight, thresholds)
- ✅ HealthKit import + write-back with provenance dedupe
- ✅ Day-type adaptive nutrition targets + food logging (barcode scan, recipes)
- ✅ Strava-style shareable session card (Skia render → PNG → iOS share sheet)

## A note on process

This repo keeps its full [`.planning/`](.planning) trail public on purpose. Every phase was
spec'd, discussed, planned, executed with atomic commits, and verified goal-backward before
moving on — so the roadmap, decision logs, and verification reports show *how* it was built,
not just the result.

---

_Apsis (working title "CONCURRENT") — a solo project by Ethan Brockman._
