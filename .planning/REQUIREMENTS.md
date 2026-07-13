# Requirements: Apsis

**Defined:** 2026-07-02
**Core Value:** Log both lifting and running, instantly see one honest combined training-load
number (HSS) and a readiness band — fully offline.

> Scope is HARD-LOCKED to the four v1.0 features (lifting log, run/conditioning log, HSS +
> readiness dashboard, HealthKit import/write-back) plus the onboarding and pure-TS engine they
> depend on. Everything else is deferred. Derived from PROJECT.md and research/FEATURES.md.

## v1 Requirements

Requirements for the v1.0 release. Each maps to exactly one roadmap phase.

### Data Foundation

- [x] **DATA-01**: All logging works fully offline; local SQLite is the source of truth
- [x] **DATA-02**: Seeded exercise library (≥40 HYROX/tactical movements) is idempotently seeded on boot
- [x] **DATA-03**: Schema changes ship via committed drizzle migrations applied on startup

### HSS Engine (the moat)

- [x] **ENG-01**: Engine computes per-session strength HSS from sets (load, reps, RPE; warmups excluded)
- [x] **ENG-02**: Engine computes per-session endurance HSS from segments (distance/duration/pace, optional HR)
- [x] **ENG-03**: Engine computes per-day HSS including the double-session penalty
- [x] **ENG-04**: Engine computes a rolling load trend (ATL / CTL / TSB) over a 28-day window
- [x] **ENG-05**: Engine derives a readiness band (green / amber / red) from TSB and CTL
- [x] **ENG-06**: Engine handles cold-start (<14 days or low CTL) without producing a misleading red band
- [x] **ENG-07**: Engine is pure TS (time passed in, no I/O) and covered by ≥20 vitest unit tests

### Onboarding & Profile

- [x] **ONB-01**: User completes onboarding capturing sex, bodyweight, threshold HR, and threshold pace
- [x] **ONB-02**: User can view and edit profile inputs later from settings
- [x] **ONB-03**: Readiness band is gated behind completed onboarding (never shows wrong numbers)
- [x] **ONB-04**: User can toggle display units (km ↔ mi); data is always stored in metric

### Lifting Logger

- [x] **LIFT-01**: User can search the seeded exercise library inline (< 2 taps to find a movement)
- [x] **LIFT-02**: User can log a set (load, reps, RPE, warmup flag) in ≤ 3 taps
- [x] **LIFT-03**: Each set pre-populates with the previous-session weight + reps for that exercise
- [x] **LIFT-04**: RPE entry is a persistent quick-row (6–10), last value pre-selected, never behind a modal
- [x] **LIFT-05**: Auto-rest timer starts on set completion (configurable, persistent banner)
- [x] **LIFT-06**: User can add and remove sets inline
- [x] **LIFT-07**: User can save or discard a session (discard confirmed); session HSS shown on finish
- [x] **LIFT-08**: Session HSS updates live as each set is logged (differentiator)

### Run / Conditioning Logger

- [x] **RUN-01**: User can log a session with an activity type (Run / Erg / Conditioning)
- [x] **RUN-02**: User enters distance + duration and pace auto-calculates live
- [x] **RUN-03**: User can optionally enter average HR
- [x] **RUN-04**: Session date defaults to today and is editable
- [x] **RUN-05**: User can add an optional free-text note / tag
- [x] **RUN-06**: Session HSS is shown on the finish screen

### Home / Dashboard

- [x] **HOME-01**: Home screen shows today's readiness band prominently, above the fold
- [x] **HOME-02**: Home screen shows today's total HSS
- [x] **HOME-03**: Home screen shows a 28-day ATL / CTL / TSB trend chart
- [x] **HOME-04**: Home shows a calibrating state ("Building trend…") until 14+ days of data exist
- [x] **HOME-05**: User can view workout history grouped by day with day HSS + session count
- [x] **HOME-06**: Double-session penalty is labeled on the day view when sessionCount > 1

### HealthKit (lowest priority — first to cut if timeline slips)

- [x] **HK-01**: User grants HealthKit permission and the app imports runs (distance, duration, HR)
- [x] **HK-02**: App imports most-recent bodyweight from HealthKit
- [x] **HK-03**: Imported runs deduplicate against manual entries by timestamp range
- [x] **HK-04**: App writes logged sessions back to HealthKit (strength training + runs)

### Release

- [x] **REL-01**: App has a 1024×1024 icon (no alpha), App Store screenshots, and store metadata
- [ ] **REL-02**: Privacy nutrition label + privacy policy (live HTTPS URL) declare Health & Fitness data
- [x] **REL-03**: Any crash/analytics reporting scrubs all HealthKit-derived values before send
- [x] **REL-04**: Binary is built via EAS and submitted to App Store review by ~July 25, 2026

