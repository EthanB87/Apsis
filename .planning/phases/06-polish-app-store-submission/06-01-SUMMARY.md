---
phase: 06-polish-app-store-submission
plan: 01
subsystem: infra
tags: [eas, app-json, app-icon, app-store-connect, apple-developer]

# Dependency graph
requires: []
provides:
  - "Single source-of-truth Expo/EAS config under apps/mobile/ (bundle id com.apsis.app) — stray root-level app.json/eas.json (com.apsistraining.apsis) removed"
  - "Opaque RGB (colorType 2) 1024x1024 app icon, submittable to App Store review"
  - "apps/mobile/scripts/check-icon-alpha.mjs — persisted regression guard against a future alpha-channel icon re-export"
  - "App Store Connect app record created for com.apsis.app; ascAppId 6792933794 present in apps/mobile/eas.json since 2026-07-20 (commit f19f2540d) — DISCREPANCY: 2026-08-03 checkpoint approval stated this is not yet provided, see Deviations"
affects: [06-06, 06-07]

# Actuals (#2632)
actuals:
  tokens: 130
  tasks: 3
  commits: 2
duration: ~4min (Tasks 1-2) + checkpoint pause (Task 3, resolved 2026-08-03)
completed: 2026-08-03
status: complete

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - apps/mobile/scripts/check-icon-alpha.mjs
  modified:
    - apps/mobile/assets/images/icon.png
  deleted:
    - app.json (repo root)
    - eas.json (repo root)

key-decisions:
  - "Root app.json/eas.json deleted outright (not merged) — they carried a stale wrong bundle id (com.apsistraining.apsis) and no config not already present under apps/mobile/."
  - "Icon flattened onto the app's own void background (#0B0C0E) rather than white/transparent, keeping the re-export visually consistent with the app's dark theme and the Android adaptiveIcon backgroundColor already set in apps/mobile/app.json."
  - "check-icon-alpha.mjs reads the PNG IHDR colorType byte directly (dependency-free) rather than pulling in an image library, so it can run as a fast pre-build guard with zero added dependencies."

patterns-established:
  - "check-icon-alpha.mjs pattern: dependency-free binary-header inspection script as a persisted regression guard — reusable for any future asset-format invariant."

requirements-completed: [REL-01, REL-04]

coverage:
  - id: D1
    description: "Repo contains exactly one app.json and one eas.json, both under apps/mobile/, bundle id com.apsis.app — no stray root-level config remains"
    requirement: REL-01
    verification:
      - kind: other
        ref: "test ! -f app.json && test ! -f eas.json && test -f apps/mobile/app.json && grep -q com.apsis.app apps/mobile/app.json (Task 1 automated verify)"
        status: pass
    human_judgment: false
  - id: D2
    description: "apps/mobile/assets/images/icon.png is a 1024x1024 opaque PNG (IHDR colorType 2), with apps/mobile/scripts/check-icon-alpha.mjs persisted as a regression guard"
    requirement: REL-01
    verification:
      - kind: other
        ref: "node apps/mobile/scripts/check-icon-alpha.mjs (Task 2 automated verify; re-confirmed at 06-01 plan closeout, exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Apple Developer Program membership confirmed active; App Store Connect app record created for com.apsis.app"
    requirement: REL-04
    verification:
      - kind: manual_procedural
        ref: "Human checkpoint (Task 3) — approved 2026-08-03: membership active, ASC record created"
        status: pass
    human_judgment: true
    rationale: "Only the human owner holds Apple Developer / App Store Connect credentials; this is inherently a manual dashboard action, not automatable from this Windows host."
  - id: D4
    description: "Numeric ascAppId captured for later submit-profile use (plan 06-07)"
    requirement: REL-04
    verification:
      - kind: other
        ref: "apps/mobile/eas.json submit.production.ios.ascAppId == '6792933794' (present since commit f19f2540d, 2026-07-20)"
        status: unknown
    human_judgment: true
    rationale: "UNRESOLVED DISCREPANCY, not a clean pass: apps/mobile/eas.json has carried ascAppId 6792933794 since 2026-07-20 (two weeks before this closeout), but the human's 2026-08-03 Task 3 checkpoint reply explicitly stated the ascAppId has NOT yet been provided and will be supplied before 06-07. These two facts conflict. Before 06-07 runs its submit-profile step, a human must confirm whether 6792933794 is still the correct/live ascAppId for the current com.apsis.app ASC record (e.g., it is not stale from a deleted/recreated app record) — do not assume either 'already done' or 'still pending' without that confirmation."
