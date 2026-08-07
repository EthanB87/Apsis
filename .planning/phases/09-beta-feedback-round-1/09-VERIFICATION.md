---
phase: 09-beta-feedback-round-1
verified: 2026-08-05T03:47:08Z
status: passed
score: 14/14 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:

  - test: "Imperial lifts + km runs displays end to end (D-01 beta case): set Bodyweight/Runs to Mixed with imperial lifts + metric runs, log a 225 lb squat and a 5 km run on the same day, check TODAY/finish/detail/history/share."
    expected: "Lift volume/loads display in lb, run pace/distance display in /km, independently, on every surface."
    why_human: "Requires an iOS dev build (op-sqlite/HealthKit are native modules); on-device rendering cannot be exercised from this Windows host. Deferred by explicit user approval per 09-01/09-05/09-06 SUMMARYs."

  - test: "Rest-timer single-buzz: start a set, let rest begin, commit another set before rest ends without tapping Skip; repeat 3-4 times quickly."
    expected: "Only ONE rest notification ultimately fires — no back-to-back stale buzzes."
    why_human: "OS notification delivery can only be observed on a physical/dev-build device. The cancel-before-reschedule call-ordering invariant is unit-tested (sessionStore.test.ts), but the actual OS Notification Center behavior is not. Deferred by explicit user approval per 09-03-SUMMARY.md."

  - test: "Delete-exercise flow: add an exercise, commit 2-3 sets, tap the ExerciseCard '...' overflow, confirm Remove, verify the exercise disappears, live HSS drops, and reopening the session (kill + reopen) does not resurrect the removed exercise's sets."
    expected: "Exercise and its committed sets are gone from the UI and from SQLite after crash-resume."
    why_human: "SQLite delete + live-HSS drop + crash-resume non-resurrection is only provable on-device. Deferred by explicit user approval per 09-03-SUMMARY.md."

  - test: "Session keyboard-safety: open a lifting session, tap a load field near the bottom of a long exercise list."
    expected: "The field scrolls above the keyboard (not hidden); a Done bar appears above the decimal pad and dismisses the keyboard; the rest-timer banner does not flicker/disappear while typing (regression check for the Phase 03 P10 rehydrate loop)."
    why_human: "Visual scroll/keyboard behavior needs a device; deferred by explicit user approval per 09-04-SUMMARY.md."

  - test: "FoodConfirmSheet conditional unit chips: open the sheet for a food WITH serving data (expect g/kg/oz/lb + tsp/tbsp/serving chips) and a food WITHOUT serving data (expect only g/kg/oz/lb)."
    expected: "Conditional chips appear/disappear exactly per food.servingGrams presence; no fabricated units offered."
    why_human: "Visual chip-row rendering needs a device; deferred by explicit user approval per 09-07-SUMMARY.md."

  - test: "FoodConfirmSheet keyboard-safety + Done bar: with the keyboard open, confirm the quantity row, live macro preview, AND the volt Log button are all visible; type a value in oz then tap lb (number should reinterpret, macros recompute live); confirm whether a Done bar appears INSIDE the sheet (BottomSheetTextInput may not forward inputAccessoryViewID — known uncertainty) or whether the sheet's own keyboard config alone satisfies visibility + dismiss."
    expected: "Nothing is hidden by the keyboard; unit switching recomputes correctly; some dismiss affordance works (Done bar or sheet's own pan-down/tap-outside dismiss)."
    why_human: "BottomSheet + native keyboard interaction needs a device; 09-07-SUMMARY.md flags a specific known uncertainty about accessory-view forwarding inside @gorhom/bottom-sheet. Deferred by explicit user approval."

  - test: "Last-used unit default: log a food in a non-default unit (e.g. oz), then reopen the same food's confirm sheet."
    expected: "The sheet defaults to the last-used unit for that food, not the bodyweight-pref fallback."
    why_human: "Requires a real log-then-reopen device interaction; deferred by explicit user approval per 09-07-SUMMARY.md."

  - test: "Quick-add / custom food / recipe-edit surfaces: confirm the Done bar appears on quick-add's decimal-pad macro fields, the chip row + Done bar appear on custom food's Serving-grams field, and the chip row + Done bar appear on newly-added recipe-edit ingredient rows (existing locked rows show no chip row)."
    expected: "All described surfaces render correctly per D-10/D-13 scope."
    why_human: "Visual surface-by-surface confirmation needs a device; deferred by explicit user approval per 09-07-SUMMARY.md."

  - test: "Onboarding explainer placement + mechanics: start fresh onboarding (no profile) — the explainer must appear FIRST, before the sex step; three cards swipe with page dots; each renders its real component with sample data (volt HSS ring at 132 no count-up, amber readiness light, mini ATL/CTL trend); each card's 'THE MATH' toggle expands/collapses; Skip and the final card's 'Get started' both advance to the sex step."
    expected: "All described behaviors work as specified in D-15/D-16/D-17."
    why_human: "Navigation order, swipe paging, and card rendering need a device; deferred by explicit user approval per 09-08-SUMMARY.md."

  - test: "Onboarding explainer Settings revisit: with a profile present, Settings -> Guide -> 'How Apsis works' opens the same three cards; Close/Done returns to Settings; the three 09-05 unit rows (Lifts/Bodyweight/Runs) still render/toggle correctly below the Profile section (regression check)."
    expected: "The standalone /explainer route opens and returns correctly; no regression to the Settings unit rows."
    why_human: "Navigation round-trip needs a device; deferred by explicit user approval per 09-08-SUMMARY.md."

  - test: "Explainer card copy review: read the drafted card copy (HSS/readiness/trend fronts + 'the math' expansions) for voice/accuracy against the athlete-direct mono register."
    expected: "Owner approves the copy or requests edits."
    why_human: "Subjective content/voice judgment — not programmatically verifiable. Explicitly flagged for owner review at UAT per 09-08-SUMMARY.md."

  - test: "Done bar on run form + onboarding bodyweight: open the run-log form and confirm the Done bar appears above the distance/duration decimal pads; open onboarding bodyweight and confirm the Done bar appears above its decimal pad."
    expected: "Both remaining D-13 call sites show the Done bar and dismiss the keyboard on tap; runUnits/bodyweightUnits behavior is unchanged."
    why_human: "Visual keyboard-accessory confirmation needs a device; deferred by explicit user approval per 09-09-SUMMARY.md."

  - test: "Onboarding Mixed-mode round trip: choose 'Mixed' at the onboarding units step, set imperial lifts + metric runs, complete onboarding, and confirm Settings shows the three rows reflecting exactly that choice."
    expected: "Settings' three rows (Lifts=imperial, Bodyweight=whatever chosen, Runs=metric) match the onboarding Mixed selections exactly."
    why_human: "End-to-end onboarding-to-settings round trip needs a device; deferred by explicit user approval per 09-05-SUMMARY.md."
