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
- [ ] **ENG-02**: Engine computes per-session endurance HSS from segments (distance/duration/pace, optional HR)
- [ ] **ENG-03**: Engine computes per-day HSS including the double-session penalty
- [ ] **ENG-04**: Engine computes a rolling load trend (ATL / CTL / TSB) over a 28-day window
- [ ] **ENG-05**: Engine derives a readiness band (green / amber / red) from TSB and CTL
- [ ] **ENG-06**: Engine handles cold-start (<14 days or low CTL) without producing a misleading red band
- [x] **ENG-07**: Engine is pure TS (time passed in, no I/O) and covered by ≥20 vitest unit tests

### Onboarding & Profile

- [ ] **ONB-01**: User completes onboarding capturing sex, bodyweight, threshold HR, and threshold pace
- [ ] **ONB-02**: User can view and edit profile inputs later from settings
- [ ] **ONB-03**: Readiness band is gated behind completed onboarding (never shows wrong numbers)
- [ ] **ONB-04**: User can toggle display units (km ↔ mi); data is always stored in metric

### Lifting Logger

- [ ] **LIFT-01**: User can search the seeded exercise library inline (< 2 taps to find a movement)
- [ ] **LIFT-02**: User can log a set (load, reps, RPE, warmup flag) in ≤ 3 taps
- [ ] **LIFT-03**: Each set pre-populates with the previous-session weight + reps for that exercise
- [ ] **LIFT-04**: RPE entry is a persistent quick-row (6–10), last value pre-selected, never behind a modal
- [ ] **LIFT-05**: Auto-rest timer starts on set completion (configurable, persistent banner)
- [ ] **LIFT-06**: User can add and remove sets inline
- [ ] **LIFT-07**: User can save or discard a session (discard confirmed); session HSS shown on finish
- [ ] **LIFT-08**: Session HSS updates live as each set is logged (differentiator)

### Run / Conditioning Logger

- [ ] **RUN-01**: User can log a session with an activity type (Run / Erg / Conditioning)
- [ ] **RUN-02**: User enters distance + duration and pace auto-calculates live
- [ ] **RUN-03**: User can optionally enter average HR
- [ ] **RUN-04**: Session date defaults to today and is editable
- [ ] **RUN-05**: User can add an optional free-text note / tag
- [ ] **RUN-06**: Session HSS is shown on the finish screen

### Home / Dashboard

- [ ] **HOME-01**: Home screen shows today's readiness band prominently, above the fold
- [ ] **HOME-02**: Home screen shows today's total HSS
- [ ] **HOME-03**: Home screen shows a 28-day ATL / CTL / TSB trend chart
- [ ] **HOME-04**: Home shows a calibrating state ("Building trend…") until 14+ days of data exist
- [ ] **HOME-05**: User can view workout history grouped by day with day HSS + session count
- [ ] **HOME-06**: Double-session penalty is labeled on the day view when sessionCount > 1

### HealthKit (lowest priority — first to cut if timeline slips)

- [ ] **HK-01**: User grants HealthKit permission and the app imports runs (distance, duration, HR)
- [ ] **HK-02**: App imports most-recent bodyweight from HealthKit
- [ ] **HK-03**: Imported runs deduplicate against manual entries by timestamp range
- [ ] **HK-04**: App writes logged sessions back to HealthKit (strength training + runs)

### Release

- [ ] **REL-01**: App has a 1024×1024 icon (no alpha), App Store screenshots, and store metadata
- [ ] **REL-02**: Privacy nutrition label + privacy policy (live HTTPS URL) declare Health & Fitness data
- [ ] **REL-03**: Any crash/analytics reporting scrubs all HealthKit-derived values before send
- [ ] **REL-04**: Binary is built via EAS and submitted to App Store review by ~July 25, 2026

## v1.1 Requirements

Deferred to the next release. Tracked, not in this roadmap.

### Post-launch enhancements

- **PLATE-01**: Plate calculator on the set entry screen
- **EXER-01**: Custom exercise creation beyond the seeded library
- **BACKUP-01**: iCloud / cloud backup of the local database
- **GARMIN-01**: Garmin activity import (gated on Garmin developer program access)
- **SUPER-01**: Superset / circuit-block logging
- **NUTR-01**: Nutrition / macro tracking

## Out of Scope

Explicitly excluded from v1.0 to protect the ~4-week App Store window.

| Feature | Reason |
|---------|--------|
| Nutrition / macros | Largest scope item; cut per BUILD.md §0; v1.1 fast-follow |
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
| ENG-02 | Phase 02 | Pending |
| ENG-03 | Phase 02 | Pending |
| ENG-04 | Phase 02 | Pending |
| ENG-05 | Phase 02 | Pending |
| ENG-06 | Phase 02 | Pending |
| ENG-07 | Phase 02 | Complete |
| ONB-01 | Phase 03 | Pending |
| ONB-02 | Phase 03 | Pending |
| ONB-03 | Phase 03 | Pending |
| ONB-04 | Phase 03 | Pending |
| LIFT-01 | Phase 03 | Pending |
| LIFT-02 | Phase 03 | Pending |
| LIFT-03 | Phase 03 | Pending |
| LIFT-04 | Phase 03 | Pending |
| LIFT-05 | Phase 03 | Pending |
| LIFT-06 | Phase 03 | Pending |
| LIFT-07 | Phase 03 | Pending |
| LIFT-08 | Phase 03 | Pending |
| RUN-01 | Phase 04 | Pending |
| RUN-02 | Phase 04 | Pending |
| RUN-03 | Phase 04 | Pending |
| RUN-04 | Phase 04 | Pending |
| RUN-05 | Phase 04 | Pending |
| RUN-06 | Phase 04 | Pending |
| HOME-01 | Phase 04 | Pending |
| HOME-02 | Phase 04 | Pending |
| HOME-03 | Phase 04 | Pending |
| HOME-04 | Phase 04 | Pending |
| HOME-05 | Phase 04 | Pending |
| HOME-06 | Phase 04 | Pending |
| HK-01 | Phase 05 | Pending |
| HK-02 | Phase 05 | Pending |
| HK-03 | Phase 05 | Pending |
| HK-04 | Phase 05 | Pending |
| REL-01 | Phase 06 | Pending |
| REL-02 | Phase 06 | Pending |
| REL-03 | Phase 06 | Pending |
| REL-04 | Phase 06 | Pending |

**Coverage:**

- v1 requirements: 42 total (3 complete via Phase 01, 39 pending). Note: an earlier
  version of this table said "37 total / 34 pending" — that was a stale placeholder left
  over from initial requirements definition; a full recount of every checklist item above
  gives 42.

- Mapped to phases: 42/42 (100%)
- Unmapped: 0

---
*Requirements defined: 2026-07-02 (reconstructed alongside the lost roadmap)*
*Last updated: 2026-07-02 after ROADMAP.md creation — 100% v1.0 coverage across Phases 01–06*
