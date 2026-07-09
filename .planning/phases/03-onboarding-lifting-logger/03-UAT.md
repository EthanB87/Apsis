---
status: testing
phase: 03-onboarding-lifting-logger
source: [03-VERIFICATION.md]
started: 2026-07-09T22:20:00Z
updated: 2026-07-09T22:20:00Z
---

## Current Test

number: 1
name: Rest timer on-device checks (LIFT-05, six behaviors)
expected: |
  Banner counts down, +30s/Skip work, background notification fires and is
  cancelled on early return, haptic+sound fire at zero, permission requested
  on first timer use not onboarding
awaiting: user response

## Tests

### 1. Rest timer on-device checks (LIFT-05, six behaviors)
expected: Banner counts down; +30s/Skip work; background notification fires at expiry; notification cancelled on early return; haptic+sound at zero; permission requested on FIRST timer use, not onboarding
result: [pending]

### 2. Exercise search and set logging tap counts (LIFT-01 / LIFT-02)
expected: Add-exercise → tap result (2 taps) selects an exercise; a pre-filled set commits in 1 tap (checkmark); a from-scratch set in ≤3 taps (load, RPE pre-selected, checkmark)
result: [pending]

### 3. Rest banner placement + live-HSS animation
expected: Banner renders as a persistent band pinned above the tab bar / below the sticky header (not a modal); live-HSS count-up animation is smooth; matches UI-SPEC
result: [pending]

### 4. Decimal load entry (CR-02 fix)
expected: Typing '62.5' into the SetRow load field commits 62.5 kg, not 625
result: [pending]

### 5. Crash-resume navigation (CR-03 fix)
expected: Kill app mid-workout, relaunch — Resume and Finish Now both navigate to the session/finish screen instead of landing on the default tab un-resumed
result: [pending]

### 6. Duplicate-workout prevention (WR-03 fix)
expected: Back-swipe out of an active session, tap Start Workout again — returns to the same open session, no second orphaned workout row
result: [pending]

### 7. Full onboarding walkthrough
expected: sex → bodyweight → units → threshold-hr → threshold-pace → review, both direct-entry and estimate paths; progress dots advance; soft-validation warns but never blocks; Save inserts profile and transitions to tab shell without relaunch
result: [pending]

### 8. Settings edits apply forward-only + units toggle (ONB-02 / ONB-04)
expected: Edit bodyweight in Settings, log a new set — only future effective-load uses the new value, past committed sets unchanged; units toggle flips display without changing stored metric
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
