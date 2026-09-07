---
phase: 06-polish-app-store-submission
plan: 08
subsystem: infra
tags: [privacy-policy, app-store-listing, compliance, docs-site, share-card]

# Dependency graph
requires:
  - phase: 08-share-card-social-overlay
    provides: share-card feature (Skia-composed image, optional background photo via expo-image-picker, iOS share sheet export) that this plan discloses in copy
  - phase: 06-polish-app-store-submission (06-04, 06-05)
    provides: the original privacy policy draft and App Store listing copy this plan corrects
provides:
  - "docs-site/privacy/index.html with an accurate 'Share cards and photos' disclosure section and 2026-08-03 Last-updated date"
  - "apps/mobile/store/app-store-listing.md with share-card description/Features copy and a photo-library App Review Notes disclosure"
  - "Human re-approval of both corrected documents, satisfying D-05/D-07 and unblocking the paused 06-04 Task 3 publish"
affects: [06-04, 06-07]

# Actuals (#2632)
actuals:
  tokens: 1600
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - docs-site/privacy/index.html
    - apps/mobile/store/app-store-listing.md

key-decisions:
  - "Privacy policy 'Share cards and photos' section placed after 'Food lookups' and before 'Apple Health', per plan's explicit ordering instruction."
  - "Listing copy footer status note left as 'pending re-approval, see Task 3' text at commit time; this SUMMARY is the authoritative record that Task 3 approval was subsequently granted 2026-08-03 with no edits requested."
  - "Fixed a pre-existing anchor-tag line-wrap in docs-site/privacy/index.html that split 'Open Food Facts' across two lines, restoring the food-lookup disclosure's single-line readability and the automated grep verify gate."
  - "Reworded pre-existing footer text in apps/mobile/store/app-store-listing.md that still carried a literal '100% offline' substring (describing the prior historical correction) — left unresolved it broke this plan's own no-100%-offline verify gate."

patterns-established: []

requirements-completed: [REL-01, REL-02]

coverage:
  - id: D1
    description: "Privacy policy discloses the Phase 8 share-card/photo-library surface (on-device compose, user-initiated iOS share sheet only) alongside intact Sentry/HealthKit/nutrition disclosures, dated 2026-08-03"
    requirement: "REL-02"
    verification:
      - kind: other
        ref: "grep gate in 06-08-PLAN.md Task 1 (photo + share sheet + date + Open Food Facts + crash diagnostics present; no '100% offline')"
        status: pass
      - kind: manual_procedural
        ref: "Human re-read docs-site/privacy/index.html end-to-end and confirmed accuracy (Task 3, 2026-08-03)"
        status: pass
    human_judgment: true
    rationale: "Privacy-claim accuracy against actual app behavior is a compliance judgment only the human/owner can certify (D-05)."
  - id: D2
    description: "App Store listing description + Features gain a share-card mention; App Review Notes disclose photo-library access is share-card-only, on-device compose, share-sheet-only egress; nutrition disclosures and field-length limits (26/30, 27/30, 89/100) remain intact"
    requirement: "REL-01"
    verification:
      - kind: other
        ref: "grep gate in 06-08-PLAN.md Task 2 (share + photo + share sheet + Open Food Facts/USDA present; no '100% offline')"
        status: pass
      - kind: manual_procedural
        ref: "Human re-read apps/mobile/store/app-store-listing.md and confirmed accuracy + field-length fit (Task 3, 2026-08-03)"
        status: pass
    human_judgment: true
    rationale: "Marketing/App-Review-notes accuracy and Apple field-limit fit are the human owner's approval per D-07."

duration: ~10min
completed: 2026-08-03
status: complete
---

# Phase 06 Plan 08: Corrected Privacy Policy + Listing Copy for Share-Card Surface Summary

**Privacy policy and App Store listing copy updated to disclose the Phase 8 share-card/photo-library surface (on-device compose, user-initiated iOS share sheet only, nothing transmitted by the app), both human re-approved 2026-08-03 with no edits requested — the hard release gate for the paused 06-04 publish is now satisfied.**

## Performance

- **Duration:** ~10 min (across two agent sessions, separated by the Task 3 checkpoint pause)
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify)
- **Files modified:** 2

## Accomplishments

- `docs-site/privacy/index.html` gained a new "Share cards and photos" section: a picked photo is composed into the share image entirely on-device via Skia; neither the photo nor the composed image is transmitted by Apsis; the image leaves the device only if the user explicitly shares it via the standard iOS share sheet; adding a photo is optional. "Last updated" bumped to 2026-08-03. Nutrition (Open Food Facts / USDA), HealthKit, and Sentry sections verified intact and unchanged in substance.
- `apps/mobile/store/app-store-listing.md` gained a share-card sentence in the Description, a Features bullet, and an App Review Notes paragraph disclosing photo-library access is requested only for the optional share-card background photo, composed on-device, shared only via the iOS share sheet, never transmitted by the app. Footer status/date note updated to record the 2026-08-03 revision.
- **Task 3 (blocking human-verify checkpoint) resolved:** the user re-read both corrected documents end-to-end and replied "copy approved" — approving both the privacy policy and the listing copy as accurate for the shipped app, with no edits requested. Approval recorded 2026-08-03.
- **RELEASE GATE STATUS:** Per the plan's explicit RELEASE GATE clause, 06-08's completion is the hard gate for the paused 06-04 Task 3 publish (`docs-site/` → apsistraining.com). **That gate is now satisfied** — 06-04 Task 3 is unblocked and may proceed. However, **as of this SUMMARY (2026-08-03), the user has NOT yet deployed `docs-site/` to apsistraining.com.** 06-04 remains paused at its own checkpoint (publish + verify `/privacy` and `/support` return HTTP 200) until that deploy actually happens. Do not treat "06-08 complete" as "docs-site is live" — these are two separate events; only the first has occurred.
- Character-count limits re-verified unchanged after the share-card edits: **App Name 26/30, Subtitle 27/30, Keywords 89/100.**

