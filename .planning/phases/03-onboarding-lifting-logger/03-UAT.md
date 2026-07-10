---
status: complete
phase: 03-onboarding-lifting-logger
source: [03-VERIFICATION.md]
started: 2026-07-09T22:20:00Z
updated: 2026-07-10T12:01:25Z
---

## Current Test

[testing complete]

## Tests

### 1. Rest timer on-device checks (LIFT-05, six behaviors)
expected: Banner counts down; +30s/Skip work; background notification fires at expiry; notification cancelled on early return; haptic+sound at zero; permission requested on FIRST timer use, not onboarding
result: pass

### 2. Exercise search and set logging tap counts (LIFT-01 / LIFT-02)
expected: Add-exercise → tap result (2 taps) selects an exercise; a pre-filled set commits in 1 tap (checkmark); a from-scratch set in ≤3 taps (load, RPE pre-selected, checkmark)
result: pass

### 3. Rest banner placement + live-HSS animation
expected: Banner renders as a persistent band pinned above the tab bar / below the sticky header (not a modal); live-HSS count-up animation is smooth; matches UI-SPEC
result: pass

### 4. Decimal load entry (CR-02 fix)
expected: Typing '62.5' into the SetRow load field commits 62.5 kg, not 625
result: pass

### 5. Crash-resume navigation (CR-03 fix)
expected: Kill app mid-workout, relaunch — Resume and Finish Now both navigate to the session/finish screen instead of landing on the default tab un-resumed
result: pass

### 6. Duplicate-workout prevention (WR-03 fix)
expected: Back-swipe out of an active session, tap Start Workout again — returns to the same open session, no second orphaned workout row
result: pass

### 7. Full onboarding walkthrough
expected: sex → bodyweight → units → threshold-hr → threshold-pace → review, both direct-entry and estimate paths; progress dots advance; soft-validation warns but never blocks; Save inserts profile and transitions to tab shell without relaunch
result: pass
note: Retested 2026-07-10 after quick-task fixes 260709-r4z (keyboard-safe WizardStep, units before bodyweight) and 260709-qmv/rq4 (design-system restyle). All onboarding behaviors pass. Original 2026-07-09 issue ("weight kg-only, keyboard covers Continue, UI is blue") resolved. New non-onboarding issue reported during retest — logged as Test 9.

### 9. Workout logging / add-set UI layout (reported during Test 7 retest)
expected: Session screen and set-logging UI render cleanly with UI-SPEC spacing
result: issue
reported: "while the color is correct the UI when adding sets and logging a workout is a little broken and spaced weird"
severity: minor

### 8. Settings edits apply forward-only + units toggle (ONB-02 / ONB-04)
expected: Edit bodyweight in Settings, log a new set — only future effective-load uses the new value, past committed sets unchanged; units toggle flips display without changing stored metric
result: pass

## Summary

total: 9
passed: 8
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Bodyweight input can be submitted — keyboard dismisses, Continue button reachable"
  status: resolved
  reason: "Fixed by quick task 260709-r4z (keyboard-safe WizardStep); confirmed in Test 7 retest 2026-07-10"
  severity: blocker
  test: 7
  root_cause: "WizardStep layout not keyboard-aware; no submit affordance on numeric keyboard"
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Bodyweight step respects unit selection (kg or lbs entry)"
  status: resolved
  reason: "Fixed by quick task 260709-r4z (units step moved before bodyweight); confirmed in Test 7 retest 2026-07-10"
  severity: major
  test: 7
  root_cause: "Units step originally ordered after bodyweight, so bodyweight defaulted to kg"
  artifacts: []
  missing: []
  debug_session: ""

- truth: "UI colors match the UI-SPEC design"
  status: resolved
  reason: "Fixed by quick tasks 260709-qmv + 260709-rq4 (Apsis dark design-system restyle); confirmed in Test 7 retest 2026-07-10"
  severity: cosmetic
  test: 7
  root_cause: "Default Expo/blue theme never replaced with Apsis design tokens"
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Session screen and set-logging UI render cleanly with UI-SPEC spacing"
  status: failed
  reason: "User reported: while the color is correct the UI when adding sets and logging a workout is a little broken and spaced weird"
  severity: minor
  test: 9
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