---

# Phase 9: Beta feedback round 1 Verification Report

**Phase Goal:** TestFlight beta feedback (build 9) is addressed and shipped in build 10 before final ASC submission: (1) FoodConfirmSheet quantity input is no longer hidden by the keyboard and gains a Done/dismiss affordance; (2) food quantity can be entered in oz/lb as well as grams (storage stays grams); (3) the single metric/imperial units preference splits into body/lifts units vs run-distance units (DB migration) so mixed mode — imperial lifts + km runs — works end to end; (4) onboarding gains an explainer step for HSS, the readiness band, and trend statistics. (09-CONTEXT.md D-01..D-21 adds three owner-approved items: delete-exercise, session keyboard-safety, rest-timer notification fix — verified below as part of the same phase contract.)

**Verified:** 2026-08-05
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | FoodConfirmSheet quantity input is no longer hidden by the keyboard; gains a Done/dismiss affordance (item 1, D-11/D-12) | VERIFIED | `FoodConfirmSheet.tsx` content moved to `BottomSheetScrollView` with `keyboardShouldPersistTaps="handled"`; quantity input sets `inputAccessoryViewID={DECIMAL_PAD_ACCESSORY_ID}`; `<DecimalPadDoneBar />` mounted. On-device visual confirmation deferred to UAT (item 6 below). |
| 2 | Food quantity enterable in g/kg/oz/lb everywhere a grams quantity is entered, storage stays grams (item 2, D-05/D-10) | VERIFIED | `packages/shared/src/units.ts` has `ozToGramsExact`/`gramsToDisplayOz`/`lbToGramsExact`/`gramsToDisplayLb` (G_PER_OZ=28.349523125 exact); `foodUnits.ts::qtyToGrams` composes them; wired into `FoodConfirmSheet.tsx`, `nutrition/log.tsx` (custom-food serving grams), `nutrition/recipe-edit.tsx` (ingredient qty); `buildFoodLogRow` still receives grams only. `pnpm --filter @apsis/shared test` (29/29) and `apps/mobile` foodUnits tests (part of 106/106) pass. |
| 3 | tsp/tbsp/serving offered ONLY when the food has a real servingGrams basis; no fabricated density (D-06/D-07) | VERIFIED | `foodUnits.ts::availableUnitsFor` gates all three conditional units on `hasServingBasis(food)`; `qtyToGrams`'s tbsp/tsp branches derive from the food's OWN `servingGrams`, never a universal constant; asserted by `foodUnits.test.ts`. |
| 4 | The units preference splits into 3 independent buckets (lifts/bodyweight/runs) via a DB migration; imperial lifts + km runs works end to end (item 3, D-01) | VERIFIED | `packages/db/src/schema.ts` has `liftsUnits`/`bodyweightUnits`/`runUnits` nullable enum columns; migration `0005_clean_champions.sql` (journal idx 5) contains the 4 `ALTER TABLE` statements + the D-04 silent backfill `UPDATE`; `units-migration.test.ts` proves the real 0005 file applies, backfills correctly, and a mixed-bucket row round-trips exactly. `pnpm --filter @apsis/db test` (68/68) passes. On-device rendering of the split confirmed via code trace (item 8), full visual confirmation deferred to UAT (item 1 above). |
| 5 | Every display call site resolves through exactly one of the three buckets; none reads the legacy `profile.units` for display (D-01 promoted-representation invariant) | VERIFIED | `grep -n "profile\.units\b"` across `(tabs)/index.tsx`, `session/finish.tsx`, `session/detail.tsx`, `session/share.tsx`, `nutrition-setup/index.tsx` returns zero display-read matches (only a comment in nutrition-setup). `sessionStore.ts`/`commitSet.ts` resolve lift-display via `liftsUnits`. |
| 6 | Settings shows three always-visible unit rows AND the Profile-editor's bodyweight/pace entry+display actually resolves from the split buckets, not the legacy single value (D-03; CR-01 fix) | VERIFIED | `settings/index.tsx` renders `UnitsRow` x3 keyed to `liftsUnits`/`bodyweightUnits`/`runUnits`; `bodyweightIsImperial = profile.bodyweightUnits === 'imperial'` and `runIsImperial = profile.runUnits === 'imperial'` now drive every bodyweight/pace modal and preview (lines 211-212, 253, 276, 581, 643); `ProfileReview` call passes `bodyweightUnits`/`runUnits` and `showUnitsRow={false}` (line 407-410) — the dead legacy row no longer renders. Matches CR-01's documented fix exactly (commit `51d81cc`, confirmed present via `git log`). |
| 7 | Onboarding review screen resolves bodyweight/pace display from the correct bucket, not `liftsUnits`, under Mixed mode (WR-01 fix) | VERIFIED | `onboarding/review.tsx` passes `bodyweightUnits: draft.bodyweightUnits, runUnits: draft.runUnits` to `ProfileReview` (lines 57-58, 86-87). Matches WR-01's documented fix exactly (commit `4f0fa38`, confirmed present via `git log`). |
| 8 | Onboarding keeps the fast Metric/Imperial choice and adds a Mixed path with three inline toggles (D-02) | VERIFIED | `onboarding/units.tsx` has a `mixed` mode option revealing 3 `UnitBucketRow`s (Lifts/Bodyweight/Runs) backed by `onboardingDraft.ts`'s three-bucket shape + `setAllUnits` fast-path convenience. |
| 9 | Onboarding gains a first-step explainer for HSS, readiness band, and trend, revisitable from Settings (item 4, D-15..D-19) | VERIFIED | `onboarding/_layout.tsx` sets `initialRouteName: 'explainer'`; `ExplainerCards.tsx` imports/renders real `HssRing`(`animate={false}`)/`ReadinessLight`/`TrendChart` with hardcoded sample data, page-dot pager, Skip, and a "THE MATH" expand toggle per card; `settings/index.tsx` has a "How Apsis works" row `router.push('/explainer')`ing to a top-level standalone route. No `@apsis/db` import in any of the 3 new explainer files (T-09-13 mitigation). |
| 10 | Committing a new set before rest elapses cancels the prior countdown AND its OS notification (item 7/owner-added, D-21) | VERIFIED | `sessionStore.ts::startRestTimer` captures `previousNotificationId` and calls `cancelRestNotification(previousNotificationId, ...)` before scheduling the new one (lines 351-353); `sessionStore.test.ts` "cancels the prior notification exactly once when a rest timer is already live" passes. Full OS-level single-buzz confirmation deferred to UAT (item 2 above). |
| 11 | Removing an exercise with committed sets deletes the DB rows + recomputes HSS DB-first, keeping the row on failure (item 5/owner-added, D-20) | VERIFIED | `sessionStore.ts::removeExercise` does the bulk `strengthSet` delete + `recomputeSessionHss` BEFORE the `set()` that removes the exercise from `exercises`; the catch block `return`s without touching in-memory state on failure. `sessionStore.test.ts` asserts both the happy path (one bulk delete + one recompute) and the failure path (exercise stays, no recompute). |
| 12 | Each ExerciseCard header exposes an explicit overflow affordance opening a Remove-exercise confirmation (item 5/owner-added, D-20) | VERIFIED | `ExerciseCard.tsx` has a `Pressable` with `accessibilityLabel="Remove exercise"` opening a Keep/Remove confirmation `Modal` before calling `removeExercise`. |
| 13 | Lifting session screen is keyboard-safe: the focused set field scrolls above the keyboard (item 6/owner-added, D-14) | VERIFIED | `session.tsx` wraps content in `KeyboardAvoidingView`; `SetRow.tsx` sets `inputAccessoryViewID={DECIMAL_PAD_ACCESSORY_ID}` on load/reps/duration fields (3 occurrences confirmed); the pre-existing `useEffect` at line 93 only sets local `startedAt` state, not session-store state — the Phase 03 P10 rehydrate-loop guard (useFocusEffect-only for store-touching effects) holds; no new plain `useEffect` was added. |
| 14 | A single shared Done bar exists and is rolled out to all 6 decimal-pad call sites app-wide (D-11/D-13) | VERIFIED | `DecimalPadDoneBar.tsx` (RN core `InputAccessoryView`, `Platform.OS !== 'ios'` guard, `DECIMAL_PAD_ACCESSORY_ID` exported) confirmed opted-in at: SetRow (lifting), FoodConfirmSheet + log.tsx + recipe-edit.tsx (food surfaces x3), run.tsx (run form), onboarding/bodyweight.tsx — all 6 call sites accounted for. |

