---
phase: 06-polish-app-store-submission
plan: 05
subsystem: app-store-submission
tags: [app-store-connect, eas-build, versioning, listing-copy]

# Dependency graph
requires:
  - phase: 06-polish-app-store-submission (06-UI-SPEC.md, 06-CONTEXT.md)
    provides: D-07 name/subtitle copywriting contract, D-08 voice, D-16 review notes, D-17 versioning decision
provides:
  - Approved App Store listing copy (name, subtitle, description, keywords, promo text, category, price, review notes) at apps/mobile/store/app-store-listing.md
  - eas.json build.production.ios auto-increment configuration for deterministic build versioning
affects: [06-06-build-submission, 06-07-app-store-connect-entry]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Listing copy locked in a reviewed markdown reference doc before ASC entry, avoiding deadline-day churn"
    - "eas.json autoIncrement + cli.appVersionSource: remote decouples buildNumber from hand-editing while app.json version stays the fixed marketing version"

key-files:
  created: []
  modified:
    - apps/mobile/store/app-store-listing.md
    - apps/mobile/eas.json

key-decisions:
  - "App Name 'Apsis: Hybrid Training Log' (26/30 chars) and Subtitle 'One score for lift + run' (24/30 chars) approved verbatim per D-07"
  - "Keywords trimmed to 94/100 chars at user's request, dropping terms already indexed from App Name/Subtitle (hybrid, training, log, score, lift/run variants) in favor of unique search terms: HYROX, tactical, readiness, RPE, HSS, strength, conditioning, workout tracker, athlete, stress"
  - "eas.json build.production.ios.autoIncrement: true with cli.appVersionSource: remote (Expo's required pairing) — marketing version stays pinned at 1.0.0 in app.json"

patterns-established:
  - "Store-listing source-of-truth doc pattern: draft -> human-verify checkpoint -> approved doc consumed verbatim by a later submission plan"

requirements-completed: [REL-01, REL-04]

coverage:
  - id: D1
    description: "App Store listing copy (name, subtitle, description, keywords, promo text, category, price, App Review notes) drafted, fits Apple's field limits, and user-approved"
    requirement: "REL-01"
    verification:
      - kind: manual_procedural
        ref: "user checkpoint response (Task 3) — approved verbatim + keyword-trim amendment"
        status: pass
    human_judgment: true
    rationale: "Marketing copy approval is inherently a human judgment call (D-07); the checkpoint response is the recorded approval, not an automated check."
  - id: D2
    description: "eas.json production build auto-increments buildNumber while marketing version stays 1.0.0"
    requirement: "REL-04"
    verification:
      - kind: other
        ref: "node -e check: build.production.ios.autoIncrement===true, buildConfiguration==='Release', cli.appVersionSource==='remote'"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-07-13
status: complete
---

# Phase 06 Plan 05: App Store Listing Copy + Build Versioning Summary

**Locked, user-approved App Store Connect listing copy (with a 94/100-char trimmed keyword field) plus eas.json production build auto-increment versioning ahead of submission.**

## Performance

- **Duration:** 6 min (continuation from Task 3 checkpoint)
- **Started:** 2026-07-12T15:37:06Z (Tasks 1-2, prior executor)
- **Completed:** 2026-07-13
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Drafted every App Store Connect text field into `apps/mobile/store/app-store-listing.md`: App Name (26/30 chars), Subtitle (24/30 chars), athlete-direct description opening exactly "You lift. You run. One number tells you what it cost.", keywords, promotional text, category (Health & Fitness), price (Free, no IAP), and D-16 App Review notes.
- Configured `apps/mobile/eas.json` production iOS build to auto-increment `buildNumber` (`autoIncrement: true`) with `cli.appVersionSource: remote`, keeping `app.json` marketing version fixed at 1.0.0 (D-17).
- User reviewed and approved all listing strings verbatim, with one amendment: trimmed the Keywords field from the original draft to 94/100 characters, removing terms already indexed from the App Name/Subtitle and substituting unique search terms (HYROX, tactical, readiness, RPE, HSS, strength, conditioning, workout tracker, athlete, stress).

## Task Commits

Each task was committed atomically:

1. **Task 1: Draft the App Store listing copy + review notes (D-07/D-08/D-16)** - `e3640af` (docs)
2. **Task 2: Configure eas.json build versioning (D-17)** - `2495cc8` (feat)
3. **Task 3: Approve final App Store listing strings** - `696c74d` (docs — keyword trim + approval status)

**Plan metadata:** (this commit)

## Files Created/Modified
- `apps/mobile/store/app-store-listing.md` - Source-of-truth listing copy for App Store Connect entry (plan 06-07); Status marked Approved 2026-07-13 with keyword-trim amendment noted.
- `apps/mobile/eas.json` - `build.production.ios.autoIncrement: true`, `cli.appVersionSource: remote`; `submit.production` left as an empty stub for plan 06-07's ascAppId.

## Decisions Made
- Keyword field trimmed per user's explicit instruction to stay under the 100-char App Store Connect keyword limit, dropping words already indexed from the App Name/Subtitle rather than trying to preserve the original longer phrase list.
- All other listing strings (name, subtitle, description, promo text, category, price, review notes) approved with no changes.

## Deviations from Plan

None - plan executed exactly as written. The Task 3 checkpoint amendment (keyword trim) was an explicit, anticipated outcome of the human-verify gate itself (the plan's `<how-to-verify>` step 3 says "Edit any string you want changed directly in the doc"), not an unplanned deviation from deviation Rules 1-4.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. (App Store Connect entry itself happens in plan 06-07, consuming this doc as source of truth.)

## Next Phase Readiness
- `apps/mobile/store/app-store-listing.md` is locked and approved — plan 06-07 can paste every field verbatim into App Store Connect with no further review needed.
- `apps/mobile/eas.json` is configured for deterministic build versioning — plan 06-06's production build will get a fresh, non-colliding buildNumber automatically.
- No blockers for 06-06 (build) or 06-07 (ASC entry + submission).

---
*Phase: 06-polish-app-store-submission*
*Completed: 2026-07-13*
