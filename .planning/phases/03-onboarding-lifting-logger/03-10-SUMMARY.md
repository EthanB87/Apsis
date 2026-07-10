---
phase: 03-onboarding-lifting-logger
plan: 10
subsystem: ui
tags: [session-logger, set-row, design-overhaul, bottom-sheet, expo-router, notifications, react-native]

# Dependency graph
requires:
  - phase: 03-onboarding-lifting-logger (plan 11)
    provides: contract Spacing scale (md=12), typography conformance, tab-bar/input/segment styling
  - phase: 03-onboarding-lifting-logger (plans 01-09)
    provides: session logger (SetRow/ExerciseCard/session screen), commitSet, rest timer, crash-resume
provides:
  - Shipped "ledger" set-logging design (user-approved source of truth for the logging surface):
    tabular tap-to-type field rows (SET/KG-LB/REPS-SEC/RPE/LOG), no steppers, material-change
    committed state, grid-mirrored mono column headers, HUD session header
  - kgToDisplayLbFractional in @apsis/shared (exact 0.1-lb display round-trip)
  - Focus-gated session rehydrate + finished-workout guard (stale stacked screens inert)
  - Rest-notification background reschedule (cancel-on-foreground now has an inverse)
  - Picker sheet single-owner visibility (imperative ref only, idempotent select)
  - Void-styled tab headers; finish-screen volume respects unit preference
