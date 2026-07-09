---
phase: 03-onboarding-lifting-logger
plan: 07
subsystem: ui
tags: [expo-notifications, expo-haptics, zustand, rest-timer, backgrounding]

# Dependency graph
requires:
  - phase: 03-06
    provides: sessionStore restTimerEndsAt field + RestTimerBanner stub mounted in session.tsx
provides:
  - Timestamp-based rest-timer helpers (startRest/remainingSec/resolveRestDuration) that survive backgrounding
  - Local-notification wrapper (schedule/cancel) with lazy permission request on first timer use
  - sessionStore timer actions (startRestTimer/addThirtySeconds/skipRest/cancelPendingNotification)
  - Fleshed-out RestTimerBanner UI (+30s / Skip / haptic+sound at zero, foreground recompute)
affects: [03-08, 03-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wall-clock endsAt timestamp (never a JS setTimeout) is the single source of truth for countdown state, recomputed on interval AND on AppState foreground transition (D-26)"
    - "Notification is a best-effort completion signal, not the source of truth -- countdown correctness never depends on permission being granted (T-03-16)"

key-files:
  created:
    - apps/mobile/lib/restTimer.ts
    - apps/mobile/lib/notifications.ts
  modified:
    - apps/mobile/stores/sessionStore.ts
    - apps/mobile/components/session/RestTimerBanner.tsx
    - apps/mobile/components/session/SetRow.tsx

key-decisions:
  - "SetRow.tsx (outside this plan's declared files_modified) wired to call startRestTimer on successful commitSet -- the plan's action explicitly required this wiring but the file wasn't listed (Rule 2 deviation)"
  - "Rest-duration resolution (per-exercise override vs. profile global default) resolved store-side inside startRestTimer via a live userProfile.restTimerDefaultSec query, not passed in by the caller -- keeps SetRow.tsx's commit call a single argument-free trigger and centralizes the D-25 precedence rule + DB-failure fallback (FALLBACK_REST_DEFAULT_SEC=120) in one place"
  - "Six on-device behaviors (device-only: haptics do not fire on simulator, background notification delivery requires a physical device) deferred to phase UAT per user checkpoint response 'Defer to phase UAT' -- NOT marked passed"

patterns-established:
  - "Rest-timer race guard: async notification scheduling checks get().restTimerEndsAt still matches the endsAt it scheduled for before storing the notification id, else immediately cancels the now-stale notification (handles rapid Skip / next-set-commit racing the in-flight schedule call)"

requirements-completed: []  # LIFT-05 intentionally NOT marked complete -- device verification deferred to phase UAT (see Known Stubs / Deferred Verification below)

coverage:
  - id: D1
    description: "Set completion starts a persistent-banner (not modal) rest timer with a live countdown that survives backgrounding"
    requirement: LIFT-05
    verification:
      - kind: manual_procedural
        ref: "Device UAT step 1: start a workout, log a set (check the checkmark) -- rest banner appears and counts down"
        status: unknown
    human_judgment: true
    rationale: "Countdown correctness under real backgrounding and simulator limitations (haptics/background delivery) cannot be verified in CI; user explicitly deferred to phase UAT at the Task 3 checkpoint."
  - id: D2
    description: "+30s extends the running countdown; Skip clears the banner"
    requirement: LIFT-05
    verification:
      - kind: manual_procedural
        ref: "Device UAT step 2: tap +30s -- countdown jumps up 30s; tap Skip -- banner clears"
        status: unknown
    human_judgment: true
    rationale: "Requires physical-device interaction to confirm visually; deferred to phase UAT."
  - id: D3
    description: "A local notification fires at endsAt when the app is backgrounded/locked before the timer expires"
    requirement: LIFT-05
    verification:
      - kind: manual_procedural
        ref: "Device UAT step 3: log a set, background/lock the phone before expiry -- confirm a local notification fires at expiry"
        status: unknown
    human_judgment: true
    rationale: "Background notification delivery requires a physical device (RESEARCH Environment Availability) -- cannot run on simulator or CI."
  - id: D4
    description: "Returning to the app before expiry cancels the pending notification (no late notification fires)"
    requirement: LIFT-05
    verification:
      - kind: manual_procedural
        ref: "Device UAT step 4: log a set, return to the app before expiry -- confirm the scheduled notification is cancelled"
        status: unknown
    human_judgment: true
    rationale: "Requires observing absence of a late notification on a physical device over a real wait interval; deferred to phase UAT."
  - id: D5
    description: "Haptic buzz + completion sound fire at zero when the app is foregrounded"
    requirement: LIFT-05
    verification:
      - kind: manual_procedural
        ref: "Device UAT step 5: confirm the haptic buzz + sound at zero when foregrounded"
        status: unknown
    human_judgment: true
    rationale: "Haptics do not fire on the iOS simulator (RESEARCH Environment Availability) -- physical device required."
  - id: D6
    description: "Notification permission is requested on the FIRST timer use, not during onboarding"
    requirement: LIFT-05
    verification:
      - kind: manual_procedural
        ref: "Device UAT step 6: confirm notification permission is requested on the FIRST timer use, not during onboarding"
        status: unknown
    human_judgment: true
    rationale: "Requires observing the OS permission prompt timing across the onboarding flow and first logged set on a physical device; deferred to phase UAT."

duration: ~2min (Tasks 1-2 autonomous execution; Task 3 device checkpoint paused for human verification and reopened at UAT)
completed: 2026-07-09
status: complete
---

# Phase 3 Plan 07: Auto-Rest Timer (Timestamp Banner + Background Notification + Haptics) Summary

**Timestamp-based (endsAt) rest-timer banner with +30s/Skip, per-exercise/global duration resolution, and a background local notification via expo-notifications -- code complete and typecheck-clean; all six on-device behaviors (haptics, background notification delivery, permission timing) deferred to phase UAT per user request.**

## Performance

- **Duration:** ~2 min for Tasks 1-2 (autonomous); Task 3 paused at a blocking human-verify checkpoint and is resolved here as "deferred to UAT," not "passed"
- **Started:** 2026-07-09T21:10:00Z (approx, from first task commit)
- **Completed:** 2026-07-09T21:11:13Z (Task 2 commit) + this closeout
- **Tasks:** 3 (2 executed autonomously, 1 checkpoint deferred to phase UAT)
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- `lib/restTimer.ts`: pure timestamp helpers -- `startRest` (endsAt = Date.now() + duration), `remainingSec` (wall-clock diff, never a resumed JS counter), `resolveRestDuration` (per-exercise override wins over profile default, D-25)
- `lib/notifications.ts`: expo-notifications wrapper -- lazy `ensureNotificationPermission()` on first timer use (not onboarding, D-26), `scheduleRestNotification`/`cancelRestNotification`, denial-tolerant (countdown never depends on permission)
- `sessionStore.ts`: `startRestTimer`/`addThirtySeconds`/`skipRest`/`cancelPendingNotification` actions, `restNotificationId` state, race-guarded async notification scheduling
- `RestTimerBanner.tsx` fleshed out from Plan 06's stub: persistent full-width banner (not modal), tabular-nums countdown on a 250ms interval + AppState foreground recompute, two 44px ghost buttons, haptic+sound zero-detection effect
- `SetRow.tsx` wired to call `startRestTimer` on successful commit (Rule 2 deviation -- the only commitSet caller, required by the plan's action but not in `files_modified`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Timestamp rest-timer logic + notifications + haptics** - `243f06a` (feat)
2. **Task 2: RestTimerBanner UI (+30s / Skip / haptic at zero)** - `2064668` (feat)
3. **Task 3: [BLOCKING] On-device rest-timer + notification + haptics verification** - checkpoint reached, human response "Defer to phase UAT" -- no code change, closed out via this SUMMARY (see Deferred Verification below)

**Plan metadata:** (this commit) `docs(03-07): complete auto-rest timer plan`

## Files Created/Modified
- `apps/mobile/lib/restTimer.ts` - Timestamp timer helpers: startRest, remainingSec, resolveRestDuration
- `apps/mobile/lib/notifications.ts` - expo-notifications wrapper: lazy permission, schedule/cancel
- `apps/mobile/stores/sessionStore.ts` - Timer state (restTimerEndsAt, restNotificationId) + actions
- `apps/mobile/components/session/RestTimerBanner.tsx` - Persistent countdown banner UI
- `apps/mobile/components/session/SetRow.tsx` - Wired startRestTimer into the commit path (Rule 2 deviation)

## Decisions Made
- **[Rule 2 deviation] SetRow.tsx wiring**: The plan's Task 1 action explicitly required wiring "the set-commit path (Plan 06 commitSet caller) to call startRestTimer on a successful commit," but `SetRow.tsx` was not listed in the task's `<files>`. Added the wiring inline since the plan's own action mandated it -- without it the timer would never start on set completion, breaking the plan's primary truth.
- **Store-side rest-duration resolution**: `startRestTimer(exerciseId)` queries `userProfile.restTimerDefaultSec` directly from the DB inside the store action (falling back to `FALLBACK_REST_DEFAULT_SEC = 120` on a query failure) rather than requiring the caller to pass the profile default in. This keeps `SetRow.tsx`'s trigger a single argument-free call and centralizes the D-25 override-vs-default precedence and DB-failure fallback in one place. Tradeoff: an extra async DB round-trip per set commit before the timer visibly starts, judged acceptable since op-sqlite JSI reads are synchronous-fast and the row is a single-row profile table.
- **Race guard on notification scheduling**: Both `startRestTimer` and `addThirtySeconds` guard the async `scheduleRestNotification` callback by re-checking `get().restTimerEndsAt` still equals the `endsAt` that was scheduled for before storing the returned notification id -- otherwise the now-stale notification is immediately cancelled. Prevents a rapid Skip or a second set's commit from leaving an orphaned notification scheduled for a countdown that's no longer running.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] SetRow.tsx startRestTimer wiring**
- **Found during:** Task 1 (Timestamp rest-timer logic + notifications + haptics)
- **Issue:** The plan's action text required wiring the set-commit path to call `startRestTimer` on a successful commit, but `SetRow.tsx` (the only `commitSet` caller) was not listed in the task's declared `files_modified`/`<files>`. Without this wiring the entire feature (LIFT-05's core truth: "completing a set starts a configurable auto-rest timer") would be inert.
- **Fix:** Added a `startRestTimer(exerciseId)` call in `SetRow.tsx` immediately following a successful `commitSet`.
- **Files modified:** `apps/mobile/components/session/SetRow.tsx`
- **Verification:** `npx tsc --noEmit` clean; code-reviewed call site matches the store's `startRestTimer` signature.
- **Committed in:** `243f06a` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical / Rule 2)
**Impact on plan:** Necessary for the plan's core truth to function at all. No scope creep -- confined to wiring the already-planned store action into its only call site.

## Issues Encountered
None during autonomous execution (Tasks 1-2). Task 3's on-device checkpoint could not be automated by design (RESEARCH Environment Availability: haptics don't fire on the simulator, background-notification delivery requires a physical device) -- the user chose to defer verification to the phase-level UAT pass rather than verify now.