### Nutrition (Phase 07)

Nutrition tracking, promoted from v2/v1.1 into v1.0 scope by owner decision 2026-07-13 (see
NUTRITION.md and 07-CONTEXT.md). Supersedes the stale v1.1 `NUTR-01` placeholder below.

- [x] **NUTR-01**: `food`/`food_log`/`recipe`/`recipe_ingredient`/`nutrition_target` schema ships via committed drizzle migrations (extends DATA-03 pattern)
- [x] **NUTR-02**: Local-first food cache: every logged food (manual, barcode, OCR) is cached on-device; repeat logging works fully offline
- [x] **NUTR-03**: User can search cached/local foods inline with a debounced remote OFF/USDA fallback; usable result in <1s
- [x] **NUTR-04**: User can log a recent or favorite food in ≤3 taps
- [x] **NUTR-05**: User can create a custom food via full manual macro entry (kcal/P/C/F, serving)
- [x] **NUTR-06**: User can quick-add a macro-only log entry with no associated `food` row
- [x] **NUTR-07**: Food log entries are tagged to a meal (breakfast/lunch/dinner/snack) and a local date
- [ ] **NUTR-08**: User can scan a barcode via camera; app resolves it through local cache → OFF (Apsis DB / commercial fallback deferred)
- [ ] **NUTR-09**: User confirms/edits serving size and quantity before a scanned/OCR'd product is logged
- [ ] **NUTR-10**: Barcode/search misses fall back gracefully to manual/custom food entry — never a dead end
- [ ] **NUTR-11**: User can photograph a nutrition label; on-device OCR (Apple Vision via expo-text-extractor) extracts kcal/P/C/F/serving into a pre-filled custom food
- [ ] **NUTR-12**: Every confirmed label scan saves as a custom food (`source:'user'`, provenance from OCR)
- [ ] **NUTR-13**: User can combine foods into a custom recipe with a servings count; per-serving macros compute automatically
- [ ] **NUTR-14**: User can log one recipe serving as a food-log entry
- [x] **NUTR-15**: `user_profile` gains `heightCm`, `birthYear`, `goalMode` fields required by the adaptive-target model
- [x] **NUTR-16**: Engine computes daily kcal/P/C/F targets from profile + goal mode + day's logged training day-type — pure function, no I/O, tunable EngineConfig constants
- [x] **NUTR-17**: Day-type (`heavy_lift`/`long_run`/`double`/`rest`/`mixed`) is derived automatically from the day's logged workouts
- [x] **NUTR-18**: `dailyMacroTarget` and `classifyDayType` ship with golden-file tests, mirroring the HSS calibration precedent (D-13/D-14/D-20)
- [x] **NUTR-19**: Nutrition screen shows today's targets vs. logged totals (kcal + P/C/F progress)
- [x] **NUTR-20**: Existing users (onboarded in Phases 03-06, before Phase 7 shipped) are prompted for the new profile fields the first time they open nutrition, gated like ONB-03
- [ ] **NUTR-21**: App displays Open Food Facts ODbL/CC-BY-SA attribution in Settings (legal requirement of API use)
- [x] **NUTR-22**: Nutrition values are scrubbed from crash/analytics reporting like HealthKit values (extends REL-03 pattern)

## v1.1 Requirements

Deferred to the next release. Tracked, not in this roadmap.

### Post-launch enhancements

- **PLATE-01**: Plate calculator on the set entry screen
- **EXER-01**: Custom exercise creation beyond the seeded library
- **BACKUP-01**: iCloud / cloud backup of the local database
- **GARMIN-01**: Garmin activity import (gated on Garmin developer program access)
- **SUPER-01**: Superset / circuit-block logging
- (former placeholder removed 2026-07-13: nutrition tracking promoted to v1.0 scope as the
  granular NUTR-01..NUTR-22 set under "Nutrition (Phase 07)" above)

## Out of Scope

Explicitly excluded from v1.0 to protect the ~4-week App Store window.

