---
phase: 03-onboarding-lifting-logger
plan: 09
subsystem: ui
tags: [expo-router, zustand, drizzle, react-native, settings]

# Dependency graph
requires:
  - phase: 03-onboarding-lifting-logger
    provides: ProfileReview component, useSaveProfile insert path (Plan 05); tab shell + Stack.Protected gate (Plan 04); user_profile schema with units/restTimerDefaultSec columns (Plan 02)
provides:
  - Settings tab (profile editor + units toggle + rest default + about footer)
  - useProfile hook (read + forward-only UPDATE against user_profile)
  - settingsStore (units-preference mirror, zustand)
affects: [phase-04-dashboard (Home tab consumes readiness/profile), phase-05-healthkit (bodyweight import will call useProfile's update path)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Settings profile editor stages ProfileReview row-taps into a local draft (component state), committed in one UPDATE via the batch 'Save Changes' button — mirrors onboarding's tap-to-edit-then-save shape (D-04) without needing per-field navigation routes"
    - "Single-value toggles (units, rest-timer default) write immediately via useProfile.update(), bypassing the batch draft used for the four review fields"
    - "settingsStore.ts (zustand) mirrors user_profile.units so any future screen can read the display-units preference without re-querying the DB — hydrated by useProfile on every load/update"

key-files:
  created:
    - apps/mobile/hooks/useProfile.ts
    - apps/mobile/lib/settingsStore.ts
    - "apps/mobile/app/(tabs)/settings/_layout.tsx"
    - "apps/mobile/app/(tabs)/settings/index.tsx"
  modified: []

key-decisions:
  - "Settings profile editor uses an in-file modal-per-field editor (segment picker for sex, numeric/pace TextInput for the rest) instead of separate edit routes — files_modified/artifacts in the plan declared only _layout.tsx + index.tsx, and ProfileReview's contract (values/onEditField/primaryLabel/onSubmit) maps cleanly onto a local-draft-then-batch-save flow"
  - "Units and rest-timer-default changes apply instantly (call update() directly on tap) rather than joining the four-field batch draft, since they're single-value toggles, not multi-field review data — matches the onboarding units.tsx step's instant-selection feel and the phase UAT note ('toggle units and confirm display flips')"
  - "useProfile.ts is a new update-in-place hook, not an edit to useSaveProfile.ts (which stays insert-only for onboarding) — useSaveProfile's Plan 05 doc comment anticipated this split"

patterns-established:
  - "Forward-only profile edits: every write in this plan is `db.update(userProfile).set(patch).where(eq(userProfile.id, profile.id))` — never touches strength_set.stressScore, endurance_segment.stressScore, workout.hss, or load_daily (D-05/Phase 02 D-06)"

requirements-completed: [ONB-02, ONB-04]

coverage:
  - id: D1
    description: "Settings tab shows a profile editor (sex, bodyweight, threshold HR, threshold pace) reusing the onboarding ProfileReview component; edits are staged via tap-to-edit and committed through a forward-only UPDATE"
    requirement: "ONB-02"
    verification:
      - kind: unit
        ref: "cd apps/mobile && npx tsc --noEmit (exit 0)"
        status: pass
      - kind: other
        ref: "grep -n 'workout|loadDaily|load_daily' apps/mobile/hooks/useProfile.ts apps/mobile/lib/settingsStore.ts -- only doc-comments reference those tables, no write calls"
        status: pass
    human_judgment: true
    rationale: "The UI-SPEC's manual verification step ('edit bodyweight in Settings, then log a set — future effective-load uses the new value while past sets are unchanged') requires running the app on-device; static analysis confirms the query shape but not the on-device UX or that the review re-render reflects the DB write correctly."
  - id: D2
    description: "Settings exposes a units toggle (km<->mi, kg<->lb) that writes user_profile.units while storage stays metric"
    requirement: "ONB-04"
    verification:
      - kind: unit
        ref: "cd apps/mobile && npx tsc --noEmit (exit 0)"
        status: pass
    human_judgment: true
    rationale: "Verifying 'toggle units and confirm display flips without changing stored metric values' is an on-device visual/behavioral check per the plan's own verification section, not something a type check can confirm."
  - id: D3
    description: "Settings exposes the default rest-timer duration and an about/version footer, with scope held to D-32 (no notification prefs, no data management)"
    verification:
      - kind: other
        ref: "grep -ni 'notification|export data|data export|delete all' apps/mobile/app/(tabs)/settings/index.tsx -- only a doc-comment mentions 'notification' (as an explicit exclusion), no UI"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-07-09
status: complete
---

# Phase 03 Plan 09: Settings Tab Summary

**Settings tab with a batched profile editor (reusing ProfileReview), instant units/rest-timer toggles, and an about/version footer — all writes route through a forward-only UPDATE that never touches version-stamped HSS scores**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-09T21:25:39Z
- **Completed:** 2026-07-09T21:34:00Z
- **Tasks:** 2
- **Files modified:** 4 (all new)

## Accomplishments
- `useProfile.ts`: reads the single `user_profile` row via drizzle and exposes an `update()` path that writes only to `user_profile` — never `workout.hss`, `load_daily`, or per-set `stressScore` (D-05 edits-forward, Phase 02 D-06 version-stamping)
- `settingsStore.ts`: a small zustand store mirroring the active `units` preference so any screen can drive display conversion without re-querying the DB
- Settings tab (`(tabs)/settings/_layout.tsx` + `index.tsx`): reuses `ProfileReview` (Plan 05) for a tap-to-edit-then-save profile editor, a dedicated instant Units toggle, six rest-timer duration presets, and an about/version footer (`Apsis v1.0.0`, `Engine v0.0.1`) — scope held to D-32, no notification or data-export UI

## Task Commits

Each task was committed atomically:

1. **Task 1: Profile read hook + settings store + units-aware display** - `660b7db` (feat)
2. **Task 2: Settings screen — profile editor + units toggle + rest default + about footer** - `34c0a63` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `apps/mobile/hooks/useProfile.ts` - reads `user_profile`; `update()` is a parameterized drizzle UPDATE scoped to the mandatory single row
- `apps/mobile/lib/settingsStore.ts` - zustand store mirroring `units` for cross-screen display conversion
- `apps/mobile/app/(tabs)/settings/_layout.tsx` - plain expo-router `<Stack>` for the settings group, mirrors the Log tab's layout
- `apps/mobile/app/(tabs)/settings/index.tsx` - the Settings screen: ProfileReview-backed profile editor + Units toggle + Default Rest Timer presets + about footer

## Decisions Made
- Profile-field edits are staged in a local draft (component state seeded from the loaded profile) and committed together via `ProfileReview`'s `primaryLabel="Save Changes"` button — a single batched UPDATE — rather than per-field navigation routes, since only `_layout.tsx`/`index.tsx` were declared as plan artifacts and this maps directly onto `ProfileReview`'s existing `values`/`onEditField`/`onSubmit` contract.
- Units and rest-timer-default changes bypass the batch draft and call `update()` immediately on tap — they're single-value toggles (matching the onboarding `units.tsx` step's instant-selection feel), not part of the four-field numeric review.
- `useProfile.ts` is a new hook, not a modification to `useSaveProfile.ts` — the latter stays insert-only for the one-time onboarding flow, exactly as its Plan 05 doc comment anticipated ("Plan 09's Settings editor... will extend this pattern with an update-in-place path").

## Deviations from Plan

None — plan executed as written. The plan explicitly left "exact BW factor values... Migration mechanics... Breakdown sheet layout, exercise-card visual design, empty states" and similar UI/interaction specifics to Claude's Discretion (03-CONTEXT.md); the field-editor modal design and draft/batch-save pattern fall within that same declared discretion band and are documented above as decisions, not deviations.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ONB-02 and ONB-04 are structurally complete: Settings shows the profile editor and units toggle within D-32's bounded scope, with every write forward-only.
- `cd apps/mobile && npx tsc --noEmit` and the root `npm run typecheck` (tsc --build, cross-package) both exit 0.
- Manual on-device UAT is still required per the plan's own `<verification>` section (edit bodyweight -> log a set -> confirm only future effective-load changes; toggle units -> confirm display flips without changing stored metric) — flagged as `human_judgment: true` in the coverage block above, consistent with LIFT-05's precedent from Plan 07 (deferred to phase UAT).
- This was the final plan (9 of 9) in Phase 03 — phase-level UAT/verification is the next step, not a new plan.

## Known Stubs
None.

## Threat Flags
None - all three T-03-19/T-03-20/T-03-08 threats from the plan's threat_model were mitigated as scoped (see coverage/decisions above); no new surface introduced beyond what the plan anticipated.

---
*Phase: 03-onboarding-lifting-logger*
*Completed: 2026-07-09*

## Self-Check: PASSED

All created files verified present; all task/summary commit hashes (`660b7db`, `34c0a63`, `284f000`) verified in git log.