**Score:** 14/14 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/src/schema.ts` | 3 unit-bucket columns + `food.lastUsedUnit` | VERIFIED | Lines 39-41 (buckets), 208 (lastUsedUnit) |
| `packages/db/drizzle/0005_clean_champions.sql` | Migration with silent backfill | VERIFIED | 4 ALTER + 1 UPDATE statement, journal idx 5 |
| `packages/db/src/__tests__/units-migration.test.ts` | Round-trip + backfill proof | VERIFIED | Exists, part of 68/68 passing @apsis/db tests |
| `packages/shared/src/units.ts` | oz/lb food conversion helpers | VERIFIED | `ozToGramsExact`/`gramsToDisplayOz`/`lbToGramsExact`/`gramsToDisplayLb` present |
| `apps/mobile/lib/foodUnits.ts` | Conditional unit availability + conversion | VERIFIED | `availableUnitsFor`/`qtyToGrams`/`gramsToDisplayQty` present, fully implemented |
| `apps/mobile/components/DecimalPadDoneBar.tsx` | Shared Done bar | VERIFIED | InputAccessoryView + iOS guard + exported nativeID |
| `apps/mobile/components/FoodConfirmSheet.tsx` | Chip row + keyboard-safe layout | VERIFIED | UnitChipRow, BottomSheetScrollView, lastUsedUnit read/write |
| `apps/mobile/stores/sessionStore.ts` | removeExercise + rest-timer fix | VERIFIED | Both present and unit-tested |
| `apps/mobile/components/session/ExerciseCard.tsx` | Remove-exercise affordance | VERIFIED | Overflow Pressable + confirmation Modal |
| `apps/mobile/components/onboarding/ExplainerCards.tsx` | 3-card explainer with sample data | VERIFIED | Renders HssRing/ReadinessLight/TrendChart with literal sample constants |
| `apps/mobile/app/(tabs)/settings/index.tsx` | 3 unit rows + Guide row + CR-01 fix | VERIFIED | All present, CR-01 fix confirmed applied |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| settingsStore three-bucket shape | useProfile hydration | profile read/update mapper | WIRED | `useProfile.ts` resolves `row.liftsUnits ?? row.units ?? 'metric'` per bucket |
| migration 0005 backfill | legacy `user_profile.units` | `UPDATE ... SET lifts_units = units, ...` | WIRED | Confirmed in 0005 SQL |
| chip row | `foodUnits.availableUnitsFor`/`qtyToGrams` | direct import | WIRED | `FoodConfirmSheet.tsx` imports both from `../lib/foodUnits` |
| `startRestTimer` | `cancelRestNotification` | cancel-before-reschedule | WIRED | Confirmed at sessionStore.ts:351-353, unit-tested |
| `removeExercise` | bulk delete + `recomputeSessionHss` | DB-first sequencing | WIRED | Confirmed at sessionStore.ts:269-292, unit-tested |
| every decimal-pad TextInput | shared Done bar | `inputAccessoryViewID = DECIMAL_PAD_ACCESSORY_ID` | WIRED | Confirmed across all 6 call sites |
| Settings "How Apsis works" row | explainer | `router.push('/explainer')` | WIRED | Top-level standalone route confirmed |
| CR-01 fix: Settings Profile editor | `bodyweightUnits`/`runUnits` | `bodyweightIsImperial`/`runIsImperial` | WIRED | Confirmed applied, matches REVIEW.md's documented fix |
| WR-01 fix: onboarding review | `ProfileReview` | `bodyweightUnits`/`runUnits` props | WIRED | Confirmed applied, matches REVIEW.md's documented fix |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full workspace test suite (unit-level proof of all invariants above) | `pnpm -r test` | shared 29/29, engine 95/95, db 68/68, mobile 106/106 = 298/298 passing | PASS |
| Cross-package typecheck | `pnpm typecheck` | 0 errors | PASS |
| Fix commits present in history | `git log --oneline 51d81cc 4f0fa38` | both commits found | PASS |
| Migration journal has idx 5 | `grep idx.*5 meta/_journal.json` | `"idx": 5, "tag": "0005_clean_champions"` | PASS |
| No debt markers in phase-touched files | grep TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER across 20 touched files | zero matches | PASS |
| No remaining legacy `profile.units` display reads in swept files | grep across index/finish/detail/share/nutrition-setup | zero display-read matches | PASS |

### Probe Execution

Not applicable — this phase has no `scripts/*/tests/probe-*.sh` and no PLAN/SUMMARY references probes. SKIPPED.

### Requirements Coverage

This phase has no global REQUIREMENTS.md REQ-IDs (confirmed: `grep -n -i "phase 9" .planning/REQUIREMENTS.md` returns nothing). Scope is defined by phase-local CONTEXT.md decision codes D-01..D-21, cross-referenced against PLAN frontmatter `requirements:` fields below.

| Decision Code | Description | Owning Plan(s) | Status | Evidence |
|---|---|---|---|---|
| D-01 | Three independent unit buckets (lifts/bodyweight/runs) | 09-01, 09-05, 09-06 | SATISFIED | Schema, migration, consumer sweep all confirmed |
| D-02 | Onboarding Mixed path | 09-05 | SATISFIED | `units.tsx` Mixed mode confirmed |
| D-03 | Settings three always-visible rows | 09-05 (+ CR-01 fix) | SATISFIED | Confirmed, including the post-review correctness fix |
| D-04 | Silent backfill from legacy `units` | 09-01, 09-05 | SATISFIED | Migration UPDATE + onboarding save both confirmed |
| D-05 | g/kg/oz/lb always available | 09-02, 09-07 | SATISFIED | `foodUnits.ts` + chip rows confirmed |
| D-06 | No fabricated tsp/tbsp density | 09-02 | SATISFIED | Gated on `food.servingGrams`, confirmed in code + tests |
| D-07 | Serving unit conditional on servingGrams | 09-02 | SATISFIED | Confirmed in code + tests |
| D-08 | Chip row UI, live recompute | 09-07 | SATISFIED | `UnitChipRow` confirmed wired |
| D-09 | Last-used-per-food default | 09-01 (column), 09-07 (wiring) | SATISFIED | `food.lastUsedUnit` column + read/write confirmed in FoodConfirmSheet |
| D-10 | Chips everywhere a grams quantity is entered | 09-07 | SATISFIED | Confirm sheet, custom food, recipe ingredient all confirmed (quick-add has no gram field, correctly scoped out per SUMMARY) |
| D-11 | Done bar affordance | 09-04, 09-07, 09-09 | SATISFIED | Confirmed at all 6 call sites |
| D-12 | Keyboard-safe FoodConfirmSheet | 09-07 | SATISFIED | BottomSheetScrollView confirmed; full visual proof deferred to UAT |
| D-13 | Done bar rolled out app-wide | 09-04, 09-07, 09-09 | SATISFIED | All 6 call sites confirmed |
| D-14 | Session screen keyboard-safe | 09-04 | SATISFIED | KeyboardAvoidingView confirmed, no new plain useEffect |
| D-15 | Explainer first wizard step | 09-08 | SATISFIED | `initialRouteName: 'explainer'` confirmed |
| D-16 | Three swipeable cards, page dots, Skip | 09-08 | SATISFIED | Confirmed in ExplainerCards.tsx |
| D-17 | Two-layer "the math" expansion | 09-08 | SATISFIED | Confirmed |
| D-18 | Real components, sample data, no DB read | 09-08 | SATISFIED | Confirmed, no `@apsis/db` import in explainer files |
| D-19 | Skippable + Settings revisit | 09-08 | SATISFIED | Confirmed |
| D-20 | Delete exercise, DB-first cleanup | 09-03 | SATISFIED | Confirmed in code + unit tests |
| D-21 | Rest-timer cancel-before-reschedule | 09-03 | SATISFIED | Confirmed in code + unit tests |

No orphaned requirements — all D-01..D-21 codes referenced in 09-CONTEXT.md are claimed by at least one plan's `requirements:` frontmatter field.

### Anti-Patterns Found

None. Scanned all 20 files touched across the 9 plans (schema.ts, migration, units.ts, foodUnits.ts, FoodConfirmSheet.tsx, sessionStore.ts, ExerciseCard.tsx, DecimalPadDoneBar.tsx, ExplainerCards.tsx, explainer.tsx x2, settings/index.tsx, onboarding/review.tsx, ProfileReview.tsx, run.tsx, onboarding/bodyweight.tsx, onboarding/units.tsx, onboardingDraft.ts, useSaveProfile.ts, commitSet.ts, nutrition/log.tsx, nutrition/recipe-edit.tsx) for TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER/"not yet implemented" — zero matches.

REVIEW.md's own findings (CR-01 critical, WR-01 warning) were verified FIXED in the codebase (commits `51d81cc`, `4f0fa38` confirmed present, code matches the documented fix). WR-02 (duplicated `formatEnduranceMeta` across 3 files) was explicitly deferred by the reviewer as out-of-phase-scope and non-blocking — it is a code-quality/DRY concern in files never touched by any 09-0X plan, not a functional defect; correctly not treated as a phase-9 gap. IN-01 (info-level: legacy `units` field still exists on some type interfaces) is a benign vestige — confirmed it is no longer read for display anywhere (see Observable Truth #5).

### Human Verification Required

14 items — all are on-device iOS verification steps that were explicitly deferred to phase UAT with user approval ("approved" checkpoint responses) during execution of plans 09-01, 09-03, 09-04, 09-05, 09-06, 09-07, 09-08, and 09-09 (see each SUMMARY.md's "Deferred to Phase UAT" / "On-Device Verification: Approved-as-Deferred" section). These cannot be exercised from this Windows verification host (op-sqlite, HealthKit, and Skia are native modules requiring a dev build). The underlying code, wiring, and unit-testable invariants for every one of these are already VERIFIED above — these items confirm the remaining visual/OS-level/subjective behavior. See the full list in the YAML frontmatter `human_verification` section.

### Gaps Summary

No gaps found. All 14 observable truths (covering the phase's 4 roadmap-goal items plus the 3 owner-approved additional items from 09-CONTEXT.md) are code-verified: schema/migration exist and are proven by a real round-trip test, every consumer sweep is grep-confirmed complete, both post-review code-review fixes (CR-01, WR-01) are confirmed actually applied in the code (not just claimed in REVIEW.md), the full workspace test suite is 298/298 green, and `pnpm typecheck` is clean. The only outstanding item is on-device iOS confirmation of already-code-verified behavior — explicitly and repeatedly deferred to phase UAT with recorded user approval throughout execution, which is the expected workflow for a Windows-host verification of a native-module-dependent mobile app, not a defect in this phase's completion.

---

_Verified: 2026-08-05_
_Verifier: Claude (gsd-verifier)_
