---
phase: 09-beta-feedback-round-1
plan: 05
subsystem: onboarding-settings
tags: [expo-router, zustand, units, onboarding, settings]

# Dependency graph
requires:
  - "09-01: user_profile.liftsUnits/bodyweightUnits/runUnits columns, settingsStore three-bucket shape, useProfile.ts ProfileValues/ProfileUpdateInput extension"
provides:
  - "onboardingDraft.ts three-bucket draft shape (liftsUnits/bodyweightUnits/runUnits) + setAllUnits single-choice convenience"
  - "onboarding units.tsx Mixed path (three inline bucket toggles) alongside the fast Metric/Imperial choice"
  - "useSaveProfile.ts SaveProfileInput with the three unit fields; onboarding insert writes all three columns + legacy units anchor"
  - "Settings three always-visible unit rows (Lifts/Bodyweight/Runs), each independently persisted via useProfile.update"
affects: []

actuals:
  tokens: 5330
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Onboarding fast-path/Mixed-path split: two one-tap options (Metric/Imperial) call a setAllUnits convenience; a third Mixed option reveals independent per-domain toggles, all backed by the same three-bucket draft"
    - "Settings bucket rows read directly from useProfile's already-hydrated profile.<bucket> and write back through useProfile.update({ <bucket> }) — no local optimistic state needed, since useProfile.update only commits on UPDATE success"

key-files:
  created: []
  modified:
    - apps/mobile/lib/onboardingDraft.ts
    - apps/mobile/app/onboarding/units.tsx
    - apps/mobile/app/onboarding/bodyweight.tsx
    - apps/mobile/app/onboarding/threshold-pace.tsx
    - apps/mobile/app/onboarding/review.tsx
    - apps/mobile/hooks/useSaveProfile.ts
    - "apps/mobile/app/(tabs)/settings/index.tsx"

key-decisions:
  - "onboardingDraft's single `units` field removed entirely (not kept alongside the three buckets) — every consumer (units.tsx, bodyweight.tsx, threshold-pace.tsx, review.tsx) was re-keyed to its correct bucket in the same commit, so no stale single-value field could drift out of sync"
  - "useSaveProfile's legacy `units` column write derives from `input.liftsUnits` (not a separate passed-in value) — this is correct for both the single-choice fast path (all three buckets equal) and the Mixed path (D-04's documented anchor rule: mirror liftsUnits)"
  - "review.tsx's ProfileReview `values.units` prop (the shared component's own summary row) is fed `draft.liftsUnits` for the same reason — ProfileReview.tsx itself was left untouched (out of this plan's declared file scope; PATTERNS.md/09-01-SUMMARY.md assign that consumer re-key to 09-04)"
  - "Settings' three new bucket rows read/write directly against `profile.<bucket>`/`useProfile.update`, NOT through the existing local `draft`/ProfileReview batch-edit staging area — units are single-value toggles that apply instantly, matching the pre-existing rest-timer-preset pattern in the same file, not the sex/bodyweight/HR/pace numeric review batch"
  - "The existing ProfileReview-embedded 'Units' row (rendered inside the Profile section, tapping still calls the pre-existing handleUnitsChange -> update({ units })) was intentionally left in place — it only writes the legacy anchor column, ProfileReview.tsx is out of this plan's declared scope, and removing/hiding that row would require modifying the shared component that 09-04 (a parallel wave-2 plan) owns"

patterns-established:
  - "handleBucketUnitsChange(bucket, next): a switch-typed dispatcher (not a computed-property object literal) to avoid the TS inference pitfall where `{ [unionKey]: value }` widens to a record of all union keys instead of exactly one"

requirements-completed: [D-02, D-03, D-04]  # D-01 already completed by 09-01 (schema/store spine); phase-local CONTEXT.md decision codes, not REQUIREMENTS.md REQ-IDs — requirements.mark-complete no-ops on these.

