---
phase: 09-beta-feedback-round-1
plan: 06
subsystem: ui
tags: [zustand, expo-router, drizzle-orm, units, unit-conversion]

# Dependency graph
requires:
  - phase: 09-beta-feedback-round-1 (09-01)
    provides: user_profile.liftsUnits/bodyweightUnits/runUnits columns, migration 0005 D-04 backfill, settingsStore three-bucket shape, useProfile.ts ProfileValues/ProfileUpdateInput extension
  - phase: 09-beta-feedback-round-1 (09-03)
    provides: sessionStore.removeExercise, ExerciseCard overflow affordance, recomputeSessionHss export from commitSet.ts
provides:
  - "commitSet.ts fetchProfileSummary extended to return liftsUnits/bodyweightUnits/runUnits alongside the legacy units anchor"
  - "index.tsx/finish.tsx/detail.tsx/share.tsx re-keyed to runUnits (pace/distance) and liftsUnits (volume/strength stat trio) independently"
  - "sessionStore.ts startSession/rehydrateFromDb sourced from profile.liftsUnits (the store's units field is now documented as the LIFT-display bucket)"
  - "nutrition-setup/index.tsx height display re-keyed to bodyweightUnits"
  - "ProfileReview.tsx bodyweight/threshold-pace display re-keyed to bodyweightUnits/runUnits (optional, backward-compatible fallback to the single units field)"
affects: [09-beta-feedback-round-1 phase gate / build-10 UAT, any future Settings profile editor that reuses ProfileReview with split buckets]

actuals:
  tokens: 3177
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Shared profile-summary read extended once (fetchProfileSummary) to serve every domain-specific display bucket from a single db.select() rather than four redundant per-screen queries"
    - "Optional bucket fields with single-value fallback (ProfileReviewValues.bodyweightUnits/runUnits ?? values.units) let a shared presentational component re-key by domain without forcing every existing caller to change"

key-files:
  created: []
  modified:
    - "apps/mobile/app/(tabs)/index.tsx"
    - apps/mobile/app/session/finish.tsx
    - apps/mobile/app/session/detail.tsx
    - apps/mobile/app/session/share.tsx
    - apps/mobile/lib/commitSet.ts
    - apps/mobile/stores/sessionStore.ts
    - apps/mobile/app/nutrition-setup/index.tsx
    - apps/mobile/components/onboarding/ProfileReview.tsx

key-decisions:
  - "Extended commitSet.ts's fetchProfileSummary (outside Task 1's declared files) to return liftsUnits/bodyweightUnits/runUnits alongside the legacy units field, in Task 1's commit rather than deferring to Task 2 -- all four Task 1 display consumers need the per-domain buckets from the same shared profile read that already exists, and duplicating the fetch or adding a second read per screen would be worse than a one-function extension"
  - "sessionStore.ts's own `units` field keeps its name (not renamed to liftsUnits) -- it is documented as the LIFT-display bucket specifically, since the store IS the active lifting session; ExerciseCard.tsx and SetRow.tsx (the latter not in this plan's declared files) already read `s.units` correctly and needed no change once startSession/rehydrateFromDb source it from profile.liftsUnits"
  - "ProfileReview.tsx's bodyweightUnits/runUnits are optional props falling back to the existing single `units` field -- the onboarding review screen only ever collects one units choice, so no caller change was required; a future Settings editor can pass split buckets later"
  - "ProfileReviewField narrowed to keyof Omit<ProfileReviewValues, 'bodyweightUnits' | 'runUnits'> (Rule 1 fix) -- adding the two optional fields to ProfileReviewValues widened keyof ProfileReviewValues and broke onboarding/review.tsx's unrelated Record<ProfileReviewField, Href> FIELD_ROUTE exhaustiveness map, which needs an entry for every editable row field, not every display-resolution input"

patterns-established:
  - "Per-domain unit-bucket resolution at a single shared profile read: fetchProfileSummary now returns all three buckets from one query rather than each caller doing its own separate resolution"

requirements-completed: [D-01]  # Phase-local CONTEXT.md decision code, not a REQUIREMENTS.md REQ-ID (Phase 08 P02 precedent) -- requirements.mark-complete will no-op on this.

