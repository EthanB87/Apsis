---
phase: 03-onboarding-lifting-logger
plan: 05
subsystem: ui
tags: [expo-router, zustand, drizzle, onboarding-wizard, race-pace-estimate]

# Dependency graph
requires:
  - phase: 03-onboarding-lifting-logger
    provides: "Plan 04's onboardingDraft.ts (draft store + WIZARD_STEP_ORDER + estimate-provenance flags), WizardStep.tsx shared chrome, Stack.Protected gate + useProfileExists hook in app/_layout.tsx"
provides:
  - "thresholdEstimates.ts: pure thresholdPaceFromRace/thresholdHrFromMax/thresholdHrFromAge helpers (D-02), no wall-clock/IO"
  - "threshold-hr.tsx and threshold-pace.tsx wizard steps: dual direct-entry / estimate-for-me paths, D-03 soft-validation warnings"
  - "ProfileReview.tsx: reusable presentational review-and-save editor (D-04) — Label/Body rows, 'estimated' tags, tap-to-edit — backs both this plan's review screen and Plan 09's Settings editor (ONB-02)"
  - "useSaveProfile.ts: parameterized drizzle insert of user_profile (T-1-01), generic UI-SPEC error string on failure"
  - "review.tsx: terminal wizard screen wiring ProfileReview + useSaveProfile to the draft; 'Save & Start Training' inserts the profile row and unlocks the tabs (ONB-01 complete)"
  - "lib/profileVersion.ts + useProfileExists.ts re-query trigger: makes the Stack.Protected gate actually flip after Save without an app relaunch"
