---
status: testing
phase: 04-run-logger-home-dashboard
source: [04-VERIFICATION.md]
started: 2026-07-10T23:55:00Z
updated: 2026-07-10T23:55:00Z
---

## Current Test

number: 1
name: Delete-then-view regression (CR-02)
expected: |
  After deleting the only session of a day via History's swipe-to-delete, TODAY shows
  the empty/0 readiness state — no stale HSS or band from the deleted session.
awaiting: user response

## Tests

### 1. Delete-then-view regression (CR-02)
expected: Log a run or lift session, confirm it appears on TODAY with a live HSS/readiness band, delete it via History's swipe-to-delete, return to TODAY. TODAY shows the empty/0 readiness state — no stale HSS or band from the deleted session.
result: [pending]

### 2. Earliest-session delete regression (CR-02 range-shrink path)
expected: With finished sessions spanning several days, delete the earliest one via History. The 28-day trend chart and History no longer show a stale value for the removed day; no row for that date lingers outside the newly re-anchored range.
result: [pending]

### 3. Scrub tooltip renders without crashing (CR-01)
expected: On the home screen's 28-day trend chart, drag a finger across it. A hairline cursor and tooltip appear, snap to the nearest day, and show "<DATE> · HSS <n> · ATL <n> · CTL <n> · TSB <±n>" without a red-screen crash.
result: [pending]

### 4. iOS date picker open/close (WR-05, lower priority)
expected: On the run entry form, tap the date row (opens the iOS picker), select a date (should close), re-tap the row (should toggle closed). The picker never stays permanently mounted; future dates remain unselectable (maximumDate).
result: [pending]

### 5. Ring count-up + capped-fill animation (carried forward)
expected: Finish a run/lift with HSS > 200 and one with HSS < 200. The ring number always shows the exact rounded HSS; the volt arc caps at a full circle only when HSS ≥ 200.
result: [pending]

### 6. Calibrating hero <14 days (carried forward)
expected: Fresh install, log fewer than 14 days of sessions. Steel ring + PlateOrbit + "BUILDING TREND · DAY N/14", ReadinessLight absent, chart shows only real days.
result: [pending]

### 7. Double-session day math (carried forward)
expected: Log two sessions on the same day. History's "N SESSIONS · ADJUSTED" chip and "DAY TOTAL X · INCL. +Y DOUBLE-DAY LOAD" line show the correct, engine-derived Y.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
