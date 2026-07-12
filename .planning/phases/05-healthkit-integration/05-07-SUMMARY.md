---
phase: 05-healthkit-integration
plan: 07
subsystem: onboarding
tags: [expo-router, healthkit, stack-protected, zustand, onboarding]

# Dependency graph
requires:
  - phase: 05-healthkit-integration
    provides: healthkitAuth.requestHealthKitAuthorization, healthkitSyncState.setSyncState, healthkitImport.runHealthKitSync (05-03/05-05)
provides:
  - Terminal, skippable "Connect Apple Health" onboarding step (app/onboarding/healthkit.tsx)
  - Fixed profile-version-bump race so the new step is reachable before the Stack.Protected gate flips to the tab shell
affects: [onboarding, healthkit-integration, settings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Terminal (non-WizardStep) onboarding screens own the useProfileVersion bump themselves, rather than the preceding step's save hook, when a further gated step must be reached first"

key-files:
  created: [apps/mobile/app/onboarding/healthkit.tsx]
  modified: [apps/mobile/app/onboarding/review.tsx, apps/mobile/hooks/useSaveProfile.ts]

key-decisions:
  - "useSaveProfile.save() no longer bumps useProfileVersion on insert; review.tsx explicitly router.push()es to /onboarding/healthkit after a successful save, and the HealthKit step's own accept/skip handlers now own the bump that flips the Stack.Protected gate (Pitfall 2 fix)"
  - "Both 'Connect Apple Health' and 'Not now' bump the profile version and advance -- decline is quiet, immediate, and the step never re-prompts (D-20)"
  - "Granting authorization fires the initial 90-day HealthKit import in the background (never awaited) so onboarding completion is not blocked on it (D-22)"

patterns-established:
  - "Terminal onboarding screens (no WizardStep progress dots) use a quieter Spacing.xxxl top pad vs WizardStep's Spacing.xxxxl, per UI-SPEC discretion for post-save steps"

requirements-completed: [HK-01]

coverage:
  - id: D1
    description: "review.tsx no longer relies on useSaveProfile to flip the Stack.Protected gate; it explicitly pushes to /onboarding/healthkit after a successful save"
    requirement: HK-01
    verification:
      - kind: unit
        ref: "grep: bumpProfileVersion absent from useSaveProfile.ts; onboarding/healthkit present in review.tsx (task 1 automated verify)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Terminal Connect Apple Health / Not now step appears after save, both paths complete onboarding without re-prompting, and granting kicks off a background 90-day import"
    requirement: HK-01
    verification:
      - kind: manual_procedural
        ref: "On-device checkpoint on EAS dev build 694ca7a8 -- user responded 'approved', confirming step ordering, permission sheet, TODAY landing + background import population, and quiet no-reprompt skip"
        status: pass
    human_judgment: true
    rationale: "iOS permission sheet, background import timing, and expo-router Stack.Protected gate behavior on a physical device cannot be verified by an automated test in this repo (apps/mobile has no component test harness, per STATE.md)"

duration: 9min
completed: 2026-07-11
status: complete
---

# Phase 05 Plan 07: Terminal HealthKit Onboarding Step Summary

**New users see a terminal, skippable "Connect Apple Health" step after saving their profile; granting starts a background 90-day import while onboarding finishes immediately, and declining advances quietly with no re-prompt.**

## Performance

- **Duration:** 9 min (code tasks; checkpoint verification wait not counted)
- **Started:** 2026-07-11T23:49:04Z
- **Completed:** 2026-07-11T23:57:47Z
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Fixed the Pitfall 2 race: `useSaveProfile.save()` no longer bumps `useProfileVersion` on insert, so Plan 04's `Stack.Protected` gate does not flip to the tab shell before the new terminal HealthKit step is reached
- `review.tsx` now explicitly `router.push('/onboarding/healthkit')` after a successful save
- Built `app/onboarding/healthkit.tsx`: a standalone terminal screen (no WizardStep progress dots) offering "Connect Apple Health" (requests HK authorization, marks connected, fires the initial 90-day import in the background without awaiting it, bumps the profile version, advances) or "Not now" (bumps the profile version, advances immediately, no dialog)
- On-device verification confirmed both paths on EAS dev build `694ca7a8`: step ordering after save, iOS permission sheet + TODAY landing + live background-import population on accept, and a quiet no-reprompt skip on decline

## Task Commits

Each task was committed atomically:

1. **Task 1: Move the profile-version bump out of useSaveProfile; review.tsx pushes to the HK step (Pitfall 2)** - `ffddefe` (fix)
2. **Task 2: Build the terminal healthkit.tsx onboarding step (D-20/D-22/D-23)** - `617f4da` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `apps/mobile/app/onboarding/healthkit.tsx` - New terminal onboarding screen: Connect Apple Health / Not now, both bumping the profile version
- `apps/mobile/app/onboarding/review.tsx` - `handleSubmit` now pushes to `/onboarding/healthkit` after a successful save instead of relying on the gate to auto-navigate
- `apps/mobile/hooks/useSaveProfile.ts` - Removed the `bumpProfileVersion()` call from `save()`; updated doc comment to point at the new bump location

## Decisions Made
- Relocated the `useProfileVersion` bump from `useSaveProfile.save()` into the terminal HealthKit step's own accept/skip handlers, since bumping it at insert time raced past the new step before it could ever render (Pitfall 2, HIGH confidence from RESEARCH.md, reproduced from live code)
- Both accept and skip bump the version and advance — decline still completes onboarding (D-20); the step is designed to never re-prompt on subsequent launches
- The background 90-day import (`runHealthKitSync(db, { initial: true })`) is deliberately never awaited so onboarding completion is not gated on HealthKit sync latency (D-22)

## Deviations from Plan

None - plan executed exactly as written. The plan's own Task 1 action already *was* the Rule-1/Pitfall-2 style fix (documented explicitly in RESEARCH.md as a known pitfall to correct), so no additional undocumented deviation was needed beyond what the plan specified.

## Issues Encountered

The checkpoint (Task 2) was initially blocked on an EAS provisioning-profile issue noted in STATE.md (native-dep changes requiring a fresh dev build). This was resolved outside this plan's scope (per the Phase 05 P01 blocker note); the user subsequently installed EAS dev build `694ca7a8` and verified both flows, responding "approved."

## User Setup Required

None - no external service configuration required. (The EAS dev build install was a one-time verification step the user performed, not an ongoing setup requirement.)

## Next Phase Readiness
- HK-01's onboarding entry point is now fully wired and on-device verified; Phase 05's remaining plans (05-08 Settings toggle, 05-09 reactive UI feedback) build on the same `healthkitSyncState`/`profileVersion` primitives already exercised here
- No blockers introduced by this plan

---
*Phase: 05-healthkit-integration*
*Completed: 2026-07-11*
