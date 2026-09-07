---
phase: 03-onboarding-lifting-logger
plan: 04
subsystem: ui
tags: [expo-router, stack-protected, zustand, drizzle, onboarding-wizard, crash-recovery]

# Dependency graph
requires:
  - phase: 03-onboarding-lifting-logger
    provides: "Plan 01 units.ts (lbToKgExact), Plan 02 schema (userProfile, workout.finishedAt/deletedAt) + queries.ts (openWorkout, softDeleteWorkout), Plan 03 dark-only Colors.ts/theme.ts design tokens + zustand dependency"
provides:
  - "Stack.Protected onboarding gate in app/_layout.tsx: no-profile routes to onboarding, profile-exists routes to (tabs) (D-01); onboarding structurally unreachable once a profile exists (ONB-03)"
  - "useProfileExists(ready) hook — drizzle count query over user_profile, gated on migrations success"
  - "D-14 crash/kill resume: openWorkout query on boot renders ResumePrompt (Resume/Finish Now/Discard) before the tab shell ever mounts; Discard soft-deletes via Plan 02's softDeleteWorkout"
  - "onboarding/_layout.tsx wizard stack scaffold"
  - "onboardingDraft.ts: in-memory zustand draft (no persist) + WIZARD_STEP_ORDER constant (sex, bodyweight, units, threshold-hr, threshold-pace, review) for Plan 05 to extend"
  - "WizardStep.tsx shared step chrome: Heading question, progress dots, Accent primary button pinned to bottom safe area"
  - "sex.tsx, bodyweight.tsx, units.tsx wizard step screens with D-03 soft validation"