affects: [phase-04 (any surface consuming session components or DESIGN-SYSTEM.md applicability)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-owner sheet visibility: @gorhom/bottom-sheet index prop is initial-only; all
      open/close driven imperatively via ref, selections idempotent via per-open-cycle ref guard"
    - "useFocusEffect (not useEffect) for any screen effect that writes shared store state —
      expo-router keeps stacked screens mounted and their plain effects keep running"
    - "Paired OS-notification invariants: cancel-on-foreground must have a reschedule-on-
      background inverse (foregrounded => no pending notification; backgrounded + live timer
      => exactly one)"
    - "Local-text TextInput pattern (loadText/rpeText): raw text held locally during typing,
      parsed/clamped value written to store, display re-syncs on blur"

key-files:
  created: []
  modified:
    - apps/mobile/components/session/SetRow.tsx
    - apps/mobile/components/session/ExerciseCard.tsx
    - apps/mobile/components/session/ExercisePickerSheet.tsx
    - apps/mobile/components/session/LiveHssHeader.tsx
    - apps/mobile/components/session/RestTimerBanner.tsx
    - apps/mobile/app/(tabs)/log/session.tsx
    - apps/mobile/app/(tabs)/_layout.tsx
    - apps/mobile/app/session/finish.tsx
    - apps/mobile/stores/sessionStore.ts
    - apps/mobile/lib/notifications.ts
    - packages/shared/src/units.ts
    - packages/shared/src/__tests__/units.test.ts
    - .planning/phases/03-onboarding-lifting-logger/03-UI-SPEC.md

key-decisions:
  - "USER SUPERSEDED THE DESIGN CONTRACT at the on-device checkpoint: 'completely overhaul
    the UI — take full control and disregard any design docs. The only thing I want to keep
    is the color palette.' DESIGN-SYSTEM.md's component/sizing specs (steppers included) no
    longer govern the logging surface; §1 palette remains binding. Recorded in 03-UI-SPEC.md's
    amended Set-row bullet."
  - "Steppers removed entirely (coordinator recommendation, user-approved): tap-to-type
    tabular fields are the primary entry — typing 2 digits beats 8 stepper taps and stepper
    furniture was the root cause of every cramped/overflowing layout iteration"
  - "expo-router stacked-screen rehydrate mechanism: plain useEffect on session screens runs
    while UNFOCUSED; two mounted session screens oscillated the store (A<->B rehydrate loop),
    resurrecting the last finished workout and wiping rest-timer state every cycle. Fix:
    useFocusEffect + finished/discarded-workout guard that self-replaces stale screens"
  - "Rest-notification cancel-without-inverse invariant: D-26 early-return cancel fired on
    every foreground return, but nothing rescheduled on backgrounding — any foreground bounce
    mid-rest permanently destroyed the completion signal. Fix: ensureRestNotificationScheduled
    on every transition away from 'active' (idempotent, race-guarded)"
  - "kgToDisplayLbFractional added to @apsis/shared (nearest 0.1 lb) for ENTRY surfaces;
    kgToDisplayLb (whole-lb, D-12) retained for read-only summaries (LAST lines, volume)"

patterns-established:
  - "State-as-material committed styling: locked rows flatten field chrome (transparent/ash)
    while the volt LOG check carries the recorded state"
  - "Exported grid constants from the row component consumed by the header component so
    column labels can never drift from their columns"

requirements-completed: [LIFT-02, LIFT-03]

duration: ~5h wall clock (multi-checkpoint interactive session)
completed: 2026-07-10
status: complete
---

# Phase 03 Plan 10: Set-Logging UI Gap Closure + User-Directed Overhaul Summary

**Closed UAT Test 9 through an iterative on-device checkpoint loop that ended in a
user-mandated full redesign: the set logger shipped as a tabular tap-to-type "ledger"
(no steppers), plus root-cause fixes for a stacked-screen store-oscillation loop, a
rest-notification cancel-without-reschedule gap, fractional-lb display, and picker-sheet
dismissal.**

## Performance

- **Duration:** ~5h wall clock across 8 checkpoint rounds
- **Completed:** 2026-07-10
- **Tasks:** 2 planned tasks + 1 blocking human-verify checkpoint (approved after 6
  feedback/fix rounds)
- **Files modified:** 13

## Accomplishments

- **UAT Test 9 closed (user: "approved", "Looks great, love the design", "lift tracking
  is great"):** set rows render as one roomy tabular line each — SET (tap toggles amber W
  warmup) · KG/LB · REPS-or-SEC · RPE · LOG — every value a 44px tappable inset mono field
  opening the numeric keypad directly
- **Committed state as material change:** checking LOG persists + locks the set
  (editable={!locked}, D-09), flattens the row's field chrome to recorded ink, and fills
  the check volt; pending sets read as hot instruments
- **Fractional lb end-to-end:** 62.5 lb entry survives display and ±steps
  (kgToDisplayLbFractional in @apsis/shared, 4 new vitest cases)
- **Session stability:** finished workouts can no longer resurrect or loop (focus-gated
  rehydrate + finished-workout guard); rest notifications now survive foreground bounces
  (background reschedule); picker sheet dismisses on selection (single imperative owner,
  idempotent select)
- **Chrome conformance:** void/bone tab headers (stock white header eliminated), HUD
  session header with labeled ELAPSED / SESSION HSS readouts, finish-screen volume in the
  profile's units

## Task Commits

Planned tasks (pre-checkpoint):

1. **Task 1: SetRow compact-stepper rebuild** - `3efa377` (feat)
2. **Task 2: ExerciseCard alignment + column header + ghost add-set** - `6b5ff67` (feat)

Checkpoint-feedback arc (Task 3 blocking human-verify, 6 rounds to approval):

| Round | Commit | What |
|---|---|---|
| 1 | `f6f6424` | fix: fractional lb display/stepper round-trip (+ shared tests) |
| 1 | `bda2099` | fix: two-line fallback + exact header alignment + opaque row |
| 1 | `70c8545` | fix: void tab headers; hide doubled Settings header |
| 2 | `6ea8d0f` | feat: user-directed 38px steppers + full-width distribution |
| 3 | `61b6c55` | feat: mono LOG caption on commit control |
| 4 | `49d5325` | fix: picker sheet close-on-select (ref-driven) |
| 4 | `ef34aa8` | feat: full ledger redesign (user mandate, steppers removed) |
| 4 | `d2fd3de` | feat: instrument-HUD header + screen rhythm |
| 5 | `39dd786` | fix: picker single visibility owner (oscillation) |
| 6 | `db30dd1` | fix: focus-gated rehydrate + finished-workout guard (the real loop) |
| 6 | `b17b40b` | docs: defer mobile component-test harness gap |
| 7 | `855f249` | fix: finish-screen volume respects units |
| 7 | `0f4883a` | fix: rest-notification background reschedule + diagnostics |
| 8 | `88fde03` | chore: strip rest-diag logs after device verification |
| 8 | `019ad1a` | docs: UI-SPEC set-row amendment (shipped ledger design) |

Also: `669f186` (docs: STATE checkpoint pause record).

## Files Created/Modified

- `apps/mobile/components/session/SetRow.tsx` - fully redesigned ledger row (fields, no
  steppers), exported grid constants, opaque surface, all preserved behaviors
- `apps/mobile/components/session/ExerciseCard.tsx` - grid-mirrored mono column headers,
  card hierarchy, ghost add-set
- `apps/mobile/components/session/ExercisePickerSheet.tsx` - single-owner visibility,
  idempotent select, keyboard decoupling (blur+dismiss on close, no "restore")
- `apps/mobile/components/session/LiveHssHeader.tsx` - labeled HUD readouts
- `apps/mobile/components/session/RestTimerBanner.tsx` - background reschedule listener
- `apps/mobile/app/(tabs)/log/session.tsx` - useFocusEffect rehydrate + finished guard,
  screen rhythm, quiet add-exercise ghost
- `apps/mobile/app/(tabs)/_layout.tsx` - void/bone headers, Settings header hidden
- `apps/mobile/app/session/finish.tsx` - unit-aware volume lines
- `apps/mobile/stores/sessionStore.ts` - ensureRestNotificationScheduled action,
  reason-annotated cancels
- `apps/mobile/lib/notifications.ts` - graceful permission-denial warning, repeats:false,
  reasoned cancel API
- `packages/shared/src/units.ts` (+ tests) - kgToDisplayLbFractional
- `.planning/.../03-UI-SPEC.md` - Set-row bullet amended to shipped design + supersession chain

## Decisions Made

- User explicitly superseded DESIGN-SYSTEM.md component specs for the logging surface
  (palette-only constraint) — the shipped ledger design is the new source of truth there
- Steppers eliminated as primary entry; tap-to-type fields are faster (logging-speed
  constraint) and were the root cause of every layout failure
- Plain useEffect banned (by pattern) for store-writing screen effects — expo-router keeps
  stacked screens mounted; useFocusEffect is the correct gate
- OS-notification lifecycle treated as a paired invariant (cancel on foreground must have a
  reschedule on background)
- Whole-lb stays for read-only summaries (D-12); fractional lb only on entry surfaces

## Deviations from Plan

The plan's Task 1/2 design (compact steppers per DESIGN-SYSTEM.md) was executed as written,
then superseded during the checkpoint by explicit user direction — a sanctioned outcome of
the blocking human-verify gate, not scope creep. Additional fixes discovered during
verification (all Rule 1/2/3, committed atomically): fractional lb (T-03-23 adjacent),
picker dismissal + oscillation, finished-workout rehydrate loop, notification reschedule
gap, volume units, void tab headers. The plan's stepper-referencing automated gates were
adapted to the new invariants (zero stepper code refs, mono valueField, clampRpe present,
editable={!locked} count) with always-true gates retained (zero flexWrap, tsc clean,
addSetRow free of marginHorizontal/dashed).

## Issues Encountered

- Two pre-existing router.push typed-route tsc errors remain (deferred-items.md, untouched)
- apps/mobile has no component-test harness, so the stacked-screen rehydrate regression
  could not get an off-device test — logged to deferred-items.md
- The `49d5325` picker fix initially introduced a two-owner visibility race (fixed in
  `39dd786`); the deeper "looping" report turned out to be the separate stacked-screen
  store oscillation (`db30dd1`)

## User Setup Required

None — notification permission is requested lazily on first rest-timer use (denial now
logs a graceful warning; the in-app countdown still works).

## Next Phase Readiness

- The logging surface is user-approved and stable across multi-workout sessions
- Phase 4 surfaces (Home HUD, run logging, trends) should treat DESIGN-SYSTEM.md §1 palette
  as binding and the shipped ledger components as the interaction precedent for data entry
- LIFT-05's six on-device rest-timer behaviors were exercised during this plan's checkpoint
  re-tests (banner countdown, background notification, early-return cancel, +30s) — formal
  UAT sign-off still rides the phase-level UAT

## Self-Check: PASSED

SUMMARY.md on disk; all 17 referenced commits verified present in git log.