coverage:
  - id: D1
    description: "Session + home display surfaces (index.tsx, finish.tsx, detail.tsx, share.tsx) resolve pace/distance via runUnits and volume/strength via liftsUnits independently -- no display read of the single legacy profile.units remains in these four files"
    requirement: "D-01"
    verification:
      - kind: other
        ref: "grep -n \"profile\\.units\" across the four files returns no matches"
        status: pass
      - kind: other
        ref: "pnpm typecheck (root tsc --build, cross-package)"
        status: pass
    human_judgment: true
    rationale: "The plan's own <verification> section defers the on-device imperial-lifts + km-runs proof (225 lb squats + 5 km runs with /km pace on the same day, across finish/detail/history/home) to the phase gate / build 10 UAT, not this plan's automated verify -- no on-device build is possible mid-plan from this Windows host."
  - id: D2
    description: "sessionStore.ts, commitSet.ts, and ExerciseCard.tsx resolve lift-display units via liftsUnits; nutrition-setup/index.tsx resolves height via bodyweightUnits; ProfileReview.tsx resolves bodyweight/threshold-pace via bodyweightUnits/runUnits; the 09-03 Remove-exercise affordance is preserved untouched"
    requirement: "D-01"
    verification:
      - kind: other
        ref: "pnpm typecheck (root tsc --build, cross-package)"
        status: pass
      - kind: unit
        ref: "pnpm --filter=./apps/mobile test sessionStore (5/5 pass, no regressions)"
        status: pass
      - kind: unit
        ref: "pnpm -r test (298/298 pass across shared/engine/db/mobile)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-05
status: complete
---

# Phase 09 Plan 06: Units-Split Consumer Sweep (Session/Home/Store/Setup) Summary

**Re-keyed nine display consumers from the single legacy `profile.units` to the three D-01 buckets (liftsUnits/bodyweightUnits/runUnits), extending `commitSet.ts`'s shared `fetchProfileSummary` read to serve all three buckets from one query -- a session showing both lift volume and run pace now resolves each independently.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-05T21:33:00Z (worktree, post wave-1 merge base)
- **Completed:** 2026-08-05T21:46:00Z
- **Tasks:** 2/2
- **Files modified:** 8

## Accomplishments
- `fetchProfileSummary` (commitSet.ts) extended to select and return `liftsUnits`/`bodyweightUnits`/`runUnits` alongside the legacy `units` anchor, each falling back to `units` for a not-yet-backfilled row -- one shared DB read now serves every domain-specific display bucket instead of four redundant per-screen queries
- `index.tsx` (TODAY dashboard): endurance meta pace/distance line re-keyed to `runUnits`
- `finish.tsx`: split the single `units` useState into `liftsUnits` (volume display) and `runUnits` (endurance summary pace/distance) -- the file now genuinely resolves both independently rather than collapsing to one value
- `detail.tsx`: endurance meta pace/distance re-keyed to `runUnits` (this screen shows HSS stress, not raw volume, so no `liftsUnits` display exists here)
- `share.tsx`: `buildStrengthStatTrio` -> `liftsUnits`, `buildEnduranceStatTrio` -> `runUnits`
- `sessionStore.ts`: `startSession`/`rehydrateFromDb` now receive and store `profile.liftsUnits` (not the legacy single `profile.units`); the store's own `units` field is documented in both the interface and each call site as the LIFT-display bucket specifically -- `ExerciseCard.tsx` and `SetRow.tsx` needed zero changes since they already read `s.units` for the correct (lift) purpose
- `nutrition-setup/index.tsx`: height display re-keyed to `bodyweightUnits` (a body-metric concern, not a lift concern)
- `ProfileReview.tsx`: bodyweight display -> `bodyweightUnits`, threshold-pace display -> `runUnits`, both optional props falling back to the existing single `units` field so the onboarding review screen (which only ever collects one units choice pre-split) needed no caller change

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-key session + home display surfaces** - `6a28f4f` (feat)
2. **Task 2: Re-key store + nutrition-setup + profile-review surfaces** - `200616b` (feat)

_Note: no plan-metadata commit in worktree mode -- the orchestrator commits STATE.md/ROADMAP.md centrally after the wave merges._

