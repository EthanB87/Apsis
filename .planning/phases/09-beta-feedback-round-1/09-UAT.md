---
status: complete
phase: 09-beta-feedback-round-1
source: [09-VERIFICATION.md]
started: 2026-08-05T03:50:04.838Z
updated: 2026-08-06T00:00:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Imperial lifts + km runs displays end to end (D-01 beta case): set Bodyweight/Runs to Mixed with imperial lifts + metric runs, log a 225 lb squat and a 5 km run on the same day, check TODAY/finish/detail/history/share.
expected: Lift volume/loads display in lb, run pace/distance display in /km, independently, on every surface.
result: pass

### 2. Rest-timer single-buzz: start a set, let rest begin, commit another set before rest ends without tapping Skip; repeat 3-4 times quickly.
expected: Only ONE rest notification ultimately fires — no back-to-back stale buzzes.
result: pass

### 3. Delete-exercise flow: add an exercise, commit 2-3 sets, tap the ExerciseCard '...' overflow, confirm Remove, verify the exercise disappears, live HSS drops, and reopening the session (kill + reopen) does not resurrect the removed exercise's sets.
expected: Exercise and its committed sets are gone from the UI and from SQLite after crash-resume.
result: pass

### 4. Session keyboard-safety: open a lifting session, tap a load field near the bottom of a long exercise list.
expected: The field scrolls above the keyboard (not hidden); a Done bar appears above the decimal pad and dismisses the keyboard; the rest-timer banner does not flicker/disappear while typing (regression check for the Phase 03 P10 rehydrate loop).
result: pass

### 5. FoodConfirmSheet conditional unit chips: open the sheet for a food WITH serving data (expect g/kg/oz/lb + tsp/tbsp/serving chips) and a food WITHOUT serving data (expect only g/kg/oz/lb).
expected: Conditional chips appear/disappear exactly per food.servingGrams presence; no fabricated units offered.
result: pass
note: "Owner request (deferred): count-based serving units for discrete foods, e.g. '1 egg', '1 pop tart'"

### 6. FoodConfirmSheet keyboard-safety + Done bar: with the keyboard open, confirm the quantity row, live macro preview, AND the volt Log button are all visible; type a value in oz then tap lb (number should reinterpret, macros recompute live); confirm whether a Done bar appears INSIDE the sheet (BottomSheetTextInput may not forward inputAccessoryViewID — known uncertainty) or whether the sheet's own keyboard config alone satisfies visibility + dismiss.
expected: Nothing is hidden by the keyboard; unit switching recomputes correctly; some dismiss affordance works (Done bar or sheet's own pan-down/tap-outside dismiss).
result: pass

### 7. Last-used unit default: log a food in a non-default unit (e.g. oz), then reopen the same food's confirm sheet.
expected: The sheet defaults to the last-used unit for that food, not the bodyweight-pref fallback.
result: pass

### 8. Quick-add / custom food / recipe-edit surfaces: confirm the Done bar appears on quick-add's decimal-pad macro fields, the chip row + Done bar appear on custom food's Serving-grams field, and the chip row + Done bar appear on newly-added recipe-edit ingredient rows (existing locked rows show no chip row).
expected: All described surfaces render correctly per D-10/D-13 scope.
result: pass
note: "Owner request (deferred): back button to previous page throughout the nutrition section"

### 9. Onboarding explainer placement + mechanics: start fresh onboarding (no profile) — the explainer must appear FIRST, before the sex step; three cards swipe with page dots; each renders its real component with sample data (volt HSS ring at 132 no count-up, amber readiness light, mini ATL/CTL trend); each card's 'THE MATH' toggle expands/collapses; Skip and the final card's 'Get started' both advance to the sex step.
expected: All described behaviors work as specified in D-15/D-16/D-17.
result: pass

### 10. Onboarding explainer Settings revisit: with a profile present, Settings -> Guide -> 'How Apsis works' opens the same three cards; Close/Done returns to Settings; the three 09-05 unit rows (Lifts/Bodyweight/Runs) still render/toggle correctly below the Profile section (regression check).
expected: The standalone /explainer route opens and returns correctly; no regression to the Settings unit rows.
result: pass

### 11. Explainer card copy review: read the drafted card copy (HSS/readiness/trend fronts + 'the math' expansions) for voice/accuracy against the athlete-direct mono register.
expected: Owner approves the copy or requests edits.
result: pass

### 12. Done bar on run form + onboarding bodyweight: open the run-log form and confirm the Done bar appears above the distance/duration decimal pads; open onboarding bodyweight and confirm the Done bar appears above its decimal pad.
expected: Both remaining D-13 call sites show the Done bar and dismiss the keyboard on tap; runUnits/bodyweightUnits behavior is unchanged.
result: pass

### 13. Onboarding Mixed-mode round trip: choose 'Mixed' at the onboarding units step, set imperial lifts + metric runs, complete onboarding, and confirm Settings shows the three rows reflecting exactly that choice.
expected: Settings' three rows (Lifts=imperial, Bodyweight=whatever chosen, Runs=metric) match the onboarding Mixed selections exactly.
result: pass

## Summary

total: 13
passed: 13
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

## Deferred Follow-Ups

- test: 5
  idea: "Foods where it makes sense should offer a quantity/count serving unit too — e.g. '1 egg', '1 pop tart'"
  deferred_at: 2026-08-05
- test: 8
  idea: "Back button to go to the previous page throughout the nutrition section"
  deferred_at: 2026-08-05
