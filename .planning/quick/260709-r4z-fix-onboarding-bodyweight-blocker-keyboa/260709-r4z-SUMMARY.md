---
phase: 260709-r4z
plan: 01
subsystem: onboarding
tags: [onboarding, keyboard, ux, wizard, units]
status: complete
dependency-graph:
  requires: []
  provides:
    - WizardStep keyboard-safe chrome (KeyboardAvoidingView + tap-to-dismiss)
    - Reordered wizard step sequence (sex -> units -> bodyweight -> threshold-hr -> threshold-pace -> review)
  affects:
    - apps/mobile/components/onboarding/WizardStep.tsx
    - apps/mobile/lib/onboardingDraft.ts
    - apps/mobile/app/onboarding/sex.tsx
    - apps/mobile/app/onboarding/units.tsx
    - apps/mobile/app/onboarding/bodyweight.tsx
tech-stack:
  added: []
  patterns:
    - "KeyboardAvoidingView wraps both content and pinned CTA button so behavior='padding' lifts the button, not just the content"
    - "flex:1 Pressable with accessible={false} around a content region gives tap-outside-to-dismiss without stealing touches from child inputs/buttons"
key-files:
  created: []
  modified:
    - apps/mobile/components/onboarding/WizardStep.tsx
    - apps/mobile/lib/onboardingDraft.ts
    - apps/mobile/app/onboarding/sex.tsx
    - apps/mobile/app/onboarding/units.tsx
    - apps/mobile/app/onboarding/bodyweight.tsx
decisions:
  - "WizardStep fix applied centrally (shared chrome) rather than per-screen, since bodyweight/threshold-hr/threshold-pace all render through it"
  - "Wizard order fixed by moving 'units' before 'bodyweight' in WIZARD_STEP_ORDER + the three router.push targets, rather than adding unit-handling logic to bodyweight.tsx (which already fully supported imperial entry/canonical-kg storage per D-05 - it just never had units set in time)"
  - "review.tsx's FIELD_ROUTE map and threshold-pace.tsx left untouched - both are order-independent and already correct against the new sequence"
metrics:
  duration: ~15min
  completed: 2026-07-09
---

# Quick Task 260709-r4z: Fix onboarding bodyweight blocker (keyboard trap + kg-only entry) Summary

Fixed the Phase-3 UAT test-7 blocker: numeric onboarding steps trapped users behind an
uncommittable keyboard, and bodyweight entry was locked to kg regardless of unit preference.

## What Was Built

**Task 1 — Keyboard-safe WizardStep** (`apps/mobile/components/onboarding/WizardStep.tsx`):
Wrapped the existing content container and the pinned Continue `Pressable` inside a single
`KeyboardAvoidingView` (`behavior: Platform.OS === 'ios' ? 'padding' : undefined`) so the
Continue button lifts above the `decimal-pad`/`number-pad` keyboard on iOS instead of being
covered by it (those keyboard types have no native Done key on iOS, so without this fix there
was no way to advance). Added a second escape route: the content region is now wrapped in a
`flex:1 Pressable` with `accessible={false}` whose `onPress` calls `Keyboard.dismiss()`, so
tapping empty space dismisses the keyboard while taps on child TextInputs and the Continue
button (a sibling, outside this Pressable) still behave normally. No visual/style changes —
purely a structural wrapper change; this is shared chrome so bodyweight, threshold-hr, and
threshold-pace all inherit the fix automatically.

**Task 2 — Reordered wizard (units before bodyweight)** (`apps/mobile/lib/onboardingDraft.ts`,
`sex.tsx`, `units.tsx`, `bodyweight.tsx`): Root cause of the kg-only bug was that `draft.units`
was captured on the units step, which ran AFTER bodyweight, so bodyweight always rendered
against the default `units: 'metric'`. `bodyweight.tsx` already had full imperial-entry support
(`kgToDisplayLb`/`lbToKgExact`) and canonical-kg storage per D-05 — it simply never saw the
user's unit choice in time. Fixed with four surgical edits:
1. `WIZARD_STEP_ORDER` reordered to `['sex', 'units', 'bodyweight', 'threshold-hr', 'threshold-pace', 'review']` — this single array drives progress-dot position everywhere, so dots update automatically.
2. `sex.tsx` now pushes to `/onboarding/units` (was `/onboarding/bodyweight`).
3. `units.tsx` now pushes to `/onboarding/bodyweight` (was `/onboarding/threshold-hr`).
4. `bodyweight.tsx` now pushes to `/onboarding/threshold-hr` (was `/onboarding/units`).

`review.tsx`'s `FIELD_ROUTE` tap-to-edit map and `threshold-pace.tsx` (which already reads
`draft.units`) were left untouched — both are order-independent and remain correct against the
new sequence. Trivial step-number header comments in `units.tsx` (3 of 6 -> 2 of 6) and
`bodyweight.tsx` (2 of 6 -> 3 of 6) were updated to match.

## Verification Performed (Automated)

- `npm run typecheck` (root, `tsc --build`) run after each task: only the two pre-existing,
  documented `Href` errors remain (`apps/mobile/app/onboarding/review.tsx:34` and
  `apps/mobile/components/ExternalLink.tsx:11`), unrelated to this change and carried forward
  from quick task 260709-qmv's deferred-items list. No new type errors introduced.
- Confirmed via grep that `review.tsx`'s `FIELD_ROUTE` map and `threshold-hr.tsx` /
  `threshold-pace.tsx` route references require no changes (order-independent / already
  pointing at the correct next step).

## Deviations from Plan

None - plan executed exactly as written (two code tasks only; Task 3 is the on-device
checkpoint, handled below per orchestrator instruction rather than blocking).

## Human-Verify Items (Deferred to Phase 3 UAT)

Task 3 in the plan is a `checkpoint:human-verify` gate requiring an on-device/simulator pass
that cannot be performed by the executor. Per orchestrator instruction, these items are
recorded here as pending phase-UAT items instead of blocking this quick task:

1. Fresh-onboard: Sex -> Continue -> Units now appears SECOND -> pick "Imperial".
2. Bodyweight step: unit label reads "lb" (not "kg"), numeric keyboard opens, Continue button
   is visible above the keyboard (not covered).
3. Tap an empty area of the bodyweight screen -> keyboard dismisses.
4. Type a bodyweight, tap Continue -> advances to threshold-hr; progress dots show step 3 of 6.
5. On threshold-hr and threshold-pace (same numeric keyboard), Continue remains reachable and
   tap-to-dismiss works.
6. Reach review, Save -> profile persists, app transitions to the tab shell.
7. Regression check: re-enter bodyweight via review's tap-to-edit -> previously entered value
   is still seeded (WR-08 intact).

These map to requirement `UAT-03-T7` (Phase-3 UAT test 7 blocker), which remains open until a
human confirms the above on a device or simulator.

## Self-Check: PASSED

- FOUND: apps/mobile/components/onboarding/WizardStep.tsx
- FOUND: apps/mobile/lib/onboardingDraft.ts
- FOUND: apps/mobile/app/onboarding/sex.tsx
- FOUND: apps/mobile/app/onboarding/units.tsx
- FOUND: apps/mobile/app/onboarding/bodyweight.tsx
- FOUND: commit bdd1465 (Task 1)
- FOUND: commit 3fbc13c (Task 2)