| Feature | Reason |
|---------|--------|
| ~~Nutrition / macros~~ | ~~Largest scope item; cut per BUILD.md §0; v1.1 fast-follow~~ — superseded 2026-07-13: promoted into v1.0 scope as Phase 07 (see NUTR-01..22 above) |
| Garmin integration | Requires Garmin developer program access; HealthKit-only for launch |
| Android | HealthKit is iOS-only; ship iOS first (RN keeps the door open) |
| Backend / cloud sync | v1.0 is fully offline; a server adds review surface + latency risk |
| Social feed / sharing | Polarising; needs backend + auth; not the v1.0 identity |
| Programming / coaching layer | Separate product surface; log what you did, not what you planned |
| Volume / tonnage analytics | HSS is the single load metric; no competing number in v1.0 |
| Wellness surveys / HRV gating | Kills logging speed; TSB-based readiness infers this already |
| Video exercise instructions | Storage/hosting cost; violates offline-first constraint |

## Traceability

Which phase covers which requirement. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 01 | Complete |
| DATA-02 | Phase 01 | Complete |
| DATA-03 | Phase 01 | Complete |
| ENG-01 | Phase 02 | Complete |
| ENG-02 | Phase 02 | Complete |
| ENG-03 | Phase 02 | Complete |
| ENG-04 | Phase 02 | Complete |
| ENG-05 | Phase 02 | Complete |
| ENG-06 | Phase 02 | Complete |
| ENG-07 | Phase 02 | Complete |
| ONB-01 | Phase 03 | Complete |
| ONB-02 | Phase 03 | Complete |
| ONB-03 | Phase 03 | Complete |
| ONB-04 | Phase 03 | Complete |
| LIFT-01 | Phase 03 | Complete |
| LIFT-02 | Phase 03 | Complete |
| LIFT-03 | Phase 03 | Complete |
| LIFT-04 | Phase 03 | Complete |
| LIFT-05 | Phase 03 | Complete |
| LIFT-06 | Phase 03 | Complete |
| LIFT-07 | Phase 03 | Complete |
| LIFT-08 | Phase 03 | Complete |
| RUN-01 | Phase 04 | Complete |
| RUN-02 | Phase 04 | Complete |
| RUN-03 | Phase 04 | Complete |
| RUN-04 | Phase 04 | Complete |
| RUN-05 | Phase 04 | Complete |
| RUN-06 | Phase 04 | Complete |
| HOME-01 | Phase 04 | Complete |
| HOME-02 | Phase 04 | Complete |
| HOME-03 | Phase 04 | Complete |
| HOME-04 | Phase 04 | Complete |
| HOME-05 | Phase 04 | Complete |
| HOME-06 | Phase 04 | Complete |
| HK-01 | Phase 05 | Complete |
| HK-02 | Phase 05 | Complete |
| HK-03 | Phase 05 | Complete |
| HK-04 | Phase 05 | Complete |
| REL-01 | Phase 06 | Complete |
| REL-02 | Phase 06 | Pending |
| REL-03 | Phase 06 | Complete |
| REL-04 | Phase 06 | Complete |
| NUTR-01 | Phase 07 | Complete |
| NUTR-02 | Phase 07 | Complete |
| NUTR-03 | Phase 07 | Complete |
| NUTR-04 | Phase 07 | Complete |
| NUTR-05 | Phase 07 | Complete |
| NUTR-06 | Phase 07 | Complete |
| NUTR-07 | Phase 07 | Complete |
| NUTR-08 | Phase 07 | Pending |
| NUTR-09 | Phase 07 | Pending |
| NUTR-10 | Phase 07 | Pending |
| NUTR-11 | Phase 07 | Pending |
| NUTR-12 | Phase 07 | Pending |
| NUTR-13 | Phase 07 | Pending |
| NUTR-14 | Phase 07 | Pending |
| NUTR-15 | Phase 07 | Complete |
| NUTR-16 | Phase 07 | Complete |
| NUTR-17 | Phase 07 | Complete |
| NUTR-18 | Phase 07 | Complete |
| NUTR-19 | Phase 07 | Complete |
| NUTR-20 | Phase 07 | Complete |
| NUTR-21 | Phase 07 | Pending |
| NUTR-22 | Phase 07 | Complete |

**Coverage:**

- v1 requirements: 64 total (3 complete via Phase 01, 61 pending). Note: an earlier
  version of this table said "37 total / 34 pending" — that was a stale placeholder left
  over from initial requirements definition; the count grew to 42 after a full recount, and
  to 64 after Phase 07's granular NUTR-01..NUTR-22 set was added 2026-07-13 (nutrition
  promoted from v1.1 into v1.0 scope).

- Mapped to phases: 64/64 (100%)
- Unmapped: 0

---
*Requirements defined: 2026-07-02 (reconstructed alongside the lost roadmap)*
*Last updated: 2026-07-13 — added Phase 07 (nutrition-tracking) NUTR-01..NUTR-22 granular
requirement set + traceability rows, promoted from the stale v1.1 NUTR-01 placeholder*