affects: [03-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-path wizard steps (D-02): a full-width row of two/three flex:1 ModeButton pills toggling between 'I know my numbers' and 'Estimate for me' sub-forms within the same WizardStep screen, rather than separate screens per path"
    - "Estimate preview text renders inline below the estimate sub-form (e.g. 'Estimated threshold HR: 172 bpm') so the user sees the derived number before committing Continue"
    - "ProfileReview is deliberately values+callbacks-only (no db/router import) so Plan 09's Settings editor can render the identical component against a live profile row instead of the draft"
    - "profileVersion.ts: a module-scoped zustand counter as a cross-cutting 're-check' signal, bumped by a write-side hook (useSaveProfile) and subscribed to by a read-side hook (useProfileExists) that lives in a different component tree (root layout vs. onboarding stack) — the pattern for any future write that needs to invalidate a boot-time gate query"

key-files:
  created:
    - apps/mobile/lib/thresholdEstimates.ts
    - apps/mobile/app/onboarding/threshold-hr.tsx
    - apps/mobile/app/onboarding/threshold-pace.tsx
    - apps/mobile/components/onboarding/ProfileReview.tsx
    - apps/mobile/hooks/useSaveProfile.ts
    - apps/mobile/app/onboarding/review.tsx
    - apps/mobile/lib/profileVersion.ts
  modified:
    - packages/shared/src/units.ts
    - apps/mobile/hooks/useProfileExists.ts

key-decisions:
  - "Race-pace-to-threshold offset constants (03-RESEARCH.md Assumption A6, Claude's discretion): 5K x1.05, 10K x1.02, half-marathon x1.00 — offset shrinks toward 1.0 as race distance approaches the engine's own ~60-minute threshold-run calibration anchor (Phase 02 D-13)"
  - "Added formatPaceMinSec to packages/shared/src/units.ts (outside this plan's declared files) rather than duplicating mm:ss formatting logic across threshold-pace.tsx's estimate preview and ProfileReview.tsx's pace row — a pure, zero-dependency display helper consistent with the rest of units.ts"
  - "threshold-hr.tsx's estimate path offers a second-level toggle ('I know my max HR' / 'Use my age instead') rather than always showing both fields, matching D-02's literal 'ask for max HR if known; else fall back to age' sequencing"
  - "threshold-pace.tsx's estimate finish-time entry uses three fields (hr/min/sec) rather than min/sec, since half-marathon finish times commonly exceed 60 minutes"
  - "ProfileReview's tap-to-edit pushes to the target wizard step's existing route (e.g. /onboarding/sex) rather than building a 'return to review after edit' shortcut — each step's own Continue button already walks forward through the remaining steps, which satisfies this plan's literal acceptance criterion without adding new step-completion state"

patterns-established:
  - "Cross-tree gate re-query via a bumped zustand counter (profileVersion.ts) — the mechanism any future onboarding-adjacent write (e.g. Settings profile edit) can reuse if it ever needs to invalidate a boot-gate query from outside the root layout's own component tree"

requirements-completed: [ONB-01]

coverage:
  - id: D1
    description: "Threshold HR and threshold pace wizard steps each offer direct-entry OR an estimate-for-me path (race-time picker for pace; max-HR-or-age fallback for HR), writing results + an estimated provenance flag into the draft, with D-03 soft-validation warnings that never block Continue"
    requirement: "ONB-01"
    verification:
      - kind: other
        ref: "apps/mobile/app/onboarding/{threshold-hr,threshold-pace}.tsx + apps/mobile/lib/thresholdEstimates.ts; root pnpm run typecheck and apps/mobile npx tsc --noEmit both clean"
        status: pass
    human_judgment: true
    rationale: "Visual verification of the dual-path toggle, estimate preview text, and out-of-range warning color requires running the app on a device/simulator — deferred to phase UAT per the plan's own verification block."
  - id: D2
    description: "The wizard ends with a reusable review screen showing every captured value (estimates labeled 'estimated'), each row tap-to-edit, and a 'Save & Start Training' button whose Save inserts the user_profile row via a parameterized drizzle builder and flips Plan 04's Stack.Protected gate to the tabs"
    requirement: "ONB-01"
    verification:
      - kind: other
        ref: "apps/mobile/components/onboarding/ProfileReview.tsx + apps/mobile/hooks/useSaveProfile.ts + apps/mobile/app/onboarding/review.tsx + apps/mobile/lib/profileVersion.ts + apps/mobile/hooks/useProfileExists.ts; root pnpm run typecheck and apps/mobile npx tsc --noEmit both clean"
        status: pass
    human_judgment: true
    rationale: "Actually completing the wizard on a device/simulator and observing the app transition from the onboarding stack to the tab shell after Save (the gate flip) requires a human running the app — deferred to phase UAT per the plan's own verification block."

duration: 9min
completed: 2026-07-09
status: complete
---

# Phase 3 Plan 05: Threshold Capture + Reusable Review/Save Summary

**Dual direct/estimate threshold HR and pace wizard steps, a reusable ProfileReview component, and the drizzle profile insert that flips the onboarding gate to the tabs**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-09T16:23:38-04:00 (prior plan completion)
- **Completed:** 2026-07-09T16:32:16-04:00
- **Tasks:** 2
- **Files modified:** 9 (7 created, 2 modified)

## Accomplishments
- `thresholdEstimates.ts`: three pure helpers — `thresholdPaceFromRace(distanceKey, finishSec)`
  (5K/10K/half distance -> race pace -> threshold-offset multiplier), `thresholdHrFromMax(maxHr)`,
  `thresholdHrFromAge(age)` — no `Date`, no I/O, matching the engine's purity discipline
- `threshold-hr.tsx`: "I know my numbers" direct bpm entry vs. "Estimate for me" (max-HR-known
  toggle -> age fallback), writing `thresholdHr` + `thresholdHrEstimated` into the draft;
  100-220 bpm soft-validation warning that never blocks Continue (D-03)
- `threshold-pace.tsx`: direct mm:ss pace entry (honoring `draft.units`, converting imperial
  entry to sec/km via `paceSecPerMiToSecPerKm`) vs. "Estimate for me" race-time picker
  (5K/10K/Half distance pill + hr:min:sec finish time -> `thresholdPaceFromRace`); 2:30-12:00
  /km soft-validation warning
- `ProfileReview.tsx`: presentational review list (sex, bodyweight, threshold HR, threshold
  pace, units) rendered from props only — no db/router import — so it can back both this
  plan's onboarding review screen and Plan 09's Settings editor unchanged; estimated fields
  render a small "estimated" tag (D-04's honest-number thesis)
- `useSaveProfile.ts`: inserts the `user_profile` row via a parameterized drizzle builder
  (T-1-01), stores everything metric, and surfaces only the hardcoded UI-SPEC error string on
  failure while console.error'ing the raw error for diagnostics (never raw bodyweight/HR/pace)
- `review.tsx`: wires `ProfileReview` to the onboarding draft and `useSaveProfile`; "Save &
  Start Training" is the primary CTA exactly per the UI-SPEC copywriting contract
- Closed a gate-flip gap: added `lib/profileVersion.ts` (a bumped zustand counter) and extended
  `useProfileExists.ts` to depend on it, so a successful Save actually re-queries and flips
  Plan 04's `Stack.Protected` gate from onboarding to the tab shell without requiring an app
  relaunch
- Added `formatPaceMinSec` to `packages/shared/src/units.ts`, reused by both
  `threshold-pace.tsx`'s estimate preview and `ProfileReview.tsx`'s pace row

## Task Commits

Each task was committed atomically:

1. **Task 1: Threshold estimate helpers + threshold-hr + threshold-pace steps** - `8d41d2a` (feat)
2. **Task 2: Reusable ProfileReview + save hook + review screen (ONB-01 completion)** - `98df9b7` (feat)

## Files Created/Modified
- `apps/mobile/lib/thresholdEstimates.ts` - pure race-pace and max-HR/age threshold estimate helpers (D-02)
- `apps/mobile/app/onboarding/threshold-hr.tsx` - threshold HR wizard step, dual direct/estimate paths
- `apps/mobile/app/onboarding/threshold-pace.tsx` - threshold pace wizard step, dual direct/estimate paths
- `packages/shared/src/units.ts` - added `formatPaceMinSec` display helper
- `apps/mobile/components/onboarding/ProfileReview.tsx` - reusable review-and-save editor (D-04/ONB-02)
- `apps/mobile/hooks/useSaveProfile.ts` - parameterized drizzle insert of `user_profile`
- `apps/mobile/app/onboarding/review.tsx` - terminal wizard screen, "Save & Start Training"
- `apps/mobile/lib/profileVersion.ts` - bumped zustand counter, the Save -> gate-flip signal
- `apps/mobile/hooks/useProfileExists.ts` - now re-queries on `profileVersion` bump

## Decisions Made
- Race-pace-to-threshold offsets: 5K x1.05, 10K x1.02, half-marathon x1.00 (03-RESEARCH.md
  Assumption A6, Claude's discretion) — offset shrinks toward 1.0 as race distance approaches
  the engine's own ~60-minute threshold-run calibration anchor
- `formatPaceMinSec` added to `packages/shared/src/units.ts` rather than duplicated in two
  onboarding files — a pure, zero-dependency display helper consistent with the rest of the
  module
- threshold-hr's estimate path uses a second-level "I know my max HR" / "Use my age instead"
  toggle rather than always showing both fields, matching D-02's literal known-then-fallback
  sequencing
- threshold-pace's estimate finish-time entry uses hr:min:sec (not just min:sec) since half
  marathon times commonly exceed 60 minutes
- ProfileReview's tap-to-edit pushes to the target step's existing forward route rather than
  building a "jump back to review after edit" shortcut — satisfies the plan's literal
  acceptance criterion without new step-completion state; each step's own Continue already
  walks the remaining steps forward

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added a Save -> gate re-query signal so the profile insert actually unlocks the app**
- **Found during:** Task 2 (review screen + save hook)
- **Issue:** `useProfileExists(ready)` only ran its `user_profile` count query once, when
  `ready` (migrations success) became true — its `useEffect` dependency array was `[ready]`
  only. Inserting a profile row later on the review screen would never cause the root layout's
  `hasProfile` state to update, so Plan 04's `Stack.Protected` gate would never flip from
  onboarding to the tab shell without a full app relaunch — directly contradicting this plan's
  own must_have truth ("Saving inserts the user_profile row, which flips the Stack.Protected
  gate to the tabs").
- **Fix:** Added `apps/mobile/lib/profileVersion.ts`, a tiny zustand counter (`version`/`bump`).
  `useSaveProfile` calls `bump()` after a successful insert; `useProfileExists` now subscribes
  to `version` and includes it in its effect's dependency array, so the count query re-runs and
  `hasProfile` flips to `true` as soon as the insert commits.
- **Files modified:** `apps/mobile/lib/profileVersion.ts` (new), `apps/mobile/hooks/useProfileExists.ts`
- **Verification:** `pnpm run typecheck` (root) and `apps/mobile`'s own `npx tsc --noEmit` both
  clean after the change; gate-flip logic traced by inspection (`bump()` -> `version` state
  change -> `useProfileExists`'s effect dependency changes -> re-query -> `setState(true)` ->
  `RootLayout` re-renders -> `Stack.Protected guard={hasProfile}` swaps to `(tabs)`).
- **Committed in:** `98df9b7` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary for ONB-01's own stated must_have truth to actually hold at
runtime; the two touched files (`lib/profileVersion.ts`, `hooks/useProfileExists.ts`) were not
in the plan's declared `files_modified` list but the change is minimal, additive, and does not
alter either file's existing behavior for any other caller. No scope creep beyond closing this
gap.

## Issues Encountered
None - both `pnpm run typecheck` (root, cross-package via TS project references) and
`apps/mobile`'s own `npx tsc --noEmit` were clean after each task, first attempt.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ONB-01 is now functionally complete: sex, bodyweight, units, threshold HR, and threshold
  pace are all captured (direct or estimated), reviewed, and persisted to `user_profile`,
  unlocking the tab shell.
- `ProfileReview.tsx` and the `useSaveProfile` insert pattern are ready for Plan 09's Settings
  editor to reuse — Plan 09 will extend `useSaveProfile` (or add a sibling hook) with an
  update-in-place path against the existing profile row, since this plan's hook is insert-only
  (first-time onboarding has no existing row).
- `apps/mobile/lib/profileVersion.ts`'s bump/subscribe pattern is available for Plan 09 (or any
  future write) if it ever needs to invalidate a boot-time gate query from outside the root
  layout's own component tree.
- No blockers for downstream plans in this wave. Full end-to-end wizard walkthrough (all six
  steps -> Save -> tab shell) is deferred to phase UAT, consistent with Plan 04's precedent.

---
*Phase: 03-onboarding-lifting-logger*
*Completed: 2026-07-09*

## Self-Check: PASSED

All 7 created files confirmed present on disk; both task commit hashes (8d41d2a,
98df9b7) confirmed present in `git log --oneline --all`.