## Files Created/Modified
- `apps/mobile/app/(tabs)/index.tsx` - endurance meta pace/distance -> `profile.runUnits`
- `apps/mobile/app/session/finish.tsx` - split `units` state into `liftsUnits`/`runUnits`; volume -> `liftsUnits`, endurance summary -> `runUnits`
- `apps/mobile/app/session/detail.tsx` - endurance meta -> `profile.runUnits`
- `apps/mobile/app/session/share.tsx` - strength stat trio -> `profile.liftsUnits`, endurance stat trio -> `profile.runUnits`
- `apps/mobile/lib/commitSet.ts` - `fetchProfileSummary` extended to return `liftsUnits`/`bodyweightUnits`/`runUnits` (Rule 2 deviation, outside Task 1's declared files)
- `apps/mobile/stores/sessionStore.ts` - `startSession`/`rehydrateFromDb` param type + implementation source `liftsUnits`; interface doc comment added
- `apps/mobile/app/nutrition-setup/index.tsx` - height display -> `profile.bodyweightUnits`
- `apps/mobile/components/onboarding/ProfileReview.tsx` - optional `bodyweightUnits`/`runUnits` props with `units` fallback; `ProfileReviewField` narrowed to exclude them (Rule 1 fix)

## Decisions Made
- Extended `fetchProfileSummary` in Task 1's commit (not deferred to Task 2, despite the plan's Task 2 action text nominally owning `commitSet.ts`) because all four Task 1 display consumers needed the per-domain buckets from that same shared read immediately -- see key-decisions in frontmatter for the full rationale.
- Kept `sessionStore.ts`'s `units` field name unchanged (did not rename to `liftsUnits`) since it's the active lifting-session store and the field already semantically means "lift units" -- renaming would have forced touching `SetRow.tsx`, which is not in this plan's declared files and had no bug to fix.
- Made `ProfileReview.tsx`'s new bucket props optional with a fallback, rather than mandatory, to avoid touching `onboarding/review.tsx` and `settings/index.tsx` (neither declared in this plan) -- see key-decisions in frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended `commitSet.ts`'s `fetchProfileSummary` outside Task 1's declared files**
- **Found during:** Task 1 (re-keying index.tsx/finish.tsx/detail.tsx/share.tsx)
- **Issue:** All four Task 1 files source their profile data from `fetchProfileSummary(db)` (defined in `commitSet.ts`, not listed in Task 1's `<files>`), which only returned the single legacy `units` field. Task 1's action requires these files to read `runUnits`/`liftsUnits` independently, which the existing function couldn't provide.
- **Fix:** Extended `fetchProfileSummary`'s return type and select clause to include `liftsUnits`/`bodyweightUnits`/`runUnits` (each falling back to the legacy `units` value), matching the exact resolution discipline `useProfile.ts` already established in plan 09-01. `commitSet.ts` was already declared in Task 2's file list for this same underlying change, so this pulls that work one task earlier rather than duplicating it.
- **Files modified:** `apps/mobile/lib/commitSet.ts`
- **Verification:** `pnpm typecheck` (root `tsc --build`) passes; all four Task 1 consumer files compile against the extended return type
- **Committed in:** `6a28f4f` (Task 1 commit)

**2. [Rule 1 - Bug] Narrowed `ProfileReviewField` to exclude the new optional bucket fields**
- **Found during:** Task 2 (adding `bodyweightUnits`/`runUnits` to `ProfileReviewValues`)
- **Issue:** `ProfileReviewField` was defined as `keyof ProfileReviewValues`. Adding the two new optional fields widened that union, which broke `onboarding/review.tsx`'s `FIELD_ROUTE: Record<ProfileReviewField, Href>` map (a file not in this plan's declared scope) -- TypeScript now required `bodyweightUnits`/`runUnits` entries in a Record meant to map only editable onboarding-step rows to their edit route.
- **Fix:** Changed `ProfileReviewField` to `keyof Omit<ProfileReviewValues, 'bodyweightUnits' | 'runUnits'>` -- the two new fields are display-resolution inputs, not editable rows, so they were never meant to appear in that map.
- **Files modified:** `apps/mobile/components/onboarding/ProfileReview.tsx` (already declared for this task)
- **Verification:** `pnpm typecheck` exits 0
- **Committed in:** `200616b` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical / Rule 2, 1 blocking bug / Rule 1)
**Impact on plan:** Both necessary for the sweep to typecheck and for the four Task 1 consumers to actually resolve per-domain buckets. No scope creep -- neither deviation changes behavior outside this plan's D-01 unit-resolution surface, and no undeclared file's runtime behavior changed (only its type-level exhaustiveness contract).

## Issues Encountered
- The worktree had no `node_modules` installed (fresh worktree checkout); `pnpm install --frozen-lockfile` was required before `pnpm typecheck` or `pnpm -r test` would run. Resolved entirely from the shared pnpm store, no lockfile changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All nine files in this plan's `files_modified` frontmatter list are accounted for: eight were edited, `ExerciseCard.tsx` required zero changes (it already reads the correctly-sourced `sessionStore.units`, verified unchanged including the 09-03 "Remove exercise" affordance).
- `pnpm typecheck` (root `tsc --build`, cross-package) is clean. `pnpm -r test`: 298/298 pass (29 shared + 95 engine + 68 db + 106 mobile, including the sessionStore suite with no regressions).
- Grep acceptance confirmed: no display-read occurrence of `profile.units` remains in `index.tsx`, `finish.tsx`, `detail.tsx`, or `share.tsx`.
- The on-device imperial-lifts + km-runs proof (this plan's `<verification>` phase-gate line: 225 lb squats + 5 km runs with /km pace on the same day, across finish/detail/history/home) remains open until the beta-round build 10 UAT, consistent with 09-01's and 09-03's same carried-forward item.
- Two remaining unit-reading call sites noted in 09-01's Next Phase Readiness (`settings/index.tsx`, `onboarding/units.tsx`) were not in this plan's scope and are not addressed here -- confirm whether a later 09-xx plan owns them before the phase gate.

---
*Phase: 09-beta-feedback-round-1*
*Completed: 2026-08-05*