---

# Phase 06 Plan 01: Config Cleanup, Icon Fix, Apple Developer Enrollment Summary

**Deleted the stray root-level app.json/eas.json (wrong bundle id), re-exported the app icon as opaque RGB with a persisted alpha-channel verifier, and got the App Store Connect app record created for com.apsis.app — but there is an unresolved discrepancy over the numeric ascAppId that a human must reconcile before plan 06-07.**

## Performance

- **Duration:** ~4 min for Tasks 1-2 (2026-07-12); Task 3 was a blocking human checkpoint that paused execution and was approved 2026-08-03 (see Deviations)
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify)
- **Files modified:** 4 (2 deleted, 2 created/modified)

## Accomplishments

- Deleted the two stray monorepo-root files `app.json` and `eas.json` (added in commit c031d25, carrying the wrong bundle id `com.apsistraining.apsis`). `apps/mobile/app.json` and `apps/mobile/eas.json` (bundle id `com.apsis.app`) remain the single source of truth. No file anywhere in the repo declares `com.apsistraining.apsis` any longer.
- Re-exported `apps/mobile/assets/images/icon.png` flattened onto the app's void background (#0B0C0E), converting it from RGBA (colorType 6, alpha channel) to opaque RGB (colorType 2), 1024x1024, 8-bit — artwork unchanged. This fixes an App Store submission blocker (Apple rejects icons with alpha).
- Added `apps/mobile/scripts/check-icon-alpha.mjs`, a dependency-free Node ESM script that reads the PNG IHDR colorType byte directly and exits non-zero if the icon ever regains an alpha channel — a persisted regression guard intended to run before every production build that touches the icon.
- **Task 3 (blocking human-verify checkpoint) resolved 2026-08-03:** the user confirmed Apple Developer Program membership is active, and confirmed the App Store Connect app record for bundle id `com.apsis.app` (name "Apsis") has been created.
- **UNRESOLVED DISCREPANCY — ascAppId:** the plan's Task 3 also asked the human to capture the app record's numeric Apple ID (`ascAppId`), needed by `eas submit` for plan 06-07's submission profile. The 2026-08-03 checkpoint reply stated the user has **not yet** supplied this number and will provide it before 06-07. **However, on independent verification of the repo, `apps/mobile/eas.json`'s `submit.production.ios.ascAppId` already contains `"6792933794"`, committed on 2026-07-20 in `f19f2540d89df5fc75a538c7e5d9dc43cc46fd5a` ("chore(06): wire ascAppId 6792933794 into eas.json submit profile") — two weeks before this checkpoint approval.** These two facts contradict each other. Possible explanations: the value in the file is stale (e.g., left over from an earlier/different ASC app record that no longer matches the current one confirmed in this checkpoint), or the checkpoint reply's caveat was simply a memory gap and the existing value is in fact still correct. **This plan does NOT resolve which is true — it is left as an explicit open item.** Plan 06-07's submit-profile step MUST NOT proceed on the assumption that either "ascAppId is done" or "ascAppId is pending" without a human first confirming that `6792933794` is (or is not) the correct numeric App ID for the current `com.apsis.app` ASC record.

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete stray root-level app.json and eas.json (Pitfall 2)** - `6d5bd5e` (fix)
2. **Task 2: Fix icon alpha channel + add persisted verifier (Pitfall 1)** - `8b75df5` (fix)
3. **Task 3: Confirm Apple Developer enrollment + create ASC app record** - checkpoint:human-verify, no code commit (approval recorded in this SUMMARY)