## Deferred Verification (Task 3 — NOT passed, NOT failed)

**Status: DEFERRED to phase UAT.** The checkpoint's six on-device behaviors were not verified during this plan's execution. They are carried forward as `human_judgment: true` coverage items (D1-D6 above, `status: unknown`) so `gsd-verify-work`'s phase-level UAT pass surfaces them as pending human verification. LIFT-05 is **not** marked complete in REQUIREMENTS.md until these pass.

The six steps to verify on a physical iOS device running the dev build:
1. Start a workout, log a set (check the checkmark) -- the rest banner appears and counts down.
2. Tap +30s -- the countdown jumps up 30s. Tap Skip -- the banner clears.
3. Log another set, then background/lock the phone before the timer expires -- confirm a local notification fires at expiry.
4. Log a set, then return to the app before expiry -- confirm the scheduled notification is cancelled (no late notification fires).
5. Confirm the haptic buzz + sound at zero when foregrounded.
6. Confirm notification permission is requested on the FIRST timer use, not during onboarding.

## User Setup Required
None - no external service configuration required (expo-notifications/expo-haptics use OS-native permission prompts handled in-app).

## Next Phase Readiness
- Timer/notification/haptics code is complete and typecheck-clean; Plan 08 (finish summary + HSS breakdown sheet) and Plan 09 (Settings default rest timer) can build on `sessionStore`'s timer state without further changes here.
- **Blocker for milestone close (not for next plan):** LIFT-05 requires an on-device UAT pass (the six steps above) before it can be marked complete in REQUIREMENTS.md. Flagged in STATE.md.

---
*Phase: 03-onboarding-lifting-logger*
*Completed: 2026-07-09*

## Self-Check: PASSED

All referenced files found on disk; both task commits (243f06a, 2064668) verified present in git log.