coverage:
  - id: T1
    description: "onboardingDraft.ts split into liftsUnits/bodyweightUnits/runUnits with individual setters + setAllUnits; units.tsx Metric/Imperial call setAllUnits, Mixed reveals three inline toggles; bodyweight.tsx/threshold-pace.tsx re-keyed to their bucket; useSaveProfile.ts writes all three columns + legacy units anchor (mirrors liftsUnits)"
    requirement: "D-02, D-04"
    verification:
      - kind: other
        ref: "pnpm typecheck (root tsc --build, cross-package)"
        status: pass
      - kind: other
        ref: "pnpm -r test (298 tests: 29 shared + 95 engine + 68 db + 106 mobile) — no regressions from the draft-shape change"
        status: pass
    human_judgment: true
    rationale: "No automated test exercises the Mixed-path UI interaction itself (only static typecheck + the pre-existing unrelated test suites) — this plan's own <verification> section defers the on-device imperial-lifts+km-runs proof to the phase gate / build 10 UAT, same as 09-01's tracer."
  - id: T2
    description: "settings/index.tsx: single combined Units toggle row replaced with three always-visible rows (Lifts/Bodyweight/Runs), each reading profile.<bucket> and writing via useProfile.update({ <bucket> })"
    requirement: "D-03"
    verification:
      - kind: other
        ref: "pnpm typecheck (root tsc --build, cross-package)"
        status: pass
      - kind: unit
        ref: "grep confirms liftsUnits/bodyweightUnits/runUnits update calls present in settings/index.tsx; no remaining choiceRow-based single Units section"
        status: pass
    human_judgment: true
    rationale: "Same as T1 — the plan's own <verification> section defers the on-device 'Settings shows the three rows reflecting the choice' proof to the phase gate/build 10 UAT."
---

# Phase 9 Plan 5: Onboarding & Settings Units-Split Consumer Sweep Summary

**Onboarding now offers a fast single Metric/Imperial choice OR a Mixed path with three independent Lifts/Bodyweight/Runs toggles, and Settings replaces the single Units row with three always-visible, independently-persisted rows — completing the D-01..D-04 units-split user-facing surface on top of 09-01's schema/store spine.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2
- **Files modified:** 7
- **Tests:** `pnpm typecheck` clean; `pnpm -r test` 298/298 passing (29 shared + 95 engine + 68 db + 106 mobile)

## Accomplishments
- Split `onboardingDraft.ts`'s single `units` field into `liftsUnits`/`bodyweightUnits`/`runUnits` (default `'metric'`), each with its own setter, plus a `setAllUnits(u)` convenience that sets all three at once for the fast single-choice path
- Rebuilt `units.tsx`: Metric and Imperial remain one-tap options (now calling `setAllUnits`); added a third Mixed option that reveals three inline bone-active-fill toggles — Lifts, Bodyweight, Runs — each independently metric/imperial
- Re-keyed `bodyweight.tsx` to read `draft.bodyweightUnits` and `threshold-pace.tsx` to read `draft.runUnits`, so each screen's display/entry unit now tracks its own bucket instead of the removed single `units` field
- Extended `useSaveProfile.ts`'s `SaveProfileInput` with `liftsUnits`/`bodyweightUnits`/`runUnits`; the onboarding insert now writes all three columns plus the legacy `units` column (mirroring `liftsUnits` as the D-04 rollback anchor, correct for both the fast path and Mixed)
- Updated `review.tsx` to pass the three buckets to `save()` and `draft.liftsUnits` as the legacy-anchor value for `ProfileReview`'s existing single-value display row
- Replaced Settings' single combined Units toggle row with three always-visible rows (Lifts kg/lb, Bodyweight kg/lb, Runs km/mi), each reading `profile.<bucket>` directly and persisting via `useProfile.update({ liftsUnits | bodyweightUnits | runUnits })`, which also hydrates `settingsStore`'s matching bucket (09-01 wiring) — shown unconditionally, never behind a Mixed toggle

## Task Commits

Each task was committed atomically:

1. **Task 1: Onboarding draft split + Mixed units step + draft-consumer re-key + save path** - `f745f57` (feat)
2. **Task 2: Settings — three always-visible unit rows (D-03)** - `b2d69e2` (feat)