affects: [03-05, 03-06, 03-08, 03-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stack.Protected guard={boolean} verified directly against installed expo-router 56.2.11 type declarations (node_modules/expo-router/build/views/Protected.d.ts) rather than assumed from research — matches RESEARCH.md Pattern 1 exactly, no Redirect fallback needed"
    - "Root-layout boot sequence extended with two more async gates (hasProfile, openWorkoutRow) using the same 'loading' | T sentinel + cancelled-flag useEffect pattern as the existing useMigrations gate"
    - "Wizard screens hold a WizardStepName prop explicitly rather than parsing usePathname() — simpler and avoids fragile route-string parsing"
    - "onboardingDraft.ts follows RESEARCH.md's anti-pattern note: zustand store has no persist middleware; the user_profile row (Plan 05's review-screen Save) is the only durable store"
    - "Forward-referencing not-yet-built routes (/onboarding/threshold-hr, /(tabs)/log/session, /session/finish) typechecks cleanly because this repo has no generated .expo/types/router.d.ts yet, so expo-router's Href type falls back to permissive string — confirmed by reading node_modules/expo-router's typed-routes/types.d.ts, not assumed"

key-files:
  created:
    - apps/mobile/hooks/useProfileExists.ts
    - apps/mobile/app/onboarding/_layout.tsx
    - apps/mobile/app/onboarding/sex.tsx
    - apps/mobile/app/onboarding/bodyweight.tsx
    - apps/mobile/app/onboarding/units.tsx
    - apps/mobile/lib/onboardingDraft.ts
    - apps/mobile/components/onboarding/WizardStep.tsx
  modified:
    - apps/mobile/app/_layout.tsx
    - apps/mobile/components/BootStates.tsx

key-decisions:
  - "Verified Stack.Protected's exact prop shape (guard: boolean) against the installed expo-router 56.2.11 package's .d.ts files instead of trusting RESEARCH.md's web-synthesized Pattern 1 verbatim — it matched exactly, so no Redirect fallback was needed"
  - "openWorkout/hasProfile checks run as parallel useEffect-driven state gates in the same root layout, both resolving before the Stack.Protected tree (or the ResumePrompt) ever renders, so the resume prompt truly appears before the tab shell mounts"
  - "ResumePrompt uses the dark UI-SPEC palette (Colors.dark.*) even though the pre-existing LoadingScreen/ErrorScreen still use light hardcoded colors — left those two untouched since restyling them was out of this task's scope and not required by any acceptance criterion"
  - "bodyweight.tsx requires a numeric value before enabling Continue (empty field disabled) but never disables it for being outside the 30-250 kg plausible range — matches D-03's 'soft validation, never block on range' literally while still preventing a blank submit"
  - "units.tsx implements a single metric/imperial toggle (not separate km/mi and kg/lb toggles) because user_profile.units is one enum column in the shipped schema, not two"

patterns-established:
  - "Root layout boot gates compose as: error -> loading (any async gate still 'loading') -> resume prompt (if an open workout exists) -> Stack.Protected route tree. Plan 05's review-screen Save and Plan 06+'s session screens build against this same profile-gated tree."

requirements-completed: [ONB-01, ONB-03]

coverage:
  - id: D1
    description: "Root layout gates the whole app behind profile existence via Stack.Protected: no profile row renders the onboarding stack, a profile row renders the tab shell, and onboarding is structurally unreachable once a profile exists"
    requirement: "ONB-03"
    verification:
      - kind: other
        ref: "apps/mobile/app/_layout.tsx Stack.Protected guard={!hasProfile}/guard={hasProfile}; npx tsc --noEmit clean"
        status: pass
    human_judgment: true
    rationale: "Actually launching the app on first install (no profile row) vs. after onboarding completes to confirm the gate visually routes correctly requires a human running the app on device/simulator — deferred to phase UAT per the plan's own verification block."
  - id: D2
    description: "Crash/kill resume: an unfinished, non-deleted workout row renders a ResumePrompt (Resume/Finish Now/Discard) before the tab shell mounts; Discard soft-deletes via Plan 02's softDeleteWorkout"
    requirement: "ONB-01"
    verification:
      - kind: other
        ref: "apps/mobile/app/_layout.tsx openWorkout(db) gate + apps/mobile/components/BootStates.tsx ResumePrompt; npx tsc --noEmit clean"
        status: pass
    human_judgment: true
    rationale: "Requires actually killing the app mid-workout and relaunching on a device/simulator to observe the prompt — deferred to phase UAT."
  - id: D3
    description: "Onboarding wizard captures sex, bodyweight (kg/lb display), and unit preference one input per screen with a progress indicator and soft validation (bodyweight 30-250 kg plausible range warns but never blocks Continue)"
    requirement: "ONB-01"
    verification:
      - kind: other
        ref: "apps/mobile/app/onboarding/{sex,bodyweight,units}.tsx + components/onboarding/WizardStep.tsx; npx tsc --noEmit clean"
        status: pass
    human_judgment: true
    rationale: "Visual verification of progress dots, warning color, and touch-target sizing requires running the app on device/simulator — deferred to phase UAT."

duration: 13min
completed: 2026-07-09
status: complete
---

# Phase 3 Plan 04: Onboarding Gate + Wizard Scaffold + Resume Detection Summary

**Stack.Protected onboarding gate blocking the entire app until a profile row exists, a crash/kill resume prompt wired into boot, and the first three wizard steps (sex, bodyweight, units) writing into an in-memory zustand draft with soft validation**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-09T16:08:13-04:00 (prior plan completion)
- **Completed:** 2026-07-09T16:21:01-04:00
- **Tasks:** 2
- **Files modified:** 9 (7 created, 2 modified)

## Accomplishments
- `app/_layout.tsx` now gates the entire route tree by profile existence via
  `Stack.Protected`: `!hasProfile` renders the `onboarding` stack, `hasProfile` renders
  `(tabs)` — verified the exact `guard: boolean` prop shape against the installed
  expo-router 56.2.11 package's own type declarations rather than trusting the research
  doc's web-synthesized example blindly
- `useProfileExists(ready)` hook: a drizzle `count()` query over `user_profile`, gated so
  it only runs after migrations succeed
- D-14 crash/kill resume: `openWorkout(db)` runs on boot; if an unfinished, non-deleted
  workout row exists, a new `ResumePrompt` component renders before the tab shell ever
  mounts, with Resume/Finish Now/Discard buttons (Discard soft-deletes via Plan 02's
  `softDeleteWorkout`)
- `onboarding/_layout.tsx`: a plain headerless `Stack` wizard shell
- `onboardingDraft.ts`: an in-memory-only zustand store (explicitly no `persist`
  middleware) plus a `WIZARD_STEP_ORDER` constant listing all six eventual wizard steps
  so the progress indicator can compute position
- `WizardStep.tsx`: shared chrome for every wizard screen — Heading-size question, 3xl
  top padding, progress dots computed from the step-order constant, and an Accent
  primary button pinned to the bottom safe area, all controls >=44x44
- Three step screens built on `WizardStep`: `sex.tsx` (segment buttons), `bodyweight.tsx`
  (numeric entry honoring `draft.units`, D-03 soft validation with a 30-250 kg plausible
  band that warns but never blocks), `units.tsx` (metric/imperial toggle)

## Task Commits

Each task was committed atomically:

1. **Task 1: Onboarding gate + wizard stack scaffold + resume detection** - `235f6c8` (feat)
2. **Task 2: Shared wizard step chrome + draft store + sex/bodyweight/units steps** - `ebcbd6b` (feat)

## Files Created/Modified
- `apps/mobile/hooks/useProfileExists.ts` - drizzle count query over user_profile, gated on migrations success
- `apps/mobile/app/_layout.tsx` - Stack.Protected onboarding gate + D-14 resume-prompt boot gate
- `apps/mobile/app/onboarding/_layout.tsx` - plain wizard Stack shell
- `apps/mobile/components/BootStates.tsx` - added `ResumePrompt` (dark-themed, no raw detail)
- `apps/mobile/lib/onboardingDraft.ts` - zustand draft store (no persist) + WIZARD_STEP_ORDER
- `apps/mobile/components/onboarding/WizardStep.tsx` - shared step chrome
- `apps/mobile/app/onboarding/sex.tsx` - sex capture step
- `apps/mobile/app/onboarding/bodyweight.tsx` - bodyweight capture step (D-03/D-05)
- `apps/mobile/app/onboarding/units.tsx` - units capture step (D-05/ONB-04)

## Decisions Made
- Confirmed `Stack.Protected`'s prop shape directly from the installed expo-router
  56.2.11 `.d.ts` files (per AGENTS.md's "Expo has changed, verify against the exact
  version" instruction) rather than trusting RESEARCH.md's Assumption A1 verbatim — it
  matched exactly (`guard: boolean`), so no `<Redirect>` fallback was needed
- `ResumePrompt` uses the dark UI-SPEC palette; the pre-existing `LoadingScreen`/
  `ErrorScreen` were left on their original light hardcoded colors since restyling them
  wasn't in this task's file scope or acceptance criteria
- `bodyweight.tsx` disables Continue only for an empty/non-numeric field, never for an
  out-of-range value — matches D-03 ("never block save") literally
- `units.tsx` is a single metric/imperial toggle, not separate distance/weight toggles,
  matching the shipped schema's single `user_profile.units` enum column
- Forward-referenced routes that don't exist until Plan 05/06/08
  (`/onboarding/threshold-hr`, `/(tabs)/log/session`, `/session/finish`) needed no type
  casting — confirmed by reading expo-router's `typed-routes/types.d.ts` that `Href`
  falls back to a permissive `string | HrefObject` because this repo has no generated
  `.expo/types/router.d.ts` yet (same situation Plan 03 already relied on for its
  not-yet-built `log`/`settings` tab routes)

## Deviations from Plan
None - plan executed exactly as written. The plan's own `<read_first>` flagged
Assumption A1 (verify `Stack.Protected`'s exact prop shape against live docs before
finalizing, falling back to `<Redirect>` if it differs) — verification against the
installed package's type declarations confirmed the assumed shape was correct, so no
fallback or deviation was needed.

## Issues Encountered
- `npx tsc --noEmit` in `apps/mobile` initially failed with "Module '@apsis/db' has no
  exported member 'openWorkout'/'softDeleteWorkout'" even though `packages/db/src/index.ts`
  clearly exports both. Root cause: `packages/db`'s `dist/` declaration output was stale
  (missing `queries.d.ts` entirely, predating Plan 02's query builders) and TypeScript's
  project-reference redirect (`composite: true` + `references`) resolves `@apsis/db`
  imports to that stale `.d.ts` output rather than the live `.ts` source, even though
  `apps/mobile/tsconfig.json`'s `paths` mapping points at `src/index.ts` directly.
  Resolved by running the root `pnpm run typecheck` (`tsc --build tsconfig.json`), which
  rebuilt the referenced packages' declaration output; `apps/mobile`'s own
  `npx tsc --noEmit` was clean afterward. This wasn't a code bug — it's inherent to how TS
  project references redirect through referenced projects' `dist/`, and Plan 01's SUMMARY
  had already flagged root `pnpm run typecheck` as this repo's actual cross-package
  verification entry point.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `onboardingDraft.ts`'s `WIZARD_STEP_ORDER` and setters are ready for Plan 05 to append
  `threshold-hr.tsx`, `threshold-pace.tsx`, and `review.tsx` against the same draft
- `WizardStep.tsx` is ready to be reused verbatim by Plan 05's remaining steps
- The root layout's `hasProfile`/`openWorkoutRow` gates are ready for Plan 06 (active
  session screen at `/(tabs)/log/session`) and Plan 08 (finish screen at
  `/session/finish`) to fill in the routes the resume prompt already targets
- No blockers for downstream plans in this wave

---
*Phase: 03-onboarding-lifting-logger*
*Completed: 2026-07-09*

## Self-Check: PASSED

All 9 created/modified files confirmed present on disk; both task commit hashes
(235f6c8, ebcbd6b) confirmed present in `git log --oneline --all`.