## Task Commits

Each task was committed atomically:

1. **Task 1: Add share-card / photo-library section to the privacy policy** - `97f38ed` (feat)
2. **Task 2: Add share card to listing description + photo disclosure to App Review notes** - `bcb1b99` (feat)
3. **Task 3: Re-approve corrected privacy policy + listing copy** - checkpoint:human-verify, no code commit (approval recorded in this SUMMARY; preceded by `1b72a3c` docs commit recording the pause)

**Plan metadata:** (this commit, following SUMMARY write)

## Files Created/Modified

- `docs-site/privacy/index.html` - New "Share cards and photos" disclosure section; Last-updated date bumped to 2026-08-03; pre-existing "Open Food Facts" anchor-tag line-wrap fixed.
- `apps/mobile/store/app-store-listing.md` - Share-card Description sentence + Features bullet; App Review Notes photo-library disclosure paragraph; footer status note updated; pre-existing stray "100% offline" substring reworded out of historical-correction footer text.

## Decisions Made

- Share-card privacy section ordered after "Food lookups" and before "Apple Health" per the plan's explicit placement instruction.
- Both in-scope pre-existing-copy fixes (anchor-tag line-wrap; footer "100% offline" substring) were made because they broke this plan's own automated `<verify>` grep gates on files this plan was already editing — Rule 1 (auto-fix bug) scope, not out-of-scope drift.
- No architectural changes; this was a content-only, two-file, two-task-plus-checkpoint plan exactly as scoped.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed anchor-tag line-wrap splitting "Open Food Facts" in the privacy policy**
- **Found during:** Task 1
- **Issue:** A pre-existing `<a>` tag line-wrap in the food-lookup section split the phrase "Open Food Facts" across two lines, breaking the intended single-line disclosure readability and risking the Task 1 automated `grep -qi "Open Food Facts"` verify gate.
- **Fix:** Re-wrapped the anchor markup so "Open Food Facts" reads as one unbroken phrase.
- **Files modified:** `docs-site/privacy/index.html`
- **Verification:** Task 1's automated grep gate passes.
- **Committed in:** `97f38ed` (Task 1 commit)

**2. [Rule 1 - Bug] Reworded pre-existing footer text carrying a literal "100% offline" substring**
- **Found during:** Task 2
- **Issue:** The listing doc's footer status note (describing an earlier historical correction) still contained the literal substring "100% offline", which fails Task 2's own automated `! grep -qi "100% offline"` verify gate even though the substring appeared in a description of a past correction, not a current claim.
- **Fix:** Reworded the footer's historical-correction sentence to avoid the literal substring while preserving its meaning.
- **Files modified:** `apps/mobile/store/app-store-listing.md`
- **Verification:** Task 2's automated grep gate passes.
- **Committed in:** `bcb1b99` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1, both required to satisfy this plan's own automated verify gates on files already in scope).
**Impact on plan:** No scope creep — both fixes were inside the two files this plan was already editing, and both were required to make the plan's own `<verify>` blocks pass.

## Issues Encountered

None beyond the two auto-fixed items above.

## User Setup Required

None - no external service configuration required by this plan.

## Next Phase Readiness

- **06-04 Task 3 (docs-site publish) is now unblocked** per the RELEASE GATE this plan satisfies — the corrected, human-approved privacy policy may be published. **It has not yet been deployed as of this SUMMARY** (2026-08-03); the human still needs to publish `docs-site/` to apsistraining.com over HTTPS and verify `/privacy` and `/support` return HTTP 200 before 06-04 itself can be marked complete.
- **06-07 (App Store Connect submission)** may now enter the re-approved listing copy verbatim, including the share-card Description/Features text and the photo-library App Review Notes disclosure.
- Outstanding non-gating item carried from Phase 06 Wave 1: the numeric `ascAppId` for `com.apsis.app` (ASC app record created per 06-01 Task 3) still needs to be captured by the user before 06-07 can build its submission profile.

---
*Phase: 06-polish-app-store-submission*
*Completed: 2026-08-03*

## Self-Check: PASSED

- FOUND: docs-site/privacy/index.html
- FOUND: apps/mobile/store/app-store-listing.md
- FOUND: commit 97f38ed
- FOUND: commit bcb1b99
