---
phase: 05-healthkit-integration
plan: 08
subsystem: settings
tags: [healthkit, settings, expo-router, react-native-switch]

# Dependency graph
requires:
  - phase: 05-healthkit-integration
    provides: healthkitAuth.requestHealthKitAuthorization, healthkitSyncState.getSyncState/setSyncState, healthkitImport.runHealthKitSync (05-03/05-05)
provides:
  - Permanent Settings "Apple Health" section (connect row, connected info row, sync toggle, LAST SYNC / SYNC PAUSED status line)
  - hkEverConnected derived-state pattern for a single-bit connected/enabled schema field
affects: [settings, healthkit-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "hkEverConnected derived flag (hkConnected || hkLastSyncAt != null) keeps a 'Connected' UI state visible across a toggle-OFF pause, when the schema only has a single healthkitConnected bit doing double duty as both 'ever completed the permission sheet' and 'sync currently enabled'"

key-files:
  created: []
  modified: [apps/mobile/app/(tabs)/settings/index.tsx]

key-decisions:
  - "hkEverConnected = hkConnected || hkLastSyncAt != null, so toggling sync OFF doesn't regress the UI back to the not-connected 'Connect Apple Health' row -- a completed prior sync is treated as durable proof the permission sheet was already granted"
  - "Toggle write reuses the existing optimistic-set-then-rollback-on-failure pattern already established by handleUnitsChange, rather than introducing a new async-state pattern"
  - "Connect button fires the initial 90-day HealthKit import in the background (never awaited), matching the onboarding healthkit.tsx step's D-22/D-25 fire-and-forget contract"

patterns-established:
  - "Settings screen's HealthKit section state (hkConnected/hkLastSyncAt) is loaded once via getSyncState in a mount-only effect, not derived from useProfile's ProfileValues shape, since it lives on a separate concern (sync state, not profile fields)"

requirements-completed: [HK-01, HK-02]

coverage:
  - id: D1
    description: "Settings has a permanent Apple Health section: not-connected renders a tappable 'Connect Apple Health' row wired to requestHealthKitAuthorization; connected renders a 'Connected' info row + 'Sync with Apple Health' Switch with the specified trackColor/thumbColor tokens; a mono status line shows LAST SYNC or SYNC PAUSED"
    requirement: HK-01
    verification:
      - kind: automated_ui
        ref: "grep: 'Apple Health', 'SYNC PAUSED', 'requestHealthKitAuthorization' all present in app/(tabs)/settings/index.tsx (task 1 automated verify)"
        status: pass
    human_judgment: false
  - id: D2
    description: "On a physical device: connect flips to Connected + toggle after the permission sheet; toggle OFF shows SYNC PAUSED and blocks foreground imports; toggle ON restores LAST SYNC and resumes sync; already-imported sessions remain in History while paused (D-19/D-21/D-24)"
    requirement: HK-02
    verification:
      - kind: manual_procedural
        ref: "On-device checkpoint on EAS dev build 694ca7a8 -- user responded 'approved', confirming connect/toggle/last-sync/pause behavior per D-19/D-21/D-24"
        status: pass
    human_judgment: true
    rationale: "iOS permission sheet, foreground sync gating, and Health-app-level permission state cannot be verified by an automated test in this repo (apps/mobile has no component test harness, per STATE.md)"

duration: 8min
completed: 2026-07-11
status: complete
---

# Phase 05 Plan 08: Settings Apple Health Section Summary

**Settings gained a permanent "Apple Health" section — a Connect row that's the D-03 re-entry point for onboarding decliners, plus a Connected/toggle/LAST SYNC state for connected users — verified end to end on a physical device.**

## Performance

- **Duration:** 8 min (code task; checkpoint verification wait not counted)
- **Started:** 2026-07-11T23:58:00Z (approx, continues immediately after 05-07)
- **Completed:** 2026-07-12T00:06:59Z
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 1

## Accomplishments
- Added a new "Apple Health" section to the Settings screen, positioned between "Default Rest Timer" and the footer with hairline dividers matching every other section boundary
- State A (not connected): a tappable "Connect Apple Health" row that calls `requestHealthKitAuthorization`, then `setSyncState({ healthkitConnected: true })`, then fires the initial 90-day `runHealthKitSync` in the background without awaiting it — the permanent D-03 re-entry point
- State B (connected): a non-tappable "Connected" info row, a "Sync with Apple Health" `Switch` (trackColor steel/accent, thumbColor background/text per the UI-SPEC tokens) using the optimistic-set-then-rollback pattern already established by `handleUnitsChange`, and a mono status line showing `LAST SYNC {time}` when on or `SYNC PAUSED` when off
- Introduced `hkEverConnected` (derived from `hkConnected || hkLastSyncAt != null`) so toggling sync OFF keeps the "Connected" UI visible instead of regressing to the not-connected Connect row
- On-device verification on EAS dev build `694ca7a8` confirmed the full behavior: connect → Connected + toggle after the permission sheet; toggle OFF → SYNC PAUSED + no foreground import; toggle ON → LAST SYNC restored + sync resumes; already-imported sessions remain in History while paused (D-19/D-21/D-24)

## Task Commits

Each task was committed atomically:

1. **Task 1: Apple Health section — connect row + connected/toggle/last-sync (D-03/19/21/24)** - `a8bdc53` (feat)
2. **Task 2: On-device verification of the Settings Apple Health section** - checkpoint:human-verify, resolved (user responded "approved" on EAS dev build `694ca7a8`) — no code commit, verification-only

**Plan metadata:** (this commit)

## Files Created/Modified
- `apps/mobile/app/(tabs)/settings/index.tsx` - New "Apple Health" section: connect row (State A), connected info row + sync Switch + LAST SYNC/SYNC PAUSED status line (State B), `hkEverConnected` derived visibility flag, `handleConnectHealthKit`/`handleToggleHealthKitSync` handlers, `formatHealthKitLastSync` helper, and section styles (`hkSection`, `hkConnectRow`, `hkInfoRow`, `hkToggleRow`, `hkStatusLine`, `hkRowLabel`, `hkRowSub`, `hairlineDivider`)

## Decisions Made
- `hkEverConnected = hkConnected || hkLastSyncAt != null` — the schema's single `healthkitConnected` bit does double duty as both "ever completed the permission sheet" and "sync currently enabled," so a completed prior sync (non-null `healthkitLastSyncAt`) is also treated as proof of a completed permission sheet even while the toggle is currently paused off
- Reused the existing optimistic-set-then-rollback-on-failure pattern (already established by `handleUnitsChange`) for the sync toggle write, rather than introducing a new pattern
- Connect button fires the initial 90-day HealthKit import in the background, never awaited, matching onboarding's `healthkit.tsx` fire-and-forget contract (D-22/D-25) — no error UI is shown on failure (D-25, silent failures)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The checkpoint was verified against the same EAS dev build (`694ca7a8`) already installed for the 05-07 on-device verification; no new build cycle was required.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- This is the final plan (9/9) in Phase 05 (healthkit-integration). All HealthKit requirements (HK-01 through HK-04) are implemented and verified across the phase's plans.
- No blockers introduced by this plan. Phase 05 is ready to close out; Phase 06 (Release) is next per ROADMAP.md.

---
*Phase: 05-healthkit-integration*
*Completed: 2026-07-11*

## Self-Check: PASSED
- FOUND: apps/mobile/app/(tabs)/settings/index.tsx changes (verified via `git show a8bdc53 --stat`)
- FOUND: commit a8bdc53 (git log --oneline --all)
- FOUND: .planning/phases/05-healthkit-integration/05-08-SUMMARY.md
