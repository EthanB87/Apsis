---
status: testing
phase: 05-healthkit-integration
source: [05-VERIFICATION.md]
started: 2026-07-12T04:30:00Z
updated: 2026-07-12T04:30:00Z
---

## Current Test

number: 1
name: CR-01 fix — dedupe classifies by provenance, not uuid nullability (HK-03)
expected: |
  The watch/Health sample does NOT import as a second Apsis session — the manual row
  (source='manual' with its own write-back healthkitUuid) is still recognized as a manual
  duplicate via source classification. Day HSS must not double-count.
awaiting: user response

## Tests

### 1. CR-01 fix — dedupe classifies by provenance, not uuid nullability (HK-03)
expected: On a physical device with HealthKit connected, log a manual run in Apsis (which writes back to Health and stores its own uuid on the row), then let a same-day Health workout of similar duration sync in (Apple Watch workout, or manually add a workout sample in the Health app). The Health sample does NOT import as a second Apsis session; day HSS does not double-count.
result: [pending]

### 2. CR-02 fix — bodyweightSetAt stamped on every manual bodyweight write (HK-02)
expected: Fresh onboarding — enter bodyweight, connect HealthKit immediately after — a stale HK body-mass sample does NOT overwrite the just-entered value. Separately, edit bodyweight in Settings after a prior HK import — an HK sample older than the edit does not overwrite it on the next foreground sync. Only an HK sample newer than the last manual edit may win.
result: [pending]

### 3. CR-03 fix — retried initial sync stays bounded to the 90-day window (HK-01/HK-03)
expected: Force an initial sync to fail partway (airplane mode mid-sync, or kill the app during the first 90-day import), relaunch, and let the foreground sync retry. The retry imports only workouts from the last 90 days — never the entire HealthKit history.
result: [pending]

### 4. HK-04 — write-back, delete-sync, idempotency, back-dated timestamps (first-ever device check)
expected: A saved lift/run appears in the Health app with correct distance/duration and an ApsisHSS metadata key (no calories). Discarding an Apsis-authored session removes that sample from Health; an imported session's sample is left untouched. Re-tapping Done / crash-resume "Finish Now" does not create a duplicate Health sample (WR-07). A back-dated run lands on the logged calendar day in Health, not today (WR-08).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

## Notes

All four tests MUST be run on a fresh EAS dev build compiled from current master
(including review-fix commits 6adae75..2b28633) — NOT the stale 694ca7a8 build,
which predates every review fix.