_Note: no plan-metadata commit in worktree mode — the orchestrator commits STATE.md/ROADMAP.md centrally after the wave merges._

## Files Created/Modified
- `apps/mobile/lib/onboardingDraft.ts` - Three-bucket draft shape (`liftsUnits`/`bodyweightUnits`/`runUnits`) + individual setters + `setAllUnits` convenience; single `units` field removed
- `apps/mobile/app/onboarding/units.tsx` - Metric/Imperial/Mixed mode selector; Mixed reveals three inline `UnitBucketRow` toggles
- `apps/mobile/app/onboarding/bodyweight.tsx` - Re-keyed to `draft.bodyweightUnits`
- `apps/mobile/app/onboarding/threshold-pace.tsx` - Re-keyed to `draft.runUnits`
- `apps/mobile/app/onboarding/review.tsx` - `save()` call passes the three buckets; `ProfileReview` values prop's `units` fed from `draft.liftsUnits`
- `apps/mobile/hooks/useSaveProfile.ts` - `SaveProfileInput` gains the three unit fields; insert writes all three columns + legacy `units` anchor (mirrors `liftsUnits`)
- `apps/mobile/app/(tabs)/settings/index.tsx` - Single combined Units row replaced with three independent `UnitsRow` components (Lifts/Bodyweight/Runs), each backed by `handleBucketUnitsChange`; dead `choiceRow` style removed

## Decisions Made
- Removed `onboardingDraft.ts`'s single `units` field entirely rather than keeping it alongside the three buckets, re-keying every consumer in the same commit so no stale single-value field could drift
- `useSaveProfile`'s legacy `units` column write derives from `input.liftsUnits` (not a separately-passed value) — correct for both the fast single-choice path (all three buckets equal) and Mixed (D-04's documented anchor rule)
- Left the pre-existing `ProfileReview`-embedded "Units" row inside Settings' Profile section untouched (still writes only the legacy `units` column via the pre-existing `handleUnitsChange`) — `ProfileReview.tsx` is not in this plan's declared file scope; per `09-PATTERNS.md`/`09-01-SUMMARY.md`'s consumer-sweep list, that shared component's re-key is owned by 09-04, a parallel wave-2 plan. Modifying it here risked a worktree merge collision with that plan's own edits.
- `handleBucketUnitsChange` uses an explicit `switch` (not a computed-property `{ [bucket]: next }` object literal) to avoid a TypeScript inference pitfall where a union-typed computed key widens to a record covering all three keys instead of exactly one

## Deviations from Plan

None - plan executed exactly as written for both tasks' declared file scope.

## Issues Encountered

- The worktree had no `node_modules` (fresh checkout, matching 09-01's same finding) — ran `pnpm install --frozen-lockfile` before `pnpm typecheck` would run; resolved entirely from the shared pnpm store, no lockfile changes.
- Settings' Profile section still contains a residual "Units" row (rendered by the unmodified `ProfileReview` component) that toggles only the legacy `units` anchor column, separate from the three new bucket rows below it. This is out of this plan's scope (see Decisions Made) and is expected to be resolved by 09-04's `ProfileReview.tsx` re-key. Flagged here for phase-gate visibility, not treated as a blocker for this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Onboarding and Settings now both offer the full D-01..D-04 units-split surface: onboarding's fast Metric/Imperial + Mixed path, and Settings' three independently-persisted rows.
- `pnpm typecheck` and `pnpm -r test` (298 tests across shared/engine/db/mobile) are both green on this worktree's HEAD.
- Residual `ProfileReview`-embedded legacy Units row in Settings (see Issues Encountered) should be reconciled once 09-04's consumer sweep lands — likely by hiding/removing that row from the Settings instance of `ProfileReview` or removing the field from the shared component's row list.
- The on-device Mixed-mode proof (choose Mixed in onboarding with imperial lifts + km runs, confirm Settings reflects it) remains open until the beta-round build 10 UAT, matching the plan's own `<verification>` phase-gate line.

---
*Phase: 09-beta-feedback-round-1*
*Completed: 2026-08-05*