**Plan metadata:** (this commit, following SUMMARY write)

## Files Created/Modified

- `app.json` (repo root) - Deleted (stray duplicate, wrong bundle id)
- `eas.json` (repo root) - Deleted (stray duplicate)
- `apps/mobile/assets/images/icon.png` - Re-exported opaque RGB (colorType 2), 1024x1024, artwork unchanged
- `apps/mobile/scripts/check-icon-alpha.mjs` - New persisted alpha-channel regression guard

## Decisions Made

- Root app.json/eas.json deleted outright rather than merged, since they held no config not already present under `apps/mobile/` and carried a stale wrong bundle id.
- Icon flattened onto `#0B0C0E` (void) to match the app's dark theme and the existing Android adaptiveIcon background color, rather than a neutral white/transparent flatten.
- Verifier script implemented dependency-free (raw IHDR byte read) so it adds zero new dependencies and can gate every future icon re-export cheaply.

## Deviations from Plan

None for Tasks 1-2 - both executed exactly as written, verified by their automated gates.

**Task 3 outcome differs from the plan's full expectation, AND conflicts with independently-verified repo state:** the plan's `<how-to-verify>` asked the human to both (a) confirm membership/create the ASC record AND (b) capture the numeric ascAppId in their reply. The user's approval covered (a) in full; on (b) they stated the ascAppId has not yet been supplied. But `apps/mobile/eas.json` already contains `ascAppId: "6792933794"`, committed 2026-07-20 (`f19f2540d`) — predating this checkpoint reply by two weeks. This is not an auto-fixable deviation (Rules 1-3 do not apply; there is no code bug to fix — the file's existing value may in fact be correct) and it is not architectural (Rule 4 does not apply either). It is an unresolved factual conflict between the human's most recent statement and the repo's committed state, and per Rule 4's spirit ("genuinely unsure → ask"), this SUMMARY does not silently resolve it either way. It is recorded here, in STATE.md, and in the `D4` coverage entry above so plan 06-07 does not proceed under either a false "already done" or false "still pending" assumption.

## Issues Encountered

The ascAppId discrepancy above is the only open issue from this plan.

## User Setup Required

**ascAppId reconciliation required before plan 06-07.** A human must confirm whether `6792933794` (already present in `apps/mobile/eas.json`, committed 2026-07-20) is the correct, current numeric Apple ID for the `com.apsis.app` App Store Connect record confirmed in this plan's Task 3 checkpoint (2026-08-03) — or whether it is stale and a new value is needed. Verify at App Store Connect → Apps → Apsis → App Information → Apple ID. If it matches, no further action is needed and 06-07 may treat ascAppId as already wired in; if it does not match, supply the correct value before 06-07's submit-profile step. No other external service configuration is required by this plan.

## Next Phase Readiness

- Config surface is clean: exactly one app.json/eas.json (under apps/mobile/), bundle id com.apsis.app confirmed everywhere.
- Icon is submittable (opaque RGB) with a persisted regression guard for future re-exports.
- Apple Developer Program membership confirmed active; ASC app record for com.apsis.app exists — this unblocks Wave 2 (06-06 production build), which does not itself need the ascAppId.
- **BLOCKING for 06-07 only:** the numeric ascAppId has an unresolved discrepancy (see Deviations/User Setup Required above — `6792933794` is present in `apps/mobile/eas.json` since 2026-07-20, but the 2026-08-03 checkpoint reply said it had not yet been provided). Plan 06-07 must not run its submit-profile step until a human reconciles this — confirm the value is correct/current, or replace it, before executing that step.

---
*Phase: 06-polish-app-store-submission*
*Completed: 2026-08-03*

## Self-Check: PASSED

- FOUND: apps/mobile/scripts/check-icon-alpha.mjs
- FOUND: apps/mobile/assets/images/icon.png
- CONFIRMED ABSENT: app.json (root)
- CONFIRMED ABSENT: eas.json (root)
- FOUND: commit 6d5bd5e
- FOUND: commit 8b75df5
